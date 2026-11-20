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
// - ¿VUELVE TU GENTE? (04/11/2026, Dlx: «Si y mejora esos paneles»): cuánto vuelve, contra la Liga, si ayuda tener otro evento
//   cerca, hasta dónde llegan y a quién invitar. Va después de lo que conviene: es lo que más puede cambiar el dueño.
// - CÓMO SUBIR DE TIER, abajo del puntaje: las reglas de `recomendar()`, con cómo va cada una.
//
// ⚠️ NO CALCULA NADA NUEVO: lo arma el ciclo (`panel()` de bot/tiers.py) y lo sirve el objeto sólo al dueño de cada
// servidor (`panelSocio()` de bot/avisos.js); Dlx los ve todos. Pregunta en silencio: a Discord se va recién si la persona
// aprieta «Entrar con Discord».
// ⚠️ SIN EMOJIS (13/10/2026: cada celular los dibuja distinto): los títulos de cada rapero llevan el ícono de la copa.
import { Fragment, useEffect, useRef, useState } from 'react';
import { contestarFinal, pedirAjustes, pedirEquipo, pedirLiga, pedirLlave, pedirPagina, pedirPanel, pedirRoles, pedirStaff, probarCanal, puede } from './panelsocio.js';
import { aBase64, achicar } from './imagen.js';
import { claveDe, limpio, msDeLocal, nombreEv, num, siglaDe, utc } from './liga.js';
import { Cara, DosToques, Ico, Sec, diaET, masDias } from './piezas.jsx';
import { useNumero } from './anima.js';
import CSS_PAGINA from './css/socio2.css?inline';
import CAT_EST from './estilos_juego.json';
import { usarCss } from './css.js';

usarCss('socio2', CSS_PAGINA);

const W = window;
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DIAS_C = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
// las franjas de bot/tiers.py (`FRANJAS`), en hora del este
const FRANJAS = [['Madrugada', '0 a 6'], ['Mañana', '6 a 12'], ['Mediodía', '12 a 16'], ['Tarde', '16 a 20'], ['Noche', '20 a 24']];
// con menos eventos que esto en un día o una franja no se marca nada: es `MIN_MUESTRA` de bot/tiers.py, la de las sugerencias
const MIN_MUESTRA = 2;
// con menos debuts no se da un porcentaje: es `MIN_VUELVEN` de bot/tiers.py
const MIN_VUELVEN = 8;
const PARTES = [['actividad', 'Actividad', 35, 'Eventos por semana: con 2 llega al tope.'],
  ['alcance', 'Alcance', 25, 'Raperos por evento y gente nueva.'],
  ['calidad', 'Calidad', 25, 'Llaves que el bot lee solo, anuncios que dicen quién organiza y pocos cancelados.'],
  ['comunidad', 'Comunidad', 15, 'Los nuevos que vuelven, las promos y las ligas.']];
// a qué parte del panel lleva cada sugerencia (`sug_ir`, lo manda el ciclo: `sugerencias_ir()` de bot/tiers.py)
const IR = { 'sp-vuelven': 'Ver quién vuelve', 'sp-cuando': 'Ver cuándo', 'sp-semanas': 'Ver las semanas', 'sp-gente': 'Ver tu gente', 'sp-puntaje': 'Ver el puntaje', 'sp-ajustes': 'Ver los ajustes' };
// lo que trae el panel, para quien todavía no entró
const TRAE = [['copa', 'Su puntaje', 'De 0 a 100 con las últimas 4 semanas: lo que mira la Liga para el nivel de cada socio.'],
  ['brote', 'Lo que conviene', 'Qué días juntan más gente, qué días la Liga está llena y cómo vienes.'],
  ['fuego', '¿Vuelve tu gente?', 'Cuántos de los que debutan contigo vuelven a jugar, y a quién invitar.'],
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

// ── ¿vuelve tu gente? Lo que el dueño más puede cambiar: cuánto vuelve, contra la Liga, si ayuda tener otro evento cerca,
// hasta dónde llegan y a quién invitar. Con pocos debuts no hay porcentajes: tres personas no son un 33 % ──
const pc = (a, b) => (b ? Math.round((100 * a) / b) : 0);
function Barras({ xs }) {
  return (
    <ul className="sp-vb">{xs.map(([t, v, tuya, extra]) => (
      <li key={t} className={tuya ? 'tuya' : ''}><span>{t}</span><i><u style={{ width: v + '%' }} /></i><b>{v} %</b>{extra ? <small>{extra}</small> : null}</li>
    ))}</ul>
  );
}
function Vuelven({ v }) {
  const L = v.liga || {};
  const hay = v.n >= MIN_VUELVEN;
  const mio = pc(v.v, v.n);
  // otro evento cerca: lo suyo si le alcanza para comparar; si no, el de toda la Liga, y lo dice
  const c = v.con || [0, 0], s = v.sin || [0, 0];
  const propio = c[1] >= MIN_VUELVEN && s[1] >= MIN_VUELVEN;
  const [c2, s2] = propio ? [c, s] : [L.con || [0, 0], L.sin || [0, 0]];
  const emb = v.emb || [], embL = L.emb || [];
  const pasos = [['2 eventos', 1], ['3 eventos', 2], ['5 eventos', 3], ['10 o más', 4]];
  const lista = v.sin_volver || [];
  return (
    <div className={'sp-vu' + (hay ? '' : ' sola')}>
      <div className="sp-vu-col">
        {hay ? (
          <>
            <p className="sp-vu-num"><b>{mio}<small> %</small></b><span>{num(v.v)} de los {num(v.n)} que debutaron en tu servidor {v.v === 1 ? 'jugó' : 'jugaron'} otro evento en los 14 días siguientes.</span></p>
            <Barras xs={[['Tu servidor', mio, true], ['Toda la Liga', pc(L.v, L.n)]]} />
          </>
        ) : <p className="sp-vacio">{v.n === 0 ? 'Todavía nadie' : v.n === 1 ? 'Todavía una sola persona' : 'Todavía ' + num(v.n) + ' personas'} con sus 14 días cumplidos: con {MIN_VUELVEN} ya sale tu porcentaje.</p>}
        {c2[1] && s2[1] ? (
          <>
            <h3 className="sp-h">Con otro evento cerca <small>{propio ? 'en tu servidor' : 'en toda la Liga'}</small></h3>
            <Barras xs={[['Hay otro evento en los 3 días siguientes', pc(c2[0], c2[1]), true, num(c2[0]) + ' de ' + num(c2[1])],
              ['No hay otro', pc(s2[0], s2[1]), false, num(s2[0]) + ' de ' + num(s2[1])]]} />
          </>
        ) : null}
        {v.v ? <p className="sp-nota">De los que volvieron: {num(v.aca)} acá y {num(v.otro)} en otro servidor de la Liga. Es una comparación, no una prueba: en los servidores que juegan más seguido también hay gente más metida.</p> : null}
      </div>
      {hay ? (
        <div className="sp-vu-col">
          <h3 className="sp-h">Hasta dónde llegan <small>de los {num(v.n)} que debutaron acá</small></h3>
          <Barras xs={pasos.map(([t, i]) => [t, pc(emb[i], emb[0]), true, 'En toda la Liga, el ' + pc(embL[i], embL[0]) + ' %'])} />
        </div>
      ) : null}
      {lista.length ? (
        <div className="sp-vu-col sp-vu-inv">
          <h3 className="sp-h">Para invitar <small>jugaron una vez acá y no volvieron{v.sin_n > lista.length ? ': ' + num(v.sin_n) + ' en 30 días, los más recientes' : ''}</small></h3>
          <ol className={'sp-lista sp-inv' + (lista.length > 3 ? ' dos' : '')} style={{ '--filas': Math.ceil(lista.length / 2) }}>{lista.map(([n, k, d]) => (
            <li key={k}><a href={'#/r/' + encodeURIComponent(k)}>{limpio(n)}</a><span className="sp-dat">{d === 1 ? 'ayer' : 'hace ' + d + ' días'}</span></li>
          ))}</ol>
        </div>
      ) : null}
    </div>
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
            {lleno >= 0 ? <span><i className="lleno" />el día con más eventos en la Liga: compite por la misma gente</span> : null}</p>
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
  // 📅 LOS 28 DÍAS, TAMBIÉN LOS SIN VISITAS (18/11/2026): el objeto sólo manda los días con fila en `secciones` (una se crea
  // con la primera visita), y una barra por fila pegaba el 1/11, el 9/11 y el 17/11 como tres días seguidos. Del día de
  // hoy en hora del este (el `diaET()` del objeto) para atrás; el último con visitas manda si este reloj va atrasado
  const m = new Map(x.visitas || []);
  const hoy = (x.visitas || []).reduce((a, d) => (d[0] > a ? d[0] : a), diaET());
  const v = Array.from({ length: 28 }, (_, i) => { const d = masDias(hoy, i - 27); return [d, m.get(d) || 0]; });
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
  kv: 'No se pudo guardar ahora: prueba en un rato.', valor: 'Ese valor no vale.',
  solo_dueno: 'El equipo lo maneja el dueño del servidor.', no_esta: 'Esa persona no está en tu servidor.',
  ya_esta: 'Ya está en tu equipo.', tope: 'Llegaste a 10: saca a alguien para sumar a otro.',
  no_rol: 'Los ajustes los cambian el dueño y los admins.', sin_canal: 'Primero elige un canal.' };
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
// 🌙 de qué hora a qué hora no habla el bot en vivo en ese servidor: se guarda con «Guardar», y «Siempre» lo quita
function HorasSinBot({ sil, ocup, cambiar }) {
  const [d, setD] = useState((sil && sil.desde) || '01:00');
  const [h, setH] = useState((sil && sil.hasta) || '09:00');
  useEffect(() => { if (sil) { setD(sil.desde); setH(sil.hasta); } }, [sil && sil.desde, sil && sil.hasta]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span className="sp-sil">
      <span>{sil ? 'Callado de ' + sil.desde + ' a ' + sil.hasta : 'Habla a cualquier hora'}</span>
      <span className="sp-sil-h">
        <input type="time" value={d} aria-label="Desde" disabled={ocup} onChange={(e) => setD(e.target.value)} />
        <input type="time" value={h} aria-label="Hasta" disabled={ocup} onChange={(e) => setH(e.target.value)} />
        <button type="button" className="btn verde chico" disabled={ocup || !d || !h || d === h} onClick={() => cambiar('silencio', { desde: d, hasta: h })}>Guardar</button>
        {sil ? <button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => cambiar('silencio', '')}>Siempre</button> : null}
      </span>
    </span>
  );
}
function Ajustes({ sv, tier }) {
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
  // 🧪 PROBAR EL CANAL (16/11/2026): un mensaje de prueba ahí, para saber antes del evento si el bot puede escribir
  const probar = (cual) => {
    setOcup(true); setMsg(null);
    probarCanal(sv, cual).then((r) => {
      setOcup(false);
      if (r && r.ok) setMsg(['bien', 'Listo: mandé un mensaje de prueba a ' + nombre(c[cual]) + '. Si lo ves, el bot puede escribir ahí.']);
      else if (r && (r.estado === 403 || r.estado === 404)) setMsg(['mal', 'El bot no puede escribir en ' + nombre(c[cual]) + ': dale permiso de «Enviar mensajes» ahí.']);
      // ⏱️ (18/11/2026) el objeto deja una prueba por minuto y por servidor, y el «espera un segundo» de AJ_ERR (el de los 2 s
      // del guardado) hacía reintentar al segundo y volver a fallar durante casi un minuto
      else if (r && r.error === 'espera') setMsg(['mal', 'Una prueba por minuto en cada servidor: espera un momento y vuelve a probar.']);
      else setMsg(['mal', AJ_ERR[r && r.error] || 'No se pudo probar: intenta en un minuto.']);
    });
  };
  const Probar = ({ cual }) => (c[cual] && c[cual] !== 'no' ? <button type="button" className="btn borde2 chico sp-probar" disabled={ocup}
    onClick={(e) => { e.preventDefault(); probar(cual); }}>Probar</button> : null);
  // 🌙 LAS HORAS SIN BOT (16/11/2026): de cuándo a cuándo (hora del este) el bot no cuenta nada en tu chat
  const sil = c.silencio && typeof c.silencio === 'object' ? c.silencio : null;
  return (
    <>
      <div className="sp-aj">
        <fieldset>
          <legend>Dónde publica el bot</legend>
          <Fila label t="Cómo va el evento" sello={sello === 'vivo'} ayuda="Durante un evento de la Liga en tu servidor, lo cuenta ahí. Nunca menciona a nadie.">
            <Canal {...sel} cual="vivo" vacio="Apagado" /><Probar cual="vivo" /></Fila>
          <Fila label t="El aviso de cada evento" sello={sello === 'aviso_evento'} ayuda="Cuando un servidor anuncia un evento. Vale desde el próximo.">
            <select value={c.aviso_evento || ''} disabled={ocup} onChange={(e) => cambiar('aviso_evento', e.target.value)}>
              <option value="">Donde habla el bot en vivo</option>
              <option value="chat">En {general}, siempre</option>
              <option value="no">Apagado</option>
            </select></Fila>
          <Fila label t="Los cambios de rango" sello={sello === 'avisos'} ayuda="Cuando alguien sube o baja de rango.">
            <Canal {...sel} cual="avisos" vacio="Apagado" /><Probar cual="avisos" /></Fila>
          <Fila label t="El ascenso de tus ligas" sello={sello === 'ascenso'} ayuda="Mantiene ahí su ranking de ascenso al día.">
            <Canal {...sel} cual="ascenso" vacio="Apagado" /><Probar cual="ascenso" /></Fila>
          <Fila label t="El resumen de la semana" sello={sello === 'resumen'} ayuda="Cada lunes al mediodía: tus eventos, tu gente, los que más puntos hicieron y cuántos vuelven. Sin mencionar a nadie.">
            <Canal {...sel} cual="resumen" vacio="No mandar" /><Probar cual="resumen" /></Fila>
          {/* 👋 la bienvenida (20/11/2026): sólo llega gente por «Unirme a los Tier 1» a los Tier 1 */}
          {tier === 1 ? <Fila label t="La bienvenida" sello={sello === 'bienvenida'} ayuda="Cuando alguien entra a tu servidor con «Unirme a los Tier 1», el bot lo saluda ahí. Apagada hasta que elijas un canal.">
            <Canal {...sel} cual="bienvenida" vacio="Apagada" /></Fila> : null}
        </fieldset>
        {/* 🏟️ LAS BATALLAS DE SUS LIGAS (Dlx, 11/11/2026: «uno, y cambiar por liga»): un canal para todas y, si quiere, otro
            para alguna. Sin elegir, donde habla el bot en vivo, como hasta hoy */}
        {(j.ligas || []).length ? (
          <fieldset>
            <legend>Las batallas de tus ligas</legend>
            <Fila label t={(j.ligas || []).length > 1 ? 'Todas tus ligas' : j.ligas[0].n} sello={sello === 'ligas'} ayuda="Cada batalla de tus ligas mientras se juega, con su VS.">
              <select value={c.ligas || ''} disabled={ocup} onChange={(e) => cambiar('ligas', e.target.value)}>
                <option value="">{c.vivo ? 'Donde cuenta cómo va el evento (' + nombre(c.vivo) + ')' : 'Donde cuenta cómo va el evento'}</option>
                {cs.map((k) => <option key={k.id} value={k.id}>{'#' + k.n + (k.cat ? ' · ' + k.cat : '')}</option>)}
                <option value="no">Apagado</option>
              </select></Fila>
            {(j.ligas || []).length > 1 ? (j.ligas || []).map((L) => {
              const cual = 'liga:' + L.id;
              const v = cual in pend ? pend[cual] : ((c.ligas_por || {})[L.id] || '');
              return (
                <Fila key={L.id} label t={L.n} sello={sello === cual}>
                  <select value={v} disabled={ocup} onChange={(e) => cambiar(cual, e.target.value)}>
                    <option value="">Como las demás</option>
                    {cs.map((k) => <option key={k.id} value={k.id}>{'#' + k.n + (k.cat ? ' · ' + k.cat : '')}</option>)}
                    <option value="no">Apagado</option>
                  </select></Fila>
              );
            }) : null}
          </fieldset>
        ) : null}
        <fieldset>
          <legend>Cómo se porta</legend>
          <Fila label t="Cuánto habla" sello={sello === 'vivo_nivel'} ayuda={c.vivo ? (nivel ? nivel[2] + '.' : '') : 'Vale cuando el bot tiene un canal para contar cómo va el evento.'}>
            <select value={c.vivo_nivel || 'normal'} disabled={ocup} onChange={(e) => cambiar('vivo_nivel', e.target.value)}>
              {niveles.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select></Fila>
          <Fila t="Horas sin bot" sello={sello === 'silencio'} ayuda="De qué hora a qué hora (del este) el bot no cuenta nada en tu chat. Lo que pase mientras tanto no lo cuenta tarde.">
            <HorasSinBot sil={sil} ocup={ocup} cambiar={cambiar} /></Fila>
          {/* 🎲 sin interruptor desde el 11/11/2026: las apuestas salen siempre, en todos los niveles (`hayApuestas()` en avisos.js) */}
          <Fila t="Apuestas" ayuda="Antes de cada batalla se apuesta con Puntos de Tienda desde el chat, y el pozo se reparte entre los que aciertan.">
            <span>Van siempre, con el bot en cualquier nivel</span></Fila>
          <Fila t="Eventos de Discord" sello={sello === 'eventos_discord'} ayuda="El bot necesita «Crear eventos» en tu servidor.">
            <Interruptor t="Eventos de Discord" on={evDiscord} ocup={ocup} cambiar={(v) => cambiar('eventos_discord', v)}
              si="Cada anuncio, un evento de tu Discord" no="Apagados" /></Fila>
          {/* 💬 LEER EL CHAT GENERAL (17/11/2026, `bot/chats.py`): prendido de entrada, y lo apaga el staff de cada servidor */}
          <Fila t="Leer el chat general" sello={sello === 'leer_chat'}
            ayuda="Una vez por día el bot lee tu chat general: cuenta cuánto se habla y quiénes, y si alguien denuncia un evento falso, una trampa, un raid o una estafa, se lo pasa a la Liga. Lo demás no se guarda.">
            <Interruptor t="Leer el chat general" on={c.leer_chat !== false} ocup={ocup} cambiar={(v) => cambiar('leer_chat', v)}
              si="Prendido: lo lee una vez por día" no="Apagado: no lee nada de tu chat" /></Fila>
          {/* 🏆 LOS GANADORES DE CADA EVENTO (Discord, tanda 2, 17/11/2026, `bot/aviso_ganadores.py`): prendido de entrada, y lo
              apaga el staff de cada servidor (Dlx: «prendido en todos los socios, el dueño lo apaga») */}
          <Fila t="Los ganadores de cada evento" sello={sello === 'ganadores'}
            ayuda="Al terminar cada evento de la Liga en tu servidor, el bot avisa en tu chat general quién ganó y qué drop se lleva, con botones para abrirlo. Menciona sólo a quien ganó un drop.">
            <Interruptor t="Los ganadores de cada evento" on={c.ganadores !== false} ocup={ocup} cambiar={(v) => cambiar('ganadores', v)}
              si="Prendido: un aviso por evento" no="Apagado: no se avisa" /></Fila>
          {/* 🏷️ desde el 18/11/2026 son las marcas del apodo (el #N y la crew), y cada uno elige su estilo con /apodo */}
          <Fila t="Las marcas de la Liga en el apodo" sello={sello === 'nick'} ayuda="El #N y la crew de cada uno, como «#23 | FLB | Nombre». Quien eligió su estilo con /apodo se queda con lo suyo.">
            <Interruptor t="Las marcas de la Liga en el apodo" on={c.nick} ocup={ocup} cambiar={(v) => cambiar('nick', v)}
              si="Activadas: el #N y la crew a quien no eligió" no="Apagadas: sólo el nombre a quien no eligió" /></Fila>
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

// ── 🎛️ LA CABINA (19/11/2026). Dlx: «remakea… el panel que tiene cada owner… porque es demasiado», eligió la B, «que sea
// viva no triste», «remakéalo más, mira el estilo con los últimos remakes» → «Como la llave» + «La cabina», y «me gusta,
// sólo agrega una barra lateral así como antes». Maqueta: https://claude.ai/artifact/2DMvUX7dBdmxcCv9kZHGrY (versión 5).
// - LA ESTRUCTURA DE LA LLAVE (6.73) Y EL RANKING (6.74): escena negra arriba (el nombre, la franja de cuatro medidores con
//   su porqué, «En el aire» = la pieza blanca, la consola y la cola del bot) y el papel abajo con pestañas.
// - LA BARRA LATERAL DE LA B: el emblema, Hoy + las cinco pestañas, y la tarjeta del tier fija abajo (corta mientras se ve la
//   cabina, completa al bajar al papel). Debajo de 1200 px se vuelve una barra de arriba.
// - NADA SE SACÓ: las 17 secciones de antes viven en las pestañas, con las mismas piezas (Preguntas, LlavesStaff, LigasStaff…).
// - LO QUE PIDE CADA TIER SALE DEL CICLO (`pide`, `subir`, `seguir` del panel; `SEGUIR` y `SUBE` de bot/tiers.py): acá no se
//   escribe ninguna regla. Sin eso todavía (el ciclo de antes), «En el aire» dice que se mide en la próxima corrida.
// - CONTESTAR ES DEFINITIVO (vale la primera respuesta): la cola pide un segundo toque (`DosToques`) en vez de dejar deshacer.
// - SE ANIMA SÓLO AL ABRIR: a los 1,6 s la cabina pasa a `quieto` y lo que se monta después (otra pestaña) ya no se mueve.
const AREAS_CZ = [['cola', 'Para contestar'], ['setlist', 'El setlist'], ['gente', 'Tu gente'], ['servidor', 'Tu servidor'], ['ajustes', 'Ajustes']];
const SVG_CZ = (d) => <svg aria-hidden="true" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">{d}</svg>;
const ICO_CZ = {
  hoy: SVG_CZ(<path d="M2.5 8.5 9 3l6.5 5.5V15h-13z" />),
  cola: SVG_CZ(<path d="M2.5 3.5h13v9h-7l-4 3v-3h-2z" />),
  setlist: SVG_CZ(<><rect x="2.5" y="3.5" width="13" height="12" /><path d="M2.5 7.5h13M6 1.5v3M12 1.5v3" /></>),
  gente: SVG_CZ(<><circle cx="7" cy="6" r="2.8" /><path d="M2 15.5c.6-2.7 2.5-4 5-4s4.4 1.3 5 4M12.5 3.6a2.6 2.6 0 0 1 0 4.8M14 11.6c1.1.6 1.8 1.8 2.1 3.9" /></>),
  servidor: SVG_CZ(<><rect x="2.5" y="2.5" width="13" height="13" /><path d="M2.5 6.5h13M5.5 10h7M5.5 12.8h4.5" /></>),
  ajustes: SVG_CZ(<><circle cx="9" cy="9" r="2.4" /><path d="M9 1.5v2.5M9 14v2.5M1.5 9H4M14 9h2.5M3.7 3.7l1.8 1.8M12.5 12.5l1.8 1.8M3.7 14.3l1.8-1.8M12.5 5.5l1.8-1.8" /></>),
};
const LO_ALTO = '«Unirme a los Tier 1», el escalón de arriba de la Liga';
// el color del servidor (del lobby, nunca escrito en el CSS), aclarado hasta que se vea sobre el negro: FFA es #26045B
const visibleCz = (hex) => {
  const a = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '#29B298';
  const n = parseInt(a.slice(1), 16);
  let c = [n >> 16 & 255, n >> 8 & 255, n & 255];
  const L = (q) => q.reduce((s, v, i) => { const x = v / 255; return s + [0.2126, 0.7152, 0.0722][i] * (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); }, 0);
  for (let i = 0; i < 12 && (L(c) + 0.05) / (L([3, 3, 4]) + 0.05) < 3.4; i++) c = c.map((v) => Math.round(v + (255 - v) * 0.14));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
};
// 📏 las 8 semanas de los requisitos: del ciclo (`m8`); si todavía no vino, de las semanas del panel (mismas cuentas)
const ochoSemanas = (x) => {
  const p = x.panel || {}, s8 = (p.semanas || []).slice(-8);
  const ev = x.m8 ? x.m8.eventos : s8.reduce((a, s) => a + (s[1] || 0), 0);
  const part = s8.reduce((a, s) => a + (s[2] || 0), 0);
  const pe = x.m8 ? x.m8.por_evento : (ev ? part / ev : 0);
  const nue = s8.reduce((a, s) => a + (s[3] || 0), 0);
  // el promedio de la Liga, pesado por cuántos eventos tiene cada día (`liga`: [eventos por semana, raperos por evento])
  const lg = p.liga || [], lev = lg.reduce((a, d) => a + (d[0] || 0), 0);
  return { ev, pe, nue, lpe: lev ? lg.reduce((a, d) => a + (d[0] || 0) * (d[1] || 0), 0) / lev : 0 };
};
function Vu({ n }) {
  return <span className="cz-vu" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < n ? 'on' : ''} style={{ '--b': i }} />)}</span>;
}
function Bloques({ n, de, falta }) {
  return <span className="cz-xp" aria-hidden="true">{Array.from({ length: de }, (_, i) => <i key={i} className={i < n ? 'on' : falta ? 'mag' : ''} style={{ '--b': i }} />)}</span>;
}

// ── la cola: la próxima pregunta del bot, contestada ahí (con dos toques: es definitivo) ──
function Cola({ liga, sv, preg, setPreg, puede, verTodas }) {
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const q = puede ? preg[0] : null;
  const elegir = (i, nombre) => {
    setOcup(true); setMsg('');
    contestarFinal(sv, q.k, i < 0 ? 'z' : LETRAS[i]).then((j) => {
      setOcup(false);
      if (j && j.ok) { setPreg(j.preguntas || []); setMsg('Listo: ' + (j.ya || nombre) + '. Entra al ranking en la próxima media hora.'); }
      else if (j && j.error === 'ya no está') { setPreg(preg.filter((y) => y.k !== q.k)); setMsg('Esa ya la había marcado alguien.'); }
      else setMsg('No se pudo: ' + ((j && j.error) || 'la red') + '.');
    });
  };
  return (
    <section className="cz-caja cz-cola">
      <h3 className="cz-h">En cola <small>{q ? (preg.length > 1 ? 'la próxima de ' + preg.length : 'la única') : 'nada en cola'}</small></h3>
      {q ? (
        <div className="cz-cola-in">
          <div className={'cz-vs' + (q.lados.length === 2 ? '' : ' muchos')}>{q.lados.map((l, i) => (
            <Fragment key={i}>
              {i ? <i className="cz-vs-x">VS</i> : null}
              <DosToques className="cz-vs-l" disabled={ocup} confirmar={<><b>¿Ganó {limpio(l)}?</b><small>Toca de nuevo para confirmar</small></>} onClick={() => elegir(i, l)}>
                <Cara liga={liga} k={claveDe(l)} nombre={l} cls="cara cz-cara" /><b>{limpio(l)}</b>
              </DosToques>
            </Fragment>
          ))}</div>
          <div className="cz-cola-pie">
            <p>¿Quién ganó? <b>{RONDA(q.ronda)} de {q.evento}</b>, {q.fecha}. Toca al ganador.
              {q.link ? <> <a href={q.link} target="_blank" rel="noopener noreferrer">Ver la llave</a></> : null}</p>
            {q.nadie ? <DosToques className="btn borde chico cz-borde" disabled={ocup} confirmar="Toca de nuevo: nadie siguió" onClick={() => elegir(-1, 'Nadie siguió')}>Nadie siguió</DosToques> : null}
            {preg.length > 1 ? <div className="cz-pie"><span>Quedan <b>{preg.length - 1}</b> más en «Para contestar».</span><button type="button" className="btn borde chico cz-borde" onClick={verTodas}>Ver todas</button></div> : null}
            {msg ? <p className="cz-msg" role="status">{msg}</p> : null}
          </div>
        </div>
      ) : <p className="cz-vacia">{msg || (puede ? 'El bot leyó todas tus llaves: no hay nada que contestar.' : 'Las preguntas del bot las contestan el dueño y los moderadores.')}</p>}
    </section>
  );
}

// ── la consola: el fader de tu tier y uno por cada parte del puntaje, tan alto como lo que sumó de su tope ──
function Consola({ x, logo, s }) {
  const t = x.tier, alto = (n) => 10 + (3 - n) * 40;
  return (
    <section className="cz-caja cz-consola-caja">
      <h3 className="cz-h">La consola <small>tu tier y tu puntaje</small></h3>
      <div className="cz-consola">
        <div className="cz-ch maestro"><span className="cz-val">Tier {t}</span>
          <span className="cz-riel">{[1, 2, 3].map((n) => <span key={n} className={'cz-muesca' + (n === t ? ' aca' : '')} style={{ bottom: alto(n) + '%' }}><span>{n}</span></span>)}
            <span className="cz-perilla tier" style={{ bottom: alto(t) + '%', '--b': 0 }}>{logo ? <img alt="" src={logo} /> : null}</span></span>
          <span className="cz-nom">Tu tier</span></div>
        {PARTES.map(([k, tt, tope], j) => {
          const v = (x.partes || {})[k] || 0, h = Math.max(0, Math.min(100, Math.round((100 * v) / tope)));
          return (
            <div key={k} className={'cz-ch' + (v >= tope ? ' tope' : '')} title={tt + ': ' + v + ' de ' + tope}>
              <span className="cz-val">{v}<small>/{tope}</small></span>
              <span className="cz-riel"><span className="cz-ll" style={{ height: h + '%', '--b': j + 1 }} /><span className="cz-perilla" style={{ bottom: h + '%', '--b': j + 1 }} /></span>
              <span className="cz-nom">{tt}</span>
            </div>
          );
        })}
      </div>
      {s && s.a ? (
        <div className="cz-subir"><span>Para llegar a Tier {s.a}</span>
          {s.pide.map(([tt, d, si]) => <div key={tt} className={'cz-r' + (si ? ' ok' : '')}><span>{tt}</span><em>{d.replace(/^llevas /, '')}</em></div>)}
          <p className={s.pide.every((y) => y[2]) ? 'llega' : ''}>{s.pide.every((y) => y[2]) ? 'Ya cumples todo: la Liga decide el cambio.' : 'Cuando cumplas todo, la Liga decide el cambio.'}{s.despues ? ' ' + s.despues + '.' : ''}</p>
        </div>
      ) : <div className="cz-subir"><span>Tier 1: lo más alto</span><p>{LO_ALTO}.</p></div>}
      <p className="cz-nota-esc">Los cuatro canales suman tu puntaje, con las últimas 4 semanas.{s && s.rec ? ' ' + s.rec[0] + ' (' + s.rec[1] + '): no es un requisito.' : ''}</p>
    </section>
  );
}

// ── un servidor, entero: la cabina con su barra ──
function Servidor({ liga, x, svs, onSel, t, permisos }) {
  const p = x.panel || {};
  const m = x.m || {};
  const cv = visibleCz(((liga.svs || {})[x.sv] || {}).color);
  const logo = liga.logo ? liga.logo(x.sv, true) : '';
  const p_ = (que) => puede(x.rol, que, permisos);
  const dueno = x.rol === 'dueno' || x.rol === 'dlx';
  const [preg, setPreg] = useState(x.preguntas || []);
  const [tab, setTab] = useState(() => ((x.preguntas || []).length && puede(x.rol, 'final', permisos) ? 'cola' : 'setlist'));
  const [nav, setNav] = useState('hoy');
  const [quieto, setQuieto] = useState(false);
  useEffect(() => { const k = setTimeout(() => setQuieto(true), 1600); return () => clearTimeout(k); }, []);
  const raiz = useRef(null);
  const o = ochoSemanas(x);
  const v = p.vuelven || {}, L = v.liga || {};
  const vv = pc(v.v || 0, v.n || 0), vl = pc(L.v || 0, L.n || 0);
  const seg = p.seguir || {};
  const filas = p.pide || null;
  // ⏳ una fila con su cuarto lugar (desde cuándo cuenta) va, pero todavía no falta (el estilo del Tier 2, 7.27)
  const faltan = (filas || []).filter((r) => !r[2] && !r[3]);
  const s = p.subir;
  const llega = s && s.a && s.pide.every((y) => y[2]);
  // 🐣 EN SU PRIMER TRAMO (`mide_desde` de bot/tiers.py): todavía no tuvo sus 4 u 8 semanas, así que no es «Te falta» sino
  // desde cuándo cuenta. CHZ entró el 19/11/2026 y al otro día su cabina le decía «Te falta 1» con cero eventos
  const tramo = faltan.length && p.mide_desde ? fechaCorta(p.mide_desde) : '';
  const corto = !filas ? 'Se mide' : tramo ? 'Recién llegas' : faltan.length ? 'Te falta ' + faltan.length : 'Al día';
  const frase = !filas ? 'Lo que te pide tu tier se mide en la próxima corrida (cada media hora).'
    : tramo ? 'se mide desde el ' + tramo + '. Por ahora, ' + faltan.map((r) => r[0] + ' (' + r[1] + ')').join('; ') + '.'
    : faltan.length ? faltan.map((r) => r[0] + ' (' + r[1] + ')').join('; ') + '.'
      : 'Cumples lo que te pide tu Tier ' + x.tier + (llega ? ', y ya llegas a lo de Tier ' + s.a + ': la Liga decide el cambio.' : ' este mes.');
  const claves = Object.keys(seg).filter((k) => k !== 'vivo');
  const bloq = (r, i) => {
    const k = claves[i];
    if (seg.vivo) return [r[2] ? 1 : 0, 1];
    if (k === 'eventos') return [Math.min(o.ev, seg.eventos), seg.eventos];
    if (k === 'por_evento') return [Math.min(Math.floor(o.pe), seg.por_evento), seg.por_evento];
    // 🎭 los eventos de estilo: el número sale de su fila («llevas N»)
    if (k === 'estilos') return [Math.min(parseInt((/\d+/.exec(r[1]) || ['0'])[0], 10), seg.estilos), seg.estilos];
    return [r[2] ? 1 : 0, 1];
  };
  const dif = (x.puntos || 0) - (x.antes || 0);
  const pideEv = seg.eventos || (s && s.a === 2 ? 8 : 0);
  const hay = new Set([v.n != null && 'sp-vuelven', (p.dias || []).length && 'sp-cuando', (p.semanas || []).some((w) => w[2]) && 'sp-semanas', (p.raperos || []).length && 'sp-gente'].filter(Boolean));
  const sugs = p.sugerencias || [], irs = p.sug_ir || [];
  const pasados = ((liga.d && liga.d.calendario) || []).filter((c) => c.sv === x.sv && Date.parse(c.t) < Date.now()).slice(-6).reverse();
  // ⭐ la nota de cada evento: `[evento, cuántos, promedio]` (`notasSv()` de bot/avisos.js)
  const notaDe = (ll) => (ll ? (x.notas || []).find((y) => String(y[0]) === String(ll)) : null);
  const ROL_TXT = { admin: 'admin', moderador: 'moderador', asistente: 'asistente' };
  const ir = (k) => {
    if (k === 'hoy') { setNav('hoy'); if (raiz.current) raiz.current.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    setTab(k); setNav('papel');
    requestAnimationFrame(() => { const el = raiz.current && raiz.current.querySelector('#cz-papel'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
  };
  const AREAS = AREAS_CZ.filter(([k]) => k !== 'ajustes' || p_('ajustes') || dueno);
  const actual = nav === 'hoy' ? 'hoy' : tab;
  const hechos = (filas || []).length - faltan.length;
  const emb = <div className="cz-emb"><span className="cz-logo">{logo ? <img alt="" src={logo} /> : <b>{siglaDe(x.sv)}</b>}</span><span><b>{limpio(x.nombre || siglaDe(x.sv))}</b><small>{m.miembros ? num(m.miembros) + ' miembros' : siglaDe(x.sv)}</small></span></div>;
  return (
    <div ref={raiz} className={'cz' + (quieto ? ' quieto' : '')} style={{ '--cv': cv }}>
      <div className="cz-top-cel">{emb}</div>
      <div className="cz-cuerpo">
        <div className="cz-lado-col"><aside className="cz-lado">
          {emb}
          {svs.length > 1 ? <Elegir liga={liga} svs={svs} sel={x.sv} onSel={onSel} /> : null}
          <nav aria-label="Tu panel">{[['hoy', 'Hoy'], ...AREAS].map(([k, tt]) => (
            <button type="button" key={k} aria-current={actual === k ? 'page' : undefined} onClick={() => ir(k)}>{ICO_CZ[k]}{tt}
              {k === 'cola' && preg.length && p_('final') ? <span className="cz-cuenta">{preg.length}</span> : null}</button>
          ))}</nav>
          {actual === 'hoy'
            ? <div className="cz-tier corta"><span className="t"><b>Tier {x.tier}</b><span>{corto}</span></span>{filas ? <Bloques n={hechos} de={filas.length} falta={!tramo} /> : null}</div>
            : <button type="button" className="cz-tier" onClick={() => ir('hoy')}><span className="t"><b>Tier {x.tier}</b><span>{corto}</span></span>{filas ? <Bloques n={hechos} de={filas.length} falta={!tramo} /> : null}<p>{frase.charAt(0).toUpperCase() + frase.slice(1)}</p><u>Ver en la cabina</u></button>}
        </aside></div>
        <div className="cz-principal">
          {svs.length > 1 ? <div className="cz-elegir-cel"><Elegir liga={liga} svs={svs} sel={x.sv} onSel={onSel} /></div> : null}
          <section className="cz-esc">
            <i className="cz-deco d1" /><i className="cz-deco d2" />
            <div className="cz-cab">
              <div>
                <span className="tag">Tu panel</span>
                <h1 className="cz-h1">{limpio(x.nombre || siglaDe(x.sv))}</h1>
                <p className="cz-d">Tu cabina: <b>lo que te pide tu tier</b>, lo que el bot necesita de ti y cómo suena tu servidor.</p>
                {/* 🆕 lo nuevo que prueban primero los Tier 1 (20/11/2026, `lo_nuevo_t1` del Dashboard) */}
                {(x.lo_nuevo || []).map((y) => <p key={y.texto} className="cz-nuevo"><b>Lo nuevo, primero para ti</b><span>{y.texto}</span></p>)}
                <div className="cz-meta">
                  {m.miembros ? <span>{num(m.miembros)} miembros en su Discord</span> : null}
                  {/* 🏟️ cuántos lo siguen en la página (20/11/2026): la campana les avisa de cada evento que anuncia */}
                  {x.seguidores ? <span>{num(x.seguidores)} {x.seguidores === 1 ? 'lo sigue' : 'lo siguen'} en la página</span> : null}
                  {t ? <span>Medido el {W.fmtFecha ? W.fmtFecha(t, { day: 'numeric', month: 'numeric' }) : fechaCorta(String(t).slice(0, 10))}{W.fmtHora ? ' a las ' + W.fmtHora(new Date(t)) : ''}: se actualiza cada media hora</span> : null}
                  {ROL_TXT[x.rol] ? <span>Entraste como {ROL_TXT[x.rol]}: te sumó el dueño del servidor</span> : null}
                </div>
                <div className="cz-acc">
                  <button type="button" className="btn verde" onClick={() => ir('setlist')}>＋ Anunciar un evento</button>
                  <a className="btn borde chico cz-borde" href={'#/sv/' + encodeURIComponent(siglaDe(x.sv))}>Su página</a>
                </div>
              </div>
              <span className="cz-stk">Tier {x.tier}</span>
            </div>
            <dl className="cz-franja">
              <div className="cz-kpi"><dt>Tu puntaje</dt><dd className="cz-v"><Contador v={x.puntos || 0} /><em>de 100</em></dd><Vu n={Math.round((x.puntos || 0) / 10)} />
                <dd className="cz-c">{x.compara === false ? <>Se compara desde el {fechaCorta(x.compara_desde)}</> : <><b>{dif > 0 ? '+' : ''}{dif < 0 ? '−' + -dif : dif}</b> contra las 4 semanas de antes</>}</dd></div>
              <div className="cz-kpi"><dt>Eventos en 8 semanas</dt><dd className="cz-v"><Contador v={o.ev} /></dd><Vu n={pideEv ? Math.min(10, Math.round((o.ev / (pideEv * 2)) * 10)) : 0} />
                <dd className="cz-c">{pideEv ? <>{seg.eventos ? 'Tu tier pide' : 'Tier 2 pide'} <b>{pideEv}</b>; la luz se llena con el doble</> : 'En las últimas 8 semanas'}</dd></div>
              <div className="cz-kpi"><dt>Raperos por evento</dt><dd className="cz-v">{coma(o.pe)}</dd><Vu n={o.lpe ? Math.min(10, Math.round((o.pe / (o.lpe * 2)) * 10)) : 0} />
                <dd className="cz-c">{o.lpe ? <>La Liga junta <b>{coma(o.lpe)}</b> de promedio</> : 'De promedio, en 8 semanas'}</dd></div>
              <div className="cz-kpi"><dt>Debutaron acá</dt><dd className="cz-v"><Contador v={o.nue} />{v.n >= MIN_VUELVEN ? <em>vuelve el {vv} %</em> : null}</dd><Vu n={v.n >= MIN_VUELVEN && vl ? Math.min(10, Math.round((vv / (vl * 2)) * 10)) : 0} />
                <dd className="cz-c">{v.n >= MIN_VUELVEN ? <>En la Liga vuelve el <b>{vl} %</b></> : 'Todavía pocos para medir si vuelven'}</dd></div>
            </dl>
            <div className="cz-grid">
              <section className={'cz-aire' + (filas && !faltan.length ? ' ok' : tramo ? ' tramo' : '')}>
                <div className="cz-aire-cab"><span className="cz-luz"><i />{filas && !faltan.length ? 'Al día' : tramo ? 'Tu primer tramo' : 'En el aire'}</span>
                  <div><small>Lo que te pide tu Tier {x.tier} este mes</small><b>{faltan.length ? corto + ': ' + frase : frase}</b></div></div>
                {filas ? <ul className="cz-req">{filas.map((r, i) => { const [n, de] = bloq(r, i); return (
                  <li key={r[0]} className={r[3] && !r[2] ? 'va' : ''}>{r[2] ? <span className="cz-sello">Hecho</span> : <span className="cz-falta">{tramo || r[3] ? 'Va' : 'Falta'}</span>}
                    <span className="cz-tx"><b>{r[0]}</b><small><Bloques n={n} de={de} falta={!r[2] && !tramo && !r[3]} />{r[1][0].toUpperCase() + r[1].slice(1)}{r[3] && !r[2] ? ' · cuenta desde el ' + fechaCorta(r[3]) : ''}</small></span></li>
                ); })}</ul> : null}
                <p className="cz-aire-pie">Los Pases (Tier 1) y los estilos de juego (Tier 2) se suman acá cuando estén listos.</p>
              </section>
              <Consola x={x} logo={logo} s={s} />
              <Cola liga={liga} sv={x.sv} preg={preg} setPreg={setPreg} puede={p_('final')} verTodas={() => ir('cola')} />
            </div>
          </section>
          <section className="cz-papel" id="cz-papel">
            <nav className="cz-pes" role="tablist">{AREAS.map(([k, tt]) => (
              <button type="button" role="tab" key={k} aria-selected={tab === k} onClick={() => { setTab(k); setNav('papel'); }}>{tt}
                {k === 'cola' && preg.length && p_('final') ? <span className="cz-cuenta">{preg.length}</span> : null}
                {k === 'gente' && p.gente_total ? <small>{num(p.gente_total)}</small> : null}</button>
            ))}</nav>
            {tab === 'cola' ? <>
              {preg.length && p_('final') ? <Sec id="sp-preg" titulo="Quién ganó" bajada="Batallas de tus llaves donde el bot no encontró quién ganó. Las puede marcar el dueño acá o el staff con los botones de Discord: vale la primera.">
                <Preguntas sv={x.sv} xs={preg} onCambio={setPreg} /></Sec> : null}
              <Sec id="sp-quien" titulo="Quién es quién" bajada="Los nombres de tus eventos que el bot no reconoce, y tus inscripciones. Contesta quién es cada uno y el ranking lo cuenta bien.">
                <QuienStaff sv={x.sv} rol={x.rol} permisos={permisos} /></Sec>
              <Sec id="sp-llaves" titulo="Tus llaves" bajada="Lo que reportó la gente de tus llaves y lo que sugirió tu equipo. Los moderadores, los admins y tú lo corrigen; los asistentes lo sugieren.">
                <LlavesStaff sv={x.sv} rol={x.rol} permisos={permisos} /></Sec>
            </> : null}
            {tab === 'setlist' ? <>
              <Sec id="sp-agenda" titulo="Tus eventos" bajada="Anuncia un evento acá y sale en Eventos y en la campana, aunque el bot no lea el anuncio de tu canal.">
                <AgendaStaff sv={x.sv} rol={x.rol} permisos={permisos} liga={liga} /></Sec>
              {x.tier === 1 || x.tier === 2 ? <Sec id="sp-estilo" titulo="Tus eventos de estilo" bajada={x.tier === 2 ? 'Tu tier pide 1 por mes: marca uno de tus próximos eventos con un estilo de juego y quien lo juegue lo desbloquea o lo sube.' : 'Si quieres, marca uno de tus próximos eventos con un estilo de juego: quien lo juegue lo desbloquea o lo sube.'}>
                <EstiloStaff sv={x.sv} rol={x.rol} permisos={permisos} liga={liga} /></Sec> : null}
              {pasados.length ? <Sec id="cz-pasados" titulo="Lo que ya tocaste" bajada="Tus últimos eventos y si el bot ya leyó su llave.">
                <ol className="cz-bols">{pasados.map((c) => (
                  <li key={c.t + c.n} className="cz-bol"><span className="cz-f"><b>{W.fmtFecha ? W.fmtFecha(c.t, { day: 'numeric' }) : String(c.t).slice(8, 10)}</b><span>{W.fmtFecha ? W.fmtFecha(c.t, { weekday: 'short' }).replace('.', '') : ''}</span></span>
                    <span className="cz-n"><b>{nombreEv ? nombreEv(c.n) : c.n}</b><span>{W.fmtHora ? W.fmtHora(new Date(c.t)) : ''}</span></span>
                    <span className="cz-d">{c.ll || c.jugado ? <span className="cz-chip si">Llave leída</span> : <span className="cz-chip no">Sin llave todavía</span>}
                      {/* ⭐ cómo lo calificaron los que jugaron (20/11/2026): el promedio, nunca quién */}
                      {notaDe(c.ll) ? <span className="cz-nota" title={notaDe(c.ll)[1] + (notaDe(c.ll)[1] === 1 ? ' calificó' : ' calificaron')}>★ {String(notaDe(c.ll)[2]).replace('.', ',')} · {notaDe(c.ll)[1]}</span> : null}</span></li>
                ))}</ol></Sec> : null}
              <Sec id="sp-ligas" titulo="Tus ligas" bajada="Corrige lo que el bot leyó de tus ligas —quién ganó, un invitado, una batalla que no cuenta—, carga lo que no leyó, suma o resta puntos sueltos y cierra la temporada con su campeón.">
                <LigasStaff sv={x.sv} rol={x.rol} permisos={permisos} /></Sec>
            </> : null}
            {tab === 'gente' ? <>
              {sugs.length ? <Sec id="sp-sug" titulo="Lo que conviene" bajada="Sale de tus números de las últimas semanas." extra="negra">
                <ol className="sp-sug">{sugs.map((s1, i) => (
                  <li key={s1}><span>{String(i + 1).padStart(2, '0')}</span><p>{resaltar(s1)}</p>
                    {IR[irs[i]] && hay.has(irs[i]) && irs.indexOf(irs[i]) === i ? <button type="button" className="sp-ir" onClick={(e) => irA(e, irs[i])}>{IR[irs[i]]}</button> : null}</li>
                ))}</ol></Sec> : null}
              {v.n != null ? <Sec id="sp-vuelven" titulo="¿Vuelve tu gente?" bajada={'De quienes jugaron su primer evento de la temporada en tu servidor' + (v.desde ? ', desde el ' + fechaCorta(v.desde) : '') + '. No cuenta a quien debutó hace menos de 14 días. Volver es otro evento, otro día, en cualquier servidor de la Liga.'}>
                <Vuelven v={v} /></Sec> : null}
              {(p.dias || []).length ? <Sec id="sp-cuando" titulo="Cuándo hay actividad" bajada="Cuánta gente juntan tus eventos cada día, y cuántos eventos tiene el resto de la Liga ese día: un día lleno compite por la misma gente.">
                <Cuando p={p} /></Sec> : null}
              {(p.semanas || []).some((w) => w[2]) ? <Sec id="sp-semanas" titulo="Semana a semana" bajada="Las participaciones de cada semana de la temporada, de lunes a domingo: cada rapero cuenta una vez por evento que juega. En verde agua, los que debutaban en la Liga en tu servidor.">
                <Semanas p={p} /></Sec> : null}
              {(p.raperos || []).length ? <Sec id="sp-gente" titulo="Su gente" bajada="Lo de cada uno en tu servidor, esta temporada."><SuGente p={p} /></Sec> : null}
              <Sec id="sp-visitas" titulo="Visitas a su página" bajada="Personas por día que abrieron la página de tu servidor, las últimas 4 semanas."><Visitas x={x} /></Sec>
            </> : null}
            {tab === 'servidor' ? <>
              {x.tier === 1 ? <Sec id="sp-pases" titulo="Tus Pases para regalar" bajada="Cada mes la Liga te da Pases premium para regalar: se los lleva el campeón de los eventos que se eligieron.">
                <PasesPanel x={x} liga={liga} /></Sec> : null}
              {x.tier === 1 || x.tier === 2 ? <Sec id="sp-consejo" titulo="El consejo de socios" bajada="Lo que la Liga propone y el voto de tu servidor: uno por servidor Tier 1 o 2, durante 7 días.">
                <ConsejoStaff sv={x.sv} rol={x.rol} permisos={permisos} /></Sec> : null}
              {p_('pagina') ? <Sec id="sp-pagina" titulo="Tu página" bajada="Lo que se ve arriba en la página de tu servidor: un texto, tus redes y un banner. Sale en la próxima media hora."><TuPagina sv={x.sv} /></Sec> : null}
              <Sec id="sp-muro" titulo="Tus publicaciones" bajada="Lo que sale de tu servidor en Publicaciones. Lo que ocultes sale del muro en la próxima media hora.">
                <MuroStaff sv={x.sv} rol={x.rol} permisos={permisos} /></Sec>
              {p_('ajustes') ? <Sec id="sp-vs" titulo="El fondo del VS" bajada="Detrás de cada VS de tu servidor en el chat. Elige uno de las escenas de la Liga.">
                <FondoVs sv={x.sv} rol={x.rol} permisos={permisos} /></Sec> : null}
            </> : null}
            {tab === 'ajustes' ? <>
              {/* ⚠️ «el aviso de cada evento» y «Eventos de Discord» NO están en /settings (bot/worker.js): son sólo de acá y del Dashboard */}
              {p_('ajustes') ? <Sec id="sp-ajustes" titulo="Los ajustes del bot" bajada="Los de /settings en tu Discord —lo último que cambies, acá o allá, es lo que vale— y los que sólo están acá: el aviso de cada evento, las batallas de tus ligas y los eventos de Discord.">
                <Ajustes sv={x.sv} tier={x.tier} /></Sec> : null}
              {/* 👥 TU EQUIPO (Dlx, 11/11/2026): sólo el dueño lo ve y lo maneja; cada uno entra con su propia cuenta y con su rol */}
              {dueno ? <Sec id="sp-equipo" titulo="Tu equipo" bajada="Los de tu servidor que pueden usar este panel, cada uno con su rol. Entran con su propia cuenta de Discord."><Equipo sv={x.sv} /></Sec> : null}
            </> : null}
          </section>
        </div>
      </div>
    </div>
  );
}

// 🏠 TU PÁGINA (Dlx, 11/11/2026: «Su página, a su gusto»): el texto (280, sin links), las redes (las seis que la página
// dibuja, cada una con su dominio) y un banner. El banner pasa por el filtro de los fondos: limpio se ve, dudoso espera a
// la Liga. Lo valida el objeto (`socioPagina()`), y cada cambio va al registro del Dashboard
const REDES_P = [['instagram', 'Instagram', 'https://instagram.com/…'], ['tiktok', 'TikTok', 'https://tiktok.com/@…'],
  ['youtube', 'YouTube', 'https://youtube.com/@…'], ['twitch', 'Twitch', 'https://twitch.tv/…'], ['x', 'X', 'https://x.com/…'], ['kick', 'Kick', 'https://kick.com/…']];
const PAG_ERR = { desc: 'El texto va sin links y hasta 280 letras: los links van en tus redes.', redes: 'Revisa los links: cada uno tiene que ser de su red (https://…).',
  filtro: 'Esa imagen no pasa el filtro de la Liga.', metadatos: 'Esa imagen trae datos escondidos: prueba con otra.', tope: 'Llegaste al tope de cambios de hoy.',
  'no es una imagen': 'Eso no es una imagen.', 'demasiado grande': 'La imagen quedó muy pesada.', no: 'Este servidor no es tuyo.' };
function TuPagina({ sv }) {
  const [j, setJ] = useState(null);
  const [desc, setDesc] = useState('');
  const [redes, setRedes] = useState({});
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const cargar = (r) => {
    setJ(r || { error: 'red' });
    if (r && r.ok) { setDesc(r.desc || ''); setRedes(Object.fromEntries((r.redes || []).map(([k, u]) => [k, u]))); }
  };
  useEffect(() => {
    let vivo = true;
    setJ(null); setMsg('');
    pedirPagina(sv).then((r) => { if (vivo) cargar(r); });
    return () => { vivo = false; };
  }, [sv]);
  // 🖼️ `todo` (18/11/2026): subir o sacar el banner contesta con el texto y las redes GUARDADOS, y `cargar()` pisaba lo
  // que se estaba escribiendo sin guardar. Para el banner sólo se toma `j` (banner y pend)
  const mandar = (cambio, listo, todo = true) => {
    setOcup(true); setMsg('');
    pedirPagina(sv, cambio).then((r) => {
      setOcup(false);
      if (r && r.ok) { if (todo) cargar(r); else setJ(r); setMsg(r.filtro === 'revisar' ? 'El banner quedó para que lo mire la Liga: te avisamos cuando se vea.' : listo); }
      else setMsg(PAG_ERR[r && r.error] || 'No se pudo guardar: prueba de nuevo en un rato.');
    });
  };
  const subir = async (e) => {
    const a = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!a) return;
    // 🔎 2400×900 (antes 1600×600): va a lo ancho de la página como el fondo de perfil (Dlx, 12/11/2026: «que todo esté
    // siempre en HD»); el tope del Worker (600 KB) no cambia y `achicar()` baja el tamaño si no entra
    try { const b = await achicar(a, 2400, 900, 550 * 1024); mandar({ img: await aBase64(b) }, 'Listo: tu banner sale en la página en la próxima media hora.', false); }
    catch (er) { setMsg('No pude usar esa imagen: ' + er.message); }
  };
  if (!j) return <p className="pronto-p">Buscando tu página…</p>;
  if (!j.ok) return <p className="pronto-p">{PAG_ERR[j.error] || 'No pude traer tu página. Prueba de nuevo en un rato.'}</p>;
  return (
    <div className="sp-pag">
      <label className="sp-eq-q"><span>El texto de tu servidor <small>{desc.length} de 280</small></span>
        <textarea value={desc} maxLength={280} rows={3} placeholder="Qué es tu servidor, qué eventos hace, cuándo." onChange={(e) => setDesc(e.target.value)} /></label>
      <div className="sp-pag-redes">{REDES_P.map(([k, n, ej]) => (
        <label key={k} className="sp-eq-q"><span>{n}</span>
          <input type="url" value={redes[k] || ''} maxLength={120} placeholder={ej} onChange={(e) => setRedes({ ...redes, [k]: e.target.value })} /></label>
      ))}</div>
      <button type="button" className="btn verde" disabled={ocup} onClick={() => mandar({ desc, redes }, 'Guardado: sale en tu página en la próxima media hora.')}>Guardar el texto y las redes</button>
      <h3 className="sp-h">El banner <small>1600 × 600, se recorta al centro</small></h3>
      {j.banner ? <img className="sp-pag-ban" alt="El banner de tu página" src={j.banner} /> : null}
      {j.pend ? <p className="sp-vacio">Hay uno nuevo esperando que lo mire la Liga.</p> : null}
      <div className="sp-pag-acc">
        <label className="btn borde2"><input type="file" accept="image/*" hidden disabled={ocup} onChange={subir} />{j.banner || j.pend ? 'Cambiar el banner' : 'Subir un banner'}</label>
        {j.banner || j.pend ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo: se saca el banner"
          onClick={() => mandar({ quitar_banner: true }, 'Listo: tu página vuelve a su fondo de siempre.', false)}>Sacar el banner</DosToques> : null}
      </div>
      {msg ? <p className="sp-preg-msg" role="status">{msg}</p> : null}
    </div>
  );
}

// 👥 TU EQUIPO (Dlx, 11/11/2026: «que ellos agreguen a sus administradores por su propia cuenta», y a cómo: «las dos»):
// arriba los que ya están, abajo los que tienen permiso de admin en su Discord (sugeridos: el dueño confirma uno por uno)
// y un buscador para sumar a alguien sin ese permiso. Lo valida el objeto (`socioEquipo()`), y cada cambio va al registro
// que ve sólo el Dashboard
function Equipo({ sv }) {
  const [j, setJ] = useState(null);
  const [ocup, setOcup] = useState('');
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const [hall, setHall] = useState(null);
  useEffect(() => {
    let vivo = true;
    setJ(null); setMsg(''); setQ(''); setHall(null);
    pedirEquipo(sv, 'ver').then((r) => { if (vivo) setJ(r || { error: 'red' }); });
    return () => { vivo = false; };
  }, [sv]);
  // 🔎 el buscador espera a que dejes de escribir: cada letra no es un pedido a Discord
  useEffect(() => {
    if (q.trim().length < 2) { setHall(null); return undefined; }
    let vivo = true;
    const t = setTimeout(() => pedirEquipo(sv, 'buscar', { q: q.trim() }).then((r) => { if (vivo) setHall(r && r.ok ? r.hallados || [] : []); }), 400);
    return () => { vivo = false; clearTimeout(t); };
  }, [q, sv]);
  const hacer = (accion, p) => {
    setOcup(p.id); setMsg('');
    pedirEquipo(sv, accion, accion === 'rol' ? { id: p.id, rol: p.rol } : { id: p.id }).then((r) => {
      setOcup('');
      if (r && r.ok) {
        setJ(r);
        setMsg(accion === 'rol' ? limpio(p.n) + ' ahora es ' + ((ROLES_EQ.find((x) => x[0] === p.rol) || [])[1] || p.rol).toLowerCase() + '.'
          : accion === 'sumar' ? p.n + ' ya puede entrar a este panel con su cuenta de Discord.' : p.n + ' ya no entra a este panel.');
        if (accion === 'sumar') { setQ(''); setHall(null); }
      } else setMsg(AJ_ERR[r && r.error] || 'No se pudo: prueba de nuevo en un rato.');
    });
  };
  if (!j) return <p className="pronto-p">Buscando tu equipo…</p>;
  if (!j.ok) return <p className="pronto-p">{AJ_ERR[j.error] || 'No pude traer tu equipo. Prueba de nuevo en un rato.'}</p>;
  const eq = j.equipo || [], sug = j.sugeridos, tengo = new Set(eq.map((a) => a.id));
  const fila = (p, boton) => (
    <li key={p.id}><span><b>{limpio(p.n) || p.id}</b>{p.u && p.u !== p.n ? <small>@{p.u}</small> : null}</span>{boton}</li>
  );
  return (
    <div className="sp-eq">
      <h3 className="sp-h">En tu equipo <small>{eq.length} de 10</small></h3>
      {eq.length ? <ul className="sp-eq-l">{eq.map((p) => fila(p,
        <span className="sp-eq-acc">
          {/* 🛡️ su rol (16/11/2026): qué abre cada uno lo decide el Worker (`SOCIO_PERMISOS`) */}
          <select value={p.rol || 'admin'} disabled={!!ocup} aria-label={'Rol de ' + (limpio(p.n) || 'esta persona')}
            onChange={(e) => hacer('rol', Object.assign({}, p, { rol: e.target.value }))}>
            {ROLES_EQ.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
          <DosToques className="btn borde2 chico" disabled={!!ocup} confirmar={'Toca de nuevo: ' + (limpio(p.n) || 'esta persona') + ' ya no entra'}
            onClick={() => hacer('sacar', p)}>Sacar</DosToques>
        </span>))}</ul>
        : <p className="sp-vacio">Todavía no sumaste a nadie: el panel lo ves sólo tú.</p>}
      <ul className="sp-roles">{ROLES_EQ.map(([k, t, d]) => <li key={k}><b>{t}</b> {d}.</li>)}</ul>
      <h3 className="sp-h">Con permiso de admin en tu Discord <small>tienen Administrador o Gestionar servidor</small></h3>
      {sug === null ? <p className="sp-vacio">Discord no me dijo quiénes son ahora: búscalos abajo por su nombre.</p>
        : sug && sug.length ? <ul className="sp-eq-l">{sug.map((p) => fila(p,
          <button type="button" className="btn verde chico" disabled={!!ocup || eq.length >= 10} onClick={() => hacer('sumar', p)}>Sumar</button>))}</ul>
          : <p className="sp-vacio">Nadie más tiene ese permiso en tu servidor.</p>}
      <label className="sp-eq-q"><span>Sumar a otra persona de tu servidor</span>
        <input type="search" value={q} maxLength={32} placeholder="Su nombre en tu Discord" onChange={(e) => setQ(e.target.value)} /></label>
      {hall ? (hall.length ? <ul className="sp-eq-l">{hall.filter((p) => !tengo.has(p.id)).map((p) => fila(p,
        <button type="button" className="btn verde chico" disabled={!!ocup || eq.length >= 10} onClick={() => hacer('sumar', p)}>Sumar</button>))}</ul>
        : <p className="sp-vacio">No encontré a nadie con ese nombre en tu servidor.</p>) : null}
      {msg ? <p className="sp-preg-msg" role="status">{msg}</p> : null}
    </div>
  );
}

// 🏁 PARA CONTESTAR (Dlx, 11/11/2026: «Chat de staff, Panel del socio»): las batallas que el bot no entendió en las llaves
// de este servidor y nadie marcó en Discord. Las deja el ciclo (`bot/finales.py`, `publicar()`); se contesta como el botón
// de Discord y vale la primera respuesta, venga de donde venga. A las 48 h lo que falte lo cierra la Liga
const LETRAS = 'abcdefghijklmnopqrstuvwxy';
const RONDA = (r) => { const x = String(r || '').toLowerCase(); return x ? x[0].toUpperCase() + x.slice(1) : ''; };
function Preguntas({ sv, xs, onCambio }) {
  const [lista, setLista] = useState(xs);
  const [ocup, setOcup] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { setLista(xs); }, [xs]);
  // 🎛️ la cola de la cabina (arriba) y esta lista dicen lo mismo: lo que se contesta acá le llega allá (`onCambio`)
  const poner = (ys) => { setLista(ys); if (onCambio) onCambio(ys); };
  const elegir = (x, v, nombre) => {
    setOcup(x.k); setMsg('');
    contestarFinal(sv, x.k, v).then((j) => {
      setOcup('');
      if (j && j.ok) { poner(j.preguntas || []); setMsg('Listo: ' + (j.ya || nombre) + '. Entra al ranking en la próxima media hora.'); }
      else if (j && j.error === 'ya no está') { poner(lista.filter((y) => y.k !== x.k)); setMsg('Esa ya la había marcado alguien.'); }
      else setMsg('No se pudo: ' + ((j && j.error) || 'la red') + '.');
    });
  };
  const vence = (t) => (t && W.fmtFecha ? W.fmtFecha(t, { weekday: 'long', day: 'numeric', month: 'numeric' }) + (W.fmtHora ? ' a las ' + W.fmtHora(new Date(t)) : '') : '');
  if (!lista.length) return msg ? <p className="sp-preg-msg" role="status">{msg}</p> : null;
  return (
    <>
      <ol className="sp-preg">{lista.map((x) => (
        <li key={x.k}>
          <p className="sp-preg-cual"><b>{RONDA(x.ronda)}</b> · {x.evento} · {x.fecha}
            {x.link ? <> · <a href={x.link} target="_blank" rel="noopener noreferrer">ver la llave</a></> : null}</p>
          <p className="sp-preg-q">¿Quién ganó?</p>
          <div className="sp-preg-opc">
            {x.lados.map((l, i) => <button key={i} type="button" className="btn borde" disabled={!!ocup} onClick={() => elegir(x, LETRAS[i], l)}>{limpio(l)}</button>)}
            {x.nadie ? <button type="button" className="btn borde sp-preg-nadie" disabled={!!ocup} onClick={() => elegir(x, 'z', 'Nadie siguió')}>Nadie siguió</button> : null}
          </div>
          {x.vence ? <p className="sp-preg-vence">Si nadie lo marca antes del {vence(x.vence)}, {x.nadie ? 'cuenta como «Nadie siguió»: cobran la ronda y no hay duelo' : 'lo decide la Liga'}.</p> : null}
        </li>
      ))}</ol>
      <p className="sp-preg-ayuda">«Nadie siguió» es para cuando alguien no se presentó o lo reemplazaron. Si a la llave le falta la mitad o más, no cuenta para el ranking.</p>
      {msg ? <p className="sp-preg-msg" role="status">{msg}</p> : null}
    </>
  );
}

// 🛡️ EL STAFF DE CADA SERVIDOR (Dlx, 16/11/2026: «todo»): los roles del equipo, las llaves y las ligas. Qué puede cada rol
// lo decide el Worker (`SOCIO_PERMISOS`, `socioPuede()` de bot/avisos.js) y llega con `pedirRoles()`: acá no hay copia
const ROLES_EQ = [['admin', 'Admin', 'todo menos el equipo'], ['moderador', 'Moderador', 'corrige tus llaves y tus ligas, y contesta quién ganó'],
  ['asistente', 'Asistente', 'sugiere correcciones, que aprueba un moderador, un admin o tú']];
const ERR_STAFF = { no: 'Este servidor no es tuyo.', no_rol: 'Tu rol no puede hacer eso.', no_es_tuya: 'Eso no es de tu servidor.',
  tope: 'Llegaste al tope de cambios de hoy.', 'ya no está': 'Eso ya no está.', 'ya está aplicado': 'Eso ya se aplicó.',
  'falta quién ganó': 'Elige quién ganó.', 'faltan los dos': 'Escribe los dos nombres, distintos.', 'falta el día': 'Elige el día.',
  'falta el nombre': 'Escribe el nombre.', 'falta el campeón': 'Elige al campeón.', red: 'No hay conexión: prueba de nuevo en un rato.',
  // 🎭🏛️ los eventos de estilo y el consejo son de los Tier 1 y 2 (20/11/2026)
  tier: 'Esto es de los servidores Tier 1 y 2.', cerrada: 'La votación ya cerró.', no_esta: 'Esa propuesta ya no está.' };
const errStaff = (x) => ERR_STAFF[x && x.error] || 'No se pudo: ' + ((x && x.error) || 'la red') + '.';

// 🛠️ TUS LLAVES: lo que reportó la gente de tus llaves y lo que sugirió tu equipo. Corregir se hace en la llave misma
const QUE_LL = { ganador: 'El ganador está mal', gente: 'Falta o sobra alguien', nombre: 'Un nombre está mal', otro: 'Otra cosa',
  staff: 'Corrección de tu equipo', sugerencia: 'Sugerencia de tu equipo' };
const ESTADO_LL = { '': 'Sin revisar', corregir: 'Corregido: entra al ranking en la próxima media hora', aplicado: 'Aplicado',
  listo: 'Cerrado', prueba: 'Cerrado', no_pude: 'No se pudo aplicar: lo mira la Liga' };
const fixTxt = (f) => (!f ? '' : f.tipo === 'ganador' ? 'ganó ' + limpio(f.ganador) + ' (' + RONDA(f.ronda) + ')'
  : f.tipo === 'no_cuenta' ? 'la llave no cuenta' : '«' + limpio(f.nombre) + '» es ' + limpio(f.es || f.nuevo || 'quien lo reportó'));
function LlavesStaff({ sv, rol, permisos }) {
  const [j, setJ] = useState(null);
  const [ocup, setOcup] = useState(0);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let vivo = true;
    setJ(null); setMsg('');
    pedirLlave(sv, 'ver').then((r) => { if (vivo) setJ(r || { error: 'red' }); });
    return () => { vivo = false; };
  }, [sv]);
  const corrige = puede(rol, 'llaves', permisos);
  const hacer = (r, accion, extra, listo) => {
    setOcup(r.id); setMsg('');
    pedirLlave(sv, accion, Object.assign({ id: r.id }, extra || {})).then((x) => {
      setOcup(0);
      if (x && x.ok) { setJ(x); setMsg(listo); } else setMsg(errStaff(x));
    });
  };
  if (!j) return <p className="pronto-p">Buscando los reportes de tus llaves…</p>;
  if (!j.ok) return <p className="pronto-p">{errStaff(j)}</p>;
  const xs = j.reportes || [];
  return (
    <div className="sp-ll">
      <p className="sp-ll-ayuda">{corrige
        ? 'Para corregir una llave, ábrela: como eres del staff de tu servidor, abajo tienes «Corregir». Lo que corriges entra al ranking en la próxima media hora, y la Liga se entera.'
        : 'Para sugerir una corrección, abre la llave: abajo tienes «Sugerir». La aprueba un moderador, un admin o el dueño.'}</p>
      {xs.length ? <ol className="sp-ll-l">{xs.map((r) => (
        <li key={r.id}>
          <p className="sp-ll-cual"><a href={'#/llave/' + r.llave}>Llave #{r.llave}</a> · {QUE_LL[r.que] || QUE_LL.otro}
            {r.de ? <> · de <a href={'#/r/' + encodeURIComponent(r.de)}>{r.de}</a></> : null}</p>
          {r.texto && r.que !== 'staff' && r.que !== 'sugerencia' ? <p className="sp-ll-t">{r.texto}</p> : null}
          {r.sug ? <p className="sp-ll-t">Sugiere: <b>{fixTxt(r.sug)}</b></p> : null}
          {r.fix ? <p className="sp-ll-t">Corregido: <b>{fixTxt(r.fix)}</b>{r.por ? ' · ' + r.por : ''}</p> : null}
          <p className="sp-ll-est">{ESTADO_LL[r.estado] || r.estado}</p>
          {corrige && !r.estado ? (
            <div className="sp-ll-acc">
              {r.sug ? <button type="button" className="btn verde chico" disabled={!!ocup}
                onClick={() => hacer(r, 'corregir', { fix: Object.assign({}, r.sug, { accion: r.sug.tipo }) }, 'Listo: entra al ranking en la próxima media hora.')}>Aplicar lo sugerido</button> : null}
              <DosToques className="btn borde2 chico" disabled={!!ocup} confirmar="Toca de nuevo: se cierra sin cambiar nada"
                onClick={() => hacer(r, 'cerrar', {}, 'Cerrado sin cambios.')}>Cerrar sin cambios</DosToques>
            </div>
          ) : null}
        </li>
      ))}</ol> : <p className="sp-vacio">Nadie reportó nada de tus llaves en los últimos días.</p>}
      {msg ? <p className="sp-preg-msg" role="status">{msg}</p> : null}
    </div>
  );
}

// 🏟️ TUS LIGAS: corregir lo que el bot leyó (quién ganó, una que no cuenta), cargar una batalla que no leyó, un DF donde
// los DF suman, un nombre de tu liga y el campeón. La tabla no se edita: sale de las batallas. Lo aplica el ciclo
// 🚫 por qué no cuenta una batalla y 🧮 por qué se suman puntos sueltos (`POR_NO_CUENTA` y `POR_PUNTOS` de bot/avisos.js,
// 18/11/2026): los mismos que el Dashboard, cada uno de un caso que ya pasó
const POR_NC_STAFF = [['exhibicion', 'una exhibición'], ['repetida', 'repetida'], ['otra_liga', 'de otra liga'], ['anulada', 'anulada'], ['no_se_jugo', 'no se jugó']];
const POR_PTS_STAFF = [['bono', 'Un bono'], ['penalizacion', 'Una penalización'], ['df', 'Un DF'], ['falta', 'Su tabla lo tiene y no sale de ninguna batalla'], ['otro', 'Otro']];
const CAMBIO_TXT = (c) => {
  const d = c.dato || {};
  const par = d.a && d.b ? limpio(d.a) + ' vs ' + limpio(d.b) : 'esa batalla';
  return c.tipo === 'ganador' ? limpio(d.gana) + ' ganó ' + par + (d.como === 'replica' ? ', en réplica' : ', directo')
    : c.tipo === 'invitado' ? limpio(d.quien) + ' jugó de invitado' + (d.bat ? ' en ' + par : ' en todas las suyas')
    : c.tipo === 'lado' ? 'En ' + par + ', «' + limpio(d.de) + '» era ' + limpio(d.es)
    : c.tipo === 'puntos' ? limpio(d.nombre) + ': ' + (d.pts > 0 ? '+' : '') + d.pts + ' · ' + ((POR_PTS_STAFF.find((x) => x[0] === d.por) || [])[1] || 'ajuste') + ' · ' + d.dia
    : c.tipo === 'no_cuenta' ? (d.a && d.b ? limpio(d.a) + ' vs ' + limpio(d.b) : 'Esa batalla') + ' no cuenta' + (d.por ? ': ' + ((POR_NC_STAFF.find((x) => x[0] === d.por) || [])[1] || '') : '')
      : c.tipo === 'cargar' ? limpio(d.a) + ' vs ' + limpio(d.b) + ': ganó ' + limpio(d.gana) + (d.como === 'replica' ? ' en réplica' : ' directo') + ' · ' + d.dia
        : c.tipo === 'df' ? limpio(d.nombre) + ': ' + (d.pts === 3 ? 'ganó por DF (3)' : 'no vino nadie (1)') + ' · ' + d.dia
          : c.tipo === 'nombre' ? '«' + limpio(d.nombre) + '» es ' + limpio(d.es) : 'Campeón: ' + limpio(d.c);
};
const hoyIso = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
function LigasStaff({ sv, rol, permisos }) {
  const [det, setDet] = useState(null);
  const [sel, setSel] = useState('');
  const [j, setJ] = useState(null);
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState(null);
  const [fila, setFila] = useState(null);
  const [porNc, setPorNc] = useState('exhibicion');
  const [era, setEra] = useState({ lado: '', es: '' });
  useEffect(() => {
    let vivo = true;
    fetch('/api/ligas').then((r) => (r.ok ? r.json() : null)).then((x) => { if (vivo) setDet(x || {}); }).catch(() => { if (vivo) setDet({}); });
    return () => { vivo = false; };
  }, []);
  const ligas = ((det && det.lobby && det.lobby.ligas) || []).filter((L) => L.sv === sv);
  const L = ligas.find((x) => x.id === sel) || ligas[0];
  const lid = L ? L.id : '';
  useEffect(() => {
    if (!lid) return undefined;
    let vivo = true;
    setJ(null); setMsg(''); setForm(null); setFila(null);
    pedirLiga(sv, lid, 'ver').then((r) => { if (vivo) setJ(r || { error: 'red' }); });
    return () => { vivo = false; };
  }, [sv, lid]);
  if (!det) return <p className="pronto-p">Buscando tus ligas…</p>;
  if (!L) return <p className="sp-vacio">La Liga todavía no lee ninguna liga de tu servidor.</p>;
  const cambia = puede(rol, 'ligas', permisos);
  const bats = (((det.ligas || {})[lid] || {}).fechas || []).flatMap((f) => f.b.map((b) => ({ a: b[0], b: b[1], g: b[2], como: b[3], id: b[6], inv: b[8] || '', dia: f.d })))
    .filter((b) => b.id).slice(0, 40);
  const mandar = (cambio, listo) => {
    setOcup(true); setMsg('');
    pedirLiga(sv, lid, 'cambiar', { cambio }).then((x) => {
      setOcup(false);
      if (x && x.ok) { setJ(x); setForm(null); setFila(null); setMsg(listo); } else setMsg(errStaff(x));
    });
  };
  const deshacer = (c) => {
    setOcup(true); setMsg('');
    pedirLiga(sv, lid, 'deshacer', { id: c.id }).then((x) => {
      setOcup(false);
      if (x && x.ok) { setJ(x); setMsg('Deshecho: en la próxima media hora vuelve a lo que dice el canal.'); } else setMsg(errStaff(x));
    });
  };
  const LISTO = 'Guardado: se ve en la página en la próxima media hora.';
  const campo = (k, ph, max = 60) => <input type="text" value={(form && form[k]) || ''} maxLength={max} placeholder={ph}
    onChange={(e) => setForm(Object.assign({}, form, { [k]: e.target.value }))} />;
  // 🎮 y 🧮 (18/11/2026): un invitado en todas sus batallas y los puntos sueltos, además de lo de antes
  const formas = [['cargar', 'Cargar una batalla'], ...(L.dfc ? [['df', 'Un DF']] : []), ['nombre', 'Un nombre'], ['invitado', 'Un invitado'],
    ['puntos', 'Puntos sueltos'], ['campeon', 'Cerrar la temporada']];
  return (
    <div className="sp-lg">
      {ligas.length > 1 ? <div className="sp-lg-sel">{ligas.map((x) => (
        <button key={x.id} type="button" className={'btn chico ' + (x.id === lid ? 'verde' : 'borde2')} onClick={() => setSel(x.id)}>{limpio(x.n)}</button>
      ))}</div> : null}
      <p className="sp-ll-ayuda">{cambia
        ? 'Lo que cambias acá se aplica sobre lo que el bot leyó de tus canales, en la próxima media hora. La tabla sale de las batallas: no se escribe a mano. Todo se puede deshacer.'
        : 'Las ligas las cambian el dueño, los admins y los moderadores. Acá ves lo que cambiaron.'}</p>
      {cambia ? <div className="sp-lg-sel">{formas.map(([k, t]) => (
        <button key={k} type="button" className={'btn chico ' + (form && form.tipo === k ? 'verde' : 'borde2')}
          onClick={() => setForm(form && form.tipo === k ? null : { tipo: k, dia: hoyIso(), como: 'directa', pts: k === 'puntos' ? 1 : 3, por: 'bono' })}>{t}</button>
      ))}</div> : null}
      {cambia && form ? (
        <div className="sp-lg-form">
          {form.tipo === 'cargar' ? <>
            <label><span>Uno</span>{campo('a', 'Como se llama en tu liga')}</label>
            <label><span>El otro</span>{campo('b', 'Como se llama en tu liga')}</label>
            <label><span>Ganó</span><select value={form.gana || ''} onChange={(e) => setForm(Object.assign({}, form, { gana: e.target.value }))}>
              <option value="">Elige</option>{[form.a, form.b].filter(Boolean).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            <label><span>Cómo</span><select value={form.como} onChange={(e) => setForm(Object.assign({}, form, { como: e.target.value }))}>
              <option value="directa">Directo</option><option value="replica">En réplica</option></select></label>
            <label><span>Día</span><input type="date" value={form.dia} onChange={(e) => setForm(Object.assign({}, form, { dia: e.target.value }))} /></label>
          </> : form.tipo === 'df' ? <>
            <label><span>Quién</span>{campo('nombre', 'Como se llama en tu liga')}</label>
            <label><span>Qué pasó</span><select value={form.pts} onChange={(e) => setForm(Object.assign({}, form, { pts: Number(e.target.value) }))}>
              <option value={3}>Ganó por DF: 3 puntos</option><option value={1}>No vino nadie: 1 punto</option></select></label>
            <label><span>Día</span><input type="date" value={form.dia} onChange={(e) => setForm(Object.assign({}, form, { dia: e.target.value }))} /></label>
          </> : form.tipo === 'nombre' ? <>
            <label><span>Lo escriben así</span>{campo('nombre', 'Por ejemplo: ZIARKI')}</label>
            <label><span>Y es</span>{campo('es', 'Por ejemplo: IVAN')}</label>
          </> : form.tipo === 'invitado' ? <>
            <label><span>Quién</span>{campo('quien', 'Como se llama en tu liga')}</label>
            <p className="sp-ll-t">Jugó de invitado en tu liga (el 🎮 que no se puso): sus batallas siguen valiendo para su rival y él no entra a la tabla.
              Si fue invitado en una sola, usa «Corregir» en esa batalla.</p>
          </> : form.tipo === 'puntos' ? <>
            <label><span>Quién</span>{campo('nombre', 'Como se llama en tu liga')}</label>
            <label><span>Puntos</span><select value={form.pts} onChange={(e) => setForm(Object.assign({}, form, { pts: Number(e.target.value) }))}>
              {[9, 6, 5, 4, 3, 2, 1, -1, -2, -3, -4, -5, -6, -9].map((n) => <option key={n} value={n}>{n > 0 ? '+' + n : n}</option>)}</select></label>
            <label><span>Por qué</span><select value={form.por} onChange={(e) => setForm(Object.assign({}, form, { por: e.target.value }))}>
              {POR_PTS_STAFF.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
            <label><span>Día</span><input type="date" value={form.dia} onChange={(e) => setForm(Object.assign({}, form, { dia: e.target.value }))} /></label>
            <p className="sp-ll-t">Sólo puntos, sin batalla: no suma jugadas ni ganadas.</p>
          </> : <>
            <label><span>Campeón</span><select value={form.c || ''} onChange={(e) => setForm(Object.assign({}, form, { c: e.target.value }))}>
              <option value="">Elige</option>{(L.tabla || []).map((f) => <option key={f[0]} value={f[0]}>{limpio(f[0])}</option>)}</select></label>
            <p className="sp-ll-t">Cierra la temporada que se juega, como si lo anunciara tu servidor: sale en el Salón y la próxima batalla abre la siguiente.</p>
          </>}
          <button type="button" className="btn verde" disabled={ocup} onClick={() => mandar(form, LISTO)}>Guardar</button>
        </div>
      ) : null}
      {bats.length ? <>
        <h3 className="sp-h">Las batallas <small>las últimas {bats.length} de la temporada que se ve</small></h3>
        <ol className="sp-lg-l">{bats.map((b, i) => (
          <li key={b.id + ':' + i}>
            <span><b>{limpio(b.a)}{b.inv.includes('a') ? ' 🎮' : ''} vs {limpio(b.b)}{b.inv.includes('b') ? ' 🎮' : ''}</b><small>{b.g ? 'Ganó ' + limpio(b.g) + (b.como === 'replica' ? ' en réplica' : ' directo') : 'Sin resultado'} · {b.dia}</small></span>
            {cambia ? (fila === i ? (
              <span className="sp-ll-acc">
                {[b.a, b.b].map((n) => ['directa', 'replica'].map((como) => (
                  <button key={n + como} type="button" className="btn borde2 chico" disabled={ocup}
                    onClick={() => mandar({ tipo: 'ganador', bat: b.id, a: b.a, b: b.b, gana: n, como }, LISTO)}>{limpio(n)} · {como === 'replica' ? 'réplica' : 'directo'}</button>
                )))}
                {/* 🎮 uno de los dos fue invitado (18/11/2026): su rival cobra y él no entra a la tabla */}
                {[['a', b.a], ['b', b.b]].filter(([l]) => !b.inv.includes(l)).map(([l, n]) => (
                  <button key={'i' + l} type="button" className="btn borde2 chico" disabled={ocup}
                    onClick={() => mandar({ tipo: 'invitado', bat: b.id, a: b.a, b: b.b, quien: n }, LISTO)}>{limpio(n)} fue invitado</button>))}
                {/* ✍️ uno de los dos era otro, sólo en esta batalla */}
                {[['a', b.a], ['b', b.b]].map(([l, n]) => (
                  <button key={'l' + l} type="button" className={'btn chico ' + (era.lado === l ? 'verde' : 'borde2')} disabled={ocup}
                    onClick={() => setEra({ lado: era.lado === l ? '' : l, es: '' })}>«{limpio(n)}» era otro</button>))}
                {era.lado ? <>
                  <input type="text" className="sp-in" maxLength={58} value={era.es} placeholder="Como se llama en tu liga" aria-label="Quién era"
                    onChange={(e) => setEra(Object.assign({}, era, { es: e.target.value }))} />
                  <button type="button" className="btn verde chico" disabled={ocup || !era.es.trim()}
                    onClick={() => { mandar({ tipo: 'lado', bat: b.id, a: b.a, b: b.b, de: era.lado === 'a' ? b.a : b.b, es: era.es.trim() }, LISTO); setEra({ lado: '', es: '' }); }}>Guardar</button>
                </> : null}
                {/* 🚫 no cuenta, y por qué */}
                <select className="sp-in" value={porNc} onChange={(e) => setPorNc(e.target.value)} aria-label="Por qué no cuenta">
                  {POR_NC_STAFF.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
                <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo: no cuenta"
                  onClick={() => mandar({ tipo: 'no_cuenta', bat: b.id, a: b.a, b: b.b, por: porNc }, LISTO)}>No cuenta</DosToques>
              </span>
            ) : <button type="button" className="btn borde2 chico" onClick={() => { setFila(i); setEra({ lado: '', es: '' }); }}>Corregir</button>) : null}
          </li>
        ))}</ol>
      </> : null}
      {j && j.ok && (j.cambios || []).length ? <>
        <h3 className="sp-h">Lo que cambió tu equipo</h3>
        <ol className="sp-lg-l">{j.cambios.map((c) => (
          <li key={c.id} className={c.estado === 'activo' ? '' : 'sp-lg-fuera'}>
            <span><b>{CAMBIO_TXT(c)}</b><small>{(c.de || 'Tu equipo') + (c.estado === 'activo' ? '' : ' · deshecho')}</small></span>
            {cambia && c.estado === 'activo' ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo: se deshace"
              onClick={() => deshacer(c)}>Deshacer</DosToques> : null}
          </li>
        ))}</ol>
      </> : null}
      {j && !j.ok ? <p className="pronto-p">{errStaff(j)}</p> : null}
      {msg ? <p className="sp-preg-msg" role="status">{msg}</p> : null}
    </div>
  );
}

// 🪪 QUIÉN ES QUIÉN (Dlx, 16/11/2026: «me gustan todas las ideas»): las «¿Quién es X?» de tus eventos, y tus inscripciones
// con «este nombre es tal persona» en tu servidor. Lo contesta el staff (moderador para arriba); lo aplica el ciclo
function QuienStaff({ sv, rol, permisos }) {
  const [q, setQ] = useState(null);
  const [nm, setNm] = useState(null);
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const [esq, setEsq] = useState({});
  const [form, setForm] = useState({ nombre: '', es: '' });
  useEffect(() => {
    let vivo = true;
    setQ(null); setNm(null); setMsg('');
    pedirStaff(sv, 'quien', 'ver').then((r) => { if (vivo) setQ(r || { error: 'red' }); });
    pedirStaff(sv, 'nombres', 'ver').then((r) => { if (vivo) setNm(r || { error: 'red' }); });
    return () => { vivo = false; };
  }, [sv]);
  const puedo = puede(rol, 'llaves', permisos);
  const contestar = (p, r) => {
    setOcup(true); setMsg('');
    pedirStaff(sv, 'quien', 'contestar', { id: p.id, r }).then((x) => {
      setOcup(false);
      if (x && x.ok) { setQ(x); setMsg('Contestado: lo aplica el ciclo en la próxima media hora.'); } else setMsg(errStaff(x));
    });
  };
  const nombres = (accion, extra, listo) => {
    setOcup(true); setMsg('');
    pedirStaff(sv, 'nombres', accion, extra).then((x) => {
      setOcup(false);
      if (x && x.ok) { setNm(x); setForm({ nombre: '', es: '' }); setMsg(listo); } else setMsg(errStaff(x));
    });
  };
  const ps = (q && q.ok && q.preguntas) || [];
  const resp = (q && q.ok && q.respuestas) || {};
  const ins = (nm && nm.ok && nm.inscritos) || [];
  const ns = ((nm && nm.ok && nm.nombres) || []).filter((x) => x.estado === 'activo');
  return (
    <div className="sp-ll">
      <h3 className="sp-h">¿Quién es? <small>de tus eventos</small></h3>
      {!q ? <p className="pronto-p">Buscando…</p> : ps.length ? <ol className="sp-ll-l">{ps.map((p) => (
        <li key={p.id}>
          <p className="sp-ll-cual">{p.link ? <a href={p.link} target="_blank" rel="noopener noreferrer">{p.sec}</a> : p.sec}</p>
          <p className="sp-ll-t"><b>{p.que}</b></p>
          {p.pistas ? <p className="sp-ll-t">{p.pistas}</p> : null}
          {resp[p.id] ? <p className="sp-ll-est">Contestado: {resp[p.id].r}{resp[p.id].por ? ' · ' + resp[p.id].por : ''}</p> : null}
          {puedo ? <div className="sp-ll-acc">
            {(p.opciones || []).map((o) => <button key={o} type="button" className="btn borde2 chico" disabled={ocup} onClick={() => contestar(p, o)}>{o}</button>)}
            <input type="text" className="sp-in" maxLength={58} value={esq[p.id] || ''} placeholder="Su nombre en la Liga"
              aria-label={'Quién es, en ' + p.sec} onChange={(e) => setEsq(Object.assign({}, esq, { [p.id]: e.target.value }))} />
            <button type="button" className="btn verde chico" disabled={ocup || !(esq[p.id] || '').trim()} onClick={() => contestar(p, 'Es ' + esq[p.id].trim())}>Es esa persona</button>
          </div> : null}
        </li>
      ))}</ol> : <p className="sp-vacio">No hay «¿Quién es?» de tus eventos esperando respuesta.</p>}
      <h3 className="sp-h">Tus inscripciones <small>de los últimos 3 días</small></h3>
      <p className="sp-ll-ayuda">Si alguien se anotó con un nombre que no es el suyo en la Liga, dilo acá: en tu servidor, ese nombre pasa a ser esa persona. Tiene que estar en la Lista de la Liga.</p>
      {!nm ? <p className="pronto-p">Buscando…</p> : ins.length ? <ol className="sp-lg-l">{ins.slice(0, 30).map((x, i) => (
        <li key={i}><span><b>{x.n}</b><small>{x.autor ? '@' + x.autor : ''}</small></span>
          {puedo ? <button type="button" className="btn borde2 chico" onClick={() => setForm({ nombre: x.n.split(/\s+/).slice(0, 3).join(' '), es: '' })}>Es otra persona</button> : null}</li>
      ))}</ol> : <p className="sp-vacio">Nadie se anotó en tus eventos en los últimos 3 días.</p>}
      {puedo ? <div className="sp-lg-form">
        <label><span>Lo escriben así</span><input type="text" maxLength={60} value={form.nombre} onChange={(e) => setForm(Object.assign({}, form, { nombre: e.target.value }))} /></label>
        <label><span>Y es</span><input type="text" maxLength={60} value={form.es} placeholder="Su nombre en la Liga" onChange={(e) => setForm(Object.assign({}, form, { es: e.target.value }))} /></label>
        <button type="button" className="btn verde" disabled={ocup || !form.nombre.trim() || !form.es.trim()}
          onClick={() => nombres('poner', { nombre: form.nombre.trim(), es: form.es.trim() }, 'Guardado: lo aplica el ciclo en la próxima media hora.')}>Guardar</button>
      </div> : null}
      {ns.length ? <ol className="sp-lg-l">{ns.map((x) => (
        <li key={x.id}><span><b>«{x.nombre}» es {x.es}</b><small>en tu servidor</small></span>
          {puedo ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo: se quita" onClick={() => nombres('quitar', { id: x.id }, 'Quitado.')}>Quitar</DosToques> : null}</li>
      ))}</ol> : null}
      {msg ? <p className="sp-preg-msg" role="status">{msg}</p> : null}
    </div>
  );
}

// 📅 TUS EVENTOS: anunciar uno sin depender de que el bot lea el anuncio (lo mismo que `/agendar` en Discord). Si después
// lo anuncian en el canal, gana el anuncio de verdad
// ⏰ HORARIOS SIN CHOQUES (el plan de los tiers, 19/11/2026): lo que otro servidor de la Liga ya anunció a menos de 2 h de
// la hora elegida (`liga.proximos()`: lo del payload y lo que el vigía vio después, sin los cancelados). Avisa y nada más:
// anunciar igual se puede. Las 2 h son las de `MISMO_EVENTO_H` de la llave: lo que dura un evento de los de la Liga
const CHOQUE_MS = 2 * 3600 * 1000;
function choquesDe(liga, sv, ini) {
  if (!liga || !liga.proximos || !Number.isFinite(ini)) return [];
  const vistos = new Set();
  return liga.proximos().filter((p) => p.sv && p.sv !== sv && !(liga.esCancelado && liga.esCancelado(p)))
    .map((p) => ({ p, t: utc(p.cuando).getTime() }))
    .filter((x) => Number.isFinite(x.t) && Math.abs(x.t - ini) < CHOQUE_MS)
    .filter((x) => { const k = x.p.sv + '|' + x.t; if (vistos.has(k)) return false; vistos.add(k); return true; })
    .sort((a, b) => Math.abs(a.t - ini) - Math.abs(b.t - ini));
}
// «1 h 30 min antes»: cuándo empieza el otro, contra el tuyo
const cuantoAntes = (ms) => {
  const m = Math.round(Math.abs(ms) / 60000);
  if (m < 10) return 'a la misma hora';
  return (m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '')) + (ms < 0 ? ' antes' : ' después');
};

function AgendaStaff({ sv, rol, permisos, liga }) {
  const [j, setJ] = useState(null);
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const [f, setF] = useState({ nombre: '', cuando: '', formato: '' });
  useEffect(() => {
    let vivo = true;
    setJ(null); setMsg('');
    pedirStaff(sv, 'agenda', 'ver').then((r) => { if (vivo) setJ(r || { error: 'red' }); });
    return () => { vivo = false; };
  }, [sv]);
  const puedo = puede(rol, 'eventos', permisos);
  const hacer = (accion, extra, listo) => {
    setOcup(true); setMsg('');
    pedirStaff(sv, 'agenda', accion, extra).then((x) => {
      setOcup(false);
      if (x && x.ok) { setJ(x); setF({ nombre: '', cuando: '', formato: '' }); setMsg(listo); } else setMsg(errStaff(x));
    });
  };
  // 🕐 (18/11/2026) «tu hora» es la de Ajustes, la misma con que la lista de abajo la muestra: `new Date()` la leía en la
  // del dispositivo y, con otra zona elegida, el evento quedaba corrido para todos
  const ini = f.cuando ? msDeLocal(f.cuando) : NaN;
  const xs = (j && j.ok && j.agenda) || [];
  const choques = puedo ? choquesDe(liga, sv, ini) : [];
  return (
    <div className="sp-ll">
      {puedo ? <div className="sp-lg-form">
        <label><span>Nombre del evento</span><input type="text" maxLength={80} value={f.nombre} onChange={(e) => setF(Object.assign({}, f, { nombre: e.target.value }))} /></label>
        <label><span>Cuándo (tu hora)</span><input type="datetime-local" value={f.cuando} onChange={(e) => setF(Object.assign({}, f, { cuando: e.target.value }))} /></label>
        <label><span>Formato</span><input type="text" maxLength={40} value={f.formato} placeholder="Por ejemplo: 1v1, 2v2" onChange={(e) => setF(Object.assign({}, f, { formato: e.target.value }))} /></label>
        <button type="button" className="btn verde" disabled={ocup || !f.nombre.trim() || !Number.isFinite(ini)}
          onClick={() => hacer('agregar', { nombre: f.nombre.trim(), ini, formato: f.formato.trim() }, 'Anunciado: sale en Eventos y en la campana en la próxima media hora.')}>Anunciar</button>
      </div> : <p className="sp-ll-ayuda">Los eventos los anuncian el dueño, los admins y los moderadores.</p>}
      {choques.length ? (
        <div className="sp-choque" role="status">
          <b>{choques.length === 1 ? 'A esa hora ya hay otro evento en la Liga' : 'A esa hora ya hay ' + choques.length + ' eventos en la Liga'}</b>
          <ul>{choques.slice(0, 3).map(({ p, t }) => (
            <li key={p.sv + t}><span>{nombreEv(p.nombre)}</span><small>{siglaDe(p.sv)} · {W.fmtHora ? W.fmtHora(new Date(t)) : ''} · empieza {cuantoAntes(t - ini)}</small></li>
          ))}</ul>
          <small>Puedes anunciarlo igual. Si lo mueves, la gente puede jugar los dos.</small>
        </div>
      ) : null}
      {xs.length ? <ol className="sp-lg-l">{xs.map((x) => (
        <li key={x.id}><span><b>{x.nombre}</b><small>{(W.fmtFecha ? W.fmtFecha(x.ini, { weekday: 'long', day: 'numeric', month: 'numeric' }) : new Date(x.ini).toLocaleDateString())
          + (W.fmtHora ? ' · ' + W.fmtHora(new Date(x.ini)) : '') + (x.formato ? ' · ' + x.formato : '')}</small></span>
          {puedo ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo: se borra" onClick={() => hacer('borrar', { nombre: x.nombre }, 'Borrado.')}>Borrar</DosToques> : null}</li>
      ))}</ol> : j ? <p className="sp-vacio">No anunciaste ningún evento desde acá.</p> : <p className="pronto-p">Buscando…</p>}
      {msg ? <p className="sp-preg-msg" role="status">{msg}</p> : null}
    </div>
  );
}

// 🎭 TUS EVENTOS DE ESTILO (20/11/2026, el plan de los tiers: el Tier 2 da 1 por mes, el Tier 1 si quiere). Marcas uno de
// tus próximos eventos con un estilo y quien lo juega lo sube o lo desbloquea (`bot/juegos.py`). Lo guarda el objeto
// (`estilo_socios`) y el ciclo lo toma sólo para eventos de tu servidor (`eventos_estilo.resolver()`)
const NOMBRE_EST = Object.fromEntries((CAT_EST.estilos || []).map(([k, n]) => [k, n]));
const claveEv = (e) => { const m = /\/([0-9]{15,22})\/?$/.exec(String((e && e.link) || '')); return m ? 'a:' + m[1] : ''; };
function EstiloStaff({ sv, rol, permisos, liga }) {
  const [j, setJ] = useState(null);
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const [sel, setSel] = useState({});
  useEffect(() => {
    let vivo = true;
    setJ(null); setMsg('');
    pedirStaff(sv, 'estilo', 'ver').then((r) => { if (vivo) setJ(r || { error: 'red' }); });
    return () => { vivo = false; };
  }, [sv]);
  if (!j || j.error || !j.puede) return j && !j.error && j.tier === 3 ? <p className="sp-ll-ayuda">Los eventos de estilo los dan los Tier 2 y 1.</p> : null;
  const yo = puede(rol, 'eventos', permisos);
  const marcados = j.marcados || {};
  const prox = (liga && liga.proximos ? liga.proximos() : []).filter((p) => p.sv === sv && claveEv(p)).slice(0, 8);
  const hacer = (accion, clave, es) => {
    setOcup(true); setMsg('');
    pedirStaff(sv, 'estilo', accion, { id: clave, es }).then((x) => {
      setOcup(false);
      if (x && x.ok) { setJ(x); setMsg(accion === 'marcar' ? 'Marcado: quien lo juegue gana ese estilo.' : 'Desmarcado.'); } else setMsg(errStaff(x));
    });
  };
  return (
    <div className="sp-ll sp-est">
      {prox.length ? <ul className="sp-est-l">{prox.map((p) => {
        const k = claveEv(p), m = marcados[k];
        return (
          <li key={k}><span><b>{nombreEv(p.nombre)}</b><small>{(W.fmtFecha ? W.fmtFecha(utc(p.cuando), { weekday: 'long', day: 'numeric', month: 'numeric' }) : '')
            + (W.fmtHora ? ' · ' + W.fmtHora(utc(p.cuando)) : '')}{m ? ' · ' + (NOMBRE_EST[m] || m) : ''}</small></span>
            {yo ? (m ? <button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => hacer('quitar', k)}>Quitar</button> : (
              <span className="sp-est-f">
                <select aria-label={'El estilo de ' + nombreEv(p.nombre)} value={sel[k] || ''} onChange={(e) => setSel(Object.assign({}, sel, { [k]: e.target.value }))}>
                  <option value="">Elige un estilo</option>
                  {Object.entries(NOMBRE_EST).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                </select>
                <button type="button" className="btn verde chico" disabled={ocup || !sel[k]} onClick={() => hacer('marcar', k, sel[k])}>Marcar</button>
              </span>
            )) : (m ? <span className="cz-chip si">{NOMBRE_EST[m] || m}</span> : null)}
          </li>
        );
      })}</ul> : <p className="sp-vacio">Cuando anuncies un evento, aparece acá para marcarlo.</p>}
      {!yo ? <p className="sp-ll-ayuda">Los marcan el dueño, los admins y los moderadores.</p> : null}
      {msg ? <p className="sp-preg-msg" role="status">{msg}</p> : null}
    </div>
  );
}

// 🏛️ EL CONSEJO DE SOCIOS (20/11/2026): lo que propone la Liga y el voto de tu servidor, uno por servidor Tier 1 o 2. Vota
// el dueño o sus admins; mientras está abierta se puede cambiar. Gana el sí con más votos que el no, y la Liga tiene 48 h
// para vetarlo (`consejoDe()` de bot/avisos.js)
const CONS_EST = { abierta: 'Votando', veto: 'Ganó el sí', aprobada: 'Aprobada', no_paso: 'No pasó', vetada: 'La Liga la vetó' };
const CONS_VOTO = [['si', 'Sí'], ['no', 'No'], ['abs', 'Me abstengo']];
function ConsejoStaff({ sv, rol, permisos }) {
  const [j, setJ] = useState(null);
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let vivo = true;
    setJ(null); setMsg('');
    pedirStaff(sv, 'consejo', 'ver').then((r) => { if (vivo) setJ(r || { error: 'red' }); });
    return () => { vivo = false; };
  }, [sv]);
  if (!j || j.error || !j.puede) return null;
  const yo = puede(rol, 'ajustes', permisos);
  const votar = (id, r) => {
    setOcup(true); setMsg('');
    pedirStaff(sv, 'consejo', 'votar', { id: String(id), r }).then((x) => {
      setOcup(false);
      if (x && x.ok) { setJ(x); setMsg('Tu voto quedó. Mientras esté abierta, lo puedes cambiar.'); } else setMsg(errStaff(x));
    });
  };
  const xs = j.lista || [];
  return (
    <div className="sp-ll sp-cons">
      {xs.length ? <ul className="sp-cons-l">{xs.map((c) => (
        <li key={c.id}>
          <div><b>{c.titulo}</b>{c.texto ? <small>{c.texto}</small> : null}
            <small>{CONS_EST[c.estado] || c.estado} · votaron {c.votaron} de {c.total}{c.estado !== 'abierta' ? ' · Sí ' + c.si + ', No ' + c.no : ''}{c.mio ? ' · tu servidor votó «' + ((CONS_VOTO.find((v) => v[0] === c.mio) || [])[1] || c.mio) + '»' : ''}</small></div>
          {c.estado === 'abierta' && yo ? (
            <span className="sp-cons-b" role="group" aria-label={'Tu voto en ' + c.titulo}>
              {CONS_VOTO.map(([v, t]) => <button key={v} type="button" className={'btn chico ' + (c.mio === v ? 'verde' : 'borde2')} aria-pressed={c.mio === v} disabled={ocup} onClick={() => votar(c.id, v)}>{t}</button>)}
            </span>
          ) : null}
        </li>
      ))}</ul> : <p className="sp-vacio">Cuando la Liga proponga algo, se vota acá.</p>}
      {!yo ? <p className="sp-ll-ayuda">Vota el dueño o sus admins.</p> : null}
      {msg ? <p className="sp-preg-msg" role="status">{msg}</p> : null}
    </div>
  );
}

// 🎟️ TUS PASES PARA REGALAR (Tier 1, 20/11/2026): los que la Liga te asignó este mes, en qué eventos, y los de tu Alianza
function PasesPanel({ x, liga }) {
  const p = x.pases && x.pases.mes === new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 7) ? x.pases : null;
  const bonos = x.alianza_bonus || [];
  const nb = bonos.reduce((t, b) => t + (b.pases || 0), 0);
  const nombreDe = (k) => {
    const todos = [...((liga.d && liga.d.calendario) || []), ...(liga.proximos ? liga.proximos().map((y) => ({ n: y.nombre, link: y.link })) : [])];
    const e = todos.find((y) => k === 'a:' + ((/\/([0-9]{15,22})\/?$/.exec(String(y.link || '')) || [])[1]) || String(y.ll) === k);
    return e ? nombreEv(e.n) : k.startsWith('a:') ? 'un evento anunciado' : 'el evento #' + k;
  };
  return (
    <div className="sp-ll">
      <p className="sp-pases-n"><b>{p ? p.n : 0}</b> {p && p.n === 1 ? 'Pase este mes' : 'Pases este mes'}{nb ? <> · <b>+{nb}</b> de tu Alianza</> : null}</p>
      {p && (p.ev || []).length ? <p className="sp-ll-ayuda">Se los llevan los campeones de: {p.ev.map(nombreDe).join(', ')}.</p>
        : <p className="sp-ll-ayuda">Todavía no se eligieron los eventos de este mes.</p>}
      {(x.alianza || []).length ? <p className="sp-ll-ayuda">Tu Alianza: acompañas a {x.alianza.map(siglaDe).join(', ')}. Si sube de tier, +2 Pases para ese mes.{bonos.length ? ' ' + bonos.map((b) => siglaDe(b.aliado) + ' subió a Tier ' + b.a + '.').join(' ') : ''}</p> : null}
    </div>
  );
}

// 🎨 EL FONDO DEL VS: uno de los aprobados (las escenas de cada servidor). Las miniaturas viven en /vsfondos/
function FondoVs({ sv, rol, permisos }) {
  const [j, setJ] = useState(null);
  const [lista, setLista] = useState([]);
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let vivo = true;
    pedirStaff(sv, 'vs', 'ver').then((r) => { if (vivo) setJ(r || { error: 'red' }); });
    fetch('/vsfondos/lista.json').then((r) => (r.ok ? r.json() : [])).then((x) => { if (vivo) setLista(Array.isArray(x) ? x : []); }).catch(() => {});
    return () => { vivo = false; };
  }, [sv]);
  const puedo = puede(rol, 'ajustes', permisos);
  const elegir = (fondo) => {
    setOcup(true); setMsg('');
    pedirStaff(sv, 'vs', 'elegir', { fondo }).then((x) => {
      setOcup(false);
      if (x && x.ok) { setJ(x); setMsg('Guardado: va desde el próximo VS.'); } else setMsg(errStaff(x));
    });
  };
  const el = (j && j.ok && j.elegido) || '';
  const propio = ['vs:' + sv.toLowerCase(), 'ev:' + sv.toLowerCase()];
  const orden = lista.slice().sort((a, b) => (propio.includes(b) ? 1 : 0) - (propio.includes(a) ? 1 : 0));
  return (
    <div className="sp-ll">
      <div className="sp-vs-l">
        <button type="button" className={'sp-vs-f' + (!el ? ' on' : '')} disabled={!puedo || ocup} onClick={() => elegir('')} aria-pressed={!el}>
          <span className="sp-vs-def">El de siempre</span></button>
        {orden.map((k) => (
          <button key={k} type="button" className={'sp-vs-f' + (el === k ? ' on' : '')} disabled={!puedo || ocup} onClick={() => elegir(k)} aria-pressed={el === k}
            aria-label={(k.startsWith('ev:') ? 'Escena de eventos de ' : 'Fondo de VS de ') + siglaDe(k.slice(3).toUpperCase())}>
            <img src={'/vsfondos/' + k.replace(':', '-') + '.webp'} alt="" loading="lazy" /><small>{siglaDe(k.slice(3).toUpperCase())}{k.startsWith('ev:') ? ' · eventos' : ''}</small></button>
        ))}
      </div>
      {!puedo ? <p className="sp-ll-ayuda">El fondo lo eligen el dueño y los admins.</p> : null}
      {msg ? <p className="sp-preg-msg" role="status">{msg}</p> : null}
    </div>
  );
}

// 🙈 TUS PUBLICACIONES: las del muro que son de tu servidor, con «Ocultar» (sale del muro en la próxima media hora)
// 🏷️ (18/11/2026) y los demás que el muro marca con `sv` (bot/muro.py, ligas.py, mes_awards.py): sin ellos salían crudos
// («campeon», «caza», «precio», «promo»)
const MURO_TIPO = { anuncio: 'Anuncio', svlunes: 'Lunes', svsemana: 'La semana', svmeta: 'Meta', svtop: 'Top', svrecord: 'Récord', svnuevo: 'Nuevo', svtier: 'Tier', svchat: 'El chat',
  campeon: 'Campeón', caza: 'Caza', precio: 'Precio por cabeza', promo: 'Promo', flyer: 'Flyer de liga', ligahito: 'Liga', mesaward: 'MES AWARDS' };
// de qué es y de quién, para que dos del mismo evento (las dos cazas de una noche) no salgan idénticas
const muroDe = (x) => (x.ev ? nombreEv(x.ev, x.ll) : limpio(x.ln || x.tit || ''));
const muroQuien = (x) => (x.quien || []).map(limpio).filter(Boolean).join(' y ');
function MuroStaff({ sv, rol, permisos }) {
  const [items, setItems] = useState(null);
  const [j, setJ] = useState(null);
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let vivo = true;
    fetch('/api/muro').then((r) => (r.ok ? r.json() : {})).then((m) => { if (vivo) setItems(((m && m.items) || []).filter((x) => x && x.sv === sv && x.id).slice(0, 30)); })
      .catch(() => { if (vivo) setItems([]); });
    pedirStaff(sv, 'muro', 'ver').then((r) => { if (vivo) setJ(r || { error: 'red' }); });
    return () => { vivo = false; };
  }, [sv]);
  const puedo = puede(rol, 'muro', permisos);
  const oc = new Set(((j && j.ok && j.ocultos) || []).map((x) => x.id));
  const hacer = (accion, pub) => {
    setOcup(true); setMsg('');
    pedirStaff(sv, 'muro', accion, { pub }).then((x) => {
      setOcup(false);
      if (x && x.ok) { setJ(x); setMsg(accion === 'ocultar' ? 'Oculta: sale del muro en la próxima media hora.' : 'Vuelve al muro en la próxima media hora.'); } else setMsg(errStaff(x));
    });
  };
  if (!items) return <p className="pronto-p">Buscando tus publicaciones…</p>;
  return (
    <div className="sp-ll">
      {items.length ? <ol className="sp-lg-l">{items.map((x) => (
        <li key={x.id} className={oc.has(x.id) ? 'sp-lg-fuera' : ''}>
          {/* 📅 (18/11/2026) la fecha por fmtFecha, en la zona de Ajustes: cortar el ISO daba el día en UTC (lo de después de
              las 7 PM ET salía con el día siguiente) y en AAAA-MM-DD */}
          <span><b>{MURO_TIPO[x.tipo] || x.tipo}{muroDe(x) ? ': ' + muroDe(x) : ''}</b><small>{[muroQuien(x),
            W.fmtFecha ? W.fmtFecha(x.t, { day: 'numeric', month: 'short' }) : String(x.t || '').slice(0, 10)].filter(Boolean).join(' · ')}{oc.has(x.id) ? ' · oculta' : ''}</small></span>
          {puedo ? (oc.has(x.id) ? <button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => hacer('mostrar', x.id)}>Mostrar</button>
            : <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo: se oculta" onClick={() => hacer('ocultar', x.id)}>Ocultar</DosToques>) : null}
        </li>
      ))}</ol> : <p className="sp-vacio">Ahora no hay publicaciones de tu servidor en el muro.</p>}
      {/* las ocultas ya no vienen en el muro: se pueden volver a mostrar igual */}
      {puedo && [...oc].filter((id) => !items.some((x) => x.id === id)).length ? <>
        <h3 className="sp-h">Ocultas</h3>
        <ol className="sp-lg-l">{[...oc].filter((id) => !items.some((x) => x.id === id)).map((id) => (
          <li key={id} className="sp-lg-fuera"><span><b>Una publicación oculta</b><small>{id}</small></span>
            <button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => hacer('mostrar', id)}>Mostrar</button></li>
        ))}</ol>
      </> : null}
      {msg ? <p className="sp-preg-msg" role="status">{msg}</p> : null}
    </div>
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
  // 🛡️ qué abre cada rol (16/11/2026): lo manda el Worker con los roles (`SOCIO_PERMISOS`); sin eso, sólo el dueño ve todo
  const [perm, setPerm] = useState(null);
  useEffect(() => {
    let vivo = true;
    pedirPanel(false).then((r) => {
      if (!vivo) return;
      setJ(r);
      if (r && r.ok) pedirRoles().then((x) => { if (vivo) setPerm((x && x.permisos) || {}); });
    });
    return () => { vivo = false; };
  }, []);
  if (!j) return <p className="pronto-p sp-carga" role="status">Buscando tu servidor…</p>;
  if (j.status === 401) {
    return <Puerta texto="Cómo viene tu servidor en la Liga, cuándo conviene hacer eventos y los ajustes del bot, en un solo lugar. Entra con tu cuenta de Discord: la del dueño o la de alguien de su equipo."
      entrar={() => pedirPanel(true).then((r) => { if (r) setJ(r); })} />;
  }
  const svs = (j && j.servidores) || [];
  if (!j.ok || !svs.length) {
    return <Puerta texto={j.ok ? 'Este panel es para los dueños de los servidores socios de la Liga y su equipo. Si eres admin, pídele al dueño que te sume; si eres el dueño y no lo ves, escríbele a @itsdlx.'
      : 'No pude traer el panel ahora. Prueba de nuevo en un rato.'} />;
  }
  const x = svs.find((s) => s.sv === sel) || svs[0];
  // 🔑 `key` (18/11/2026): sin ella, al tocar otro servidor React reusaba las mismas piezas, y la respuesta de un cambio en
  // FFA que llegaba tarde pisaba el panel de DDF (con «Guardado»); los borradores de «Tus eventos» y «Quién es quién» se
  // guardaban en el otro servidor. Con la key cada servidor arranca de cero
  return <Servidor key={x.sv} liga={liga} x={x} svs={svs} onSel={setSel} t={j.t} permisos={perm} />;
}
