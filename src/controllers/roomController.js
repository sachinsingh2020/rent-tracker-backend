const Room = require('../models/Room');
const Tenant = require('../models/Tenant');

// @desc    Get all rooms with current active tenant
// @route   GET /api/rooms
exports.getRooms = async (req, res) => {
  try {
    const userQuery = req.user ? { userId: req.user._id } : {};
    const rooms = await Room.find(userQuery).sort({ roomNumber: 1 }).lean();

    // Attach active tenant info to each room
    const enrichedRooms = await Promise.all(
      rooms.map(async (room) => {
        const activeTenant = await Tenant.findOne({
          roomId: room._id,
          status: 'Active',
          ...userQuery,
        })
          .sort({ updatedAt: -1, createdAt: -1 })
          .select('name phone photoUrl negotiatedRent latestReading initialReading moveInDate');
        return {
          ...room,
          activeTenant: activeTenant || null,
        };
      })
    );

    res.json(enrichedRooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Create new room
// @route   POST /api/rooms
exports.createRoom = async (req, res) => {
  try {
    const { roomNumber, floor, defaultRent, notes } = req.body;

    if (!roomNumber) {
      return res.status(400).json({ error: 'Room number is required' });
    }

    const room = await Room.create({
      userId: req.user ? req.user._id : null,
      roomNumber,
      floor: floor || 'Ground Floor',
      defaultRent: Number(defaultRent) || 6000,
      notes,
    });

    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Update room details
// @route   PUT /api/rooms/:id
exports.updateRoom = async (req, res) => {
  try {
    const userQuery = req.user ? { userId: req.user._id } : {};
    const room = await Room.findOneAndUpdate(
      { _id: req.params.id, ...userQuery },
      req.body,
      { new: true, runValidators: true }
    );
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Delete a room
// @route   DELETE /api/rooms/:id
exports.deleteRoom = async (req, res) => {
  try {
    const userQuery = req.user ? { userId: req.user._id } : {};
    const room = await Room.findOne({ _id: req.params.id, ...userQuery });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Clean up all associated tenants and bills of this room
    const MonthlyBill = require('../models/MonthlyBill');
    await Tenant.deleteMany({ roomId: room._id, ...userQuery });
    await MonthlyBill.deleteMany({ roomId: room._id, ...userQuery });

    await room.deleteOne();
    res.json({ success: true, message: 'Room and its associated records removed successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
