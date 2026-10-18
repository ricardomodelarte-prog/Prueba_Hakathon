/* ============================================================
   ar-fallback.js - Comprobaciones ANTES de cargar A-Frame y MindAR.
   Si la AR no puede funcionar, mandamos al visor 3D con el motivo.
   (requiere config.js cargado antes)
   ============================================================ */
(function () {
  var ua = navigator.userAgent || '';
  var motivo = null;

  if (/FBAN|FBAV|Instagram|WhatsApp|Line|GSA/.test(ua)) {
    // Navegadores internos de apps (Facebook, Instagram, WhatsApp, Line, Google): la cámara suele fallar
    motivo = 'navegador-interno';
  } else if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    // Sin API de cámara: normalmente por no usar HTTPS, o navegador muy antiguo
    motivo = window.isSecureContext === false ? 'sin-https' : 'sin-camara';
  }

  if (motivo) { MARTE.irAlVisor(motivo); }
})();
