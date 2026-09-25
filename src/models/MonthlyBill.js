const mongoose = require('mongoose');

const MonthlyBillSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    monthYear: {
      type: String,
      required: true, // e.g. "September 2026"
    },
    billDate: {
      type: Date,
      default: Date.now,
    },

    // 🏠 Room Rent Tracking
    roomRentAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    roomRentStatus: {
      type: String,
      enum: ['Pending', 'Paid'],
      default: 'Pending',
    },
    roomRentPaidDate: {
      type: Date,
    },

    // ⚡ Electricity Tracking
    previousReading: {
      type: Number,
      required: true,
      default: 0,
    },
    currentReading: {
      type: Number,
      required: true,
      default: 0,
    },
    unitsConsumed: {
      type: Number,
      required: true,
      default: 0,
    },
    ratePerUnit: {
      type: Number,
      required: true,
      default: 11,
    },
    electricityAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    electricityStatus: {
      type: String,
      enum: ['Pending', 'Paid'],
      default: 'Pending',
    },
    electricityPaidDate: {
      type: Date,
    },
    meterPhotoUrl: {
      type: String,
      default: '',
    },
    meterPhotoPublicId: {
      type: String,
      default: '',
    },

    // 💰 Totals
    totalDue: {
      type: Number,
      required: true,
    },
    isFullyPaid: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Optimize retention queries and tenant billing history
MonthlyBillSchema.index({ billDate: 1 });
MonthlyBillSchema.index({ tenantId: 1, billDate: -1 });

// Auto-update isFullyPaid before save
MonthlyBillSchema.pre('save', function (next) {
  this.isFullyPaid = this.roomRentStatus === 'Paid' && this.electricityStatus === 'Paid';
  next();
});

module.exports = mongoose.model('MonthlyBill', MonthlyBillSchema);
