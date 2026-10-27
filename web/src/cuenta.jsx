// Mi cuenta y Ajustes, juntos y como los ajustes de Discord. Dlx, 01/10/2026: «a mí me gusta como lo tiene Discord»,
// y antes de construirla, «genera PREVIEWS de cómo sería, así mismo como lo que hicimos con INICIO».
// `#/cuenta` es la lista; `#/cuenta/<parte>` abre una. En el celular se entra y se vuelve con «‹»; en la computadora,
// la lista a la izquierda y la parte a la derecha. Lo que hace cada cosa por dentro —entrar con Discord, la foto, las
// redes, la campana— sigue siendo de app.js: acá cambia la cara.
// ✅ EN LÍNEA ENTERA desde el 02/10/2026 (Dlx: «ajustes y cuenta separados, y me gusta cómo lo propusiste»). Lo que
// hace cada cosa por dentro —la foto, las redes, «tu servidor», salir— lo sigue haciendo app.js (`cuentaFotoSi()`,
// `cuentaRedes()`, `cuentaServidor()`, `cuentaSalir()`…) y esta página se entera de cada cambio por `lg:cuentaest`
// (App.jsx envuelve `pintaPopCuenta()`). Su ventana vieja queda de respaldo, si esto no se monta.
import { useEffect, useState } from 'react';
import { DUENO, PAIS, hora, limpio, nuevaQue, num, siglaDe } from './liga.js';
import { Bandera, Cara, Carta, Chevron, DosToques, GrillaDias, Ico, accion, diaET, masDias, semanasEntre, usePerfiles } from './piezas.jsx';
import { MiCrew } from './crewpanel.jsx';
import { crewDe } from './crews.js';
import { CaraDc } from './arriba.jsx';
import { useRacha } from './racha.js';
import { TEMAS_SV, nivelTema, nombreTema } from './temas.js';
import { useRoles } from './roles.js';
import { urlFondo } from './fondos.js';
import { useSocio } from './panelsocio.js';
import { seguirOrg, useOrgs } from './orgs.js';

import { PasosInstalar } from './instalar.jsx';
import { FraseEditor } from './frase.jsx';
import CSS_PAGINA from './css/cuenta.css?inline';
import { usarCss } from './css.js';
import { achicar as achicarImagen, aBase64 } from './imagen.js';

// 🎨 su CSS, con su pedazo (web/src/css/cuenta.css)
usarCss('cuenta', CSS_PAGINA);

const leer = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const W = typeof window !== 'undefined' ? window : {};

// lo tuyo que guarda app.js —tu Discord, la foto, las redes, «tu servidor», quién te sigue—, leído de nuevo cada vez
// que cambia: app.js vuelve a pintar su ventana (`lg:cuentaest`) o cambia quién sos (`lg:cuenta`)
function useCuentaEst() {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    W.addEventListener('lg:cuentaest', f);
    W.addEventListener('lg:cuenta', f);
    return () => { W.removeEventListener('lg:cuentaest', f); W.removeEventListener('lg:cuenta', f); };
  }, []);
  return { FOTO: W.FOTO || null, REDES: W.REDES_MIAS || null, token: !!W.DC_TOKEN, MISV: W.MISV || null,
    MISV_EST: W.MISV_EST || {}, ME_SIGUEN: W.ME_SIGUEN || null, MIFOTO: W.MIFOTO || null, MIFOTO_EST: W.MIFOTO_EST || {} };
}

// la zona y el formato de hora: los ajustes de app.js (`AJ`, `ZONAS`)
function horaYZona() {
  const aj = W.AJ || leer('lg:ajustes', {}) || {};
  const zonas = W.ZONAS || [];
  const z = (zonas.find((x) => x[0] === (aj.tz || '')) || ['', 'La de este dispositivo'])[1];
  const f = aj.h12 === true ? '12 h' : (aj.h12 === false ? '24 h' : 'automático');
  return { aj, zonas, z, f };
}

// guarda un ajuste donde lo guarda app.js (`AJ` en `lg:ajustes`, el mismo objeto) y vuelve a pintar las horas: así la
// página de hoy y el Inicio nuevo dicen lo mismo. `undefined` borra la clave (vuelve a «automático»)
function guardarAjustes(cambio) {
  const aj = W.AJ && typeof W.AJ === 'object' ? W.AJ : (W.AJ = {});
  Object.keys(cambio).forEach((k) => { if (cambio[k] === undefined) delete aj[k]; else aj[k] = cambio[k]; });
  try { if (W.guardarLS) W.guardarLS('lg:ajustes', aj); else localStorage.setItem('lg:ajustes', JSON.stringify(aj)); } catch (e) { /* sin guardar */ }
  try { if (W.aplicarCalma) W.aplicarCalma(); else document.documentElement.classList.toggle('calma', !!aj.calma); } catch (e) { /* nada */ }
  try { if (W.repintarHoras) W.repintarHoras(); } catch (e) { /* nada */ }
  W.dispatchEvent(new Event('lg:ajustes'));
}

function ParteHora() {
  const [, refrescar] = useState(0);
  const { aj, zonas, z } = horaYZona();
  const h = aj.h12 === true ? '12' : (aj.h12 === false ? '24' : '');
  const poner = (c) => { guardarAjustes(c); refrescar((x) => x + 1); };
  return (
    <>
      <Caja t="Formato" d={'Ahora: ' + hora(new Date().toISOString())}>
        <div className="x-seg cu-seg" role="group" aria-label="Formato de la hora">
          {[['', 'Automático'], ['12', '12 h'], ['24', '24 h']].map(([v, n]) => (
            <button type="button" key={n} aria-pressed={h === v} onClick={() => poner({ h12: v ? v === '12' : undefined })}>{n}</button>
          ))}
        </div>
      </Caja>
      <Caja t="Zona" d={'Las horas de la página van en: ' + z + '.'}>
        <ul className="cu-lista radio" role="radiogroup" aria-label="Zona horaria">{zonas.map(([v, n]) => (
          <li key={n} className={(aj.tz || '') === v ? 'on' : ''}>
            <button type="button" role="radio" aria-checked={(aj.tz || '') === v} className="cu-radio" onClick={() => poner({ tz: v || undefined })}><b>{n}</b><i aria-hidden="true" /></button>
          </li>
        ))}</ul>
      </Caja>
    </>
  );
}

function ParteCalma() {
  const [calma, setCalma] = useState(() => !!((W.AJ || {}).calma));
  return (
    <Caja t="Movimiento" d="Con menos animaciones, el escenario del Inicio no pasa solo y la página se mueve lo menos posible.">
      <label className="cu-sw"><span><b>Menos animaciones</b></span>
        <input type="checkbox" checked={calma} onChange={(e) => { setCalma(e.target.checked); guardarAjustes({ calma: e.target.checked || undefined }); }} /><i aria-hidden="true" /></label>
    </Caja>
  );
}

// paso a paso y con un dibujo por paso: ver web/src/instalar.jsx (Dlx, 01/10/2026: «sé más específico»)
function ParteInstalar() {
  return (
    <Caja t="La Liga en tu celular" d="Instalada, queda en tu pantalla de inicio y se abre de un toque, como cualquier app. En el iPhone es además lo que habilita los avisos de eventos.">
      <PasosInstalar />
    </Caja>
  );
}

// las partes, en grupos, como Discord. Dlx, 01/10/2026: «creo que ajustes tendría su propia sección»: Mi cuenta era
// lo tuyo y Ajustes lo de la página en este dispositivo.
// 🔑 UNA SOLA PÁGINA, «VOS», DESDE EL 19/10/2026 (Dlx: «la pestaña de mi perfil o mi cuenta y quizás ajustes es muy
// confusa», y a las dos opciones: «1, a»): «Mi cuenta» dejó de ser una pestaña —entrar, salir y verificado viven en la
// cabecera (`Quien`)—, Ajustes dejó de ser otra página (el ⚙ de arriba abre «La app» acá mismo) y los grupos son por lo
// que la persona quiere hacer: tu perfil, tu gente, avisos, la app, ayuda y tus datos. `#/ajustes/<parte>` sigue
// abriendo lo mismo, para los links que ya circulan
function grupos(liga, dc, tema, temaSv) {
  const yo = liga.yo;
  const { z, f, aj } = horaYZona();
  const C = W.CAMBIOS;
  const ult = Array.isArray(C) && C[0] ? C[0].version : '';
  const nuevo = !!ult && nuevaQue(ult, W.CAMBIOS_VISTO);
  const avisos = !!leer('campana:activada', false);
  const crew = crewDe(dc && dc.clave);
  return [
    ['TU PERFIL', [
      ['perfil', 'perfil', 'Foto y redes', yo ? 'tu foto, tu frase, tus redes y tu servidor' : 'lo que los demás ven de ti'],
      ['fondo', 'tema', 'Tu fondo', 'tu imagen, con el nivel 10 del Pase'],
    ]],
    ['TU GENTE', [
      // 👥 las crews que arma la gente (19/10/2026): la tuya y tus invitaciones; armar una, en Crews (3.73)
      ['crew', 'socios', 'Mi crew', crew ? 'la tuya: ' + limpio(crew.c.nombre) : 'tus invitaciones; se arman en Crews'],
      ['siguiendo', 'seguir', 'Siguiendo', liga.sigue.length ? liga.sigue.length + (liga.sigue.length === 1 ? ' rapero' : ' raperos') : 'todavía nadie'],
    ]],
    ['AVISOS', [
      ['avisos', 'campana', 'Avisos de eventos', avisos ? 'activados en este dispositivo' : 'apagados'],
    ]],
    ['LA APP', [
      ['apariencia', 'tema', 'Apariencia', nombreTema(tema, temaSv)],
      ['hora', 'reloj', 'Hora y zona', f + ' · ' + z],
      ['accesibilidad', 'calma', 'Accesibilidad', aj.calma ? 'menos animaciones' : 'animaciones normales'],
      ['instalar', 'instalar', 'Instalar la app', 'en tu pantalla de inicio'],
    ]],
    ['AYUDA Y TUS DATOS', [
      ['privacidad', 'candado', 'Privacidad y mis datos', 'tu foto, lo que guardamos y este dispositivo'],
      // 🙋 los pedidos (17/10/2026): perdí mi cuenta, ese no soy yo, mi país, un video que no es mío
      ['algo-mal', 'aviso', 'Algo está mal', 'perdí mi cuenta, mi país, un video…'],
      ['guia', 'guia', 'Guía', 'cómo funciona la Liga'],
      ['novedades', 'novedades', 'Novedades', ult ? 'v' + ult + (nuevo ? ' · NUEVO' : '') : 'el changelog'],
      ['legal', 'legal', 'Términos y privacidad', 'las reglas y lo que guardamos'],
    ]],
  ];
}

// ⭐ CÓMO SUBIR DE NIVEL (Dlx, 14/10/2026: «haz que otras y muchas cosas más te hagan subir de nivel… no me refiero a
// nivel de pase»): cada cosa que suma, cuánto da y cuánto llevás, con su tope. Los números son del servidor (`XP_FUENTES`
// y `xp_de` de `rachaDe()` en bot/avisos.js); acá sólo se muestran
function ComoSubir({ R }) {
  const de = R.xp_de || {};
  const fuentes = R.xp_fuentes || {};
  const filas = [['ev', 'Jugar un evento', R.xp_ev, 0], ['dia', 'Cada día que entras o juegas', R.xp_dia, 0]]
    .concat(Object.entries(fuentes).map(([k, [vale, tope, txt]]) => [k, txt, vale, tope]));
  return (
    <details className="cu-xp">
      <summary>Cómo subir de nivel</summary>
      <ul>{filas.map(([k, txt, vale, tope]) => {
        const [n, xp] = de[k] || [0, 0];
        const lleno = tope && n >= tope;
        return (
          <li key={k} className={(n ? 'si' : '') + (lleno ? ' lleno' : '')}>
            <span>{txt}</span>
            <b>+{vale}</b>
            <small>{tope === 1 ? (n ? 'hecho' : 'una vez') : tope ? n + ' de ' + tope : n ? num(xp) + ' XP' : 'sin tope'}</small>
          </li>
        );
      })}</ul>
      <p>Cada cosa cuenta una vez (seguir a la misma persona dos veces es una) y las que tienen tope dejan de sumar al llegar. Jugar es lo que más da.</p>
    </details>
  );
}

// ── 🔥 tu racha diaria y tu nivel, debajo de quién sos (Dlx, 04/10/2026). La cuenta es del servidor ──────────────
// 📅 LA RACHA COMO CALENDARIO (Dlx, 19/10/2026, «me gustan todas», a «Habit Tracker Calendar» de 21st): las últimas
// cinco semanas, L a D, con los días que contaron (`R.dias`, del servidor) y, encima, los que jugaste (tus eventos, de
// `/api/perfiles`, pasados a día del este). Hoy lleva su aro; lo que viene, apagado. Una racha se entiende de un vistazo
// cuando se ve la tira de días llenos, no cuando se lee «3 días seguidos»
function CalendarioRacha({ R, liga }) {
  const P = usePerfiles();
  const yo = liga && liga.yo;
  const hoy = R.hoy || diaET();
  const jugo = new Set();
  if (P && yo && P.p && P.p[yo.k]) {
    ((P.p[yo.k] || {}).ev || []).forEach(([n]) => { const x = (P.e || {})[n] || (P.e || {})[String(n)]; if (x && x[2]) jugo.add(diaET(Date.parse(x[2]))); });
  }
  const conto = new Set(R.dias || []);
  const semanas = semanasEntre(masDias(hoy, -28), hoy);
  const marca = (iso) => (jugo.has(iso) ? { cls: 'jugo', t: 'Jugaste' } : conto.has(iso) ? { cls: 'conto', t: 'Entraste' } : null);
  return (
    <div className="cu-cal">
      <GrillaDias semanas={semanas} marca={marca} hoy={hoy} etiqueta="Tus últimas cinco semanas" />
      <ul className="gd-ley">
        <li><b>{semanas.flat().filter((d) => d <= hoy && (conto.has(d) || jugo.has(d))).length} de {semanas.flat().filter((d) => d <= hoy).length} días</b></li>
        <li><i className="gd-c conto" />entraste</li><li><i className="gd-c jugo" />jugaste</li><li><i className="gd-c hoy" />hoy</li>
      </ul>
    </div>
  );
}

function RachaNivel({ dc, liga }) {
  const R = useRacha(!!dc);
  if (!R) return null;
  const { racha: r, nivel: n } = R;
  const tramo = Math.max(1, n.sig - n.base);
  const pct = Math.max(0, Math.min(100, Math.round(100 * (n.xp - n.base) / tramo)));
  const dias = (x) => x + (x === 1 ? ' día' : ' días');
  return (
    <div className="cu-rn">
      <div className="cu-rn-c">
        <b className="cu-con"><Ico n="fuego" t={18} />{r.actual ? dias(r.actual) + ' seguidos' : 'Sin racha todavía'}</b>
        <small>{r.actual ? (r.hoy ? 'Hoy ya contó. ' : 'Entra o juega hoy para no cortarla. ') : 'Cuenta cada día que usas el bot, entras con tu cuenta o juegas un evento. '}
          {R.hito ? <>A los {dias(R.hito[0])} seguidos: <b>+{num(R.hito[1])} Puntos de Tienda</b>. </> : null}El premio de cada día se cobra en el Inicio.{r.maxima > r.actual ? ' Tu mejor racha: ' + dias(r.maxima) + '.' : ''}</small>
        <CalendarioRacha R={R} liga={liga} />
      </div>
      <div className="cu-rn-c">
        <b>Nivel {n.n}</b>
        <span className="cu-rn-barra" role="progressbar" aria-label={'Nivel ' + n.n} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: pct + '%' }} /></span>
        <small>{n.xp - n.base} de {tramo} para el nivel {n.n + 1}. Sube jugando, entrando cada día y con lo que haces en la Liga.</small>
        <ComoSubir R={R} />
      </div>
    </div>
  );
}

// ── la tarjeta de arriba: quién sos, como el «Tú» de Discord ──────────────────────────────────────
// ⭕ EL NIVEL DEL PASE COMO ANILLO ALREDEDOR DE TU FOTO (Dlx, 19/10/2026, «me gustan todas», a «Circle Progress» de
// 21st): cuánto te falta para el próximo nivel se ve sin leer. Un SVG con dos círculos, sin degradé (el remake no los
// usa); el número, en una pastilla abajo a la derecha. Sin cuenta (o sin racha cargada) no hay anillo
function AnilloNivel({ dc }) {
  const R = useRacha(!!dc);
  if (!R || !R.nivel) return null;
  const n = R.nivel;
  const tramo = Math.max(1, n.sig - n.base);
  const pct = Math.max(0, Math.min(1, (n.xp - n.base) / tramo));
  const r = 46, c = 2 * Math.PI * r;
  return (
    <>
      <svg className="cu-anillo" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--suave)" strokeWidth="6" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--magenta)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)} transform="rotate(-90 50 50)" />
      </svg>
      <b className="cu-anillo-n" title={'Nivel ' + n.n + ' · ' + Math.round(pct * 100) + ' % al ' + (n.n + 1)}>{n.n}</b>
    </>
  );
}

// 🎨 el color del cuadradito de cada fila, como en la maqueta (20/10/2026): verde lo tuyo, magenta tu gente; el resto, gris
const ICO_COLOR = { perfil: 'v', fondo: 'v', crew: 'm', siguiendo: 'm' };

function Quien({ liga, dc }) {
  const yo = liga.yo;
  if (!yo && !dc) {
    return (
      <div className="cu-quien anon">
        <span className="cu-av anon"><Ico n="yo" t={30} /></span>
        <div className="cu-q"><b>Todavía no entraste</b><small>Entra con Discord y ves tu puesto, tus tarjetas y tus avisos, y puedes seguir a otros.</small></div>
        <button type="button" className="btn verde" onClick={accion.entrar}>Entrar con Discord</button>
      </div>
    );
  }
  const s = yo && liga.svs[yo.sv];
  return (
    <div className="cu-quien" style={{ '--cu-c': (s && s.color) || '#29B298' }}>
      <span className="cu-av-con">
        {yo ? <Cara liga={liga} k={yo.k} nombre={yo.n} cls="cu-av" /> : <CaraDc dc={dc} cls="cu-av" />}
        <AnilloNivel dc={dc} />
      </span>
      <div className="cu-q">
        <b>{limpio(yo ? yo.n : dc.n)}</b>
        {/* 🪪 la línea de estado, como en la maqueta que eligió Dlx (20/10/2026): quién sos para la Liga, en tres datos */}
        <small className="cu-estado">{[
          dc && dc.rapero ? 'Verificado' : dc ? 'Con Discord' : 'Sin entrar',
          yo && yo.rg ? 'Rango ' + yo.rg : (yo ? 'Sin rango todavía' : ''),
          s ? limpio(s.nombre || yo.sv) : '',
        ].filter(Boolean).join(' · ')}</small>
        {yo ? <span className="cu-datos">{yo.pos ? '#' + yo.pos + ' de la ' + liga.temp : 'Sin puesto todavía'} · OVR {yo.ovr || '—'} · {yo.ev || 0} {yo.ev === 1 ? 'evento' : 'eventos'}</span>
          // 🔴 UN RAPERO QUE TODAVÍA NO JUGÓ LA TEMPORADA NO ES «SIN TARJETA»: el día del arranque es el caso de todos
          : <span className="cu-datos">{dc && dc.rapero ? 'Todavía no jugaste esta temporada.' : 'Todavía sin tarjeta.'}</span>}
      </div>
      <div className="cu-ver cu-acciones">
        {yo ? <a className="btn verde chico" href={'#/r/' + encodeURIComponent(yo.k)}>Ver mi perfil público</a>
          : dc && dc.clave ? <a className="btn verde chico" href={'#/r/' + encodeURIComponent(dc.clave)}>Ver mi perfil público</a>
          : <a className="btn verde chico" href="#/cuenta/verificar">Verificarme</a>}
        {/* salir (o «no soy yo») vive acá desde la 3.74: antes era el último botón de la lista, debajo de todo */}
        <button type="button" className="btn borde2 chico" onClick={accion.salir}>{dc ? 'Salir' : 'No soy yo'}</button>
      </div>
      {/* la sesión de antes del 25/09 no trae la clave: es un toque, `prompt=none` no vuelve a pedir nada */}
      {dc && dc.rapero && !dc.clave ? (
        <p className="cu-d cu-ver">Tu sesión es de una versión anterior. Actualizala para ver tus tarjetas y tu perfil: es un toque, no te pide nada.{' '}
          <button type="button" className="btn borde2 chico" onClick={accion.entrar}>Actualizar mi cuenta</button></p>
      ) : null}
      <RachaNivel dc={dc} liga={liga} />
    </div>
  );
}

// ── cada parte ───────────────────────────────────────────────────────────────────────────────────
// el botón de entrar de cada parte (se abre una por vez, también en la compu desde el 20/10/2026)
function BotonEntrar({ chico = true }) {
  return <button type="button" className={'btn verde' + (chico ? ' chico' : '')} onClick={accion.entrar}>Entrar con Discord</button>;
}

function Caja({ t, children, d }) {
  return <section className="cu-caja"><h3>{t}</h3>{d ? <p className="cu-d">{d}</p> : null}{children}</section>;
}

// ── 🖼️ TU FONDO (13/10/2026). Dlx, a «una imagen propia para tu cuenta para el fondo»: «Sí, y mientras tanto con el Pase
// gratis», y dónde, «que él decida, pero por default en ambos». Con el nivel 10 del Pase subís una imagen; la ven los
// demás recién cuando la aprueba la Liga, y elegís si va en tu perfil, de fondo de tu página, o los dos. La imagen se
// achica acá antes de mandarla: 1600×640 recortada al centro, en webp, bajo los 600 KB (ver `fondo()` en avisos.js) ──
const FONDO_W = 1600, FONDO_H = 640, FONDO_TOPE = 600 * 1024;

const achicar = (archivo, AN = FONDO_W, AL = FONDO_H, TOPE = FONDO_TOPE) => achicarImagen(archivo, AN, AL, TOPE);

async function pedirFondo(ruta, cuerpo) {
  const r = await fetch('/api/avisos/' + ruta, { method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const e = { nivel: 'Se desbloquea con el nivel ' + (j.falta || 10) + ' del Pase de rapero.', tope: 'Ya subiste varias hoy: prueba mañana.',
      'no es una imagen': 'Eso no es una imagen.', 'demasiado grande': 'La imagen es muy pesada.',
      metadatos: 'La imagen trae datos escondidos (como dónde se sacó): elígela de nuevo desde acá y se limpian solos.',
      // 🛡️ el filtro automático (13/10/2026): no entra, y se dice por qué
      filtro: 'Esa imagen no pasó el filtro automático' + (j.texto ? ': parece tener ' + j.texto : '') + '. Elige otra.' }[j.error];
    throw new Error(r.status === 401 ? 'Entra con Discord de nuevo.' : e || j.error || String(r.status));
  }
  return j;
}

export function FondoCaja({ dc }) {
  const [st, setSt] = useState(null);
  const [vista, setVista] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!dc) return undefined;
    let vivo = true;
    pedirFondo('mi-fondo').then((j) => { if (vivo) setSt(j); }).catch((e) => { if (vivo) setMsg(e.message); });
    return () => { vivo = false; };
  }, [dc && dc.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!dc) return <Caja t="Tu fondo" d="Entra con Discord para poner tu propia imagen de fondo." />;
  if (!st) return <Caja t="Tu fondo"><p className="cu-d">{msg || 'Cargando…'}</p></Caja>;
  const f = st.fondo, pu = st.puede || {};
  const perfil = f ? f.perfil : true, pagina = f ? f.pagina : true;
  const elegir = async (e) => {
    const a = e.target.files && e.target.files[0];
    if (!a) return;
    setMsg('');
    try { const b = await achicar(a); setArchivo(b); setVista(URL.createObjectURL(b)); } catch (er) { setMsg('No pude usar esa imagen: ' + er.message); }
  };
  const mandar = async (cuerpo) => {
    setOcup(true); setMsg('');
    try {
      const j = await pedirFondo('fondo', cuerpo);
      setSt(j);
      if (cuerpo.img) {
        setArchivo(null); setVista('');
        // 🛡️ limpia se ve ya; si el filtro no estuvo seguro, la mira la Liga
        setMsg(j.filtro === 'ok' ? 'Listo: ya se ve.' : 'El filtro automático no estuvo seguro: la mira la Liga y, cuando la apruebe, se ve.');
      }
    } catch (er) { setMsg(er.message); }
    setOcup(false);
  };
  const subir = async () => { if (archivo) await mandar({ img: await aBase64(archivo), perfil, pagina }); };
  const estado = !f ? '' : f.pend ? 'En revisión: el filtro automático no estuvo seguro y la mira la Liga.' : f.estado === 'no' ? 'No se aprobó' + (f.motivo ? ': ' + f.motivo : '') + '. Puedes subir otra.' : 'Ya se ve.';
  return (
    <Caja t="Tu fondo" d={pu.si ? 'Tu propia imagen de fondo. Pasa por un filtro automático: sin desnudos, sangre, violencia, odio ni datos personales.' : 'Tu propia imagen de fondo, en tu perfil y en tu página.'}>
      {!pu.si && !(f && f.url) ? <p className="cu-d">🔒 Se desbloquea con el <b>nivel {pu.falta || 10}</b> del <a href="#/pase">Pase de rapero</a>{pu.nivel != null ? ' (vas en el ' + pu.nivel + ')' : ''}.</p> : null}
      {f && urlFondo(f.pend || f.url) ? <div className="cu-fondo-ver" style={{ backgroundImage: urlFondo(f.pend || f.url) }} aria-label="Tu fondo" role="img" /> : null}
      {estado ? <p className="cu-d">{estado}</p> : null}
      {f ? (
        <div className="cu-fondo-donde">
          <label><input type="checkbox" checked={perfil} disabled={ocup} onChange={(e) => mandar({ perfil: e.target.checked, pagina })} /> En mi perfil (lo ven todos)</label>
          <label><input type="checkbox" checked={pagina} disabled={ocup} onChange={(e) => mandar({ perfil, pagina: e.target.checked })} /> De fondo de mi página (lo veo yo)</label>
        </div>) : null}
      {pu.si ? <>
        {vista ? <div className="cu-fondo-ver" style={{ backgroundImage: 'url("' + vista + '")' }} aria-label="La que vas a subir" role="img" /> : null}
        <div className="cu-btns">
          <label className="btn borde2 chico cu-fondo-arch">{f ? 'Elegir otra imagen' : 'Elegir una imagen'}<input type="file" accept="image/*" onChange={elegir} /></label>
          {archivo ? <button type="button" className="btn verde chico" disabled={ocup} onClick={subir}>{ocup ? 'Subiendo…' : 'Subir'}</button> : null}
          {f ? <button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => mandar({ borrar: true })}>Quitar mi fondo</button> : null}
        </div>
      </> : null}
      {msg ? <p className="cu-d" role="status">{msg}</p> : null}
    </Caja>
  );
}

// ── 📸 TU FOTO DE TARJETA (13/10/2026). Dlx: «la opción de foto personalizable de la tarjeta y quizás la opción de
// cambiarla para cada tarjeta… agrega un filtro a eso también», y a las preguntas: «Nivel 15 gratis», «Una por
// tarjeta», «Una por semana». Una imagen tuya en vez de la de Discord, en las tarjetas que elijas: pasa por el filtro
// automático (`fotoCarta()` en avisos.js) y cada tarjeta se cambia una vez por semana. Se achica acá: 768×768 ──
const FOTO_LADO = 768, FOTO_TOPE = 500 * 1024;
const CARTAS_FOTO = [['temporada', 'Temporada'], ['competitivo', 'Competitiva'], ['servidor', 'Servidor'], ['pais', 'País']];
const nombresCartas = (cs) => (cs || []).map((c) => (CARTAS_FOTO.find((x) => x[0] === c) || [c, c])[1]).join(', ');
const fechaLarga = (ms) => (W.fmtFecha ? W.fmtFecha(new Date(ms).toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })
  : new Date(ms).toLocaleDateString());

async function pedirFotoCarta(ruta, cuerpo) {
  const r = await fetch('/api/avisos/' + ruta, { method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const e = { nivel: 'Se desbloquea con el nivel ' + (j.falta || 15) + ' del Pase de rapero.', tope: 'Ya probaste varias hoy: prueba mañana.',
      semana: 'La foto de ' + nombresCartas(j.cartas) + ' ya la cambiaste esta semana: se vuelve a abrir el ' + (j.desde ? fechaLarga(j.desde) : 'que viene') + '.',
      sin_perfil: 'Primero necesitas tu tarjeta: verifícate en la página.', 'elige en qué tarjetas': 'Elige en qué tarjetas va.',
      'no es una imagen': 'Eso no es una imagen.', 'demasiado grande': 'La imagen es muy pesada.',
      metadatos: 'La imagen trae datos escondidos (como dónde se sacó): elígela de nuevo desde acá y se limpian solos.',
      filtro: 'Esa imagen no pasó el filtro automático' + (j.texto ? ': parece tener ' + j.texto : '') + '. Elige otra.' }[j.error];
    throw new Error(r.status === 401 ? 'Entra con Discord de nuevo.' : e || j.error || String(r.status));
  }
  return j;
}

export function FotoCartaCaja({ dc }) {
  const [st, setSt] = useState(null);
  const [vista, setVista] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [sel, setSel] = useState(null);
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!dc || !dc.clave) return undefined;
    let vivo = true;
    pedirFotoCarta('mi-foto-carta').then((j) => { if (vivo) setSt(j); }).catch((e) => { if (vivo) setMsg(e.message); });
    return () => { vivo = false; };
  }, [dc && dc.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const T = 'Tu foto de tarjeta';
  if (!dc) return <Caja t={T} d="Entra con Discord para poner tu propia foto en tus tarjetas." />;
  if (!dc.clave) return <Caja t={T} d="Primero necesitas tu tarjeta: verifícate en la página." />;
  if (!st) return <Caja t={T}><p className="cu-d">{msg || 'Cargando…'}</p></Caja>;
  const pu = st.puede || {}, cs = st.cartas || {}, ahora = Date.now();
  const libre = (c) => !cs[c] || !cs[c].desde || cs[c].desde <= ahora;
  const elegidas = sel || CARTAS_FOTO.map(([c]) => c).filter(libre);
  const tocar = (c) => setSel(elegidas.includes(c) ? elegidas.filter((x) => x !== c) : elegidas.concat([c]));
  const elegir = async (e) => {
    const a = e.target.files && e.target.files[0];
    if (!a) return;
    setMsg('');
    try { const b = await achicar(a, FOTO_LADO, FOTO_LADO, FOTO_TOPE); setArchivo(b); setVista(URL.createObjectURL(b)); } catch (er) { setMsg('No pude usar esa imagen: ' + er.message); }
  };
  const mandar = async (cuerpo) => {
    setOcup(true); setMsg('');
    try {
      const j = await pedirFotoCarta('foto-carta', cuerpo);
      setSt(j);
      if (cuerpo.img) {
        setArchivo(null); setVista(''); setSel(null);
        setMsg(j.filtro === 'ok' ? 'Listo: sale en ' + nombresCartas(cuerpo.cartas) + ' en la próxima vuelta del ciclo (cada media hora; de 3 a 11 AM, hora del este, no corre).'
          : 'El filtro automático no estuvo seguro: la mira la Liga y, cuando la apruebe, sale en tus tarjetas.');
      } else setMsg('Listo: esa tarjeta vuelve a tu foto de Discord en la próxima vuelta del ciclo.');
    } catch (er) { setMsg(er.message); }
    setOcup(false);
  };
  const subir = async () => { if (archivo && elegidas.length) await mandar({ img: await aBase64(archivo), cartas: elegidas }); };
  return (
    <Caja t={T} d={pu.si ? 'Una imagen tuya en vez de la de Discord, en las tarjetas que elijas. Pasa por un filtro automático y cada tarjeta se cambia una vez por semana.'
      : 'Una imagen tuya en vez de la de Discord, en cada tarjeta.'}>
      {!pu.si ? <p className="cu-d">🔒 Se desbloquea con el <b>nivel {pu.falta || 15}</b> del <a href="#/pase">Pase de rapero</a>{pu.nivel != null ? ' (vas en el ' + pu.nivel + ')' : ''}.</p> : null}
      <ul className="cu-fotos-carta">{CARTAS_FOTO.map(([c, n]) => {
        const x = cs[c] || {};
        const que = x.pend ? 'En revisión' : x.estado === 'ok' ? 'Tu foto' : 'La de Discord';
        return (
          <li key={c}>
            {x.url && !x.pend ? <span className="cu-foto-mini" style={{ backgroundImage: 'url("' + x.url + '")' }} role="img" aria-label={'Tu foto en la ' + n} /> : <span className="cu-foto-mini vacia" aria-hidden="true" />}
            <b>{n}</b><small>{que}{!libre(c) ? ' · se cambia desde el ' + fechaLarga(x.desde) : ''}</small>
            {x.estado === 'ok' ? <button type="button" className="evp-lnk" disabled={ocup} onClick={() => mandar({ borrar: [c] })}>Volver a la de Discord</button> : null}
          </li>);
      })}</ul>
      {pu.si ? <>
        {vista ? <div className="cu-foto-ver" style={{ backgroundImage: 'url("' + vista + '")' }} aria-label="La que vas a subir" role="img" /> : null}
        {archivo ? <div className="cu-fondo-donde">{CARTAS_FOTO.map(([c, n]) => (
          <label key={c}><input type="checkbox" checked={elegidas.includes(c)} disabled={ocup || !libre(c)} onChange={() => tocar(c)} /> {n}</label>
        ))}</div> : null}
        <div className="cu-btns">
          <label className="btn borde2 chico cu-fondo-arch">{archivo ? 'Elegir otra imagen' : 'Elegir una imagen'}<input type="file" accept="image/*" onChange={elegir} /></label>
          {archivo ? <button type="button" className="btn verde chico" disabled={ocup || !elegidas.length} onClick={subir}>{ocup ? 'Revisando…' : 'Subir'}</button> : null}
        </div>
        <p className="cu-d">Si ocultaste tu foto, tus tarjetas siguen con la silueta.</p>
      </> : null}
      {msg ? <p className="cu-d" role="status">{msg}</p> : null}
    </Caja>
  );
}

// ── Mi perfil: la foto, las redes y tu servidor. Los mismos estados que la ventana de app.js (`secFoto()`,
// `secRedes()`, `secMiServidor()`), con lo que hace cada botón allá ──
function FotoCaja({ liga, dc }) {
  const est = useCuentaEst();
  // si la ocultó, se avisa acá (ver abajo): por eso se pregunta también desde esta parte
  useEffect(() => { if (dc && W.pedirMiFoto) W.pedirMiFoto(); }, [dc && dc.id]);
  const F = est.FOTO;
  const yo = liga.yo;
  const T = (F && F.temporada) || liga.temp || 'temporada';
  const libre = (f) => (f.libre_hasta ? 'Hasta el ' + f.libre_hasta + ' la puedes cambiar las veces que quieras.'
    : 'Hasta que arranque la temporada la puedes cambiar las veces que quieras.');
  let cuerpo;
  // (sin entrar: el botón)
  if (!dc) {
    cuerpo = <BotonEntrar />;
  } else if (!dc.clave) {
    cuerpo = <a className="btn verde chico" href="#/cuenta/verificar">Verificarme</a>;
  } else if (F && F.hecho) {
    cuerpo = <p className="cu-d"><b>Listo</b>: ésa es tu foto de la {T}. Tus tarjetas se vuelven a dibujar en la próxima vuelta del ciclo (cada media hora; de 3 a 11 AM, hora del este, no corre).{F.libre ? ' ' + libre(F) : ''}</p>;
  } else if (F && F.error) {
    const m = F.error === 'sin_foto' ? 'No tienes foto puesta en Discord: tu tarjeta va con la inicial, que con el color de tu rango queda bien. Si te pones una, vuelve.'
      : F.error === 'sin_perfil' ? 'Primero necesitas tu tarjeta: verifícate en la página.'
      : F.error === 'usado' ? 'Ya elegiste tu foto de la ' + T + ': va una por temporada. Se vuelve a abrir cuando arranque la que sigue.'
      : F.error === 'cdn' ? 'Discord no me dio tu foto. Suele arreglarse volviéndotela a poner en Discord y probando de nuevo.'
      : F.error === 'espera' ? 'Espera un minuto y prueba de nuevo.' : 'No pude cambiarla. Prueba de nuevo en un rato.';
    cuerpo = <><p className="cu-d">{m}</p><button type="button" className="btn borde2 chico" onClick={() => W.cuentaFotoNo && W.cuentaFotoNo()}>Volver</button></>;
  } else if (F && F.estado === 'usado') {
    cuerpo = <p className="cu-d">Ya elegiste tu foto de la {T} y va <b>una por temporada</b>: la Histórica necesita la cara que tenías en cada una. Se vuelve a abrir cuando arranque la que sigue.</p>;
  } else if (F && F.vista) {
    cuerpo = (
      <div className="cu-foto">
        <img className="cu-foto-v" src={F.vista} alt="Tu foto de Discord" width="96" height="96" />
        <div className="cu-foto-tx">
          <small>Tu tarjeta de la {T} va a llevar ésta, la de tu perfil de Discord. {F.libre ? libre(F) : F.pase ? 'Con el pase de DRA la puedes cambiar cuando quieras.' : 'Va una por temporada: después no se puede cambiar hasta la próxima.'}</small>
          <div className="cu-btns"><button type="button" className="btn verde chico" onClick={() => W.cuentaFotoSi && W.cuentaFotoSi()}>Usar esta foto</button>
            <button type="button" className="btn borde2 chico" onClick={() => W.cuentaFotoNo && W.cuentaFotoNo()}>Cancelar</button></div>
        </div>
      </div>
    );
  } else {
    cuerpo = (
      <div className="cu-foto">
        {yo ? <Carta liga={liga} k={yo.k} cual="temporada" cls="cu-carta" abre={false} /> : <span className="cu-carta vacia">Tu tarjeta</span>}
        <div className="cu-foto-tx"><CaraDc dc={dc} cls="cu-av" />
          <button type="button" className="btn verde chico" onClick={accion.foto}>Usar mi foto de Discord</button>
          <small>Discord te pide permiso para mirarla, y antes de cambiarla te la muestra.</small></div>
      </div>
    );
  }
  // 🙈 si la ocultó, que lo sepa acá también: si no, cambiar la foto parece no hacer nada
  const oculta = !!(est.MIFOTO && est.MIFOTO.oculta);
  return (
    <Caja t="Tu foto de la tarjeta" d={!dc ? 'La de tu Discord. Entra con Discord para cambiarla.' : !dc.clave ? 'Primero necesitas tu tarjeta.' : 'La de tu Discord. Va una por temporada.'}>
      {oculta ? <p className="cu-d">La tienes <b>oculta</b>: tus tarjetas van con tu inicial. Se cambia en <a href="#/cuenta/privacidad">Privacidad</a>.</p> : null}
      {cuerpo}
    </Caja>
  );
}

const NOMBRE_RED = (t) => (W.RED_NOMBRE && W.RED_NOMBRE[t]) || t;
function RedesCaja({ dc }) {
  const est = useCuentaEst();
  const R = est.REDES;
  const [marcadas, setMarcadas] = useState(null);
  const [nota, setNota] = useState('');
  const [va, setVa] = useState(false);
  if (!dc || !dc.clave) return null;
  const titulo = 'Mis redes en mi perfil';
  if (!R || !est.token) {
    return (
      <Caja t={titulo} d="Muestra en tu perfil las redes que ya tienes conectadas en Discord (Instagram, TikTok, YouTube…). Discord te pide permiso para leerlas.">
        <button type="button" className="btn borde2 chico" onClick={accion.redes}>Elegir mis redes</button>
      </Caja>
    );
  }
  if (R.error) {
    return (
      <Caja t={titulo} d={R.error === 'sin_perfil' ? 'Primero necesitas tu tarjeta: verifícate en la página.' : 'No pude leer tus redes. Prueba de nuevo.'}>
        <button type="button" className="btn borde2 chico" onClick={accion.redes}>Probar de nuevo</button>
      </Caja>
    );
  }
  if (!(R.publicas || []).length) {
    return (
      <Caja t={titulo} d="No tienes redes públicas en Discord. Ve a Ajustes → Conexiones, conecta tu Instagram, TikTok o YouTube y activa «Mostrar en el perfil». Después vuelve acá.">
        <button type="button" className="btn borde2 chico" onClick={accion.redes}>Ya las conecté</button>
      </Caja>
    );
  }
  // ⚠️ NINGUNA MARCADA DE ENTRADA salvo las que ya mostrás: se muestra lo que la persona elige (auditoría legal del 01/10)
  const ya = (R.guardadas || []).map((r) => r.t + ':' + r.n);
  const sel = marcadas || ya;
  const alternar = (id) => setMarcadas(sel.includes(id) ? sel.filter((x) => x !== id) : sel.concat([id]));
  const guardar = (ids) => {
    if (!W.cuentaRedes) return;
    setVa(true);
    W.cuentaRedes(ids).then((m) => { setNota(m); setVa(false); setMarcadas(null); });
  };
  return (
    <Caja t={titulo} d="Las que tienes públicas en Discord: elige cuáles salen en tu perfil.">
      <ul className="cu-lista">{R.publicas.map((r) => {
        const id = r.t + ':' + r.n;
        return (
          <li key={id}><label className="cu-red"><input type="checkbox" checked={sel.includes(id)} onChange={() => alternar(id)} />
            <span>{NOMBRE_RED(r.t)}</span><b>{r.n}</b></label></li>
        );
      })}</ul>
      <div className="cu-btns"><button type="button" className="btn verde chico" disabled={va} onClick={() => guardar(sel)}>Guardar en mi perfil</button>
        {ya.length ? <button type="button" className="btn borde2 chico" disabled={va} onClick={() => guardar([])}>Quitar todas</button> : null}</div>
      <p className="cu-d" role="status">{nota || ((ya.length ? 'Tu perfil muestra ' + ya.length + '.' : 'Todavía no muestras ninguna.') + ' Los cambios aparecen en la próxima actualización (cada media hora).')}</p>
    </Caja>
  );
}

// 📣 LOS ORGANIZADORES QUE SEGUÍS (Dlx, 12/10/2026, «5. E»): te avisa la campana cuando anuncian. Se siguen desde Eventos
function OrgsCaja({ dc }) {
  const orgs = useOrgs(dc);
  if (!dc) return null;
  return (
    <Caja t="Organizadores que sigues" d={orgs && orgs.length ? 'Te llega a la campana cuando anuncian un evento.'
      : 'En Eventos, «Cuándo suele jugar» dice quiénes organizan en cada servidor: toca uno y te avisamos cuando anuncie.'}>
      {orgs && orgs.length ? (
        <ul className="cu-lista">{orgs.map((o) => (
          <li key={o.org}><b>{limpio(o.nombre)}</b>
            <button type="button" className="btn borde2 chico" onClick={() => seguirOrg(o.nombre, false)}>Dejar de seguir</button></li>
        ))}</ul>
      ) : <a className="btn borde2 chico" href="#/eventos">Ir a Eventos</a>}
    </Caja>
  );
}

// 🎬 TUS BATALLAS EN VIDEO (Dlx, 12/10/2026: «las 2 [un link o un canal], pero asegurate que haya restricciones»). Acá
// sólo se pide y se ve cómo terminó cada pedido: lo que entra lo decide el ciclo (`bot/videos_propios.py`) con sus reglas
const VID_ERR = {
  sin_verificar: 'Sólo los verificados pueden sumar videos: verifícate en DRA.',
  link: 'Pega el link de un video o de un canal de YouTube.',
  muchos: 'Ya mandaste cinco hoy: prueba mañana.',
  espera: 'Tienes diez esperando: espera a que se revisen.',
  ya: 'Ese ya lo mandaste.',
  sin_sesion: 'Tu sesión venció: entra con Discord de nuevo.',
  respuestas: 'Completa las tres cosas: tu nombre en el video, cómo te reconocemos y el minuto (por ejemplo 4:35).',
  pedido: 'Ese pedido ya no espera respuesta.',
};
const VID_EST = { espera: 'En cola · se revisa en la próxima media hora', ok: '✓', no: '✗', revisar: 'Lo revisa Dlx',
  preguntar: '❓' };
// 🎬 «CONTANOS CÓMO APARECÉS» (Dlx, 16/10/2026): cuando tu nombre no está en el título —en las plazas te dicen de
// otra forma, o es un video de equipos—, estas tres cosas le alcanzan a Dlx para verificar que sos vos
function Contanos({ p, pedir, setMsg }) {
  const [f, setF] = useState({ nombre: '', como: '', minuto: '' });
  const [va, setVa] = useState(false);
  const ok = f.nombre.trim().length >= 2 && f.como.trim().length >= 4 && /^(?:\d{1,2}:)?\d{1,2}:\d{2}$/.test(f.minuto.trim());
  const mandar = async (e) => {
    e.preventDefault();
    if (!ok || va) return;
    setVa(true);
    const err = await pedir({ accion: 'responder', id: p.id, nombre: f.nombre.trim(), como: f.como.trim(), minuto: f.minuto.trim() });
    setVa(false);
    setMsg(err || 'Gracias: lo revisa Dlx con lo que contaste y, si eres tú, sale en tu perfil.');
  };
  const campo = (k, t, ph, max) => (
    <label><span>{t}</span><input value={f[k]} maxLength={max} placeholder={ph} onChange={(e) => setF(Object.assign({}, f, { [k]: e.target.value }))} /></label>
  );
  return (
    <form className="cu-contanos" onSubmit={mandar}>
      <p>No encontramos tu nombre en el título. Cuéntanos cómo apareces y lo revisa Dlx:</p>
      {campo('nombre', '¿Con qué nombre apareces en el video?', 'Ej.: SEBA', 60)}
      {campo('como', '¿Cómo te reconocemos?', 'Ej.: lentes, buzo negro, el de la izquierda', 160)}
      {campo('minuto', '¿En qué minuto apareces?', 'Ej.: 4:35', 8)}
      <button type="submit" className="btn verde chico" disabled={!ok || va}>{va ? 'Mandando…' : 'Mandar'}</button>
    </form>
  );
}
function VideosCaja({ dc }) {
  const [ps, setPs] = useState(null);
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');
  const [va, setVa] = useState(false);
  const pedir = async (cuerpo) => {
    const r = await fetch('/api/avisos/mis-videos', { method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const j = await r.json().catch(() => ({}));
    if (j.pedidos) setPs(j.pedidos);
    return r.ok ? '' : VID_ERR[j.error] || 'No se pudo. Prueba de nuevo.';
  };
  useEffect(() => {
    if (!dc || !dc.clave) return;
    pedir({ accion: 'ver' }).then((e) => { if (e) setMsg(e); });
  }, [dc && dc.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!dc || !dc.clave) return null;
  const mandar = async (e) => {
    e.preventDefault();
    if (va || !url.trim()) return;
    setVa(true);
    const err = await pedir({ accion: 'pedir', url: url.trim() });
    setVa(false);
    setMsg(err || 'Listo: se revisa en la próxima media hora y, si entra, sale en tu perfil.');
    if (!err) setUrl('');
  };
  return (
    <Caja t="Mis batallas en video" d="Pega el link de una batalla tuya en YouTube, o el de un canal donde estén tus batallas (una liga, una plaza). Entra si el título es una batalla («A vs B») y dice tu nombre de la Liga o un apodo tuyo; si trae bandera, la de tu país. Si en el video te dicen de otra forma, te preguntamos cómo apareces y lo revisa Dlx; un canal grande o un nombre famoso, también.">
      <form className="cu-vid" onSubmit={mandar}>
        <input type="url" maxLength={300} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/…" aria-label="Link de YouTube" />
        <button type="submit" className="btn verde chico" disabled={va}>{va ? 'Mandando…' : 'Sumar'}</button>
      </form>
      {msg ? <p className="cu-d" role="status">{msg}</p> : null}
      {ps && ps.length ? (
        <ul className="cu-lista cu-vids">{ps.map((p) => (
          <li key={p.id}><span className={'cu-vid-e ' + p.estado}>{VID_EST[p.estado] || p.estado}{p.motivo && p.estado !== 'espera' ? ' ' + p.motivo : ''}</span>
            <a href={p.url} target="_blank" rel="noopener noreferrer">{p.tipo === 'canal' ? 'Canal · ' : ''}{p.url.replace(/^https?:\/\/(www\.)?/, '')}</a>
            {p.estado === 'preguntar' ? <Contanos p={p} pedir={pedir} setMsg={setMsg} /> : null}</li>
        ))}</ul>
      ) : null}
    </Caja>
  );
}

// 🏠 Y AL FINAL DE VERIFICARSE (`paso`; Dlx, 07/10/2026: «que al final te pregunte de qué servidor venís y/o a qué
// servidor querés representar… todos los socios y la opción ninguno»). La misma elección que Mi cuenta, con «Ninguno»
// (`sv: ''`), que queda contestado sin fijar la temporada: tu perfil no muestra ningún servidor
function ServidorCaja({ liga, dc, paso }) {
  const est = useCuentaEst();
  useEffect(() => { if (dc && W.pedirMiServidor) W.pedirMiServidor(); }, [dc && dc.id]);
  const svs = Object.values(liga.svs || {});
  if (!dc || !svs.length) return null;
  const M = est.MISV || {};
  const e = est.MISV_EST || {};
  const hasta = M.libre_hasta && W.fmtFecha ? W.fmtFecha(new Date(M.libre_hasta - 60000).toISOString(), { day: 'numeric', month: 'long' }) : '';
  const nota = !est.MISV ? 'Cargando…'
    : e.error ? e.error
    : M.error ? ((W.errorCuenta && W.errorCuenta(M.error)) || 'No pude leerlo. Prueba en un rato.')
    : e.va ? 'Guardando…'
    // 🏠 sin elegir, ninguno: la página ya no le pone a nadie el servidor donde más jugó (Dlx, 12/10/2026, elegidos.js)
    : M.elegido && !M.sv ? 'Elegiste ninguno: tu perfil no muestra ningún servidor. Puedes elegir uno cuando quieras.'
    : M.libre ? 'Cámbialo cuantas veces quieras hasta el ' + hasta + '; después, uno por temporada.'
    : M.puede ? (M.sv ? 'Puedes cambiarlo una vez en esta temporada.' : 'Se elige una vez por temporada.')
    : 'Ya lo elegiste esta temporada: se vuelve a abrir en la que viene.';
  const nombre = (sv) => ((liga.svs[sv] || {}).nombre || sv);
  return (
    <Caja t={(paso ? 'Último paso: tu servidor' : 'Tu servidor') + (M.sv ? ' · ' + nombre(M.sv) : M.elegido ? ' · ninguno' : '')}
      d={paso ? '¿De qué servidor vienes, o a cuál quieres representar en la Liga? Sale en tu perfil. Si no es ninguno de éstos, elige «Ninguno».'
        : 'El que representas en la Liga: sale en tu perfil. Tu tarjeta de Servidor sigue siendo la de donde juegas.'}>
      <div className="cu-svs">{svs.map((o) => {
        const on = M.sv === o.sv;
        const off = (est.MISV && !M.error && !M.puede && !on) || !!e.va;
        return (
          <button type="button" key={o.sv} className={'cu-sv' + (on ? ' on' : '') + (e.pide === o.sv ? ' pide' : '')} style={{ '--c': o.color }}
            aria-pressed={on} disabled={off} onClick={() => { if (W.cuentaServidor) W.cuentaServidor(o.sv); }}>
            <img alt="" src={liga.logo(o.sv)} /><b>{siglaDe(o.sv)}</b></button>
        );
      })}
        {(() => {
          const on = !!M.elegido && !M.sv;
          return (
            <button type="button" className={'cu-sv cu-sv-no' + (on ? ' on' : '')} style={{ '--c': 'var(--linea)' }} aria-pressed={on}
              disabled={(est.MISV && !M.error && !M.puede && !on) || !!e.va} onClick={() => { if (W.cuentaServidor) W.cuentaServidor(''); }}>
              <b>Ninguno</b></button>
          );
        })()}
      </div>
      {/* pasada la ventana libre, elegir es para toda la temporada: se confirma */}
      {e.pide ? (
        <div className="cu-btns"><button type="button" className="btn verde chico" onClick={() => { if (W.elegirMiServidor) W.elegirMiServidor(e.pide); }}>Elegir {nombre(e.pide)}</button>
          <small>Queda hasta la temporada que viene.</small></div>
      ) : null}
      <p className="cu-d" role="status">{nota}</p>
    </Caja>
  );
}

// 🙈 «OCULTAR MI FOTO» (Dlx, 29/09 y 02/10/2026: «1. A»). La página y tus tarjetas van con tu inicial: también las que
// se ven en Discord, porque la página muestra las tarjetas y ocultarla sólo en los círculos no servía. Lo guarda el
// vigía (`cuentaMiFoto()` de app.js) y lo aplica el ciclo en su próxima vuelta
function OcultarFoto({ dc }) {
  const est = useCuentaEst();
  useEffect(() => { if (dc && W.pedirMiFoto) W.pedirMiFoto(); }, [dc && dc.id]);
  const d = 'Si la ocultas, la página y tus tarjetas (también las de Discord) te muestran con tu inicial. Se aplica en la próxima vuelta del ciclo: cada media hora, salvo de 3 a 11 AM (hora del este).';
  if (!dc) return <Caja t="Tu foto" d={d + ' Entra con Discord para usarlo.'}><BotonEntrar /></Caja>;
  const M = est.MIFOTO || {};
  const e = est.MIFOTO_EST || {};
  const nota = !est.MIFOTO ? 'Cargando…'
    : e.error ? e.error
    : M.error ? ((W.errorCuenta && W.errorCuenta(M.error)) || 'No pude leerlo. Prueba en un rato.')
    : e.va ? 'Guardando…'
    : M.oculta ? (e.ok ? '✓ Oculta. ' : '') + 'Tus tarjetas se vuelven a dibujar con tu inicial en la próxima vuelta.'
    : (e.ok ? '✓ Visible. ' : '') + 'Tu foto se ve en la página y en tus tarjetas.';
  return (
    <Caja t="Tu foto" d={d}>
      <label className="cu-sw"><span><b>Ocultar mi foto</b><small role="status">{nota}</small></span>
        <input type="checkbox" checked={!!M.oculta} disabled={!est.MIFOTO || !!M.error || !!e.va}
          onChange={(ev) => { if (W.cuentaMiFoto) W.cuentaMiFoto(ev.target.checked); }} />
        <i aria-hidden="true" /></label>
    </Caja>
  );
}

// quién te sigue: cuántos, y de ésos los que son raperos (los demás no tienen perfil)
function TeSiguen({ liga }) {
  const est = useCuentaEst();
  const ms = est.ME_SIGUEN;
  if (!ms || !ms.n) return null;
  const suyos = (ms.perfiles || []).map((k) => liga.T[k]).filter(Boolean);
  const otros = ms.n - suyos.length;
  return (
    <Caja t={'Te siguen ' + ms.n} d={otros > 0 ? (suyos.length ? 'Y ' : '') + otros + (otros === 1 ? ' persona que no compite.' : ' personas que no compiten.') : ''}>
      {suyos.length ? <ul className="cu-gente">{suyos.map((f) => (
        <li key={f.k}><a href={'#/r/' + encodeURIComponent(f.k)}><Cara liga={liga} k={f.k} nombre={f.n} cls="cu-av chica" /><b>{limpio(f.n)}</b></a></li>
      ))}</ul> : null}
    </Caja>
  );
}

// ── 🙋 ALGO ESTÁ MAL (Dlx, 17/10/2026: «deberíamos hacer un sistema de reportes… ¿qué pasa si alguien pierde acceso a su
// cuenta de Discord y tiene una nueva?»; a las preguntas: lo aprueba él o un Moderador, al aprobar pasa todo, y también
// «ese no soy yo», «mi país» y «un video que no es mío»). Se pide con tu Discord —el de ahora—; lo que el bot ve de tu
// cuenta va de prueba solo (`pedir()` en bot/avisos.js). Lo aprobado de cuenta y país lo aplica el ciclo (bot/pedidos.py)
const PEDIDOS = [
  ['cuenta', 'Perdí mi cuenta de Discord', 'Entraste con una cuenta nueva y quieres recuperar tu perfil: tus tarjetas, tus Puntos de Tienda, tu Pase y a quién sigues.'],
  ['identidad', 'Ese no soy yo / mi nombre está mal', 'Una llave te puso el resultado de otro, o tu nombre en la Liga está mal escrito.'],
  ['pais', 'Mi país o mi bandera están mal', 'Tu bandera en la Liga no es la tuya.'],
  ['video', 'Un video que no es mío', 'En un perfil aparece una batalla que no es de esa persona.'],
];
// 💡 lo que ya se puede hacer al instante, sin esperar a nadie: se dice antes de pedir (17/10/2026: la llave tiene su
// «¿Algo está mal en esta llave?», que se corrige y se aplica solo, y los videos que subiste vos tienen «Quitar»)
const ATAJO_PED = {
  identidad: '¿Es el resultado de una llave? Lo más rápido es abrir esa llave y tocar «¿Algo está mal en esta llave?»: '
    + 'se corrige y se aplica solo. Acá, mejor lo que no es de una llave, como tu nombre mal escrito.',
  video: 'Si es un video que sumaste tú, en tu perfil tiene «Quitar» y se va al instante. Acá van los demás: las batallas '
    + 'de los canales de los socios, que se suman solas por el nombre.',
};
const ESTADO_PED = { '': 'esperando que lo mire alguien', si: 'aprobado: se aplica en la próxima vuelta (menos de una hora)',
  hecho: 'listo ✓', no: 'no se aprobó', no_pude: 'aprobado, pero falta un paso: lo termina Dlx' };
function Pedidos({ liga, dc }) {
  const [tipo, setTipo] = useState('');
  const [q, setQ] = useState('');
  const [k, setK] = useState('');
  const [texto, setTexto] = useState('');
  const yoK = liga.yo ? liga.yo.k : '';
  const [cc, setCc] = useState('');
  const [vid, setVid] = useState('');
  const [est, setEst] = useState({});
  const [mios, setMios] = useState(null);
  const pedirMios = () => {
    if (!dc || !W.conCuenta) return;
    W.conCuenta('/api/avisos/mis-pedidos', {}).then((j) => setMios((j && j.pedidos) || [])).catch(() => setMios([]));
  };
  useEffect(pedirMios, [dc && dc.id]);
  if (!dc) {
    return <Caja t="Algo está mal" d="Entra con Discord —con la cuenta que usas ahora— para pedir que lo arreglemos."><BotonEntrar chico={false} /></Caja>;
  }
  const res = q.trim().length >= 2 ? (liga.d.tabla || []).filter((f) => limpio(f.n).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : [];
  const elegido = k ? liga.T[k] : null;
  // Emiratos y Brasil no cuentan como países de la Liga (Dlx, 22/09/2026)
  const paises = Object.entries(PAIS).filter(([c]) => c !== 'ae' && c !== 'br').sort((a, b) => a[1].localeCompare(b[1]));
  const mandar = () => {
    setEst({ va: true });
    const v = (vid.match(/(?:youtu\.be\/|v=|shorts\/)([A-Za-z0-9_-]{11})/) || [])[1] || vid.trim();
    W.conCuenta('/api/avisos/pedido', { tipo, k, texto, cc, vid: v }, 's').then((j) => {
      if (j === null) return; // se fue a Discord a confirmar quién eres
      if (j && j.ok) { setEst({ ok: true }); setTipo(''); setTexto(''); setK(''); setQ(''); pedirMios(); }
      else setEst({ error: (j && j.error) || 'error' });
    }).catch(() => setEst({ error: 'red' }));
  };
  const falta = !tipo ? 'Elige qué está mal.' : (tipo === 'cuenta' || tipo === 'identidad' || tipo === 'video') && !k ? 'Busca el perfil.'
    : tipo === 'pais' && !cc ? 'Elige tu país.' : tipo === 'video' && !vid.trim() ? 'Pega el link del video.'
      : tipo !== 'pais' && texto.trim().length < 3 ? 'Cuéntanos un poco más.' : '';
  const errorTxt = { tope: 'Ya tienes tres pedidos esperando: cuando se resuelvan puedes mandar otro.', perfil: 'Elige tu perfil de la lista.',
    texto: 'Cuéntanos un poco más.', pais: 'Elige tu país.', video: 'Ese link no es de un video de YouTube.' };
  return (
    <>
      <Caja t="¿Qué está mal?" d="Lo mira Dlx o un Moderador. Si es tu cuenta, también ve lo que el bot sabe de la cuenta con la que entraste (tu apodo en DRA y desde cuándo estás), así que pídelo desde la cuenta nueva.">
        <div className="pd-tipos" role="radiogroup" aria-label="Qué está mal">{PEDIDOS.map(([t, n, d]) => (
          <button key={t} type="button" role="radio" aria-checked={tipo === t} className={'pd-tipo' + (tipo === t ? ' on' : '')} onClick={() => { setTipo(t); setEst({}); if (t === 'video' && !k && yoK) setK(yoK); }}>
            <b>{n}</b><small>{d}</small></button>
        ))}</div>
        {ATAJO_PED[tipo] ? <p className="pd-atajo">💡 {ATAJO_PED[tipo]}</p> : null}
        {tipo === 'cuenta' || tipo === 'identidad' || tipo === 'video' ? (
          <div className="pd-campo">
            <label htmlFor="pd-q">{tipo === 'cuenta' ? '¿Cuál era tu perfil?' : tipo === 'video' ? '¿En qué perfil aparece?' : '¿Qué perfil está mal?'}</label>
            {elegido ? <p className="pd-elegido"><b>{limpio(elegido.n)}</b> <button type="button" className="btn borde2 chico" onClick={() => setK('')}>Cambiar</button></p> : (
              <>
                <input id="pd-q" type="search" className="ti-busca" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tu nombre en la Liga" />
                {res.length ? <ul className="pd-res">{res.map((f) => <li key={f.k}><button type="button" onClick={() => { setK(f.k); setQ(''); }}>{limpio(f.n)}</button></li>)}</ul> : null}
              </>
            )}
          </div>
        ) : null}
        {tipo === 'pais' ? (
          <div className="pd-campo"><label htmlFor="pd-cc">Tu país</label>
            <select id="pd-cc" value={cc} onChange={(e) => setCc(e.target.value)}><option value="">Elige…</option>
              {paises.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></div>
        ) : null}
        {tipo === 'video' ? (
          <div className="pd-campo"><label htmlFor="pd-vid">El link del video</label>
            <input id="pd-vid" type="url" className="ti-busca" value={vid} onChange={(e) => setVid(e.target.value)} placeholder="https://youtu.be/…" /></div>
        ) : null}
        {tipo ? (
          <div className="pd-campo"><label htmlFor="pd-tx">{tipo === 'cuenta' ? '¿Cómo lo comprobamos? (tu cuenta vieja, quién te conoce…)' : 'Cuéntanos qué pasa'}{tipo === 'pais' ? ' (si quieres)' : ''}</label>
            <textarea id="pd-tx" rows={3} maxLength={400} value={texto} onChange={(e) => setTexto(e.target.value)} /></div>
        ) : null}
        {tipo ? <div className="cu-btns"><button type="button" className="btn verde chico" disabled={!!falta || est.va} onClick={mandar}>{est.va ? 'Mandando…' : 'Mandar el pedido'}</button>
          {falta ? <small className="pd-falta">{falta}</small> : null}</div> : null}
        {est.ok ? <p className="cu-d" role="status">✓ Listo: lo vas a ver abajo, y cuando lo resuelvan te avisamos en la campana.</p> : null}
        {est.error ? <p className="cu-d" role="alert">{errorTxt[est.error] || (W.errorCuenta && W.errorCuenta(est.error)) || 'No pude mandarlo. Prueba de nuevo.'}</p> : null}
      </Caja>
      {mios && mios.length ? (
        <Caja t="Tus pedidos" d="Los últimos que mandaste.">
          <ul className="pd-mios">{mios.map((p) => (
            <li key={p.id}><b>{(PEDIDOS.find((x) => x[0] === p.tipo) || [])[1] || p.tipo}</b>
              <small>{ESTADO_PED[p.estado] || p.estado}{p.nota ? ' · ' + p.nota : ''}</small></li>
          ))}</ul>
        </Caja>
      ) : null}
    </>
  );
}

function Parte({ id, liga, dc, tema, onTema, temaSv, onTemaSv }) {
  // 🔓 tu nivel, para los colores de los servidores (ver `NIVEL_TEMA` en temas.js)
  const Rn = useRacha(!!dc && id === 'apariencia');
  const [temaMsg, setTemaMsg] = useState('');
  const yo = liga.yo;
  const { aj, zonas, z } = horaYZona();
  if (id === 'cuenta') {
    return (
      <>
        <Caja t="Discord" d={dc ? 'Entraste con tu cuenta de Discord. No guardamos ningún permiso: cada vez que haces algo, Discord confirma que eres tú.' : 'Entra con Discord para ver tu puesto, tus tarjetas y tus avisos.'}>
          {dc ? (
            <div className="cu-fila"><CaraDc dc={dc} cls="cu-av chica" /><span><b>{limpio(dc.n)}</b>
              <small>{yo ? 'Tu tarjeta: ' + limpio(yo.n) : dc.rapero ? 'Eres ' + limpio(dc.rapero) + ' · todavía no jugaste esta temporada' : 'Sin tarjeta todavía'}</small></span></div>
          ) : <BotonEntrar chico={false} />}
          {/* la sesión de antes del 25/09 no trae la clave: es un toque, `prompt=none` no vuelve a pedir nada */}
          {dc && dc.rapero && !dc.clave ? (
            <p className="cu-d">Tu sesión es de una versión anterior. Actualizala para ver tus tarjetas y tu perfil: es un toque, no te pide nada.{' '}
              <button type="button" className="btn borde2 chico" onClick={accion.entrar}>Actualizar mi cuenta</button></p>
          ) : null}
        </Caja>
        {!dc && yo ? (
          <Caja t="Sin entrar" d={'Elegiste ser ' + limpio(yo.n) + ' sin entrar con Discord. Entra y queda confirmado.'}>
            <div className="cu-btns"><button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar con Discord</button>
              <button type="button" className="btn borde2 chico" onClick={accion.salir}>No soy yo</button></div>
          </Caja>
        ) : null}
        {dc && !yo && !dc.rapero ? (
          <Caja t="Tu tarjeta" d="Son dos pasos: verifícate en DRA (acá, en un toque) y se abre tu Servidor; con tu primera Tarea del Pase de rapero, tu Temporada.">
            <div className="cu-btns"><a className="btn verde chico" href="#/cuenta/verificar">Verificarme</a>
              <a className="btn borde2 chico" href="#/guia">Cómo conseguir tu tarjeta</a></div>
          </Caja>
        ) : null}
      </>
    );
  }
  if (id === 'fondo') return <FondoCaja dc={dc} />;
  if (id === 'algo-mal') return <Pedidos liga={liga} dc={dc} />;
  if (id === 'perfil') {
    return (
      <>
        <FotoCaja liga={liga} dc={dc} />
        {/* 💬 tu frase entre comillas, debajo de tu nombre en tu perfil (la tanda 2 del perfil, 27/10/2026) */}
        <Caja t="Tu frase" d={!dc ? 'Entra con Discord para escribirla.' : !dc.clave ? 'Primero necesitas estar verificado.' : 'Sale entre comillas debajo de tu nombre, en tu perfil.'}>
          {dc && dc.clave ? <FraseEditor k={dc.clave} /> : !dc ? null : <a className="btn verde chico" href="#/cuenta/verificar">Verificarme</a>}
        </Caja>
        <FotoCartaCaja dc={dc} />
        <RedesCaja dc={dc} />
        <VideosCaja dc={dc} />
        <ServidorCaja liga={liga} dc={dc} />
      </>
    );
  }
  if (id === 'crew') return <Caja t="Mi crew"><MiCrew liga={liga} dc={dc} /></Caja>;
  if (id === 'siguiendo') {
    const fs = liga.sigue.map((k) => liga.T[k]).filter(Boolean);
    return (
      <>
        <Caja t={'Sigues a ' + fs.length} d={dc ? 'Te llega un aviso cuando ganan, suben de rango o desbloquean una tarjeta (activa los avisos en este dispositivo).'
          : 'Entra con Discord y te avisamos cuando ganen o suban de rango.'}>
          {fs.length ? <ul className="cu-gente">{fs.map((f) => (
            <li key={f.k}><a href={'#/r/' + encodeURIComponent(f.k)}><Cara liga={liga} k={f.k} nombre={f.n} cls="cu-av chica" /><b>{limpio(f.n)}</b>
              <small>{f.pos ? '#' + f.pos : ''}</small></a></li>
          ))}</ul> : <a className="btn borde2 chico" href="#/ranking">Buscar a quién seguir</a>}
        </Caja>
        <TeSiguen liga={liga} />
        <OrgsCaja dc={dc} />
      </>
    );
  }
  if (id === 'privacidad') {
    return (
      <>
        <OcultarFoto dc={dc} />
        <Caja t="Tus datos" d="En Discord, /borrar-mis-datos borra todo lo tuyo de la Liga: tus tarjetas, tu foto y lo que el bot sabe de ti." />
        <Caja t="Este dispositivo" d="Olvida quién eres, tus ajustes y los avisos de este dispositivo. Tus tarjetas y tu cuenta no se tocan.">
          <DosToques className="btn borde2 chico" confirmar="¿Seguro? Toca de nuevo" onClick={() => { if (W.cuentaOlvidarTodo) W.cuentaOlvidarTodo(); }}>Olvidar este dispositivo</DosToques>
        </Caja>
      </>
    );
  }
  if (id === 'avisos') {
    const svs = leer('campana:svs', []) || [];
    const activos = !!leer('campana:activada', false);
    const de = Object.values(liga.svs).filter((o) => !svs.length || svs.includes(o.sv));
    return (
      <Caja t="En este dispositivo" d={activos ? 'Activados: te avisa al minuto de que ' + (svs.length ? de.map((o) => siglaDe(o.sv)).join(', ') : 'cualquier servidor') + ' anuncia un evento.'
        : 'Apagados. Activalos y te avisa al minuto de que un servidor anuncia un evento.'}>
        <a className="btn verde chico" href="#/avisos">{activos ? 'Cambiar los avisos' : 'Activar los avisos'}</a>
      </Caja>
    );
  }
  if (id === 'apariencia') {
    return (
      <Caja t="Tema" d="Cómo se ve la página en este dispositivo.">
        <div className="cu-temas">
          {[['clara', 'Clara'], ['noche', 'Noche']].map(([t, n]) => (
            <button type="button" key={t} className={'cu-tema ' + t + (tema === t ? ' on' : '')} aria-pressed={tema === t} onClick={() => onTema(t)}>
              <span className="cu-mini" aria-hidden="true"><i /><u /><u /><s /></span><b>{n}</b></button>
          ))}
        </div>
        {/* 🎨 LOS COLORES DE UN SERVIDOR, encima de Clara o de Noche (13/10/2026, Dlx: «crea temas con los servidores
            asociados», y «agrega la opción ninguno… ninguno va combinado con el tema blanco»). La vista previa de cada uno
            va con el tema de base elegido */}
        <p className="cu-temas-t">Con los colores de un servidor de la Liga:</p>
        {(() => {
          const n = Rn && Rn.nivel ? Rn.nivel.n || 1 : 0;
          return <p className="cu-d">{dc ? (n ? 'Vas en el nivel ' + n + '. ' : '') + 'Se abren con tu nivel: 3 en el nivel 2, 3 más en el 3 y los últimos en el 5. Subes jugando, entrando cada día y con lo que haces en la Liga (mira «Cómo subir de nivel», arriba).'
            : 'Se abren con tu nivel: entra con Discord y subes jugando, entrando cada día y con lo que haces en la Liga.'}</p>;
        })()}
        <div className="cu-temas sv">
          <button type="button" className={'cu-tema tsv tsv-base ' + tema + (!temaSv ? ' on' : '')} aria-pressed={!temaSv} onClick={() => onTemaSv('')}>
            <span className="cu-mini" aria-hidden="true"><i /><u /><u /><s /></span><b>Ninguno</b></button>
          {TEMAS_SV.map(([sv, n]) => {
            const pide = nivelTema(sv), tengo = Rn && Rn.nivel ? Rn.nivel.n || 1 : 0;
            // ⚠️ el que ya tenías puesto sigue abierto: no se te saca lo que elegiste antes de que hubiera niveles
            const abierto = tengo >= pide || temaSv === sv;
            const nom = (liga && liga.svs && liga.svs[sv] && liga.svs[sv].nombre) || n;
            return (
              <button type="button" key={sv} className={'cu-tema tsv ' + tema + ' t-' + sv.toLowerCase() + (temaSv === sv ? ' on' : '') + (abierto ? '' : ' cerrado')}
                aria-pressed={temaSv === sv} aria-label={abierto ? nom : nom + ': se abre con el nivel ' + pide}
                onClick={() => { if (abierto) { setTemaMsg(''); onTemaSv(sv); } else setTemaMsg('Los colores de ' + nom + ' se abren con el nivel ' + pide + (tengo ? ': vas en el ' + tengo + '.' : '. Entra con Discord para subir de nivel.')); }}>
                <span className="cu-mini" aria-hidden="true"><i /><u /><u /><s /></span>
                <b>{liga && liga.logo ? <img alt="" src={liga.logo(sv)} /> : null}{nom}</b>
                {abierto ? null : <span className="cu-tema-nivel"><Ico n="candado" t={14} />Nivel {pide}</span>}</button>
            );
          })}
        </div>
        {temaMsg ? <p className="cu-d" role="status">{temaMsg}</p> : null}
      </Caja>
    );
  }
  if (id === 'hora') return <ParteHora />;
  if (id === 'accesibilidad') return <ParteCalma />;
  if (id === 'instalar') return <ParteInstalar />;
  if (id === 'verificar') return <Verificar liga={liga} dc={dc} />;
  if (id === 'novedades') {
    return <Caja t="Novedades" d="Lo que cambió en la página y en el bot."><a className="btn verde chico" href="#/cambios">Ver el changelog</a></Caja>;
  }
  if (id === 'guia') {
    return <Caja t="Guía" d="Cómo se suman puntos, qué pide cada tarjeta y cómo funcionan los rangos."><a className="btn verde chico" href="#/guia">Abrir la guía</a></Caja>;
  }
  if (id === 'legal') {
    return (
      <Caja t="Privacidad y términos" d="Qué guardamos, para qué, y las reglas de la página.">
        <div className="cu-btns"><a className="btn borde2 chico" href="/privacidad">Privacidad</a><a className="btn borde2 chico" href="/terminos">Términos</a></div>
      </Caja>
    );
  }
  return null;
}

// ── verificarse desde la página (Dlx, 01/10/2026: «haz que la gente se verifique por la página web, así más rápido,
// y que te entres a DRA automáticamente»). Lo mismo que /verificar —qué te falta, con el botón que lo arregla, y te
// anota— más meterte en DRA con el permiso «unirse a servidores» de Discord. El trabajo lo hacen app.js
// (`verificarme()`) y el Worker (`cuentaVerificar()`); acá se dibuja lo que contestaron: `VERIF`, aviso `lg:verif`.
// ⚠️ El país se pone SÓLO después de aceptar las reglas de DRA (ver el Worker), así que la página lo pide recién ahí.
const DRA_URL = 'https://discord.com/channels/841017460341604382';
const ERR_VERIF = {
  cancelado: 'Cancelaste el permiso en Discord. Sin él no podemos mirar DRA ni meterte.',
  discord_error: 'Discord no dio el permiso. Prueba de nuevo en un rato.',
  permiso: 'Discord no nos dio permiso para meterte en DRA. Prueba de nuevo y acepta «Unirse a servidores».',
  discord: 'Tu permiso de Discord se venció. Prueba de nuevo.',
  token: 'Tu permiso de Discord se venció. Prueba de nuevo.',
  discord_ocupado: 'Discord está ocupado ahora mismo. Prueba en un minuto.',
  dra: 'No pude mirar Discord Rap Español ahora mismo. Prueba en un minuto.',
  porton: 'La verificación no está disponible ahora. Prueba en un rato, o con /verificar en Discord.',
  lleno: 'Estás en el máximo de servidores que permite Discord. Sal de alguno y prueba de nuevo.',
  no_deja: 'Discord Rap Español no nos deja meterte. Si crees que es un error, habla con un admin de DRA.',
  entrar: 'No pude meterte en DRA ahora mismo. Prueba de nuevo en un rato.',
  rol: 'No pude ponerte el país en DRA. Prueba de nuevo en un rato.',
  pais: 'Ese país no está en DRA. Elige otro.',
  espera: 'Fueron muchos intentos seguidos. Espera un minuto y prueba de nuevo.',
  red: 'No pude conectarme. Revisa tu internet y prueba de nuevo.',
};
// los que piden un permiso nuevo de Discord; el resto se reintenta con el que hay
const REPERMISO = { cancelado: 1, discord_error: 1, permiso: 1, discord: 1, token: 1 };

function useVerif() {
  const [v, setV] = useState(() => W.VERIF || null);
  useEffect(() => {
    const f = () => setV(W.VERIF ? Object.assign({}, W.VERIF) : null);
    W.addEventListener('lg:verif', f);
    f();
    return () => W.removeEventListener('lg:verif', f);
  }, []);
  return v;
}
const irADiscord = () => { if (W.urlLogin) W.location.href = W.urlLogin('d'); };
const revisar = (pais) => { if (W.verificarme) W.verificarme(pais || null); else irADiscord(); };

function ElegirPais({ v }) {
  const [pais, setPais] = useState('');
  const ops = (v.opciones || []).slice().sort((a, b) => (PAIS[a] || a).localeCompare(PAIS[b] || b, 'es'));
  return (
    <span className="cu-pais">
      <select aria-label="Tu país" value={pais} onChange={(e) => setPais(e.target.value)}>
        <option value="" disabled>Elige tu país</option>
        {ops.map((c) => <option key={c} value={c}>{PAIS[c] || c.toUpperCase()}</option>)}
      </select>
      <button type="button" className="btn verde chico" disabled={!pais || v.cargando} onClick={() => revisar(pais)}>Guardar</button>
    </span>
  );
}

// (exportada: la usa también la pantalla de bienvenida, en su paso 2 —bienvenida.jsx—)
export function Verificar({ liga, dc }) {
  const v = useVerif();
  const yo = liga.yo;
  // ya cargado: con su clave de la Liga (`d:`), que sólo tiene quien pasó el portón
  if ((dc && dc.rapero) || (v && v.listo)) {
    return (
      <>
        <Caja t="Ya estás verificado" d="Tus tarjetas salen con /card en Discord, y tu perfil está en la página.">
          {yo ? <a className="btn verde chico" href={'#/r/' + encodeURIComponent(yo.k)}>Ver mi perfil</a> : null}
        </Caja>
        <ServidorCaja liga={liga} dc={dc} paso />
      </>
    );
  }
  if (v && v.olvido) {
    return <Caja t="Borraste tus datos de la Liga" d="Con /borrar-mis-datos pediste que no te sumemos solos. Para volver, pídeselo a un admin de la Liga en DRA." />;
  }
  if (!v || (v.cargando && !v.enDra)) {
    return (
      <Caja t="Qué es estar verificado" d="Estar en Discord Rap Español, con tu país y el rol de Miembro. Sin eso no hay tarjetas: verificado se abre tu Servidor, con tu primera Tarea del Pase tu Temporada, y la Competitiva y la de País con su requisito. Y tu perfil, con tu foto y tus redes.">
        <button type="button" className="btn verde" disabled={!!(v && v.cargando)} onClick={() => (W.DC_TOKEN ? revisar() : irADiscord())}>
          {v && v.cargando ? 'Mirando Discord Rap Español…' : 'Verificarme con Discord'}</button>
        <small className="cu-nota">Discord te va a pedir dos permisos: ver tu usuario y unirte a servidores por ti, que es lo que deja al bot meterte en Discord Rap Español si todavía no estás. Se usa una vez y no se guarda.</small>
      </Caja>
    );
  }
  if (v.error) {
    return (
      <Caja t="No se pudo" d={ERR_VERIF[v.error] || ERR_VERIF.red}>
        <button type="button" className="btn verde chico" onClick={() => (REPERMISO[v.error] ? irADiscord() : revisar())}>Probar de nuevo</button>
      </Caja>
    );
  }
  const paises = v.paises || [];
  const abrir = <a key="dra" className="btn borde2 chico" href={DRA_URL} target="_blank" rel="noopener noreferrer">Abrir DRA ↗</a>;
  let pais;
  if (paises.length === 1) {
    pais = ['ok', <>Tu país: {PAIS[paises[0]] || paises[0].toUpperCase()} <Bandera cc={paises[0]} cls="cu-band" /></>,
      v.puso ? 'Te pusimos el rol en DRA recién.' : ''];
  } else if (v.pendiente) {
    pais = ['espera', 'Tu país', 'Lo eliges acá cuando aceptes las reglas.'];
  } else if (paises.length > 1 && v.porRol) {
    pais = ['aviso', 'Tienes ' + paises.length + ' países en DRA', 'Deja uno solo en tus roles de DRA y toca «Revisar de nuevo».', abrir];
  } else {
    pais = ['falta', 'Tu país', paises.length > 1 ? 'Tu nombre tiene ' + paises.length + ' banderas: elige la tuya y el bot te pone ese rol en DRA.'
      : 'Elígelo y el bot te pone ese rol en DRA.', <ElegirPais key="p" v={v} />];
  }
  const vuelta = v.vuelta ? hora(v.vuelta) : '';
  // ✅ con todo completo, el Worker te lo da en el momento (`darMiembro()`, Dlx 12/10/2026: «A y B»)
  const miembro = v.rol ? ['ok', 'Tienes el rol de Miembro', v.dimos ? 'Te lo dimos recién.' : '']
    : v.revisa ? ['aviso', 'Tu caso lo revisa un admin', 'No hace falta que hagas nada más.']
      : v.completo ? ['espera', 'Tu rol de Miembro', 'Te lo da el bot solo' + (vuelta ? ', en la vuelta de las ' + vuelta + ' o en la siguiente' : '') + '. Con él salen tus tarjetas.']
        : ['espera', 'Tu rol de Miembro', 'Te lo da el bot cuando completes lo de arriba.'];
  const filas = [
    ['ok', 'Tu Discord', dc ? limpio(dc.n) : 'Conectado'],
    ['ok', 'Estás en Discord Rap Español', v.entro ? 'Te metimos recién.' : 'Ya estabas adentro.'],
    v.pendiente ? ['aviso', 'Acepta las reglas de DRA', 'Discord te las muestra al abrir el servidor: es un toque. Después vuelve acá y toca «Revisar de nuevo».', abrir]
      : ['ok', 'Aceptaste las reglas de DRA', ''],
    pais,
    miembro,
  ];
  const resumen = v.completo
    ? (v.rol ? 'Estás verificado en DRA. Tus tarjetas salen cuando el bot te cargue' + (vuelta ? ': en la vuelta de las ' + vuelta + ' o en la siguiente.' : '.')
      : 'Lo tuyo está completo. El resto lo hace el bot solo.')
    : v.revisa ? 'Lo tuyo está completo. Tu caso lo revisa un admin.' : 'Te falta lo que está marcado abajo.';
  return (
    <>
    <Caja t={v.completo ? 'Listo de tu lado' : 'Lo que falta'} d={resumen}>
      <ul className="cu-chk" aria-busy={!!v.cargando}>{filas.map(([e, t, d, acc], i) => (
        <li key={i} className={e}><span className="cu-chk-i"><Ico n={e} t={18} /></span><span className="cu-chk-t"><b>{t}</b>{d ? <small>{d}</small> : null}</span>{acc || null}</li>
      ))}</ul>
      <button type="button" className="btn borde2 chico" disabled={!!v.cargando} onClick={() => revisar()}>{v.cargando ? 'Mirando…' : 'Revisar de nuevo'}</button>
    </Caja>
    {v.completo ? <ServidorCaja liga={liga} dc={dc} paso /> : null}
    </>
  );
}

// `#/cuenta/verificar`, sola: el resto de Mi cuenta todavía no está en línea (Dlx, 01/10/2026: primero esto)
export function PaginaVerificar({ liga, dc }) {
  useEffect(() => { W.scrollTo(0, 0); }, []);
  return (
    <div className="cu cu-sola">
      <div className="cu-cab"><h1 className="cu-h">Verificarme</h1></div>
      <section className="cu-parte" aria-label="Verificarme"><Verificar liga={liga} dc={dc} /></section>
    </div>
  );
}

// 🖥️ EN LA COMPU, LA SECCIÓN ELEGIDA Y NADA MÁS (Dlx, 20/10/2026, ~5:15 PM: «está mostrando todas las configuraciones a
// lo loco cuando debería mostrar de acuerdo a lo que está seleccionado en el momento»). Es la misma vista del teléfono
// —la lista en cajas a la izquierda, la parte a la derecha—, con la primera abierta de entrada. Hasta hoy la compu
// mostraba TODAS las partes en tarjetas, en dos columnas (Dlx, 02/10: «me gusta rellenar el espacio así»): la sacó él
export function Cuenta({ liga, dc, parte, tema, onTema, temaSv, onTemaSv }) {
  const gs = grupos(liga, dc, tema, temaSv);
  // 🔒 el acceso al Dashboard, a la vista sólo para el dueño. Es un atajo: la puerta de verdad está en el servidor
  // 🔐 el botón del Dashboard: Dlx, y quien tiene un rol que lo abre (Admin, Asistente, Moderador; 13/10/2026)
  const misRoles = ((useRoles() || {})[liga.yo && liga.yo.k] || []).map((x) => x[0]);
  const dueno = !!dc && (String(dc.id) === DUENO || misRoles.some((r) => ['admin', 'asistente', 'moderador'].includes(r)));
  // 📊 dueño de un servidor socio (Tier 1 o 2): el botón a su panel (`#/socio`). Se pregunta una vez por sesión
  const socio = useSocio(!!dc);
  const todas = gs.flatMap((g) => g[1]);
  // verificarse no está en la lista: se llega desde la tarjeta de arriba (y desde el botón del bot)
  const extra = parte === 'verificar' ? ['verificar', 'ok', 'Verificarme', ''] : null;
  const actual = extra || todas.find((x) => x[0] === parte) || null;
  // en la computadora siempre hay una abierta: la primera
  const [ancha, setAncha] = useState(() => !!(W.matchMedia && W.matchMedia('(min-width: 900px)').matches));
  useEffect(() => {
    if (!W.matchMedia) return undefined;
    const m = W.matchMedia('(min-width: 900px)');
    const f = () => setAncha(m.matches);
    if (m.addEventListener) m.addEventListener('change', f);
    return () => { if (m.removeEventListener) m.removeEventListener('change', f); };
  }, []);
  const abierta = actual || (ancha ? todas[0] : null);
  const lista = (
    <nav className="cu-nav" aria-label="Tu cuenta">
      {gs.map(([t, xs]) => (
        <div className="cu-g" key={t}><span className="cu-gt">{t}</span>
          <ul>{xs.map(([id, ico, n, v]) => (
            <li key={id}><a href={'#/cuenta/' + id} className={abierta && abierta[0] === id ? 'on' : ''} aria-current={abierta && abierta[0] === id ? 'page' : undefined}>
              <i className={'cu-ico ' + (ICO_COLOR[id] || '')} aria-hidden="true"><Ico n={ico} t={18} /></i>
              <span><b>{n}</b><small>{(v || '').replace(/ · NUEVO$/, '')}</small></span>
              {/NUEVO$/.test(v || '') ? <em className="cu-chip">NUEVO</em> : <Chevron />}</a></li>
          ))}</ul></div>
      ))}
      {/* 🚪 SALIR, AL FINAL DE LA LISTA Y SIEMPRE A LA VISTA (Dlx, 26/10/2026: «no hay log out option»): el botón chico de
          al lado de tu nombre no se veía, y en el teléfono se esconde con una sección abierta */}
      {dc ? (
        <div className="cu-g"><ul><li><button type="button" className="cu-salir" onClick={accion.salir}>
          <i className="cu-ico" aria-hidden="true"><Ico n="salir" t={18} /></i>
          <span><b>Salir de tu cuenta</b><small>vuelves a entrar con Discord cuando quieras</small></span></button></li></ul></div>
      ) : null}
    </nav>
  );
  return (
    <div className={'cu' + (abierta ? ' con-parte' : '')}>
      <div className="cu-cab"><h1 className="cu-h">{abierta && !ancha ? '' : <>Tu cuenta<small className="cu-hs">todo lo tuyo</small></>}</h1>{socio && (!abierta || ancha) ? <a className="btn borde2 chico" href="#/socio">Mi servidor</a> : null}{dueno && (!abierta || ancha) ? <a className="btn borde2 chico" href="#/dashboard">Dashboard</a> : null}</div>
      <div className="cu-g2">
        <aside className="cu-lado">
          <Quien liga={liga} dc={dc} />
          {lista}
        </aside>
        {abierta ? (
          <section className="cu-parte" aria-label={abierta[2]}>
            <a className="cu-volver" href="#/cuenta"><Chevron />Tu cuenta</a>
            <h2 className="cu-pt"><Ico n={abierta[1]} t={24} />{abierta[2]}</h2>
            <Parte id={abierta[0]} liga={liga} dc={dc} tema={tema} onTema={onTema} temaSv={temaSv} onTemaSv={onTemaSv} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
