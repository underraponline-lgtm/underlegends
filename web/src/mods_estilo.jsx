// 🎭 MARCAR UN EVENTO DE ESTILO DESDE EL EVENTO, CON LOS LÁPICES DE MODS (20/11/2026, la página Mods, lo que quedaba). Lo
// mismo que ya se podía en dos lugares, desde el evento mismo:
//   · Dlx: el ajuste `eventos_estilo` del Dashboard (`modsEstilo()` de bot/avisos.js lo cambia adentro del objeto, con su
//     historial), para cualquier evento de cualquier servidor;
//   · el staff de un servidor Tier 1 o 2 (con el permiso `eventos`): sus eventos, como en su panel (`socioStaff`, `estilo`).
// Lo toma el ciclo en su próxima vuelta (`bot/eventos_estilo.py`): recién ahí sale «🎭 evento de …» en el evento. El
// catálogo de estilos pesa 76 KB, así que se baja sólo al abrir el lápiz
import { useEffect, useState } from 'react';
import { anotarMods, useModsEstado } from './mods.js';
import { pedirMods, pedirRoles, pedirStaff, puede } from './panelsocio.js';
import { clavesDe } from './estilo_claves.js';

let catP = null;
const catalogo = () => (catP = catP || import('./estilos_juego.json').then((m) => (m.default || m).estilos || []).catch(() => []));

export function EstiloMods({ e }) {
  const M = useModsEstado();
  const [r, setR] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [cat, setCat] = useState(null);
  const [sel, setSel] = useState('');
  const [paso, setPaso] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!M.lapices) { setR(null); return undefined; }
    let vivo = true;
    pedirRoles().then((x) => { if (vivo) setR(x || null); });
    return () => { vivo = false; };
  }, [M.lapices]);
  useEffect(() => { if (abierto && !cat) catalogo().then(setCat); }, [abierto, cat]);
  const ks = clavesDe(e);
  if (!M.lapices || !r || !e || !ks.length) return null;
  const sv = String(e.sv || '');
  const dlx = !!r.dlx;
  const rolSv = (r.roles || {})[sv];
  if (!dlx && !(rolSv && puede(rolSv, 'eventos', r.permisos))) return null;
  const nombreDe = (c) => ((cat || []).find((x) => x[0] === c) || [])[1] || c;
  const hacer = (accion) => {
    setPaso('va'); setMsg('');
    const p = dlx ? pedirMods('estilo', accion, accion === 'marcar' ? { ids: ks, es: sel } : { ids: ks })
      : pedirStaff(sv, 'estilo', accion, accion === 'marcar' ? { id: ks[0], es: sel } : { id: ks[0] });
    p.then((j) => {
      setPaso('');
      if (j && j.ok) {
        if (accion === 'marcar') {
          anotarMods({ t: Date.now(), que: 'Marcaste «' + String(e.n || 'un evento') + '» de ' + nombreDe(sel), donde: 'Eventos · ' + sv, ruta: '#/eventos',
            deshacer: { tipo: 'estilo', dlx, sv, ids: ks } });
          setMsg('✓ Marcado: sale como evento de ' + nombreDe(sel) + ' en la próxima vuelta del ciclo.');
        } else setMsg('✓ Desmarcado: deja de ser de estilo en la próxima vuelta del ciclo.');
        return;
      }
      setMsg(j && j.error === 'tier' ? 'Los eventos de estilo los dan los servidores Tier 1 y 2.' : j && j.error === 'tope' ? 'Hiciste muchos cambios seguidos: prueba en un rato.' : 'No se pudo: prueba de nuevo.');
    }).catch(() => { setPaso(''); setMsg('No se pudo: prueba de nuevo.'); });
  };
  if (!abierto) {
    return <p className="om"><button type="button" className="om-b lapiz" onClick={() => setAbierto(true)} aria-label="Marcar este evento de estilo (Mods)">✎ De estilo</button>
      {e.je ? <span className="md-qe-d">Hoy: evento de {e.je}</span> : null}</p>;
  }
  return (
    <p className="om md-est">
      <select aria-label={'El estilo de «' + String(e.n || '') + '»'} value={sel} onChange={(x) => { setSel(x.target.value); setMsg(''); }} disabled={!cat}>
        <option value="">{cat ? 'Elige un estilo' : 'Cargando los estilos…'}</option>
        {(cat || []).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
      </select>
      <button type="button" className="om-b fuerte" disabled={paso === 'va' || !sel} onClick={() => hacer('marcar')}>{paso === 'va' ? 'Marcando…' : 'Marcar'}</button>
      {e.je ? <button type="button" className="om-b" disabled={paso === 'va'} onClick={() => hacer('quitar')}>No es de estilo</button> : null}
      <button type="button" className="om-b" disabled={paso === 'va'} onClick={() => { setAbierto(false); setMsg(''); }}>Cerrar</button>
      {msg ? <span className={msg.startsWith('✓') ? 'md-qe-ok' : 'om-err'} role="status">{msg}</span> : null}
    </p>
  );
}
