const Setting = require('../models/Setting');

// @desc    Get default pricing & settings
// @route   GET /api/settings
exports.getSettings = async (req, res) => {
  try {
    const userId = req.user ? req.user._id : null;
    const settingQuery = userId ? { userId } : { key: 'global_defaults' };

    let setting = await Setting.findOne(settingQuery);
    if (!setting) {
      setting = await Setting.create({
        userId,
        key: userId ? `user_${userId}` : 'global_defaults',
        defaultElectricityRate: Number(process.env.DEFAULT_ELECTRICITY_RATE) || 11.0,
        defaultRoomRent: Number(process.env.DEFAULT_ROOM_RENT) || 6000.0,
      });
    }
    res.json(setting);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Update default pricing
// @route   PUT /api/settings
exports.updateSettings = async (req, res) => {
  try {
    const userId = req.user ? req.user._id : null;
    const settingQuery = userId ? { userId } : { key: 'global_defaults' };
    const { defaultElectricityRate, defaultRoomRent, ownerName, upiId } = req.body;

    let setting = await Setting.findOne(settingQuery);
    if (!setting) {
      setting = new Setting({
        userId,
        key: userId ? `user_${userId}` : 'global_defaults',
      });
    }

    if (defaultElectricityRate !== undefined) {
      setting.defaultElectricityRate = Number(defaultElectricityRate);
    }
    if (defaultRoomRent !== undefined) {
      setting.defaultRoomRent = Number(defaultRoomRent);
    }
    if (ownerName !== undefined) {
      setting.ownerName = String(ownerName).trim();
    }
    if (upiId !== undefined) {
      setting.upiId = String(upiId).trim();
    }

    await setting.save();
    res.json(setting);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
