// Mi cuenta y Ajustes, juntos y como los ajustes de Discord. Dlx, 01/10/2026: «a mí me gusta como lo tiene Discord»,
// y antes de construirla, «genera PREVIEWS de cómo sería, así mismo como lo que hicimos con INICIO».
// `#/cuenta` es la lista; `#/cuenta/<parte>` abre una. En el celular se entra y se vuelve con «‹»; en la computadora,
// la lista a la izquierda y la parte a la derecha. Lo que hace cada cosa por dentro —entrar con Discord, la foto, las
// redes, la campana— sigue siendo de app.js: acá cambia la cara.
// ⚠️ PREVIEW: se mira y no se publica hasta que Dlx diga.
import { useEffect, useState } from 'react';
import { hora, limpio } from './liga.js';
import { Cara, Carta, Chevron, Ico, accion } from './piezas.jsx';
import { CaraDc } from './arriba.jsx';
import { nuevaQue } from './cambios.jsx';

const leer = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const W = typeof window !== 'undefined' ? window : {};

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

function ParteInstalar() {
  const [ev, setEv] = useState(() => W.__instalar || null);
  useEffect(() => {
    const f = () => setEv(W.__instalar || null);
    W.addEventListener('lg:instalar', f);
    return () => W.removeEventListener('lg:instalar', f);
  }, []);
  const app = !!(W.matchMedia && W.matchMedia('(display-mode: standalone)').matches) || W.navigator.standalone === true;
  const instalar = async () => {
    const e = ev;
    W.__instalar = null;
    setEv(null);
    try { e.prompt(); await e.userChoice; } catch (err) { /* el navegador no quiso */ }
  };
  return (
    <Caja t="La Liga en tu celular" d={app ? 'Ya la estás usando como app.' : 'Instalada, queda en tu pantalla y se abre de un toque. En el iPhone es además lo que habilita los avisos.'}>
      {ev ? <button type="button" className="btn verde chico" onClick={instalar}>Instalar</button> : null}
      {!app ? <ol className="cu-pasos"><li>En Android: el menú de Chrome (⋮) → «Instalar app».</li>
        <li>En el iPhone: en Safari, Compartir → «Agregar a inicio».</li></ol> : null}
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
      ['privacidad', 'candado', 'Privacidad', 'tu foto y tus datos'],
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

// ── la tarjeta de arriba: quién sos, como el «Tú» de Discord ──────────────────────────────────────
function Quien({ liga, dc }) {
  const yo = liga.yo;
  if (!yo && !dc) {
    return (
      <div className="cu-quien anon">
        <span className="cu-av anon"><Ico n="yo" t={30} /></span>
        <div className="cu-q"><b>Todavía no entraste</b><small>Entrá con Discord y ves tu puesto, tus tarjetas y tus avisos, y podés seguir a otros.</small></div>
        <button type="button" className="btn verde" onClick={accion.cuenta}>Entrar con Discord</button>
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
          : <span className="cu-datos">Todavía sin tarjeta.</span>}
      </div>
      {yo ? <a className="btn borde2 chico cu-ver" href={'#/r/' + encodeURIComponent(yo.k)}>Ver mi perfil</a>
        : <a className="btn verde chico cu-ver" href="#/cuenta/verificar">Verificarme</a>}
    </div>
  );
}

// ── cada parte ───────────────────────────────────────────────────────────────────────────────────
function Caja({ t, children, d }) {
  return <section className="cu-caja"><h3>{t}</h3>{d ? <p className="cu-d">{d}</p> : null}{children}</section>;
}

function Parte({ id, liga, dc, tema, onTema }) {
  const yo = liga.yo;
  const { aj, zonas, z } = horaYZona();
  if (id === 'cuenta') {
    return (
      <>
        <Caja t="Discord" d={dc ? 'Entraste con tu cuenta de Discord. No guardamos ningún permiso: cada vez que hacés algo, Discord confirma que sos vos.' : 'Entrá con Discord para ver tu puesto, tus tarjetas y tus avisos.'}>
          {dc ? (
            <div className="cu-fila"><CaraDc dc={dc} cls="cu-av chica" /><span><b>{limpio(dc.n)}</b><small>{yo ? 'Tu tarjeta: ' + limpio(yo.n) : 'Sin tarjeta todavía'}</small></span>
              <button type="button" className="btn borde2 chico" onClick={accion.cuenta}>Cambiar</button></div>
          ) : <button type="button" className="btn verde" onClick={accion.cuenta}>Entrar con Discord</button>}
        </Caja>
        {dc && !yo ? (
          <Caja t="Tu tarjeta" d="Para tener tarjeta hay que jugar en la Liga y estar verificado en DRA. En Discord, /verificar te dice qué te falta.">
            <a className="btn borde2 chico" href="#/guia">Cómo conseguir tu tarjeta</a>
          </Caja>
        ) : null}
      </>
    );
  }
  if (id === 'perfil') {
    const s = yo && liga.svs[yo.sv];
    return (
      <>
        <Caja t="Tu foto de la tarjeta" d="La de tu Discord. Se cambia una vez por temporada.">
          <div className="cu-foto">
            {yo ? <Carta liga={liga} k={yo.k} cual="temporada" cls="cu-carta" abre={false} /> : <span className="cu-carta vacia">Tu tarjeta</span>}
            <div className="cu-foto-tx">{dc ? <CaraDc dc={dc} cls="cu-av" /> : null}
              <button type="button" className="btn verde chico" onClick={accion.cuenta} disabled={!dc}>Usar mi foto de Discord</button>
              <small>{dc ? 'Te queda 1 cambio en la ' + liga.temp + '.' : 'Entrá con Discord para cambiarla.'}</small></div>
          </div>
        </Caja>
        <Caja t="Tus redes" d="Las que tengas conectadas en Discord; elegís cuáles salen en tu perfil.">
          {(dc && dc.cs && dc.cs.length) ? (
            <ul className="cu-lista">{dc.cs.map((c, i) => <li key={i}><span>{String(c[0] || c.t || c)}</span><b>{String(c[1] || c.n || '')}</b><i className="cu-tg on" aria-hidden="true" /></li>)}</ul>
          ) : <button type="button" className="btn borde2 chico" onClick={accion.cuenta} disabled={!dc}>Traer mis redes de Discord</button>}
        </Caja>
        <Caja t="Tu servidor" d="El que representás en la Liga: sale en tu perfil. Uno por temporada.">
          <div className="cu-svs">{Object.values(liga.svs).map((o) => (
            <button type="button" key={o.sv} className={'cu-sv' + (s && s.sv === o.sv ? ' on' : '')} style={{ '--c': o.color }} disabled={!dc}>
              <img alt="" src={liga.logo(o.sv)} /><b>{o.sv}</b></button>
          ))}</div>
        </Caja>
      </>
    );
  }
  if (id === 'siguiendo') {
    const fs = liga.sigue.map((k) => liga.T[k]).filter(Boolean);
    return (
      <Caja t={'Seguís a ' + fs.length} d="Cuando alguien que seguís gana o consigue su tarjeta, aparece primero en tus historias.">
        {fs.length ? <ul className="cu-gente">{fs.map((f) => (
          <li key={f.k}><a href={'#/r/' + encodeURIComponent(f.k)}><Cara liga={liga} k={f.k} nombre={f.n} cls="cu-av chica" /><b>{limpio(f.n)}</b>
            <small>{f.pos ? '#' + f.pos : ''}</small></a></li>
        ))}</ul> : <a className="btn borde2 chico" href="#/ranking">Buscar a quién seguir</a>}
      </Caja>
    );
  }
  if (id === 'privacidad') {
    return (
      <>
        <Caja t="Tu foto" d="Si la ocultás, tu perfil y tus tarjetas en la página van con tu inicial.">
          <label className="cu-sw"><span><b>Ocultar mi foto en la página</b><small>Tus tarjetas en Discord no cambian.</small></span><input type="checkbox" disabled /><i aria-hidden="true" /></label>
        </Caja>
        <Caja t="Tus datos" d="En Discord, /borrar-mis-datos borra todo lo tuyo de la Liga.">
          <button type="button" className="btn borde2 chico">Olvidar este dispositivo</button>
        </Caja>
      </>
    );
  }
  if (id === 'avisos') {
    const svs = leer('campana:svs', []) || [];
    const activos = !!leer('campana:activada', false);
    const de = Object.values(liga.svs).filter((o) => !svs.length || svs.includes(o.sv));
    return (
      <Caja t="En este dispositivo" d={activos ? 'Activados: te avisa al minuto de que ' + (svs.length ? de.map((o) => o.sv).join(', ') : 'cualquier servidor') + ' anuncia un evento.'
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
// y que entres a DRA automáticamente»). Lo mismo que /verificar —qué te falta, con el botón que lo arregla, y te
// anota— más meterte en DRA con el permiso «unirse a servidores» de Discord. PREVIEW: el resultado es de muestra
function Verificar({ liga, dc }) {
  const [listo, setListo] = useState(() => leer('lg:prev-ver', '') === 'despues');
  const prox = (() => { const d = new Date(); const m = d.getMinutes(); d.setMinutes(m < 22 ? 22 : (m < 52 ? 52 : 82), 0, 0); return d; })();
  const filas = [
    ['ok', 'Tu Discord', dc ? limpio(dc.n) : 'conectado'],
    ['ok', 'Estás en Discord Rap Español', 'te metimos recién'],
    ['aviso', 'Aceptá las reglas de DRA', 'Discord las pide al entrar: es un toque.', <a key="a" className="btn borde2 chico" href="https://discord.com/channels/841017460341604382" target="_blank" rel="noopener noreferrer">Abrir DRA ↗</a>],
    ['falta', 'Tu país', 'Elegilo y el bot te pone el rol en DRA.', <span key="p" className="cu-pais"><select aria-label="Tu país" defaultValue=""><option value="" disabled>Elegí tu país</option>{['Argentina', 'Chile', 'Colombia', 'México', 'Perú', 'Venezuela', 'Uruguay', 'España'].map((p) => <option key={p}>{p}</option>)}</select><button type="button" className="btn verde chico">Guardar</button></span>],
    ['espera', 'Tu rol de Miembro', 'Lo da el ciclo en la próxima vuelta: ' + hora(prox.toISOString()) + '. Con eso salen tus cuatro tarjetas.'],
  ];
  return (
    <>
      <Caja t="Qué es estar verificado" d="Estar en Discord Rap Español, con el rol de Miembro y tu país. Con eso tenés las cuatro tarjetas: la Temporada y la Servidor ya las tenés con sólo jugar.">
        {!listo ? (
          <>
            <button type="button" className="btn verde" onClick={() => setListo(true)}>Verificarme con Discord</button>
            <small className="cu-nota">Discord te va a pedir dos permisos: ver tu usuario y unirte a servidores por vos (para meterte en DRA si todavía no estás).</small>
          </>
        ) : null}
      </Caja>
      {listo ? (
        <Caja t="Lo que hicimos y lo que falta" d="Te anotamos: el ciclo te encuentra en la próxima vuelta.">
          <ul className="cu-chk">{filas.map(([e, t, d, acc]) => (
            <li key={t} className={e}><span className="cu-chk-i"><Ico n={e} t={18} /></span><span className="cu-chk-t"><b>{t}</b><small>{d}</small></span>{acc || null}</li>
          ))}</ul>
          <button type="button" className="btn borde2 chico" onClick={() => setListo(false)}>Revisar de nuevo</button>
        </Caja>
      ) : null}
    </>
  );
}

export function Cuenta({ liga, dc, parte, tema, onTema, cual = 'cuenta' }) {
  const gs = grupos(liga, dc, tema, cual);
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
  const lista = (
    <nav className="cu-nav" aria-label="Mi cuenta">
      {gs.map(([t, xs]) => (
        <div className="cu-g" key={t}><span className="cu-gt">{t}</span>
          <ul>{xs.map(([id, ico, n, v]) => (
            <li key={id}><a href={'#/' + cual + '/' + id} className={abierta && abierta[0] === id ? 'on' : ''} aria-current={abierta && abierta[0] === id ? 'page' : undefined}>
              <Ico n={ico} t={20} /><span><b>{n}</b><small>{v}</small></span><Chevron /></a></li>
          ))}</ul></div>
      ))}
      {cual === 'cuenta' && (dc || liga.yo) ? <button type="button" className="cu-salir" onClick={accion.cuenta}><Ico n="salir" t={20} />Salir</button> : null}
    </nav>
  );
  return (
    <div className={'cu' + (abierta ? ' con-parte' : '')}>
      <div className="cu-cab"><h1 className="cu-h">{abierta && !ancha ? '' : (cual === 'ajustes' ? 'Ajustes' : 'Mi cuenta')}</h1></div>
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
