# Spec: Mapa Seguro de Marte en Realidad Aumentada

> NASA Space Apps Challenge 2026 · Generada con `/interview-me` el 2026-10-18 · Estado: aprobada para prototipo
> Repo de prácticas: `Prueba_Hakathon` (ver D14)

## 1. Resumen

Web app móvil (sin instalar, se abre por enlace/QR) que proyecta en la cámara una zona real del cráter **Jezero** de Marte. El usuario enfoca una **carta impresa** con el mapa 2D de la zona, como la carta-trampa de *Invizimals*. Sobre ella aparecen el **relieve 3D**, un **semáforo de riesgo** (verde/ámbar/rojo) que indica dónde es seguro circular y el **rover Perseverance** recorriendo la **ruta más segura**. También se muestra la ruta que siguió de verdad Perseverance, para compararlas.

## 2. Contexto del reto

| Dato | Valor |
|---|---|
| Reto (probable) | *Interplanetary Survival Guide: Martian Map* (nivel principiante): "mapa interactivo para explorar y navegar Marte" |
| Enunciado completo | Se publica el **28-oct-2026**. Hay plan de ajuste definido (D31) |
| Hackathon | **14–15 nov 2026** (48 h). La evaluación empieza el 16-nov |
| Equipo | Hasta 6 personas. Poca experiencia técnica; se desarrolla con IA (Claude Code) |
| Entrega | En inglés. Demo como **vídeo de máx. 30 s o 7 diapositivas**, con subtítulos en inglés. Si se supera el límite, el proyecto queda fuera de la evaluación global |
| Criterios | Impacto, Creatividad, Validez, Relevancia, Presentación |

**Pendiente de confirmar con el organizador local:** si se permite llegar con código escrito antes del 14-nov (D14); si hay que declarar el uso de IA; si se puede usar la insignia de la NASA en la carta o el vídeo; si se puede tocar el despliegue durante la evaluación (D30).

## 3. Objetivos y no objetivos

**Objetivos**
- Mostrar en AR, sobre una carta impresa, el relieve real de un tramo de Jezero con su mapa de transitabilidad.
- Demostrar la navegación segura: el rover recorre una ruta calculada con A* que evita pendientes fuertes, terreno rugoso y arena.
- Validar el método comparando la ruta calculada con un tramo real de la ruta de Perseverance.
- Que funcione en iOS y Android (incluidos móviles antiguos) y que los jueces puedan verlo desde un ordenador.

**No objetivos**
- Publicar en App Store o Google Play (inviable en el plazo: D4).
- Procesar datos en el móvil (todo se prepara antes: D8).
- Backend, cuentas, analítica o cookies (D18).
- Varias zonas, AR a escala real o colocación sobre superficies sin carta.
- Detectar rocas o arena con IA (no se puede validar con este equipo).

## 4. Experiencia de usuario

### Flujo AR (móvil)
1. Escanea el QR o abre el enlace y aparece la pantalla de inicio con dos opciones: **"Ver en AR"** y **"Ver en 3D"**.
2. Al pulsar "Ver en AR", el navegador pide permiso de cámara y el usuario enfoca la carta.
3. El relieve sube desde la carta. La ortofoto se cubre con los colores de riesgo y aparece una leyenda.
4. El rover recorre la ruta segura precalculada, inclinándose con el terreno. La ruta se dibuja siempre por encima del terreno.
5. Hay un botón para mostrar u ocultar la **ruta real de Perseverance** y un panel con métricas comparadas (D24).
6. Botón **"Escala real"**: el rover se encoge a su tamaño real (casi invisible), como momento didáctico.
7. En la pantalla hay un aviso permanente: "Rover ampliado ×N · Relieve exagerado ×2".

### Flujo visor 3D (escritorio, o móvil sin cámara)
La misma escena sin cámara: girar arrastrando y acercar con la rueda o pellizcando. Muestra un QR y la imagen de la carta, para que un juez pueda apuntar con su móvil a la pantalla del portátil (MindAR reconoce imágenes mostradas en pantallas).

### Plan B en el móvil (D25)
| Situación | Comportamiento |
|---|---|
| Permiso de cámara denegado, o sin `getUserMedia` | Pasa sola al visor 3D, con un aviso |
| Navegador interno (WhatsApp, Instagram, Gmail…) | Aviso con el botón **"Abrir en Safari/Chrome"** y visor 3D mientras tanto |
| MindAR no arranca (GPU antigua) | Visor 3D |
| La carta no aparece en unos 10 s | Consejos (luz, reflejos, distancia) y oferta de pasar al visor 3D |
| Se pierde la carta un momento | Se mantiene la última posición unos segundos para que no parpadee |
| La carta no coincide con la versión de la app | Aviso "Carta antigua, descarga la versión X" (D30) |

### P1: toque A→B
El usuario toca un origen y un destino sobre el relieve y el A* calcula la ruta en el navegador. Si no hay ruta posible (rojo intransitable), la app avisa y ofrece la más segura cruzando zonas ámbar (D26).

## 5. Arquitectura

```
┌──────────────── OFFLINE (una vez, PC) ────────────────┐      ┌────────────── WEB APP (GitHub Pages, HTTPS) ───────────────┐
│ USGS DTM 1 m + Orto 25 cm ─┐                           │      │ index.html (inicio) ──► ar.html (A-Frame + MindAR)         │
│ GeoJSON ruta M20 ──────────┼─► pipeline.py ──► assets ─┼─────►│                    └──► viewer.html (A-Frame, sin cámara)  │
│ Polígono arena (QGIS) ─────┘   (rasterio/numpy)        │      │ js/scene-content.js  ← misma escena en los dos modos       │
│ GLB Perseverance NASA ──► gltf-transform ──► rover.glb │      │   terreno · riesgo · rover · ruta · A* · capa Perseverance │
└────────────────────────────────────────────────────────┘      └────────────────────────────────────────────────────────────┘
```

- **Stack (D7, D29):** A-Frame **1.5.0** y MindAR **1.2.5**, con versiones fijas y **copiadas al repo** (`docs/vendor/`), sin CDN en tiempo de ejecución. No hay paso de compilación. Está prohibido que la IA cambie estas versiones (hay que dejarlo escrito en `CLAUDE.md`). Los controles del visor se escriben a mano, sin componentes de la comunidad que puedan no ser compatibles.
- **Una escena, dos anclas (D13):** el contenido cuelga de un nodo que se coloca bajo el ancla de MindAR (`ar.html`) o bajo un nodo fijo con controles de órbita (`viewer.html`).
- **Unidades:** MindAR toma 1 unidad = ancho total de la imagen de la carta, con el origen en el centro. La posición y escala de la ortofoto dentro de la carta se leen de `meta.json` (D23).
- **Estructura de carpetas:** `docs/` (la web, publicable en GitHub Pages desde `/docs`), `pipeline/` (Python), `models/` (fuentes del rover, en `.gitignore`).

## 6. Datos y pipeline (D8, D9, D21, D23, D26)

**Entradas**
| Dato | Fuente |
|---|---|
| DEM 1 m/px | USGS *Mars 2020 TRN HiRISE DTM Mosaic*. Usar las **teselas individuales** del índice S3 (`asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/HiRISE/`), no el mosaico entero |
| Ortofoto 25 cm/px | USGS *Mars 2020 TRN HiRISE Orthomosaic* (el fichero completo ocupa 3,2 GB; recortar la zona) |
| Ruta real | `mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json`. **Descargar y congelar una copia en el repo.** Declara `CRS84`, que es un código terrestre, aunque las coordenadas son de Marte |
| Arena / Séítah | Polígono calcado en QGIS del mapa geológico publicado de Jezero o sobre la ortofoto, **citando la fuente**. Es una buena tarea para quien no programa |
| Rover | GLB oficial de Perseverance de la NASA (crédito NASA/JPL-Caltech) |

**Zona:** desde el punto de aterrizaje Octavia E. Butler hasta el borde de Séítah, unos 1–2 km.

**Salidas (`docs/assets/`)**
- `terrain.bin` o un PNG de 16 bits (malla de ~256×256, o 128×128 en modo lite) y `meta.json` (m/px, altura mínima y máxima, exageración, rectángulo de la ortofoto dentro de la carta, versión de la carta, factor de ampliación del rover).
- `ortho.jpg` (≤2048²; 1024² en modo lite, con el riesgo ya pintado encima).
- `hazard.png` (textura de clases de riesgo).
- `cost.bin` (rejilla de costes de ~5 m por celda).
- `route_default.json` (ruta A* precalculada entre A y B).
- `traverse_segment.json` (tramo de Perseverance en coordenadas de la rejilla, con sus soles).
- `card.pdf`/`card.png`, la carta imprimible con marco de alto contraste, decoración no repetitiva y código de versión, y su `card.mind` compilado.

**Verificación obligatoria (D23), que falla el script si no se cumple**
1. El punto de aterrizaje OEB cae en el píxel esperado (con una tolerancia de pocos metros).
2. Las altitudes del GeoJSON coinciden con el DEM, con un desfase pequeño y constante.
3. Se usan los parámetros de la proyección marciana **leídos del propio fichero**, incluido el factor cos(latitud ≈ 18,4°).
4. Superposición visual en QGIS (ortofoto, ruta y polígono de arena) antes de imprimir.
5. Se comprueba el nivel de puntos de tracking de la carta en el compilador de MindAR antes de imprimir.

## 7. Modelo de riesgo (D2, D11, D26)

- **Pendiente:** se calcula a **1 m** con una ventana de ~3 m, porque HiRISE resuelve bien unas 3 veces el tamaño del píxel.
- **Rugosidad:** desviación típica de las alturas tras quitar la tendencia, en una ventana de ~3–5 m. El umbral se fija tras ver los datos y se documenta.
- **Agregación:** a celdas de ~5 m con el **percentil 90**, que es conservador.
- **Clases**
  - 🟢 verde: pendiente < 15°
  - 🟠 ámbar: 15–25°, o rugosidad media
  - 🔴 rojo: > 25°, rugosidad alta o **arena**
  - Referencia: Curiosity y Perseverance aguantan 45° de inclinación sin volcar, pero su software evita pasar de unos 30°. Los umbrales son configurables en `meta.json`.
- **A\*:** el rojo es **intransitable**; el ámbar tiene coste alto; el coste base es proporcional a la distancia y la pendiente. Si no hay ruta, se reintenta tratando el rojo como coste muy alto y se avisa al usuario.
- **Paleta apta para daltónicos** (D20): tonos con luminancia distinta y una leyenda siempre visible.
- **Exageración vertical** ×2 fija con aviso en pantalla (D19). El riesgo **siempre se calcula sobre el relieve real**. El control deslizante es P2.

## 8. Rover (D3, D10, D12, D27)

- Modelo: Perseverance de la NASA, optimizado con `gltf-transform` a **< 2–3 MB** (`rover.glb`) y una versión **lite < 1 MB** (`rover-lite.glb`). Se usa cuantización en lugar de Draco para no tener que cargar un decodificador.
- Ampliación **×15–20** (unos 45–60 m, ~1 cm en la carta), ajustable en `meta.json`. El botón "escala real" lo deja a ×1.
- Inclinación: normal del terreno muestreada en una **huella fija de ~10–20 m**, suavizada en el tiempo. El modelo va un poco elevado y la ruta se dibuja por encima.

## 9. Comparación con Perseverance (D24)

- Se elige en QGIS **un único tramo cronológico** (rango de soles) que bordee Séítah, recortado a la zona.
- A y B de la ruta segura son los **extremos de ese tramo**.
- Métricas mostradas: **longitud**, **pendiente máxima** y **% del recorrido en ámbar/rojo**, para la ruta calculada y para la real.
- Ficha explicativa: a finales de 2021 Perseverance **entró en South Séítah** por interés científico y volvió por el mismo camino. Fue un desvío asumido conscientemente y no contradice el modelo, porque una ruta científica no es la ruta A→B más segura.

## 10. Rendimiento (D28)

- Objetivo: **≥ 24 fps** en el Android antiguo y **< 15 MB** de descarga total.
- **Modo lite automático** si los fps caen: malla de 128×128, una sola textura de 1024² con el riesgo ya pintado y el rover lite.
- Contador de fps y consola eruda con `?debug=1` (D16; no hay Mac para depurar Safari).
- Se mide en la **primera semana** del prototipo en los 3 móviles de prueba.

## 11. Distribución, despliegue y versiones (D4, D14, D30)

- GitHub Pages desde `/docs` (requiere HTTPS para la cámara y repo público en el plan gratuito).
- **Nombre definitivo del repo y la URL reservado antes del 14-nov.** Los QR se generan solo al final.
- La carta lleva un **código de versión** impreso que la app compara con `meta.json`.
- Al enviar el proyecto: **etiqueta git y congelación**. No se toca nada durante la evaluación.
- Modo offline (PWA con service worker) es P2. Si se añade, la caché debe ir versionada.

## 12. Demo y evaluación (D13, D22)

- **Vídeo de 30 s** con guion plano a plano escrito antes del 14-nov, en inglés con subtítulos.
- Fuentes: grabación de pantalla del iPhone y una segunda cámara que filme manos, móvil y carta.
- Una persona del equipo es responsable del vídeo (rol para quien no programa). Se ensaya la grabación con el prototipo.
- Planos mínimos: carta → el relieve sube → semáforo de riesgo → el rover recorre la ruta → comparación con Perseverance → botón "escala real".
- En la página del proyecto: enlace al visor 3D, la carta en PDF y créditos de los datos.

## 13. Idioma (D15)

ES/EN con selector y textos en `i18n.json`. Inglés por defecto salvo que el navegador esté en español. **Es lo primero que se recorta** (D17): si falta tiempo, solo inglés.

## 14. Seguridad y privacidad (D18, D29)

- Sin backend, cuentas, analítica ni cookies. Las imágenes de la cámara **se procesan solo en el dispositivo**; no se graban ni se envían.
- Todas las librerías con versión fija y copiadas al repo: no hay scripts de terceros cargados en tiempo de ejecución, lo que reduce el riesgo de cadena de suministro.
- Solo HTTPS (GitHub Pages).
- No se ha activado ningún bloqueo de seguridad: no hay datos personales, autenticación, endpoints ni secretos.

## 15. Pruebas

- **Matriz de dispositivos:** iPhone (Safari), Android de gama alta (Chrome), Android antiguo o de gama baja. Además, abrir el enlace desde WhatsApp en los dos sistemas.
- **Página de prueba semanal:** la combinación A-Frame + MindAR + carta en los 3 móviles.
- **Pipeline:** las verificaciones de la sección 6 se ejecutan automáticamente en el script.
- **Ensayo general:** del 9 al 13 de noviembre, con una lista de pasos para el día del evento (cartas impresas en papel mate, móviles cargados, datos móviles como respaldo del WiFi, URL de reserva).

## 16. Prioridades (D17)

| Prioridad | Contenido |
|---|---|
| **P0** | Carta, relieve y semáforo de riesgo; rover recorriendo la ruta precalculada (con inclinación); visor 3D en escritorio con plan B automático en el móvil; comparación con Perseverance |
| **P1** | Toque A→B, ES/EN, botón "escala real" |
| **P2** | Control de exageración vertical, modo offline, fichas informativas |
| **Lo primero que se recorta** | El bilingüe (pasa a solo inglés) y el toque A→B (se queda la ruta precalculada) |

## 17. Plan para el 28-oct (D31)

Reunión el 28–29 de octubre con criterios decididos de antemano. **Se mantiene la arquitectura.** Si el enunciado se centra en astronautas, se añade solo un perfil "astronauta / rover tripulado" (otros umbrales de pendiente, mismo A*) y se reenfoca el relato del vídeo. No se rediseña nada.

## 18. Equipo y roles sugeridos

| Rol | Tareas | Perfil |
|---|---|---|
| Desarrollo de la app (con IA) | `docs/`, escena, modos AR y 3D | El más técnico |
| Datos | Ejecutar el pipeline, QGIS, polígono de arena, elegir el tramo de soles | Ciencias |
| 3D y carta | Rover, diseño de la carta, pruebas de tracking | Diseño |
| Vídeo y presentación | Guion, grabación, subtítulos, página del proyecto | Comunicación |
| Pruebas y reglas | Matriz de dispositivos, organizador local, ensayo general | Cualquiera |

## Decisions Log

| ID | Topic | Decision | Rationale | Source | Date |
|---|---|---|---|---|---|
| D1 | Anclaje AR | Carta impresa con la ortofoto como marcador (MindAR), a escala de mesa, con marco de alto contraste | Funciona en casi cualquier móvil desde el navegador, sin ARCore/ARKit; estilo Invizimals | Interview | 2026-10-18 |
| D2 | Significado de "seguro" | Transitabilidad del rover: semáforo y ruta segura | Sale del DEM y se defiende con los límites reales de los rovers | Interview | 2026-10-18 |
| D3 | Comportamiento del rover | Ruta A→B con A* sobre la rejilla de costes; el rover la recorre inclinándose | Demuestra la "navegación", que es lo que pide el reto | Interview | 2026-10-18 |
| D4 | Distribución | Web app por URL/QR (PWA), sin tiendas | Las tiendas no llegan a tiempo; los jueces no instalan APK; funciona en iOS y Android | Interview | 2026-10-18 |
| D5 | Equipo | Poca experiencia técnica; desarrollo con IA | Respuesta honesta del equipo; condiciona alcance y stack | Interview | 2026-10-18 |
| D6 | Plan de ejecución | Prototipo con IA antes del 14-nov; versión final en el hackathon | Quita riesgos técnicos y permite aprender antes de las 48 h | Interview | 2026-10-18 |
| D7 | Stack | A-Frame + MindAR, sin compilación, en GitHub Pages | HTML declarativo, adecuado para principiantes y bien conocido por la IA | Interview | 2026-10-18 |
| D8 | Pipeline | Script de Python que se ejecuta una vez; el móvil solo carga ficheros y calcula el A* | Procesar el DEM en el móvil sería excesivo; separa la ciencia de la interacción | Interview | 2026-10-18 |
| D9 | Zona | Jezero, del aterrizaje OEB al borde de Séítah (~1–2 km); DEM USGS de 1 m y ortofoto de 25 cm | Los mejores datos disponibles y una ruta real con la que comparar | Interview | 2026-10-18 |
| D10 | Escala | Rover ampliado con etiqueta y botón "escala real"; cálculos a escala real | A escala real el rover mide 0,4–0,8 mm en la carta | Interview | 2026-10-18 |
| D11 | Modelo de riesgo | Pendiente (<15° / 15–25° / >25°), rugosidad y polígono de arena citado | Séítah es peligrosa por la arena; solo con la pendiente podría no detectarse | Interview | 2026-10-18 |
| D12 | Modelo 3D | GLB oficial de Perseverance de la NASA, optimizado | Coherente con Jezero y uso libre con crédito | Interview | 2026-10-18 |
| D13 | Jueces | Visor 3D en escritorio (misma escena, dos anclas), carta en pantalla y QR | Los jueces globales evalúan desde un ordenador | Interview | 2026-10-18 |
| D14 | Reglas y trabajo previo | Este repo es de prácticas; el 14-nov se empieza un repo limpio y se reutilizan los datos públicos ya preparados | Evita la descalificación si no se permite código previo | Interview | 2026-10-18 |
| D15 | Idioma | ES/EN con selector; inglés por defecto salvo navegador en español | Jueces globales en inglés y público local en español | Interview | 2026-10-18 |
| D16 | Dispositivos y depuración | iPhone, Android de gama alta y antiguo; eruda con `?debug=1` | No hay Mac para depurar Safari | Interview | 2026-10-18 |
| D17 | Prioridades | P0/P1/P2 de la sección 16; lo primero que se recorta es el bilingüe y el toque A→B | El equipo prioriza la validez científica sobre la interacción | Interview | 2026-10-18 |
| D18 | Privacidad | Sin backend, cuentas, analítica ni cookies; la cámara se procesa en local | Superficie de ataque y RGPD mínimos | Interview | 2026-10-18 |
| D19 | Exageración vertical | ×2 fija con aviso; el control deslizante es P2 | A escala de mesa el relieve se vería plano | Interview | 2026-10-18 |
| D20 | Accesibilidad | Paleta de riesgo apta para daltónicos y leyenda | El rojo/verde clásico falla con el daltonismo | Interview | 2026-10-18 |
| D21 | Datos de la ruta real | Copia congelada del GeoJSON M20 en el repo | La URL solo aparece citada por terceros y puede desaparecer | Interview | 2026-10-18 |
| D22 | Demo para la entrega | Vídeo de 30 s con guion, subtítulos en inglés, responsable y ensayo antes del 14-nov | Límite oficial de 30 s o 7 diapositivas; los jueces puntúan sobre todo por el vídeo | Red Team | 2026-10-18 |
| D23 | Alineación | Pruebas automáticas (píxel de OEB, altitudes), revisión en QGIS y rectángulo de la ortofoto en meta.json | Cuatro sistemas de coordenadas; el GeoJSON declara un CRS terrestre; error de ~5 % sin cos(lat) | Red Team | 2026-10-18 |
| D24 | Comparación con Perseverance | Un tramo por soles que bordee Séítah; A/B en sus extremos; métricas de longitud, pendiente máxima y % ámbar/rojo; ficha sobre la entrada de 2021 | El rover real entró en South Séítah; la comparación sin acotar estaba mal planteada | Red Team | 2026-10-18 |
| D25 | Plan B en el móvil | Visor 3D automático, botón "Abrir en Safari/Chrome", consejos a los 10 s y mantener la posición al perder la carta | Navegadores internos sin cámara, permisos denegados, pérdida de tracking | Red Team | 2026-10-18 |
| D26 | Rejilla de costes | Calcular a 1 m (ventana de 3 m), agregar a 5 m con el percentil 90; arena = rojo; rojo intransitable; alternativa si no hay ruta | Calcular sobre la malla reducida suaviza las pendientes; A* necesita una regla para "sin ruta" | Red Team | 2026-10-18 |
| D27 | Ampliación del rover | ×15–20 configurable; inclinación con huella de 10–20 m suavizada; ruta dibujada por encima | A ×50 ocupaba 150 m del mapa y se inclinaba mal | Red Team | 2026-10-18 |
| D28 | Rendimiento | ≥24 fps, <15 MB y modo lite automático; se mide la primera semana | MindAR y el renderizado comparten GPU; límites de memoria de iOS | Red Team | 2026-10-18 |
| D29 | Dependencias | A-Frame 1.5.0 y MindAR 1.2.5 fijos y copiados al repo; prohibido cambiarlos | MindAR no se actualiza; CDN y WiFi del evento; riesgo de cadena de suministro | Red Team | 2026-10-18 |
| D30 | URL y versiones | Nombre de repo reservado, QR generados al final, código de versión en la carta y congelación al enviar | El repo nuevo cambia la URL; un .mind en caché puede no corresponder a la carta | Red Team | 2026-10-18 |
| D31 | Enunciado del 28-oct | Reunión con criterios fijados; como mucho se añade un perfil astronauta; no se rediseña | El título del reto apunta a supervivencia humana | Red Team | 2026-10-18 |
| D32 | Primera demo | Demo en `docs/` con terreno procedural provisional y la carta de ejemplo de MindAR hasta que exista el pipeline; rover comprimido con gltf-transform | Valida pronto el stack y el rendimiento sin esperar a los datos reales | Interview | 2026-10-18 |

## Dependency Graph & Implementation Order

```
[Reglas confirmadas] ─────────────────────────────────────────────┐
[Datos descargados y congelados] ─► [Pipeline .py] ─► [Assets terreno/riesgo/coste] ─┬─► [Escena compartida] ─┬─► [Modo AR] ─────┐
[Polígono de arena (QGIS)] ─────────┘       │                                        │   (terreno, rover,    ├─► [Visor 3D + plan B] ─┤
[Rover compactado] ──────────────────────────┼────────────────────────────────────────┘    ruta, A*)          │                 ├─► [Vídeo 30 s] ─► [Envío y congelación]
                                             ├─► [Carta + .mind + versión] ─► [Modo AR]                         └─► [Comparación M20] ┘
                                             └─► [Tramo M20 + métricas] ─► [Comparación M20]
```

| Fecha | Hito |
|---|---|
| **Semana 1 (18–25 oct)** | Preguntar las reglas al organizador. Demo con terreno procedural y rover compacto (D32). Medir fps en los 3 móviles. Descargar la tesela del DEM, la ortofoto y el GeoJSON M20 y congelarlos. Escribir `CLAUDE.md` con las versiones fijas. |
| **Semana 2 (26 oct–1 nov)** | Pipeline de Python con sus verificaciones. Polígono de arena. **Reunión del 28–29 oct sobre el enunciado (D31).** Reservar el nombre del repo y la URL definitivos. |
| **Semana 3 (2–8 nov)** | Carta real y `.mind` con versión, y prueba de alineación. Tramo M20 y métricas. Guion del vídeo y ensayo de grabación. |
| **Semana 4 (9–13 nov)** | Ensayo general y lista de pasos para el día del evento. Imprimir las cartas en papel mate. Cerrar el prototipo. |
| **14–15 nov** | Repo limpio si las reglas lo exigen. P0 y luego P1 según el tiempo. Vídeo. Envío, etiqueta y congelación. |
| **16 nov en adelante** | Evaluación: no se toca el despliegue. |
