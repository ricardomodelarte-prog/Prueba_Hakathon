/* ============================================================
   orbit.js - Controles propios para el visor 3D (sin librerías externas).
   - Un dedo / ratón: girar alrededor del mapa
   - Pellizco (dos dedos) o rueda del ratón: acercar / alejar
   - Dos dedos moviéndose juntos: desplazar el mapa
   Se pone en la entidad de la cámara:  <a-entity camera orbita-simple>
   ============================================================ */
AFRAME.registerComponent('orbita-simple', {
  schema: {
    distancia: { default: 0 },         // distancia a la cámara (1 = ancho del mapa). 0 = automática según la pantalla
    azimut: { default: 15 },           // giro horizontal en grados
    elevacion: { default: 42 },        // ángulo sobre el suelo en grados
    minDistancia: { default: 0.3 },
    maxDistancia: { default: 4 }
  },

  init: function () {
    var THREE = AFRAME.THREE, self = this;
    this.objetivo = new THREE.Vector3(0, 0.03, 0);   // punto que mira la cámara
    this.objetivoDest = this.objetivo.clone();
    this.punteros = {};          // dedos/ratón activos: id -> {x, y}
    this.reiniciar();
    this.tmp = new THREE.Vector3();

    function conectar() {
      var c = self.canvas = self.el.sceneEl.canvas;
      c.addEventListener('pointerdown', function (e) { self.alBajar(e); });
      c.addEventListener('pointermove', function (e) { self.alMover(e); });
      c.addEventListener('pointerup', function (e) { self.alSubir(e); });
      c.addEventListener('pointercancel', function (e) { self.alSubir(e); });
      c.addEventListener('wheel', function (e) {
        e.preventDefault();
        self.distDest = self.limitar(self.distDest * (e.deltaY > 0 ? 1.1 : 0.9));
      }, { passive: false });
    }
    window.addEventListener('resize', function () {
      if (!self.tocado) { self.distDest = self.dist = self.distanciaAuto(); }   // al girar el móvil, reencuadra
    });
    if (this.el.sceneEl.canvas) { conectar(); }
    else { this.el.sceneEl.addEventListener('render-target-loaded', conectar); }
  },

  // Vuelve a la vista inicial (botón "Reiniciar vista").
  reiniciar: function () {
    this.az = this.azDest = this.data.azimut;
    this.el_ = this.elDest = this.data.elevacion;
    this.dist = this.distDest = this.data.distancia || this.distanciaAuto();
    this.objetivoDest.set(0, 0.03, 0);
  },

  // Distancia para que el mapa (1 de ancho) quepa en pantalla, tanto en vertical como en horizontal.
  distanciaAuto: function () {
    var aspecto = window.innerWidth / window.innerHeight;
    var tanMedio = Math.tan(27.5 * Math.PI / 180);       // la cámara tiene fov 55 (vertical)
    var d = 0.7 / (tanMedio * Math.min(aspecto, 1.8));
    return Math.min(3.2, Math.max(0.9, d));
  },

  limitar: function (d) { return Math.min(this.data.maxDistancia, Math.max(this.data.minDistancia, d)); },

  alBajar: function (e) {
    this.tocado = true;
    this.canvas.setPointerCapture(e.pointerId);
    this.punteros[e.pointerId] = { x: e.clientX, y: e.clientY };
  },

  alSubir: function (e) { delete this.punteros[e.pointerId]; },

  alMover: function (e) {
    var p = this.punteros[e.pointerId];
    if (!p) { return; }
    var ids = Object.keys(this.punteros);
    var dx = e.clientX - p.x, dy = e.clientY - p.y;

    if (ids.length === 1) {
      // Un dedo: girar
      this.azDest -= dx * 0.4;
      this.elDest = Math.min(85, Math.max(8, this.elDest + dy * 0.4));
    } else if (ids.length === 2) {
      // Dos dedos: pellizco (zoom) + desplazar
      var otro = this.punteros[ids[0] === String(e.pointerId) ? ids[1] : ids[0]];
      var antes = Math.hypot(p.x - otro.x, p.y - otro.y);
      var ahora = Math.hypot(e.clientX - otro.x, e.clientY - otro.y);
      if (antes > 0 && ahora > 0) { this.distDest = this.limitar(this.distDest * antes / ahora); }
      var k = this.dist * 0.0015, a = this.az * Math.PI / 180;
      // Cada dedo genera sus propios eventos: por eso usamos la mitad del movimiento (0.5).
      this.objetivoDest.x += (-Math.cos(a) * dx - Math.sin(a) * dy) * k * 0.5;
      this.objetivoDest.z += (Math.sin(a) * dx - Math.cos(a) * dy) * k * 0.5;
      this.objetivoDest.x = Math.min(0.6, Math.max(-0.6, this.objetivoDest.x));
      this.objetivoDest.z = Math.min(0.6, Math.max(-0.6, this.objetivoDest.z));
    }
    p.x = e.clientX; p.y = e.clientY;
  },

  tick: function (t, dtMs) {
    // Suavizado: la cámara "persigue" los valores deseados
    var k = 1 - Math.exp(-(dtMs || 16) / 1000 * 14);
    this.az += (this.azDest - this.az) * k;
    this.el_ += (this.elDest - this.el_) * k;
    this.dist += (this.distDest - this.dist) * k;
    this.objetivo.lerp(this.objetivoDest, k);

    var az = this.az * Math.PI / 180, el = this.el_ * Math.PI / 180;
    var o = this.el.object3D;
    o.position.set(
      this.objetivo.x + this.dist * Math.cos(el) * Math.sin(az),
      this.objetivo.y + this.dist * Math.sin(el),
      this.objetivo.z + this.dist * Math.cos(el) * Math.cos(az));
    // Un Object3D normal apunta con su eje +Z, pero la cámara mira hacia -Z.
    // Truco: miramos al punto simétrico (al otro lado de la cámara).
    this.tmp.copy(o.position).multiplyScalar(2).sub(this.objetivo);
    o.lookAt(this.tmp);
  }
});
