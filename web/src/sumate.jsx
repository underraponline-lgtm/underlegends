// /sumate: cómo se suma un servidor, una comunidad o una marca, con todo lo que hacemos. Dlx, 03/10/2026: «quizás
// tengamos que crear una página externa para eso de CÓMO AGREGAR TU SERVIDOR O COMUNIDAD O CÓMO ASOCIARTE A NOSOTROS y
// explicar a FULL DETALLE lo que hacemos y beneficios que tendrían», y a las preguntas: «3. A» (en la raíz de Under
// Legends, no adentro de la Liga) · «4. hacer 1 evento a la semana como mínimo… y entre otras cosas que se discutirá
// conmigo… o incluso… un ticket donde te envía el formulario a ti y me lo envías a mí por Discord» · «5. Sí… no sólo
// comunidades sino otras cosas». 🔍 PREVIEW: sólo con `lg:prev-sum` (App.jsx).
//
// ⚠️ LO QUE DICE TIENE QUE SER VERDAD HOY. Lo único que se pide es lo que dijo Dlx (un evento por semana); lo demás «se
// habla con Dlx». Nada de precios ni de plazos que nadie decidió.
import { useState } from 'react';
import { num } from './liga.js';
import { Compartir, Ico, accion, enlace } from './piezas.jsx';
import { REDES } from './servidor.jsx';
import { BotHace, DLX, QueGana } from './sumar.jsx';

const QUIEN = [
  ['socios', 'Servidores de freestyle', 'Organizás eventos en tu Discord: tus eventos suman a la tabla de toda la Liga y tu gente tiene su carta.'],
  ['seguir', 'Comunidades y creadores', 'Una comunidad de rap, un canal, un stream o un medio: lo que hacés y la Liga se pueden cruzar.'],
  ['tienda', 'Marcas y patrocinadores', 'Premios para los eventos, tu marca en la página y en las redes de Under Legends: lo armamos juntos.'],
];
const PASOS = [
  ['Mandá tu postulación', 'Con el formulario de abajo, o escribile a @itsdlx en Discord.'],
  ['Lo charlamos', 'Lo mínimo para un servidor: un evento por semana. Lo demás se habla con Dlx.'],
  ['Se suma el bot', 'Lee tus anuncios y tus llaves y crea las invitaciones de la Liga. Nada más.'],
  ['Tus eventos suman', 'Desde el primero: a la tabla, a las cartas y a todo lo de arriba.'],
];
const PREGUNTAS = [
  ['¿Tengo que cambiar cómo anuncio mis eventos?', 'No. El bot lee los anuncios como los escribe cada servidor: con su plantilla, sus campos y sus emojis.'],
  ['¿Mi gente tiene que registrarse?', 'No: aparece en el ranking con jugar. Si entra con Discord a la página, ve su carta, sigue a otros y le llegan sus avisos.'],
  ['¿Qué necesita el bot?', 'Ver tus canales de anuncios, de inscripciones y de llaves, y poder crear invitaciones. No escribe en ellos ni toca mensajes.'],
  ['¿Sirve si mi servidor es chico?', 'Sí. La guerra de servidores se gana por los puntos por persona, no por cuántos son, y lo mínimo es un evento por semana.'],
];
const TIPOS = [['servidor', 'Servidor de freestyle'], ['comunidad', 'Comunidad o creador'], ['marca', 'Marca o patrocinador'], ['otro', 'Otra cosa']];

// la postulación: a /api/avisos/sumate con tu sesión de Discord (así Dlx sabe quién escribió y te contesta), y de ahí a
// su DM (`postular()` de bot/avisos.js). Sin sesión, primero «Entrar con Discord»
function Postulacion({ dc }) {
  const [d, setD] = useState({ tipo: 'servidor', nombre: '', link: '', miembros: '', eventos: '', mensaje: '' });
  const [est, setEst] = useState('');
  const [msg, setMsg] = useState('');
  const cambiar = (k) => (e) => setD(Object.assign({}, d, { [k]: e.target.value }));
  const mandar = async (e) => {
    e.preventDefault();
    if (est === 'mandando') return;
    setEst('mandando');
    setMsg('');
    try {
      const r = await fetch('/api/avisos/sumate', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(d) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { setEst('listo'); return; }
      setEst('');
      setMsg(j.error === 'sin_sesion' ? 'Tu sesión venció: entrá con Discord de nuevo.'
        : j.error === 'ya' ? 'Ya mandaste una en las últimas 24 horas: Dlx la tiene.'
          : j.error === 'nueva' ? 'Tu cuenta de Discord es muy nueva para mandarla desde acá: escribile a @itsdlx en Discord.'
            : j.error === 'muchas' ? 'Hoy llegaron muchas: escribile a @itsdlx en Discord.'
          : j.error === 'faltan' ? (j.que || 'Falta el nombre.')
            : 'No pude mandarla. Escribile a @itsdlx en Discord.');
    } catch (err) {
      setEst('');
      setMsg('No pude mandarla. Escribile a @itsdlx en Discord.');
    }
  };
  if (est === 'listo') {
    return (
      <div className="su-ok" role="status">
        <b>✓ Le llegó a Dlx</b>
        <p>Te va a escribir por Discord. Si querés adelantarte, escribile a <b>@itsdlx</b>.</p>
      </div>
    );
  }
  if (!dc) {
    return (
      <div className="su-entrar">
        <p>Para mandarla entrá con Discord: así Dlx sabe quién sos y te contesta ahí.</p>
        <div className="su-acc">
          <button type="button" className="btn verde" onClick={accion.entrar}>Entrar con Discord</button>
          <a className="btn borde2" href={DLX} target="_blank" rel="noopener noreferrer"><span>O escribile a <span className="soc-at">@itsdlx</span> ↗</span></a>
        </div>
      </div>
    );
  }
  return (
    <form className="su-form" onSubmit={mandar}>
      <fieldset className="su-tipos">
        <legend>¿Qué sos?</legend>
        {TIPOS.map(([k, t]) => (
          <label key={k} className={d.tipo === k ? 'on' : ''}>
            <input type="radio" name="tipo" value={k} checked={d.tipo === k} onChange={cambiar('tipo')} />{t}
          </label>
        ))}
      </fieldset>
      <label className="su-campo"><span>Nombre</span>
        <input type="text" required maxLength={80} value={d.nombre} onChange={cambiar('nombre')}
          placeholder={d.tipo === 'marca' ? 'El nombre de tu marca' : 'El nombre de tu servidor o comunidad'} /></label>
      <label className="su-campo"><span>Link <small>la invitación de Discord, tu web o tus redes</small></span>
        <input type="url" maxLength={200} value={d.link} onChange={cambiar('link')} placeholder="https://discord.gg/…" /></label>
      <div className="su-dos">
        <label className="su-campo"><span>¿Cuántos son?</span>
          <input type="number" min="0" max="10000000" inputMode="numeric" value={d.miembros} onChange={cambiar('miembros')} placeholder="Miembros o seguidores" /></label>
        {d.tipo === 'servidor' ? (
          <label className="su-campo"><span>Eventos por semana</span>
            <input type="number" min="0" max="50" inputMode="numeric" value={d.eventos} onChange={cambiar('eventos')} placeholder="Lo mínimo es 1" /></label>
        ) : null}
      </div>
      <label className="su-campo"><span>Contanos <small>qué hacen, qué te gustaría</small></span>
        <textarea rows={4} maxLength={1000} value={d.mensaje} onChange={cambiar('mensaje')} /></label>
      <p className="su-nota">Le llega a Dlx por Discord, con tu usuario <b>{dc.n || ''}</b>. Guardamos lo que escribiste 90 días.</p>
      {msg ? <p className="su-err" role="alert">{msg}</p> : null}
      {msg && /sesión venció/.test(msg) ? <button type="button" className="btn borde2" onClick={accion.entrar}>Entrar con Discord</button> : null}
      <button type="submit" className="btn verde" disabled={est === 'mandando'}>{est === 'mandando' ? 'Mandando…' : 'Mandar la postulación'}</button>
    </form>
  );
}

export function Sumate({ liga, dc }) {
  const svs = Object.values(liga.svs).sort((a, b) => (b.pts || 0) - (a.pts || 0));
  const enDiscord = svs.reduce((t, s) => t + (s.miembros || 0), 0);
  // ⚠️ la gente del pool, no las 200 filas que viajan (ver Socios)
  const raperos = liga.d.gente || (liga.d.tabla || []).length;
  const bajar = (sel) => {
    const h = document.getElementById('inicio-nuevo');
    const s = h && h.shadowRoot ? h.shadowRoot.querySelector(sel) : null;
    if (s) window.scrollTo({ top: s.getBoundingClientRect().top + window.scrollY - 10, behavior: 'smooth' });
  };
  return (
    <>
      <div className="escena su-esc" style={{ '--mo-c': '#E41373', '--mo-o': 0.8 }}>
        <section className="su-hero">
          <span className="tag">UNDER LEGENDS · SUMATE</span>
          <h1 className="hero-ev largo">Sumate a la Liga</h1>
          <p className="hero-p">Servidores, comunidades y marcas: la Liga Global junta el freestyle de Discord en una sola tabla. Esto es todo lo que hacemos, y cómo sumarte.</p>
          <dl className="soc-tot">
            <div><dt>SERVIDORES</dt><dd>{svs.length}</dd></div>
            <div><dt>EN SUS DISCORD</dt><dd>{num(enDiscord)}</dd></div>
            <div><dt>JUGARON LA {liga.temp}</dt><dd>{num(raperos)}</dd></div>
            {liga.d.eventos ? <div><dt>EVENTOS EN LA {liga.temp}</dt><dd>{num(liga.d.eventos)}</dd></div> : null}
          </dl>
          <div className="su-acc">
            <button type="button" className="btn verde" onClick={() => bajar('.su-post')}>Postulate</button>
            <a className="btn borde" href={DLX} target="_blank" rel="noopener noreferrer"><span>Escribirle a <span className="soc-at">@itsdlx</span> ↗</span></a>
            <Compartir cls="btn borde" url={enlace('#/sumate')} texto="Sumate a la Liga Global" />
          </div>
          {/* los que ya están: la prueba de que esto anda */}
          <a className="su-ya" href="#/socios" aria-label="Los servidores que ya están">
            <span>YA ESTÁN</span>{svs.map((s) => <img key={s.sv} alt={s.sv} title={s.nombre || s.sv} src={liga.logo(s.sv)} />)}<Ico n="flecha" t={16} />
          </a>
        </section>
      </div>

      <section className="sec su-quien" aria-label="Para quién es">
        <div className="sec-t"><h2>Para quién es</h2></div>
        <ul className="su-q">
          {QUIEN.map(([ic, t, tx]) => <li key={t}><Ico n={ic} t={26} /><b>{t}</b><span>{tx}</span></li>)}
        </ul>
      </section>

      <section className="soc-sumar su-hace" aria-label="Lo que hacemos por cada servidor">
        <div className="soc-sumar-tit">
          <span className="tag">PARA SERVIDORES</span>
          <h2 className="hero-ev">Lo que hacemos por cada servidor</h2>
          <p className="hero-p">Tocá cada una para ver un ejemplo de la Liga de hoy.</p>
        </div>
        <QueGana ejemplos />
        {(liga.d.redes || []).length ? (
          <nav className="soc-ul" aria-label="Las redes de Under Legends">
            <span>LAS REDES DE UNDER LEGENDS</span>
            {liga.d.redes.map(([r, u]) => <a key={r} href={u} target="_blank" rel="noopener noreferrer">{REDES[r] || r} ↗</a>)}
          </nav>
        ) : null}
      </section>

      <section className="sec su-como" aria-label="Cómo se suma">
        <div className="sec-t"><h2>Cómo se suma</h2></div>
        <ol className="su-pasos">
          {PASOS.map(([t, tx], i) => <li key={t}><b>{i + 1}</b><h3>{t}</h3><p>{tx}</p></li>)}
        </ol>
        <div className="su-bot"><BotHace /></div>
      </section>

      <section className="sec su-faq" aria-label="Preguntas">
        <div className="sec-t"><h2>Preguntas</h2></div>
        <div className="gu-faq">
          {PREGUNTAS.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </div>
      </section>

      <section className="sec negra su-post" aria-label="La postulación">
        <div className="sec-t"><h2>Postulate</h2></div>
        <p className="hero-p">Contanos quién sos y qué hacen. Le llega a Dlx por Discord y te escribe él.</p>
        <Postulacion dc={dc} />
      </section>
    </>
  );
}
