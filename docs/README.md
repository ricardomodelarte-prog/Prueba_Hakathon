# Mapa Seguro Marte AR (demo de práctica)
Web móvil de AR: el rover Perseverance conduce por la ruta más segura de A a B sobre un mapa de riesgo
(verde / ámbar / rojo según la pendiente). A-Frame 1.5.0 + MindAR 1.2.5 en `vendor/`; sin build.

## Páginas
- `index.html` portada · `ar.html` AR con cámara (si falla, pasa solo al visor) · `viewer.html` visor 3D
  sin cámara (arrastra para girar, pellizca para zoom, botón "Mostrar tarjeta").
- Código compartido en `js/`; `js/config.js` guarda los números y TODOS los textos.

## Probar en local
Desde la raíz del repo: `python servir.py` y abre http://localhost:8000/ (`localhost` cuenta como seguro; el servidor desactiva la caché).

## En el móvil (la cámara exige HTTPS)
- GitHub Pages: Settings → Pages → Branch → carpeta `/docs`, y abre la URL `https://...`.
- O un túnel HTTPS, p. ej. `cloudflared tunnel --url http://localhost:8000`.
- No uses el navegador interno de WhatsApp/Instagram: abre el enlace en Safari o Chrome.

## La tarjeta
Imprime `assets/target/card.png` o ábrela en otra pantalla ("Mostrar tarjeta" en el visor) y apunta
la cámara desde `ar.html`. El mapa aparece tumbado sobre la tarjeta.

## Parámetros de la URL
`?lite=1` rover ligero (`rover-lite.glb`) · `?debug=1` muestra FPS · `?fallback=...` lo pone `ar.html`.

## Qué es provisional
- Terreno procedural inventado en `getHeightmap()` (`js/terrain.js`). TODO: leer `terrain.bin` + `meta.json`.
- Tarjeta de ejemplo de MindAR. Otra imagen: compílala en el compilador de MindAR y cambia
  `card.mind`, `card.png` y `TARJETA_ASPECTO` en `js/config.js`.
- Rover x18 y relieve x2 (botón "Escala real" para el rover a x1).
