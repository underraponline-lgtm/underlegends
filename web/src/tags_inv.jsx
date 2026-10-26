// 🎒 TU INVENTARIO: tu carta, su marco, su TAG y tu carta principal, en un solo lugar.
//
// Dlx, 25/10/2026: «que los tags de abajo sean personalizables en cada tarjeta… desde el inventario»; 26/10/2026: «eso de
// tus marcos y todo eso debería estar en inventario», «reworkear cómo se ve el inventario… organizarlo muchísimo mejor»
// y, mirando la primera vuelta, «está desordenadísimo… otra forma de listar las cosas, quizás un ícono».
//   · ARRIBA, QUÉ CARTA EDITAS (Temporada · Competitiva · Servidor · País), a todo el ancho: encima de la carta se
//     pisaba con la corona del marco de oro, que sobresale por arriba.
//   · A la izquierda la carta, con aire alrededor para su marco, y lo que tiene puesto (cada fila lleva a su pestaña).
//   · A la derecha, TAG · MARCO · PRINCIPAL, cada una con cuántos tienes. Todo se elige en FICHAS: un cuadro con el
//     ícono pintado por rareza (Legendario · Épico · Raro · Común, de `niveles` del catálogo), el nombre y qué lo da.
//     Antes eran 40 pastillas sueltas de un renglón; la ficha dice qué es cada una sin abrir nada.
//     Ideas de 21st (sólo mirar, sin traer código): «Icon Card Radio Group» (sean0205) para la ficha y «Filter Grid»
//     (ddoemonn) / «Tabs with Count Badge» (coss.com) para los filtros con su número.
//   · 👀 TOCAR ES PROBAR, NO GUARDAR (Dlx, 26/10/2026: «cuando clickeo algo que se vea la preview de lo que presioné… y un
//     botón de guardar y otro de cancelar»). Lo que tocas queda en un borrador: el marco se prueba sobre la carta, el
//     TAG se muestra encima de ella (la imagen lo trae recién al redibujarse) y abajo aparece la barra con Guardar y
//     Cancelar. Guardar manda todo junto; salir con cambios sin guardar pregunta antes.
//   · ⚡ El TAG se dibuja en la imagen: elegir uno pide un redibujo a pedido (`pedirRedibujo()` en bot/avisos.js), que
//     tarda unos minutos y tiene freno —uno cada 10 minutos, 6 por día—. El marco se ve al momento en la página.
// Los 🎯 de estado no se guardan: salen solos mientras se cumplen, con «Automático».
import { useEffect, useMemo, useRef, useState } from 'react';
import CAT from './tags_catalogo.json';
import { pasePost, refrescarPases } from './pase.js';
import { Carta } from './piezas.jsx';
import { nombreMarco } from './marcos.jsx';

const CARTAS = [['temporada', 'Temporada'], ['competitivo', 'Competitiva'], ['servidor', 'Servidor'], ['pais', 'País']];
const GRUPO = { siempre: ['♾️', 'Para siempre'], temporada: ['📅', 'De temporada'], pase: ['✨', 'Edición limitada'] };
const RAREZA = (CAT.niveles || {});
const ORDEN_R = { t1: 0, t2: 1, t3: 2, t4: 3 };
const TIER = { premium: 'Premium', plata: 'Plata', oro: 'Oro' };
const ORDEN_T = ['oro', 'plata', 'premium'];
/** «El mejor»: el de nivel más alto que tengas, como `mejorMarco()` de bot/avisos.js */
const mejor = (ids) => ORDEN_T.map((t) => ids.find((id) => id.split(':')[1] === t)).find(Boolean) || '';
const sinNum = (t) => t.replace(' x%d', '').replace(' DE %d', '');
// el ícono es el emoji del principio del nombre («💀 REGICIDA»); los de País no traen: va su inicial
const EMOJI = /^((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|‍|\p{Extended_Pictographic}|\p{Regional_Indicator})*)\s*/u;
function partir(texto) {
  const m = texto.match(EMOJI);
  return m ? [m[1], texto.slice(m[0].length)] : ['', texto];
}

/** Lo que puedes ponerle a `carta`: `[{tag, texto, desc, grupo, nivel}]`, de la rareza más alta a la más baja */
function opciones(carta, yo) {
  const cat = (CAT.cat && CAT.cat[carta]) || [];
  const out = [];
  for (const [t, n, p, g] of cat) {
    if (g !== 'siempre' && g !== 'temporada') continue;
    const x = ((yo.ganados || {})[carta] || {})[t];
    if (yo.dueno) out.push({ tag: t, texto: x ? x[0] : sinNum(t), desc: p, grupo: g, nivel: n });
    else if (x && (g === 'siempre' || x[1] === yo.temp)) out.push({ tag: t, texto: x[0], desc: p, grupo: g, nivel: n });
  }
  // ✨ cada título del Pase va en UNA carta (`titulo_carta`, de `bot/pase.py`); sin el mapa, en todas como antes
  const tc = yo.titulo_carta || {};
  for (const tit of yo.titulos || []) if (!Object.keys(tc).length || tc[tit] === carta) out.push({ tag: 'pase:' + tit, texto: '✨ ' + tit.toUpperCase(), desc: 'Título del Pase de rapero.', grupo: 'pase', nivel: 't1' });
  return out.sort((a, b) => (ORDEN_R[a.nivel] ?? 9) - (ORDEN_R[b.nivel] ?? 9));
}

// 🏷️ EL TAG QUE PRUEBAS, DENTRO DE LA CARTA (Dlx, 26/10/2026: «cuando cambie de tag que se cambie el tag de ahí, no que
// aparezca un label encima»). La imagen trae el TAG recién al redibujarse, así que mientras tanto se dibuja OTRA pastilla
// igual a la de la carta justo encima de la suya: mismo lugar, misma forma, mismo nivel.
//   · DÓNDE: medido en las imágenes de verdad, dibujando cada carta con el TAG en t1 y en t4 y restando (el centro de
//     la pastilla, como fracción de la imagen). `w` es el ancho de la imagen en píxeles de la carta: de ahí la escala.
//   · CÓMO: el estilo computado de cada generador (`.c-band` de normal_v3, `.tagbot` de card.css, `.tagb` de
//     comun/titulos.py, `.tag` de maqueta.py), nivel por nivel. Servidor y País pintan la pastilla con el color de tu
//     servidor o sobre tu bandera: ese fondo se lee de la imagen misma (R2 la sirve con CORS para la página).
//   · TAPA LA VIEJA: va por lo menos del ancho de la que está dibujada (su texto se sabe: el elegido o el de la
//     cascada, `/api/tags`), y opaca aunque la de la carta sea traslúcida en t3/t4: si no, se leerían las dos.
// ⚠️ Si se mueve el TAG en una carta, esto queda corrido: hay que volver a medirlo.
const PASTILLA = {
  temporada: { cx: 0.4794, cy: 0.928, w: 300, fs: 9.28, ls: 1.6, pad: [3, 13, 4] },
  competitivo: { cx: 0.4822, cy: 0.8276, w: 319, fs: 8.96, ls: 1.2, pad: [3.5, 12, 4.5] },
  // ⚠️ la Servidor sube o baja su TAG hasta 3 px según cuántos círculos tiene (`comun/pie.tag_centrado()`): va al medio
  // de los dos extremos y 1,5 px más alta arriba y abajo, así tapa la de cualquiera
  servidor: { cx: 0.5004, cy: 0.8844, w: 300, fs: 8.64, ls: 1.1, pad: [4.5, 11, 5.5] },
  pais: { cx: 0.6115, cy: 0.9203, w: 308, fs: 8.64, ls: 1.2, pad: [4, 13, 5] },
};
// Temporada y Competitiva: el metal de cada nivel (los mismos degradés que la carta; t4 opaco para tapar la de abajo)
const METAL = {
  t1: { bg: 'linear-gradient(#FFF0A8,#FFD024 48%,#C89000)', bd: 'rgba(90,66,0,.55)', c: '#2A1E00', sh: '0 0 16px rgba(255,196,32,.75),inset 0 1px 0 rgba(255,255,255,.9)' },
  t2: { bg: 'linear-gradient(#FFFFFF,#DCE0E8 46%,#9BA3B2)', bd: 'rgba(60,68,82,.45)', c: '#1E2129', sh: '0 0 12px rgba(255,255,255,.55),inset 0 1px 0 rgba(255,255,255,.95)' },
  t3: { bg: 'linear-gradient(#5A606E,#3A404C 55%,#23272F)', bd: 'rgba(255,255,255,.45)', c: '#EEF1F6', sh: '0 3px 10px rgba(0,0,0,.55)' },
  t4: { bg: '#141419', bd: 'rgba(255,255,255,.2)', c: '#A8ACB8', sh: '0 3px 10px rgba(0,0,0,.55)' },
};
// Servidor y País: el nivel va en el borde (grosor del acento en t1/t2; blanco apagado en t3/t4)
const BORDE = {
  servidor: { t1: 1.4, t2: 1, t3: 'rgba(255,255,255,.22)', t4: 'rgba(255,255,255,.12)' },
  pais: { t1: 1.6, t2: 1, t3: 'rgba(255,255,255,.24)', t4: 'rgba(255,255,255,.14)' },
};

let _medir = null;
/** el ancho de una pastilla con `texto`, en píxeles de la carta (Archivo 900, como la carta) */
function anchoPastilla(texto, p) {
  if (!texto) return 0;
  _medir = _medir || document.createElement('canvas').getContext('2d');
  _medir.font = '900 ' + p.fs + 'px Archivo, sans-serif';
  return _medir.measureText(texto.toUpperCase()).width + p.ls * [...texto].length + p.pad[1] * 2 + 3;
}

/** el color de fondo de la pastilla que la carta tiene dibujada, leído de la imagen (la chica alcanza) */
function useFondoPastilla(liga, k, carta) {
  const [c, setC] = useState(null);
  useEffect(() => {
    setC(null);
    if (carta !== 'servidor' && carta !== 'pais') return undefined;
    const url = liga.cartaUrl(k, carta, true);
    if (!url) return undefined;
    let vivo = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const p = PASTILLA[carta];
        const cv = document.createElement('canvas');
        cv.width = img.naturalWidth;
        cv.height = img.naturalHeight;
        const x = cv.getContext('2d');
        x.drawImage(img, 0, 0);
        const s = img.naturalWidth / p.w;
        // arriba del centro, entre el borde y la letra: sólo fondo
        const d = x.getImageData(Math.round(p.cx * cv.width) - 1, Math.round(p.cy * cv.height - 7 * s), 3, 1).data;
        const m = (i) => Math.round((d[i] + d[i + 4] + d[i + 8]) / 3);
        if (vivo) setC('rgb(' + m(0) + ',' + m(1) + ',' + m(2) + ')');
      } catch (e) { /* sin CORS: queda el color de siempre */ }
    };
    // ⚠️ otra dirección que la del <img>: si el navegador reusa la respuesta sin CORS del caché, el canvas queda sucio
    img.src = url + (url.indexOf('?') < 0 ? '?' : '&') + 'px=1';
    return () => { vivo = false; };
  }, [liga, k, carta]);
  return c;
}

function PastillaTag({ caja, liga, k, carta, texto, nivel, vieja, rg }) {
  const [pos, setPos] = useState(null);
  const fondo = useFondoPastilla(liga, k, carta);
  const p = PASTILLA[carta];
  useEffect(() => {
    const cont = caja.current;
    if (!cont || !p) return undefined;
    const medir = () => {
      const img = cont.querySelector('img.iv9-ci');
      if (!img || !img.naturalWidth) { setPos(null); return; }
      const a = cont.getBoundingClientRect();
      const b = img.getBoundingClientRect();
      setPos({ x: b.left - a.left + p.cx * b.width, y: b.top - a.top + p.cy * b.height, e: b.width / p.w });
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(cont);
    // la imagen puede terminar de cargar después: se vuelve a medir un rato
    const t = setInterval(medir, 400);
    const fin = setTimeout(() => clearInterval(t), 4000);
    return () => { ro.disconnect(); clearInterval(t); clearTimeout(fin); };
  }, [caja, p, carta, k]);
  if (!pos || !p || !texto) return null;
  const e = pos.e;
  const st = {
    left: pos.x, top: pos.y, fontSize: p.fs * e, letterSpacing: p.ls * e,
    padding: p.pad.map((v) => v * e + 'px').join(' '),
    minWidth: anchoPastilla(vieja, p) * e,
  };
  if (carta === 'temporada' || carta === 'competitivo') {
    const m = METAL[nivel] || METAL.t4;
    Object.assign(st, { background: m.bg, color: m.c, border: Math.max(1, e) + 'px solid ' + m.bd, boxShadow: m.sh });
  } else {
    const b = BORDE[carta][nivel] || BORDE[carta].t4;
    const acento = carta === 'pais' ? (rg ? liga.colorRg(rg) : '#C9CCD6') : '#FFFFFF';
    Object.assign(st, {
      background: fondo || (carta === 'pais' ? 'rgb(14,16,24)' : 'rgb(20,24,40)'), color: '#FFFFFF',
      border: typeof b === 'number' ? b * e + 'px solid ' + acento : Math.max(1, e) + 'px solid ' + b,
      textShadow: '0 1px 3px rgba(0,0,0,.9)', boxShadow: carta === 'servidor' ? '0 3px 10px rgba(0,0,0,.6)' : 'none',
    });
  }
  return <span className="iv9-past" style={st} aria-label={'TAG que pruebas: ' + texto}>{texto}</span>;
}

/** El aviso de qué pasa con tu carta después de elegir un TAG */
function avisoRedibujo(r) {
  if (!r) return 'Listo.';
  if (r.limite) return 'Listo: ya cambiaste tu carta 6 veces hoy, así que ésta sale en la próxima vuelta del ciclo (media hora como mucho).';
  const min = Math.ceil((r.en || 0) / 60000);
  return min > 0 ? '⚡ Listo: tu carta se redibuja en unos ' + (min + 3) + ' minutos (hay una espera de 10 entre cambios).'
    : '⚡ Listo: tu carta se redibuja en unos 3 minutos.';
}

/** Una ficha elegible: el ícono en su cuadro, el nombre, qué la da y su rareza */
// `on`: lo que se ve ahora (guardado o probándose); `puesto`: lo guardado. Si difieren, la ficha dice «Sin guardar»
function Ficha({ on, puesto, ic, nombre, desc, rar, cls = '', disabled, onClick, children }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={'iv9-f ' + cls + (on ? ' on' : '') + (on && !puesto ? ' prueba' : '')} disabled={disabled} onClick={onClick}>
      {children || <span className="iv9-ic" aria-hidden="true">{ic}</span>}
      <span className="iv9-tx"><b>{nombre}</b>{desc ? <small>{desc}</small> : null}</span>
      {rar ? <em className="iv9-rar">{rar}</em> : null}
      {on && puesto ? <i className="iv9-ok" aria-hidden="true">✓</i> : null}
      {on && !puesto ? <i className="iv9-sg">Sin guardar</i> : null}
    </button>
  );
}

export function Inventario({ liga, dc }) {
  const [yo, setYo] = useState(undefined);
  const [mk, setMk] = useState(null);
  const [carta, setCarta] = useState('temporada');
  const [pest, setPest] = useState('tag');
  const [filtro, setFiltro] = useState('todos');
  const [ocup, setOcup] = useState('');
  const [msg, setMsg] = useState('');
  const [busca, setBusca] = useState('');
  // 👀 el borrador: `tags` por carta, `marco`, `estilo` y `principal`; lo que no está, es lo guardado
  const [bor, setBor] = useState({ tags: {} });
  const cajaCarta = useRef(null);
  // 🏷️ el TAG que la cascada le da hoy a cada carta (el de «Automático»): `{clave: [i, i, i, i]}` en el catálogo
  const [deCascada, setDeCascada] = useState(null);
  useEffect(() => {
    let vivo = true;
    fetch('/api/tags', { headers: { accept: 'application/json' } }).then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo) setDeCascada((d && d.de) || null); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  useEffect(() => {
    pasePost('tags-mios', {}).then((d) => setYo(d && d._ok ? d : null));
    pasePost('marcos', {}).then((d) => setMk(d && d._ok ? d : null));
  }, []);
  const k = (dc && dc.clave) || (yo && yo.k) || '';
  // las cartas que tienes: la página las sabe por tu fila o tu cuenta (ver `filaDe` de visor.jsx)
  const tienes = useMemo(() => {
    const f = (liga.T && liga.T[k]) || (liga.X && liga.X[k]);
    const c = new Set([...((f && f.c) || []), ...((dc && dc.cs) || [])]);
    return CARTAS.filter(([x]) => c.has(x));
  }, [liga, k, dc]);
  useEffect(() => { if (tienes.length && !tienes.some(([x]) => x === carta)) setCarta(tienes[0][0]); }, [tienes]); // eslint-disable-line react-hooks/exhaustive-deps
  const nCambios = Object.keys(bor.tags).length + ('marco' in bor || 'estilo' in bor ? 1 : 0) + ('principal' in bor ? 1 : 0);
  // salir con cambios sin guardar pregunta antes
  useEffect(() => {
    if (!nCambios) return undefined;
    const f = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [nCambios]);
  if (yo === undefined) return <p className="iv-nota">Buscando tu inventario…</p>;
  if (!yo) return <p className="iv-nota">No pude leer tu inventario. Entra con Discord y prueba de nuevo.</p>;

  const cartas = tienes.length ? tienes : CARTAS;
  const ops = opciones(carta, yo);
  const elG = (yo.elegidos || {})[carta] || 'auto';
  const el = carta in bor.tags ? bor.tags[carta] : elG;
  const q = busca.trim().toLowerCase();
  const buscados = q ? ops.filter((o) => o.texto.toLowerCase().includes(q) || (o.desc || '').toLowerCase().includes(q)) : ops;
  const cuenta = (g) => buscados.filter((o) => o.grupo === g).length;
  const vistos = filtro === 'todos' ? buscados : buscados.filter((o) => o.grupo === filtro);
  const grupos = ['siempre', 'temporada', 'pase'].map((g) => [g, vistos.filter((o) => o.grupo === g)]).filter(([, xs]) => xs.length);
  const nombre = (CARTAS.find(([x]) => x === carta) || [])[1] || '';
  const marcos = (mk && mk.tienes) || [];
  const marcoG = (mk && mk.elegido) || '';
  const estiloG = (mk && mk.estilo) || 'camiseta';
  const principalG = yo.principal || '';
  const marcoAhora = 'marco' in bor ? bor.marco : marcoG;
  const estiloAhora = 'estilo' in bor ? bor.estilo : estiloG;
  const principalAhora = 'principal' in bor ? bor.principal : principalG;
  const tagAhora = el === 'auto' ? null : ops.find((o) => o.tag === el);
  // 🏷️ lo que sale con «Automático»: el TAG de la cascada (`/api/tags`), con su nivel del catálogo
  const iCasc = deCascada && deCascada[k] ? deCascada[k][CARTAS.findIndex(([x]) => x === carta)] : -1;
  const casc = iCasc >= 0 ? ((CAT.cat || {})[carta] || [])[iCasc] : null;
  const auto = casc ? { texto: sinNum(casc[0]), nivel: casc[1] } : null;
  const tagGuardado = elG === 'auto' ? auto : ops.find((o) => o.tag === elG) || null;
  const tagVer = tagAhora || auto;
  const filaYo = (liga.T && liga.T[k]) || (liga.X && liga.X[k]) || {};
  // el marco que se prueba sobre la carta, con la misma forma que `marcosPublicos()`: `null` sin marco
  const marcoVer = !('marco' in bor || 'estilo' in bor) ? undefined
    : marcoAhora === 'ninguno' || !marcos.length ? null
      : [marcoAhora || mejor(marcos.map(([id]) => id)), estiloAhora, (mk && mk.serie) || 0];

  // tocar = probar: lo igual a lo guardado sale del borrador
  const probar = (campo, v, guardado) => setBor((b) => {
    const n = { ...b, tags: { ...b.tags } };
    if (campo === 'tag') { if (v === guardado) delete n.tags[carta]; else n.tags[carta] = v; }
    else if (v === guardado) delete n[campo]; else n[campo] = v;
    return n;
  });
  const cancelar = () => { setBor({ tags: {} }); setMsg(''); };
  const guardar = async () => {
    setOcup('guardar');
    const avisos = [];
    let ok = true;
    for (const [c, tag] of Object.entries(bor.tags)) {
      const d = await pasePost('tag-elige', { carta: c, tag });
      if (d && d._ok) { setYo(d); avisos.push(avisoRedibujo(d.redibujo)); }
      else { ok = false; avisos.push(d && d.error === 'no lo tienes' ? 'Ese TAG todavía no es tuyo.' : 'Un TAG no se pudo guardar.'); }
    }
    if ('marco' in bor || 'estilo' in bor) {
      const d = await pasePost('marco-elige', { marco: marcoAhora, estilo: estiloAhora });
      // 🖼️ el marco va también en la imagen de /card: se redibuja como con el TAG (ver bot/con_marco.py)
      if (d && d._ok) { setMk(d); if (d.redibujo) avisos.push(avisoRedibujo(d.redibujo).replace('tu carta se redibuja', 'tu carta con su marco sale en /card')); } else { ok = false; avisos.push('El marco no se pudo guardar.'); }
    }
    if ('principal' in bor) {
      const d = await pasePost('carta-principal', { carta: principalAhora });
      if (d && d._ok) setYo(d); else { ok = false; avisos.push('La carta principal no se pudo guardar.'); }
    }
    refrescarPases();
    setOcup('');
    setBor({ tags: {} });
    setMsg((ok ? 'Guardado. ' : 'Se guardó una parte. ') + [...new Set(avisos)].join(' '));
  };

  const fichaTag = (o) => {
    const [ic, txt] = partir(o.texto);
    return <Ficha key={o.tag} on={el === o.tag} puesto={elG === o.tag} ic={ic || txt.charAt(0)} nombre={txt} desc={o.desc} rar={RAREZA[o.nivel]}
      cls={'r-' + o.nivel + (ic ? '' : ' letra')} disabled={!!ocup} onClick={() => probar('tag', o.tag, elG)} />;
  };

  // 🃏 la carta principal ya no va acá: se elige en el visor de tus cartas, mirándola (Dlx, 26/10/2026: «ponlo en otro
  // lado porque puede ser confuso»)
  const PEST = [['tag', 'TAG', ops.length], ['marco', 'Marco', marcos.length]];
  const puesto = [
    ['tag', 'TAG', tagAhora ? partir(tagAhora.texto)[1] : 'Automático', tagAhora ? (partir(tagAhora.texto)[0] || '🏷️') : '🎯'],
    ['marco', 'Marco', !marcoAhora ? 'El mejor' : marcoAhora === 'ninguno' ? 'Sin marco' : nombreMarco(marcoAhora), '🖼️'],
  ];

  return (
    <div className="iv9">
      <div className="iv9-top">
        <span className="iv9-et">Editando</span>
        <div className="iv9-seg" role="tablist" aria-label="Qué carta editas">
          {cartas.map(([c, n]) => (
            <button key={c} type="button" role="tab" aria-selected={carta === c} className={carta === c ? 'on' : ''}
              onClick={() => { setCarta(c); setBusca(''); setFiltro('todos'); }}>{n}{principalAhora === c ? <i aria-label="principal">★</i> : null}{c in bor.tags ? <b className="iv9-pt" aria-label="sin guardar" /> : null}</button>
          ))}
        </div>
      </div>

      <div className="iv9-cuerpo">
        <aside className="iv9-ver">
          <div className="iv9-carta" ref={cajaCarta}>
            {k ? <Carta key={carta + JSON.stringify(marcoVer)} liga={liga} k={k} cual={carta} cls="iv9-ci" abre={false} marco={marcoVer} /> : null}
            {/* el TAG que se prueba, en el lugar del de la carta (ver PASTILLA): la imagen lo trae al redibujarse */}
            {k && carta in bor.tags && tagVer ? <PastillaTag caja={cajaCarta} liga={liga} k={k} carta={carta} texto={tagVer.texto}
              nivel={tagVer.nivel} vieja={tagGuardado ? tagGuardado.texto : ''} rg={filaYo.rg} /> : null}
            {nCambios ? <span className="iv9-vp">Vista previa</span> : null}
          </div>
          <ul className="iv9-puesto" aria-label="Lo que tiene puesto">
            {puesto.map(([id, et, v, ic]) => (
              <li key={id}><button type="button" className={(pest === id ? 'on' : '') + ((id === 'tag' ? carta in bor.tags : id === 'marco' ? 'marco' in bor || 'estilo' in bor : 'principal' in bor) ? ' sg' : '')} onClick={() => setPest(id)}>
                <span className="iv9-ic" aria-hidden="true">{ic}</span><span className="iv9-tx"><small>{et}</small><b>{v}</b></span><i aria-hidden="true">›</i>
              </button></li>
            ))}
          </ul>
        </aside>

        <div className="iv9-ed">
          <div className="iv9-pest" role="tablist" aria-label="Qué cambias">
            {PEST.map(([id, n, c]) => (
              <button key={id} type="button" role="tab" aria-selected={pest === id} className={pest === id ? 'on' : ''} onClick={() => setPest(id)}>
                {n}<small>{c}</small></button>
            ))}
          </div>

          {msg ? <p className="iv-msg" role="status">{msg}</p> : null}

          {pest === 'tag' ? (
            <div className="iv9-panel">
              <p className="iv-p">El TAG de abajo de tu carta de <b>{nombre}</b>. Los de estado (EN LLAMAS, TOP DEL SERVIDOR…) salen solos con «Automático».</p>
              <div className="iv9-barra">
                {ops.length > 12 ? <input className="iv9-busca" type="search" placeholder="Buscar un TAG…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar un TAG" /> : null}
                <div className="iv9-filtros" role="radiogroup" aria-label="Qué TAGs ver">
                  {[['todos', 'Todos', buscados.length]].concat(['siempre', 'temporada', 'pase'].filter((g) => ops.some((o) => o.grupo === g)).map((g) => [g, GRUPO[g][1], cuenta(g)])).map(([id, n, c]) => (
                    <button key={id} type="button" role="radio" aria-checked={filtro === id} className={filtro === id ? 'on' : ''} onClick={() => setFiltro(id)}>
                      {id !== 'todos' ? <span aria-hidden="true">{GRUPO[id][0]}</span> : null}{n}<small>{c}</small></button>
                  ))}
                </div>
              </div>
              <div className="iv9-grid" role="radiogroup" aria-label={'El TAG de tu carta de ' + nombre}>
                <Ficha on={el === 'auto'} puesto={elG === 'auto'} ic="🎯" nombre="Automático" desc="El que te toca hoy: los de estado salen solos." cls="auto" disabled={!!ocup} onClick={() => probar('tag', 'auto', elG)} />
              </div>
              {grupos.map(([g, xs]) => (
                <section key={g} className="iv9-grupo">
                  {filtro === 'todos' ? <h4><span aria-hidden="true">{GRUPO[g][0]}</span>{GRUPO[g][1]}<small>{xs.length}</small></h4> : null}
                  <div className="iv9-grid" role="radiogroup" aria-label={GRUPO[g][1]}>{xs.map(fichaTag)}</div>
                </section>
              ))}
              {!ops.length ? <p className="iv-nota">Todavía no ganaste ninguno que se guarde para esta carta: aparecen acá en cuanto tu carta los muestre.</p> : null}
              {q && !vistos.length ? <p className="iv-nota">Ningún TAG tuyo dice «{busca}».</p> : null}
            </div>
          ) : null}

          {pest === 'marco' ? (
            <div className="iv9-panel">
              {!marcos.length ? (
                <p className="iv-nota">Todavía no tienes marcos: se ganan en el Pase premium. Sin marco, tus cartas salen como siempre.</p>
              ) : (
                <>
                  <p className="iv-p">El marco va alrededor de <b>todas</b> tus cartas en la página. Tócalo para probarlo en tu carta.</p>
                  <div className="iv9-grid" role="radiogroup" aria-label="El marco de tus cartas">
                    <Ficha on={!marcoAhora} puesto={!marcoG} ic="⭐" nombre="El mejor" desc="El más alto que tengas, solo." cls="auto" disabled={!!ocup} onClick={() => probar('marco', '', marcoG)} />
                    {marcos.map(([id]) => {
                      const t = id.split(':')[1];
                      return (
                        <Ficha key={id} on={marcoAhora === id} puesto={marcoG === id} nombre={nombreMarco(id)} desc={'Marco ' + (TIER[t] || '') + ' del Pase.'} rar={TIER[t]} cls={'m-' + t}
                          disabled={!!ocup} onClick={() => probar('marco', id, marcoG)}><span className="iv9-ic" aria-hidden="true"><i className={'iv9-sw ' + t} /></span></Ficha>
                      );
                    })}
                    <Ficha on={marcoAhora === 'ninguno'} puesto={marcoG === 'ninguno'} ic="▢" nombre="Sin marco" desc="Tus cartas como siempre." disabled={!!ocup} onClick={() => probar('marco', 'ninguno', marcoG)} />
                  </div>
                  {carta === 'servidor' ? (
                    <section className="iv9-grupo">
                      <h4>Tu carta de Servidor</h4>
                      <div className="iv9-grid" role="radiogroup" aria-label="El estilo de tu carta de Servidor">
                        {(mk.estilos || ['camiseta', 'cadena']).map((e) => (
                          <Ficha key={e} on={estiloAhora === e} puesto={estiloG === e} ic={e === 'cadena' ? '⛓️' : '👕'} nombre={e === 'cadena' ? 'La cadena' : 'La camiseta'}
                            desc={e === 'cadena' ? 'El marco como una cadena.' : 'Los colores de tu servidor.'} disabled={!!ocup} onClick={() => probar('estilo', e, estiloG)} />
                        ))}
                      </div>
                    </section>
                  ) : null}
                </>
              )}
            </div>
          ) : null}


          {yo.dueno ? <p className="iv-nota">👑 Como dueño de Under Legends, tienes todo desbloqueado.</p> : null}

          {/* 💾 la barra de guardar: sólo con cambios, pegada abajo mientras bajas */}
          {nCambios ? (
            <div className="iv9-guardar" role="region" aria-label="Cambios sin guardar">
              <span><b>{nCambios === 1 ? '1 cambio' : nCambios + ' cambios'}</b> sin guardar{Object.keys(bor.tags).length ? ' · el TAG se dibuja en tu carta unos minutos después' : ''}</span>
              <button type="button" className="iv9-cancel" disabled={!!ocup} onClick={cancelar}>Cancelar</button>
              <button type="button" className="iv9-ok-b" disabled={!!ocup} onClick={guardar}>{ocup === 'guardar' ? 'Guardando…' : 'Guardar'}</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
