/* ============================================================
   ui.js - Interfaz superpuesta (visor 3D y AR):
   - Leyenda: la ruta siempre; los colores de riesgo solo con "Mapa de riesgo" activado
   - Nota de honestidad: "Rover ampliado ×18 · Relieve ×2"
   - Botones: "Mapa de riesgo" (interruptor) y "Escala real"
   - Mensajes de carga / aviso de ruta / error y contador de FPS (?debug=1)
   Se crea con JS para que todos los textos salgan de MARTE.TEXTOS.

   Acuerdo con el código del terreno (terrain.js / mapa.js):
   - MARTE.capaRiesgo(visible)  muestra u oculta la capa de riesgo y lanza en window
     el evento 'marte-capa-riesgo' con detail.visible.
   - MARTE.COLORES = { ruta, riesgo: [verde, ambar, rojo] }  son los colores reales para la leyenda.
   Si todavía no existen, usamos los colores de config.js y el botón queda desactivado.
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

  // Convierte un color (texto '#rrggbb', número 0xrrggbb o THREE.Color) a '#rrggbb'
  function aHex(valor, respaldo) {
    try {
      if (typeof valor === 'string') { return valor; }
      if (typeof valor === 'number') { return '#' + ('000000' + valor.toString(16)).slice(-6); }
      if (valor && valor.getHexString) { return '#' + valor.getHexString(); }
    } catch (e) { /* usamos el respaldo */ }
    return respaldo;
  }

  // Pasa los colores reales del mapa a variables CSS (las usan la leyenda y el botón de riesgo)
  function pintarColores() {
    var col = MARTE.COLORES || {};
    var riesgo = col.riesgo || [];
    var raiz = document.documentElement.style;
    raiz.setProperty('--r-verde', aHex(riesgo[0], C.COLORES.verde));
    raiz.setProperty('--r-ambar', aHex(riesgo[1], C.COLORES.ambar));
    raiz.setProperty('--r-rojo', aHex(riesgo[2], C.COLORES.rojo));
    raiz.setProperty('--ruta', aHex(col.ruta, '#ffffff'));
  }

  MARTE.iniciarUI = function () {
    var datos = { rover: C.ROVER_ESCALA, relieve: C.EXAGERACION_RELIEVE,
                  v: C.PENDIENTE_VERDE_MAX, a: C.PENDIENTE_AMBAR_MAX };
    var raiz = el('div', 'marte-ui');
    document.body.appendChild(raiz);
    pintarColores();

    // Mensajes: cargando / aviso de ruta / error (arriba y centrados)
    var estado = el('div', 'marte-estado', 'panel', MARTE.t('cargando'));
    estado.setAttribute('role', 'status');
    raiz.appendChild(estado);

    // Zona de abajo: leyenda (con la nota de escalas) y fila de botones
    var base = el('div', 'marte-base');
    raiz.appendChild(base);

    // --- Leyenda ---
    var leyenda = el('div', 'marte-leyenda', 'panel');
    var grupo = el('div', null, 'grupo-riesgo');           // solo se ve con el mapa de riesgo activado
    grupo.appendChild(el('div', null, 'titulo', MARTE.t('leyendaTitulo')));
    [['leyendaVerde', 'verde'], ['leyendaAmbar', 'ambar'], ['leyendaRojo', 'rojo']].forEach(function (f) {
      var fila = el('div', null, 'fila');
      fila.appendChild(el('span', null, 'muestra ' + f[1]));
      fila.appendChild(document.createTextNode(MARTE.t(f[0], datos)));
      grupo.appendChild(fila);
    });
    leyenda.appendChild(grupo);
    var filaRuta = el('div', null, 'fila');                // la ruta se ve siempre
    filaRuta.appendChild(el('span', null, 'muestra ruta'));
    filaRuta.appendChild(document.createTextNode(MARTE.t('leyendaRuta', datos)));
    leyenda.appendChild(filaRuta);
    // Nota fija y discreta: "Rover ampliado ×18 · Relieve ×2"
    var nota = el('div', 'marte-nota');
    var notaTexto = el('span');
    nota.appendChild(notaTexto);
    leyenda.appendChild(nota);
    base.appendChild(leyenda);

    // --- Botones ---
    var dock = el('div', 'marte-dock');
    base.appendChild(dock);

    // Interruptor "Mapa de riesgo" (por defecto apagado: se ve el terreno real)
    var riesgo = el('button', 'marte-riesgo', 'boton');
    riesgo.type = 'button';
    riesgo.setAttribute('aria-pressed', 'false');
    var semaforo = el('span', null, 'semaforo');
    semaforo.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 3; i++) { semaforo.appendChild(document.createElement('i')); }
    riesgo.appendChild(semaforo);
    riesgo.appendChild(el('span', null, 'txt', MARTE.t('botonRiesgo')));
    var interruptor = el('span', null, 'interruptor');
    interruptor.setAttribute('aria-hidden', 'true');
    riesgo.appendChild(interruptor);
    dock.appendChild(riesgo);

    var riesgoVisible = false;
    function mostrarRiesgo(visible) {
      riesgoVisible = !!visible;
      riesgo.setAttribute('aria-pressed', riesgoVisible ? 'true' : 'false');
      leyenda.classList.toggle('con-riesgo', riesgoVisible);
      pintarColores();
    }
    // El botón solo funciona cuando el mapa está listo y existe MARTE.capaRiesgo
    function actualizarDisponible() {
      riesgo.disabled = !(MARTE.mundo && MARTE.capaRiesgo);
    }
    riesgo.addEventListener('click', function () {
      if (!MARTE.capaRiesgo) { return; }
      var nuevo = !riesgoVisible;
      MARTE.capaRiesgo(nuevo);
      mostrarRiesgo(nuevo);
    });
    // Si otra parte del código cambia la capa, el botón y la leyenda se ponen al día
    window.addEventListener('marte-capa-riesgo', function (e) {
      mostrarRiesgo(e.detail && e.detail.visible);
    });
    actualizarDisponible();
    if (MARTE.estado && MARTE.estado.capaRiesgo) { mostrarRiesgo(true); }   // por si ya estaba activada

    // Botón de escala real
    var boton = el('button', 'marte-escala', 'boton');
    boton.type = 'button';
    dock.appendChild(boton);
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

    // Estado del mapa: listo (con o sin aviso de ruta) o error
    window.addEventListener('marte-listo', function (e) {
      pintarColores();
      actualizarDisponible();
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
      nota.appendChild(fps);   // el contador va junto a la nota de escalas
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
