// 🔒 «TU CARTA TE ESPERA», EN EL PERFIL DE QUIEN NO SE VERIFICÓ (23/11/2026). Dlx, a la pregunta de si la regla de las
// tarjetas se quedaba (sólo los Miembros de DRA tienen carta): «yes add it, and maybe other ways to remind people they are
// 1 step away to get cards, and more awards». Lo medido ese día: 66 de las 200 filas del Ranking están sin verificar —59
// por el rol de DRA—, y entre ellas hay quien tiene 34 eventos y 5 llaves ganadas. Hasta acá el perfil lo decía en una
// línea rosa debajo del nombre (`pf-nv`); ahora es un panel con SU carta de Servidor con candado y lo que gana al
// verificarse, con sus números.
//
// ⚠️ NADA DE LO QUE PROMETE ES INVENTADO, y cada línea sale de una regla del código:
//   · la Servidor sale al verificarse, la Competitiva con sus 10 eventos de Tier 1 o 2 (`requisitos` del payload, que sale
//     de comun/requisitos.py; los que cuentan son `evc`, o `ev` si son todos) y la Temporada con el nivel 1 del Pase, que
//     es sólo de Miembros (bot/pase.py). Una carta que ya tiene (`f.c`: quien conserva las suyas) no se ofrece.
//   · el número: quien está fuera de concurso sale «—» en todos los rankings; el que tendría es contar los que tienen
//     número y van antes por mérito (`o`), que es como el ciclo le pondría el suyo (bot/subir_web.py). Si está más allá
//     de las 200 filas no se puede contar, y no se dice.
//   · los MES AWARDS: `mes_awards.numeros()` saca a los fuera de concurso de Rapero del mes y Revelación (votar sí puede).
//   · los drops: desde el 17/11 se le dan a todo ganador con su cuenta conocida y abrirlos es de Miembros
//     (bot/drops_merito.py). Sin Discord vinculado (`nv: 'id'`) no hay cuenta a quién dárselos: esa línea no va.
// En el perfil de otro, «Avísale» copia (o comparte, en el celular) el link a este perfil con una frase: quien lo ve es
// muchas veces un amigo de la misma llave, y el aviso le llega por quien conoce, no por el bot (el bot no manda DMs).
import { Cara, Compartir, Ico, enlace } from './piezas.jsx';
import { limpio, siglaDe } from './liga.js';
import * as RQ from './requisitos.js';

// cuántos eventos pide la Competitiva, del payload («10 eventos»); sin payload, los de hoy
function pideComp(liga) {
  const r = ((liga.d && liga.d.requisitos) || []).find((x) => x.id === 'competitivo');
  const m = r && (r.pide || []).join(' ').match(/(\d+)\s*evento/i);
  return m ? Number(m[1]) : 10;
}

// el número que tendría en la Temporada: los que tienen número y van antes por mérito, más uno. 0 si no se puede saber
export function puestoSiVerifica(liga, f) {
  if (!f || f.pos || !f.o) return 0;
  const tabla = (liga.d && liga.d.tabla) || [];
  const ultimo = tabla.reduce((m, x) => Math.max(m, x.o || 0), 0);
  if (!ultimo || f.o > ultimo) return 0;
  return tabla.filter((x) => x.pos && (x.o || 0) < f.o).length + 1;
}

// lo que se abre al verificarse, en el orden en que llega: [ícono, título, frase]
export function loQueGana(liga, f, tu) {
  const c = f.c || [];
  const out = [];
  const sv = f.sv ? siglaDe(f.sv) : '';
  if (sv && !c.includes('servidor')) out.push(['servidor', 'Tarjeta de Servidor · ' + sv, tu ? 'Sale al verificarte.' : 'Sale al verificarse.']);
  if (!c.includes('competitivo')) {
    const pide = pideComp(liga);
    const ev = f.evc != null ? f.evc : (f.ev || 0);
    out.push(['tarjetas', 'Tarjeta Competitiva', ev >= pide
      ? (tu ? 'Ya tienes tus ' + ev + ' eventos: sale al verificarte, con tu rango.' : 'Ya tiene sus ' + ev + ' eventos: sale al verificarse, con su rango.')
      : 'Con ' + pide + ' eventos de servidores Tier 1 o 2: ' + (tu ? 'llevas ' : 'lleva ') + ev + '.']);
  }
  if (!c.includes('temporada')) out.push(['pase', 'Tarjeta de Temporada', 'Con el nivel 1 del Pase de rapero (dos Tareas diarias), que ' + (tu ? 'se te abre' : 'se abre') + ' con el rol.']);
  if (f.fc || !f.pos) {
    const n = puestoSiVerifica(liga, f);
    out.push(['ranking', tu ? 'Tu número en el Ranking' : 'Su número en el Ranking', n
      ? 'Hoy sale «—»: ' + (tu ? 'serías' : 'sería') + ' el #' + n + ' de la Temporada.'
      : 'Hoy sale «—» en cada ranking: con el rol, ' + (tu ? 'tu' : 'su') + ' número.']);
    out.push(['premio', 'MES AWARDS', tu ? 'Entras a Rapero del mes y Revelación: hoy no te pueden nominar.' : 'Entra a Rapero del mes y Revelación: hoy no está en las nominaciones.']);
  }
  if (f.nv !== 'id') out.push(['regalo', tu ? 'Los drops de tus llaves' : 'Los drops de sus llaves', tu ? 'Los que ganas se guardan: se abren al verificarte.' : 'Los que gana se guardan: se abren al verificarse.']);
  return out;
}

// la carta con candado: su cara apagada en el color de su servidor, como la Bloqueada de comun/bloqueada.py (la foto va
// apagada y detrás del velo: es su cara, pero todavía no es su carta). Es un dibujo de la página, no una carta de R2
function CartaCandado({ liga, f, k }) {
  const s = (liga.svs && liga.svs[f.sv]) || {};
  return (
    <div className="tce-carta" style={s.color ? { '--tce-sv': s.color } : undefined} aria-hidden="true">
      {f.sv ? <img className="tce-logo" alt="" src={liga.logo(f.sv)} /> : null}
      <Cara liga={liga} k={k} nombre={f.n} cls="tce-cara" />
      <span className="tce-velo" />
      <span className="tce-cand"><Ico n="candado" t={26} /></span>
      <b className="tce-n">{limpio(f.n)}</b>
      <small>TE ESPERA</small>
    </div>
  );
}

export function TeEspera({ liga, f, k, esYo, dc }) {
  if (!f || !f.nv) return null;
  const items = loQueGana(liga, f, esYo);
  const nombre = limpio(f.n);
  // ¿puede ser esa persona quien mira? Un verificado que es otro, no: a él le sirve «Avísale» y nada más
  const otroVerificado = !!(dc && dc.clave && dc.clave !== k);
  return (
    <section className="sec pf-sec tce" aria-label={esYo ? 'Tu carta te espera' : 'La carta de ' + nombre + ' espera'}>
      <div className="tce-caja">
      <CartaCandado liga={liga} f={f} k={k} />
      <div className="tce-tx">
        <small className="tce-k">Sin verificar{f.fc || !f.pos ? ' · fuera de concurso' : ''}</small>
        <h2>{esYo ? 'Tu carta te espera' : 'La carta de ' + nombre + ' espera'}</h2>
        <p className="tce-p">{esYo ? 'Estás a un paso. ' : 'Está a un paso. '}{RQ.sinVerificar(f.nv, esYo)}</p>
        {items.length ? (
          <ul className="tce-lista">
            {items.map(([ico, t, x]) => <li key={t}><Ico n={ico} t={18} /><span><b>{t}</b>{x}</span></li>)}
          </ul>
        ) : null}
        <div className="tce-btns">
          {esYo ? <a className="btn verde" href="#/cuenta/verificar">Verificarme</a>
            : !otroVerificado ? <a className="btn verde" href="#/cuenta/verificar">¿Eres {nombre}? Verifícate</a> : null}
          {esYo ? <span className="tce-nota">Entras con Discord, eliges tu país y el bot hace el resto.</span>
            : <Compartir cls="btn borde" etiqueta="Avísale" titulo="Liga Global"
              url={enlace('r/' + encodeURIComponent(k))} texto={nombre + ': tu carta de la Liga Global te espera. Te falta verificarte:'} />}
        </div>
      </div>
      </div>
    </section>
  );
}
