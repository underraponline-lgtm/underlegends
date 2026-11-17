// 🃏 LA VENTANA DE UNA TARJETA, NUEVA (03/10/2026, con la llave: el plan del remake, «1. A»). La de app.js (`abrir()`)
// era de la página vieja —oscura, con brillo— y se abría encima de las nuevas. Hace lo mismo: el puesto, el país y la
// crew (se tocan), una pestaña por tarjeta (y tus Bloqueadas, si es la tuya y no estás en la tabla), la imagen de R2
// con su versión, el aviso de «se está redibujando», sus números, Descargar y Ver su perfil. Se cierra con ✕, tocando
// afuera o con Escape, y mientras está abierta la página de atrás no se mueve
// 🎬 REHECHA EL 16/11/2026 (Dlx: «te había dicho que remakees eso de cuando le abres su preview de perfil donde puedes
// ver su tarjeta… y descargar o abrir perfil»). Es la C de la maqueta (artifact privado TkQdmCdUKMZu8c9mDbNej9), la
// fusión de las dos que vio: el ESCENARIO de la A —la carta flotando sobre la página desenfocada, con la luz del color
// de su rango— y la FICHA blanca de la B —quién es, su último evento, qué mide esa carta y los botones—. Dlx: «me gusta
// más lo que veo en el primero, pero el segundo tiene la interfaz».
// · 🃏 SUS CARTAS VAN A LOS COSTADOS (Dlx: «las tarjetas deberían ir a los costados… van a haber más tarjetas»): la
//   elegida en el medio y la de cada lado asomando, apagada. Aguanta cualquier cantidad —con las de liga, Makmah ya
//   tiene 7—, cuando una fila de miniaturas o pestañas de texto se partía en dos renglones con cuatro.
// · ✂️ FUERA LOS CUATRO NÚMEROS (OVR, puntos, eventos, Win%): la carta ya los dice (la regla del VS en vivo y de «Los
//   que mandan»: nada debajo de la carta que la carta ya diga). En su lugar, su último evento y hasta dónde llegó.
// · 📐 «QUE NO HAYA ESPACIOS EXAGERADOS… QUE CREES UN ESPACIO SÓLO PARA UN BOTÓN PEQUEÑO» (Dlx): en el celular la ✕ va
//   en la cabecera de la ficha, al lado del nombre, y no en una fila propia; la ficha mide lo que tiene, sin relleno.
//   Medido en la maqueta en 7 tamaños (360 a 1621) × 5 personas × otro/dueño/con 13 cartas: nada se sale ni se pisa.
import { useEffect, useMemo, useRef, useState } from 'react';
import { limpio, siglaDe } from './liga.js';
import { Bandera, Ico, enlace, nombrePais } from './piezas.jsx';
import { pasePost, refrescarPases, usePases } from './pase.js';
import { pedirLigas } from './ligas_datos.js';
import { fondoEn, useFondos } from './fondos.js';

const NOMBRE = { temporada: 'Temporada', competitivo: 'Competitiva', servidor: 'Servidor', pais: 'País' };
const ORDEN = ['temporada', 'competitivo', 'servidor', 'pais'];
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// quien entró con Discord y no está en la tabla (no jugó la temporada): sus tarjetas y sus Bloqueadas (`filaCuenta()`)
function filaDe(liga, dc, k) {
  const f = liga.T[k] || liga.X[k];
  // 🃏 tus cartas: las del inventario y las de tu cuenta, juntas (ver perfil.jsx)
  if (f && !liga.T[k] && dc && dc.clave === k && Array.isArray(dc.cs)) return Object.assign({}, f, { c: [...new Set([...(f.c || []), ...dc.cs])] });
  if (f) return f;
  if (!dc || dc.clave !== k) return null;
  return { k, n: dc.rapero || dc.n, cc: dc.cc, sv: dc.sv, pos: null, ovr: null, pts: 0, ev: dc.ev || 0, wr: '', c: dc.cs || [], bl: dc.bl || [], cuenta: true };
}

// 🔴 BAJAR UNA CARTA NO ES UN `<a download>`: con otro origen (R2) el navegador ignora `download` y abre la imagen.
// Se baja con fetch y se guarda un blob (R2 deja leer desde la página); si falla, se abre en otra pestaña: un botón que
// no hace nada es peor que uno que hace algo parecido (`bajarCarta()` de app.js). El nombre lo pone la página: en R2
// todas se llaman `temporada.webp`
// 🔴 Y SIN CACHÉ (26/10/2026, Dlx: «¿podríamos hacer que la función de descargar realmente funcione?»): la carta ya se
// mostró como `<img>`, que la pide sin CORS, y el navegador le devolvía al fetch esa copia guardada sin el permiso:
// fallaba SIEMPRE y caía en abrir otra pestaña. Medido: con caché «Failed to fetch», con `no-store` 200
// 🖼️ EN PNG Y NO EN WEBP (26/10/2026, Dlx: «salió en formato webp y dice que no tengo ninguna app para abrir eso»). R2
// sirve WEBP porque pesa un sexto; para guardar, se redibuja en un lienzo y sale PNG, que abre cualquier teléfono y
// cualquier PC. El blob viene por fetch con CORS, así que el lienzo no queda «manchado». Si algo falla, el WEBP
function aPng(bl) {
  return new Promise((ok) => {
    const u = URL.createObjectURL(bl);
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        c.toBlob((p) => { URL.revokeObjectURL(u); ok(p || bl); }, 'image/png');
      } catch (e) { URL.revokeObjectURL(u); ok(bl); }
    };
    img.onerror = () => { URL.revokeObjectURL(u); ok(bl); };
    img.src = u;
  });
}

function bajar(url, nombre, fin) {
  fetch(url, { mode: 'cors', cache: 'no-store' }).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.blob();
  }).then(aPng).then((bl) => {
    const u = URL.createObjectURL(bl);
    const a = document.createElement('a');
    a.href = u;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
  }).catch(() => { window.open(url, '_blank', 'noopener'); }).then(fin, fin);
}

// qué mide cada carta, en una línea: lo que la ficha dice de la elegida (la de tu cuenta, de tú)
function queMide(tipo, yo) {
  if (tipo === 'temporada') return yo ? 'Mide lo que sumaste esta temporada: puntos, podios y eventos.' : 'Mide lo que sumó esta temporada: puntos, podios y eventos.';
  if (tipo === 'competitivo') return yo ? 'Mide tu nivel. Es el Score, y de ahí sale tu rango.' : 'Mide su nivel. Es el Score, y de ahí sale su rango.';
  if (tipo === 'servidor') return yo ? 'Mide lo tuyo dentro de tu servidor.' : 'Mide lo suyo dentro de su servidor.';
  if (tipo === 'pais') return yo ? 'Mide tu puesto dentro de tu país.' : 'Mide su puesto dentro de su país.';
  if (tipo === 'liga') return yo ? 'Mide lo tuyo en esa liga: tu puesto y tu OVR de liga.' : 'Mide lo suyo en esa liga: su puesto y su OVR de liga.';
  return '';
}

// 📅 su último evento (`ult` del lobby: el día y hasta dónde llegó). Lo que la carta NO dice
function ultimoEv(f, yo) {
  if (!Array.isArray(f.ult) || !f.ult[0]) return null;
  const [d, r] = f.ult;
  const x = new Date(d + 'T12:00:00');
  if (isNaN(x)) return null;
  const tope = /^(campe|subcampe)/i.test(r || '');
  return { dia: DIAS[x.getDay()] + ' ' + d.slice(8, 10) + '/' + d.slice(5, 7), res: tope ? r : r ? (yo ? 'llegaste a ' : 'llegó a ') + r : '', camp: /^campe/i.test(r || '') };
}

// 🎞️ LA CARTA SALE DE DONDE LA TOCASTE: la miniatura de la carta que se tocó antes de abrir (piezas.jsx guarda el último
// toque en `__lgToque`). Sólo si era una carta de R2 y el toque fue recién; si no, se abre como siempre
function deDonde() {
  const t = window.__lgToque;
  if (!t || Date.now() - t.t > 1500 || !t.el) return null;
  const el = t.el;
  const img = el.tagName === 'IMG' ? el : (el.closest && (el.closest('button, a') || el).querySelector && (el.closest('button, a') || el).querySelector('img'));
  if (!img || !/\/(temporada|competitivo|servidor|pais|liga-[^/.]+)(\.chica)?\.webp/.test(img.currentSrc || img.src || '')) return null;
  const r = img.getBoundingClientRect();
  return r.width > 4 ? r : null;
}

export function VisorCarta({ liga, dc, k, inicial = '', onCerrar }) {
  const f = filaDe(liga, dc, k);
  // 🎞️ SUAVE (Dlx, 17/11/2026: «asegúrate que todo tenga animaciones smoother»). Medido con el procesador frenado como un
  // celular mediano: al pasar de carta tironeaban 41 de 95 cuadros (el peor, 250 ms). Era el `filter` que apagaba las de
  // al lado —se repinta la imagen entera en cada cuadro—, las imágenes que se creaban y decodificaban de nuevo al pasar,
  // y dos movimientos encimados al abrir. Ahora: sólo `transform` y `opacity` (los mueve la placa de video), cada carta
  // que ya se vio queda montada, la carta sigue al dedo mientras arrastras, el texto cambia con un fundido, y al
  // cerrar se va en vez de desaparecer de golpe
  // de dónde sale la carta (una sola vez, al abrir) y si vino de la persona de al lado (entra de costado, sin fundir el fondo)
  const [desde0] = useState(() => deDonde());
  const [sigue] = useState(() => { const v = window.__lgVkSigue; return v && Date.now() - v.t < 900 ? v.dir : 0; });
  const [sale, setSale] = useState(false);
  const pub = usePases();
  const fondos = useFondos();
  const cp = (pub && pub.cp && pub.cp[k]) || '';
  const esYo = !!((dc && dc.clave === k) || (liga.yo && liga.yo.k === k));
  // 🏟️ sus cartas de liga, del mismo pedido que ya hace la página (`/api/ligas`, una vez por lobby)
  const [lx, setLx] = useState(null);
  useEffect(() => {
    let vivo = true;
    pedirLigas(liga.d.sello).then((x) => { if (vivo) setLx(x); });
    return () => { vivo = false; };
  }, [liga.d.sello]);
  const items = useMemo(() => {
    if (!f) return [];
    const r2 = liga.d.r2 + '/' + encodeURIComponent(k) + '/';
    const cs = ORDEN.filter((c) => (f.c || []).includes(c));
    const out = cs.map((c) => ({ id: c, tipo: c, nom: NOMBRE[c], url: liga.cartaUrl(k, c), mide: queMide(c, esYo) }));
    const mias = (lx && lx.cartas && lx.cartas[k]) || [];
    if (mias.length) {
      const nom = {};
      ((lx.lobby && lx.lobby.ligas) || []).forEach((L) => { nom[L.id] = L.n; });
      Object.values(lx.comp || {}).forEach((C) => { nom[C.id] = C.n + ' · ' + (C.lt ? 'T' + C.lt : 'terminada'); });
      mias.forEach((m) => out.push({ id: 'liga:' + m[0], tipo: 'liga', nom: limpio(nom[m[0]] || m[0]), sub: 'Liga', url: r2 + 'liga-' + m[0] + '.webp?v=' + m[1], mide: queMide('liga', esYo) }));
    }
    // tus Bloqueadas, si es la tuya y no estás en la tabla (las de R2: `bloq-<carta>.webp`)
    if (f.cuenta) ORDEN.filter((c) => (f.bl || []).includes(c) && !cs.includes(c)).forEach((c) => out.push({ id: 'bloq-' + c, tipo: c, bloq: true, nom: NOMBRE[c], sub: 'Bloqueada', url: r2 + 'bloq-' + c + '.webp', mide: '' }));
    return out;
  }, [f, k, liga, lx, esYo]);
  // 🃏 sin pedir una, abre en su carta principal (26/10/2026), si la eligió
  const primera = inicial && items.some((x) => x.id === inicial) ? inicial : cp && items.some((x) => x.id === cp) ? cp : (items[0] ? items[0].id : '');
  const [sel, setSel] = useState(primera);
  useEffect(() => { setSel(primera); }, [k, inicial, cp]); // eslint-disable-line react-hooks/exhaustive-deps
  const i = Math.max(0, items.findIndex((x) => x.id === sel));
  const x = items[i];
  const ir = (d) => { const n = Math.max(0, Math.min(items.length - 1, i + d)); if (items[n]) setSel(items[n].id); };
  const irRef = useRef(ir);
  irRef.current = ir;
  const [yendo, setYendo] = useState(false);
  const [aviso, setAviso] = useState('');
  const avisoT = useRef(0);
  const avisar = (t) => { setAviso(t); clearTimeout(avisoT.current); avisoT.current = setTimeout(() => setAviso(''), 2400); };
  useEffect(() => () => clearTimeout(avisoT.current), []);
  const raiz = useRef(null);
  const gira = useRef(null);
  // 🃏 TU CARTA PRINCIPAL SE ELIGE ACÁ, mirándola (Dlx, 26/10/2026: «eso de principal ponlo en otro lado porque puede ser
  // confuso»: en el Inventario era una pestaña más al lado del TAG y el marco)
  const [princ, setPrinc] = useState(false);
  const hacerPrincipal = (c) => {
    setPrinc(true);
    pasePost('carta-principal', { carta: c }).then((d) => {
      setPrinc(false);
      avisar(d && d._ok ? (c ? 'Listo: es tu carta principal' : 'Listo: vuelve a lo de siempre') : 'No se pudo guardar. Prueba de nuevo.');
      refrescarPases();
    });
  };
  // ✕, Escape y tocar afuera: se va en 200 ms en vez de desaparecer de golpe; con «Menos animaciones», al instante
  const cerrar = () => {
    if (sale) return;
    const quieta = (raiz.current && raiz.current.closest('.calma')) || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (quieta) { onCerrar(); return; }
    setSale(true);
    setTimeout(onCerrar, 160);
  };
  const cerrarRef = useRef(cerrar);
  cerrarRef.current = cerrar;
  // Escape cierra, ← → pasan de carta, la página de atrás no se mueve, y el foco vuelve a donde estaba
  useEffect(() => {
    const antes = document.activeElement;
    const tecla = (e) => {
      if (e.key === 'Escape') cerrarRef.current();
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); irRef.current(e.key === 'ArrowRight' ? 1 : -1); }
    };
    window.addEventListener('keydown', tecla);
    const o = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    // el foco a la ✕ que se ve: en el celular la de la ficha, en la compu la de la esquina
    const x1 = raiz.current && [...raiz.current.querySelectorAll('.vk-x')].find((b) => b.offsetParent);
    if (x1) x1.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', tecla);
      document.documentElement.style.overflow = o;
      if (antes && antes.focus) { try { antes.focus({ preventScroll: true }); } catch (e) { /* ya no está */ } }
    };
  }, [onCerrar]);
  // 🎞️ la carta sale de donde la tocaste (una vez, al abrir; con «Menos animaciones» o el sistema en reducido, no)
  useEffect(() => {
    const desde = desde0;
    const el = raiz.current;
    if (!desde || !el || el.closest('.calma') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const img = el.querySelector('.vk-sl.vk-cur img');
    if (!img || !img.animate) return;
    const ir2 = () => {
      const b = img.getBoundingClientRect();
      if (!b.width) return;
      img.animate([{ transformOrigin: '0 0', transform: 'translate(' + (desde.left - b.left) + 'px,' + (desde.top - b.top) + 'px) scale(' + (desde.width / b.width) + ')' },
        { transformOrigin: '0 0', transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' });
    };
    (img.decode ? img.decode() : Promise.resolve()).then(ir2, ir2);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // 👆 deslizar para pasar de carta (y tocar la de al lado la trae al medio). ⚠️ El navegador manda un click DESPUÉS
  // de soltar, y para entonces la carta que estaba en el medio ya es la de al lado: su «tocar para traerla» la volvía
  // a poner (medido: arrastrar no cambiaba nada). Por eso el click que llega justo después de un deslizar se ignora
  const arr = useRef({ x0: null });
  const cc = useRef(null);
  const desliz = useRef(0);
  // 🖼️ cada carta que ya estuvo cerca queda montada: crearla y decodificarla de nuevo al pasar era un tirón
  const vistos = useRef(new Set());
  const listas = useRef(new Set());
  // 🖼️ las tres que siguen hacia cada lado se bajan y se decodifican de antemano: al llegar, la imagen ya está lista y
  // montarla no frena el paso (medido: era el tirón que quedaba al pasar de carta)
  // (recién después de abrir: al mismo tiempo que la apertura, en un celular frenado, le robaba cuadros)
  const abierta = useRef(Date.now());
  useEffect(() => {
    const t = setTimeout(() => {
      items.forEach((y, j) => {
        if (Math.abs(j - i) > 3 || !y.url || listas.current.has(y.url)) return;
        listas.current.add(y.url);
        const im = new Image();
        im.decoding = 'async';
        im.src = y.url;
        if (im.decode) im.decode().catch(() => { /* la carta se pide igual al montarse */ });
      });
    }, Math.max(0, 650 - (Date.now() - abierta.current)));
    return () => clearTimeout(t);
  }, [i, items]);
  // ↔️ en la compu, ‹ › en las orillas pasan a la persona de al lado en la tabla de la temporada
  const vecinos = useMemo(() => {
    const L = Object.values(liga.T).filter((y) => y.pos && !y.fc).sort((a, b) => a.pos - b.pos);
    const j = L.findIndex((y) => y.k === k);
    return j < 0 ? [null, null] : [L[j - 1] || null, L[j + 1] || null];
  }, [liga.T, k]);
  if (!f) return null;
  const nombre = limpio(f.n);
  const tipo = x ? x.tipo : '';
  const vieja = x && !x.bloq && tipo !== 'liga' && liga.cartaVieja(k, tipo);
  // 🖼️ la descarga, con su marco si lo tiene en la imagen (bot/con_marco.py): lo mismo que manda /card
  const conMarco = x && !x.bloq && tipo !== 'liga' && pub && pub.mi && (pub.mi[k] || []).includes(tipo);
  const urlBajar = x ? (conMarco ? x.url.replace('/' + tipo + '.webp', '/' + tipo + '-m.webp') : x.url) : '';
  const crew = liga.crewDe ? liga.crewDe(f) : null;
  const sv = f.sv && liga.svs[f.sv];
  const enTabla = !!liga.T[k];
  const u = ultimoEv(f, esYo);
  const color = /^#[0-9a-f]{3,8}$/i.test(f.rgc || '') ? f.rgc : '#29B298';
  // 🖼️ lo que eligió para «El escenario de tu carta» en Tus fondos (17/11/2026): su imagen, su bandera o su servidor,
  // apagado detrás de la luz del rango. En automático, sólo la luz, como siempre
  const escF = fondoEn((fondos || {})[k], 'esc', { cc: f.cc, sv: f.sv });
  const compartir = async () => {
    const url = enlace('#/r/' + encodeURIComponent(k));
    const texto = (esYo ? 'Mi carta' : 'La carta de ' + nombre) + ' en la Liga Global';
    const tactil = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    if (navigator.share && tactil) {
      try { await navigator.share({ title: 'Liga Global', text: texto, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); avisar(esYo ? 'Link de tu perfil copiado' : 'Link de su perfil copiado'); } catch (e) { avisar('No pude copiarlo'); }
  };
  const gir = (e) => {
    if (e.pointerType !== 'mouse' || !gira.current || arr.current.va || (raiz.current && raiz.current.closest('.calma'))) return;
    gira.current.style.transition = 'transform .12s ease-out';
    const r = gira.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    gira.current.style.transform = 'perspective(900px) rotateY(' + ((px - 0.5) * 12).toFixed(2) + 'deg) rotateX(' + ((0.5 - py) * 10).toFixed(2) + 'deg)';
  };
  const quieto = () => { if (gira.current) { gira.current.style.transition = ''; gira.current.style.transform = ''; } };
  // 👆 arrastrar mueve la caja entera con un `transform` (sólo la placa de video); al soltar vuelve con transición mientras
  // las cartas van a su lugar nuevo. Con una variable CSS se recalculaban todas las cartas en cada movimiento del dedo
  const soltar = () => { const el = cc.current; if (el) { el.style.transition = ''; el.style.transform = ''; } };
  const tipoNav = x && !x.bloq && ORDEN.includes(x.tipo) ? x.tipo : '';
  const aPersona = (y, dir) => { window.__lgVkSigue = { t: Date.now(), dir }; window.dispatchEvent(new CustomEvent('lg:carta', { detail: y.k + (tipoNav ? '|' + tipoNav : '') })); };
  items.forEach((y, j) => { if (Math.abs(j - i) <= 2) vistos.current.add(y.id); });
  const dueno = esYo && x && !x.bloq && tipo !== 'liga';
  return (
    <div className={'vk' + (dueno ? ' vk-yo' : '') + (desde0 ? ' vk-flip' : '') + (sigue ? ' vk-sigue' : '') + (sale ? ' vk-sale' : '')} ref={raiz} role="presentation"
      style={sigue ? { '--dir': sigue } : undefined} onClick={(e) => { if (e.target === e.currentTarget || e.target.classList.contains('vk-in')) cerrar(); }}>
      <div className="vk-in" role="dialog" aria-modal="true" aria-label={'Las tarjetas de ' + nombre}>
        <div className={'vk-esc' + (escF ? ' con-fondo' : '')} style={{ '--g': color }}>
          {escF ? <span className="vk-esc-f" style={{ backgroundImage: escF }} aria-hidden="true" /> : null}
          <div className="vk-cc" ref={cc} onPointerDown={(e) => { arr.current = { x0: e.clientX, va: false }; }}
            onPointerMove={(e) => {
              const a = arr.current;
              if (a.x0 === null) return;
              let dx = e.clientX - a.x0;
              if (!a.va && Math.abs(dx) < 8) return;
              if (!a.va) { a.va = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) { /* sin captura */ } cc.current.style.transition = 'none'; quieto(); }
              if ((i === 0 && dx > 0) || (i === items.length - 1 && dx < 0)) dx *= 0.35;
              cc.current.style.transform = 'translateX(' + dx.toFixed(1) + 'px)';
            }}
            onPointerCancel={() => { arr.current = { x0: null }; soltar(); }}
            onPointerUp={(e) => {
              const a = arr.current;
              arr.current = { x0: null };
              if (a.x0 === null) return;
              const dx = e.clientX - a.x0;
              soltar();
              if (a.va) desliz.current = Date.now();
              if (a.va && Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1);
            }}
            onClickCapture={(e) => { if (Date.now() - desliz.current < 500) { e.stopPropagation(); e.preventDefault(); } }}>
            {items.length ? items.map((y, j) => {
              const d = j - i, a = Math.abs(d);
              return (
                <div key={y.id} className={'vk-sl' + (a === 0 ? ' vk-cur' : a === 1 ? ' vk-lado' : '')} aria-hidden={a !== 0}
                  style={{ '--d': Math.sign(d) * Math.min(a, 2), '--k': a === 0 ? 1 : a === 1 ? 0.84 : 0.7, opacity: a === 0 ? 1 : a === 1 ? 0.5 : 0, zIndex: 10 - a, pointerEvents: a <= 1 ? undefined : 'none' }}
                  onClick={a === 1 ? () => setSel(y.id) : undefined}
                  onPointerMove={a === 0 ? gir : undefined} onPointerLeave={a === 0 ? quieto : undefined}>
                  {vistos.current.has(y.id) ? (
                    <div className="vk-gira" ref={a === 0 ? gira : undefined}>
                      <img src={y.url} alt={a === 0 ? 'Tarjeta ' + (y.tipo === 'liga' ? 'de liga ' + y.nom : y.nom) + ' de ' + nombre + (y.bloq ? ', bloqueada' : '') : ''} draggable="false" decoding="async" />
                    </div>
                  ) : null}
                </div>
              );
            }) : <p className="vk-sin">Todavía no tiene ninguna tarjeta emitida.</p>}
          </div>
          {items.length > 1 ? (
            <div className="vk-et">
              <button type="button" className="vk-fl" onClick={() => ir(-1)} disabled={i === 0} aria-label="Carta anterior">‹</button>
              <span aria-live="polite"><span className="vk-etx" key={x.id}><b>{x.nom}</b>{(x.sub ? x.sub + ' · ' : '') + (i + 1) + ' de ' + items.length}</span></span>
              <button type="button" className="vk-fl" onClick={() => ir(1)} disabled={i === items.length - 1} aria-label="Carta siguiente">›</button>
            </div>
          ) : null}
        </div>
        <div className="vk-ficha">
          <div className="vk-cab">
            <div className="vk-q">
              <span className="vk-pos">{f.pos && !f.fc ? '#' + f.pos + ' de la temporada' : f.fc ? 'Fuera de concurso' : 'Sin eventos esta temporada'}</span>
              <h2>{nombre}</h2>
            </div>
            <button type="button" className="vk-x vk-xf" onClick={cerrar} aria-label="Cerrar"><Ico n="cerrar" t={20} /></button>
          </div>
          <ul className="vk-filas">
            {f.cc ? <li><a href={'#/pais/' + f.cc} onClick={onCerrar}><span className="vk-k">País</span><span className="vk-v"><Bandera cc={f.cc} cls="vk-flag" />{nombrePais(f.cc)}</span><i aria-hidden="true">›</i></a></li> : null}
            {f.sv ? <li><a href={'#/sv/' + siglaDe(f.sv)} onClick={onCerrar}><span className="vk-k">Servidor</span><span className="vk-v">{(sv && sv.nombre) || siglaDe(f.sv)}</span><i aria-hidden="true">›</i></a></li> : null}
            {crew ? <li><a href={'#/crew/' + encodeURIComponent(crew.clave || crew.crew)} onClick={onCerrar}><span className="vk-k">Crew</span><span className="vk-v">{limpio(crew.crew)}</span><i aria-hidden="true">›</i></a></li> : null}
            {u ? <li><div><span className="vk-k">Último evento</span><span className="vk-v">{u.dia + ' · '}{u.camp ? <em>{u.res}</em> : u.res}</span></div></li> : null}
          </ul>
          {vieja ? <p className="vk-aviso">⏳ Esta tarjeta se está redibujando con los datos de ahora.</p> : null}
          {x && x.mide ? <p className="vk-mide" key={x.id}><b>{x.nom}</b>{' ' + x.mide}</p> : null}
          <div className="vk-acc">
            {x ? (
              <button type="button" className="vk-bl" disabled={yendo}
                onClick={() => { setYendo(true); bajar(urlBajar, nombre.replace(/[\\/:*?"<>|]/g, '') + ' - ' + (tipo === 'liga' ? 'Liga ' + x.nom : NOMBRE[tipo] || tipo) + (x.bloq ? ' (bloqueada)' : '') + '.png', () => setYendo(false)); }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
                {yendo ? 'Bajando…' : 'Descargar'}
              </button>
            ) : null}
            {!dueno && enTabla ? <a className="vk-bo" href={'#/r/' + encodeURIComponent(k)} onClick={onCerrar}>{esYo ? 'Ver tu perfil' : 'Ver su perfil'}</a> : null}
            <button type="button" className="vk-bi" onClick={compartir} aria-label="Compartir"><Ico n="compartir" t={20} /></button>
            {dueno ? (
              <div className="vk-fila2">
                <button type="button" className="vk-bo" disabled={princ} onClick={() => hacerPrincipal(cp === tipo ? '' : tipo)}>{cp === tipo ? '★ Tu principal' : '☆ Hacer principal'}</button>
                {/* ✏️ la puerta 2 del Inventario (26/10/2026): de tu carta, directo a personalizarla */}
                <a className="vk-bo" href={'#/inventario/' + tipo} onClick={onCerrar}>✏️ Personalizar</a>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <button type="button" className="vk-x vk-xg" onClick={cerrar} aria-label="Cerrar"><Ico n="cerrar" t={20} /></button>
      {vecinos[0] ? <button type="button" className="vk-per vk-pl" onClick={() => aPersona(vecinos[0], -1)} aria-label={'Anterior: ' + limpio(vecinos[0].n)}>‹<small>{'#' + vecinos[0].pos + ' ' + limpio(vecinos[0].n)}</small></button> : null}
      {vecinos[1] ? <button type="button" className="vk-per vk-pr" onClick={() => aPersona(vecinos[1], 1)} aria-label={'Siguiente: ' + limpio(vecinos[1].n)}>›<small>{'#' + vecinos[1].pos + ' ' + limpio(vecinos[1].n)}</small></button> : null}
      {aviso ? <div className="vk-toast" role="status">{aviso}</div> : null}
    </div>
  );
}
