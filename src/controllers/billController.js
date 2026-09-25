const MonthlyBill = require('../models/MonthlyBill');
const Tenant = require('../models/Tenant');
const { purgeExpiredData, runCleanupThrottled } = require('../utils/cleanupService');

// @desc    Create new monthly bill (Room Rent + Electricity)
// @route   POST /api/bills
exports.createBill = async (req, res) => {
  try {
    const {
      tenantId,
      monthYear,
      billDate,
      roomRentAmount,
      roomRentStatus = 'Pending',
      previousReading,
      currentReading,
      ratePerUnit = 11,
      electricityStatus = 'Pending',
      meterPhotoUrl = '',
      meterPhotoPublicId = '',
      notes = '',
    } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant is required' });
    }

    const userQuery = req.user ? { userId: req.user._id } : {};
    const tenant = await Tenant.findOne({ _id: tenantId, ...userQuery });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const prev = Number(previousReading) ?? Number(tenant.latestReading) ?? Number(tenant.initialReading) ?? 0;
    const curr = Number(currentReading);
    const rate = Number(ratePerUnit) || 11;
    const rent = Number(roomRentAmount) ?? Number(tenant.negotiatedRent) ?? 0;

    if (isNaN(curr) || curr < prev) {
      return res.status(400).json({
        error: `Current reading (${curr}) cannot be less than previous reading (${prev})`,
      });
    }

    const unitsConsumed = Math.round((curr - prev) * 100) / 100;
    const electricityAmount = Math.round(unitsConsumed * rate * 100) / 100;
    const totalDue = Math.round((rent + electricityAmount) * 100) / 100;

    const bill = await MonthlyBill.create({
      userId: req.user ? req.user._id : null,
      tenantId,
      roomId: tenant.roomId,
      monthYear: monthYear || new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      billDate: billDate || new Date(),
      roomRentAmount: rent,
      roomRentStatus,
      roomRentPaidDate: roomRentStatus === 'Paid' ? new Date() : null,
      previousReading: prev,
      currentReading: curr,
      unitsConsumed,
      ratePerUnit: rate,
      electricityAmount,
      electricityStatus,
      electricityPaidDate: electricityStatus === 'Paid' ? new Date() : null,
      meterPhotoUrl,
      meterPhotoPublicId,
      totalDue,
      isFullyPaid: roomRentStatus === 'Paid' && electricityStatus === 'Paid',
      notes,
    });

    // Update tenant's latest reading
    tenant.latestReading = curr;
    await tenant.save();

    // Trigger throttled background data retention cleanup
    runCleanupThrottled();

    res.status(201).json(bill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Update payment status for room rent and/or electricity
// @route   PATCH /api/bills/:id/payment
exports.updatePaymentStatus = async (req, res) => {
  try {
    const userQuery = req.user ? { userId: req.user._id } : {};
    const { roomRentStatus, electricityStatus } = req.body;
    const bill = await MonthlyBill.findOne({ _id: req.params.id, ...userQuery });

    if (!bill) return res.status(404).json({ error: 'Bill record not found' });

    if (roomRentStatus) {
      bill.roomRentStatus = roomRentStatus;
      bill.roomRentPaidDate = roomRentStatus === 'Paid' ? new Date() : null;
    }

    if (electricityStatus) {
      bill.electricityStatus = electricityStatus;
      bill.electricityPaidDate = electricityStatus === 'Paid' ? new Date() : null;
    }

    bill.isFullyPaid = bill.roomRentStatus === 'Paid' && bill.electricityStatus === 'Paid';
    await bill.save();

    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Delete a bill record
// @route   DELETE /api/bills/:id
exports.deleteBill = async (req, res) => {
  try {
    const userQuery = req.user ? { userId: req.user._id } : {};
    const bill = await MonthlyBill.findOne({ _id: req.params.id, ...userQuery });
    if (!bill) return res.status(404).json({ error: 'Bill record not found' });

    const tenantId = bill.tenantId;
    await bill.deleteOne();

    // Recalculate tenant's latestReading based on remaining bills or initialReading
    if (tenantId) {
      const remainingBills = await MonthlyBill.find({ tenantId, ...userQuery }).sort({ billDate: -1, createdAt: -1 });
      const tenant = await Tenant.findOne({ _id: tenantId, ...userQuery });
      if (tenant) {
        if (remainingBills.length > 0) {
          tenant.latestReading = remainingBills[0].currentReading;
        } else {
          tenant.latestReading = tenant.initialReading || 0;
        }
        await tenant.save();
      }
    }

    res.json({ success: true, message: 'Bill removed and meter reading rolled back successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Enforce retention rules (Purge >8 yrs bills & >12 mos photos)
// @route   POST /api/bills/cleanup or /api/cleanup
exports.cleanExpiredData = async (req, res) => {
  try {
    const report = await purgeExpiredData();
    res.json(report);
  } catch (error) {
    console.error('Manual cleanup error:', error);
    res.status(500).json({ error: error.message });
  }
};
