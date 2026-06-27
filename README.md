# Recetario — Recetas caseras

Recetario HTML con backend Node.js para guardar recetas, categorías e imágenes en disco.

## Uso

```bash
npm install
npm run dev
```

Abre **http://localhost:3000**

Si abres `index.html` directamente (sin servidor), la app funciona en modo local con `localStorage` como respaldo.

## Backend

Servidor Express en `server/`:

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/recetario` | Carga recetas, categorías, fotos elegidas e imágenes importadas |
| PUT | `/api/recetario` | Guarda el estado completo |
| PUT | `/api/web-links` | Guarda enlaces web del lateral |
| POST | `/api/images` | Sube una imagen (`multipart`, campo `image`) |
| GET | `/health` | Comprobación de estado (despliegue) |

### Datos en disco

| Archivo / carpeta | Descripción |
|-------------------|-------------|
| `data/recipes.json` | Datos base del documento Word |
| `data/state.json` | Cambios guardados (recetas, categorías, preferencias) |
| `images/` | Fotos del recetario original |
| `images/imported/` | Imágenes subidas desde el formulario |

Regenerar desde el Word:

```bash
python3 scripts/build_recipes.py
```

## Funciones

- **Tipo de receta**: filtro por categoría (Platos principales, Cremas, Caldos, etc.).
- **Características**: etiquetas como saludable, al horno, pescado, rápida, vegetariana…
- **Búsqueda** por nombre o ingredientes.
- **Fotos**: elige de la galería o importa las tuyas desde el formulario.
- **Gestionar recetas**: crear, editar y eliminar recetas.
- **Categorías**: crear, renombrar o eliminar tipos desde el formulario.

## Consultar en internet (GitHub Pages)

La versión pública es **solo lectura**: carga `data/recipes.json` + `data/state.json` del repositorio. No se pueden editar recetas desde la web de GitHub.

**URL:** https://jrodagu-star.github.io/recetas/

### Publicar cambios

1. Edita en el Mac con Cursor y `npm run dev` (http://localhost:3000).
2. Los cambios se guardan en `data/state.json` e `images/imported/`.
3. Sube al repositorio:
   ```bash
   git add data/state.json images/imported/ index.html
   git commit -m "Actualizar recetas"
   git push
   ```
4. GitHub Actions publica automáticamente la web (workflow `deploy-pages.yml`).

### Activar GitHub Pages (solo la primera vez)

1. Repo → **Settings** → **Pages**.
2. **Build and deployment** → Source: **GitHub Actions**.
3. Tras el primer `git push` a `main`, la URL quedará activa en unos minutos.

## Edición en local (servidor Node.js)

```bash
npm install
npm run dev
```

Abre **http://localhost:3000** — aquí sí puedes crear, editar y eliminar recetas.

## Despliegue con servidor (opcional)

Si prefieres editar también desde la web pública (sin pasar por git), el repositorio incluye configuración para **Render** y **Fly.io** con disco persistente. Ver `render.yaml` y `fly.toml`.
