const Setting = require('../models/Setting');

// @desc    Get default pricing & settings
// @route   GET /api/settings
exports.getSettings = async (req, res) => {
  try {
    let setting = await Setting.findOne({ key: 'global_defaults' });
    if (!setting) {
      setting = await Setting.create({
        key: 'global_defaults',
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
    const { defaultElectricityRate, defaultRoomRent } = req.body;

    let setting = await Setting.findOne({ key: 'global_defaults' });
    if (!setting) {
      setting = new Setting({ key: 'global_defaults' });
    }

    if (defaultElectricityRate !== undefined) {
      setting.defaultElectricityRate = Number(defaultElectricityRate);
    }
    if (defaultRoomRent !== undefined) {
      setting.defaultRoomRent = Number(defaultRoomRent);
    }

    await setting.save();
    res.json(setting);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
