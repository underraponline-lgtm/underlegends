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
import { DUENO, PAIS, hora, limpio, nuevaQue, siglaDe } from './liga.js';
import { Bandera, Cara, Carta, Chevron, DosToques, Ico, accion } from './piezas.jsx';
import { CaraDc } from './arriba.jsx';
import { useRacha } from './racha.js';

import { PasosInstalar } from './instalar.jsx';

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

// las partes, en grupos, como Discord. Dlx, 01/10/2026: «creo que ajustes tendría su propia sección»: Mi cuenta es
// lo tuyo y Ajustes lo de la página en este dispositivo
function grupos(liga, dc, tema, cual) {
  const yo = liga.yo;
  const { z, f, aj } = horaYZona();
  const C = W.CAMBIOS;
  const ult = Array.isArray(C) && C[0] ? C[0].version : '';
  const nuevo = !!ult && nuevaQue(ult, W.CAMBIOS_VISTO);
  const avisos = !!leer('campana:activada', false);
  const g = [
    ['TU CUENTA', [
      ['cuenta', 'yo', 'Mi cuenta', dc ? 'Discord · ' + limpio(dc.n) : 'Entrar con Discord'],
      ['perfil', 'perfil', 'Mi perfil', yo ? 'tu foto, tus redes y tu servidor' : 'lo que los demás ven de vos'],
      ['siguiendo', 'seguir', 'Siguiendo', liga.sigue.length ? liga.sigue.length + (liga.sigue.length === 1 ? ' rapero' : ' raperos') : 'todavía nadie'],
      ['privacidad', 'candado', 'Privacidad', 'tu foto, tus datos y este dispositivo'],
    ]],
    ['AVISOS', [
      ['avisos', 'campana', 'Avisos de eventos', avisos ? 'activados en este dispositivo' : 'apagados'],
    ]],
    ['LA APP', [
      ['apariencia', 'tema', 'Apariencia', tema === 'noche' ? 'Noche' : 'Clara'],
      ['hora', 'reloj', 'Hora y zona', f + ' · ' + z],
      ['accesibilidad', 'calma', 'Accesibilidad', aj.calma ? 'menos animaciones' : 'animaciones normales'],
      ['instalar', 'instalar', 'Instalar la app', 'en tu pantalla de inicio'],
    ]],
    ['LA LIGA', [
      ['novedades', 'novedades', 'Novedades', ult ? 'v' + ult + (nuevo ? ' · NUEVO' : '') : 'el changelog'],
      ['guia', 'guia', 'Guía', 'cómo funciona la Liga'],
      ['legal', 'legal', 'Privacidad y términos', 'lo que guardamos y las reglas'],
    ]],
  ];
  return cual === 'ajustes' ? g.slice(1) : g.slice(0, 1);
}

// ── 🔥 tu racha diaria y tu nivel, debajo de quién sos (Dlx, 04/10/2026). La cuenta es del servidor ──────────────
function RachaNivel({ dc }) {
  const R = useRacha(!!dc);
  if (!R) return null;
  const { racha: r, nivel: n, falta, premio } = R;
  const tramo = Math.max(1, n.sig - n.base);
  const pct = Math.max(0, Math.min(100, Math.round(100 * (n.xp - n.base) / tramo)));
  const dias = (x) => x + (x === 1 ? ' día' : ' días');
  return (
    <div className="cu-rn">
      <div className="cu-rn-c">
        <b>🔥 {r.actual ? dias(r.actual) + ' seguidos' : 'Sin racha todavía'}</b>
        <small>{r.actual ? (r.hoy ? 'Hoy ya contó. ' : 'Entrá o jugá hoy para no cortarla. ') : 'Cuenta cada día que usás el bot, entrás con tu cuenta o jugás un evento. '}
          Faltan {dias(falta)} para <b>+{premio} Puntos de Tienda</b>.{r.maxima > r.actual ? ' Tu mejor racha: ' + dias(r.maxima) + '.' : ''}</small>
      </div>
      <div className="cu-rn-c">
        <b>Nivel {n.n}</b>
        <span className="cu-rn-barra" role="progressbar" aria-label={'Nivel ' + n.n} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: pct + '%' }} /></span>
        <small>{n.xp - n.base} de {tramo} para el nivel {n.n + 1}. Sube +{R.xp_ev} por evento jugado y +{R.xp_dia} por cada día que cuenta.</small>
      </div>
    </div>
  );
}

// ── la tarjeta de arriba: quién sos, como el «Tú» de Discord ──────────────────────────────────────
function Quien({ liga, dc }) {
  const yo = liga.yo;
  if (!yo && !dc) {
    return (
      <div className="cu-quien anon">
        <span className="cu-av anon"><Ico n="yo" t={30} /></span>
        <div className="cu-q"><b>Todavía no entraste</b><small>Entrá con Discord y ves tu puesto, tus tarjetas y tus avisos, y podés seguir a otros.</small></div>
        <button type="button" className="btn verde" onClick={accion.entrar}>Entrar con Discord</button>
      </div>
    );
  }
  const s = yo && liga.svs[yo.sv];
  return (
    <div className="cu-quien" style={{ '--cu-c': (s && s.color) || '#29B298' }}>
      <span className="cu-banda" aria-hidden="true" />
      {yo ? <Cara liga={liga} k={yo.k} nombre={yo.n} cls="cu-av" /> : <CaraDc dc={dc} cls="cu-av" />}
      <div className="cu-q">
        <b>{limpio(yo ? yo.n : dc.n)}</b>
        <small>{dc ? 'Conectado con Discord' : 'Elegiste quién sos, sin entrar'}</small>
        {yo ? <span className="cu-datos">{yo.pos ? '#' + yo.pos + ' de la ' + liga.temp : 'Sin puesto todavía'} · OVR {yo.ovr || '—'} · {yo.ev || 0} {yo.ev === 1 ? 'evento' : 'eventos'}</span>
          // 🔴 UN RAPERO QUE TODAVÍA NO JUGÓ LA TEMPORADA NO ES «SIN TARJETA»: el día del arranque es el caso de todos
          : <span className="cu-datos">{dc && dc.rapero ? 'Todavía no jugaste esta temporada.' : 'Todavía sin tarjeta.'}</span>}
      </div>
      {yo ? <a className="btn borde2 chico cu-ver" href={'#/r/' + encodeURIComponent(yo.k)}>Ver mi perfil</a>
        : dc && dc.clave ? <a className="btn borde2 chico cu-ver" href={'#/r/' + encodeURIComponent(dc.clave)}>Ver mi perfil</a>
        : <a className="btn verde chico cu-ver" href="#/cuenta/verificar">Verificarme</a>}
      <RachaNivel dc={dc} />
    </div>
  );
}

// ── cada parte ───────────────────────────────────────────────────────────────────────────────────
function Caja({ t, children, d }) {
  return <section className="cu-caja"><h3>{t}</h3>{d ? <p className="cu-d">{d}</p> : null}{children}</section>;
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
  const libre = (f) => (f.libre_hasta ? 'Hasta el ' + f.libre_hasta + ' la podés cambiar las veces que quieras.'
    : 'Hasta que arranque la temporada la podés cambiar las veces que quieras.');
  let cuerpo;
  if (!dc) {
    cuerpo = <button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar con Discord</button>;
  } else if (!dc.clave) {
    cuerpo = <a className="btn verde chico" href="#/cuenta/verificar">Verificarme</a>;
  } else if (F && F.hecho) {
    cuerpo = <p className="cu-d">📸 <b>Listo</b>: ésa es tu foto de la {T}. Tus tarjetas se vuelven a dibujar en la próxima vuelta del ciclo (cada media hora; de 3 a 11 AM, hora del este, no corre).{F.libre ? ' ' + libre(F) : ''}</p>;
  } else if (F && F.error) {
    const m = F.error === 'sin_foto' ? 'No tenés foto puesta en Discord: tu tarjeta va con la inicial, que con el color de tu rango queda bien. Si te ponés una, volvé.'
      : F.error === 'sin_perfil' ? 'Primero necesitás tu tarjeta: verificate en la página.'
      : F.error === 'usado' ? 'Ya elegiste tu foto de la ' + T + ': va una por temporada. Se vuelve a abrir cuando arranque la que sigue.'
      : F.error === 'cdn' ? 'Discord no me dio tu foto. Suele arreglarse volviéndotela a poner en Discord y probando de nuevo.'
      : F.error === 'espera' ? 'Esperá un minuto y probá de nuevo.' : 'No pude cambiarla. Probá de nuevo en un rato.';
    cuerpo = <><p className="cu-d">{m}</p><button type="button" className="btn borde2 chico" onClick={() => W.cuentaFotoNo && W.cuentaFotoNo()}>Volver</button></>;
  } else if (F && F.estado === 'usado') {
    cuerpo = <p className="cu-d">Ya elegiste tu foto de la {T} y va <b>una por temporada</b>: la Histórica necesita la cara que tenías en cada una. Se vuelve a abrir cuando arranque la que sigue.</p>;
  } else if (F && F.vista) {
    cuerpo = (
      <div className="cu-foto">
        <img className="cu-foto-v" src={F.vista} alt="Tu foto de Discord" width="96" height="96" />
        <div className="cu-foto-tx">
          <small>Tu tarjeta de la {T} va a llevar ésta, la de tu perfil de Discord. {F.libre ? libre(F) : F.pase ? 'Con el pase de DRA la podés cambiar cuando quieras.' : 'Va una por temporada: después no se puede cambiar hasta la próxima.'}</small>
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
    <Caja t="Tu foto de la tarjeta" d={!dc ? 'La de tu Discord. Entrá con Discord para cambiarla.' : !dc.clave ? 'Primero necesitás tu tarjeta.' : 'La de tu Discord. Va una por temporada.'}>
      {oculta ? <p className="cu-d">🙈 La tenés <b>oculta</b>: tus tarjetas van con tu inicial. Se cambia en <a href="#/cuenta/privacidad">Privacidad</a>.</p> : null}
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
      <Caja t={titulo} d="Mostrá en tu perfil las redes que ya tenés conectadas en Discord (Instagram, TikTok, YouTube…). Discord te pide permiso para leerlas.">
        <button type="button" className="btn borde2 chico" onClick={accion.redes}>Elegir mis redes</button>
      </Caja>
    );
  }
  if (R.error) {
    return (
      <Caja t={titulo} d={R.error === 'sin_perfil' ? 'Primero necesitás tu tarjeta: verificate en la página.' : 'No pude leer tus redes. Probá de nuevo.'}>
        <button type="button" className="btn borde2 chico" onClick={accion.redes}>Probar de nuevo</button>
      </Caja>
    );
  }
  if (!(R.publicas || []).length) {
    return (
      <Caja t={titulo} d="No tenés redes públicas en Discord. Andá a Ajustes → Conexiones, conectá tu Instagram, TikTok o YouTube y activá «Mostrar en el perfil». Después volvé acá.">
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
    <Caja t={titulo} d="Las que tenés públicas en Discord: elegí cuáles salen en tu perfil.">
      <ul className="cu-lista">{R.publicas.map((r) => {
        const id = r.t + ':' + r.n;
        return (
          <li key={id}><label className="cu-red"><input type="checkbox" checked={sel.includes(id)} onChange={() => alternar(id)} />
            <span>{NOMBRE_RED(r.t)}</span><b>{r.n}</b></label></li>
        );
      })}</ul>
      <div className="cu-btns"><button type="button" className="btn verde chico" disabled={va} onClick={() => guardar(sel)}>Guardar en mi perfil</button>
        {ya.length ? <button type="button" className="btn borde2 chico" disabled={va} onClick={() => guardar([])}>Quitar todas</button> : null}</div>
      <p className="cu-d" role="status">{nota || ((ya.length ? 'Tu perfil muestra ' + ya.length + '.' : 'Todavía no mostrás ninguna.') + ' Los cambios aparecen en la próxima actualización (cada media hora).')}</p>
    </Caja>
  );
}

// 🏠 Y AL FINAL DE VERIFICARSE (`paso`; Dlx, 07/10/2026: «que al final te pregunte de qué servidor venís y/o a qué
// servidor querés representar… todos los socios y la opción ninguno»). La misma elección que Mi cuenta, con «Ninguno»
// (`sv: ''`), que queda contestado sin fijar la temporada: tu perfil sigue con donde más jugás
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
    : M.error ? ((W.errorCuenta && W.errorCuenta(M.error)) || 'No pude leerlo. Probá en un rato.')
    : e.va ? 'Guardando…'
    : M.elegido && !M.sv ? 'Elegiste ninguno: tu perfil muestra donde más jugás. Podés elegir uno cuando quieras.'
    : M.libre ? 'Cambialo cuantas veces quieras hasta el ' + hasta + '; después, uno por temporada.'
    : M.puede ? (M.sv ? 'Podés cambiarlo una vez en esta temporada.' : 'Se elige una vez por temporada.')
    : 'Ya lo elegiste esta temporada: se vuelve a abrir en la que viene.';
  const nombre = (sv) => ((liga.svs[sv] || {}).nombre || sv);
  return (
    <Caja t={(paso ? 'Último paso: tu servidor' : 'Tu servidor') + (M.sv ? ' · ' + nombre(M.sv) : M.elegido ? ' · ninguno' : '')}
      d={paso ? '¿De qué servidor venís, o a cuál querés representar en la Liga? Sale en tu perfil. Si no es ninguno de éstos, elegí «Ninguno».'
        : 'El que representás en la Liga: sale en tu perfil. Tu tarjeta de Servidor sigue siendo la de donde jugás.'}>
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
  const d = 'Si la ocultás, la página y tus tarjetas —también las de Discord— te muestran con tu inicial. Se aplica en la próxima vuelta del ciclo: cada media hora, salvo de 3 a 11 AM (hora del este).';
  if (!dc) {
    return (
      <Caja t="Tu foto" d={d}>
        <button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar con Discord</button>
      </Caja>
    );
  }
  const M = est.MIFOTO || {};
  const e = est.MIFOTO_EST || {};
  const nota = !est.MIFOTO ? 'Cargando…'
    : e.error ? e.error
    : M.error ? ((W.errorCuenta && W.errorCuenta(M.error)) || 'No pude leerlo. Probá en un rato.')
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

function Parte({ id, liga, dc, tema, onTema }) {
  const yo = liga.yo;
  const { aj, zonas, z } = horaYZona();
  if (id === 'cuenta') {
    return (
      <>
        <Caja t="Discord" d={dc ? 'Entraste con tu cuenta de Discord. No guardamos ningún permiso: cada vez que hacés algo, Discord confirma que sos vos.' : 'Entrá con Discord para ver tu puesto, tus tarjetas y tus avisos.'}>
          {dc ? (
            <div className="cu-fila"><CaraDc dc={dc} cls="cu-av chica" /><span><b>{limpio(dc.n)}</b>
              <small>{yo ? 'Tu tarjeta: ' + limpio(yo.n) : dc.rapero ? 'Sos ' + limpio(dc.rapero) + ' · todavía no jugaste esta temporada' : 'Sin tarjeta todavía'}</small></span></div>
          ) : <button type="button" className="btn verde" onClick={accion.entrar}>Entrar con Discord</button>}
          {/* la sesión de antes del 25/09 no trae la clave: es un toque, `prompt=none` no vuelve a pedir nada */}
          {dc && dc.rapero && !dc.clave ? (
            <p className="cu-d">Tu sesión es de una versión anterior. Actualizala para ver tus tarjetas y tu perfil: es un toque, no te pide nada.{' '}
              <button type="button" className="btn borde2 chico" onClick={accion.entrar}>Actualizar mi cuenta</button></p>
          ) : null}
        </Caja>
        {!dc && yo ? (
          <Caja t="Sin entrar" d={'Elegiste ser ' + limpio(yo.n) + ' sin entrar con Discord. Entrá y queda confirmado.'}>
            <div className="cu-btns"><button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar con Discord</button>
              <button type="button" className="btn borde2 chico" onClick={accion.salir}>No soy yo</button></div>
          </Caja>
        ) : null}
        {dc && !yo && !dc.rapero ? (
          <Caja t="Tu tarjeta" d="Son dos pasos: verificate en DRA —acá, en un toque— y se abre tu Servidor; con tu primera Tarea del Pase de rapero, tu Temporada.">
            <div className="cu-btns"><a className="btn verde chico" href="#/cuenta/verificar">Verificarme</a>
              <a className="btn borde2 chico" href="#/guia">Cómo conseguir tu tarjeta</a></div>
          </Caja>
        ) : null}
      </>
    );
  }
  if (id === 'perfil') {
    return (
      <>
        <FotoCaja liga={liga} dc={dc} />
        <RedesCaja dc={dc} />
        <ServidorCaja liga={liga} dc={dc} />
      </>
    );
  }
  if (id === 'siguiendo') {
    const fs = liga.sigue.map((k) => liga.T[k]).filter(Boolean);
    return (
      <>
        <Caja t={'Seguís a ' + fs.length} d={dc ? 'Te llega un aviso cuando ganan, suben de rango o desbloquean una tarjeta (activá los avisos en este dispositivo).'
          : 'Entrá con Discord y te avisamos cuando ganen o suban de rango.'}>
          {fs.length ? <ul className="cu-gente">{fs.map((f) => (
            <li key={f.k}><a href={'#/r/' + encodeURIComponent(f.k)}><Cara liga={liga} k={f.k} nombre={f.n} cls="cu-av chica" /><b>{limpio(f.n)}</b>
              <small>{f.pos ? '#' + f.pos : ''}</small></a></li>
          ))}</ul> : <a className="btn borde2 chico" href="#/ranking">Buscar a quién seguir</a>}
        </Caja>
        <TeSiguen liga={liga} />
      </>
    );
  }
  if (id === 'privacidad') {
    return (
      <>
        <OcultarFoto dc={dc} />
        <Caja t="Tus datos" d="En Discord, /borrar-mis-datos borra todo lo tuyo de la Liga: tus tarjetas, tu foto y lo que el bot sabe de vos." />
        <Caja t="Este dispositivo" d="Olvida quién sos, tus ajustes y los avisos de este dispositivo. Tus tarjetas y tu cuenta no se tocan.">
          <DosToques className="btn borde2 chico" confirmar="¿Seguro? Tocá de nuevo" onClick={() => { if (W.cuentaOlvidarTodo) W.cuentaOlvidarTodo(); }}>Olvidar este dispositivo</DosToques>
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
  discord_error: 'Discord no dio el permiso. Probá de nuevo en un rato.',
  permiso: 'Discord no nos dio permiso para meterte en DRA. Probá de nuevo y aceptá «Unirse a servidores».',
  discord: 'Tu permiso de Discord se venció. Probá de nuevo.',
  token: 'Tu permiso de Discord se venció. Probá de nuevo.',
  discord_ocupado: 'Discord está ocupado ahora mismo. Probá en un minuto.',
  dra: 'No pude mirar Discord Rap Español ahora mismo. Probá en un minuto.',
  porton: 'La verificación no está disponible ahora. Probá en un rato, o con /verificar en Discord.',
  lleno: 'Estás en el máximo de servidores que permite Discord. Salí de alguno y probá de nuevo.',
  no_deja: 'Discord Rap Español no nos deja meterte. Si creés que es un error, hablá con un admin de DRA.',
  entrar: 'No pude meterte en DRA ahora mismo. Probá de nuevo en un rato.',
  rol: 'No pude ponerte el país en DRA. Probá de nuevo en un rato.',
  pais: 'Ese país no está en DRA. Elegí otro.',
  espera: 'Fueron muchos intentos seguidos. Esperá un minuto y probá de nuevo.',
  red: 'No pude conectarme. Revisá tu internet y probá de nuevo.',
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
        <option value="" disabled>Elegí tu país</option>
        {ops.map((c) => <option key={c} value={c}>{PAIS[c] || c.toUpperCase()}</option>)}
      </select>
      <button type="button" className="btn verde chico" disabled={!pais || v.cargando} onClick={() => revisar(pais)}>Guardar</button>
    </span>
  );
}

function Verificar({ liga, dc }) {
  const v = useVerif();
  const yo = liga.yo;
  // ya cargado: con su clave de la Liga (`d:`), que sólo tiene quien pasó el portón
  if ((dc && dc.rapero) || (v && v.listo)) {
    return (
      <>
        <Caja t="Ya estás verificado ✅" d="Tus tarjetas salen con /card en Discord, y tu perfil está en la página.">
          {yo ? <a className="btn verde chico" href={'#/r/' + encodeURIComponent(yo.k)}>Ver mi perfil</a> : null}
        </Caja>
        <ServidorCaja liga={liga} dc={dc} paso />
      </>
    );
  }
  if (v && v.olvido) {
    return <Caja t="Borraste tus datos de la Liga" d="Con /borrar-mis-datos pediste que no te sumemos solos. Para volver, pedíselo a un admin de la Liga en DRA." />;
  }
  if (!v || (v.cargando && !v.enDra)) {
    return (
      <Caja t="Qué es estar verificado" d="Estar en Discord Rap Español, con tu país y el rol de Miembro. Sin eso no hay tarjetas: verificado se abre tu Servidor, con tu primera Tarea del Pase tu Temporada, y la Competitiva y la de País con su requisito. Y tu perfil, con tu foto y tus redes.">
        <button type="button" className="btn verde" disabled={!!(v && v.cargando)} onClick={() => (W.DC_TOKEN ? revisar() : irADiscord())}>
          {v && v.cargando ? 'Mirando Discord Rap Español…' : 'Verificarme con Discord'}</button>
        <small className="cu-nota">Discord te va a pedir dos permisos: ver tu usuario y unirte a servidores por vos, que es lo que deja al bot meterte en Discord Rap Español si todavía no estás. Se usa una vez y no se guarda.</small>
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
    pais = ['espera', 'Tu país', 'Lo elegís acá cuando aceptes las reglas.'];
  } else if (paises.length > 1 && v.porRol) {
    pais = ['aviso', 'Tenés ' + paises.length + ' países en DRA', 'Dejá uno solo en tus roles de DRA y tocá «Revisar de nuevo».', abrir];
  } else {
    pais = ['falta', 'Tu país', paises.length > 1 ? 'Tu nombre tiene ' + paises.length + ' banderas: elegí la tuya y el bot te pone ese rol en DRA.'
      : 'Elegilo y el bot te pone ese rol en DRA.', <ElegirPais key="p" v={v} />];
  }
  const vuelta = v.vuelta ? hora(v.vuelta) : '';
  const miembro = v.rol ? ['ok', 'Tenés el rol de Miembro', '']
    : v.revisa ? ['aviso', 'Tu caso lo revisa un admin', 'No hace falta que hagas nada más.']
      : v.completo ? ['espera', 'Tu rol de Miembro', 'Te lo da el bot solo' + (vuelta ? ', en la vuelta de las ' + vuelta + ' o en la siguiente' : '') + '. Con él salen tus tarjetas.']
        : ['espera', 'Tu rol de Miembro', 'Te lo da el bot cuando completes lo de arriba.'];
  const filas = [
    ['ok', 'Tu Discord', dc ? limpio(dc.n) : 'Conectado'],
    ['ok', 'Estás en Discord Rap Español', v.entro ? 'Te metimos recién.' : 'Ya estabas adentro.'],
    v.pendiente ? ['aviso', 'Aceptá las reglas de DRA', 'Discord te las muestra al abrir el servidor: es un toque. Después volvé acá y tocá «Revisar de nuevo».', abrir]
      : ['ok', 'Aceptaste las reglas de DRA', ''],
    pais,
    miembro,
  ];
  const resumen = v.completo
    ? (v.rol ? 'Estás verificado en DRA ✅. Tus tarjetas salen cuando el bot te cargue' + (vuelta ? ': en la vuelta de las ' + vuelta + ' o en la siguiente.' : '.')
      : 'Lo tuyo está completo ✅. El resto lo hace el bot solo.')
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

// 🔑 MI CUENTA Y AJUSTES EN TARJETAS, EN LA COMPU (Dlx, 02/10/2026, al ver la preview: «hazlo como están las cosas de la
// derecha, me gusta rellenar el espacio así»): con un menú más alto que la parte de al lado quedaba media página vacía;
// en tarjetas, todas las partes a la vista y en dos columnas. En el celular sigue la lista y una parte por vez
// las tarjetas: una por parte, y las tres de «La Liga» juntas (cada una es un link: separadas repetían el título)
function tarjetasDe(gs) {
  const out = [];
  gs.forEach(([t, xs]) => {
    if (t === 'LA LIGA') out.push({ id: 'la-liga', ico: 'guia', n: 'La Liga', partes: xs.map((x) => x[0]) });
    else xs.forEach(([id, ico, n]) => out.push({ id, ico, n, partes: [id] }));
  });
  return out;
}

export function Cuenta({ liga, dc, parte, tema, onTema, cual = 'cuenta' }) {
  const gs = grupos(liga, dc, tema, cual);
  // 🔒 el acceso al Dashboard, a la vista sólo para el dueño. Es un atajo: la puerta de verdad está en el servidor
  const dueno = cual === 'cuenta' && !!dc && String(dc.id) === DUENO;
  const todas = gs.flatMap((g) => g[1]);
  // verificarse no está en la lista: se llega desde la tarjeta de arriba (y desde el botón del bot)
  const extra = cual === 'cuenta' && parte === 'verificar' ? ['verificar', 'ok', 'Verificarme', ''] : null;
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
  const enTarjetas = ancha && !extra;
  const cartas = enTarjetas ? tarjetasDe(gs) : [];
  useEffect(() => {
    if (!enTarjetas || !parte) return;
    const c = cartas.find((x) => x.partes.includes(parte));
    if (c) accion.ir('cu-' + c.id);
  }, [enTarjetas, parte]); // eslint-disable-line react-hooks/exhaustive-deps
  const lista = (
    <nav className="cu-nav" aria-label="Mi cuenta">
      {gs.map(([t, xs]) => (
        <div className="cu-g" key={t}><span className="cu-gt">{t}</span>
          <ul>{xs.map(([id, ico, n, v]) => (
            <li key={id}><a href={'#/' + cual + '/' + id} className={abierta && abierta[0] === id ? 'on' : ''} aria-current={abierta && abierta[0] === id ? 'page' : undefined}>
              <Ico n={ico} t={20} /><span><b>{n}</b><small>{v}</small></span><Chevron /></a></li>
          ))}</ul></div>
      ))}
      {cual === 'cuenta' && (dc || liga.yo) ? <button type="button" className="cu-salir" onClick={accion.salir}><Ico n="salir" t={20} />{dc ? 'Salir' : 'No soy yo'}</button> : null}
    </nav>
  );
  if (enTarjetas) {
    return (
      <div className="cu tarjetas">
        <div className="cu-cab"><h1 className="cu-h">{cual === 'ajustes' ? 'Ajustes' : 'Mi cuenta'}</h1>{dueno ? <a className="btn borde2 chico" href="#/dashboard">Dashboard</a> : null}</div>
        {cual === 'cuenta' ? <div className="cu-tj-quien"><Quien liga={liga} dc={dc} /></div> : null}
        <div className="cu-tarjetas">
          {cartas.map((c) => (
            <section key={c.id} id={'cu-' + c.id} className="cu-tj" aria-label={c.n}>
              <h2 className="cu-tjt"><Ico n={c.ico} t={22} />{c.n}</h2>
              {c.partes.map((id) => <Parte key={id} id={id} liga={liga} dc={dc} tema={tema} onTema={onTema} />)}
            </section>
          ))}
        </div>
        {cual === 'cuenta' && (dc || liga.yo) ? <button type="button" className="cu-salir" onClick={accion.salir}><Ico n="salir" t={20} />{dc ? 'Salir' : 'No soy yo'}</button> : null}
      </div>
    );
  }
  return (
    <div className={'cu' + (abierta ? ' con-parte' : '')}>
      <div className="cu-cab"><h1 className="cu-h">{abierta && !ancha ? '' : (cual === 'ajustes' ? 'Ajustes' : 'Mi cuenta')}</h1>{dueno && !abierta ? <a className="btn borde2 chico" href="#/dashboard">Dashboard</a> : null}</div>
      <div className="cu-g2">
        <aside className="cu-lado">
          {cual === 'cuenta' ? <Quien liga={liga} dc={dc} /> : null}
          {lista}
        </aside>
        {abierta ? (
          <section className="cu-parte" aria-label={abierta[2]}>
            <a className="cu-volver" href={'#/' + cual}><Chevron />{cual === 'ajustes' ? 'Ajustes' : 'Mi cuenta'}</a>
            <h2 className="cu-pt"><Ico n={abierta[1]} t={24} />{abierta[2]}</h2>
            <Parte id={abierta[0]} liga={liga} dc={dc} tema={tema} onTema={onTema} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
