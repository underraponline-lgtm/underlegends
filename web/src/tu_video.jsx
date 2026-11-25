// 🎬 «TU BATALLA YA TIENE VIDEO» (25/11/2026, Dlx: «All of them and specially for #4 you could do a pop up in the website
// as well»). El 42 % juega una sola vez y ahí se pierde: que tu batalla salió en video es una razón directa para volver.
// Al entrar, si sales en un short de los últimos 7 días que todavía no te mostramos, sale esta ventana una vez, con la
// portada y «Verlo» / «Compartir». Lo mismo le llega a la campana y a tu bandeja (`tusVideos()` de bot/avisos.js).
//
// ⚠️ DE DÓNDE: los shorts del muro (`/api/muro`, que App.jsx ya pide), tipo `short`, con las claves de quienes salen (`ks`,
// `con_claves()` de bot/muro.py). Por clave y no por nombre: a dos «Sol» los separa la clave.
// ⚠️ SÓLO CON «ENTRAR CON DISCORD» (`yo.dc`): con un «quién soy» elegido a mano no se sabe si de verdad sos vos.
// ⚠️ LO YA MOSTRADO se guarda en `lg:tuvideo-visto`. ⏳ VA A SEGUIR A TU CUENTA (`UI_CLAVES` de bot/avisos.js ya la tiene)
// cuando se despliegue el Worker: recién ahí se suma a `REGLAS` de web/src/sync_cuenta.js (`unionReciente(300)`) y se saca de
// `ESPERAN` en bot/avisos_prueba.mjs. Antes no: el objeto de hoy rechazaría el envío entero y nadie sincronizaría nada.
// ⚠️ NUNCA ENCIMA DE OTRA COSA: ni con la pantalla de carga, ni con la bienvenida, ni con otra ventana abierta (el
// tutorial, el «¡Subiste!» del Pase, una historia o una carta: lo mismo que mira el tutorial), ni en la página de Videos
// (ya estás ahí). Espera y vuelve a mirar.
import { useEffect, useRef, useState } from 'react';
import { useTapado } from './anima.js';

const CLAVE = 'lg:tuvideo-visto';
const DIAS = 7;
const RONDA = { octavos: 'Octavos', cuartos: 'Cuartos', semifinales: 'Semifinal', semifinal: 'Semifinal', final: 'Final' };

const leer = () => { try { const v = JSON.parse(localStorage.getItem(CLAVE) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const guardar = (rids) => {
  try {
    const v = leer().filter((x) => !rids.includes(x)).concat(rids).slice(-300);
    localStorage.setItem(CLAVE, JSON.stringify(v));
  } catch (e) { /* sin almacenamiento: puede volver a salir */ }
};

/** Los shorts del muro donde sale `k`, de los últimos 7 días y sin mostrar, del más nuevo al más viejo */
export function tusVideos(muro, k, ahora = Date.now(), vistos = leer()) {
  if (!k || !muro) return [];
  const desde = ahora - DIAS * 86400000;
  return (muro.items || []).filter((x) => x && x.tipo === 'short' && /^ul-[a-z0-9-]{3,60}$/.test(String(x.rid || ''))
    && Array.isArray(x.ks) && x.ks.includes(k) && Date.parse(x.t || '') >= desde && !vistos.includes(x.rid))
    .sort((a, b) => Date.parse(b.t) - Date.parse(a.t));
}

const rivalDe = (x, k) => (x.quien || []).filter((_, i) => (x.ks || [])[i] !== k).filter(Boolean).join(' y ');

export function PopTuVideo({ muro, yo, pagina, ocupado }) {
  const tapado = useTapado();
  const [abierto, setAbierto] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const caja = useRef(null);
  const marca = useRef(null);
  const k = yo && yo.dc ? yo.k : null;

  // 👀 cuando nada más está a la vista: espera 2,5 s después de entrar y, si hay otra ventana abierta, vuelve a mirar
  useEffect(() => {
    if (abierto || !k || !muro || tapado || ocupado || pagina === 'reels') return undefined;
    if (!tusVideos(muro, k).length) return undefined;
    let t = 0;
    const mirar = () => {
      const raiz = marca.current && marca.current.getRootNode ? marca.current.getRootNode() : document;
      const otra = raiz.querySelector && raiz.querySelector('[role="dialog"][aria-modal="true"], dialog[open], .hv-ov, .vc');
      if (otra) { t = setTimeout(mirar, 4000); return; }
      const xs = tusVideos(muro, k);
      if (xs.length) setAbierto(xs);
    };
    t = setTimeout(mirar, 2500);
    return () => clearTimeout(t);
  }, [muro, k, tapado, ocupado, pagina, abierto]);

  // 📱 ya lo viste en otro dispositivo (llega por `lg:ui`, web/src/sync_cuenta.js): se cierra sola
  useEffect(() => {
    if (!abierto) return undefined;
    const f = () => { const v = leer(); if (abierto.every((x) => v.includes(x.rid))) setAbierto(null); };
    window.addEventListener('lg:ui', f);
    return () => window.removeEventListener('lg:ui', f);
  }, [abierto]);

  // el foco entra a la ventana, y Escape la cierra
  useEffect(() => {
    if (!abierto) return undefined;
    const b = caja.current && caja.current.querySelector('.tv-ver');
    if (b) b.focus();
    const tecla = (e) => { if (e.key === 'Escape') cerrar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!abierto) return <span ref={marca} hidden />;
  const x = abierto[0];
  const mas = abierto.length - 1;
  const url = 'https://underlegends.pages.dev/freestyle-rap/videos/' + x.rid;
  const rival = rivalDe(x, k);
  const ronda = RONDA[String(x.ronda || '').toLowerCase()] || '';
  const cerrar = () => { guardar(abierto.map((y) => y.rid)); setAbierto(null); };
  const compartir = async () => {
    const texto = 'Mi batalla' + (x.ev ? ' en ' + x.ev : '') + (rival ? ' contra ' + rival : '');
    try {
      if (navigator.share) { await navigator.share({ title: texto, text: texto, url }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2200); } catch (e) { /* sin portapapeles */ }
  };
  return (
    <div className="tv-velo" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
      <div className="tv-pop" role="dialog" aria-modal="true" aria-labelledby="tv-pop-t" ref={caja}>
        <a className="tv-portada" href={'#/videos/' + x.rid} onClick={cerrar} aria-label="Ver el video">
          {x.portada ? <img src={x.portada} alt="" width="108" height="192" decoding="async" /> : null}
          <i className="tv-play" aria-hidden="true">▶</i>
        </a>
        <div className="tv-tx">
          <span className="tv-tag">TU VIDEO</span>
          <h2 id="tv-pop-t">Tu batalla ya tiene video</h2>
          <p className="tv-de">{[x.ev, ronda, rival ? 'contra ' + rival : ''].filter(Boolean).join(' · ')}</p>
          <p className="tv-mas">{mas > 0 ? (mas === 1 ? 'Y tienes 1 video más en Videos.' : 'Y tienes ' + mas + ' videos más en Videos.') : 'Compártelo: es tu batalla.'}</p>
          <div className="tv-bts">
            <a className="btn verde tv-ver" href={'#/videos/' + x.rid} onClick={cerrar}>Verlo</a>
            <button type="button" className="btn borde2 tv-comp" onClick={compartir}>{copiado ? 'Link copiado' : 'Compartir'}</button>
            <button type="button" className="tv-luego" onClick={cerrar}>Después</button>
          </div>
        </div>
      </div>
    </div>
  );
}
