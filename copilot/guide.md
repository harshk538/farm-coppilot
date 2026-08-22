# 🌾 Farm Copilot — Full Build Guide
## Multilingual Voice AI for Farmers

---

## ⚙️ TECH STACK

| Layer | Tech |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| AI / Agents | Anthropic Claude API (multi-agent) |
| Voice | Web Speech API (browser-native, free) |
| Multilingual | react-i18next |
| Routing | React Router v6 |

---

## 📁 FINAL FOLDER STRUCTURE

```
farm-copilot/
├── client/                        ← React frontend
│   ├── public/
│   │   └── logo.svg
│   ├── src/
│   │   ├── components/
│   │   │   ├── VoiceCopilot.jsx   ← Mic button + speech-to-text
│   │   │   ├── ChatInterface.jsx  ← Chat messages UI
│   │   │   ├── ProductCard.jsx    ← Product recommendation card
│   │   │   ├── AuthenticityChecker.jsx  ← Batch/QR verify UI
│   │   │   └── LanguageSelector.jsx     ← Language switcher
│   │   ├── pages/
│   │   │   ├── Home.jsx           ← Landing page
│   │   │   ├── Advisory.jsx       ← Main voice + chat advisor
│   │   │   ├── Products.jsx       ← Product catalog browser
│   │   │   └── Verify.jsx         ← Authenticity checker page
│   │   ├── locales/
│   │   │   ├── en.json            ← English translations
│   │   │   ├── hi.json            ← Hindi translations
│   │   │   └── kn.json            ← Kannada translations
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── server/                        ← Node.js backend
│   ├── routes/
│   │   ├── advisory.js            ← /api/advisory endpoint
│   │   ├── products.js            ← /api/products endpoint
│   │   └── verify.js              ← /api/verify endpoint
│   ├── agents/
│   │   ├── orchestrator.js        ← Master agent controller
│   │   ├── diagnosisAgent.js      ← Identifies crop problem
│   │   ├── productAgent.js        ← Recommends products
│   │   ├── safetyAgent.js         ← Safe application plan
│   │   └── authenticityAgent.js   ← Verifies product batch
│   ├── data/
│   │   └── productCatalog.json    ← Your product database
│   ├── index.js
│   └── .env
└── README.md
```

---

## 🖥️ TERMINAL COMMANDS (Step by Step)

### Step 1 — Create root folder
```bash
mkdir farm-copilot
cd farm-copilot
```

### Step 2 — Create the React frontend
```bash
npm create vite@latest client -- --template react
cd client
npm install
npm install react-router-dom react-i18next i18next axios tailwindcss @tailwindcss/vite lucide-react
npx tailwindcss init -p
cd ..
```

### Step 3 — Create the Node.js backend
```bash
mkdir server
cd server
npm init -y
npm install express cors dotenv @anthropic-ai/sdk
cd ..
```

### Step 4 — Create all folders inside server
```bash
mkdir server/routes server/agents server/data
```

### Step 5 — Create all folders inside client/src
```bash
mkdir client/src/components client/src/pages client/src/locales
```

### Step 6 — Create all empty files (run one by one in terminal)
```bash
# Server files
touch server/index.js
touch server/.env
touch server/data/productCatalog.json
touch server/agents/orchestrator.js
touch server/agents/diagnosisAgent.js
touch server/agents/productAgent.js
touch server/agents/safetyAgent.js
touch server/agents/authenticityAgent.js
touch server/routes/advisory.js
touch server/routes/products.js
touch server/routes/verify.js

# Client files
touch client/src/App.jsx
touch client/src/index.css
touch client/src/components/VoiceCopilot.jsx
touch client/src/components/ChatInterface.jsx
touch client/src/components/ProductCard.jsx
touch client/src/components/AuthenticityChecker.jsx
touch client/src/components/LanguageSelector.jsx
touch client/src/pages/Home.jsx
touch client/src/pages/Advisory.jsx
touch client/src/pages/Products.jsx
touch client/src/pages/Verify.jsx
touch client/src/locales/en.json
touch client/src/locales/hi.json
touch client/src/locales/kn.json
```

### Step 7 — Run dev servers (open 2 terminals)
```bash
# Terminal 1 — backend
cd server
node index.js

# Terminal 2 — frontend
cd client
npm run dev
```

---

## 🔑 server/.env
```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
PORT=5000
```

---

## 🗄️ server/data/productCatalog.json
```json
{
  "products": [
    {
      "id": "P001",
      "name": "GrowShield Pro",
      "category": "fungicide",
      "crops": ["wheat", "rice", "cotton"],
      "activeIngredient": "Tebuconazole 25.9% EC",
      "dosage": "1ml per litre of water",
      "applicationWindow": "Early disease symptoms stage",
      "reEntryInterval": "12 hours",
      "batchFormat": "GS-YYYY-XXXX",
      "price": 450,
      "unit": "250ml",
      "verified": true,
      "whyThis": "Broad-spectrum systemic fungicide effective against rust, blight and leaf spot"
    },
    {
      "id": "P002",
      "name": "NitroBurst 46",
      "category": "fertilizer",
      "crops": ["all"],
      "activeIngredient": "Urea 46% N",
      "dosage": "50kg per acre",
      "applicationWindow": "30 days after sowing",
      "reEntryInterval": "4 hours",
      "batchFormat": "NB-YYYY-XXXX",
      "price": 1200,
      "unit": "50kg bag",
      "verified": true,
      "whyThis": "High nitrogen content for vegetative growth; soil moisture required for activation"
    },
    {
      "id": "P003",
      "name": "BugOff Max",
      "category": "insecticide",
      "crops": ["cotton", "vegetables", "pulses"],
      "activeIngredient": "Imidacloprid 17.8% SL",
      "dosage": "0.5ml per litre of water",
      "applicationWindow": "At first sign of pest infestation",
      "reEntryInterval": "24 hours",
      "batchFormat": "BM-YYYY-XXXX",
      "price": 320,
      "unit": "100ml",
      "verified": true,
      "whyThis": "Systemic insecticide; highly effective against sucking pests like aphids, whitefly, jassids"
    },
    {
      "id": "P004",
      "name": "RootMax Bio",
      "category": "biostimulant",
      "crops": ["all"],
      "activeIngredient": "Humic acid 12% + Fulvic acid 3%",
      "dosage": "2ml per litre of water",
      "applicationWindow": "Transplanting or early growth stage",
      "reEntryInterval": "0 hours",
      "batchFormat": "RB-YYYY-XXXX",
      "price": 280,
      "unit": "500ml",
      "verified": true,
      "whyThis": "Improves root development and nutrient uptake; safe for organic farming"
    }
  ]
}
```

---

## 🤖 server/agents/diagnosisAgent.js
```javascript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runDiagnosisAgent(userQuery, context = {}) {
  const systemPrompt = `You are an expert agricultural diagnosis agent. 
  Your job is to identify the crop problem based on farmer's description.
  Always respond in JSON format with these exact fields:
  {
    "issue": "name of the issue",
    "issueType": "fungal/bacterial/viral/insect/nutritional/other",
    "cropAffected": "crop name",
    "severity": "low/medium/high",
    "urgency": "immediate/within 3 days/within a week",
    "confidence": 0-100,
    "symptoms": ["symptom1", "symptom2"],
    "possibleCauses": ["cause1", "cause2"],
    "summary": "2 sentence plain English summary"
  }
  Only return JSON, no extra text.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Farmer query: ${userQuery}\nContext: ${JSON.stringify(context)}`
      }
    ]
  });

  try {
    return JSON.parse(response.content[0].text);
  } catch {
    return { issue: 'Unknown', summary: response.content[0].text, confidence: 50 };
  }
}
```

---

## 🌿 server/agents/productAgent.js
```javascript
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const __dirname = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(join(__dirname, '../data/productCatalog.json'), 'utf-8')
);

export async function runProductAgent(diagnosis, context = {}) {
  const systemPrompt = `You are a farm input product recommendation agent.
  Given a diagnosis and a product catalog, recommend the best products.
  Always respond in JSON format:
  {
    "recommendations": [
      {
        "productId": "P001",
        "rank": 1,
        "whyRecommended": "reason",
        "alternativeTo": null or "productId"
      }
    ],
    "interventionWindow": "when to apply",
    "combinationWarning": "any mixing warnings or null"
  }
  Only return JSON, no extra text.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Diagnosis: ${JSON.stringify(diagnosis)}\nAvailable Products: ${JSON.stringify(catalog.products)}\nFarmer context: ${JSON.stringify(context)}`
      }
    ]
  });

  try {
    const result = JSON.parse(response.content[0].text);
    // Enrich with full product details
    result.recommendations = result.recommendations.map(rec => ({
      ...rec,
      productDetails: catalog.products.find(p => p.id === rec.productId)
    }));
    return result;
  } catch {
    return { recommendations: [], interventionWindow: 'Consult agronomist' };
  }
}
```

---

## 🛡️ server/agents/safetyAgent.js
```javascript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runSafetyAgent(diagnosis, productRec, context = {}) {
  const systemPrompt = `You are a farm safety and application guide agent.
  Generate a step-by-step safe application plan.
  Always respond in JSON format:
  {
    "steps": [
      { "step": 1, "action": "action text", "icon": "emoji" }
    ],
    "precautions": ["precaution1", "precaution2"],
    "weatherRequirements": "weather conditions needed",
    "ppe": ["PPE item 1", "PPE item 2"],
    "storageInstructions": "how to store product",
    "reapplicationRule": "when/if to reapply",
    "emergencyContact": "what to do if something goes wrong",
    "simpleAdvice": "one plain sentence in very simple language"
  }
  Only return JSON, no extra text.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1200,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Diagnosis: ${JSON.stringify(diagnosis)}\nRecommended Products: ${JSON.stringify(productRec)}\nContext: ${JSON.stringify(context)}`
      }
    ]
  });

  try {
    return JSON.parse(response.content[0].text);
  } catch {
    return { steps: [], precautions: [], simpleAdvice: response.content[0].text };
  }
}
```

---

## 🔍 server/agents/authenticityAgent.js
```javascript
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const __dirname = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(join(__dirname, '../data/productCatalog.json'), 'utf-8')
);

export async function runAuthenticityAgent(batchNumber, productName, photoDescription = '') {
  // Check batch format against catalog
  const product = catalog.products.find(p =>
    productName.toLowerCase().includes(p.name.toLowerCase())
  );

  const systemPrompt = `You are a product authenticity verification agent for agricultural inputs.
  Check if a batch number matches the expected format and flag any anomalies.
  Always respond in JSON:
  {
    "isAuthentic": true/false,
    "confidenceScore": 0-100,
    "riskLevel": "low/medium/high",
    "flags": ["flag1"],
    "recommendation": "buy/do not buy/verify with agronomist",
    "reason": "plain English explanation",
    "escalateToHuman": true/false
  }
  Only return JSON, no extra text.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 512,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Batch Number: ${batchNumber}\nProduct Name: ${productName}\nExpected Format: ${product?.batchFormat || 'Unknown'}\nPackaging Description: ${photoDescription}`
      }
    ]
  });

  try {
    return JSON.parse(response.content[0].text);
  } catch {
    return { isAuthentic: false, riskLevel: 'high', escalateToHuman: true, reason: 'Could not verify' };
  }
}
```

---

## 🎯 server/agents/orchestrator.js
```javascript
import { runDiagnosisAgent } from './diagnosisAgent.js';
import { runProductAgent } from './productAgent.js';
import { runSafetyAgent } from './safetyAgent.js';

export async function orchestrate(userQuery, context = {}) {
  console.log('🌾 Orchestrator: Starting pipeline...');

  // AGENT 1: Diagnose
  console.log('🔬 Running Diagnosis Agent...');
  const diagnosis = await runDiagnosisAgent(userQuery, context);
  console.log('✅ Diagnosis:', diagnosis.issue);

  // AGENT 2: Recommend Products
  console.log('🛒 Running Product Agent...');
  const products = await runProductAgent(diagnosis, context);
  console.log('✅ Products recommended:', products.recommendations?.length || 0);

  // AGENT 3: Safety Plan
  console.log('🛡️ Running Safety Agent...');
  const safetyPlan = await runSafetyAgent(diagnosis, products, context);
  console.log('✅ Safety plan generated');

  // Escalation check
  const shouldEscalate = diagnosis.confidence < 60 || diagnosis.severity === 'high';

  return {
    diagnosis,
    products,
    safetyPlan,
    shouldEscalate,
    escalationReason: shouldEscalate ? 'Low confidence or high severity — consult agronomist' : null
  };
}
```

---

## 🛣️ server/routes/advisory.js
```javascript
import express from 'express';
import { orchestrate } from '../agents/orchestrator.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { query, language, crop, location, budget } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const context = { language, crop, location, budget };
    const result = await orchestrate(query, context);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Advisory error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

export default router;
```

---

## 🛣️ server/routes/products.js
```javascript
import express from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const router = express.Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

router.get('/', (req, res) => {
  const catalog = JSON.parse(
    readFileSync(join(__dirname, '../data/productCatalog.json'), 'utf-8')
  );
  const { category, crop } = req.query;
  let products = catalog.products;

  if (category) products = products.filter(p => p.category === category);
  if (crop) products = products.filter(p => p.crops.includes(crop) || p.crops.includes('all'));

  res.json({ success: true, data: products });
});

export default router;
```

---

## 🛣️ server/routes/verify.js
```javascript
import express from 'express';
import { runAuthenticityAgent } from '../agents/authenticityAgent.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { batchNumber, productName, photoDescription } = req.body;

    if (!batchNumber || !productName) {
      return res.status(400).json({ error: 'batchNumber and productName are required' });
    }

    const result = await runAuthenticityAgent(batchNumber, productName, photoDescription);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

---

## 🚀 server/index.js
```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import advisoryRoutes from './routes/advisory.js';
import productsRoutes from './routes/products.js';
import verifyRoutes from './routes/verify.js';

dotenv.config();

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Routes
app.use('/api/advisory', advisoryRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/verify', verifyRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🌾 Farm Copilot Server running on http://localhost:${PORT}`);
});
```

---
## Add `"type": "module"` to server/package.json
Open `server/package.json` and add this line:
```json
{
  "name": "server",
  "version": "1.0.0",
  "type": "module",
  ...
}
```

---

## 🌐 client/src/locales/en.json
```json
{
  "appName": "Farm Copilot",
  "tagline": "Your trusted farming advisor",
  "home": {
    "title": "Smart Farming Assistant",
    "subtitle": "Ask in your language, get verified advice",
    "startButton": "Start Advisory",
    "verifyButton": "Verify Product"
  },
  "advisory": {
    "placeholder": "Describe your problem (e.g. yellow leaves on wheat)",
    "voiceHint": "Tap mic to speak",
    "send": "Get Advice",
    "loading": "Analyzing your query...",
    "diagnosis": "Diagnosis",
    "products": "Recommended Products",
    "safetyPlan": "Safe Application Plan",
    "escalate": "⚠️ Consult an Agronomist"
  },
  "verify": {
    "title": "Verify Product Authenticity",
    "batchLabel": "Batch Number",
    "productLabel": "Product Name",
    "checkButton": "Verify Now",
    "authentic": "✅ Product Appears Genuine",
    "fake": "❌ Risk Detected — Do Not Use"
  }
}
```

---

## 🌐 client/src/locales/hi.json
```json
{
  "appName": "फार्म कोपायलट",
  "tagline": "आपका विश्वसनीय कृषि सलाहकार",
  "home": {
    "title": "स्मार्ट खेती सहायक",
    "subtitle": "अपनी भाषा में पूछें, सही सलाह पाएं",
    "startButton": "सलाह शुरू करें",
    "verifyButton": "उत्पाद जांचें"
  },
  "advisory": {
    "placeholder": "अपनी समस्या बताएं (जैसे गेहूं की पत्तियां पीली हो रही हैं)",
    "voiceHint": "बोलने के लिए माइक दबाएं",
    "send": "सलाह लें",
    "loading": "आपकी समस्या विश्लेषण हो रही है...",
    "diagnosis": "निदान",
    "products": "अनुशंसित उत्पाद",
    "safetyPlan": "सुरक्षित उपयोग योजना",
    "escalate": "⚠️ कृषि विशेषज्ञ से मिलें"
  },
  "verify": {
    "title": "उत्पाद की प्रामाणिकता जांचें",
    "batchLabel": "बैच नंबर",
    "productLabel": "उत्पाद का नाम",
    "checkButton": "अभी जांचें",
    "authentic": "✅ उत्पाद असली है",
    "fake": "❌ जोखिम पाया गया — उपयोग न करें"
  }
}
```

---

## 🌐 client/src/locales/kn.json
```json
{
  "appName": "ಫಾರ್ಮ್ ಕೋಪೈಲಟ್",
  "tagline": "ನಿಮ್ಮ ವಿಶ್ವಾಸಾರ್ಹ ಕೃಷಿ ಸಲಹೆಗಾರ",
  "home": {
    "title": "ಸ್ಮಾರ್ಟ್ ಕೃಷಿ ಸಹಾಯಕ",
    "subtitle": "ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಕೇಳಿ, ಸರಿಯಾದ ಸಲಹೆ ಪಡೆಯಿರಿ",
    "startButton": "ಸಲಹೆ ಪ್ರಾರಂಭಿಸಿ",
    "verifyButton": "ಉತ್ಪನ್ನ ಪರಿಶೀಲಿಸಿ"
  },
  "advisory": {
    "placeholder": "ನಿಮ್ಮ ಸಮಸ್ಯೆ ವಿವರಿಸಿ",
    "voiceHint": "ಮಾತನಾಡಲು ಮೈಕ್ ಒತ್ತಿ",
    "send": "ಸಲಹೆ ಪಡೆಯಿರಿ",
    "loading": "ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ...",
    "diagnosis": "ರೋಗನಿರ್ಣಯ",
    "products": "ಶಿಫಾರಸು ಮಾಡಿದ ಉತ್ಪನ್ನಗಳು",
    "safetyPlan": "ಸುರಕ್ಷಿತ ಅನ್ವಯ ಯೋಜನೆ",
    "escalate": "⚠️ ತಜ್ಞ ಕೃಷಿಶಾಸ್ತ್ರಜ್ಞರನ್ನು ಭೇಟಿ ಮಾಡಿ"
  },
  "verify": {
    "title": "ಉತ್ಪನ್ನ ಮೂಲ ಪರಿಶೀಲಿಸಿ",
    "batchLabel": "ಬ್ಯಾಚ್ ಸಂಖ್ಯೆ",
    "productLabel": "ಉತ್ಪನ್ನದ ಹೆಸರು",
    "checkButton": "ಈಗ ಪರಿಶೀಲಿಸಿ",
    "authentic": "✅ ಉತ್ಪನ್ನ ನಿಜವಾದದ್ದು",
    "fake": "❌ ಅಪಾಯ ಪತ್ತೆಯಾಗಿದೆ — ಬಳಸಬೇಡಿ"
  }
}
```

---

## 🎨 client/src/main.jsx
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import hi from './locales/hi.json';
import kn from './locales/kn.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    kn: { translation: kn }
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## 🗺️ client/src/App.jsx
```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Advisory from './pages/Advisory';
import Products from './pages/Products';
import Verify from './pages/Verify';
import LanguageSelector from './components/LanguageSelector';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-green-50 font-sans">
        <header className="bg-green-700 text-white px-4 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌾</span>
            <span className="font-bold text-lg">Farm Copilot</span>
          </div>
          <LanguageSelector />
        </header>

        <main className="max-w-2xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/advisory" element={<Advisory />} />
            <Route path="/products" element={<Products />} />
            <Route path="/verify" element={<Verify />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
```

---

## 🏠 client/src/pages/Home.jsx
```jsx
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Home() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="text-center space-y-8 py-10">
      <div>
        <div className="text-7xl mb-4">🌾</div>
        <h1 className="text-3xl font-bold text-green-800">{t('home.title')}</h1>
        <p className="text-gray-600 mt-2">{t('home.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
        <button
          onClick={() => navigate('/advisory')}
          className="bg-green-600 text-white rounded-2xl p-6 text-center shadow-lg hover:bg-green-700 transition"
        >
          <div className="text-3xl mb-2">🎤</div>
          <div className="font-semibold">{t('home.startButton')}</div>
        </button>

        <button
          onClick={() => navigate('/verify')}
          className="bg-amber-500 text-white rounded-2xl p-6 text-center shadow-lg hover:bg-amber-600 transition"
        >
          <div className="text-3xl mb-2">🔍</div>
          <div className="font-semibold">{t('home.verifyButton')}</div>
        </button>

        <button
          onClick={() => navigate('/products')}
          className="col-span-2 bg-blue-600 text-white rounded-2xl p-4 text-center shadow-lg hover:bg-blue-700 transition"
        >
          <div className="text-2xl mb-1">🛒</div>
          <div className="font-semibold">Browse Product Catalog</div>
        </button>
      </div>
    </div>
  );
}
```

---

## 🎙️ client/src/components/VoiceCopilot.jsx
```jsx
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, MicOff } from 'lucide-react';

export default function VoiceCopilot({ onTranscript, language = 'en' }) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const { t } = useTranslation();

  // Language codes for Web Speech API
  const langMap = { en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN' };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice not supported in your browser. Use Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = langMap[language] || 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  // Text-to-speech helper
  const speak = (text, lang = language) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langMap[lang] || 'en-IN';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={isListening ? stopListening : startListening}
        className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all ${
          isListening
            ? 'bg-red-500 animate-pulse scale-110'
            : 'bg-green-600 hover:bg-green-700'
        }`}
      >
        {isListening ? (
          <MicOff className="text-white w-7 h-7" />
        ) : (
          <Mic className="text-white w-7 h-7" />
        )}
      </button>
      <span className="text-xs text-gray-500">
        {isListening ? '🔴 Listening...' : t('advisory.voiceHint')}
      </span>
    </div>
  );
}

// Export speak utility
export function speakText(text, language = 'en') {
  const langMap = { en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN' };
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langMap[language] || 'en-IN';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
```

---

## 💬 client/src/components/ChatInterface.jsx
```jsx
export default function ChatInterface({ messages }) {
  return (
    <div className="space-y-3 max-h-96 overflow-y-auto py-2">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-xs rounded-2xl px-4 py-2 text-sm shadow ${
              msg.role === 'user'
                ? 'bg-green-600 text-white rounded-tr-none'
                : 'bg-white text-gray-800 rounded-tl-none'
            }`}
          >
            {msg.role === 'bot' && <span className="text-base mr-1">🌾</span>}
            {msg.content}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 🛒 client/src/components/ProductCard.jsx
```jsx
export default function ProductCard({ product, rank, whyRecommended }) {
  const categoryColors = {
    fungicide: 'bg-purple-100 text-purple-700',
    fertilizer: 'bg-green-100 text-green-700',
    insecticide: 'bg-red-100 text-red-700',
    biostimulant: 'bg-blue-100 text-blue-700'
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4 border border-gray-100">
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="text-xs font-bold text-amber-600">#{rank} Recommended</span>
          <h3 className="font-bold text-gray-800 text-lg">{product.name}</h3>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${categoryColors[product.category] || 'bg-gray-100'}`}>
          {product.category}
        </span>
      </div>

      <p className="text-sm text-green-700 font-medium mb-3">💡 {whyRecommended}</p>

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
        <div><span className="font-medium">Dosage:</span> {product.dosage}</div>
        <div><span className="font-medium">Price:</span> ₹{product.price}/{product.unit}</div>
        <div><span className="font-medium">Re-entry:</span> {product.reEntryInterval}</div>
        <div><span className="font-medium">Apply:</span> {product.applicationWindow}</div>
      </div>

      {product.verified && (
        <div className="mt-3 flex items-center gap-1 text-xs text-green-600 font-medium">
          ✅ Verified Product
        </div>
      )}
    </div>
  );
}
```

---

## 🌍 client/src/components/LanguageSelector.jsx
```jsx
import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'hi', label: 'हि', name: 'Hindi' },
  { code: 'kn', label: 'ಕ', name: 'Kannada' }
];

export default function LanguageSelector() {
  const { i18n } = useTranslation();

  return (
    <div className="flex gap-1">
      {languages.map(lang => (
        <button
          key={lang.code}
          onClick={() => i18n.changeLanguage(lang.code)}
          className={`px-2 py-1 rounded text-sm font-bold transition ${
            i18n.language === lang.code
              ? 'bg-white text-green-700'
              : 'bg-green-600 text-white hover:bg-green-500'
          }`}
          title={lang.name}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
```

---

## 📋 client/src/pages/Advisory.jsx
```jsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import VoiceCopilot, { speakText } from '../components/VoiceCopilot';
import ChatInterface from '../components/ChatInterface';
import ProductCard from '../components/ProductCard';

export default function Advisory() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    { role: 'bot', content: '👋 Hello! Tell me about your crop problem. I can help!' }
  ]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleQuery = async (text = query) => {
    if (!text.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setQuery('');
    setLoading(true);

    try {
      const res = await axios.post('http://localhost:5000/api/advisory', {
        query: text,
        language: i18n.language
      });

      const data = res.data.data;
      setResult(data);

      const botMsg = `✅ Diagnosis: ${data.diagnosis.issue}. ${data.diagnosis.summary}`;
      setMessages(prev => [...prev, { role: 'bot', content: botMsg }]);
      speakText(botMsg, i18n.language);

      if (data.shouldEscalate) {
        setMessages(prev => [...prev, {
          role: 'bot',
          content: '⚠️ This seems serious. Please consult a certified agronomist.'
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'bot',
        content: '❌ Something went wrong. Please try again.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-green-800">🎤 Voice Advisory</h2>

      {/* Chat */}
      <div className="bg-white rounded-2xl shadow p-4">
        <ChatInterface messages={messages} />
        {loading && (
          <p className="text-center text-sm text-gray-500 animate-pulse mt-2">
            {t('advisory.loading')}
          </p>
        )}
      </div>

      {/* Input + Voice */}
      <div className="bg-white rounded-2xl shadow p-4 flex gap-3 items-center">
        <VoiceCopilot
          onTranscript={(text) => { setQuery(text); handleQuery(text); }}
          language={i18n.language}
        />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleQuery()}
          placeholder={t('advisory.placeholder')}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <button
          onClick={() => handleQuery()}
          className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-green-700"
        >
          {t('advisory.send')}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Diagnosis */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h3 className="font-bold text-green-700 mb-2">🔬 {t('advisory.diagnosis')}</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="font-medium">Issue:</span> {result.diagnosis.issue}</div>
              <div><span className="font-medium">Severity:</span> {result.diagnosis.severity}</div>
              <div><span className="font-medium">Urgency:</span> {result.diagnosis.urgency}</div>
              <div><span className="font-medium">Confidence:</span> {result.diagnosis.confidence}%</div>
            </div>
          </div>

          {/* Products */}
          {result.products?.recommendations?.length > 0 && (
            <div>
              <h3 className="font-bold text-green-700 mb-2">🛒 {t('advisory.products')}</h3>
              <div className="space-y-3">
                {result.products.recommendations.map((rec, i) => (
                  <ProductCard
                    key={i}
                    product={rec.productDetails}
                    rank={rec.rank}
                    whyRecommended={rec.whyRecommended}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Safety Plan */}
          {result.safetyPlan?.steps?.length > 0 && (
            <div className="bg-white rounded-2xl shadow p-4">
              <h3 className="font-bold text-green-700 mb-3">🛡️ {t('advisory.safetyPlan')}</h3>
              <div className="space-y-2">
                {result.safetyPlan.steps.map((step, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <span className="text-lg">{step.icon}</span>
                    <span><strong>Step {step.step}:</strong> {step.action}</span>
                  </div>
                ))}
              </div>
              {result.safetyPlan.precautions?.length > 0 && (
                <div className="mt-3 bg-red-50 rounded-xl p-3">
                  <p className="text-xs font-bold text-red-600 mb-1">⚠️ Precautions</p>
                  {result.safetyPlan.precautions.map((p, i) => (
                    <p key={i} className="text-xs text-red-700">• {p}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Escalation */}
          {result.shouldEscalate && (
            <div className="bg-orange-50 border border-orange-300 rounded-2xl p-4 text-center">
              <p className="font-bold text-orange-700">{t('advisory.escalate')}</p>
              <p className="text-sm text-orange-600 mt-1">{result.escalationReason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## ✅ client/src/pages/Verify.jsx
```jsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

export default function Verify() {
  const { t } = useTranslation();
  const [batchNumber, setBatchNumber] = useState('');
  const [productName, setProductName] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!batchNumber || !productName) return;
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/verify', {
        batchNumber,
        productName
      });
      setResult(res.data.data);
    } catch (err) {
      alert('Verification failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-green-800">🔍 {t('verify.title')}</h2>

      <div className="bg-white rounded-2xl shadow p-4 space-y-3">
        <div>
          <label className="text-sm font-medium text-gray-700">{t('verify.productLabel')}</label>
          <input
            value={productName}
            onChange={e => setProductName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 mt-1 text-sm"
            placeholder="e.g. GrowShield Pro"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">{t('verify.batchLabel')}</label>
          <input
            value={batchNumber}
            onChange={e => setBatchNumber(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 mt-1 text-sm"
            placeholder="e.g. GS-2024-0142"
          />
        </div>
        <button
          onClick={handleVerify}
          disabled={loading}
          className="w-full bg-amber-500 text-white rounded-xl py-3 font-bold hover:bg-amber-600 disabled:opacity-50"
        >
          {loading ? 'Checking...' : t('verify.checkButton')}
        </button>
      </div>

      {result && (
        <div className={`rounded-2xl shadow p-4 ${result.isAuthentic ? 'bg-green-50 border border-green-300' : 'bg-red-50 border border-red-300'}`}>
          <p className={`font-bold text-lg ${result.isAuthentic ? 'text-green-700' : 'text-red-700'}`}>
            {result.isAuthentic ? t('verify.authentic') : t('verify.fake')}
          </p>
          <p className="text-sm mt-1 text-gray-700">{result.reason}</p>
          <p className="text-sm mt-2"><strong>Risk:</strong> {result.riskLevel}</p>
          <p className="text-sm"><strong>Confidence:</strong> {result.confidenceScore}%</p>
          <p className="text-sm font-bold mt-2">
            👉 {result.recommendation}
          </p>
          {result.escalateToHuman && (
            <p className="mt-2 text-orange-600 font-medium text-sm">
              ⚠️ Please consult an agronomist before using this product.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 🛒 client/src/pages/Products.jsx
```jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import ProductCard from '../components/ProductCard';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    axios.get('http://localhost:5000/api/products').then(res => {
      setProducts(res.data.data);
    });
  }, []);

  const categories = ['all', 'fungicide', 'fertilizer', 'insecticide', 'biostimulant'];
  const filtered = filter === 'all' ? products : products.filter(p => p.category === filter);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-green-800">🛒 Product Catalog</h2>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition ${
              filter === cat ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border'
            }`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((product, i) => (
          <ProductCard
            key={product.id}
            product={product}
            rank={i + 1}
            whyRecommended={product.whyThis}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## 🎨 client/src/index.css
```css
@import "tailwindcss";

body {
  font-family: 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

---

## ⚙️ client/vite.config.js
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

---

## 🧩 AGENT FLOW DIAGRAM

```
User speaks / types
        ↓
   VoiceCopilot (STT)
        ↓
   Advisory Page sends POST /api/advisory
        ↓
   ┌─── ORCHESTRATOR ──────────────────┐
   │  1. diagnosisAgent  → crop issue  │
   │  2. productAgent    → products    │
   │  3. safetyAgent     → safe plan   │
   │  4. escalation check              │
   └───────────────────────────────────┘
        ↓
   Response → UI renders cards
        ↓
   TTS reads summary aloud
```

---

## ✅ QUICK CHECKLIST

- [ ] Create folders and files using all terminal commands above
- [ ] Add your `ANTHROPIC_API_KEY` in `server/.env`
- [ ] Add `"type": "module"` in `server/package.json`
- [ ] Run `node index.js` in server/
- [ ] Run `npm run dev` in client/
- [ ] Open `http://localhost:5173` in Chrome (for voice support)
- [ ] Test with: "My wheat leaves are turning yellow and have brown spots"

---

## 🏆 HACKATHON EXTRA TIPS

1. **Demo script**: Pre-load a query in Hindi: "मेरी गेहूं की फसल में पीले धब्बे हैं" (Yellow spots on wheat)
2. **Add crop selector**: Add a dropdown for crop type context
3. **Mock authenticity**: Use batch `GS-2024-FAKE` to trigger a fake detection
4. **Voice first**: Always demo the mic button — judges love it
5. **Show the agent pipeline** in console logs during demo

---

*Good luck at the hackathon! 🌾🚀*
