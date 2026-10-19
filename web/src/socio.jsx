// 📊 EL PANEL DE LOS SOCIOS (Dlx, 19/10/2026: «dar un acceso especial tipo dashboard para los socios, o sea los owners de
// los sv… para ver cómo sus servidores están mejorando, sus estadísticas»; «tier 1 y tier 2»; el dueño «automático y lo
// corregís vos»; y que traiga su puntaje y tendencia, eventos y gente, sus raperos y crews, las visitas a su página y
// «sugerencias para mejorar, ver cuándo hay actividad, qué días hacer eventos y qué días no»).
//
// Lo arma el ciclo (`panel()` de bot/tiers.py, junto con el puntaje) y lo sirve el objeto sólo al dueño de cada servidor
// (`panelSocio()` de bot/avisos.js); Dlx los ve todos. ⚠️ Pregunta en silencio (sin ir a Discord): a Discord se va
// recién si la persona aprieta «Entrar con Discord».
import { useEffect, useState } from 'react';
import { pedirPanel } from './panelsocio.js';
import { limpio, num } from './liga.js';
import { Sec } from './piezas.jsx';
import { useNumero } from './anima.js';
import CSS_PAGINA from './css/socio.css?inline';
import { usarCss } from './css.js';

const W = window;
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const FRANJAS = ['Madrugada', 'Mañana', 'Mediodía', 'Tarde', 'Noche'];
const PARTES = [['actividad', 'Actividad', 35, 'eventos por semana (2 es lo máximo)'], ['alcance', 'Alcance', 25, 'raperos por evento y gente nueva'],
  ['calidad', 'Calidad', 25, 'llaves que el bot lee solo, anuncios con su staff, pocos cancelados'],
  ['comunidad', 'Comunidad', 15, 'los nuevos que vuelven, promos y ligas']];
const TIER = { 1: 'Tier 1 · suma al ranking', 2: 'Tier 2 · el calendario y la campana' };

const fechaCorta = (iso) => { const p = String(iso || '').split('-'); return p.length === 3 ? Number(p[2]) + '/' + Number(p[1]) : ''; };
const coma = (x) => String(Math.round((Number(x) || 0) * 10) / 10).replace('.', ',');

function Puntaje({ x }) {
  const pts = useNumero(x.puntos || 0);
  const dif = (x.puntos || 0) - (x.antes || 0);
  return (
    <div className="so-pts">
      <div className="so-pts-n"><b>{pts}</b><small>de 100</small></div>
      <p className={'so-tend ' + (dif > 0 ? 'sube' : dif < 0 ? 'baja' : '')}>{dif > 0 ? '▲ ' + dif : dif < 0 ? '▼ ' + -dif : '='} <span>contra las 4 semanas de antes ({x.antes || 0})</span></p>
      <div className="so-partes">{PARTES.map(([k, t, tope, que]) => {
        const v = (x.partes || {})[k] || 0;
        return (
          <div key={k} className="so-parte">
            <span><b>{t}</b><small>{v} de {tope}</small></span>
            <i><u style={{ width: Math.round((100 * v) / tope) + '%' }} /></i>
            <small className="so-que">{que}</small>
          </div>
        );
      })}</div>
    </div>
  );
}

function Numeros({ x }) {
  const m = x.m || {};
  const vis = (x.visitas || []).reduce((s, v) => s + v[1], 0);
  const tiles = [
    ['Eventos', num(m.eventos || 0), 'en 4 semanas'],
    ['Por evento', coma(m.por_evento || 0), 'raperos'],
    ['Nuevos', num(m.nuevos || 0), m.nuevos ? 'volvió el ' + Math.round((100 * (m.volvieron || 0)) / m.nuevos) + ' %' : 'en 4 semanas'],
    m.miembros ? ['Miembros', num(m.miembros), 'en su Discord'] : null,
    ['Visitas', num(vis), 'a su página, 4 semanas'],
  ].filter(Boolean);
  return <div className="so-tiles">{tiles.map(([t, v, s]) => <div key={t} className="so-tile"><small>{t}</small><b>{v}</b><span>{s}</span></div>)}</div>;
}

function Semanas({ p }) {
  const sem = p.semanas || [];
  const max = Math.max(1, ...sem.map((s) => s[2]));
  return (
    <div className="so-sem" role="img" aria-label="Raperos que jugaron cada semana">
      {sem.map(([d, ev, gente, nuevos]) => (
        <div key={d} className="so-sem-c">
          <b>{gente ? num(gente) : ''}</b>
          <i style={{ height: Math.max(2, Math.round((100 * gente) / max)) + '%' }}><u style={{ height: gente ? Math.round((100 * nuevos) / gente) + '%' : 0 }} /></i>
          <small>{fechaCorta(d)}</small>
          <span>{ev ? ev + ' ev' : '—'}</span>
        </div>
      ))}
    </div>
  );
}

function Cuando({ p }) {
  const dias = p.dias || [], liga = p.liga || [], fr = p.franjas || [];
  // ⚠️ la barra más larga llega al 62 % de su columna: así entran al lado el número y los eventos, y ninguna se corta en
  // un tope (con un tope del 70 % se cortaban todas igual y los días se veían parejos)
  const max = Math.max(1, ...dias.map((d) => d[1]));
  const maxL = Math.max(1, ...liga.map((d) => d[0]));
  const maxF = Math.max(1, ...fr.map((d) => d[1]));
  return (
    <div className="so-cuando">
      <div className="so-dias">
        <div className="so-dia so-dia-t"><span /><small>Tu gente por evento</small><small>La Liga · eventos por semana</small></div>
        {DIAS.map((t, i) => (
          <div key={t} className="so-dia">
            <span>{t}</span>
            <div className="so-bar">{dias[i] && dias[i][0] ? <><i style={{ width: Math.round((62 * dias[i][1]) / max) + '%' }} /><b>{coma(dias[i][1])}</b><small>{dias[i][0]} ev</small></> : <small>sin eventos</small>}</div>
            <div className="so-bar liga"><i style={{ width: Math.round((62 * (liga[i] ? liga[i][0] : 0)) / maxL) + '%' }} /><b>{coma(liga[i] ? liga[i][0] : 0)}</b></div>
          </div>
        ))}
      </div>
      {fr.some((f) => f[0]) ? (
        <div className="so-franjas">{FRANJAS.map((t, i) => (
          <div key={t} className="so-franja">
            <small>{t}</small>
            <i><u style={{ height: Math.round((100 * ((fr[i] || [])[1] || 0)) / maxF) + '%' }} /></i>
            <b>{fr[i] && fr[i][0] ? coma(fr[i][1]) : '—'}</b>
          </div>
        ))}</div>
      ) : null}
      <p className="so-nota">Hora del este. La hora de cada evento sale de cuándo se publicó su llave en Discord.</p>
    </div>
  );
}

function Visitas({ x }) {
  const v = x.visitas || [];
  if (!v.length) return <p className="so-nota">Todavía no hay visitas contadas: se cuentan desde el 19/10, una por persona y por día.</p>;
  const max = Math.max(1, ...v.map((d) => d[1]));
  return (
    <div className="so-vis" role="img" aria-label="Visitas a la página del servidor, día por día">
      {v.map(([d, n]) => <i key={d} title={fechaCorta(d) + ': ' + n} style={{ height: Math.max(4, Math.round((100 * n) / max)) + '%' }} />)}
    </div>
  );
}

function Servidor({ liga, x }) {
  const p = x.panel || {};
  const logo = liga && liga.logo ? liga.logo(x.sv) : '';
  return (
    <>
      <header className="so-cab">
        {logo ? <img alt="" src={logo} /> : null}
        <div><h1>{limpio(x.nombre)}</h1><p>{TIER[x.tier] || 'Tier ' + x.tier}{x.ultimo ? ' · último evento el ' + fechaCorta(x.ultimo) : ''}</p></div>
        <a className="btn borde2 chico" href={'#/sv/' + encodeURIComponent(x.sv)}>Su página</a>
      </header>
      <Sec id="so-puntaje" titulo="Su puntaje" bajada="De 0 a 100, con las últimas 4 semanas. Es lo que mira la Liga para los niveles de socio.">
        <Puntaje x={x} />
        <Numeros x={x} />
      </Sec>
      {(p.sugerencias || []).length ? (
        <Sec id="so-sug" titulo="Lo que conviene">
          <ul className="so-sug">{p.sugerencias.map((s) => <li key={s}>💡 {s}</li>)}</ul>
        </Sec>
      ) : null}
      {(p.semanas || []).length ? (
        <Sec id="so-semanas" titulo="Semana a semana" bajada="Raperos que jugaron cada semana; en magenta, los que jugaban por primera vez en tu servidor.">
          <Semanas p={p} />
        </Sec>
      ) : null}
      {(p.dias || []).length ? (
        <Sec id="so-cuando" titulo="Cuándo hay actividad" bajada="Cuánta gente juntan tus eventos cada día y cuántos eventos tiene el resto de la Liga ese día. Un día lleno de eventos compite por la misma gente.">
          <Cuando p={p} />
        </Sec>
      ) : null}
      {(p.raperos || []).length ? (
        <Sec id="so-raperos" titulo="Sus raperos" bajada={num(p.gente_total || 0) + ' jugaron en tu servidor esta temporada. Los que más puntos hicieron ahí:'}>
          <ol className="so-lista">{p.raperos.map(([n, k, ev, pts, oro]) => (
            <li key={k}><a href={'#/r/' + encodeURIComponent(k)}><b>{limpio(n)}</b></a><span>{num(pts)} pts · {ev} ev{oro ? ' · ' + oro + ' 🏆' : ''}</span></li>
          ))}</ol>
        </Sec>
      ) : null}
      {(p.crews || []).length ? (
        <Sec id="so-crews" titulo="Sus crews" bajada="Las crews con más gente que juega en tu servidor.">
          <ul className="so-lista">{p.crews.map(([id, n, cuantos, pts]) => (
            <li key={id}><a href={'#/crew/' + encodeURIComponent(id)}><b>{limpio(n)}</b></a><span>{cuantos} {cuantos === 1 ? 'rapero' : 'raperos'} · {num(pts)} pts acá</span></li>
          ))}</ul>
        </Sec>
      ) : null}
      <Sec id="so-visitas" titulo="Visitas a su página" bajada="Personas por día que abrieron la página de tu servidor, las últimas 4 semanas.">
        <Visitas x={x} />
      </Sec>
    </>
  );
}

export function PanelSocio({ liga, q }) {
  usarCss('socio', CSS_PAGINA);
  const [j, setJ] = useState(null);
  const [sel, setSel] = useState(() => (/(?:^|&)sv=([A-Z]{2,6})/.exec(q || '') || [])[1] || '');
  useEffect(() => {
    let vivo = true;
    pedirPanel(false).then((r) => { if (vivo) setJ(r); });
    return () => { vivo = false; };
  }, []);
  if (!j) return <div className="so"><p className="pronto-p">Buscando tu servidor…</p></div>;
  if (j.status === 401) {
    return (
      <div className="so so-vacio">
        <h1>El panel de tu servidor</h1>
        <p>Para los dueños de los servidores socios de la Liga (Tier 1 y 2): cómo viene tu servidor, cuándo hay actividad y qué conviene.</p>
        <button type="button" className="btn verde" onClick={() => pedirPanel(true).then((r) => { if (r) setJ(r); })}>Entrar con Discord</button>
      </div>
    );
  }
  const svs = (j && j.servidores) || [];
  if (!j.ok || !svs.length) {
    return (
      <div className="so so-vacio">
        <h1>El panel de tu servidor</h1>
        <p>{j.ok ? 'Este panel es para los dueños de los servidores socios de la Liga (Tier 1 y 2). Si sos dueño de uno y no lo ves, escribile a @itsdlx.'
          : 'No pude traer el panel ahora. Probá de nuevo en un rato.'}</p>
      </div>
    );
  }
  const x = svs.find((s) => s.sv === sel) || svs[0];
  return (
    <div className="so">
      {svs.length > 1 ? (
        <nav className="so-elegir" aria-label="Elegí el servidor">{svs.map((s) => (
          <button key={s.sv} type="button" className={'so-chip' + (s.sv === x.sv ? ' on' : '')} aria-pressed={s.sv === x.sv} onClick={() => setSel(s.sv)}>
            {s.sv}<small>{s.puntos}</small></button>
        ))}</nav>
      ) : null}
      <Servidor liga={liga} x={x} />
      {j.t ? <p className="so-nota">Lo midió la Liga el {W.fmtFecha ? W.fmtFecha(j.t, { day: 'numeric', month: 'numeric' }) : fechaCorta(String(j.t).slice(0, 10))}
        {W.fmtHora ? ' a las ' + W.fmtHora(new Date(j.t)) : ''}. Se actualiza cada media hora.</p> : null}
    </div>
  );
}
