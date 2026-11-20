// ✎ OCULTAR UNA PUBLICACIÓN CON LOS LÁPICES DE MODS (20/11/2026, la página Mods, tanda 3). Lo mismo que el staff de un
// servidor ya podía hacer desde su panel (`socioStaff()` de bot/avisos.js, `que: 'muro'`), desde la publicación misma: Dlx
// en cualquier servidor, y los Admin y Moderadores de la página (`liga`). Sólo las de un servidor (`it.sv`): las de toda
// la Liga no tienen a quién pertenecer. La saca del muro el ciclo en la próxima vuelta (`bot/muro.py`, `MS.ocultos()`), y
// queda en «Lo que hiciste con Mods» con su Deshacer
import { useEffect, useState } from 'react';
import { anotarMods, deshechaMods, useModsEstado } from './mods.js';
import { pedirRoles, pedirStaff, puede } from './panelsocio.js';

export function OcultarMods({ it }) {
  const M = useModsEstado();
  const [r, setR] = useState(null);
  const [paso, setPaso] = useState('');
  const [hecho, setHecho] = useState(0);
  useEffect(() => {
    if (!M.lapices) { setR(null); return undefined; }
    let vivo = true;
    pedirRoles().then((x) => { if (vivo) setR(x || null); });
    return () => { vivo = false; };
  }, [M.lapices]);
  const sv = String((it && it.sv) || '').toUpperCase();
  const id = String((it && it.id) || '');
  if (!M.lapices || !r || !/^[A-Z]{2,6}$/.test(sv) || !/^[0-9a-f]{6,16}$/.test(id)) return null;
  const rol = (r.roles || {})[sv] || (r.dlx ? 'dlx' : r.liga ? 'liga' : '');
  if (!rol || !puede(rol, 'muro', r.permisos)) return null;
  const pedir = (accion) => {
    setPaso('va');
    pedirStaff(sv, 'muro', accion, { pub: id }).then((j) => {
      if (j && j.ok) {
        if (accion === 'ocultar') {
          const t = Date.now();
          anotarMods({ t, que: 'Ocultaste una publicación', donde: 'Publicaciones · ' + sv, ruta: '#/publicaciones', deshacer: { tipo: 'muro', sv, pub: id } });
          setHecho(t); setPaso('oculta');
        } else { if (hecho) deshechaMods(hecho); setHecho(0); setPaso('vuelve'); }
        return;
      }
      setPaso(j && j.error === 'no_es_tuya' ? 'ajena' : 'error');
    }).catch(() => setPaso('error'));
  };
  if (paso === 'oculta') {
    return (
      <p className="om" role="status">✓ Oculta: sale del muro en la próxima vuelta del ciclo.
        <button type="button" className="om-b" onClick={() => pedir('mostrar')}>Deshacer</button></p>
    );
  }
  if (paso === 'vuelve') return <p className="om" role="status">✓ Vuelve a mostrarse en la próxima vuelta del ciclo.</p>;
  if (paso === 'preg' || paso === 'va') {
    return (
      <p className="om">¿Ocultarla del muro?
        <button type="button" className="om-b fuerte" disabled={paso === 'va'} onClick={() => pedir('ocultar')}>{paso === 'va' ? 'Ocultando…' : 'Ocultar'}</button>
        <button type="button" className="om-b" disabled={paso === 'va'} onClick={() => setPaso('')}>No</button></p>
    );
  }
  return (
    <p className="om">
      <button type="button" className="om-b lapiz" onClick={() => setPaso('preg')} aria-label="Ocultar esta publicación (Mods)">✎ Ocultar</button>
      {paso === 'error' ? <span className="om-err">No se pudo: prueba de nuevo.</span> : paso === 'ajena' ? <span className="om-err">Ya no está en el muro de su servidor.</span> : null}
    </p>
  );
}
