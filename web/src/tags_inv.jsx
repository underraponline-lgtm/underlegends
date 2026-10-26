// 🎒 TU INVENTARIO: tu carta, su marco, su TAG y tu carta principal, en un solo lugar.
//
// Dlx, 25/10/2026: «que los tags de abajo sean personalizables en cada tarjeta… desde el inventario»; 26/10/2026: «eso de
// tus marcos y todo eso debería estar en inventario» y «reworkear cómo se ve el inventario… organizarlo muchísimo mejor».
//   · A la izquierda, LA CARTA QUE ESTÁS EDITANDO, grande y con su marco: se elige arriba (Temporada · Competitiva ·
//     Servidor · País). Lo que cambias se ve ahí.
//   · A la derecha, tres pestañas: TAG (agrupados: ♾️ para siempre, 📅 de temporada, ✨ edición limitada), MARCO (y, en la
//     de Servidor, camiseta o cadena) y PRINCIPAL (la que sale primero en /card).
//   · ⚡ El TAG se dibuja en la imagen: elegir uno pide un redibujo a pedido (`pedirRedibujo()` en bot/avisos.js), que
//     tarda unos minutos y tiene freno —uno cada 10 minutos, 6 por día—. El marco se ve al momento en la página.
// Los 🎯 de estado no se guardan: salen solos mientras se cumplen, con «Automático».
import { useEffect, useMemo, useState } from 'react';
import CAT from './tags_catalogo.json';
import { pasePost, refrescarPases } from './pase.js';
import { Carta } from './piezas.jsx';
import { nombreMarco } from './marcos.jsx';

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

/** El aviso de qué pasa con tu carta después de elegir un TAG */
function avisoRedibujo(r) {
  if (!r) return 'Listo.';
  if (r.limite) return 'Listo: ya cambiaste tu carta 6 veces hoy, así que ésta sale en la próxima vuelta del ciclo (media hora como mucho).';
  const min = Math.ceil((r.en || 0) / 60000);
  return min > 0 ? '⚡ Listo: tu carta se redibuja en unos ' + (min + 3) + ' minutos (hay una espera de 10 entre cambios).'
    : '⚡ Listo: tu carta se redibuja en unos 3 minutos.';
}

export function Inventario({ liga, dc }) {
  const [yo, setYo] = useState(undefined);
  const [mk, setMk] = useState(null);
  const [carta, setCarta] = useState('temporada');
  const [pest, setPest] = useState('tag');
  const [ocup, setOcup] = useState('');
  const [msg, setMsg] = useState('');
  const [busca, setBusca] = useState('');
  useEffect(() => {
    pasePost('tags-mios', {}).then((d) => setYo(d && d._ok ? d : null));
    pasePost('marcos', {}).then((d) => setMk(d && d._ok ? d : null));
  }, []);
  const k = (dc && dc.clave) || (yo && yo.k) || '';
  // las cartas que tienes: la página las sabe por tu fila o tu cuenta (ver `filaDe` de visor.jsx)
  const tienes = useMemo(() => {
    const f = (liga.T && liga.T[k]) || (liga.X && liga.X[k]);
    const c = new Set([...((f && f.c) || []), ...((dc && dc.cs) || [])]);
    return CARTAS.filter(([x]) => c.has(x));
  }, [liga, k, dc]);
  useEffect(() => { if (tienes.length && !tienes.some(([x]) => x === carta)) setCarta(tienes[0][0]); }, [tienes]); // eslint-disable-line react-hooks/exhaustive-deps
  if (yo === undefined) return <p className="iv-nota">Buscando tu inventario…</p>;
  if (!yo) return <p className="iv-nota">No pude leer tu inventario. Entra con Discord y prueba de nuevo.</p>;

  const ops = opciones(carta, yo);
  const el = (yo.elegidos || {})[carta] || 'auto';
  const q = busca.trim().toLowerCase();
  const vistos = q ? ops.filter((o) => o.texto.toLowerCase().includes(q)) : ops;
  const grupos = ['siempre', 'temporada', 'pase'].map((g) => [g, vistos.filter((o) => o.grupo === g)]).filter(([, xs]) => xs.length);
  const nombre = (CARTAS.find(([x]) => x === carta) || [])[1] || '';

  const elegirTag = (tag) => {
    if (tag === el) return;
    setOcup('t' + tag);
    pasePost('tag-elige', { carta, tag }).then((d) => {
      setOcup('');
      if (d && d._ok) { setYo(d); setMsg(avisoRedibujo(d.redibujo)); }
      else setMsg(d && d.error === 'no lo tienes' ? 'Ese TAG todavía no es tuyo.' : 'No se pudo guardar. Prueba de nuevo.');
    });
  };
  const elegirMarco = (marco, estilo) => {
    setOcup('m' + marco + estilo);
    pasePost('marco-elige', { marco, estilo }).then((d) => {
      setOcup('');
      if (d && d._ok) { setMk(d); refrescarPases(); setMsg('Listo: el marco ya se ve en tus cartas de la página.'); }
      else setMsg('No se pudo guardar. Prueba de nuevo.');
    });
  };
  const principal = (c) => {
    setOcup('p' + c);
    pasePost('carta-principal', { carta: c }).then((d) => {
      setOcup('');
      if (d && d._ok) { setYo(d); refrescarPases(); setMsg(c ? 'Listo: ésa es tu carta principal.' : 'Listo: vuelve a lo de siempre.'); }
      else setMsg('No se pudo guardar. Prueba de nuevo.');
    });
  };

  const marcoAhora = (mk && mk.elegido) || '';
  return (
    <div className="iv8">
      <div className="iv8-ver">
        <div className="iv8-cartas" role="tablist" aria-label="Qué carta editas">
          {(tienes.length ? tienes : CARTAS).map(([c, n]) => (
            <button key={c} type="button" role="tab" aria-selected={carta === c} className={carta === c ? 'on' : ''}
              onClick={() => { setCarta(c); setBusca(''); }}>{n}{yo.principal === c ? <i aria-label="principal">★</i> : null}</button>
          ))}
        </div>
        <div className="iv8-carta">{k ? <Carta liga={liga} k={k} cual={carta} cls="iv8-ci" abre={false} /> : null}</div>
        <dl className="iv8-ahora">
          <div><dt>TAG</dt><dd>{el === 'auto' ? 'Automático' : ((ops.find((o) => o.tag === el) || {}).texto || el)}</dd></div>
          <div><dt>Marco</dt><dd>{!marcoAhora ? 'El mejor' : marcoAhora === 'ninguno' ? 'Sin marco' : nombreMarco(marcoAhora)}</dd></div>
          <div><dt>Principal</dt><dd>{yo.principal ? (CARTAS.find(([x]) => x === yo.principal) || [])[1] : 'Automático'}</dd></div>
        </dl>
      </div>

      <div className="iv8-ed">
        <div className="iv8-pest" role="tablist" aria-label="Qué cambias">
          {[['tag', 'TAG'], ['marco', 'Marco'], ['principal', 'Principal']].map(([id, n]) => (
            <button key={id} type="button" role="tab" aria-selected={pest === id} className={pest === id ? 'on' : ''} onClick={() => setPest(id)}>{n}</button>
          ))}
        </div>

        {pest === 'tag' ? (
          <div className="iv8-panel">
            <p className="iv-p">El TAG de abajo de tu carta de <b>{nombre}</b>. Los <b>🎯 de estado</b> (EN LLAMAS, TOP DEL SERVIDOR…) salen solos con «Automático».</p>
            {ops.length > 12 ? <input className="iv8-busca" type="search" placeholder="Buscar un TAG…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar un TAG" /> : null}
            <div className="iv-l" role="radiogroup" aria-label={'El TAG de tu carta de ' + nombre}>
              <button type="button" role="radio" aria-checked={el === 'auto'} className={'iv-t auto' + (el === 'auto' ? ' on' : '')}
                disabled={!!ocup} onClick={() => elegirTag('auto')}>Automático<small>el que te toca hoy</small></button>
            </div>
            {grupos.map(([g, xs]) => (
              <section key={g} className="iv8-grupo">
                <h4>{GRUPO[g][0]} {GRUPO[g][1]}<small>{xs.length}</small></h4>
                <div className="iv-l" role="radiogroup" aria-label={GRUPO[g][1]}>
                  {xs.map((o) => (
                    <button key={o.tag} type="button" role="radio" aria-checked={el === o.tag} className={'iv-t iv-' + o.nivel + (el === o.tag ? ' on' : '')}
                      disabled={!!ocup} onClick={() => elegirTag(o.tag)}>{o.texto}</button>
                  ))}
                </div>
              </section>
            ))}
            {!ops.length ? <p className="iv-nota">Todavía no ganaste ninguno que se guarde para esta carta: aparecen acá en cuanto tu carta los muestre.</p> : null}
            {q && !vistos.length ? <p className="iv-nota">Ningún TAG tuyo dice «{busca}».</p> : null}
          </div>
        ) : null}

        {pest === 'marco' ? (
          <div className="iv8-panel">
            {!mk || !(mk.tienes || []).length ? (
              <p className="iv-nota">Todavía no tienes marcos: se ganan en el Pase premium. Sin marco, tus cartas salen como siempre.</p>
            ) : (
              <>
                <p className="iv-p">El marco va alrededor de <b>todas</b> tus cartas en la página. Se ve al momento.</p>
                <div className="iv8-marcos" role="radiogroup" aria-label="El marco de tus cartas">
                  {mk.tienes.map(([id]) => (
                    <button key={id} type="button" role="radio" aria-checked={marcoAhora === id} className={'iv8-mk' + (marcoAhora === id ? ' on' : '')}
                      disabled={!!ocup} onClick={() => elegirMarco(id, mk.estilo)}><i className={'iv8-sw ' + id.split(':')[1]} aria-hidden="true" />{nombreMarco(id)}</button>
                  ))}
                  <button type="button" role="radio" aria-checked={!marcoAhora} className={'iv8-mk' + (!marcoAhora ? ' on' : '')} disabled={!!ocup}
                    onClick={() => elegirMarco('', mk.estilo)}>El mejor<small>el más alto que tengas</small></button>
                  <button type="button" role="radio" aria-checked={marcoAhora === 'ninguno'} className={'iv8-mk' + (marcoAhora === 'ninguno' ? ' on' : '')}
                    disabled={!!ocup} onClick={() => elegirMarco('ninguno', mk.estilo)}>Sin marco</button>
                </div>
                {carta === 'servidor' ? (
                  <section className="iv8-grupo">
                    <h4>Tu carta de Servidor</h4>
                    <div className="iv-l" role="radiogroup" aria-label="El estilo de tu carta de Servidor">
                      {(mk.estilos || ['camiseta', 'cadena']).map((e) => (
                        <button key={e} type="button" role="radio" aria-checked={mk.estilo === e} className={'iv-t' + (mk.estilo === e ? ' on' : '')}
                          disabled={!!ocup} onClick={() => elegirMarco(marcoAhora, e)}>{e === 'cadena' ? 'La cadena' : 'La camiseta'}</button>
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {pest === 'principal' ? (
          <div className="iv8-panel">
            <p className="iv-p">La carta que te representa: sale primero en <b>/card</b>, en tu perfil y cuando alguien abre tus cartas.</p>
            <div className="iv-l" role="radiogroup" aria-label="Tu carta principal">
              {[['', 'Automático']].concat(tienes.length ? tienes : CARTAS).map(([c, n]) => (
                <button key={c || 'auto'} type="button" role="radio" aria-checked={(yo.principal || '') === c}
                  className={'iv-t' + (c ? '' : ' auto') + ((yo.principal || '') === c ? ' on' : '')} disabled={!!ocup} onClick={() => principal(c)}>{n}</button>
              ))}
            </div>
          </div>
        ) : null}

        {msg ? <p className="iv-msg" role="status">{msg}</p> : null}
        {yo.dueno ? <p className="iv-nota">👑 Como dueño de Under Legends, tienes todo desbloqueado.</p> : null}
      </div>
    </div>
  );
}
