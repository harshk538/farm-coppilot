import dotenv from 'dotenv';
dotenv.config();
import nodemailer from 'nodemailer';

console.log('--- Testing Email ---');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_APP_PASSWORD:', process.env.EMAIL_APP_PASSWORD ? `${process.env.EMAIL_APP_PASSWORD.substring(0,4)}...` : 'MISSING');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

try {
  // First verify the connection
  await transporter.verify();
  console.log('✅ Gmail connection verified!');

  const info = await transporter.sendMail({
    from: `"Farm Copilot Alerts" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: '🚨 [CRITICAL] Severe Thunderstorm Warning — Farm Copilot Alert',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#fff;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:28px 32px;">
          <span style="font-size:28px;">🌾</span>
          <span style="font-size:18px;font-weight:700;color:#fff;">Farm Copilot</span>
          <p style="color:#888;font-size:13px;">Weather Alert System</p>
        </div>
        <div style="padding:28px 32px;">
          <h2 style="color:#ef4444;">🌪️ Severe Thunderstorm Warning</h2>
          <p style="color:#ccc;">Hi <strong>Harsh</strong>,</p>
          <p style="color:#aaa;">A severe weather event has been detected. Take immediate action.</p>
          <div style="background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.3);border-radius:10px;padding:16px;">
            <p style="color:#a78bfa;font-weight:700;">🌱 FARM ACTION REQUIRED</p>
            <p style="color:#d4c2ff;">Move livestock to shelter immediately. Secure greenhouse structures.</p>
          </div>
        </div>
        <div style="padding:16px 32px;text-align:center;">
          <p style="color:#555;font-size:11px;">Farm Copilot — AI-Powered Agricultural Intelligence</p>
        </div>
      </div>
    `,
  });
  
  console.log('✅ EMAIL SENT SUCCESSFULLY!');
  console.log('Message ID:', info.messageId);
  console.log('Accepted by:', info.accepted);
} catch (err) {
  console.error('❌ EMAIL FAILED:', err.message);
  console.error('Error code:', err.code);
  console.error('Full error:', err);
}
