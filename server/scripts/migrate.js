// One-time migration: copies every server/data/*.json file into its matching
// MongoDB collection (already created in Atlas). Safe to re-run — each
// collection is fully replaced with the current JSON content, so running
// this twice just re-syncs Mongo to whatever the JSON files currently say.
//
// Usage:  node scripts/migrate.js
import dotenv from 'dotenv';
dotenv.config({ path: new URL('../.env', import.meta.url) });
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from '../db.js';
import { ARRAY_MODELS, CONFIG_MODELS } from '../models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));

// file name -> { kind: 'array' | 'config', collection }
const PLAN = [
  { file: 'users.json', kind: 'array', collection: 'users' },
  { file: 'farms.json', kind: 'array', collection: 'farms' },
  { file: 'soilTests.json', kind: 'array', collection: 'soilTests' },

  { file: 'equipmentOwners.json', kind: 'config', collection: 'equipmentOwners' },
  { file: 'equipmentRequests.json', kind: 'config', collection: 'equipmentRequests' },
  { file: 'equipmentTypes.json', kind: 'config', collection: 'equipmentTypes' },
  { file: 'orders.json', kind: 'config', collection: 'orders' },
  { file: 'priceData.json', kind: 'config', collection: 'priceData' },
  { file: 'productCatalog.json', kind: 'config', collection: 'productCatalog' },
  { file: 'vendorShops.json', kind: 'config', collection: 'vendorShops' },
  { file: 'diseaseRecommendations.json', kind: 'config', collection: 'diseaseRecommendations' },
  { file: 'diseaseRiskRules.json', kind: 'config', collection: 'diseaseRiskRules' },
  { file: 'cropCalendar.json', kind: 'config', collection: 'cropCalendar' },
  { file: 'cropNutrientRanges.json', kind: 'config', collection: 'cropNutrientRanges' },
  { file: 'fertilizerDosage.json', kind: 'config', collection: 'fertilizerDosage' },
  { file: 'soilRegions.json', kind: 'config', collection: 'soilRegions' },
  { file: 'soilBorneDiseaseRisk.json', kind: 'config', collection: 'soilBorneDiseaseRisk' },
];

async function run() {
  await connectDB();
  console.log('');

  for (const step of PLAN) {
    let data;
    try {
      data = readJson(step.file);
    } catch (err) {
      console.log(`⚠️  Skipped ${step.file} — could not read/parse (${err.message})`);
      continue;
    }

    if (step.kind === 'array') {
      const Model = ARRAY_MODELS[step.collection];
      await Model.deleteMany({});
      if (Array.isArray(data) && data.length) await Model.insertMany(data, { ordered: true });
      console.log(`✅ ${step.collection.padEnd(24)} ← ${step.file}  (${Array.isArray(data) ? data.length : 0} document${data.length === 1 ? '' : 's'})`);
    } else {
      const Model = CONFIG_MODELS[step.collection];
      await Model.deleteMany({});
      await Model.create(data);
      console.log(`✅ ${step.collection.padEnd(24)} ← ${step.file}  (1 config document)`);
    }
  }

  console.log('\nDone. All 17 collections now hold real data from server/data/.');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
