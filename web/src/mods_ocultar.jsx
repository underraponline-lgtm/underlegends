// ✎ OCULTAR UNA PUBLICACIÓN CON LOS LÁPICES DE MODS (20/11/2026, la página Mods, tanda 3). Lo mismo que el staff de un
// servidor ya podía hacer desde su panel (`socioStaff()` de bot/avisos.js, `que: 'muro'`), desde la publicación misma: Dlx
// en cualquier servidor, y los Admin y Moderadores de la página (`liga`). Sólo las de un servidor (`it.sv`): las de toda
// la Liga no tienen a quién pertenecer. La saca del muro el ciclo en la próxima vuelta (`bot/muro.py`, `MS.ocultos()`), y
// queda en «Lo que hiciste con Mods» con su Deshacer
//
// 📌 Y FIJARLA ARRIBA (20/11/2026, lo que quedaba de Mods): Dlx y los Admin y Moderadores de la página, cualquier
// publicación, también las de toda la Liga. Una sola a la vez, por 3 días o hasta que se suelte (`modsFijar()`); el ciclo
// la pone de titular en la edición del día (`bot/muro.py`, `MS.fijo()`). `fijo` es la que está fijada hoy (`liga.muroFijo`)
import { useEffect, useState } from 'react';
import { anotarMods, deshechaMods, useModsEstado } from './mods.js';
import { pedirMods, pedirRoles, pedirStaff, puede } from './panelsocio.js';

export function OcultarMods({ it, fijo = '' }) {
  const M = useModsEstado();
  const [r, setR] = useState(null);
  const [paso, setPaso] = useState('');
  const [hecho, setHecho] = useState(0);
  const [pin, setPin] = useState('');
  useEffect(() => {
    if (!M.lapices) { setR(null); return undefined; }
    let vivo = true;
    pedirRoles().then((x) => { if (vivo) setR(x || null); });
    return () => { vivo = false; };
  }, [M.lapices]);
  const sv = String((it && it.sv) || '').toUpperCase();
  const id = String((it && it.id) || '');
  if (!M.lapices || !r || !/^[0-9a-f]{6,16}$/.test(id)) return null;
  const rol = /^[A-Z]{2,6}$/.test(sv) ? (r.roles || {})[sv] || (r.dlx ? 'dlx' : r.liga ? 'liga' : '') : '';
  const ocultar = !!rol && puede(rol, 'muro', r.permisos);
  const fijar = !!(r.dlx || r.liga);
  if (!ocultar && !fijar) return null;
  const esFija = pin ? pin === 'si' : fijo === id;
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
  const fijarla = (accion) => {
    setPaso('va');
    pedirMods('fijar', accion, accion === 'fijar' ? { pub: id } : {}).then((j) => {
      if (j && j.ok) {
        if (accion === 'fijar') {
          anotarMods({ t: Date.now(), que: 'Fijaste una publicación arriba', donde: 'Publicaciones', ruta: '#/publicaciones', deshacer: { tipo: 'fijar' } });
          setPin('si'); setPaso('fijada');
        } else { setPin('no'); setPaso('suelta'); }
        return;
      }
      setPaso(j && j.error === 'no_esta' ? 'ajena' : 'error');
    }).catch(() => setPaso('error'));
  };
  if (paso === 'oculta') {
    return (
      <p className="om" role="status">✓ Oculta: sale del muro en la próxima vuelta del ciclo.
        <button type="button" className="om-b" onClick={() => pedir('mostrar')}>Deshacer</button></p>
    );
  }
  if (paso === 'vuelve') return <p className="om" role="status">✓ Vuelve a mostrarse en la próxima vuelta del ciclo.</p>;
  if (paso === 'preg' || (paso === 'va' && !fijar)) {
    return (
      <p className="om">¿Ocultarla del muro?
        <button type="button" className="om-b fuerte" disabled={paso === 'va'} onClick={() => pedir('ocultar')}>{paso === 'va' ? 'Ocultando…' : 'Ocultar'}</button>
        <button type="button" className="om-b" disabled={paso === 'va'} onClick={() => setPaso('')}>No</button></p>
    );
  }
  return (
    <p className="om">
      {ocultar ? <button type="button" className="om-b lapiz" disabled={paso === 'va'} onClick={() => setPaso('preg')} aria-label="Ocultar esta publicación (Mods)">✎ Ocultar</button> : null}
      {fijar ? (esFija
        ? <button type="button" className="om-b lapiz" disabled={paso === 'va'} onClick={() => fijarla('soltar')} aria-label="Soltar esta publicación de arriba (Mods)">📌 Soltar</button>
        : <button type="button" className="om-b lapiz" disabled={paso === 'va'} onClick={() => fijarla('fijar')} aria-label="Fijar esta publicación arriba (Mods)">📌 Fijar arriba</button>) : null}
      {paso === 'fijada' ? <span className="md-qe-ok" role="status">✓ Fijada: sale de titular en la próxima vuelta del ciclo, por 3 días.</span>
        : paso === 'suelta' ? <span className="md-qe-ok" role="status">✓ Suelta: deja de ir arriba en la próxima vuelta del ciclo.</span>
          : paso === 'error' ? <span className="om-err">No se pudo: prueba de nuevo.</span>
            : paso === 'ajena' ? <span className="om-err">Ya no está en el muro.</span> : null}
    </p>
  );
}
