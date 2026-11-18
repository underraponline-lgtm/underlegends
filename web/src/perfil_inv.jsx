// 👤 LA PESTAÑA PERFIL DEL INVENTARIO, «EL PROBADOR» (17/11/2026).
//
// Dlx: «remakea la pestaña de perfil del inventario», y a la maqueta https://claude.ai/artifact/WsyPQxba5yfKmPhcCL1xEC,
// «Perfil A». Antes eran cuatro cajas sueltas —tu carta principal sola en una columna vacía, Tus fondos con cinco filas de
// cuadritos, y la frase y los emblemas abajo— y nada te mostraba cómo te ven. Ahora, como la pestaña Cartas:
//   · a la izquierda, qué cambias: tu carta principal, los cinco lugares de tus fondos, tu imagen, tu frase y tus emblemas
//     (en el celular, una fila de chips que se desliza)
//   · al medio, CÓMO TE VEN: tu perfil de verdad (la portada, tu carta principal, tu nombre, tu bandera y tu frase), o el
//     lugar que tocaste (el VS del Inicio, el escenario de tu carta, el VS en vivo de Discord, tu ficha)
//   · debajo, las opciones de lo que tocaste, y los otros lugares en chico para ver cómo quedas en todos
// Lo que se guarda no cambió: la carta principal va al borrador del Inventario (la barra de guardar de abajo); los fondos se
// guardan al tocarlos (`fondo()` en avisos.js); la frase, con su editor de siempre (`FraseEditor`).
import { useEffect, useState } from 'react';
import { Carta } from './piezas.jsx';
import { LUGARES, NOMBRE_OPCION, eleccion, fondoEn, fondoOpcion, urlFondo } from './fondos.js';
import { FraseEditor } from './frase.jsx';
import { usePerfilExtra } from './perfil_extra.js';
import { FONDO_H, FONDO_W, achicarFondo, pedirFondo } from './cuenta.jsx';
import { aBase64 } from './imagen.js';
import { limpio, siglaDe } from './liga.js';

const LUGAR = Object.fromEntries(LUGARES.map((x) => [x[0], x]));
// «El escenario de tu carta» → «Escenario de tu carta»
const sinEl = (n) => { const t = n.replace(/^El /, ''); return t.charAt(0).toUpperCase() + t.slice(1); };
const CARTA_DE = { temporada: 'Temporada', competitivo: 'Competitiva', servidor: 'Servidor', pais: 'País' };

/** Tu perfil como se ve arriba: la portada, tu carta principal, tu nombre, tu bandera y tu servidor, y tu frase */
function Cabecera({ liga, k, yo, bg, cual, frase, chica }) {
  return (
    <div className={'pv-cab' + (chica ? ' chica' : '')}>
      <span className={'pv-cab-f' + (bg ? '' : ' liso')} style={bg ? { backgroundImage: bg } : undefined} aria-hidden="true" />
      <div className="pv-cab-in">
        {cual ? <span className="pv-cab-c"><Carta liga={liga} k={k} cual={cual} cls="pv-ci" abre={false} /></span> : null}
        <div className="pv-cab-t">
          <span className="pv-cab-o">
            {yo.cc ? <img alt="" src={'/banderas/g/' + String(yo.cc).toLowerCase() + '.webp'} /> : null}
            {yo.sv ? siglaDe(yo.sv) : ''}
          </span>
          <b>{limpio(yo.n || k)}</b>
          {frase ? <q>{frase}</q> : chica ? null : <q className="vacia">Sin frase todavía</q>}
        </div>
      </div>
    </div>
  );
}
/** Las miniaturas de los otros lugares, con lo que va detrás de ti en cada uno */
function Mini({ liga, k, l, bg, cual, yo = {} }) {
  if (l === 'vs' || l === 'vivo') {
    return (
      <span className={'pv-vs' + (l === 'vivo' ? ' vivo' : '')}>
        <span className={'pv-vs-a' + (bg ? '' : ' liso')} style={bg ? { backgroundImage: bg } : undefined}>
          {l === 'vs' && cual ? <Carta liga={liga} k={k} cual={cual} cls="pv-mc" abre={false} /> : null}
        </span>
        <span className="pv-vs-b"><i>?</i></span><em>VS</em>
      </span>
    );
  }
  if (l === 'esc') {
    return <span className={'pv-esc' + (bg ? '' : ' liso')} style={bg ? { backgroundImage: bg } : undefined}>{cual ? <Carta liga={liga} k={k} cual={cual} cls="pv-mc" abre={false} /> : null}</span>;
  }
  if (l === 'ficha') {
    return <span className="pv-fi"><span className={'pv-fi-f' + (bg ? '' : ' liso')} style={bg ? { backgroundImage: bg } : undefined} /><span className="pv-fi-t" /></span>;
  }
  return <Cabecera liga={liga} k={k} yo={yo} bg={bg} cual={cual} chica />;
}

export default function PerfilProbador({ liga, dc, k, cartas, principalAhora, principalG, probar, sinCartas }) {
  const [sel, setSel] = useState('perfil');
  const [st, setSt] = useState(null);
  const [vista, setVista] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const ex = usePerfilExtra(k);
  useEffect(() => {
    if (!dc) return undefined;
    let vivo = true;
    pedirFondo('mi-fondo').then((j) => { if (vivo) setSt(j); }).catch((e) => { if (vivo) setMsg(e.message); });
    return () => { vivo = false; };
  }, [dc && dc.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const yo = (liga && k && ((liga.T && liga.T[k]) || (liga.X && liga.X[k]))) || (liga && liga.yo) || {};
  const f = st && st.fondo, pu = (st && st.puede) || {}, L = (st && st.lugares) || {};
  const fo = [f && f.url ? f.url : '', f ? (f.perfil ? 1 : 0) : 1, 0, L];
  const hayMia = !!(f && urlFondo(f.url));
  const cualDe = principalAhora || (cartas[0] && cartas[0][0]) || '';
  const bgDe = (l) => fondoEn(fo, l, yo);
  const frase = (ex && ex.fr) || '';

  const mandar = async (cuerpo, texto) => {
    setOcup(true); setMsg('');
    try {
      const j = await pedirFondo('fondo', cuerpo);
      setSt(j);
      if (cuerpo.img) { setArchivo(null); setVista(''); setMsg(j.filtro === 'ok' ? 'Listo: ya se ve.' : 'El filtro automático no estuvo seguro: la mira la Liga y, cuando la apruebe, se ve.'); }
      else setMsg(texto || 'Guardado. En la página se ve al toque; en el VS en vivo, desde el próximo evento.');
    } catch (er) { setMsg(er.message); }
    setOcup(false);
  };
  const elegir = async (e) => {
    const a = e.target.files && e.target.files[0];
    if (!a) return;
    setMsg('');
    try {
      const b = await achicarFondo(a);
      setArchivo(b); setVista(URL.createObjectURL(b));
      const o = b.origen;
      if (o && (o.w < FONDO_W * 0.75 || o.h < FONDO_H * 0.75)) {
        setMsg('Tu imagen mide ' + o.w + '×' + o.h + ' px: en pantallas grandes se va a ver un poco borrosa. Para verla en HD, usa una de ' + FONDO_W + '×' + FONDO_H + ' o más.');
      }
    } catch (er) { setMsg('No pude usar esa imagen: ' + er.message); }
  };
  const poner = (l, op) => mandar({ lugares: Object.assign({}, L, { [l]: op }) });

  // 🧭 lo que se toca, con lo que tiene puesto debajo
  const valorFondo = (l) => {
    const e = eleccion(fo, l);
    return NOMBRE_OPCION[e === 'mia' && !hayMia ? 'auto' : e];
  };
  const estadoImg = !dc ? 'Entra con Discord' : !st ? 'Cargando…' : f && f.pend ? 'En revisión' : hayMia ? 'Puesta' : pu.si ? 'Sin imagen' : 'Del Pase premium';
  const rail = [
    ['Tu carta', null],
    ['carta', 'Carta principal', sinCartas ? 'Sin cartas todavía' : principalAhora ? CARTA_DE[principalAhora] : 'Según dónde'],
    ['Dónde te ven', null],
    ...LUGARES.map(([l, n]) => [l, l === 'perfil' ? 'Portada del perfil' : sinEl(n), st ? valorFondo(l) : '…']),
    ['Lo tuyo', null],
    ['imagen', 'Tu imagen', estadoImg],
    ['frase', 'Tu frase', frase ? '«' + frase.slice(0, 26) + (frase.length > 26 ? '…' : '') + '»' : 'Sin frase todavía'],
    ['emblemas', 'Tus emblemas', 'En tu perfil'],
  ];

  // 🖼️ al medio: tu perfil, o el lugar que tocaste
  const lugarSel = LUGAR[sel] ? sel : 'perfil';
  const nombreLugar = { perfil: 'tu perfil', vs: 'el VS del Inicio', esc: 'el escenario de tu carta', vivo: 'el VS en vivo de Discord', ficha: 'tu ficha' }[lugarSel];
  const grande = lugarSel === 'perfil'
    ? <Cabecera liga={liga} k={k} yo={yo} bg={sel === 'imagen' && (vista || hayMia) ? (vista ? 'url("' + vista + '")' : urlFondo(f.url)) : bgDe('perfil')} cual={cualDe} frase={frase} />
    : <span className="pv-grande"><Mini liga={liga} k={k} l={lugarSel} bg={bgDe(lugarSel)} cual={lugarSel === 'esc' ? (principalAhora || 'competitivo') : cualDe} /></span>;

  let opciones = null;
  if (sel === 'carta') {
    opciones = sinCartas ? <p className="ves-nota">Todavía no tienes cartas: cuando tengas la primera, eliges cuál te representa.</p> : (
      <div className="pv-cartas" role="radiogroup" aria-label="Tu carta principal">
        <button type="button" role="radio" aria-checked={!principalAhora} className={'pv-cp' + (!principalAhora ? ' on' : '')} onClick={() => probar('principal', '', principalG)}>
          <span className="pv-cp-auto" aria-hidden="true">⟳</span><b>Según dónde</b><small>{!principalG ? 'Puesta' : 'La de siempre'}</small></button>
        {cartas.map(([c, n]) => (
          <button key={c} type="button" role="radio" aria-checked={principalAhora === c} className={'pv-cp' + (principalAhora === c ? ' on' : '')} onClick={() => probar('principal', c, principalG)}>
            <Carta liga={liga} k={k} cual={c} cls="pv-cpi" abre={false} /><b>{n}</b><small>{principalG === c ? 'Puesta' : ''}</small></button>
        ))}
      </div>
    );
  } else if (LUGAR[sel]) {
    const [l, , d, ops, auto] = LUGAR[sel];
    const e = eleccion(fo, l);
    opciones = !dc ? <p className="ves-nota">Entra con Discord para elegir qué va detrás de ti.</p> : !st ? <p className="ves-nota">{msg || 'Cargando…'}</p> : (
      <div className="pv-ops" role="radiogroup" aria-label={d}>
        {ops.map((op) => {
          const bg = op === 'auto' ? fondoEn([fo[0], fo[1], 0, {}], l, yo) : fondoOpcion(fo, op, yo);
          const cerrada = (op === 'mia' && !hayMia) || (op === 'bandera' && !yo.cc) || (op === 'servidor' && !bg);
          const on = e === op || (op === 'auto' && e === 'mia' && !hayMia);
          return (
            <button type="button" key={op} role="radio" aria-checked={on} className={'pv-op' + (on ? ' on' : '') + (cerrada ? ' cerrada' : '')}
              disabled={ocup || cerrada} onClick={() => poner(l, op)}
              title={op === 'auto' ? auto : cerrada ? (op === 'mia' ? 'Sube tu imagen en «Tu imagen»' : op === 'bandera' ? 'Todavía no tienes país' : 'Tu servidor no tiene escena todavía') : NOMBRE_OPCION[op]}>
              <span className={'pv-op-v' + (bg ? '' : ' liso')} style={bg ? { backgroundImage: bg } : undefined} aria-hidden="true" />
              <b>{on ? '✓ ' : ''}{NOMBRE_OPCION[op]}</b>
              {op === 'auto' ? <small>{auto}</small> : cerrada ? <small>{op === 'mia' ? 'Sube la tuya en «Tu imagen»' : 'No disponible'}</small> : null}
            </button>
          );
        })}
      </div>
    );
  } else if (sel === 'imagen') {
    const estado = !f ? '' : f.pend ? 'En revisión: el filtro automático no estuvo seguro y la mira la Liga.' : f.estado === 'no' ? 'No se aprobó' + (f.motivo ? ': ' + f.motivo : '') + '. Puedes subir otra.' : f.url ? 'Ya se ve donde la elegiste.' : '';
    opciones = !dc ? <p className="ves-nota">Entra con Discord para subir tu imagen.</p> : (
      <div className="pv-img">
        <p className="ves-p">{pu.si ? 'Tu propia imagen de fondo, para los lugares que quieras. Pasa por un filtro automático: sin desnudos, sangre, violencia, odio ni datos personales.'
          : 'Subir tu propia imagen es del Pase premium, y pasa por un filtro automático. La bandera y tu servidor son de todos: elígelos en cada lugar.'}</p>
        {!pu.si && !(f && f.url) ? <p className="ves-nota">💎 <a href="#/pase">Ver el Pase premium</a>{pu.prem && pu.pFalta ? ' · se abre en el nivel ' + pu.pFalta + ' del Pase' : ''}.</p> : null}
        {estado ? <p className="ves-nota">{estado}</p> : null}
        {pu.si ? (
          <div className="pv-img-b">
            <label className="ves-btn pv-arch">{f && (f.url || f.pend) ? 'Elegir otra imagen' : 'Elegir una imagen'}<input type="file" accept="image/*" onChange={elegir} /></label>
            {archivo ? <button type="button" className="ves-btn blanco" disabled={ocup} onClick={async () => mandar({ img: await aBase64(archivo), perfil: f ? f.perfil : true, pagina: f ? f.pagina : false })}>{ocup ? 'Subiendo…' : 'Subir'}</button> : null}
            {f && (f.url || f.pend) && !archivo ? <button type="button" className="ves-btn" disabled={ocup} onClick={() => mandar({ borrar: true }, 'Listo: quitaste tu imagen.')}>Quitar mi imagen</button> : null}
          </div>
        ) : null}
      </div>
    );
  } else if (sel === 'frase') {
    opciones = k ? <FraseEditor k={k} /> : <p className="ves-nota">Verifícate para escribir tu frase.</p>;
  } else if (sel === 'emblemas') {
    opciones = (
      <div className="pv-img">
        <p className="ves-p">Van al lado de tu nombre. Se eligen mirando tu perfil: tócalos y marca los que quieres que se vean.</p>
        {k ? <a className="ves-btn blanco" href={'#/r/' + encodeURIComponent(k)}>Ir a mi perfil</a> : null}
      </div>
    );
  }
  const titOps = sel === 'carta' ? 'Tu carta principal · la que te representa en /card, tu perfil y el ranking'
    : LUGAR[sel] ? (sel === 'perfil' ? 'Portada del perfil' : LUGAR[sel][1]) + ' · ' + LUGAR[sel][2].replace(/\.$/, '').toLowerCase()
      : sel === 'imagen' ? 'Tu imagen' : sel === 'frase' ? 'Tu frase · debajo de tu nombre' : 'Tus emblemas';

  return (
    <section className="pv">
      <nav className="pv-rail" aria-label="Qué cambias">
        {rail.map((r) => (r[1] == null ? <span key={r[0]} className="ves-rk">{r[0]}</span> : (
          <button key={r[0]} type="button" aria-pressed={sel === r[0]} className={'ves-rn' + (sel === r[0] ? ' on' : '')} onClick={() => { setSel(r[0]); setMsg(''); }}>
            <b>{r[1]}</b><small>{r[2]}</small></button>
        )))}
      </nav>
      <div className="pv-mid">
        <span className="pv-donde">Así te ven en <b>{nombreLugar}</b></span>
        {grande}
        <div className="pv-opc">
          <span className="ves-rk">{titOps}</span>
          {opciones}
          {msg ? <p className="ves-msg" role="status">{msg}</p> : null}
        </div>
        {/* 👀 y en los otros lugares, en chico: tocarlos los elige */}
        <div className="pv-otros">
          <span className="ves-rk">Y en los otros lugares</span>
          <div className="pv-otros-g">
            {LUGARES.filter(([l]) => l !== lugarSel).map(([l, n]) => (
              <button key={l} type="button" className="pv-otro" onClick={() => { setSel(l); setMsg(''); }}>
                <span>{l === 'perfil' ? 'Tu perfil' : sinEl(n)}</span>
                <Mini liga={liga} k={k} l={l} yo={yo} bg={bgDe(l)} cual={l === 'esc' ? (principalAhora || 'competitivo') : cualDe} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
