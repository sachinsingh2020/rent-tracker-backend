const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    key: {
      type: String,
      required: true,
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
    ownerName: {
      type: String,
      default: '',
    },
    upiId: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', SettingSchema);
