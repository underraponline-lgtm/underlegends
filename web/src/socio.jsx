// 📊 EL PANEL DE LOS SOCIOS (Dlx, 19/10/2026: «dar un acceso especial tipo dashboard para los socios, o sea los owners de
// los sv… para ver cómo sus servidores están mejorando, sus estadísticas»; «tier 1 y tier 2»; el dueño «automático y lo
// corregís vos»; y que traiga su puntaje y tendencia, eventos y gente, sus raperos y crews, las visitas a su página y
// «sugerencias para mejorar, ver cuándo hay actividad, qué días hacer eventos y qué días no»).
//
// Lo arma el ciclo (`panel()` de bot/tiers.py, junto con el puntaje) y lo sirve el objeto sólo al dueño de cada servidor
// (`panelSocio()` de bot/avisos.js); Dlx los ve todos. ⚠️ Pregunta en silencio (sin ir a Discord): a Discord se va
// recién si la persona aprieta «Entrar con Discord».
import { useEffect, useState } from 'react';
import { pedirAjustes, pedirPanel } from './panelsocio.js';
import { limpio, num, siglaDe } from './liga.js';
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
      {/* 📈 sólo contra 4 semanas de ESTA temporada: contra las de antes del arranque, todos «subían» */}
      {x.compara === false ? <p className="so-tend"><span>La comparación con las 4 semanas anteriores llega el {fechaCorta(x.compara_desde)}, cuando la temporada tenga 8 semanas.</span></p>
        : <p className={'so-tend ' + (dif > 0 ? 'sube' : dif < 0 ? 'baja' : '')}>{dif > 0 ? '▲ ' + dif : dif < 0 ? '▼ ' + -dif : '='} <span>contra las 4 semanas de antes ({x.antes || 0})</span></p>}
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

// ⚙️ LOS AJUSTES DEL BOT (Dlx, 19/10/2026: «que los socios puedan usar las opciones de /settings en su propia página…
// que ellos tengan su dashboard propio… para que ellos manejen esas cosas mejor»). Los mismos de `/settings` —es el
// mismo lugar guardado: lo último que se toque, acá o en Discord, es lo que vale— más «Eventos de Discord» y dónde va el
// aviso de cada evento. ⚠️ Lo que Dlx fijó en el Dashboard para ese servidor gana por abajo Y NO SE MUESTRA (Dlx, 19/10:
// «lo mío manda, pero que no le aparezca eso a ellos, sino que ellos lo pueden cambiar»). Los canales salen de su Discord
const AJ_ERR = { sin_guild: 'Todavía no tengo el Discord de este servidor a mano: prueba en una hora.',
  discord: 'Discord no contestó: prueba de nuevo en un minuto.', no: 'Este servidor no es tuyo.', espera: 'Muy seguido: espera un segundo.',
  kv: 'No se pudo guardar ahora: prueba en un rato.', valor: 'Ese valor no vale.' };
function Canal({ c, cs, cual, ocup, cambiar, vacio }) {
  return (
    <select value={c[cual] || ''} disabled={ocup} onChange={(e) => cambiar(cual, e.target.value)}>
      <option value="">{vacio}</option>
      {cs.map((k) => <option key={k.id} value={k.id}>{'#' + k.n + (k.cat ? ' · ' + k.cat : '')}</option>)}
    </select>
  );
}
function Ajustes({ sv }) {
  const [j, setJ] = useState(null);
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let vivo = true;
    setJ(null); setMsg('');
    pedirAjustes(sv).then((r) => { if (vivo) setJ(r || { error: 'red' }); });
    return () => { vivo = false; };
  }, [sv]);
  const cambiar = (cual, valor) => {
    setOcup(true); setMsg('');
    pedirAjustes(sv, { cual, valor }).then((r) => {
      if (r && r.ok) { setJ(r); setMsg('✅ Guardado: vale desde ahora.'); } else setMsg('⚠️ ' + (AJ_ERR[r && r.error] || 'No se pudo guardar.'));
      setOcup(false);
    });
  };
  if (!j) return <p className="pronto-p">Buscando los ajustes…</p>;
  if (!j.ok) return <p className="pronto-p">{AJ_ERR[j.error] || 'No pude traer los ajustes. Prueba de nuevo en un rato.'}</p>;
  const c = j.cfg || {}, cs = j.canales || [], niveles = j.niveles || [];
  const nombre = (id) => { const k = cs.find((x) => x.id === id); return k ? '#' + k.n : id ? 'un canal que ya no está' : ''; };
  const general = j.general ? nombre(j.general) : 'su chat general';
  const elegidos = c.canales || [];
  const toggleCanal = (id) => cambiar('canales', elegidos.includes(id) ? elegidos.filter((x) => x !== id) : elegidos.concat(id));
  const sel = { c, cs, ocup, cambiar };
  return (
    <div className="so-aj">
      <label><span>El bot en vivo</span>
        <Canal {...sel} cual="vivo" vacio="Apagado" />
        <small>Durante un evento de la Liga en tu servidor, cuenta en ese canal cómo va. Nunca menciona a nadie.</small></label>
      <label><span>Cuánto habla</span>
        <select value={c.vivo_nivel || 'normal'} disabled={ocup} onChange={(e) => cambiar('vivo_nivel', e.target.value)}>
          {niveles.map(([k, n, q]) => <option key={k} value={k}>{n} · {q}</option>)}
        </select>
        <small>{c.vivo ? 'Cuánto cuenta el bot en vivo en ' + nombre(c.vivo) + '.' : 'Vale cuando el bot en vivo tiene un canal.'}</small></label>
      <label><span>Apuestas</span>
        <select value={c.apuestas ? 'si' : ''} disabled={ocup} onChange={(e) => cambiar('apuestas', e.target.value === 'si')}>
          <option value="">Como siempre: sólo con el bot en «A full»</option>
          <option value="si">Prendidas, en cualquier nivel</option>
        </select>
        <small>Antes de cada batalla se apuesta con Puntos de Tienda desde el chat, y el pozo se reparte entre los que aciertan.</small></label>
      <label><span>Eventos de Discord</span>
        <select value={j.eventos_discord ? 'si' : ''} disabled={ocup} onChange={(e) => cambiar('eventos_discord', e.target.value === 'si')}>
          <option value="">Apagados</option>
          <option value="si">Cada anuncio, un evento de tu Discord</option>
        </select>
        <small>El bot necesita «Crear eventos» en tu servidor.</small></label>
      <label><span>El aviso de cada evento</span>
        <select value={c.aviso_evento || ''} disabled={ocup} onChange={(e) => cambiar('aviso_evento', e.target.value)}>
          <option value="">Donde habla el bot en vivo</option>
          <option value="chat">En {general}, siempre</option>
          <option value="no">Apagado</option>
        </select>
        <small>Cuando un servidor anuncia un evento, el bot lo cuenta ahí. Vale desde el próximo evento.</small></label>
      <label><span>Avisos de cambio de rango</span><Canal {...sel} cual="avisos" vacio="Ninguno" />
        <small>Dónde anunciar cuando alguien sube o baja de rango.</small></label>
      <label><span>El ascenso de tus ligas</span><Canal {...sel} cual="ascenso" vacio="Apagado" />
        <small>El bot mantiene ahí su ranking de ascenso al día.</small></label>
      <label><span>#N del ranking en el apodo</span>
        <select value={c.nick ? 'si' : 'no'} disabled={ocup} onChange={(e) => cambiar('nick', e.target.value === 'si')}>
          <option value="si">Activado: se le pone el número a todos</option>
          <option value="no">Apagado: no se le pone a nadie</option>
        </select>
        <small>Quien lo eligió con /numeral se queda con lo suyo.</small></label>
      <div className="so-aj-ancho">
        <span className="so-aj-t">Canales donde se puede usar /card</span>
        <small>{elegidos.length ? elegidos.map(nombre).join(', ') + '.' : 'En cualquiera.'} Hasta 10.</small>
        <details><summary>Elegir canales</summary>
          <div className="so-aj-lista">{cs.map((k) => (
            <label key={k.id}><input type="checkbox" checked={elegidos.includes(k.id)} disabled={ocup || (!elegidos.includes(k.id) && elegidos.length >= 10)}
              onChange={() => toggleCanal(k.id)} />#{k.n}{k.cat ? <i> · {k.cat}</i> : null}</label>
          ))}</div></details>
      </div>
      {msg ? <p className="so-aj-msg so-aj-ancho" role="status">{msg}</p> : null}
      <small className="so-aj-ancho">Es lo mismo que <code>/settings</code> en tu Discord: lo último que cambies, acá o allá, es lo que vale.</small>
    </div>
  );
}

function Servidor({ liga, x }) {
  const p = x.panel || {};
  const logo = liga && liga.logo ? liga.logo(x.sv) : '';
  // el botón «Ajustes» baja a la sección: adentro del shadow root, así que se busca desde ahí y no en `document`
  const bajar = (e) => { const r = e.currentTarget.getRootNode(); const el = r && r.getElementById ? r.getElementById('so-ajustes') : null; if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  return (
    <>
      <header className="so-cab">
        {logo ? <img alt="" src={logo} /> : null}
        <div><h1>{limpio(x.nombre)}</h1><p>{TIER[x.tier] || 'Tier ' + x.tier}{x.ultimo ? ' · último evento el ' + fechaCorta(x.ultimo) : ''}</p></div>
        <button type="button" className="btn borde2 chico" onClick={bajar}>Ajustes</button>
        <a className="btn borde2 chico" href={'#/sv/' + encodeURIComponent(siglaDe(x.sv))}>Su página</a>
      </header>
      <Sec id="so-puntaje" titulo="Su puntaje" bajada="De 0 a 100, con las últimas 4 semanas. Es lo que mira la Liga para los niveles de socio.">
        <Puntaje x={x} />
        <Numeros x={x} />
      </Sec>
      <Sec id="so-ajustes" titulo="Los ajustes del bot" bajada="Lo mismo que /settings en tu Discord, desde acá: el bot en vivo, las apuestas, los avisos y dónde se usa /card.">
        <Ajustes sv={x.sv} />
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
        <p>{j.ok ? 'Este panel es para los dueños de los servidores socios de la Liga (Tier 1 y 2). Si eres dueño de uno y no lo ves, escribile a @itsdlx.'
          : 'No pude traer el panel ahora. Prueba de nuevo en un rato.'}</p>
      </div>
    );
  }
  const x = svs.find((s) => s.sv === sel) || svs[0];
  return (
    <div className="so">
      {svs.length > 1 ? (
        <nav className="so-elegir" aria-label="Elige el servidor">{svs.map((s) => (
          <button key={s.sv} type="button" className={'so-chip' + (s.sv === x.sv ? ' on' : '')} aria-pressed={s.sv === x.sv} onClick={() => setSel(s.sv)}>
            {siglaDe(s.sv)}<small>{s.puntos}</small></button>
        ))}</nav>
      ) : null}
      <Servidor liga={liga} x={x} />
      {j.t ? <p className="so-nota">Lo midió la Liga el {W.fmtFecha ? W.fmtFecha(j.t, { day: 'numeric', month: 'numeric' }) : fechaCorta(String(j.t).slice(0, 10))}
        {W.fmtHora ? ' a las ' + W.fmtHora(new Date(j.t)) : ''}. Se actualiza cada media hora.</p> : null}
    </div>
  );
}
