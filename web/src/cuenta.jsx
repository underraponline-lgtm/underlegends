// Mi cuenta y Ajustes, juntos y como los ajustes de Discord. Dlx, 01/10/2026: «a mí me gusta como lo tiene Discord»,
// y antes de construirla, «genera PREVIEWS de cómo sería, así mismo como lo que hicimos con INICIO».
// `#/cuenta` es la lista; `#/cuenta/<parte>` abre una. En el celular se entra y se vuelve con «‹»; en la computadora,
// la lista a la izquierda y la parte a la derecha. Lo que hace cada cosa por dentro —entrar con Discord, la foto, las
// redes, la campana— sigue siendo de app.js: acá cambia la cara.
// ✅ EN LÍNEA ENTERA desde el 02/10/2026 (Dlx: «ajustes y cuenta separados, y me gusta cómo lo propusiste»). Lo que
// hace cada cosa por dentro —la foto, las redes, «tu servidor», salir— lo sigue haciendo app.js (`cuentaFotoSi()`,
// `cuentaRedes()`, `cuentaServidor()`, `cuentaSalir()`…) y esta página se entera de cada cambio por `lg:cuentaest`
// (App.jsx envuelve `pintaPopCuenta()`). Su ventana vieja queda de respaldo, si esto no se monta.
import { Fragment, useEffect, useRef, useState } from 'react';
import { DUENO, PAIS, hora, limpio, norm, nuevaQue, num, siglaDe } from './liga.js';
import { Bandera, Cara, Carta, Chevron, DosToques, GrillaDias, Ico, accion, diaET, masDias, semanasEntre, useCampana, usePerfiles } from './piezas.jsx';
import { MiCrew } from './crewpanel.jsx';
import { crewDe } from './crews.js';
import { CaraDc } from './arriba.jsx';
import { useRacha } from './racha.js';
import { TEMAS_SV, nivelTema, nombreTema } from './temas.js';
import { useRoles } from './roles.js';
import { LUGARES, NOMBRE_OPCION, eleccion, escenaDe, fondoEn, fondoOpcion, fondoPropio, urlFondo } from './fondos.js';
import { FichaCuerpo } from './ficha.jsx';
import { FondoPropio } from './fondo_propio.jsx';
import { useSocio } from './panelsocio.js';
import { seguirOrg, useOrgs } from './orgs.js';

import { PasosInstalar } from './instalar.jsx';
import { FraseEditor } from './frase.jsx';
import CSS_PAGINA from './css/cuenta.css?inline';
import { usarCss } from './css.js';
import { CuentaPC, EntrarError } from './cuenta_pc.jsx';
import { achicar as achicarImagen, aBase64 } from './imagen.js';
import { bajarGlobal, globalListo } from './global_datos.js';
import { deAfuera, esDeAfuera } from './sigo_global.js';
import { siluetaDe } from './sin_foto.js';
import { BotonSeguir, GenteParaSeguir, LigaTeSigue, ligaSigue, sugeridos, useComparten } from './sugeridos.jsx';

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
function grupos(liga, dc, tema, temaSv, camp) {
  const yo = liga.yo;
  const { z, f, aj } = horaYZona();
  const C = W.CAMBIOS;
  const ult = Array.isArray(C) && C[0] ? C[0].version : '';
  const nuevo = !!ult && nuevaQue(ult, W.CAMBIOS_VISTO);
  // 🔔 el estado de verdad de la campana (18/11/2026): `campana:activada` es una marca —esconde la invitación del
  // Inicio— que la baja Desactivar (campana.js), pero no una baja que hace el navegador solo (permiso revocado), y ahí
  // seguía diciendo «activados». La marca, sólo si campana.js no cargó
  const avisos = camp ? !!camp.activa : !!leer('campana:activada', false);
  // 👥 a cuántos sigues, también los de fuera de las 200 filas (18/11/2026): `liga.sigue` viene filtrada por la tabla
  const nSigue = (liga.sigueTodos || liga.sigue).length;
  const crew = crewDe(dc && dc.clave);
  return [
    ['TU PERFIL', [
      ['perfil', 'perfil', 'Foto y redes', yo ? 'tu foto, tu frase, tus redes y tu servidor' : 'lo que los demás ven de ti'],
      ['fondo', 'tema', 'Tus fondos', 'tu imagen y qué va en cada lugar'],
    ]],
    ['TU GENTE', [
      // 👥 las crews que arma la gente (19/10/2026): la tuya y tus invitaciones; armar una, en Crews (3.73)
      ['crew', 'socios', 'Mi crew', crew ? 'la tuya: ' + limpio(crew.c.nombre) : 'tus invitaciones; se arman en Crews'],
      ['siguiendo', 'seguir', 'Siguiendo', nSigue ? nSigue + (nSigue === 1 ? ' rapero' : ' raperos') : 'todavía nadie'],
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
      // 🎮 la bienvenida otra vez, entera (Dlx, 12/11/2026: «que la gente pueda ver completamente todo eso como introducción
      // nuevamente, ya sea por ese link o por una opción dentro de configuraciones»): es la página `#/bienvenida`
      ['introduccion', 'micro', 'La introducción', 'la bienvenida de la Liga, otra vez'],
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

export function RachaNivel({ dc, liga }) {
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
// ⚠️ magenta es `mg` y no `m` (18/11/2026): `.m` es la batalla de la llave chica del Inicio (estilo.css) y, global en el
// shadow root, le ponía un borde de 2 px a los cuadraditos de Tu gente
const ICO_COLOR = { perfil: 'v', fondo: 'v', crew: 'mg', siguiendo: 'mg' };

function Quien({ liga, dc }) {
  const yo = liga.yo;
  if (!yo && !dc) {
    return (
      <div className="cu-quien anon" data-tuto="cu-quien">
        <span className="cu-av anon"><Ico n="yo" t={30} /></span>
        {/* 🚪 por qué no entraste (18/11/2026): si al volver de Discord /api/cuenta falló, el celular volvía a «Entrar con
            Discord» sin decir nada. EntrarError escucha `lg:cuentaest` solo: Quien no se redibuja con ese aviso */}
        <div className="cu-q"><b>Todavía no entraste</b><small>Entra con Discord y ves tu puesto, tus tarjetas y tus avisos, y puedes seguir a otros.</small><EntrarError /></div>
        <button type="button" className="btn verde" onClick={accion.entrar}>Entrar con Discord</button>
      </div>
    );
  }
  const s = yo && liga.svs[yo.sv];
  return (
    <div className="cu-quien" data-tuto="cu-quien" style={{ '--cu-c': (s && s.color) || '#29B298' }}>
      <span className="cu-av-con">
        {yo ? <Cara liga={liga} k={yo.k} nombre={yo.n} cls="cu-av" /> : <CaraDc dc={dc} cls="cu-av" />}
        <AnilloNivel dc={dc} />
      </span>
      <div className="cu-q">
        <b>{limpio(yo ? yo.n : dc.n)}</b>
        {/* 🪪 la línea de estado, como en la maqueta que eligió Dlx (20/10/2026): quién sos para la Liga, en tres datos */}
        {/* cada dato entero en su renglón (22/11/2026, la revisión visual G6#23): partía «FREESTYLE / FOR ALL»; el «·» va
            con el dato que sigue, así no queda colgando al final */}
        <small className="cu-estado">{[
          dc && dc.rapero ? 'Verificado' : dc ? 'Con Discord' : 'Sin entrar',
          yo && yo.rg ? 'Rango ' + yo.rg : (yo ? 'Sin rango todavía' : ''),
          s ? limpio(s.nombre || yo.sv) : '',
        ].filter(Boolean).map((t, i) => <Fragment key={i}>{i ? ' ' : ''}<span>{i ? '· ' : ''}{t}</span></Fragment>)}</small>
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
        <p className="cu-d cu-ver">Tu sesión es de una versión anterior. Actualízala para ver tus tarjetas y tu perfil: es un toque, no te pide nada.{' '}
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

// 🎭 TU ESTILO, en la cuenta (17/11/2026): tu estilo de juego y cómo se ven tus cartas. Elegir se hace en el vestidor del
// Inventario, que es donde está la carta viva: acá se ve qué tienes y se llega directo
const CARTAS_EST = [['temporada', 'Temporada'], ['servidor', 'Servidor'], ['competitivo', 'Competitiva'], ['pais', 'País']];
function EstiloCaja({ dc }) {
  const [d, setD] = useState(undefined);
  const [cat, setCat] = useState(null);
  useEffect(() => {
    if (!dc) { setD(null); return undefined; }
    let vivo = true;
    import('./pase.js').then((m) => m.pasePost('juego-mio', {})).then((r) => { if (vivo) setD(r && r._ok ? r : null); });
    import('./estilos_juego.json').then((m) => { if (vivo) setCat(m.default || m); });
    return () => { vivo = false; };
  }, [dc && dc.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const est = cat && d && d.juego ? (cat.estilos || []).find((x) => x[0] === d.juego) : null;
  return (
    <>
      <Caja t="Tu estilo de juego" d={!dc ? 'Entra con Discord para elegirlo.' : d === undefined ? 'Cargando…'
        : est ? 'Va en la columna izquierda de tu carta Competitiva. ' + (d.puede ? 'Puedes cambiarlo una vez en esta temporada.' : 'Ya lo cambiaste esta temporada.')
        : 'Todavía no elegiste. Va en la columna izquierda de tu carta Competitiva: el primero es libre.'}>
        {est ? <div className="cpc-estf"><span className="cpc-est" aria-hidden="true" style={{ WebkitMaskImage: 'url(' + est[4] + ')', maskImage: 'url(' + est[4] + ')' }} /><span><b>{est[1]}</b><small>{est[3]}</small></span></div> : null}
        {dc ? <a className="btn verde chico" href="#/inventario/temporada/juego">{est ? 'Cambiar mi estilo' : 'Elegir mi estilo'}</a> : null}
      </Caja>
      <Caja t="Tus cartas" d="El TAG, el marco, la foto y el estilo de cada una se cambian en el vestidor, con la carta viva al lado.">
        <div className="cu-btns">{CARTAS_EST.map(([c, n]) => <a key={c} className="btn borde2 chico" href={'#/inventario/' + c + '/tag'}>{n}</a>)}</div>
      </Caja>
      <Caja t="Tus emblemas y tus looks" d="Los emblemas salen al lado de tu nombre; un look guarda todo lo que llevan puesto tus cartas.">
        <div className="cu-btns"><a className="btn borde2 chico" href="#/inventario/temporada/emblemas">Mis emblemas</a><a className="btn borde2 chico" href="#/inventario">Mis looks</a></div>
      </Caja>
    </>
  );
}

export function Caja({ t, children, d, cls }) {
  return <section className={'cu-caja' + (cls ? ' ' + cls : '')}><h3>{t}</h3>{d ? <p className="cu-d">{d}</p> : null}{children}</section>;
}

// 🖥️ EN LA COMPU, DOS COLUMNAS QUE BAJAN CADA UNA A SU RITMO (18/11/2026, Dlx: «asegúrate que todas las páginas no
// tengan espacios innecesarios»). En la grilla de a dos de antes cada fila medía lo que su caja más alta, así que la de
// al lado quedaba con un hueco abajo: medido con sesión a 1333 px, 520×592 en Tu perfil y 520×384 en Privacidad. Las
// cajas van repartidas a mano para que las dos columnas terminen parejas (`cols`, sólo desde cuenta_pc.jsx)
export const DosCol = ({ a, b }) => <div className="cpc-2c"><div>{a}</div><div>{b}</div></div>;

// ── 🖼️ TU FONDO (13/10/2026). Dlx, a «una imagen propia para tu cuenta para el fondo»: «Sí, y mientras tanto con el Pase
// gratis», y dónde, «que él decida, pero por default en ambos». Con el nivel 10 del Pase subís una imagen; la ven los
// demás recién cuando la aprueba la Liga, y elegís si va en tu perfil, de fondo de tu página, o los dos. La imagen se
// achica acá antes de mandarla: recortada al centro, en webp, bajo los 600 KB (ver `fondo()` en avisos.js) ──
// 🔎 2400×960 desde el 12/11/2026 (Dlx: «el fondo no se ve en HD»): con 1600×640 la cabecera del perfil, a 1850 px de
// ancho y en una pantalla de alta densidad, la estiraba más del doble. El tope del Worker (600 KB) no cambia: entra igual
const FONDO_W = 2400, FONDO_H = 960, FONDO_TOPE = 600 * 1024;

const achicar = (archivo, AN = FONDO_W, AL = FONDO_H, TOPE = FONDO_TOPE) => achicarImagen(archivo, AN, AL, TOPE);
// 🧩 también los usa la pestaña Perfil del Inventario («el probador», perfil_inv.jsx)
export { achicar as achicarFondo, FONDO_W, FONDO_H };

export async function pedirFondo(ruta, cuerpo) {
  const r = await fetch('/api/avisos/' + ruta, { method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const e = { nivel: 'Se desbloquea con el nivel ' + (j.falta || 10) + ' del Pase de rapero.', premium: 'Subir tu propia imagen es del Pase premium.', tope: 'Ya subiste varias hoy: prueba mañana.',
      'no es una imagen': 'Eso no es una imagen.', 'demasiado grande': 'La imagen es muy pesada.',
      metadatos: 'La imagen trae datos escondidos (como dónde se sacó): elígela de nuevo desde acá y se limpian solos.',
      // 🛡️ el filtro automático (13/10/2026): no entra, y se dice por qué
      filtro: 'Esa imagen no pasó el filtro automático' + (j.texto ? ': parece tener ' + j.texto : '') + '. Elige otra.' }[j.error];
    throw new Error(r.status === 401 ? 'Entra con Discord de nuevo.' : e || j.error || String(r.status));
  }
  return j;
}

// ═══ 🖼️ TUS FONDOS (17/11/2026, la tanda 2 del remake de Tu cuenta). Dos partes: TU IMAGEN (subirla es del Pase
// premium; Dlx: «PREMIUM lo que te dejaría hacer es subir tu propia imagen, analizada con el filtro») y DÓNDE VA CADA
// UNO, para todos: los cinco lugares de `LUGARES` (fondos.js), cada uno con sus opciones y una vista chica de cada una.
// Elegir guarda al toque (`lugares` en `fondo()` de avisos.js) ═══
// 🎨 CÓMO SE VE «AUTOMÁTICO» DONDE NO ES UNA IMAGEN (25/11/2026, Dlx: «encontré un error»): en el escenario y en el VS en
// vivo la vista salía negra, como si no hubiera nada. Ahí lo automático es una luz o el fondo de otro: se dibuja eso
// —la luz de tu rango, la escena de tu servidor de ejemplo, el color de tu servidor en el perfil—
function vistaAuto(l, yo, liga) {
  const rgc = /^#[0-9a-f]{3,8}$/i.test(yo.rgc || '') ? yo.rgc : '#29B298';
  if (l === 'esc') return { background: 'radial-gradient(closest-side, color-mix(in srgb, ' + rgc + ' 55%, transparent), transparent), #0b0b0d' };
  if (l === 'vivo') { const e = escenaDe(yo.sv); return e ? { backgroundImage: 'url("' + e + '")' } : null; }
  if (l === 'perfil') { const c = yo.sv && liga && liga.svs && (liga.svs[yo.sv] || {}).color; return c ? { background: c } : null; }
  return null;
}

export function FondoCaja({ dc, liga }) {
  const [st, setSt] = useState(null);
  // 🪪 la opción de «Tu ficha» que estás mirando con el mouse o el teclado: la vista de abajo la prueba antes de elegirla
  const [prueba, setPrueba] = useState('');
  const [vista, setVista] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgL, setMsgL] = useState('');
  useEffect(() => {
    if (!dc) return undefined;
    let vivo = true;
    pedirFondo('mi-fondo').then((j) => { if (vivo) setSt(j); }).catch((e) => { if (vivo) setMsg(e.message); });
    return () => { vivo = false; };
  }, [dc && dc.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!dc) return <Caja t="Tus fondos" d="Entra con Discord para elegir qué va detrás de ti en cada lugar." />;
  if (!st) return <Caja t="Tus fondos"><p className="cu-d">{msg || 'Cargando…'}</p></Caja>;
  const f = st.fondo, pu = st.puede || {}, L = st.lugares || {};
  const perfil = f ? f.perfil : true, pagina = f ? f.pagina : false;
  // quién eres, para la bandera y tu servidor: la fila de la tabla, o la de los perfiles si vas más allá de los 200
  const yo = (liga && (liga.yo || (dc.clave && ((liga.T && liga.T[dc.clave]) || (liga.X && liga.X[dc.clave]))))) || {};
  // lo que se ve con lo de ahora, con la misma cuenta que usa cada lugar (`fondoEn()`)
  const fo = [f && f.url ? f.url : '', perfil ? 1 : 0, 0, L];
  const elegir = async (e) => {
    const a = e.target.files && e.target.files[0];
    if (!a) return;
    setMsg('');
    try {
      const b = await achicar(a);
      setArchivo(b); setVista(URL.createObjectURL(b));
      // 🔎 una imagen más chica que el fondo se estira: se avisa, con cuánto mide y cuánto pide
      const o = b.origen;
      if (o && (o.w < FONDO_W * 0.75 || o.h < FONDO_H * 0.75)) {
        setMsg('Tu imagen mide ' + o.w + '×' + o.h + ' px: en pantallas grandes se va a ver un poco borrosa. Para verla en HD, usa una de '
          + FONDO_W + '×' + FONDO_H + ' o más.');
      }
    } catch (er) { setMsg('No pude usar esa imagen: ' + er.message); }
  };
  const mandar = async (cuerpo, enLugares) => {
    setOcup(true); (enLugares ? setMsgL : setMsg)('');
    try {
      const j = await pedirFondo('fondo', cuerpo);
      setSt(j);
      if (cuerpo.img) {
        setArchivo(null); setVista('');
        // 🛡️ limpia se ve ya; si el filtro no estuvo seguro, la mira la Liga
        setMsg(j.filtro === 'ok' ? 'Listo: ya se ve.' : 'El filtro automático no estuvo seguro: la mira la Liga y, cuando la apruebe, se ve.');
      }
      if (enLugares) setMsgL('Guardado. En la página se ve al toque; en el VS en vivo, desde el próximo evento.');
    } catch (er) { (enLugares ? setMsgL : setMsg)(er.message); }
    setOcup(false);
  };
  const subir = async () => { if (archivo) await mandar({ img: await aBase64(archivo), perfil, pagina }); };
  const poner = (l, op) => mandar({ lugares: Object.assign({}, L, { [l]: op }) }, true);
  const estado = !f ? '' : f.pend ? 'En revisión: el filtro automático no estuvo seguro y la mira la Liga.' : f.estado === 'no' ? 'No se aprobó' + (f.motivo ? ': ' + f.motivo : '') + '. Puedes subir otra.' : f.url ? 'Ya se ve.' : '';
  const hayMia = !!(f && urlFondo(f.url));
  return (
    <>
      <Caja t="Tu imagen" cls="cu-img" d={pu.si ?'Tu propia imagen de fondo, para los lugares de abajo. Pasa por un filtro automático: sin desnudos, sangre, violencia, odio ni datos personales.'
        : 'Subir tu propia imagen es del Pase premium, y pasa por un filtro automático. La bandera y tu servidor son de todos: elígelos abajo.'}>
        {!pu.si && !(f && f.url) ? <p className="cu-d">💎 <a href="#/pase">Ver el Pase premium</a>{pu.prem && pu.pFalta ? ' · se abre en el nivel ' + pu.pFalta + ' del Pase' + (pu.pNivel != null ? ' (vas en el ' + pu.pNivel + ')' : '') : ''}.</p> : null}
        {f && urlFondo(f.pend || f.url) ? <div className="cu-fondo-ver" style={{ backgroundImage: urlFondo(f.pend || f.url) }} aria-label="Tu imagen" role="img" /> : null}
        {estado ? <p className="cu-d">{estado}</p> : null}
        {pu.si ? <>
          {vista ? <div className="cu-fondo-ver" style={{ backgroundImage: 'url("' + vista + '")' }} aria-label="La que vas a subir" role="img" /> : null}
          <div className="cu-btns">
            <label className="btn borde2 chico cu-fondo-arch">{f && (f.url || f.pend) ? 'Elegir otra imagen' : 'Elegir una imagen'}<input type="file" accept="image/*" onChange={elegir} /></label>
            {archivo ? <button type="button" className="btn verde chico" disabled={ocup} onClick={subir}>{ocup ? 'Subiendo…' : 'Subir'}</button> : null}
            {f && (f.url || f.pend) ? <button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => mandar({ borrar: true })}>Quitar mi imagen</button> : null}
          </div>
        </> : null}
        {msg ? <p className="cu-d" role="status">{msg}</p> : null}
      </Caja>
      <Caja t="Dónde va cada uno" d="Lo que va detrás de ti en cada lugar. «Automático» es lo de siempre.">
        <div className="tf-lugares">
          {LUGARES.map(([l, n, d, ops, auto]) => {
            const e = eleccion(fo, l);
            return (
              <div className="tf-lugar" key={l} data-parte={'fondo-' + l}>
                <div className="tf-lt"><b>{n}</b><small>{d}</small></div>
                <div className="tf-ops" role="radiogroup" aria-label={n}>
                  {ops.map((op) => {
                    const bg = op === 'auto' ? fondoEn([fo[0], fo[1], 0, {}], l, yo) : fondoOpcion(fo, op, yo);
                    const va = !bg && op === 'auto' ? vistaAuto(l, yo, liga) : null;
                    const probar = l === 'ficha' ? { onMouseEnter: () => setPrueba(op), onMouseLeave: () => setPrueba(''), onFocus: () => setPrueba(op), onBlur: () => setPrueba('') } : null;
                    const cerrada = (op === 'mia' && !hayMia) || (op === 'bandera' && !yo.cc) || (op === 'servidor' && !bg);
                    const on = e === op || (op === 'auto' && e === 'mia' && !hayMia);
                    return (
                      <button type="button" key={op} role="radio" aria-checked={on} className={'tf-op' + (on ? ' on' : '') + (cerrada ? ' cerrada' : '')}
                        disabled={ocup || cerrada} onClick={() => poner(l, op)} {...probar}
                        title={op === 'auto' ? auto : cerrada ? (op === 'mia' ? 'Sube tu imagen arriba' : op === 'bandera' ? 'Todavía no tienes país' : 'Tu servidor no tiene escena todavía') : NOMBRE_OPCION[op]}>
                        <span className={'tf-mini' + (bg || va ? '' : ' liso')} style={bg ? { backgroundImage: bg } : va || undefined} aria-hidden="true" />
                        <span className="tf-on">{NOMBRE_OPCION[op]}</span>
                        {op === 'auto' ? <small>{auto}</small> : cerrada ? <small>{op === 'mia' ? 'Sin imagen' : 'No disponible'}</small> : null}
                      </button>
                    );
                  })}
                </div>
                {l === 'ficha' && yo.k ? <FichaVista liga={liga} yo={yo} bg={prueba ? (prueba === 'auto' ? fondoEn([fo[0], fo[1], 0, {}], 'ficha', yo) : fondoOpcion(fo, prueba, yo)) : fondoEn(fo, 'ficha', yo)} prueba={prueba}
                  enFila={!!(prueba ? (prueba === 'auto' ? fondoPropio([fo[0], fo[1], 0, {}], 'ficha', yo) : fondoOpcion(fo, prueba, yo)) : fondoPropio(fo, 'ficha', yo))} /> : null}
              </div>
            );
          })}
        </div>
        {msgL ? <p className="cu-d" role="status">{msgL}</p> : null}
      </Caja>
    </>
  );
}

// 🪪 ASÍ TE VEN (25/11/2026, Dlx: «como te ves en el rectángulo… así como Discord tiene cómo te ves tu perfil, sin ir a tu
// perfil»). La ficha de verdad (`FichaCuerpo`, la misma que sale al pasar el mouse por tu cara), quieta, con lo que
// elegiste; al pasar por una opción, con esa
function FichaVista({ liga, yo, bg, prueba, enFila }) {
  return (
    <div className="tf-vista">
      <small className="tf-vista-t">{prueba ? 'Así te verían con «' + NOMBRE_OPCION[prueba] + '»' : 'Así te ven en tu ficha'}</small>
      <div className="fh fh-quieto" aria-label="Vista previa de tu ficha" role="img"><FichaCuerpo liga={liga} f={yo} bg={bg} /></div>
      <small className="tf-vista-p">{enFila ? 'Y va detrás de tu fila en el Ranking.'
        : 'En el Ranking tu fila queda negra, como la de todos: elige tu bandera o tu servidor (o sube tu imagen) para que se vea ahí.'}</small>
    </div>
  );
}

// ── 📸 TU FOTO DE TARJETA (13/10/2026). Dlx: «la opción de foto personalizable de la tarjeta y quizás la opción de
// cambiarla para cada tarjeta… agrega un filtro a eso también», y a las preguntas: «Nivel 15 gratis», «Una por
// tarjeta», «Una por semana». Una imagen tuya en vez de la de Discord, en las tarjetas que elijas: pasa por el filtro
// automático (`fotoCarta()` en avisos.js) y cada tarjeta se cambia una vez por semana. Se achica acá: 768×768 ──
const FOTO_LADO = 768, FOTO_TOPE = 500 * 1024;
const CARTAS_FOTO = [['temporada', 'Temporada'], ['competitivo', 'Competitiva'], ['servidor', 'Servidor'], ['pais', 'País']];
// la última va con « y » (18/11/2026): «Temporada, Competitiva, Servidor, País se vuelven…» se leía cortado
const nombresCartas = (cs) => {
  const ns = (cs || []).map((c) => (CARTAS_FOTO.find((x) => x[0] === c) || [c, c])[1]);
  return ns.length > 1 ? ns.slice(0, -1).join(', ') + ' y ' + ns[ns.length - 1] : ns.join('');
};
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
    // también con la clave (18/11/2026): `refrescarVerificado()` se la suma al MISMO `dc` (el id no cambia) y la caja
    // se quedaba en «Cargando…» hasta recargar
  }, [dc && dc.id, dc && dc.clave]); // eslint-disable-line react-hooks/exhaustive-deps
  // se llamaba «Tu foto de tarjeta», pegada a «Tu foto de la tarjeta» (la de Discord): parecían la misma sección dos veces
  const T = 'Tu propia imagen en las tarjetas';
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
        // una sola carta, en singular (18/11/2026): «Listo: Competitiva se vuelven a dibujar…» con una
        setMsg(j.filtro === 'ok' ? 'Listo: ' + (cuerpo.cartas.length === 1 ? 'tu tarjeta ' + nombresCartas(cuerpo.cartas) + ' se vuelve'
          : 'tus tarjetas ' + nombresCartas(cuerpo.cartas) + ' se vuelven') + ' a dibujar con ella en unos minutos.'
          : 'El filtro automático no estuvo seguro: la mira la Liga y, cuando la apruebe, sale en tus tarjetas.');
      } else setMsg('Listo: esa tarjeta vuelve a tu foto de Discord en unos minutos.');
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
    cuerpo = <p className="cu-d"><b>Listo</b>: ésa es tu foto de la {T}. Tus tarjetas se vuelven a dibujar con ella en unos minutos.{F.libre ? ' ' + libre(F) : ''}</p>;
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
    // sin red, el fetch se rechaza (18/11/2026): sin esto «Sumar» y «Mandar» se quedaban en «Mandando…» para siempre
    let r;
    try {
      r = await fetch('/api/avisos/mis-videos', { method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
    } catch (e) { return 'Sin conexión: prueba de nuevo.'; }
    const j = await r.json().catch(() => ({}));
    if (j.pedidos) setPs(j.pedidos);
    return r.ok ? '' : VID_ERR[j.error] || 'No se pudo. Prueba de nuevo.';
  };
  useEffect(() => {
    if (!dc || !dc.clave) return;
    pedir({ accion: 'ver' }).then((e) => { if (e) setMsg(e); });
    // también con la clave (18/11/2026): llega por `refrescarVerificado()` con la página abierta y el mismo id
  }, [dc && dc.id, dc && dc.clave]); // eslint-disable-line react-hooks/exhaustive-deps
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
export function ServidorCaja({ liga, dc, paso }) {
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
  const d = 'Si la ocultas, la página y tus tarjetas (también las de Discord) te muestran con tu inicial. Se aplica en unos minutos.';
  if (!dc) return <Caja t="Tu foto" d={d + ' Entra con Discord para usarlo.'}><BotonEntrar /></Caja>;
  const M = est.MIFOTO || {};
  const e = est.MIFOTO_EST || {};
  const nota = !est.MIFOTO ? 'Cargando…'
    : e.error ? e.error
    : M.error ? ((W.errorCuenta && W.errorCuenta(M.error)) || 'No pude leerlo. Prueba en un rato.')
    : e.va ? 'Guardando…'
    : M.oculta ? (e.ok ? '✓ Oculta. ' : '') + 'Tus tarjetas se vuelven a dibujar con tu inicial en unos minutos.'
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

// 💬 «COMENTARIOS CON MI CARA» (12/11/2026). Los comentarios simulados de Publicaciones pueden salir con tu foto y tu
// nombre: con la etiqueta «simulado» hasta que le digas que sí a Dlx, sin ella después. Apagado, no apareces nunca.
// Lo guarda el objeto (`cmMio()`) y llega al ciclo en su próxima vuelta
function CaraComentarios({ dc }) {
  const [st, setSt] = useState(null);
  const [va, setVa] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let vivo = true;
    if (dc && W.conCuenta) W.conCuenta('/api/avisos/cm-mio', {}).then((j) => { if (vivo && j) setSt(j); }).catch(() => {});
    return () => { vivo = false; };
  }, [dc && dc.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = 'Debajo de las publicaciones salen comentarios cortos que escribe la Liga. Pueden salir con tu foto y tu nombre, con la etiqueta «simulado». Si lo apagas, no apareces nunca.';
  if (!dc) return <Caja t="Comentarios con tu cara" d={d + ' Entra con Discord para elegir.'}><BotonEntrar /></Caja>;
  if (st && st.sin_perfil) return null;
  // sin respuesta buena, no se dice «prendido» (18/11/2026, como en `PublicarSolo`): con la sesión vencida llegaba
  // `{error: 'sin_sesion'}`, sin `estado`, y la casilla salía marcada aunque lo hubieras apagado
  const roto = !!st && !st.ok;
  const on = !!st && !roto && st.estado !== 'no';
  const cambiar = async (quiero) => {
    if (!W.conCuenta) return;
    setVa(true);
    setMsg('');
    try {
      // 's' y no 'p' (18/11/2026): con la sesión vencida, 'p' volvía de Discord a Publicaciones; 's' vuelve acá mismo
      const j = await W.conCuenta('/api/avisos/cm-mio', { quiero }, 's');
      if (j && j.ok) setSt(j);
      else if (j) setMsg(j.error === 'espera' ? 'Ya lo cambiaste muchas veces hoy: prueba mañana.' : 'No se pudo: prueba de nuevo.');
    } finally { setVa(false); }
  };
  const nota = !st ? 'Cargando…' : msg || (va ? 'Guardando…'
    : roto ? ((W.errorCuenta && W.errorCuenta(st.error)) || 'No pude leerlo. Prueba en un rato.')
      : !on ? 'Apagado: no apareces en ningún comentario simulado.'
        : st.estado === 'si' ? 'Prendido, sin etiqueta: le dijiste que sí a Dlx.'
          : 'Prendido: sales con la etiqueta «simulado».');
  return (
    <Caja t="Comentarios con tu cara" d={d}>
      <label className="cu-sw"><span><b>Dejar que la Liga comente con mi foto</b><small role="status">{nota}</small></span>
        <input type="checkbox" checked={on} disabled={!st || va || roto} onChange={(ev) => cambiar(ev.target.checked)} />
        <i aria-hidden="true" /></label>
    </Caja>
  );
}

// 🙈 «PUBLICAR LO MÍO SOLO» (Dlx, 15/11/2026, a «¿cada uno puede apagar sus publicaciones automáticas desde Tu cuenta?»:
// «dALE»). Lo que la Liga publica sola de ti —tu carta nueva, subir de rango, ganar, tu racha…— sale firmado por ti y en
// primera persona. Apagado, no sale en Publicaciones ni en tu perfil. Lo guarda el objeto (`muroMio()`) y lo aplica el
// ciclo en su próxima vuelta (bot/muro_solos.py `apagados()`)
function PublicarSolo({ dc }) {
  const [st, setSt] = useState(null);
  const [va, setVa] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let vivo = true;
    if (dc && W.conCuenta) W.conCuenta('/api/avisos/muro-mio', {}).then((j) => { if (vivo && j) setSt(j); }).catch(() => {});
    return () => { vivo = false; };
  }, [dc && dc.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = 'Cuando sacas una carta, subes de rango, ganas un evento o llevas una racha, la Liga lo publica sola en Publicaciones, firmado por ti y en primera persona («Subí a rango B»). Si lo apagas, no sale ni ahí ni en tu perfil.';
  if (!dc) return <Caja t="Tus publicaciones" d={d + ' Entra con Discord para elegir.'}><BotonEntrar /></Caja>;
  if (st && st.sin_perfil) return null;
  const roto = !!st && !st.ok;                                         // sin respuesta buena, no se dice «prendido»
  const on = !!st && !roto && st.publica !== false;
  const cambiar = async (publicar) => {
    if (!W.conCuenta) return;
    setVa(true);
    setMsg('');
    try {
      // 's' y no 'p' (18/11/2026): con la sesión vencida, 'p' volvía de Discord a Publicaciones; 's' vuelve acá mismo
      const j = await W.conCuenta('/api/avisos/muro-mio', { publicar }, 's');
      if (j && j.ok) setSt(j);
      else if (j) setMsg(j.error === 'espera' ? 'Ya lo cambiaste muchas veces hoy: prueba mañana.' : 'No se pudo: prueba de nuevo.');
    } finally { setVa(false); }
  };
  const nota = !st ? 'Cargando…' : msg || (va ? 'Guardando…'
    : roto ? ((W.errorCuenta && W.errorCuenta(st.error)) || 'No pude leerlo. Prueba en un rato.')
      : on ? 'Prendido: lo tuyo sale en Publicaciones.' : 'Apagado: se aplica en la próxima vuelta del ciclo (unos 30 minutos).');
  return (
    <Caja t="Tus publicaciones" d={d}>
      <label className="cu-sw"><span><b>Publicar lo mío solo</b><small role="status">{nota}</small></span>
        <input type="checkbox" checked={on} disabled={!st || va || roto} onChange={(ev) => cambiar(ev.target.checked)} />
        <i aria-hidden="true" /></label>
    </Caja>
  );
}

// a quién sigues. 🧑 DE LA LISTA ENTERA (18/11/2026): `liga.sigue` viene filtrada por las 200 filas de la tabla, así que
// a quien seguías del #201 en adelante no salía acá ni se contaba. Es su propio componente para pedir los perfiles
// (`quienK()` los lee cuando llegan) sólo en esta parte
function Sigues({ liga, dc }) {
  usePerfiles();
  const ks = liga.sigueTodos || liga.sigue;
  const fs = ks.map((k) => liga.quienK(k)).filter(Boolean);
  // ⭐ y los pros y los de plaza del Ranking global (`g--<clave>`, sigo_global.js, 25/11/2026): su nombre y su cara salen de
  // /global.json, que se baja sólo si sigues a alguien de afuera
  const fuera = ks.filter(esDeAfuera);
  const [G, setG] = useState(() => globalListo());
  useEffect(() => {
    if (!fuera.length || G) return undefined;
    let vivo = true;
    bajarGlobal().then((d) => { if (vivo) setG(d); }).catch(() => {});
    return () => { vivo = false; };
  }, [fuera.length, G]);
  const porK = G && G.g ? new Map(G.g.map((x, i) => [x.k, { ...x, pos: x.p > 0 ? i + 1 : 0 }])) : null;
  const gs = porK ? fuera.map((k) => porK.get(deAfuera(k))).filter(Boolean) : [];
  const n = fs.length + (porK ? gs.length : fuera.length);
  return (
    <Caja t={'Sigues a ' + n} d={dc ? 'Te llega un aviso cuando ganan, suben de rango o desbloquean una tarjeta (activa los avisos en este dispositivo).'
      : 'Entra con Discord y te avisamos cuando ganen o suban de rango.'}>
      {fs.length || gs.length ? <ul className="cu-gente">{fs.map((f) => (
        <li key={f.k}><a href={'#/r/' + encodeURIComponent(f.k)}><FondoPropio liga={liga} k={f.k} /><Cara liga={liga} k={f.k} nombre={f.n} cls="cu-av chica" /><b>{limpio(f.n)}</b>
          <small>{f.pos ? '#' + f.pos : ''}</small></a></li>
      ))}{gs.map((g) => (
        <li key={'g' + g.k}><a href={'#/global/' + encodeURIComponent(g.k)}>
          <span className={'cu-av chica' + (g.ft ? '' : ' sil')}><img alt="" src={g.ft || siluetaDe(g.n)} loading="lazy" /></span>
          <b>{limpio(g.n)}</b><small>{g.pos ? '#' + g.pos + ' global' : 'global'}</small></a></li>
      ))}</ul> : <a className="btn borde2 chico" href="#/ranking">Buscar a quién seguir</a>}
    </Caja>
  );
}

// quién te sigue: cuántos, y de ésos los que son raperos (los demás no tienen perfil)
function TeSiguen({ liga, dc }) {
  const est = useCuentaEst();
  // 🧑 también los de fuera de las 200 filas (18/11/2026): con `liga.T` el #250 que te sigue se contaba entre «personas
  // que no compiten». `quienK()` mira la tabla, los perfiles (por eso se piden: llegan después) y las filas ligeras
  const P = usePerfiles();
  const ms = est.ME_SIGUEN;
  // 🤖 la Liga que te sigue (los personajes y las barras de tus servidores): suma al número y se ve como Liga, con su
  // pastilla (`LigaTeSigue` de sugeridos.jsx)
  const mio = P && P.p && liga.yo ? P.p[liga.yo.k] : null;
  const nL = ligaSigue(liga.yo, mio, liga).length;
  const liga1 = nL ? <LigaTeSigue f={liga.yo} p={mio} liga={liga} yo /> : null;
  if (!ms || !ms.n) return liga1 ? <Caja t={'Te siguen ' + nL}>{liga1}</Caja> : null;
  const suyos = (ms.perfiles || []).map((k) => liga.quienK(k)).filter(Boolean);
  const otros = ms.n - suyos.length;
  return (
    <Caja t={'Te siguen ' + (ms.n + nL)} d={otros > 0 ? (suyos.length ? 'Y ' : '') + otros + (otros === 1 ? ' persona que no compite.' : ' personas que no compiten.') : ''}>
      {suyos.length ? <ul className="cu-gente">{suyos.map((f) => (
        <li key={f.k}><a href={'#/r/' + encodeURIComponent(f.k)}><FondoPropio liga={liga} k={f.k} /><Cara liga={liga} k={f.k} nombre={f.n} cls="cu-av chica" /><b>{limpio(f.n)}</b></a>
          {liga.sigo(f.k) ? null : <BotonSeguir liga={liga} dc={dc} k={f.k} de chico />}</li>
      ))}</ul> : null}
      {liga1}
    </Caja>
  );
}

// ⭐ GENTE PARA SEGUIR (21/11/2026, sugeridos.jsx): quien te sigue y no sigues, quien está en tus mismos servidores
// (`useComparten()`, con el permiso `guilds`), con quien hablas en el chat, con quien te
// cruzaste en una llave y los primeros de tu servidor, cada uno con su porqué y su botón. Sin nadie que sugerir, no se dibuja
function ParaSeguir({ liga, dc }) {
  const est = useCuentaEst();
  const P = usePerfiles();
  // quien te sigue ya está en «Te siguen», con su «Seguir de vuelta»: acá no se repite
  const ya = (est.ME_SIGUEN && est.ME_SIGUEN.perfiles) || [];
  const comparten = useComparten(dc);
  if (!liga.yo || !sugeridos(liga, P, null, 6, ya, comparten).length) return null;
  return <Caja t="Gente para seguir" d="Te llega un aviso cuando ganan, y a ellos, que los sigues."><GenteParaSeguir liga={liga} dc={dc} P={P} meSiguen={null} excluir={ya} /></Caja>;
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
  // 🆘 más opciones (23/11/2026, Dlx: «agrega más opciones a soporte en ese panel de ayuda»)
  ['hackeo', 'Me hackearon la cuenta', 'Alguien entró a tu Discord: pídelo desde tu cuenta nueva y pasamos tu perfil, tus Puntos y tu Pase.'],
  ['premio', 'No me llegó un premio', 'Puntos de Tienda, un Drop, el Pase, un título o una recompensa que ganaste y no aparece.'],
  ['puntos', 'Mis puntos o mi puesto están mal', 'Tus puntos, tu rango o tu lugar en un ranking no cuadran con lo que jugaste.'],
  ['carta', 'Mi carta está mal', 'Tu carta no aparece, tiene un dato mal o la foto no es la tuya.'],
  ['falla', 'Algo no funciona', 'Un botón, una página o un comando del bot que falla.'],
  ['otro', 'Otra cosa', 'Lo que no entra en las de arriba.'],
];
// 💡 lo que ya se puede hacer al instante, sin esperar a nadie: se dice antes de pedir (17/10/2026: la llave tiene su
// «¿Algo está mal en esta llave?», que se corrige y se aplica solo, y los videos que subiste vos tienen «Quitar»)
const ATAJO_PED = {
  hackeo: 'Primero cambia la contraseña y revisa tu correo en Discord. Pídelo desde la cuenta nueva: la vieja deja de entrar a tu perfil.',
  falla: 'Si puedes, di qué tocaste, en qué página y si fue en el celular o en la compu.',
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
  // 🧑 TODOS LOS PERFILES, NO SÓLO LAS 200 FILAS (18/11/2026): quien estaba del #201 en adelante no se encontraba, y
  // «Perdí mi cuenta», «Ese no soy yo» y «Un video» piden el perfil: el botón no se habilitaba nunca. Antes del
  // `return` de abajo, por el orden de los hooks
  const P = usePerfiles();
  if (!dc) {
    return <Caja t="Algo está mal" d="Entra con Discord —con la cuenta que usas ahora— para pedir que lo arreglemos."><BotonEntrar chico={false} /></Caja>;
  }
  // con `norm()`, que pliega las tildes: «andres» encuentra a «Andrés»
  const nq = norm(q).trim();
  let res = [];
  if (nq.length >= 2) {
    const pool = new Map();
    (liga.d.tabla || []).forEach((f) => { if (f && f.k) pool.set(f.k, f); });
    Object.values((P && P.p) || {}).forEach((x) => { if (x && x.f && x.f.k && !pool.has(x.f.k)) pool.set(x.f.k, x.f); });
    Object.values(liga.Fx || {}).forEach((f) => { if (f && f.k && !pool.has(f.k)) pool.set(f.k, f); });
    res = [...pool.values()].filter((f) => norm(limpio(f.n)).includes(nq)).slice(0, 6);
  }
  // y el elegido sale de cualquiera de esos (en «video» se pone el tuyo solo, y puedes estar fuera de las 200)
  const elegido = k ? liga.quienK(k) : null;
  // Emiratos y Brasil no cuentan como países de la Liga (Dlx, 22/09/2026)
  const paises = Object.entries(PAIS).filter(([c]) => c !== 'ae' && c !== 'br').sort((a, b) => a[1].localeCompare(b[1]));
  const mandar = () => {
    setEst({ va: true });
    const v = (vid.match(/(?:youtu\.be\/|v=|shorts\/)([A-Za-z0-9_-]{11})/) || [])[1] || vid.trim();
    // 's' vuelve de Discord a esta misma parte (18/11/2026): hasta hoy la 's' llevaba al panel del socio (#/socio); ahora
    // el panel tiene su 'a' y la 's' vuelve a la ruta desde donde se fue (`lg:vuelta-s`, `urlLogin()` en cuenta.js)
    W.conCuenta('/api/avisos/pedido', { tipo, k, texto, cc, vid: v }, 's').then((j) => {
      if (j === null) return; // se fue a Discord a confirmar quién eres
      if (j && j.ok) { setEst({ ok: true }); setTipo(''); setTexto(''); setK(''); setQ(''); pedirMios(); }
      else setEst({ error: (j && j.error) || 'error' });
    }).catch(() => setEst({ error: 'red' }));
  };
  const conPerfil = tipo === 'cuenta' || tipo === 'hackeo' || tipo === 'identidad' || tipo === 'video';
  const falta = !tipo ? 'Elige qué está mal.' : conPerfil && !k ? 'Busca el perfil.'
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
        {conPerfil ? (
          <div className="pd-campo">
            <label htmlFor="pd-q">{tipo === 'cuenta' || tipo === 'hackeo' ? '¿Cuál era tu perfil?' : tipo === 'video' ? '¿En qué perfil aparece?' : '¿Qué perfil está mal?'}</label>
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
          <div className="pd-campo"><label htmlFor="pd-tx">{tipo === 'cuenta' || tipo === 'hackeo' ? '¿Cómo lo comprobamos? (tu cuenta vieja, quién te conoce…)' : 'Cuéntanos qué pasa'}{tipo === 'pais' ? ' (si quieres)' : ''}</label>
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

export function Parte({ id, liga, dc, tema, onTema, temaSv, onTemaSv, sinServidor = false, cols = false }) {
  // 🔓 tu nivel, para los colores de los servidores (ver `NIVEL_TEMA` en temas.js)
  const Rn = useRacha(!!dc && id === 'apariencia');
  const [temaMsg, setTemaMsg] = useState('');
  // 🔔 si la campana está activa de verdad, para «Avisos» (18/11/2026): arriba y sin condición, por el orden de los hooks
  const camp = useCampana();
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
            <p className="cu-d">Tu sesión es de una versión anterior. Actualízala para ver tus tarjetas y tu perfil: es un toque, no te pide nada.{' '}
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
  if (id === 'fondo') return <FondoCaja dc={dc} liga={liga} />;
  // 🖥️ las dos páginas nuevas de la compu (17/11/2026), que el celular también abre si le llega el link
  if (id === 'servidor') return <ServidorCaja liga={liga} dc={dc} />;
  if (id === 'estilo') return <EstiloCaja dc={dc} />;
  if (id === 'algo-mal') return <Pedidos liga={liga} dc={dc} />;
  if (id === 'perfil') {
    const foto = <FotoCaja key="foto" liga={liga} dc={dc} />;
    /* 💬 tu frase entre comillas, debajo de tu nombre en tu perfil (la tanda 2 del perfil, 27/10/2026) */
    const frase = (
      <Caja key="frase" t="Tu frase" d={!dc ? 'Entra con Discord para escribirla.' : !dc.clave ? 'Primero necesitas estar verificado.' : 'Sale entre comillas debajo de tu nombre, en tu perfil.'}>
        {dc && dc.clave ? <FraseEditor k={dc.clave} /> : !dc ? null : <a className="btn verde chico" href="#/cuenta/verificar">Verificarme</a>}
      </Caja>
    );
    const carta = <FotoCartaCaja key="carta" dc={dc} />;
    const redes = <RedesCaja key="redes" dc={dc} />;
    const videos = <VideosCaja key="videos" dc={dc} />;
    /* 🖥️ en la compu, tu servidor tiene su propia página (cuenta_pc.jsx): ahí no se repite */
    const serv = sinServidor ? null : <ServidorCaja key="serv" liga={liga} dc={dc} />;
    // las dos fotos a la izquierda y lo que se lee en tu perfil a la derecha: 693 contra 623 px de alto
    if (cols) return <DosCol a={[foto, carta]} b={[frase, redes, videos, serv]} />;
    return <>{foto}{frase}{carta}{redes}{videos}{serv}</>;
  }
  if (id === 'crew') return <Caja t="Mi crew"><MiCrew liga={liga} dc={dc} /></Caja>;
  if (id === 'siguiendo') {
    const sigues = <Sigues key="sigues" liga={liga} dc={dc} />;
    const teSiguen = <TeSiguen key="te" liga={liga} dc={dc} />;
    const orgs = <OrgsCaja key="orgs" dc={dc} />;
    const sug = <ParaSeguir key="sug" liga={liga} dc={dc} />;
    if (cols) return <DosCol a={[sigues, sug]} b={[teSiguen, orgs]} />;
    return <>{sigues}{sug}{teSiguen}{orgs}</>;
  }
  if (id === 'privacidad') {
    const xs = [
      <OcultarFoto key="foto" dc={dc} />,
      <CaraComentarios key="cara" dc={dc} />,
      <PublicarSolo key="publ" dc={dc} />,
      <Caja key="datos" t="Tus datos" d="En Discord, /borrar-mis-datos borra todo lo tuyo de la Liga: tus tarjetas, tu foto y lo que el bot sabe de ti." />,
      <Caja key="disp" t="Este dispositivo" d="Olvida quién eres, tus ajustes y los avisos de este dispositivo. Tus tarjetas y tu cuenta no se tocan.">
        <DosToques className="btn borde2 chico" confirmar="¿Seguro? Toca de nuevo" onClick={() => { if (W.cuentaOlvidarTodo) W.cuentaOlvidarTodo(); }}>Olvidar este dispositivo</DosToques>
      </Caja>,
    ];
    // en el mismo orden, partidas después de la segunda: 410 contra 527 px de alto
    if (cols) return <DosCol a={xs.slice(0, 2)} b={xs.slice(2)} />;
    return <>{xs}</>;
  }
  if (id === 'avisos') {
    const svs = leer('campana:svs', []) || [];
    // el estado de verdad (18/11/2026): `campana:activada` la baja Desactivar (campana.js), pero no una baja que hace el
    // navegador solo (permiso revocado), y ahí seguía diciendo «Activados». La marca, sólo si campana.js no cargó
    const activos = camp ? !!camp.activa : !!leer('campana:activada', false);
    const de = Object.values(liga.svs).filter((o) => !svs.length || svs.includes(o.sv));
    return (
      <Caja t="En este dispositivo" d={activos ? 'Activados: te avisa al minuto de que ' + (svs.length ? de.map((o) => siglaDe(o.sv)).join(', ') : 'cualquier servidor') + ' anuncia un evento.'
        : 'Apagados. Actívalos y te avisa al minuto de que un servidor anuncia un evento.'}>
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
  if (id === 'introduccion') {
    return (
      <Caja t="La introducción" d="La bienvenida de la Liga, entera y desde el principio: qué es, las cartas, los eventos, el ranking, el Pase y la comunidad. También se abre con el link underlegends.pages.dev/freestyle-rap/bienvenida.">
        <a className="btn verde chico" href="#/bienvenida">Ver la introducción</a>
      </Caja>
    );
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

// (exportada: la página de verificarse, verificar.jsx, mira si ya empezaste)
export function useVerif() {
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

// (exportada: la usa también la pantalla de bienvenida, en su paso 2 —bienvenida.jsx—, y la página de verificarse,
// verificar.jsx, que dice los permisos de Discord en su costado: `nota={false}` no los repite)
export function Verificar({ liga, dc, nota = true }) {
  const v = useVerif();
  const yo = liga.yo;
  // 🔁 SE REVISA SOLA AL VOLVER DE DISCORD (04/11/2026): quien abre DRA acepta las reglas allá, y al volver encontraba lo
  // mismo hasta que encontraba «Revisar de nuevo». Una sola vez por cada vez que abrió DRA, con un momento para que Discord
  // se entere. El Worker deja 6 por minuto: esto no llega ni cerca
  const alVolver = useRef(false);
  useEffect(() => {
    const f = () => {
      if (document.visibilityState !== 'visible' || !alVolver.current) return;
      alVolver.current = false;
      setTimeout(() => revisar(), 800);
    };
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, []);
  // ⏱️ cuándo se miró por última vez: si no cambió nada, se ve que sí miró
  const cargando = !!(v && v.cargando);
  const miraba = useRef(false);
  const [revisado, setRevisado] = useState(null);
  useEffect(() => {
    if (miraba.current && !cargando) setRevisado(new Date());
    miraba.current = cargando;
  }, [cargando]);
  // ya cargado: con su clave de la Liga (`d:`), que sólo tiene quien pasó el portón
  if ((dc && dc.rapero) || (v && v.listo)) {
    return (
      <>
        <Caja t="Ya estás verificado" d="Tus tarjetas salen con /card en Discord, y tu perfil está en la página.">
          {/* quien no entra en la tabla tiene perfil igual: su clave viene con la cuenta */}
          {(yo && yo.k) || (dc && dc.clave) ? <a className="btn verde chico" href={'#/r/' + encodeURIComponent((yo && yo.k) || dc.clave)}>Ver mi perfil</a> : null}
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
      // (en la página de verificarse lo que se abre lo dice su costado: acá va sólo qué es)
      <Caja t="Qué es estar verificado" d={nota ? 'Estar en Discord Rap Español, con tu país y el rol de Miembro. Sin eso no hay tarjetas: verificado se abre tu Servidor, con tu primera Tarea del Pase tu Temporada, y la Competitiva y la de País con su requisito. Y tu perfil, con tu foto y tus redes.'
        : 'Estar en Discord Rap Español, con tu país y el rol de Miembro.'}>
        <button type="button" className="btn verde" disabled={!!(v && v.cargando)} onClick={() => (W.DC_TOKEN ? revisar() : irADiscord())}>
          {v && v.cargando ? 'Mirando Discord Rap Español…' : 'Verificarme con Discord'}</button>
        {nota ? <small className="cu-nota">Discord te va a pedir dos permisos: ver tu usuario y unirte a servidores por ti, que es lo que deja al bot meterte en Discord Rap Español si todavía no estás. Se usa una vez y no se guarda.</small> : null}
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
  const abrir = <a key="dra" className="btn borde2 chico" href={DRA_URL} target="_blank" rel="noopener noreferrer" onClick={() => { alVolver.current = true; }}>Abrir DRA ↗</a>;
  let pais;
  if (paises.length === 1) {
    pais = ['ok', <>Tu país: {PAIS[paises[0]] || paises[0].toUpperCase()} <Bandera cc={paises[0]} cls="cu-band" /></>,
      v.puso ? 'Te pusimos el rol en DRA recién.' : ''];
  } else if (v.pendiente) {
    pais = ['espera', 'Tu país', 'Lo eliges acá cuando aceptes las reglas.'];
  } else if (paises.length > 1 && v.porRol) {
    pais = ['aviso', 'Tienes ' + paises.length + ' países en DRA', 'Deja uno solo en tus roles de DRA. Al volver acá se revisa solo.', abrir];
  } else {
    pais = ['falta', 'Tu país', paises.length > 1 ? 'Tu nombre tiene ' + paises.length + ' banderas: elige la tuya y el bot te pone ese rol en DRA.'
      : 'Elígelo y el bot te pone ese rol en DRA.', <ElegirPais key="p" v={v} />];
  }
  const vuelta = v.vuelta ? hora(v.vuelta) : '';
  // ▶️ el Worker ya largó el ciclo (13/11/2026): no hace falta esperar a la vuelta
  const yaVa = !!v.corre;
  // ✅ con todo completo, el Worker te lo da en el momento (`darMiembro()`, Dlx 12/10/2026: «A y B»)
  const miembro = v.rol ? ['ok', 'Tienes el rol de Miembro', v.dimos ? 'Te lo dimos recién.' : '']
    : v.revisa ? ['aviso', 'Tu caso lo revisa un admin', 'No hace falta que hagas nada más.']
      : v.completo ? ['espera', 'Tu rol de Miembro', 'Te lo da el bot solo' + (yaVa ? ': ya te está cargando, en unos minutos' : vuelta ? ', en la vuelta de las ' + vuelta + ' o en la siguiente' : '') + '. Con él sale tu tarjeta de Servidor.']
        : ['espera', 'Tu rol de Miembro', 'Te lo da el bot cuando completes lo de arriba.'];
  const filas = [
    ['ok', 'Tu Discord', dc ? limpio(dc.n) : 'Conectado'],
    ['ok', 'Estás en Discord Rap Español', v.entro ? 'Te metimos recién.' : 'Ya estabas adentro.'],
    v.pendiente ? ['aviso', 'Acepta las reglas de DRA', 'Discord te las muestra al abrir el servidor: es un toque. Al volver acá se revisa solo.', abrir]
      : ['ok', 'Aceptaste las reglas de DRA', ''],
    pais,
    miembro,
  ];
  const resumen = v.completo
    ? (v.rol ? 'Estás verificado en DRA. Tus tarjetas salen cuando el bot te cargue' + (yaVa ? ': ya te está cargando, en unos minutos.' : vuelta ? ': en la vuelta de las ' + vuelta + ' o en la siguiente.' : '.')
      : 'Lo tuyo está completo. El resto lo hace el bot solo.')
    : v.revisa ? 'Lo tuyo está completo. Tu caso lo revisa un admin.' : 'Te falta lo que está marcado abajo.';
  // cuántos van, y cuál toca ahora: el primero que no está listo
  const hechas = filas.filter((f) => f[0] === 'ok').length;
  const ahora = filas.findIndex((f) => f[0] !== 'ok');
  return (
    <>
    <Caja t={v.completo ? 'Listo de tu lado' : 'Lo que falta'} d={resumen}>
      <div className="cu-prog" role="img" aria-label={hechas + ' de ' + filas.length + ' listos'}>
        <span>{hechas} de {filas.length}</span>
        <i>{filas.map((f, i) => <u key={i} className={f[0] === 'ok' ? 'ok' : i === ahora ? 'ahora' : ''} />)}</i>
      </div>
      <ul className="cu-chk" aria-busy={!!v.cargando} aria-live="polite">{filas.map(([e, t, d, acc], i) => (
        <li key={i} className={e + (i === ahora ? ' ahora' : '')}><span className="cu-chk-i"><Ico n={e} t={18} /></span><span className="cu-chk-t"><b>{t}</b>{d ? <small>{d}</small> : null}</span>{acc || null}</li>
      ))}</ul>
      <button type="button" className="btn borde2 chico" disabled={!!v.cargando} onClick={() => revisar()}>{v.cargando ? 'Mirando…' : 'Revisar de nuevo'}</button>
      {revisado && W.fmtHora ? <small className="cu-rev">Revisado a las {W.fmtHora(revisado)}</small> : null}
    </Caja>
    {v.completo ? <ServidorCaja liga={liga} dc={dc} paso /> : null}
    </>
  );
}

// `#/cuenta/verificar`, sola: desde el 02/11/2026 es verificar.jsx (el remake), con esta `Verificar` adentro

// 🖥️ EN LA COMPU, LA SECCIÓN ELEGIDA Y NADA MÁS (Dlx, 20/10/2026, ~5:15 PM: «está mostrando todas las configuraciones a
// lo loco cuando debería mostrar de acuerdo a lo que está seleccionado en el momento»). Es la misma vista del teléfono
// —la lista en cajas a la izquierda, la parte a la derecha—, con la primera abierta de entrada. Hasta hoy la compu
// mostraba TODAS las partes en tarjetas, en dos columnas (Dlx, 02/10: «me gusta rellenar el espacio así»): la sacó él
export function Cuenta({ liga, dc, parte, tema, onTema, temaSv, onTemaSv }) {
  // 🔔 el estado de verdad de la campana, para la fila «Avisos de eventos» (18/11/2026, ver `grupos()`)
  const camp = useCampana();
  const gs = grupos(liga, dc, tema, temaSv, camp);
  // 🔒 el acceso al Dashboard, a la vista sólo para el dueño. Es un atajo: la puerta de verdad está en el servidor
  // 🔐 el botón del Dashboard: Dlx, y quien tiene un rol que lo abre (Admin, Asistente, Moderador; 13/10/2026)
  const misRoles = ((useRoles() || {})[liga.yo && liga.yo.k] || []).map((x) => x[0]);
  const dueno = !!dc && (String(dc.id) === DUENO || misRoles.some((r) => ['admin', 'asistente', 'moderador'].includes(r)));
  // 📊 dueño de un servidor socio (Tier 1 o 2): el botón a su panel (`#/socio`). Se pregunta una vez por sesión
  const socio = useSocio(!!dc);
  // 🔁 ¿te verificaste en otra visita? Mi cuenta es donde se lee «Verificarme» o «Verificado»: si este navegador te tiene
  // sin verificar, se pregunta una vez por carga (`refrescarVerificado()` de bot/paginas/cuenta.js, con la sesión) (17/11/2026)
  useEffect(() => { if (dc && !dc.rapero && !dc.clave && W.refrescarVerificado) W.refrescarVerificado(); }, [dc && dc.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const todas = gs.flatMap((g) => g[1]);
  // verificarse no está en la lista: se llega desde la tarjeta de arriba (y desde el botón del bot)
  // 📱 los links de las páginas de la compu (cuenta_pc.jsx) abren en el celular la parte que las tiene: un link copiado en
  // la compu y abierto en el teléfono no se queda en la lista. Tu estilo y Tu servidor se abren solas, como verificarse
  const enMovil = { fondos: 'fondo', temas: 'apariencia', resumen: 'cuenta', app: 'hora', ayuda: 'algo-mal' }[parte] || parte;
  const extra = parte === 'verificar' ? ['verificar', 'ok', 'Verificarme', ''] : parte === 'estilo' ? ['estilo', 'micro', 'Tu estilo', '']
    : parte === 'servidor' ? ['servidor', 'servidor', 'Tu servidor', ''] : null;
  const actual = extra || todas.find((x) => x[0] === enMovil) || null;
  // en la computadora siempre hay una abierta: la primera
  const [ancha, setAncha] = useState(() => !!(W.matchMedia && W.matchMedia('(min-width: 900px)').matches));
  useEffect(() => {
    if (!W.matchMedia) return undefined;
    const m = W.matchMedia('(min-width: 900px)');
    const f = () => setAncha(m.matches);
    if (m.addEventListener) m.addEventListener('change', f);
    return () => { if (m.removeEventListener) m.removeEventListener('change', f); };
  }, []);
  // 🖥️ EN LA COMPU, LA CUENTA NUEVA (17/11/2026, cuenta_pc.jsx): el menú por grupos y una página por cosa. El celular
  // sigue acá abajo, como estaba (Dlx: «me gusta cómo se ve en celular»)
  if (ancha && parte !== 'verificar') {
    return <CuentaPC liga={liga} dc={dc} parte={parte} tema={tema} onTema={onTema} temaSv={temaSv} onTemaSv={onTemaSv} socio={socio} dueno={dueno} />;
  }
  const abierta = actual || (ancha ? todas[0] : null);
  const lista = (
    <nav data-tuto="cu-nav" className="cu-nav" aria-label="Tu cuenta">
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
          <section data-tuto="cu-parte" className="cu-parte" aria-label={abierta[2]}>
            <a className="cu-volver" href="#/cuenta"><Chevron />Tu cuenta</a>
            <h2 className="cu-pt"><Ico n={abierta[1]} t={24} />{abierta[2]}</h2>
            <Parte id={abierta[0]} liga={liga} dc={dc} tema={tema} onTema={onTema} temaSv={temaSv} onTemaSv={onTemaSv} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
