// 🎁 INVITA Y GANA (17/11/2026). Dlx: «agreguemos una nueva opción con el ícono de regalo… al costado de notificaciones…
// será un sistema de referrals», «podríamos hacer como un track», «que el link sea corto», «de cosa final pon algo
// buenísimo… como un marco especial» y «que el máximo sea 10 de momento».
//
// Una página, dos lados:
//   · QUIEN LLEGA por un link (`?ref=`, ver referidos.js): quién lo invitó y qué tiene que hacer (entrar con Discord antes
//     de verificarse, y llegar al nivel 1 del Pase) para su bienvenida.
//   · QUIEN INVITA: su link corto de la temporada (`/i/<clave>`), el track hasta 10 con sus premios y a quién trajo.
// Los números (cuánto paga, el tope, las metas) vienen del objeto (`refMio()`, REF_TRACK en bot/avisos.js): acá no se
// escribe ninguno, salvo el texto de quien todavía no entró (sin cuenta no se le pueden pedir).
import { useEffect, useState } from 'react';
import { limpio, num } from './liga.js';
import { Cara, Compartir, Ico, accion } from './piezas.jsx';
import { diaCrew } from './crews.js';
import { REF_ERROR, mandarRef, pedirRef, useRefPendiente } from './referidos.js';
import CSS_PAGINA from './css/invitar.css?inline';
import { usarCss } from './css.js';

usarCss('invitar', CSS_PAGINA);

const nombreK = (liga, k) => {
  const f = liga && ((liga.T && liga.T[k]) || (liga.X && liga.X[k]));
  return limpio((f && f.n) || k);
};
const premioTx = (pr) => {
  const [t, x] = pr || [];
  if (t === 'drop') return x === 1 ? 'Dragón Drop' : x + ' Dragón Drops';
  if (t === 'pdt') return num(x) + ' Puntos de Tienda';
  if (t === 'titulo') return 'Título «' + x + '»';
  if (t === 'marco') return 'Marco ' + (x === 'embajador' ? 'Embajador' : x);
  return '';
};

/** 🙋 Quien llegó por un link: quién lo invitó y qué le falta */
function Llegaste({ liga, dc, rp }) {
  const de = nombreK(liga, rp.k);
  const r = rp.r || '';
  useEffect(() => { if (dc && !r) mandarRef(); }, [dc && dc.id, r]);
  return (
    <section className="sec rf-llego" aria-live="polite">
      <div className="rf-llego-c">
        <Cara liga={liga} k={rp.k} nombre={de} cls="cara rf-llego-cara" />
        <div>
          <span className="rf-k">Te invitó</span>
          <h2 className="rf-llego-n">{de}</h2>
          {!dc ? (
            <>
              <p className="rf-p">Entra con Discord <b>ahora, antes de verificarte</b>: así la invitación queda a tu nombre. Después,
                verifícate y haz dos Tareas del Pase de rapero (nivel 1): te llegan <b>500 Puntos de Tienda</b> de bienvenida.</p>
              <button type="button" className="btn verde" onClick={accion.entrar}>Entrar con Discord</button>
            </>
          ) : (
            <p className={'rf-p' + (r && r !== 'ok' && r !== 'ya' ? ' rf-no' : '')}>{r ? (REF_ERROR[r] || 'No pude anotar la invitación.') : 'Anotando tu invitación…'}</p>
          )}
        </div>
      </div>
    </section>
  );
}

/** 🔗 Tu link de esta temporada */
function TuLink({ dc, R, abrir, va }) {
  if (!dc) {
    return (
      <div className="rf-link rf-link-sin">
        <p className="rf-p">Entra con Discord para tener tu link.</p>
        <button type="button" className="btn verde" onClick={accion.entrar}>Entrar con Discord</button>
      </div>
    );
  }
  if (!R) return <div className="rf-link"><p className="rf-p">Cargando tu link…</p></div>;
  if (!R.puede) {
    return (
      <div className="rf-link rf-link-sin">
        <p className="rf-p">Tu link se abre cuando estés verificado (Miembro de DRA).</p>
        <a className="btn borde2" href="#/cuenta/verificar">Verificarme</a>
      </div>
    );
  }
  if (!R.activo) {
    return (
      <div className="rf-link rf-link-sin">
        <p className="rf-p">Tu link vale una temporada. Ábrelo y pásaselo a quien todavía no esté en la Liga.</p>
        <button type="button" className="btn verde" disabled={va} onClick={abrir}>Abrir mi link de la {String(R.temp || '').toUpperCase()}</button>
      </div>
    );
  }
  const url = 'https://underlegends.pages.dev/i/' + R.k;
  return (
    <div className="rf-link">
      <span className="rf-k">Tu link · vale toda la {String(R.temp || '').toUpperCase()}</span>
      <code className="rf-url">{url.replace(/^https:\/\//, '')}</code>
      <div className="rf-link-b">
        <Compartir url={url} texto="Únete a la Liga Global de Freestyle con mi link:" titulo="Liga Global de Freestyle" cls="btn verde" etiqueta="Copiar o compartir" />
      </div>
    </div>
  );
}

/** 🛤️ El track: de 0 al tope, con sus metas */
function Track({ R }) {
  const max = (R && R.max) || 10, hechos = (R && R.hechos) || 0;
  const metas = (R && R.track) || [];
  return (
    <section className="sec rf-track-s">
      <div className="sec-t"><h2>Tu track</h2><span className="rf-cuenta"><b>{hechos}</b> de {max}</span></div>
      <div className="rf-track" role="img" aria-label={hechos + ' de ' + max + ' invitados que ya cuentan'}>
        <i className="rf-barra"><u style={{ width: Math.min(100, (100 * hechos) / max) + '%' }} /></i>
        {metas.map(([n]) => <b key={n} className={'rf-hito' + (hechos >= n ? ' on' : '')} style={{ left: (100 * n) / max + '%' }}>{n}</b>)}
      </div>
      <ol className="rf-metas">
        {metas.map(([n, prs]) => {
          const final = n === max;
          return (
            <li key={n} className={(hechos >= n ? 'on ' : '') + (final ? 'final' : '')}>
              <span className="rf-metas-n">{n}</span>
              <span className="rf-metas-t">{prs.map(premioTx).join(' + ')}{final ? <small>El premio final: para todas tus cartas</small> : null}</span>
              {hechos >= n ? <Ico n="ok" t={18} /> : null}
            </li>
          );
        })}
      </ol>
      {R ? <p className="rf-nota">Y por cada uno que cuenta: <b>{num(R.pdt)} Puntos de Tienda</b> y <b>{num(R.xp)} XP del Pase</b>. A quien llega,
        {' '}<b>{num(R.bien)}</b> de bienvenida.</p> : null}
    </section>
  );
}

function Invitados({ liga, R }) {
  const xs = (R && R.lista) || [];
  if (!xs.length) return null;
  return (
    <section className="sec">
      <div className="sec-t"><h2>Tus invitados</h2></div>
      <ul className="rf-lista">
        {xs.map((x, i) => (x.cumple ? (
          <li key={'c' + i}>
            {x.k ? <a href={'#/r/' + encodeURIComponent(x.k)} className="rf-q"><Cara liga={liga} k={x.k} nombre={nombreK(liga, x.k)} cls="cara rf-q-c" lazy /><b>{nombreK(liga, x.k)}</b></a>
              : <span className="rf-q"><b>Invitado {x.n}</b></span>}
            <span className="rf-est ok">Cuenta · {x.n} de {R.max}</span>
          </li>
        ) : (
          <li key={'p' + i}>
            <span className="rf-q"><b>Alguien llegó el {diaCrew(x.t)}</b></span>
            <span className="rf-est">Falta que se verifique y llegue al nivel 1</span>
          </li>
        )))}
      </ul>
    </section>
  );
}

export function Invitar({ liga, dc }) {
  const rp = useRefPendiente();
  const [R, setR] = useState(null);
  const [va, setVa] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!dc) { setR(null); return undefined; }
    let vivo = true;
    pedirRef('ver').then((j) => { if (vivo && j && j.ok) setR(j); });
    return () => { vivo = false; };
  }, [dc && dc.id]);
  const abrir = async () => {
    setVa(true); setErr('');
    const j = await pedirRef('activar');
    setVa(false);
    if (j && j.ok) setR(j); else setErr(REF_ERROR[(j && j.error) || ''] || 'No pude abrir tu link: prueba en un rato.');
  };
  // quien llegó por un link y todavía no cuenta: arriba, lo suyo
  const llego = rp && !(R && R.k === rp.k);
  return (
    <>
      <div className="escena rf-esc">
        <section className="rf-cab">
          <div className="rf-cab-tx">
            <span className="tag">INVITA Y GANA · {String(liga.temp || '').toUpperCase()}</span>
            <h1 className="hero-ev">Trae a tu gente</h1>
            <p className="hero-p">Pásale tu link a alguien que todavía no esté en la Liga. Cuenta cuando entra, se verifica y llega al nivel 1 del Pase:
              a ti te da Puntos de Tienda y XP, y cada meta del track suma más. A los 10, el marco Embajador para todas tus cartas.</p>
          </div>
          <TuLink dc={dc} R={R} abrir={abrir} va={va} />
        </section>
        {err ? <p className="rf-err" role="status">{err}</p> : null}
      </div>
      {llego ? <Llegaste liga={liga} dc={dc} rp={rp} /> : null}
      <Track R={R || { max: 10, hechos: 0, track: [[1, [['drop', 1]]], [3, [['titulo', 'Reclutador']]], [5, [['drop', 2], ['pdt', 1500]]], [10, [['marco', 'embajador']]]] }} />
      <Invitados liga={liga} R={R} />
      <section className="sec rf-reglas">
        <div className="sec-t"><h2>Cómo cuenta</h2></div>
        <ul>
          <li>Sólo gente <b>nueva</b>: que no estaba verificada ni había usado la página antes de tu link.</li>
          <li>Tiene que entrar con Discord desde tu link, verificarse y hacer dos Tareas del Pase de rapero (nivel 1).</li>
          <li>Su cuenta de Discord tiene que tener <b>30 días o más</b>.</li>
          <li>Tu link vale una temporada; los que no trajeron a nadie se borran al terminarla.</li>
          <li>Por ahora, el tope es de <b>10 invitados</b> por persona.</li>
        </ul>
      </section>
    </>
  );
}
