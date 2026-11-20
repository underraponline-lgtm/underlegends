// 🪪 QUIÉN ES QUIÉN DESDE EL PERFIL, CON LOS LÁPICES DE MODS (20/11/2026, la página Mods, lo que quedaba; sólo Dlx: lo decide
// la ruta, `/avisos/mods` con `que: 'ident'`). Dos cosas, las mismas que Dlx ya decidía por chat y quedaban en
// datos/akas_a_mano.json: «es la misma persona que…» (va a `pares`, con el nombre que queda) y «son dos personas» (va a
// `no_confundir`). Las aplica el ciclo en su próxima vuelta (`bot/reportes.py`, `ident_mods()`), y quedan en «Lo que hiciste
// con Mods» con su Deshacer. El nombre que queda tiene que estar en la Lista: si no, el ciclo no lo junta, y acá se avisa antes
import { useEffect, useMemo, useState } from 'react';
import { limpio } from './liga.js';
import { anotarMods, useModsEstado } from './mods.js';
import { pedirMods, pedirRoles } from './panelsocio.js';

const igual = (x, y) => limpio(x || '').toLowerCase() === limpio(y || '').toLowerCase();

export function QuienEsMods({ liga, k, nombre }) {
  const M = useModsEstado();
  const [r, setR] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState('mismo');
  const [otro, setOtro] = useState('');
  const [queda, setQueda] = useState('otro');
  const [paso, setPaso] = useState('');
  const [msg, setMsg] = useState('');
  const [ident, setIdent] = useState(null);
  useEffect(() => {
    if (!M.lapices) { setR(null); return undefined; }
    let vivo = true;
    pedirRoles().then((x) => { if (vivo) setR(x || null); });
    return () => { vivo = false; };
  }, [M.lapices]);
  useEffect(() => { setAbierto(false); setOtro(''); setPaso(''); setMsg(''); }, [k]);
  useEffect(() => {
    if (!abierto || ident) return undefined;
    let vivo = true;
    pedirMods('ident', 'ver').then((j) => { if (vivo) setIdent(j && j.ok ? j.ident || [] : []); });
    return () => { vivo = false; };
  }, [abierto, ident]);
  // los nombres de la Lista, para elegir sin escribir de memoria (sólo con el panel abierto)
  const lista = useMemo(() => (abierto ? [...new Set(Object.values(liga.T || {}).map((x) => x && x.n).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')) : []), [abierto, liga]);
  if (!M.lapices || !r || !r.dlx || !nombre) return null;
  const n = limpio(nombre);
  const o = limpio(otro).trim();
  const enLista = (x) => lista.some((y) => igual(y, x));
  const real = queda === 'este' ? n : o;
  const alias = queda === 'este' ? o : n;
  const mal = !o ? 'Escribe el otro nombre.' : igual(o, n) ? 'Es el mismo nombre.'
    : modo === 'mismo' && !enLista(real) ? '«' + real + '» no está en la Lista: el ciclo sólo junta con alguien de la Lista. Elige que quede ' + n + '.' : '';
  const suyos = (ident || []).filter((x) => x.estado === 'activo' && (igual(x.a, n) || igual(x.b, n)));
  const pedir = () => {
    if (mal) { setMsg(mal); return; }
    setPaso('va'); setMsg('');
    const extra = modo === 'mismo' ? { a: alias, b: real } : { a: n, b: o };
    pedirMods('ident', modo === 'mismo' ? 'juntar' : 'separar', extra).then((j) => {
      if (j && j.ok) {
        const t = Date.now();
        anotarMods({ t, que: modo === 'mismo' ? 'Juntaste a ' + alias + ' con ' + real : 'Separaste a ' + n + ' de ' + o,
          donde: 'Perfil · ' + n, ruta: '#/r/' + encodeURIComponent(k), deshacer: { tipo: 'ident', id: j.id } });
        setIdent(j.ident || null); setPaso('hecho'); setOtro('');
        setMsg(modo === 'mismo' ? '✓ Anotado: «' + alias + '» pasa a ser ' + real + ' en la próxima vuelta del ciclo.' : '✓ Anotado: el ciclo deja de confundir a ' + n + ' con ' + o + '.');
        return;
      }
      setPaso(''); setMsg(j && j.error === 'tope' ? 'Hiciste muchos cambios seguidos: prueba en un rato.' : 'No se pudo: prueba de nuevo.');
    }).catch(() => { setPaso(''); setMsg('No se pudo: prueba de nuevo.'); });
  };
  const quitar = (x) => {
    setPaso('va'); setMsg('');
    pedirMods('ident', 'quitar', { id: x.id }).then((j) => {
      setPaso('');
      if (j && j.ok) { setIdent(j.ident || null); setMsg('✓ Vuelve atrás en la próxima vuelta del ciclo.'); } else setMsg('No se pudo: prueba de nuevo.');
    }).catch(() => { setPaso(''); setMsg('No se pudo: prueba de nuevo.'); });
  };
  if (!abierto) {
    return (
      <section className="sec pf-sec md-qe" aria-label="Quién es (Mods)">
        <p className="om"><button type="button" className="om-b lapiz" onClick={() => setAbierto(true)}>✎ Quién es</button>
          <span className="md-qe-d">Juntar a {n} con otro nombre, o separarlos.</span></p>
      </section>
    );
  }
  return (
    <section className="sec pf-sec md-qe" aria-labelledby="md-qe-t">
      <div className="md-qe-c"><h3 id="md-qe-t">✎ Quién es {n}</h3><button type="button" className="om-b" onClick={() => { setAbierto(false); setMsg(''); }}>Cerrar</button></div>
      <div className="md-qe-modos" role="radiogroup" aria-label="Qué pasa con estos dos nombres">
        <button type="button" role="radio" aria-checked={modo === 'mismo'} className={'om-b' + (modo === 'mismo' ? ' fuerte' : '')} onClick={() => { setModo('mismo'); setMsg(''); }}>Es la misma persona que…</button>
        <button type="button" role="radio" aria-checked={modo === 'otro'} className={'om-b' + (modo === 'otro' ? ' fuerte' : '')} onClick={() => { setModo('otro'); setMsg(''); }}>Son dos personas</button>
      </div>
      <label className="md-qe-in"><span>{modo === 'mismo' ? 'El otro nombre' : 'No es'}</span>
        <input type="text" list="md-qe-lista" value={otro} maxLength={60} autoComplete="off" placeholder="Un nombre de la Lista o de una llave"
          onChange={(e) => { setOtro(e.target.value); setMsg(''); }} /></label>
      <datalist id="md-qe-lista">{lista.slice(0, 1500).map((x) => <option key={x} value={x} />)}</datalist>
      {modo === 'mismo' && o && !igual(o, n) ? (
        <div className="md-qe-modos" role="radiogroup" aria-label="Qué nombre queda">
          <span className="md-qe-d">Queda</span>
          <button type="button" role="radio" aria-checked={queda === 'otro'} className={'om-b' + (queda === 'otro' ? ' fuerte' : '')} onClick={() => setQueda('otro')}>{o}</button>
          <button type="button" role="radio" aria-checked={queda === 'este'} className={'om-b' + (queda === 'este' ? ' fuerte' : '')} onClick={() => setQueda('este')}>{n}</button>
        </div>
      ) : null}
      <p className="md-qe-d">{modo === 'mismo'
        ? 'El otro nombre pasa a ser el que queda: lo de los dos se cuenta junto. Lo aplica el ciclo en su próxima vuelta.'
        : 'El ciclo deja de confundirlos, aunque se escriban parecido. Lo aplica en su próxima vuelta.'}</p>
      <p className="om">
        <button type="button" className="om-b fuerte" disabled={paso === 'va' || !o} onClick={pedir}>{paso === 'va' ? 'Anotando…' : modo === 'mismo' ? 'Juntar' : 'Separar'}</button>
        {msg ? <span className={msg.startsWith('✓') ? 'md-qe-ok' : 'om-err'} role="status">{msg}</span> : null}
      </p>
      {suyos.length ? (
        <ul className="md-qe-l" aria-label="Lo que dijiste de este nombre">
          {suyos.map((x) => (
            <li key={x.id}><span>{x.tipo === 'mismo' ? '«' + x.a + '» es ' + x.b : x.a + ' y ' + x.b + ' son dos personas'}</span>
              <button type="button" className="om-b" disabled={paso === 'va'} onClick={() => quitar(x)}>Volver atrás</button></li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
