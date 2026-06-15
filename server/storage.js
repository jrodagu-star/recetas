import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BASE_FILE = path.join(ROOT, "data", "recipes.json");
const STATE_FILE = path.join(ROOT, "data", "state.json");
const IMPORTED_DIR = path.join(ROOT, "images", "imported");

async function readJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export async function ensureDirs() {
  await fs.mkdir(IMPORTED_DIR, { recursive: true });
}

export async function loadRecetario() {
  const base = await readJson(BASE_FILE, {
    title: "Recetas caseras",
    tagLabels: {},
    gallery: [],
    categories: [],
    recipes: [],
  });
  const state = await readJson(STATE_FILE, null);

  const data = {
    title: base.title,
    source: base.source,
    tagLabels: base.tagLabels || {},
    gallery: base.gallery || [],
    categories: state?.categories?.length ? state.categories : base.categories || [],
    recipes: state?.recipes?.length ? state.recipes : base.recipes || [],
    imageChoices: state?.imageChoices || {},
    importedImages: state?.importedImages || {},
  };

  syncCategories(data);
  return data;
}

export async function saveRecetario(payload) {
  const current = await readJson(STATE_FILE, {
    recipes: [],
    categories: [],
    imageChoices: {},
    importedImages: {},
  });

  const next = {
    recipes: payload.recipes ?? current.recipes,
    categories: payload.categories ?? current.categories,
    imageChoices: payload.imageChoices ?? current.imageChoices,
    importedImages: payload.importedImages ?? current.importedImages,
  };

  await writeJson(STATE_FILE, next);
  return next;
}

export async function registerImportedImage(id, relPath, name) {
  const state = await readJson(STATE_FILE, {
    recipes: [],
    categories: [],
    imageChoices: {},
    importedImages: {},
  });
  state.importedImages = state.importedImages || {};
  state.importedImages[id] = { file: relPath, name };
  await writeJson(STATE_FILE, state);
  return state.importedImages[id];
}

export function importedDir() {
  return IMPORTED_DIR;
}

function syncCategories(data) {
  const set = new Set(data.categories || []);
  (data.recipes || []).forEach((r) => {
    if (r.category) set.add(r.category);
  });
  data.categories = [...set].sort((a, b) => a.localeCompare(b, "es"));
}
