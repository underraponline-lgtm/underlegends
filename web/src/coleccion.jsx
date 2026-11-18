// 🏅 LA COLECCIÓN DEL INVENTARIO, «LA VITRINA» (17/11/2026).
//
// Dlx: «remakea la pestaña de colección», y a la maqueta https://claude.ai/artifact/S2uXewXQsMrJg7HQvXsizH, «me gusta
// todo, haremos A». Antes era una pared de 77 cuadros grises con candado, todos iguales.
//   · arriba, tu total en un anillo (insignias, títulos, marcos, TAGs y estilos de juego), cuánto tienes de cada cosa, tu
//     última insignia y las tres que tiene más gente y tú todavía no (las más fáciles)
//   · a la izquierda, las categorías con su barra; en el celular, una fila de chips que se desliza
//   · la ficha de lo que tocas y la grilla: lo tuyo primero, el resto de la más común a la más rara
//   · LA RAREZA: cuánta gente de la Liga la tiene (de los perfiles), en cuatro tramos con los tonos que el Inventario ya
//     usa para los TAG (`--t4` gris, `--t3` azul, `--t2` morado, `--t1` oro). Sin perfiles todavía, sin rareza
// Títulos y marcos siguen llevándote a probártelos en tus cartas, y los estilos de juego, a su pestaña.
import { useEffect, useRef, useState } from 'react';
import { pasePost } from './pase.js';

const CATS = [['logros', 'Logros', 'Lo que haces en los eventos'], ['elo', 'Ranking ELO', 'Las piedras de tu temporada'],
  ['ligas', 'Ligas', 'Las ligas de los servidores'], ['mes', 'MES AWARDS', 'Los premios de cada mes'],
  ['gala', 'Gala de la temporada', 'Los premios del 1 de enero']];
const catDe = (id) => (id.startsWith('mes_') ? 'mes' : id.startsWith('gala_') ? 'gala' : id.startsWith('piedra_') ? 'elo'
  : id.startsWith('liga') || id === 'invicto' ? 'ligas' : 'logros');
// la rareza por el % de gente que la tiene: [clase, nombre]
const RAREZA = (p) => (p == null ? ['', ''] : p >= 20 ? ['t4', 'Común'] : p >= 5 ? ['t3', 'Rara'] : p >= 1 ? ['t2', 'Épica'] : ['t1', 'Legendaria']);
const pctTxt = (p) => (!p ? 'nadie todavía' : String(p < 1 ? p.toFixed(2) : p < 10 ? p.toFixed(1) : Math.round(p)).replace('.', ',') + ' %');
const FILTROS = [['todas', 'Todas'], ['mias', 'Las tengo'], ['faltan', 'Me faltan'], ['raras', 'Más raras primero']];

function Anillo({ n, de, tam }) {
  const r = tam / 2 - 9;
  const c = 2 * Math.PI * r;
  return (
    <svg className="cl-ring" width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`} aria-hidden="true">
      <circle cx={tam / 2} cy={tam / 2} r={r} fill="none" stroke="#1f2126" strokeWidth="10" />
      <circle cx={tam / 2} cy={tam / 2} r={r} fill="none" stroke="var(--v-verde)" strokeWidth="10" strokeDasharray={`${de ? (c * n) / de : 0} ${c}`}
        transform={`rotate(-90 ${tam / 2} ${tam / 2})`} />
    </svg>
  );
}

const Bar = ({ n, de }) => <i className="cl-bar" aria-hidden="true"><u style={{ width: (de ? (100 * n) / de : 0) + '%' }} /></i>;

/**
 * `ins`: el catálogo (`[id, ícono, nombre, qué es]`); `mias`: `Map(id → cuándo)`; `pct`: `{n, de: {id: cuántos}}` de los
 * perfiles (o null); `extra`: `{titulos, marcos, tags}` con `[n, de]`; `Titulos` y `Marcos`: lo de siempre, ya armado
 */
export default function Coleccion({ ins, mias, pct, extra, Titulos, Marcos, onEstilos }) {
  const [cat, setCat] = useState('todas');
  const [filtro, setFiltro] = useState('todas');
  const [sel, setSel] = useState('');
  const [jg, setJg] = useState(null);
  const fichaR = useRef(null);
  // 🎭 tus estilos de juego: el elegido, los que dejaste y los ganados en DRA
  useEffect(() => {
    let vivo = true;
    pasePost('juego-mio', {}).then((r) => { if (vivo && r && r._ok) setJg(r); });
    return () => { vivo = false; };
  }, []);
  const estilos = jg ? new Set([jg.juego, ...(jg.viejos || []), ...(jg.lugares || []).map((x) => x[0])].filter(Boolean)).size : 0;

  const p = (id) => (pct && pct.n ? (100 * (pct.de[id] || 0)) / pct.n : null);
  const tot = [['Insignias', mias.size, ins.length], ['Títulos', ...extra.titulos], ['Marcos', ...extra.marcos], ['TAGs', ...extra.tags],
    ['Estilos', estilos, 18]].filter((x) => x[2]);
  const suma = [tot.reduce((a, x) => a + x[1], 0), tot.reduce((a, x) => a + x[2], 0)];
  const ultimaId = [...mias.entries()].sort((a, b) => String(b[1] || '').localeCompare(String(a[1] || '')))[0];
  const ultima = ultimaId ? ins.find((x) => x[0] === ultimaId[0]) : null;
  const cerca = pct ? ins.filter((x) => !mias.has(x[0])).sort((a, b) => p(b[0]) - p(a[0])).slice(0, 3) : [];

  // la grilla de la categoría elegida, con su filtro
  let xs = cat === 'todas' ? ins : ins.filter((x) => catDe(x[0]) === cat);
  if (filtro === 'mias') xs = xs.filter((x) => mias.has(x[0]));
  if (filtro === 'faltan') xs = xs.filter((x) => !mias.has(x[0]));
  xs = [...xs].sort(filtro === 'raras' ? (a, b) => (p(a[0]) ?? 0) - (p(b[0]) ?? 0)
    : (a, b) => (mias.has(b[0]) - mias.has(a[0])) || ((p(b[0]) ?? 0) - (p(a[0]) ?? 0)));
  const elegida = ins.find((x) => x[0] === sel) || ultima || xs[0] || null;

  const tocar = (id) => {
    setSel(id);
    const f = fichaR.current;
    if (f && f.getBoundingClientRect().top < 0) {
      const quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      f.scrollIntoView({ block: 'start', behavior: quieto ? 'auto' : 'smooth' });
    }
  };
  const cats = [['todas', 'Todas', mias.size, ins.length],
    ...CATS.map(([c, n]) => { const ys = ins.filter((x) => catDe(x[0]) === c); return [c, n, ys.filter((x) => mias.has(x[0])).length, ys.length]; })];
  const otras = [['titulos', 'Títulos', ...extra.titulos], ['marcos', 'Marcos', ...extra.marcos], ['estilos', 'Estilos de juego', estilos, 18]].filter((x) => x[3]);

  let ficha = null;
  if (elegida) {
    const [id, ic, n, d] = elegida;
    const pp = p(id);
    const [rc, rn] = RAREZA(pp);
    const mia = mias.has(id);
    ficha = (
      <div className={'cl-fx' + (rc ? ' r-' + rc : '')} ref={fichaR} aria-live="polite">
        <span className="cl-fx-ic" aria-hidden="true">{ic}</span>
        <div>
          <em>{rn ? rn + ' · ' : ''}{pp == null ? '' : pp ? 'la tiene el ' + pctTxt(pp) + ' de la Liga' : 'nadie la tiene todavía'}</em>
          <b>{n}</b>
          <p>{d}</p>
          <span className={'cl-fx-st' + (mia ? ' si' : '')}>{mia ? 'La tienes' : 'Todavía no la tienes'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="cl">
      {/* 🏆 tu total, cuánto tienes de cada cosa, tu última y las más fáciles que te faltan */}
      <section className="cl-cab">
        <div className="cl-anillo">
          <Anillo n={suma[0]} de={suma[1]} tam={typeof window !== 'undefined' && window.innerWidth < 760 ? 100 : 128} />
          <span><b>{suma[0]}</b><small>de {suma[1]} piezas</small></span>
        </div>
        <ul className="cl-st">
          {tot.map(([t, n, de]) => <li key={t}><span>{t}</span><b>{n}<small>/{de}</small></b><Bar n={n} de={de} /></li>)}
        </ul>
        <div className="cl-ult">
          {ultima ? (<>
            <span className="cl-rk">Tu última</span>
            <button type="button" className={'cl-ult-i' + (RAREZA(p(ultima[0]))[0] ? ' r-' + RAREZA(p(ultima[0]))[0] : '')} onClick={() => tocar(ultima[0])}>
              <span aria-hidden="true">{ultima[1]}</span><b>{ultima[2]}</b></button>
          </>) : <><span className="cl-rk">Tu primera</span><p className="ves-nota">Juega tu primer evento y te llevas Debut.</p></>}
          {cerca.length ? (<>
            <span className="cl-rk">Las que tiene más gente y tú no</span>
            <ul className="cl-cerca">
              {cerca.map(([id, ic, n]) => (
                <li key={id}><button type="button" onClick={() => tocar(id)}><span aria-hidden="true">{ic}</span>
                  <span><b>{n}</b><small>{RAREZA(p(id))[1]} · la tiene el {pctTxt(p(id))}</small></span></button></li>
              ))}
            </ul>
          </>) : null}
        </div>
      </section>

      <div className="cl-cuerpo">
        {/* 🗂️ las categorías con su barra (en el celular, chips) */}
        <nav className="cl-nav" aria-label="Categorías">
          <span className="cl-rk">Insignias</span>
          {cats.map(([c, n, m, de]) => (
            <button key={c} type="button" aria-pressed={cat === c} className={cat === c ? 'on' : ''} onClick={() => { setCat(c); setSel(''); }}>
              <b>{n}</b><small>{m}/{de}</small><Bar n={m} de={de} /></button>
          ))}
          {otras.length ? <span className="cl-rk">Lo demás</span> : null}
          {otras.map(([c, n, m, de]) => (
            <button key={c} type="button" aria-pressed={cat === c} className={cat === c ? 'on' : ''}
              onClick={() => { if (c === 'estilos') onEstilos(); else { setCat(c); setSel(''); } }}>
              <b>{n}</b><small>{m}/{de}</small><Bar n={m} de={de} /></button>
          ))}
          {pct ? (<>
            <span className="cl-rk">Rareza</span>
            <p className="cl-ley">{[['t4', 'Común'], ['t3', 'Rara'], ['t2', 'Épica'], ['t1', 'Legendaria']].map(([c, n]) => <span key={c} className={'r-' + c}><i />{n}</span>)}</p>
          </>) : null}
        </nav>

        <section className="cl-der">
          {cat === 'titulos' ? Titulos : cat === 'marcos' ? Marcos : (<>
            {ficha}
            <div className="cl-fil" role="tablist" aria-label="Qué mostrar">
              {FILTROS.filter(([f]) => f !== 'raras' || pct).map(([f, n]) => (
                <button key={f} type="button" role="tab" aria-selected={filtro === f} className={filtro === f ? 'on' : ''} onClick={() => setFiltro(f)}>{n}</button>
              ))}
            </div>
            {xs.length ? (
              <div className="cl-grid">
                {xs.map(([id, ic, n]) => {
                  const pp = p(id);
                  const [rc, rn] = RAREZA(pp);
                  const mia = mias.has(id);
                  return (
                    <button key={id} type="button" aria-pressed={elegida && elegida[0] === id}
                      className={'cl-it' + (rc ? ' r-' + rc : '') + (mia ? ' mia' : '') + (elegida && elegida[0] === id ? ' sel' : '')} onClick={() => tocar(id)}>
                      <span className="cl-it-ic" aria-hidden="true">{ic}</span>
                      {mia ? null : <svg className="cl-lk" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="1" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>}
                      <b>{n}</b>
                      {rn ? <small><i />{rn} · {pctTxt(pp)}</small> : <small>{mia ? 'La tienes' : 'Por ganar'}</small>}
                    </button>
                  );
                })}
              </div>
            ) : <p className="ves-nota">{filtro === 'mias' ? 'Todavía no tienes ninguna de esta categoría.' : 'Las tienes todas.'}</p>}
          </>)}
        </section>
      </div>
    </div>
  );
}
