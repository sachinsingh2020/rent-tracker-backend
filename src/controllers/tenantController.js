const Tenant = require('../models/Tenant');
const Room = require('../models/Room');
const MonthlyBill = require('../models/MonthlyBill');

// @desc    Get all tenants with room and pending dues calculation
// @route   GET /api/tenants
exports.getTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find()
      .populate('roomId', 'roomNumber floor defaultRent')
      .sort({ createdAt: -1 })
      .lean();

    const cutoff8Years = new Date();
    cutoff8Years.setFullYear(cutoff8Years.getFullYear() - 8);

    // Compute pending room rent dues & electricity dues for each tenant (within 8-year retention window)
    const enrichedTenants = await Promise.all(
      tenants.map(async (tenant) => {
        const bills = await MonthlyBill.find({
          tenantId: tenant._id,
          billDate: { $gte: cutoff8Years },
        }).lean();

        let pendingRent = 0;
        let pendingElectricity = 0;

        bills.forEach((b) => {
          if (b.roomRentStatus === 'Pending') {
            pendingRent += Number(b.roomRentAmount) || 0;
          }
          if (b.electricityStatus === 'Pending') {
            pendingElectricity += Number(b.electricityAmount) || 0;
          }
        });

        return {
          ...tenant,
          pendingRent,
          pendingElectricity,
          totalPendingDue: pendingRent + pendingElectricity,
          totalBillsCount: bills.length,
        };
      })
    );

    res.json(enrichedTenants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Get single tenant by ID with all bills (newest first, 8-year history, 12-month photo limit)
// @route   GET /api/tenants/:id
exports.getTenantById = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id)
      .populate('roomId', 'roomNumber floor defaultRent')
      .lean();

    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const cutoff8Years = new Date();
    cutoff8Years.setFullYear(cutoff8Years.getFullYear() - 8);

    const cutoff12Months = new Date();
    cutoff12Months.setMonth(cutoff12Months.getMonth() - 12);

    // Fetch monthly bills strictly within the last 8 years, newest first
    const rawBills = await MonthlyBill.find({
      tenantId: tenant._id,
      billDate: { $gte: cutoff8Years },
    })
      .sort({ billDate: -1, createdAt: -1 })
      .lean();

    // Enforce 12-month retention on meter photos (hide photos older than 12 months)
    const bills = rawBills.map((b) => {
      const isPhotoExpired = new Date(b.billDate || b.createdAt) < cutoff12Months;
      return {
        ...b,
        meterPhotoUrl: isPhotoExpired ? '' : b.meterPhotoUrl,
      };
    });

    let pendingRent = 0;
    let pendingElectricity = 0;

    bills.forEach((b) => {
      if (b.roomRentStatus === 'Pending') pendingRent += Number(b.roomRentAmount) || 0;
      if (b.electricityStatus === 'Pending') pendingElectricity += Number(b.electricityAmount) || 0;
    });

    res.json({
      tenant: {
        ...tenant,
        pendingRent,
        pendingElectricity,
        totalPendingDue: pendingRent + pendingElectricity,
      },
      bills,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Register a new tenant in a room
// @route   POST /api/tenants
exports.createTenant = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      photoUrl,
      photoPublicId,
      roomId,
      negotiatedRent,
      securityDeposit,
      meterNumber,
      initialReading,
      moveInDate,
      notes,
    } = req.body;

    if (!name || !roomId) {
      return res.status(400).json({ error: 'Tenant name and room are required' });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Selected room not found' });

    const tenant = await Tenant.create({
      name,
      phone,
      email,
      photoUrl: photoUrl || '',
      photoPublicId: photoPublicId || '',
      roomId,
      negotiatedRent: Number(negotiatedRent) || room.defaultRent,
      securityDeposit: Number(securityDeposit) || 0,
      meterNumber: meterNumber || `MTR-${room.roomNumber}`,
      initialReading: Number(initialReading) || 0,
      latestReading: Number(initialReading) || 0,
      moveInDate: moveInDate || new Date(),
      status: 'Active',
      notes,
    });

    // Mark room as occupied
    room.status = 'Occupied';
    await room.save();

    res.status(201).json(tenant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Update tenant details
// @route   PUT /api/tenants/:id
exports.updateTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Vacate tenant (mark Vacated and free room)
// @route   POST /api/tenants/:id/vacate
exports.vacateTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    tenant.status = 'Vacated';
    await tenant.save();

    // Check if any other active tenant in the same room
    const otherActive = await Tenant.findOne({ roomId: tenant.roomId, status: 'Active' });
    if (!otherActive) {
      await Room.findByIdAndUpdate(tenant.roomId, { status: 'Available' });
    }

    res.json({ success: true, message: 'Tenant marked as vacated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
