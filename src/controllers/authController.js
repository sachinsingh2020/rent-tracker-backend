const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { sendOtpEmail } = require('../utils/mailer');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '30d',
  });
};

// @desc    Send 6-digit OTP to Email
// @route   POST /api/auth/send-otp
exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Generate random 6-digit numeric OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete existing OTP for this email
    await Otp.deleteMany({ email: cleanEmail });

    // Save new OTP with 5 minute TTL
    await Otp.create({
      email: cleanEmail,
      otp: otpCode,
    });

    // Send email via mailer
    const mailResult = await sendOtpEmail(cleanEmail, otpCode);

    res.json({
      success: true,
      emailSent: Boolean(mailResult.sent),
      simulated: Boolean(mailResult.simulated),
      message: mailResult.sent
        ? `A 6-digit verification code was sent to ${cleanEmail}. Check your inbox & spam.`
        : mailResult.simulated
        ? `SMTP not configured in backend/.env. For testing, your OTP is: ${otpCode}`
        : `Email delivery issue (${mailResult.error}). For testing, your OTP is: ${otpCode}`,
      devOtp: otpCode,
    });
  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// @desc    Verify OTP and Log in or Register User
// @route   POST /api/auth/verify-otp
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp, name } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and 6-digit OTP code are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = String(otp).trim();

    const record = await Otp.findOne({ email: cleanEmail, otp: cleanOtp });
    if (!record) {
      return res.status(400).json({ error: 'Invalid or expired verification code. Please request a new code.' });
    }

    // Delete used OTP
    await Otp.deleteOne({ _id: record._id });

    // Check if user exists or create new one
    let user = await User.findOne({ email: cleanEmail });
    const isNewUser = !user;
    if (!user) {
      user = await User.create({
        name: name ? name.trim() : cleanEmail.split('@')[0],
        email: cleanEmail,
      });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
      isNewUser,
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    const user = await User.create({ name, email, password });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ error: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Google Sign-in / Social Auth
// @route   POST /api/auth/google
exports.googleAuth = async (req, res) => {
  try {
    const { googleId, email, name, avatar } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required from Google' });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    const isNewUser = !user;

    if (!user) {
      user = await User.create({
        googleId,
        email,
        name: name || 'Google User',
        avatar,
      });
    } else if (!user.googleId) {
      user.googleId = googleId;
      if (avatar) user.avatar = avatar;
      await user.save();
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      token: generateToken(user._id),
      isNewUser,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
