// Tarjetas (`#/tarjetas` y `#/tarjetas/<carta>`): todas las tarjetas, las tuyas y «Comparar dos». Dlx, 03/10/2026:
// «hay que reworkear la página de las tarjetas», y al plan: «1. A» (la galería arriba, con el buscador) · «2. A» («Las
// tuyas» arriba si entraste: tus cuatro y, en las bloqueadas, qué te falta) · «3. A» (una pestaña por tipo de tarjeta).
// Para todos desde la 2.08 (Dlx: «1. A»), con sus dos ideas: «2. A» (tu tarjeta para historias) y «3. A» (los filtros
// de la galería: Nuevas, A quién seguís y por servidor). La de app.js sigue escondida, de respaldo.
//
// ⚠️ LOS DATOS SON LOS DE LA PÁGINA DE HOY, no otros: quién aparece (`conTarjeta()` de app.js: alguna carta y foto), el
// orden (el de la tabla), las filas de «Comparar dos» (`CMP_FILAS` de app.js) y lo que falta (`req` de /api/perfiles,
// como «Lo que le falta» del perfil). Si una regla cambia allá, cambia acá.
import { useEffect, useMemo, useState } from 'react';
import { limpio, norm, num, utc } from './liga.js';
import { Carta, Compartir, Ico, accion, enlace, nombrePais } from './piezas.jsx';
import { W, aPng, armarYCompartir, carta, lienzo, pie } from './historia.js';

const ORDEN = ['temporada', 'competitivo', 'servidor', 'pais'];
const NOMBRE = { temporada: 'Temporada', competitivo: 'Competitiva', servidor: 'Servidor', pais: 'País' };
// las filas de «Comparar dos»: [campo de la tabla, cómo se llama, 1 = gana el más alto · -1 = el más bajo]
const FILAS = {
  temporada: [['ovr', 'OVR', 1], ['pts', 'Puntos', 1], ['ev', 'Eventos', 1], ['pod', 'Podios', 1], ['pos', 'Puesto', -1]],
  competitivo: [['sc', 'Score', 1], ['ev', 'Eventos', 1], ['wr', 'Win%', 1], ['oro', 'Títulos', 1]],
  servidor: [['pts', 'Puntos', 1], ['ev', 'Eventos', 1], ['oro', 'Títulos', 1], ['pos', 'Puesto', -1]],
  pais: [['pts', 'Puntos', 1], ['ev', 'Eventos', 1], ['pod', 'Podios', 1], ['pos', 'Puesto', -1]],
};
// por qué alguien que cumple todavía no tiene la tarjeta: lo primero que le falta del portón (`nv` del payload)
const NV = { id: 'tu Discord todavía no está vinculado a la Liga', pais: 'te falta el país', dra: 'tenés que ser Miembro de Discord Rap Español' };
const movil = () => typeof matchMedia === 'function' && matchMedia('(max-width: 599.98px)').matches;

// el historial de cada uno (`/api/perfiles`: lo que le falta y sus duelos), una vez: lo pide y lo guarda app.js
function usePerfiles() {
  const [p, setP] = useState(null);
  useEffect(() => {
    if (typeof window.perfiles !== 'function') return undefined;
    let vivo = true;
    Promise.resolve(window.perfiles()).then((d) => { if (vivo && d) setP(d); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  return p;
}

// ── las de arriba: las tres primeras de ese tipo, en abanico (sólo en la compu: en el celular, la galería primero) ──
function Abanico({ liga, t, top }) {
  if (top.length < 3) return null;
  return (
    <ol className={'tj-abanico tj-' + t} aria-label={'Las tres primeras de ' + NOMBRE[t]}>
      {[top[1], top[0], top[2]].map((f, i) => (
        <li key={f.k} className={['izq', 'centro', 'der'][i]}><Carta liga={liga} k={f.k} cual={t} cls="tj-c" /></li>
      ))}
    </ol>
  );
}

// ── tu tarjeta para historias (Dlx, 03/10/2026: «2. A»): la imagen vertical de esa carta con el marco de la Liga, como
// «Mi puesto para historias» del Ranking y el campeón de Eventos (el marco, la carta y el compartir viven en historia.js) ──
function datoDe(liga, f, c) {
  if (c === 'temporada') return (f.pos ? '#' + f.pos + ' DE LA TEMPORADA' : 'FUERA DE CONCURSO') + (f.ovr ? ' · OVR ' + f.ovr : '');
  if (c === 'competitivo') return [f.rg ? 'RANGO ' + f.rg : '', f.sc ? 'SCORE ' + String(f.sc).replace('.', ',') : ''].filter(Boolean).join(' · ');
  if (c === 'servidor') return f.sv ? String((liga.svs[f.sv] || {}).nombre || f.sv).toUpperCase() : '';
  if (c === 'pais') return f.cc ? nombrePais(f.cc).toUpperCase() : '';
  return '';
}
async function imagenTarjeta(liga, k, c) {
  const f = liga.T[k] || {};
  const { c: lz, g, letra } = await lienzo();
  letra(700, 34, true); g.fillStyle = '#A5A5A0';
  g.fillText(('LIGA GLOBAL · ' + liga.temp + ' · MI TARJETA').toUpperCase(), 72, 132);
  const tit = NOMBRE[c].toUpperCase();
  let px = 116;
  letra(900, px, false);
  while (px > 60 && g.measureText(tit).width > W - 144) { px -= 6; letra(900, px, false); }
  g.fillStyle = '#F6F6F6'; g.fillText(tit, 72, 132 + 24 + px * 0.9);
  const y0 = 330;
  const ch = await carta(g, letra, liga, k, f.n || k, c, W / 2, y0, 700, 1120);
  // debajo, en verde agua, lo que dice esa carta: el puesto, el rango, el servidor o el país
  const dato = datoDe(liga, f, c);
  if (dato) {
    const ye = y0 + ch + 36;
    let pd = 40;
    letra(700, pd, true);
    while (pd > 24 && g.measureText(dato).width > 760 - 60) { pd -= 2; letra(700, pd, true); }
    g.fillStyle = '#29B298'; g.fillRect((W - 760) / 2, ye, 760, 104);
    g.fillStyle = '#030304'; g.textAlign = 'center';
    g.fillText(dato, W / 2, ye + 52 + Math.round(pd * 0.36));
  }
  await pie(g, letra);
  return aPng(lz);
}
function BotonHistoria({ liga, k, c }) {
  const [est, setEst] = useState('');
  const hacer = () => {
    if (est === 'armando') return;
    armarYCompartir(() => imagenTarjeta(liga, k, c), 'mi-tarjeta-' + c + '-' + k + '.png',
      'Mi tarjeta de ' + NOMBRE[c] + ' de la Liga Global. ' + enlace('#/r/' + encodeURIComponent(k)), setEst, 'tarjetas');
  };
  const txt = est === 'armando' ? 'Armando…' : est === 'bajada' ? 'Imagen guardada' : est === 'error' ? 'No pude armarla' : 'Para historias';
  return (
    <button type="button" className="tj-hist" onClick={hacer} aria-busy={est === 'armando'} aria-live="polite"
      aria-label={est ? undefined : 'Tu tarjeta de ' + NOMBRE[c] + ' para historias'}>
      <Ico n="compartir" t={14} /><span>{txt}</span>
    </button>
  );
}

// ── «Las tuyas»: tus cuatro, y en las que faltan, qué te falta ──
function Falta({ cs }) {
  return (
    <ul className="tj-falta">
      {cs.map((q) => {
        const pct = Math.max(0, Math.min(100, Math.round((100 * q[0]) / (q[1] || 1))));
        return (
          <li key={q[2]} className={q[0] >= q[1] ? 'ok' : ''}>
            <span>{Math.min(q[0], q[1])}/{q[1]} {String(q[2]).toLowerCase()}</span>
            <i><u style={{ width: pct + '%' }} /></i>
          </li>
        );
      })}
    </ul>
  );
}

function Tuya({ liga, k, c, tiene, bloq, cs, nv, jugo }) {
  const fila = liga.T[k];
  const cumple = c === 'servidor' ? jugo : cs.length ? cs.every((q) => q[0] >= q[1]) : false;
  // 🔴 CUMPLIR NO ES TENERLA: la Competitiva y la de País piden estar verificado (las de Temporada y Servidor, no)
  const libre = c === 'temporada' || c === 'servidor';
  const listo = tiene || (cumple && (!nv || libre));
  const espera = !listo && cumple;
  let img;
  if (tiene && fila) img = <Carta liga={liga} k={k} cual={c} cls="tj-c" />;
  else if (tiene) {
    img = (
      <button type="button" className="sin-boton" onClick={() => accion.carta(k)} aria-label={'Ver tu carta de ' + NOMBRE[c]}>
        <img className="tj-c" alt={'Tu carta de ' + NOMBRE[c]} src={liga.d.r2 + '/' + encodeURIComponent(k) + '/' + c + '.webp'} loading="lazy" />
      </button>
    );
  } else if (bloq) {
    // la Bloqueada de verdad, la que el bot dibuja con cuánto falta (`comun/bloqueada.py`)
    img = <img className="tj-c tj-bloq" alt={'Tu ' + NOMBRE[c] + ', bloqueada'} src={liga.d.r2 + '/' + encodeURIComponent(k) + '/bloq-' + c + '.webp'} loading="lazy" />;
  } else {
    img = <div className="tj-c tj-hueco" aria-hidden="true"><Ico n="candado" t={30} /></div>;
  }
  return (
    <li className={'tj-tu tj-' + c + (tiene ? ' tiene' : '')}>
      {img}
      <div className="tj-tu-pie">
        <b>{NOMBRE[c]}</b>
        {tiene ? <small className="ok"><Ico n="ok" t={14} />La tenés</small>
          : listo ? <small><Ico n="reloj" t={14} />Se está dibujando</small>
            : espera ? <small>Cumplís lo que pide: {NV[nv] || 'te falta verificarte'}.</small>
              : c === 'servidor' ? <small>Sale con tu primer evento.</small>
                : <small>Bloqueada</small>}
        {!tiene && !listo && !espera && cs.length ? <Falta cs={cs} /> : null}
        {espera ? <a className="tj-lnk" href="#/cuenta/verificar">Verificarme</a> : null}
        {tiene && fila ? <BotonHistoria liga={liga} k={k} c={c} /> : null}
      </div>
    </li>
  );
}

function LasTuyas({ liga, dc, perf }) {
  const f = liga.yo;
  const k = (f && f.k) || (dc && dc.clave) || '';
  const tiene = (f ? f.c : dc && dc.cs) || [];
  const bl = (dc && dc.clave === k && dc.bl) || [];
  const p = (perf && perf.p && perf.p[k]) || null;
  const req = (p && p.req) || {};
  const nv = (f && f.nv) || (dc && dc.nv) || '';
  const jugo = !!((f && f.ev) || (dc && dc.ev) || (p && p.ev && p.ev.length));
  const dra = ((liga.svs || {}).DRA || {}).invita;
  if (!k) {
    // entró con Discord, pero su cuenta no es (todavía) de nadie de la Lista
    return (
      <section className="sec tj-tuyas">
        <div className="sec-t"><h2>Las tuyas</h2></div>
        <div className="tj-sin">
          <p><b>Todavía no tenés tarjetas.</b> Tu Temporada y tu Servidor salen solas cuando jugás un evento de la Liga. Para
            las cuatro hace falta estar en Discord Rap Español con el rol Miembro y tu país (la bandera en el apodo o el
            rol de tu país). Escribí <code>/verificar</code> en Discord y el bot te dice qué te falta.</p>
          <div className="hero-acc">
            {dra ? <a className="btn verde chico" href={dra} target="_blank" rel="noopener noreferrer">Entrar a Discord Rap Español ↗</a> : null}
            <a className="btn borde2 chico" href="#/guia">Cómo funciona</a>
          </div>
        </div>
      </section>
    );
  }
  const primera = ORDEN.find((c) => tiene.includes(c));
  const url = primera ? liga.cartaUrl(k, primera) || enlace('#/r/' + encodeURIComponent(k)) : null;
  return (
    <section className="sec tj-tuyas">
      <div className="sec-t"><h2>Las tuyas</h2><a href={'#/r/' + encodeURIComponent(k)}>Tu perfil <Ico n="flecha" t={16} /></a></div>
      <ul className="tj-tuyas-l">
        {ORDEN.map((c) => (
          <Tuya key={c} liga={liga} k={k} c={c} tiene={tiene.includes(c)} bloq={bl.includes(c)} cs={req[c] || []} nv={nv} jugo={jugo} />
        ))}
      </ul>
      {url ? <div className="hero-acc tj-tu-acc"><Compartir cls="btn borde2 chico" url={url} texto="Mi carta de la Liga Global" etiqueta="Compartir mi carta" /></div> : null}
    </section>
  );
}

// ── la galería: todas las de ese tipo, con el buscador y los filtros (Dlx, 03/10/2026: «3. A»): las Nuevas —las de
// este tipo que salieron esta semana, del muro—, A quién seguís y por servidor, como los del Ranking. Un filtro que no
// filtra nada no se dibuja ──
function Galeria({ liga, t, lista }) {
  const [q, setQ] = useState('');
  const [ver, setVer] = useState(false);
  const [sv, setSv] = useState('');
  const [soloNuevas, setSoloNuevas] = useState(false);
  const [soloSigo, setSoloSigo] = useState(false);
  useEffect(() => { setVer(false); }, [t]);
  const nuevas = useMemo(() => {
    const d = liga.desdeLunes();
    return new Set(liga.muro.filter((it) => it.tipo === 'tarjeta' && it.carta === t && utc(it.t) >= d).flatMap((it) => it.ks || []));
  }, [liga, t]);
  const sigo = useMemo(() => new Set(liga.sigue || []), [liga]);
  const svs = useMemo(() => [...new Set(lista.map((f) => f.sv).filter(Boolean))].sort(), [lista]);
  const nNuevas = lista.filter((f) => nuevas.has(f.k)).length;
  const nSigo = lista.filter((f) => sigo.has(f.k)).length;
  const qn = norm(q).trim();
  const filtra = !!(sv || soloNuevas || soloSigo);
  const fs = lista.filter((f) => (!qn || norm(limpio(f.n)).includes(qn)) && (!sv || f.sv === sv)
    && (!soloNuevas || nuevas.has(f.k)) && (!soloSigo || sigo.has(f.k)));
  const tope = movil() ? 12 : 24;
  const vis = ver || qn || filtra ? fs : fs.slice(0, tope);
  const sacar = () => { setQ(''); setSv(''); setSoloNuevas(false); setSoloSigo(false); };
  return (
    <section className="sec tj-gal" id="tj-gal">
      <div className="sec-t"><h2>Todas las tarjetas</h2><span className="tj-n">{num(lista.length)} de {NOMBRE[t]}</span></div>
      {lista.length ? (
        <div className="rk-fil tj-fil">
          <label className="rk-buscar"><Ico n="buscar" t={18} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar rapero" aria-label="Buscar rapero" enterKeyHint="search" />
          </label>
          {nNuevas || nSigo || svs.length > 1 ? (
            <div className="rk-chips" role="group" aria-label="Filtrar">
              <button type="button" className={!filtra ? 'on' : ''} aria-pressed={!filtra} onClick={() => { setSv(''); setSoloNuevas(false); setSoloSigo(false); }}>Todas</button>
              {nNuevas ? <button type="button" className={'rk-chip-nuevo' + (soloNuevas ? ' on' : '')} aria-pressed={soloNuevas}
                onClick={() => setSoloNuevas(!soloNuevas)} title="Las que salieron esta semana">Nuevas · {nNuevas}</button> : null}
              {nSigo ? <button type="button" className={soloSigo ? 'on' : ''} aria-pressed={soloSigo} onClick={() => setSoloSigo(!soloSigo)}>A quién seguís</button> : null}
              {svs.length > 1 ? svs.map((s) => (
                <button type="button" key={s} className={sv === s ? 'on' : ''} aria-pressed={sv === s} onClick={() => setSv(sv === s ? '' : s)}>
                  <img alt="" src={liga.logo(s)} />{s}
                </button>
              )) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {!lista.length ? <p className="rk-vacio">Todavía nadie tiene la de {NOMBRE[t]}. La primera aparece acá apenas alguien la desbloquee.</p>
        : !fs.length ? <p className="rk-vacio">Nadie con {qn ? 'ese nombre' : 'ese filtro'}. <button type="button" className="rk-lnk" onClick={sacar}>{qn && !filtra ? 'Borrar la búsqueda' : 'Sacar los filtros'}</button></p>
          : (
            <ul className={'tj-grilla tj-' + t}>
              {vis.map((f) => (
                <li key={f.k}>
                  <Carta liga={liga} k={f.k} cual={t} cls="tj-c" />
                  <div className="tj-pie">
                    <b>{limpio(f.n)}</b>
                    <small>{f.pos ? '#' + f.pos : 'fuera de concurso'}{f.sv ? ' · ' + f.sv : ''}</small>
                    {liga.cartaVieja(f.k, t) ? <small className="tj-dib"><Ico n="reloj" t={13} />se está redibujando</small> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
      {fs.length > vis.length ? <button type="button" className="btn borde2 chico tj-mas" onClick={() => setVer(true)}>Ver las {num(fs.length)}</button> : null}
    </section>
  );
}

// ── «Comparar dos»: dos de ese tipo, fila por fila; el que gana cada fila, en verde ──
const valor = (f, campo) => {
  const v = f[campo];
  if (v == null || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
  return isNaN(n) ? null : n;
};
const mostrar = (campo, n) => (n == null ? '—' : campo === 'pos' ? '#' + n : campo === 'wr' ? String(n).replace('.', ',') + '%'
  : campo === 'sc' ? String(n).replace('.', ',') : num(n));

function Elegir({ lista, f, onElegir, et, id }) {
  const [txt, setTxt] = useState(limpio(f.n));
  const [mal, setMal] = useState(false);
  useEffect(() => { setTxt(limpio(f.n)); setMal(false); }, [f.k]); // eslint-disable-line react-hooks/exhaustive-deps
  const resolver = (v) => {
    const qn = norm(v).trim();
    if (!qn) { setTxt(limpio(f.n)); return; }
    const x = lista.find((g) => norm(limpio(g.n)) === qn) || lista.find((g) => norm(limpio(g.n)).startsWith(qn))
      || lista.find((g) => norm(limpio(g.n)).includes(qn));
    if (x) { onElegir(x.k); setTxt(limpio(x.n)); setMal(false); } else setMal(true);
  };
  return (
    <label className={'rk-buscar tj-elegir' + (mal ? ' mal' : '')}>
      <Ico n="buscar" t={16} />
      <input list={id} value={txt} aria-label={et} placeholder="Buscar rapero" enterKeyHint="search"
        onFocus={(e) => e.target.select()}
        onChange={(e) => { const v = e.target.value; setTxt(v); setMal(false); if (lista.some((g) => limpio(g.n) === v)) resolver(v); }}
        onBlur={(e) => resolver(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); resolver(e.currentTarget.value); } }} />
    </label>
  );
}

function Comparar({ liga, t, lista, perf }) {
  const [par, setPar] = useState([null, null]);
  if (lista.length < 2) return null;
  const A = lista.find((f) => f.k === par[0]) || lista[0];
  const B = lista.find((f) => f.k === par[1] && f.k !== A.k) || lista.find((f) => f.k !== A.k);
  const filas = FILAS[t].map(([campo, et, dir]) => {
    const a = valor(A, campo);
    const b = valor(B, campo);
    const gana = a == null || b == null || a === b ? 0 : (dir > 0 ? a > b : a < b) ? 1 : 2;
    return { campo, et, a, b, gana };
  });
  // cara a cara: sus duelos, de /api/perfiles (los mismos del perfil)
  const du = ((perf && perf.p && perf.p[A.k]) || {}).du || [];
  const cc = du.filter((d) => { const r = liga.fila(d[1]); return r && r.k === B.k; });
  const g = cc.filter((d) => d[2]).length;
  const p = cc.length - g;
  return (
    <section className="sec tj-cmp" id="tj-cmp">
      <div className="sec-t"><h2>Comparar dos</h2><span className="tj-n">{NOMBRE[t]}</span></div>
      <datalist id="tj-nombres">{lista.map((f) => <option key={f.k} value={limpio(f.n)} />)}</datalist>
      <div className="tj-cmp-g">
        <div className="tj-lado">
          <Elegir lista={lista} f={A} et="El primero" id="tj-nombres" onElegir={(k) => setPar([k, k === B.k ? A.k : B.k])} />
          <Carta liga={liga} k={A.k} cual={t} cls="tj-c" />
        </div>
        <dl className="tj-filas">
          {cc.length ? (
            <div className="tj-fila tj-cara">
              <dd className={g > p ? 'gana' : ''}>{g}</dd>
              <dt>Cara a cara<small>{cc.length === 1 ? 'una vez' : cc.length + ' veces'}</small></dt>
              <dd className={p > g ? 'gana' : ''}>{p}</dd>
            </div>
          ) : null}
          {filas.map((x) => (
            <div className="tj-fila" key={x.campo}>
              <dd className={x.gana === 1 ? 'gana' : ''}>{mostrar(x.campo, x.a)}</dd>
              <dt>{x.et}</dt>
              <dd className={x.gana === 2 ? 'gana' : ''}>{mostrar(x.campo, x.b)}</dd>
            </div>
          ))}
        </dl>
        <div className="tj-lado">
          <Elegir lista={lista} f={B} et="El segundo" id="tj-nombres" onElegir={(k) => setPar([k === A.k ? B.k : A.k, k])} />
          <Carta liga={liga} k={B.k} cual={t} cls="tj-c" />
        </div>
      </div>
    </section>
  );
}

export function Tarjetas({ liga, dc, tipo }) {
  const t = ORDEN.includes(tipo) ? tipo : 'temporada';
  const perf = usePerfiles();
  // quién aparece: alguna carta y su foto (`conTarjeta()` de app.js), en el orden de la tabla
  const con = useMemo(() => (liga.d.tabla || []).filter((f) => (f.c || []).length && f.fo !== 0), [liga]);
  const cuantos = useMemo(() => Object.fromEntries(ORDEN.map((c) => [c, con.filter((f) => f.c.includes(c)).length])), [con]);
  const lista = useMemo(() => con.filter((f) => f.c.includes(t)), [con, t]);
  const req = (liga.d.requisitos || []).find((r) => r.id === t) || {};
  const pide = (req.pide || []).filter((x) => x !== 'nada');
  const mira = !!(liga.yo || (dc && (dc.clave || dc.id)));
  return (
    <>
      <nav className="rk-subs" aria-label="Tarjetas">
        <div className="rk-subs-in">
          {ORDEN.map((c) => (
            <a key={c} href={'#/tarjetas' + (c === 'temporada' ? '' : '/' + c)} className={c === t ? 'on' : ''} aria-current={c === t ? 'page' : undefined}>
              {NOMBRE[c]}<i>{num(cuantos[c])}</i>
            </a>
          ))}
        </div>
      </nav>
      <div className="escena tj-esc" style={{ '--mo-c': '#E41373', '--mo-o': 0.9, '--mo-c2': '#29B298' }}>
        <section className="rk-cab tj-cab">
          <div className="rk-tx">
            <span className="tag">TARJETAS · {liga.temp}</span>
            <h1 className="hero-ev largo">{NOMBRE[t]}</h1>
            <p className="hero-p">{req.mide || ''} Hasta cuatro por rapero: se dibujan solas con los datos de la temporada, y en Discord se piden con <code>/card</code>.</p>
            <p className="tj-pide"><b>PIDE</b>{pide.length ? pide.join(' · ') : 'nada: sale con tu primer evento'}</p>
          </div>
          <Abanico liga={liga} t={t} top={lista.slice(0, 3)} />
        </section>
      </div>
      {mira ? <LasTuyas liga={liga} dc={dc} perf={perf} /> : (
        <div className="sec tj-invita-w">
          <div className="rk-invita"><span>¿Y las tuyas? Entrá con Discord: te mostramos tus tarjetas y lo que te falta para las que no tenés.</span>
            <button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar</button></div>
        </div>
      )}
      <Galeria liga={liga} t={t} lista={lista} />
      <Comparar key={t} liga={liga} t={t} lista={lista} perf={perf} />
    </>
  );
}
