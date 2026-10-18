/* ============================================================
   terrain.js - Terreno: mapa de alturas, pendientes, riesgo y malla 3D.

   Flujo:  getHeightmap()  ->  analizarTerreno()  ->  crearMallaTerreno()
   Colores: capa "Marte" (realista, por defecto) y capa de riesgo (semáforo): MARTE.capaRiesgo(bool).
   Todas las distancias del terreno están en METROS "reales" (x: 0..1500, z: 0..~830).
   Solo al dibujar se pasan a "unidades de ancla" (1 unidad = ancho de la tarjeta).
   ============================================================ */
(function () {
  var MARTE = window.MARTE;
  var C = MARTE.CONFIG;

  /* ---------- Utilidades matemáticas ---------- */

  // Generador de números pseudoaleatorios con semilla (mulberry32): mismo resultado siempre.
  function crearRandom(semilla) {
    var a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Ruido "de valor" 2D suave con valores entre -1 y 1.
  function crearRuido(semilla) {
    var rnd = crearRandom(semilla);
    var tabla = new Float32Array(256 * 256);
    for (var i = 0; i < tabla.length; i++) { tabla[i] = rnd() * 2 - 1; }
    function v(ix, iy) { return tabla[((iy & 255) << 8) + (ix & 255)]; }
    function suave(t) { return t * t * (3 - 2 * t); }
    return function (x, y) {
      var ix = Math.floor(x), iy = Math.floor(y);
      var fx = suave(x - ix), fy = suave(y - iy);
      var a = v(ix, iy), b = v(ix + 1, iy), c = v(ix, iy + 1), d = v(ix + 1, iy + 1);
      var arriba = a + (b - a) * fx;
      var abajo = c + (d - c) * fx;
      return arriba + (abajo - arriba) * fy;
    };
  }

  // Suma de ruidos a distintas escalas (más natural que un solo ruido).
  function fbm(ruido, x, y, octavas) {
    var suma = 0, amp = 1, norm = 0;
    for (var o = 0; o < octavas; o++) {
      suma += ruido(x, y) * amp;
      norm += amp;
      x *= 2; y *= 2; amp *= 0.5;
    }
    return suma / norm;
  }

  // Escalón suave: 0 si x<=a, 1 si x>=b (también funciona con a>b).
  function escalon(a, b, x) {
    var t = (x - a) / (b - a);
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return t * t * (3 - 2 * t);
  }

  // ¿Está el punto (x,z) dentro del polígono? (algoritmo del rayo)
  function dentroPoligono(x, z, poli) {
    var dentro = false;
    for (var i = 0, j = poli.length - 1; i < poli.length; j = i++) {
      var xi = poli[i][0], zi = poli[i][1], xj = poli[j][0], zj = poli[j][1];
      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) { dentro = !dentro; }
    }
    return dentro;
  }

  // Distancia de un punto a un segmento (para las crestas).
  function distSegmento(px, pz, ax, az, bx, bz) {
    var vx = bx - ax, vz = bz - az;
    var t = ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz);
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return Math.hypot(px - (ax + t * vx), pz - (az + t * vz));
  }

  /* Ruido "de crestas" (ridged): valles redondeados y crestas afiladas. Devuelve 0..1. */
  function cresta(ruido, x, y, octavas) {
    var suma = 0, amp = 1, norm = 0;
    for (var o = 0; o < octavas; o++) {
      var n = 1 - Math.abs(ruido(x, y));
      suma += n * n * amp;
      norm += amp;
      x *= 2.03; y *= 2.03; amp *= 0.5;
    }
    return suma / norm;
  }

  /* ---------- Terreno procedural tipo Jezero ---------- */

  // Polígono del campo de dunas, en fracciones del ancho (u, w). Se etiqueta "arena (tipo Séítah)".
  var ARENA_UW = [[0.44, 0.34], [0.52, 0.30], [0.62, 0.36], [0.66, 0.46],
                  [0.60, 0.54], [0.49, 0.55], [0.42, 0.46]];

  // Crestas (ridges): [u1, w1, u2, w2, altura_m, anchura]
  var CRESTAS = [[0.43, -0.02, 0.49, 0.17, 26, 0.035],
                 [0.60, -0.02, 0.66, 0.16, 24, 0.035],
                 [0.52, 0.55, 0.58, 0.40, 18, 0.03]];

  // Mesetas / cerros testigo aislados: [u, w, radio, altura_m]  (radio en fracciones del ancho)
  // Cima plana, acantilado empinado y falda de derrubios (talud) alrededor.
  var MESAS = [[0.78, 0.07, 0.038, 62],
               [0.72, 0.50, 0.034, 52],
               [0.40, 0.19, 0.028, 44]];

  // Picos con crestas (ruido ridged): [u, w, radio, altura_m]. Flancos muy empinados.
  var PICOS = [[0.56, 0.09, 0.046, 118],
               [0.92, 0.50, 0.044, 96],
               [0.97, 0.06, 0.038, 66]];

  // Cráteres pequeños con borde elevado. Se reparten con una semilla propia y se descartan los
  // que caen cerca de A, de B, de la pared del cráter grande o del pasillo central
  // (así la ruta A -> B siempre existe).
  var CRATERES = (function () {
    var rnd = crearRandom(C.SEMILLA + 77), lista = [], intentos = 0;
    var A = C.PUNTO_A, B = C.PUNTO_B;
    while (lista.length < 14 && intentos < 400) {
      intentos++;
      var u = 0.28 + rnd() * 0.70, w = 0.03 + rnd() * 0.50, r = 0.012 + rnd() * rnd() * 0.034;
      if (Math.hypot(u - A[0], w - A[1]) < 0.09 + r) { continue; }
      if (Math.hypot(u - B[0], w - B[1]) < 0.09 + r) { continue; }
      var dCrater = Math.hypot(u - 0.91, w - 0.28);              // lejos de la pared interior
      if (dCrater > 0.55 && dCrater < 0.80) { continue; }
      if (w > 0.20 && w < 0.34 && u > 0.34 && u < 0.78) { continue; }   // pasillo central
      var ok = true, i;
      for (i = 0; i < lista.length && ok; i++) {
        if (Math.hypot(u - lista[i][0], w - lista[i][1]) < (r + lista[i][2]) * 1.8) { ok = false; }
      }
      for (i = 0; i < MESAS.length && ok; i++) {
        if (Math.hypot(u - MESAS[i][0], w - MESAS[i][1]) < MESAS[i][2] * 2.6 + r) { ok = false; }
      }
      for (i = 0; i < PICOS.length && ok; i++) {
        if (Math.hypot(u - PICOS[i][0], w - PICOS[i][1]) < PICOS[i][2] * 1.8 + r) { ok = false; }
      }
      if (ok) { lista.push([u, w, r]); }
    }
    return lista;
  })();

  // Altura (en metros) de un punto con coordenadas normalizadas u = x/ancho, w = z/ancho.
  function alturaProcedural(u, w, ruido) {
    var h = 0, i;

    // 0) DEFORMACIÓN DEL DOMINIO (domain warping): torcemos las coordenadas con ruido suave
    //    para que bordes, crestas y cerros no salgan tan "redondos" ni geométricos.
    var uw = u + 0.05 * fbm(ruido, u * 3.1 + 21, w * 3.1 + 8, 3);
    var ww = w + 0.05 * fbm(ruido, u * 3.1 + 57, w * 3.1 + 33, 3);

    // 1) BORDE DEL CRÁTER: arco a la izquierda. El suelo del cráter queda a la derecha.
    var CX = 0.91, CZ = 0.28, R = 0.73;          // centro y radio del cráter (fracciones del ancho)
    var BORDE = 95, MESETA = 55;                 // altura del borde y de la meseta exterior (m)
    var dx = uw - CX, dz = ww - CZ;
    var d = Math.hypot(dx, dz) + 0.025 * ruido(u * 7 + 40, w * 7);
    var angC = Math.atan2(dz, dx);
    if (d < R) {
      h += BORDE * escalon(R - 0.13, R, d);                 // pared interior (empinada)
      // barrancos en la pared interior (ruido ridged)
      h += 14 * escalon(R - 0.11, R - 0.02, d) * (cresta(ruido, u * 16 + 70, w * 16 + 5, 3) - 0.4);
    } else {
      h += BORDE - (BORDE - MESETA) * escalon(R, R + 0.16, d); // ladera exterior (suave)
    }
    // Cresta afilada del borde: una arista estrecha cuya altura cambia a lo largo del arco
    var alturaCresta = 8 + 26 * cresta(ruido, angC * 7 + 3, 4.5, 3);
    var x = (d - R + 0.006) / 0.02;
    h += alturaCresta * Math.exp(-(x * x));

    // 2) DELTA: lóbulo elevado a la derecha, con una rampa suave por el oeste (la "entrada del río").
    var ex = (u - 0.78) / 0.19, ez = (w - 0.28) / 0.15;
    var ang = Math.atan2(ez, ex);
    var lobulos = 1 + 0.18 * Math.sin(3 * ang + 1) + 0.08 * Math.sin(7 * ang);
    var rr = Math.hypot(ex, ez) / lobulos;
    var dAng = Math.atan2(Math.sin(ang - Math.PI), Math.cos(ang - Math.PI)); // ángulo respecto al oeste
    var borde = 1.25 + 0.9 * Math.exp(-(dAng * dAng) / 0.35);               // borde más ancho al oeste
    h += 38 * escalon(borde, 0.7, rr);
    if (rr < 0.85) { h += 1.0 * Math.sin(u * 140 + 3 * ruido(u * 9, w * 9)); } // ondulaciones en la cima

    // 3) CRESTAS (ridges), con el dominio deformado
    for (i = 0; i < CRESTAS.length; i++) {
      var c = CRESTAS[i];
      var dd = distSegmento(uw, ww, c[0], c[1], c[2], c[3]);
      h += c[4] * (0.75 + 0.25 * ruido(u * 14 + i * 9, w * 14)) * Math.exp(-(dd * dd) / (c[5] * c[5]));
    }

    // 4) MESETAS aisladas: cima plana + acantilado + falda de derrubios (talud)
    for (i = 0; i < MESAS.length; i++) {
      var m = MESAS[i];
      var mx = uw - m[0], mz = ww - m[1];
      var am = Math.atan2(mz, mx);
      var rm = Math.hypot(mx, mz) / (m[2] * (1 + 0.28 * ruido(Math.cos(am) * 1.6 + m[0] * 40, Math.sin(am) * 1.6 + m[1] * 40)));
      var cima = 1 - escalon(0.62, 1.0, rm);                       // 1 arriba, 0 pasado el acantilado
      var talud = Math.pow(1 - escalon(0.95, 1.8, rm), 1.3);       // falda de derrubios que baja al suelo
      h += m[3] * (0.42 * talud + 0.58 * cima);
      if (rm < 0.6) { h += 1.6 * ruido(u * 30 + i, w * 30); }      // cima rugosa
      // flancos rugosos (estratos y bloques caídos) en el acantilado y el talud
      h += 5 * escalon(0.5, 0.8, rm) * (1 - escalon(1.3, 1.8, rm)) * ruido(u * 36 + i * 7, w * 36 + 2);
    }

    // 5) PICOS con crestas (ruido ridged) y flancos empinados
    for (i = 0; i < PICOS.length; i++) {
      var pk = PICOS[i];
      var dp = Math.hypot(uw - pk[0], ww - pk[1]) / pk[2];
      var envolvente = Math.max(0, 1 - (dp + 0.16 * ruido(u * 10 + i * 5, w * 10)));   // cono (flancos rectos)
      var cr = cresta(ruido, u * 22 + i * 13, w * 22 + 4, 4);
      h += pk[3] * Math.pow(envolvente, 0.95) * (0.40 + 0.60 * cr);
      h += 6 * Math.min(1, envolvente * 3) * ruido(u * 36 + i * 3, w * 36 + 9);   // flancos rugosos
    }
    // "Tierras malas" en el norte: más crestas sueltas (ruido ridged) que se apagan hacia el sur
    var mascara = escalon(0.24, 0.06, w) * escalon(0.40, 0.50, u) * (1 - escalon(0.80, 0.90, u));
    h += 36 * mascara * (cresta(ruido, u * 15 + 31, w * 15 + 12, 4) - 0.35);

    // 6) CRÁTERES pequeños con borde elevado
    for (i = 0; i < CRATERES.length; i++) {
      var q = CRATERES[i];
      var rq = Math.hypot(u - q[0], w - q[1]) / q[2];
      if (rq > 3) { continue; }
      var prof = 0.30 * q[2] * C.ANCHO_REAL_M;                      // profundidad (m)
      if (rq < 1) {
        h -= prof * (1 - rq * rq);                                 // cuenco
        h += 0.30 * prof * escalon(0.55, 1.0, rq);                 // borde interior elevado
      } else {
        h += 0.27 * prof * Math.exp(-(rq - 1) * (rq - 1) / 0.35);  // borde
        h += 0.10 * prof * (1 - escalon(1.0, 3.0, rq));            // eyecciones
      }
    }

    // 7) RUIDO suave general (rugosidad de fondo)
    h += 11 * fbm(ruido, u * 5 + 11, w * 5 + 3, 3);
    h += 1.5 * ruido(u * 24 + 5, w * 24 + 7);

    // 8) DUNAS: ondulaciones solo dentro del polígono de arena
    if (dentroPoligono(u, w, ARENA_UW)) {
      h += 2.2 * Math.sin((u * 0.8 + w * 0.6) * 150 + 2 * ruido(u * 12, w * 12));
    }
    return h;
  }

  function generarProcedural() {
    var nx = C.MALLA_X;
    var anchoM = C.ANCHO_REAL_M;
    var nz = Math.round((nx - 1) * C.TARJETA_ASPECTO) + 1;   // filas según el aspecto de la tarjeta
    var largoM = anchoM * C.TARJETA_ASPECTO;
    var ruido = crearRuido(C.SEMILLA);
    var alturas = new Float32Array(nx * nz);
    var min = Infinity;
    for (var j = 0; j < nz; j++) {
      for (var i = 0; i < nx; i++) {
        var u = i / (nx - 1);
        var w = (j / (nz - 1)) * C.TARJETA_ASPECTO;
        var h = alturaProcedural(u, w, ruido);
        alturas[j * nx + i] = h;
        if (h < min) { min = h; }
      }
    }
    for (var k = 0; k < alturas.length; k++) { alturas[k] -= min; }   // la altura mínima pasa a 0

    return {
      fuente: 'procedural',
      nx: nx, nz: nz,
      anchoM: anchoM, largoM: largoM,
      celdaX: anchoM / (nx - 1), celdaZ: largoM / (nz - 1),
      alturas: alturas,                                  // metros, sin exagerar
      arena: ARENA_UW.map(function (p) { return [p[0] * anchoM, p[1] * anchoM]; }),
      A: [C.PUNTO_A[0] * anchoM, C.PUNTO_A[1] * anchoM],
      B: [C.PUNTO_B[0] * anchoM, C.PUNTO_B[1] * anchoM]
    };
  }

  /* ---------- PUNTO DE ENTRADA DE LOS DATOS DEL TERRENO ---------- */
  // Devuelve (en una Promise) un objeto con: nx, nz, anchoM, largoM, celdaX, celdaZ,
  // alturas (Float32Array de nx*nz en metros), arena (polígono en metros), A y B (en metros).
  //
  // TODO(pipeline real): cuando tengamos datos reales de Jezero, sustituir el cuerpo por algo así:
  //   var meta = await (await fetch('assets/meta.json')).json();
  //   var buf  = await (await fetch('assets/terrain.bin')).arrayBuffer();
  //   var alturas = new Float32Array(buf);   // formato exacto: ver spec (secciones 4 y 5)
  //   return { fuente: 'dem', nx: meta.nx, nz: meta.nz, ..., alturas: alturas, arena: meta.arena };
  // El resto de la app NO necesita cambios: solo usa lo que devuelve esta función.
  MARTE.getHeightmap = function () {
    return Promise.resolve(generarProcedural());
  };

  /* ---------- Análisis: pendientes y clases de riesgo ---------- */
  // Clases: 0 = verde, 1 = ámbar, 2 = rojo (pendiente alta o arena)
  MARTE.analizarTerreno = function (hm) {
    var nx = hm.nx, nz = hm.nz, h = hm.alturas;
    var pendiente = new Float32Array(nx * nz);
    var clase = new Uint8Array(nx * nz);
    var enArena = new Uint8Array(nx * nz);

    for (var j = 0; j < nz; j++) {
      for (var i = 0; i < nx; i++) {
        var i0 = Math.max(i - 1, 0), i1 = Math.min(i + 1, nx - 1);
        var j0 = Math.max(j - 1, 0), j1 = Math.min(j + 1, nz - 1);
        // La pendiente usa las alturas REALES (sin la exageración x2).
        var dhdx = (h[j * nx + i1] - h[j * nx + i0]) / ((i1 - i0) * hm.celdaX);
        var dhdz = (h[j1 * nx + i] - h[j0 * nx + i]) / ((j1 - j0) * hm.celdaZ);
        var grados = Math.atan(Math.hypot(dhdx, dhdz)) * 180 / Math.PI;
        var k = j * nx + i;
        pendiente[k] = grados;
        enArena[k] = dentroPoligono(i * hm.celdaX, j * hm.celdaZ, hm.arena) ? 1 : 0;
        if (enArena[k] || grados > C.PENDIENTE_AMBAR_MAX) { clase[k] = 2; }
        else if (grados >= C.PENDIENTE_VERDE_MAX) { clase[k] = 1; }
        else { clase[k] = 0; }
      }
    }

    var T = {
      hm: hm, nx: nx, nz: nz, anchoM: hm.anchoM, largoM: hm.largoM,
      celdaX: hm.celdaX, celdaZ: hm.celdaZ,
      pendiente: pendiente, clase: clase, enArena: enArena,
      exag: C.EXAGERACION_RELIEVE
    };

    // Altura real (m) en cualquier punto, interpolando entre los 4 vértices cercanos.
    T.alturaEn = function (x, z) {
      var fi = Math.min(Math.max(x / T.celdaX, 0), nx - 1.001);
      var fj = Math.min(Math.max(z / T.celdaZ, 0), nz - 1.001);
      var i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j;
      var h00 = h[j * nx + i], h10 = h[j * nx + i + 1], h01 = h[(j + 1) * nx + i], h11 = h[(j + 1) * nx + i + 1];
      return (h00 * (1 - a) + h10 * a) * (1 - b) + (h01 * (1 - a) + h11 * a) * b;
    };
    // Altura tal como se dibuja (con relieve exagerado).
    T.alturaVisual = function (x, z) { return T.alturaEn(x, z) * T.exag; };

    // Normal de la superficie DIBUJADA, medida en una huella de 'radio' metros (para inclinar el rover).
    T.normalVisual = function (x, z, huella) {
      var e = huella / 2;
      var dhdx = (T.alturaVisual(x + e, z) - T.alturaVisual(x - e, z)) / (2 * e);
      var dhdz = (T.alturaVisual(x, z + e) - T.alturaVisual(x, z - e)) / (2 * e);
      var l = Math.sqrt(dhdx * dhdx + 1 + dhdz * dhdz);
      return [-dhdx / l, 1 / l, -dhdz / l];
    };

    // Metros (x, altura visual, z) -> unidades de ancla (1 unidad = ancho de la tarjeta, centrado).
    T.aUnidades = function (x, yMetros, z) {
      return [x / T.anchoM - 0.5, yMetros / T.anchoM, z / T.anchoM - (T.largoM / T.anchoM) / 2];
    };

    return T;
  };

  /* ---------- Colores: capa Marte (por defecto) y capa de riesgo ---------- */

  // Color de la línea de la ruta: cian, el "opuesto" del rojo-óxido del terreno (con borde oscuro).
  var RUTA_HEX = '#22e0ff';
  var MEZCLA_RIESGO = 0.9;      // cuánto pesa el color de riesgo sobre el marrón marciano (0..1)

  // Paleta marciana (tipo HiRISE en color): ocres, óxidos y basalto oscuro.
  var PALETA_MARTE = {
    ocre:    '#b48a5c',   // suelo de polvo anaranjado (zonas bajas)
    oxido:   '#96593a',   // óxido de hierro, más rojizo (media altura)
    pardo:   '#76574b',   // tierras altas, más oscuras y apagadas
    polvo:   '#d4b189',   // polvo claro color mantequilla (hondonadas)
    basalto: '#3a3234',   // roca basáltica expuesta (pendientes fuertes)
    arena:   '#2b2629'    // arena oscura del campo de dunas
  };

  // Color de cada clase de riesgo (0 verde, 1 ámbar, 2 rojo), mezclado un poco con el marrón marciano.
  // Luminosidad MUY distinta entre las tres (ámbar claro > verde medio > rojo oscuro): apto daltonismo.
  MARTE.colorClase = function (clase) {
    var THREE = AFRAME.THREE;
    var nombre = ['verde', 'ambar', 'rojo'][clase];
    return new THREE.Color(C.COLORES.base).lerp(new THREE.Color(C.COLORES[nombre]), MEZCLA_RIESGO);
  };

  // Contrato con la interfaz: colores que REALMENTE se usan (hex '#rrggbb').
  MARTE.COLORES = { ruta: RUTA_HEX, riesgo: [C.COLORES.verde, C.COLORES.ambar, C.COLORES.rojo] };
  try {
    MARTE.COLORES.riesgo = [0, 1, 2].map(function (c) { return '#' + MARTE.colorClase(c).getHexString(); });
  } catch (e) { /* sin THREE (p. ej. en pruebas): se quedan los colores de config.js */ }

  /* ---------- Malla 3D del terreno ---------- */
  // Dos juegos de colores por vértice, calculados UNA vez: "marte" (realista) y "riesgo" (semáforo).
  // El sombreado del relieve lo hacen las luces de la escena (ver mapa.js), no los colores.
  MARTE.crearMallaTerreno = function (T) {
    var THREE = AFRAME.THREE;
    var nx = T.nx, nz = T.nz, n = nx * nz, h = T.hm.alturas;
    var pos = new Float32Array(n * 3);
    var colMarte = new Float32Array(n * 3), colRiesgo = new Float32Array(n * 3);
    var rN = crearRuido(C.SEMILLA + 101);               // ruido propio para manchas de color

    // Paleta -> componentes lineales [r, g, b]
    var P = {};
    Object.keys(PALETA_MARTE).forEach(function (k) {
      var c = new THREE.Color(PALETA_MARTE[k]);
      P[k] = [c.r, c.g, c.b];
    });
    var cRiesgo = [0, 1, 2].map(function (c) { var q = MARTE.colorClase(c); return [q.r, q.g, q.b]; });

    var hmax = 1;
    for (var q = 0; q < n; q++) { if (h[q] > hmax) { hmax = h[q]; } }

    function alt(i, j) {                                  // altura con índices limitados al borde
      i = i < 0 ? 0 : (i > nx - 1 ? nx - 1 : i);
      j = j < 0 ? 0 : (j > nz - 1 ? nz - 1 : j);
      return h[j * nx + i];
    }
    function arena(i, j) {                                // 1 si esa celda es arena
      i = i < 0 ? 0 : (i > nx - 1 ? nx - 1 : i);
      j = j < 0 ? 0 : (j > nz - 1 ? nz - 1 : j);
      return T.enArena[j * nx + i];
    }
    function limitar(x, a, b) { return x < a ? a : (x > b ? b : x); }
    var col = [0, 0, 0];
    function poner(c) { col[0] = c[0]; col[1] = c[1]; col[2] = c[2]; }
    function mezclar(c, t) {                              // col = col*(1-t) + c*t
      col[0] += (c[0] - col[0]) * t; col[1] += (c[1] - col[1]) * t; col[2] += (c[2] - col[2]) * t;
    }
    function mezclar2(a, b, t) {                          // col = a*(1-t) + b*t
      col[0] = a[0] + (b[0] - a[0]) * t; col[1] = a[1] + (b[1] - a[1]) * t; col[2] = a[2] + (b[2] - a[2]) * t;
    }

    for (var j = 0; j < nz; j++) {
      for (var i = 0; i < nx; i++) {
        var k = j * nx + i;
        var p = T.aUnidades(i * T.celdaX, h[k] * T.exag, j * T.celdaZ);
        pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2];

        var u = i / (nx - 1), w = j * T.celdaZ / T.anchoM;
        var hn = h[k] / hmax;                             // altura relativa 0..1
        var pend = T.pendiente[k];                        // grados
        // Curvatura: positivo = hondonada (vecinos más altos), negativo = loma o cresta
        var lap = (alt(i - 2, j) + alt(i + 2, j) + alt(i, j - 2) + alt(i, j + 2)) / 4 - h[k];
        var n1 = fbm(rN, u * 6 + 3, w * 6 + 9, 3);        // manchas grandes
        var n2 = fbm(rN, u * 26 + 7, w * 26 + 1, 3);      // manchas pequeñas
        var n3 = rN(i * 1.9 + 13.1, j * 1.9 + 5.7);       // grano fino (por vértice)

        // 1) Color base según la altura: ocre abajo -> óxido -> pardo apagado arriba (+ variación)
        mezclar2(P.ocre, P.oxido, limitar(escalon(0.05, 0.5, hn) + 0.9 * n1, 0, 1));
        mezclar(P.pardo, 0.65 * escalon(0.55, 0.95, hn));

        // 2) Polvo claro: se acumula en hondonadas y en el llano
        var llano = 1 - escalon(5, 16, pend);
        mezclar(P.polvo, limitar((0.16 + 0.75 * limitar(lap / 7, 0, 1) + 0.35 * n2) * llano, 0, 0.8));

        // 3) Roca oscura: donde la pendiente es fuerte el polvo resbala y queda el basalto
        var conv = limitar(-lap / 7, 0, 1);               // lomas y crestas
        mezclar(P.basalto, 0.9 * limitar(escalon(10, 34, pend) * 1.05 + 0.35 * n2 + 0.3 * conv * escalon(6, 20, pend), 0, 1));

        // 4) Campo de dunas: arena oscura con borde suave y ondas más claras en las crestas
        var s = 0;
        for (var dj = -1; dj <= 1; dj++) { for (var di = -1; di <= 1; di++) { s += arena(i + di, j + dj); } }
        s /= 9;
        if (s > 0) {
          mezclar(P.arena, 0.92 * s);
          var onda = limitar(-lap / 3, -1, 1);
          var luzDuna = 1 + 0.22 * onda;
          col[0] = col[0] * (1 - s) + col[0] * luzDuna * s;
          col[1] = col[1] * (1 - s) + col[1] * luzDuna * s;
          col[2] = col[2] * (1 - s) + col[2] * luzDuna * s;
        }

        // 5) Variación de brillo (manchas + grano)
        var brillo = 1 + 0.2 * n2 + 0.06 * n3;
        colMarte[k * 3] = limitar(col[0] * brillo, 0, 1);
        colMarte[k * 3 + 1] = limitar(col[1] * brillo, 0, 1);
        colMarte[k * 3 + 2] = limitar(col[2] * brillo, 0, 1);

        // Capa de riesgo: color de la clase con una pizca de textura para no verse plana
        var cr = cRiesgo[T.clase[k]], tex = 1 + 0.08 * n2;
        colRiesgo[k * 3] = limitar(cr[0] * tex, 0, 1);
        colRiesgo[k * 3 + 1] = limitar(cr[1] * tex, 0, 1);
        colRiesgo[k * 3 + 2] = limitar(cr[2] * tex, 0, 1);
      }
    }

    var tri = [];
    for (var jj = 0; jj < nz - 1; jj++) {
      for (var ii = 0; ii < nx - 1; ii++) {
        var a = jj * nx + ii, b = a + 1, c2 = a + nx, d2 = c2 + 1;
        tri.push(a, c2, b, b, c2, d2);     // dos triángulos por celda (cara hacia arriba)
      }
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colMarte), 3));
    geo.setIndex(new THREE.BufferAttribute(n > 65535 ? new Uint32Array(tri) : new Uint16Array(tri), 1));
    geo.computeVertexNormals();            // normales suaves: las luces dan el sombreado del relieve
    geo.computeBoundingSphere();

    // Material con luz (estándar, mate): necesita las luces que se añaden en mapa.js
    var mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    var malla = new THREE.Mesh(geo, mat);
    malla.renderOrder = 0;
    malla.userData.colores = { marte: colMarte, riesgo: colRiesgo };

    capa.malla = malla;
    pintarCapa();                          // respeta una orden de capaRiesgo() dada antes de construir
    return malla;
  };

  /* ---------- Capa de riesgo: cambio Marte <-> semáforo con un fundido corto ---------- */
  var capa = { visible: false, t: 0, malla: null, raf: 0, ultimo: 0 };
  var DURACION_FUNDIDO_MS = 350;

  function pintarCapa() {
    var m = capa.malla;
    if (!m) { return; }
    var atr = m.geometry.getAttribute('color'), dst = atr.array;
    var a = m.userData.colores.marte, b = m.userData.colores.riesgo, t = capa.t;
    if (t <= 0) { dst.set(a); }
    else if (t >= 1) { dst.set(b); }
    else {
      var e = t * t * (3 - 2 * t);                        // suavizado
      for (var x = 0; x < dst.length; x++) { dst[x] = a[x] + (b[x] - a[x]) * e; }
    }
    atr.needsUpdate = true;
  }

  function pasoFundido(ahora) {
    var objetivo = capa.visible ? 1 : 0;
    var dt = capa.ultimo ? Math.min(ahora - capa.ultimo, 100) : 16;
    capa.ultimo = ahora;
    capa.t += (objetivo - capa.t > 0 ? 1 : -1) * dt / DURACION_FUNDIDO_MS;
    if ((objetivo === 1 && capa.t >= 1) || (objetivo === 0 && capa.t <= 0)) {
      capa.t = objetivo; capa.raf = 0; capa.ultimo = 0;
    } else {
      capa.raf = window.requestAnimationFrame(pasoFundido);
    }
    pintarCapa();
  }

  // visible = true -> mapa de riesgo (semáforo);  false -> colores de Marte (por defecto).
  MARTE.capaRiesgo = function (visible) {
    visible = !!visible;
    capa.visible = visible;
    if (MARTE.estado) { MARTE.estado.capaRiesgo = visible; }
    var objetivo = visible ? 1 : 0;
    if (capa.t !== objetivo) {
      if (!capa.malla || !window.requestAnimationFrame) { capa.t = objetivo; pintarCapa(); }
      else if (!capa.raf) { capa.ultimo = 0; capa.raf = window.requestAnimationFrame(pasoFundido); }
    }
    window.dispatchEvent(new CustomEvent('marte-capa-riesgo', { detail: { visible: visible } }));
  };

  /* Contorno del campo de dunas (línea blanca que flota sobre el terreno). */
  MARTE.crearContornoArena = function (T) {
    var THREE = AFRAME.THREE;
    var pts = [];
    var poli = T.hm.arena;
    for (var i = 0; i < poli.length; i++) {
      var a = poli[i], b = poli[(i + 1) % poli.length];
      for (var s = 0; s < 8; s++) {            // subdividimos para que siga el relieve
        var x = a[0] + (b[0] - a[0]) * s / 8, z = a[1] + (b[1] - a[1]) * s / 8;
        var p = T.aUnidades(x, T.alturaVisual(x, z), z);
        pts.push(new THREE.Vector3(p[0], p[1] + 0.002, p[2]));
      }
    }
    var geo = new THREE.BufferGeometry().setFromPoints(pts);
    var linea = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: 0xffffff }));
    linea.renderOrder = 1;
    return linea;
  };
})();
