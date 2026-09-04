import express from 'express';
import fs from 'fs';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readCollection } from '../utils/mongoStore.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// The "do everything from one command" assistant. Instead of answering
// questions from data it already has (see chatbot.js), this one is allowed
// to actually DO things — it calls the app's own existing API endpoints
// (soil report, photo diagnosis, placing an order) as "tools", the same
// way a farmer would use each page, just triggered by one plain-language
// request instead of clicking through the app.
//
// Design choice: each tool below is a thin wrapper that calls this same
// server's own existing route (self-fetch to localhost). That way the real
// business logic (soil math, AI diagnosis, order creation) stays in ONE
// place — routes/soil.js, routes/advisory.js, routes/vendor.js — and this
// file never has to duplicate or drift from it.

// Computed lazily (inside a function, not at import time) because this
// module is imported before index.js runs dotenv.config() -- reading
// process.env.PORT at import time would always see it as unset.
function selfBaseUrl() {
  return `http://localhost:${process.env.PORT || 5005}`;
}

// ── Tools ────────────────────────────────────────────────────────────────

async function toolGetFarms(farmerId) {
  const farms = await readCollection('farms', []);
  const mine = farms.filter(f => f.farmerId === farmerId);
  if (mine.length === 0) return { farms: [], note: 'This farmer has no farms added yet.' };
  return { farms: mine.map(f => ({ id: f.id, name: f.name, location: f.location || 'not set', currentCrop: f.currentCrop || 'not set' })) };
}

async function toolGetSoilReport(farmerId, farmId) {
  if (!farmId) return { error: 'A farmId is required — call getFarms first if you do not have it yet.' };
  const resp = await fetch(`${selfBaseUrl()}/api/soil/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ farmerId, farmId }),
  });
  const data = await resp.json();
  if (!data.success) return { error: data.message || 'Could not generate the soil report for this farm.' };
  return { analysis: data.analysis, testCount: data.testCount, analysedAt: data.analysedAt };
}

async function toolDiagnosePhoto(farmerId, imageBase64, imageMimeType, query) {
  if (!imageBase64) return { error: 'No photo is attached to this message. Ask the farmer to attach one.' };
  const buffer = Buffer.from(imageBase64, 'base64');
  const blob = new Blob([buffer], { type: imageMimeType || 'image/jpeg' });
  const form = new FormData();
  form.append('image', blob, 'photo.jpg');
  form.append('query', query || '');
  form.append('userId', farmerId || '');
  const resp = await fetch(`${selfBaseUrl()}/api/advisory`, { method: 'POST', body: form });
  const data = await resp.json();
  if (!data.success) return { error: 'Could not analyze this photo right now.' };
  const d = data.data.diagnosis;
  return {
    issue: d.issueEnglish || d.issue,
    severity: d.severity,
    urgency: d.urgency,
    summary: d.summaryEnglish || d.summary,
    recommendedProducts: (data.data.products?.recommendations || []).map(p => ({
      id: p.id, name: p.name, price: p.price, unit: p.unit, whyThis: p.whyThis,
    })),
  };
}

async function toolPlaceOrder(farmerId, args) {
  let { productId, productName, price, quantity, confirmed } = args || {};
  if (!confirmed) {
    return {
      error: 'NOT_CONFIRMED',
      instructions: 'Do not call this tool again yet. First tell the farmer exactly what you are about to order — product name, price, quantity — in plain language, and wait for their next message to clearly say yes/confirm. Only then call placeOrder again with confirmed=true.',
    };
  }
  if (!productName) {
    return { error: 'productName is required.' };
  }
  if (!productId) {
    productId = 'ORD-' + String(productName).replace(/[^a-zA-Z0-9]/g, '-').toUpperCase();
  }

  const users = await readCollection('users', []);
  const user = users.find(u => u.id === farmerId) || {};

  const resp = await fetch(`${selfBaseUrl()}/api/vendor/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      farmerName: user.name || 'Farmer',
      farmerPhone: user.phone || '+91 98765 00000',
      location: user.fieldLocation || 'Kumbalgodu, Bengaluru',
      items: [{ id: productId, name: productName, price: price || 350, qty: quantity || 1 }],
    }),
  });
  const data = await resp.json();
  if (!data.success) return { error: 'Could not place the order right now.' };
  return { orderId: data.data.id, status: data.data.status, message: 'Order placed and broadcast to nearby vendors.' };
}

// ── Tool schema Gemini sees ─────────────────────────────────────────────

const TOOLS = [{
  functionDeclarations: [
    {
      name: 'getFarms',
      description: "List the farmer's own farms (id, name, location, current crop). Call this first whenever you need a farmId and don't already have one from earlier in the conversation.",
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'getSoilReport',
      description: "Generate this farm's full soil report — compares its latest soil test against real crop benchmarks and predicts trends from its test history. Requires a farmId (use getFarms first if you don't have it).",
      parameters: {
        type: 'OBJECT',
        properties: { farmId: { type: 'STRING', description: 'The id of the farm to report on.' } },
        required: ['farmId'],
      },
    },
    {
      name: 'diagnosePhoto',
      description: 'Analyze a crop/disease photo the farmer attached to this message and get real, catalog-matched product recommendations. Always call this for any photo — never guess the diagnosis or invent a product yourself.',
      parameters: {
        type: 'OBJECT',
        properties: { query: { type: 'STRING', description: "The farmer's description of the problem, if any." } },
      },
    },
    {
      name: 'placeOrder',
      description: "Place a real order for a product with nearby vendors. NEVER call this with confirmed=true unless the farmer's own most recent message clearly said yes/confirm to a proposal you already showed them. First call it with confirmed=false (or omit it) to check, then follow its instructions.",
      parameters: {
        type: 'OBJECT',
        properties: {
          productId: { type: 'STRING' },
          productName: { type: 'STRING' },
          price: { type: 'NUMBER' },
          quantity: { type: 'NUMBER' },
          confirmed: { type: 'BOOLEAN', description: 'true only once the farmer has explicitly confirmed this exact order in their latest message.' },
        },
        required: ['productId', 'productName'],
      },
    },
  ],
}];

const SYSTEM_INSTRUCTION = `You are the Farm Copilot agent — a single assistant an Indian farmer (who may not be able to read or type well) can give one plain-language command to, and you carry out the whole task yourself using your tools, instead of the farmer clicking through separate app pages.

You can, in one request:
- Look up the farmer's farms.
- Generate a full soil report for a farm (fetches their real soil test history and produces the same report the app's Soil Report page would).
- Diagnose a photo of a crop problem and recommend real products for it.
- Place a real order for a recommended product — but ONLY after explicitly confirming the exact product, price and quantity with the farmer in your previous reply, and seeing them clearly agree in their next message. Never place an order on the first ask.

Rules:
- Keep replies short, simple, and spoken-language plain — never technical.
- Reply in the same language the farmer writes in.
- Never invent data, products, or prices — only use what your tools return.
- If a farmer has more than one farm and it's not clear which one they mean, ask which farm before calling getSoilReport.
- If something fails, say so plainly and suggest what the farmer can try next.`;

// ── Route ────────────────────────────────────────────────────────────────

router.post('/chat', upload.single('image'), async (req, res) => {
  const imageFile = req.file;
  try {
    const { message, userId, history } = req.body;

    if (!message && !imageFile) {
      return res.status(400).json({ success: false, message: 'A message or a photo is required.' });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, message: 'AI is not configured on the server (GEMINI_API_KEY missing).' });
    }

    let imageBase64 = null;
    if (imageFile) imageBase64 = fs.readFileSync(imageFile.path).toString('base64');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.7-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: TOOLS,
    });

    let parsedHistory = [];
    try { parsedHistory = history ? JSON.parse(history) : []; } catch { /* ignore bad history */ }
    const historyWithoutCurrent = parsedHistory.slice(0, -1);
    const chatHistory = historyWithoutCurrent.slice(-10).map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(h.text || '') }],
    }));

    // Gemini API requires chatHistory to start with a 'user' message
    while (chatHistory.length > 0 && chatHistory[0].role === 'model') {
      chatHistory.shift();
    }

    const chat = model.startChat({ history: chatHistory });

    const userParts = [{ text: message || 'Here is a photo — please look at it.' }];
    if (imageBase64) {
      userParts.push({ inlineData: { mimeType: imageFile.mimetype, data: imageBase64 } });
    }

    let result = await chat.sendMessage(userParts);

    let loops = 0;
    while (loops++ < 5) {
      const calls = result.response.functionCalls();
      if (!calls || calls.length === 0) break;

      const toolResponses = [];
      for (const call of calls) {
        let output;
        try {
          if (call.name === 'getFarms') output = await toolGetFarms(userId);
          else if (call.name === 'getSoilReport') output = await toolGetSoilReport(userId, call.args?.farmId);
          else if (call.name === 'diagnosePhoto') output = await toolDiagnosePhoto(userId, imageBase64, imageFile?.mimetype, call.args?.query);
          else if (call.name === 'placeOrder') output = await toolPlaceOrder(userId, call.args);
          else output = { error: `Unknown tool: ${call.name}` };
        } catch (err) {
          console.error(`Agent tool "${call.name}" failed:`, err.message);
          output = { error: 'This step failed unexpectedly. Please try again.' };
        }
        toolResponses.push({ functionResponse: { name: call.name, response: output } });
      }
      result = await chat.sendMessage(toolResponses);
    }

    const reply = result.response.text();
    if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
    res.json({ success: true, reply });
  } catch (error) {
    console.error('❌ Agent error:', error.message || error);
    if (imageFile && fs.existsSync(imageFile.path)) { try { fs.unlinkSync(imageFile.path); } catch {} }
    const isRateLimit = error.status === 429 || (error.message && (error.message.includes('429') || error.message.includes('Quota exceeded') || error.message.includes('Too Many Requests')));
    const message = isRateLimit
      ? 'The AI assistant is temporarily rate-limited by Google Gemini API (Quota Exceeded / 429). Please wait a moment and try again.'
      : 'The assistant ran into a problem. Please try again.';
    res.status(isRateLimit ? 429 : 500).json({ success: false, message });
  }
});

export default router;
