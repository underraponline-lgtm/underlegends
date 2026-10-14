// 🏟️ LAS LIGAS DE LOS SERVIDORES (Dlx, 12/10/2026: «2. Me gusta», a la pestaña «Ligas» con la tabla de cada una; y a
// la Copa de Campeones, no: «cada liga tiene su inicio y su fin aleatoriamente… no podemos controlar eso»). La cuenta
// la hace el ciclo (`bot/ligas.py`) con los veredictos de cada liga y viaja en el lobby (`ligas`): acá sólo se muestra.
//
// ⚠️ LA TABLA ES LA QUE SALE DE LOS VEREDICTOS QUE SE PUDIERON LEER: directa 3 y 0, réplica 2 y 1, sin los ExtraPlayers.
// La oficial de cada liga puede tener sanciones o defaults que acá no están; por eso va el link a la suya.
import { useState } from 'react';
import { limpio, num, siglaDe } from './liga.js';
import { Cara } from './piezas.jsx';

// 🏟️ ¿UN NOMBRE ESTÁ MAL? (Dlx, 14/10/2026: «Sí, a Reportes», a ForceGP: «¿no hay manera de que uno pueda corregir
// eso?»). Elegís el nombre, contás quién es, y le llega a la Liga en Reportes del Dashboard con tu cuenta; lo decide la
// Liga y el ciclo lo deja como el nombre de esa persona en ESE servidor (`reportes.corregir_liga()`). Como el de las llaves
function AvisarLiga({ L }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [txt, setTxt] = useState('');
  const [est, setEst] = useState('');
  const [va, setVa] = useState(false);
  const [ok, setOk] = useState(false);
  if (ok) return <p className="lk-rep-ok">✓ ¡Gracias! Lo revisa la Liga.</p>;
  if (!abierto) return <button type="button" className="btn borde2 chico lg-avisar" onClick={() => setAbierto(true)}>¿Un nombre está mal?</button>;
  const nombres = [];
  for (const f of L.tabla || []) if (f[0] && !nombres.includes(f[0])) nombres.push(f[0]);
  for (const u of L.ult || []) for (const x of u.slice(0, 2)) if (x && !nombres.includes(x)) nombres.push(x);
  const enviar = () => {
    const t = txt.replace(/\s+/g, ' ').trim();
    if (!nombre || va) return;
    if (t.length < 2) { setEst('Contá quién es.'); return; }
    if (!window.conCuenta) { setEst('No pude mandarlo. Probá de nuevo en un rato.'); return; }
    setVa(true);
    setEst('');
    window.conCuenta('/api/avisos/reportar', { llave: 'liga:' + L.id, que: 'nombre', texto: t, batalla: nombre }).then((j) => {
      setVa(false);
      if (j && j.ok) { setOk(true); return; }
      const e = (j && j.error) || '';
      setEst((window.errorCuenta && window.errorCuenta(e)) || (j && j.status === 401 ? 'Para avisar, entrá con Discord desde Mi cuenta.'
        : e === 'nueva' ? 'Tu cuenta de Discord es muy nueva para avisar.'
          : e === 'tope' ? 'Ya mandaste varios hoy: probá mañana.' : 'No pude mandarlo. Probá de nuevo en un rato.'));
    }).catch(() => { setVa(false); setEst('No pude mandarlo. Probá de nuevo en un rato.'); });
  };
  return (
    <div className="lk-rep">
      <p className="lk-rep-t">¿Qué nombre de {L.n} está mal?</p>
      <div className="lk-rep-q" role="group" aria-label="El nombre que está mal">
        {nombres.map((x) => <button key={x} type="button" aria-pressed={nombre === x} className={nombre === x ? 'on' : ''} onClick={() => setNombre(x)}>{limpio(x)}</button>)}
      </div>
      {nombre ? <textarea aria-label="Quién es" maxLength={300} rows={2} value={txt} onChange={(e) => setTxt(e.target.value)}
        placeholder={'¿Quién es «' + limpio(nombre) + '»? Su nombre en la Liga o su Discord (o «soy yo»)'} /> : null}
      <div className="lk-rep-pie">
        <button type="button" className="btn verde chico" disabled={!nombre || va} onClick={enviar}>{va ? 'Enviando…' : 'Enviar'}</button>
        <span aria-live="polite">{est}</span>
      </div>
      <p className="lk-rep-nota">Se guarda con tu cuenta de Discord 14 días, para revisarlo. Lo decide la Liga.</p>
    </div>
  );
}

export function Ligas({ liga }) {
  const D = liga.d.ligas;
  const ls = (D && D.ligas) || [];
  const [sel, setSel] = useState(0);
  if (!ls.length) return null;
  const L = ls[Math.min(sel, ls.length - 1)];
  const yo = liga.yo;
  // 🔑 el perfil de cada nombre: el de la tabla del lobby, y si no está ahí, el que manda el ciclo (`ks`, 14/10/2026:
  // ForceGP es staff, no está entre los que jugaron eventos, y «le pico donde dice FORCE y no me lleva a nada»)
  const kDe = (raw) => { const f = liga.fila(raw); return f ? f.k : ((L.ks || {})[raw] || ''); };
  const miK = (window.DC && window.DC.clave) || (yo && yo.k) || '';
  const esYo = (raw) => (!!yo && liga.esDe(raw, yo.k)) || (!!miK && kDe(raw) === miK);
  const nombre = (raw, cls) => {
    const k = kDe(raw);
    return k ? <a className={cls} href={'#/r/' + encodeURIComponent(k)}>{limpio(raw)}</a> : <span className={cls}>{limpio(raw)}</span>;
  };
  const cara = (raw) => {
    const k = kDe(raw);
    return k ? <Cara liga={liga} k={k} nombre={raw} cls="cara dv-cara" /> : <span className="cara dv-cara ini">{limpio(raw).slice(0, 1).toUpperCase()}</span>;
  };
  return (
    <div className="dv lgs">
      <p className="dv-cab">Las ligas de los servidores, con sus jornadas: cada una arranca y termina cuando la organiza su servidor.
        {' '}Sus batallas suman a tus <b>duelos</b> (el Ranking Duelos y el Win%); al Score, no.</p>
      <div className="lg-tabs" role="tablist" aria-label="Las ligas">
        {ls.map((x, i) => (
          <button key={x.id} type="button" role="tab" aria-selected={i === sel} className={i === sel ? 'on' : ''} onClick={() => setSel(i)}>
            {x.n}<small>{siglaDe(x.sv)}</small>
          </button>
        ))}
      </div>
      <section className="dv-g" aria-label={L.n}>
        <h3 className="dv-gt">{L.n}<small>{L.j ? 'jornada ' + L.j + ' · ' : ''}{num(L.bat)} {L.bat === 1 ? 'batalla' : 'batallas'}{L.pend ? ' · ' + L.pend + ' sin cierre todavía' : ''}</small></h3>
        <ol className="dv-tabla lg-tabla">
          {L.tabla.map(([raw, pj, pg, pts], i) => (
            <li key={raw} className={esYo(raw) ? 'yo' : ''}>
              <span className="dv-i">{i + 1}</span>
              {cara(raw)}
              {nombre(raw, 'dv-n')}
              <span className="lg-pj" title="ganadas de jugadas">{pg}/{pj}</span>
              <b className="dv-p">{pts}</b>
            </li>
          ))}
        </ol>
        <h4 className="lg-st">Los últimos resultados</h4>
        <ul className="lg-ult">
          {L.ult.map(([a, b, g, como, j], i) => (
            <li key={i}>
              {nombre(g, 'lg-g')} le ganó a {nombre(g === a ? b : a, 'lg-p')}
              <small>{como === 'replica' ? 'en réplica' : 'directo'}{j ? ' · jornada ' + j : ''}</small>
            </li>
          ))}
        </ul>
        <p className="lg-nota">La tabla sale de los veredictos que se pudieron leer: directa 3 puntos, réplica 2 y 1, sin los invitados.
          {L.link ? <> La oficial, con sanciones y defaults, está en <a className="te-link" href={L.link} target="_blank" rel="noopener noreferrer">su Discord</a>.</> : null}</p>
        <AvisarLiga key={L.id} L={L} />
      </section>
    </div>
  );
}
