const nodemailer = require('nodemailer');

const createTransporter = () => {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      service: process.env.SMTP_SERVICE || 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return null;
};

exports.sendOtpEmail = async (email, otp) => {
  console.log(`\n========================================`);
  console.log(`🔐 RENTTRACKER OTP VERIFICATION CODE`);
  console.log(`📧 To: ${email}`);
  console.log(`🔑 Verification OTP: ${otp}`);
  console.log(`⏱️ Valid for: 5 minutes`);
  console.log(`========================================\n`);

  const transporter = createTransporter();
  if (!transporter) {
    console.log(`ℹ️ SMTP credentials (SMTP_USER & SMTP_PASS) not configured in backend/.env. Using simulated OTP mode.`);
    return {
      sent: false,
      simulated: true,
      reason: 'No SMTP credentials in backend/.env. Configure SMTP_USER and SMTP_PASS to send real emails.',
    };
  }

  try {
    const info = await transporter.sendMail({
      from: `"RentTracker App" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Your RentTracker Verification Code: ${otp}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #0f172a; margin-bottom: 6px;">RentTracker Verification</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 0;">Use the 6-digit verification code below to complete your login:</p>
          <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; padding: 20px; border-radius: 10px; text-align: center; margin: 24px 0;">
            <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #d97706; font-family: monospace;">${otp}</span>
          </div>
          <p style="color: #94a3b8; font-size: 12px; line-height: 1.5;">This code will expire in 5 minutes. If you did not request this code, you can safely ignore this email.</p>
        </div>
      `,
    });
    console.log(`✅ Real email dispatched successfully to ${email}. MessageId: ${info.messageId}`);
    return { sent: true, simulated: false, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ SMTP dispatch failed:`, err);
    return { sent: false, simulated: false, error: err.message };
  }
};
