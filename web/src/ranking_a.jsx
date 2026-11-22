// 🏁 EL RANKING CON LA ESTRUCTURA DE LA LLAVE 6.73 (Dlx, 18/11/2026: revisando las páginas por cómo están armadas, el
// Ranking primero; de la maqueta https://claude.ai/artifact/JZba2JEeCDLNC38UWtQRi9 eligió «A + piezas de B»). Arriba, en
// la escena: la franja de cuatro números con su porqué, el podio y una columna (tu lugar y una pieza por ranking). Abajo,
// el papel, con pestañas en la Temporada. Las piezas viven acá; el armado, en `Ranking()` de ranking.jsx.
// ⚠️ Las clases van con `rka-`: el shadow root es uno solo y las del Inicio son globales (ver CLAUDE.md, «el remake»).
// ⚠️ El papel NO trae color propio: toma el del tema (Clara, Noche o el del servidor elegido). El crema de la maqueta era
// el tema de Cypherhood de la llave que se miró (`.lk-tsv.t-ch`), no un color de la llave.
import { Cara } from './piezas.jsx';
import { limpio, num, siglaDe } from './liga.js';
import CSS_RKA from './css/rka.css?inline';
import { usarCss } from './css.js';

// los estilos de estas piezas, una vez, en cualquier página que las use (el Ranking, el ELO, cada país)
usarCss('rka', CSS_RKA);

const coma = (x, d = 1) => Number(x || 0).toFixed(d).replace('.', ',');
export const semDe = (sem, k) => { const g = sem && sem.g && sem.g[k]; return g && g.length ? g[g.length - 1] || 0 : 0; };
const rch = (f, i) => (f.rch || [0, 0])[i] || 0;

// ── la franja: cuatro números, cada uno con su línea de porqué (como la de la llave) ──────────────────────────────────
export function Franja({ items }) {
  if (!items || !items.length) return null;
  return (
    <dl className="rka-franja" style={{ '--n': items.length }}>
      {items.map((it) => (
        <div className="rka-kpi" key={it.l}>
          <dt>{it.l}</dt>
          <dd className="rka-v">{it.cara || null}<span>{it.v}</span>{it.em != null ? <em>{it.em}</em> : null}</dd>
          <dd className="rka-c">{it.c}</dd>
        </div>
      ))}
    </dl>
  );
}

// qué cuatro números lleva cada ranking. ⚠️ Nada que repita el podio («El #1» se sacó por eso: Impeccable, 18/11/2026)
// y nada que dependa de cuántas filas viajan (son 200, y la tabla de verdad es más larga)
export function franjaDe({ sub, liga, cfg, base, clas, sem, numero, pide, nombreDe, valTxt, sv }) {
  const out = [];
  const conNum = base.filter((f) => numero(cfg, f));
  if (sub === 'temporada') {
    if (clas && clas.length === cfg.final) {
      const c = clas[clas.length - 1];
      out.push({ l: 'El corte de la Clausura', v: (c.ovr || 0) + ' de OVR', em: '#' + numero(cfg, c), c: <>hoy es <b>{limpio(c.n)}</b>; los {cfg.final} primeros juegan la Clausura</> });
    }
    const xs = sem && sem.g ? base.filter((f) => semDe(sem, f.k) > 0).sort((a, b) => semDe(sem, b.k) - semDe(sem, a.k)) : null;
    if (!xs) out.push({ l: 'Lo más sumado esta semana', v: '—', c: 'llega en un momento' });
    else if (xs.length) {
      const a = xs[0];
      const antes = (sem.g[a.k] || []).slice(0, -1).some((v) => v > 0);
      out.push({ l: 'Lo más sumado esta semana', cara: <Cara liga={liga} k={a.k} nombre={a.n} cls="cara rka-kc" />, v: '+' + num(semDe(sem, a.k)),
        c: <><b>{limpio(a.n)}</b>{antes ? '' : ', en su primera semana'}{xs[1] ? <>; el segundo, {limpio(xs[1].n)} con +{num(semDe(sem, xs[1].k))}</> : null}</> });
    }
    if (conNum.length > 1) {
      const [a, b] = conNum;
      const d = (a.ovr || 0) - (b.ovr || 0);
      out.push({ l: 'Del #1 al #2', v: d ? d + ' de OVR' : num((a.pts || 0) - (b.pts || 0)) + ' pts', c: <><b>{limpio(a.n)}</b> sobre {limpio(b.n)}{d ? '' : ', con el mismo OVR'}</> });
    }
    const viva = base.slice().sort((a, b) => (rch(b, 0) - rch(a, 0)) || (rch(b, 1) - rch(a, 1)))[0];
    const larga = base.slice().sort((a, b) => rch(b, 1) - rch(a, 1))[0];
    if (viva && rch(viva, 0)) {
      out.push({ l: 'La racha viva más larga', cara: <Cara liga={liga} k={viva.k} nombre={viva.n} cls="cara rka-kc" />, v: limpio(viva.n), em: rch(viva, 0),
        c: <>eventos seguidos llegando arriba de la llave{larga && larga.k !== viva.k ? <>; la más larga de la temporada, {limpio(larga.n)} con {rch(larga, 1)}</> : null}</> });
    }
  } else if (sub === 'competitivo') {
    if (clas && clas.length === cfg.final) {
      const c = clas[clas.length - 1];
      out.push({ l: 'El corte de la Superliga', v: coma(c.sc), em: '#' + numero(cfg, c), c: <>hoy es <b>{limpio(c.n)}</b>; del 5.º al {cfg.final}.º, al duelo a muerte</> });
    }
    if (clas && clas.length > 4) {
      const c = clas[3];
      out.push({ l: 'Directo a la Superliga', v: coma(c.sc), em: '#4', c: <>los 4 primeros; hoy el #4 es <b>{limpio(c.n)}</b></> });
    }
    const R = liga.d.rangos || [];
    const cuenta = {};
    base.forEach((f) => { cuenta[f.rg] = (cuenta[f.rg] || 0) + 1; });
    const alto = R.find((r) => cuenta[r.r]);
    if (alto) {
      out.push({ l: 'El rango más alto', cara: <span className="rg rk-rg" style={{ background: liga.colorRg(alto.r) }}>{alto.r}</span>,
        v: cuenta[alto.r] + (cuenta[alto.r] === 1 ? ' rapero' : ' raperos'), c: 'desde ' + alto.min + ' de Score' + (R[0] && alto.r !== R[0].r ? '; nadie llegó a la ' + R[0].r : ', la letra más alta') });
    }
    if (base.length) out.push({ l: 'Con rango', v: num(base.length), em: base.length === 1 ? 'rapero' : 'raperos', c: 'el rango aparece con ' + (pide || 10) + ' eventos en servidores Tier 1 o 2' });
  } else if (sub === 'servidores') {
    // 🏟️ tanda 3 (19/11/2026): el servidor elegido contra la Liga, por el OVR de la carta de Servidor
    const del = base.filter((f) => f.sv === sv);
    const cuenta = {};
    base.forEach((f) => { cuenta[f.sv] = (cuenta[f.sv] || 0) + 1; });
    out.push({ l: 'En ' + siglaDe(sv), v: num(del.length), em: del.length === 1 ? 'carta' : 'cartas', c: 'de Servidor, de ' + num(base.length) + ' en todos los servidores' });
    if (del.length > 1) {
      const d = (del[0].osv || 0) - (del[1].osv || 0);
      out.push({ l: 'Del #1 al #2 de ' + siglaDe(sv), v: d ? d + ' de OVR' : 'empatados', c: <><b>{limpio(del[0].n)}</b> sobre {limpio(del[1].n)}</> });
    }
    const alto = base.reduce((m, f) => ((f.osv || 0) > ((m && m.osv) || 0) ? f : m), null);
    if (alto) out.push({ l: 'El OVR SV más alto de la Liga', cara: <Cara liga={liga} k={alto.k} nombre={alto.n} cls="cara rka-kc" />, v: limpio(alto.n), em: alto.osv, c: 'en ' + siglaDe(alto.sv) });
    // si el elegido ya es el que más tiene, el número es el que le sigue (si no, se repetía el primero de la franja)
    const orden = Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a]);
    const otro = orden[0] === sv ? orden[1] : orden[0];
    if (otro) out.push({ l: orden[0] === sv ? 'El que le sigue' : 'El servidor con más cartas', v: siglaDe(otro), em: cuenta[otro], c: 'raperos con su carta de Servidor ahí' });
  } else {
    // 🏁 las demás (tanda 2, 19/11/2026): la distancia del #1 al #2 y dos números de cada una, nunca el #1 (ya está en el podio)
    const nom = nombreDe || ((f) => limpio(f.n));
    const cara = (f) => (f.k ? <Cara liga={liga} k={f.k} nombre={f.n} cls="cara rka-kc" /> : null);
    const max = (xs, val) => xs.reduce((m, f) => (val(f) > (m ? val(m) : -1) ? f : m), null);
    if (cfg.valor && conNum.length > 1) {
      const [a, b] = conNum;
      const d = cfg.valor[0](a) - cfg.valor[0](b);
      out.push({ l: 'Del #1 al #2', v: d ? valTxt(d) : 'empatados', c: <><b>{nom(a)}</b> sobre {nom(b)}</> });
    }
    const du = (f) => (f.t != null ? [f.g || 0, f.t || 0] : (f.du || [0, 0]));
    const extra = {
      duelos: () => {
        const con10 = base.filter((f) => du(f)[1] >= 10);
        const pct = (f) => du(f)[0] / du(f)[1];
        const mejor = max(con10, pct);
        const mas = max(base, (f) => du(f)[1]);
        return [mejor ? { l: 'El mejor %, con 10 o más', cara: cara(mejor), v: nom(mejor), em: Math.round(100 * pct(mejor)) + '%', c: 'ganó ' + du(mejor)[0] + ' de ' + du(mejor)[1] } : null,
          mas ? { l: 'El que más duelos jugó', cara: cara(mas), v: nom(mas), em: du(mas)[1], c: 'uno contra uno, en las llaves de la temporada' } : null];
      },
      podios: () => {
        const oros = max(base, (f) => f.oro || 0);
        const platas = max(base, (f) => f.seg || 0);
        const campeones = base.filter((f) => f.oro).length;
        return [oros ? { l: 'Más oros', cara: cara(oros), v: nom(oros), em: oros.oro, c: 'eventos ganados en la temporada' } : null,
          platas ? { l: 'Más subcampeonatos', cara: cara(platas), v: nom(platas), em: platas.seg, c: 'segundos puestos en la temporada' } : null,
          { l: 'Campeones distintos', v: num(campeones), c: 'ganaron al menos un evento' }];
      },
      rachas: () => {
        const viva = max(base, (f) => (f.rch || [0])[0] || 0);
        const n = base.filter((f) => ((f.rch || [0])[0] || 0) >= 3).length;
        return [viva && (viva.rch || [0])[0] ? { l: 'La viva más larga', cara: cara(viva), v: nom(viva), em: viva.rch[0], c: 'la lleva ahora: si no llega arriba en su próximo evento, vuelve a 0' } : null,
          // el 13 cuenta PERSONAS (22/11/2026, la 2.ª revisión): con «eventos seguidos» debajo se leía como una racha de 13
          { l: 'Con racha viva de 3 o más', v: num(n), em: n === 1 ? 'rapero' : 'raperos', c: 'llevan 3 o más eventos seguidos llegando arriba de la llave' }];
      },
      eventos: () => {
        const lg = max(base, (f) => f.lg || 0);
        const ev = max(base, (f) => f.ev || 0);
        return [ev ? { l: 'Más eventos', cara: cara(ev), v: nom(ev), em: ev.ev, c: 'jugados en la temporada, en todos los servidores' } : null,
          lg && lg.lg ? { l: 'Más batallas de liga', cara: cara(lg), v: nom(lg), em: lg.lg, c: 'en las ligas de los servidores' } : null];
      },
      mw: () => {
        const caz = max(base, (f) => f.caz || 0);
        const sob = max(base, (f) => f.sob || 0);
        return [caz && caz.caz ? { l: 'Más cazas', cara: cara(caz), v: nom(caz), em: caz.caz, c: 'buscados cazados' } : null,
          sob && sob.sob ? { l: 'Más veces sobrevivió', cara: cara(sob), v: nom(sob), em: sob.sob, c: 'siendo buscado' } : null];
      },
      paises: () => {
        const mas = max(base, (f) => f.n || 0);
        const con5 = base.filter((f) => (f.n || 0) >= 5);
        const prom = max(con5, (f) => (f.pts || 0) / f.n);
        return [mas ? { l: 'Más raperos', v: nom(mas), em: mas.n, c: 'jugaron en la temporada' } : null,
          prom ? { l: 'Mejor promedio, con 5 o más', v: nom(prom), em: num(Math.round(prom.pts / prom.n)), c: 'puntos por rapero' } : null];
      },
      crews: () => {
        const grande = max(base, (f) => f.n || 0);
        const con = base.filter((f) => f.rk !== 0).length;
        return [grande ? { l: 'La más grande', v: nom(grande), em: grande.n, c: 'raperos en la temporada' } : null,
          { l: 'Con puesto', v: num(con), em: con === 1 ? 'crew' : 'crews', c: 'las que tienen tres raperos o más' }];
      },
    }[sub];
    if (extra) extra().filter(Boolean).forEach((x) => out.push(x));
  }
  return out;
}

// ── la pelea más cerrada: dos seguidos del top 30 con la menor distancia (de la B) ───────────────────────────────────
export function peleaDe({ cfg, base, numero }) {
  if (!cfg.valor) return null;
  const [val] = cfg.valor;
  const xs = base.filter((f) => numero(cfg, f)).slice(0, 30);
  let p = null;
  for (let i = 1; i < xs.length; i += 1) {
    const a = xs[i - 1];
    const b = xs[i];
    const d = val(a) - val(b);
    // a igual distancia (el OVR empata mucho), la de menos puntos
    const d2 = (a.pts || 0) - (b.pts || 0);
    if (!p || d < p.d || (d === p.d && d2 < p.d2)) p = { a, b, d, d2, va: val(a) };
  }
  return p;
}
export function Pelea({ liga, p, va, vb, pie, vis, href, nombre }) {
  if (!p) return null;
  // gente, país o crew: quien llama dice cómo se dibuja cada uno (sin `vis`, una cara y su perfil)
  const lado = (f, v) => (
    <a className="rka-lado" href={href ? href(f) : '#/r/' + encodeURIComponent(f.k)}>
      {vis ? vis(f, 'rka-pc') : <Cara liga={liga} k={f.k} nombre={f.n} cls="cara rka-pc" />}
      <b>{nombre ? nombre(f) : limpio(f.n)}</b><small>{v}</small>
    </a>
  );
  // «pegados» sólo si lo están (22/11/2026, la 2.ª revisión: dos crews a 329.377 pts llevaban «los dos, pegados»): si
  // los separa más del 15 % del de arriba, el título solo (otra etiqueta partía el título en dos renglones)
  const pegados = !(p.va > 0 && p.d > 0.15 * p.va);
  return (
    <div className="rka-caja">
      <h2 className="rka-h">La pelea más cerrada{pegados ? <small>los dos, pegados</small> : null}</h2>
      <div className="rka-pelea">{lado(p.a, va)}<span className="rka-vs" aria-hidden="true">VS</span>{lado(p.b, vb)}</div>
      <p className="rka-pie">{pie}</p>
    </div>
  );
}

// ── se movieron desde el lunes (la Temporada): los que más subieron y los que más bajaron, como «El camino» ──────────
export function Movidos({ liga, base, yoK }) {
  const con = base.filter((f) => f.mv && f.pos);
  const up = con.filter((f) => f.mv > 0).sort((a, b) => b.mv - a.mv || a.pos - b.pos).slice(0, 8);
  const dn = con.filter((f) => f.mv < 0).sort((a, b) => a.mv - b.mv || a.pos - b.pos).slice(0, 3);
  if (!up.length && !dn.length) return null;
  const fila = (f) => (
    <li key={f.k} className={'rka-paso ' + (f.mv > 0 ? 'up' : 'dn') + (f.k === yoK ? ' tuyo' : '')}>
      <i aria-hidden="true" />
      <a className="rka-x" href={'#/r/' + encodeURIComponent(f.k)}><Cara liga={liga} k={f.k} nombre={f.n} cls="cara rka-mc" /><b>{limpio(f.n)}</b><small>ahora #{f.pos}</small></a>
      <span className={'rka-mv ' + (f.mv > 0 ? 'up' : 'dn')}>{Math.abs(f.mv)}<span className="rk-sr">{f.mv > 0 ? ' puestos arriba' : ' puestos abajo'}</span></span>
    </li>
  );
  return (
    <div className="rka-caja">
      <h2 className="rka-h">Se movieron<small>desde el lunes</small></h2>
      <ol className="rka-camino">{up.map(fila)}{dn.map(fila)}</ol>
    </div>
  );
}

// ── Podios: «Más podios en total» (el medallero ordena por oros; ésta, por todos) ────────────────────────────────
export function MasPodios({ liga, base, yoK }) {
  const tot = (f) => (f.oro || 0) + (f.seg || 0) + (f.ter || 0);
  const xs = base.filter((f) => tot(f) > 0).sort((a, b) => tot(b) - tot(a) || (b.oro || 0) - (a.oro || 0)).slice(0, 8);
  if (!xs.length) return null;
  return (
    <div className="rka-caja">
      <h2 className="rka-h">Más podios en total<small>oros, platas y bronces</small></h2>
      <ol className="rka-camino">
        {xs.map((f) => (
          <li key={f.k} className={'rka-paso up' + (f.k === yoK ? ' tuyo' : '')}>
            <i aria-hidden="true" />
            <a className="rka-x" href={'#/r/' + encodeURIComponent(f.k)}><Cara liga={liga} k={f.k} nombre={f.n} cls="cara rka-mc" /><b>{limpio(f.n)}</b><small>{f.oro || 0} · {f.seg || 0} · {f.ter || 0}</small></a>
            <span className="rka-falta">{tot(f)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── el Competitivo: a un paso de la letra, y la escalera de letras (de la B) ─────────────────────────────────────────
function cercaDeLetra(liga, base) {
  const R = liga.d.rangos || [];
  const out = [];
  base.forEach((f) => {
    const i = R.findIndex((r) => r.r === f.rg);
    if (i > 0) out.push({ f, sig: R[i - 1], d: R[i - 1].min - (f.sc || 0) });
  });
  return out.filter((x) => x.d > 0).sort((a, b) => a.d - b.d);
}
export function AUnPaso({ liga, base, yoK }) {
  const xs = cercaDeLetra(liga, base).slice(0, 5);
  if (!xs.length) return null;
  const rg = (r) => <span className="rg rk-rg" style={{ background: liga.colorRg(r) }}>{r}</span>;
  return (
    <div className="rka-caja">
      <h2 className="rka-h">A un paso de la letra<small>lo que les falta</small></h2>
      <ol className="rka-camino">
        {xs.map((x) => (
          <li key={x.f.k} className={'rka-paso up' + (x.f.k === yoK ? ' tuyo' : '')}>
            <i aria-hidden="true" />
            <a className="rka-x" href={'#/r/' + encodeURIComponent(x.f.k)}><Cara liga={liga} k={x.f.k} nombre={x.f.n} cls="cara rka-mc" /><b>{limpio(x.f.n)}</b><small className="rka-rgs">{rg(x.f.rg)}→{rg(x.sig.r)}</small></a>
            <span className="rka-falta">{coma(x.d)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
export function EscaleraLetras({ liga, base, yoK, movil }) {
  const R = liga.d.rangos || [];
  if (!R.length || !base.length) return null;
  const primera = R.findIndex((r) => base.some((f) => f.rg === r.r));
  const tope = movil ? 3 : 7;
  return (
    <div className="rka-caja">
      {/* en UN solo texto: partido en pedazos, la vista en inglés tenía que traducir «a la» suelto */}
      <h2 className="rka-h">La escalera de letras<small>{'de la ' + R[0].r + ' a la ' + R[R.length - 1].r + ' · sale del Score'}</small></h2>
      <ol className="rka-escl">
        {R.map((r, i) => {
          const fs = base.filter((f) => f.rg === r.r);
          const tuya = fs.some((f) => f.k === yoK);
          return (
            <li key={r.r} className={'rka-esl' + (i === primera ? ' top' : '') + (tuya ? ' tuyo' : '')}>
              <span className="rka-val"><span className="rg rk-rg" style={{ background: liga.colorRg(r.r) }}>{r.r}</span><small>desde {r.min}</small></span>
              <span className="rka-gente">
                {fs.length ? fs.slice(0, tope).map((f) => (
                  <a key={f.k} className={f.k === yoK ? 'tuyo' : ''} href={'#/r/' + encodeURIComponent(f.k)}><Cara liga={liga} k={f.k} nombre={f.n} cls="cara rka-ec" /><b>{limpio(f.n)}</b></a>
                )) : <em>nadie todavía</em>}
                {fs.length > tope ? <em>+{fs.length - tope}</em> : null}
              </span>
              <span className="rka-cnt">{tuya ? 'la tuya · ' : ''}{fs.length || ''}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── el papel de la Temporada: «Esta semana» (la fila es la barra) y «Por servidor» ───────────────────────────────────
export function EstaSemana({ liga, base, sem, yoK }) {
  if (!sem || !sem.g) return <p className="rk-vacio">Cargando la semana…</p>;
  const xs = base.filter((f) => semDe(sem, f.k) > 0).sort((a, b) => semDe(sem, b.k) - semDe(sem, a.k));
  if (!xs.length) return <p className="rk-vacio">Esta semana todavía no sumó nadie: la semana arranca el lunes a las 11 AM ET.</p>;
  const mx = semDe(sem, xs[0].k) || 1;
  const ti = xs.findIndex((f) => f.k === yoK);
  const fila = (f, i) => (
    <li key={f.k} className={'rka-blf' + (f.k === yoK ? ' tuyo' : '')}>
      <span className="rka-fill" style={{ width: Math.max(2, Math.round(88 * semDe(sem, f.k) / mx)) + '%' }} aria-hidden="true" />
      <span className="rka-bp">{i + 1}</span>
      <Cara liga={liga} k={f.k} nombre={f.n} cls="cara rka-bc" />
      <a href={'#/r/' + encodeURIComponent(f.k)}>{limpio(f.n)}{f.k === yoK ? ' · tú' : ''}</a>
      <b>+{num(semDe(sem, f.k))}</b>
    </li>
  );
  return (
    <>
      <p className="rka-nota">Lo que sumó cada uno desde el lunes. Es la carrera de la semana: el OVR se mueve con el próximo cálculo.</p>
      <ol className="rka-bl">
        {xs.slice(0, 15).map(fila)}
        {ti >= 15 ? <><li className="rka-salto" aria-hidden="true">…</li>{fila(xs[ti], ti)}</> : null}
      </ol>
    </>
  );
}
export function PorServidor({ liga, base, numero, cfg, yoK }) {
  const por = {};
  base.filter((f) => numero(cfg, f) && f.sv).forEach((f) => { (por[f.sv] = por[f.sv] || []).push(f); });
  const svs = Object.keys(por).sort((a, b) => por[b].length - por[a].length);
  if (!svs.length) return null;
  return (
    <div className="rka-hojas">
      {svs.map((s) => (
        <div className="rka-hj" key={s}>
          <a className="rka-hj-c" href={'#/sv/' + encodeURIComponent(siglaDe(s))}><img alt="" src={liga.logo(s)} />{siglaDe(s)}<small>{por[s].length} en la tabla</small></a>
          <ol>
            {por[s].slice(0, 3).map((f) => (
              <li key={f.k} className={f.k === yoK ? 'tuyo' : ''}>
                <span>#{numero(cfg, f)}</span><Cara liga={liga} k={f.k} nombre={f.n} cls="cara rka-hc" />
                <a href={'#/r/' + encodeURIComponent(f.k)}>{limpio(f.n)}</a><b>{f.ovr || '—'}</b>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
