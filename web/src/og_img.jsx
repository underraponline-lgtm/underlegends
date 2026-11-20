// 🖼️ LAS IMÁGENES DE `/perfil` Y `/vitrina` (la tanda 2 de los comandos del bot, 20/11/2026). Dlx aprobó las dos en la
// maqueta: `/perfil` es «A · la portada» (1200 × 760) y `/vitrina`, «la combinación» (1200 × 960, o × 820 con cinco trofeos
// o menos). La respuesta de los dos comandos es SÓLO la imagen, como `/card`.
//
// La dibuja la página (`#/og/perfil-img/<clave>` y `#/og/vitrina-img/<clave>`) y le saca la foto bot/og_links.py, como el
// cartel del link de cada perfil: los números salen de LAS MISMAS CUENTAS que el perfil de la página (perfil_datos.js,
// emblemas.jsx, fondos.js, roles.js…), así la imagen y la página no pueden decir dos cosas distintas.
//
// 🔏 EL SELLO (`data-sello`): una huella de TODO lo que la imagen muestra, menos lo que sale de un pedido por persona (su rol
// en DRA y los emblemas que eligió, `perfil-extra`). Lo calcula también `#/og/img-sellos/<t>` para todos de una vez —una
// sola carga de página— y el ciclo redibuja a quien le cambió. Lo de un pedido por persona se pone al día cuando cambia
// otra cosa o a la semana (ver `VIEJA_DIAS` en bot/og_links.py).
//
// ⚠️ SÓLO PARA EL FOTÓGRAFO: la monta `OgLink` (og_link.jsx) detrás de `paraLaFoto()`; quien entra a la página no la ve.
// ⚠️ Las clases van con `oi-` (css/og_img.css): las de la maqueta —`.cara`, `.tag`, `.panel`— ya existen en el shadow root.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { limpio, num, siglaDe } from './liga.js';
import { escenaDe, fondoEn } from './fondos.js';
import { textoRol } from './roles.js';
import { Arte, emblemasDe } from './emblemas.jsx';
import { nombrePais } from './piezas.jsx';
import { CORTO, datosV10, eloDe, fecha, ini, nomEv, pu, sinB } from './perfil_datos.js';
import CSS_PAGINA from './css/og_img.css?inline';
import { usarCss } from './css.js';

usarCss('og_img', CSS_PAGINA);

//: el diseño de estas dos imágenes: entra en el sello, así cambiarlo las redibuja a todas (de a `MAX_IMG` por corrida).
//: ⚠️ el mismo `DISENO_IMG` de bot/og_links.py: si la página publicada dice otro, el ciclo no saca la foto
export const DISENO_IMG = 'img-1';
const ALTO_PERFIL = 760;
const DIA_MS = 864e5;
const ORDEN = ['temporada', 'competitivo', 'servidor', 'pais'];

// ── 📦 lo de todos, una vez: los mismos pedidos de la página (fondos.js, roles.js, racha.js, pase.js, elegidos.js, social.js,
// crews.js y /api/perfiles). Cada uno dice si llegó: con uno caído la imagen NO sale (sería otra imagen con el mismo sello)
const json = (u) => fetch(u, { headers: { accept: 'application/json' } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
let todo = null;
function pedirTodo() {
  if (todo) return todo;
  todo = Promise.all([
    typeof window.perfiles === 'function' ? Promise.resolve(window.perfiles()).catch(() => null) : json('/api/perfiles'),
    json('/api/avisos/fondos'), json('/api/avisos/roles'), json('/api/avisos/niveles'), json('/api/avisos/pases'),
    json('/api/avisos/servidores'), json('/api/avisos/seguidores'), json('/api/avisos/crews'),
  ]).then(([P, fo, ro, ni, pa, se, sg, cw]) => {
    const B = { P, fondos: fo && fo.f, roles: ro && ro.r, niveles: ni && ni.n, pases: pa && pa.n ? pa : null,
      eleg: se && se.n && typeof se.n === 'object' ? se.n : null, seg: sg && sg.n ? sg.n : null, crews: cw && Array.isArray(cw.crews) ? cw.crews : null };
    B.ok = !!(P && P.p && B.fondos && B.roles && B.niveles && B.pases && B.eleg && B.seg && B.crews);
    if (!B.ok) todo = null;                     // la próxima vez se vuelve a pedir
    return B;
  });
  return todo;
}
function useTodo() {
  const [B, setB] = useState(null);
  useEffect(() => { let vivo = true; pedirTodo().then((x) => { if (vivo) setB(x); }); return () => { vivo = false; }; }, []);
  return B;
}

/** 🔏 Una huella corta y estable de un texto (cyrb53, 10 caracteres hex) */
export function huellaImg(s) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  const t = String(s);
  for (let i = 0; i < t.length; i++) {
    const ch = t.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0').slice(-10);
}

// la rareza por el % de la gente que la tiene: la misma regla que la Colección (coleccion.jsx `RAREZA`)
const RAREZA = (p) => (p == null ? '' : p >= 20 ? 'Común' : p >= 5 ? 'Rara' : p >= 1 ? 'Épica' : 'Legendaria');
const pctTxt = (p) => (!p ? 'nadie todavía' : String(p < 1 ? p.toFixed(2) : p < 10 ? p.toFixed(1) : Math.round(p)).replace('.', ',') + ' %');
const RARZ = [['Comunes', 'Común'], ['Raras', 'Rara'], ['Épicas', 'Épica'], ['Legendarias', 'Legendaria']];
const COL_RAR = { Común: 'var(--rar-comun)', Rara: 'var(--rar-rara)', Épica: 'var(--rar-epica)', Legendaria: 'var(--rar-leg)' };
const primeraUrl = (bg) => { const m = /url\("([^"]+)"\)/.exec(bg || ''); return m ? m[1] : ''; };
const wrTxt = (wr) => (wr ? String(Math.round(parseFloat(String(wr).replace(',', '.')) || 0)) + ' %' : '—');

/** La fila de alguien: la de la tabla o la de su perfil (quien no entra en las 200 la trae en /api/perfiles) */
const filaDe = (liga, P, k) => liga.T[k] || (P && P.p && P.p[k] && P.p[k].f ? Object.assign({ k }, P.p[k].f) : null);

/**
 * 🧩 LO QUE MUESTRAN LAS DOS IMÁGENES, como datos sueltos (textos, números y direcciones): el dibujo sale sólo de acá, y el
 * sello es la huella de esto. `ex` es lo de un pedido por persona (`perfil-extra`): con `null`, lo que va en el sello.
 */
export function modelos(liga, B, k, ex) {
  const f = filaDe(liga, B.P, k);
  if (!f) return null;
  const p = (B.P.p && B.P.p[k]) || null;
  const E = B.P.e || {};
  const D = datosV10(liga, k, f, p, E);
  const n = limpio(f.n || k);
  const cara = liga.avUrl(k, 512) || (liga.avNombre ? liga.avNombre(f.n, 512) : '') || '';
  // 🏠 el servidor que eligió (el de su perfil); si no eligió, donde juega. El fondo: su «Tu perfil» de Tus fondos, y si
  // no, la escena de ese servidor (nunca la de otro: `escenaDe()` da '' a quien no tiene)
  const svE = B.eleg[k] && liga.svs[B.eleg[k]] ? B.eleg[k] : '';
  const sv = svE || f.sv || '';
  const fo = B.fondos[k];
  const esc = escenaDe(sv);
  const fondo = fondoEn(fo, 'perfil', { cc: f.cc, sv }) || (esc ? 'url("' + esc + '")' : '');
  const rgc = f.rg ? liga.colorRg(f.rg) : '';
  const e = eloDe(liga, k);
  const elo = e ? { v: num(e.elo), piedra: e.piedra + ' ' + e.sub, c: e.c } : null;
  const temp = String(liga.temp || 'T1').toUpperCase();
  // 🔰 los emblemas, como `useEmblemas()` de perfil.jsx
  const ev = (p && p.ev) || [];
  const ts = ev.map(([x]) => Date.parse((E[x] || E[String(x)] || [])[2] || '')).filter((x) => !isNaN(x));
  const dias = ts.length ? Math.max(0, Math.floor((Date.now() - Math.min(...ts)) / DIA_MS)) : null;
  const propio = String(f.sv || '').toLowerCase();
  const cartas = ORDEN.filter((c) => (f.c || []).includes(c)).length + ((p && p.svc) || []).filter((x) => x !== propio).length;
  const promos = ((p && p.mu) || []).filter((it) => it.tipo === 'promo').length;
  const pa = (B.pases.n || {})[k];
  const crew = (B.crews || []).find((c) => (c.gente || []).some((g) => g[0] === k));
  const crewRol = crew ? ((crew.gente || []).find((g) => g[0] === k) || [])[1] : '';
  const rls = (B.roles || {})[k] || [];
  const nv = (B.niveles || {})[k];
  const ems = emblemasDe({ dias, vd: p && p.vd, pase: pa ? pa[0] : null, racha: nv ? nv[1] : null, seg: (B.seg || {})[k] || 0,
    crewRol, cartas, promos, roles: rls.map((x) => x[0]), aplausos: ex ? ex.apl : null, voz: ex ? ex.voz : null, elegidos: (ex && ex.em) || [] });
  const nEle = ems.filter((x) => x.ele).length;
  const ver = ems.slice(0, nEle || 5);
  const chips = [];
  if (rls.length) chips.push(['', textoRol(rls[0])]);
  if (ex && ex.dra) chips.push(['', ex.dra + ' en DRA']);
  if (f.cc) chips.push(['pais', nombrePais(f.cc), f.cc]);
  if (sv) chips.push(['b', siglaDe(sv)]);
  if (nv) chips.push(['', 'Nivel ' + nv[0]]);
  if (pa) chips.push(['', 'Pase' + (pa[0] ? ' ' + pa[0] : '')]);
  // 🥊 el récord, la forma y la mejor noche: lo mismo que «El récord» y «Su mejor noche» del perfil (perfil_v10.jsx)
  const tot = D.g + D.perd;
  const rk = (p && p.rk) || {};
  const forma = D.enT.slice(-5).reverse().map((x) => [CORTO[x.pu] || 'R32', pu(x.pu)[1]]);
  let noche = null;
  if (D.mejor) {
    const x = D.porEv[D.mejor.n] || { gano: [], cayo: '' };
    noche = { res: pu(D.mejor.pu)[0], sv: siglaDe(D.mejor.sv), nom: limpio(nomEv(D.mejor)), pts: D.mejor.pts, gente: D.mejor.gente, gano: x.gano.length,
      vs: x.gano.slice(-3).map((r) => { const q = liga.quien(r); return [sinB(q ? q.n : r), q ? liga.avUrl(q.k, 64) || '' : '']; }) };
  }
  const perfil = {
    k, n, cara, ini: ini(n), fondo, tag: (f.solo ? 'En la Liga' : f.pos ? '#' + f.pos + ' de la Temporada' : 'Fuera de concurso') + ' · ' + temp,
    color: pa && pa[2] ? pa[2] : '', emb: ver.map((x) => [x.g, x.t, !!x.unico, x.rol || '']), mas: Math.max(0, ems.length - ver.length), chips,
    ovr: f.ovr || 0, rg: f.rg || '', rgc, elo, pts: num(f.pts || 0), ev: f.ev || 0, wr: wrTxt(f.wr),
    rec: tot ? [D.g, D.perd, Math.round((100 * D.g) / tot), rk.du ? rk.du : null] : null, forma, oro: D.oro, seg: D.seg, noche,
  };

  // 🏆 LA VITRINA: los títulos y las finales por IMPORTANCIA (cuánta gente jugó), los títulos primero
  const placa = (x, plata) => {
    const y = E[x[0]] || E[String(x[0])] || [];
    const s = y[1] || '';
    const t = y[2] ? Date.parse(y[2]) : 0;
    const nom = limpio(nomEv({ nom: limpio(y[0] || 'Evento ' + x[0]), sv: siglaDe(s), t }));
    return { nom, sv: siglaDe(s), fecha: t ? fecha(t) : '', gente: Number(y[3]) || 0, t, plata, esc: escenaDe(s), col: (liga.svs[s] || {}).color || '#2a1050' };
  };
  const imp = (a, b) => b.gente - a.gente || b.t - a.t;
  const tit = ev.filter((x) => x[1] === 'Campeón').map((x) => placa(x, false)).sort(imp);
  const fin = ev.filter((x) => x[1] === 'Subcampeón').map((x) => placa(x, true)).sort(imp);
  const todas = (tit.length ? tit : ['vacia']).concat(fin);
  const mostradas = todas.slice(0, 10).filter((x) => x !== 'vacia').length;
  // la letra y el puesto del Competitivo: el `#` de su vitrina (`rk.co` de /api/perfiles, `_perfiles()` de bot/subir_web.py:
  // sin los de fuera de concurso y con el desempate del Score sin redondear). Mientras el payload no lo traiga, el de la
  // tabla del lobby por Score (lo que muestra el Ranking Competitivo de la página); fuera de concurso, sin número («—»)
  const comp = Object.values(liga.T || {}).filter((x) => x && x.rg && !x.fc).sort((a, b) => (Number(b.sc) || 0) - (Number(a.sc) || 0));
  const ci = f.fc ? -1 : rk.co ? Number(rk.co[0]) - 1 : comp.findIndex((x) => x.k === k);
  // 🏅 la colección, por rareza sobre el catálogo (como la Colección del Inventario): cuánta gente la tiene, de los perfiles
  const cat = (liga.d && liga.d.insignias) || [];
  const todos = Object.values(B.P.p || {});
  const de = {};
  for (const x of todos) for (const i of x.ins || []) de[i[0]] = (de[i[0]] || 0) + 1;
  const pct = (id) => (todos.length ? (100 * (de[id] || 0)) / todos.length : null);
  const mias = new Set(((p && p.ins) || []).map((x) => x[0]));
  const barras = RARZ.map(([et, r]) => {
    const xs = cat.filter((x) => RAREZA(pct(x[0])) === r);
    return [et, r, xs.filter((x) => mias.has(x[0])).length, xs.length];
  }).filter((x) => x[3]);
  const suyas = cat.filter((x) => mias.has(x[0])).sort((a, b) => pct(a[0]) - pct(b[0]));
  let ins;
  if (suyas.length > 5) {
    ins = suyas.slice(0, 4).map((x) => [x[1], x[2], RAREZA(pct(x[0])), pctTxt(pct(x[0])), 0])
      .concat([['+' + (suyas.length - 4), 'Más', 'Común', 'en la página', 2]]);
  } else {
    // con pocas, lo próximo: las que tiene más gente y él todavía no (las más fáciles), apagadas
    const prox = cat.filter((x) => !mias.has(x[0])).sort((a, b) => pct(b[0]) - pct(a[0])).slice(0, 5 - suyas.length);
    ins = suyas.map((x) => [x[1], x[2], RAREZA(pct(x[0])), pctTxt(pct(x[0])), 0])
      .concat(prox.map((x) => [x[1], x[2], RAREZA(pct(x[0])), 'Lo próximo', 1]));
  }
  const vitrina = {
    k, n, cara, ini: ini(n), fondo, rg: f.rg || '', rgc, pc: ci >= 0 ? ci + 1 : 0, elo,
    oro: D.oro, seg: D.seg, ter: D.ter, placas: todas.slice(0, 10), resto: Math.max(0, tit.length + fin.length - mostradas),
    barras, ins, nIns: mias.size,
  };
  return { perfil, vitrina };
}

/** 🔏 Los dos sellos de alguien: la huella de lo que muestra cada imagen, sin lo de un pedido por persona.
 *  ⚠️ SIN EL «0,30 %» DE CADA INSIGNIA: el porcentaje se mueve con cada perfil nuevo de la Liga, y con él adentro las
 *  vitrinas de todos cambiarían de sello a cada rato. Entra la rareza (Común… Legendaria), que es lo que se lee de lejos;
 *  el número queda como estaba en la última foto hasta que cambie otra cosa */
export function sellosDe(liga, B, k) {
  const m = modelos(liga, B, k, null);
  if (!m) return null;
  const vit = Object.assign({}, m.vitrina, { ins: m.vitrina.ins.map((x) => (x[4] === 0 ? [x[0], x[1], x[2], '', 0] : x)) });
  return [huellaImg(JSON.stringify([DISENO_IMG, 'p', m.perfil])), huellaImg(JSON.stringify([DISENO_IMG, 'v', vit]))];
}

// ── 🖼️ esperar a que esté todo: las imágenes bajadas y las letras puestas ──
function cargar(u) {
  return new Promise((ok) => {
    if (!u) { ok(); return; }
    const im = new Image();
    const t = setTimeout(ok, 15000);
    im.onload = im.onerror = () => { clearTimeout(t); ok(); };
    im.src = u;
  });
}
const urlsDe = (bg) => [...String(bg || '').matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]);
function useListo(urls, clave) {
  const [listo, setListo] = useState('');
  useEffect(() => {
    let vivo = true;
    const fuentes = document.fonts && document.fonts.load
      ? Promise.all(['400 40px Anton', '700 16px "Barlow Condensed"', '900 20px Archivo', '400 18px Archivo'].map((x) => document.fonts.load(x).catch(() => null)))
      : Promise.resolve();
    Promise.all([fuentes, ...urls.map(cargar)]).then(() => (document.fonts && document.fonts.ready) || null)
      .then(() => new Promise((r) => setTimeout(r, 120))).then(() => { if (vivo) setListo(clave); });
    return () => { vivo = false; };
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps
  return listo === clave;
}
/** 🔠 Lo que tiene `data-max`, del tamaño que entre en su caja (de a 2 px, hasta `data-min`): un nombre largo no se corta */
function encajar(raiz) {
  if (!raiz) return;
  raiz.querySelectorAll('[data-max]').forEach((el) => {
    const max = Number(el.dataset.max), min = Number(el.dataset.min || 20);
    let px = max;
    el.style.fontSize = px + 'px';
    while (px > min && el.scrollWidth > el.clientWidth + 1) { px -= 2; el.style.fontSize = px + 'px'; }
  });
}

const Cara = ({ m, px, borde }) => (
  <div className="oi-cara" style={{ width: px, height: px, borderWidth: borde, fontSize: Math.round(px / 3) }}>
    {m.cara ? <img src={m.cara} alt="" /> : m.ini}
  </div>
);
const Copa = ({ plata }) => (
  // la copa dibujada y no un emoji: el emoji lo pone la máquina que saca la foto, y cada una lo dibuja distinto
  <svg className="oi-copa" viewBox="0 0 20 26" aria-hidden="true">
    <path d="M3 2h14l-1 8q-1 6-6 6t-6-6z" fill={plata ? '#D9DCE2' : '#F5C542'} />
    <path d="M3 4H1q0 5 3 6M17 4h2q0 5-3 6" fill="none" stroke={plata ? '#D9DCE2' : '#F5C542'} strokeWidth="1.6" />
    <rect x="8.5" y="16" width="3" height="5" fill={plata ? '#AEB3BC' : '#C8920F'} />
    <rect x="5" y="21" width="10" height="3" rx="1" fill={plata ? '#AEB3BC' : '#C8920F'} />
  </svg>
);
const Pie = ({ temp }) => (
  <div className="oi-pie">
    <img src="/ul-blanco.png" alt="Under Legends" />
    <span className="oi-ic">Liga Global · {temp} · <b>underlegends.pages.dev</b></span>
  </div>
);

// ════════ /perfil · «A · la portada» ════════
function DibujoPerfil({ m, temp }) {
  const nEmb = m.emb.length + (m.mas ? 1 : 0);
  const maxNombre = 886 - (nEmb ? nEmb * 48 + 18 : 0);
  return (
    <>
      <div className={'oi-fondo' + (m.fondo ? ' real' : '')} style={m.fondo ? { backgroundImage: 'linear-gradient(180deg,rgba(7,7,10,.05) 0%,rgba(7,7,10,.35) 55%,#07070A 100%),' + m.fondo } : undefined} />
      <div style={{ position: 'absolute', left: 48, top: 150, right: 48, display: 'flex', gap: 28, alignItems: 'flex-end' }}>
        <Cara m={m} px={190} borde={5} />
        <div style={{ display: 'grid', gap: 10, paddingBottom: 6, minWidth: 0 }}>
          <span className="oi-tag">{m.tag}</span>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', minWidth: 0 }}>
            <div className="oi-nombre" data-max="112" data-min="56" style={{ maxWidth: maxNombre, color: m.color || undefined }}>{m.n}</div>
            {nEmb ? (
              <div className="oi-emb">
                {m.emb.map(([g, t, unico, rol], i) => <span key={i}><Arte g={g} t={t} px={30} unico={unico} rol={rol} /></span>)}
                {m.mas ? <span><i>+{m.mas}</i></span> : null}
              </div>
            ) : null}
          </div>
          {m.chips.length ? (
            <div className="oi-chips">
              {m.chips.map(([t, x, cc], i) => (t === 'pais' ? <span key={i}><b><img className="oi-flag" src={'/banderas/g/' + cc + '.webp'} alt="" />{x}</b></span>
                : t === 'b' ? <span key={i}><b>{x}</b></span> : <span key={i}>{x}</span>))}
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 48, right: 48, top: 392, display: 'flex', gap: 22, alignItems: 'stretch' }}>
        {m.ovr ? (
          <div className="oi-ovr" style={m.rgc ? { '--rc': m.rgc } : undefined}>
            <b>{m.ovr}</b>{m.rg ? <i>{m.rg}</i> : null}<span className="oi-ic oi-v">OVR</span>
          </div>
        ) : null}
        {m.elo ? <div className="oi-elo" style={{ '--pc': m.elo.c }}><b>{m.elo.v}</b><span>ELO<br />{m.elo.piedra}</span></div> : null}
        <div className="oi-num" style={{ paddingLeft: 12 }}><b>{m.pts}</b><span>Puntos</span></div>
        <div className="oi-num"><b>{m.ev}</b><span>Eventos</span></div>
        <div className="oi-num"><b>{m.wr}</b><span>Win</span></div>
      </div>
      <div style={{ position: 'absolute', left: 48, right: 48, top: 510, display: 'grid', gridTemplateColumns: '300px 352px minmax(0,1fr)', gap: 18 }}>
        <div className="oi-panel">
          <span className="oi-ic">El récord · duelos 1v1</span>
          {m.rec ? (
            <>
              <div className="oi-rec">{m.rec[0]}<span>–{m.rec[1]}</span></div>
              <span className="oi-sub">{m.rec[2]} % ganados{m.rec[3] ? ' · #' + m.rec[3][0] + ' de ' + m.rec[3][1] + ' en Duelos' : ''}</span>
            </>
          ) : <div className="oi-vacio oi-sub"><b>Su primer duelo</b>El récord arranca en su primer 1v1 de una llave.</div>}
        </div>
        <div className="oi-panel">
          <span className="oi-ic">Su forma · {m.forma.length === 1 ? 'la última' : 'las últimas ' + m.forma.length}</span>
          {m.forma.length ? <div className="oi-forma">{m.forma.map(([t, c], i) => <span key={i} className={c}>{t}</span>)}</div>
            : <div className="oi-vacio oi-sub"><b>Sin eventos</b>Todavía no jugó esta temporada.</div>}
          <span className="oi-sub">{m.oro} {m.oro === 1 ? 'título' : 'títulos'} · {m.seg} {m.seg === 1 ? 'final' : 'finales'}</span>
        </div>
        {m.noche ? (
          <div className="oi-noche">
            <span className="oi-camp">Su mejor noche · {m.noche.res}{m.noche.sv ? ' · ' + m.noche.sv : ''}</span>
            <h4 data-max="44" data-min="24">{m.noche.nom}</h4>
            {m.noche.vs.length ? <div className="oi-vs">{m.noche.vs.map(([n, u], i) => <span key={i}>{u ? <img src={u} alt="" /> : <i>{ini(n)}</i>}{n}</span>)}</div> : null}
            <div className="oi-pts"><b>+{num(m.noche.pts)}</b>pts · <b>{m.noche.gente || '—'}</b>raperos{m.noche.gano ? ' · le ganó a ' + m.noche.gano : ''}</div>
          </div>
        ) : (
          <div className="oi-noche"><span className="oi-camp">Su primera noche</span><h4>Todavía no</h4>
            <div className="oi-pts">Con su primer evento, acá va su mejor noche.</div></div>
        )}
      </div>
      <Pie temp={temp} />
    </>
  );
}

// ════════ /vitrina · «la combinación» ════════
const GS = [-12, -6, 0, 6, 12], YS = [24, 8, 0, 8, 24];
function Placa({ x, st }) {
  if (x === 'vacia') return <div className="oi-placa vacia" style={st}><b>Tu primer título</b><span>va acá</span></div>;
  if (x === 'hueco') return <div className="oi-placa vacia hueco" style={st}><b /><span /></div>;
  // un nombre largo, en letra más chica: «Me quisiera morir pero no Multiverse Vol.2» no entra a 25 px en 122 de ancho
  const largo = x.nom.length > 26 ? ' larga' : x.nom.length > 16 ? ' media' : '';
  return (
    <div className={'oi-placa' + (x.plata ? ' plata' : '') + largo} style={st}>
      <div className="oi-pbg" style={x.esc ? { backgroundImage: 'url("' + x.esc + '")', backgroundColor: x.col } : { backgroundColor: x.col }} />
      <Copa plata={x.plata} />
      <span className="oi-sv">{x.sv}{x.fecha ? ' · ' + x.fecha : ''}{x.plata ? ' · final' : ''}</span>
      <b>{x.nom}</b>
      <span>{x.gente ? x.gente + ' raperos' : ''}</span>
    </div>
  );
}
/** Hasta 5 placas: la primera al medio y después a los costados (los costados vacíos, apagados) */
function abanico(items, gs, ys) {
  const lug = [null, null, null, null, null];
  items.slice(0, 5).forEach((x, i) => { lug[[2, 1, 3, 0, 4][i]] = x; });
  if (lug.some(Boolean) && !lug[1]) lug[1] = 'hueco';
  if (lug.some(Boolean) && !lug[3]) lug[3] = 'hueco';
  return lug.map((x, j) => (x ? <Placa key={j} x={x} st={{ '--g': gs[j] + 'deg', '--y': ys[j] + 'px', zIndex: j === 2 ? 3 : j === 1 || j === 3 ? 2 : 1 }} /> : null));
}
/** La fila de atrás: sin huecos, centrada con las que tiene; con 5, la primera al medio como adelante */
function atras(items) {
  const n = items.length;
  if (n === 5) return abanico(items, [-8, -4, 0, 4, 8], [14, 5, 0, 5, 14]);
  return items.map((x, i) => {
    const g = n === 1 ? 0 : -6 + (12 * i) / (n - 1);
    return <Placa key={i} x={x} st={{ '--g': g.toFixed(1) + 'deg', '--y': Math.trunc(Math.abs(g) * 1.4) + 'px', zIndex: 2 }} />;
  });
}
const altoVitrina = (m) => (m.placas.length > 5 ? 960 : 820);
function DibujoVitrina({ m, temp }) {
  const delante = m.placas.slice(0, 5), detras = m.placas.slice(5, 10);
  const dos = detras.length > 0;
  const med = (col, n, txt, nro) => <div className="oi-med"><i style={{ '--m': col }}>{nro}</i><div><b>{n}</b><span>{txt}</span></div></div>;
  return (
    <>
      {m.fondo ? <div className="oi-vfondo" style={{ backgroundImage: m.fondo }} /> : null}
      <div style={{ position: 'absolute', left: 48, right: 48, top: 30, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', minWidth: 0 }}>
          <Cara m={m} px={96} borde={3} />
          <div style={{ minWidth: 0 }}><span className="oi-ic">La vitrina de</span>
            <div className="oi-nombre" data-max="78" data-min="40" style={{ maxWidth: m.rg || m.elo ? 560 : 900 }}>{m.n}</div></div>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', flex: 'none' }}>
          {m.rg ? (
            <div className="oi-ovr oi-comp" style={{ '--rc': m.rgc, background: 'color-mix(in srgb,' + m.rgc + ' 12%,rgba(7,7,10,.6))' }}>
              <i>{m.rg}</i><span className="oi-ic">Competitivo<br /><b>{m.pc ? '#' + m.pc : '—'}</b></span>
            </div>
          ) : null}
          {m.elo ? <div className="oi-elo" style={{ '--pc': m.elo.c, background: 'rgba(10,20,40,.6)' }}><b>{m.elo.v}</b><span>ELO<br />{m.elo.piedra}</span></div> : null}
        </div>
      </div>
      {/* (en la de 820 empiezan más arriba y más juntas: a 186 el total tocaba la línea de la colección) */}
      <div className="oi-medallas" style={{ position: 'absolute', left: 48, top: dos ? 176 : 156, width: 250, gap: dos ? 18 : 12 }}>
        {med('#F5C542', m.oro, m.oro === 1 ? 'Título' : 'Títulos', 1)}
        {med('#C9CDD4', m.seg, m.seg === 1 ? 'Segundo puesto' : 'Segundos puestos', 2)}
        {med('#C98A4B', m.ter, m.ter === 1 ? 'Tercer puesto' : 'Terceros puestos', 3)}
        <div className="oi-tot"><b>{m.oro + m.seg + m.ter}</b><span>{m.oro + m.seg + m.ter === 1 ? 'trofeo en total' : 'trofeos en total'}</span></div>
      </div>
      {dos ? (
        <>
          <div style={{ position: 'absolute', left: 330, right: 40, top: 150 }}>
            <div className="oi-abanico atras" style={{ height: 236 }}>{atras(detras)}</div>
            <div className="oi-estante" style={{ margin: '0 150px', opacity: 0.85 }} />
          </div>
          <div style={{ position: 'absolute', left: 330, right: 40, top: 392 }}>
            <div className="oi-abanico" style={{ height: 262 }}>{abanico(delante, GS, YS)}</div>
            <div className="oi-estante" style={{ margin: '0 70px' }} />
          </div>
        </>
      ) : (
        <div style={{ position: 'absolute', left: 330, right: 40, top: 176 }}>
          <div className="oi-abanico" style={{ height: 270 }}>{abanico(delante, GS, YS)}</div>
          <div className="oi-estante" style={{ margin: '0 70px' }} />
        </div>
      )}
      {m.resto ? <div className="oi-ic oi-mas" style={{ top: dos ? 168 : 190 }}><b>+{m.resto}</b>en la página</div> : null}
      <div style={{ position: 'absolute', left: 48, right: 48, top: dos ? 696 : 500, display: 'grid', gridTemplateColumns: '400px 1fr', gap: 48,
        alignItems: 'start', borderTop: '1px solid rgba(255,255,255,.12)', paddingTop: 22 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <span className="oi-ic">Su colección · {m.nIns} {m.nIns === 1 ? 'insignia' : 'insignias'}</span>
          {m.barras.map(([et, r, n, t]) => (
            <div key={r} className="oi-cat"><span>{et}</span><u style={{ '--v': Math.round((100 * n) / t) + '%', '--col': COL_RAR[r] }} /><b>{n}/{t}</b></div>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          <span className="oi-ic">{m.nIns ? 'Sus insignias más raras' : 'Sus primeras insignias'}</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            {m.ins.map(([ic, nm, r, txt, cual], i) => (
              <div key={i} className={'oi-ins' + (cual === 1 ? ' bloq' : '')} style={{ '--rc': COL_RAR[r] || 'var(--rar-comun)' }}>
                <i className={cual === 2 ? 'mas' : undefined}>{ic}</i><b>{nm}</b><span>{cual === 2 || cual === 1 ? txt : r + ' · ' + txt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Pie temp={temp} />
    </>
  );
}

/** 🖼️ `#/og/perfil-img/<clave>` y `#/og/vitrina-img/<clave>`: la imagen, con `data-listo` cuando están las imágenes y las
 *  letras, `data-sello` (lo que el ciclo compara) y `data-alto` (cuánto se fotografía) */
export function OgImagen({ liga, tipo, k }) {
  const B = useTodo();
  const [ex, setEx] = useState(undefined);
  const raiz = useRef(null);
  useEffect(() => {
    let vivo = true;
    setEx(undefined);
    fetch('/api/avisos/perfil-extra', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ k }) })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => { if (vivo) setEx(d || null); });
    return () => { vivo = false; };
  }, [k]);
  const m = useMemo(() => (B && B.ok && ex !== undefined ? modelos(liga, B, k, ex) : null), [B, ex, k, liga]);
  const sellos = useMemo(() => (B && B.ok ? sellosDe(liga, B, k) : null), [B, k, liga]);
  const v = m ? (tipo === 'vitrina-img' ? m.vitrina : m.perfil) : null;
  const urls = !v ? [] : [v.cara, ...urlsDe(v.fondo), '/ul-blanco.png'].concat(tipo === 'vitrina-img'
    ? v.placas.filter((x) => x && x.esc).map((x) => x.esc)
    : (v.noche ? v.noche.vs.map((x) => x[1]) : []).concat(v.chips.filter((x) => x[0] === 'pais').map((x) => '/banderas/g/' + x[2] + '.webp')));
  const clave = v ? tipo + '|' + k + '|' + JSON.stringify(v) : '';
  const cargado = useListo(urls, clave);
  const [medido, setMedido] = useState('');
  useLayoutEffect(() => { if (cargado) { encajar(raiz.current); setMedido(clave); } }, [cargado, clave]);
  const temp = String(liga.temp || 'T1').toUpperCase();
  // (`data-k` y `data-t` en todas: el fotógrafo cambia de persona sin recargar y espera la de ESTA clave, no la anterior)
  if (B && !B.ok) return <div className="og oi" data-listo="1" data-falta="1" data-incompleto="1" data-d={DISENO_IMG} data-k={k} data-t={tipo} />;
  if (B && B.ok && !filaDe(liga, B.P, k)) return <div className="og oi" data-listo="1" data-falta="1" data-d={DISENO_IMG} data-k={k} data-t={tipo} />;
  if (!v) return <div className="og oi" data-d={DISENO_IMG} data-k={k} data-t={tipo} />;
  const alto = tipo === 'vitrina-img' ? altoVitrina(v) : ALTO_PERFIL;
  const sello = sellos ? sellos[tipo === 'vitrina-img' ? 1 : 0] : '';
  return (
    <div ref={raiz} className={'og oi ' + (tipo === 'vitrina-img' ? 'oi-vit' : 'oi-perfil')} style={{ height: alto }} data-d={DISENO_IMG} data-k={k}
      data-t={tipo} data-sello={sello} data-alto={alto} data-listo={cargado && medido === clave ? '1' : ''}>
      {tipo === 'vitrina-img' ? <DibujoVitrina m={v} temp={temp} /> : <DibujoPerfil m={v} temp={temp} />}
    </div>
  );
}

/** 🔏 `#/og/img-sellos/<t>`: los dos sellos de cada uno con carta, en `data-sellos` (`{clave: [perfil, vitrina]}`), para que el
 *  ciclo sepa a quién redibujar sin sacarle la foto a nadie. Con un pedido caído, `data-falta`: mejor ningún sello que uno
 *  calculado sin un dato */
export function OgSellos({ liga }) {
  const B = useTodo();
  const sellos = useMemo(() => {
    if (!B || !B.ok) return null;
    const out = {};
    const ks = new Set(Object.keys(liga.T || {}).concat(Object.keys(B.P.p || {})));
    for (const k of ks) {
      const f = filaDe(liga, B.P, k);
      if (!f || !(f.c || []).length) continue;
      try { const s = sellosDe(liga, B, k); if (s) out[k] = s; } catch (e) { /* esa persona no: las demás sí */ }
    }
    return out;
  }, [B, liga]);
  if (B && !B.ok) return <div className="og oi" data-listo="1" data-falta="1" data-d={DISENO_IMG} />;
  if (!sellos) return <div className="og oi" data-d={DISENO_IMG} />;
  return <div className="og oi" data-listo="1" data-d={DISENO_IMG} data-n={Object.keys(sellos).length} data-sellos={JSON.stringify(sellos)} />;
}
