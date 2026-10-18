/* ============================================================
   mapa.js - Componente A-Frame "marte-mapa".
   Construye TODO el contenido (terreno, ruta, etiquetas y rover).
   Se usa igual en ar.html y viewer.html: solo cambia dónde está colgado
   (en AR sigue a la tarjeta; en el visor está quieto sobre el "suelo").
   ============================================================ */
(function () {
  var MARTE = window.MARTE;
  var C = MARTE.CONFIG;

  /* Etiqueta de texto como sprite (se dibuja en un canvas: no necesita fuentes ni internet). */
  function crearEtiqueta(texto, alto) {
    var THREE = AFRAME.THREE;
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var fuente = 'bold 40px sans-serif';
    ctx.font = fuente;
    var ancho = Math.ceil(ctx.measureText(texto).width) + 28, altoPx = 60;
    canvas.width = ancho; canvas.height = altoPx;      // al cambiar el tamaño se borra el contexto
    ctx.font = fuente;
    ctx.fillStyle = 'rgba(20,14,12,0.75)';
    ctx.fillRect(0, 0, ancho, altoPx);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, 14, altoPx / 2 + 2);
    var tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sprite.scale.set(alto * ancho / altoPx, alto, 1);
    sprite.renderOrder = 6;
    return sprite;
  }

  /* Rectángulo fino que marca el borde de la tarjeta (el "cuadro" del mapa). */
  function crearMarco(T) {
    var THREE = AFRAME.THREE;
    var mx = 0.5, mz = (T.largoM / T.anchoM) / 2;
    var pts = [new THREE.Vector3(-mx, 0, -mz), new THREE.Vector3(mx, 0, -mz),
               new THREE.Vector3(mx, 0, mz), new THREE.Vector3(-mx, 0, mz)];
    return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),
                              new THREE.LineBasicMaterial({ color: 0xffffff }));
  }

  AFRAME.registerComponent('marte-mapa', {
    init: function () {
      var self = this;
      // Este grupo gira 90° en X: el "arriba" del mapa (Y) pasa a apuntar fuera de la tarjeta
      // (el eje Z del ancla de MindAR). Así el terreno queda "tumbado" sobre la tarjeta.
      this.grupo = document.createElement('a-entity');
      this.grupo.setAttribute('rotation', '90 0 0');
      this.el.appendChild(this.grupo);

      MARTE.getHeightmap().then(function (hm) {
        self.construir(hm);
      }).catch(function (err) {
        console.error('Error creando el mapa', err);
        window.dispatchEvent(new CustomEvent('marte-error', { detail: err }));
      });
    },

    construir: function (hm) {
      var g = this.grupo;
      var T = MARTE.analizarTerreno(hm);      // pendientes y clases de riesgo
      var R = MARTE.calcularRuta(T);          // A* de A a B
      MARTE.mundo = { terreno: T, ruta: R };  // el rover lee esto

      g.setObject3D('terreno', MARTE.crearMallaTerreno(T));
      g.setObject3D('arena', MARTE.crearContornoArena(T));
      g.setObject3D('ruta', MARTE.crearLineaRuta(T, R));
      g.setObject3D('marco', crearMarco(T));

      // Etiquetas: [texto, x en metros, z en metros, altura sobre el terreno en unidades]
      var poli = hm.arena, cx = 0, cz = 0;
      poli.forEach(function (p) { cx += p[0] / poli.length; cz += p[1] / poli.length; });
      var etiquetas = [
        [MARTE.t('etiquetaArena'), cx, cz + 0.05 * T.anchoM, 0.03],
        [MARTE.t('etiquetaA'), hm.A[0], hm.A[1], 0.075],
        [MARTE.t('etiquetaB'), hm.B[0], hm.B[1], 0.075],
        [MARTE.t('etiquetaBorde'), 0.19 * T.anchoM, 0.10 * T.anchoM, 0.04],
        [MARTE.t('etiquetaDelta'), 0.90 * T.anchoM, 0.40 * T.anchoM, 0.04]
      ];
      etiquetas.forEach(function (e, i) {
        var s = crearEtiqueta(e[0], 0.04);
        var p = T.aUnidades(e[1], T.alturaVisual(e[1], e[2]), e[2]);
        s.position.set(p[0], p[1] + e[3], p[2]);
        g.setObject3D('etiqueta' + i, s);
      });

      // El rover (su componente lee MARTE.mundo al arrancar)
      var rover = document.createElement('a-entity');
      rover.setAttribute('rover-marte', '');
      g.appendChild(rover);

      window.dispatchEvent(new CustomEvent('marte-listo', { detail: MARTE.mundo }));
    }
  });
})();
