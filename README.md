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
| POST | `/api/images` | Sube una imagen (`multipart`, campo `image`) |

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
