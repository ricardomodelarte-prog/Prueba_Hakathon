/* ============================================================
   ui.js - Interfaz superpuesta: nota de escalas, leyenda, botón "Escala real",
   aviso de ruta y contador de FPS (?debug=1).
   Se crea con JS para que todos los textos salgan de MARTE.TEXTOS.
   ============================================================ */
(function () {
  var MARTE = window.MARTE;
  var C = MARTE.CONFIG;

  function el(tag, id, clase, texto) {
    var e = document.createElement(tag);
    if (id) { e.id = id; }
    if (clase) { e.className = clase; }
    if (texto) { e.textContent = texto; }
    return e;
  }

  MARTE.iniciarUI = function () {
    var datos = { rover: C.ROVER_ESCALA, relieve: C.EXAGERACION_RELIEVE,
                  v: C.PENDIENTE_VERDE_MAX, a: C.PENDIENTE_AMBAR_MAX };
    var raiz = el('div', 'marte-ui');
    document.body.appendChild(raiz);

    // Nota fija: "Rover ampliado ×18 · Relieve ×2"
    var nota = el('div', 'marte-nota', 'panel');
    var notaTexto = el('span');
    nota.appendChild(notaTexto);
    raiz.appendChild(nota);

    // Botón de escala real
    var boton = el('button', 'marte-escala', 'boton');
    raiz.appendChild(boton);
    function actualizarEscala() {
      var real = MARTE.estado.escalaReal;
      notaTexto.textContent = MARTE.t(real ? 'notaReal' : 'nota', datos);
      boton.textContent = MARTE.t(real ? 'botonEscalaAmpliada' : 'botonEscalaReal', datos);
    }
    boton.addEventListener('click', function () {
      MARTE.estado.escalaReal = !MARTE.estado.escalaReal;
      actualizarEscala();
    });
    actualizarEscala();

    // Leyenda de colores
    var leyenda = el('div', 'marte-leyenda', 'panel');
    leyenda.appendChild(el('strong', null, null, MARTE.t('leyendaTitulo')));
    var filas = [['leyendaVerde', 0], ['leyendaAmbar', 1], ['leyendaRojo', 2], ['leyendaRuta', -1]];
    filas.forEach(function (f) {
      var fila = el('div', null, 'fila');
      var muestra = el('span', null, f[1] < 0 ? 'muestra ruta' : 'muestra');
      if (f[1] >= 0) { muestra.style.background = '#' + MARTE.colorClase(f[1]).getHexString(); }
      fila.appendChild(muestra);
      fila.appendChild(document.createTextNode(MARTE.t(f[0], datos)));
      leyenda.appendChild(fila);
    });
    raiz.appendChild(leyenda);

    // Mensajes: cargando / aviso de ruta / error
    var estado = el('div', 'marte-estado', 'panel', MARTE.t('cargando'));
    raiz.appendChild(estado);
    window.addEventListener('marte-listo', function (e) {
      if (e.detail.ruta.aviso) { estado.textContent = MARTE.t('rutaSinSegura'); estado.className = 'panel aviso'; }
      else { estado.style.display = 'none'; }
    });
    window.addEventListener('marte-error', function () {
      estado.textContent = MARTE.t('errorMapa'); estado.className = 'panel aviso';
    });
    if (MARTE.mundo) {   // por si el mapa ya estaba listo
      window.dispatchEvent(new CustomEvent('marte-listo', { detail: MARTE.mundo }));
    }

    // Contador de FPS (solo con ?debug=1)
    if (MARTE.params.debug) {
      var fps = el('span', 'marte-fps', null, ' · FPS …');
      nota.appendChild(fps);   // el contador va dentro de la nota de arriba a la izquierda
      var cuenta = 0, desde = performance.now();
      (function bucle(ahora) {
        cuenta++;
        if (ahora - desde >= 500) {
          fps.textContent = ' · FPS ' + Math.round(cuenta * 1000 / (ahora - desde));
          cuenta = 0; desde = ahora;
        }
        requestAnimationFrame(bucle);
      })(performance.now());
    }
  };
})();
