/* ============================================================
   viewer.js - Lógica de la página del visor 3D (viewer.html).
   - Aviso cuando venimos de un fallback de AR (?fallback=motivo)
   - Botón "Mostrar tarjeta" para apuntar un móvil a la pantalla
   - Botón "Reiniciar vista"
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {
  var MARTE = window.MARTE;
  MARTE.traducirPagina();
  MARTE.iniciarUI();

  var enlaceAR = new URL(MARTE.conParams('ar.html'), window.location.href).href;
  document.getElementById('v-ar').href = MARTE.conParams('ar.html');

  // --- Aviso de fallback ---
  var motivo = MARTE.params.fallback;
  if (motivo) {
    var textos = MARTE.t('fallback');
    document.getElementById('fb-motivo').textContent = textos[motivo] || textos.otro;
    document.getElementById('fb-url').value = enlaceAR;
    document.getElementById('fb-aviso').style.display = 'block';
    document.getElementById('fb-copiar').addEventListener('click', function () {
      var campo = document.getElementById('fb-url');
      campo.select();
      try {
        if (navigator.clipboard) { navigator.clipboard.writeText(enlaceAR); }
        else { document.execCommand('copy'); }
        this.textContent = MARTE.t('copiado');
      } catch (e) { /* si falla, el usuario puede copiar el texto seleccionado */ }
    });
    document.getElementById('fb-cerrar').addEventListener('click', function () {
      document.getElementById('fb-aviso').style.display = 'none';
    });
  }

  // --- Tarjeta a pantalla completa (para que otro móvil la apunte con la cámara) ---
  var tarjeta = document.getElementById('v-tarjeta');
  document.getElementById('v-mostrar').addEventListener('click', function () { tarjeta.style.display = 'flex'; });
  document.getElementById('v-cerrar-tarjeta').addEventListener('click', function () { tarjeta.style.display = 'none'; });

  // --- Reiniciar vista ---
  document.getElementById('v-reiniciar').addEventListener('click', function () {
    var cam = document.getElementById('camara');
    cam.components['orbita-simple'].reiniciar();
  });

  // La ayuda de gestos desaparece sola a los 8 segundos
  setTimeout(function () { document.getElementById('v-ayuda').style.opacity = '0'; }, 8000);
});
