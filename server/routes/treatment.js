import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readConfig, writeConfig } from '../utils/mongoStore.js';

const router = express.Router();

// diseaseRecommendations / priceData are "config" collections (see
// utils/mongoStore.js) — fetched lazily and cached in memory rather than at
// module load, since this module is imported before index.js connects to
// Mongo; a top-level await here would run a query before the connection
// exists.
let recommendationsCache = null;
async function getRecommendations() {
  if (recommendationsCache) return recommendationsCache;
  try {
    const doc = await readConfig('diseaseRecommendations', { recommendations: {} });
    recommendationsCache = doc.recommendations || {};
  } catch (err) {
    console.error("❌ Failed to load disease recommendations:", err.message);
    recommendationsCache = {};
  }
  return recommendationsCache;
}

let priceDataCache = null;
async function getPriceData() {
  if (priceDataCache) return priceDataCache;
  try {
    const doc = await readConfig('priceData', { prices: {} });
    priceDataCache = doc.prices || {};
  } catch (err) {
    console.error("❌ Failed to load price data:", err.message);
    priceDataCache = {};
  }
  return priceDataCache;
}

// AI-powered disease matching using Gemini
async function aiMatchDisease(diseaseName) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const recommendations = await getRecommendations();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.7-flash" });

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

function calcHaversineKm(lat1, lng1, lat2, lng2) {
  const p = Math.PI / 180;
  const a = 0.5 - Math.cos((lat2 - lat1) * p)/2 + 
            Math.cos(lat1 * p) * Math.cos(lat2 * p) * 
            (1 - Math.cos((lng2 - lng1) * p))/2;
  return 12742 * Math.asin(Math.sqrt(a));
}

function getDynamicMockShops(baseLat, baseLng) {
  const lat = parseFloat(baseLat) || 12.9716;
  const lng = parseFloat(baseLng) || 77.5946;
  const rawShops = [
    {
      name: "Shree Agro Suppliers",
      address: "Main Market Road, Near Bus Stand, Kumbalgodu",
      rating: 4.6,
      phone: "+91 98765 43210",
      location: { lat: lat + 0.008, lng: lng + 0.006 },
      availability: "In Stock"
    },
    {
      name: "Sri Chamundeshwari Fertilizers",
      address: "Station Road, Opposite SBI Bank, Kengeri",
      rating: 4.4,
      phone: "+91 99887 76655",
      location: { lat: lat - 0.007, lng: lng + 0.012 },
      availability: "In Stock"
    },
    {
      name: "Hassan Agro Bio Tech",
      address: "NH-48, Agricultural Market Yard, Bannerghatta",
      rating: 4.5,
      phone: "+91 97766 55443",
      location: { lat: lat + 0.012, lng: lng - 0.009 },
      availability: "Limited Stock"
    },
    {
      name: "Venkateshwara Krishi Kendra",
      address: "Tavarekere Main Road, Near bus stand",
      rating: 4.6,
      phone: "+91 96655 44332",
      location: { lat: lat + 0.005, lng: lng - 0.012 },
      availability: "In Stock"
    },
    {
      name: "Kisan Krishi Kendra",
      address: "Gandhi Chowk, Near Mandi",
      rating: 4.2,
      phone: "+91 98450 12345",
      location: { lat: lat - 0.011, lng: lng - 0.014 },
      availability: "In Stock"
    },
    {
      name: "Green Care Agri Store",
      address: "Krishi Complex, Main Road",
      rating: 4.7,
      phone: "+91 99001 88776",
      location: { lat: lat + 0.015, lng: lng + 0.018 },
      availability: "In Stock"
    }
  ];

  return rawShops
    .map(shop => {
      const d = calcHaversineKm(lat, lng, shop.location.lat, shop.location.lng);
      return {
        ...shop,
        distanceVal: d,
        distance: d.toFixed(1) + " km"
      };
    })
    .filter(shop => shop.distanceVal <= 10.0)
    .sort((a, b) => a.distanceVal - b.distanceVal);
}

// POST /api/treatment — Get treatment recommendation for a disease
router.post('/', async (req, res) => {
  try {
    const { disease_name, crop_name } = req.body;

    if (!disease_name) {
      return res.status(400).json({ success: false, message: 'disease_name is required' });
    }

    const recommendations = await getRecommendations();

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
    const priceData = await getPriceData();
    const price = priceData[rec.priceKey] || null;

    // Automatically sync primary pesticide & alternative into Vendor Product Catalog
    await syncProductsToCatalog([
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

// GET /api/treatment/nearby-shops — Find ALL nearby fertilizer/pesticide/agri shops within 10 km
router.get('/nearby-shops', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    const userLat = parseFloat(lat) || 12.9716;
    const userLng = parseFloat(lng) || 77.5946;

    // If we have a real API key, use Google Maps Places API
    if (apiKey && apiKey !== '' && apiKey !== 'your_key_here') {
      try {
        const keywords = ['fertilizer', 'pesticide', 'agricultural', 'krishi', 'seed', 'agro', 'kisan'];
        let allPlaces = [];

        await Promise.all(keywords.map(async (kw) => {
          try {
            const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${userLat},${userLng}&radius=10000&keyword=${encodeURIComponent(kw)}&key=${apiKey}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.results && data.results.length > 0) {
              allPlaces.push(...data.results);
            }
          } catch (err) {}
        }));

        if (allPlaces.length > 0) {
          const map = new Map();
          // Excludes nursery/garden/plant terms on purpose — the user wants agri product shops (fertilizer, pesticide, seed, etc), not plant nurseries.
          const AGRI_NAME_HINTS = /fertiliz|fertilis|agro|agri|pesticide|krishi|kisan|seed|bio|organic|farm|chem/i;
          const EXCLUDE_HINTS = /nursery|garden|plant\s*nursery|landscap/i;

          const shopsWithDist = [];
          for (const place of allPlaces) {
            if (!place.place_id || map.has(place.place_id)) continue;
            map.set(place.place_id, true);

            const shopLat = place.geometry?.location?.lat;
            const shopLng = place.geometry?.location?.lng;
            if (shopLat === undefined || shopLng === undefined) continue;

            const name = place.name || 'Agri Shop';
            if (!AGRI_NAME_HINTS.test(name) || EXCLUDE_HINTS.test(name)) continue;

            const distVal = calcHaversineKm(userLat, userLng, shopLat, shopLng);
            if (distVal <= 10.0) {
              shopsWithDist.push({
                name,
                address: place.vicinity || 'Address not available',
                rating: place.rating || 4.2,
                phone: null,
                location: { lat: shopLat, lng: shopLng },
                availability: 'In Stock',
                distanceVal: distVal,
                distance: distVal.toFixed(1) + " km",
                placeId: place.place_id
              });
            }
          }

          // Sort ascending by distance — return ALL shops within 10 km without slice limit!
          shopsWithDist.sort((a, b) => a.distanceVal - b.distanceVal);

          if (shopsWithDist.length > 0) {
            return res.json({
              success: true,
              source: 'google_maps',
              disclaimer: 'Availability may vary, please confirm with store',
              data: shopsWithDist
            });
          }
        }
      } catch (apiErr) {
        console.error("⚠ Google Maps API error, falling back to mock:", apiErr.message);
      }
    }

    // Fallback: return mock data centered on user's actual location (strictly within 10 km, no limit)
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
router.get('/diseases', async (req, res) => {
  const recommendations = await getRecommendations();
  const diseases = Object.entries(recommendations).map(([key, val]) => ({
    key,
    disease: val.disease,
    crop: val.crop,
    label: `${val.crop} — ${val.disease}`
  }));
  res.json({ success: true, data: diseases });
});

async function syncProductsToCatalog(items) {
  try {
    const catalogData = await readConfig('productCatalog', { products: [] });
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
      await writeConfig('productCatalog', catalogData);
    }
  } catch (err) {
    console.error("Error syncing treatment product to catalog:", err.message);
  }
}

export default router;
