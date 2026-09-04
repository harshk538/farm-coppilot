import axios from 'axios';

/**
 * Sends an SMS using Fast2SMS API
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} messageText - The message to be delivered
 */
export const sendSMS = async (phoneNumber, messageText) => {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    console.warn('[Fast2SMS] Missing FAST2SMS_API_KEY in environment variables.');
    return { success: false, message: 'Missing API key' };
  }

  if (!phoneNumber) {
    console.warn('[Fast2SMS] Phone number is missing.');
    return { success: false, message: 'Missing phone number' };
  }

  // Clean phone number to get 10 digits
  const cleanPhone = String(phoneNumber).replace(/\D/g, '').slice(-10);
  if (!cleanPhone || cleanPhone.length !== 10) {
    console.warn(`[Fast2SMS] Invalid 10-digit phone number: ${phoneNumber} -> ${cleanPhone}`);
    return { success: false, message: 'Invalid phone number format' };
  }

  console.log(`[Fast2SMS] Attempting to send SMS to ${cleanPhone}: "${messageText}"`);

  try {
    // Try POST request using Fast2SMS Quick Route 'q'
    const response = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      {
        route: 'q',
        message: messageText,
        language: 'english',
        flash: 0,
        numbers: cleanPhone
      },
      {
        headers: {
          authorization: apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log('[Fast2SMS Success Response]:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    const errorDetails = error.response?.data || error.message;
    console.error('[Fast2SMS Error Response]:', errorDetails);

    // Fallback: try GET request if POST route fails or requires params
    try {
      console.log('[Fast2SMS] Retrying via GET method fallback...');
      const fallbackResp = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
        params: {
          authorization: apiKey,
          route: 'q',
          message: messageText,
          language: 'english',
          flash: 0,
          numbers: cleanPhone
        },
        timeout: 10000
      });
      console.log('[Fast2SMS Fallback Success]:', fallbackResp.data);
      return { success: true, data: fallbackResp.data };
    } catch (fallbackErr) {
      console.error('[Fast2SMS Fallback Error]:', fallbackErr.response?.data || fallbackErr.message);
      return { success: false, error: errorDetails };
    }
  }
};
