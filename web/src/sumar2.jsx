// 🏟️ SUMA TU SERVIDOR, «EL ASCENSO» (19/11/2026). Dlx: «quisiera q hagas una nueva pagina dando instrucciones y todo
// eso… dentro de la pagina de socio… si alguien esta interesado en meterlo, q haya un boton ahi para meterlo»; a las
// maquetas (privadas, https://claude.ai/artifact/HvHwQWjrPEj6vfyFyXysxW), «La pista» y después, a la idea de fondo,
// «El ascenso»; y «Sí, prográmala». Vive en `#/socios/sumar` y reemplaza la sección larga que tenía Socios.
//
// LA PÁGINA ES UNA LIGA:
// - el escenario negro: el pedido con el botón del bot y el marcador de la Liga; LA PRETEMPORADA (los cuatro pasos como
//   cuatro jornadas: la 2, la que hace el dueño, en blanco), y LA TABLA de los tiers, con el escudo de cada socio, sus
//   eventos, raperos, puntos y su multiplicador de la semana. Cada tier abre con la franja de lo que pide para subir al
//   de arriba, y abajo de todo aparece «Tu servidor», debutando;
// - el papel: el registro en pestañas, como la llave (Desde el debut · El bot · Cómo se asciende · Comandos y preguntas).
//
// ⚠️ LO QUE PIDE Y DA CADA TIER NO SE ESCRIBE ACÁ: viaja en `tiers_reglas` del lobby (`tiers.reglas()` de bot/tiers.py,
// con las mismas constantes que `como_subir()`): `rec` (los miembros recomendados), `sube` (lo que pide para llegar a
// cada tier) y `da` (lo que suma cada uno sobre el de abajo). Sin ese dato no se dibujan las franjas ni las frases
// (sin dato no hay pieza). El tier de cada socio es `svs[].tier`, y su multiplicador, `mult.sv`.
// ⚠️ LOS MIEMBROS NO SON UN REQUISITO (Dlx, 19/11/2026: «quita el requisito de tener miembros. La cantidad no define,
// pero puedes poner recomendado»): por eso el recomendado va chico, en la jornada 1, en «Cómo se asciende» y en una
// pregunta, y nunca como la cifra grande de un tier.
// ⚠️ EL BOTÓN AGREGA EL BOT DIRECTO (Dlx: «directo, el bot me escribe x DM que lo agregaron a X servidor»): el aviso
// lo manda el Worker cuando Discord le dice que lo agregaron (`eventosDiscord()` en bot/worker.js). Que sus eventos
// sumen lo sigue aprobando Dlx, al terminar el /setup (bot/setup.js).
// ⚠️ LAS TRES PLANTILLAS DEL /setup están copiadas de `PLANTILLAS` y `cfgDePlantilla()` de bot/setup.js: si cambia lo
// que prende cada una, se cambia acá también.
import { useState } from 'react';
import { limpio, mult, num, siglaDe } from './liga.js';
import { Cara } from './piezas.jsx';
import { DLX } from './sumar.jsx';
import CSS from './css/sumar2.css?inline';
import { usarCss } from './css.js';

usarCss('sumar2', CSS);

// el bot entra como administrador, con su propio rol (Dlx, 17/11/2026): el mismo link que el kit de cada servidor
export const BOT_LINK = 'https://discord.com/oauth2/authorize?client_id=1550026808404217926&permissions=8&integration_type=0&scope=bot+applications.commands';
// DRA es la sede: no compite como los demás socios (`CASA` de bot/tiers.py)
const CASA = new Set(['DRA']);
const COLOR_TIER = { 1: 'var(--stv-oro)', 2: 'var(--stv-plata)', 3: 'var(--stv-bronce)' };

// lo que suma cada tier, en palabras (las claves son las de `tiers_reglas.da`). Dos clases de frase: lo que CUENTA (una
// oración entera) y lo que TIENES (va detrás de «Tienes»); una clave nueva sin frase no se dibuja
const DA = {
  suma: ['cuenta', (min) => 'tus eventos de ' + (min || 8) + ' o más raperos suman a la Temporada'],
  competitivo: ['cuenta', () => 'tus eventos cuentan para el Competitivo'],
  duelos: ['cuenta', () => 'tus ligas cuentan como duelos'],
  unirse: ['cuenta', () => 'sales en «Unirme a los Tier 1», el botón que suma gente a tu Discord con un toque'],
  carta: ['tiene', () => 'la carta de tu servidor para tu gente'],
  mes_awards: ['tiene', () => 'tus MES AWARDS'],
  pagina: ['tiene', () => 'tu página en Socios'],
  calendario: ['tiene', () => 'tus eventos en el calendario y la campana'],
  ligas: ['tiene', () => 'tus ligas'],
  panel: ['tiene', () => 'tu panel'],
  // 🗞️ lo del plan de los tiers (20/11/2026): tandas B y C, las imágenes de la semana y las prendas
  estilos: ['cuenta', () => 'tus eventos dan estilos de juego'],
  pases_t1: ['cuenta', () => 'regalas los Pases premium que te da la Liga a tus campeones'],
  tarea_t1: ['cuenta', () => 'el Pase tiene una Tarea que lleva gente a tus eventos'],
  redes2: ['tiene', () => '2 imágenes por semana para tus redes'],
  redes5: ['tiene', () => '5 imágenes por semana para tus redes'],
  consejo: ['tiene', () => 'tu voto en el consejo de socios'],
  bienvenida: ['tiene', () => 'la bienvenida del bot a quien llega a tu Discord'],
  lo_nuevo: ['tiene', () => 'lo nuevo antes que nadie'],
  prendas: ['tiene', () => 'la posibilidad de camisetas y prendas de tu servidor, hechas por la Liga'],
};
const ORDEN_DA = ['suma', 'competitivo', 'duelos', 'estilos', 'unirse', 'pases_t1', 'tarea_t1', 'carta', 'mes_awards', 'redes2', 'redes5',
  'consejo', 'bienvenida', 'lo_nuevo', 'prendas', 'pagina', 'calendario', 'ligas', 'panel'];
const lista = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1] : xs[0] || '');
const mayus = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// los puntos de un servidor, cortos (como los carteles de Socios)
const corto = (n) => {
  const x = Number(n) || 0;
  if (x >= 1e6) return (x / 1e6).toFixed(1).replace('.', ',').replace(/,0$/, '') + 'M';
  if (x >= 1e5) return Math.round(x / 1e3) + 'k';
  if (x >= 1e4) return (x / 1e3).toFixed(1).replace('.', ',').replace(/,0$/, '') + 'k';
  return num(x);
};

// las tres plantillas del /setup y lo que prende cada una (bot/setup.js)
const PLANTILLAS = [['⭐', 'Liga completa'], ['📋', 'Lo básico'], ['👁', 'Sólo leer']];
const QUE_HACE = [
  ['Lee tus anuncios y tus llaves, y arma cada evento solo', [1, 1, 1]],
  ['Crea la invitación de la Liga a tu servidor', [1, 1, 1]],
  ['Contesta /card cuando alguien lo pide', [1, 1, 1]],
  ['Avisa los cambios de rango', [1, 1, 0]],
  ['Lee el chat general una vez por día, para contar cuánta gente habla', [1, 1, 0]],
  ['Cuenta tu evento en vivo en tu chat', [1, 0, 0]],
  ['Avisa cada evento y sus ganadores en tu chat', [1, 0, 0]],
  ['Las batallas de tus ligas, en tu chat', [1, 0, 0]],
  ['Pone el #N y la sigla de la crew en el apodo de tu gente', [1, 0, 0]],
];
// las cuatro partes del puntaje del panel (bot/tiers.py, el docstring de `medir()`)
const PARTES = [
  ['Actividad', 35, '#29B298', 'eventos por semana; con 2 llegas al tope.'],
  ['Alcance', 25, '#6FCDB9', 'raperos por evento y gente nueva.'],
  ['Calidad', 25, '#A9E2D5', 'llaves que el bot lee solo, anuncios con su staff y pocos cancelados.'],
  ['Comunidad', 15, '#DDF3EE', 'los nuevos que vuelven, las promos y las ligas.'],
];

function Copiar({ texto }) {
  const [dijo, setDijo] = useState('');
  const decir = (s) => { setDijo(s); setTimeout(() => setDijo(''), 1600); };
  return (
    <button type="button" onClick={(e) => {
      const code = e.currentTarget.parentNode.querySelector('code');
      const aMano = () => { try { getSelection().selectAllChildren(code); } catch (err) { /* sin selección */ } decir('Selecciónalo'); };
      try { navigator.clipboard.writeText(texto).then(() => decir('Copiado'), aMano); } catch (err) { aMano(); }
    }}>
      <span aria-live="polite">{dijo || 'Copiar link'}</span>
    </button>
  );
}

const BotonBot = ({ negro = false }) => (
  <a className={'btn stv-bot' + (negro ? ' neg' : '')} href={BOT_LINK} target="_blank" rel="noopener noreferrer">Agregar el bot ↗</a>
);

// ── el marcador de la Liga: cuatro números, la pieza blanca de la portada ──
function Marcador({ liga, svs }) {
  const com = liga.d.comunidad || {};
  const filas = [
    ['Servidores socios', svs.length],
    com.personas ? ['Personas en sus Discords', com.personas] : null,
    liga.d.gente ? ['Raperos que jugaron', liga.d.gente] : null,
    ['Eventos jugados', svs.reduce((t, s) => t + (s.ev || 0), 0)],
  ].filter(Boolean);
  return (
    <div className="stv-marc" aria-label="La Liga hoy" style={{ gridTemplateRows: 'auto repeat(' + filas.length + ',1fr)' }}>
      <div className="stv-marc-t">La Liga hoy <span>● {liga.tempLarga}</span></div>
      {filas.map(([l, v]) => <div key={l}><span>{l}</span><b>{num(v)}</b></div>)}
    </div>
  );
}

// ── la pretemporada: las cuatro jornadas ──
function Pretemporada({ rec3 }) {
  return (
    <section className="stv-sec" aria-labelledby="stv-pre">
      <h2 className="stv-st" id="stv-pre">La pretemporada · <b>cuatro jornadas</b></h2>
      <ol className="stv-jors">
        <li className="stv-jor">
          <div className="stv-jor-n"><b>1</b>Jornada</div>
          <h3>Arma tu plantel</h3>
          <ul className="stv-lista"><li>Eventos de freestyle, con su llave en un canal.</li><li>Alguien de tu staff que los organice.</li></ul>
          {rec3 ? <p className="stv-pie">Se recomiendan {num(rec3)} miembros para el Tier 3. No es un requisito.</p> : null}
        </li>
        <li className="stv-jor tuya">
          <div className="stv-jor-n"><b>2</b>Jornada<span>tú, un minuto</span></div>
          <h3>Ficha al bot</h3>
          <p>Entra como administrador, con su propio rol: así lee tus llaves y pone el #N en los apodos. Sube su rol por encima de los de tu gente.</p>
          <BotonBot negro />
          <div className="stv-copia"><code>{BOT_LINK.replace('https://', '')}</code><Copiar texto={BOT_LINK} /></div>
          <div className="stv-nunca"><b>Lo que nunca hace</b><span>Expulsar ni banear, borrar los mensajes de tu gente ni mandarle privados. Lo sacas cuando quieras.</span></div>
        </li>
        <li className="stv-jor">
          <div className="stv-jor-n"><b>3</b>Jornada<span>un admin</span></div>
          <h3>Escribe /setup</h3>
          <p>En seis pasos: revisa los permisos del bot, eliges una plantilla, él busca tus canales y tú corriges. No crea canales ni roles.</p>
          <div className="stv-dc" aria-hidden="true">
            <div className="stv-dc-sug"><small>Comandos que coinciden con /setup</small>
              <div className="stv-dc-f"><span className="stv-ul">UL</span><b>/setup</b><span>Deja el bot de la Liga listo</span></div></div>
            <div className="stv-dc-in">/setup</div>
          </div>
        </li>
        <li className="stv-jor debut">
          <div className="stv-jor-n"><b>4</b>Jornada<span>la Liga</span></div>
          <h3>Debutas</h3>
          <p>A Dlx le llega tu servidor y aprueba que tus eventos sumen; mientras tanto, el /setup dice «en revisión». Ahí mismo tienes el link de tu panel y de tu kit.</p>
          <div className="stv-debut"><span className="stv-tu" aria-hidden="true">TÚ</span><b>Tu servidor</b><span className="stv-sticker">Debuta</span></div>
        </li>
      </ol>
    </section>
  );
}

// ── la tabla de los tiers ──
// el tier de abajo de todo dice lo que tiene; los de arriba, con «+», lo que suman sobre el de abajo
function fraseDa(da, t, min, base) {
  const ks = ((da && da[String(t)]) || []).filter((k) => DA[k]).sort((a, b) => ORDEN_DA.indexOf(a) - ORDEN_DA.indexOf(b));
  const cuenta = ks.filter((k) => DA[k][0] === 'cuenta').map((k) => DA[k][1](min));
  const tiene = ks.filter((k) => DA[k][0] === 'tiene').map((k) => DA[k][1](min));
  if (!cuenta.length && !tiene.length) return null;
  const c = cuenta.length ? mayus(lista(cuenta)) + '.' : '';
  const ti = tiene.length ? (c ? ' ' : '') + 'Tienes ' + lista(tiene) + '.' : '';
  return base ? <>{c}{ti}</> : <><b>+ {c || ti}</b>{c ? ti : ''}</>;
}

function Tabla({ liga, svs, reglas, alMide }) {
  const M = (liga.d.mult || {}).sv || {};
  const tiers = [1, 2, 3].filter((t) => svs.some((s) => s.tier === t));
  if (!tiers.length) return null;
  const ultimo = tiers[tiers.length - 1];
  const min3 = ((svs.find((s) => s.tier === 3) || {}).cu || {}).min;
  const sube = (reglas && reglas.sube) || {};
  return (
    <section className="stv-sec" aria-labelledby="stv-tab">
      <h2 className="stv-st" id="stv-tab">La tabla · <b>{tiers.length === 1 ? 'el tier' : 'los ' + tiers.length + ' tiers'}</b></h2>
      <div className="stv-tabla">
        {tiers.map((t) => {
          const del = svs.filter((s) => s.tier === t)
            .sort((a, b) => (CASA.has(a.sv) - CASA.has(b.sv)) || (b.pts || 0) - (a.pts || 0));
          const zona = sube[String(t - 1)];
          let n = 0;
          return (
            <div className="stv-div" key={t} style={{ '--c': COLOR_TIER[t] }}>
              {zona ? (
                <button type="button" className="stv-zona" onClick={alMide}>
                  <span className="stv-zona-f">Al Tier {t - 1}</span><p>{zona}.</p><span className="stv-zona-ver">Cómo se mide →</span>
                </button>
              ) : null}
              <div className="stv-div-cab">
                <span className="stv-div-n"><i aria-hidden="true" />Tier {t}</span>
                {reglas ? <span className="stv-div-da">{fraseDa(reglas.da, t, min3, t === 3)}</span> : null}
              </div>
              <div className="stv-fila-cab" aria-hidden="true"><span>#</span><span>Servidor</span><span>Ev.</span><span>Raperos</span><span>Puntos</span><span>Semana</span></div>
              <div role="list">
                {del.map((s) => {
                  const sede = CASA.has(s.sv);
                  if (!sede) n += 1;
                  const x = M[s.sv];
                  return (
                    <a role="listitem" className={'stv-fila' + (sede ? ' sede' : '')} key={s.sv} href={'#/socios'}
                      aria-label={(s.nombre || s.sv) + ', Tier ' + t + (sede ? ', la sede de la Liga' : ': ' + num(s.ev) + ' eventos, ' + num(s.n) + ' raperos')}>
                      <span className="stv-pos">{sede ? '—' : n}</span>
                      <span className="stv-club" style={{ '--cc': s.color || '#333' }}><img alt="" src={liga.logo(s.sv)} />
                        <span><b>{limpio(s.nombre || s.sv)}</b><small>{siglaDe(s.sv)}{sede ? ' · la sede de la Liga' : ''}</small></span></span>
                      <span className={'stv-num' + (s.ev ? '' : ' cero')}>{num(s.ev)}</span>
                      <span className={'stv-num' + (s.n ? '' : ' cero')}>{num(s.n)}</span>
                      <span className={'stv-num' + (s.pts ? '' : ' cero')}>{corto(s.pts)}</span>
                      {sede ? <span className="stv-sticker">Sede</span>
                        : <span className={'stv-x' + (x != null && x < 1 ? ' baja' : '')}>{x != null ? mult(x) : '—'}</span>}
                    </a>
                  );
                })}
                {t === ultimo ? (
                  <div role="listitem" className="stv-fila tu">
                    <span className="stv-pos">—</span>
                    <span className="stv-club"><span className="stv-tu" aria-hidden="true">TÚ</span><span><b>Tu servidor</b><small>debuta en la jornada 4</small></span></span>
                    <span className="stv-num">0</span><span className="stv-num">0</span><span className="stv-num">0</span>
                    <span className="stv-sticker">Debuta</span>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className="stv-ley"><span><b>Ev.</b> eventos en la {liga.tempLarga.toLowerCase().replace(/^t/, 'T')}</span><span className="no-cel"><b>Raperos</b> los que jugaron ahí</span>
        <span><b>Puntos</b> lo que hizo su gente</span><span className="no-cel"><b>Semana</b> su multiplicador de esta semana</span></p>
    </section>
  );
}

// ── desde el debut: cada cosa dibujada con lo que pasó en la Liga esta semana ──
function ultimaLlave(liga) {
  const ronda = (ll, ini) => (ll.rondas || []).find((r) => String(r.r || '').toLowerCase().startsWith(ini));
  const ls = Object.values(liga.d.llaves || {})
    .filter((l) => l && l.n && ronda(l, 'final') && ((ronda(l, 'final').b || [])[0] || [])[1] && ronda(l, 'semi'))
    .sort((a, b) => String(b.dia || '').localeCompare(String(a.dia || '')) || (b.n || 0) - (a.n || 0));
  if (!ls.length) return null;
  const L = ls[0];
  return { L, cuartos: (ronda(L, 'cuart') || {}).b || [], semis: (ronda(L, 'semi') || {}).b || [], fin: ronda(L, 'final').b[0] };
}
const Cruce = ({ b }) => (
  <div className="stv-cruce">{(b[0] || []).slice(0, 2).map((x, i) => <span key={i} className={x && x === b[1] ? 'gana' : ''}>{limpio(x)}</span>)}</div>
);

function Debut({ liga }) {
  const top = (liga.d.tabla || []).slice(0, 3);
  const ll = ultimaLlave(liga);
  const vistos = new Set();
  const notis = (liga.d.proximos || []).filter((p) => p && liga.svs[p.sv] && !vistos.has(p.sv) && vistos.add(p.sv)).slice(0, 2);
  const mw = (((liga.d.mw || {}).b) || []).slice().sort((a, b) => (b.v || 0) - (a.v || 0)).slice(0, 3);
  return (
    <>
      <p className="stv-pan-t">Lo que tiene tu servidor desde que debuta, con lo que pasó en la Liga esta semana. Toca uno para verlo en la página.</p>
      <div className="stv-bento">
        {top.length ? (
          <a className="stv-tile ancha" href="#/ranking">
            <h3>La Temporada</h3><p>Tus eventos suman a la misma tabla que los de los demás servidores. Hoy va así:</p>
            <ol className="stv-top">{top.map((f) => (
              <li key={f.k || f.n}><span className="p">{f.pos}</span><Cara liga={liga} k={f.k} nombre={f.n} />
                <span className="nom">{limpio(f.n)}<small>{siglaDe(f.sv)}{f.rg ? ' · rango ' + f.rg : ''}</small></span><span className="pts">{num(f.pts)}</span></li>
            ))}</ol>
          </a>
        ) : null}
        {ll ? (
          <a className="stv-tile negra alta" href={'#/llave/' + ll.L.n}>
            <h3>La llave, en vivo</h3><p>El cuadro se arma solo mientras se juega, y a quien tiene la campana le avisa cuando le toca.</p>
            <div className="stv-llave">
              {ll.cuartos.length ? <><span className="rt">Cuartos</span><div className="r">{ll.cuartos.slice(0, 4).map((b, i) => <Cruce b={b} key={i} />)}</div></> : null}
              <span className="rt">Semifinales</span><div className="r">{ll.semis.slice(0, 2).map((b, i) => <Cruce b={b} key={i} />)}</div>
              <div className="stv-camp"><small>Campeón</small><b>{limpio(ll.fin[1])}</b>
                <span>final contra {limpio((ll.fin[0] || []).find((x) => x !== ll.fin[1]) || '')} · {limpio(ll.L.nombre)} · {siglaDe(ll.L.sv)} · {ll.L.fecha}</span></div>
            </div>
          </a>
        ) : null}
        {notis.length ? (
          <a className="stv-tile" href="#/avisos">
            <h3>Avisos al minuto</h3><p>Cuando anuncias, le llega al celular a quien activó la campana.</p>
            <div className="stv-notis">{notis.map((p) => (
              <div className="stv-noti" key={p.sv + p.nombre}><img alt="" src={liga.logo(p.sv)} /><div><b>{limpio(liga.svs[p.sv].nombre || p.sv)} anunció un evento</b><span>{limpio(p.nombre)}</span></div></div>
            ))}</div>
          </a>
        ) : null}
        {mw.length ? (
          <a className="stv-tile" href="#/">
            <h3>Most Wanted</h3><p>El primero que le gana a un buscado en un evento de la Liga lo caza y cobra.</p>
            <div className="stv-mws">{mw.map((b) => (
              <div className="stv-mw" key={b.k || b.n}><b>{limpio(b.n)}</b><span className="v">{num(b.v)}</span>
                <em>{b.cn}{b.sv ? ' · ' + siglaDe(b.sv) : ''}</em><span className={'e ' + (b.e === 'cazado' ? 'cazado' : 'suelto')}>{b.e === 'cazado' ? 'cazado' : 'suelto'}</span></div>
            ))}</div>
          </a>
        ) : null}
      </div>
      <div className="stv-tira">
        <a href="#/socios"><h3>Tu página en la Liga</h3><p>Tu gente, tus eventos, tu semana, tus redes y tu invitación.</p></a>
        <a href="#/publicaciones"><h3>Tus posts, en nuestras redes</h3><p>Los compartimos en Under Legends, y tus campeones salen en Publicaciones.</p></a>
        <a href="#/competencias"><h3>Competencias</h3><p>Tu gente entra a las ligas por niveles, la Copa, las Rapid y los mini eventos.</p></a>
      </div>
    </>
  );
}

function ElBot() {
  return (
    <>
      <p className="stv-pan-t">Lo que hace según la plantilla que elijas en /setup. La cambias cuando quieras con /settings o en tu panel; el anti-raid va aparte, con /antiraid.</p>
      <div className="stv-mat" role="table" aria-label="Lo que hace el bot con cada plantilla">
        <div className="stv-mat-f stv-mat-cab" role="row"><span role="columnheader">Qué hace</span>
          {PLANTILLAS.map(([e, n]) => <span role="columnheader" key={n}><span aria-hidden="true">{e} </span>{n}</span>)}</div>
        {QUE_HACE.map(([q, xs]) => (
          <div className="stv-mat-f" role="row" key={q}><span role="cell">{q}</span>
            {xs.map((x, i) => <span role="cell" key={i} className={x ? 'si' : 'no'} aria-label={x ? 'sí' : 'no'}>{x ? '✓' : '—'}</span>)}</div>
        ))}
      </div>
      <div className="stv-nunca-f"><h3>Lo que nunca hace</h3><span>Expulsar ni banear a nadie.</span><span>Editar ni borrar los mensajes de tu gente.</span><span>Mandarle privados a nadie de tu servidor.</span></div>
    </>
  );
}

function Mide({ reglas }) {
  const rec = (reglas && reglas.rec) || {};
  const m = /(\d+)\s+puntos/.exec(((reglas && reglas.sube) || {})['1'] || '');
  const pide = m ? Number(m[1]) : null;
  const recs = [1, 2, 3].filter((t) => rec[String(t)]);
  const max = Math.max(1, ...recs.map((t) => rec[String(t)]));
  return (
    <div className="stv-mide">
      <div className="stv-mide-izq">
        <p className="stv-pan-t">Tu panel mide tus últimas cuatro semanas con un puntaje de 0 a 100, y Dlx confirma cada ascenso. Lo que pide cada tier está en la tabla, arriba de cada uno.</p>
        {pide ? <div className="stv-regla" aria-hidden="true"><span style={{ left: pide + '%' }}>El Tier 1 pide {pide}</span></div> : null}
        <div className="stv-barra" aria-hidden="true">{PARTES.map(([n, v, c]) => <i key={n} style={{ flex: v, background: c }}>{v}</i>)}</div>
        <ul className="stv-partes">{PARTES.map(([n, v, c, tx]) => <li key={n} style={{ '--c': c }}><b>{n} · {v}</b><span>{tx}</span></li>)}</ul>
      </div>
      {recs.length ? (
        <div className="stv-plant">
          <h3>El plantel recomendado</h3>
          <p>Ningún tier pide una cantidad de miembros: el tamaño no define. Esto es lo que recomendamos para que tus eventos se llenen.</p>
          {recs.map((t) => (
            <div className="stv-pl" key={t} style={{ '--c': COLOR_TIER[t] }}><span>Tier {t}</span>
              <i style={{ width: Math.max(4, Math.round(100 * rec[String(t)] / max)) + '%' }} /><b>{num(rec[String(t)])}</b></div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Comandos({ reglas }) {
  const rec = (reglas && reglas.rec) || {};
  const recTx = [3, 2, 1].filter((t) => rec[String(t)]).map((t) => num(rec[String(t)]) + ' para el Tier ' + t);
  return (
    <div className="stv-dos">
      <div className="stv-pick" aria-label="Los comandos del bot">
        <div className="stv-pick-cab"><span className="stv-ul" aria-hidden="true">UL</span>Liga Global · así los ves al escribir «/»</div>
        {[['/setup', 'Deja el bot listo en tu servidor. Es la jornada 3.'],
          ['/settings', 'Admins: el evento en vivo en tu chat, los avisos de rango, tu ranking de ascenso, dónde se usa /card y las marcas del apodo.'],
          ['/antiraid', 'Sólo el dueño: escudo contra spam, alarma si entra mucha gente de golpe y botón de pánico.'],
          ['/agendar', 'Staff y organizadores: pone un evento en el calendario de la Liga con tiempo.'],
          ['/help', 'Todos los comandos.']].map(([c, tx]) => (
          <div className="stv-dc-f" key={c}><span className="stv-ul" aria-hidden="true">UL</span><b>{c}</b><span>{tx}</span></div>
        ))}
      </div>
      <div className="stv-faq">
        <details><summary>¿Tengo que cambiar cómo organizo mis eventos?</summary><p>No. El bot lee tus anuncios y tus llaves como ya los publicas. Si una llave no se entiende, le pregunta a tu organizador en el canal de llaves.</p></details>
        <details><summary>¿Qué lee el bot de mi servidor?</summary><p>Tus anuncios, inscripciones, llaves y veredictos. Con «Liga completa» o «Lo básico», una vez por día lee el chat general para contar cuánta gente habla; eso se apaga en tu panel.</p></details>
        <details><summary>¿Y si no quiero que el bot escriba en mi servidor?</summary><p>Elige «Sólo leer» en /setup: lee tus anuncios y tus llaves y no escribe nada en tu servidor. Contestar un /card no cuenta, porque eso lo pide alguien.</p></details>
        <details><summary>¿Puedo seguir con mi propio ranking?</summary><p>Sí. Tu servidor tiene su ranking en tu página y en tu panel, y si tienes rangos de ascenso, el bot los mantiene al día en el canal que elijas.</p></details>
        <details><summary>¿El bot le cambia el apodo a mi gente?</summary><p>Sólo con «Liga completa»: le pone su #N y la sigla de su crew. Cada uno elige cómo con /apodo, y un admin lo apaga con /settings.</p></details>
        {recTx.length ? <details><summary>¿Necesito muchos miembros?</summary><p>No: ningún tier pide una cantidad. Recomendamos {lista(recTx)}, para que tus eventos se llenen.</p></details> : null}
        <details><summary>¿Puedo sacar el bot?</summary><p>Sí, cuando quieras, como a cualquier bot.</p></details>
      </div>
    </div>
  );
}

const PESTANAS = [['debut', 'Desde el debut'], ['bot', 'El bot'], ['mide', 'Cómo se asciende'], ['cmd', 'Comandos y preguntas']];

export function SumaTuServidor({ liga }) {
  const [pes, setPes] = useState('debut');
  // la sede va en su fila sin números; los servidores sin tier no están en la Liga todavía
  const svs = Object.values(liga.svs || {}).filter((s) => s && s.tier);
  const reglas = liga.d.tiers_reglas || null;
  const rec3 = reglas && reglas.rec ? reglas.rec['3'] : null;
  const irA = (id) => {
    const h = document.getElementById('inicio-nuevo');
    const el = h && h.shadowRoot ? h.shadowRoot.getElementById(id) : null;
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 16, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const alMide = () => { setPes('mide'); requestAnimationFrame(() => requestAnimationFrame(() => irA('stv-papel'))); };
  const tecla = (e, i) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const sig = PESTANAS[(i + d + PESTANAS.length) % PESTANAS.length][0];
    setPes(sig);
    const h = document.getElementById('inicio-nuevo');
    const b = h && h.shadowRoot ? h.shadowRoot.getElementById('stv-t-' + sig) : null;
    if (b) b.focus();
  };
  return (
    <div className="stv">
      <div className="escena stv-esc">
        <div className="stv-in">
          <div className="stv-cab">
            <div className="stv-cab-tx">
              <a className="stv-miga" href="#/socios">‹ Socios</a>
              <span className="tag" style={{ width: 'fit-content' }}>Suma tu servidor</span>
              <h1 className="stv-h1">Tu servidor, en la <em>tabla</em> de la Liga</h1>
              <p className="stv-baj">Debuta en el Tier 3 y asciende jugando: tus eventos suman a la misma tabla que los de los {svs.length} socios.</p>
              <div className="stv-acc">
                <BotonBot />
                <a className="btn stv-bor" href={DLX} target="_blank" rel="noopener noreferrer">Escribirle a <span className="stv-at">@itsdlx</span> ↗</a>
              </div>
              <p className="stv-para"><b>Para empezar:</b> eventos de freestyle con su llave en un canal. Ningún tier pide una cantidad de miembros.</p>
            </div>
            <Marcador liga={liga} svs={svs} />
          </div>
          <Pretemporada rec3={rec3} />
          <Tabla liga={liga} svs={svs} reglas={reglas} alMide={alMide} />
        </div>
      </div>
      <section className="stv-papel" id="stv-papel" aria-label="Lo que trae la Liga">
        <div className="stv-in">
          <div className="stv-pes" role="tablist" aria-label="Lo que trae la Liga">
            {PESTANAS.map(([k, n], i) => (
              <button key={k} id={'stv-t-' + k} type="button" role="tab" aria-selected={pes === k} aria-controls={'stv-p-' + k}
                tabIndex={pes === k ? 0 : -1} onClick={() => setPes(k)} onKeyDown={(e) => tecla(e, i)}>{n}</button>
            ))}
          </div>
          <div className="stv-pan" role="tabpanel" id={'stv-p-' + pes} aria-labelledby={'stv-t-' + pes}>
            {pes === 'debut' ? <Debut liga={liga} /> : pes === 'bot' ? <ElBot /> : pes === 'mide' ? <Mide reglas={reglas} /> : <Comandos reglas={reglas} />}
          </div>
          <div className="stv-cierre"><h2>Ficha al bot y escribe /setup</h2><BotonBot negro /></div>
        </div>
      </section>
    </div>
  );
}
