// 📬 «AVISARME TAMBIÉN EN DISCORD» (28/11/2026, paso 9): el interruptor del buzón en hilos privados de DRA, en
// Ajustes → Avisos. El buzón no tiene avisos propios: lleva a un hilo privado de #conversacion lo mismo que ya está en
// tu campana (ver bot/buzon.js). Acá sólo se prende o se apaga; lo guarda el objeto (`buzon_no`), así vale en todos tus
// dispositivos y en el botón «No me avises más» del hilo.
// ⚠️ Por `/api/avisos/bandeja` con `buzon` (true · false · 'ver'): sin ruta nueva en el Worker de la página.
// ⚠️ Sin sesión no se dibuja (sin dato no hay pieza); con el buzón apagado de nuestro lado (`encendido: false`), dice
// que todavía no arranca en vez de un interruptor que no hace nada.
import { useEffect, useState } from 'react';

const W = typeof window !== 'undefined' ? window : {};
const pedir = (buzon) => (W.pedirConCuenta ? W.pedirConCuenta('/api/avisos/bandeja', { buzon }, false) : Promise.resolve(null));

export function ParteBuzon({ Caja, dc }) {
  const [e, setE] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    let vivo = true;
    if (dc && dc.id) pedir('ver').then((j) => { if (vivo && j && j.ok && j.buzon) setE(j.buzon); }).catch(() => {});
    return () => { vivo = false; };
  }, [dc && dc.id]);
  if (!dc || !dc.id || !e) return null;
  const poner = (si) => {
    setOcupado(true);
    pedir(si).then((j) => { if (j && j.ok && j.buzon) setE(j.buzon); }).catch(() => {}).finally(() => setOcupado(false));
  };
  return (
    <Caja t="En Discord" d={e.encendido
      ? 'Lo de tu campana —tus drops, tu tarjeta, tu rango, una batalla libre— te llega también en un hilo privado de DRA, sin mensajes directos. Uno por día como mucho, y se borra solo a las 48 horas.'
      : 'Pronto: lo de tu campana te va a llegar también en un hilo privado de DRA, sin mensajes directos. Puedes dejarlo apagado desde ya.'}>
      <label className="cu-sw"><span><b>Avisarme en un hilo de DRA</b></span>
        <input type="checkbox" checked={!!e.si} disabled={ocupado} onChange={(x) => poner(x.target.checked)} /><i aria-hidden="true" /></label>
    </Caja>
  );
}
