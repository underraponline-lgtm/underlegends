// 🗳️ LA VOTACIÓN DE LOS MES AWARDS DE UN SERVIDOR, EN UN SOLO LUGAR (17/11/2026, el remake «D» del Salón: Dlx eligió la D
// de la maqueta). La usan el Salón (salon2.jsx) y la página de cada servidor (`MesSv` de servidor.jsx): hasta acá cada
// una votaba con su propia tarjeta (la `Categoria` de salon2.jsx y la de mesawards.jsx) y se veían distintas.
// - LA FRANJA BLANCA, la del Inicio: cuántas votaste de ese servidor, cuándo cierra y el Cajón de discos por votarlas
//   todas (`cofreMes()` de bot/avisos.js); el resto del mes, cuándo salen los nominados.
// - CADA CATEGORÍA con sus nominados en tarjetas: la carta de Temporada de quien la tiene (Rapero y Revelación), el video
//   de la Batalla, la cara del Staff; «✓ Tu voto» en la tuya.
// - 🤫 LOS PORCENTAJES, SÓLO AL CERRAR (la maqueta: «los porcentajes se ven sólo al cerrar»): mientras se vota no se ve
//   cuántos van; con el mes cerrado, el ganador primero con «GANÓ» y el reparto (`reparto()`).
// 🏆 Y LA GALA DE CADA TEMPORADA (17/11/2026): lo de toda la Liga al cierre (`gala` de /api/salon, bot/mes_awards.py).
// La misma franja (`FranjaGala`: votar las 4 principales da un Flight case), las mismas tarjetas para las 4 principales y
// una fila compacta para las otras 22 (`CatCompacta`).
// ⚠️ Las clases van con `sd-`: las del prototipo son globales adentro del shadow root.
import { MESES, siglaDe, utc } from './liga.js';
import { Cara, Carta, Ico, accion } from './piezas.jsx';
import { Miniatura } from './video.jsx';
import { nomTexto, reparto } from './mesawards.jsx';
import CSS_VOTO from './css/mesvoto.css?inline';
import { usarCss } from './css.js';

// 🗳️ QUIÉN VOTA LOS DE UN SERVIDOR, EN UNA SOLA FRASE. Lo decide el Worker (`validarVoto()`: los que jugaron ahí ese mes,
// de `votantes()` de bot/mes_awards.py, y desde el 17/11/2026 —Dlx, «2: B»— los que lo eligieron como su servidor). Si
// la regla cambia, se cambia acá y en ningún otro lado de la página
export const QUIEN_VOTA = (sigla, mes) => 'Votan los que jugaron en ' + sigla + (mes ? ' en ' + mes : ' ese mes') +
  ' y los que lo eligieron como su servidor.';
// 🐉 lo que se lleva cada ganador de un servidor desde noviembre (Dlx, «4: A»; `DROP_SV` de bot/mes_awards.py, en
// `/api/salon` como `drop_sv`): el Rapero un Nido, los demás un Star Dragon
export const PREMIO_SV = (S) => (S && S.drop_sv ? 'un Nido de dragón (el Rapero del mes) o un Star Dragon (las demás)'
  : S && S.premio_sv && S.premio_sv.rapero ? S.premio_sv.rapero.toLocaleString('es') + ' Puntos de Tienda' : '');
// 🎁 los cofres de los Dragón Drops, de menos a más (el `t` de `cofre5:<t>:`, como `COFRES` de drops.jsx): el 0 por votar
// las de tu servidor, el 1 por votar las 4 principales de la gala, y los premios de la gala salen de su `drop`
// (`DROP_GALA` de bot/mes_awards.py: 'cofre:4' es el Tesoro del Dragón)
const COFRES_N = ['Cajón de discos', 'Flight case', 'Baúl de los objetos', 'Funda del Campeón', 'Tesoro del Dragón'];
export const COFRE = COFRES_N[0];
export const COFRE_GALA = COFRES_N[1];
// 🗳️ quién vota la gala: cualquiera con Discord (con la cuenta de 30 días o más: `validarVoto()` de bot/avisos.js)
export const QUIEN_VOTA_GALA = 'Vota cualquiera con Discord.';
// 🏆 lo que se lleva cada ganador de la gala, con el artículo: [quiénes, qué]. Sin `drop` en el payload, nada (no se inventa)
export function premiosGala(g) {
  const d = (g && g.drop) || {};
  const de = (k) => {
    const m = /^cofre:(\d)$/.exec(String(d[k] || ''));
    const n = m ? COFRES_N[Number(m[1])] : '';
    return n ? (/^Funda/.test(n) ? 'la ' : 'el ') + n : '';
  };
  const out = [];
  if (de('rapero')) out.push(['El Rapero de la temporada', de('rapero')]);
  if (de('revelacion') && de('revelacion') === de('batalla')) out.push(['La Revelación y la Batalla', de('revelacion')]);
  else {
    if (de('revelacion')) out.push(['La Revelación', de('revelacion')]);
    if (de('batalla')) out.push(['La Batalla', de('batalla')]);
  }
  if (de('personas')) out.push(['Cada una de las de personas', de('personas')]);
  if (out.length) out.push(['Servidor, Crew, País y Liga', 'su lugar en el Salón y la publicación']);
  return out;
}
// el nombre y el «por qué» de una categoría de la Liga, para la gala: «Rapero del mes» → «Rapero de la temporada»
export const deTemporada = (s) => String(s || '').replace(/\bdel mes\b/g, 'de la temporada').replace(/\ben el mes\b/g, 'en la temporada')
  .replace(/\b(ese|este) mes\b/g, 'en la temporada');

const css = () => usarCss('mesvoto', CSS_VOTO);
export const cssVoto = css;
export const mayus = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
export const mesDe = (m) => MESES[Number(String(m || '').slice(5, 7)) - 1] || '';

// ⏱️ «2D 14H», «5H 08M», «12 MIN»: lo que falta, con `liga.ahora` (App.jsx lo mueve cada minuto). '' si ya pasó
export function falta(liga, t) {
  const seg = Math.floor((utc(t) - liga.ahora) / 1000);
  if (!(seg > 0)) return '';
  const d = Math.floor(seg / 86400);
  const h = Math.floor((seg % 86400) / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const dos = (x) => String(x).padStart(2, '0');
  return d ? d + 'D ' + dos(h) + 'H' : h ? h + 'H ' + dos(m) + 'M' : Math.max(1, m) + ' MIN';
}

// 🕚 cuándo salen los nominados del mes que corre. `vivo` trae sólo cuándo se vota (las 6 PM ET del día 1, `ABRE_H`); los
// nominados salen el mismo día a las 11 AM ET (`NOMINA_H` de bot/mes_awards.py): 7 horas antes. Si un día el payload lo
// trae (`nominado`), manda ése
export const nominadoDe = (viv) => (viv.nominado ? viv.nominado : new Date(utc(viv.vota).getTime() - 7 * 3600000).toISOString());

// las categorías de ese servidor ese mes que se votan —las de dos nominados o más, como `encuestas()` de
// bot/mes_awards.py— y cuáles votaste. `id(c)`: la encuesta del Worker. Votarlas todas da el cofre
export function votosSv(enc, S, sv) {
  const ab = S && S.abierto;
  const s = ab && ab.sv && ab.sv[sv];
  const id = (c) => 'mes:' + (ab ? ab.mes : '') + ':' + sv + ':' + c;
  if (!s) return { cats: [], hechas: [], n: 0, N: 0, id };
  const cats = (S.cats_sv || []).map(([c]) => c).filter((c) => ((((s.cats || {})[c] || {}).nom) || []).length >= 2);
  const mio = (enc && enc.mio) || {};
  const hechas = cats.filter((c) => mio[id(c)]);
  return { cats, hechas, n: hechas.length, N: cats.length, id };
}

// 🎁 el cofre, dibujado: dos discos sobre un cajón de madera
export function IcoCofre() {
  return (
    <svg className="sd-cofre-ic" viewBox="0 0 44 34" aria-hidden="true">
      <circle cx="15" cy="12" r="10" fill="#111" stroke="#E5B800" strokeWidth="2" /><circle cx="15" cy="12" r="3" fill="#E5B800" />
      <circle cx="29" cy="11" r="9" fill="#111" stroke="#E41373" strokeWidth="2" /><circle cx="29" cy="11" r="2.6" fill="#E41373" />
      <rect x="2" y="15" width="40" height="17" fill="#8B5A24" stroke="#030304" strokeWidth="2" /><path d="M2 21h40" stroke="#030304" strokeWidth="1.5" />
      <rect x="18" y="19" width="8" height="6" fill="#E5B800" stroke="#030304" strokeWidth="1.2" />
    </svg>
  );
}
// «Vota las 3 y ganas un Cajón de discos» → «te faltan 2 para el Cajón de discos» → «Tu Cajón de discos, listo». En la
// gala, `cofre` es el Flight case y `que`, «las 4 principales»
function PremioVoto({ n, N, cofre = COFRE, que }) {
  const listo = N > 0 && n >= N;
  const k = N - n;
  return (
    <span className={'sd-cofre' + (listo ? ' sd-listo' : '')}>
      <IcoCofre />
      <span><b>{listo ? 'Tu ' + cofre + ', listo' : 'Vota ' + (que || (N === 1 ? 'la categoría' : 'las ' + N)) + ' y ganas'}</b>
        <small>{listo ? 'Ya está en tus Dragón Drops' : !n ? 'un ' + cofre : 'te ' + (k === 1 ? 'falta 1' : 'faltan ' + k) + ' para el ' + cofre}</small></span>
    </span>
  );
}

// 🏆 las 4 principales de la gala que se votan (las de dos nominados o más, como `encuestas()` de bot/mes_awards.py) y
// cuáles votaste. `id(c)`: la encuesta, `mes:t1:<cat>`. Votarlas todas da el Flight case
export function votosGala(enc, S) {
  const g = S && S.gala;
  const temp = String((g && g.temp) || '').toLowerCase();
  const id = (c) => 'mes:' + temp + ':' + c;
  const cats = g && g.cats ? (S.cats || []).filter((c) => !c[3]).map(([c]) => c).filter((c) => ((((g.cats[c] || {}).nom) || []).length >= 2)) : [];
  const mio = (enc && enc.mio) || {};
  const hechas = cats.filter((c) => mio[id(c)]);
  return { cats, hechas, n: hechas.length, N: cats.length, id };
}
// ── la franja de la gala: «La gala de la T1 · votaste 2 de 4», cuándo cierra (o abre) y el Flight case ──
export function FranjaGala({ liga, enc, S, modo }) {
  css();
  const g = S.gala;
  const v = votosGala(enc, S);
  const vota = modo === 'vota';
  const t = vota ? g.cierra : g.abre;
  const f = falta(liga, t);
  return (
    <div className="sd-franja">
      <span className="sd-fr-copa" aria-hidden="true"><Ico n="copa" t={22} /></span>
      <div className="sd-fr-tx">
        <b>La gala de la {g.temp} · {vota ? 'votaste ' + v.n + ' de ' + v.N : 'ya salieron los nominados'}</b>
        <small>{vota ? 'Cierra ' + liga.dia(t) : 'La votación abre ' + liga.dia(t)}{f ? ' · ' + f : ''}</small>
      </div>
      {vota && v.N ? <span className="sd-pips" role="img" aria-label={'Votaste ' + v.n + ' de ' + v.N}>
        {v.cats.map((c) => <i key={c} className={v.hechas.includes(c) ? 'sd-on' : ''} />)}</span> : null}
      <span className="sd-fr-sp" />
      {v.N ? <PremioVoto n={vota ? v.n : 0} N={v.N} cofre={COFRE_GALA} que={'las ' + v.N + ' principales'} /> : null}
    </div>
  );
}

// ── la franja blanca. `modo`: 'vota' (se vota), 'nominados' (salieron y todavía no se vota) o 'espera' (corre el mes).
// `propio`: en la página de un servidor, «votar las de FFA»; en el Salón, «las de tu servidor» ──
export function Franja({ liga, enc, S, sv, modo, propio }) {
  css();
  if (modo === 'espera') {
    const viv = S && S.vivo;
    if (!viv) return null;
    const t = nominadoDe(viv);
    const f = falta(liga, t);
    return (
      <div className="sd-franja" role="status">
        <div className="sd-fr-tx"><b>Los nominados de {viv.nombre} salen {f ? 'en' : 'hoy'}</b>
          <small>{mayus(liga.dia(t))} · votar las de {propio ? siglaDe(sv) : 'tu servidor'} da un {COFRE}</small></div>
        <span className="sd-fr-sp" />
        {f ? <span className="sd-reloj">{f}</span> : null}
      </div>
    );
  }
  const ab = S.abierto;
  const v = votosSv(enc, S, sv);
  const vota = modo === 'vota';
  const t = vota ? ab.cierra : ab.abre;
  const f = falta(liga, t);
  return (
    <div className="sd-franja">
      <img className="sd-fr-lg" alt="" src={liga.logo(sv)} />
      <div className="sd-fr-tx">
        <b>{siglaDe(sv)} · {vota ? 'votaste ' + v.n + ' de ' + v.N : v.N ? 'ya salieron los nominados' : 'sin votación este mes'}</b>
        <small>{vota ? 'Cierra ' + liga.dia(t) : 'La votación abre ' + liga.dia(t)}{f ? ' · ' + f : ''}</small>
      </div>
      {vota && v.N ? <span className="sd-pips" role="img" aria-label={'Votaste ' + v.n + ' de ' + v.N}>
        {v.cats.map((c) => <i key={c} className={v.hechas.includes(c) ? 'sd-on' : ''} />)}</span> : null}
      <span className="sd-fr-sp" />
      {v.N ? <PremioVoto n={vota ? v.n : 0} N={v.N} /> : null}
    </div>
  );
}

// ── los botones de servidor: cuál se mira. `cuenta(sv)`: cuántos premios tiene (0 = apagado, se puede tocar igual) ──
export function ChipsSv({ liga, svs, sv, onSv, cuenta, etiqueta }) {
  css();
  return (
    <div className="sd-svs" role="group" aria-label={etiqueta}>
      {svs.map((x) => {
        const n = cuenta(x);
        const s = liga.svs[x] || {};
        return (
          <button key={x} type="button" className={'sd-sv' + (x === sv ? ' sd-on' : '') + (n ? '' : ' sd-off')} style={{ '--c': s.color || 'transparent' }}
            aria-pressed={x === sv} onClick={() => onSv(x)}>
            <img alt="" src={liga.logo(x)} />{siglaDe(x)}<small>{n ? n + (n === 1 ? ' premio' : ' premios') : 'sin premios'}</small>
          </button>
        );
      })}
    </div>
  );
}

// lo que se ve de un nominado en chico: el escudo del servidor, la bandera, el video o la imagen de las de la Liga
// (bot/mes_otros.py), o la cara. Es lo mismo que decide `Nominado` de mesawards.jsx, con las clases de acá
function visChica(liga, cat, y, t) {
  if (cat === 'servidor') return <img className="sd-cara" alt="" src={liga.logo(y.op)} />;
  if (y.d !== undefined) {
    if (y.vid) return <Miniatura vid={y.vid} cls="sd-cuad" />;
    if (y.img) return <img className="sd-cuad" alt="" src={y.img} loading="lazy" />;
    if (y.cc) return <img className="sd-cuad sd-flag" alt="" src={'/banderas/g/' + y.cc + '.webp'} />;
    if (y.sv && !y.q) return <img className="sd-cara" alt="" src={liga.logo(y.sv)} />;
  }
  return <Cara liga={liga} k={t.k} nombre={t.q} cls="sd-cara" />;
}

// ── un nominado: la carta, el video o la cara, su nombre, su número y el botón ──
function Nom({ liga, cat, y, tipo, E, mio, va, gana }) {
  const t = nomTexto(liga, cat, y);
  const vis = tipo === 'vid' ? <Miniatura vid={y.op} cls="sd-vid" />
    : tipo === 'carta' ? <Carta liga={liga} k={t.k} cual="temporada" abre={false} cls="sd-ct" nombre={t.n} />
      : visChica(liga, cat, y, t);
  const es = mio === y.op;
  const cls = 'sd-nom' + (es ? ' sd-mio' : '') + (gana ? ' sd-gana' : '') + (va === y.op ? ' sd-va' : '');
  const cuerpo = (
    <>
      {gana ? <span className="sd-gano">GANÓ</span> : null}
      {vis}
      <span className="sd-nt"><b>{t.n}</b><small>{t.d}</small></span>
      {E ? <span className="sd-votar" aria-hidden="true">{va === y.op ? 'Guardando…' : es ? '✓ Tu voto' : 'Votar'}</span> : null}
    </>
  );
  return E ? (
    <button type="button" className={cls} aria-pressed={es} onClick={() => accion.votar(E.id, y.op)}
      aria-label={(es ? 'Tu voto: ' : 'Votar a ') + t.n}>{cuerpo}</button>
  ) : <div className={cls}>{cuerpo}</div>;
}

// ── una categoría: a la izquierda qué es, a la derecha sus nominados (en el celular, de costado) ──
// `encId`: la encuesta, si se vota; `cerrado`: el mes cerró (el ganador primero, con su reparto); `gala`: es de la gala
export function CatVoto({ liga, enc, cat, nombre, de, x, encId, cerrado, nota, gala }) {
  css();
  const nom0 = (x && x.nom) || [];
  if (!nom0.length) return null;
  const gana = cerrado ? x.gana : '';
  const nom = gana ? nom0.filter((y) => y.op === gana).concat(nom0.filter((y) => y.op !== gana)) : nom0;
  const E = encId ? ((liga.d.enc || []).find((e) => e.id === encId) || null) : null;
  const mio = E && enc ? enc.mio[E.id] : '';
  const est = (E && enc && enc.est[E.id]) || {};
  // con la carta cuando alguno de los nominados la tiene; los que no, con su cara y «SIN CARTA», del mismo tamaño
  const carta = (cat === 'rapero' || cat === 'revelacion') && nom.some((y) => { const k = nomTexto(liga, cat, y).k; return k && liga.cartaUrl(k, 'temporada'); });
  const tipo = cat === 'batalla' ? 'vid' : carta ? 'carta' : 'cara';
  // en la compu, las columnas: cinco caras; las cartas, de a cuatro o cinco (tres en cinco columnas dejaban un hueco del
  // alto de una carta); los videos, tantos como haya (dos videos a lo ancho y no dos chiquitos y tres huecos)
  const cols = tipo === 'vid' ? Math.min(5, Math.max(2, nom.length)) : tipo === 'carta' ? Math.min(5, Math.max(4, nom.length)) : 5;
  // lo que dice el voto (guardando, el error, «votaste por…»): sólo cuando hay algo que decir, no «toca para votar» ×4
  const pie = E && enc && (est.va || est.error || mio) ? enc.pie(E, (op) => nomTexto(liga, cat, nom.find((y) => y.op === op) || { op, n: op }).n) : '';
  return (
    <div className={'sd-cat sd-t-' + tipo}>
      <div className="sd-cat-t">
        <b>{nombre}</b>
        <small>Por {de}</small>
        {nota ? <span className="sd-nota">{nota}</span> : null}
        {cerrado ? (x.por === 'votos' ? reparto(x, liga) : <span className="sd-nota sd-gris">Lo decidieron los números {gala ? 'de la temporada' : 'del mes'}</span>) : null}
        {!cerrado && nom.length < 2 ? <span className="sd-nota sd-gris">Un solo nominado: sin votación</span> : null}
        {pie ? <span className="sd-pie" aria-live="polite">{pie}</span> : null}
      </div>
      <ol className="sd-noms" style={{ '--cols': cols }} aria-label={nombre}>
        {nom.map((y) => <li key={y.op}><Nom liga={liga} cat={cat} y={y} tipo={tipo} E={E} mio={mio} va={est.va} gana={gana && y.op === gana} /></li>)}
      </ol>
    </div>
  );
}

// ── las categorías de un servidor en un mes (`m`: el mes abierto o uno cerrado) ──
// `votando`: se vota (cada categoría con su encuesta); sin eso, se ven sin botón
export function CatsSv({ liga, enc, S, sv, m, votando, cerrado }) {
  const s = (m && m.sv && m.sv[sv]) || null;
  if (!s) return null;
  const xs = (S.cats_sv || []).map(([c, n, de]) => {
    const x = (s.cats || {})[c];
    if (!x || !(x.nom || []).length) return null;
    const encId = votando && x.nom.length >= 2 ? 'mes:' + m.mes + ':' + sv + ':' + c : '';
    return <CatVoto key={c} liga={liga} enc={enc} cat={c} nombre={n} de={de} x={x} encId={encId} cerrado={cerrado} />;
  }).filter(Boolean);
  return xs.length ? <div className="sd-cats">{xs}</div> : null;
}

// ── 🏆 una de las otras 22 de la gala, compacta: qué es y sus nominados en una fila (en el celular, de costado), cada uno
// con lo que se ve, su nombre y su número. Se vota tocándolo, como las tarjetas ──
export function CatCompacta({ liga, enc, cat, nombre, de, x, encId }) {
  css();
  const nom = (x && x.nom) || [];
  if (!nom.length) return null;
  const E = encId ? ((liga.d.enc || []).find((e) => e.id === encId) || null) : null;
  const mio = E && enc ? enc.mio[E.id] : '';
  const est = (E && enc && enc.est[E.id]) || {};
  // sólo lo que hay que decir: guardando o el error (tu voto ya se ve marcado)
  const pie = E && enc && (est.va || est.error) ? enc.pie(E, (op) => nomTexto(liga, cat, nom.find((y) => y.op === op) || { op, n: op }).n) : '';
  return (
    <div className="sd-cc">
      <div className="sd-cc-t">
        <b>{nombre}</b>
        <small>Por {de}</small>
        {nom.length < 2 ? <span className="sd-nota sd-gris">Un solo nominado: sin votación</span> : null}
        {pie ? <span className="sd-pie" aria-live="polite">{pie}</span> : null}
      </div>
      <ul className="sd-cc-l" aria-label={nombre}>{nom.map((y) => {
        const t = nomTexto(liga, cat, y);
        const es = mio === y.op;
        const cls = 'sd-cc-o' + (es ? ' sd-mio' : '') + (est.va === y.op ? ' sd-va' : '');
        const cuerpo = <>{visChica(liga, cat, y, t)}<span className="sd-cc-n"><b>{t.n}</b><small>{t.d}</small></span>
          {E ? <span className="sd-cc-v" aria-hidden="true">{es ? '✓' : ''}</span> : null}</>;
        return (
          <li key={y.op}>{E ? <button type="button" className={cls} aria-pressed={es} title={t.n + ' · ' + t.d} onClick={() => accion.votar(E.id, y.op)}
            aria-label={(es ? 'Tu voto: ' : 'Votar a ') + t.n}>{cuerpo}</button> : <div className={cls} title={t.n + ' · ' + t.d}>{cuerpo}</div>}</li>
        );
      })}</ul>
    </div>
  );
}
