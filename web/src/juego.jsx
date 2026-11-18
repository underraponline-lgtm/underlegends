// 🎭 TU ESTILO DE JUEGO, en el Inventario (16/11/2026).
//
// Dlx: «mi idea era implementar los playstyles a la competitiva»; «la primera lo puedes elegir desde la página»; a si se
// cambia: «una vez por temporada… si eliges una nueva empieza desde 0, pero tienes el playstyle desbloqueado»; y a mis
// sugerencias (mostrar cuántos tienen cada uno, que se vea para todos), «como tú decidas».
//   · 18 estilos en tres familias, cada una con su FORMA: ATAQUE rombo · FOCO círculo · CABEZA escudo. El catálogo sale de
//     `02_Competitivo/v2/estilos_juego.py --web` (`estilos_juego.json`), el mismo que dibuja la carta.
//   · La primera vez eliges libre; después, UN cambio por temporada. El que dejas queda desbloqueado (en nivel 0). Lo
//     cuenta el objeto (`juegoElige()` en bot/avisos.js), no esta página.
//   · El 2.º y el 3.º se ganan en los eventos de estilo de DRA (Dlx, 17/11/2026: «que el segundo y tercero se ganen por
//     un evento específico en DRA y ya está»): jugar uno de un estilo que no es el tuyo te lo desbloquea.
//   · Va en tu carta Competitiva (la columna izquierda) con la próxima corrida del ciclo; sin Competitiva, en tu perfil.
//
// 🎮 EL REMAKE, OPCIÓN B «SELECCIÓN DE PERSONAJE» (Dlx, 17/11/2026: «esta página remakeala porque es la más rara de todas
// en gris encima y con espacios blancos», y a la maqueta https://claude.ai/artifact/AN9LH6DVdYantMXLm39rFZ, «B pero fíjate
// bien el estilo del diseño de la página web en general»):
//   · arriba, el estilo en grande sobre el negro de la página, con su nombre gigante y tenue detrás (como «TAG» en
//     Cartas) y un halo del color de tu rango; tocas uno abajo y lo ves ahí, con el botón
//   · al costado, TUS TRES LUGARES con su nivel (los deja el ciclo en el objeto: `juegosCiclo()`, `lugares` y `niveles`)
//   · la grilla entera: tres filas de seis, una por familia, a todo el ancho (antes, seis cuadros de 124 px y un tercio vacío)
//   · al pie, cómo se sube y el próximo evento de estilo de DRA (`je` del calendario)
//   · sin el panel gris que la envolvía: va directo sobre el negro, como el escenario de Cartas
import { useEffect, useRef, useState } from 'react';
import CAT from './estilos_juego.json';
import { pasePost } from './pase.js';
import { limpio, siglaDe, utc } from './liga.js';

const FAMILIA = {
  ATAQUE: ['Ataque', 'lo que le hace al rival y al público'],
  FOCO: ['Foco', 'el medio campo: cómo suena cada barra'],
  CABEZA: ['Cabeza', 'lo que lee, piensa y contesta'],
};
const FORMA_NOMBRE = { rombo: 'Rombo', circulo: 'Círculo', escudo: 'Escudo' };
const FORMA_DE = Object.fromEntries(CAT.familias);
const ESTILO = Object.fromEntries(CAT.estilos.map(([k, n, f, d, ic]) => [k, { k, n, f, d, ic }]));
const OSC = 'rgba(10,10,18,.94)';
const BLANCO = '#F4F4F6';

/** Un estilo dibujado como en la carta: la forma de su familia y el nivel por luz y aros. `c` es el color */
export function Insignia({ k, nivel = 1, tam = 52, c = BLANCO }) {
  const e = ESTILO[k];
  if (!e) return null;
  const forma = FORMA_DE[e.f];
  const d = CAT.formas[forma];
  const m = CAT.margen;
  const j = { strokeLinejoin: 'round' };
  let cuerpo, op = 1, col = '#fff';
  if (nivel === 0) {
    cuerpo = <path d={d} fill="rgba(8,8,14,.55)" stroke={c} strokeOpacity=".6" strokeWidth="4" strokeDasharray="7 6" {...j} />;
    op = 0.45;
  } else if (nivel === 1) {
    cuerpo = <path d={d} fill="#15151F" stroke={c} strokeWidth="5" {...j} />;
  } else if (nivel === 2) {
    cuerpo = (<>
      <path d={d} fill="none" stroke={c} strokeWidth="14" {...j} /><path d={d} fill="none" stroke={OSC} strokeWidth="8" {...j} />
      <path d={d} fill="#15151F" /><path d={d} fill={c} fillOpacity=".42" stroke={c} strokeWidth="5" {...j} />
    </>);
  } else {
    cuerpo = (<>
      <path d={d} fill="none" stroke={c} strokeWidth="24" {...j} /><path d={d} fill="none" stroke={OSC} strokeWidth="18" {...j} />
      <path d={d} fill="none" stroke="#fff" strokeWidth="14" {...j} /><path d={d} fill="none" stroke={OSC} strokeWidth="8" {...j} />
      <path d={d} fill={c} stroke="#fff" strokeWidth="5" {...j} />
    </>);
    col = '#0b0b12';
  }
  const L = tam / (1 + (2 * m) / 100);            // el lado del viewBox de 100, dentro de la caja con margen
  const s = (CAT.ico[forma] * L) / 100;
  const cx = ((50 + m) * L) / 100, cy = ((CAT.ico_y[forma] + m) * L) / 100;
  return (
    <span className="jg-ins" style={{ width: tam, height: tam }} aria-hidden="true">
      <svg viewBox={`-${m} -${m} ${100 + 2 * m} ${100 + 2 * m}`}>{cuerpo}</svg>
      <i style={{ left: cx - s / 2, top: cy - s / 2, width: s, height: s, opacity: op, background: col,
        WebkitMaskImage: `url(${e.ic})`, maskImage: `url(${e.ic})` }} />
    </span>
  );
}

/** Un lugar vacío: la forma punteada y el signo de pregunta */
function Vacio({ tam = 46 }) {
  const m = CAT.margen;
  return (
    <span className="jg-ins jg-vac" style={{ width: tam, height: tam }} aria-hidden="true">
      <svg viewBox={`-${m} -${m} ${100 + 2 * m} ${100 + 2 * m}`}><path d={CAT.formas.circulo} fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="7 6" /></svg>
      <b>?</b>
    </span>
  );
}

const ERROR = {
  ya: 'Ya usaste tu cambio de esta temporada: el próximo, cuando arranque la que viene.',
  sin_verificar: 'Para elegir tu estilo tienes que estar verificado (Miembro de DRA).',
};
const cuantosTxt = (n) => (n ? n + (n === 1 ? ' lo eligió' : ' lo eligieron') : 'Nadie lo eligió todavía');
// en el cuadro, corto: «Nadie lo eligió todavía» ocupaba dos renglones apretados en el celular
const cuantosCorto = (n) => (n ? n + (n === 1 ? ' lo eligió' : ' lo eligieron') : 'Sin elegir');
// la escalera: qué es cada nivel
const ESCALERA = [
  ['Desbloqueado', 'Lo dejaste, o recién lo eliges'],
  ['Jugaste uno', 'Un evento de ese estilo'],
  ['Cuarto de arriba', 'En un evento de ese estilo'],
  ['Otra vez arriba', 'El tope. Vuelve a 0 cada temporada'],
];

export default function EstiloJuego({ liga, dc, k, Cuadro, Titulo }) {
  const [d, setD] = useState(undefined);
  const [sel, setSel] = useState('');
  const [conf, setConf] = useState(false);
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const heroR = useRef(null);
  useEffect(() => {
    pasePost('juego-mio', {}).then((r) => setD(r && r._ok ? r : null));
  }, []);

  if (d === undefined) return <p className="ves-nota">Cargando tus estilos…</p>;
  const verificado = !!(dc && dc.clave) || !!(d && d.dueno);
  const mio = (d && d.juego) || '';
  const viejos = new Set((d && d.viejos) || []);
  const cuantos = (d && d.cuantos) || {};
  const niveles = (d && d.niveles) || {};
  // 🎭 tus tres lugares (el ciclo los deja en el objeto). El 1.º es SIEMPRE el elegido de hoy: si recién lo cambiaste, el
  // ciclo todavía no lo vio y va en el nivel que tenga (0 si es nuevo)
  const ganados = ((d && d.lugares) || []).filter((x) => x[0] !== mio && ESTILO[x[0]]).slice(0, 2);
  const nivelDe = (x) => (x === mio ? (niveles[x] || 0) : ganados.find((g) => g[0] === x) ? ganados.find((g) => g[0] === x)[1] : (niveles[x] || 0));
  const tiene = (x) => x === mio || ganados.some((g) => g[0] === x) || viejos.has(x) || x in niveles;
  const f = liga && k ? liga.T[k] : null;
  const rg = f && f.rg && liga ? liga.colorRg(f.rg) : BLANCO;
  const e = ESTILO[sel] || ESTILO[mio] || ESTILO.punchline;
  const nv = tiene(e.k) ? nivelDe(e.k) : 1;

  // 📅 el próximo evento de estilo: primero uno del estilo que estás mirando, si no cualquiera
  const ahora = liga ? liga.ahora : Date.now();
  const prox = ((liga && liga.d && liga.d.calendario) || []).filter((c) => c.je && utc(c.t) > ahora).sort((a, b) => utc(a.t) - utc(b.t));
  const px = prox.find((c) => limpio(c.je).toLowerCase() === e.n.toLowerCase()) || prox[0] || null;

  const tocar = (x) => {
    setSel(x);
    setConf(false);
    setMsg('');
    // 📱 en el celular la grilla queda lejos del estilo grande: se sube a verlo
    const h = heroR.current;
    if (h && h.getBoundingClientRect().top < 0) {
      const quieto = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      h.scrollIntoView({ block: 'start', behavior: quieto ? 'auto' : 'smooth' });
    }
  };
  const elegir = () => {
    if (!sel || ocup) return;
    setOcup(true);
    pasePost('juego-elige', { juego: sel }).then((r) => {
      setOcup(false);
      setConf(false);
      if (r && r._ok) {
        setD(r);
        setMsg('Listo: tu estilo es ' + ESTILO[sel].n + '. Tu carta Competitiva lo muestra con la próxima corrida del ciclo.');
      } else {
        setMsg(ERROR[r && r.error] || 'No se pudo guardar. Prueba de nuevo en un rato.');
      }
    });
  };

  let accion = null;
  if (d && verificado && e.k !== mio) {
    if (conf) {
      accion = (
        <div className="jg-conf">
          <p>{mio ? <>Cambias <b>{ESTILO[mio].n}</b> por <b>{e.n}</b>. Es tu único cambio de la temporada; <b>{ESTILO[mio].n}</b> queda desbloqueado, en nivel 0.</>
            : <>Tu estilo va a ser <b>{e.n}</b>. Después lo puedes cambiar una vez por temporada.</>}</p>
          <button type="button" className="ves-btn" disabled={ocup} onClick={() => setConf(false)}>Cancelar</button>
          <button type="button" className="ves-btn blanco" disabled={ocup} onClick={elegir}>{ocup ? 'Guardando…' : 'Confirmar'}</button>
        </div>
      );
    } else if (d.puede) {
      accion = <button type="button" className="ves-btn blanco" onClick={() => { setSel(e.k); setConf(true); }}>{mio ? 'Cambiar a ' + e.n : 'Elegir ' + e.n}</button>;
    } else {
      accion = <p className="ves-nota">{ERROR.ya}</p>;
    }
  } else if (e.k === mio) {
    accion = <span className="jg-es">Es tu estilo</span>;
  }

  const lugar = (n, de, x, nivel, pie) => (
    <li key={n} className={x ? '' : 'vac'}>
      <span className="jg-lg-n">{n}</span>
      {x ? <Insignia k={x} nivel={nivel} tam={46} c={rg} /> : <Vacio />}
      <span><em>{de}{x ? ' · nivel ' + nivel : ' · libre'}</em><b style={{ '--n': Math.max(8, (x ? ESTILO[x].n : 'Sin estilo').length) }}>{x ? ESTILO[x].n : 'Sin estilo'}</b><small>{pie}</small></span>
    </li>
  );

  return (
    <div className="jg">
      {d === null ? <p className="ves-nota">Todavía no se puede elegir: se habilita en unas horas.</p> : null}
      {d && !verificado ? <p className="ves-nota">{ERROR.sin_verificar}</p> : null}
      {msg ? <p className="ves-msg" role="status">{msg}</p> : null}

      {/* 🎮 el estilo en grande, y al costado tus tres lugares */}
      <section className="jg-hero" ref={heroR} data-fondo={e.n} style={{ '--rg': rg }} aria-live="polite">
        <div className="jg-sel">
          <Insignia k={e.k} nivel={nv} tam={typeof window !== 'undefined' && window.innerWidth < 760 ? 92 : 132} c={rg} />
          <div className="jg-sel-t">
            <em>{FAMILIA[e.f][0]} · {cuantosTxt(cuantos[e.k] || 0)}</em>
            {/* 📏 el tamaño sale del largo del nombre: «Showman» se partía en «SHOWMA / N» en el celular */}
            <b style={{ '--n': Math.max(7, e.n.length) }}>{e.n}</b>
            <p>{e.d}</p>
            {accion}
          </div>
        </div>
        <aside className="jg-lug" aria-label="Tus tres lugares">
          <span className="jg-rk">Tus tres lugares</span>
          <ol>
            {lugar(1, 'Elegido', mio, mio ? nivelDe(mio) : 0, mio ? 'Lo cambias una vez por temporada' : 'Elige uno abajo: la primera vez es libre')}
            {lugar(2, 'DRA', ganados[0] ? ganados[0][0] : '', ganados[0] ? ganados[0][1] : 0, ganados[0] ? 'Ganado en un evento de estilo' : 'Juega un evento de estilo de DRA de otro estilo')}
            {lugar(3, 'DRA', ganados[1] ? ganados[1][0] : '', ganados[1] ? ganados[1][1] : 0, ganados[1] ? 'Ganado en un evento de estilo' : 'Van los dos de nivel más alto')}
          </ol>
          {mio && d ? <span className={'jg-pill' + (d.puede ? '' : ' gris')}>{d.puede ? '✓ Tienes tu cambio de esta temporada' : 'Ya usaste tu cambio de esta temporada'}</span> : null}
          <p className="ves-nota">Van en la columna izquierda de tu carta Competitiva. La forma es la familia; el color, el de tu rango.</p>
        </aside>
      </section>

      {/* 🗂️ la grilla entera: una fila por familia, seis estilos a todo el ancho */}
      <div className="jg-grilla">
        {CAT.familias.map(([fam, forma]) => (
          <div key={fam} className="jg-fila">
            <h4><b>{FAMILIA[fam][0]}</b><small>{FORMA_NOMBRE[forma]} · {FAMILIA[fam][1]}</small></h4>
            <div className="ves-grid jg-6" role="radiogroup" aria-label={'Estilos de ' + FAMILIA[fam][0]}>
              {CAT.estilos.filter((x) => x[2] === fam).map(([x, n]) => {
                const g = ganados.findIndex((y) => y[0] === x);
                return (
                  <Cuadro key={x} on={e.k === x && (sel === x || (!sel && x === mio))} puesto={mio === x} nombre={n}
                    rar={mio === x ? 'Tu estilo' : g >= 0 ? 'Lugar ' + (g + 2) : viejos.has(x) ? 'Desbloqueado' : cuantosCorto(cuantos[x] || 0)}
                    onClick={() => tocar(x)}>
                    {/* todos como nivel 1: el nivel es de lo que jugaste, no de esta grilla. Lo tuyo lo dice «Puesto» */}
                    <Insignia k={x} nivel={1} tam={58} />
                  </Cuadro>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 🪜 cómo se sube, con el estilo que estás mirando, y el próximo evento de estilo */}
      <div className="jg-pie">
        <section>
          <Titulo extra={<small className="ves-de">vuelven a 0 cada temporada</small>}>Cómo se sube</Titulo>
          <ol className="jg-esc">
            {ESCALERA.map(([t, s], n) => (
              <li key={n} className={tiene(e.k) ? (n === nv ? 'on' : n < nv ? 'ya' : '') : ''}>
                <Insignia k={e.k} nivel={n} tam={44} c={rg} />
                <b>Nivel {n}</b><span>{t}</span><small>{s}</small>
              </li>
            ))}
          </ol>
        </section>
        <section className="jg-px">
          <span className="jg-rk">Próximo evento de estilo</span>
          {px ? (<>
            <b>{limpio(px.n)}</b>
            <span>{limpio(px.je)} · {siglaDe(px.sv)} · {liga.dia(px.t)}</span>
            <a className="ves-btn" href="#/eventos">Ver en Eventos</a>
          </>) : (<>
            <b>Todavía no hay uno anunciado</b>
            <span>Cuando DRA anuncie un evento de estilo, aparece acá. Jugarlo es como subes de nivel o ganas tu 2.º y 3.º lugar.</span>
          </>)}
        </section>
      </div>
    </div>
  );
}
