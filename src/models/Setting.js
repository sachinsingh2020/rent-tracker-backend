const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'global_defaults',
    },
    defaultElectricityRate: {
      type: Number,
      default: 11.00,
    },
    defaultRoomRent: {
      type: Number,
      default: 6000.00,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', SettingSchema);
