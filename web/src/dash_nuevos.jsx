// 🐣 LOS EVENTOS DE NUEVOS, en el Dashboard (28/11/2026).
//
// Dlx: «puedes tener 1 temporada gratis de pase premium si participas en eventos nuevos». Quien JUEGA un evento marcado
// acá recibe el Pase Premium de la temporada, una vez (bot/premium_regalos.js). Se marca como los de estilo
// (dash_estilos.jsx), con la misma clave: el número del evento si ya se jugó o `a:<id del anuncio>` si todavía no. Se
// guarda en el ajuste `eventos_nuevos`, `{clave: 1}`; `{clave: 0}` le saca la marca a uno que el ciclo detectó solo
// (`nv` en el calendario: anunciado en «evento-nuevos» o con «para los nuevos», «novatos»… en el nombre;
// bot/premium_nuevos.py).
import { useState } from 'react';
import { siglaDe } from './liga.js';
import { clavesDe } from './estilo_claves.js';

export function AjEventosNuevos({ liga, aj, hacer, ocup }) {
  const marcados = aj.eventos_nuevos || {};
  const [todos, setTodos] = useState(false);
  const delCal = (liga.d && liga.d.calendario) || [];
  const cal = delCal.filter((e) => todos || e.sv === 'DRA')
    .sort((a, b) => (b.fut - a.fut) || (b.fut ? String(a.t).localeCompare(String(b.t)) : String(b.t).localeCompare(String(a.t))));
  const usadas = new Set(delCal.flatMap(clavesDe));
  const sueltos = Object.keys(marcados).filter((k) => !usadas.has(k) && marcados[k] === 1);
  // lo que dijo Dlx gana; si no dijo nada, lo que detectó el ciclo (`nv`)
  const dice = (e) => { for (const k of clavesDe(e)) if (k in marcados) return marcados[k]; return null; };
  const es = (e) => { const d = dice(e); return d === null ? !!e.nv : d === 1; };
  const poner = (e, si) => {
    const ks = clavesDe(e);
    if (!ks.length) return;
    const nuevo = Object.assign({}, marcados);
    for (const k of ks) delete nuevo[k];
    // si coincide con lo detectado solo, no hace falta guardar nada; si no, 1 o 0 por su primera clave
    if (si !== !!e.nv) nuevo[ks[0]] = si ? 1 : 0;
    hacer('eventos_nuevos', Object.keys(nuevo).length ? nuevo : null,
      si ? '«' + e.n + '» es un evento de nuevos: quien lo juegue recibe el Pase Premium de la temporada.' : '«' + e.n + '» ya no es un evento de nuevos.');
  };
  const sacar = (k) => {
    const nuevo = Object.assign({}, marcados);
    delete nuevo[k];
    hacer('eventos_nuevos', Object.keys(nuevo).length ? nuevo : null, 'Listo: ya no está marcado.');
  };
  return (
    <div className="db-aj db-aj-ancho">
      <div className="db-aj-c"><h3>Eventos de nuevos</h3><span className="db-est">{cal.filter(es).length} en el calendario</span></div>
      <p className="db-tx">
        Quien <b>juega</b> un evento marcado recibe el <b>Pase Premium de la temporada</b>, una sola vez. Si ya lo tenía, se le
        guarda uno en su Inventario. Los de DRA anunciados en «evento-nuevos» o con «para los nuevos», «novatos» o «principiantes»
        en el nombre se marcan solos: puedes sacarles la marca.
      </p>
      <div className="db-ee-f" role="radiogroup" aria-label="Qué eventos ver">
        <button type="button" role="radio" aria-checked={!todos} className={'btn chico ' + (!todos ? 'verde' : 'borde2')} onClick={() => setTodos(false)}>Sólo DRA</button>
        <button type="button" role="radio" aria-checked={todos} className={'btn chico ' + (todos ? 'verde' : 'borde2')} onClick={() => setTodos(true)}>Todos los servidores</button>
      </div>
      {cal.length ? (
        <ul className="db-ee">
          {cal.map((e) => {
            const v = es(e);
            return (
              <li key={e.link || e.ll || e.t} className={v ? 'on' : ''}>
                <span className="db-ee-d">{liga.dia ? liga.dia(e.t) : String(e.t).slice(0, 10)}</span>
                <span className="db-ee-n"><b>{e.n}</b><small>{todos ? siglaDe(e.sv) + ' · ' : ''}{e.fut ? 'por jugar' : /^[0-9]{1,6}$/.test(String(e.ll || '')) ? '#' + e.ll : e.ll ? 'no suma' : 'sin llave'}{e.nv && dice(e) === null ? ' · detectado solo' : ''}</small></span>
                <button type="button" className={'btn chico ' + (v ? 'verde' : 'borde2')} disabled={ocup || !clavesDe(e).length} aria-pressed={v}
                  onClick={() => poner(e, !v)}>{v ? '🐣 De nuevos' : 'Marcar'}</button>
              </li>
            );
          })}
        </ul>
      ) : <p className="db-tx">No hay eventos en el calendario de estas semanas.</p>}
      {sueltos.length ? (
        <>
          <p className="db-tx">Marcados que ya no están en el calendario de estas semanas (siguen contando):</p>
          <ul className="db-ee">
            {sueltos.map((k) => (
              <li key={k} className="on">
                <span className="db-ee-d">{k.startsWith('a:') ? 'anuncio' : '#' + k}</span>
                <span className="db-ee-n"><b>Evento de nuevos</b></span>
                <button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => sacar(k)}>Sacar</button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
