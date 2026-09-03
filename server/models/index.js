import mongoose from '../db.js';

const { Schema } = mongoose;

/* ══════════════════════════════════════════════════════════════════════════
   Every model here uses { strict: false } — the JSON files this app has run
   on so far are loosely-shaped (nested objects, AI-generated blobs like
   soilTest.analysis, occasional extra fields), and the goal of this
   migration is to move that data into MongoDB *as-is*, not to redesign it.
   A strict schema would silently drop fields Mongoose doesn't know about,
   which is exactly the kind of data loss this migration must not cause.
   Tightening these schemas later, once the shapes are settled, is a
   reasonable follow-up — not part of "get this data into Mongo safely".
   ══════════════════════════════════════════════════════════════════════════ */

const looseOpts = { strict: false, timestamps: false, versionKey: false };

// ── Per-record collections (one Mongo document per array element) ─────────
const userSchema = new Schema({ id: String }, looseOpts);
const farmSchema = new Schema({ id: String }, looseOpts);
const soilTestSchema = new Schema({ id: String }, looseOpts);
const diagnosisHistorySchema = new Schema({ id: String }, looseOpts);

export const User = mongoose.models.User || mongoose.model('User', userSchema, 'users');
export const Farm = mongoose.models.Farm || mongoose.model('Farm', farmSchema, 'farms');
export const SoilTest = mongoose.models.SoilTest || mongoose.model('SoilTest', soilTestSchema, 'soilTests');
export const DiagnosisHistory = mongoose.models.DiagnosisHistory || mongoose.model('DiagnosisHistory', diagnosisHistorySchema, 'diagnosisHistory');

// ── Singleton / config collections (the whole JSON file becomes ONE
//    document, so nothing about its original shape — nested objects, extra
//    top-level fields like vendorShops' "nextShopNum" — gets lost). ───────
const configSchema = new Schema({}, looseOpts);

function configModel(name, collection) {
  return mongoose.models[name] || mongoose.model(name, configSchema, collection);
}

export const EquipmentOwners = configModel('EquipmentOwners', 'equipmentOwners');
export const EquipmentRequests = configModel('EquipmentRequests', 'equipmentRequests');
export const EquipmentTypes = configModel('EquipmentTypes', 'equipmentTypes');
export const Orders = configModel('Orders', 'orders');
export const PriceData = configModel('PriceData', 'priceData');
export const ProductCatalog = configModel('ProductCatalog', 'productCatalog');
export const VendorShops = configModel('VendorShops', 'vendorShops');
export const DiseaseRecommendations = configModel('DiseaseRecommendations', 'diseaseRecommendations');
export const DiseaseRiskRules = configModel('DiseaseRiskRules', 'diseaseRiskRules');
export const CropCalendar = configModel('CropCalendar', 'cropCalendar');
export const CropNutrientRanges = configModel('CropNutrientRanges', 'cropNutrientRanges');
export const FertilizerDosage = configModel('FertilizerDosage', 'fertilizerDosage');
export const SoilRegions = configModel('SoilRegions', 'soilRegions');
export const SoilBorneDiseaseRisk = configModel('SoilBorneDiseaseRisk', 'soilBorneDiseaseRisk');

// A name -> model registry, used by the migration script and by the
// generic readCollection/writeCollection helpers in utils/mongoStore.js so
// each route only has to say which collection it wants, not redeclare a
// model import every time.
export const ARRAY_MODELS = { users: User, farms: Farm, soilTests: SoilTest, diagnosisHistory: DiagnosisHistory };

export const CONFIG_MODELS = {
  equipmentOwners: EquipmentOwners,
  equipmentRequests: EquipmentRequests,
  equipmentTypes: EquipmentTypes,
  orders: Orders,
  priceData: PriceData,
  productCatalog: ProductCatalog,
  vendorShops: VendorShops,
  diseaseRecommendations: DiseaseRecommendations,
  diseaseRiskRules: DiseaseRiskRules,
  cropCalendar: CropCalendar,
  cropNutrientRanges: CropNutrientRanges,
  fertilizerDosage: FertilizerDosage,
  soilRegions: SoilRegions,
  soilBorneDiseaseRisk: SoilBorneDiseaseRisk,
};
