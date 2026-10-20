// 🎯 LAS MISIONES DE LA SEMANA (Dlx, 04/10/2026, a la propuesta: «3. A»; 05/10: «empezá ya»). Tres por semana, las
// mismas para todos, que se renuevan el lunes a las 11 AM ET con los multiplicadores; cada una suma puntos a la
// Temporada y las tres juntas dan un bono. La cuenta la hace el ciclo (`bot/misiones.py`) y viaja en el lobby
// (`mis`): acá sólo se muestra. Las TAREAS son otra cosa: son del Pase.
//
// 🎮 LA PÁGINA COMO UN JUEGO (Dlx, 14/10/2026): arriba TUS misiones, cada una con su barra y lo que te falta dicho en
// palabras, y la cuenta atrás hasta el lunes a las 11; después la cacería con la cara y la carta de la presa y quién
// ya la cazó, y la Semana perfecta (los que cumplieron las tres, con su bono). Abajo, como estaban, «Esta semana» y
// «En la temporada».
import { useEffect, useState } from 'react';
import { MESES, limpio, num, quienMira, utc } from './liga.js';
import { Cara, Carta, accion } from './piezas.jsx';

const NIVEL = { facil: 'Fácil', media: 'Media', dificil: 'Difícil', caza: 'Cacería', dorado: 'Evento dorado', writing: 'Writing' };
// las tres del bono: la cacería y el dorado van aparte
const DEL_BONO = ['facil', 'media', 'dificil'];
// lo que se aclara debajo de las que tienen letra chica (`q` de `bot/misiones.py`)
const ACLARA = {
  arriba1: 'Vale el rango que cada uno tenía el lunes. Sin letra, cuentas como E.',
  arriba2: 'Vale el rango que cada uno tenía el lunes. Sin letra, cuentas como E.',
  paises: 'El país de cada uno es el de la Lista: un rival sin país no cuenta.',
  cuartos: 'Llegar más lejos también cuenta.',
  chico: 'Uno de los servidores que menos juegan: cualquier evento suyo de esta semana.',
  dorado: 'El primer evento de ese servidor desde el día del dorado: vale ×3.',
  // ✍️ el Writing Challenge de FFA (Dlx, 14/10/2026): sólo las semanas con fecha
  writing: 'Sumar puntos en la fecha de esta semana del Writing Challenge de FFA. Va aparte del bono.',
};
const LLEGAR = { semis: 'llegar a una semifinal', final: 'llegar a una final', campeon: 'ganar un evento' };

function fechaCorta(iso) {
  const d = new Date(String(iso || '') + 'T12:00:00');
  return isNaN(d) ? '' : d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3);
}

const de = (n, uno, varios) => (n === 1 ? uno : varios);

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
    case 'caza': return 'Te falta ganarle un duelo a ' + limpio(x.x || 'la presa');
    case 'dorado': return 'Te falta jugar el evento dorado';
    default: return x.m > 1 ? 'Llevas ' + (v || 0) + ' de ' + x.m : 'Todavía no';
  }
}

// ⏳ la cuenta atrás hasta el lunes a las 11 AM ET: segundo a segundo, como un juego
function Reloj({ fin, liga }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((utc(fin) - ahora) / 1000));
  if (isNaN(s)) return null;
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const p = (n) => String(n).padStart(2, '0');
  return (
    <div className="mi-reloj" role="timer" aria-label={'Se renuevan ' + liga.dia(fin)}>
      <small>SE RENUEVAN EN</small>
      {s ? <b>{d ? d + 'd ' : ''}{p(h)}:{p(m)}:{p(s % 60)}</b> : <b>En un rato</b>}
      <small>{liga.dia(fin)}</small>
    </div>
  );
}

// la cara de alguien de la lista (por nombre), con su perfil si tiene
function Quien({ liga, raw, cls = 'cara dv-cara' }) {
  const f = liga.fila(raw);
  return f ? <Cara liga={liga} k={f.k} nombre={f.n} cls={cls} /> : <span className={cls + ' ini'}>{limpio(raw).slice(0, 1).toUpperCase()}</span>;
}

// 🎮 una misión, como carta de juego: su nivel, lo que da, la barra y lo que falta
function Mision({ liga, x, v, cumplieron }) {
  const ok = v != null && v >= x.m;
  const pct = v == null ? 0 : Math.round((100 * Math.min(v, x.m)) / (x.m || 1));
  const presa = x.n === 'caza' && x.x ? liga.fila(x.x) : null;
  return (
    <li className={'mi-m mi-' + x.n + (ok ? ' ok' : '')}>
      <div className="mi-arr">
        <span className="mi-niv">{NIVEL[x.n] || x.n}</span>
        <span className="mi-p">{ok ? '✓ ' : ''}+{num(x.p)}</span>
      </div>
      <div className="mi-cuerpo">
        {x.sv ? <img className="mi-sv" alt="" src={liga.logo(x.sv)} loading="lazy" /> : null}
        {x.n === 'caza' && x.x ? <Quien liga={liga} raw={x.x} cls="cara mi-cara" /> : null}
        <b className="mi-t">{presa ? <>Ganale un duelo a <a href={'#/r/' + encodeURIComponent(presa.k)}>{limpio(presa.n)}</a></> : x.t}</b>
      </div>
      {v != null ? (
        <>
          <span className="mb mi-barra" role="img" aria-label={(ok ? x.m : Math.min(v, x.m)) + ' de ' + x.m}><i style={{ width: pct + '%' }} /></span>
          <span className="mi-yo">{ok ? '✓ La cumpliste' : falta(liga, x, v)}{!ok && x.m > 1 ? <small> · {Math.min(v, x.m)} de {x.m}</small> : null}</span>
        </>
      ) : null}
      {ACLARA[x.q] ? <small className="mi-acl">{ACLARA[x.q]}</small> : null}
      <small className="mi-c">{cumplieron === 1 ? '1 la cumplió' : num(cumplieron) + ' la cumplieron'}</small>
    </li>
  );
}

// 🎯 la cacería: la presa con su cara y su carta, y quién ya la cazó
function Caceria({ liga, M, i, esYo, mio }) {
  const x = M.lista[i];
  if (!x || !x.x) return null;
  const f = liga.fila(x.x);
  const prog = M.prog || {};
  const cazaron = Object.keys(prog).filter((q) => (prog[q] || [])[i] >= 1)
    .sort((a, b) => (M.pts[b] || 0) - (M.pts[a] || 0) || (a < b ? -1 : 1));
  const yoSi = mio && (prog[mio] || [])[i] >= 1;
  return (
    <section className="dv-g mi-cz" aria-label="La cacería de la semana">
      <h3 className="dv-gt">La cacería<small>+{num(x.p)} · aparte del bono</small></h3>
      <div className="mi-presa">
        <div className="mi-presa-c">
          {f ? <Carta liga={liga} k={f.k} cual="temporada" cls="ci mi-presa-ci" /> : <Quien liga={liga} raw={x.x} cls="cara mi-presa-cara" />}
        </div>
        <div className="mi-presa-tx">
          <span className="mi-eti">LA PRESA DE LA SEMANA</span>
          <div className="mi-presa-n">
            <Quien liga={liga} raw={x.x} cls="cara mi-presa-cara" />
            {f ? <a className="dv-n" href={'#/r/' + encodeURIComponent(f.k)}>{limpio(f.n)}</a> : <b className="dv-n">{limpio(x.x)}</b>}
          </div>
          <p>Una de las más activas de la Liga. Ganale un duelo en cualquier evento de la semana y sumas <b>+{num(x.p)}</b> a tu Temporada.</p>
          {mio != null ? <p className={'mi-presa-yo' + (yoSi ? ' si' : '')}>{yoSi ? '✓ La cazaste' : 'Todavía no la cazaste'}</p> : null}
          <span className="mi-eti">{cazaron.length ? 'YA LA ' + de(cazaron.length, 'CAZÓ 1', 'CAZARON ' + cazaron.length) : 'NADIE LA CAZÓ TODAVÍA'}</span>
          {cazaron.length ? (
            <ul className="mi-caras">
              {cazaron.slice(0, 12).map((q) => {
                const g = liga.fila(q);
                return (
                  <li key={q} className={esYo(q) ? 'yo' : ''} title={limpio(q)}>
                    {g ? <a href={'#/r/' + encodeURIComponent(g.k)} aria-label={limpio(g.n)}><Quien liga={liga} raw={q} cls="cara mi-cc" /></a> : <Quien liga={liga} raw={q} cls="cara mi-cc" />}
                  </li>
                );
              })}
              {cazaron.length > 12 ? <li className="mi-mas">+{cazaron.length - 12}</li> : null}
            </ul>
          ) : <p className="mi-nada">El primero que le gane un duelo aparece acá.</p>}
        </div>
      </div>
    </section>
  );
}

// 🏆 la Semana perfecta: los que cumplieron la fácil, la media y la difícil, con su bono
function Perfecta({ liga, M, esYo }) {
  const prog = M.prog || {};
  const idx = M.lista.map((x, j) => (DEL_BONO.includes(x.n) ? j : -1)).filter((j) => j >= 0);
  if (idx.length !== DEL_BONO.length) return null;
  const quienes = Object.keys(prog).filter((q) => idx.every((j) => (prog[q] || [])[j] >= M.lista[j].m))
    .sort((a, b) => (M.pts[b] || 0) - (M.pts[a] || 0) || (a < b ? -1 : 1));
  return (
    <section className="dv-g mi-perf" aria-label="Semana perfecta">
      <h3 className="dv-gt">Semana perfecta<small>las tres: +{num(M.bono)} de bono</small></h3>
      {quienes.length ? (
        <ol className="dv-tabla mi-perf-l">
          {quienes.map((q) => {
            const f = liga.fila(q);
            return (
              <li key={q} className={esYo(q) ? 'yo' : ''}>
                <Quien liga={liga} raw={q} />
                {f ? <a className="dv-n" href={'#/r/' + encodeURIComponent(f.k)}>{limpio(q)}</a> : <span className="dv-n">{limpio(q)}</span>}
                <span className="mi-bono-s">+{num(M.bono)} BONO</span>
                <b className="dv-p">+{num(M.pts[q] || 0)}</b>
              </li>
            );
          })}
        </ol>
      ) : <p className="mi-nada">Nadie cumplió las tres todavía: la primera persona que lo haga aparece acá, con su bono de +{num(M.bono)}.</p>}
    </section>
  );
}

export function Misiones({ liga }) {
  const M = liga.d.mis;
  if (!M) return null;
  const yo = liga.yo;
  const esYo = (raw) => !!yo && liga.esDe(raw, yo.k);
  const prog = M.prog || {};
  const lista = M.lista || [];
  const mio = Object.keys(prog).find(esYo);
  const dc = quienMira().dc;
  const cumplieron = (i) => Object.values(prog).filter((v) => (v[i] || 0) >= lista[i].m).length;
  const semana = Object.entries(M.pts || {}).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const total = Object.entries(M.total || {}).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 10);
  // 🔑 quien juega la temporada y todavía no hizo nada esta semana lleva 0, no «nada» (revisión del 05/10/2026)
  const valor = (i) => (mio ? (prog[mio] || [])[i] || 0 : yo ? 0 : null);
  const tres = lista.map((x, i) => [x, i]).filter(([x]) => DEL_BONO.includes(x.n));
  const hechas = tres.filter(([x, i]) => valor(i) != null && valor(i) >= x.m).length;
  const iCaza = lista.findIndex((x) => x.n === 'caza');
  const mios = mio ? (M.pts || {})[mio] || 0 : 0;
  return (
    <div className="mi">
      <section className="mi-tus" aria-label={yo ? 'Tus misiones' : 'Las misiones de la semana'}>
        <div className="mi-tus-cab">
          <div className="mi-tus-tx">
            <span className="mi-eti">SEMANA DEL {fechaCorta(M.sem).toUpperCase()}</span>
            <h2>{yo ? 'Tus misiones' : 'Las misiones de la semana'}</h2>
            {yo ? (
              <div className="mi-bono" role="img" aria-label={hechas + ' de ' + tres.length + ' del bono'}>
                <span className="mi-bono-m">{tres.map(([x, i]) => <i key={x.id} className={valor(i) >= x.m ? 'si mi-' + x.n : ''} />)}</span>
                <span>{hechas === tres.length ? <><b>¡Semana perfecta!</b> Sumaste el bono de +{num(M.bono)}.</>
                  : <>Llevas <b>{hechas} de {tres.length}</b>: las tres juntas suman <b>+{num(M.bono)}</b> más.</>}
                {mios ? <> Esta semana, <b>+{num(mios)}</b> a tu Temporada.</> : null}</span>
              </div>
            ) : (
              <p className="mi-intro">{dc ? 'Con tu primer evento de la ' + liga.temp + ' acá ves cuánto llevas de cada una.'
                : 'Entra con Discord y acá ves cuánto llevas de cada una.'}
                {!dc ? <> <button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar con Discord</button></> : null}</p>
            )}
          </div>
          <Reloj fin={M.fin} liga={liga} />
        </div>
        <ol className="mi-lista">
          {lista.map((x, i) => <Mision key={x.id} liga={liga} x={x} v={valor(i)} cumplieron={cumplieron(i)} />)}
        </ol>
        <p className="mi-reglas">Las mismas para todos, y se cumplen <b>jugando</b>: cada una suma a tu <b>Temporada</b>, y la fácil, la media y la difícil juntas, <b>+{num(M.bono)}</b> más.
          {iCaza >= 0 ? ' La cacería va aparte.' : ''}
          {/* ✨ el evento dorado (Dlx, 12/10/2026: «4. Dale»): sale entre los servidores que juegan poco */}
          {lista.some((x) => x.n === 'dorado') ? ' El evento dorado también: es el de un servidor más chico y vale ×3.' : ''}
          {lista.some((x) => x.n === 'writing') ? ' Y la del Writing Challenge de FFA, las semanas con fecha.' : ''}</p>
      </section>
      {/* la cacería y la Semana perfecta, lado a lado en la compu */}
      <div className="mi-dos">
        {iCaza >= 0 ? <Caceria liga={liga} M={M} i={iCaza} esYo={esYo} mio={yo ? mio || '' : null} /> : null}
        <Perfecta liga={liga} M={M} esYo={esYo} />
      </div>
      <section className="dv-g" aria-label="Los que sumaron esta semana">
        <h3 className="dv-gt">Esta semana<small>{semana.length ? semana.length + ' sumaron' : 'todavía nadie'}</small></h3>
        {semana.length ? (
          <ol className="dv-tabla mi-tabla mi-cols">
            {semana.map(([raw, pts]) => {
              const f = liga.fila(raw);
              const h = lista.map((x, j) => (prog[raw] || [])[j] >= x.m);
              return (
                <li key={raw} className={esYo(raw) ? 'yo' : ''}>
                  <Quien liga={liga} raw={raw} />
                  {f ? <a className="dv-n" href={'#/r/' + encodeURIComponent(f.k)}>{limpio(raw)}</a> : <span className="dv-n">{limpio(raw)}</span>}
                  <span className="mi-marcas" role="img" aria-label={h.filter(Boolean).length + ' de ' + lista.length + ' cumplidas'}>
                    {h.map((si, j) => <i key={j} className={si ? 'si' : ''} />)}
                  </span>
                  <b className="dv-p">+{num(pts)}</b>
                </li>
              );
            })}
          </ol>
        ) : <p className="dv-cab">Cuando alguien cumpla la primera, aparece acá.</p>}
      </section>
      {total.length ? (
        <section className="dv-g" aria-label="Lo sumado en la temporada">
          <h3 className="dv-gt">En la temporada<small>lo sumado con misiones</small></h3>
          <ol className="dv-tabla mi-tabla con-i mi-cols">
            {total.map(([raw, pts], i) => {
              const f = liga.fila(raw);
              return (
                <li key={raw} className={esYo(raw) ? 'yo' : ''}>
                  <span className="dv-i">{i + 1}</span>
                  <Quien liga={liga} raw={raw} />
                  {f ? <a className="dv-n" href={'#/r/' + encodeURIComponent(f.k)}>{limpio(raw)}</a> : <span className="dv-n">{limpio(raw)}</span>}
                  <b className="dv-p">{num(pts)}</b>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
