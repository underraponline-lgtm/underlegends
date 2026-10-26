// 🏆 LA SEMANA EN EL INICIO (26/10/2026). Dlx, a la maqueta del Inicio 4: «prefiero el actual pero me gustan las
// agregaciones que agregaste, eso de posiciones de los mini eventos». Así que el Inicio no cambia: se le suma esto, una
// sección, con EN QUÉ VAS en cada competencia (o, sin entrar, cómo va cada una) y el link a Competencias
import { Sec } from './piezas.jsx';
import { dondeEstoy, nombreDe, nombreLiga, useCompetencias } from './competencias_datos.js';

export function SemanaComp({ liga, dc }) {
  const C = useCompetencias();
  if (!C || !C.ligas || !(C.copa || []).length) return null;
  const yo = (liga && liga.yo && liga.yo.k) || (dc && dc.clave) || '';
  const d = dondeEstoy(C, yo);
  const L = C.ligas;
  const pct = (p) => Math.round((p || 0) * 100) + ' %';
  const contra = (c) => (c ? 'Contra ' + nombreDe(liga, C, c.rival) + (c.m[2] ? '' : ' · ' + pct(c.p)) : '');
  const cajas = d ? [
    d.liga ? ['LIGA ' + nombreLiga(C, d.liga.g).toUpperCase(), d.liga.pos + '.º', contra(d.liga.cruce)] : ['LIGAS', 'J' + L.jornada, 'Entras la temporada que viene'],
    d.elite ? ['ÉLITE', d.elite.pos + '.º', contra(d.elite.cruce)] : null,
    d.copa ? ['COPA · LLAVE ' + d.copa.r.id, d.copa.campeon ? 'Campeón' : d.copa.fuera ? 'Afuera' : (d.copa.ronda || {}).r || '—', d.copa.fuera ? 'Quedaste en ' + ((d.copa.ronda || {}).r || 'octavos').toLowerCase() : 'Sigues en carrera'] : ['COPA', '—', 'Esta semana no estás'],
    d.rapid ? ['RAPID', d.rapid.campeon ? 'Campeón' : d.rapid.fuera ? 'Afuera' : (d.rapid.ronda || {}).r || '—', d.rapid.fuera ? 'Quedaste en ' + ((d.rapid.ronda || {}).r || 'cuartos').toLowerCase() : 'Sigues en carrera'] : null,
  ].filter(Boolean) : [
    ['LIGAS', 'J' + L.jornada, (L.g || []).length + ' ligas · de 9 jornadas'],
    ['COPA', String(C.copa.length), 'llaves de 16 · ' + C.activos + ' activos'],
    ['RAPID', String((C.rapid || []).length), 'llaves de 8 esta semana'],
  ];
  return (
    <Sec id="i-semana-comp" titulo={'La semana · día ' + C.dia + ' de 7'} enlace="Competencias" href="#/competencias">
      <div className="sc8">
        <div className="sc8-dias" aria-hidden="true">{[1, 2, 3, 4, 5, 6, 7].map((x) => <i key={x} className={x < C.dia ? 'ya' : x === C.dia ? 'hoy' : ''} />)}</div>
        <ul className="sc8-cajas">
          {cajas.map(([t, b, s]) => <li key={t}><span>{t}</span><b>{b}</b><small>{s}</small></li>)}
        </ul>
      </div>
    </Sec>
  );
}
