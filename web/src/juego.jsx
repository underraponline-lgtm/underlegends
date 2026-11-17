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
import { useEffect, useState } from 'react';
import CAT from './estilos_juego.json';
import { pasePost } from './pase.js';

const FAMILIA = {
  ATAQUE: ['Ataque', 'lo que le hace al rival y al público'],
  FOCO: ['Foco', 'el medio campo: cómo suena cada barra'],
  CABEZA: ['Cabeza', 'lo que lee, piensa y contesta'],
};
const FORMA_DE = Object.fromEntries(CAT.familias);
const ESTILO = Object.fromEntries(CAT.estilos.map(([k, n, f, d, ic]) => [k, { k, n, f, d, ic }]));
const OSC = 'rgba(10,10,18,.94)';

/** Un estilo dibujado como en la carta: la forma de su familia y el nivel por luz y aros. `c` es el color */
export function Insignia({ k, nivel = 1, tam = 52, c = '#F4F4F6' }) {
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

const ERROR = {
  ya: 'Ya usaste tu cambio de esta temporada: el próximo, cuando arranque la que viene.',
  sin_verificar: 'Para elegir tu estilo tienes que estar verificado (Miembro de DRA).',
};

export default function EstiloJuego({ dc, Cuadro, Titulo }) {
  const [d, setD] = useState(undefined);
  const [sel, setSel] = useState('');
  const [conf, setConf] = useState(false);
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    pasePost('juego-mio', {}).then((r) => setD(r && r._ok ? r : null));
  }, []);

  if (d === undefined) return <p className="ves-nota">Cargando tus estilos…</p>;
  const verificado = !!(dc && dc.clave) || !!(d && d.dueno);
  const mio = (d && d.juego) || '';
  const viejos = new Set((d && d.viejos) || []);
  const cuantos = (d && d.cuantos) || {};
  const e = ESTILO[sel] || ESTILO[mio] || null;

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

  return (
    <div className="jg">
      <p className="ves-p">
        Tu <b>estilo de juego</b> va en la columna izquierda de tu carta <b>Competitiva</b>: hasta tres, uno de cada lugar.
        La familia se ve en la forma —<b>rombo</b> Ataque, <b>círculo</b> Foco, <b>escudo</b> Cabeza— y el color es el de tu rango.
      </p>
      <ol className="jg-lug">
        <li><b>1.º · Lo eliges acá.</b> La primera vez es libre; después, un cambio por temporada. El que dejas queda desbloqueado.</li>
        <li><b>2.º y 3.º · Eventos de estilo de DRA.</b> Juegas uno de un estilo que no es el tuyo y se te desbloquea acá. Van los dos de nivel más alto.</li>
      </ol>
      <div className="jg-niv" aria-label="Los niveles">
        {[0, 1, 2, 3].map((n) => (
          <span key={n}><Insignia k={mio || 'punchline'} nivel={n} tam={40} /><small>Nivel {n}</small></span>
        ))}
        <p className="ves-nota">Juegas un evento de tu estilo: nivel 1. Quedas en el cuarto de arriba de la llave: subes uno, hasta el 3. Vuelven a 0 cada temporada.</p>
      </div>

      {d === null ? <p className="ves-nota">Todavía no se puede elegir: se habilita en unas horas.</p> : null}
      {d && !verificado ? <p className="ves-nota">{ERROR.sin_verificar}</p> : null}
      {msg ? <p className="ves-msg" role="status">{msg}</p> : null}

      {e ? (
        <div className="ves-ficha jg-ficha">
          <Insignia k={e.k} nivel={1} tam={64} />
          <div>
            <em>{FAMILIA[e.f][0]} · {cuantos[e.k] ? cuantos[e.k] + (cuantos[e.k] === 1 ? ' lo eligió' : ' lo eligieron') : 'nadie lo eligió todavía'}</em>
            <b>{e.n}</b>
            <p>{e.d}</p>
            {d && verificado && sel && sel !== mio ? (
              conf ? (
                <div className="jg-conf">
                  <p>{mio ? <>Cambias <b>{ESTILO[mio].n}</b> por <b>{e.n}</b>. Es tu único cambio de la temporada; <b>{ESTILO[mio].n}</b> queda desbloqueado, en nivel 0.</>
                    : <>Tu estilo va a ser <b>{e.n}</b>. Después lo puedes cambiar una vez por temporada.</>}</p>
                  <button type="button" className="ves-btn" disabled={ocup} onClick={() => setConf(false)}>Cancelar</button>
                  <button type="button" className="ves-btn blanco" disabled={ocup} onClick={elegir}>{ocup ? 'Guardando…' : 'Confirmar'}</button>
                </div>
              ) : d.puede ? (
                <button type="button" className="ves-btn blanco" onClick={() => setConf(true)}>{mio ? 'Cambiar a ' + e.n : 'Elegir ' + e.n}</button>
              ) : <p className="ves-nota">{ERROR.ya}</p>
            ) : sel && sel === mio ? <p className="ves-nota">Es tu estilo.</p> : null}
          </div>
        </div>
      ) : <p className="ves-nota">Toca un estilo para ver qué es{verificado ? ' y elegirlo' : ''}.</p>}

      {CAT.familias.map(([f]) => {
        const xs = CAT.estilos.filter((x) => x[2] === f);
        return (
          <div key={f} className="ves-grp">
            <Titulo extra={<small className="ves-de">{FAMILIA[f][1]}</small>}>{FAMILIA[f][0]}</Titulo>
            <div className="ves-grid" role="radiogroup" aria-label={'Estilos de ' + FAMILIA[f][0]}>
              {xs.map(([k, n]) => (
                <Cuadro key={k} on={sel === k} puesto={mio === k} nombre={n}
                  rar={mio === k ? 'Tu estilo' : viejos.has(k) ? 'Desbloqueado' : (cuantos[k] || 0) + (cuantos[k] === 1 ? ' lo tiene' : ' lo tienen')}
                  onClick={() => { setSel(k); setConf(false); setMsg(''); }}>
                  {/* todos como nivel 1: el nivel es de lo que jugaste, no de esta grilla. Lo tuyo lo dice «Puesto» */}
                  <Insignia k={k} nivel={1} />
                </Cuadro>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
