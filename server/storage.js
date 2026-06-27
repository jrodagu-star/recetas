import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PERSISTENT_DIR = process.env.RECETARIO_DATA_DIR
  ? path.resolve(process.env.RECETARIO_DATA_DIR)
  : null;

const BASE_FILE = path.join(ROOT, "data", "recipes.json");
const STATE_FILE = PERSISTENT_DIR
  ? path.join(PERSISTENT_DIR, "state.json")
  : path.join(ROOT, "data", "state.json");
const IMPORTED_DIR = PERSISTENT_DIR
  ? path.join(PERSISTENT_DIR, "imported")
  : path.join(ROOT, "images", "imported");

const BUNDLED_STATE = path.join(ROOT, "data", "state.json");
const BUNDLED_IMPORTED = path.join(ROOT, "images", "imported");

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

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function copyDirIfMissing(srcDir, destDir) {
  if (!(await fileExists(srcDir))) return;
  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(srcDir, entry.name);
    const to = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirIfMissing(from, to);
      continue;
    }
    if (!(await fileExists(to))) {
      await fs.copyFile(from, to);
    }
  }
}

async function seedPersistentData() {
  if (!PERSISTENT_DIR) return;
  await fs.mkdir(PERSISTENT_DIR, { recursive: true });
  if (!(await fileExists(STATE_FILE)) && (await fileExists(BUNDLED_STATE))) {
    await fs.copyFile(BUNDLED_STATE, STATE_FILE);
  }
  await copyDirIfMissing(BUNDLED_IMPORTED, IMPORTED_DIR);
}

export async function ensureDirs() {
  await fs.mkdir(IMPORTED_DIR, { recursive: true });
  await seedPersistentData();
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
    seasonLabels: base.seasonLabels || {},
    gallery: base.gallery || [],
    categories: state?.categories?.length ? state.categories : base.categories || [],
    recipes: state?.recipes?.length ? state.recipes : base.recipes || [],
    webLinks: state?.webLinks != null ? state.webLinks : base.webLinks || [],
    filterIngredients: state?.filterIngredients != null ? state.filterIngredients : base.filterIngredients || [],
    filterIngredientsCustomized: Boolean(state?.filterIngredientsCustomized),
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
    webLinks: [],
    filterIngredients: [],
    filterIngredientsCustomized: false,
    imageChoices: {},
    importedImages: {},
  });

  const next = {
    recipes: payload.recipes ?? current.recipes,
    categories: payload.categories ?? current.categories,
    webLinks: payload.webLinks ?? current.webLinks ?? [],
    filterIngredients: payload.filterIngredients ?? current.filterIngredients ?? [],
    filterIngredientsCustomized:
      payload.filterIngredientsCustomized ?? current.filterIngredientsCustomized ?? false,
    imageChoices: payload.imageChoices ?? current.imageChoices,
    importedImages: payload.importedImages ?? current.importedImages,
  };

  await writeJson(STATE_FILE, next);
  return next;
}

export async function saveWebLinks(webLinks) {
  const current = await readJson(STATE_FILE, {
    recipes: [],
    categories: [],
    webLinks: [],
    filterIngredients: [],
    filterIngredientsCustomized: false,
    imageChoices: {},
    importedImages: {},
  });
  current.webLinks = Array.isArray(webLinks) ? webLinks : [];
  await writeJson(STATE_FILE, current);
  return current.webLinks;
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
