// 🎯 LAS MISIONES DE LA SEMANA (Dlx, 04/10/2026, a la propuesta: «3. A»; 05/10: «empezá ya»). Tres por semana, las
// mismas para todos, que se renuevan el lunes a las 11 AM ET con los multiplicadores; cada una suma puntos a la
// Temporada y las tres juntas dan un bono. La cuenta la hace el ciclo (`bot/misiones.py`) y viaja en el lobby
// (`mis`): acá sólo se muestra. Las TAREAS son otra cosa: son del Pase.
//
// 🎟️ «EL TABLÓN» (Dlx, 20/11/2026, a la maqueta privada 5gUBkNwHzpqSTdLad5nMLj: «B · El tablón»). Cada cosa con su forma:
//   · arriba, en negro, tus tres misiones como BOLETOS (lo que pide a la izquierda; lo que paga en el TALÓN, que se sella
//     al cumplirla) y el bono como un boleto con tres agujeros que se perforan; la que falta trae el botón a Eventos;
//   · al costado, TU PRESA como cartel de Se busca, quién te está cazando a ti y el reloj hasta el lunes;
//   · abajo, el dorado, la de todos (la cacería) y los buscados del Most Wanted;
//   · en el papel, la carrera de la semana (podio, cuántos cumplieron cada una y la lista con sus marcas), la Semana
//     perfecta y lo sumado en la temporada.
// 🎯 TU PRESA (Dlx, 20/11/2026: «una combinación de todo y que te deje una pista de qué días compite y dónde»): cada uno
// la suya, elegida el lunes por el ciclo (`presas_de()` de bot/misiones.py); se caza quedando por encima en un evento
// donde estén los dos, o ganándole un duelo. Arranca la semana del lunes 23/11 (`pre_desde`): antes, se anuncia.
import { useEffect, useState } from 'react';
import { DIAS, MESES, limpio, num, quienMira, utc } from './liga.js';
import { Cara, Carta, accion } from './piezas.jsx';
import CSS from './css/misiones.css?inline';
import { usarCss } from './css.js';

usarCss('misiones', CSS);

const NIVEL = { facil: 'Fácil', media: 'Media', dificil: 'Difícil', caza: 'La de todos', dorado: 'El dorado', writing: 'Writing' };
const COLOR = { facil: '#29B298', media: '#E8A93B', dificil: '#E41373', caza: 'var(--mt-cz)', dorado: '#E7B622', writing: '#8B7CF6' };
// las tres del bono: la cacería, el dorado y el Writing van aparte
const DEL_BONO = ['facil', 'media', 'dificil'];
// lo que se aclara debajo de las que tienen letra chica (`q` de `bot/misiones.py`)
const ACLARA = {
  arriba1: 'Vale el rango que cada uno tenía el lunes. Sin letra, cuentas como E.',
  arriba2: 'Vale el rango que cada uno tenía el lunes. Sin letra, cuentas como E.',
  paises: 'El país de cada uno es el de la Lista: un rival sin país no cuenta.',
  cuartos: 'Llegar más lejos también cuenta.',
  chico: 'Uno de los servidores que menos juegan: cualquier evento suyo de esta semana.',
  // ✍️ el Writing Challenge de FFA (Dlx, 14/10/2026): sólo las semanas con fecha
  writing: 'Sumar puntos en la fecha de esta semana del Writing Challenge de FFA. Va aparte del bono.',
};
// 🎯 desde cuándo hay presa (`PRESA_DESDE` de bot/misiones.py): sólo para un lobby que todavía no trae `pre_desde`
const PRESA_DESDE = '2026-11-23';
const LLEGAR = { semis: 'llegar a una semifinal', final: 'llegar a una final', campeon: 'ganar un evento' };
const RONDA = { campeon: 'la final', subcampeon: 'la final', final: 'la final', semifinal: 'la semifinal', semifinales: 'la semifinal',
  tercero: 'la semifinal', cuarto: 'la semifinal', cuartos: 'los cuartos', octavos: 'los octavos', r32: 'los dieciseisavos', dieciseisavos: 'los dieciseisavos' };

function fechaCorta(iso) {
  const d = new Date(String(iso || '') + 'T12:00:00');
  return isNaN(d) ? '' : d.getDate() + ' de ' + MESES[d.getMonth()];
}
const de = (n, uno, varios) => (n === 1 ? uno : varios);
const yJunto = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1] : xs[0] || '');

// ⚠️ EL SERVIDOR CON SU NOMBRE, como lo escribe `misiones._nombre_sv()`
function nombreSv(liga, sv) {
  const s = liga.svs && liga.svs[sv];
  return (s && s.nombre) || sv || '';
}

// el servidor del multiplicador más alto de AHORA (la misión «multi» se mide en el momento de cada evento)
function topMult(liga) {
  const sv = (liga.d.mult && liga.d.mult.sv) || {};
  const m = Math.max(0, ...Object.values(sv).map(Number).filter((x) => x > 0));
  return m ? Object.keys(sv).filter((k) => Number(sv[k]) === m) : [];
}

// 🗣️ LO QUE TE FALTA, EN PALABRAS: con `q` (qué mide) y la meta. Sin `q` (un lobby de antes), lo de siempre
function falta(liga, x, v) {
  const f = Math.max(0, (x.m || 1) - (v || 0));
  switch (x.q) {
    case 'eventos': return 'Te ' + de(f, 'falta 1 evento', 'faltan ' + f + ' eventos');
    case 'duelos': return 'Te falta ganar ' + f + ' ' + de(f, 'duelo', 'duelos');
    case 'paises': return x.m > 1 ? 'Te ' + de(f, 'falta un país más', 'faltan ' + f + ' países más') : 'Te falta ganarle a alguien de otro país';
    case 'cuartos': return 'Te falta llegar a cuartos ' + de(f, 'una vez más', f + ' veces');
    case 'podios': return 'Te ' + de(f, 'falta 1 podio', 'faltan ' + f + ' podios');
    case 'formato': return 'Te falta jugar un evento que no sea 1 vs 1';
    case 'arriba1': return 'Te falta ganarle a alguien de rango más alto';
    case 'arriba2': return 'Te falta ganarle a alguien dos rangos arriba';
    case 'llego': return 'Te falta ' + (LLEGAR[x.id] || 'llegar más lejos');
    case 'multi': {
      const t = topMult(liga);
      return 'Te falta jugar un evento ' + (t.length ? 'de ' + t.map((s) => nombreSv(liga, s)).join(' o ') : 'del servidor con el multiplicador más alto');
    }
    case 'nuevo': return 'Te falta jugar en un servidor donde todavía no jugaste';
    case 'chico': return 'Te falta jugar un evento de ' + nombreSv(liga, x.sv || x.x);
    case 'dorado': return 'Te falta jugar el evento dorado';
    default: return x.m > 1 ? 'Llevas ' + (v || 0) + ' de ' + x.m : 'Todavía no';
  }
}
// el título corto y los ejemplos como chips: «Juega un evento que no sea 1 vs 1: 2 vs 2, pandillas…» (se cortaba)
function partes(t) {
  const i = String(t || '').indexOf(': ');
  return i < 0 ? [t, []] : [t.slice(0, i), t.slice(i + 2).split(',').map((x) => x.replace(/…$/, '').trim()).filter(Boolean)];
}

// ⏳ la cuenta atrás hasta el lunes a las 11 AM ET: al minuto (el sello no necesita segundos)
function useFalta(fin) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((utc(fin) - ahora) / 1000));
  return isNaN(s) ? null : { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s };
}
function Reloj({ fin, liga }) {
  const f = useFalta(fin);
  if (!f) return null;
  const p2 = (n) => String(n).padStart(2, '0');
  return (
    <div className="mt-reloj" role="timer" aria-label={'Se renuevan ' + liga.dia(fin)}>
      <span className="mt-lab">Se renuevan</span>
      {f.s ? <span className="mt-dig"><b>{f.d}</b><small>D</small><b>{p2(f.h)}</b><small>H</small><b>{p2(f.m)}</b><small>M</small></span> : <b className="mt-ya">En un rato</b>}
      <span className="mt-lab">{liga.dia(fin)}</span>
    </div>
  );
}

// la cara de alguien de la lista (por nombre), con su perfil si tiene
function Quien({ liga, raw, cls = 'cara' }) {
  const f = liga.fila(raw);
  return f ? <Cara liga={liga} k={f.k} nombre={f.n} cls={cls} /> : <span className={cls + ' ini'}>{limpio(raw).slice(0, 1).toUpperCase()}</span>;
}
// quiénes la cumplieron: hasta cinco caras y cuántos
function Pila({ liga, quienes, n }) {
  return (
    <span className="mt-pila">
      {quienes.length ? <span className="mt-cs">{quienes.slice(0, 5).map((q) => <Quien key={q} liga={liga} raw={q} cls="cara mt-c" />)}</span> : null}
      {n ? n + (n === 1 ? ' la cumplió' : ' la cumplieron') : 'Nadie todavía'}
    </span>
  );
}

// 🎟️ una misión del bono, como boleto: lo que pide a la izquierda y el talón con lo que paga (sellado si la cumpliste)
function Boleto({ liga, x, v, n, quienes, pend, prox }) {
  const ok = v != null && v >= x.m;
  const [t, ej] = partes(x.t);
  return (
    <article className={'mt-bol' + (ok ? ' ok' : '')} style={{ '--c': COLOR[x.n] }}>
      <div className="mt-q">
        <span className="mt-lab">{NIVEL[x.n] || x.n}</span>
        <h3>{t}</h3>
        {ej.length ? <div className="mt-chips">{ej.map((e) => <span key={e}>{e}</span>)}</div> : null}
        {x.sv && x.q === 'chico' ? <span className="mt-sv"><img alt="" src={liga.logo(x.sv)} loading="lazy" />{nombreSv(liga, x.sv)}</span> : null}
        {ok ? <span className="mt-est"><i>✓</i>La cumpliste</span>
          : v != null && !ej.length && x.q !== 'formato' ? <span className="mt-falta">{falta(liga, x, v)}{x.m > 1 ? <small> · {Math.min(v, x.m)} de {x.m}</small> : null}</span> : null}
        {!ok && ACLARA[x.q] ? <small className="mt-acl">{ACLARA[x.q]}</small> : null}
        {pend ? (
          <div className="mt-ir">
            <a className="btn mt-inv" href="#/eventos">Ver los eventos</a>
            {prox ? <span className="mt-prox">El próximo: <b>{limpio(prox.nombre)}</b> · {nombreSv(liga, prox.sv)} · {liga.dia(prox.cuando)}</span> : null}
          </div>
        ) : null}
        <Pila liga={liga} quienes={quienes} n={n} />
      </div>
      <div className="mt-talon"><b>+{num(x.p)}</b>{ok ? <span className="mt-sello">Cumplida</span> : <small>Temporada</small>}</div>
    </article>
  );
}

// 🎯 tu presa como cartel de Se busca: la carta, por qué te tocó, la pista y lo que paga. Sin sesión o sin presa, lo dice
function Presa({ liga, M, mio, esYo, dc }) {
  const pre = M.pre || null;
  const paga = M.pre_p || 600;
  // (sin `pre_desde`, un lobby de antes del código nuevo: la fecha de arranque de bot/misiones.py, `PRESA_DESDE`)
  const desde = M.pre_desde || PRESA_DESDE;
  const antes = !pre && String(M.sem || '') < String(desde);
  const vacio = (tx, boton) => (
    <div className="mt-cartel vacio">
      <span className="mt-lab">Tu presa<span className="mt-nueva">Nueva</span></span>
      <span className="mt-se">Se busca</span>
      <span className="mt-sil" aria-hidden="true">?</span>
      <p>{tx}</p>
      {boton}
      <span className="mt-paga">+{num(paga)} <small>a tu Temporada</small></span>
    </div>
  );
  if (antes) {
    return vacio(<>Desde el <b>lunes {fechaCorta(desde)}</b>, cada uno tiene su presa: alguien a quien cazar, elegido para ti (el último que te ganó, alguien de tu escena o el de al lado en la tabla), con una pista de qué días juega y dónde. Se caza quedando por encima en un evento donde estén los dos, o ganándole un duelo.</>);
  }
  if (!dc) return vacio(<>Cada semana te toca alguien a quien cazar, con una pista de qué días juega y dónde. Entra y te decimos quién es.</>, <button type="button" className="btn mt-inv" onClick={accion.entrar}>Entrar con Discord</button>);
  const k = pre ? Object.keys(pre).find(esYo) : null;
  const a = k ? pre[k] : null;
  if (!a) return vacio(<>Juega un evento esta semana y el lunes te toca tu presa, con una pista de qué días juega y dónde.</>);
  const [x, hecha, motivo, nEv, sv, ronda] = a;
  const f = liga.fila(x);
  const pista = (M.pis || {})[x] || [[], []];
  const dias = (pista[0] || []).map((d) => DIAS[(d + 1) % 7]);
  const svs = (pista[1] || []).map((s) => nombreSv(liga, s));
  const porque = motivo === 'r' ? <>Te ganó {RONDA[ronda] || 'un duelo'} del evento #{nEv}{sv ? ' de ' + nombreSv(liga, sv) : ''}. Es la revancha.</>
    : motivo === 'e' ? <>Juega donde juegas tú y está cerca tuyo en la tabla.</> : <>Está cerca tuyo en la Temporada.</>;
  return (
    <div className={'mt-cartel' + (hecha ? ' cazada' : '')}>
      <span className="mt-lab">Tu presa{motivo === 'r' ? ' · la revancha' : ''}<span className="mt-nueva">Nueva</span></span>
      <span className="mt-se">{hecha ? 'Cazada' : 'Se busca'}</span>
      {f ? <Carta liga={liga} k={f.k} cual="temporada" cls="ci mt-ci" /> : <Quien liga={liga} raw={x} cls="cara mt-ci" />}
      <h3>{f ? <a href={'#/r/' + encodeURIComponent(f.k)}>{limpio(f.n)}</a> : limpio(x)}</h3>
      <p>{porque}</p>
      {dias.length || svs.length ? <p className="mt-pista"><b>La pista:</b> suele jugar{dias.length ? ' los ' + yJunto(dias.map((d) => d + (d.endsWith('s') ? '' : 's'))) : ''}{svs.length ? ', en ' + yJunto(svs) : ''}.</p> : null}
      <p>{hecha ? <b>¡La cazaste! Sumaste +{num(paga)}.</b> : <>Queda <b>por encima en un evento donde estén los dos</b>, o gánale un duelo.</>}</p>
      <span className="mt-paga">+{num(paga)} <small>a tu Temporada</small></span>
    </div>
  );
}
// quién te tiene a ti de presa
function Cazan({ liga, M, esYo }) {
  const pre = M.pre || {};
  const qs = Object.keys(pre).filter((q) => esYo(pre[q][0]));
  if (!qs.length) return null;
  return (
    <div className="mt-cazan">
      <span className="mt-cs">{qs.slice(0, 3).map((q) => <Quien key={q} liga={liga} raw={q} cls="cara" />)}</span>
      <span><b>Te {de(qs.length, 'está cazando ' + limpio(qs[0]), 'están cazando ' + qs.length)}</b>{qs.length === 1 && pre[qs[0]][2] === 'r' ? ': la última vez le ganaste tú.' : '.'}</span>
    </div>
  );
}

// 🏆 la Semana perfecta: los que cumplieron la fácil, la media y la difícil, con su bono
// quiénes cumplieron las tres; `null` si esta semana no hay las tres del bono
function quienesPerfecta(M) {
  const prog = M.prog || {};
  const idx = M.lista.map((x, j) => (DEL_BONO.includes(x.n) ? j : -1)).filter((j) => j >= 0);
  if (idx.length !== DEL_BONO.length) return null;
  return Object.keys(prog).filter((q) => idx.every((j) => (prog[q] || [])[j] >= M.lista[j].m))
    .sort((a, b) => (M.pts[b] || 0) - (M.pts[a] || 0) || (a < b ? -1 : 1));
}

// una fila de la carrera: el puesto, la cara, la barra de sus puntos, las marcas de cada misión y lo que sumó
function Fila({ liga, raw, pts, i, mx, M, esYo }) {
  const f = liga.fila(raw);
  const h = M.lista.map((x, j) => ((M.prog || {})[raw] || [])[j] >= x.m);
  return (
    <li className={esYo(raw) ? 'yo' : ''}>
      {i != null ? <span className="mt-pos">{i}</span> : null}
      <Quien liga={liga} raw={raw} />
      <span className="mt-n">{f ? <a href={'#/r/' + encodeURIComponent(f.k)}>{limpio(raw)}</a> : <b>{limpio(raw)}</b>}<i style={{ width: Math.max(3, Math.round(100 * pts / (mx || 1))) + '%' }} /></span>
      <span className="mt-mk" role="img" aria-label={h.filter(Boolean).length + ' de ' + h.length + ' cumplidas'}>
        {h.map((si, j) => <i key={j} className={(si ? 'si' : '') + (M.lista[j].n === 'dorado' ? ' rb' : '')} style={{ '--c': COLOR[M.lista[j].n] }} />)}
      </span>
      <b className="mt-pt">+{num(pts)}</b>
    </li>
  );
}

export function Misiones({ liga }) {
  const M = liga.d.mis;
  const [tab, setTab] = useState('carrera');
  const [todas, setTodas] = useState(false);
  if (!M) return null;
  const yo = liga.yo;
  const esYo = (raw) => !!yo && liga.esDe(raw, yo.k);
  const prog = M.prog || {};
  const lista = M.lista || [];
  const mio = Object.keys(prog).find(esYo);
  const dc = quienMira().dc;
  const cumplieron = (i) => Object.values(prog).filter((v) => (v[i] || 0) >= lista[i].m).length;
  const semana = Object.entries(M.pts || {}).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const quienes = (i) => semana.filter(([q]) => (prog[q] || [])[i] >= lista[i].m).map(([q]) => q);
  const total = Object.entries(M.total || {}).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 10);
  // 🔑 quien juega la temporada y todavía no hizo nada esta semana lleva 0, no «nada» (revisión del 05/10/2026)
  const valor = (i) => (mio ? (prog[mio] || [])[i] || 0 : yo ? 0 : null);
  const tres = lista.map((x, i) => [x, i]).filter(([x]) => DEL_BONO.includes(x.n));
  const hechas = tres.filter(([x, i]) => valor(i) != null && valor(i) >= x.m).length;
  const pend = yo ? (tres.find(([x, i]) => !(valor(i) >= x.m)) || [])[1] : -1;
  const aparte = lista.map((x, i) => [x, i]).filter(([x]) => !DEL_BONO.includes(x.n));
  const iCaza = lista.findIndex((x) => x.n === 'caza');
  const perf = quienesPerfecta(M) || [];
  const pos = mio ? semana.findIndex(([q]) => q === mio) + 1 : 0;
  const ahora = Date.now();
  const prox = (liga.proximos() || []).filter((p) => utc(p.cuando) >= ahora - 2 * 3600000).sort((a, b) => utc(a.cuando) - utc(b.cuando))[0] || null;
  const mw = (liga.d.mw && liga.d.mw.b) || [];
  // sólo lo que la portada no dice (22/11/2026, la 2.ª revisión · Impeccable distill): «las mismas para todos, se cumplen
  // jugando» salía tres veces en la misma pantalla
  const cab = !yo ? ['Las misiones de la semana', <>Las tres juntas: <b>+{num(M.bono)}</b> más.</>]
    : hechas === tres.length ? ['¡Semana perfecta!', <>Cumpliste las tres: sumaste el bono de <b>+{num(M.bono)}</b>.</>]
      : hechas === 0 ? ['Tus tres misiones', <>Ninguna todavía. La {NIVEL[lista[tres[0][1]].n].toLowerCase()} da <b>+{num(lista[tres[0][1]].p)}</b>{cumplieron(tres[0][1]) ? <> y ya la cumplieron {cumplieron(tres[0][1])} esta semana</> : null}.</>]
        : ['Llevas ' + hechas + ' de ' + tres.length, <>Te falta <b>la {NIVEL[lista[pend].n].toLowerCase()}</b>: +{num(lista[pend].p)}, y con ella el bono de <b>+{num(M.bono)}</b>.</>];
  const mx = semana.length ? semana[0][1] : 1;
  const mxc = Math.max(1, ...lista.map((_x, i) => cumplieron(i)));
  return (
    <div className="mt">
      <section className="mt-esc" aria-label={yo ? 'Tus misiones' : 'Las misiones de la semana'}>
        <div className="mt-cab">
          <div className="mt-cab-tx">
            <span className="mt-lab">Semana del {fechaCorta(M.sem)}{yo ? ' · tus misiones' : ''}</span>
            <h2>{cab[0]}</h2>
            <p>{cab[1]}</p>
          </div>
          {pos ? <div className="mt-lugar"><b>#{pos}</b><span><small>de {semana.length} esta semana</small><small>+{num((M.pts || {})[mio] || 0)}</small></span></div> : null}
          {!dc ? <button type="button" className="btn mt-inv" onClick={accion.entrar}>Entrar con Discord</button> : null}
        </div>
        <div className="mt-mesa">
          <div className="mt-boletos">
            {tres.map(([x, i]) => <Boleto key={x.id} liga={liga} x={x} v={valor(i)} n={cumplieron(i)} quienes={quienes(i)} pend={i === pend} prox={prox} />)}
            <div className="mt-bono">
              <span className="mt-ag" aria-hidden="true">{tres.map(([x, i]) => <i key={x.id} className={valor(i) >= x.m ? 'si' : ''} />)}</span>
              <div><h3>Semana perfecta</h3><p>{!yo ? 'Las tres de arriba juntas: se perfora un agujero por cada una.' : hechas === tres.length ? '¡Las tres! El bono ya se sumó.' : 'Las tres de arriba juntas. Llevas ' + hechas + '.'}</p></div>
              <b className="mt-mas">+{num(M.bono)}</b>
            </div>
          </div>
          <div className="mt-lado">
            <Presa liga={liga} M={M} mio={mio} esYo={esYo} dc={dc} />
            {yo ? <Cazan liga={liga} M={M} esYo={esYo} /> : null}
            <Reloj fin={M.fin} liga={liga} />
          </div>
        </div>
        <div className="mt-fila">
          {aparte.map(([x, i]) => {
            const v = valor(i), ok = v != null && v >= x.m;
            const f = x.n === 'caza' && x.x ? liga.fila(x.x) : null;
            return (
              <div key={x.id} className={'mt-mini' + (ok ? ' ok' : '')} style={{ '--c': COLOR[x.n] }}>
                {x.n === 'caza' ? (f ? <Carta liga={liga} k={f.k} cual="temporada" cls="ci mt-mci" /> : <Quien liga={liga} raw={x.x} cls="cara mt-mci" />)
                  : x.sv ? <img className="mt-lg" alt="" src={liga.logo(x.sv)} loading="lazy" /> : <span className="mt-lg" />}
                <div>
                  <span className="mt-lab">{x.n === 'dorado' ? <i className="mt-rombo" /> : null}{NIVEL[x.n] || x.n}{x.n === 'caza' ? ' · aparte del bono' : ''}</span>
                  <h4>{x.n === 'caza' && f ? <>Gánale un duelo a <a href={'#/r/' + encodeURIComponent(f.k)}>{limpio(f.n)}</a></> : x.t}</h4>
                  <p>{ok ? '✓ La cumpliste' : x.n === 'dorado' ? 'Su evento vale ×3 para la Temporada.' : x.n === 'caza' ? (cumplieron(i) ? de(cumplieron(i), '1 la cazó', cumplieron(i) + ' la cazaron') : 'Nadie la cazó todavía.') : ACLARA[x.q] || ''}</p>
                </div>
                <b className="mt-p">+{num(x.p)}</b>
              </div>
            );
          })}
          {mw.length ? (
            <a className="mt-mini mt-mw" href="#/ranking/mw">
              <span className="mt-cs">{mw.slice(0, 4).map((b) => <Cara key={b.k || b.n} liga={liga} k={b.k} nombre={b.n} cls="cara" />)}</span>
              <div><span className="mt-lab">Los buscados</span><h4>{mw.length} esta semana</h4><p>{mw.filter((b) => b.e !== 'cazado').length} sueltos · cada uno vale distinto</p></div>
              <b className="mt-p" aria-hidden="true">›</b>
            </a>
          ) : null}
        </div>
        <p className="mt-reglas">Las de abajo y tu presa van aparte del bono.{iCaza >= 0 ? ' La de todos es la misma presa para toda la Liga.' : ''}</p>
      </section>

      <section className="mt-papel" aria-label="La semana de todos">
        <div className="mt-tabs" role="tablist">
          {[['carrera', 'Carrera', semana.length], ['perfecta', 'Perfecta', perf.length], ['temporada', 'Temporada', null]].map(([k, t, n]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t}{n != null ? <small>{n}</small> : null}</button>
          ))}
        </div>
        {tab === 'carrera' ? (
          semana.length ? (
            <>
              <div className="mt-podio-f">
                {semana.length >= 3 ? (
                  <div className="mt-podio">
                    {[1, 0, 2].map((i) => {
                      const [q, pts] = semana[i];
                      return <div key={q} className={esYo(q) ? 'yo' : ''}><Quien liga={liga} raw={q} cls="cara mt-pc" /><b>{limpio(q)}</b><small>+{num(pts)}</small><span className="mt-alto">{i + 1}</span></div>;
                    })}
                  </div>
                ) : null}
                <div className="mt-snum">
                  <span className="mt-lab">Cuántos la cumplieron</span>
                  {lista.map((x, i) => (
                    <div key={x.id} className="mt-r" style={{ '--c': COLOR[x.n] }}><span>{NIVEL[x.n] || x.n}</span><span><i className={cumplieron(i) ? '' : 'd'} style={{ width: cumplieron(i) ? Math.round(100 * cumplieron(i) / mxc) + '%' : '6%' }} /></span><b>{cumplieron(i)}</b></div>
                  ))}
                </div>
              </div>
              <div className="mt-ley">{lista.map((x) => <span key={x.id} className="mt-mk"><i className={'si' + (x.n === 'dorado' ? ' rb' : '')} style={{ '--c': COLOR[x.n] }} />{NIVEL[x.n] || x.n}</span>)}</div>
              {(() => {
                const desde = semana.length >= 3 ? 3 : 0;
                const xs = semana.slice(desde, todas ? undefined : desde + 12);
                return (
                  <>
                    <ol className="mt-carrera" style={{ '--filas': Math.ceil(xs.length / 2) }}>
                      {xs.map(([raw, pts], k) => <Fila key={raw} liga={liga} raw={raw} pts={pts} i={desde + k + 1} mx={mx} M={M} esYo={esYo} />)}
                    </ol>
                    {!todas && semana.length > desde + 12 ? <button type="button" className="btn borde2 chico mt-ver" onClick={() => setTodas(true)}>Ver los {semana.length}</button> : null}
                  </>
                );
              })()}
            </>
          ) : <p className="mt-vacio">Cuando alguien cumpla la primera, aparece acá.</p>
        ) : null}
        {tab === 'perfecta' ? (
          perf.length ? (
            <ol className="mt-carrera" style={{ '--filas': Math.ceil(perf.length / 2) }}>
              {perf.map((q, k) => <Fila key={q} liga={liga} raw={q} pts={M.pts[q] || 0} i={k + 1} mx={mx} M={M} esYo={esYo} />)}
            </ol>
          ) : <p className="mt-vacio">Nadie cumplió las tres todavía: la primera persona que lo haga aparece acá, con su bono de +{num(M.bono)}.</p>
        ) : null}
        {tab === 'temporada' ? (
          total.length ? (
            <>
              <p className="mt-vacio">Lo sumado con misiones en toda la temporada.</p>
              <ol className="mt-carrera mt-tot" style={{ '--filas': Math.ceil(total.length / 2) }}>
                {total.map(([raw, pts], i) => {
                  const f = liga.fila(raw);
                  return (
                    <li key={raw} className={esYo(raw) ? 'yo' : ''}>
                      <span className="mt-pos">{i + 1}</span><Quien liga={liga} raw={raw} />
                      <span className="mt-n">{f ? <a href={'#/r/' + encodeURIComponent(f.k)}>{limpio(raw)}</a> : <b>{limpio(raw)}</b>}<i style={{ width: Math.round(100 * pts / (total[0][1] || 1)) + '%' }} /></span>
                      <b className="mt-pt">{num(pts)}</b>
                    </li>
                  );
                })}
              </ol>
            </>
          ) : <p className="mt-vacio">Todavía nadie sumó con misiones esta temporada.</p>
        ) : null}
      </section>
    </div>
  );
}
