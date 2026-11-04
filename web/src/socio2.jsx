// 📊 EL PANEL DEL SOCIO, EL REMAKE (02/11/2026). Dlx: «terminar de REMAKEAR cada pagina exceptuando INICIO», y con las
// otras siete ya hechas, «Publica y haz todo… sube todo». Es lo mismo que socio.jsx —el puntaje, lo que conviene, los
// ajustes del bot, las semanas, cuándo hay actividad, su gente y las visitas—, ordenado como la página de cada servidor:
// la misma portada y el mismo índice (entidad2.jsx), porque es su servidor visto por su dueño.
// - EL PUNTAJE VA EN LA TIRA DE NÚMEROS, y abajo UNA SOLA BARRA de 0 a 100 partida en sus cuatro pesos (04/11/2026): lo
//   lleno es el puntaje, y se ve de una dónde falta. Eran cuatro cajas que no decían cómo sumaban.
// - LO QUE CONVIENE VA SEGUNDO: es lo que el dueño puede hacer hoy con lo que mira, con el número que lo respalda resaltado.
// - CUÁNDO HAY ACTIVIDAD ES UNA TABLA: cada día con su gente por evento y lo lleno que está el resto de la Liga. El mejor
//   día y el más lleno se marcan con la regla de las sugerencias (`MIN_MUESTRA` de bot/tiers.py): dicen lo mismo.
// - LOS AJUSTES, POR LO QUE EL DUEÑO DECIDE (04/11/2026): dónde publica el bot (una tabla, cada cosa con su canal), cómo
//   se porta (interruptores cuya frase dice lo que pasa) y dónde se usa /card. Cada uno se guarda solo y dice «Guardado»
//   en su fila, que es donde estás mirando; el aviso de abajo queda para los errores.
//
// ⚠️ NO CALCULA NADA NUEVO: lo arma el ciclo (`panel()` de bot/tiers.py) y lo sirve el objeto sólo al dueño de cada
// servidor (`panelSocio()` de bot/avisos.js); Dlx los ve todos. Pregunta en silencio: a Discord se va recién si la persona
// aprieta «Entrar con Discord».
// ⚠️ SIN EMOJIS (13/10/2026: cada celular los dibuja distinto): los títulos de cada rapero llevan el ícono de la copa.
import { useEffect, useState } from 'react';
import { pedirAjustes, pedirPanel } from './panelsocio.js';
import { limpio, num, siglaDe } from './liga.js';
import { Ico, Sec, silueta } from './piezas.jsx';
import { useNumero } from './anima.js';
import { Indice, Portada } from './entidad2.jsx';
import CSS_PAGINA from './css/socio2.css?inline';
import { usarCss } from './css.js';

usarCss('socio2', CSS_PAGINA);

const W = window;
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DIAS_C = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
// las franjas de bot/tiers.py (`FRANJAS`), en hora del este
const FRANJAS = [['Madrugada', '0 a 6'], ['Mañana', '6 a 12'], ['Mediodía', '12 a 16'], ['Tarde', '16 a 20'], ['Noche', '20 a 24']];
// con menos eventos que esto en un día o una franja no se marca nada: es `MIN_MUESTRA` de bot/tiers.py, la de las sugerencias
const MIN_MUESTRA = 2;
const PARTES = [['actividad', 'Actividad', 35, 'Eventos por semana: con 2 llega al tope.'],
  ['alcance', 'Alcance', 25, 'Raperos por evento y gente nueva.'],
  ['calidad', 'Calidad', 25, 'Llaves que el bot lee solo, anuncios que dicen quién organiza y pocos cancelados.'],
  ['comunidad', 'Comunidad', 15, 'Los nuevos que vuelven, las promos y las ligas.']];
// a qué parte del panel lleva cada sugerencia (`sug_ir`, lo manda el ciclo: `sugerencias_ir()` de bot/tiers.py)
const IR = { 'sp-cuando': 'Ver cuándo', 'sp-semanas': 'Ver las semanas', 'sp-gente': 'Ver tu gente', 'sp-puntaje': 'Ver el puntaje', 'sp-ajustes': 'Ver los ajustes' };
const TIER = { 1: 'TIER 1 · SUMA AL RANKING', 2: 'TIER 2 · EL CALENDARIO Y LA CAMPANA', 3: 'TIER 3 · SU PÁGINA Y SUS LIGAS' };
// lo que trae el panel, para quien todavía no entró
const TRAE = [['copa', 'Su puntaje', 'De 0 a 100 con las últimas 4 semanas: lo que mira la Liga para el nivel de cada socio.'],
  ['brote', 'Lo que conviene', 'Qué días juntan más gente, qué días la Liga está llena y cómo vienes.'],
  ['reloj', 'Cuándo hay actividad', 'Tu gente por evento, día por día y por franja del día.'],
  ['seguir', 'Su gente', 'Los raperos y las crews que más juegan en tu servidor.'],
  ['perfil', 'Las visitas', 'Cuánta gente abre la página de tu servidor, día por día.'],
  ['engranaje', 'Los ajustes del bot', 'Los de /settings y dos más: el bot en vivo, los avisos y dónde se usa /card.']];

const fechaCorta = (iso) => { const p = String(iso || '').split('-'); return p.length === 3 ? Number(p[2]) + '/' + Number(p[1]) : ''; };
const coma = (x) => String(Math.round((Number(x) || 0) * 10) / 10).replace('.', ',');
const pct = (v, max) => Math.max(0, Math.round((100 * (Number(v) || 0)) / (max || 1))) + '%';
// 💡 el número que respalda cada sugerencia, resaltado (el primero: «Los martes tus eventos juntan 23,9 raperos…»). Las
// semanas no: «en las últimas 4 semanas» es la ventana, no el dato
const resaltar = (s) => {
  const m = /\d+(?:[.,]\d+)?(?![\d.,]| semanas?\b)/.exec(s);
  return m ? <>{s.slice(0, m.index)}<b>{m[0]}</b>{s.slice(m.index + m[0].length)}</> : s;
};
// bajar a una sección: adentro del shadow root, así que se busca desde ahí y no en `document`; el índice pegado tapa 64 px
const irA = (e, id) => {
  const r = e.currentTarget.getRootNode();
  const el = r && r.getElementById ? r.getElementById(id) : null;
  if (el) W.scrollTo({ top: el.getBoundingClientRect().top + W.scrollY - 64, behavior: 'smooth' });
};
// el más alto de una lista `[[eventos, valor], …]`, entre los que tienen muestra; -1 si no hay dos para comparar
const elMejor = (xs) => {
  const c = xs.map((d, i) => [i, d]).filter(([, d]) => (d[0] || 0) >= MIN_MUESTRA);
  return c.length >= 2 ? c.reduce((a, b) => (b[1][1] > a[1][1] ? b : a))[0] : -1;
};

function Contador({ v }) {
  return useNumero(v);
}

// ── los servidores de quien tiene más de uno (y de Dlx, que los ve todos) ──
function Elegir({ liga, svs, sel, onSel }) {
  return (
    <nav className="sp-elegir" aria-label="Tus servidores">
      <ol>{svs.map((s) => (
        <li key={s.sv}>
          <button type="button" className={s.sv === sel ? 'on' : ''} aria-pressed={s.sv === sel}
            style={{ '--c': ((liga.svs || {})[s.sv] || {}).color || '#29B298' }} onClick={() => { onSel(s.sv); W.scrollTo(0, 0); }}>
            <b>{siglaDe(s.sv)}</b><small>{s.puntos}</small>
          </button>
        </li>
      ))}</ol>
    </nav>
  );
}

// ── el puntaje: la tendencia y sus cuatro partes. Con todo en cero, una línea: cuatro barras vacías no dicen nada ──
function Puntaje({ x }) {
  const dif = (x.puntos || 0) - (x.antes || 0);
  if (!x.puntos && !Object.values(x.partes || {}).some(Boolean)) {
    return <p className="sp-vacio">Todavía no hay con qué medirlo: el puntaje se mueve con tus eventos de las últimas 4 semanas.</p>;
  }
  const filas = PARTES.map(([k, t, tope, que]) => ({ k, t, tope, que, v: (x.partes || {})[k] || 0 }));
  const falta = filas.reduce((a, b) => (b.tope - b.v > a.tope - a.v ? b : a));
  return (
    <>
      {/* 📈 sólo contra 4 semanas de ESTA temporada: contra las de antes del arranque, todos «subían» */}
      {x.compara === false
        ? <p className="sp-tend">La comparación con las 4 semanas anteriores llega el <b>{fechaCorta(x.compara_desde)}</b>, cuando la temporada tenga 8 semanas.</p>
        : <p className={'sp-tend' + (dif > 0 ? ' sube' : dif < 0 ? ' baja' : '')}><b>{dif > 0 ? '▲ ' + dif : dif < 0 ? '▼ ' + -dif : '='}</b> contra las 4 semanas de antes, que dieron {x.antes || 0}.</p>}
      {/* cada parte, tan ancha como lo que pesa: lo lleno de la barra entera ES el puntaje */}
      <div className="sp-regla" role="img" aria-label={'Puntaje: ' + filas.map((f) => f.t + ' ' + f.v + ' de ' + f.tope).join(', ')}>
        {filas.map((f) => <span key={f.k} className={f.v >= f.tope ? 'tope' : ''} style={{ flexGrow: f.tope }}><u style={{ width: pct(f.v, f.tope) }} /></span>)}
      </div>
      <ol className="sp-partes">{filas.map((f) => (
        <li key={f.k} className={f.v >= f.tope ? 'tope' : ''} style={{ '--peso': f.tope }}>
          <b>{f.t}</b><span><strong>{f.v}</strong> de {f.tope}</span>
          <small>{f.que}</small>
        </li>
      ))}</ol>
      {falta.tope > falta.v ? <p className="sp-falta">Donde más puntos puedes sumar: <b>{falta.t}</b>, te faltan {falta.tope - falta.v}.</p> : null}
    </>
  );
}

// ── cuándo hay actividad: los días como tabla y las horas al lado. Cada columna dice de cuánto tiempo es: lo tuyo,
// desde el arranque o las últimas 8 semanas (`SEMANAS_PANEL` de bot/tiers.py); la Liga, las últimas 4 ──
function Cuando({ p }) {
  const dias = p.dias || [], liga = p.liga || [], fr = p.franjas || [];
  const nSem = (p.semanas || []).length || 8;
  // sin eventos tuyos, sólo la Liga: siete «sin eventos» en una columna no dicen nada
  const tuyos = dias.some((d) => d[0]);
  const max = Math.max(1, ...dias.map((d) => d[1] || 0));
  const maxL = Math.max(1, ...liga.map((d) => d[0] || 0));
  const maxF = Math.max(1, ...fr.map((d) => d[1] || 0));
  const mejor = elMejor(dias);
  // el más lleno, con la regla de la sugerencia: 2 eventos por semana o más
  const lleno = liga.some((d) => (d[0] || 0) >= 2) ? liga.findIndex((d) => (d[0] || 0) === maxL) : -1;
  const mejorF = elMejor(fr);
  const conHoras = fr.some((f) => f[0]);
  return (
    <div className={'sp-cuando' + (conHoras ? ' dos' : '')}>
      <div>
        <table className={'sp-dias' + (tuyos ? '' : ' sola')}>
          <thead><tr><th scope="col">Día</th>
            {tuyos ? <th scope="col">Tu gente por evento <span>· {nSem} semanas</span></th> : null}
            <th scope="col">La Liga · eventos por semana <span>· últimas 4</span></th></tr></thead>
          <tbody>{DIAS.map((t, i) => {
            const d = dias[i] || [0, 0], l = liga[i] || [0, 0];
            return (
              <tr key={t} className={(i === mejor ? 'mejor' : '') + (i === lleno ? ' lleno' : '')}>
                <th scope="row"><span className="sp-dl">{t}</span><span className="sp-dc">{DIAS_C[i]}</span></th>
                {tuyos ? <td>{d[0] ? (
                  <div className="sp-bar"><i><u style={{ width: pct(d[1], max) }} /></i><b>{coma(d[1])}</b><small>{d[0]}{' '}ev</small>
                    {i === mejor ? <em>Tu mejor día</em> : null}</div>
                ) : <small className="sp-sin">sin eventos</small>}</td> : null}
                <td><div className="sp-bar liga"><i><u style={{ width: pct(l[0], maxL) }} /></i><b>{coma(l[0])}</b>
                  {i === lleno ? <em>El más lleno</em> : null}</div></td>
              </tr>
            );
          })}</tbody>
        </table>
        {!tuyos ? <p className="sp-nota">Todavía no hay eventos tuyos en la temporada: así está el resto de la Liga cada día.</p> : null}
        {mejor >= 0 || lleno >= 0 ? (
          <p className="sp-ley">{mejor >= 0 ? <span><i className="a" />tu mejor día</span> : null}
            {lleno >= 0 ? <span><i className="m" />el día con más eventos en la Liga: compite por la misma gente</span> : null}</p>
        ) : null}
      </div>
      {conHoras ? (
        <div className="sp-franjas">
          <h3 className="sp-h">A qué hora <small>tu gente por evento</small></h3>
          <ol>{FRANJAS.map(([t, h], i) => {
            const f = fr[i] || [0, 0];
            return (
              <li key={t} className={i === mejorF ? 'mejor' : ''}>
                <b>{f[0] ? coma(f[1]) : '—'}</b>
                <i><u style={{ height: f[0] ? pct(f[1], maxF) : 0 }} /></i>
                <span>{t}</span><small>{h} · {f[0] || 0}{' '}ev</small>
              </li>
            );
          })}</ol>
          <p className="sp-nota">Hora del este. La hora de cada evento sale de cuándo se publicó su llave en Discord.</p>
        </div>
      ) : null}
    </div>
  );
}

// ── semana a semana: lo que juntó cada una, con la gente nueva abajo. Desde la semana del arranque (bot/tiers.py), y
// la que corre va marcada «en curso»: con un día jugado, al lado de las enteras parecía un derrumbe ──
function Semanas({ p }) {
  const sem = p.semanas || [];
  const max = Math.max(1, ...sem.map((s) => s[2] || 0));
  const enCurso = (d) => Date.parse(d + 'T12:00:00Z') + 7 * 86400000 > Date.now();
  return (
    <>
      <ol className="sp-sem" style={{ '--n': sem.length }}>{sem.map(([d, ev, gente, nuevos]) => (
        <li key={d} className={enCurso(d) ? 'va' : ''}>
          <b>{gente ? num(gente) : '—'}</b>
          <i style={{ height: gente ? Math.max(3, Math.round((100 * gente) / max)) + '%' : 0 }}>
            <u style={{ height: gente ? Math.round((100 * nuevos) / gente) + '%' : 0 }} /></i>
          <span>{fechaCorta(d)}</span>
          <small>{enCurso(d) ? 'en curso' : ev ? ev + ' ev' : 'sin eventos'}</small>
          {nuevos ? <small className="nv">{num(nuevos)} nuevos</small> : null}
        </li>
      ))}</ol>
      <p className="sp-ley"><span><i className="g" />participaciones</span><span><i className="a" />de gente que debutaba en la Liga en tu servidor</span></p>
    </>
  );
}

// ── su gente: las crews que más juegan acá, en una fila, y los raperos en dos columnas (en la compu, una al lado de la
// otra quedaban diez raperos contra tres crews y un hueco de 320 px debajo de las crews) ──
function SuGente({ p }) {
  const rs = p.raperos || [], cs = p.crews || [];
  return (
    <div className="sp-gente">
      {cs.length ? (
        <div>
          <h3 className="sp-h">Sus crews <small>las que más juegan acá</small></h3>
          <ol className="sp-crews">{cs.map(([id, n, cuantos, pts], i) => (
            <li key={id}><a href={'#/crew/' + encodeURIComponent(id)}>
              <span className="sp-pos">{i + 1}</span><b>{limpio(n)}</b>
              <small>{cuantos} {cuantos === 1 ? 'rapero' : 'raperos'} · {num(pts)} pts acá</small></a></li>
          ))}</ol>
        </div>
      ) : null}
      <div>
        <h3 className="sp-h">Sus raperos <small>{num(p.gente_total || rs.length)} jugaron en tu servidor: los que más puntos hicieron acá</small></h3>
        <ol className={'sp-lista' + (rs.length > 5 ? ' dos' : '')} style={{ '--filas': Math.ceil(rs.length / 2) }}>{rs.map(([n, k, ev, pts, oro], i) => (
          <li key={k}>
            <span className="sp-pos">{i + 1}</span>
            <a href={'#/r/' + encodeURIComponent(k)}>{limpio(n)}</a>
            <span className="sp-dat"><b>{num(pts)}</b> pts · {ev} ev
              {oro ? <span className="sp-oro" title={oro + (oro === 1 ? ' título' : ' títulos') + ' acá'}><Ico n="copa" t={14} />{oro}</span> : null}</span>
          </li>
        ))}</ol>
      </div>
    </div>
  );
}

// ── las visitas a su página: una por persona y por día ──
function Visitas({ x }) {
  const v = x.visitas || [];
  const tot = v.reduce((s, d) => s + (d[1] || 0), 0);
  if (!tot) return <p className="sp-vacio">Todavía no hay visitas contadas: se cuenta una por persona y por día.</p>;
  const max = Math.max(1, ...v.map((d) => d[1] || 0));
  const mejor = v.reduce((a, b) => (b[1] > a[1] ? b : a));
  return (
    <>
      <dl className="sp-vis-n">
        <div><dt>EN 4 SEMANAS</dt><dd>{num(tot)}</dd></div>
        <div><dt>EL MEJOR DÍA</dt><dd>{num(mejor[1])}<small> el {fechaCorta(mejor[0])}</small></dd></div>
      </dl>
      {/* gris, y el mejor día en verde agua: el color dice algo, no decora */}
      <div className="sp-vis" role="img" aria-label={'Visitas a la página del servidor, día por día: ' + num(tot) + ' en 4 semanas'}>
        {v.map(([d, n]) => <i key={d} className={d === mejor[0] ? 'mejor' : ''} title={fechaCorta(d) + ': ' + n}
          style={{ height: n ? Math.max(4, Math.round((100 * n) / max)) + '%' : '2px' }} />)}
      </div>
      <div className="sp-vis-x"><span>{fechaCorta(v[0][0])}</span><span>{fechaCorta(v[v.length - 1][0])}</span></div>
    </>
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
// una fila de ajustes: qué es a la izquierda y el control a la derecha (arriba y abajo en el teléfono), con su «Guardado»
// al lado de lo que se tocó. `label` ata el texto al menú; el interruptor ya lleva su nombre
function Fila({ t, ayuda, sello, label, children }) {
  const Tag = label ? 'label' : 'div';
  return (
    <Tag className="sp-fila">
      <span className="sp-fila-t"><b>{t}</b>{ayuda ? <small>{ayuda}</small> : null}</span>
      <span className="sp-fila-c">{children}
        <span className="sp-sello" role="status">{sello ? <><Ico n="ok" t={14} />Guardado</> : null}</span>
      </span>
    </Tag>
  );
}
// prendido o apagado, con la frase de lo que pasa en cada caso (son las dos opciones que tenía el menú)
function Interruptor({ t, on, si, no, ocup, cambiar }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} aria-label={t} disabled={ocup} className={'sp-sw' + (on ? ' on' : '')} onClick={() => cambiar(!on)}>
      <i aria-hidden="true" /><span>{on ? si : no}</span>
    </button>
  );
}
function Ajustes({ sv }) {
  const [j, setJ] = useState(null);
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState(null);
  // ⏳ lo elegido se ve elegido mientras se guarda: sin esto cada menú volvía a lo de antes hasta que contestaba el Worker
  const [pend, setPend] = useState({});
  // ✅ el «Guardado» de la fila que se acaba de tocar
  const [sello, setSello] = useState('');
  useEffect(() => {
    if (!sello) return undefined;
    const t = setTimeout(() => setSello(''), 3000);
    return () => clearTimeout(t);
  }, [sello]);
  useEffect(() => {
    let vivo = true;
    setJ(null); setMsg(null);
    pedirAjustes(sv).then((r) => { if (vivo) setJ(r || { error: 'red' }); });
    return () => { vivo = false; };
  }, [sv]);
  // el aviso de error se va solo: abajo de la pantalla, sin tapar nada
  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => setMsg(null), 4500);
    return () => clearTimeout(t);
  }, [msg]);
  const cambiar = (cual, valor) => {
    setOcup(true); setMsg(null); setSello('');
    setPend((p) => ({ ...p, [cual]: valor }));
    pedirAjustes(sv, { cual, valor }).then((r) => {
      if (r && r.ok) { setJ(r); setSello(cual); } else setMsg(['mal', AJ_ERR[r && r.error] || 'No se pudo guardar.']);
      setPend((p) => { const n = { ...p }; delete n[cual]; return n; });
      setOcup(false);
    });
  };
  if (!j) return <p className="pronto-p">Buscando los ajustes…</p>;
  if (!j.ok) return <p className="pronto-p">{AJ_ERR[j.error] || 'No pude traer los ajustes. Prueba de nuevo en un rato.'}</p>;
  const c = { ...(j.cfg || {}), ...pend }, cs = j.canales || [], niveles = j.niveles || [];
  const evDiscord = 'eventos_discord' in pend ? pend.eventos_discord : j.eventos_discord;
  // el nivel elegido, dicho en palabras: en el menú va sólo el nombre (con la descripción, «Con datos» se cortaba)
  const nivel = niveles.find((x) => x[0] === (c.vivo_nivel || 'normal'));
  const nombre = (id) => { const k = cs.find((x) => x.id === id); return k ? '#' + k.n : id ? 'un canal que ya no está' : ''; };
  const general = j.general ? nombre(j.general) : 'su chat general';
  const elegidos = c.canales || [];
  const toggleCanal = (id) => cambiar('canales', elegidos.includes(id) ? elegidos.filter((x) => x !== id) : elegidos.concat(id));
  const sel = { c, cs, ocup, cambiar };
  return (
    <>
      <div className="sp-aj">
        <fieldset>
          <legend>Dónde publica el bot</legend>
          <Fila label t="Cómo va el evento" sello={sello === 'vivo'} ayuda="Durante un evento de la Liga en tu servidor, lo cuenta ahí. Nunca menciona a nadie.">
            <Canal {...sel} cual="vivo" vacio="Apagado" /></Fila>
          <Fila label t="El aviso de cada evento" sello={sello === 'aviso_evento'} ayuda="Cuando un servidor anuncia un evento. Vale desde el próximo.">
            <select value={c.aviso_evento || ''} disabled={ocup} onChange={(e) => cambiar('aviso_evento', e.target.value)}>
              <option value="">Donde habla el bot en vivo</option>
              <option value="chat">En {general}, siempre</option>
              <option value="no">Apagado</option>
            </select></Fila>
          <Fila label t="Los cambios de rango" sello={sello === 'avisos'} ayuda="Cuando alguien sube o baja de rango.">
            <Canal {...sel} cual="avisos" vacio="Apagado" /></Fila>
          <Fila label t="El ascenso de tus ligas" sello={sello === 'ascenso'} ayuda="Mantiene ahí su ranking de ascenso al día.">
            <Canal {...sel} cual="ascenso" vacio="Apagado" /></Fila>
        </fieldset>
        <fieldset>
          <legend>Cómo se porta</legend>
          <Fila label t="Cuánto habla" sello={sello === 'vivo_nivel'} ayuda={c.vivo ? (nivel ? nivel[2] + '.' : '') : 'Vale cuando el bot tiene un canal para contar cómo va el evento.'}>
            <select value={c.vivo_nivel || 'normal'} disabled={ocup} onChange={(e) => cambiar('vivo_nivel', e.target.value)}>
              {niveles.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select></Fila>
          <Fila t="Apuestas" sello={sello === 'apuestas'} ayuda="Antes de cada batalla se apuesta con Puntos de Tienda desde el chat, y el pozo se reparte entre los que aciertan.">
            <Interruptor t="Apuestas" on={c.apuestas} ocup={ocup} cambiar={(v) => cambiar('apuestas', v)}
              si="Prendidas, en cualquier nivel" no="Como siempre: sólo con el bot en «A full»" /></Fila>
          <Fila t="Eventos de Discord" sello={sello === 'eventos_discord'} ayuda="El bot necesita «Crear eventos» en tu servidor.">
            <Interruptor t="Eventos de Discord" on={evDiscord} ocup={ocup} cambiar={(v) => cambiar('eventos_discord', v)}
              si="Cada anuncio, un evento de tu Discord" no="Apagados" /></Fila>
          <Fila t="#N del ranking en el apodo" sello={sello === 'nick'} ayuda="Quien lo eligió con /numeral se queda con lo suyo.">
            <Interruptor t="#N del ranking en el apodo" on={c.nick} ocup={ocup} cambiar={(v) => cambiar('nick', v)}
              si="Activado: se le pone el número a todos" no="Apagado: no se le pone a nadie" /></Fila>
        </fieldset>
        <fieldset className="sp-aj-card">
          <legend>Dónde se puede usar /card</legend>
          <p className="sp-elegidos">{elegidos.length ? elegidos.map((id) => <b key={id}>{nombre(id)}</b>) : <b>En cualquier canal</b>}
            <small>{elegidos.length} de 10<span className="sp-sello" role="status">{sello === 'canales' ? <><Ico n="ok" t={14} />Guardado</> : null}</span></small></p>
          <details className="sp-canales">
            <summary>Elegir canales</summary>
            {elegidos.length >= 10 ? <p className="sp-tope">Llegaste a 10: quita uno para sumar otro.</p> : null}
            <div className="sp-canales-l">{cs.map((k) => (
              <label key={k.id}><input type="checkbox" checked={elegidos.includes(k.id)} disabled={ocup || (!elegidos.includes(k.id) && elegidos.length >= 10)}
                onChange={() => toggleCanal(k.id)} /><span>#{k.n}</span>{k.cat ? <small>{k.cat}</small> : null}</label>
            ))}</div>
          </details>
        </fieldset>
      </div>
      <div className="sp-toast-z" role="alert">
        {msg ? <p className={'sp-toast ' + msg[0]}><Ico n="aviso" t={18} />{msg[1]}</p> : null}
      </div>
    </>
  );
}

// ── un servidor, entero ──
function Servidor({ liga, x, svs, onSel, t }) {
  const p = x.panel || {};
  const m = x.m || {};
  const color = ((liga.svs || {})[x.sv] || {}).color || '#29B298';
  const logo = liga.logo ? liga.logo(x.sv, true) : '';
  const pts = x.puntos || 0;
  const sube = x.compara !== false && pts > (x.antes || 0);
  const sugs = p.sugerencias || [];
  const irs = p.sug_ir || [];
  const items = [['sp-puntaje', 'Puntaje', null], ['sp-sug', 'Lo que conviene', sugs.length], ['sp-cuando', 'Cuándo', null],
    ['sp-semanas', 'Semanas', null], ['sp-gente', 'Su gente', null], ['sp-visitas', 'Visitas', null], ['sp-ajustes', 'Ajustes', null]];
  return (
    <>
      {svs.length > 1 ? <Elegir liga={liga} svs={svs} sel={x.sv} onSel={onSel} /> : null}
      <Portada forma="cuadrado" color={color} nombre={limpio(x.nombre || siglaDe(x.sv))}
        estilo={logo ? { '--mo-logo': 'url("' + logo + '")', ...silueta(x.sv, color) } : silueta(x.sv, color)}
        emblema={logo ? <img alt="" src={logo} /> : <b className="sp-sigla">{siglaDe(x.sv)}</b>}
        tag={TIER[x.tier] || 'TIER ' + x.tier}
        sub={<>{siglaDe(x.sv)}{x.ultimo ? ' · último evento el ' + fechaCorta(x.ultimo) : ''}{m.miembros ? ' · ' + num(m.miembros) + ' miembros en su Discord' : ''}
          {t ? <small className="sp-medido">Medido el {W.fmtFecha ? W.fmtFecha(t, { day: 'numeric', month: 'numeric' }) : fechaCorta(String(t).slice(0, 10))}
            {W.fmtHora ? ' a las ' + W.fmtHora(new Date(t)) : ''}. Se actualiza cada media hora.</small> : null}</>}
        acciones={<>
          <a className="btn verde" href={'#/sv/' + encodeURIComponent(siglaDe(x.sv))}>Su página</a>
          <button type="button" className="btn borde" onClick={(e) => irA(e, 'sp-ajustes')}>Ajustes del bot</button>
        </>}
        numeros={[['PUNTAJE', <><Contador v={pts} /><small className="sp-de"> de 100</small></>, 'dest' + (sube ? ' sube' : '')],
          ['EVENTOS · 4 SEMANAS', num(m.eventos || 0)], ['RAPEROS POR EVENTO', m.eventos ? coma(m.por_evento || 0) : '—'],
          ['NUEVOS · 4 SEMANAS', <>{num(m.nuevos || 0)}{m.nuevos ? <small className="sp-de"> volvió el {Math.round((100 * (m.volvieron || 0)) / m.nuevos)} %</small> : null}</>]]} />
      <Indice items={items} />
      <Sec id="sp-puntaje" titulo="Su puntaje" bajada="De 0 a 100, con las últimas 4 semanas: es lo que mira la Liga para el nivel de cada socio. Cada parte tiene su tope.">
        <Puntaje x={x} />
      </Sec>
      {sugs.length ? (
        <Sec id="sp-sug" titulo="Lo que conviene" bajada="Sale de tus números de las últimas semanas." extra="negra">
          {/* el botón una vez por destino: cuatro «Ver cuándo» seguidos llevan al mismo lugar */}
          <ol className="sp-sug">{sugs.map((s, i) => (
            <li key={s}><span>{String(i + 1).padStart(2, '0')}</span><p>{resaltar(s)}</p>
              {IR[irs[i]] && irs.indexOf(irs[i]) === i ? <button type="button" className="sp-ir" onClick={(e) => irA(e, irs[i])}>{IR[irs[i]]}</button> : null}</li>
          ))}</ol>
        </Sec>
      ) : null}
      {(p.dias || []).length ? (
        <Sec id="sp-cuando" titulo="Cuándo hay actividad" bajada="Cuánta gente juntan tus eventos cada día, y cuántos eventos tiene el resto de la Liga ese día: un día lleno compite por la misma gente.">
          <Cuando p={p} />
        </Sec>
      ) : null}
      {/* ocho semanas en cero no son un gráfico: es «sin dato no hay pieza» */}
      {(p.semanas || []).some((s) => s[2]) ? (
        <Sec id="sp-semanas" titulo="Semana a semana" bajada="Las participaciones de cada semana de la temporada, de lunes a domingo: cada rapero cuenta una vez por evento que juega. En verde agua, los que debutaban en la Liga en tu servidor.">
          <Semanas p={p} />
        </Sec>
      ) : null}
      {(p.raperos || []).length ? (
        <Sec id="sp-gente" titulo="Su gente" bajada="Lo de cada uno en tu servidor, esta temporada.">
          <SuGente p={p} />
        </Sec>
      ) : null}
      <Sec id="sp-visitas" titulo="Visitas a su página" bajada="Personas por día que abrieron la página de tu servidor, las últimas 4 semanas.">
        <Visitas x={x} />
      </Sec>
      {/* ⚠️ «el aviso de cada evento» y «Eventos de Discord» NO están en /settings (bot/worker.js): son sólo de acá y del
          Dashboard. Decir «es lo mismo que /settings» era falso para esos dos */}
      <Sec id="sp-ajustes" titulo="Los ajustes del bot" bajada="Los de /settings en tu Discord —lo último que cambies, acá o allá, es lo que vale— y dos que sólo están acá: el aviso de cada evento y los eventos de Discord.">
        <Ajustes sv={x.sv} />
      </Sec>
    </>
  );
}

// ── quien no entró, o no es dueño de ningún socio: qué trae el panel ──
function Puerta({ texto, entrar }) {
  return (
    <>
      <div className="escena sp-esc" style={{ '--mo-c': '#29B298', '--mo-o': 0.9 }}>
        <section className="sp-puerta">
          <span className="tag">PARA LOS DUEÑOS DE LOS SERVIDORES SOCIOS</span>
          <h1 className="hero-ev largo">El panel de tu servidor</h1>
          <p className="hero-p">{texto}</p>
          {entrar ? <button type="button" className="btn verde" onClick={entrar}>Entrar con Discord</button> : null}
        </section>
      </div>
      <Sec id="sp-trae" titulo="Qué trae">
        <ul className="sp-trae">{TRAE.map(([ico, tt, d]) => <li key={tt}><Ico n={ico} t={22} /><b>{tt}</b><p>{d}</p></li>)}</ul>
      </Sec>
    </>
  );
}

export function PanelSocio({ liga, q }) {
  const [j, setJ] = useState(null);
  const [sel, setSel] = useState(() => (/(?:^|&)sv=([A-Z]{2,6})/.exec(q || '') || [])[1] || '');
  useEffect(() => { W.scrollTo(0, 0); }, []);
  useEffect(() => {
    let vivo = true;
    pedirPanel(false).then((r) => { if (vivo) setJ(r); });
    return () => { vivo = false; };
  }, []);
  if (!j) return <p className="pronto-p sp-carga" role="status">Buscando tu servidor…</p>;
  if (j.status === 401) {
    return <Puerta texto="Cómo viene tu servidor en la Liga, cuándo conviene hacer eventos y los ajustes del bot, en un solo lugar. Entra con la cuenta de Discord del dueño."
      entrar={() => pedirPanel(true).then((r) => { if (r) setJ(r); })} />;
  }
  const svs = (j && j.servidores) || [];
  if (!j.ok || !svs.length) {
    return <Puerta texto={j.ok ? 'Este panel es para los dueños de los servidores socios de la Liga. Si eres dueño de uno y no lo ves, escríbele a @itsdlx.'
      : 'No pude traer el panel ahora. Prueba de nuevo en un rato.'} />;
  }
  const x = svs.find((s) => s.sv === sel) || svs[0];
  return <Servidor liga={liga} x={x} svs={svs} onSel={setSel} t={j.t} />;
}
