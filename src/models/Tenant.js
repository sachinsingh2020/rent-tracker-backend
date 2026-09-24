const mongoose = require('mongoose');

const TenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tenant name is required'],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room is required'],
    },
    negotiatedRent: {
      type: Number,
      required: [true, 'Negotiated rent amount is required'],
      default: 6000,
    },
    securityDeposit: {
      type: Number,
      default: 0,
    },
    meterNumber: {
      type: String,
      trim: true,
    },
    initialReading: {
      type: Number,
      required: true,
      default: 0,
    },
    latestReading: {
      type: Number,
      required: true,
      default: 0,
    },
    moveInDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['Active', 'Vacated'],
      default: 'Active',
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tenant', TenantSchema);
