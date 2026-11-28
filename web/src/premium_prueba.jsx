// 🎁 LA PRUEBA DEL PASE PREMIUM, en la sección Premium del Pase (28/11/2026).
//
// Dlx: «Un free trial que necesitas verificarte con la cuenta de Discord primero». 14 días, una vez por cuenta. El objeto
// decide si se puede (`out.prueba` de `paseDe()`, ver bot/premium_regalos.js) y la reclama (`/api/avisos/premium-prueba`
// con `si`). Con la prueba activa, `P.premium` llega con `hasta: null` (la página ya lo trata como Premium) y `prueba`:
// cuándo termina. La bienvenida de DRA («🎁 Reclamar premio») trae a la gente acá: /freestyle-rap/pase/premium.
import { useState } from 'react';
import { accion } from './piezas.jsx';
import { pasePost, pedirPase } from './pase.js';

const DIA = 24 * 3600 * 1000;
const fecha = (t) => new Intl.DateTimeFormat('es', { timeZone: 'America/New_York', day: 'numeric', month: 'long' }).format(new Date(t));
const MAL = {
  verificar: 'Primero verifícate con tu cuenta de Discord.', usada: 'Ya usaste tu prueba.', ya_premium: 'Ya tienes el Premium.',
  ya_tuviste: 'Ya tuviste el Premium esta temporada.', sin_temporada: 'El Pase todavía no arrancó: prueba en un rato.',
  cuenta: 'Entra con Discord para reclamarla.',
};

export function PruebaPremium({ dc, P, ahora = Date.now() }) {
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const e = P && P.prueba;
  const dias = (e && e.dias) || 14;
  const activa = P && P.premium && P.premium.prueba;
  if (!dc) {
    return (
      <section className="ps-tuyo ps-prueba" data-prueba="entrar">
        <span className="ps-tag2">🎁 GRATIS</span>
        <b>Prueba el Premium {dias} días</b>
        <p>Entra con Discord y, si estás verificado, el Pase Premium es tuyo por {dias} días. Una vez por cuenta.</p>
        <span className="pc-acc"><button type="button" className="btn verde" onClick={accion.entrar}>Entrar con Discord</button></span>
      </section>
    );
  }
  if (activa) {
    const quedan = Math.max(0, Math.ceil((activa - ahora) / DIA));
    return (
      <section className="ps-tuyo ps-prueba" data-prueba="activa">
        <span className="ps-tag2">🎁 PRUEBA</span>
        <b>{quedan <= 1 ? 'Tu prueba termina mañana' : 'Te quedan ' + quedan + ' días de prueba'}</b>
        <p>Tienes el Pase Premium hasta el <b>{fecha(activa)}</b>. Lo que cobres de la fila premium es tuyo para siempre.</p>
      </section>
    );
  }
  if (!e || e.por === 'ya_premium' || e.por === 'ya_tuviste' || e.por === 'sin_temporada') return null;
  if (e.por === 'usada') return <p className="ps-sub" data-prueba="usada">🎁 Ya usaste tu prueba de {dias} días del Premium.</p>;
  if (e.por === 'verificar') {
    return (
      <section className="ps-tuyo ps-prueba" data-prueba="verificar">
        <span className="ps-tag2">🎁 GRATIS</span>
        <b>{dias} días de Premium, al verificarte</b>
        <p>La prueba es para los verificados: verifícate en <b>#verificate-aqui</b> de DRA o desde la página, y vuelve acá.</p>
        <span className="pc-acc"><a className="btn verde" href={e.verificar || '#/cuenta/verificar'}>Cómo verificarme</a></span>
      </section>
    );
  }
  if (!e.puede) return null;
  const reclamar = async () => {
    setOcup(true); setMsg('');
    const r = await pasePost('premium-prueba', { si: true });
    setOcup(false);
    if (r && r._ok && r.ok) { pedirPase(); return; }
    setMsg((r && MAL[r.error]) || 'No se pudo: prueba de nuevo.');
    if (r && r.error) pedirPase();
  };
  return (
    <section className="ps-tuyo ps-prueba" data-prueba="puede">
      <span className="ps-tag2">🎁 GRATIS</span>
      <b>Prueba el Premium {dias} días</b>
      <p>Te da +XP en tus Tareas y cobras ya la fila premium de los niveles que pasaste. Es una vez por cuenta.</p>
      <span className="pc-acc"><button type="button" className="btn verde" disabled={ocup} onClick={reclamar}>{ocup ? 'Activando…' : '🎁 Probar ' + dias + ' días gratis'}</button></span>
      {msg ? <p className="ps-mal" role="alert">{msg}</p> : null}
    </section>
  );
}
