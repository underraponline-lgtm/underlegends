// 🐉 EL DROP DEL DÍA (15/11/2026). Dlx: «¿y si ponemos un Star Dragon aquí cada día? para que la gente chequee esto», y a
// las dos preguntas, «Drop diario, Star el 7.º» y «Los de DRA, como el Pase». Va en la portada del Pase, donde estaba «lo
// próximo» (que pasó a la línea de la barra de XP). Un Dragón Drop común por día y el domingo, si abriste de lunes a
// sábado, un Star Dragon. La cuenta y la suerte las decide el servidor (`paseDiaAbrir()` en bot/avisos.js): acá se pide,
// se anima mientras contesta y se muestra lo que salió. Es el mismo drop de siempre: queda también en tus Dragón Drops.
import { useEffect, useRef, useState } from 'react';
import { num } from './liga.js';
import { accion } from './piezas.jsx';
import { pedirPase } from './pase.js';
import { abrirConEscenario, dropQuietoSvg, pedirDrops } from './drops.jsx';

const W = typeof window !== 'undefined' ? window : {};
const DIAS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

function reloj(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n) => String(n).padStart(2, '0');
  return p(Math.floor(s / 3600)) + ':' + p(Math.floor((s % 3600) / 60)) + ':' + p(s % 60);
}

function useSegundo(activo) {
  const [t, setT] = useState(Date.now());
  useEffect(() => {
    if (!activo) return undefined;
    const i = setInterval(() => setT(Date.now()), 1000);
    return () => clearInterval(i);
  }, [activo]);
  return t;
}

/** 🐉 El Dragón Drop de verdad, quieto (el casete o la escama del escenario de los drops, `dropQuieto()`): no un dibujo
 *  del Pase. 6.87, Dlx: «eso del huevo no es un drop ni nada porq no incluye la animacion ni nada q deberia tener» */
function DropReal({ tipo, t = 112, gris, an }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let vivo = true;
    dropQuietoSvg(tipo, tipo === 'star' ? 2 : 0).then((x) => { if (vivo) setSvg(x || ''); }).catch(() => {});
    return () => { vivo = false; };
  }, [tipo]);
  return <span className={'dd2-real' + (gris ? ' gris' : '') + (an ? ' an' : '')} style={{ width: t }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** La semana de lunes a domingo: qué días abriste, hoy, y el domingo en dorado (ahí toca el Star) */
function Semana({ d, hoyAbierto }) {
  return (
    <ol className="dd2-sem" aria-label="Tu semana">
      {DIAS.map((t, i) => {
        const ya = d ? !!d.semana[i] || (i === d.i && hoyAbierto) : false;
        const hoy = d && i === d.i;
        const perdido = d && i < d.i && !d.semana[i];
        const tipo = i === 6 ? 'star' : 'drop';
        return (
          <li key={t} className={(ya ? 'ya' : '') + (hoy && !ya ? ' hoy' : '') + (perdido ? ' fue' : '') + (i === 6 ? ' siete' : '')}
            aria-label={t + (ya ? ': abierto' : perdido ? ': no entraste' : hoy ? ': hoy' : '') + (i === 6 ? ', Star Dragon' : '')}>
            <DropReal tipo={tipo} t={22} gris={!ya && !hoy && !(i === 6 && d && d.star_semana)} />{t}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * La tarjeta del drop del día. `P` es tu Pase (con `P.dia` desde el Worker del 15/11), `miembro` si eres de DRA, `dc` si
 * entraste con Discord, `invita` el link a DRA
 */
export function DropDia({ P, miembro, dc, invita }) {
  const d = P && P.dia;
  const [est, setEst] = useState('');     // '' (lo que diga el servidor) · 'abre' · 'sale' · 'mal'
  const [res, setRes] = useState(null);
  const pidiendo = useRef(false);
  const ya = !!(d && d.ya) || !!res;
  const ahora = useSegundo(!!d && ya);
  const star = d ? !!d.star : false;
  // con la vuelta de tu Pase después de abrirlo, `d.ya` queda en true: lo de la pantalla no salta
  useEffect(() => { if (est === 'mal') { const t = setTimeout(() => setEst(''), 4000); return () => clearTimeout(t); } return undefined; }, [est]);
  // 🌙 EL CAMBIO DE DÍA (18/11/2026): nada volvía a pedir el Pase a la medianoche del este, así que con el drop abierto
  // el reloj se quedaba en 00:00:00, sin botón, y el `res` de ayer seguía diciendo «Ya abriste el de hoy» aunque llegara
  // el día nuevo (se podía perder el día, y con él el Star del domingo). Con otro `dia` se olvida lo de ayer, y 5 s
  // después de `fin` se pide el Pase otra vez (una sola: va atado a `fin`, que no cambia si el servidor sigue en el mismo
  // día). Con la pestaña de fondo, espera a que vuelva a verse
  const dia = d ? d.dia : '';
  const fin = d ? d.fin : 0;
  useEffect(() => { setRes(null); setEst(''); }, [dia]);
  useEffect(() => {
    if (!fin) return undefined;
    const doc = W.document;
    const verse = () => { if (doc && !doc.hidden) { doc.removeEventListener('visibilitychange', verse); pedirPase(); } };
    const t = setTimeout(() => {
      if (!doc || !doc.hidden) pedirPase(); else doc.addEventListener('visibilitychange', verse);
    }, Math.max(0, fin - Date.now()) + 5000);
    return () => { clearTimeout(t); if (doc) doc.removeEventListener('visibilitychange', verse); };
  }, [fin]);
  // 🐉 se abre con el escenario de siempre (pantalla completa, a toques): `/pase-dia` lo cobra y lo abre en el mismo
  // pedido y contesta como `drop-abrir`, así que el escenario anima hasta lo que salió
  const abrir = (e) => {
    if (pidiendo.current || !d || d.ya) return;
    pidiendo.current = true;
    setEst('abre');
    let j0 = null;
    const item = { id: 'pdia:' + d.dia, tipo: star ? 'star' : 'drop', min: star ? 2 : 0, origen: (star ? 'star:' : '') + 'pdia:' + d.dia };
    const pedir = () => (W.conCuenta ? W.conCuenta('/api/avisos/pase-dia', {}).catch(() => null) : Promise.resolve(null)).then((j) => { j0 = j; return j; });
    const listo = () => {
      pidiendo.current = false;
      if (j0 && j0.ok) { setRes(j0); setEst(''); } else setEst('mal');
      pedirPase();
      try { pedirDrops(); } catch (er) { /* la lista de drops se pone al día sola */ }
    };
    abrirConEscenario(e.currentTarget, item, pedir, listo).catch(() => { pidiendo.current = false; setEst('mal'); });
  };
  let cuerpo;
  let titulo;
  let boton = null;
  if (!dc || !miembro) {
    titulo = 'Un drop cada día, y el domingo un Star Dragon';
    cuerpo = <span className="dd2-ped"><DropReal tipo="star" t={104} gris /><span className="dd2-cand" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><rect x="5" y="10.5" width="14" height="10" rx="1" /><path d="M8 10.5V7a4 4 0 018 0v3.5" /></svg></span></span>;
    boton = !dc ? <button type="button" className="btn dd2-b" onClick={accion.entrar}>Entrar con Discord</button>
      : invita ? <a className="btn dd2-b" href={invita} target="_blank" rel="noopener noreferrer">Unirme a DRA ↗</a> : null;
  } else if (d && (d.ya || res)) {
    const a = d.abierto || res;
    titulo = 'Ya abriste el de hoy. Vuelve mañana';
    cuerpo = (
      <span className="dd2-ped">
        <DropReal tipo={star ? 'star' : 'drop'} t={84} gris />
        <span className="dd2-reloj">{reloj((d.fin || 0) - ahora)}</span>
      </span>
    );
    boton = a ? <small className="dd2-nota">Hoy te salió {a.nombre}{a.puntos ? ': +' + num(a.puntos) + ' Puntos' : a.titulo ? ': «' + a.titulo + '»' : ''}</small> : null;
  } else if (d) {
    titulo = est === 'mal' ? 'No se pudo abrir: prueba de nuevo' : star ? 'Tu Star Dragon de hoy te espera' : 'Tu drop de hoy te espera';
    cuerpo = (
      <span className="dd2-ped">
        <button type="button" className={'dd2-toca' + (est === 'abre' ? ' dd2-sacude' : '')} onClick={abrir} disabled={est === 'abre'} aria-label={star ? 'Abrir tu Star Dragon' : 'Abrir tu drop'}>
          <DropReal tipo={star ? 'star' : 'drop'} t={124} an={est !== 'abre'} /></button>
      </span>
    );
    boton = <button type="button" className="btn dd2-b" onClick={abrir} disabled={est === 'abre'}>{est === 'abre' ? 'Abriendo…' : star ? 'Abrir mi Star Dragon' : 'Abrir mi drop'}</button>;
  } else return null;
  const seis = d ? d.semana.slice(0, 6).filter(Boolean).length + (d.i < 6 && (d.ya || !!res) && !d.semana[d.i] ? 1 : 0) : 0;
  const top = !d ? 'Lunes a domingo' : d.i === 6 ? (star ? '¡Domingo de Star!' : 'Domingo') : d.star_semana ? 'Día ' + (d.i + 1) + ' de 7 · el domingo, Star' : 'Esta semana ya no hay Star';
  return (
    <section className="dd2" aria-label="El drop del día">
      <i className="dd2-esq a" /><i className="dd2-esq b" />
      <div className="dd2-cab"><span className="k">{star ? 'Star Dragon del día' : 'Drop del día'}</span><span className="k dd2-top">{top}</span></div>
      {cuerpo}
      <b className="dd2-t">{titulo}</b>
      <Semana d={d} hoyAbierto={!!res} />
      {d && d.i < 6 && d.star_semana ? <small className="dd2-nota">Llevas {seis} de 6: abre uno cada día y el domingo sale un Star Dragon (de Vinilo para arriba).</small> : null}
      {boton}
    </section>
  );
}
