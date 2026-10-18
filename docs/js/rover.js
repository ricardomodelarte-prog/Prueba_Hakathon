/* ============================================================
   rover.js - Componente A-Frame "rover-marte".
   - Carga assets/rover.glb (o rover-lite.glb con ?lite=1). Si falla, deja un
     marcador sencillo de cajas y ruedas.
   - Recorre la ruta A <-> B sin parar (ida y vuelta).
   - Se inclina según la normal del terreno (suavizada en el tiempo).
   El modelo está en METROS; el componente lo escala a "unidades de ancla".
   ============================================================ */
(function () {
  var MARTE = window.MARTE;
  var C = MARTE.CONFIG;

  /* Marcador de cajas y ruedas (en metros, el frente del rover es +Z). */
  function crearMarcador() {
    var THREE = AFRAME.THREE;
    var g = new THREE.Group();
    function caja(ancho, alto, largo, color, x, y, z) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, largo),
                             new THREE.MeshLambertMaterial({ color: color }));
      m.position.set(x, y, z);
      g.add(m);
    }
    caja(1.8, 0.7, 2.6, 0xe8e8e8, 0, 0.95, 0);        // cuerpo
    caja(0.5, 0.4, 0.6, 0x777777, 0, 0.95, -1.55);     // generador (atrás)
    caja(0.12, 1.0, 0.12, 0xcccccc, 0.5, 1.8, 0.9);    // mástil
    caja(0.5, 0.25, 0.25, 0x333333, 0.5, 2.35, 0.9);   // cabeza del mástil
    caja(0.6, 0.2, 0.3, 0xff7a1a, 0, 0.95, 1.4);       // franja naranja = FRENTE
    for (var i = 0; i < 6; i++) {                       // 6 ruedas
      var lado = i % 2 === 0 ? -1 : 1;
      var rueda = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.2, 12),
                                 new THREE.MeshLambertMaterial({ color: 0x222222 }));
      rueda.rotation.z = Math.PI / 2;
      rueda.position.set(lado * 1.1, 0.26, -1.2 + Math.floor(i / 2) * 1.2);
      g.add(rueda);
    }
    return g;
  }

  AFRAME.registerComponent('rover-marte', {
    init: function () {
      var THREE = AFRAME.THREE, self = this;
      this.T = MARTE.mundo.terreno;
      this.R = MARTE.mundo.ruta;
      this.s = 0;            // metros recorridos sobre la ruta
      this.dir = 1;          // 1 = de A a B, -1 = de B a A
      this.pausa = 0;        // segundos de espera en los extremos
      this.escala = C.ROVER_ESCALA / this.T.anchoM;   // escala actual (se suaviza al cambiar)
      this.primera = true;
      this.quat = new THREE.Quaternion();
      this.quatObj = new THREE.Quaternion();
      this.m4 = new THREE.Matrix4();
      this.v1 = new THREE.Vector3(); this.v2 = new THREE.Vector3(); this.v3 = new THREE.Vector3();

      // Marcador inmediato; se quita cuando el modelo real termina de cargar.
      this.el.setObject3D('marcador', crearMarcador());

      // Modelo real (glTF). 'gltf-model' ya viene incluido en A-Frame.
      this.modelo = document.createElement('a-entity');
      this.modelo.setAttribute('rotation', '0 ' + C.ROVER_GIRO_MODELO_GRADOS + ' 0');
      this.modelo.addEventListener('model-loaded', function () { self.alCargarModelo(); });
      this.modelo.addEventListener('model-error', function () {
        console.warn('No se pudo cargar el rover; se queda el marcador de cajas.');
      });
      this.el.appendChild(this.modelo);
      this.modelo.setAttribute('gltf-model', 'url(' + (MARTE.params.lite ? C.ROVER_URL_LITE : C.ROVER_URL) + ')');
    },

    alCargarModelo: function () {
      this.el.removeObject3D('marcador');
      var obj = this.modelo.getObject3D('mesh');
      if (!obj) { return; }
      obj.traverse(function (o) {
        if (!o.isMesh) { return; }
        o.renderOrder = 3;            // el rover se dibuja encima de la línea de ruta
        o.frustumCulled = false;
        var mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(function (m) {
          // Sin mapa de entorno, los metales puros se ven negros: los suavizamos un poco.
          if (m && m.metalness > 0.4) { m.metalness = 0.4; }
        });
      });
    },

    tick: function (tiempo, dtMs) {
      var T = this.T, R = this.R;
      var dt = Math.min(dtMs, 100) / 1000;   // segundos (con tope por si la pestaña estuvo parada)
      if (!dt) { return; }

      // 1) Avanzar por la ruta (con pausa al llegar a cada extremo y vuelta atrás)
      if (this.pausa > 0) {
        this.pausa -= dt;
      } else {
        this.s += this.dir * C.ROVER_VELOCIDAD_M_S * dt;
        if (this.s >= R.largo) { this.s = R.largo; this.dir = -1; this.pausa = C.ROVER_PAUSA_S; }
        else if (this.s <= 0) { this.s = 0; this.dir = 1; this.pausa = C.ROVER_PAUSA_S; }
      }

      // 2) Posición y rumbo (el rumbo se mide mirando un poco hacia delante y hacia atrás)
      var p = MARTE.muestrearRuta(R, this.s);
      var a = MARTE.muestrearRuta(R, this.s - 6), b = MARTE.muestrearRuta(R, this.s + 6);
      var tx = (b[0] - a[0]) * this.dir, tz = (b[1] - a[1]) * this.dir;
      if (tx === 0 && tz === 0) { tx = 1; }

      // 3) Altura y normal del terreno dibujado (huella de ~15 m)
      var n = T.normalVisual(p[0], p[1], C.HUELLA_INCLINACION_M);

      // 4) Orientación objetivo: "arriba" = normal, "frente" = rumbo proyectado sobre el suelo.
      var arriba = this.v1.set(n[0], n[1], n[2]);
      var frente = this.v2.set(tx, 0, tz).normalize();
      var derecha = this.v3.crossVectors(arriba, frente).normalize();
      frente.crossVectors(derecha, arriba).normalize();
      this.m4.makeBasis(derecha, arriba, frente);
      this.quatObj.setFromRotationMatrix(this.m4);
      if (this.primera) { this.quat.copy(this.quatObj); }
      else { this.quat.slerp(this.quatObj, 1 - Math.exp(-C.SUAVIZADO_INCLINACION * dt)); }

      // 5) Escala (ampliada x18 o real x1), con transición suave
      var objetivo = (MARTE.estado.escalaReal ? 1 : C.ROVER_ESCALA) / T.anchoM;
      this.escala = this.primera ? objetivo : this.escala + (objetivo - this.escala) * (1 - Math.exp(-8 * dt));

      // 6) Colocar. Se eleva un poco (proporcional a la escala) para que la ruta siga visible.
      var elevacion = C.ROVER_ELEVACION * (this.escala * T.anchoM / C.ROVER_ESCALA);
      var u = T.aUnidades(p[0], T.alturaVisual(p[0], p[1]), p[1]);
      var o3 = this.el.object3D;
      o3.position.set(u[0], u[1] + elevacion, u[2]);
      o3.quaternion.copy(this.quat);
      o3.scale.setScalar(this.escala);
      this.primera = false;
    }
  });
})();
