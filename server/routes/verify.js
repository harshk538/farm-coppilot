import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

// Original product verify route
router.post('/', (req, res) => {
    const { code } = req.body;
    if (code === '12345') {
        res.json({ message: '✅ Product is authentic' });
    } else {
        res.json({ message: '❌ Fake product' });
    }
});

// Gemini API handshake test route
router.get('/gemini-handshake', async (req, res) => {
    const key = process.env.GEMINI_API_KEY;

    if (!key) {
        return res.json({ success: false, status: '❌ MISSING', message: 'GEMINI_API_KEY not set in .env' });
    }

    try {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: 'gemini-3.7-flash' });
        const result = await model.generateContent('Reply with just the word: CONNECTED');
        const text = result.response.text().trim();

        res.json({
            success: true,
            status: '✅ CONNECTED',
            model: 'gemini-3.7-flash',
            keyPrefix: key.substring(0, 8) + '...',
            response: text
        });
    } catch (err) {
        const msg = err.message || '';
        let status, advice;

        if (msg.includes('429')) {
            status = '⏳ QUOTA EXHAUSTED';
            advice = 'Free tier daily limit reached. Resets at ~1:30 AM IST. Or enable billing at console.cloud.google.com';
        } else if (msg.includes('403')) {
            status = '🔒 ACCESS DENIED';
            advice = 'This API key does not have permission for this model.';
        } else if (msg.includes('404')) {
            status = '❓ MODEL NOT FOUND';
            advice = 'The model name is not available for this API key.';
        } else {
            status = '❌ ERROR';
            advice = msg.substring(0, 200);
        }

        res.json({ success: false, status, advice, keyPrefix: key.substring(0, 8) + '...' });
    }
});

export default router;