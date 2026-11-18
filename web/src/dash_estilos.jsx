// 🎭 LOS EVENTOS DE ESTILO, en el Dashboard (17/11/2026).
//
// Dlx: a «¿cómo se marca un evento de DRA como evento de estilo?», «B, desde el Dashboard»; y «que se pueda marcar antes».
// Cada evento de DRA del calendario (lo que viene y lo de las últimas cuatro semanas) con un selector de los 18 estilos.
// Se guarda como un ajuste más (`eventos_estilo`, `{clave: estilo}`): la clave es el número del evento si ya se jugó, o
// `a:<id del mensaje del anuncio>` si todavía no. El ciclo une el anuncio con su llave cuando se juega
// (`bot/eventos_estilo.py`) y con los resultados sube los niveles (`bot/juegos.py`):
//   · jugar un evento de un estilo da nivel 1 en ese estilo; quedar en el cuarto de arriba de la llave sube uno, hasta 3
//   · si es el tuyo (el que elegiste), sube ese; si no, se te desbloquea en el 2.º o 3.º lugar (van los dos más altos)
// Lo marcado sale en Eventos como «Evento de estilo».
import { useState } from 'react';
import CAT from './estilos_juego.json';
import { siglaDe } from './liga.js';

const NOMBRE = Object.fromEntries(CAT.estilos.map(([k, n]) => [k, n]));
const FAMILIA = { ATAQUE: 'Ataque', FOCO: 'Foco', CABEZA: 'Cabeza' };

/** Las claves con las que puede estar marcado un evento del calendario: su número y el id de su anuncio */
export function clavesDe(e) {
  const out = [];
  // ⚠️ sólo si es un NÚMERO DE EVENTO (hasta 6 cifras): la llave de un servidor que no suma (Tier 2 y 3,
  // `datos/llaves_sin_sumar.json`) trae en `ll` su registro (`#126047346`), que no es un evento; ese va por su anuncio.
  // El Worker rechaza el ajuste entero con una clave así. (18/11/2026: esto decía «una llave en vivo», y no lo es)
  if (e && e.ll && /^[0-9]{1,6}$/.test(String(e.ll))) out.push(String(e.ll));
  const m = /\/([0-9]{15,22})\/?$/.exec((e && e.link) || '');
  if (m) out.push('a:' + m[1]);
  return out;
}

export function AjEventosEstilo({ liga, aj, hacer, ocup }) {
  const marcados = aj.eventos_estilo || {};
  // 🏠 DRA por defecto (son sus eventos oficiales); «Todos» deja marcar el de otro servidor. Al 17/11 DRA no tenía ni un
  // evento en el calendario de la T1, así que sin esto la lista salía vacía
  const [todos, setTodos] = useState(false);
  const delCal = (liga.d && liga.d.calendario) || [];
  const hayDRA = delCal.some((e) => e.sv === 'DRA');
  const cal = delCal.filter((e) => todos || e.sv === 'DRA')
    .sort((a, b) => (b.fut - a.fut) || (b.fut ? String(a.t).localeCompare(String(b.t)) : String(b.t).localeCompare(String(a.t))));
  // 🔎 contra el calendario ENTERO, no el filtrado (18/11/2026): con «Sólo DRA» (lo de entrada) todo lo marcado de otro
  // servidor salía en «ya no están en el calendario», como «#493» o «anuncio», y seguía estando
  const usadas = new Set(delCal.flatMap(clavesDe));
  const sueltos = Object.keys(marcados).filter((k) => !usadas.has(k));
  const valor = (e) => { for (const k of clavesDe(e)) if (marcados[k]) return marcados[k]; return ''; };
  const poner = (e, juego) => {
    const ks = clavesDe(e);
    if (!ks.length) return;
    const nuevo = Object.assign({}, marcados);
    for (const k of ks) delete nuevo[k];
    // jugado → por su número (no cambia); por jugar → por su anuncio
    if (juego) nuevo[ks[0]] = juego;
    hacer('eventos_estilo', Object.keys(nuevo).length ? nuevo : null,
      juego ? '«' + e.n + '» es un evento de ' + NOMBRE[juego] + '.' : '«' + e.n + '» ya no es un evento de estilo.');
  };
  const sacar = (k) => {
    const nuevo = Object.assign({}, marcados);
    delete nuevo[k];
    hacer('eventos_estilo', Object.keys(nuevo).length ? nuevo : null, 'Listo: ya no está marcado.');
  };
  const opciones = (
    <>
      <option value="">— no es de estilo —</option>
      {CAT.familias.map(([f]) => (
        <optgroup key={f} label={FAMILIA[f]}>
          {CAT.estilos.filter((x) => x[2] === f).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </optgroup>
      ))}
    </>
  );
  return (
    <div className="db-aj db-aj-ancho">
      <div className="db-aj-c"><h3>Eventos de estilo</h3><span className="db-est">{Object.keys(marcados).length} marcados</span></div>
      <p className="db-tx">
        Elige un estilo para un evento de DRA. Jugarlo da <b>nivel 1</b> en ese estilo, y quedar en el <b>cuarto de arriba</b> de
        la llave sube uno, hasta el 3. Si es el estilo que la persona eligió, sube ese; si no, se le desbloquea en el 2.º o 3.º lugar.
        Lo puedes marcar antes de que se juegue: sale en Eventos como «Evento de estilo».
      </p>
      <div className="db-ee-f" role="radiogroup" aria-label="Qué eventos ver">
        <button type="button" role="radio" aria-checked={!todos} className={'btn chico ' + (!todos ? 'verde' : 'borde2')} onClick={() => setTodos(false)}>Sólo DRA</button>
        <button type="button" role="radio" aria-checked={todos} className={'btn chico ' + (todos ? 'verde' : 'borde2')} onClick={() => setTodos(true)}>Todos los servidores</button>
      </div>
      {!todos && !hayDRA ? <p className="db-tx">DRA no tiene eventos anunciados en estas semanas. Cuando anuncie uno, aparece acá; mientras, puedes marcar el de otro servidor en «Todos los servidores».</p> : null}
      {cal.length ? (
        <ul className="db-ee">
          {cal.map((e) => {
            const v = valor(e);
            return (
              <li key={e.link || e.ll || e.t} className={v ? 'on' : ''}>
                <span className="db-ee-d">{liga.dia ? liga.dia(e.t) : String(e.t).slice(0, 10)}</span>
                {/* 🏷️ la sigla, no el código (ACAD → LCW, SR → SNK: `siglaDe()`), y un `ll` de 9 cifras es una llave de
                    `llaves_sin_sumar.json` (Tier 2 y 3), no una en vivo: decía «en vivo» de eventos de hace semanas (18/11/2026) */}
                <span className="db-ee-n"><b>{e.n}</b><small>{todos ? siglaDe(e.sv) + ' · ' : ''}{e.fut ? 'por jugar' : /^[0-9]{1,6}$/.test(String(e.ll || '')) ? '#' + e.ll : e.ll ? 'no suma' : 'sin llave'}</small></span>
                <select className="db-sel" disabled={ocup || !clavesDe(e).length} value={v} aria-label={'El estilo de «' + e.n + '»'}
                  onChange={(ev) => poner(e, ev.target.value)}>{opciones}</select>
              </li>
            );
          })}
        </ul>
      ) : todos ? <p className="db-tx">No hay eventos en el calendario de estas semanas.</p> : null}
      {sueltos.length ? (
        <>
          <p className="db-tx">Marcados que ya no están en el calendario de estas semanas (siguen contando):</p>
          <ul className="db-ee">
            {sueltos.map((k) => (
              <li key={k} className="on">
                <span className="db-ee-d">{k.startsWith('a:') ? 'anuncio' : '#' + k}</span>
                <span className="db-ee-n"><b>{NOMBRE[marcados[k]] || marcados[k]}</b></span>
                <button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => sacar(k)}>Sacar</button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
