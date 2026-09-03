import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readConfig } from '../utils/mongoStore.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple CSV line parser helper
function parseCSV(csvContent) {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const items = [];
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Match CSV fields supporting quoted strings
    const match = line.match(/^(".*?"|[^",\s]+)(?:\s*,\s*(".*?"|[^",\s]+))?$/) ||
                  line.match(/^(?:"([^"]*)"|([^,]*)),(?:"([^"]*)"|([^,]*))$/);
    
    let pest = '';
    let pesticidesStr = '';

    if (line.includes('"')) {
      const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      pest = parts[0]?.replace(/^"|"$/g, '').trim();
      pesticidesStr = parts[1]?.replace(/^"|"$/g, '').trim();
    } else {
      const parts = line.split(',');
      pest = parts[0]?.trim();
      pesticidesStr = parts.slice(1).join(',').trim();
    }

    if (pest && pesticidesStr) {
      const list = pesticidesStr.split(',').map(s => s.replace(/"/g, '').trim()).filter(Boolean);
      items.push({ pest, pesticides: list });
    }
  }
  return items;
}

// Image pool for realistic agricultural packaging & spray container display
const AGRI_IMAGE_POOL = [
  'https://images.unsplash.com/photo-1595246140625-573b715d11dc?w=400&q=80',
  'https://images.unsplash.com/photo-1585314062340-f1a5a7c9328d?w=400&q=80',
  'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=400&q=80',
  'https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?w=400&q=80',
  'https://images.unsplash.com/photo-1592417817098-8f3d6eb231fc?w=400&q=80'
];

// Price generator helper based on chemical name string hash
function getPriceForChemical(chemName) {
  let hash = 0;
  for (let i = 0; i < chemName.length; i++) hash = chemName.charCodeAt(i) + ((hash << 5) - hash);
  const price = 180 + (Math.abs(hash) % 750);
  return Math.round(price / 10) * 10;
}

// Category predictor based on chemical / pest name
function getCategory(pestName, chemName) {
  const c = chemName.toLowerCase();
  if (c.includes('thuringiensis') || c.includes('neem') || c.includes('humic')) return 'biostimulant';
  if (c.includes('mancozeb') || c.includes('tebuconazole') || c.includes('azoxystrobin') || c.includes('sulphur') || c.includes('copper')) return 'fungicide';
  if (c.includes('glyphosate') || c.includes('weed')) return 'herbicide';
  return 'insecticide';
}

// Main Loader function: merges productCatalog.json + pesticides.csv data
const loadAllProducts = async () => {
  let jsonProducts = [];
  try {
    const catalogDoc = await readConfig('productCatalog', { products: [] });
    jsonProducts = catalogDoc.products || [];
  } catch (err) {
    console.error('Error loading productCatalog from MongoDB:', err.message);
  }

  // Load Pesticides.csv
  let csvPestMappings = [];
  try {
    const csvPath1 = path.join(__dirname, '../data/pesticides.csv');
    const csvPath2 = path.join(__dirname, '../data/Pesticides.csv');
    const targetPath = fs.existsSync(csvPath1) ? csvPath1 : fs.existsSync(csvPath2) ? csvPath2 : null;
    
    if (targetPath) {
      const csvContent = fs.readFileSync(targetPath, 'utf-8');
      csvPestMappings = parseCSV(csvContent);
    }
  } catch (err) {
    console.error('Error reading pesticides.csv:', err.message);
  }

  // Map CSV pesticides to dynamic product objects
  const csvProducts = [];
  const chemicalToPests = new Map();

  csvPestMappings.forEach(({ pest, pesticides }) => {
    pesticides.forEach(chem => {
      if (!chemicalToPests.has(chem)) {
        chemicalToPests.set(chem, new Set());
      }
      chemicalToPests.get(chem).add(pest);
    });
  });

  let index = 100;
  chemicalToPests.forEach((pestSet, chemName) => {
    const pestsList = Array.from(pestSet);
    const category = getCategory(pestsList[0] || '', chemName);
    const id = `CSV-${index++}`;

    csvProducts.push({
      id,
      name: `${chemName} Formulation`,
      category,
      crops: ['rice', 'cotton', 'wheat', 'vegetables', 'pulses'],
      activeIngredient: chemName,
      dosage: '1.5ml to 2.5ml per litre of water',
      applicationWindow: 'Spray at first sign of pest infestation',
      reEntryInterval: '12-24 hours',
      batchFormat: `PEST-${index}-2026`,
      price: getPriceForChemical(chemName),
      unit: chemName.toLowerCase().includes('bt') || chemName.toLowerCase().includes('powder') ? '500g' : '250ml',
      verified: true,
      isOrganic: chemName.toLowerCase().includes('thuringiensis') || chemName.toLowerCase().includes('neem'),
      diseases: pestsList.slice(0, 5),
      targetPests: pestsList,
      alternatives: [],
      imageUrl: AGRI_IMAGE_POOL[index % AGRI_IMAGE_POOL.length],
      whyThis: `Highly effective formulation tailored against ${pestsList.slice(0, 3).join(', ')}.`
    });
  });

  return [...jsonProducts, ...csvProducts];
};

// GET /api/products — All products (JSON + CSV Dataset merged)
router.get('/', async (req, res) => {
  try {
    const products = await loadAllProducts();
    res.json({ success: true, count: products.length, data: products });
  } catch (error) {
    console.error('❌ Products error:', error.message);
    res.status(500).json({ success: false, message: 'Error reading products' });
  }
});

// GET /api/products/by-disease?disease=<name>
// Returns primary + alternative products matched to diagnosed disease / pest
router.get('/by-disease', async (req, res) => {
  try {
    const { disease } = req.query;
    if (!disease) {
      return res.status(400).json({ success: false, message: 'disease query param required' });
    }

    const products = await loadAllProducts();
    const diseaseLower = disease.toLowerCase();

    // Step 1: Direct keyword match on product.diseases / targetPests array
    let primaryProducts = products.filter(p =>
      p.diseases?.some(d => diseaseLower.includes(d.toLowerCase()) || d.toLowerCase().includes(diseaseLower)) ||
      p.targetPests?.some(tp => diseaseLower.includes(tp.toLowerCase()) || tp.toLowerCase().includes(diseaseLower)) ||
      p.activeIngredient?.toLowerCase().includes(diseaseLower)
    );

    // Step 2: If no direct match, try AI matching via Gemini
    if (primaryProducts.length === 0 && process.env.GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // Provide catalog sample to AI
        const catalogSnippet = products.slice(0, 40).map(p =>
          `ID: ${p.id} | Name: ${p.name} | Active: ${p.activeIngredient} | Treats: ${p.diseases?.join(', ')}`
        ).join('\n');

        const prompt = `You are an agricultural pest control expert.
Target Pest / Disease: "${disease}"

Products catalog:
${catalogSnippet}

Return a JSON array of up to 4 matching Product IDs that treat this pest/disease.
Format: ["P001", "CSV-102"] — reply with ONLY the JSON array.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, '').trim();
        const ids = JSON.parse(text);
        primaryProducts = ids.map(id => products.find(p => p.id === id)).filter(Boolean);
      } catch (aiErr) {
        console.error('⚠ AI product matching failed:', aiErr.message);
      }
    }

    // Step 3: Collect alternatives
    const primaryIds = new Set(primaryProducts.map(p => p.id));
    const alternativeProducts = products.filter(p =>
      !primaryIds.has(p.id) &&
      p.category === (primaryProducts[0]?.category || 'insecticide')
    ).slice(0, 3);

    res.json({
      success: true,
      data: {
        disease,
        primary: primaryProducts.slice(0, 4),
        alternatives: alternativeProducts
      }
    });
  } catch (error) {
    console.error('❌ by-disease error:', error.message);
    res.status(500).json({ success: false, message: 'Error finding products for disease' });
  }
});

export default router;