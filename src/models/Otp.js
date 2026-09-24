const mongoose = require('mongoose');

const OtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 300, // Document auto-deletes from MongoDB after 5 minutes!
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Otp', OtpSchema);
