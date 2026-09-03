import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { ARRAY_MODELS, CONFIG_MODELS } from '../models/index.js';

const isMongoConnected = () => mongoose.connection && mongoose.connection.readyState === 1;

const getJsonPath = (name) => path.join(process.cwd(), 'data', `${name}.json`);

const readLocalJson = (name, fallback) => {
  try {
    const filePath = getJsonPath(name);
    if (!fs.existsSync(filePath)) return fallback;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data;
  } catch (e) {
    return fallback;
  }
};

const writeLocalJson = (name, data) => {
  try {
    const filePath = getJsonPath(name);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`Failed to write local JSON ${name}:`, e.message);
  }
};

export async function readCollection(name, fallback) {
  if (isMongoConnected()) {
    const Model = ARRAY_MODELS[name];
    if (Model) {
      try {
        const docs = await Model.find({}).maxTimeMS(3000).lean();
        if (docs && docs.length) return docs;
      } catch (err) {
        console.error(`Mongo read failed for "${name}":`, err.message);
      }
    }
  }
  return readLocalJson(name, fallback);
}

export async function writeCollection(name, array) {
  writeLocalJson(name, array);
  if (isMongoConnected()) {
    const Model = ARRAY_MODELS[name];
    if (Model) {
      try {
        await Model.deleteMany({});
        if (array.length) await Model.insertMany(array, { ordered: true });
      } catch (err) {
        console.error(`Mongo write failed for "${name}":`, err.message);
      }
    }
  }
}

export async function readConfig(name, fallback) {
  if (isMongoConnected()) {
    const Model = CONFIG_MODELS[name];
    if (Model) {
      try {
        const doc = await Model.findOne({}).maxTimeMS(3000).lean();
        if (doc) {
          delete doc._id;
          return doc;
        }
      } catch (err) {
        console.error(`Mongo read failed for "${name}":`, err.message);
      }
    }
  }
  return readLocalJson(name, fallback);
}

export async function writeConfig(name, obj) {
  writeLocalJson(name, obj);
  if (isMongoConnected()) {
    const Model = CONFIG_MODELS[name];
    if (Model) {
      try {
        await Model.deleteMany({});
        await Model.create(obj);
      } catch (err) {
        console.error(`Mongo write failed for "${name}":`, err.message);
      }
    }
  }
}

export async function appendToCollection(name, item) {
  const list = readLocalJson(name, []);
  list.unshift(item);
  writeLocalJson(name, list);

  if (isMongoConnected()) {
    const Model = ARRAY_MODELS[name];
    if (Model) {
      try {
        const doc = await Model.create(item);
        return doc.toObject();
      } catch (err) {
        console.error(`Mongo append failed for "${name}":`, err.message);
      }
    }
  }
  return item;
}

export async function queryCollection(name, filter = {}) {
  if (isMongoConnected()) {
    const Model = ARRAY_MODELS[name];
    if (Model) {
      try {
        return await Model.find(filter).sort({ createdAt: -1 }).maxTimeMS(3000).lean();
      } catch (err) {
        console.error(`Mongo query failed for "${name}":`, err.message);
      }
    }
  }
  const list = readLocalJson(name, []);
  return list.filter(item => {
    for (const k in filter) {
      if (item[k] !== filter[k]) return false;
    }
    return true;
  });
}

export async function deleteFromCollection(name, filter) {
  const list = readLocalJson(name, []);
  const updated = list.filter(item => {
    for (const k in filter) {
      if (item[k] === filter[k]) return false;
    }
    return true;
  });
  writeLocalJson(name, updated);

  if (isMongoConnected()) {
    const Model = ARRAY_MODELS[name];
    if (Model) {
      try {
        await Model.deleteOne(filter);
      } catch (err) {
        console.error(`Mongo delete failed for "${name}":`, err.message);
      }
    }
  }
}
