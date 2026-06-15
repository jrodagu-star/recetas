import express from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import {
  ensureDirs,
  loadRecetario,
  saveRecetario,
  saveWebLinks,
  registerImportedImage,
  importedDir,
} from "./storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json({ limit: "2mb" }));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, importedDir()),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Solo se permiten imágenes"));
  },
});

app.get("/api/recetario", async (_req, res) => {
  try {
    res.json(await loadRecetario());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo cargar el recetario" });
  }
});

app.put("/api/recetario", async (req, res) => {
  try {
    const { recipes, categories, webLinks, filterIngredients, filterIngredientsCustomized, imageChoices, importedImages } =
      req.body || {};
    if (!Array.isArray(recipes) || !Array.isArray(categories)) {
      return res.status(400).json({ error: "Datos inválidos" });
    }
    await saveRecetario({
      recipes,
      categories,
      webLinks,
      filterIngredients,
      filterIngredientsCustomized,
      imageChoices,
      importedImages,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo guardar" });
  }
});

app.put("/api/web-links", async (req, res) => {
  try {
    const { webLinks } = req.body || {};
    if (!Array.isArray(webLinks)) {
      return res.status(400).json({ error: "Enlaces inválidos" });
    }
    const saved = await saveWebLinks(webLinks);
    res.json({ ok: true, webLinks: saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudieron guardar los enlaces" });
  }
});

app.post("/api/images", (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Error al subir" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No se recibió ninguna imagen" });
    }
    try {
      const relPath = `imported/${req.file.filename}`;
      const id = `local:${path.parse(req.file.filename).name}`;
      const meta = await registerImportedImage(id, relPath, req.file.originalname);
      res.status(201).json({ id, file: meta.file, name: meta.name });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "No se pudo registrar la imagen" });
    }
  });
});

app.use("/images", express.static(path.join(ROOT, "images")));
app.use(express.static(ROOT));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

await ensureDirs();
app.listen(PORT, () => {
  console.log(`Recetario: http://localhost:${PORT}`);
});
