import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readCollection, writeCollection, readConfig } from '../utils/mongoStore.js';

const router = express.Router();

// The seven values the NPK meter reports over USB serial.
const PARAMS = ['n', 'p', 'k', 'ph', 'moisture', 'temperature', 'tds'];

// Sanity bounds — a confirmed test outside these is almost certainly a bad
// serial frame rather than real soil, so we refuse to store it as history.
const VALID_RANGES = {
  n: [0, 2000],
  p: [0, 2000],
  k: [0, 2000],
  ph: [0, 14],
  moisture: [0, 100],
  temperature: [-20, 80],
  tds: [0, 20000],
};

// Now backed by MongoDB instead of data/soilTests.json + data/farms.json —
// same read-all-as-array shape every handler below already expects.
const readTests = () => readCollection('soilTests', []);
const writeTests = (tests) => writeCollection('soilTests', tests);
const readFarms = () => readCollection('farms', []);

// ── Deterministic Reference Data & Predictive Analytics Evaluator ─────────
async function evaluateReferenceData(farm, latestReadings, history = []) {
  // Each of these is a single "config" document per collection (see
  // utils/mongoStore.js) — the whole reference dataset in one read, same
  // shape as when this came straight from the JSON file.
  const cropRanges = await readConfig('cropNutrientRanges', { crops: {} });
  const fertilizerData = await readConfig('fertilizerDosage', { recommendations: [] });
  const soilRegions = await readConfig('soilRegions', { stateZones: {}, soilTypes: [] });
  const calendarData = await readConfig('cropCalendar', { seasons: [] });
  const diseaseRules = await readConfig('soilBorneDiseaseRisk', { rules: [] });

  const readings = latestReadings || {};
  const ph = Number(readings.ph) || 7.0;
  const moisture = Number(readings.moisture) || 50;
  const temp = Number(readings.temperature) || 25;
  const cropName = (farm.currentCrop || '').toLowerCase().trim();
  const location = (farm.location || '').trim();

  // 1. Soil-borne Disease Risk Evaluation
  const detectedDiseaseRisks = [];
  for (const rule of (diseaseRules.rules || [])) {
    let matches = true;
    const cond = rule.conditions || {};

    if (cond.phMin !== undefined && ph < cond.phMin) matches = false;
    if (cond.phMax !== undefined && ph > cond.phMax) matches = false;
    if (cond.moistureMin !== undefined && moisture < cond.moistureMin) matches = false;
    if (cond.moistureMax !== undefined && moisture > cond.moistureMax) matches = false;
    if (cond.tempMin !== undefined && temp < cond.tempMin) matches = false;
    if (cond.tempMax !== undefined && temp > cond.tempMax) matches = false;

    if (matches) {
      detectedDiseaseRisks.push({
        disease: rule.disease,
        pathogen: rule.pathogen,
        risk: rule.risk,
        icon: rule.icon || '⚠️',
        reason: rule.reason,
        prevention: rule.prevention,
        source: rule.source,
        confidence: rule.confidence,
        crops: rule.crops,
        triggeringConditions: cond.note || `pH: ${ph}, Moisture: ${moisture}%, Temp: ${temp}°C`
      });
    }
  }

  // 2. Crop Soil Benchmarks (Kaggle/ICAR)
  let cropBenchmark = null;
  const cropKeys = Object.keys(cropRanges.crops || {});
  const matchedKey = cropKeys.find(k => k.toLowerCase() === cropName || cropName.includes(k.toLowerCase()));
  if (matchedKey) {
    cropBenchmark = {
      crop: matchedKey,
      ...cropRanges.crops[matchedKey]
    };
  }

  // 3. Agroclimatic Zone & Soil Type Mapping
  let matchedZoneInfo = null;
  let stateMatched = null;
  for (const stateName of Object.keys(soilRegions.stateZones || {})) {
    if (location.toLowerCase().includes(stateName.toLowerCase()) || stateName.toLowerCase().includes(location.toLowerCase())) {
      matchedZoneInfo = soilRegions.stateZones[stateName];
      stateMatched = stateName;
      break;
    }
  }

  // 4. Fertilizer Recommendation Lookup (NAAS Policy 42)
  let fertilizerRec = null;
  if (stateMatched && cropName) {
    fertilizerRec = (fertilizerData.recommendations || []).find(r => 
      r.state.toLowerCase().includes(stateMatched.toLowerCase()) &&
      (r.crop.toLowerCase().includes(cropName) || cropName.includes(r.crop.toLowerCase()))
    ) || null;
  }

  // 5. Current Season Guidance
  const currentMonth = new Date().getMonth() + 1; // 1-12
  let currentSeason = 'Kharif';
  if (currentMonth >= 10 || currentMonth <= 3) {
    currentSeason = 'Rabi';
  } else if (currentMonth >= 4 && currentMonth <= 6) {
    currentSeason = 'Zaid';
  }
  const seasonInfo = (calendarData.seasons || []).find(s => s.season === currentSeason) || null;

  // 6. Time-Series Predictive Engine & Chart Forecasting Data
  const sortedHistory = [...history].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const parameterForecasts = {};
  const daysToDeficiency = [];
  let acidificationWarning = null;

  const paramsList = ['n', 'p', 'k', 'ph', 'moisture', 'temperature', 'tds'];

  if (sortedHistory.length >= 2) {
    const firstTest = sortedHistory[0];
    const lastTest = sortedHistory[sortedHistory.length - 1];
    const timeDiffMs = new Date(lastTest.createdAt) - new Date(firstTest.createdAt);
    const timeDiffDays = Math.max(0.5, timeDiffMs / (1000 * 60 * 60 * 24));

    paramsList.forEach(param => {
      const series = sortedHistory.map(t => ({
        val: Number(t.readings[param]),
        date: new Date(t.createdAt)
      })).filter(item => Number.isFinite(item.val));

      if (series.length >= 2) {
        const firstVal = series[0].val;
        const lastVal = series[series.length - 1].val;
        const totalChange = lastVal - firstVal;
        const dailyRate = Math.round((totalChange / timeDiffDays) * 100) / 100;

        // Generate 7-day projected forecast points
        const forecast7Day = Math.max(0, Math.round((lastVal + dailyRate * 7) * 10) / 10);
        const forecast3Day = Math.max(0, Math.round((lastVal + dailyRate * 3) * 10) / 10);

        // Chart data: historical points + predicted points
        const chartPoints = series.map((pt, index) => ({
          label: pt.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          value: Math.round(pt.val * 10) / 10,
          isPredicted: false
        }));

        // Append 3-day and 7-day predicted points for visualization
        chartPoints.push({
          label: '+3 Days',
          value: forecast3Day,
          isPredicted: true
        });
        chartPoints.push({
          label: '+7 Days',
          value: forecast7Day,
          isPredicted: true
        });

        parameterForecasts[param] = {
          current: lastVal,
          dailyRate,
          forecast3Day,
          forecast7Day,
          trend: dailyRate === 0 ? 'stable' : (dailyRate > 0 ? 'rising' : 'falling'),
          chartPoints
        };

        // Days to deficiency threshold calculations
        const benchmarkMin = cropBenchmark?.[param.toUpperCase()]?.min || (param === 'n' ? 60 : param === 'p' ? 35 : param === 'k' ? 35 : 0);
        if (dailyRate < 0 && lastVal > benchmarkMin) {
          const daysLeft = Math.ceil((lastVal - benchmarkMin) / Math.abs(dailyRate));
          if (daysLeft <= 30) {
            daysToDeficiency.push({
              parameter: param.toUpperCase(),
              currentVal: lastVal,
              thresholdVal: benchmarkMin,
              dailyDrop: Math.abs(dailyRate),
              estimatedDaysRemaining: daysLeft
            });
          }
        }

        // Soil Acidification Risk Check (pH dropping < 4.5)
        if (param === 'ph' && dailyRate < 0 && lastVal <= 5.5) {
          const daysToAcid = Math.ceil((lastVal - 4.5) / Math.abs(dailyRate));
          acidificationWarning = {
            currentPh: lastVal,
            dailyDrop: Math.abs(dailyRate),
            daysUntilCritical: Math.max(1, daysToAcid),
            recommendation: 'Apply 250-400 kg/acre agricultural lime prior to sowing.'
          };
        }
      }
    });
  }

  return {
    diseaseRisks: detectedDiseaseRisks,
    cropBenchmark,
    regionalZone: matchedZoneInfo ? { state: stateMatched, ...matchedZoneInfo } : null,
    fertilizerRecommendation: fertilizerRec,
    currentSeasonInfo: seasonInfo,
    predictiveAnalytics: {
      parameterForecasts,
      daysToDeficiency,
      acidificationWarning,
      historyCount: sortedHistory.length
    }
  };
}

// ── GET /api/soil/tests?farmerId=&farmId=  (history, newest first) ─────────
router.get('/tests', async (req, res) => {
  const { farmerId, farmId } = req.query;
  if (!farmerId) return res.status(400).json({ success: false, message: 'farmerId is required.' });

  let tests = (await readTests()).filter(t => t.farmerId === farmerId);
  if (farmId) tests = tests.filter(t => t.farmId === farmId);
  tests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ success: true, tests });
});

// ── POST /api/soil/tests  (save one confirmed, stable reading) ─────────────
router.post('/tests', async (req, res) => {
  try {
    const { farmerId, farmId, readings, extras, source, stabilitySeconds, notes } = req.body;
    if (!farmerId || !farmId) {
      return res.status(400).json({ success: false, message: 'farmerId and farmId are required.' });
    }
    if (!readings || typeof readings !== 'object') {
      return res.status(400).json({ success: false, message: 'Soil readings are missing.' });
    }

    // Every one of the seven values must be present and inside its sane range.
    const clean = {};
    for (const key of PARAMS) {
      const value = Number(readings[key]);
      if (!Number.isFinite(value)) {
        return res.status(400).json({ success: false, message: `Reading for "${key}" is missing or not a number.` });
      }
      const [min, max] = VALID_RANGES[key];
      if (value < min || value > max) {
        return res.status(400).json({ success: false, message: `Reading for "${key}" (${value}) is outside the expected range.` });
      }
      clean[key] = value;
    }

    const cleanExtras = {};
    if (extras && typeof extras === 'object') {
      for (const key of ['ec', 'salinity']) {
        const value = Number(extras[key]);
        if (Number.isFinite(value)) cleanExtras[key] = value;
      }
    }

    const farm = (await readFarms()).find(f => f.id === farmId);
    if (!farm) return res.status(404).json({ success: false, message: 'Farm not found.' });
    if (farm.farmerId !== farmerId) {
      return res.status(403).json({ success: false, message: 'This farm is not yours.' });
    }

    // The crop and location are snapshotted onto the test, so history stays
    // truthful even if the farm is renamed or a different crop is sown later.
    const test = {
      id: `SOIL-${Date.now()}`,
      farmerId,
      farmId,
      farmName: farm.name,
      crop: farm.currentCrop || '',
      coords: farm.coords || null,
      readings: clean,
      extras: cleanExtras,
      source: source === 'manual' ? 'manual' : 'device',
      stabilitySeconds: Number(stabilitySeconds) || null,
      notes: (notes && String(notes).trim()) || '',
      createdAt: new Date().toISOString(),
    };

    const tests = await readTests();
    tests.push(test);
    await writeTests(tests);

    res.json({ success: true, test });
  } catch (err) {
    console.error('Save soil test failed:', err.message);
    res.status(500).json({ success: false, message: 'Could not save this soil test.' });
  }
});

// ── DELETE /api/soil/tests/:id ─────────────────────────────────────────────
router.delete('/tests/:id', async (req, res) => {
  const { farmerId } = req.query;
  const tests = await readTests();
  const test = tests.find(t => t.id === req.params.id);
  if (!test) return res.status(404).json({ success: false, message: 'Soil test not found.' });
  if (farmerId && test.farmerId !== farmerId) {
    return res.status(403).json({ success: false, message: 'This test is not yours.' });
  }

  await writeTests(tests.filter(t => t.id !== req.params.id));
  res.json({ success: true });
});

/* ══════════════════════════════════════════════════════════════════════════
   AI ANALYSIS WITH ICAR & EXTENSION DATASETS
   ══════════════════════════════════════════════════════════════════════════ */

function computeTrends(testsOldestFirst) {
  if (testsOldestFirst.length < 2) return null;

  const trends = {};
  for (const key of PARAMS) {
    const series = testsOldestFirst.map(t => t.readings[key]).filter(Number.isFinite);
    if (series.length < 2) continue;

    const first = series[0];
    const last = series[series.length - 1];
    const change = last - first;
    const pct = first !== 0 ? (change / Math.abs(first)) * 100 : 0;
    const average = series.reduce((sum, v) => sum + v, 0) / series.length;

    trends[key] = {
      first,
      last,
      change: Math.round(change * 10) / 10,
      changePct: Math.round(pct * 10) / 10,
      average: Math.round(average * 10) / 10,
      direction: Math.abs(pct) < 5 ? 'steady' : (change > 0 ? 'rising' : 'falling'),
      readings: series,
    };
  }
  return trends;
}

async function getWeatherContext(coords) {
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return null;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}`
      + `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum`
      + `&current=temperature_2m,relative_humidity_2m,precipitation`
      + `&past_days=30&forecast_days=7&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.daily) return null;

    const days = data.daily.time.length;
    const forecastDays = 7;
    const pastEnd = days - forecastDays;

    const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);
    const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0);
    const round = (v) => Math.round(v * 10) / 10;

    const pastRain = data.daily.precipitation_sum.slice(0, pastEnd);
    const nextRain = data.daily.precipitation_sum.slice(pastEnd);
    const pastMax = data.daily.temperature_2m_max.slice(0, pastEnd);
    const pastMin = data.daily.temperature_2m_min.slice(0, pastEnd);
    const nextMax = data.daily.temperature_2m_max.slice(pastEnd);

    return {
      now: {
        temperature: data.current?.temperature_2m ?? null,
        humidity: data.current?.relative_humidity_2m ?? null,
        raining: (data.current?.precipitation ?? 0) > 0,
      },
      past30Days: {
        totalRainMm: round(sum(pastRain)),
        rainyDays: pastRain.filter(v => Number(v) > 1).length,
        avgMaxTempC: round(avg(pastMax)),
        avgMinTempC: round(avg(pastMin)),
      },
      next7Days: {
        totalRainMm: round(sum(nextRain)),
        rainyDays: nextRain.filter(v => Number(v) > 1).length,
        avgMaxTempC: round(avg(nextMax)),
      },
    };
  } catch (err) {
    console.error('Weather lookup for soil analysis failed:', err.message);
    return null;
  }
}

async function loadCatalog() {
  const data = await readConfig('productCatalog', { products: [] });
  return Array.isArray(data) ? data : (data.products || []);
}

function buildPrompt({ farm, latest, history, trends, weather, catalog, referenceData }) {
  const hasCrop = !!(farm.currentCrop && farm.currentCrop.trim());
  const pastCrops = (farm.cropHistory || []).map(c => c.crop).filter(Boolean);

  return `You are an agricultural soil advisor for a small farmer in India.

WRITE IN VERY SIMPLE ENGLISH. Short sentences. No jargon. A farmer with basic
schooling must understand every line.

=== THIS FARM ===
Name: ${farm.name}
Location: ${farm.location}
Current crop: ${hasCrop ? farm.currentCrop : 'NOT SET — the field is empty or the farmer has not told us'}
Past crops on this field: ${pastCrops.length ? pastCrops.join(', ') : 'none recorded'}

=== LATEST SOIL TEST (${new Date(latest.createdAt).toDateString()}) ===
Nitrogen (N): ${latest.readings.n} mg/kg
Phosphorus (P): ${latest.readings.p} mg/kg
Potassium (K): ${latest.readings.k} mg/kg
pH: ${latest.readings.ph}
Moisture: ${latest.readings.moisture} %
Soil temperature: ${latest.readings.temperature} C
TDS: ${latest.readings.tds} ppm
${latest.extras?.ec ? `EC: ${latest.extras.ec} uS/cm` : ''}
${latest.extras?.salinity ? `Salinity: ${latest.extras.salinity}` : ''}

=== ICAR & EXTENSION REFERENCE BENCHMARKS ===
${referenceData.cropBenchmark ? `Crop Ideal Benchmarks (${referenceData.cropBenchmark.crop}): N min/avg/max: ${referenceData.cropBenchmark.N.min}/${referenceData.cropBenchmark.N.avg}/${referenceData.cropBenchmark.N.max}, P: ${referenceData.cropBenchmark.P.min}/${referenceData.cropBenchmark.P.avg}/${referenceData.cropBenchmark.P.max}, K: ${referenceData.cropBenchmark.K.min}/${referenceData.cropBenchmark.K.avg}/${referenceData.cropBenchmark.K.max}, pH: ${referenceData.cropBenchmark.ph.min}-${referenceData.cropBenchmark.ph.max}` : 'No crop benchmark file match.'}
${referenceData.regionalZone ? `Regional Zone (${referenceData.regionalZone.state}): ${referenceData.regionalZone.zone}, Soils: ${referenceData.regionalZone.soilTypes}` : ''}
${referenceData.fertilizerRecommendation ? `NAAS Policy 42 Recommended Fertilizer Dose for ${referenceData.fertilizerRecommendation.crop} in ${referenceData.fertilizerRecommendation.state}: N=${referenceData.fertilizerRecommendation.n_kgPerHa} kg/ha, P2O5=${referenceData.fertilizerRecommendation.p2o5_kgPerHa} kg/ha, K2O=${referenceData.fertilizerRecommendation.k2o_kgPerHa} kg/ha (Ratio ${referenceData.fertilizerRecommendation.ratio})` : ''}
${referenceData.diseaseRisks?.length ? `DETECTED SOIL DISEASE RISKS: ${referenceData.diseaseRisks.map(d => `${d.disease} (${d.pathogen}) - Risk: ${d.risk}. Reason: ${d.reason}`).join('; ')}` : 'No specific soil disease triggers identified.'}
${referenceData.currentSeasonInfo ? `Current Season: ${referenceData.currentSeasonInfo.season} (${referenceData.currentSeasonInfo.alsoCalled}). Sowing: ${referenceData.currentSeasonInfo.sowingWindow}` : ''}

=== SOIL HISTORY (${history.length} test${history.length === 1 ? '' : 's'} on this field) ===
${history.length < 2
  ? 'Only one test so far. Say so plainly and keep confidence "low".'
  : JSON.stringify(trends, null, 1)}

=== WEATHER AT THIS FARM ===
${weather ? JSON.stringify(weather, null, 1) : 'Weather data not available for this location.'}

=== PRODUCTS THE FARMER CAN ORDER IN THIS APP ===
${catalog.map(p => `${p.id} | ${p.name} | ${p.category} | Rs.${p.price} per ${p.unit} | ${p.whyThis || ''}`).join('\n')}

=== RULES YOU MUST FOLLOW ===
1. Base every statement on the numbers above and ICAR reference datasets.
2. NEVER say a disease is present or confirmed. Reference them as SOIL DISEASE RISKS evaluated from pH, moisture, and temperature conditions (e.g. Pythium, Fusarium, Phytophthora).
3. Suggest crops that suit this soil, season (Kharif/Rabi/Zaid), and climate.
4. Integrate the NAAS Policy 42 fertilizer doses into your recommendations where applicable.

Reply with ONLY this JSON:

{
  "soilSummary": "4 to 6 sentences describing this soil overall, in plain words. Cover how wet it is, how acidic or alkaline, the nutrient balance, and salt level.",
  "confidence": "low | medium | high",
  "confidenceReason": "1-2 sentences explaining why the confidence is at that level.",
  "parameters": [
    {
      "key": "n|p|k|ph|moisture|temperature|tds",
      "status": "low|optimal|high",
      "headline": "one short verdict line",
      "normalRange": "the healthy range for this value",
      "meaning": "2-3 sentences on what this reading means.",
      "cause": "2-3 sentences on the most likely reason.",
      "effectOnCrop": "2-3 sentences on what this does to plants.",
      "whatToDo": "2-3 sentences of practical action.",
      "ifIgnored": "1-2 sentences on what happens if nothing is done."
    }
  ],
  "corrections": [
    {
      "action": "short title of the action",
      "why": "2-3 sentences on why this is needed.",
      "how": "2-4 sentences of step by step method.",
      "howMuch": "quantity or dose guidance in Indian units.",
      "when": "best timing.",
      "expectedResult": "1-2 sentences on what should improve.",
      "urgency": "now|soon|watch",
      "productIds": ["catalog ID, or leave empty"]
    }
  ],
  "cropMode": "recommend|check",
  "currentCropCheck": {
    "verdict": "good fit|workable|poor fit",
    "why": "3-4 sentences on how this soil suits or fights this crop.",
    "risks": "2-3 sentences on specific problems.",
    "advice": "2-3 sentences on how to still get a good yield."
  },
  "cropRecommendations": [
    {
      "crop": "crop name",
      "fit": "good|moderate",
      "why": "3-4 sentences tying this crop to these exact readings.",
      "season": "when it is sown in this part of India",
      "waterNeed": "how much water it needs",
      "expectedBenefit": "2-3 sentences on what this crop does FOR the soil",
      "caution": "one thing to be careful about"
    }
  ],
  "risk": {
    "level": "Low|Medium|High",
    "summary": "2-3 sentences explaining overall risk picture.",
    "issues": [
      {
        "name": "risk name",
        "why": "3-4 sentences naming exact readings and weather that create this risk.",
        "signsToWatch": "what the farmer should look for in the field.",
        "prevention": "3-4 sentences of practical steps.",
        "timeframe": "how soon this could become a problem"
      }
    ]
  },
  "future": {
    "nextSeason": [
      {
        "crop": "crop name",
        "why": "3-4 sentences using farm trend and expected weather.",
        "whenToSow": "the sowing window",
        "prepareFirst": "2-3 sentences on what must be fixed in field before sowing"
      }
    ],
    "prepare": [
      { "step": "short title", "detail": "2-3 sentences on how to do it" }
    ]
  },
  "soilProfile": {
    "characterisation": "one sentence",
    "nutrientPattern": "2-3 sentences on N, P, K balance.",
    "phBehaviour": "2-3 sentences on pH behaviour.",
    "moistureBehaviour": "2-3 sentences on moisture pattern.",
    "saltBehaviour": "2-3 sentences on TDS/EC picture.",
    "trend": "2-3 sentences on direction of travel.",
    "whatThisMeansLongTerm": "3-4 sentences on where field is heading.",
    "note": "one line on confidence"
  }
}`;
}

// ── POST /api/soil/analyze ─────────────────────────────────────────────────
router.post('/analyze', async (req, res) => {
  try {
    const { farmerId, farmId } = req.body;
    if (!farmerId || !farmId) {
      return res.status(400).json({ success: false, message: 'farmerId and farmId are required.' });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, message: 'AI is not configured on the server (GEMINI_API_KEY missing).' });
    }

    const farm = (await readFarms()).find(f => f.id === farmId);
    if (!farm) return res.status(404).json({ success: false, message: 'Farm not found.' });
    if (farm.farmerId !== farmerId) {
      return res.status(403).json({ success: false, message: 'This farm is not yours.' });
    }

    const all = await readTests();
    const history = all
      .filter(t => t.farmId === farmId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));   // oldest first

    if (history.length === 0) {
      return res.status(400).json({ success: false, message: 'Save a soil test for this farm first.' });
    }

    const latest = history[history.length - 1];
    const trends = computeTrends(history);
    const weather = await getWeatherContext(farm.coords);
    const referenceData = await evaluateReferenceData(farm, latest.readings, history);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 16384,
        temperature: 0.6,
      },
    });
    const catalog = await loadCatalog();
    const result = await model.generateContent(buildPrompt({ farm, latest, history, trends, weather, catalog, referenceData }));

    const finishReason = result.response?.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      console.error('Soil AI stopped early. finishReason =', finishReason);
      return res.status(502).json({
        success: false,
        message: finishReason === 'MAX_TOKENS'
          ? 'The report was too long for one answer. Try again.'
          : `AI stopped early (${finishReason}). Please try again.`,
      });
    }

    let rawText = '';
    try {
      rawText = result.response.text();
    } catch (err) {
      console.error('Soil AI returned no readable text:', err.message);
      return res.status(502).json({ success: false, message: 'AI returned an empty answer. Please try again.' });
    }

    let analysis;
    try {
      analysis = JSON.parse(rawText.replace(/```json|```/g, '').trim());
    } catch {
      console.error('Soil AI returned malformed JSON. First 500 chars:', rawText.slice(0, 500));
      return res.status(502).json({ success: false, message: 'AI returned an unreadable answer. Please try again.' });
    }

    if (Array.isArray(analysis.corrections)) {
      analysis.corrections = analysis.corrections.map(c => ({
        ...c,
        products: (c.productIds || [])
          .map(id => catalog.find(p => p.id === id))
          .filter(Boolean)
          .map(p => ({
            id: p.id, name: p.name, category: p.category,
            price: p.price, unit: p.unit, whyThis: p.whyThis,
            isOrganic: p.isOrganic, inStock: p.inStock,
          })),
      }));
    }

    const stored = all.find(t => t.id === latest.id);
    if (stored) {
      stored.analysis = analysis;
      stored.referenceData = referenceData;
      stored.analysedAt = new Date().toISOString();
      await writeTests(all);
    }

    res.json({ 
      success: true, 
      analysis, 
      referenceData, 
      trends, 
      weather, 
      testCount: history.length, 
      analysedAt: new Date().toISOString() 
    });
  } catch (err) {
    console.error('Soil analysis failed:', err);
    res.status(500).json({
      success: false,
      message: `Could not analyse this soil test: ${err.message || 'unknown error'}`,
    });
  }
});

export default router;
