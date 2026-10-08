// El perfil de cada rapero (`#/r/<clave>` y `#/r/<clave>/<pestaña>`). Dlx, 03/10/2026, al plan: «1. A» (pestañas:
// Resumen · Eventos · Duelos · Insignias, cada una con su link) · «2. A» (en Resumen: sus números, sus fortalezas —el
// radar que pidió el 27/09—, en cada ranking, lo que le falta y el precio por su cabeza) · «3. A» (el cara a cara y sus
// duelos, juntos: al tocar un rival, sus duelos con él). Para todos desde la 2.09 (Dlx: «1. A»), con «Comparar conmigo»
// («2. A»). El de app.js sigue escondido, de respaldo.
//
// ⚠️ LOS DATOS SON LOS DE LA PÁGINA DE HOY: la fila de la tabla (`liga.T[k]`) y `/api/perfiles` (`p[k]`: `ev` sus
// eventos, `du` sus duelos, `dm` las cinco dimensiones, `rd` la racha de duelos, `rk` su puesto en cada ranking, `req`
// lo que le falta, `ins` sus insignias, `mw` su cacería; `e` los eventos y `dmp` el promedio de la Liga). Las acciones
// —seguir, el precio por cabeza, el visor de cartas y de llaves— son las de app.js.
import { useEffect, useMemo, useRef, useState } from 'react';
import { diaISO, limpio, minutosDelDia, norm, num, siglaDe } from './liga.js';
import { Bandera, Cara, Carta, Compartir, DosToques, FaltaLista, Ico, Rango, SinCarta, accion, enlace, https, nombrePais, usePerfiles } from './piezas.jsx';
import { REDES } from './servidor.jsx';
import { useNiveles } from './racha.js';
import { usePaseDe } from './pase.js';
import * as RQ from './requisitos.js';

// 🔑 UNA SOLA PÁGINA (Dlx, 07/10/2026: *«me gustaría que todo esté en una página, no que esté dividido en varias»*).
// Las pestañas de antes siguen siendo links que circulan (`#/r/x/duelos`): ahora bajan hasta su sección
const SECCIONES = ['eventos', 'duelos', 'insignias'];
const DIAS = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
const DIA1 = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const ORDEN = ['temporada', 'competitivo', 'servidor', 'pais'];
const NOMBRE = { temporada: 'Temporada', competitivo: 'Competitiva', servidor: 'Servidor', pais: 'País' };
// quién está en «Comparar dos» de Tarjetas (la de Temporada, que es la que abre): con carta y con cara, como
// `conTarjeta()` de app.js. Sin esto, «Comparar conmigo» con alguien sin cara ponía en su lugar al #1 de la lista
const enComparar = (x) => !!x && (x.c || []).includes('temporada') && x.fo !== 0;
const MEDALLA = { Campeón: '🥇', Subcampeón: '🥈', Tercero: '🥉' };
// en la zona de quien mira (Ajustes), no la del aparato (revisión del 04/10/2026)
const fecha = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const [, m, dd] = diaISO(d).split('-');
  return Number(dd) + ' ' + ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'][Number(m) - 1];
};

// ── seguir: el de app.js (`alternarSigo()`: este navegador y, si entraste con Discord, tu cuenta). A quién seguís
// vuelve por `lg:sigo`, así que el botón cambia solo. Los seguidores (`pedirSeguidores()`, cinco minutos de memoria)
// se corrigen al toque con lo que acabás de hacer, para que seguir no deje el número igual ──
function useSeguidores(k) {
  const [n, setN] = useState(null);
  useEffect(() => {
    let vivo = true;
    setN(null);
    if (typeof window.pedirSeguidores === 'function') {
      Promise.resolve(window.pedirSeguidores()).then((s) => { if (vivo) setN((s || {})[k] || 0); }).catch(() => {});
    }
    return () => { vivo = false; };
  }, [k]);
  return n;
}
function Seguir({ si, onSeguir }) {
  return (
    <button type="button" className={'btn chico pf-sigo ' + (si ? 'borde on' : 'verde')} aria-pressed={si} onClick={onSeguir}>
      <Ico n="seguir" t={16} />{si ? 'Siguiendo' : 'Seguir'}
    </button>
  );
}

// ── el precio por su cabeza: el de la Tienda de app.js (`ponerPrecio()`), con su cuenta y sus errores; las
// cabezas van por NOMBRE. Sólo a quien juega la temporada y no es «fuera de concurso» (`puedeCabeza()`) ──
const sinEtiquetas = (h) => String(h || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
function usePrecios() {
  const [, setV] = useState(0);
  useEffect(() => {
    const f = () => setV((x) => x + 1);
    window.addEventListener('lg:precios', f);
    return () => window.removeEventListener('lg:precios', f);
  }, []);
}
function Precio({ liga, f, esYo, dc }) {
  usePrecios();
  const T = liga.d.tienda;
  if (!T || f.fc || !f.pos || typeof window.ponerPrecio !== 'function') return null;
  const v = (typeof window.valorCabezas === 'function' ? window.valorCabezas() : {})[f.n] || 0;
  const est = (window.PR_EST || {})[f.n] || {};
  const saldo = window.BILL && window.BILL.ok ? window.BILL.saldo : null;
  const queda = T.tope - v;
  const msg = est.va ? 'Poniendo ' + num(est.va) + '…'
    : est.ok ? '✓ Pusiste ' + num(est.ok) + '. Si nadie lo caza en la semana, vuelven a vos.'
      : est.error ? sinEtiquetas(typeof window.errorPrecio === 'function' ? window.errorPrecio(est) : 'No pude ponerlo.')
        : dc ? 'Elegí cuánto ponerle.' : 'Para poner un precio entrás con Discord: tocá un monto.';
  return (
    <section className="sec pf-sec negra">
      <div className="sec-t"><h2>Precio por su cabeza</h2><a href="#/tienda">Cómo funciona <Ico n="flecha" t={16} /></a></div>
      <p className="pf-bajada">El primero que le gane en un evento de la Liga se lleva lo que vale, en Puntos de Tienda y en su Temporada.</p>
      <p className="pf-pr"><b>{limpio(f.n)}</b> vale <span className="pf-pr-v">{num(v)}</span>
        {v < T.tope ? <> · se le pueden poner {num(queda)} más</> : <> · ya vale lo máximo</>}</p>
      {esYo ? <p className="pf-bajada">Sos vos: no te podés poner precio.</p> : (
        <>
          <div className="pf-pr-m">
            {[1, 2, 5, 10].map((x) => T.min * x).map((m) => (
              <DosToques key={m} className="btn borde2 chico" disabled={m > queda || (saldo != null && m > saldo) || !!est.va}
                confirmar={'¿' + num(m) + '? Tocá de nuevo'} onClick={() => window.ponerPrecio(f.n, m)}>+{num(m)}</DosToques>
            ))}
          </div>
          <p className={'pf-pr-e' + (est.error ? ' mal' : '')} aria-live="polite">{msg}</p>
        </>
      )}
    </section>
  );
}

// ── arriba: quién es, sus números y su tarjeta (con sus cuatro para cambiar) ──
function Cabeza({ liga, f, k, p, dc, esYo, resumen }) {
  const si = (liga.sigue || []).includes(k);
  const n0 = useSeguidores(k);
  const [si0, setSi0] = useState(si);
  useEffect(() => { setSi0((liga.sigue || []).includes(k)); }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  const segs = n0 == null ? null : Math.max(0, n0 + (si ? 1 : 0) - (si0 ? 1 : 0));
  const redes = ((p && p.redes) || []).filter((r) => r && r[1]);
  const cs = ORDEN.filter((c) => (f.c || []).includes(c));
  const [cual, setCual] = useState(cs[0] || 'temporada');
  useEffect(() => { setCual(cs[0] || 'temporada'); setOtroSv(''); }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  // 🃏 LA SERVIDOR DE SUS OTROS SERVIDORES (Dlx, 07/10/2026: *«en la opción de tarjetas servidor, que se vea la opción
  // para ver sus otros servidores también»*): la misma carta con la camiseta de otro, `<clave>/sv-<sv>.webp` (`svc`)
  const [otroSv, setOtroSv] = useState('');
  const propio = String(f.sv || '').toLowerCase();
  const svc = ((p && p.svc) || []).filter((x) => x !== propio);
  const sv = f.sv && liga.svs[f.sv];
  const crew = liga.crewDe(f);
  // 🔥 su nivel y su racha diaria (04/10/2026): por la clave del perfil, nunca por cuenta. Sin Discord no hay
  const nvs = useNiveles();
  const nv = nvs && nvs[k];
  // 🎟️ y su Pase de rapero (05/10/2026): el nivel, el título y el color de su nombre, por la clave del perfil
  const pa = usePaseDe(k);
  return (
    <div className="escena pf-esc" style={{ '--mo-c': (sv && sv.color) || '#E41373', '--mo-o': 0.85, '--mo-c2': '#29B298' }}>
      <section className={'rk-cab pf-cab' + (resumen ? '' : ' sin-carta')}>
        <div className="rk-tx pf-tx">
          <span className="tag">{f.pos ? '#' + f.pos + ' DE LA TEMPORADA' : 'FUERA DE CONCURSO'} · {liga.temp}</span>
          <div className="pf-quien">
            <Cara liga={liga} k={k} nombre={f.n} cls="cara pf-cara" />
            <h1 className="hero-ev largo" style={pa && pa.color ? { color: pa.color } : undefined}>{limpio(f.n)}</h1>
          </div>
          {segs ? <p className="pf-segs"><b>{num(segs)}</b> {segs === 1 ? 'seguidor' : 'seguidores'}</p> : null}
          <ul className="pf-chips">
            {f.cc ? <li><a href={'#/pais/' + f.cc}><Bandera cc={f.cc} cls="pf-flag" />{nombrePais(f.cc)}</a></li> : null}
            {f.sv ? <li><a href={'#/sv/' + siglaDe(f.sv)}><img alt="" src={liga.logo(f.sv)} />{(sv && sv.nombre) || siglaDe(f.sv)}</a></li> : null}
            {crew ? <li><a href={'#/crew/' + encodeURIComponent(crew.clave || crew.crew)}>{limpio(crew.crew)}</a></li>
              : f.crew ? <li><span>{limpio(f.crew)}</span></li> : null}
            {nv ? <li><span className="pf-nivel" title="Sube jugando eventos y entrando cada día">Nivel {nv[0]}</span></li> : null}
            {nv && nv[1] >= 2 ? <li><span title={nv[1] + ' días seguidos en la Liga'}>🔥 {nv[1]} días</span></li> : null}
            {pa ? <li><a className="pf-pase" href="#/pase" title="Su nivel en el Pase de rapero de la temporada">🎟️ Pase {pa.nivel}{pa.titulo ? ' · ' + pa.titulo : ''}</a></li> : null}
          </ul>
          {redes.length ? (
            <ul className="pf-redes" aria-label="Sus redes">
              {redes.filter((r) => https(r[1])).map((r) => <li key={r[1]}><a href={https(r[1])} target="_blank" rel="noopener noreferrer">{REDES[r[0]] || r[0]} ↗</a></li>)}
            </ul>
          ) : null}
          <dl className="pf-num">
            <div><dt>OVR</dt><dd className="ovr">{f.ovr || '—'}</dd></div>
            <div><dt>RANGO</dt><dd><Rango liga={liga} rg={f.rg} /></dd></div>
            <div><dt>PUNTOS</dt><dd>{num(f.pts || 0)}</dd></div>
            <div><dt>EVENTOS</dt><dd>{f.ev || 0}</dd></div>
            <div><dt>WIN%</dt><dd title={f.wr ? undefined : 'El Win% aparece con 10 eventos'}>{f.wr ? String(f.wr).replace('.', ',') : '—'}</dd></div>
          </dl>
          <div className="hero-acc pf-acc">
            {!esYo && typeof window.alternarSigo === 'function' ? <Seguir si={si} onSeguir={() => window.alternarSigo(k)} /> : null}
            {esYo && dc ? <button type="button" className="btn borde chico" onClick={accion.foto}>Cambiar mi foto</button> : null}
            {!esYo && liga.yo && liga.yo.k !== f.k && enComparar(liga.yo) && enComparar(f) ? (
              <a className="btn borde chico" href={'#/tarjetas?a=' + encodeURIComponent(liga.yo.k) + '&b=' + encodeURIComponent(f.k)}>Comparar conmigo</a>
            ) : null}
            <Compartir cls="btn borde chico" url={enlace('#/r/' + encodeURIComponent(k))} texto={limpio(f.n) + ' en la Liga Global'} etiqueta="Compartir" />
          </div>
          {f.nv ? <p className="pf-nv"><b>Sin verificar.</b> {RQ.sinVerificar(f.nv, esYo)}{esYo ? <> <a href="#/cuenta/verificar">Verificarme</a></> : null}</p> : null}
        </div>
        <div className="pf-carta">
          {cs.length > 1 ? (
            <div className="pf-cartas" role="tablist" aria-label="Sus tarjetas">
              {cs.map((c) => <button key={c} type="button" role="tab" aria-selected={c === cual} className={c === cual ? 'on' : ''} onClick={() => setCual(c)}>{NOMBRE[c]}</button>)}
            </div>
          ) : null}
          {cual === 'servidor' && svc.length ? (
            <div className="pf-svs" role="tablist" aria-label="La carta de Servidor en cada servidor">
              {[''].concat(svc).map((x) => (
                <button key={x || 'propio'} type="button" role="tab" aria-selected={x === otroSv} className={x === otroSv ? 'on' : ''}
                  onClick={() => setOtroSv(x)}>
                  <img alt="" src={liga.logo((x || propio).toUpperCase())} />{siglaDe((x || propio).toUpperCase())}
                </button>
              ))}
            </div>
          ) : null}
          <div className={'pf-carta-c tj-' + cual}>
            {cs.length && cual === 'servidor' && otroSv ? (
              <button type="button" className="sin-boton" onClick={() => accion.carta(k)} aria-label={'Ver las cartas de ' + f.n}>
                <img className="tj-c" alt={'Carta de Servidor de ' + f.n + ' en ' + siglaDe(otroSv.toUpperCase())}
                  src={liga.d.r2 + '/' + k + '/sv-' + otroSv + '.webp'} loading="lazy" />
              </button>
            ) : cs.length ? <Carta liga={liga} k={k} cual={cual} cls="tj-c" /> : <SinCarta liga={liga} k={k} nombre={f.n} cc={f.cc} cls="tj-c" />}
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Resumen ──
function Numeros({ f, p }) {
  const du = (p && p.du) || [];
  const g = du.filter((d) => d[2]).length;
  const rd = (p && p.rd) || null;
  return (
    <section className="sec pf-sec">
      <div className="sec-t"><h2>Sus números</h2></div>
      <dl className="pf-tiles">
        <div><dd className="pf-med"><span>🥇 {f.oro || 0}</span><span>🥈 {f.seg || 0}</span><span>🥉 {f.ter || 0}</span></dd><dt>PODIOS</dt></div>
        <div><dd>{f.sem || 0}</dd><dt>QUEDÓ EN SEMIS</dt></div>
        <div><dd>{g}<small>/{du.length}</small></dd><dt>DUELOS GANADOS</dt></div>
        <div><dd>{rd ? rd[0] : 0}{rd ? <small> · máx {rd[1]}</small> : null}</dd><dt>RACHA DE DUELOS</dt></div>
      </dl>
    </section>
  );
}

// 🔎 SUS DATOS (Dlx, 07/10/2026: *«qué días usualmente participa, su win rate en réplicas… HACE MEJOR EQUIPO con X
// persona… su verdugo es… y su hijo es…»*, y después: *«en sus datos, sé más detallista»*). Todo sale de lo que el perfil
// ya trae —sus eventos (`ev`, con `e`: nombre, servidor, instante), sus duelos (`du`), el compañero y las réplicas que
// arma el ciclo (`eq`, `rp`)—, y las horas en la zona de quien mira. Sin dato no hay renglón; sin ninguno, no hay sección
const PUESTOS = ['Campeón', 'Subcampeón', 'Tercero', 'Cuarto', 'Semifinal', 'Cuartos', 'Octavos', 'R32', 'Dieciseisavos'];
const FRANJA = [[6, 'de madrugada'], [12, 'a la mañana'], [19, 'a la tarde'], [24, 'a la noche']];
const DIA_MS = 864e5;
function franjaDe(iso) {
  const h = minutosDelDia(iso) / 60;
  return (FRANJA.find(([hasta]) => h < hasta) || FRANJA[3])[1];
}
function haceDias(iso) {
  const n = Math.round((new Date(diaISO(new Date()) + 'T12:00:00Z') - new Date(diaISO(new Date(iso)) + 'T12:00:00Z')) / DIA_MS);
  return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : 'hace ' + n + ' días';
}
function Datos({ liga, p, e }) {
  const filas = [];
  const ev = (p && p.ev) || [];
  const de = (n) => (e || {})[n] || [];
  const conFecha = ev.filter(([n]) => de(n)[2] && !isNaN(new Date(de(n)[2])));
  // 📅 los días, y a qué hora (la franja que junta más de la mitad)
  if (ev.length >= 3) {
    const c = [0, 0, 0, 0, 0, 0, 0];
    conFecha.forEach(([n]) => { c[new Date(diaISO(new Date(de(n)[2])) + 'T12:00:00Z').getUTCDay()] += 1; });
    const tope = Math.max(2, Math.ceil(ev.length * 0.25));
    const dias = c.map((v, i) => [v, i]).filter(([v]) => v >= tope).sort((a, b) => b[0] - a[0]).slice(0, 2);
    const fr = {};
    conFecha.forEach(([n]) => { const f = franjaDe(de(n)[2]); fr[f] = (fr[f] || 0) + 1; });
    const [franja, nf] = Object.entries(fr).sort((a, b) => b[1] - a[1])[0] || [];
    const aHora = franja && nf * 2 > conFecha.length ? franja : '';
    if (dias.length) {
      filas.push(['📅', 'Suele jugar', 'los ' + dias.map(([, i]) => DIAS[i]).join(' y los ') + (aHora ? ', ' + aHora : ''),
        dias.map(([v, i]) => v + ' ' + (v === 1 ? 'evento' : 'eventos') + ' un ' + DIA1[i]).join(' · ')
        + (aHora ? ' · ' + nf + ' de ' + conFecha.length + ' ' + aHora + ' (tu hora)' : '')]);
    } else if (aHora && conFecha.length >= 3) {
      filas.push(['🕘', 'Suele jugar', aHora, nf + ' de ' + conFecha.length + ' eventos, en tu hora']);
    }
  }
  // 🏟️ dónde juega más
  if (ev.length >= 2) {
    const sv = {};
    ev.forEach(([n]) => { const s = de(n)[1]; if (s) sv[s] = (sv[s] || 0) + 1; });
    const [s, k] = Object.entries(sv).sort((a, b) => b[1] - a[1])[0] || [];
    const otros = Object.keys(sv).length - 1;
    if (s) {
      filas.push(['🏟️', 'Juega más en', liga.svs[s] ? (liga.svs[s].nombre || siglaDe(s)) : siglaDe(s),
        k + ' de ' + ev.length + ' eventos' + (otros > 0 ? ' · también en ' + otros + (otros === 1 ? ' servidor más' : ' servidores más') : '')]);
    }
  }
  // 🏆 su mejor resultado, con el evento y la fecha (y cuántas veces más)
  const conPuesto = ev.filter(([, pu]) => PUESTOS.indexOf(pu) >= 0);
  if (conPuesto.length) {
    const mejor = Math.min(...conPuesto.map(([, pu]) => PUESTOS.indexOf(pu)));
    const esos = conPuesto.filter(([, pu]) => PUESTOS.indexOf(pu) === mejor);
    const [n] = esos[0];
    const x = de(n);
    filas.push([MEDALLA[PUESTOS[mejor]] || '🎖️', 'Su mejor resultado', PUESTOS[mejor],
      limpio(x[0] || 'Evento ' + n) + (x[2] ? ' · ' + fecha(x[2]).toLowerCase() : '')
      + (esos.length > 1 ? ' · y ' + (esos.length - 1) + (esos.length === 2 ? ' vez más' : ' veces más') : '')]);
  }
  // 📈 cuánto hace por evento
  if (ev.length >= 2) {
    const tot = ev.reduce((s, x) => s + (Number(x[2]) || 0), 0);
    const top = Math.max(...ev.map((x) => Number(x[2]) || 0));
    filas.push(['📈', 'Por evento', num(Math.round(tot / ev.length)) + ' puntos', 'el que más le dio: ' + num(top)]);
  }
  const du = (p && p.du) || [];
  if (du.length) {
    const por = new Map();
    du.forEach((d) => {
      const r = liga.fila(d[1]);
      const id = r ? r.k : 'n:' + limpio(d[1]).toLowerCase();
      if (!por.has(id)) por.set(id, { k: r ? r.k : '', n: r ? r.n : d[1], g: 0, p: 0, evs: new Set() });
      const x = por.get(id);
      x[d[2] ? 'g' : 'p'] += 1;
      x.evs.add(d[0]);
    });
    const rs = [...por.values()];
    // 🔥 SU CLÁSICO, con la regla de la Liga (la Guía: «cuando dos se cruzan en su tercer evento o más, es un
    // Clásico»): tres eventos distintos, no tres batallas. Dlx, 07/10/2026: «y su clásico de cada uno, añadir eso»
    const clasicos = rs.filter((r) => r.evs.size >= 3).sort((a, b) => b.evs.size - a.evs.size || (b.g + b.p) - (a.g + a.p));
    if (clasicos.length) {
      const c = clasicos[0];
      filas.push(['🔥', 'Su clásico', c, c.evs.size + ' eventos cruzados · ' + c.g + '–' + c.p + ' en duelos'
        + (clasicos.length > 1 ? ' · y ' + (clasicos.length - 1) + (clasicos.length === 2 ? ' clásico más' : ' clásicos más') : '')]);
    }
    // 🔑 MÁS FORMAL (Dlx, 07/10/2026: «¿puedes hacer que sea más formal lo de verdugo e hijo?»): decía «su verdugo» y
    // «su hijo»; la cuenta es la misma —desde dos, y más ganadas que perdidas (o al revés)—
    const dificil = rs.filter((r) => r.p >= 2 && r.p > r.g).sort((a, b) => b.p - a.p || a.g - b.g)[0];
    const vencio = rs.filter((r) => r.g >= 2 && r.g > r.p).sort((a, b) => b.g - a.g || a.p - b.p)[0];
    if (dificil) filas.push(['🛡️', 'Su rival más difícil', dificil, 'le ganó ' + dificil.p + ' de ' + (dificil.g + dificil.p) + ' duelos']);
    if (vencio) filas.push(['🎯', 'El rival que más venció', vencio, 'le ganó ' + vencio.g + ' de ' + (vencio.g + vencio.p) + ' duelos']);
  }
  if (p && p.eq) {
    const r = liga.T[p.eq[0]];
    filas.push(['🤝', 'Hace mejor equipo con', { k: r ? r.k : '', n: r ? r.n : p.eq[1] }, 'ganaron ' + p.eq[2] + ' de ' + p.eq[3] + ' juntos']);
  }
  if (p && p.rp && p.rp[1]) filas.push(['🔁', 'En réplicas', 'ganó ' + p.rp[0] + ' de ' + p.rp[1], 'las votadas en un canal que lee el bot']);
  // 🌱 cuándo debutó, y 🕒 su último evento
  if (conFecha.length) {
    const orden = conFecha.slice().sort((a, b) => new Date(de(a[0])[2]) - new Date(de(b[0])[2]));
    const [n0] = orden[0];
    const [n1] = orden[orden.length - 1];
    filas.push(['🌱', 'Debutó', fecha(de(n0)[2]).toLowerCase(), limpio(de(n0)[0] || 'Evento ' + n0)]);
    if (orden.length > 1) filas.push(['🕒', 'Su último evento', haceDias(de(n1)[2]), limpio(de(n1)[0] || 'Evento ' + n1)]);
  }
  if (!filas.length) return null;
  return (
    <section className="sec pf-sec">
      <div className="sec-t"><h2>Sus datos</h2></div>
      <ul className="pf-datos">
        {filas.map(([ic, et, v, sub]) => (
          <li key={et}>
            <span className="pf-dt-ic" aria-hidden="true">{ic}</span>
            <small>{et}</small>
            {typeof v === 'object' ? (
              v.k ? <a className="pf-dt-q" href={'#/r/' + encodeURIComponent(v.k)}><Cara liga={liga} k={v.k} nombre={v.n} cls="cara pf-dt-cara" lazy />{limpio(v.n)}</a>
                : <b className="pf-dt-q">{limpio(v.n)}</b>
            ) : <b>{v}</b>}
            <em>{sub}</em>
          </li>
        ))}
      </ul>
    </section>
  );
}

// el radar de las cinco dimensiones del Score, contra el promedio de la Liga (Dlx, 27/09/2026: «en mi perfil de la hoja
// había un gráfico donde comparaba las estadísticas del competitivo y te mostraba cuál era más fuerte y menos»)
// `oculto`: la vista previa de la bloqueada — la forma es de ejemplo y en vez de los números va «?»
function Radar({ dims, val, prom, oculto }) {
  const cx = 150;
  const cy = 132;
  const R = 96;
  const ang = (i) => -Math.PI / 2 + (2 * Math.PI * i) / dims.length;
  const pt = (i, v) => [cx + Math.cos(ang(i)) * R * v / 100, cy + Math.sin(ang(i)) * R * v / 100];
  const poly = (vs) => vs.map((v, i) => pt(i, Math.max(3, Math.min(100, v || 0))).map((x) => x.toFixed(1)).join(',')).join(' ');
  return (
    <svg className="pf-radar" viewBox="0 0 300 270" role="img"
      aria-label={oculto ? 'Vista previa de sus fortalezas: se desbloquean con la tarjeta Competitiva'
        : 'Sus fortalezas: ' + dims.map((d, i) => d[1] + ' ' + (val[i] || 0)).join(', ')}>
      {[25, 50, 75, 100].map((r) => <polygon key={r} className="pf-r-red" points={poly(dims.map(() => r))} />)}
      {dims.map((d, i) => { const [x, y] = pt(i, 100); return <line key={d[1]} className="pf-r-eje" x1={cx} y1={cy} x2={x} y2={y} />; })}
      {prom ? <polygon className="pf-r-liga" points={poly(prom)} /> : null}
      <polygon className={'pf-r-yo' + (oculto ? ' fantasma' : '')} points={poly(val)} />
      {dims.map((d, i) => {
        const [x, y] = pt(i, 122);
        return <text key={d[1]} className="pf-r-et" x={x} y={y + 5} textAnchor={Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end'}>{d[0]} {oculto ? '?' : val[i] || 0}</text>;
      })}
    </svg>
  );
}

// 🔒 LA VISTA PREVIA DE LA BLOQUEADA. Dlx, 07/10/2026: *«muéstrales una preview de lo que sería, desbloqueás esto al
// tener 10 eventos»*. El radar va con una forma de EJEMPLO —sus números no se muestran hasta que tenga la carta—, con
// qué mide cada una y cuánto le falta, dicho como `requisitos.js`. Quien ya tiene los eventos y no la carta es porque no
// está verificado (`nv`)
const EJEMPLO = [72, 48, 34, 62, 55];
function FortalezasBloq({ dims, f, pide, esYo }) {
  const ev = f.ev || 0;
  const pct = Math.max(0, Math.min(100, Math.round((100 * ev) / pide)));
  const llego = ev >= pide;
  return (
    <section className="sec pf-sec negra">
      <div className="sec-t"><h2>Sus fortalezas</h2><span className="pf-bloq"><Ico n="candado" t={14} />Bloqueada</span></div>
      <div className="pf-fz">
        <div className="pf-fz-prev">
          <Radar dims={dims} val={EJEMPLO} oculto />
          <span className="pf-fz-cand" aria-hidden="true"><Ico n="candado" t={24} /></span>
        </div>
        <div className="pf-fz-tx">
          <p className="pf-fz-q"><b>Se desbloquea con la tarjeta Competitiva</b>
            {esYo ? 'En qué sos más fuerte y qué te toca trabajar' : 'En qué es más fuerte y qué le toca trabajar'}: las cinco
            cosas que mide el Score, contra el promedio de la Liga.</p>
          <ul className="tj-falta pf-fz-meta">
            <li className={llego ? 'ok' : ''}><span>{Math.min(ev, pide)}/{pide} eventos</span><i><u style={{ width: pct + '%' }} /></i></li>
          </ul>
          <p className="pf-bajada pf-fz-falta">{llego
            ? (esYo ? 'Ya tenés los ' : 'Ya tiene los ') + pide + ' eventos. ' + (f.nv ? (esYo ? 'Sólo te falta verificarte (arriba dice cómo).' : 'Sólo le falta verificarse.') : 'La tarjeta sale en la próxima vuelta del bot.')
            : RQ.falta('EVENTOS', ev, pide, esYo)}</p>
          <ul className="pf-dims pf-dims-bloq">
            {dims.map((d) => (
              <li key={d[1]}><span><b>{d[0]} {d[1]}</b><small>{d[2]} · {d[3]} %</small></span><i /><em>?</em></li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Fortalezas({ liga, f, p, dmp, esYo }) {
  const dims = ((liga.d.guia || {}).score || []);
  const val = (p && p.dm) || null;
  if (!dims.length || !f.ev) return null;
  const q = (liga.d.requisitos || []).find((r) => r.id === 'competitivo') || {};
  const pide = parseInt(((q.pide || [])[0] || '10'), 10) || 10;
  // 🔑 SÓLO CON LA COMPETITIVA DESBLOQUEADA. Dlx, 07/10/2026: *«para q te muestre sus fortalezas necesita tener
  // desbloqueada la tarjeta competitiva»*. Las cinco son las del Score, que es lo que esa carta mide; antes, alguien
  // con 1 evento ya tenía radar. Sin la carta, la vista previa. La misma regla en `pintaJuego()` de app.js
  if (!(f.c || []).includes('competitivo')) return <FortalezasBloq dims={dims} f={f} pide={pide} esYo={esYo} />;
  if (!val) return null;
  const mx = val.indexOf(Math.max(...val));
  const mn = val.indexOf(Math.min(...val));
  return (
    <section className="sec pf-sec negra">
      <div className="sec-t"><h2>Sus fortalezas</h2></div>
      <div className="pf-fz">
        <Radar dims={dims} val={val} prom={dmp} />
        <div className="pf-fz-tx">
          <div className="pf-fz-dos">
            <p><small>SU FUERTE</small><b>{dims[mx][0]} {dims[mx][1]}</b></p>
            {mn !== mx ? <p><small>A TRABAJAR</small><b>{dims[mn][0]} {dims[mn][1]}</b></p> : null}
          </div>
          <ul className="pf-dims">
            {dims.map((d, i) => (
              <li key={d[1]}>
                <span><b>{d[0]} {d[1]}</b><small>{d[2]} · {d[3]} %</small></span>
                <i><u style={{ width: Math.max(2, Math.min(100, val[i] || 0)) + '%' }} />{dmp ? <s style={{ left: Math.min(100, dmp[i] || 0) + '%' }} title={'La Liga: ' + dmp[i]} /> : null}</i>
                <em>{val[i] || 0}</em>
              </li>
            ))}
          </ul>
          {dmp ? <p className="pf-ley"><i className="yo" /> {limpio(f.n)} <i className="liga" /> el promedio de la Liga</p> : null}
          {(f.ev || 0) < pide ? <p className="pf-bajada">Provisorio: con pocos eventos cambia mucho. Cuenta para el rango desde los {pide} eventos (lleva {f.ev || 0}).</p> : null}
        </div>
      </div>
    </section>
  );
}

function EnCadaRanking({ liga, f, p }) {
  const rk = (p && p.rk) || {};
  const filas = [];
  const total = liga.oficiales().length;
  filas.push(['Temporada', f.pos ? '#' + f.pos + ' de ' + total : 'Fuera de concurso', '#/ranking/temporada']);
  if (rk.du) filas.push(['Duelos', '#' + rk.du[0] + ' de ' + rk.du[1], '#/ranking/duelos']);
  if (rk.pod) filas.push(['Podios', '#' + rk.pod[0] + ' de ' + rk.pod[1], '#/ranking/podios']);
  if (rk.pa && f.cc) filas.push([<><Bandera cc={f.cc} cls="pf-flag" />{nombrePais(f.cc)}</>, '#' + rk.pa[0] + ' de ' + rk.pa[1], '#/pais/' + f.cc]);
  const crew = liga.crewDe(f);
  if (rk.cr && rk.cr[0] && rk.cr[1]) filas.push([limpio(rk.cr[0]), '#' + rk.cr[1] + ' de ' + rk.cr[2], crew ? '#/crew/' + encodeURIComponent(crew.clave || crew.crew) : '#/ranking/crews']);
  return (
    <section className="sec pf-sec">
      <div className="sec-t"><h2>En cada ranking</h2></div>
      <ul className="pf-rk">
        {filas.map((x, i) => <li key={i}><a href={x[2]}><span>{x[0]}</span><b>{x[1]}</b></a></li>)}
      </ul>
    </section>
  );
}

function LoQueFalta({ f, p, esYo }) {
  const pa = usePaseDe(f.k);
  const nivel = (pa && pa.nivel) || 0;
  const req = (p && p.req) || {};
  // 🔑 LO DESBLOQUEADO SE VA (Dlx, 07/10/2026: *«que cuando una tarjeta sea desbloqueada eso desaparezca del perfil»*):
  // quedan sólo las que le faltan; sin ninguna, no hay sección
  const listaDe = (c) => {
    const q = req[c] || [];
    const cumple = c === 'temporada' ? nivel >= 1 : q.every((x) => x[0] >= x[1]);
    return (f.c || []).includes(c) || (cumple && !f.nv);
  };
  const cs = ['temporada', 'competitivo', 'pais'].filter((c) => (req[c] || (f.c || []).includes(c)) && !listaDe(c));
  if (!cs.length) return null;
  return (
    <section className="sec pf-sec">
      <div className="sec-t"><h2>{esYo ? 'Lo que te falta' : 'Lo que le falta'}</h2></div>
      <ul className="pf-falta">
        {cs.map((c) => {
          const q = req[c] || [];
          // 🔑 LAS REGLAS DEL 05/10/2026 (2.41): la Temporada sale con el nivel 1 del Pase, no con su requisito de antes,
          // y sin verificarse no hay ninguna (lo de `Tuya` en tarjetas.jsx). Decía «salvo la de Temporada, que no lo pide»
          const cumple = c === 'temporada' ? nivel >= 1 : q.every((x) => x[0] >= x[1]);
          const listo = false;
          const espera = cumple;
          return (
            <li key={c}>
              <h3>{NOMBRE[c]}<span>{espera ? 'Falta verificarse' : 'Bloqueada'}</span></h3>
              {/* el porqué entero va una sola vez, arriba (`pf-nv`): acá repetirlo en cada tarjeta era la misma frase tres veces */}
              {espera ? <p>{esYo ? 'Ya cumplís lo que pide: sólo te falta verificarte (arriba dice cómo).' : 'Ya cumple lo que pide: sólo le falta verificarse.'}</p> : null}
              {!listo && !espera && c === 'temporada' ? <p>{RQ.pase(esYo)}</p> : null}
              {!listo && !espera && c !== 'temporada' ? <FaltaLista q={q} tu={esYo} /> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Eventos: todos los que jugó en la temporada, con su puesto, sus puntos y la llave ──
// 🔎 AL FINAL, CON BUSCADOR Y FILTRO POR RESULTADO (Dlx, 07/10/2026: «poner eventos en lo último y con la opción de
// buscar evento y filtrar, ya sea que fue campeón, subcampeón, etc.»). Los filtros son los puestos que tiene, con cuántos
const PUESTO_ORDEN = ['Campeón', 'Subcampeón', 'Tercero', 'Cuarto', 'Semifinal', 'Cuartos', 'Octavos', 'R32', 'Dieciseisavos'];
const ordenPuesto = (x) => (PUESTO_ORDEN.indexOf(x) < 0 ? 99 : PUESTO_ORDEN.indexOf(x));
function Eventos({ liga, p, e }) {
  const ev = (p && p.ev) || [];
  const [q, setQ] = useState('');
  const [pu, setPu] = useState('');
  if (!ev.length) return <section className="sec pf-sec"><p className="rk-vacio">Todavía no jugó ningún evento en la {liga.temp}.</p></section>;
  const cuenta = {};
  ev.forEach(([, x]) => { cuenta[x] = (cuenta[x] || 0) + 1; });
  const puestos = Object.keys(cuenta).sort((a, b) => ordenPuesto(a) - ordenPuesto(b));
  const nq = norm(q);
  const vis = ev.filter(([n, x]) => (!pu || x === pu) && (!nq || norm(((e || {})[n] || [])[0] || '').includes(nq)));
  return (
    <section className="sec pf-sec">
      <div className="sec-t"><h2>Sus eventos</h2><span className="tj-n">{vis.length === ev.length ? ev.length + ' en la ' + liga.temp : vis.length + ' de ' + ev.length}</span></div>
      {ev.length > 3 ? (
        <div className="rk-fil pf-ev-fil">
          <label className="rk-buscar"><Ico n="buscar" t={18} />
            <input type="search" value={q} onChange={(ev2) => setQ(ev2.target.value)} placeholder="Buscar evento" aria-label="Buscar evento" enterKeyHint="search" />
          </label>
          {puestos.length > 1 ? (
            <div className="rk-chips" role="group" aria-label="Filtrar por resultado">
              <button type="button" className={!pu ? 'on' : ''} aria-pressed={!pu} onClick={() => setPu('')}>Todos · {ev.length}</button>
              {puestos.map((x) => (
                <button type="button" key={x} className={pu === x ? 'on' : ''} aria-pressed={pu === x} onClick={() => setPu(pu === x ? '' : x)}>
                  {MEDALLA[x] ? MEDALLA[x] + ' ' : ''}{x} · {cuenta[x]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {!vis.length ? <p className="rk-vacio">Ningún evento con ese filtro.</p> : null}
      <ol className="pf-ev">
        {vis.map(([n, puesto, pts]) => {
          const x = (e || {})[n] || [];
          return (
            <li key={n} style={{ '--c': (liga.svs[x[1]] || {}).color || '#29B298' }}>
              <span className="pf-ev-f">{x[2] ? fecha(x[2]) : x[4] || ''}</span>
              <div className="pf-ev-tx">
                <b>{limpio(x[0] || 'Evento ' + n)}</b>
                <small>{x[1] ? <img alt="" src={liga.logo(x[1])} /> : null}{x[1] ? siglaDe(x[1]) : ''}{x[3] ? ' · ' + x[3] + ' raperos' : ''}</small>
              </div>
              <span className="pf-ev-p">{MEDALLA[puesto] ? MEDALLA[puesto] + ' ' : ''}{puesto}</span>
              <b className="pf-ev-pts">{num(pts)}</b>
              <button type="button" className="pf-ev-ll" onClick={() => accion.llave(String(n))}>Ver llave</button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ── Duelos: el cara a cara con cada rival; al tocar uno, sus duelos con él (Dlx: «3. A») ──
function Duelos({ liga, p, e }) {
  const du = (p && p.du) || [];
  const rivales = useMemo(() => {
    const por = new Map();
    du.forEach((d) => {
      const r = liga.fila(d[1]);
      const id = r ? r.k : 'n:' + limpio(d[1]).toLowerCase();
      if (!por.has(id)) por.set(id, { id, k: r ? r.k : '', n: r ? r.n : d[1], g: 0, p: 0, ds: [] });
      const x = por.get(id);
      x[d[2] ? 'g' : 'p'] += 1;
      x.ds.push(d);
    });
    return [...por.values()].sort((a, b) => (b.g + b.p) - (a.g + a.p) || (b.g - b.p) - (a.g - a.p));
  }, [du, liga]);
  const [abierto, setAbierto] = useState(null);
  if (!du.length) return <section className="sec pf-sec"><p className="rk-vacio">Todavía no tiene duelos en la {liga.temp}: cuentan los 1vs1 de las llaves.</p></section>;
  const g = du.filter((d) => d[2]).length;
  const rd = (p && p.rd) || null;
  return (
    <section className="sec pf-sec negra">
      <div className="sec-t"><h2>Cara a cara</h2><span className="tj-n">{g} ganados de {du.length}{rd ? ' · racha ' + rd[0] + ' (máx ' + rd[1] + ')' : ''}</span></div>
      <p className="pf-bajada">Contra cada rival: cuántas veces se cruzaron y cómo le fue. Tocá uno para ver sus duelos.</p>
      <ul className="pf-cc">
        {rivales.map((r) => {
          const t = r.g + r.p;
          const on = abierto === r.id;
          return (
            <li key={r.id} className={on ? 'on' : ''}>
              <button type="button" className="pf-cc-b" aria-expanded={on} onClick={() => setAbierto(on ? null : r.id)}>
                <Cara liga={liga} k={r.k} nombre={r.n} cls="cara pf-cc-cara" lazy />
                <b>{limpio(r.n)}</b>
                <span className={'pf-cc-res' + (r.g > r.p ? ' gana' : r.p > r.g ? ' pierde' : '')}>{r.g}–{r.p}</span>
                <small>{t === 1 ? 'una vez' : t + ' veces'}</small>
              </button>
              {on ? (
                <ol className="pf-cc-ds">
                  {r.ds.map((d, i) => {
                    const x = (e || {})[d[0]] || [];
                    return (
                      <li key={i}>
                        <span className={d[2] ? 'pf-gano' : 'pf-perdio'}>{d[2] ? 'GANÓ' : 'PERDIÓ'}</span>
                        <button type="button" className="pf-lnk" onClick={() => accion.llave(String(d[0]))}>{limpio(x[0] || 'Evento ' + d[0])}</button>
                        <small>{x[2] ? fecha(x[2]) : ''}</small>
                      </li>
                    );
                  })}
                  {r.k ? <li className="pf-cc-ver"><a className="pf-lnk" href={'#/r/' + encodeURIComponent(r.k)}>Ver el perfil de {limpio(r.n)}</a></li> : null}
                </ol>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Insignias y su cacería ──
function Insignias({ liga, p }) {
  const cat = liga.d.insignias || [];
  const tiene = new Map(((p && p.ins) || []).map((x) => [x[0], x[1]]));
  const mw = (p && p.mw) || {};
  return (
    <>
      {cat.length ? (
        <section className="sec pf-sec">
          <div className="sec-t"><h2>Insignias</h2><span className="tj-n">{tiene.size} de {cat.length}</span></div>
          <ul className="pf-ins">
            {cat.map(([id, ic, n, desc]) => {
              const t = tiene.get(id);
              return (
                <li key={id} className={t ? 'si' : ''}>
                  <span className="pf-ins-ic" aria-hidden="true">{ic}</span>
                  <b>{n}</b>
                  <small>{t ? 'desde el ' + fecha(t).toLowerCase() : desc}</small>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      <section className="sec pf-sec">
        <div className="sec-t"><h2>Su cacería</h2><a href="#/ranking/mw">Most Wanted <Ico n="flecha" t={16} /></a></div>
        <dl className="pf-tiles pf-caza">
          <div><dd>{(mw.caz || []).length}</dd><dt>CAZÓ</dt></div>
          <div><dd>{(mw.czd || []).length}</dd><dt>LO CAZARON</dt></div>
          <div><dd>{mw.sob || 0}</dd><dt>SOBREVIVIÓ</dt></div>
          <div><dd>{mw.esc || 0}</dd><dt>SE ESCONDIÓ</dt></div>
        </dl>
        {(mw.czd || []).length || (mw.caz || []).length ? (
          <ul className="pf-czd">
            {(mw.caz || []).map((x, i) => <li key={'a' + i}><b>Cazó a {limpio((x[3] || [])[0] || '')}</b><small>{x[1]} · {limpio(x[2] || '')}</small></li>)}
            {(mw.czd || []).map((x, i) => <li key={'b' + i}><b>Lo cazó {limpio((x[3] || [])[0] || '')}</b><small>{x[1]} · {limpio(x[2] || '')}</small></li>)}
          </ul>
        ) : null}
      </section>
    </>
  );
}

// tu fila cuando entraste con Discord y no estás en la tabla (corta en 200): lo de tu cuenta, como `filaCuenta()` de app.js
function filaDeCuenta(dc, k) {
  if (!dc || dc.clave !== k) return null;
  return { k, n: dc.rapero || dc.n, cc: dc.cc, sv: dc.sv, pos: null, ovr: null, pts: 0, ev: dc.ev || 0, wr: '', c: dc.cs || [], fuera: true };
}

export function Perfil({ liga, dc, k: k0, tab }) {
  let k = k0;
  try { k = decodeURIComponent(k0); } catch (e) { /* tal cual */ }
  // un link viejo con otra forma de la clave (mayúsculas): el de la tabla, como `porK()` de app.js
  if (!liga.T[k]) { const kk = Object.keys(liga.T).find((x) => x.toLowerCase() === String(k).toLowerCase()); if (kk) k = kk; }
  const P = usePerfiles();
  const f = liga.T[k] || filaDeCuenta(dc, k);
  const esYo = !!((dc && dc.clave === k) || (liga.yo && liga.yo.k === k));
  const p = (P && P.p && P.p[k]) || null;
  const t = SECCIONES.includes(tab) ? tab : '';
  useEffect(() => { window.scrollTo(0, 0); }, [k]);
  useEffect(() => {
    if (!f) return undefined;
    const poner = () => { document.title = limpio(f.n) + ' · Liga Global de Freestyle'; };
    poner();
    const r = setTimeout(poner, 0);
    return () => clearTimeout(r);
  }, [f]);
  // un link de los de antes (`#/r/x/duelos`): baja hasta esa sección cuando ya está dibujada.
  // ⚠️ ANTES del `return` de «no está»: un hook después de un return condicional cambia la cuenta de hooks si la persona
  // aparece o desaparece de la tabla con la página abierta, y React tira la página entera
  const abajo = useRef(null);
  useEffect(() => {
    if (!t || !P) return undefined;
    const r = setTimeout(() => {
      const el = abajo.current && abajo.current.parentNode && abajo.current.parentNode.querySelector('#pf-' + t);
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 64);
    }, 60);
    return () => clearTimeout(r);
  }, [t, k, !!P]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!f) {
    return (
      <section className="sec pf-sec">
        <div className="sec-t"><h2>Todavía no jugó esta temporada</h2></div>
        <p className="pronto-p">O está más abajo de los 200 que muestra la tabla. Buscalo en el <a className="te-link" href="#/ranking">Ranking</a>.</p>
      </section>
    );
  }
  // 🎨 BLANCO Y NEGRO, COMO EL INICIO (Dlx, 07/10/2026: *«no todos los lugares son blancos sino intercala con el
  // negro»*): la cabeza, Sus fortalezas, Cara a cara y el Precio van en `.sec.negra` (estilo.css), con dos blancas
  // entre cada una. El Precio en negro como el Most Wanted del Inicio
  return (
    <>
      <Cabeza liga={liga} f={f} k={k} p={p} dc={dc} esYo={esYo} resumen />
      <div ref={abajo} />
      {f.fuera ? <section className="sec pf-sec"><p className="pronto-p">Tu historial todavía no está en la página: aparece cuando entrás entre los 200 de la tabla.</p></section> : null}
      {!P ? <div className="cargando">Cargando…</div> : (
        <>
          <Numeros f={f} p={p} />
          <Datos liga={liga} p={p} e={P.e} />
          <Fortalezas liga={liga} f={f} p={p} dmp={P.dmp} esYo={esYo} />
          <div className="pf-dos">
            <EnCadaRanking liga={liga} f={f} p={p} />
            <LoQueFalta f={f} p={p} esYo={esYo} />
          </div>
          <div id="pf-duelos"><Duelos liga={liga} p={p} e={P.e} /></div>
          <div id="pf-insignias"><Insignias liga={liga} p={p} /></div>
          <Precio liga={liga} f={f} esYo={esYo} dc={dc} />
          {/* sus eventos, al final y con buscador (Dlx, 07/10/2026: «poner eventos en lo último») */}
          <div id="pf-eventos"><Eventos liga={liga} p={p} e={P.e} /></div>
        </>
      )}
    </>
  );
}
