const mongoose = require('mongoose');
const Room = require('../models/Room');
const Tenant = require('../models/Tenant');
const MonthlyBill = require('../models/MonthlyBill');
const Setting = require('../models/Setting');

const normalizePhone = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

// @desc    Bulk sync offline SQLite data into MongoDB
// @route   POST /api/sync
exports.syncOfflineData = async (req, res) => {
  try {
    const { rooms = [], tenants = [], bills = [], settings = {} } = req.body;

    const idMap = {
      rooms: {},
      tenants: {},
    };

    const existingTenantCount = await Tenant.countDocuments();
    const existingRoomCount = await Room.countDocuments();
    const cloudHasRealData = existingTenantCount > 0 || existingRoomCount > 0;

    // Filter out dummy starter placeholder seed if cloud already contains real data
    const cleanTenants = tenants.filter((t) => {
      if (cloudHasRealData && t.id === 'tenant_1' && t.name === 'Ramesh Kumar') {
        return false;
      }
      return true;
    });

    const cleanBills = bills.filter((b) => {
      if (cloudHasRealData && b.id === 'bill_1' && b.tenantId === 'tenant_1') {
        return false;
      }
      return true;
    });

    // 1. Sync Rooms (Handle room number conflicts gracefully)
    for (const r of rooms) {
      if (cloudHasRealData && (r.id === 'room_101' || r.id === 'room_102') && r.notes === 'Corner room with balcony') {
        const existingSameRoom = await Room.findOne({ roomNumber: String(r.roomNumber).trim() });
        if (existingSameRoom) {
          idMap.rooms[r.id] = existingSameRoom._id;
          idMap.rooms[r.roomNumber] = existingSameRoom._id;
          continue;
        }
      }

      let roomDoc;
      if (r.cloudId && mongoose.isValidObjectId(r.cloudId)) {
        roomDoc = await Room.findById(r.cloudId);
      }
      if (!roomDoc && r.roomNumber) {
        roomDoc = await Room.findOne({ roomNumber: String(r.roomNumber).trim() });
      }

      if (roomDoc) {
        roomDoc.floor = r.floor || roomDoc.floor;
        roomDoc.defaultRent = Number(r.defaultRent) || roomDoc.defaultRent;
        if (roomDoc.status !== 'Occupied' && r.status) {
          roomDoc.status = r.status;
        }
        if (r.notes && !roomDoc.notes) {
          roomDoc.notes = r.notes;
        }
        await roomDoc.save();
      } else {
        roomDoc = await Room.create({
          roomNumber: String(r.roomNumber).trim(),
          floor: r.floor || 'Ground Floor',
          defaultRent: Number(r.defaultRent) || 6000,
          status: r.status || 'Available',
          notes: r.notes || '',
        });
      }
      if (r.id) idMap.rooms[r.id] = roomDoc._id;
      if (r.localId) idMap.rooms[r.localId] = roomDoc._id;
      if (r.roomNumber) idMap.rooms[r.roomNumber] = roomDoc._id;
    }

    // 2. Sync Tenants: STRICTLY MATCH AND MERGE BY 10-DIGIT PHONE NUMBER!
    for (const t of cleanTenants) {
      let tenantDoc = null;
      const cleanPhone = normalizePhone(t.phone);

      // Priority 1: Match by normalized 10-digit phone number across all database tenants
      if (cleanPhone && cleanPhone.length === 10) {
        const allTenantsInDb = await Tenant.find();
        tenantDoc = allTenantsInDb.find((dbT) => normalizePhone(dbT.phone) === cleanPhone);
      }

      // Priority 2: Match by cloudId if valid ObjectId
      if (!tenantDoc && t.cloudId && mongoose.isValidObjectId(t.cloudId)) {
        tenantDoc = await Tenant.findById(t.cloudId);
      }

      // Priority 3: Fallback to exact name match ONLY IF phone number is absent
      if (!tenantDoc && !cleanPhone && t.name) {
        tenantDoc = await Tenant.findOne({ name: t.name.trim() });
      }

      // Resolve target room
      let targetRoomId = idMap.rooms[t.roomId || t.localRoomId];
      if (!targetRoomId && mongoose.isValidObjectId(t.roomId)) {
        targetRoomId = t.roomId;
      }
      if (!targetRoomId && t.room?.roomNumber) {
        targetRoomId = idMap.rooms[t.room.roomNumber];
      }
      if (!targetRoomId && tenantDoc?.roomId) {
        targetRoomId = tenantDoc.roomId;
      }
      if (!targetRoomId) {
        const anyRoom = await Room.findOne();
        if (anyRoom) targetRoomId = anyRoom._id;
      }

      if (tenantDoc) {
        // Matched existing tenant -> non-destructively merge details
        tenantDoc.name = t.name || tenantDoc.name;
        tenantDoc.phone = t.phone || tenantDoc.phone;
        tenantDoc.email = t.email || tenantDoc.email;
        if (t.photoUrl && !tenantDoc.photoUrl) {
          tenantDoc.photoUrl = t.photoUrl;
          tenantDoc.photoPublicId = t.photoPublicId || '';
        }
        tenantDoc.negotiatedRent = Number(t.negotiatedRent) || tenantDoc.negotiatedRent;
        tenantDoc.meterNumber = t.meterNumber || tenantDoc.meterNumber;
        tenantDoc.latestReading = Math.max(
          Number(tenantDoc.latestReading) || 0,
          Number(t.latestReading) || 0
        );
        if (t.status === 'Active' || tenantDoc.status === 'Active') {
          tenantDoc.status = 'Active';
        }
        if (targetRoomId) {
          tenantDoc.roomId = targetRoomId;
        }
        await tenantDoc.save();
      } else if (targetRoomId && t.name) {
        // Brand new tenant from offline device
        tenantDoc = await Tenant.create({
          name: t.name.trim(),
          phone: t.phone || '',
          email: t.email || '',
          photoUrl: t.photoUrl || '',
          photoPublicId: t.photoPublicId || '',
          roomId: targetRoomId,
          negotiatedRent: Number(t.negotiatedRent) || 6000,
          securityDeposit: Number(t.securityDeposit) || 0,
          meterNumber: t.meterNumber || '',
          initialReading: Number(t.initialReading) || 0,
          latestReading: Number(t.latestReading) || Number(t.initialReading) || 0,
          moveInDate: t.moveInDate || new Date(),
          status: t.status || 'Active',
          notes: t.notes || '',
        });
      }

      if (tenantDoc) {
        if (t.id) idMap.tenants[t.id] = tenantDoc._id;
        if (t.localId) idMap.tenants[t.localId] = tenantDoc._id;
        if (cleanPhone) idMap.tenants[cleanPhone] = tenantDoc._id;
        if (t.name) idMap.tenants[t.name] = tenantDoc._id;
      }
    }

    // 3. Resolve Room Conflicts & Reconcile Room Occupancy Status
    // Ensures occupied count NEVER exceeds room count (no 4/2 bug)
    const allRooms = await Room.find();
    for (const r of allRooms) {
      const activeTenantsInRoom = await Tenant.find({
        roomId: r._id,
        status: 'Active',
      }).sort({ updatedAt: -1, moveInDate: -1, createdAt: -1 });

      if (activeTenantsInRoom.length === 0) {
        r.status = 'Available';
        await r.save();
      } else if (activeTenantsInRoom.length === 1) {
        r.status = 'Occupied';
        await r.save();
      } else {
        // Room Conflict: Multiple active tenants assigned to the same room
        // The newest active tenant stays Active, others are set to Vacated
        const [keepActive, ...conflicts] = activeTenantsInRoom;
        r.status = 'Occupied';
        await r.save();

        for (const conf of conflicts) {
          conf.status = 'Vacated';
          await conf.save();
        }
      }
    }

    // 4. Sync Monthly Bills (enforcing 8-year retention policy & non-destructive merge)
    const cutoff8Years = new Date();
    cutoff8Years.setFullYear(cutoff8Years.getFullYear() - 8);

    for (const b of cleanBills) {
      const billDateObj = b.billDate ? new Date(b.billDate) : new Date();
      if (billDateObj < cutoff8Years) {
        continue;
      }

      let targetTenantId = idMap.tenants[b.tenantId || b.localTenantId];
      if (!targetTenantId && mongoose.isValidObjectId(b.tenantId)) {
        targetTenantId = b.tenantId;
      }

      let targetRoomId = idMap.rooms[b.roomId || b.localRoomId];
      if (!targetRoomId && mongoose.isValidObjectId(b.roomId)) {
        targetRoomId = b.roomId;
      }

      if (targetTenantId && targetRoomId) {
        let billDoc;
        if (b.cloudId && mongoose.isValidObjectId(b.cloudId)) {
          billDoc = await MonthlyBill.findById(b.cloudId);
        }
        if (!billDoc) {
          billDoc = await MonthlyBill.findOne({
            tenantId: targetTenantId,
            monthYear: b.monthYear,
          });
        }

        if (!billDoc) {
          await MonthlyBill.create({
            tenantId: targetTenantId,
            roomId: targetRoomId,
            monthYear: b.monthYear,
            billDate: billDateObj,
            roomRentAmount: Number(b.roomRentAmount) || 0,
            roomRentStatus: b.roomRentStatus || 'Pending',
            previousReading: Number(b.previousReading) || 0,
            currentReading: Number(b.currentReading) || 0,
            unitsConsumed: Number(b.unitsConsumed) || 0,
            ratePerUnit: Number(b.ratePerUnit) || 11,
            electricityAmount: Number(b.electricityAmount) || 0,
            electricityStatus: b.electricityStatus || 'Pending',
            meterPhotoUrl: b.meterPhotoUrl || '',
            meterPhotoPublicId: b.meterPhotoPublicId || '',
            totalDue: Number(b.totalDue) || 0,
            isFullyPaid: b.roomRentStatus === 'Paid' && b.electricityStatus === 'Paid',
            notes: b.notes || '',
          });
        } else {
          let changed = false;
          if (b.roomRentStatus === 'Paid' && billDoc.roomRentStatus !== 'Paid') {
            billDoc.roomRentStatus = 'Paid';
            billDoc.roomRentPaidDate = b.roomRentPaidDate || new Date();
            changed = true;
          }
          if (b.electricityStatus === 'Paid' && billDoc.electricityStatus !== 'Paid') {
            billDoc.electricityStatus = 'Paid';
            billDoc.electricityPaidDate = b.electricityPaidDate || new Date();
            changed = true;
          }
          if (!billDoc.meterPhotoUrl && b.meterPhotoUrl) {
            billDoc.meterPhotoUrl = b.meterPhotoUrl;
            billDoc.meterPhotoPublicId = b.meterPhotoPublicId || '';
            changed = true;
          }
          if (changed) {
            billDoc.isFullyPaid = billDoc.roomRentStatus === 'Paid' && billDoc.electricityStatus === 'Paid';
            await billDoc.save();
          }
        }
      }
    }

    // 5. Sync Settings
    if (settings && (settings.defaultElectricityRate || settings.defaultRoomRent || settings.ownerName || settings.upiId)) {
      await Setting.findOneAndUpdate(
        { key: 'global_defaults' },
        {
          defaultElectricityRate: Number(settings.defaultElectricityRate) || 11,
          defaultRoomRent: Number(settings.defaultRoomRent) || 6000,
          ownerName: String(settings.ownerName || '').trim(),
          upiId: String(settings.upiId || '').trim(),
        },
        { upsert: true, new: true }
      );
    }

    res.json({
      success: true,
      message: 'Offline data successfully synced and merged into MongoDB Atlas',
      idMap,
    });
  } catch (error) {
    console.error('Sync Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// @desc    Check whether cloud account already contains existing data
// @route   GET /api/sync/status
exports.getSyncStatus = async (req, res) => {
  try {
    const roomsCount = await Room.countDocuments();
    const tenantsCount = await Tenant.countDocuments();
    const billsCount = await MonthlyBill.countDocuments();

    res.json({
      hasData: roomsCount > 0 || tenantsCount > 0 || billsCount > 0,
      roomsCount,
      tenantsCount,
      billsCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Export all cloud data to replace or update local device storage
// @route   GET /api/sync/export
exports.getExportData = async (req, res) => {
  try {
    const cutoff8Years = new Date();
    cutoff8Years.setFullYear(cutoff8Years.getFullYear() - 8);

    const cutoff12Months = new Date();
    cutoff12Months.setMonth(cutoff12Months.getMonth() - 12);

    const rooms = await Room.find().sort({ roomNumber: 1 }).lean();
    const tenants = await Tenant.find().lean();
    const rawBills = await MonthlyBill.find({ billDate: { $gte: cutoff8Years } })
      .sort({ billDate: -1, createdAt: -1 })
      .lean();

    const bills = rawBills.map((b) => ({
      ...b,
      meterPhotoUrl: new Date(b.billDate || b.createdAt) < cutoff12Months ? '' : b.meterPhotoUrl,
    }));

    const settingDoc = await Setting.findOne({ key: 'global_defaults' }).lean();

    res.json({
      rooms,
      tenants,
      bills,
      settings: settingDoc
        ? {
            defaultElectricityRate: settingDoc.defaultElectricityRate || 11,
            defaultRoomRent: settingDoc.defaultRoomRent || 6000,
            ownerName: settingDoc.ownerName || '',
            upiId: settingDoc.upiId || '',
          }
        : { defaultElectricityRate: 11, defaultRoomRent: 6000, ownerName: '', upiId: '' },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
