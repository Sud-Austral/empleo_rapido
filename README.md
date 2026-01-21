# Empleo Rápido Dashboard

Este proyecto visualiza datos de empleo cargados desde `data.json`.

## Requisitos
- Node.js instalado (opcional, para usar npx)
- O una extensión de servidor local como "Live Server" en VS Code.

## Cómo ejecutar

Debido a que los navegadores bloquean la carga de archivos locales via `fetch` (CORS), necesitas un servidor local.

### Opción 1: Usando npx (Recomendado)
Ejecuta el siguiente comando en la terminal en esta carpeta:
```bash
npx http-server .
```
Luego abre el link que aparece (ej. `http://127.0.0.1:8080`).

### Opción 2: VS Code Live Server
1. Abre el archivo `index.html`.
2. Haz click derecho y selecciona "Open with Live Server".

## Estructura
- `index.html`: Estructura de la página.
- `style.css`: Estilos visuales (diseño moderno y responsive).
- `script.js`: Lógica de carga de datos, filtros y tabla.
