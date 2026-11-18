// 🎁 INVITA Y GANA (17/11/2026). Dlx: «agreguemos una nueva opción con el ícono de regalo… al costado de notificaciones…
// será un sistema de referrals», «podríamos hacer como un track», «que el link sea corto», «de cosa final pon algo
// buenísimo… como un marco especial» y «que el máximo sea 10 de momento».
//
// 🎟️ REHECHA EL 17/11/2026 (6.30; Dlx: «mejora esa página de referidos mucho más… que se vea mejor, más animaciones» y, a
// la maqueta criticada con Impeccable y con las animaciones revisadas con Emil, «dale, pasa la página de referidos así»).
// El link es una ENTRADA con talón («VALE 10 · QUEDAN 8») y lo que juntas, un TALONARIO de 10 casillas que se sellan.
// Una página, dos lados:
//   · QUIEN LLEGA por un link (`?ref=`, ver referidos.js) y todavía no está verificado: la página entera es suya —la
//     carta de quien lo invitó, los cuatro pasos con el que toca latiendo, y lo que le espera adentro—.
//   · QUIEN INVITA: su entrada de la temporada (`/i/<clave>`), el talonario con los premios y a quién trajo.
// Los números (cuánto paga, el tope, las metas) vienen del objeto (`refMio()`, REF_TRACK en bot/avisos.js): acá no se
// escribe ninguno, salvo el texto de quien todavía no entró (sin cuenta no se le pueden pedir).
// ⚠️ De los que todavía no cuentan el objeto manda sólo cuándo llegaron: no se sabe quién es hasta que se verifica, y la
// página no lo inventa.
import { useEffect, useState } from 'react';
import { capital, diaISO, hora, limpio, num, siglaDe, utc } from './liga.js';
import { Cara, Compartir, Ico, accion } from './piezas.jsx';
import { diaCrew } from './crews.js';
import { REF_ERROR, mandarRef, pedirRef, useRefPendiente } from './referidos.js';
import CSS_PAGINA from './css/invitar.css?inline';
import { usarCss } from './css.js';

usarCss('invitar', CSS_PAGINA);

const W = window;
const TRACK = [[1, [['drop', 1]]], [3, [['titulo', 'Reclutador']]], [5, [['drop', 2], ['pdt', 1500]]], [10, [['marco', 'embajador']]]];
const VISTO = 'lg:ref_visto';

const nombreK = (liga, k) => {
  const f = liga && ((liga.T && liga.T[k]) || (liga.X && liga.X[k]));
  return limpio((f && f.n) || k);
};
const premioTx = (pr) => {
  const [t, x] = pr || [];
  if (t === 'drop') return x === 1 ? 'Dragón Drop' : x + ' Dragón Drops';
  if (t === 'pdt') return num(x) + ' Puntos de Tienda';
  if (t === 'titulo') return 'Título «' + x + '»';
  if (t === 'marco') return 'Marco ' + (x === 'embajador' ? 'Embajador' : x);
  return '';
};
// el premio dicho en una frase: «te da un Dragón Drop», «para el título «Reclutador»»
const premioFrase = (pr) => {
  const [t, x] = pr || [];
  if (t === 'drop') return x === 1 ? 'un Dragón Drop' : x + ' Dragón Drops';
  if (t === 'titulo') return 'el título «' + x + '»';
  if (t === 'marco') return 'el marco ' + (x === 'embajador' ? 'Embajador' : x);
  return premioTx(pr);
};
const slugOg = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/** «hasta el 31/12, faltan 44 días», del fin de la temporada que trae el payload */
function vence(liga) {
  const fin = liga && liga.d && liga.d.fase && liga.d.fase.termina;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fin || ''))) return '';
  const [, m, d] = fin.split('-');
  const dias = Math.round((Date.parse(fin) - Date.parse(diaISO(new Date()))) / 864e5);
  if (dias < 0) return '';
  return 'hasta el ' + d + '/' + m + (dias === 0 ? ', hoy es el último día' : dias === 1 ? ', falta 1 día' : ', faltan ' + dias + ' días');
}

/** Cuántos torneos hubo en los últimos 7 días (sin los cancelados), redondeado para abajo a la decena */
function porSemana(liga) {
  const cal = (liga && liga.d && liga.d.calendario) || [];
  const ahora = Date.now(), desde = ahora - 7 * 864e5;
  const n = cal.filter((c) => { const t = Date.parse(c.t || c.cuando || ''); return t >= desde && t <= ahora && !(liga.esCancelado && liga.esCancelado(c)); }).length;
  return n >= 20 ? 'Más de ' + Math.floor(n / 10) * 10 + ' torneos de freestyle online por semana' : 'Torneos de freestyle online todas las semanas';
}

function leerVisto() { try { return Number(W.localStorage.getItem(VISTO)) || 0; } catch (e) { return 0; } }
function guardarVisto(n) { try { W.localStorage.setItem(VISTO, String(n)); } catch (e) { /* sin almacenamiento */ } }

// ───────────────────────────── quien llega por un link ─────────────────────────────

const ERR_LLEGO = {
  propio: ['Ése es tu propio link', 'Pásaselo a alguien que todavía no esté en la Liga.', 'Ir al Inicio', '#/inicio'],
  no_nuevo: ['Ya estabas en la Liga', 'Las invitaciones son para quien llega por primera vez. Lo tuyo sigue igual.', 'Ir al Inicio', '#/inicio'],
  cuenta_nueva: ['Tu cuenta de Discord es muy nueva', 'Para una invitación tiene que tener 30 días o más. Igual puedes entrar y jugar.', 'Ver los eventos', '#/eventos'],
  link_vencido: ['Ese link ya no está abierto', 'Pídele uno nuevo a quien te invitó. Igual puedes entrar y jugar.', 'Ver los eventos', '#/eventos'],
  lleno: ['Llegó al tope de invitados', 'Su talonario ya está completo. Igual puedes entrar y jugar.', 'Ver los eventos', '#/eventos'],
};

const PASOS = [
  ['Entra con Discord', 'Ahora, antes de verificarte: así la invitación queda a tu nombre.'],
  ['Verifícate', 'Con el rol de Miembro en Discord Rap Español (DRA), el servidor central de la Liga.'],
  ['Haz dos Tareas del Pase', 'Llegas al nivel 1 del Pase de rapero, y con él tu carta de Temporada.'],
  ['Recibes 500 Puntos de Tienda', 'Y quien te invitó suma una entrada a su talonario.'],
];

function Llegaste({ liga, dc, rp }) {
  const de = nombreK(liga, rp.k);
  const r = rp.r || '';
  useEffect(() => { if (dc && !r) mandarRef(); }, [dc && dc.id, r]);
  const carta = liga.cartaUrl(rp.k, liga.cartaDe(rp.k) || 'temporada');
  const [sinCarta, setSinCarta] = useState(false);
  const anotado = r === 'ok' || r === 'ya';
  const err = dc && r && !anotado ? (ERR_LLEGO[r] || ['No pude anotar la invitación', REF_ERROR[r] || 'Prueba de nuevo en un rato.', 'Ver los eventos', '#/eventos']) : null;
  const hecho = anotado ? 1 : 0;
  const prox = liga.proximos().filter((p) => utc(p.cuando).getTime() > Date.now() && !liga.esCancelado(p))
    .sort((a, b) => utc(a.cuando) - utc(b.cuando)).slice(0, 3);
  const hoy = diaISO(new Date()), manana = diaISO(new Date(Date.now() + 864e5));
  const dia = (t) => {
    const d = utc(t), x = diaISO(d);
    if (x === hoy) return 'Hoy';
    if (x === manana) return 'Mañana';
    return capital(W.fmtFecha ? W.fmtFecha(d.toISOString(), { weekday: 'long' }) : d.toLocaleDateString('es', { weekday: 'long' }));
  };
  return (
    <>
      <div className="escena rl-esc">
        <section className="rl-cab">
          {carta && !sinCarta ? <img className="rl-carta" src={carta} alt={'La carta de ' + de + ', que te invitó'} onError={() => setSinCarta(true)} />
            : <Cara liga={liga} k={rp.k} nombre={de} cls="cara rl-cara" grande />}
          <div className="rl-tx rf-entra">
            <span className="tag">UNA INVITACIÓN · {String(liga.temp || '').toUpperCase()}</span>
            <h1 className="hero-ev rl-h1">{de} te invitó a la Liga Global de Freestyle</h1>
            <p className="hero-p">{porSemana(liga)}, para todos los niveles.{err ? '' : ' Haz estos cuatro pasos y te llegan 500 Puntos de Tienda de bienvenida.'}</p>
            {err ? (
              <div className="rl-err" role="status">
                <b>{err[0]}</b>
                <span>{err[1]}</span>
                <a className="btn borde" href={err[3]}>{err[2]}</a>
              </div>
            ) : (
              <>
                <ol className="rl-pasos">
                  {PASOS.map(([t, s], i) => {
                    const ok = i < hecho, actual = i === hecho;
                    return (
                      <li key={t} className={'rl-paso' + (ok ? ' ok' : '') + (actual ? ' actual' : '')}>
                        <span className={'rl-punto' + (actual && !(dc && !r) ? ' late' : '')}>{ok ? <Ico n="ok" t={16} /> : i + 1}</span>
                        <span className="rl-paso-t"><b>{t}</b><small>{s}</small></span>
                        {i === 0 && !dc ? <span className="rl-paso-b"><button type="button" className="btn verde" onClick={accion.entrar}>Entrar con Discord</button></span> : null}
                        {i === 1 && anotado ? <span className="rl-paso-b"><a className="rl-link" href="#/cuenta/verificar">Cómo me verifico →</a></span> : null}
                      </li>
                    );
                  })}
                </ol>
                <p className="rl-estado" aria-live="polite">
                  {!dc ? 'Tu cuenta de Discord tiene que tener 30 días o más.'
                    : !r ? <><span className="rl-gira" aria-hidden="true" />Anotando tu invitación…</>
                      : REF_ERROR[r]}
                </p>
              </>
            )}
          </div>
        </section>
      </div>
      <section className="sec rl-adentro">
        <div className="sec-t"><h2>Lo que te espera adentro</h2></div>
        <div className={'rl-tres' + (prox.length ? '' : ' dos')}>
          <div className="rl-caja rl-caja-carta">
            <span className="rl-sil" aria-hidden="true">
              <svg viewBox="0 0 150 170" width="38" height="44"><circle cx="75" cy="52" r="38" /><path d="M8 168c4-44 32-66 67-66s63 22 67 66z" /></svg>
              <b>TU CARTA</b>
            </span>
            <span><b>Tu propia carta</b><small>Con tu nombre, tu país y tus números. Llega con el nivel 1 del Pase y sube con cada torneo.</small></span>
          </div>
          <div className="rl-caja">
            <b>Empiezas en Sexta</b>
            <small>Juegas un evento y entras en Sexta, la división de quien recién empieza: compites con gente de tu nivel y los primeros de cada grupo suben cada lunes.</small>
            <span className="rl-divs" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} className={i === 5 ? 'on' : ''} />)}</span>
          </div>
          {prox.length ? (
            <div className="rl-caja">
              <b>Los próximos torneos <em>· en tu hora</em></b>
              {prox.map((p) => (
                <a key={(p.link || p.nombre) + p.cuando} className="rl-ev" href={p.link || '#/eventos'} target={p.link ? '_blank' : undefined} rel="noreferrer">
                  <img src={liga.logo(p.sv)} alt="" width="28" height="28" loading="lazy" />
                  <span className="rl-ev-n"><b>{dia(p.cuando)} · {hora(p.cuando)}</b><small>{limpio(p.nombre)}</small></span>
                  <span className="rl-ev-sv">{siglaDe(p.sv)}</span>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

// ───────────────────────────── quien invita ─────────────────────────────

/** 🎟️ La entrada cerrada: sin cuenta, sin verificar o sin abrir todavía */
function Cerrada({ max, titulo, texto, candado, children }) {
  return (
    <div className="rf-lado">
      <div className="rf-tk off">
        <div className="rf-tk-cara">
          <span className="rf-tk-k">ENTRADA · LIGA GLOBAL DE FREESTYLE</span>
          <b className="rf-tk-n">{candado ? <Ico n="candado" t={22} /> : null}{titulo}</b>
          {texto ? <span className="rf-tk-p">{texto}</span> : null}
        </div>
        <div className="rf-tk-talon"><span>VALE {max}</span><b>—</b></div>
      </div>
      {children}
    </div>
  );
}

function TuLink({ liga, dc, R, abrir, va }) {
  const [rasga, setRasga] = useState(0);
  const max = (R && R.max) || 10;
  const T = String((R && R.temp) || liga.temp || '').toUpperCase();
  if (!dc) {
    return (
      <Cerrada max={max} titulo="Tu entrada se abre con tu cuenta" texto="Entra con Discord para tener tu link y empezar tu talonario." candado>
        <button type="button" className="btn verde rf-btn" onClick={accion.entrar}>Entrar con Discord</button>
      </Cerrada>
    );
  }
  if (!R) return <Cerrada max={max} titulo="Cargando tu entrada…" />;
  if (!R.puede) {
    return (
      <Cerrada max={max} titulo="Se abre al verificarte" texto="Tu link se abre cuando seas Miembro de Discord Rap Español (DRA): es lo mismo que te da tus cartas." candado>
        <a className="btn borde rf-btn" href="#/cuenta/verificar">Verificarme</a>
      </Cerrada>
    );
  }
  if (!R.activo) {
    return (
      <Cerrada max={max} titulo={'Tu entrada de la ' + T + ' está lista'} texto="Vale toda la temporada. Ábrela y pásasela a quien todavía no esté en la Liga.">
        <button type="button" className="btn verde rf-btn" disabled={va} onClick={abrir}>{va ? 'Abriendo…' : 'Abrir mi entrada de la ' + T}</button>
      </Cerrada>
    );
  }
  const url = 'https://underlegends.pages.dev/i/' + R.k;
  const quedan = Math.max(0, max - (R.hechos || 0));
  return (
    <div className="rf-lado">
      <div className="rf-tk">
        <div className="rf-tk-cara">
          <span className="rf-tk-k">ENTRADA · LIGA GLOBAL DE FREESTYLE</span>
          <b className="rf-tk-n">Invita {nombreK(liga, R.k)}</b>
          <code className="rf-url">{url.replace(/^https:\/\//, '')}</code>
          <span className="rf-tk-p">Quien entra con ella recibe <b>{num(R.bien)} Puntos de Tienda</b> de bienvenida.</span>
        </div>
        <div key={rasga} className={'rf-tk-talon' + (rasga ? ' rasga' : '')}>
          <span>VALE {max}</span><b>{quedan}</b><span>{quedan === 1 ? 'QUEDA' : 'QUEDAN'}</span>
        </div>
      </div>
      <div className="rf-comp" onClickCapture={() => setRasga((n) => n + 1)}>
        <Compartir url={url} texto="Únete a la Liga Global de Freestyle con mi link:" titulo="Liga Global de Freestyle" cls="btn verde rf-btn" etiqueta="Compartir mi link" />
      </div>
      <p className="rf-lado-p">En el celular se abre para mandarlo por donde quieras; en la compu se copia el link con el mensaje. Sólo cuenta gente <b>nueva</b>, con su cuenta de Discord de 30 días o más.</p>
    </div>
  );
}

/** 🎟️ El talonario: una casilla por invitado que puede contar, con los premios bajo sus metas */
function Talonario({ liga, R }) {
  const max = (R && R.max) || 10, hechos = Math.min(max, (R && R.hechos) || 0);
  const metas = (R && R.track) || TRACK;
  const lista = (R && R.lista) || [];
  const pend = lista.filter((x) => !x.cumple).length;
  const porN = {};
  lista.forEach((x) => { if (x.cumple && x.n) porN[x.n] = x; });
  // ✅ el sello cae sólo en las casillas nuevas desde la última vez que miraste: si sellara todas cada vez, dejaría de decir algo
  const [visto] = useState(leerVisto);
  useEffect(() => { if (R) guardarVisto(hechos); }, [R && hechos]);
  const premioDe = {};
  metas.forEach(([n, prs]) => { premioDe[n] = prs; });
  const prox = metas.find(([n]) => n > hechos);
  const falta = prox ? prox[0] - hechos : 0;
  const titulo = !prox ? 'Talonario completo: el marco Embajador es tuyo'
    : hechos === 0 && prox[0] === 1 ? 'Tu primera entrada te da ' + prox[1].map(premioFrase).join(' y ')
      : 'Te falta' + (falta === 1 ? ' 1' : 'n ' + falta) + ' para ' + prox[1].map(premioFrase).join(' y ');
  const casillas = [];
  for (let n = 1; n <= max; n++) {
    const yo = porN[n];
    const sellada = n <= hechos, camino = !sellada && n <= hechos + pend, fin = n === max && !sellada;
    const prs = premioDe[n];
    const nombre = yo && yo.k ? nombreK(liga, yo.k) : 'Invitado ' + n;
    casillas.push(
      <li key={n} className="rf-cas">
        <span className={'rf-cas-c' + (sellada ? ' sellada' : camino ? ' camino' : fin ? ' fin' : '')}>
          <i className="rf-cas-n">{n}</i>
          {sellada ? (
            <>
              <Cara liga={liga} k={yo && yo.k} nombre={nombre} cls="cara rf-cas-cara" lazy />
              <b className="rf-cas-nom">{nombre}</b>
              <em className={'rf-sello' + (n > visto ? ' nueva' : '')}>ADENTRO</em>
              <em className={'rf-sello rf-sello-ch' + (n > visto ? ' nueva' : '')}><Ico n="ok" t={12} /></em>
            </>
          ) : camino ? (
            <><span className="rf-late" /><small className="rf-cas-nom">en camino</small></>
          ) : fin ? (
            <span className="rf-marco" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.3 9.2l6.1-.6z" /></svg></span>
          ) : null}
        </span>
        {prs ? (
          <small className={'rf-cas-p' + (sellada ? ' ya' : prox && prox[0] === n ? ' rf-prox' : '')}>
            {sellada ? <span className="rf-cobrado"><Ico n="ok" t={13} />cobrado</span> : null}
            {prs.map(premioTx).join(' + ')}
          </small>
        ) : null}
      </li>,
    );
  }
  return (
    <section className="sec rf-tal-s">
      <div className="rf-tal-t">
        <h2>{titulo}</h2>
        <span className="rf-cuenta"><b>{hechos}</b> de {max} adentro</span>
      </div>
      <ol className="rf-tal" aria-label={hechos + ' de ' + max + ' invitados que ya cuentan'}>{casillas}</ol>
      <ol className="rf-premios">
        {metas.map(([n, prs]) => {
          const ya = hechos >= n, es = prox && prox[0] === n;
          return (
            <li key={n} className={(ya ? 'ya' : '') + (es ? ' rf-prox' : '') + (n === max ? ' fin' : '')}>
              <b>{n}</b>
              <span>{prs.map(premioTx).join(' + ')}</span>
              <small>{ya ? 'cobrado ✓' : es ? 'te falta' + (falta === 1 ? ' 1' : 'n ' + falta) : ''}</small>
            </li>
          );
        })}
      </ol>
      {R ? <p className="rf-nota">Y por cada uno que cuenta: <b>{num(R.pdt)} Puntos de Tienda</b> y <b>{num(R.xp)} XP del Pase</b>. A quien llega, {num(R.bien)} de bienvenida.</p> : null}
    </section>
  );
}

function Invitados({ liga, R }) {
  const [copiado, setCopiado] = useState(false);
  const xs = (R && R.lista) || [];
  if (!xs.length) return null;
  const ya = xs.filter((x) => x.cumple), pend = xs.filter((x) => !x.cumple);
  const max = R.max || 10;
  const texto = '¿Ya entraste a la Liga? Verifícate y haz dos Tareas del Pase: te llegan ' + num(R.bien) +
    ' Puntos de Tienda de bienvenida. https://underlegends.pages.dev/i/' + R.k;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch (e) { setCopiado(false); }
  };
  return (
    <div className="rf-col">
      <h2 className="rf-h2">Tus invitados</h2>
      <ul className="rf-iv-l">
        {ya.map((x, i) => {
          const n = x.k ? nombreK(liga, x.k) : 'Invitado ' + x.n;
          const dentro = (
            <>
              <Cara liga={liga} k={x.k} nombre={n} cls="cara rf-iv-c" lazy />
              <span className="rf-iv-t"><b>{n}</b>{x.t ? <small>Cuenta desde el {diaCrew(x.t)}</small> : null}</span>
              <span className="rf-iv-ok">Cuenta · {x.n} de {max}</span>
            </>
          );
          return <li key={'c' + i}>{x.k ? <a className="rf-iv" href={'#/r/' + encodeURIComponent(x.k)}>{dentro}</a> : <span className="rf-iv">{dentro}</span>}</li>;
        })}
        {pend.map((x, i) => (
          <li key={'p' + i}>
            <span className="rf-iv rf-iv-p">
              <span className="rf-iv-q" aria-hidden="true">?</span>
              <span className="rf-iv-t"><b>Alguien llegó el {diaCrew(x.t)}</b><small>Le falta verificarse y llegar al nivel 1 del Pase (dos Tareas)</small></span>
            </span>
          </li>
        ))}
      </ul>
      {pend.length ? (
        <div className="rf-rec">
          <b>¿Se trabó alguien? Pásale esto:</b>
          <p>«{texto}»</p>
          <button type="button" className="btn borde2 rf-btn" onClick={copiar} aria-live="polite">{copiado ? 'Copiado ✓' : 'Copiar recordatorio'}</button>
          <small>No sabemos quién es hasta que se verifique. El bot no manda mensajes privados: tú se lo pasas.</small>
        </div>
      ) : null}
    </div>
  );
}

/** Cómo se ve el link pegado en Discord: la miniatura que arma el ciclo (`bot/og_links.py`); si todavía no está, no va */
function EnDiscord({ liga, R }) {
  const [mal, setMal] = useState(false);
  if (!R || !R.activo || mal || !liga.d || !liga.d.r2) return null;
  const url = 'underlegends.pages.dev/i/' + R.k;
  return (
    <>
      <h2 className="rf-h2">Así se ve tu link en Discord</h2>
      <div className="rf-dc">
        <span>Únete a la Liga Global de Freestyle con mi link: <u>{url}</u></span>
        <span className="rf-dc-e">
          <b>{nombreK(liga, R.k)} te invita a la Liga Global de Freestyle</b>
          <img src={liga.d.r2 + '/og/ref/' + slugOg(R.k) + '.jpg'} alt="La miniatura de tu link" width="1200" height="630" loading="lazy" onError={() => setMal(true)} />
        </span>
      </div>
    </>
  );
}

const REGLAS = (
  <>
    <h2 className="rf-h2">Cómo cuenta</h2>
    <ul className="rf-reglas">
      <li>Sólo gente <b>nueva</b>: que no estaba verificada ni había usado la página antes de tu link.</li>
      <li>Tiene que entrar con Discord desde tu link, verificarse y hacer dos Tareas del Pase de rapero (nivel 1).</li>
      <li>Su cuenta de Discord tiene que tener <b>30 días o más</b>.</li>
      <li>Tu link vale una temporada; los que no trajeron a nadie se borran al terminarla.</li>
      <li>Por ahora, el tope es de <b>10 invitados</b> por persona.</li>
    </ul>
  </>
);

export function Invitar({ liga, dc }) {
  const rp = useRefPendiente();
  const [R, setR] = useState(null);
  const [va, setVa] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!dc) { setR(null); return undefined; }
    let vivo = true;
    pedirRef('ver').then((j) => { if (vivo && j && j.ok) setR(j); });
    return () => { vivo = false; };
  }, [dc && dc.id]);
  const abrir = async () => {
    setVa(true); setErr('');
    const j = await pedirRef('activar');
    setVa(false);
    if (j && j.ok) setR(j); else setErr(REF_ERROR[(j && j.error) || ''] || 'No pude abrir tu link: prueba en un rato.');
  };
  // quien llegó por un link de otro y todavía no está verificado: la página es suya (verificado, ya puede invitar)
  const llego = rp && !(R && R.k === rp.k) && !(R && R.puede);
  if (llego) return <div className="rf"><Llegaste liga={liga} dc={dc} rp={rp} /></div>;
  const max = (R && R.max) || 10;
  const hasta = vence(liga);
  const hay = !!(R && R.lista && R.lista.length);
  return (
    <div className="rf">
      <div className="escena rf-esc">
        <section className="rf-cab">
          <div className="rf-cab-tx rf-entra">
            <span className="tag">INVITA Y GANA · {String(liga.temp || '').toUpperCase()}</span>
            <h1 className="hero-ev rf-h1">Trae a tu gente a la Liga</h1>
            <p className="hero-p">Cada persona que entra con tu link, se verifica y llega al nivel 1 del Pase te da{' '}
              {R ? <b>{num(R.pdt)} Puntos de Tienda y {num(R.xp)} XP</b> : 'Puntos de Tienda y XP'}. Con {max}, el marco Embajador para todas tus cartas.</p>
            {hasta ? <p className="rf-vence">Tu link vale toda la {String(liga.temp || '').toUpperCase()}: {hasta}.</p> : null}
          </div>
          <TuLink liga={liga} dc={dc} R={R} abrir={abrir} va={va} />
        </section>
        {err ? <p className="rf-err" role="status">{err}</p> : null}
      </div>
      <Talonario liga={liga} R={R} />
      <section className="sec rf-dos-s">
        <div className={'rf-dos' + (hay ? '' : ' solo')}>
          {hay ? <Invitados liga={liga} R={R} /> : null}
          <div className="rf-col">
            <EnDiscord liga={liga} R={R} />
            {REGLAS}
          </div>
        </div>
      </section>
    </div>
  );
}
