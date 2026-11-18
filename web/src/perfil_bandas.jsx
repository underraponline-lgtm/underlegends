// 🎨 EL PERFIL EN BANDAS (17/11/2026). Dlx, al remake de lo de abajo de la cabecera: «La A pero q no todo sea negro que
// tenga el estilo del inicio, y tmb hay cosas q necesitan mas data», a la v3 de la maqueta privada
// (https://claude.ai/artifact/K1LibeeGUNJnHTqZubw9U1): «Sí, pásala», y antes: «QUIZAS q muro este mas arriba, y que en
// perfil se pueda ver las historias que la pagina sube por los usuarios mismos».
// Las piezas NUEVAS viven acá (las de antes siguen en perfil.jsx): sus historias, su forma, su mejor noche, rivalidades,
// su camino, sus récords y su muro con el dibujo de Publicaciones. Todo sale de lo que el perfil ya trae —sus eventos
// (`p.ev` con `e`), sus duelos (`p.du`), sus publicaciones (`p.mu`), su fila de la tabla—: sin dato no hay pieza.
import { useMemo, useState } from 'react';
import { diaISO, limpio, num, siglaDe } from './liga.js';
import { Alguien, Bandera, Cara, accion } from './piezas.jsx';
import { historiasDePersona } from './arriba.jsx';
import { useAplausos } from './aplausos.js';
import { useComentarios } from './comentarios.jsx';
import { usePase } from './pase.js';
import { FILTROS2, Fila, TIPOS } from './publicaciones2.jsx';

const MES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];
const fecha = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const [, m, dd] = diaISO(d).split('-');
  return Number(dd) + ' ' + MES[Number(m) - 1];
};
// cómo le fue: el color y la etiqueta corta (los de la tira de Eventos)
const PU = {
  Campeón: ['1º', '#E7B622', '#030304'], Subcampeón: ['2º', '#C9CDD4', '#030304'], Tercero: ['3º', '#D9782F', '#030304'],
  Cuarto: ['4º', '#D9782F', '#030304'], Semifinal: ['SEMI', '#E8803A', '#030304'], Cuartos: ['CUAR', '#29B298', '#030304'],
  Octavos: ['OCT', '#2A4D47', '#E9F6F3'],
};
const pu = (x) => PU[x] || [String(x || '').slice(0, 4).toUpperCase(), '#3A3A3E', '#F6F6F6'];
const SEMIS = ['Campeón', 'Subcampeón', 'Tercero', 'Cuarto', 'Semifinal'];
const LEJOS = ['Octavos', 'Cuartos', 'Semifinal', 'Cuarto', 'Tercero', 'Subcampeón', 'Campeón'];
const coma = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
const kmil = (n) => (n >= 1000 ? coma(n / 1000) + 'k' : num(n));

// ── los datos de una vez, para todas las piezas ──
export function usePerfilDatos(liga, f, p, e) {
  return useMemo(() => {
    const E = e || {};
    const evs = ((p && p.ev) || []).map(([n, puesto, pts]) => {
      const x = E[n] || E[String(n)] || [];
      return { n, pu: puesto, pts: pts || 0, nom: limpio(x[0] || 'Evento ' + n), sv: x[1] || '', iso: x[2] || '', gente: x[3] || 0 };
    }).filter((x) => x.iso).sort((a, b) => b.iso.localeCompare(a.iso));
    const du = (p && p.du) || [];
    const saco = (n) => (du.find((d) => d[0] === n && !d[2]) || [])[1] || '';
    // por rival: cuántas ganó y perdió (por su clave si está en la tabla, si no por el nombre)
    const por = new Map();
    du.forEach((d) => {
      const r = liga.quien(d[1]);
      const id = r ? r.k : 'n:' + limpio(d[1]).toLowerCase();
      if (!por.has(id)) por.set(id, { id, k: r ? r.k : '', n: r ? r.n : d[1], f: r, g: 0, p: 0 });
      por.get(id)[d[2] ? 'g' : 'p'] += 1;
    });
    const rivales = [...por.values()];
    const ovr = Number(f.ovr) || 0;
    // matagigantes: cada duelo ganado contra alguien de más OVR que él (hoy)
    const gig = ovr ? du.filter((d) => d[2]).map((d) => ({ d, r: liga.quien(d[1]) })).filter((x) => x.r && Number(x.r.ovr) > ovr)
      .map((x) => ({ n: x.d[0], k: x.r.k, nom: x.r.n, ovr: Number(x.r.ovr), dif: Number(x.r.ovr) - ovr })).sort((a, b) => b.dif - a.dif) : [];
    return { evs, du, saco, rivales, gig };
  }, [liga, f, p, e]);
}

// el rival con su OVR y su puesto, si está en la tabla
function Meta({ r }) {
  if (!r || !r.ovr || !r.pos) return <small>fuera del ranking</small>;
  return <small>{r.cc ? <Bandera cc={r.cc} cls="pf9-flag" /> : null}OVR {r.ovr} · #{r.pos}</small>;
}

// ── 📸 SUS HISTORIAS: las que la página subió de él, como los destacados de Instagram. Un toque abre el visor del Inicio ──
function vistas() { try { return JSON.parse(localStorage.getItem('lg:historias2')) || {}; } catch (e) { return {}; } }
export function SusHistorias({ liga, f, p, esYo }) {
  const g = useMemo(() => { try { return historiasDePersona(liga, f.k, (p && p.mu) || []); } catch (err) { return null; } }, [liga, f.k, p]);
  if (!g) return null;
  const v = vistas();
  const xs = [...g.slides].reverse();
  return (
    <section className="pf9-hist" aria-label={esYo ? 'Tus historias' : 'Sus historias'}>
      <h3 className="pf9-hist-t">{esYo ? 'Tus historias' : 'Sus historias'}<small>{xs.length}</small></h3>
      <ul>
        {xs.map((s) => (
          <li key={s.id}>
            <button type="button" className={'pf9-hist-b' + (v[s.id] ? ' vista' : '')} onClick={() => window.lgVerHistorias && window.lgVerHistorias(g, s.id)}>
              <span className="pf9-hist-c" style={s.esc ? { backgroundImage: 'url(' + liga.logo(s.esc) + ')' } : undefined}><i>▶</i></span>
              <b>{limpio(String(s.tag || '').split('·')[0]).toLowerCase()}</b>
              <small>{s.t ? fecha(s.t) : ''}</small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── 📊 SU FORMA: sus últimos diez eventos en columnas —el alto, lo que sumó; el color, cómo le fue— y abajo quién lo sacó ──
export function SuForma({ liga, D, esYo }) {
  const xs = D.evs.slice(0, 10).reverse();
  if (xs.length < 2) return null;
  const mx = Math.max(...xs.map((x) => x.pts), 1);
  const t = xs.filter((x) => SEMIS.includes(x.pu)).length;
  const ult = xs[xs.length - 1];
  return (
    <section className="pf9-pz pf9-forma tinte-v">
      <header className="pf9-h"><h3>{esYo ? 'Tu forma' : 'Su forma'}</h3><span>últimos {xs.length} eventos</span></header>
      <ol className="pf9-fm" style={{ gridTemplateColumns: 'repeat(' + xs.length + ',minmax(0,1fr))' }}>
        {xs.map((x) => {
          const c = pu(x.pu);
          const s = D.saco(x.n);
          return (
            <li key={x.n}>
              <button type="button" onClick={() => accion.llave(String(x.n))} title={x.nom + ' · ' + x.pu + ' · +' + num(x.pts)} aria-label={x.nom + ': ' + x.pu + ', +' + num(x.pts)}>
                <em>+{kmil(x.pts)}</em>
                <b style={{ height: Math.max(12, Math.round((100 * x.pts) / mx)) + '%', background: c[1] }} />
                <span style={{ background: c[1], color: c[2] }}>{c[0]}</span>
              </button>
              <span className="pf9-fm-q" title={s ? 'Lo sacó ' + liga.aka(s) : 'Campeón'}>{s ? <Cara liga={liga} k={(liga.quien(s) || {}).k || ''} nombre={s} cls="cara pf9-av xs" lazy /> : '🏆'}</span>
              <small>{fecha(x.iso).toLowerCase()}</small>
            </li>
          );
        })}
      </ol>
      <p className="pf9-pie"><b>{t} de {esYo ? 'tus' : 'sus'} últimos {xs.length}</b> terminaron en semis o más · abajo, quién {esYo ? 'te' : 'lo'} sacó · el último: {ult.pu.toLowerCase()} en {ult.nom}</p>
    </section>
  );
}

// ── 🌙 SU MEJOR NOCHE: el título más nuevo (o su mejor puesto), ronda por ronda con cada rival, sus otros títulos y las
// finales que se le escaparon ──
const RONDAS = ['Final', 'Semifinal', 'Cuartos', 'Octavos', '16avos', '32avos'];
const HASTA = { Campeón: 0, Subcampeón: 0, Tercero: 1, Cuarto: 1, Semifinal: 1, Cuartos: 2, Octavos: 3 };
export function SuMejorNoche({ liga, f, D, esYo }) {
  const { evs, du } = D;
  if (!evs.length) return null;
  const titulos = evs.filter((x) => x.pu === 'Campeón');
  const orden = (x) => (LEJOS.indexOf(x.pu) < 0 ? -1 : LEJOS.indexOf(x.pu));
  const mejor = titulos[0] || [...evs].sort((a, b) => orden(b) - orden(a) || b.iso.localeCompare(a.iso))[0];
  // sus duelos de esa noche, del primero a la final (`du` viene del más nuevo al más viejo)
  const ds = du.filter((d) => d[0] === mejor.n).reverse();
  const tope = HASTA[mejor.pu] != null ? HASTA[mejor.pu] : 0;
  const pasos = ds.map((d, i) => ({ d, r: RONDAS[tope + (ds.length - 1 - i)] || '', f: liga.quien(d[1]) }));
  const otros = titulos.filter((x) => x.n !== mejor.n).slice(0, 6);
  const finales = evs.filter((x) => x.pu === 'Subcampeón');
  const gano = ds.filter((d) => d[2]).length;
  return (
    <section className="pf9-pz pf9-noche tinte-o">
      <header className="pf9-h"><h3>{esYo ? 'Tu mejor noche' : 'Su mejor noche'}</h3><span>{titulos.length ? titulos.length + (titulos.length === 1 ? ' título' : ' títulos') + ' en la ' + liga.temp : 'su mejor puesto'}</span></header>
      <p className="pf9-nt">{mejor.nom}</p>
      <p className="pf9-pie">{fecha(mejor.iso).toLowerCase()} · {siglaDe(mejor.sv)}{mejor.gente ? ' · ' + mejor.gente + ' raperos' : ''} · +{num(mejor.pts)}{ds.length ? ' · ' + (esYo ? 'le ganaste a ' : 'le ganó a ') + (gano === ds.length ? 'los ' + gano + ' que cruzó' : gano + ' de ' + ds.length) : ''}</p>
      {pasos.length ? (
        <ol className="pf9-ruta">
          {pasos.map(({ d, r, f: x }, i) => (
            <li key={i} className={d[2] ? '' : 'pierde'}>
              <span className="pf9-rd">{r}</span>
              <Cara liga={liga} k={x ? x.k : ''} nombre={d[1]} cls="cara pf9-av" lazy />
              <b><Alguien liga={liga} nombre={d[1]} /></b>
              <Meta r={x} />
              <em>{d[2] ? 'ganó' : 'perdió'}</em>
            </li>
          ))}
          {mejor.pu === 'Campeón' ? <li className="cop"><span className="pf9-rd">Campeón</span><span className="pf9-trofeo">1º</span><b>{limpio(f.n)}</b></li> : null}
        </ol>
      ) : null}
      {otros.length ? (
        <div className="pf9-otros"><span className="pf9-k">{esYo ? 'Tus' : 'Sus'} otros {otros.length} {otros.length === 1 ? 'título' : 'títulos'}</span>
          <ul>{otros.map((x) => <li key={x.n}><button type="button" onClick={() => accion.llave(String(x.n))}><b>{x.nom}</b><small>{fecha(x.iso).toLowerCase()} · {siglaDe(x.sv)}{x.gente ? ' · ' + x.gente + ' raperos' : ''}</small></button></li>)}</ul></div>
      ) : null}
      {finales.length ? (
        <div className="pf9-otros fp"><span className="pf9-k">{finales.length === 1 ? 'La final que se ' + (esYo ? 'te' : 'le') + ' escapó' : 'Las ' + finales.length + ' finales que se ' + (esYo ? 'te' : 'le') + ' escaparon'}</span>
          <ul>{finales.map((x) => {
            const q = D.saco(x.n);
            const r = q ? liga.quien(q) : null;
            return (
              <li key={x.n}><button type="button" onClick={() => accion.llave(String(x.n))}>
                {q ? <Cara liga={liga} k={r ? r.k : ''} nombre={q} cls="cara pf9-av xs" lazy /> : null}
                <b>{q ? liga.aka(q) : x.nom}</b>
                <small>{q ? (r && r.ovr ? 'OVR ' + r.ovr + (r.pos ? ' · #' + r.pos : '') + ' · ' : '') + x.nom : fecha(x.iso).toLowerCase() + ' · ' + x.gente + ' raperos'}</small>
              </button></li>
            );
          })}</ul></div>
      ) : null}
      <button type="button" className="pf9-btn bl" onClick={() => accion.llave(String(mejor.n))}>Ver la llave</button>
    </section>
  );
}

// ── ⚔️ RIVALIDADES: su némesis, su clásico, su mejor victoria y los matagigantes ──
export function Rivalidades({ liga, D, esYo }) {
  const { rivales, gig } = D;
  if (!rivales.length) return null;
  const nem = [...rivales].filter((r) => r.p > 0).sort((a, b) => b.p - a.p || a.g - b.g)[0];
  const cla = [...rivales].filter((r) => r.g + r.p >= 2 && (!nem || r.id !== nem.id)).sort((a, b) => (b.g + b.p) - (a.g + a.p) || b.g - a.g)[0];
  const mv = gig[0];
  const ev = (n) => limpio(((D.evs.find((x) => x.n === n) || {}).nom) || '');
  const tarjeta = (k, r, sc, cls, pie) => (
    <div className="pf9-rc">
      <span className="pf9-k">{k}</span>
      <Cara liga={liga} k={r.k} nombre={r.n || r.nom} cls="cara pf9-av lg" lazy />
      <b><Alguien liga={liga} nombre={r.n || r.nom} /></b>
      <span className={'pf9-sc ' + cls}>{sc}</span>
      <small>{pie}</small>
    </div>
  );
  if (!nem && !cla && !mv) return null;
  return (
    <section className="pf9-pz pf9-riv tinte-m">
      <header className="pf9-h"><h3>Rivalidades</h3></header>
      <div className="pf9-rcs">
        {nem ? tarjeta(esYo ? 'Tu némesis' : 'Su némesis', nem, nem.g + '–' + nem.p, 'mal', (esYo ? 'te ganó ' : 'le ganó ') + (nem.p === 1 ? 'una vez' : nem.p + ' veces') + (nem.f && nem.f.pos ? ' · es el #' + nem.f.pos : '')) : null}
        {cla ? tarjeta(esYo ? 'Tu clásico' : 'Su clásico', cla, cla.g + '–' + cla.p, '', 'se cruzaron ' + (cla.g + cla.p) + ' veces') : null}
        {mv ? tarjeta(esYo ? 'Tu mejor victoria' : 'Su mejor victoria', mv, '+' + mv.dif, 'bien', 'OVR ' + mv.ovr + ' · en ' + ev(mv.n)) : null}
      </div>
      {gig.length ? (
        <div className="pf9-gig"><span className="pf9-k">Matagigantes · {gig.length === 1 ? 'un duelo ganado' : gig.length + ' duelos ganados'} contra alguien de más OVR</span>
          <ul>{gig.slice(0, 6).map((x, i) => (
            <li key={i}><Cara liga={liga} k={x.k} nombre={x.nom} cls="cara pf9-av xs" lazy /><b><Alguien liga={liga} nombre={x.nom} /></b><small>OVR {x.ovr}</small><em>+{x.dif}</em></li>
          ))}</ul></div>
      ) : null}
    </section>
  );
}

// ── 🅑 SU CAMINO: las letras que tuvo en la temporada (del muro) y la barra de Score hasta la que sigue ──
export function SuCamino({ liga, f, p, esYo }) {
  const sc = Number(f.sc);
  const orden = [...((liga.d.rangos) || [])].sort((a, b) => a.min - b.min);
  if (!f.rg || !sc || !orden.length) return null;
  const pasos = [];
  [...((p && p.mu) || [])].filter((m) => m.tipo === 'rango' && m.rg).sort((a, b) => String(a.t).localeCompare(String(b.t))).forEach((m) => {
    if (!pasos.length || pasos[pasos.length - 1].rg !== m.rg) pasos.push({ rg: m.rg, t: m.t });
  });
  if (!pasos.length || pasos[pasos.length - 1].rg !== f.rg) pasos.push({ rg: f.rg, t: '' });
  const sig = orden.find((r) => r.min > sc);
  const act = [...orden].reverse().find((r) => r.min <= sc);
  const pct = sig && act ? Math.max(3, Math.min(100, Math.round((100 * (sc - act.min)) / (sig.min - act.min)))) : 100;
  return (
    <section className="pf9-pz pf9-crg tinte-g">
      <header className="pf9-h"><h3>{esYo ? 'Tu camino' : 'Su camino'}</h3><span>{esYo ? 'tu' : 'su'} rango en la {liga.temp}</span></header>
      <ol className="pf9-sube">
        {pasos.slice(-4).map((x, i, xs) => (
          <li key={i}><span className="pf9-rg" style={{ background: liga.colorRg(x.rg) }}>{x.rg}</span><small>{x.t ? (i ? 'desde el ' : 'el ') + fecha(x.t).toLowerCase() : i === xs.length - 1 && i ? 'hoy' : ''}</small></li>
        ))}
        {sig ? <li className="sig"><span className="pf9-rg">{sig.r}</span><small>pide {sig.min}</small></li> : null}
      </ol>
      {sig && act ? (
        <>
          <div className="pf9-scb"><span>{act.r} {act.min}</span><i><u style={{ width: pct + '%' }} /></i><span>{sig.r} {sig.min}</span></div>
          <p className="pf9-pie">Score <b>{coma(sc)}</b>: {esYo ? 'te faltan' : 'le faltan'} <b>{coma(sig.min - sc)}</b> para la {sig.r}. El Score sale de {esYo ? 'tus' : 'sus'} fortalezas.</p>
        </>
      ) : <p className="pf9-pie">Score <b>{coma(sc)}</b>: la letra más alta.</p>}
    </section>
  );
}

// ── 🏅 SUS RÉCORDS: lo mejor que hizo en una noche y sus mejores rachas ──
export function SusRecords({ f, p, D, esYo }) {
  const { evs, du } = D;
  if (!evs.length) return null;
  const xs = [];
  const masPts = evs.reduce((a, b) => (b.pts > a.pts ? b : a), evs[0]);
  if (masPts.pts) xs.push(['Más puntos en una noche', '+' + num(masPts.pts), masPts.nom]);
  const cuenta = {};
  du.filter((d) => d[2]).forEach((d) => { cuenta[d[0]] = (cuenta[d[0]] || 0) + 1; });
  const nmax = Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a])[0];
  if (nmax && cuenta[nmax] > 1) xs.push(['Más duelos ganados en una noche', String(cuenta[nmax]), (evs.find((x) => String(x.n) === nmax) || {}).nom || '']);
  const mayor = evs.reduce((a, b) => (b.gente > a.gente ? b : a), evs[0]);
  if (mayor.gente) xs.push([esYo ? 'Tu evento más grande' : 'Su evento más grande', mayor.gente + ' raperos', mayor.nom + ' · ' + mayor.pu.toLowerCase()]);
  const grandes = evs.filter((x) => x.gente >= 20 && LEJOS.includes(x.pu));
  if (grandes.length) {
    const l = grandes.sort((a, b) => LEJOS.indexOf(b.pu) - LEJOS.indexOf(a.pu) || b.gente - a.gente)[0];
    xs.push(['Lo más lejos en uno de 20+', l.pu, l.nom + ' · ' + l.gente + ' raperos']);
  }
  const rd = p && p.rd;
  if (rd && rd[1]) xs.push(['Mejor racha de duelos', rd[1] + (rd[1] === 1 ? ' ganado' : ' seguidos'), 'hoy ' + rd[0]]);
  const rch = Array.isArray(f.rch) ? f.rch : null;
  if (rch && rch[1]) xs.push(['Mejor racha de eventos', rch[1] + (rch[1] === 1 ? ' evento' : ' seguidos'), 'en semis o más · hoy ' + rch[0]]);
  if (!xs.length) return null;
  return (
    <section className="pf9-pz pf9-rec tinte-o">
      <header className="pf9-h"><h3>{esYo ? 'Tus récords' : 'Sus récords'}</h3></header>
      <ul>{xs.map((x, i) => <li key={i}><span>{x[0]}<small>{x[2]}</small></span><b>{x[1]}</b></li>)}</ul>
    </section>
  );
}

// ── 📰 SU MURO, COMO PUBLICACIONES: las mismas filas (`Fila` de publicaciones2.jsx: firma en primera persona, lo fuerte
// grande, 👏 Felicitar, la nube del último comentario) y los mismos filtros, con lo de él. Las subidas de rango seguidas
// con la misma letra son una sola noticia (el muro anota cada vez que vuelve a entrar al tramo): queda el día que llegó ──
const VER_MURO = 4;
export function SuMuro({ liga, p, esYo, n = VER_MURO }) {
  const A = useAplausos();
  useComentarios();
  const P = usePase(typeof window !== 'undefined' && !!window.DC);
  const [fil, setFil] = useState('');
  const [todas, setTodas] = useState(false);
  const xs = useMemo(() => {
    const mu = ((p && p.mu) || []).filter((it) => it.tipo !== 'anuncio');
    const fuera = new Set();
    let previo = null;
    [...mu].reverse().forEach((m) => {
      if (m.tipo !== 'rango') return;
      if (previo === m.rg) fuera.add(m.id);
      previo = m.rg;
    });
    return mu.filter((m) => !fuera.has(m.id));
  }, [p]);
  if (!xs.length) return null;
  const chips = FILTROS2.filter(([k]) => k && TIPOS[k]).map(([k, n]) => [k, n, xs.filter((it) => TIPOS[k].includes(it.tipo)).length]).filter((x) => x[2]);
  const lista = fil ? xs.filter((it) => TIPOS[fil].includes(it.tipo)) : xs;
  const ver = todas ? lista : lista.slice(0, n);
  const fel = xs.reduce((s, it) => s + Number(A.cu[it.id] || 0), 0);
  return (
    <section className="pf9-pz pf9-muro pw" id="pf-publicaciones" data-n={lista.length}>
      <header className="pf9-h"><h3>{esYo ? 'Tu muro' : 'Su muro'}</h3><span>{xs.length} {xs.length === 1 ? 'publicación' : 'publicaciones'}{fel ? ' · ' + fel + (fel === 1 ? ' felicitación' : ' felicitaciones') : ''}</span></header>
      {chips.length > 1 ? (
        <div className="pw-chips pf9-chips" role="group" aria-label="Qué publicaciones ver">
          <button type="button" className={fil ? '' : 'on'} aria-pressed={!fil} onClick={() => { setFil(''); setTodas(false); }}>Todo <em>{xs.length}</em></button>
          {chips.map(([k, n, c]) => <button key={k} type="button" className={fil === k ? 'on' : ''} aria-pressed={fil === k} onClick={() => { setFil(k); setTodas(false); }}>{n} <em>{c}</em></button>)}
        </div>
      ) : null}
      <div className="pf9-filas">{ver.map((it) => <Fila key={it.id || it.t} liga={liga} it={it} A={A} P={P} nuevo={false} />)}</div>
      {lista.length > n ? (
        <button type="button" className="pf9-btn" aria-expanded={todas} onClick={() => setTodas(!todas)}>
          {todas ? 'Ver menos' : 'Ver las ' + lista.length + ' publicaciones'}</button>
      ) : null}
    </section>
  );
}

// ── la banda: negra o blanca a todo el ancho, con su título grande y su raya arriba, como el Inicio ──
export function Banda({ color, titulo, link, ir, id, children }) {
  return (
    <section className={'pf9-banda ' + color} id={id}>
      <div className="pf9-bi">
        {titulo ? <header className="pf9-bh"><h2>{titulo}</h2>{link ? <a className="pf9-bl" href={ir}>{link} →</a> : null}</header> : null}
        {children}
      </div>
    </section>
  );
}

