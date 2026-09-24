const MonthlyBill = require('../models/MonthlyBill');
const Tenant = require('../models/Tenant');

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
      notes = '',
    } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant is required' });
    }

    const tenant = await Tenant.findById(tenantId);
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
      totalDue,
      isFullyPaid: roomRentStatus === 'Paid' && electricityStatus === 'Paid',
      notes,
    });

    // Update tenant's latest reading
    tenant.latestReading = curr;
    await tenant.save();

    res.status(201).json(bill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Update payment status for room rent and/or electricity
// @route   PATCH /api/bills/:id/payment
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { roomRentStatus, electricityStatus } = req.body;
    const bill = await MonthlyBill.findById(req.params.id);

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
    const bill = await MonthlyBill.findById(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill record not found' });

    await bill.deleteOne();
    res.json({ success: true, message: 'Bill removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
