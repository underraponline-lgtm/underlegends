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
import { useEffect, useState } from 'react';
import { contestarFinal, pedirAjustes, pedirEquipo, pedirPagina, pedirPanel } from './panelsocio.js';
import { aBase64, achicar } from './imagen.js';
import { limpio, num, siglaDe } from './liga.js';
import { DosToques, Ico, Sec, silueta } from './piezas.jsx';
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
// con menos debuts no se da un porcentaje: es `MIN_VUELVEN` de bot/tiers.py
const MIN_VUELVEN = 8;
const PARTES = [['actividad', 'Actividad', 35, 'Eventos por semana: con 2 llega al tope.'],
  ['alcance', 'Alcance', 25, 'Raperos por evento y gente nueva.'],
  ['calidad', 'Calidad', 25, 'Llaves que el bot lee solo, anuncios que dicen quién organiza y pocos cancelados.'],
  ['comunidad', 'Comunidad', 15, 'Los nuevos que vuelven, las promos y las ligas.']];
// a qué parte del panel lleva cada sugerencia (`sug_ir`, lo manda el ciclo: `sugerencias_ir()` de bot/tiers.py)
const IR = { 'sp-vuelven': 'Ver quién vuelve', 'sp-cuando': 'Ver cuándo', 'sp-semanas': 'Ver las semanas', 'sp-gente': 'Ver tu gente', 'sp-puntaje': 'Ver el puntaje', 'sp-ajustes': 'Ver los ajustes' };
const TIER = { 1: 'TIER 1 · TEMPORADA Y COMPETITIVO', 2: 'TIER 2 · EL CALENDARIO Y LA CAMPANA', 3: 'TIER 3 · SU PÁGINA Y SUS LIGAS' };
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

// ── cuánto falta para el tier de arriba: lo que mira la Liga, con cómo va cada cosa. En Tier 1, nada ──
function ComoSubir({ s }) {
  if (!s || !s.a) return null;
  const van = s.pide.filter((x) => x[2]).length;
  return (
    <div className="sp-sube">
      <h3 className="sp-h">Para llegar a Tier {s.a} <small>{van} de {s.pide.length}</small></h3>
      <ul>{s.pide.map(([t, d, si]) => (
        <li key={t} className={si ? 'si' : ''}><i aria-hidden="true">{si ? <Ico n="ok" t={14} /> : null}</i><b>{t}</b><span>{si ? <span className="sp-oculto">Cumplido: </span> : null}{d}</span></li>
      ))}</ul>
      <p className="sp-nota">Se mide solo con tus últimas 4 semanas. Cuando cumplas todo, Dlx confirma el cambio.</p>
    </div>
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
  kv: 'No se pudo guardar ahora: prueba en un rato.', valor: 'Ese valor no vale.',
  solo_dueno: 'El equipo lo maneja el dueño del servidor.', no_esta: 'Esa persona no está en tu servidor.',
  ya_esta: 'Ya está en tu equipo.', tope: 'Llegaste a 10: saca a alguien para sumar a otro.' };
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
          <Fila label t="El resumen de la semana" sello={sello === 'resumen'} ayuda="Cada lunes al mediodía: tus eventos, tu gente, los que más puntos hicieron y cuántos vuelven. Sin mencionar a nadie.">
            <Canal {...sel} cual="resumen" vacio="No mandar" /></Fila>
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
          {/* 🎲 sin interruptor desde el 11/11/2026: las apuestas salen siempre, en todos los niveles (`hayApuestas()` en avisos.js) */}
          <Fila t="Apuestas" ayuda="Antes de cada batalla se apuesta con Puntos de Tienda desde el chat, y el pozo se reparte entre los que aciertan.">
            <span>Van siempre, con el bot en cualquier nivel</span></Fila>
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
  const vu = p.vuelven && p.vuelven.n != null ? p.vuelven : null;
  const preg = x.preguntas || [];
  const items = [...(preg.length ? [['sp-preg', 'Para contestar', preg.length]] : []), ['sp-puntaje', 'Puntaje', null], ['sp-sug', 'Lo que conviene', sugs.length], ['sp-vuelven', '¿Vuelven?', vu ? null : 0], ['sp-cuando', 'Cuándo', null],
    ['sp-semanas', 'Semanas', null], ['sp-gente', 'Su gente', null], ['sp-visitas', 'Visitas', null], ['sp-ajustes', 'Ajustes', null],
    ['sp-pagina', 'Tu página', null], ...(x.rol !== 'admin' ? [['sp-equipo', 'Equipo', null]] : [])];
  return (
    <>
      {svs.length > 1 ? <Elegir liga={liga} svs={svs} sel={x.sv} onSel={onSel} /> : null}
      <Portada forma="cuadrado" color={color} nombre={limpio(x.nombre || siglaDe(x.sv))}
        estilo={logo ? { '--mo-logo': 'url("' + logo + '")', ...silueta(x.sv, color) } : silueta(x.sv, color)}
        emblema={logo ? <img alt="" src={logo} /> : <b className="sp-sigla">{siglaDe(x.sv)}</b>}
        tag={TIER[x.tier] || 'TIER ' + x.tier}
        sub={<>{siglaDe(x.sv)}{x.ultimo ? ' · último evento el ' + fechaCorta(x.ultimo) : ''}{m.miembros ? ' · ' + num(m.miembros) + ' miembros en su Discord' : ''}
          {x.rol === 'admin' ? <small className="sp-medido">Entraste como admin: te sumó el dueño del servidor.</small> : null}
          {t ? <small className="sp-medido">Medido el {W.fmtFecha ? W.fmtFecha(t, { day: 'numeric', month: 'numeric' }) : fechaCorta(String(t).slice(0, 10))}
            {W.fmtHora ? ' a las ' + W.fmtHora(new Date(t)) : ''}. Se actualiza cada media hora.</small> : null}</>}
        acciones={<>
          <a className="btn verde" href={'#/sv/' + encodeURIComponent(siglaDe(x.sv))}>Su página</a>
          <button type="button" className="btn borde" onClick={(e) => irA(e, 'sp-ajustes')}>Ajustes del bot</button>
        </>}
        numeros={[['PUNTAJE', <><Contador v={pts} /><small className="sp-de"> de 100</small></>, 'dest' + (sube ? ' sube' : '')],
          ['EVENTOS · 4 SEMANAS', num(m.eventos || 0)], ['RAPEROS POR EVENTO', m.eventos ? coma(m.por_evento || 0) : '—'],
          // ⚠️ el «vuelve» de abajo, con sus 14 días cumplidos: el de los nuevos de 4 semanas daba otro número al lado del de la sección
          ['NUEVOS · 4 SEMANAS', <>{num(m.nuevos || 0)}{vu && vu.n >= MIN_VUELVEN ? <small className="sp-de"> vuelve el {pc(vu.v, vu.n)} %</small> : null}</>]]} />
      <Indice items={items} />
      {preg.length ? (
        <Sec id="sp-preg" titulo="Para contestar" bajada="Batallas de tus llaves donde el bot no encontró quién ganó. Las puede marcar el dueño acá o el staff con los botones de Discord: vale la primera." extra="negra">
          <Preguntas sv={x.sv} xs={preg} />
        </Sec>
      ) : null}
      <Sec id="sp-puntaje" titulo="Su puntaje" bajada="De 0 a 100, con las últimas 4 semanas: es lo que mira la Liga para el nivel de cada socio. Cada parte tiene su tope.">
        <Puntaje x={x} />
        <ComoSubir s={p.subir} />
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
      {vu ? (
        <Sec id="sp-vuelven" titulo="¿Vuelve tu gente?" bajada={'De quienes jugaron su primer evento de la temporada en tu servidor' + (vu.desde ? ', desde el ' + fechaCorta(vu.desde) : '') + '. No cuenta a quien debutó hace menos de 14 días. Volver es otro evento, otro día, en cualquier servidor de la Liga.'}>
          <Vuelven v={vu} />
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
      <Sec id="sp-ajustes" titulo="Los ajustes del bot" bajada="Los de /settings en tu Discord —lo último que cambies, acá o allá, es lo que vale— y los que sólo están acá: el aviso de cada evento, las batallas de tus ligas y los eventos de Discord.">
        <Ajustes sv={x.sv} />
      </Sec>
      <Sec id="sp-pagina" titulo="Tu página" bajada="Lo que se ve arriba en la página de tu servidor: un texto, tus redes y un banner. Sale en la próxima media hora.">
        <TuPagina sv={x.sv} />
      </Sec>
      {/* 👥 TU EQUIPO (Dlx, 11/11/2026): sólo el dueño lo ve y lo maneja; sus admins entran con su propia cuenta */}
      {x.rol !== 'admin' ? (
        <Sec id="sp-equipo" titulo="Tu equipo" bajada="Los admins de tu servidor que pueden usar este panel. Entran con su propia cuenta de Discord y pueden cambiar todo menos el equipo.">
          <Equipo sv={x.sv} />
        </Sec>
      ) : null}
    </>
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
  const mandar = (cambio, listo) => {
    setOcup(true); setMsg('');
    pedirPagina(sv, cambio).then((r) => {
      setOcup(false);
      if (r && r.ok) { cargar(r); setMsg(r.filtro === 'revisar' ? 'El banner quedó para que lo mire la Liga: te avisamos cuando se vea.' : listo); }
      else setMsg(PAG_ERR[r && r.error] || 'No se pudo guardar: prueba de nuevo en un rato.');
    });
  };
  const subir = async (e) => {
    const a = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!a) return;
    // 🔎 2400×900 (antes 1600×600): va a lo ancho de la página como el fondo de perfil (Dlx, 12/11/2026: «que todo esté
    // siempre en HD»); el tope del Worker (600 KB) no cambia y `achicar()` baja el tamaño si no entra
    try { const b = await achicar(a, 2400, 900, 550 * 1024); mandar({ img: await aBase64(b) }, 'Listo: tu banner sale en la página en la próxima media hora.'); }
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
          onClick={() => mandar({ quitar_banner: true }, 'Listo: tu página vuelve a su fondo de siempre.')}>Sacar el banner</DosToques> : null}
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
    pedirEquipo(sv, accion, { id: p.id }).then((r) => {
      setOcup('');
      if (r && r.ok) {
        setJ(r);
        setMsg(accion === 'sumar' ? p.n + ' ya puede entrar a este panel con su cuenta de Discord.' : p.n + ' ya no entra a este panel.');
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
        <DosToques className="btn borde2 chico" disabled={!!ocup} confirmar={'Toca de nuevo: ' + (limpio(p.n) || 'esta persona') + ' ya no entra'}
          onClick={() => hacer('sacar', p)}>Sacar</DosToques>))}</ul>
        : <p className="sp-vacio">Todavía no sumaste a nadie: el panel lo ves sólo tú.</p>}
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
function Preguntas({ sv, xs }) {
  const [lista, setLista] = useState(xs);
  const [ocup, setOcup] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { setLista(xs); }, [xs]);
  const elegir = (x, v, nombre) => {
    setOcup(x.k); setMsg('');
    contestarFinal(sv, x.k, v).then((j) => {
      setOcup('');
      if (j && j.ok) { setLista(j.preguntas || []); setMsg('Listo: ' + (j.ya || nombre) + '. Entra al ranking en la próxima media hora.'); }
      else if (j && j.error === 'ya no está') { setLista(lista.filter((y) => y.k !== x.k)); setMsg('Esa ya la había marcado alguien.'); }
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
    return <Puerta texto="Cómo viene tu servidor en la Liga, cuándo conviene hacer eventos y los ajustes del bot, en un solo lugar. Entra con tu cuenta de Discord: la del dueño o la de alguien de su equipo."
      entrar={() => pedirPanel(true).then((r) => { if (r) setJ(r); })} />;
  }
  const svs = (j && j.servidores) || [];
  if (!j.ok || !svs.length) {
    return <Puerta texto={j.ok ? 'Este panel es para los dueños de los servidores socios de la Liga y su equipo. Si eres admin, pídele al dueño que te sume; si eres el dueño y no lo ves, escríbele a @itsdlx.'
      : 'No pude traer el panel ahora. Prueba de nuevo en un rato.'} />;
  }
  const x = svs.find((s) => s.sv === sel) || svs[0];
  return <Servidor liga={liga} x={x} svs={svs} onSel={setSel} t={j.t} />;
}
