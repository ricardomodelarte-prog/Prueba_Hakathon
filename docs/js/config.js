/* ============================================================
   config.js - Configuración, textos y utilidades comunes.
   Se carga PRIMERO en todas las páginas.
   Todo cuelga del objeto global MARTE (sin módulos ni build).
   ============================================================ */
var MARTE = window.MARTE = window.MARTE || {};

/* ---------- 1) CONFIGURACIÓN (aquí se cambian los números) ---------- */
MARTE.CONFIG = {
  // --- Tarjeta (imagen que detecta MindAR) ---
  // Alto/ancho de assets/target/card.png (674 x 372 px).
  // En el ancla, 1 unidad = ancho de la tarjeta, así que el mapa mide 1 x TARJETA_ASPECTO.
  TARJETA_ASPECTO: 372 / 674,

  // --- Terreno ---
  ANCHO_REAL_M: 1500,        // ancho "real" del mapa en metros (~1,5 km)
  MALLA_X: 128,              // columnas de la malla (las filas salen del aspecto de la tarjeta)
  SEMILLA: 18022021,         // semilla del terreno procedural (aterrizaje de Perseverance :)
  EXAGERACION_RELIEVE: 2,    // el relieve se dibuja x2 (la pendiente se calcula SIN exagerar)

  // --- Pendientes (grados, calculadas con las alturas reales) ---
  PENDIENTE_VERDE_MAX: 15,   // < 15°  -> verde
  PENDIENTE_AMBAR_MAX: 25,   // 15-25° -> ámbar, > 25° -> rojo

  // Paleta apta para daltonismo: los tres colores tienen luminosidad MUY distinta
  // (ámbar claro, verde medio, rojo oscuro). Se mezclan sobre el color base marciano.
  COLORES: {
    base:  '#b4775a',   // color base "marciano"
    verde: '#1f9e89',
    ambar: '#ffc533',
    rojo:  '#8c1238'
  },
  MEZCLA_RIESGO: 0.68,       // 0 = solo color marciano, 1 = solo color de riesgo

  // --- Ruta A -> B (fracciones del ancho del mapa: [u, w]) ---
  PUNTO_A: [0.34, 0.47],
  PUNTO_B: [0.80, 0.28],
  COSTE_AMBAR: 4,            // moverse por ámbar cuesta 4 veces más
  COSTE_ROJO_REINTENTO: 60,  // si no hay ruta, el rojo se permite pero muy caro
  ELEVACION_RUTA: 0.003,     // la línea de la ruta flota un poco sobre el terreno (unidades)
  RADIO_RUTA: 0.003,         // grosor del tubo de la ruta (unidades)

  // --- Rover ---
  ROVER_URL: 'assets/rover.glb',
  ROVER_URL_LITE: 'assets/rover-lite.glb',   // con ?lite=1
  ROVER_ESCALA: 18,          // el rover se dibuja x18 respecto al tamaño real
  ROVER_LARGO_M: 3,          // largo real de Perseverance (m)
  // Si el modelo avanza "de lado" o "marcha atrás", cambia esto a 90, 180 o -90:
  ROVER_GIRO_MODELO_GRADOS: 0,    // rover.glb: brazo y cámaras frontales en +Z, generador (RTG) en -Z
  ROVER_ELEVACION: 0.004,    // el rover va un poco elevado para que se vea la ruta (unidades)
  ROVER_VELOCIDAD_M_S: 25,   // m del mapa por segundo (velocidad de demo; la real es ~0,04 m/s)
  ROVER_PAUSA_S: 1.2,        // pausa al llegar a A o B antes de dar la vuelta
  HUELLA_INCLINACION_M: 15,  // el rover se inclina según la normal medida en ~15 m
  SUAVIZADO_INCLINACION: 4,  // más alto = se adapta más rápido al terreno

  // --- Realidad aumentada ---
  SEGUNDOS_BUSCANDO: 10,     // si no ve la tarjeta en 10 s, mostramos consejos
  MS_CONTENIDO_TRAS_PERDER: 3000  // al perder la tarjeta, el contenido sigue 3 s en su última pose
};

/* ---------- 2) TEXTOS (todo el texto visible está aquí; añadir 'en' después) ---------- */
MARTE.IDIOMA = 'es';
MARTE.TEXTOS = {
  es: {
    // --- Portada (index.html) ---
    titulo: 'Mapa seguro de Marte',
    tituloA: 'Mapa seguro',
    tituloB: 'de Marte',
    subtitulo: 'Apunta tu móvil a una tarjeta y el cráter Jezero se levanta en relieve sobre tu mesa. ' +
               'El rover Perseverance recorre la ruta más segura según la pendiente.',
    verAR: 'Ver en AR',
    ver3D: 'Ver en 3D',
    pistaAR: 'La AR necesita cámara y HTTPS. Sin cámara o sin tarjeta, usa «Ver en 3D».',
    tarjetaTitulo: 'La tarjeta de anclaje',
    tarjetaTexto: 'Es la imagen que reconoce la cámara. Imprímela o ábrela en otra pantalla.',
    abrirTarjeta: 'Abrir la tarjeta de AR',
    pasosTitulo: 'Cómo verlo en AR',
    paso1T: 'Ten la tarjeta a mano',
    paso1: 'En papel o en otra pantalla, con buena luz y sin reflejos.',
    paso2T: 'Abre la AR y da permiso a la cámara',
    paso2: 'Pulsa «Ver en AR». Funciona en Safari (iPhone) y Chrome (Android).',
    paso3T: 'Apunta a la tarjeta',
    paso3: 'El mapa se levanta sobre ella. Muévete alrededor y sigue al rover.',
    qrTitulo: 'Ábrelo en tu móvil',
    qrTexto: 'Escanea el código con la cámara del móvil.',
    qrAlt: 'Código QR con el enlace de esta página',
    qrLocal: 'Estás en localhost: un móvil no podrá abrir este enlace. ' +
             'Usa la dirección pública (https) o la IP de tu ordenador.',
    pistaEnlace: 'O copia el enlace:',
    copiar: 'Copiar enlace',
    copiado: 'Copiado',
    creditos: 'Proyecto para el reto NASA Space Apps 2026; no es un producto oficial de la NASA. ' +
              'Modelo 3D del rover: NASA/JPL-Caltech. Terreno: procedural de práctica (no es real).',
    plano: 'Curvas de nivel decorativas con la ruta A → B',

    // Notas en pantalla
    nota: 'Rover ampliado ×{rover} · Relieve ×{relieve}',
    notaReal: 'Rover a escala real ×1 · Relieve ×{relieve}',
    botonEscalaReal: 'Escala real',
    botonEscalaAmpliada: 'Escala ×{rover}',
    cargando: 'Cargando mapa…',
    errorMapa: 'No se pudo crear el mapa. Recarga la página.',
    rutaSinSegura: 'Aviso: no hay ruta totalmente segura; la ruta cruza zonas rojas.',

    // Leyenda
    botonRiesgo: 'Mapa de riesgo',
    leyendaTitulo: 'Riesgo por pendiente',
    leyendaVerde: 'Transitable (< {v}°)',
    leyendaAmbar: 'Precaución ({v}–{a}°)',
    leyendaRojo: 'Peligro (> {a}° o arena)',
    leyendaRuta: 'Ruta A → B',

    // Etiquetas del mapa
    etiquetaArena: 'arena (tipo Séítah)',
    etiquetaA: 'A · inicio',
    etiquetaB: 'B · destino',
    etiquetaBorde: 'borde del cráter',
    etiquetaDelta: 'delta',

    // Visor 3D
    mostrarTarjeta: 'Mostrar tarjeta',
    cerrarTarjeta: 'Cerrar',
    tarjetaAyuda: 'Apunta la cámara de tu móvil (en la página "Ver en AR") a esta pantalla.',
    reiniciarVista: 'Reiniciar vista',
    ayudaVisor: 'Arrastra para girar · pellizca para acercar',
    abrirAR: 'Probar AR',

    // Modo AR
    buscando: 'Apunta la cámara a la tarjeta',
    consejosTitulo: 'No encuentro la tarjeta',
    consejos: [
      'Pon la tarjeta entera dentro de la imagen, sin cortar los bordes.',
      'Busca buena luz y evita reflejos o brillos.',
      'Aleja un poco el móvil y mantenlo quieto un momento.',
      'Si la muestras en una pantalla, sube el brillo.'
    ],
    verTarjeta: 'Ver la tarjeta',
    irAlVisor: 'Mejor ver en 3D',

    // Aviso del visor cuando venimos de un fallback de AR
    fallbackTitulo: 'No se pudo abrir la realidad aumentada',
    fallback: {
      'navegador-interno': 'Estás en un navegador interno (WhatsApp, Instagram, Facebook, Line, Google…) ' +
                           'que no deja usar la cámara.',
      'sin-camara': 'Este navegador o dispositivo no permite usar la cámara.',
      'sin-https': 'La cámara solo funciona con HTTPS. Abre la versión https:// de esta página.',
      'camara': 'No se pudo acceder a la cámara (¿has denegado el permiso?).',
      'error-mindar': 'La librería de AR ha fallado en este dispositivo.',
      'otro': 'La realidad aumentada no está disponible ahora mismo.'
    },
    fallbackConsejo: 'Abre este enlace en Safari (iPhone) o Chrome (Android) para probar la AR. ' +
                     'Mientras tanto, puedes explorar el mapa en 3D aquí abajo.',
    copiarEnlaceAR: 'Copiar enlace de AR',
    cerrar: 'Cerrar',
    cerrarConsejos: 'Cerrar los consejos'
  }
};

/* Devuelve un texto por clave. Los {marcadores} se rellenan con 'datos'.
   Ejemplo: MARTE.t('nota', {rover: 18, relieve: 2}) */
MARTE.t = function (clave, datos) {
  var tabla = MARTE.TEXTOS[MARTE.IDIOMA] || MARTE.TEXTOS.es;
  var txt = tabla[clave];
  if (txt === undefined) { return clave; }          // si falta, mostramos la clave
  if (typeof txt !== 'string') { return txt; }      // listas (consejos, fallback)
  return txt.replace(/\{(\w+)\}/g, function (m, k) {
    return (datos && datos[k] !== undefined) ? datos[k] : m;
  });
};

/* Rellena los elementos HTML con atributo data-t="clave" (y data-t-title para tooltips). */
MARTE.traducirPagina = function () {
  var nodos = document.querySelectorAll('[data-t]');
  for (var i = 0; i < nodos.length; i++) {
    nodos[i].textContent = MARTE.t(nodos[i].getAttribute('data-t'), {
      rover: MARTE.CONFIG.ROVER_ESCALA, relieve: MARTE.CONFIG.EXAGERACION_RELIEVE
    });
  }
};

/* ---------- 3) PARÁMETROS DE LA URL (?lite=1 ?debug=1 ?fallback=...) ---------- */
(function () {
  var q = new URLSearchParams(window.location.search);
  MARTE.params = {
    lite: q.get('lite') === '1',
    debug: q.get('debug') === '1',
    fallback: q.get('fallback')
  };
})();

/* Añade ?lite / ?debug a un enlace para conservarlos al cambiar de página. */
MARTE.conParams = function (url, extra) {
  var q = [];
  if (MARTE.params.lite) { q.push('lite=1'); }
  if (MARTE.params.debug) { q.push('debug=1'); }
  if (extra) { q.push(extra); }
  return q.length ? url + '?' + q.join('&') : url;
};

/* Manda al usuario al visor 3D indicando el motivo (lo usa ar.html). */
MARTE.irAlVisor = function (motivo) {
  window.location.replace(MARTE.conParams('viewer.html', 'fallback=' + encodeURIComponent(motivo)));
};

/* Estado compartido muy simple (lo lee el rover, lo cambia el botón). */
MARTE.estado = { escalaReal: false };
