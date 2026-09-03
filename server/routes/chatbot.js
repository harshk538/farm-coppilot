import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readCollection, queryCollection } from '../utils/mongoStore.js';

const router = express.Router();

// Farm Copilot's assistant — answers farming questions in plain language and,
// when the farmer is logged in, can see their own farms/soil tests/past
// diagnosis reports so it can give personalized answers ("what did my last
// soil report say"). It only reads data — it never places orders or changes
// anything, so there's no risk of it accidentally taking an action.

const buildContext = async (userId) => {
  if (!userId) return 'The farmer is not logged in, so no personal farm data is available. Answer generally.';

  try {
    const [farms, soilTests, diagnoses] = await Promise.all([
      readCollection('farms', []),
      readCollection('soilTests', []),
      queryCollection('diagnosisHistory', { userId }),
    ]);

    const myFarms = farms.filter(f => f.farmerId === userId);
    if (myFarms.length === 0) {
      return 'This farmer is logged in but has not added any farms yet.';
    }

    const farmSummaries = myFarms.map(farm => {
      const farmTests = soilTests
        .filter(t => t.farmId === farm.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const latest = farmTests[0];

      let soilLine = 'No soil test recorded yet.';
      if (latest?.readings) {
        const r = latest.readings;
        soilLine = `Latest soil test (${new Date(latest.createdAt).toLocaleDateString()}): N=${r.n}, P=${r.p}, K=${r.k}, pH=${r.ph}, moisture=${r.moisture}%, temperature=${r.temperature}°C.`;
      }

      return `- Farm "${farm.name}" (${farm.location || 'location not set'}), current crop: ${farm.currentCrop || 'not set'}. ${soilLine}`;
    }).join('\n');

    const recentDiagnoses = (diagnoses || []).slice(0, 3).map(d =>
      `- ${new Date(d.createdAt).toLocaleDateString()}: ${d.diagnosis?.issueEnglish || d.diagnosis?.issue || 'unknown issue'} (severity: ${d.diagnosis?.severity || 'n/a'})`
    ).join('\n') || 'None yet.';

    return `Farmer's farms and latest soil data:\n${farmSummaries}\n\nFarmer's recent AI disease diagnosis reports:\n${recentDiagnoses}`;
  } catch (err) {
    console.error('⚠️ Chatbot context lookup failed:', err.message);
    return 'Could not load this farmer\'s personal data right now — answer generally.';
  }
};

router.post('/message', async (req, res) => {
  try {
    const { userId, message, history } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'message is required.' });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, message: 'AI is not configured on the server (GEMINI_API_KEY missing).' });
    }

    const contextText = await buildContext(userId);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `You are the Farm Copilot assistant — a friendly, plain-spoken helper for Indian farmers using the Farm Copilot app.

You can help with:
- General farming questions (crops, pests, fertilizers, weather, soil basics).
- Explaining what the app's features do (AI Advisory for disease diagnosis, Soil Test, Soil Report, Treatment Finder, Weather, Orders, Equipment rental).
- Personalized answers using the farmer's own data below, when available.

Rules:
- Keep answers short, simple, and in plain language — the farmer may not be technical.
- You cannot place orders, change any data, or take any action — you can only answer and explain. If asked to do something like "order this product", explain that they should use the Orders or Advisory page to do that themselves, and point them to it.
- If you don't know something, say so plainly rather than guessing.
- Reply in the same language the farmer writes in.

${contextText}`,
    });

    const chatHistory = Array.isArray(history)
      ? history.slice(0, -1).slice(-10).map(h => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(h.text || '') }],
        }))
      : [];

    while (chatHistory.length > 0 && chatHistory[0].role === 'model') {
      chatHistory.shift();
    }

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    res.json({ success: true, reply });
  } catch (error) {
    console.error('❌ Chatbot error:', error.message);
    res.status(500).json({ success: false, message: 'The assistant is having trouble right now. Please try again.' });
  }
});

export default router;
