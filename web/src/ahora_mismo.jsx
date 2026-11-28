// 🎧 «AHORA MISMO» (28/11/2026). Dlx, 27/11/2026 (la retención es el objetivo): las llamadas de voz que están pasando
// AHORA en todos los servidores socios, sólo de canales públicos, con números y no con nombres, y un botón para entrar.
//
// Los datos: `GET /api/ahora` (bot/ahora.js, 30 s en el borde), que llena el grabador de Railway (grabador/ahora.js). Se
// pregunta al abrir y cada minuto, SÓLO con la pestaña a la vista. El color, el logo, el nombre y la invitación de cada
// servidor salen del lobby (`liga.svs`, de datos/colores_sv_marca.json y datos/servidores.json): acá no se escribe ninguno.
//
// ⚠️ Va DENTRO del lobby (lobby.jsx), entre tu evento y el panel: suma, no reemplaza nada. Sin llamadas no se dibuja
// («sin dato no hay pieza»). Las clases llevan `amv-` (buscadas en estilo.css, vivo.css y css/: no chocan con nada).
// 🧪 `?prev=ahora`: tres llamadas de muestra en los primeros servidores del lobby, para verlo sin que haya nadie hablando.
import { useEffect, useState } from 'react';
import { Ico } from './piezas.jsx';

const CADA_MS = 60000;
//: en la compu, cuántas se ven antes de «Ver todas»
const VISIBLES = 6;

function prev() {
  try { return !!localStorage.getItem('lg:prev-ahora'); } catch (e) { return false; }
}

function muestra(liga, ahora) {
  const svs = Object.keys((liga && liga.svs) || {}).slice(0, 3);
  const nombres = ['Cypher abierto', 'Entrenamiento', 'Sala de espera'];
  return { t: ahora, ll: svs.map((sv, i) => ({ sv, g: '100000000000000000', c: '20000000000000000' + i, n: nombres[i],
    p: 9 - i * 3, m: 4 - i, d: ahora - (i + 1) * 17 * 60000 })) };
}

/** `{t, ll}` de `/api/ahora`, al día cada minuto mientras la pestaña se ve. `null` hasta la primera respuesta. */
export function useAhora() {
  const [d, setD] = useState(() => (typeof window !== 'undefined' && window.AHORA) || null);
  useEffect(() => {
    let vivo = true;
    let ult = 0;
    const pedir = () => {
      if (document.hidden) return;
      ult = Date.now();
      fetch('/api/ahora', { headers: { accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (vivo && j && Array.isArray(j.ll)) { window.AHORA = j; setD(j); } })
        .catch(() => {});
    };
    pedir();
    const t = setInterval(pedir, CADA_MS);
    // al volver a la pestaña, lo de ahora (si pasó el minuto): no lo de cuando se fue
    const vis = () => { if (!document.hidden && Date.now() - ult > CADA_MS - 5000) pedir(); };
    document.addEventListener('visibilitychange', vis);
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return d;
}

/** «hace 25 min», «hace 1 h 5 min», «recién empieza» */
export function haceCuanto(d, ahora) {
  const min = Math.floor(Math.max(0, ahora - Number(d || ahora)) / 60000);
  if (min < 1) return 'recién empieza';
  if (min < 60) return 'hace ' + min + ' min';
  const h = Math.floor(min / 60);
  return 'hace ' + h + ' h' + (min % 60 ? ' ' + (min % 60) + ' min' : '');
}

export const micros = (m) => (!m ? 'nadie con micro' : m === 1 ? '1 con micro' : m + ' con micro');

/** Los links de una llamada: la invitación del servidor (para quien no está) y el canal (para quien ya está). */
export function linksDe(x, s) {
  const canal = /^\d{15,22}$/.test(String(x.g)) && /^\d{15,22}$/.test(String(x.c))
    ? 'https://discord.com/channels/' + x.g + '/' + x.c : '';
  const inv = /^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]{2,40}\/?$/.test(String((s && s.invita) || '')) ? s.invita : '';
  return { inv, canal };
}

export function AhoraMismo({ liga }) {
  const real = useAhora();
  const [todas, setTodas] = useState(false);
  const ahora = Date.now();
  const d = prev() ? muestra(liga, ahora) : real;
  const svs = (liga && liga.svs) || {};
  // sólo las de servidores que el lobby conoce: sin su color ni su logo, la fila no diría de dónde es
  const ll = ((d && d.ll) || []).filter((x) => x && svs[x.sv] && Number(x.p) > 0);
  if (!ll.length) return null;
  const gente = ll.reduce((a, x) => a + Number(x.p || 0), 0);
  return (
    <section className="amv" aria-label="Llamadas abiertas ahora mismo">
      <div className="amv-cab">
        <h2 className="amv-t"><i className="vivo-late" aria-hidden="true" />AHORA MISMO EN LLAMADA</h2>
        <small className="amv-n">{gente} {gente === 1 ? 'persona' : 'personas'} en {ll.length === 1 ? '1 llamada' : ll.length + ' llamadas'}</small>
      </div>
      {/* todas en la lista: en el celular se deslizan; en la compu las de más de `VISIBLES` esperan a «Ver las N» (CSS) */}
      <ul className={'amv-l' + (ll.length === 1 ? ' uno' : '')}>
        {ll.map((x, i) => {
          const s = svs[x.sv];
          const { inv, canal } = linksDe(x, s);
          const sigla = s.sigla || x.sv;
          const href = inv || canal;
          return (
            <li key={x.g + ':' + x.c} className={'amv-c' + (!todas && i >= VISIBLES ? ' amv-oculta' : '')} style={{ borderLeftColor: s.color || undefined }}>
              <img alt="" src={liga.logo(x.sv)} loading="lazy" />
              <span className="amv-tx">
                <b title={x.n}>{x.n}</b>
                {/* cada dato con su «·» delante y sin cortarse: al bajar de renglón, el punto nunca queda colgando */}
                <small><em>{sigla}</em><span className="amv-dt">· <Ico n="yo" t={13} /> {x.p} en la llamada</span>
                  <span className="amv-dt">· <Ico n="micro" t={13} /> {micros(x.m)}</span></small>
                <small className="amv-h"><span className="amv-dt">{haceCuanto(x.d, ahora)}</span>
                  {inv && canal ? <span className="amv-dt">· <a href={canal} target="_blank" rel="noopener noreferrer"
                    title={'Si ya estás en ' + sigla + ', abre la llamada en Discord'}>Ya estoy en {sigla}</a></span> : null}</small>
              </span>
              {href ? <a className="amv-b" href={href} target="_blank" rel="noopener noreferrer"
                aria-label={'Unirme a ' + x.n + ' en ' + (s.nombre || sigla)}>{inv ? 'Unirme' : 'Abrir'}</a> : null}
            </li>
          );
        })}
      </ul>
      {ll.length > VISIBLES ? <button type="button" className="amv-mas" onClick={() => setTodas(!todas)}>
        {todas ? 'Ver menos' : 'Ver las ' + ll.length + ' llamadas'}</button> : null}
    </section>
  );
}
