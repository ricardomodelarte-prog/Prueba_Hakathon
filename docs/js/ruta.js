/* ============================================================
   ruta.js - Ruta A -> B con A* sobre la malla (8 vecinos).
   Rojo = intransitable, ámbar = caro. Si no hay camino, se reintenta
   permitiendo rojo a un coste altísimo y se avisa al usuario.
   ============================================================ */
(function () {
  var MARTE = window.MARTE;
  var C = MARTE.CONFIG;

  /* Cola de prioridad (montículo binario): saca siempre el nodo con menor 'f'. */
  function Monton() { this.claves = []; this.valores = []; }
  Monton.prototype.vacio = function () { return this.valores.length === 0; };
  Monton.prototype.meter = function (clave, valor) {
    var k = this.claves, v = this.valores, i = k.length;
    k.push(clave); v.push(valor);
    while (i > 0) {
      var p = (i - 1) >> 1;
      if (k[p] <= k[i]) { break; }
      var tk = k[p]; k[p] = k[i]; k[i] = tk;
      var tv = v[p]; v[p] = v[i]; v[i] = tv;
      i = p;
    }
  };
  Monton.prototype.sacar = function () {
    var k = this.claves, v = this.valores, res = v[0];
    var ultimoK = k.pop(), ultimoV = v.pop();
    if (k.length > 0) {
      k[0] = ultimoK; v[0] = ultimoV;
      var i = 0, n = k.length;
      for (;;) {
        var l = 2 * i + 1, r = l + 1, m = i;
        if (l < n && k[l] < k[m]) { m = l; }
        if (r < n && k[r] < k[m]) { m = r; }
        if (m === i) { break; }
        var tk = k[m]; k[m] = k[i]; k[i] = tk;
        var tv = v[m]; v[m] = v[i]; v[i] = tv;
        i = m;
      }
    }
    return res;
  };

  /* A* sobre la malla. Devuelve lista de índices de nodo o null si no hay camino. */
  function buscar(T, costeRojo) {
    var nx = T.nx, nz = T.nz, n = nx * nz, alt = T.hm.alturas;

    // Factor de coste por nodo según su clase (verde 1, ámbar caro, rojo imposible o carísimo)
    var factor = new Float32Array(n);
    var k, i, j;
    for (k = 0; k < n; k++) {
      factor[k] = T.clase[k] === 0 ? 1 : (T.clase[k] === 1 ? C.COSTE_AMBAR : costeRojo);
    }
    // Margen de seguridad: los nodos pegados a una zona roja cuestan un poco más
    var extra = new Float32Array(n);
    for (j = 0; j < nz; j++) {
      for (i = 0; i < nx; i++) {
        if (T.clase[j * nx + i] !== 2) { continue; }
        for (var dj = -1; dj <= 1; dj++) {
          for (var di = -1; di <= 1; di++) {
            var vi = i + di, vj = j + dj;
            if (vi >= 0 && vj >= 0 && vi < nx && vj < nz) { extra[vj * nx + vi] = 1.5; }
          }
        }
      }
    }
    for (k = 0; k < n; k++) { if (T.clase[k] !== 2) { factor[k] += extra[k]; } }

    // Nodos de inicio y fin (el nodo más cercano a A y B; siempre transitables)
    var si = Math.round(T.hm.A[0] / T.celdaX), sj = Math.round(T.hm.A[1] / T.celdaZ);
    var gi = Math.round(T.hm.B[0] / T.celdaX), gj = Math.round(T.hm.B[1] / T.celdaZ);
    var inicio = sj * nx + si, meta = gj * nx + gi;
    factor[inicio] = 1; factor[meta] = 1;

    var g = new Float32Array(n).fill(Infinity);
    var padre = new Int32Array(n).fill(-1);
    var cerrado = new Uint8Array(n);
    var monton = new Monton();
    g[inicio] = 0;
    monton.meter(0, inicio);

    while (!monton.vacio()) {
      var u = monton.sacar();
      if (cerrado[u]) { continue; }
      cerrado[u] = 1;
      if (u === meta) { break; }
      var ui = u % nx, uj = (u / nx) | 0;
      for (var dj2 = -1; dj2 <= 1; dj2++) {
        for (var di2 = -1; di2 <= 1; di2++) {
          if (di2 === 0 && dj2 === 0) { continue; }
          var vi2 = ui + di2, vj2 = uj + dj2;
          if (vi2 < 0 || vj2 < 0 || vi2 >= nx || vj2 >= nz) { continue; }
          var v = vj2 * nx + vi2;
          if (cerrado[v] || factor[v] === Infinity) { continue; }
          // En diagonal no se "corta" una esquina roja imposible
          if (di2 !== 0 && dj2 !== 0 &&
              (factor[uj * nx + vi2] === Infinity || factor[vj2 * nx + ui] === Infinity)) { continue; }
          // Distancia 3D real del paso (incluye el desnivel)
          var dist = Math.hypot(di2 * T.celdaX, dj2 * T.celdaZ, alt[v] - alt[u]);
          var nuevo = g[u] + dist * factor[v];
          if (nuevo < g[v]) {
            g[v] = nuevo;
            padre[v] = u;
            // Heurística: distancia en línea recta (nunca sobreestima, porque el coste mínimo es 1)
            var h = Math.hypot((vi2 - gi) * T.celdaX, (vj2 - gj) * T.celdaZ);
            monton.meter(nuevo + h, v);
          }
        }
      }
    }
    if (g[meta] === Infinity) { return null; }
    var camino = [];
    for (var c = meta; c !== -1; c = padre[c]) { camino.push(c); }
    return camino.reverse();
  }

  /* Suaviza esquinas (algoritmo de Chaikin) para que el rover no gire en ángulos bruscos. */
  function suavizar(p, veces) {
    for (var r = 0; r < veces; r++) {
      var q = [p[0]];
      for (var i = 0; i < p.length - 1; i++) {
        var a = p[i], b = p[i + 1];
        q.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
        q.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
      }
      q.push(p[p.length - 1]);
      p = q;
    }
    return p;
  }

  /* Calcula la ruta. Devuelve { puntos:[[x,z]...] (m), acum:[...] (m acumulados), largo, aviso } */
  MARTE.calcularRuta = function (T) {
    var aviso = false;
    var nodos = buscar(T, Infinity);                 // 1er intento: rojo prohibido
    if (!nodos) {
      aviso = true;                                  // 2º intento: rojo permitido pero carísimo
      nodos = buscar(T, C.COSTE_ROJO_REINTENTO);
    }
    var pts;
    if (nodos) {
      pts = nodos.map(function (k) { return [(k % T.nx) * T.celdaX, ((k / T.nx) | 0) * T.celdaZ]; });
      pts = suavizar(pts, 2);
    } else {
      aviso = true;                                  // último recurso: línea recta A -> B
      pts = [T.hm.A, T.hm.B];
    }
    var acum = [0];
    for (var i = 1; i < pts.length; i++) {
      acum.push(acum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    return { puntos: pts, acum: acum, largo: acum[acum.length - 1], aviso: aviso };
  };

  /* Punto de la ruta a 's' metros del inicio (se limita a los extremos). Devuelve [x, z]. */
  MARTE.muestrearRuta = function (R, s) {
    s = Math.max(0, Math.min(R.largo, s));
    var lo = 0, hi = R.acum.length - 1;
    while (hi - lo > 1) {                            // búsqueda binaria
      var mid = (lo + hi) >> 1;
      if (R.acum[mid] <= s) { lo = mid; } else { hi = mid; }
    }
    var seg = R.acum[hi] - R.acum[lo];
    var t = seg > 0 ? (s - R.acum[lo]) / seg : 0;
    return [R.puntos[lo][0] + (R.puntos[hi][0] - R.puntos[lo][0]) * t,
            R.puntos[lo][1] + (R.puntos[hi][1] - R.puntos[lo][1]) * t];
  };

  /* Dibuja la ruta: tubo blanco con borde oscuro, siempre visible (no lo tapa el relieve). */
  MARTE.crearLineaRuta = function (T, R) {
    var THREE = AFRAME.THREE;
    var grupo = new THREE.Group();
    var pts = R.puntos.map(function (p) {
      var u = T.aUnidades(p[0], T.alturaVisual(p[0], p[1]), p[1]);
      return new THREE.Vector3(u[0], u[1] + C.ELEVACION_RUTA, u[2]);
    });
    var curva = new THREE.CatmullRomCurve3(pts);
    var tramos = Math.min(pts.length * 2, 800);

    function tubo(radio, color, orden) {
      var geo = new THREE.TubeGeometry(curva, tramos, radio, 5, false);
      var mat = new THREE.MeshBasicMaterial({ color: color, depthTest: false, depthWrite: false });
      var m = new THREE.Mesh(geo, mat);
      m.renderOrder = orden;
      m.frustumCulled = false;
      return m;
    }
    grupo.add(tubo(C.RADIO_RUTA * 1.8, 0x1a1a1a, 2));   // borde oscuro (contraste sobre ámbar)
    grupo.add(tubo(C.RADIO_RUTA, 0xffffff, 3));          // línea blanca

    // Marcadores de inicio (A) y fin (B)
    [pts[0], pts[pts.length - 1]].forEach(function (p) {
      var geo = new THREE.SphereGeometry(C.RADIO_RUTA * 3, 12, 8);
      var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false }));
      m.position.copy(p);
      m.renderOrder = 4;
      grupo.add(m);
    });
    return grupo;
  };
})();
