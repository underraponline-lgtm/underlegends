// ⭐ CALIFICAR EL EVENTO (20/11/2026, Dlx: «Los que jugaron, 1 a 5», con un Drop básico): en la llave, para quien jugó y
// durante 3 días. Quién puede lo decide el objeto (`calificar()` de bot/avisos.js, con lo que manda el ciclo); acá sólo se
// pregunta y se muestra. Sin cuenta, o si no jugaste, no sale nada.
import { useEffect, useState } from 'react';
import { quienMira } from './liga.js';

async function pedir(cuerpo) {
  try {
    const r = await fetch('/api/avisos/calificar', { method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const j = await r.json().catch(() => ({}));
    return r.ok && !j.error ? j : { error: j.error || 'error' };
  } catch (e) {
    return { error: 'red' };
  }
}

const QUE = ['', 'Flojo', 'Regular', 'Bien', 'Muy bueno', 'Una noche para recordar'];

export default function Calificar({ ev, nombre }) {
  const dc = quienMira().dc;
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState('');
  const [ocup, setOcup] = useState(false);
  useEffect(() => {
    let vivo = true;
    setD(null); setMsg('');
    if (dc && /^\d{1,7}$/.test(String(ev || ''))) pedir({ accion: 'ver', ev: String(ev) }).then((j) => { if (vivo) setD(j); });
    return () => { vivo = false; };
  }, [ev, dc && dc.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d || d.error || !d.puede) return null;
  const poner = async (nota) => {
    setOcup(true); setMsg('');
    const j = await pedir({ ev: String(ev), nota });
    setOcup(false);
    if (j.error) { setMsg(j.error === 'cerrado' ? 'Ya pasaron los 3 días para calificarlo.' : 'No se pudo. Prueba de nuevo.'); return; }
    setD(Object.assign({}, d, { nota: j.nota }));
    setMsg(j.drop ? '¡Gracias! Te ganaste un Drop: lo abres en tu Inventario.' : 'Listo, cambiaste tu nota.');
  };
  return (
    <section className="cal" aria-label={'Califica ' + (nombre || 'este evento')}>
      <div className="cal-t"><b>¿Qué tal estuvo?</b><small>Jugaste este evento: califícalo de 1 a 5{d.nota ? '' : ' y te llevas un Drop'}. Tu nota no la ve nadie: al servidor le llega el promedio.</small></div>
      <div className="cal-e" role="radiogroup" aria-label="Tu nota">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={d.nota === n} disabled={ocup} className={n <= (d.nota || 0) ? 'on' : ''}
            onClick={() => poner(n)} title={QUE[n]}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" /></svg>
            <span className="rk-sr">{n} · {QUE[n]}</span>
          </button>
        ))}
        {d.nota ? <em>{QUE[d.nota]}</em> : null}
      </div>
      {msg ? <p className="cal-m" role="status">{msg}</p> : null}
    </section>
  );
}
