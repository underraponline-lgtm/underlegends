// ⚖️ LA FICHA DE UN JURADO, EN SU PERFIL (26/10/2026). Dlx: «un score de cada jurado, basado en lo que ellos votan… a
// quién votan más, menos», y a si era pública, «sí, que sea para el público». La arma `bot/competencias.py` (jurados())
// con quién votó a quién en cada batalla de #veredictos, y viaja con las competencias (`jur`). Vive aparte de la página
// de Competencias para que el perfil no se baje la página entera.
import { useCompetencias } from './competencias_datos.js';
import { usarCss } from './css.js';

usarCss('jurado-ficha', `
.jf{display:flex;flex-direction:column;gap:12px;padding:16px;border:1.6px solid var(--esc-linea,#2A2A2C)}
.jf header{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.jf-chip{display:inline-flex;align-items:center;gap:7px;padding:6px 9px;background:#E41373;color:#FFFFFF;font:700 14px/1 "Barlow Condensed",sans-serif;letter-spacing:.08em}
.jf header b{font:900 30px/1 Archivo,sans-serif;font-stretch:120%}
.jf header small{font:700 12px/1 "Barlow Condensed",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--esc-gris,#A5A5A0)}
.jf dl{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin:0}
.jf dl div{display:flex;flex-direction:column;gap:5px;padding:10px;border:1.5px solid var(--esc-linea,#2A2A2C)}
.jf dt{font:700 11px/1.1 "Barlow Condensed",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--esc-gris,#A5A5A0)}
.jf dd{margin:0;font:900 17px/1.15 Archivo,sans-serif}
.jf p{margin:0;font:500 13.5px/1.45 Archivo,sans-serif;color:var(--esc-gris,#A5A5A0)}
`);

export function FichaJurado({ k }) {
  const C = useCompetencias();
  const f = C && C.jur && C.jur[k];
  if (!f || !f.v) return null;
  const P = (x) => (x == null ? '—' : Math.round(x * 100) + ' %');
  return (
    <section className="sec pf-sec" aria-label="Ficha de jurado">
      <div className="sec-t"><h2>Como jurado</h2></div>
      <div className="jf">
        <header><span className="jf-chip">⚖️ JURADO</span><b>{f.nota != null ? f.nota.toFixed(1) : '—'}</b><small>{f.nota != null ? 'nota de jurado, del 1 al 10' : 'pocos votos todavía para una nota'}</small></header>
        <dl>
          <div><dt>Votos</dt><dd>{f.v}</dd></div>
          <div><dt>Coincide con el resultado</dt><dd>{P(f.co)}</dd></div>
          <div><dt>Vota al favorito</dt><dd>{P(f.fa)}</dd></div>
          <div><dt>Con gente de su servidor</dt><dd>{P(f.pr)}</dd></div>
          {f.mas ? <div><dt>A quien más votó</dt><dd>{f.mas[0]} ({f.mas[1]})</dd></div> : null}
          {f.menos ? <div><dt>Contra quien más votó</dt><dd>{f.menos[0]} ({f.menos[1]})</dd></div> : null}
        </dl>
        <p>La nota sale de cuántas veces su voto coincide con el resultado. Se cuenta con lo que votó en #veredictos desde el 26/10.</p>
      </div>
    </section>
  );
}
