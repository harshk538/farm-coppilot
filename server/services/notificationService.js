import nodemailer from 'nodemailer';
import axios from 'axios';

// Transporter is created fresh on each call so it always reads
// the latest env vars (avoids "Missing credentials" on cold start)
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
}

/**
 * Sends both an email and SMS alert to the given user.
 * @param {Object} user   - { name, email, phone }
 * @param {Object} alert  - { title, severity, detail, farmAction, timeWindow }
 */
export async function sendAlertNotification(user, alert) {
  const severityLabel = (alert.severity || 'info').toUpperCase();
  const results = { email: null, sms: null };

  // ── Email ────────────────────────────────────────────────────────────────
  try {
    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#fff;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:28px 32px;border-bottom:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:28px;">🌾</span>
            <span style="font-size:18px;font-weight:700;color:#fff;letter-spacing:-0.3px;">Farm Copilot</span>
          </div>
          <p style="margin:8px 0 0;color:#888;font-size:13px;">Weather Alert System</p>
        </div>
        <div style="padding:28px 32px;">
          <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:16px 20px;margin-bottom:20px;">
            <span style="font-size:10px;font-weight:700;color:#ef4444;letter-spacing:1px;">${severityLabel} ALERT</span>
            <h2 style="margin:6px 0 0;font-size:20px;font-weight:700;color:#fff;">${alert.icon || '⚠️'} ${alert.title}</h2>
          </div>
          <p style="color:#ccc;font-size:14px;margin:0 0 8px;">Hi <strong>${user.name}</strong>,</p>
          <p style="color:#aaa;font-size:14px;line-height:1.6;margin:0 0 20px;">
            A severe weather event has been detected in your area. Please take immediate action to protect your farm.
          </p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#666;font-size:12px;font-weight:600;text-transform:uppercase;width:120px;">Time Window</td>
              <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#e2e8f0;font-size:13px;">${alert.timeWindow || 'Imminent'}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#666;font-size:12px;font-weight:600;text-transform:uppercase;">Details</td>
              <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#e2e8f0;font-size:13px;">${alert.detail || '-'}</td>
            </tr>
          </table>
          <div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:10px;padding:16px 20px;">
            <p style="font-size:10px;font-weight:700;color:#a78bfa;letter-spacing:1px;margin:0 0 8px;">🌱 FARM ACTION REQUIRED</p>
            <p style="color:#d4c2ff;font-size:13px;line-height:1.6;margin:0;">${alert.farmAction || 'Take protective measures for your crops and livestock.'}</p>
          </div>
        </div>
        <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
          <p style="color:#555;font-size:11px;margin:0;">Farm Copilot — AI-Powered Agricultural Intelligence</p>
        </div>
      </div>
    `;

    await createTransporter().sendMail({
      from: `"Farm Copilot Alerts" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `🚨 [${severityLabel}] ${alert.title} — Farm Copilot Alert`,
      html: emailHtml,
    });
    results.email = 'sent';
    console.log(`✅ Email alert sent to ${user.email}`);
  } catch (err) {
    results.email = 'failed';
    console.error('❌ Email send error:', err.message);
  }

  // ── SMS via Fast2SMS ──────────────────────────────────────────────────────
  try {
    const smsBody = 
      `Farm Copilot ALERT\n` +
      `[${severityLabel}] ${alert.title}\n` +
      `${alert.timeWindow || ''}\n` +
      `${alert.detail || ''}`;

    // Clean up phone number (remove +91 for Fast2SMS as they prefer 10 digits for Indian numbers)
    let phoneNum = user.phone.replace(/\D/g, '');
    if (phoneNum.length === 12 && phoneNum.startsWith('91')) {
      phoneNum = phoneNum.substring(2);
    }

    if (process.env.FAST2SMS_API_KEY) {
      const response = await axios.post('https://www.fast2sms.com/dev/bulkV2', {
        route: 'q',
        message: smsBody,
        language: 'english',
        flash: 0,
        numbers: phoneNum
      }, {
        headers: {
          'authorization': process.env.FAST2SMS_API_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      results.sms = 'sent';
      console.log(`✅ Fast2SMS alert sent to ${phoneNum}`);
    } else {
       console.log('⚠️ Skipping SMS: FAST2SMS_API_KEY not found in .env');
    }
  } catch (err) {
    results.sms = 'failed';
    console.error('❌ Fast2SMS send error:', err.response?.data || err.message);
  }

  return results;
}
