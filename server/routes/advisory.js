import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Helper to load all catalog items including CSV pest dataset
const loadFullCatalog = () => {
  let products = [];
  try {
    const catalogPath = path.join(process.cwd(), 'data', 'productCatalog.json');
    products = JSON.parse(fs.readFileSync(catalogPath, 'utf8')).products || [];
  } catch (err) {
    console.error("❌ Failed to load product catalog:", err.message);
  }

  // Also parse Pesticides.csv
  try {
    const csvPath1 = path.join(process.cwd(), 'data', 'pesticides.csv');
    const csvPath2 = path.join(process.cwd(), 'data', 'Pesticides.csv');
    const targetPath = fs.existsSync(csvPath1) ? csvPath1 : fs.existsSync(csvPath2) ? csvPath2 : null;
    
    if (targetPath) {
      const csvLines = fs.readFileSync(targetPath, 'utf-8').split(/\r?\n/);
      let idx = 100;
      csvLines.slice(1).forEach(line => {
        if (!line.trim()) return;
        let pest = '';
        let chems = '';
        if (line.includes('"')) {
          const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          pest = parts[0]?.replace(/^"|"$/g, '').trim();
          chems = parts[1]?.replace(/^"|"$/g, '').trim();
        } else {
          const parts = line.split(',');
          pest = parts[0]?.trim();
          chems = parts.slice(1).join(',').trim();
        }
        if (pest && chems) {
          products.push({
            id: `CSV-${idx++}`,
            name: `${chems.split(',')[0].trim()} Formulation`,
            category: 'insecticide',
            activeIngredient: chems,
            price: 350,
            dosage: '1.5 - 2.5ml per litre of water',
            whyThis: `Specifically effective against ${pest} (${chems})`
          });
        }
      });
    }
  } catch (err) {
    console.error("❌ Failed to load pesticides.csv:", err.message);
  }

  return products;
};

router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { query, language } = req.body;
    const image = req.file;

    // Check for Gemini API key
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing from environment variables.");
    }

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    console.log("📝 Incoming Query:", query || "(no text)", "| Target Language:", language || "English");
    if (image) console.log("📷 Incoming Image:", image.path);

    const fullCatalog = loadFullCatalog();
    const catalogSnippet = fullCatalog.slice(0, 50).map(p => `- ${p.name} (ID: ${p.id}): ${p.whyThis}`).join('\n');

    const targetLang = language && language !== 'English' && language !== 'en-IN' ? language : 'English';

    const prompt = `You are an expert agronomist and pest control consultant. Diagnose the crop issue or pest based on the text description and/or image provided.
Suggest products ONLY from the following catalog:
${catalogSnippet}

CRITICAL DUAL-LANGUAGE INSTRUCTION:
${targetLang !== 'English' ? `1. Provide "issue" and "summary" in ${targetLang} language (using native script for ${targetLang}).
2. Provide "issueEnglish" and "summaryEnglish" in clear English.` : `Provide "issue" and "issueEnglish" in English, and "summary" and "summaryEnglish" in English.`}

Return your response in STRICT JSON format with these exact keys:
{
  "issue": "short disease name in ${targetLang}",
  "issueEnglish": "short disease name in English",
  "summary": "detailed diagnosis and remedy in ${targetLang}",
  "summaryEnglish": "detailed diagnosis and remedy in English",
  "severity": "low" | "medium" | "high",
  "urgency": "immediate" | "observe closely",
  "recommendedProductIds": ["matching ID from catalog"]
}`;

    const parts = [{ text: prompt }];
    
    // Add text query if present
    if (query) {
      parts.push({ text: `Farmer's Query: ${query}` });
    }

    // Process image if uploaded
    if (image) {
      const imageBuffer = fs.readFileSync(image.path);
      parts.push({
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: "image/jpeg"
        }
      });
    }

    // Call Gemini
    const result = await model.generateContent(parts);
    const textResponse = result.response.text();
    
    let aiResponse;
    try {
      const cleanedJson = textResponse.replace(/```json|```/g, '').trim();
      aiResponse = JSON.parse(cleanedJson);
    } catch (e) {
      console.error("❌ Failed to parse Gemini JSON:", textResponse);
      throw new Error("AI returned malformed data. Please try again.");
    }

    // Clean up temporary local file safely
    if (image && fs.existsSync(image.path)) {
      fs.unlinkSync(image.path);
    }

    // Map product IDs to full product objects for the frontend
    const recommendedProducts = (aiResponse.recommendedProductIds || [])
      .map(id => fullCatalog.find(p => p.id === id))
      .filter(Boolean);

    // Return real AI data
    res.json({
      success: true,
      data: {
        diagnosis: {
          issue: aiResponse.issue || 'Analyzing...',
          issueEnglish: aiResponse.issueEnglish || aiResponse.issue || 'Analyzing...',
          severity: aiResponse.severity || 'medium',
          urgency: aiResponse.urgency || 'observe closely',
          confidence: 95,
          summary: aiResponse.summary,
          summaryEnglish: aiResponse.summaryEnglish || aiResponse.summary,
          languageName: targetLang
        },
        products: { recommendations: recommendedProducts },
        safetyPlan: { steps: [] },
        shouldEscalate: aiResponse.severity === 'high'
      }
    });

  } catch (error) {
    console.error("❌ Gemini AI Error:", error.message);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    const msg = error.message || '';
    let friendlyMessage;
    if (msg.includes('429')) {
      friendlyMessage = '⏳ API quota exhausted for today. The free tier limit has been reached. Please try again after midnight (IST) or enable billing at console.cloud.google.com.';
    } else if (msg.includes('403')) {
      friendlyMessage = '🔒 API key does not have access to this model. Please check your Google AI Studio project permissions.';
    } else {
      friendlyMessage = 'Error: ' + msg;
    }

    res.json({
      success: true,
      data: {
        diagnosis: {
          issue: 'AI System Notice',
          severity: 'medium',
          urgency: 'observe closely',
          confidence: 0,
          summary: friendlyMessage
        }
      }
    });
  }
});

export default router;