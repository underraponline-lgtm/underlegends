// 🏷️ TUS TAGS, EN TU INVENTARIO (Dlx, 25/10/2026: «que los tags de abajo sean personalizables en cada tarjeta, si uno
// desbloquea uno claro… que pueda elegir el que desee desde el inventario», y a los cuatro grupos, «sí, sirve así»).
//   · ♾️ PARA SIEMPRE y 📅 DE TEMPORADA: los que tu carta mostró alguna vez (los de temporada, sólo los de la que corre)
//   · ✨ EDICIÓN LIMITADA: tus títulos del Pase, que valen en las cuatro
//   · 🎯 DE ESTADO: no se guardan; salen solos mientras se cumplen («Automático»)
// Lo que eliges lo guarda el objeto (`tagElige()` en bot/avisos.js) y la carta se redibuja en la próxima vuelta del
// ciclo (`bot/tags_inventario.py`, que lo revisa otra vez contra tu inventario).
import { useEffect, useState } from 'react';
import CAT from './tags_catalogo.json';
import { pasePost } from './pase.js';

const CARTAS = [['temporada', 'Temporada'], ['competitivo', 'Competitiva'], ['servidor', 'Servidor'], ['pais', 'País']];
const GRUPO = { siempre: ['♾️', 'Para siempre'], temporada: ['📅', 'De temporada'], pase: ['✨', 'Edición limitada'] };
const sinNum = (t) => t.replace(' x%d', '').replace(' DE %d', '');

/** Lo que puedes ponerle a `carta`: `[{tag, texto, grupo, nivel}]` */
function opciones(carta, yo) {
  const cat = (CAT.cat && CAT.cat[carta]) || [];
  const out = [];
  for (const [t, n, _p, g] of cat) {
    if (g !== 'siempre' && g !== 'temporada') continue;
    const x = ((yo.ganados || {})[carta] || {})[t];
    if (yo.dueno) out.push({ tag: t, texto: x ? x[0] : sinNum(t), grupo: g, nivel: n });
    else if (x && (g === 'siempre' || x[1] === yo.temp)) out.push({ tag: t, texto: x[0], grupo: g, nivel: n });
  }
  for (const tit of yo.titulos || []) out.push({ tag: 'pase:' + tit, texto: '✨ ' + tit.toUpperCase(), grupo: 'pase', nivel: 't1' });
  return out;
}

export function TusTags() {
  const [yo, setYo] = useState(undefined);
  const [ocup, setOcup] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { pasePost('tags-mios', {}).then((d) => setYo(d && d._ok ? d : null)); }, []);
  if (yo === undefined) return <p className="iv-nota">Buscando tu inventario…</p>;
  if (!yo) return <p className="iv-nota">No pude leer tu inventario. Entra con Discord y prueba de nuevo.</p>;
  const elegir = (carta, tag) => {
    setOcup(carta + tag);
    pasePost('tag-elige', { carta, tag }).then((d) => {
      setOcup('');
      if (d && d._ok) { setYo(d); setMsg('Listo: tu carta sale con ese TAG en la próxima vuelta del ciclo (media hora como mucho).'); }
      else setMsg(d && d.error === 'no lo tienes' ? 'Ese TAG todavía no es tuyo.' : 'No se pudo guardar. Prueba de nuevo.');
    });
  };
  const total = CARTAS.reduce((s, [c]) => s + opciones(c, yo).filter((o) => o.grupo !== 'pase').length, 0);
  return (
    <div className="iv">
      <p className="iv-p">
        El TAG de abajo de cada carta lo eliges tú, de los que ganaste. <b>♾️ Para siempre</b> y <b>📅 de temporada</b> se
        guardan cuando tu carta los muestra; <b>✨ edición limitada</b> son tus títulos del Pase. Los <b>🎯 de estado</b> (EN
        LLAMAS, TOP DEL SERVIDOR…) no se guardan: salen solos mientras se cumplen, con «Automático».
      </p>
      {!total && !(yo.titulos || []).length ? <p className="iv-nota">Todavía no ganaste ninguno que se guarde: aparecen acá en cuanto tu carta los muestre.</p> : null}
      {CARTAS.map(([c, nombre]) => {
        const ops = opciones(c, yo);
        const el = (yo.elegidos || {})[c] || 'auto';
        return (
          <section key={c} className="iv-c">
            <h4>{nombre}<small>{el === 'auto' ? 'Automático' : 'Elegido'}</small></h4>
            <div className="iv-l" role="radiogroup" aria-label={'El TAG de tu carta de ' + nombre}>
              <button type="button" role="radio" aria-checked={el === 'auto'} className={'iv-t auto' + (el === 'auto' ? ' on' : '')}
                disabled={!!ocup} onClick={() => el !== 'auto' && elegir(c, 'auto')}>Automático<small>el que te toca hoy</small></button>
              {ops.map((o) => (
                <button key={o.tag} type="button" role="radio" aria-checked={el === o.tag} className={'iv-t iv-' + o.nivel + (el === o.tag ? ' on' : '')}
                  disabled={!!ocup} onClick={() => el !== o.tag && elegir(c, o.tag)} title={GRUPO[o.grupo][1]}>
                  {o.texto}<small>{GRUPO[o.grupo][0]} {GRUPO[o.grupo][1]}</small>
                </button>
              ))}
            </div>
          </section>
        );
      })}
      {msg ? <p className="iv-msg" role="status">{msg}</p> : null}
      {yo.dueno ? <p className="iv-nota">👑 Como dueño de Under Legends, los tienes todos.</p> : null}
    </div>
  );
}
