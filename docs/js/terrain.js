/* ============================================================
   terrain.js - Terreno: mapa de alturas, pendientes, riesgo y malla 3D.

   Flujo:  getHeightmap()  ->  analizarTerreno()  ->  crearMallaTerreno()
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

  /* ---------- Terreno procedural tipo Jezero ---------- */

  // Polígono del campo de dunas, en fracciones del ancho (u, w). Se etiqueta "arena (tipo Séítah)".
  var ARENA_UW = [[0.44, 0.34], [0.52, 0.30], [0.62, 0.36], [0.66, 0.46],
                  [0.60, 0.54], [0.49, 0.55], [0.42, 0.46]];

  // Crestas (ridges): [u1, w1, u2, w2, altura_m, anchura]
  var CRESTAS = [[0.43, -0.02, 0.49, 0.17, 26, 0.035],
                 [0.60, -0.02, 0.66, 0.16, 24, 0.035],
                 [0.52, 0.55, 0.58, 0.40, 18, 0.03]];

  // Altura (en metros) de un punto con coordenadas normalizadas u = x/ancho, w = z/ancho.
  function alturaProcedural(u, w, ruido) {
    var h = 0;

    // 1) BORDE DEL CRÁTER: arco a la izquierda. El suelo del cráter queda a la derecha.
    var CX = 0.91, CZ = 0.28, R = 0.73;          // centro y radio del cráter (fracciones del ancho)
    var BORDE = 95, MESETA = 55;                 // altura del borde y de la meseta exterior (m)
    var d = Math.hypot(u - CX, w - CZ) + 0.025 * ruido(u * 7 + 40, w * 7);
    if (d < R) {
      h += BORDE * escalon(R - 0.13, R, d);                 // pared interior (empinada)
    } else {
      h += BORDE - (BORDE - MESETA) * escalon(R, R + 0.16, d); // ladera exterior (suave)
    }

    // 2) DELTA: lóbulo elevado a la derecha, con una rampa suave por el oeste (la "entrada del río").
    var ex = (u - 0.78) / 0.19, ez = (w - 0.28) / 0.15;
    var ang = Math.atan2(ez, ex);
    var lobulos = 1 + 0.18 * Math.sin(3 * ang + 1) + 0.08 * Math.sin(7 * ang);
    var rr = Math.hypot(ex, ez) / lobulos;
    var dAng = Math.atan2(Math.sin(ang - Math.PI), Math.cos(ang - Math.PI)); // ángulo respecto al oeste
    var borde = 1.25 + 0.9 * Math.exp(-(dAng * dAng) / 0.35);               // borde más ancho al oeste
    h += 38 * escalon(borde, 0.7, rr);
    if (rr < 0.85) { h += 1.0 * Math.sin(u * 140 + 3 * ruido(u * 9, w * 9)); } // ondulaciones en la cima

    // 3) CRESTAS (ridges)
    for (var i = 0; i < CRESTAS.length; i++) {
      var c = CRESTAS[i];
      var dd = distSegmento(u, w, c[0], c[1], c[2], c[3]);
      h += c[4] * (0.75 + 0.25 * ruido(u * 14 + i * 9, w * 14)) * Math.exp(-(dd * dd) / (c[5] * c[5]));
    }

    // 4) RUIDO suave general (rugosidad de fondo)
    h += 11 * fbm(ruido, u * 5 + 11, w * 5 + 3, 3);
    h += 1.5 * ruido(u * 24 + 5, w * 24 + 7);

    // 5) DUNAS: ondulaciones solo dentro del polígono de arena
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

  /* ---------- Color de cada clase (mezclado sobre el color base marciano) ---------- */
  MARTE.colorClase = function (clase) {
    var THREE = AFRAME.THREE;
    var nombre = ['verde', 'ambar', 'rojo'][clase];
    return new THREE.Color(C.COLORES.base).lerp(new THREE.Color(C.COLORES[nombre]), C.MEZCLA_RIESGO);
  };

  /* ---------- Malla 3D del terreno ---------- */
  // Colores por vértice = color de riesgo + sombreado (hillshade) calculado aquí mismo,
  // así no dependemos de luces y se ve igual en AR y en el visor.
  MARTE.crearMallaTerreno = function (T) {
    var THREE = AFRAME.THREE;
    var nx = T.nx, nz = T.nz, n = nx * nz, h = T.hm.alturas;
    var pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    var colores = [MARTE.colorClase(0), MARTE.colorClase(1), MARTE.colorClase(2)];
    var luz = new THREE.Vector3(-0.55, 0.65, -0.52).normalize();   // sol desde el noroeste
    var nrm = new THREE.Vector3();

    for (var j = 0; j < nz; j++) {
      for (var i = 0; i < nx; i++) {
        var k = j * nx + i;
        var p = T.aUnidades(i * T.celdaX, h[k] * T.exag, j * T.celdaZ);
        pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2];

        // Sombreado según la inclinación local del relieve dibujado
        var i0 = Math.max(i - 1, 0), i1 = Math.min(i + 1, nx - 1);
        var j0 = Math.max(j - 1, 0), j1 = Math.min(j + 1, nz - 1);
        var dhdx = (h[j * nx + i1] - h[j * nx + i0]) * T.exag / ((i1 - i0) * T.celdaX);
        var dhdz = (h[j1 * nx + i] - h[j0 * nx + i]) * T.exag / ((j1 - j0) * T.celdaZ);
        nrm.set(-dhdx, 1, -dhdz).normalize();
        var sombra = 0.45 + 0.75 * Math.max(0, nrm.dot(luz));

        var c = colores[T.clase[k]];
        col[k * 3] = Math.min(c.r * sombra, 1);
        col[k * 3 + 1] = Math.min(c.g * sombra, 1);
        col[k * 3 + 2] = Math.min(c.b * sombra, 1);
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
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(n > 65535 ? new Uint32Array(tri) : new Uint16Array(tri), 1));
    geo.computeBoundingSphere();

    var mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    var malla = new THREE.Mesh(geo, mat);
    malla.renderOrder = 0;
    return malla;
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
