// 🎙️💎 LO QUE VE CADA UNO DEL EVENTO GRABADO (28/11/2026, el paso 7). Va adentro de «El evento entero» de la llave
// (`EventoCompleto`, llave.jsx): arriba, qué puedes oír y por qué; en la lista, la marca de cada batalla (30 s · Tu batalla ·
// entera); cuando termina un adelanto, el cartel con «Hazte Premium»; y para el Premium, la grabación completa en partes.
// Qué oye cada uno lo decide el Worker (bot/grabados.js `acceso()`): acá sólo se dice.
import { useState } from 'react';
import CSS from './css/grabado.css?inline';
import { usarCss } from './css.js';
import { HAZTE, PREVIA_S, largo } from './grabado.js';

usarCss('grabado', CSS);

const W = typeof window !== 'undefined' ? window : {};
const entrar = () => { if (W.urlLogin) W.location.href = W.urlLogin('s'); };
const fecha = (ms) => { try { return new Date(ms).toLocaleDateString('es', { day: 'numeric', month: 'long' }); } catch (e) { return ''; } };

function Hazte({ cls = 'btn verde chico' }) {
  return <a className={cls} href={HAZTE}>Hazte Premium</a>;
}

/** 🔓 Arriba de todo: qué escuchas tú, en una línea, y el camino al Premium si no lo tienes. */
export function AccesoGrabado({ F }) {
  if (!F) return null;
  const hasta = F.ev && F.ev.hasta_e ? fecha(F.ev.hasta_e) : '';
  const completo = F.evento && F.evento.dur ? ' y la grabación completa (' + largo(F.evento.dur) + ', con todo lo del medio)' : ' y la grabación completa';
  if (F.yo === 'premium') {
    return (
      <div className="gb-acc gb-prem" role="note">
        <span className="gb-tag">PREMIUM</span>
        <p><b>Tienes el evento entero:</b> todas las batallas{F.evento ? completo : ''}.{hasta ? ' Hasta el ' + hasta + '.' : ''}</p>
      </div>
    );
  }
  const tuyas = F.tuyas || 0;
  return (
    <div className="gb-acc" role="note">
      <span className="gb-tag">{PREVIA_S} S GRATIS</span>
      <div className="gb-acc-t">
        {F.yo === 'anon' ? (
          <p><b>De cada batalla escuchas {PREVIA_S} segundos.</b> ¿Rapeaste acá? Entra con Discord y tu batalla suena entera, gratis.</p>
        ) : tuyas ? (
          <p><b>{tuyas === 1 ? 'Tu batalla suena entera' : 'Tus ' + tuyas + ' batallas suenan enteras'}: {tuyas === 1 ? 'es tuya' : 'son tuyas'}.</b> Del resto, {PREVIA_S} segundos de cada una.</p>
        ) : (
          <p><b>De cada batalla escuchas {PREVIA_S} segundos.</b> Si rapeaste en este evento, tu batalla suena entera.</p>
        )}
        <p className="gb-acc-sub">Con el Premium del Pase: todas las batallas enteras{F.evento ? completo : ''}.</p>
      </div>
      <div className="gb-acc-b">
        {F.yo === 'anon' ? <button type="button" className="btn borde2 chico" onClick={entrar}>Entrar con Discord</button> : null}
        <Hazte />
      </div>
    </div>
  );
}

/** La marca de cada batalla en la lista: «30 s», «Tu batalla» o nada (entera con el Premium). */
export function MarcaFila({ y }) {
  if (!y || !y.nivel) return null;
  if (y.tuya) return <b className="gb-m gb-m-tuya">Tu batalla</b>;
  if (y.previa) return <b className="gb-m">{PREVIA_S} s</b>;
  return null;
}

/** ⏹️ Cuando termina un adelanto: lo que falta y cómo llegar. Sigue solo al próximo (como el cartel del resultado). `sigue`:
 *  'adelanto' o 'batalla' (la que viene suena entera: es tuya), o '' si era la última. */
export function CartelPrevia({ y, sigue, onSiguiente }) {
  return (
    <div className="vau-cartel gb-cartel" role="status">
      <small>Fin de los {PREVIA_S} s gratis</small>
      <p className="gb-cartel-t">La batalla entera dura {Math.max(1, Math.round((y && y.dur ? y.dur : 0) / 60))} min.</p>
      <div className="gb-cartel-b">
        <a href={HAZTE}>Hazte Premium</a>
        {sigue ? <button type="button" onClick={onSiguiente}>{sigue === 'batalla' ? 'Siguiente batalla ›' : 'Siguiente adelanto ›'}</button> : null}
      </div>
    </div>
  );
}

/** 💎 La grabación completa, con lo del medio, en las partes en que la entregó ULAYA. Sólo llega al Premium. */
export function PartesEvento({ F }) {
  const [abierta, setAbierta] = useState(false);
  if (!F || F.yo !== 'premium' || !F.partes.length) return null;
  return (
    <div className="gb-partes">
      <button type="button" className={'btn borde2 chico' + (abierta ? ' on' : '')} aria-expanded={abierta} onClick={() => setAbierta(!abierta)}>
        {abierta ? 'Ocultar la grabación completa' : 'La grabación completa' + (F.evento && F.evento.dur ? ' · ' + largo(F.evento.dur) : '')}
      </button>
      {abierta ? (
        <>
          <p className="gb-partes-t">Tal cual sonó la llamada, con las esperas y lo que se habló entre batalla y batalla{F.partes.length > 1 ? ', en ' + F.partes.length + ' partes' : ''}.</p>
          <ol className="gb-partes-l">
            {F.partes.map((p) => (
              <li key={p.n}>
                {F.partes.length > 1 ? <small>Parte {p.n}{p.mb ? ' · ' + p.mb + ' MB' : ''}</small> : null}
                <audio src={p.url} controls preload="none" />
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </div>
  );
}
