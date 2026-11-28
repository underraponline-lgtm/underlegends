// 🎯 LA RETENCIÓN: ¿VUELVEN LOS QUE DEBUTAN? (28/11/2026, Dlx: «la retención es el objetivo principal»).
//
// Los mismos números en tres lugares, todos de `bot/retencion.py` (las definiciones viven ahí):
//   · RetencionDash: el Dashboard, sólo Dlx. Llega en la lista de primerizos (`d.primerizos.ret`), por el objeto.
//   · RetencionSocio: el panel de cada socio («Tu servidor»), lo suyo contra el promedio de los socios y UN consejo,
//     que es una sugerencia y no una orden. Llega en su panel (`p.retencion`, de bot/tiers.py).
//   · RetencionPublica: la página, para todos. Sólo lo que entusiasma y sin nombres; si el ciclo no lo mandó (pocos, o
//     el número es malo) no se dibuja nada (`liga.d.ret`).
//
// ⚠️ «0 DE 0 NO ES 0 %»: cada número es `[cuántos ya cumplieron los N días, cuántos de ellos volvieron]`. Con 0
// cumplidos se dice «todavía no se sabe», nunca «0 %».
// ⚠️ Clases con `rt-`: las del prototipo son globales adentro del shadow root (buscado en estilo.css, vivo.css y css/).
// ⚠️ Los colores de servidor vienen del payload (`liga.svs[sv].color`), nunca de este CSS.
import CSS from './css/retencion.css?inline';
import { usarCss } from './css.js';
import { num, siglaDe } from './liga.js';

const VENT = [7, 30, 90];
// con menos que esto no se da un porcentaje: el mismo 8 de `MIN_PCT` (bot/retencion.py) y `MIN_VUELVEN` (bot/tiers.py)
const MIN = 8;
const pct = (par) => (par && par[0] ? Math.round((100 * par[1]) / par[0]) : null);
const fecha = (iso) => { const p = String(iso || '').split('-'); return p.length === 3 ? Number(p[2]) + '/' + Number(p[1]) : ''; };
// el CSS se pone al dibujar (y una sola vez): este archivo lo importan el Dashboard, el panel y la página de Socios, y al
// importarse puede no existir todavía el shadow root
const css = () => usarCss('retencion', CSS);

function Celda({ par, total }) {
  if (!par || !par[0]) return <span className="rt-c rt-nada" title="Nadie cumplió esos días todavía">—</span>;
  const p = pct(par);
  return (
    <span className={'rt-c' + (par[0] < MIN ? ' rt-pocos' : '')} title={num(par[1]) + ' de ' + num(par[0])}>
      <b>{par[0] < MIN ? num(par[1]) + '/' + num(par[0]) : p + ' %'}</b>
      <small>{par[0] < MIN ? 'pocos' : num(par[1]) + ' de ' + num(par[0])}{total && par[0] < total && par[0] >= MIN ? ' · va' : ''}</small>
    </span>
  );
}

// ── el Dashboard ──────────────────────────────────────────────────────────────────────────────────────────────────────
export function RetencionDash({ r, liga }) {
  css();
  if (!r || !r.jugadores) return <p className="pronto-p">Todavía no jugó nadie esta temporada.</p>;
  const t = r.tot || {};
  const una = r.jugadores ? Math.round((100 * r.una) / r.jugadores) : 0;
  const u30 = pct(r.una30);
  const tend = r.tend || {};
  const ta = tend.ahora || [0, 0, 0], tb = tend.antes || [0, 0, 0];
  const svs = Object.entries(r.por_sv || {}).sort((a, b) => b[1].n - a[1].n);
  const color = (sv) => ((liga && liga.svs && liga.svs[sv]) || {}).color || 'var(--gris)';
  return (
    <div className="rt-dash">
      <div className="rt-4">
        <div className="rt-k rt-mal">
          <span>UNA SOLA VEZ</span><b>{una} %</b>
          <small>{num(r.una)} de los {num(r.jugadores)} que jugaron esta temporada{u30 != null ? '. Entre quienes debutaron hace 30 días o más: ' + u30 + ' % (' + num(r.una30[1]) + ' de ' + num(r.una30[0]) + ')' : ''}</small>
        </div>
        {VENT.map((w) => {
          const par = t[String(w)] || [0, 0];
          return (
            <div key={w} className="rt-k">
              <span>VUELVEN EN {w} DÍAS</span><b>{par[0] ? pct(par) + ' %' : '—'}</b>
              <small>{par[0] ? num(par[1]) + ' de ' + num(par[0]) + ' debutantes con sus ' + w + ' días cumplidos' : 'Nadie cumplió los ' + w + ' días todavía: no es 0 %, es que no se sabe'}</small>
            </div>
          );
        })}
      </div>
      <ul className="rt-lin">
        {r.multi && r.multi[0] ? <li><b>{pct(r.multi)} %</b> de los debutantes jugó en más de un servidor ({num(r.multi[1])} de {num(r.multi[0])})</li> : null}
        <li><b>{num(r.semana || 0)}</b> debutaron en los últimos 7 días</li>
        {ta[0] ? (
          <li className={tend.dir < 0 ? 'rt-baja' : tend.dir > 0 ? 'rt-sube' : ''}>
            A 7 días, {ta[2] === 1 ? 'la última semana cerrada' : 'las últimas ' + ta[2] + ' semanas cerradas'}: <b>{pct(ta)} %</b> ({num(ta[1])} de {num(ta[0])})
            {tb[0] ? <>{' · '}{tb[2] === 1 ? 'la de antes' : 'las ' + tb[2] + ' de antes'}: {pct(tb)} % ({num(tb[1])} de {num(tb[0])}) · <b>{tend.dir > 0 ? 'subió' : tend.dir < 0 ? 'bajó' : 'sin cambio claro'}</b></> : null}
          </li>
        ) : null}
      </ul>
      <h4 className="rt-h">Por semana de debut</h4>
      <div className="rt-t" role="table" aria-label="Por semana de debut">
        <div className="rt-f rt-cab" role="row"><span>Semana</span><span>Nue&shy;vos</span>{VENT.map((w) => <span key={w}>{w} d</span>)}</div>
        {(r.cohortes || []).map((c) => (
          <div key={c.s} className={'rt-f' + (c.a ? ' rt-arr' : '')} role="row">
            <span>{fecha(c.s)}{c.a ? <small>arranque</small> : null}</span><span>{num(c.n)}</span>
            {VENT.map((w) => (c.a ? <span key={w} className="rt-c rt-nada" title="La semana del arranque no cuenta: debutaron también los que ya jugaban">·</span>
              : <Celda key={w} par={c[String(w)]} total={c.n} />))}
          </div>
        ))}
      </div>
      {svs.length ? (
        <>
          <h4 className="rt-h">Por servidor donde debutaron</h4>
          <div className="rt-t rt-sv" role="table" aria-label="Por servidor donde debutaron">
            <div className="rt-f rt-cab" role="row"><span>Sv</span><span>Nue&shy;vos</span>{VENT.map((w) => <span key={w}>{w} d</span>)}<span>+1 sv</span></div>
            {svs.map(([sv, s]) => (
              <div key={sv} className="rt-f" role="row">
                <span><i className="rt-pto" style={{ background: color(sv) }} />{siglaDe(sv)}</span><span>{num(s.n)}</span>
                {VENT.map((w) => <Celda key={w} par={s[String(w)]} total={s.n} />)}
                <span className="rt-c"><b>{num(s.multi || 0)}</b><small>{s.n ? pct([s.n, s.multi || 0]) + ' %' : ''}</small></span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      <p className="db-tx rt-nota">Debutar es jugar tu primer evento de la temporada; volver, jugar otro evento otro día dentro de esos días. Quien debutó hace menos días todavía no cuenta (ni como que volvió ni como que no). «Va»: la semana todavía tiene gente sin sus días cumplidos. «Pocos»: menos de {MIN}. La semana del arranque no cuenta: ahí debutaron también los que ya jugaban antes. «+1 sv»: jugaron en más de un servidor.</p>
    </div>
  );
}

// ── el panel del socio ────────────────────────────────────────────────────────────────────────────────────────────────
export function RetencionSocio({ r }) {
  css();
  if (!r || !r.n) return null;
  // 🕳️ una ventana que nadie de la Liga cumplió todavía (hoy, los 90 días) no se dibuja: se dice en una línea
  const todas = VENT.map((w) => [w, r[String(w)] || [0, 0], (r.prom || {})[String(w)]]);
  const filas = todas.filter(([, par, prom]) => par[0] || prom != null);
  const faltan = todas.filter((f) => !filas.includes(f)).map(([w]) => w);
  return (
    <div className="rt-soc">
      <ul className="rt-vb">{filas.map(([w, par, prom]) => {
        const mio = par[0] >= MIN ? pct(par) : null;
        return (
          <li key={w}>
            <span className="rt-vb-t">A {w} días</span>
            {mio != null ? (
              <div className="rt-vb-b">
                <p><i><u className="rt-tuya" style={{ width: mio + '%' }} /></i><b>{mio} %</b><small>tu servidor · {num(par[1])} de {num(par[0])}</small></p>
                {prom != null ? <p><i><u style={{ width: prom + '%' }} /></i><b>{prom} %</b><small>el promedio de los socios</small></p> : null}
              </div>
            ) : (
              <p className="rt-vb-n">{par[0] ? 'Todavía ' + (par[0] === 1 ? 'una persona' : num(par[0]) + ' personas') + ' con sus ' + w + ' días cumplidos: con ' + MIN + ' sale tu porcentaje.'
                : 'Nadie cumplió los ' + w + ' días todavía.'}</p>
            )}
          </li>
        );
      })}</ul>
      {faltan.length ? <p className="rt-vb-n">A {faltan.join(' y ')} días: todavía nadie de la Liga lleva tanto tiempo desde su debut.</p> : null}
      {r.consejo ? <p className="rt-consejo"><b>Una idea</b>{r.consejo}</p> : null}
      {r.multi ? <p className="sp-nota">De tus {num(r.n)} nuevos, {num(r.multi)} {r.multi === 1 ? 'jugó' : 'jugaron'} también en otro servidor de la Liga: eso suma a todos.</p> : null}
    </div>
  );
}

// ── la página, para todos ─────────────────────────────────────────────────────────────────────────────────────────────
export function RetencionPublica({ liga }) {
  const r = (liga && liga.d && liga.d.ret) || null;
  if (!r || !(r.sem || r.diez)) return null;
  css();
  return (
    <div className="rt-pub">
      {r.sem ? <p><b>{num(r.sem)}</b><span>personas jugaron su primer evento de la temporada en los últimos 7 días</span></p> : null}
      {r.diez ? <p><b>{r.diez} de cada 10</b><span>nuevos volvieron a jugar en su primer mes{r.vol ? ': ya son ' + num(r.vol) : ''}</span></p> : null}
    </div>
  );
}
