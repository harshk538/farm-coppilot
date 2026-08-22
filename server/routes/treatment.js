import express from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

// Load data files
const recPath = path.join(process.cwd(), 'data', 'diseaseRecommendations.json');
const pricePath = path.join(process.cwd(), 'data', 'priceData.json');

let recommendations = {};
let priceData = {};

try {
  recommendations = JSON.parse(fs.readFileSync(recPath, 'utf8')).recommendations;
} catch (err) {
  console.error("❌ Failed to load disease recommendations:", err.message);
}

try {
  priceData = JSON.parse(fs.readFileSync(pricePath, 'utf8')).prices;
} catch (err) {
  console.error("❌ Failed to load price data:", err.message);
}

// AI-powered disease matching using Gemini
async function aiMatchDisease(diseaseName) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const availableKeys = Object.keys(recommendations);
    const keyDescriptions = availableKeys.map(k => {
      const r = recommendations[k];
      return `"${k}" → ${r.crop} - ${r.disease}`;
    }).join('\n');

    const prompt = `You are a crop disease matching system. Given an AI-diagnosed disease name, find the BEST matching key from the database below.

AI Diagnosis: "${diseaseName}"

Available disease keys:
${keyDescriptions}

Reply with ONLY the exact key string (e.g. "Tomato___Leaf_Spot") that best matches the diagnosis. If no reasonable match exists, reply with "NONE".`;

    const result = await model.generateContent(prompt);
    const matchedKey = result.response.text().trim().replace(/"/g, '');
    
    if (matchedKey !== 'NONE' && recommendations[matchedKey]) {
      console.log(`🧠 AI matched "${diseaseName}" → "${matchedKey}"`);
      return recommendations[matchedKey];
    }
    return null;
  } catch (err) {
    console.error("⚠ AI matching failed:", err.message);
    return null;
  }
}

function getDynamicMockShops(baseLat, baseLng) {
  const lat = parseFloat(baseLat) || 12.9716;
  const lng = parseFloat(baseLng) || 77.5946;
  return [
    {
      name: "Shree Agro Suppliers",
      address: "Main Market Road, Near Bus Stand",
      rating: 4.6,
      phone: "+91 98765 43210",
      location: { lat: lat + 0.008, lng: lng + 0.006 },
      availability: "In Stock",
      distance: "1.2 km"
    },
    {
      name: "Sri Chamundeshwari Fertilizers",
      address: "Station Road, Opposite SBI Bank",
      rating: 4.4,
      phone: "+91 99887 76655",
      location: { lat: lat - 0.007, lng: lng + 0.012 },
      availability: "In Stock",
      distance: "2.1 km"
    },
    {
      name: "Hassan Agro Bio Tech",
      address: "NH-48, Agricultural Market Yard",
      rating: 4.5,
      phone: "+91 97766 55443",
      location: { lat: lat + 0.012, lng: lng - 0.009 },
      availability: "Limited Stock",
      distance: "3.5 km"
    },
    {
      name: "Kisan Krishi Kendra",
      address: "Gandhi Chowk, Near Mandi",
      rating: 4.2,
      phone: "+91 98450 12345",
      location: { lat: lat - 0.011, lng: lng - 0.014 },
      availability: "In Stock",
      distance: "4.2 km"
    },
    {
      name: "Green Care Agri Store",
      address: "Krishi Complex, Main Road",
      rating: 4.7,
      phone: "+91 99001 88776",
      location: { lat: lat + 0.015, lng: lng + 0.018 },
      availability: "In Stock",
      distance: "5.0 km"
    }
  ];
}

// POST /api/treatment — Get treatment recommendation for a disease
router.post('/', async (req, res) => {
  try {
    const { disease_name, crop_name } = req.body;

    if (!disease_name) {
      return res.status(400).json({ success: false, message: 'disease_name is required' });
    }

    // Try exact match first
    let rec = recommendations[disease_name];
    
    if (!rec) {
      const searchKey = disease_name.toLowerCase();
      // Intelligent keyword matching
      const matchedKey = Object.keys(recommendations).find(key => {
        const kLower = key.toLowerCase();
        if (kLower.includes(searchKey.replace(/\s+/g, '_'))) return true;
        if (searchKey.includes('gall') || searchKey.includes('midge')) return kLower.includes('gall_midge');
        if (searchKey.includes('blight')) return kLower.includes('blight');
        if (searchKey.includes('rust')) return kLower.includes('rust');
        if (searchKey.includes('spot')) return kLower.includes('spot');
        if (searchKey.includes('mildew')) return kLower.includes('mildew');
        return false;
      });
      if (matchedKey) rec = recommendations[matchedKey];
    }

    // If still no match, try AI-powered matching
    if (!rec) {
      console.log(`🔍 Trying AI match for "${disease_name}"...`);
      rec = await aiMatchDisease(disease_name);
    }

    // Smart fallback if database/AI has no key match (ensure alternatives ALWAYS show!)
    if (!rec) {
      const isInsect = /gall|midge|aphid|worm|borer|fly|bug|pest|beetle|caterpillar/i.test(disease_name);
      rec = isInsect ? {
        disease: disease_name,
        crop: crop_name || "General",
        pesticide: "Imidacloprid 17.8% SL",
        dosage: "0.5ml per litre of water",
        alternative: "Dimethoate 30% EC",
        altDosage: "1.7ml per litre of water",
        category: "insecticide",
        application: "Foliar spray at early symptoms. Repeat at 10-14 day intervals.",
        precautions: "Wear protective gloves and face mask during application.",
        priceKey: "imidacloprid_178sl"
      } : {
        disease: disease_name,
        crop: crop_name || "General",
        pesticide: "Mancozeb 75% WP",
        dosage: "2.5g per litre of water",
        alternative: "Copper Oxychloride 50% WP",
        altDosage: "3g per litre of water",
        category: "fungicide",
        application: "Foliar spray at 10-15 day intervals during humid weather.",
        precautions: "Avoid spraying during high winds or full sunlight.",
        priceKey: "mancozeb_75wp"
      };
    }

    // Get price data
    const price = priceData[rec.priceKey] || null;

    // Automatically sync primary pesticide & alternative into Vendor Product Catalog
    syncProductsToCatalog([
      { name: rec.pesticide, category: rec.category, dosage: rec.dosage, crop: rec.crop, whyThis: rec.application },
      rec.alternative ? { name: rec.alternative, category: rec.category, dosage: rec.altDosage, crop: rec.crop } : null
    ].filter(Boolean));

    res.json({
      success: true,
      data: {
        found: true,
        disease: rec.disease,
        crop: rec.crop,
        pesticide: rec.pesticide,
        dosage: rec.dosage,
        alternative: rec.alternative,
        altDosage: rec.altDosage,
        category: rec.category,
        application: rec.application,
        precautions: rec.precautions,
        pricing: price ? {
          productName: price.productName,
          brands: price.brands,
          priceRange: price.priceRange,
          unit: price.unit,
          source: price.source
        } : null
      }
    });
  } catch (error) {
    console.error("❌ Treatment error:", error.message);
    res.status(500).json({ success: false, message: 'Error processing treatment request' });
  }
});

// GET /api/treatment/ip-location — Get IP location server-side for mobile HTTP clients
router.get('/ip-location', async (req, res) => {
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    if (data && data.latitude && data.longitude) {
      return res.json({ success: true, lat: data.latitude, lng: data.longitude, city: data.city });
    }
  } catch (e) {}
  res.json({ success: true, lat: 12.8006, lng: 77.5084, city: 'Bengaluru' });
});

// GET /api/treatment/nearby-shops — Find nearby fertilizer/pesticide shops
router.get('/nearby-shops', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    const userLat = parseFloat(lat) || 12.9716;
    const userLng = parseFloat(lng) || 77.5946;

    // If we have a real API key, use Google Maps Places API
    if (apiKey && apiKey !== '' && apiKey !== 'your_key_here') {
      try {
        const keyword = encodeURIComponent('fertilizer shop pesticide shop agricultural shop');
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${userLat},${userLng}&radius=10000&keyword=${keyword}&key=${apiKey}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
          const p = Math.PI / 180;

          const shops = data.results.slice(0, 8).map(place => {
            const shopLat = place.geometry?.location?.lat;
            const shopLng = place.geometry?.location?.lng;
            
            let distStr = null;
            if (shopLat !== undefined && shopLng !== undefined && !isNaN(userLat) && !isNaN(userLng)) {
               const a = 0.5 - Math.cos((shopLat - userLat) * p)/2 + 
               Math.cos(userLat * p) * Math.cos(shopLat * p) * 
               (1 - Math.cos((shopLng - userLng) * p))/2;
               const d = 12742 * Math.asin(Math.sqrt(a));
               distStr = d.toFixed(1) + " km";
            }

            return {
              name: place.name || 'Unknown Store',
              address: place.vicinity || 'Address not available',
              rating: place.rating || 4.2,
              phone: null,
              location: { lat: shopLat, lng: shopLng },
              availability: 'In Stock',
              distance: distStr,
              placeId: place.place_id
            };
          });

          return res.json({
            success: true,
            source: 'google_maps',
            disclaimer: 'Availability may vary, please confirm with store',
            data: shops
          });
        }
      } catch (apiErr) {
        console.error("⚠ Google Maps API error, falling back to mock:", apiErr.message);
      }
    }

    // Fallback: return mock data centered on user's actual location
    res.json({
      success: true,
      source: 'mock',
      disclaimer: 'Availability may vary, please confirm with store',
      data: getDynamicMockShops(userLat, userLng)
    });

  } catch (error) {
    console.error("❌ Nearby shops error:", error.message);
    res.status(500).json({ success: false, message: 'Error finding nearby shops' });
  }
});

// GET /api/treatment/diseases — List all supported diseases (for dropdown)
router.get('/diseases', (req, res) => {
  const diseases = Object.entries(recommendations).map(([key, val]) => ({
    key,
    disease: val.disease,
    crop: val.crop,
    label: `${val.crop} — ${val.disease}`
  }));
  res.json({ success: true, data: diseases });
});

function syncProductsToCatalog(items) {
  try {
    const catalogPath = path.join(process.cwd(), 'data', 'productCatalog.json');
    if (!fs.existsSync(catalogPath)) return;

    const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    let catalogProducts = catalogData.products || [];
    let updated = false;

    for (const item of items) {
      if (!item || !item.name) continue;
      const prodName = item.name;

      const existing = catalogProducts.find(
        p => p.name.toLowerCase() === prodName.toLowerCase()
      );

      if (!existing) {
        const newProduct = {
          id: `CSV-${Math.floor(100 + Math.random() * 900)}`,
          name: prodName,
          category: (item.category || 'insecticide').toLowerCase(),
          activeIngredient: item.activeIngredient || prodName,
          dosage: item.dosage || '1.5 - 2.5ml per litre of water',
          price: item.price || 350,
          unit: '250ml',
          inStock: true,
          verified: true,
          whyThis: item.whyThis || `Recommended for ${item.crop || 'crop'} protection.`
        };
        catalogProducts.push(newProduct);
        updated = true;
      }
    }

    if (updated) {
      catalogData.products = catalogProducts;
      fs.writeFileSync(catalogPath, JSON.stringify(catalogData, null, 2));
    }
  } catch (err) {
    console.error("Error syncing treatment product to catalog:", err.message);
  }
}

export default router;
