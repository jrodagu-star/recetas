#!/usr/bin/env python3
"""Extrae recetas del docx y genera data/recipes.json + index.html."""

from __future__ import annotations

import json
import os
import re
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCX = Path(os.environ.get("RECETAS_DOCX", ROOT / "Recetas caseras.docx"))
EXTRACT = ROOT / "_docx_extract"
MEDIA = EXTRACT / "word" / "media"
IMAGES_OUT = ROOT / "images"
DATA_OUT = ROOT / "data" / "recipes.json"
HTML_OUT = ROOT / "index.html"

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

TAG_LABELS = {
    "plato-principal": "Plato principal",
    "crema": "Crema / sopa",
    "caldo": "Caldo",
    "postre": "Postre / bizcocho",
    "picoteo": "Picoteo / entrante",
    "consejo": "Consejo",
    "bebida": "Bebida / batido",
    "saludable": "Saludable",
    "rapido": "Rápida / fácil",
    "horno": "Al horno",
    "vegetariano": "Vegetariana",
    "pescado": "Pescado",
    "pollo": "Pollo / ave",
    "huevo": "Con huevo",
    "sin-lactosa": "Sin lactosa",
}

CATEGORY_TAGS = {
    "PLATOS PRINCIPALES": "plato-principal",
    "CREMAS": "crema",
    "CALDOS": "caldo",
    "BIZCOCHOS": "postre",
    "PICOTEOS": "picoteo",
    "CONSEJOS": "consejo",
    "BEBIDAS": "bebida",
}

KEYWORD_TAGS = [
    ("saludable", [r"\bsaludable\b", r"\blight\b"]),
    ("rapido", [r"\br[aá]pid", r"\bf[aá]cil\b", r"\bshorts\b"]),
    ("horno", [r"\bhorno\b", r"\bhornear\b"]),
    ("vegetariano", [r"\bberenjena\b", r"\bhummus\b", r"\bguisantes\b", r"\bcalabac[ií]n\b", r"\bzanahoria\b", r"\bverduras\b"]),
    ("pescado", [r"\bmerluza\b", r"\bsalm[oó]n\b", r"\bpescado\b"]),
    ("pollo", [r"\bpollo\b", r"\bpechuga\b"]),
    ("huevo", [r"\bhuevos?\b", r"\btortilla\b"]),
    ("sin-lactosa", [r"\bsin leche\b", r"\bsin lact\b"]),
    ("bebida", [r"\bbatido\b", r"\bcointreau\b", r"\bt[oó]nic\b"]),
    ("postre", [r"\bbizcocho\b", r"\bmagdalena\b", r"\bchoco\b"]),
]


def ensure_extracted() -> None:
    if not EXTRACT.exists() or not (EXTRACT / "word" / "document.xml").exists():
        import zipfile

        EXTRACT.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(DOCX, "r") as zf:
            zf.extractall(EXTRACT)


def load_paragraphs() -> list[dict]:
    rels_path = EXTRACT / "word" / "_rels" / "document.xml.rels"
    doc_path = EXTRACT / "word" / "document.xml"
    rels = {rel.get("Id"): rel.get("Target") for rel in ET.parse(rels_path).getroot()}

    def get_text(elem):
        parts = []
        for t in elem.iter(W + "t"):
            parts.append(t.text or "")
            if t.tail:
                parts.append(t.tail)
        return "".join(parts).strip()

    def get_style(p):
        p_pr = p.find("w:pPr", NS)
        if p_pr is not None:
            p_style = p_pr.find("w:pStyle", NS)
            if p_style is not None:
                return p_style.get(W + "val")
        return None

    def get_images(p):
        images = []
        for blip in p.iter("{http://schemas.openxmlformats.org/drawingml/2006/main}blip"):
            embed = blip.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed")
            if embed and embed in rels:
                images.append(rels[embed].replace("media/", ""))
        return images

    paragraphs = []
    for p in ET.parse(doc_path).getroot().find("w:body", NS).findall("w:p", NS):
        text = get_text(p)
        images = get_images(p)
        if text or images:
            paragraphs.append({"text": text, "style": get_style(p), "images": images})
    return paragraphs


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace("\xa0", " ").strip())


def format_ingredient(line: str) -> str:
    line = norm(line)
    line = re.sub(
        r"([a-záéíóúñ])(\d)",
        r"\1 \2",
        line,
        flags=re.I,
    )
    line = re.sub(r"(\d)\s*([gG]|ml|kg|Kg)\b", r"\1 \2", line)
    return line.rstrip(",")


def slugify(name: str) -> str:
    s = name.lower()
    for a, b in zip("áéíóúñ", "aeioun"):
        s = s.replace(a, b)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def is_section_header(text: str) -> bool:
    t = norm(text).upper().rstrip(":")
    return t in ("INGREDIENTES", "PREPARACION", "PREPARACIÓN", "RECETA")


def is_web_line(text: str) -> bool:
    t = text.strip().lower()
    return t.startswith("web") or "http" in t or "youtube" in t or "youtu.be" in t


def infer_tags(name: str, category: str, ingredients: list[str], preparation: list[str], web: str | None) -> list[str]:
    blob = " ".join([name, category, *ingredients, *preparation, web or ""]).lower()
    tags = {CATEGORY_TAGS.get(category, "otro")}
    for tag, patterns in KEYWORD_TAGS:
        if any(re.search(p, blob) for p in patterns):
            tags.add(tag)
    if "pescado" in tags and "vegetariano" in tags:
        tags.discard("vegetariano")
    if category == "BEBIDAS":
        tags.add("bebida")
    return sorted(tags)


def parse_recipes(paragraphs: list[dict]) -> list[dict]:
    recipes: list[dict] = []
    current_category: str | None = None
    current: dict | None = None
    section: str | None = None

    def flush():
        nonlocal current
        if not current or not current.get("name"):
            return
        if not current["ingredients"] and current.get("_pre_ing"):
            current["ingredients"] = current.pop("_pre_ing")
        current.pop("_pre_ing", None)
        current["ingredients"] = [format_ingredient(x) for x in current["ingredients"]]
        current["preparation"] = [norm(x) for x in current["preparation"]]
        current["tags"] = infer_tags(
            current["name"],
            current["category"],
            current["ingredients"],
            current["preparation"],
            current.get("web"),
        )
        current["id"] = slugify(current["name"])
        current["hasPreparation"] = len(current["preparation"]) > 0
        current["hasImage"] = len(current["images"]) > 0
        recipes.append(current)
        current = None

    for para in paragraphs:
        text, style, images = para["text"], para["style"], para["images"]

        if style == "Ttulo1":
            flush()
            current_category = norm(text)
            section = None
            continue

        if style == "Ttulo2":
            flush()
            current = {
                "name": norm(text),
                "category": current_category or "Sin categoría",
                "ingredients": [],
                "preparation": [],
                "images": [],
                "web": None,
            }
            section = None
            continue

        if not current:
            continue

        for img in images:
            if img not in current["images"]:
                current["images"].append(img)

        if not text:
            continue

        if is_web_line(text):
            current["web"] = norm(text)
            continue

        if is_section_header(text):
            header = norm(text).upper().rstrip(":")
            section = "ingredients" if header == "INGREDIENTES" else "preparation"
            continue

        if section is None:
            upper = norm(text).upper()
            if upper.startswith("INGREDIENTES"):
                section = "ingredients"
                if ":" in text and text.split(":", 1)[1].strip():
                    current["ingredients"].append(text.split(":", 1)[1])
                continue
            if upper.startswith("PREPARACION") or upper.startswith("PREPARACIÓN"):
                section = "preparation"
                if ":" in text and text.split(":", 1)[1].strip():
                    current["preparation"].append(text.split(":", 1)[1])
                continue
            if re.match(r"^\d+[\.\)\-]", text.strip()):
                current["preparation"].append(text)
                section = "preparation"
                continue
            if re.match(r"^ingredientes\s*:?", text, re.I):
                section = "ingredients"
                continue

        line = norm(text)
        if line.upper() in ("ALUBIAS CON VERDURAS", "GUISANTES CONGELADOS"):
            continue

        if section == "ingredients":
            current["ingredients"].append(line)
        elif section == "preparation":
            current["preparation"].append(line)
        elif re.match(r"^\d+[\.\)\-]", line):
            current["preparation"].append(line)
            section = "preparation"
        elif not current["ingredients"] and not current.get("_pre_ing"):
            current.setdefault("_pre_ing", []).append(line)
        else:
            current["preparation"].append(line)

    flush()
    return recipes


def copy_images() -> list[str]:
    IMAGES_OUT.mkdir(parents=True, exist_ok=True)
    names = []
    if MEDIA.exists():
        for img in sorted(MEDIA.iterdir()):
            if img.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
                shutil.copy2(img, IMAGES_OUT / img.name)
                names.append(img.name)
    return names


def embed_data_in_html(data: dict) -> None:
    html_path = ROOT / "index.html"
    html = html_path.read_text(encoding="utf-8")
    payload = json.dumps(data, ensure_ascii=False)
    marker = '<script id="recipes-data" type="application/json">'
    end = "</script>"
    start = html.find(marker)
    if start == -1:
        return
    content_start = start + len(marker)
    content_end = html.find(end, content_start)
    html_path.write_text(html[:content_start] + payload + html[content_end:], encoding="utf-8")


def main() -> None:
    ensure_extracted()
    paragraphs = load_paragraphs()
    recipes = parse_recipes(paragraphs)
    gallery = copy_images()
    data = {
        "title": "Recetas caseras",
        "source": str(DOCX),
        "tagLabels": TAG_LABELS,
        "gallery": gallery,
        "categories": sorted({r["category"] for r in recipes}),
        "recipes": recipes,
    }
    DATA_OUT.parent.mkdir(parents=True, exist_ok=True)
    DATA_OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    embed_data_in_html(data)
    print(f"✓ {len(recipes)} recetas → {DATA_OUT}")
    print(f"✓ {len(gallery)} imágenes → {IMAGES_OUT}")
    print(f"✓ Datos embebidos en index.html")


if __name__ == "__main__":
    main()
