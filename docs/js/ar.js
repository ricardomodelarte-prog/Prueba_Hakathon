/* ============================================================
   ar.js - Lógica de la página de AR (ar.html).
   - Componente "seguir-ancla": copia la pose de la tarjeta al contenido y lo mantiene
     visible 3 s tras perder la tarjeta.
   - Fallbacks: si MindAR o la cámara fallan, redirige al visor 3D.
   - Si en ~10 s no ve la tarjeta, muestra consejos.
   ============================================================ */
(function () {
  var MARTE = window.MARTE;
  var C = MARTE.CONFIG;

  /* El contenido NO cuelga de la entidad de MindAR (esa se oculta nada más perder la tarjeta);
     está aparte y, en cada frame, copiamos la pose de la tarjeta mientras se ve. */
  AFRAME.registerComponent('seguir-ancla', {
    schema: { ancla: { type: 'selector' } },

    init: function () {
      var self = this;
      this.perdidoEn = null;          // momento en que se perdió la tarjeta
      this.visto = false;             // ¿se ha visto alguna vez?
      this.el.object3D.visible = false;
      this.data.ancla.addEventListener('targetFound', function () {
        self.visto = true; self.perdidoEn = null;
      });
      this.data.ancla.addEventListener('targetLost', function () {
        self.perdidoEn = performance.now();
      });
    },

    tick: function () {
      var ancla = this.data.ancla.object3D, o = this.el.object3D;
      if (ancla.visible) {
        // Tarjeta a la vista: copiamos su posición, rotación y escala
        ancla.matrix.decompose(o.position, o.quaternion, o.scale);
        o.visible = this.visto;
      } else if (this.visto && this.perdidoEn !== null &&
                 performance.now() - this.perdidoEn > C.MS_CONTENIDO_TRAS_PERDER) {
        o.visible = false;            // tras ~3 s sin tarjeta, ocultamos (hasta entonces queda en su última pose)
      }
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    MARTE.traducirPagina();
    MARTE.iniciarUI();

    var escena = document.querySelector('a-scene');
    var ancla = document.getElementById('ancla');
    var aviso = document.getElementById('ar-aviso');
    var consejos = document.getElementById('ar-consejos');
    var temporizador = null;
    var listo = false;

    // Lista de consejos desde TEXTOS
    var lista = document.getElementById('ar-lista');
    MARTE.t('consejos').forEach(function (c) {
      var li = document.createElement('li'); li.textContent = c; lista.appendChild(li);
    });
    var cerrar = document.getElementById('ar-cerrar');
    cerrar.setAttribute('aria-label', MARTE.t('cerrarConsejos'));
    cerrar.title = MARTE.t('cerrarConsejos');
    cerrar.addEventListener('click', function () { consejos.style.display = 'none'; });
    document.getElementById('ar-enlace-visor').href = MARTE.conParams('viewer.html');
    document.getElementById('ar-enlace-tarjeta').href = 'assets/target/card.png';

    // --- Errores: MindAR avisa con 'arError' (p. ej. cámara denegada) ---
    escena.addEventListener('arError', function (e) {
      var motivo = e.detail && e.detail.error === 'VIDEO_FAIL' ? 'camara' : 'error-mindar';
      MARTE.irAlVisor(motivo);
    });
    // Errores sueltos de MindAR antes de arrancar
    window.addEventListener('error', function (e) {
      if (!listo && e.filename && /mindar/i.test(e.filename)) { MARTE.irAlVisor('error-mindar'); }
    });
    window.addEventListener('unhandledrejection', function () {
      if (!listo) { MARTE.irAlVisor('error-mindar'); }
    });

    // --- MindAR listo: pedimos apuntar a la tarjeta y empezamos a contar 10 s ---
    escena.addEventListener('arReady', function () {
      listo = true;
      aviso.style.display = 'flex';        // el marco guía y el texto van en columna
      temporizador = setTimeout(function () {
        aviso.style.display = 'none';
        consejos.style.display = 'block';
      }, C.SEGUNDOS_BUSCANDO * 1000);
    });

    // --- Tarjeta encontrada: ocultamos mensajes ---
    ancla.addEventListener('targetFound', function () {
      clearTimeout(temporizador);
      aviso.style.display = 'none';
      consejos.style.display = 'none';
    });
  });
})();
