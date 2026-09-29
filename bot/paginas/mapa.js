/* EL MAPA DE LA LIGA — el dibujo, que se explora y (en vivo) dice cómo está cada pieza.

   Dlx, 29/09/2026: «pensé que sería más interactuable» y después «1. C»: que
   se explore como el grafo del reel —arrastrar, hacer zoom, abrir cada pieza
   en sus partes— y que además esté en vivo, sólo para él.

   Dos modos, un solo código:
     · EN VIVO (`mapa.html`, en la página): lee el vigía (`/api/avisos/estado`),
       las corridas de GitHub (su API pública) y lo que deja el ciclo en
       `datos/estado_*.json` (del repo público). No gasta KV ni CPU del Worker
       más allá de lo que ya servía `/api/avisos/estado`.
     · FOTO (el artifact privado): los mismos archivos, con `window.MAPA_FOTO`
       armado al publicarlo. Un artifact no puede pedir nada afuera.

   ⚠️ «Sólo para Dlx» NO ES UN CANDADO: la vista se muestra si la página dice
   que entró con su Discord (`lg:dc`). Los datos que muestra ya son públicos
   —el repo y los registros de Actions lo son—; la puerta es para que no esté
   a la vista de todos, no para esconder nada.

   Todas las horas en hora del este. */
(function () {
  'use strict';
  var D = window.MAPA_DATOS;
  var FOTO = window.MAPA_FOTO || null;
  // ⚠️ El mismo DUENO de `bot/worker.js`: `bot/paginas_subir.py` no sube la
  // página si los dos no coinciden.
  var DUENO = '739338101603696681';
  var GH = 'https://api.github.com/repos/underraponline-lgtm/underlegends';
  var RAW = 'https://raw.githubusercontent.com/underraponline-lgtm/underlegends/main/datos/';
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (s) { return document.querySelector(s); };
  var reducir = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var angosto = window.matchMedia ? window.matchMedia('(max-width: 1099px)') : { matches: false };

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fmt(s) {
    return esc(s).replace(/(bot\/[\w./-]+|sheet\/[\w./-]+|datos\/[\w./*-]*|web:\w+|voz:&lt;SV&gt;|p:&lt;clave&gt;|d:&lt;id&gt;|cfg:&lt;guild&gt;|_worker\.js|que_cambio\.py|subir_datos\.py|alertar\.py|\/api(?:\/lobby|\/cuenta)?|\/card|\/versus|\/numeral|\/foto|\/settings|&lt;clave&gt;\/&lt;carta&gt;\.webp|fotos\/t1\/|\.webp)/g, '<code>$1</code>');
  }
  function num(n, dec) { return Number(n).toLocaleString('es-AR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }); }

  /* ── el tiempo, en hora del este ─────────────────────────── */
  var TZ = 'America/New_York';
  var fH = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });
  var fHs = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  // ⚠️ el día se arma a mano: `es-AR` con día y mes da «29-09» en Chromium, y la Liga escribe 29/09
  var fSem = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, weekday: 'short' });
  var fP = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  function dia(d) {
    var p = partes(d);
    return fSem.format(d).replace('.', '') + ' ' + ('0' + p.day).slice(-2) + '/' + ('0' + p.month).slice(-2);
  }
  function partes(d) { var o = {}; fP.formatToParts(d).forEach(function (p) { o[p.type] = +p.value; }); return o; }
  function madrugada(h) { return h >= 3 && h < 11; }
  function proxima(ahora) {
    var base = Math.floor(ahora.getTime() / 60000) * 60000;
    for (var i = 1; i <= 1500; i++) {
      var t = new Date(base + i * 60000), p = partes(t);
      if ((p.minute === 22 || p.minute === 52) && !madrugada(p.hour)) return t;
    }
    return null;
  }
  function hora(t) { return t ? fH.format(new Date(t)) : ''; }
  function cuando(t) {
    if (!t) return '';
    var d = new Date(t), a = new Date();
    var mismo = partes(d).day === partes(a).day && Math.abs(a - d) < 864e5;
    return mismo ? fH.format(d) : dia(d) + ' ' + fH.format(d);
  }
  function hace(t) {
    if (!t) return '';
    // en la foto, «hace 5 min» se vuelve mentira al abrirla más tarde: va la hora
    if (FOTO) return 'a las ' + cuando(t);
    var s = Math.round((Date.now() - new Date(t).getTime()) / 1000);
    if (s < 45) return 'recién';
    if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
    if (s < 86400) { var h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return 'hace ' + h + ' h' + (m ? ' ' + m + ' min' : ''); }
    return 'hace ' + Math.round(s / 86400) + ' d';
  }
  function falta(ms) {
    var m = Math.round(ms / 60000);
    if (m < 1) return 'en menos de 1 min';
    if (m < 60) return 'en ' + m + ' min';
    var h = Math.floor(m / 60), r = m % 60; return 'en ' + h + ' h' + (r ? ' ' + r + ' min' : '');
  }
  function dur(s) {
    if (s == null) return '';
    s = Math.round(s);
    if (s < 60) return s + ' s';
    var m = Math.floor(s / 60), r = s % 60; return m + ' min' + (r ? ' ' + r + ' s' : '');
  }

  /* ── la puerta (sólo en vivo) ────────────────────────────── */
  if (!FOTO) {
    var dc = null;
    try { dc = JSON.parse(localStorage.getItem('lg:dc') || 'null'); } catch (e) { dc = null; }
    if (!dc || String(dc.id) !== DUENO) {
      $('#puerta').hidden = false;
      $('#app').hidden = true;
      return;
    }
  }
  if (!window.d3) {
    $('#sin-d3').hidden = false;
    return;
  }
  var d3 = window.d3;

  /* ── el estado ───────────────────────────────────────────── */
  var EST = FOTO ? FOTO : { modo: 'vivo' };
  var ult = { avisos: 0, gh: 0 };

  function jget(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' → ' + r.status);
      return r.json();
    });
  }
  function traer(todo) {
    var ps = [];
    ps.push(jget('/api/avisos/estado').then(function (a) { EST.avisos = a; }).catch(function () {}));
    ps.push(jget(RAW + 'estado_escuchar.json').then(function (a) { EST.escuchar = a; }).catch(function () {}));
    ps.push(jget(RAW + 'estado_dibujar.json').then(function (a) { EST.dibujar = a; }).catch(function () {}));
    // ⚠️ La API de GitHub sin cuenta da 60 pedidos por hora: cada 5 min.
    if (todo || Date.now() - ult.gh > 5 * 60e3) {
      ult.gh = Date.now();
      ps.push(jget(GH + '/actions/workflows/ciclo.yml/runs?per_page=12').then(function (a) {
        EST.corridas = (a.workflow_runs || []).map(function (r) {
          return { id: r.id, t: r.run_started_at || r.created_at, fin: r.updated_at, evento: r.event, estado: r.status, fin_ok: r.conclusion, url: r.html_url };
        });
        var hecha = EST.corridas.filter(function (r) { return r.estado === 'completed'; })[0];
        if (!hecha) return null;
        return jget(GH + '/actions/runs/' + hecha.id + '/jobs').then(function (j) {
          var o = { corrida: hecha.id, t: hecha.t };
          (j.jobs || []).forEach(function (x) {
            o[x.name] = { fin_ok: x.conclusion, t: x.started_at,
              s: x.started_at && x.completed_at ? (new Date(x.completed_at) - new Date(x.started_at)) / 1000 : null };
          });
          EST.trabajos = o;
        });
      }).catch(function () {}));
      ps.push(jget(GH + '/actions/workflows/auditoria.yml/runs?per_page=1').then(function (a) {
        var r = (a.workflow_runs || [])[0];
        EST.auditoria = r ? { t: r.run_started_at || r.created_at, fin_ok: r.conclusion, estado: r.status } : null;
      }).catch(function () {}));
    }
    return Promise.all(ps).then(function () { EST.medido = new Date().toISOString(); aplicarEstado(); });
  }
  function cuotas() {
    var a = EST.escuchar && EST.escuchar.cuando ? EST.escuchar : null;
    var b = EST.dibujar && EST.dibujar.cuando ? EST.dibujar : null;
    var nuevo = a && b ? (a.cuando > b.cuando ? a : b) : a || b;
    if (nuevo && nuevo.cuotas) return { q: nuevo.cuotas, t: nuevo.cuando };
    if (EST.cuotas) return { q: EST.cuotas, t: EST.cuotas_t || EST.medido };
    return null;
  }
  function paso(trabajo, n) {
    var e = EST[trabajo];
    if (!e || !e.pasos) return null;
    for (var i = 0; i < e.pasos.length; i++) if (e.pasos[i].n === n) return e.pasos[i];
    return null;
  }
  function pasosDe(trabajo, ns) {
    var ps = ns.map(function (n) { return paso(trabajo, n); }).filter(Boolean);
    if (!ps.length) return null;
    var mal = ps.filter(function (p) { return !p.ok; });
    return { nivel: mal.length ? 'falla' : 'ok',
      txt: mal.length ? 'falló el paso ' + mal.map(function (p) { return p.n; }).join(', ') : 'bien en la última corrida',
      lineas: ps.map(function (p) { return (p.ok ? '✓ ' : '✗ ') + p.n + ' · ' + p.que + (p.s != null ? ' · ' + dur(p.s) : ''); }) };
  }

  /* Cómo está cada pieza ahora: {nivel: ok|ojo|falla|duerme, txt, lineas}. `null`: sin dato, sin pieza. */
  // la hora contra la que se juzga: ahora, o la de la foto
  function REF() { return FOTO && EST.medido ? new Date(EST.medido) : new Date(); }
  function estadoDe(id) {
    var ahora = REF(), p = partes(ahora), noche = madrugada(p.hour);
    var A = EST.avisos || null, q = cuotas(), x, l;
    switch (id) {
      case 'disparo': {
        var c = EST.corridas || [];
        if (!c.length && !(A && A.disparador)) return null;
        var pr = proxima(ahora);
        l = [];
        if (c[0]) l.push('Última corrida: ' + cuando(c[0].t) + ' (' + hace(c[0].t) + '), la arrancó ' + (c[0].evento === 'workflow_dispatch' ? 'el Worker' : c[0].evento === 'schedule' ? 'el cron de GitHub' : c[0].evento));
        if (c.length) l.push('De las últimas ' + c.length + ', el Worker arrancó ' + c.filter(function (r) { return r.evento === 'workflow_dispatch'; }).length);
        if (A && A.disparador && A.disparador.ultimo) l.push('El Worker disparó por última vez a las ' + cuando(A.disparador.ultimo.t) + (A.disparador.ultimo.ok ? ', bien' : ', y GitHub dijo que no'));
        if (pr) l.push('Próxima: ' + hora(pr) + ' ET, ' + falta(pr - ahora));
        if (noche) return { nivel: 'duerme', txt: 'duerme hasta las 11:22 AM', lineas: l };
        var ok = c[0] && REF() - new Date(c[0].t) < 45 * 60e3;
        return { nivel: ok ? 'ok' : 'ojo', txt: c[0] ? 'última: ' + cuando(c[0].t) : 'sin corridas', lineas: l };
      }
      case 'escuchar': case 'dibujar': {
        var e = EST[id], j = EST.trabajos && EST.trabajos[id];
        if (!(e && e.cuando) && !j) return null;
        l = [];
        if (e && e.cuando) {
          l.push('Última: ' + cuando(e.cuando) + ' (' + hace(e.cuando) + ') · tardó ' + dur(e.dur_s));
          var lentos = (e.pasos || []).slice().sort(function (a, b) { return (b.s || 0) - (a.s || 0); }).slice(0, 3);
          if (lentos.length) l.push('Lo que más tardó: ' + lentos.map(function (p) { return p.n + ' (' + dur(p.s) + ')'; }).join(', '));
          (e.fallas || []).forEach(function (f) { l.push('✗ falló en el paso ' + (f.paso || '?') + ': ' + f.que); });
        }
        if (j && j.fin_ok === 'skipped') l.push('En la corrida de las ' + cuando(EST.trabajos.t) + ' no hizo falta' + (id === 'escuchar' ? ' (la madrugada)' : ': no había cartas viejas'));
        var malo = e && e.cuando && (e.codigo || (e.fallas || []).length);
        if (j && j.fin_ok === 'failure') malo = true;
        if (malo) return { nivel: 'falla', txt: 'falló · ' + hace(e && e.cuando || j.t), lineas: l };
        if (noche && id === 'escuchar') return { nivel: 'duerme', txt: 'duerme · última ' + cuando(e && e.cuando || j.t), lineas: l };
        return { nivel: 'ok', txt: e && e.cuando ? hace(e.cuando) + ' · ' + dur(e.dur_s) : 'no hizo falta', lineas: l };
      }
      case 'repo': {
        var ts = [EST.escuchar, EST.dibujar].filter(function (e) { return e && e.cuando; }).map(function (e) { return e.cuando; }).sort();
        if (!ts.length) return null;
        return { nivel: 'ok', txt: 'guardó ' + hace(ts[ts.length - 1]), lineas: ['Último estado guardado: ' + cuando(ts[ts.length - 1])] };
      }
      case 'audit': {
        x = EST.auditoria;
        if (!x) return null;
        return { nivel: x.fin_ok === 'success' ? 'ok' : x.fin_ok ? 'falla' : 'ojo', txt: (x.fin_ok === 'success' ? 'bien' : x.fin_ok || 'corriendo') + ' · ' + cuando(x.t), lineas: ['Última auditoría: ' + cuando(x.t) + ' (' + hace(x.t) + ')'] };
      }
      case 'operativo': return pasosDe('escuchar', ['1', '2', '2d']);
      case 'oficial': return pasosDe('escuchar', ['1c']);
      case 'roles': return pasosDe('escuchar', ['1a2', '1b', '2b6']);
      case 'llamada': x = pasosDe('escuchar', ['1b2']); return x;
      case 'invit': return pasosDe('escuchar', ['2b5']);
      case 'vigia': {
        if (!A || !A.vigia) return null;
        var v = A.vigia;
        l = ['Miró por última vez ' + hace(v.t) + ' · ' + (v.canales || []).length + ' canales'];
        if ((v.errores || []).length) l.push('⚠ ' + v.errores.length + ' error(es) en la última vuelta');
        if ((v.sin_leer || []).length) l.push('⚠ ' + v.sin_leer.length + ' canal(es) sin leer');
        if (v.dormido || noche) return { nivel: 'duerme', txt: 'duerme hasta las 11 AM', lineas: l };
        if ((v.errores || []).length || (v.sin_leer || []).length) return { nivel: 'ojo', txt: 'miró ' + hace(v.t) + ' · con errores', lineas: l };
        return { nivel: 'ok', txt: 'miró ' + hace(v.t), lineas: l };
      }
      case 'anuncios': {
        if (!A || !A.vigia) return null;
        return { nivel: 'ok', txt: 'el vigía mira ' + (A.vigia.canales || []).length + ' canales', lineas: ['Canales que mira el vigía: ' + (A.vigia.canales || []).length] };
      }
      case 'do': {
        if (!A) return null;
        l = ['Dispositivos anotados a la campana: ' + num(A.suscripciones || 0)];
        if (A.ultimas_24h) l.push('En 24 h: ' + num(A.ultimas_24h.avisos) + ' avisos, ' + num(A.ultimas_24h.enviados) + ' envíos');
        return { nivel: 'ok', txt: num(A.suscripciones || 0) + ' anotados', lineas: l };
      }
      case 'tel': {
        if (!A || !A.ultimo) return null;
        x = A.ultimo;
        return { nivel: x.fallos ? 'ojo' : 'ok', txt: 'último aviso ' + hace(x.t),
          lineas: ['Último aviso: «' + x.titulo + '» (' + x.sv + '), ' + cuando(x.t), 'Llegó a ' + num(x.enviados) + ' dispositivo(s)' + (x.fallos ? ', ' + x.fallos + ' fallo(s)' : '')] };
      }
      case 'kv': {
        if (!q || !q.q.kv) return null;
        var w = q.q.kv.write;
        return { nivel: w >= 1000 ? 'falla' : w >= 600 ? 'ojo' : 'ok', txt: num(w) + ' de 1.000 escrituras hoy',
          lineas: ['Escrituras hoy: ' + num(w) + ' de 1.000 (el ciclo se frena en 850)', 'Lecturas hoy: ' + num(q.q.kv.read) + ' de 100.000', 'Medido ' + hace(q.t) + '. El día de Cloudflare arranca a las 8 PM ET.'] };
      }
      case 'r2': {
        if (!q || !q.q.r2) return null;
        return { nivel: q.q.r2.gb >= 8 ? 'ojo' : 'ok', txt: num(q.q.r2.gb, 2) + ' de 10 GB',
          lineas: ['Espacio: ' + num(q.q.r2.gb, 2) + ' de 10 GB · ' + num(q.q.r2.objetos) + ' archivos'] };
      }
      case 'worker': {
        if (!q || !q.q.worker) return null;
        x = q.q.worker;
        return { nivel: x.p99_ms > 8 || x.errores ? 'ojo' : 'ok', txt: 'CPU ' + num(x.p99_ms, 1) + ' de 10 ms',
          lineas: ['CPU por pedido: la mitad ' + num(x.p50_ms, 2) + ' ms, el peor 1 % ' + num(x.p99_ms, 2) + ' ms (de 10)', 'Pedidos en 24 h: ' + num(x.pedidos) + ' de 100.000 · ' + num(x.errores) + ' errores', 'Medido ' + hace(q.t)] };
      }
      case 'llaves': {
        var ev = (EST.escuchar && EST.escuchar.ultimo_evento) || EST.ultimo_evento;
        if (!ev) return null;
        return { nivel: 'ok', txt: '#' + ev.n + ' · ' + ev.sv, lineas: ['Último evento cargado: #' + ev.n + ' «' + ev.nombre + '» (' + ev.sv + '), ' + ev.dia.split('-').reverse().slice(0, 2).join('/')] };
      }
      case 'dlx': {
        var n = EST.escuchar && EST.escuchar.decidir;
        if (n == null) return null;
        return { nivel: n ? 'ojo' : 'ok', txt: n ? n + ' pregunta(s) en ✅ Decidir' : '✅ Decidir al día', lineas: [n ? n + ' pregunta(s) esperan en ✅ Decidir' : 'No hay nada para decidir'] };
      }
    }
    return null;
  }

  /* ── el grafo ────────────────────────────────────────────── */
  var R = { corre: 14, guarda: 13, fuente: 12, gente: 13 };
  var colX = function (c) { return 186 + (c - 1) * 250; };
  var POR = {}, MAIN = [], MAIN_L = [];
  D.N.forEach(function (d) {
    var n = { id: d.id, d: d, k: d.k, t: d.t, s: d.s, r: R[d.k], tx: colX(d.c), ty: d.y, x: colX(d.c), y: d.y };
    n.partes = (d.partes || []).map(function (p, i) {
      return { id: d.id + '/' + p[0], pid: p[0], t: p[1], texto: p[2] || '', parte: true, padre: n, k: d.k, r: 5.5, i: i };
    });
    POR[n.id] = n; MAIN.push(n);
    n.partes.forEach(function (p) { POR[p.id] = p; });
  });
  D.E.forEach(function (e) {
    MAIN_L.push({ id: e.a + '>' + e.b, source: POR[e.a], target: POR[e.b], e: e, dos: !!e.dos });
  });
  var LPOR = {};
  MAIN_L.forEach(function (l) { LPOR[l.id] = l; });

  var svg = d3.select('#lienzo');
  var mundo = svg.select('#mundo');
  var gCarr = mundo.select('#carriles'), gL = mundo.select('#links'), gN = mundo.select('#nodos'), gE = mundo.select('#etqs');
  var pulso = mundo.select('#pulso');
  var ordenado = false, abrirTodo = false, abiertos = new Set(), sel = null, hov = null, rec = null, token = 0;
  var nodes = [], links = [];

  // los carriles del modo ordenado: columnas y franjas
  (function () {
    D.COLUMNAS.forEach(function (c) {
      var x = colX(c.c);
      gCarr.append('rect').attr('class', 'col').attr('x', x - 118).attr('y', 58).attr('width', 236).attr('height', 952);
      gCarr.append('text').attr('class', 'col-t').attr('x', x).attr('y', 30).attr('text-anchor', 'middle').text(c.t);
      gCarr.append('text').attr('class', 'col-s').attr('x', x).attr('y', 47).attr('text-anchor', 'middle').text(c.s);
    });
    D.FRANJAS.forEach(function (b) {
      gCarr.append('line').attr('class', 'franja').attr('x1', 20).attr('x2', 1320).attr('y1', b.y0).attr('y2', b.y0);
      var g = gCarr.append('g').attr('transform', 'translate(34 ' + ((b.y0 + b.y1) / 2) + ') rotate(-90)');
      g.append('text').attr('class', 'banda-t').attr('text-anchor', 'middle').attr('y', b.s ? -3 : 5).text(b.t);
      if (b.s) g.append('text').attr('class', 'banda-s').attr('text-anchor', 'middle').attr('y', 13).text(b.s);
    });
  })();

  var sim = d3.forceSimulation()
    .force('link', d3.forceLink().id(function (d) { return d.id; })
      .distance(function (l) { return l.parte ? 36 : 150; })
      .strength(function (l) { return l.parte ? 0.9 : 0.03; }))
    .force('carga', d3.forceManyBody().strength(function (d) { return d.parte ? -40 : -330; }).distanceMax(420))
    .force('choque', d3.forceCollide(function (d) { return d.parte ? 10 : 42; }))
    .force('x', d3.forceX(function (d) { return d.tx || d.x; }))
    .force('y', d3.forceY(function (d) { return d.ty || d.y; }))
    .alphaDecay(0.035)
    .on('tick', tick)
    .on('end', function () { if (encuadrarAlFinal) { encuadrarAlFinal = false; encuadrarTodo(true); } });
  var encuadrarAlFinal = true;
  function fuerzas() {
    var fx = ordenado ? 0.5 : 0.05, fy = ordenado ? 0.5 : 0.04;
    sim.force('x').strength(function (d) { return d.parte ? 0 : fx; });
    sim.force('y').strength(function (d) { return d.parte ? 0 : fy; });
    svg.classed('ordenado', ordenado);
  }

  function trimmed(l) {
    var a = l.source, b = l.target, dx = b.x - a.x, dy = b.y - a.y, dd = Math.sqrt(dx * dx + dy * dy) || 1;
    var ra = a.r + (l.dos ? 5 : 2), rb = b.r + (l.parte ? 1 : 5);
    return [a.x + dx / dd * ra, a.y + dy / dd * ra, b.x - dx / dd * rb, b.y - dy / dd * rb];
  }
  function tick() {
    gL.selectAll('line').each(function (l) {
      var t = trimmed(l);
      this.setAttribute('x1', t[0]); this.setAttribute('y1', t[1]); this.setAttribute('x2', t[2]); this.setAttribute('y2', t[3]);
    });
    gN.selectAll('g.n').attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });
    gE.selectAll('g.etq').attr('transform', function (l) {
      return 'translate(' + ((l.source.x + l.target.x) / 2) + ',' + ((l.source.y + l.target.y) / 2) + ')';
    });
  }

  function rebuild() {
    nodes = MAIN.slice(); links = MAIN_L.slice();
    MAIN.forEach(function (n) {
      var abierto = abiertos.has(n.id);
      n.partes.forEach(function (p) {
        if (!abierto) { p.x = null; return; }
        if (p.x == null) {
          var ang = (p.i / Math.max(1, n.partes.length)) * Math.PI * 2;
          p.x = n.x + Math.cos(ang) * 34; p.y = n.y + Math.sin(ang) * 34; p.vx = 0; p.vy = 0;
        }
        nodes.push(p);
        links.push({ id: n.id + '~' + p.pid, source: n, target: p, parte: true });
      });
    });

    var ls = gL.selectAll('line').data(links, function (l) { return l.id; });
    ls.exit().remove();
    ls.enter().append('line')
      .attr('class', function (l) { return l.parte ? 'l lp' : 'l le'; })
      .each(function (l) {
        if (!l.parte) {
          this.setAttribute('marker-end', 'url(#m)');
          if (l.dos) this.setAttribute('marker-start', 'url(#m)');
          var t = document.createElementNS(NS, 'title');
          t.textContent = l.source.t + (l.dos ? ' ↔ ' : ' → ') + l.target.t + ': ' + l.e.l;
          this.appendChild(t);
        }
      });

    var ns = gN.selectAll('g.n').data(nodes, function (d) { return d.id; });
    ns.exit().remove();
    var en = ns.enter().append('g')
      .attr('class', function (d) { return 'n k-' + d.k + (d.parte ? ' parte' : ''); })
      .attr('tabindex', 0).attr('role', 'button')
      .attr('aria-label', function (d) { return d.parte ? d.t + ', parte de ' + d.padre.t : d.t + '. ' + d.s; })
      .on('click', function (ev, d) { ev.stopPropagation(); elegir(d); })
      .on('keydown', function (ev, d) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); elegir(d); } })
      .on('mouseenter', function (ev, d) { hov = d; pintarFoco(); })
      .on('mouseleave', function () { hov = null; pintarFoco(); })
      .call(d3.drag().clickDistance(4)
        .on('start', function (ev, d) { if (!ev.active) sim.alphaTarget(0.25).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', function (ev, d) { d.fx = ev.x; d.fy = ev.y; })
        .on('end', function (ev, d) { if (!ev.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));
    en.append('circle').attr('class', 'halo').attr('r', function (d) { return d.r + 7; });
    en.append('circle').attr('class', 'c').attr('r', function (d) { return d.r; });
    en.filter(function (d) { return !d.parte; }).append('circle').attr('class', 'est').attr('r', 4.2)
      .attr('cx', function (d) { return d.r * 0.72; }).attr('cy', function (d) { return -d.r * 0.72; });
    en.filter(function (d) { return d.parte; }).append('circle').attr('class', 'est est-p').attr('r', 2.4);
    en.append('text').attr('class', 'lbl').attr('x', function (d) { return d.r + 7; }).attr('y', function (d) { return d.parte ? 3.5 : 1; })
      .text(function (d) { return d.parte && /^\d/.test(d.pid) && (d.padre.id === 'escuchar' || d.padre.id === 'dibujar') ? d.pid + ' · ' + d.t : d.t; });
    en.filter(function (d) { return !d.parte; }).append('text').attr('class', 'sub').attr('x', function (d) { return d.r + 7; }).attr('y', 15).text(function (d) { return d.s; });

    sim.nodes(nodes);
    sim.force('link').links(links);
    fuerzas();
    sim.alpha(0.55).restart();
    aplicarEstado(true);
    pintarFoco();
  }

  /* ── zoom ─────────────────────────────────────────────────── */
  var zoom = d3.zoom().scaleExtent([0.25, 3.2])
    .on('zoom', function (ev) { mundo.attr('transform', ev.transform); svg.classed('cerca', ev.transform.k >= 1.05); });
  svg.call(zoom).on('dblclick.zoom', null);
  svg.on('click', function () { elegir(null); });
  function encuadre(bx, animar) {
    var el = svg.node(), w = el.clientWidth || 900, h = el.clientHeight || 600;
    var k = Math.min(w / (bx[2] - bx[0]), h / (bx[3] - bx[1])) * 0.94;
    k = Math.max(0.25, Math.min(1.6, k));
    var t = d3.zoomIdentity.translate(w / 2 - k * (bx[0] + bx[2]) / 2, h / 2 - k * (bx[1] + bx[3]) / 2).scale(k);
    (animar && !reducir ? svg.transition().duration(550) : svg).call(zoom.transform, t);
  }
  function encuadrarTodo(animar) {
    var xs = nodes.map(function (d) { return d.x; }), ys = nodes.map(function (d) { return d.y; });
    encuadre([Math.min.apply(null, xs) - 70, Math.min.apply(null, ys.concat([ordenado ? 10 : 1e9])) - 40, Math.max.apply(null, xs) + 170, Math.max.apply(null, ys) + 50], animar);
  }
  function centrarEn(d) {
    var el = svg.node(), w = el.clientWidth, h = el.clientHeight, k = Math.max(d3.zoomTransform(el).k, 1.1);
    var t = d3.zoomIdentity.translate(w / 2 - k * (d.x + 40), h / 2 - k * d.y).scale(k);
    (reducir ? svg : svg.transition().duration(500)).call(zoom.transform, t);
  }

  /* ── el foco: lo elegido, sus vecinos y sus líneas ────────── */
  function vecinosDe(d) {
    var v = new Set([d.id]), es = new Set();
    links.forEach(function (l) {
      if (l.source === d || l.target === d) { v.add(l.source.id); v.add(l.target.id); es.add(l.id); }
    });
    return { v: v, es: es };
  }
  function pintarFoco() {
    var foco = sel || hov, V = null, ES = new Set();
    if (rec) {
      V = new Set(); rec.pasos.forEach(function (p) { var l = LPOR[p[0]]; if (l) { V.add(l.source.id); V.add(l.target.id); } });
      ES = rec.encendidas || new Set();
    } else if (foco) {
      var x = vecinosDe(foco.parte && !sel ? foco.padre : foco); V = x.v; ES = x.es;
      if (foco.parte) { V.add(foco.id); V.add(foco.padre.id); }
    }
    gN.selectAll('g.n')
      .classed('sel', function (d) { return !!sel && d === sel; })
      .classed('vecino', function (d) { return !!V && V.has(d.id) && d !== sel; })
      .classed('tenue', function (d) { return !!V && !V.has(d.id) && !(d.parte && V.has(d.padre.id)); })
      .classed('foco', function (d) { return d.parte && ((sel && (sel === d.padre || sel === d || sel.padre === d.padre)) || (hov && (hov === d.padre || hov === d))); });
    gL.selectAll('line')
      .classed('on', function (l) { return ES.has(l.id) && (!!sel || !!rec); })
      .classed('hov', function (l) { return ES.has(l.id) && !sel && !rec; })
      .classed('tenue', function (l) { return !!V && !ES.has(l.id) && !(l.parte && V.has(l.source.id)); })
      .each(function (l) {
        if (l.parte) return;
        var m = ES.has(l.id) ? ((sel || rec) ? 'url(#m-on)' : 'url(#m-hov)') : 'url(#m)';
        this.setAttribute('marker-end', m); if (l.dos) this.setAttribute('marker-start', m);
      });
    var etqs = (sel || rec) ? links.filter(function (l) { return !l.parte && ES.has(l.id); }) : [];
    var g = gE.selectAll('g.etq').data(etqs, function (l) { return l.id; });
    g.exit().remove();
    var ge = g.enter().append('g').attr('class', 'etq');
    ge.append('rect').attr('rx', 3).attr('ry', 3);
    ge.append('text').attr('text-anchor', 'middle').attr('y', 4).text(function (l) { return l.e.l; });
    ge.each(function () {
      var t = this.querySelector('text'), r = this.querySelector('rect'), w = t.getComputedTextLength() + 14;
      r.setAttribute('x', -w / 2); r.setAttribute('y', -10); r.setAttribute('width', w); r.setAttribute('height', 19);
    });
    tick();
  }

  /* ── elegir ───────────────────────────────────────────────── */
  function elegir(d) {
    token++; rec = null; pulso.attr('cx', -9999);
    document.querySelectorAll('.chip-rec').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
    sel = d;
    if (!abrirTodo) {
      var antes = Array.from(abiertos).sort().join(), queda = new Set();
      if (d) { var m = d.parte ? d.padre : d; if (m.partes.length) queda.add(m.id); }
      abiertos = queda;
      if (Array.from(abiertos).sort().join() !== antes) rebuild();
    }
    pintarFoco();
    pintarPanel();
    if (d && angosto.matches) abrirPanel(true);
  }

  /* ── la búsqueda ─────────────────────────────────────────── */
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  var buscador = $('#buscar'), resultados = $('#resultados');
  buscador.addEventListener('input', function () {
    var q = norm(buscador.value.trim());
    if (!q) { resultados.hidden = true; return; }
    var hits = [];
    MAIN.forEach(function (n) {
      if (norm(n.t + ' ' + n.s).indexOf(q) >= 0) hits.push(n);
      n.partes.forEach(function (p) { if (norm(p.t + ' ' + p.pid).indexOf(q) >= 0) hits.push(p); });
    });
    resultados.innerHTML = hits.slice(0, 8).map(function (h, i) {
      return '<button type="button" data-i="' + i + '"><b>' + esc(h.t) + '</b><span>' + esc(h.parte ? 'parte de ' + h.padre.t : D.KIND[h.k]) + '</span></button>';
    }).join('') || '<p>No hay nada con ese nombre.</p>';
    resultados.hidden = false;
    resultados.onclick = function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      var h = hits[+b.dataset.i]; resultados.hidden = true; buscador.value = '';
      if (h.parte) { abiertos.add(h.padre.id); rebuild(); }
      elegir(h); setTimeout(function () { centrarEn(h); }, 60);
    };
  });
  buscador.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') { var b = resultados.querySelector('button'); if (b) b.click(); }
    if (ev.key === 'Escape') { buscador.value = ''; resultados.hidden = true; }
  });

  /* ── los botones del lienzo ──────────────────────────────── */
  function marcarBotones() {
    $('#b-orden').setAttribute('aria-pressed', ordenado ? 'true' : 'false');
    $('#b-orden').textContent = ordenado ? 'Ordenado' : 'Libre';
    $('#b-todo').setAttribute('aria-pressed', abrirTodo ? 'true' : 'false');
    $('#b-todo').textContent = abrirTodo ? 'Cerrar todo' : 'Abrir todo';
  }
  $('#b-orden').addEventListener('click', function () {
    ordenado = !ordenado; encuadrarAlFinal = true; fuerzas(); sim.alpha(0.8).restart(); marcarBotones();
    try { localStorage.setItem('mapa:orden', ordenado ? '1' : '0'); } catch (e) {}
  });
  $('#b-todo').addEventListener('click', function () {
    abrirTodo = !abrirTodo;
    abiertos = new Set(abrirTodo ? MAIN.filter(function (n) { return n.partes.length; }).map(function (n) { return n.id; }) : sel ? [sel.parte ? sel.padre.id : sel.id] : []);
    encuadrarAlFinal = true; rebuild(); marcarBotones();
  });
  $('#b-mas').addEventListener('click', function () { svg.transition().duration(250).call(zoom.scaleBy, 1.3); });
  $('#b-menos').addEventListener('click', function () { svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.3); });
  $('#b-centrar').addEventListener('click', function () { encuadrarTodo(true); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && document.activeElement !== buscador) elegir(null); });

  /* ── los recorridos ──────────────────────────────────────── */
  var cr = $('#chips-rec');
  D.REC.forEach(function (r) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip-rec'; b.textContent = r.t; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function () { correr(r); });
    cr.appendChild(b);
  });
  function correr(r) {
    var mio = ++token; sel = null; rec = r; r.encendidas = new Set();
    if (!abrirTodo && abiertos.size) { abiertos = new Set(); rebuild(); }
    document.querySelectorAll('.chip-rec').forEach(function (c) { c.setAttribute('aria-pressed', c.textContent === r.t ? 'true' : 'false'); });
    pintarRec(r); pintarFoco();
    if (angosto.matches) abrirPanel(true);
    var lis = document.querySelectorAll('#pasos li'), i = 0;
    if (reducir) {
      r.pasos.forEach(function (p) { r.encendidas.add(p[0]); });
      lis.forEach(function (li) { li.classList.add('fue'); }); pintarFoco(); return;
    }
    function siguiente() {
      if (mio !== token) return;
      if (i >= r.pasos.length) {
        pulso.attr('cx', -9999);
        lis.forEach(function (li) { li.classList.remove('va'); li.classList.add('fue'); });
        return;
      }
      lis.forEach(function (li, j) { li.classList.toggle('va', j === i); if (j < i) li.classList.add('fue'); });
      var id = r.pasos[i][0], l = LPOR[id];
      r.encendidas.add(id); pintarFoco();
      var alReves = id.split('>')[0] !== l.e.a, t0 = null, durMs = 1100;
      function cuadro(ts) {
        if (mio !== token) return;
        if (t0 === null) t0 = ts;
        var k = Math.min(1, (ts - t0) / durMs), q = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        if (alReves) q = 1 - q;
        pulso.attr('cx', l.source.x + (l.target.x - l.source.x) * q).attr('cy', l.source.y + (l.target.y - l.source.y) * q);
        if (k < 1) requestAnimationFrame(cuadro); else { i++; setTimeout(siguiente, 250); }
      }
      requestAnimationFrame(cuadro);
    }
    siguiente();
  }

  /* ── el panel ─────────────────────────────────────────────── */
  var panel = $('#panel'), cuerpoP = $('#panel-cuerpo'), tituloP = $('#panel-titulo'), botonP = $('#panel-boton');
  function abrirPanel(si) {
    panel.classList.toggle('abierto', !!si);
    botonP.textContent = si ? 'Cerrar' : 'Abrir';
    botonP.setAttribute('aria-expanded', si ? 'true' : 'false');
  }
  botonP.addEventListener('click', function () { abrirPanel(!panel.classList.contains('abierto')); });
  cuerpoP.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-ir]');
    if (b) { var d = POR[b.getAttribute('data-ir')]; if (d && d.parte && !abiertos.has(d.padre.id)) { abiertos.add(d.padre.id); rebuild(); } if (d) { elegir(d); centrarEn(d); } }
    if (ev.target.closest('#b-partes')) {
      var m = sel && (sel.parte ? sel.padre : sel);
      if (m) { if (abiertos.has(m.id)) abiertos.delete(m.id); else abiertos.add(m.id); rebuild(); pintarPanel(); }
    }
  });
  function lineasAhora(st) {
    if (!st) return '';
    return '<div class="ahora-p nivel-' + st.nivel + '"><h3>' + (EST.modo === 'vivo' ? 'Ahora' : 'En la foto') + '</h3><ul>' +
      st.lineas.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
  }
  function pintarPanel() {
    if (rec) return;
    var d = sel;
    if (!d) { pintarInicio(); return; }
    var h;
    if (d.parte) {
      var st = null, m = d.padre;
      if (m.id === 'escuchar' || m.id === 'dibujar') {
        var p = paso(m.id, d.pid);
        if (p) st = { nivel: p.ok ? 'ok' : 'falla', lineas: [(p.ok ? 'Bien' : 'Falló') + ' en la última corrida' + (p.s != null ? ' · ' + dur(p.s) : '')] };
      }
      h = '<div class="p-cab"><span class="chip k-' + m.k + '">Parte</span><span class="donde">de ' + esc(m.t) + '</span></div>' +
        '<h2>' + esc(/^\d/.test(d.pid) && (m.id === 'escuchar' || m.id === 'dibujar') ? d.pid + ' · ' + d.t : d.t) + '</h2>' +
        lineasAhora(st) + (d.texto ? '<p class="que">' + fmt(d.texto) + '</p>' : '') +
        '<div><h3>Es parte de</h3><ul class="con"><li><button type="button" data-ir="' + m.id + '"><span class="a">' + esc(m.t) + '</span><span class="q">' + esc(m.s) + '</span></button></li></ul></div>';
      cuerpoP.innerHTML = h; tituloP.textContent = d.t; return;
    }
    var n = d.d;
    h = '<div class="p-cab"><span class="chip k-' + n.k + '">' + D.KIND[n.k] + '</span><span class="donde">' + esc(n.donde) + '</span></div>';
    h += '<h2>' + esc(n.t) + '</h2><p class="cada">' + esc(n.cada) + '</p>';
    h += lineasAhora(estadoDe(n.id));
    h += '<p class="que">' + fmt(n.que) + '</p>';
    if (n.ojo) h += '<p class="ojo"><strong>OJO</strong>' + fmt(n.ojo) + '</p>';
    if (d.partes.length) {
      h += '<div><h3>Sus partes · ' + d.partes.length + '</h3><div class="partes-lista">' + d.partes.map(function (p) {
        var ps = (n.id === 'escuchar' || n.id === 'dibujar') ? paso(n.id, p.pid) : null;
        return '<button type="button" data-ir="' + p.id + '"' + (ps ? ' class="' + (ps.ok ? 'p-ok' : 'p-falla') + '"' : '') + '>' +
          esc((n.id === 'escuchar' || n.id === 'dibujar') ? p.pid + ' · ' + p.t : p.t) + '</button>';
      }).join('') + '</div><button type="button" class="boton-chico" id="b-partes">' + (abiertos.has(n.id) ? 'Ocultarlas del mapa' : 'Mostrarlas en el mapa') + '</button></div>';
    }
    var vienen = [], van = [];
    MAIN_L.forEach(function (l) {
      if (l.target === d) vienen.push({ o: l.source, l: l });
      else if (l.source === d) van.push({ o: l.target, l: l });
    });
    function lista(t, xs) {
      if (!xs.length) return '';
      return '<div><h3>' + t + '</h3><ul class="con">' + xs.map(function (x) {
        return '<li><button type="button" data-ir="' + x.o.id + '"><span class="a">' + (x.l.dos ? '↔ ' : '') + esc(x.o.t) + '</span><span class="q">' + esc(x.l.e.l) + '</span></button></li>';
      }).join('') + '</ul></div>';
    }
    h += lista('Le llega de', vienen) + lista('Le manda a', van);
    h += '<div><h3>En el repo</h3><div class="arch">' + n.arch.map(function (a) { return '<code>' + esc(a) + '</code>'; }).join('') + '</div></div>';
    cuerpoP.innerHTML = h; tituloP.textContent = n.t;
    if (!angosto.matches && panel.scrollTop) panel.scrollTop = 0;
  }
  function pintarRec(r) {
    var h = '<div class="p-cab"><span class="chip rec">Recorrido</span><span class="donde">' + r.pasos.length + ' pasos</span></div><h2>' + esc(r.t) + '</h2>';
    h += '<ol class="pasos" id="pasos">' + r.pasos.map(function (p) { return '<li>' + fmt(p[1]) + '</li>'; }).join('') + '</ol>';
    h += '<button type="button" class="boton" id="otra-vez">Ver de nuevo</button>';
    cuerpoP.innerHTML = h; tituloP.textContent = r.t;
    $('#otra-vez').addEventListener('click', function () { correr(r); });
  }
  function pintarInicio() {
    var alertas = [];
    MAIN.forEach(function (n) {
      var st = estadoDe(n.id);
      if (st && (st.nivel === 'falla' || st.nivel === 'ojo')) alertas.push({ n: n, st: st });
    });
    var h = '<div class="p-cab"><span class="chip k-corre">' + (EST.modo === 'vivo' ? 'En vivo' : 'Foto') + '</span><span class="donde">' +
      (EST.modo === 'vivo' ? (EST.medido ? 'actualizado ' + hace(EST.medido) : 'cargando…') : 'tomada ' + cuando(EST.medido)) + '</span></div>';
    var cargando = EST.modo === 'vivo' && !EST.medido;
    h += '<h2>' + (cargando ? 'Cargando el estado…' : alertas.length ? 'Para mirar' : 'Todo en orden') + '</h2>';
    if (alertas.length) {
      h += '<ul class="hallazgos">' + alertas.map(function (a) {
        return '<li class="nivel-' + a.st.nivel + '"><b>' + esc(a.n.t) + '</b>' + esc(a.st.txt) + '<br><button type="button" class="ir" data-ir="' + a.n.id + '">Ver ' + esc(a.n.t) + ' →</button></li>';
      }).join('') + '</ul>';
    } else if (!cargando) {
      h += '<p class="que">Ninguna pieza con falla ni aviso' + (EST.modo === 'vivo' ? ' ahora.' : ' en esta foto.') + ' Toca una para ver qué hace y cómo está.</p>';
    }
    h += '<div><h3>Cómo se usa</h3><div class="leyenda">' +
      '<div>Toca una pieza: se abre en sus partes y acá ves qué hace, de dónde le llega el dato y a dónde lo manda.</div>' +
      '<div>Arrastra las piezas, haz zoom con la rueda o con dos dedos, y busca por nombre arriba.</div>' +
      '<div><b>Libre</b> las deja flotar como un grafo; <b>Ordenado</b> las pone en columnas (dónde corre) y franjas (cada cuánto).</div>' +
      '<div>El punto de cada pieza dice cómo está: <span class="pt pt-ok"></span>bien · <span class="pt pt-ojo"></span>para mirar · <span class="pt pt-falla"></span>falló · <span class="pt pt-duerme"></span>duerme.</div>' +
      '</div></div>';
    h += '<div><h3>Los colores</h3><div class="leyenda">' +
      '<div class="fila"><span class="sw" style="border-color:#8FA39F"></span>Fuente: lo que pasa en Discord</div>' +
      '<div class="fila"><span class="sw" style="border-color:#29B298"></span>Corre: un proceso que hace el trabajo</div>' +
      '<div class="fila"><span class="sw" style="border-color:#B9C4C1"></span>Guarda: donde queda el dato</div>' +
      '<div class="fila"><span class="sw" style="border-color:#E41373"></span>Gente: donde alguien lo ve o decide</div></div></div>';
    cuerpoP.innerHTML = h;
    tituloP.textContent = cargando ? 'Cargando…' : alertas.length ? alertas.length + ' pieza(s) para mirar' : 'Todo en orden';
  }

  /* ── aplicar el estado: puntos, subtítulos, medidores ─────── */
  function aplicarEstado(sinPanel) {
    gN.selectAll('g.n').each(function (d) {
      var st = null;
      if (d.parte) {
        if (d.padre.id === 'escuchar' || d.padre.id === 'dibujar') {
          var p = paso(d.padre.id, d.pid);
          if (p) st = { nivel: p.ok ? 'ok' : 'falla' };
        }
      } else st = estadoDe(d.id);
      var e = this.querySelector('.est');
      if (e) e.setAttribute('class', 'est' + (d.parte ? ' est-p' : '') + (st ? ' nivel-' + st.nivel : ' nada'));
      var s = this.querySelector('.sub');
      if (s) s.textContent = st && st.txt ? st.txt : d.s;
    });
    pintarMedidores(); pintarAhora();
    if (!sinPanel) pintarPanel();
  }
  function pintarMedidores() {
    var q = cuotas(), M = [];
    if (q && q.q.worker) M.push({ ir: 'worker', l: 'Worker · CPU por pedido', v: num(q.q.worker.p99_ms, 2), u: 'ms', de: 'de 10 ms, el peor 1 %', p: q.q.worker.p99_ms * 10, n: 'la mitad usa ' + num(q.q.worker.p50_ms, 2) + ' ms' });
    if (q && q.q.kv) M.push({ ir: 'kv', l: 'KV · escrituras', v: num(q.q.kv.write), u: 'hoy', de: 'de 1.000 por día', p: q.q.kv.write / 10, est: q.q.kv.write >= 1000 ? 'falla' : q.q.kv.write >= 600 ? 'ojo' : '', n: 'el ciclo se frena en 850' });
    if (q && q.q.r2) M.push({ ir: 'r2', l: 'R2 · espacio', v: num(q.q.r2.gb, 2), u: 'GB', de: 'de 10 GB', p: q.q.r2.gb * 10, n: num(q.q.r2.objetos) + ' archivos' });
    var c = EST.corridas || [];
    if (c.length) {
      var bien = c.filter(function (r) { return r.fin_ok === 'success'; }).length, mal = c.filter(function (r) { return r.fin_ok === 'failure'; }).length;
      M.push({ ir: 'escuchar', l: 'El ciclo · últimas ' + c.length, v: String(bien), u: 'bien', de: mal ? mal + ' con falla' : 'ninguna falló', dias: c.slice().reverse().map(function (r) { return r.estado !== 'completed' ? 'va' : r.fin_ok === 'success' ? 'ok' : r.fin_ok === 'failure' ? 'falla' : 'nada'; }), est: mal ? 'falla' : '', n: 'la última, ' + hace(c[0].t) });
    }
    var dib = EST.dibujar && EST.dibujar.cuando ? EST.dibujar : null;
    if (dib) M.push({ ir: 'dibujar', l: 'dibujar · la última', v: String(Math.round(dib.dur_s / 60)), u: 'min', de: 'de 120 min de techo', p: dib.dur_s / 72, n: hace(dib.cuando) });
    var dec = EST.escuchar && EST.escuchar.decidir;
    if (dec != null) M.push({ ir: 'dlx', l: '✅ Decidir', v: String(dec), u: 'pregunta(s)', de: dec ? 'esperan tu respuesta' : 'nada para decidir', est: dec ? 'ojo' : '', n: 'en el Sheet Operativo' });
    $('#medidores').innerHTML = M.map(function (m) {
      var barra = m.dias ? '<span class="dias" aria-hidden="true">' + m.dias.map(function (d) { return '<i class="' + d + '"></i>'; }).join('') + '</span>'
        : m.p != null ? '<span class="barra"><i style="width:' + Math.max(1, Math.min(100, m.p)).toFixed(1) + '%"></i></span>' : '';
      return '<button type="button" class="med' + (m.est ? ' est-' + m.est : '') + '" data-ir="' + m.ir + '"><span class="l">' + esc(m.l) + '</span><span class="v">' + esc(m.v) + (m.u ? '<small>' + esc(m.u) + '</small>' : '') + '</span><span class="de">' + esc(m.de) + '</span>' + barra + '<span class="n">' + esc(m.n) + '</span></button>';
    }).join('');
    $('#medidores').hidden = !M.length;
  }
  $('#medidores').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-ir]'); if (!b) return;
    var d = POR[b.getAttribute('data-ir')]; elegir(d); centrarEn(d);
  });

  /* ── la cabecera: el reloj ─────────────────────────────────── */
  function pintarAhora() {
    var ahora = new Date(), p = partes(ahora), noche = madrugada(p.hour), pr = proxima(ahora), li = [];
    $('#reloj').textContent = 'Son las ' + fH.format(ahora) + ' ET';
    var v = EST.avisos && EST.avisos.vigia;
    if (EST.modo === 'vivo' && v) li.push(v.dormido ? '<b>El vigía duerme</b> hasta las 11 AM ET.' : 'El vigía miró Discord <b>' + esc(hace(v.t)) + '</b>.');
    else if (noche) li.push('<b>Madrugada.</b> De 3 a 11 AM ET el ciclo y el vigía duermen.');
    else li.push('El vigía mira Discord <b>cada minuto</b>.');
    var corriendo = !noche && ((p.minute >= 22 && p.minute < 28) || (p.minute >= 52 && p.minute < 58));
    if (corriendo) li.push('El ciclo de las <b>' + ((p.hour % 12) || 12) + ':' + (p.minute < 52 ? '22' : '52') + '</b> debería estar corriendo.');
    if (pr) li.push('Próximo ciclo: <b>' + hora(pr) + ' ET</b>, ' + falta(pr - ahora) + '.');
    $('#ahora-lista').innerHTML = '<li>' + li.join('</li><li>') + '</li>';
    $('#latido').classList.toggle('duerme', noche || !!(v && v.dormido));
    $('#fresco').textContent = EST.modo === 'vivo'
      ? (EST.medido ? 'En vivo · actualizado ' + hace(EST.medido) : 'En vivo · cargando…')
      : 'Foto tomada el ' + dia(new Date(EST.medido)) + ' a las ' + fH.format(new Date(EST.medido)) + ' ET · la versión en vivo está en la página de la Liga';
  }

  /* ── arranque ─────────────────────────────────────────────── */
  try { ordenado = localStorage.getItem('mapa:orden') === '1'; } catch (e) { ordenado = false; }
  marcarBotones();
  rebuild();
  // se deja asentar antes de encuadrar: sin esto, encuadra la posición de salida
  sim.tick(120); tick(); encuadrarTodo(false);
  elegir(null);
  setInterval(pintarAhora, 1000);
  if (EST.modo === 'vivo') {
    traer(true);
    setInterval(function () { if (document.visibilityState !== 'hidden') traer(false); }, 60e3);
  }
  if (angosto.addEventListener) angosto.addEventListener('change', function () { if (!angosto.matches) abrirPanel(false); });
  window.addEventListener('resize', function () { encuadrarTodo(false); });
})();
