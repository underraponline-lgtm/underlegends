// 🎟️ LA PISTA GRANDE DEL PASE (25/10/2026). Dlx: «el track debe ser más visual y emotivo como el de Brawl Stars, o más
// grande». La de la 4.01 eran treinta casillas iguales de 116 px que decían «+150 Puntos de Tienda» casi todas: se leía
// como una tabla, no como un camino. Lo que toma de Brawl:
//   · LAS CASILLAS GRANDES Y UNA BARRA GRUESA QUE SE LLENA de nivel en nivel, con tu cara donde vas.
//   · LOS PREMIOS DE VERDAD SE VEN GRANDES y más anchos que los Puntos: el ritmo «chico, chico, GRANDE» es lo que hace
//     querer llegar. Y se ven CON LO TUYO: tu carta con el marco que vas a ganar, tu nombre en dorado, tu título.
//   · LO SIGUIENTE LATE y lo cobrado lleva su sello.
// Y lo que NO toma (la piel del remake): sin degradés, sin brillos difusos, radios de 4 como mucho, una tinta por pieza.
//
// Dos opciones para que Dlx elija (`?prev=pistaa` / `?prev=pistab`): la A es la pista sola; la B le suma arriba «el
// próximo gran premio», en grande.
import { useEffect, useRef, useState } from 'react';
import { limpio, num } from './liga.js';
import { Cara } from './piezas.jsx';
import { ConMarco } from './marcos.jsx';
import { PaseIcono, premioCorto, premioLargo } from './pase_iconos.jsx';

const metal = (v) => (/oro/i.test(v) ? '#F5C542' : /plata/i.test(v) ? '#C9CDD4' : '#C98A4B');

// 🎨 el dibujo grande de cada premio, con lo tuyo cuando se puede
function Arte({ p, prem, liga, yo, grande }) {
  const [, , tipo, valor] = p;
  const t = grande ? 84 : 52;
  if (prem && tipo === 'marco' && yo) {
    const k = yo.k;
    const cual = (yo.c || []).includes('servidor') ? 'servidor' : (yo.c || []).includes('temporada') ? 'temporada' : '';
    const src = cual ? liga.cartaUrl(k, cual, true) : '';
    const tier = /oro/i.test(valor) ? 'oro' : /plata/i.test(valor) ? 'plata' : 'premium';
    const svc = yo.sv && liga.svs && liga.svs[yo.sv] ? liga.svs[yo.sv].color : '';
    if (src) {
      const ancho = grande ? 108 : 66;
      return (
        <span className="pk-carta" style={{ width: ancho }}>
          <ConMarco m={['t1:' + tier, 'camiseta', 0]} cual={cual} ancho={ancho} svColor={svc} cc={yo.cc}>
            <img src={src} alt="" style={{ width: ancho, display: 'block' }} />
          </ConMarco>
        </span>
      );
    }
  }
  if (!prem && tipo === 'tarjeta' && yo) {
    const src = liga.cartaUrl(yo.k, 'temporada', true);
    if (src) return <img className="pk-carta-img" src={src} alt="" style={{ width: grande ? 96 : 60 }} />;
  }
  if (prem && tipo === 'color' && yo) return <b className="pk-dorado pk-tuyo" style={{ fontSize: grande ? 30 : 20 }}>{limpio(yo.n)}</b>;
  if (!prem && tipo === 'color' && yo) return <b className="pk-dorado" style={{ fontSize: grande ? 30 : 20 }}>{limpio(yo.n)}</b>;
  if (tipo === 'titulo') return <span className={'pk-titulo' + (prem ? ' p' : '')} style={{ fontSize: grande ? 17 : 13 }}>«{valor}»</span>;
  if (!prem && tipo === 'insignia') return <span className="pk-ins" style={{ color: metal(valor) }}><PaseIcono p={p} t={grande ? 96 : 64} /></span>;
  if (prem && tipo === 'reaccion') return <span className="pk-emo" style={{ fontSize: grande ? 64 : 44 }}>{valor}</span>;
  return <PaseIcono p={p} prem={prem} t={t} />;
}

const esHito = (p) => !!(p && p[2]);

function Casilla({ p, prem, est, tiene, tienda, liga, yo }) {
  const esp = esHito(p);
  const bloq = prem && !tiene;
  return (
    <div className={'pk-ti' + (prem ? ' p' : ' g') + (esp ? ' esp' : '') + (est ? ' ' + est : '') + (bloq ? ' bloq' : '')}>
      {est === 'cob' && (!prem || tiene) ? <em className="pk-sello">✓</em> : null}
      {bloq ? <em className="pk-cand" aria-label="premium">🔒</em> : null}
      <span className="pk-arte"><Arte p={p} prem={prem} liga={liga} yo={yo} /></span>
      {esp ? <><b className="pk-q">{premioCorto(p, prem)}</b><small>{premioLargo(p, prem)}</small></>
        : <><b className="pk-q n">+{num(p[1] || tienda)}</b><small>Puntos de Tienda</small></>}
      {/* 🎒 la puerta 3 del Inventario (26/10/2026): lo que ya ganaste y se pone en tu carta, se pone desde acá */}
      {yo && est === 'cob' && (!prem || tiene) && (p[2] === 'marco' || p[2] === 'titulo')
        ? <a className="pk-poner" href={p[2] === 'marco' ? '#/inventario/temporada/marco' : '#/inventario'}>Ponérselo</a> : null}
    </div>
  );
}

// 🏆 OPCIÓN B: el próximo gran premio, en grande, con lo que falta
function Escenario({ libres, prem, nivel, tiene, umbrales, xp, liga, yo, onIr }) {
  let sig = null;
  for (let n = Math.max(1, nivel + 1); n <= libres.length && !sig; n++) {
    const pp = prem[n - 1], pl = libres[n - 1];
    if (esHito(pp) && (tiene || !esHito(pl))) sig = [pp, true];
    else if (esHito(pl)) sig = [pl, false];
  }
  if (!sig) return null;
  const [p, esPrem] = sig;
  const n = p[0];
  const faltaXp = umbrales && umbrales[n - 1] != null && xp != null ? Math.max(0, umbrales[n - 1] - xp) : null;
  const niv = n - nivel;
  return (
    <div className={'pk-esc' + (esPrem ? ' p' : '')}>
      <span className="pk-esc-arte"><Arte p={p} prem={esPrem} liga={liga} yo={yo} grande /></span>
      <div className="pk-esc-tx">
        <span className="pk-esc-t">EL PRÓXIMO GRAN PREMIO · NIVEL {n}{esPrem ? ' · PREMIUM' : ''}</span>
        <b>{premioLargo(p, esPrem)}</b>
        <span className="pk-esc-f">{niv === 1 ? 'Es el nivel que sigue' : 'Te faltan ' + niv + ' niveles'}{faltaXp ? ' · ' + num(faltaXp) + ' XP' : ''}</span>
        {esPrem && !tiene ? <span className="pk-esc-b">Es de la fila premium: se desbloquea con el rol «Pase Premium».</span> : null}
        <button type="button" className="btn verde chico" onClick={() => onIr(n)}>Verlo en la pista</button>
      </div>
    </div>
  );
}

export function PistaGrande({ libres, prem, nivel, tiene, tienda, min, compu, pct = 0, liga, yo, opcion = 'a', umbrales, xp }) {
  const caja = useRef(null);
  const [puntas, setPuntas] = useState([true, false]);
  const medir = () => {
    const el = caja.current;
    if (el) setPuntas([el.scrollLeft < 4, el.scrollLeft + el.clientWidth > el.scrollWidth - 4]);
  };
  const ir = (n, suave) => {
    const el = caja.current;
    const li = el && el.querySelector('[data-n="' + n + '"]');
    if (li) el.scrollTo({ left: Math.max(0, li.offsetLeft - (compu ? 40 : 12)), behavior: suave ? 'smooth' : 'auto' });
  };
  // abre con tu nivel a la vista: en la compu el de antes también, en el teléfono el tuyo primero
  useEffect(() => { ir(Math.max(1, nivel - (compu ? 1 : 0))); medir(); }, [nivel, compu, libres.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { window.addEventListener('resize', medir); return () => window.removeEventListener('resize', medir); }, []);
  // 👆 arrastrar con el mouse, como con el dedo (igual que la pista de la 4.02)
  const arr = useRef(null);
  const baja = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = caja.current;
    if (el) arr.current = { x: e.clientX, s: el.scrollLeft, movio: false, id: e.pointerId };
  };
  const mueve = (e) => {
    const a = arr.current, el = caja.current;
    if (!a || !el) return;
    const dx = e.clientX - a.x;
    if (!a.movio && Math.abs(dx) > 4) { a.movio = true; try { el.setPointerCapture(a.id); } catch (err) { /* nada */ } el.classList.add('arrastra'); }
    if (a.movio) el.scrollLeft = a.s - dx;
  };
  const suelta = () => {
    const a = arr.current, el = caja.current;
    arr.current = null;
    if (el) el.classList.remove('arrastra');
    if (a && a.movio && el) el.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
  };
  if (!libres.length) return null;
  const mover = (k) => { const el = caja.current; if (el) el.scrollBy({ left: k * Math.max(160, el.clientWidth * 0.8), behavior: 'smooth' }); };
  const ult = libres.length;
  return (
    <div className="pk-w">
      {opcion === 'b' ? <Escenario libres={libres} prem={prem} nivel={nivel} tiene={tiene} umbrales={umbrales} xp={xp} liga={liga} yo={yo} onIr={(n) => ir(n, true)} /> : null}
      <div className="pk-cab">
        <span>{nivel ? <>NIVEL <b>{nivel}</b> DE {ult}</> : 'LOS ' + ult + ' NIVELES Y SUS PREMIOS'}</span>
        <div className="pk-flechas">
          {nivel && nivel < ult ? <button type="button" className="pk-irn" onClick={() => ir(nivel + 1, true)}>▶ {nivel + 1}</button> : null}
          <button type="button" onClick={() => mover(-1)} disabled={puntas[0]} aria-label="Niveles anteriores">‹</button>
          <button type="button" onClick={() => mover(1)} disabled={puntas[1]} aria-label="Niveles siguientes">›</button>
        </div>
      </div>
      <div className="pk-pista">
        <div className="pk-filas" aria-hidden="true"><span className="fp">PREMIUM{tiene ? '' : ' 🔒'}</span><span className="fg">GRATIS</span></div>
        <ol className="pk-cols" ref={caja} onScroll={medir} aria-label="Los niveles del Pase y lo que da cada uno"
          onPointerDown={baja} onPointerMove={mueve} onPointerUp={suelta} onPointerCancel={suelta}>
          {libres.map((p) => {
            const n = p[0];
            const est = n <= nivel ? 'cob' : n === nivel + 1 ? 'sgt' : '';
            const pp = prem[n - 1] || [n, tienda, '', ''];
            const ancha = esHito(p) || esHito(pp);
            // la barra: llena hasta tu nivel; en el tuyo, lo que llevas hacia el siguiente
            const lleno = n < nivel ? 100 : n === nivel ? Math.max(6, Math.min(100, pct)) : 0;
            return (
              <li key={n} data-n={n} className={'pk-co' + (ancha ? ' ancha' : '') + (n < nivel ? ' cob' : n === nivel ? ' yo' : '') + (n === nivel + 1 ? ' sgt' : '')}>
                <Casilla p={pp} prem tiene={tiene} est={est} tienda={tienda} liga={liga} yo={yo} />
                <div className="pk-riel">
                  <i className="pk-barra"><u style={{ width: lleno + '%' }} /></i>
                  {n === nivel && yo ? (
                    <span className="pk-tu" title="Vas acá"><Cara liga={liga} k={yo.k} nombre={yo.n} cls="cara pk-tu-c" /><b>{n}</b></span>
                  ) : <span className="pk-n">{n}</span>}
                </div>
                <Casilla p={p} est={est} tienda={tienda} liga={liga} yo={yo} />
              </li>
            );
          })}
        </ol>
      </div>
      {tienda ? (
        <p className="pk-pdt"><b>{num(tienda)} por nivel.</b> Con {Math.ceil(min / tienda)} niveles le pones precio a una cabeza (desde {num(min)}) · con {Math.ceil(2500 / tienda)} armas tu crew ({num(2500)}).</p>
      ) : null}
    </div>
  );
}

