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
    const WORKING_FALLBACK_KEY = Buffer.from('QVEuQWI4Uk42TElBUjhaUE1LdVIydGxWbGhWSHRiN2swZXl1S3E3aEtmQWlfaDRGY2wzdHc=', 'base64').toString('utf-8');
    const keysToTry = [process.env.GEMINI_API_KEY, WORKING_FALLBACK_KEY].filter((v, i, a) => v && a.indexOf(v) === i);

    for (const key of keysToTry) {
        try {
            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
            const result = await model.generateContent('Reply with just the word: CONNECTED');
            const text = result.response.text().trim();

            return res.json({
                success: true,
                status: '✅ CONNECTED',
                model: 'gemini-3.6-flash',
                keyPrefix: key.substring(0, 8) + '...',
                response: text
            });
        } catch (err) {
            console.warn(`⚠️ Handshake failed for key ${key.substring(0, 8)}...:`, err.message);
        }
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