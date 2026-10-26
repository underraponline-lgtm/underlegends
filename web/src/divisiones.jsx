// 🏟️ LAS DIVISIONES DE LA SEMANA (Dlx, 29/09/2026: «como otro tipo de eventos semanales»; 04/10/2026: «1. A 2. C,
// subir a una división mejor y más competitiva»). La cuenta la hace el ciclo (`bot/divisiones.py`) y viaja en el
// lobby (`div`): acá sólo se muestra. Una tabla por grupo de 30; los de arriba suben y los de abajo bajan.
//
// ⚠️ LA ZONA ES LA MISMA CUENTA QUE `divisiones.zona()`: cinco, o un tercio si el grupo es chico. Si se cambia allá,
// se cambia acá.
import { useEffect, useState } from 'react';
import { MESES, limpio, num } from './liga.js';
import { Cara } from './piezas.jsx';

const zonaDe = (n, z) => Math.min(z, Math.floor(n / 3));

function fechaCorta(iso) {
  const d = new Date(String(iso || '') + 'T12:00:00');
  return isNaN(d) ? '' : d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3);
}

// La semana recién empezada, sin nadie que haya jugado todavía: en qué división estás y cómo cerró la anterior.
// ⚠️ Antes las divisiones desaparecían de la página cada lunes hasta el primer evento (ver `divisiones.para_web()`).
function SemanaNueva({ liga, D, esYo }) {
  const nombres = D.n || [];
  const yo = liga.yo;
  const mio = yo ? Object.keys(D.v || {}).find(esYo) : null;
  const ult = D.u;
  const ultYo = ult && yo ? (ult.sube.some(esYo) ? 'subiste' : ult.baja.some(esYo) ? 'bajaste' : '') : '';
  return (
    <div className="dvp">
      <p className="dvp-cab"><b>Semana nueva</b> · todavía nadie jugó · cierra {liga.dia(D.fin)}</p>
      <p className="dvp-yo">{mio != null ? 'Estás en ' + nombres[D.v[mio]] + ' División: juega un evento y entras en la tabla de esta semana.'
        : 'Juegas un evento y entras en Sexta; los primeros de cada grupo suben.'}</p>
      {ult ? <p className="dvp-yo">{ultYo ? (ultYo === 'subiste' ? '⬆️ La semana pasada subiste de división. ' : '⬇️ La semana pasada bajaste de división. ') : ''}
        La semana del {fechaCorta(ult.sem)} subieron {ult.sube.length} y bajaron {ult.baja.length}.</p> : null}
      {/* los que subieron la semana pasada, con su cara: la previa no queda en tres renglones (sin huecos grandes) */}
      {ult && ult.sube.length ? (
        <ul className="dvp-sub" aria-label="Subieron la semana pasada">
          {ult.sube.slice(0, 8).map((raw) => {
            const f = liga.fila(raw);
            return (
              <li key={raw}>
                {f ? <Cara liga={liga} k={f.k} nombre={f.n} cls="cara dv-cara" /> : <span className="cara dv-cara ini">{limpio(raw).slice(0, 1).toUpperCase()}</span>}
                {f ? <a className="dv-n" href={'#/r/' + encodeURIComponent(f.k)}>{limpio(raw)}</a> : <span className="dv-n">{limpio(raw)}</span>}
                <i className="dv-z">SUBIÓ</i>
              </li>
            );
          })}
          {ult.sube.length > 8 ? <li className="dvp-mas">y {ult.sube.length - 8} más</li> : null}
        </ul>
      ) : null}
      <a className="evp-lnk dvp-lnk" href="#/ranking/divisiones">Ver las divisiones</a>
    </div>
  );
}

// 🏟️ LA PREVIA DEL INICIO (Dlx, 05/10/2026: «que divisiones tenga su espacio en INICIO también como una previa…
// el primer panel donde está tu temporada y encuestas»). Tu grupo de esta semana —o, si no jugaste, el de la división
// más alta con gente—: los de la zona de subida, y vos si estás más abajo. La tabla entera está en el Ranking.
export function DivisionPrevia({ liga }) {
  const D = liga.d.div;
  if (!D) return null;
  const yo = liga.yo;
  const nombres = D.n || [];
  const divs = D.d || [];
  const esYo = (raw) => !!yo && liga.esDe(raw, yo.k);
  if (esElo(D)) return <PreviaElo liga={liga} D={D} esYo={esYo} />;
  let di = -1, gi = -1;
  divs.forEach((gs, i) => (gs || []).forEach((g, j) => { if (di < 0 && g.some((f) => esYo(f[0]))) { di = i; gi = j; } }));
  const mia = di >= 0;
  if (!mia) { di = divs.findIndex((gs) => (gs || []).length); gi = 0; }
  if (di < 0) return <SemanaNueva liga={liga} D={D} esYo={esYo} />;
  const g = (divs[di] || [])[gi] || [];
  const z = zonaDe(g.length, D.z);
  const ultima = nombres.length - 1;
  const pos = mia ? g.findIndex((f) => esYo(f[0])) : -1;
  const filas = g.slice(0, Math.max(z, 3)).map((f, i) => [f, i]);
  if (pos >= filas.length) filas.push([g[pos], pos]);
  const estado = !mia ? (yo ? 'Esta semana todavía no jugaste: con un evento entras en tu división.'
    : 'Juegas un evento y entras en Sexta.')
    : pos < z && di > 0 ? '⬆️ Vas ' + (pos + 1) + 'º: estás en zona de subida.'
      : pos >= g.length - z && di < ultima ? '⬇️ Vas ' + (pos + 1) + 'º: estás en zona de descenso.'
        : 'Vas ' + (pos + 1) + 'º de ' + g.length + '.';
  return (
    <div className="dvp">
      <p className="dvp-cab"><b>{nombres[di]} División</b>{(divs[di] || []).length > 1 ? ' · grupo ' + (gi + 1) : ''} · {g.length} jugando · cierra {liga.dia(D.fin)}</p>
      <p className="dvp-yo">{estado} Los {z} primeros de cada grupo suben y ganan <b>{num(D.p)} Puntos de Tienda</b>.</p>
      <ol className="dv-tabla dvp-tabla">
        {filas.map(([f, i]) => {
          const p = liga.fila(f[0]);
          const sube = di > 0 && i < z;
          return (
            <li key={f[0]} className={(sube ? 'sube' : '') + (esYo(f[0]) ? ' yo' : '') + (i === z && filas.length > z ? ' corte' : '')}>
              <span className="dv-i">{i + 1}</span>
              {p ? <Cara liga={liga} k={p.k} nombre={p.n} cls="cara dv-cara" /> : <span className="cara dv-cara ini">{limpio(f[0]).slice(0, 1).toUpperCase()}</span>}
              {p ? <a className="dv-n" href={'#/r/' + encodeURIComponent(p.k)}>{limpio(f[0])}</a> : <span className="dv-n">{limpio(f[0])}</span>}
              {sube ? <i className="dv-z">SUBE</i> : <span />}
              <b className="dv-p">{num(f[1])}</b>
            </li>
          );
        })}
      </ol>
      <a className="evp-lnk dvp-lnk" href="#/ranking/divisiones">Ver todas las divisiones</a>
    </div>
  );
}

// cuánto falta para que cierre la semana: «en 3 días», «en 5 horas», «en 20 min»
function enCuanto(liga, iso) {
  const ms = new Date(iso).getTime() - (+liga.ahora);
  if (!(ms > 0)) return '';
  const h = Math.round(ms / 3600000);
  if (h >= 48) return 'en ' + Math.round(h / 24) + ' días';
  if (h >= 2) return 'en ' + h + ' horas';
  const m = Math.max(1, Math.round(ms / 60000));
  return m >= 60 ? 'en 1 hora' : 'en ' + m + ' min';
}

// 📈 EL RANKING ELO (Dlx, 26/10/2026: «divisiones ahora serían Ranking ELO», «por tramos de ELO»). Desde la semana del
// 02/11 el ciclo manda `m: 'elo'`: cada división es UNA tabla con todos los que están en ella, por ELO en vivo, y cada
// fila es [rapero, elo, batallas, división si cerrara ahora]. `t` son los cortes (de Primera a Quinta) y `pv` cuántas
// batallas hacen falta para que el ELO deje de ser provisional. La cuenta está en `bot/divisiones.py`.
const esElo = (D) => !!D && D.m === 'elo';
// el ELO desde el que se está en la división `d`: Sexta no tiene piso
const pisoDe = (D, d) => (d < (D.t || []).length ? D.t[d] : null);
const TOPE_FILAS = 50;
// 💎 como Brawl Stars Ranked (Dlx, 26/10/2026): piedras de Hierro a Mítico (`D.n`, con su color en `D.c`) y tres
// subniveles, I · II · III de abajo arriba (`divisiones.subnivel()`: tercios del tramo de 50)
const SUBS = ['I', 'II', 'III'];
const rango = (D, d, s) => (D.n || [])[d] + ' ' + SUBS[s || 0];
const signo = (x) => (x > 0 ? '+' : x < 0 ? '−' : '±') + Math.abs(x);
// el ELO desde el que empieza el subnivel `s` de la división `d` (Hierro se mide desde 50 abajo de su techo)
function corteDe(D, d, s) {
  const piso = d < D.t.length ? D.t[d] : D.t[D.t.length - 1] - 50;
  return piso + Math.ceil((s * 50) / 3);
}
// el próximo escalón por encima de alguien: [su nombre, el ELO desde el que empieza], o null en Mítico III
function proximo(D, d, s) {
  if (s < 2) return [rango(D, d, s + 1), corteDe(D, d, s + 1)];
  if (d > 0) return [rango(D, d - 1, 0), D.t[d - 1]];
  return null;
}

function miFila(divs, esYo) {
  for (let i = 0; i < divs.length; i++) {
    const g = (divs[i] || [])[0] || [];
    const p = g.findIndex((f) => esYo(f[0]));
    if (p >= 0) return { di: i, g, pos: p, f: g[p] };
  }
  return null;
}

// qué le pasa a cada uno si la semana cerrara ahora, en palabras
function estadoElo(D, nombres, di, f) {
  const [, elo, n, a, s] = f;
  if (n < (D.pv || 5)) {
    const faltan = (D.pv || 5) - n;
    return { msg: <>Tu ELO es <b>provisional</b>: te {faltan === 1 ? 'falta 1 batalla' : 'faltan ' + faltan + ' batallas'} 1v1 para que cuente. Hasta entonces no te mueve.</>, chip: 'provisional' };
  }
  if (a < di) return { msg: <>Si la semana cierra así, <b className="sube">subes a {rango(D, a, s)}</b>. Cada piedra nueva paga {num(D.p)} Puntos de Tienda la primera vez, y cada subnivel {num(D.ps || 150)}.</>, chip: 'subirías' };
  if (a > di) return { msg: <>Si la semana cierra así, <b className="baja">bajas a {rango(D, a, s)}</b>: {nombres[di]} empieza en {num(pisoDe(D, di))}.</>, chip: 'bajarías' };
  const sig = proximo(D, di, s);
  if (!sig) return { msg: <>Estás en <b>{rango(D, 0, 2)}</b>: la cima.</>, chip: '' };
  return { msg: <>Te faltan <b>{num(Math.max(1, sig[1] - elo))} de ELO</b> para {sig[0]} ({num(sig[1])}). Llegar por primera vez paga {num(sig[0].endsWith(' I') ? D.p : (D.ps || 150))} Puntos de Tienda.</>, chip: '' };
}

function TuSemanaElo({ liga, D, nombres, divs, esYo }) {
  const cierra = enCuanto(liga, D.fin);
  const reloj = cierra ? <span className="dv-tu-chip oro">cierra {cierra}</span> : null;
  const yo = miFila(divs, esYo);
  if (!yo) {
    return (
      <section className="dv-tu" aria-label="Tu ELO">
        <div className="dv-tu-c"><b>{rango(D, nombres.length - 1, 0)}</b><small>todavía no tienes ELO</small></div>
        <p>Tu ELO sale de tus batallas 1v1: juega una y entras en el ranking. Con {D.pv || 5} ya cuenta para subir de división.</p>
        <div className="dv-tu-chips">{reloj}</div>
      </section>
    );
  }
  const { di, g, pos, f } = yo;
  const e = estadoElo(D, nombres, di, f);
  // 📏 tu ELO entre el piso de tu subnivel y el próximo escalón
  const s = f[4] || 0;
  const piso = corteDe(D, di, s);
  const sig = proximo(D, di, s);
  const techo = sig ? sig[1] : Math.max(f[1], g[0][1]);
  const pct = techo > piso ? Math.max(0, Math.min(100, Math.round(100 * (f[1] - piso) / (techo - piso)))) : 100;
  return (
    <section className="dv-tu" aria-label="Tu ELO">
      <div className="dv-tu-c"><b><i className="dv-gema" style={{ background: (D.c || [])[di] }} aria-hidden="true" />{rango(D, di, s)}</b><small>ELO {num(f[1])} · vas {pos + 1}º de {g.length} en {nombres[di]}</small></div>
      <p>{e.msg}</p>
      <span className="dv-tu-barra" role="progressbar" aria-label={di > 0 ? 'Tu ELO hacia ' + nombres[di - 1] : 'Tu ELO'} aria-valuemin={piso} aria-valuemax={techo} aria-valuenow={f[1]}>
        <i style={{ width: pct + '%' }} />
      </span>
      <div className="dv-tu-chips">{reloj}{e.chip ? <span className="dv-tu-chip">{e.chip}</span> : null}<span className="dv-tu-chip">{f[2]} {f[2] === 1 ? 'batalla' : 'batallas'}</span></div>
      {/* ± lo que te dio o te sacó cada batalla, como el +/− de Brawl después de cada partida */}
      {(f[5] || []).length ? (
        <ul className="dv-ultb" aria-label="Tus últimas batallas">
          {f[5].map(([x, rival], i) => <li key={i} className={x > 0 ? 'sube' : x < 0 ? 'baja' : ''}><b>{signo(x)}</b> vs {limpio(rival)}</li>)}
        </ul>
      ) : null}
    </section>
  );
}

function GrupoElo({ liga, g, sel, nombres, D, esYo }) {
  const yo = g.findIndex((f) => esYo(f[0]));
  const vis = g.slice(0, TOPE_FILAS).map((f, i) => [f, i]);
  if (yo >= TOPE_FILAS) vis.push([g[yo], yo]);
  const piso = pisoDe(D, sel);
  return (
    <section className="dv-g" aria-label={nombres[sel]}>
      <h3 className="dv-gt"><i className="dv-gema" style={{ background: (D.c || [])[sel] }} aria-hidden="true" />{nombres[sel]}<small>{piso ? 'desde ' + num(piso) + ' de ELO' : 'menos de ' + num(D.t[D.t.length - 1]) + ' de ELO'} · {g.length} {g.length === 1 ? 'rapero' : 'raperos'}</small></h3>
      <ol className="dv-tabla dv-tabla2 elo">
        {vis.map(([[raw, elo, n, a, s, h], i]) => {
          const f = liga.fila(raw);
          const prov = n < (D.pv || 5);
          const zona = prov ? '' : a < sel ? 'sube' : a > sel ? 'baja' : '';
          return (
            <li key={raw} className={zona + (esYo(raw) ? ' yo' : '') + (i >= TOPE_FILAS ? ' corte' : '')}>
              <span className="dv-i">{i + 1}</span>
              {f ? <Cara liga={liga} k={f.k} nombre={f.n} cls="cara dv-cara" /> : <span className="cara dv-cara ini">{limpio(raw).slice(0, 1).toUpperCase()}</span>}
              {f ? <a className="dv-n" href={'#/r/' + encodeURIComponent(f.k)}>{limpio(raw)}</a> : <span className="dv-n">{limpio(raw)}</span>}
              <span className="dv-ev">{SUBS[s || 0]} · {prov ? 'provisional' : n + ' batallas'}{(h || [])[0] ? <em className={h[0][0] > 0 ? 'sube' : h[0][0] < 0 ? 'baja' : ''}> {signo(h[0][0])}</em> : null}</span>
              {zona === 'sube' ? <i className="dv-z">SUBIRÍA</i> : zona === 'baja' ? <i className="dv-z">BAJARÍA</i> : <span />}
              <b className="dv-p">{num(elo)}</b>
            </li>
          );
        })}
      </ol>
      {g.length > vis.length ? <p className="dv-mas">y {g.length - vis.length} más en {nombres[sel]}</p> : null}
    </section>
  );
}

function PreviaElo({ liga, D, esYo }) {
  const nombres = D.n || [];
  const divs = D.d || [];
  const yo = miFila(divs, esYo);
  const di = yo ? yo.di : divs.findIndex((gs) => (gs || []).length);
  if (di < 0) return null;
  const g = (divs[di] || [])[0] || [];
  const filas = g.slice(0, 3).map((f, i) => [f, i]);
  if (yo && yo.pos >= 3) filas.push([yo.f, yo.pos]);
  const e = yo ? estadoElo(D, nombres, di, yo.f) : null;
  return (
    <div className="dvp">
      <p className="dvp-cab"><b>{yo ? rango(D, di, yo.f[4]) : nombres[di]}</b> · {g.length} {g.length === 1 ? 'rapero' : 'raperos'} en {nombres[di]} · cierra {liga.dia(D.fin)}</p>
      <p className="dvp-yo">{e ? e.msg : 'Tu división sale de tu ELO: juega batallas 1v1 y entras en el ranking.'}</p>
      <ol className="dv-tabla dvp-tabla">
        {filas.map(([[raw, elo], i]) => {
          const p = liga.fila(raw);
          return (
            <li key={raw} className={esYo(raw) ? 'yo' : ''}>
              <span className="dv-i">{i + 1}</span>
              {p ? <Cara liga={liga} k={p.k} nombre={p.n} cls="cara dv-cara" /> : <span className="cara dv-cara ini">{limpio(raw).slice(0, 1).toUpperCase()}</span>}
              {p ? <a className="dv-n" href={'#/r/' + encodeURIComponent(p.k)}>{limpio(raw)}</a> : <span className="dv-n">{limpio(raw)}</span>}
              <span />
              <b className="dv-p">{num(elo)}</b>
            </li>
          );
        })}
      </ol>
      <a className="evp-lnk dvp-lnk" href="#/ranking/divisiones">Ver el Ranking ELO</a>
    </div>
  );
}

// 🪜 LA ESCALERA (Dlx, 08/10/2026: «quiero que mejores la sección de divisiones»; a las cuatro ideas, «A»). Las seis
// siempre a la vista, de Sexta —donde se entra— a Primera —la cima—, con cuántos juegan esta semana en cada una y cuál
// es la tuya. Había un botón por división CON GENTE: se veían Cuarta, Quinta y Sexta y no a dónde se podía llegar.
// 🧑 Y DESDE EL 14/10/2026 CON CARAS Y «VOS» (Dlx, a la maqueta: «Escalera con caras y vos»): las caras de los primeros
// tres de cada una, y la marca de la tuya ARRIBA del escalón —adentro se pisaba con el nombre: «CUARTA» encima de «7
// jugando · la tuya» en la compu—
function Escalera({ liga, nombres, divs, sel, setSel, mia, elo, colores }) {
  const orden = nombres.map((_n, i) => i).reverse();
  return (
    <div className="dv-esc" role="group" aria-label="Las divisiones, de Sexta a Primera">
      {orden.map((i, k) => {
        const n = (divs[i] || []).reduce((t, g) => t + g.length, 0);
        const top = [].concat(...(divs[i] || []).map((g) => g.slice(0, 3))).sort((a, b) => b[1] - a[1]).slice(0, 3);
        return (
          <button type="button" key={i} aria-pressed={i === sel} onClick={() => setSel(i)}
            aria-label={nombres[i] + ' División: ' + (n ? n + (elo ? ' en ella' : ' jugando') : 'nadie') + (i === mia ? ', la tuya' : '')}
            className={'dv-esc-p' + (i === sel ? ' on' : '') + (i === mia ? ' mia' : '') + (n ? '' : ' vacia')}
            style={{ '--alto': (78 + k * 12) + 'px' }} title={nombres[i] + ' División'}>
            {i === mia ? <i className="dv-esc-vos" aria-hidden="true">TÚ</i> : null}
            {elo ? <b className="dv-gema" style={{ background: (colores || [])[i] }}>{nombres[i].slice(0, 1)}</b> : <b>{i + 1}ª</b>}
            <span>{nombres[i]}</span>
            {top.length ? (
              <i className="dv-esc-caras" aria-hidden="true">{top.map(([raw]) => {
                const f = liga.fila(raw);
                return f ? <Cara key={raw} liga={liga} k={f.k} nombre={f.n} cls="cara dv-esc-cara" />
                  : <span key={raw} className="cara dv-esc-cara ini">{limpio(raw).slice(0, 1).toUpperCase()}</span>;
              })}</i>
            ) : null}
            <small>{n ? <>{n}<em>{elo ? (n === 1 ? ' rapero' : ' raperos') : ' jugando'}</em></> : i === 0 ? 'la cima' : 'nadie'}</small>
          </button>
        );
      })}
    </div>
  );
}

// 🎯 TU SEMANA (Dlx, 14/10/2026, a la maqueta: «Tu semana arriba»). Lo primero que importa —en qué división estás, qué
// puesto, si subís o bajás y cuánto te falta— y el premio y el reloj a la vista. Antes era un párrafo largo arriba y una
// línea chica abajo de la escalera
function TuSemana({ liga, D, nombres, divs, esYo }) {
  const cierra = enCuanto(liga, D.fin);
  const ultima = nombres.length - 1;
  let di = -1, gi = -1, pos = -1;
  divs.forEach((gs, i) => (gs || []).forEach((g, j) => {
    const p = g.findIndex((f) => esYo(f[0]));
    if (di < 0 && p >= 0) { di = i; gi = j; pos = p; }
  }));
  const reloj = cierra ? <span className="dv-tu-chip oro">cierra {cierra}</span> : null;
  if (di < 0) {
    const yaEsta = liga.yo ? Object.keys(D.v || {}).find(esYo) : null;
    return (
      <section className="dv-tu" aria-label="Tu semana">
        <div className="dv-tu-c"><b>{yaEsta != null ? nombres[D.v[yaEsta]] + ' División' : 'Sexta División'}</b><small>todavía no jugaste esta semana</small></div>
        <p>Juegas un evento y entras en la tabla de esta semana. Los primeros de cada grupo suben y cobran <b>{num(D.p)} Puntos de Tienda</b>.</p>
        <div className="dv-tu-chips">{reloj}</div>
      </section>
    );
  }
  const g = (divs[di] || [])[gi] || [];
  const z = zonaDe(g.length, D.z);
  const subeZ = di > 0 ? z : 0;
  const bajaZ = di < ultima ? z : 0;
  const pts = g[pos][1];
  const max = Math.max(1, g[0][1]);
  let msg, chip = '';
  if (subeZ && pos < subeZ) {
    msg = <>Si la semana cierra así, <b className="sube">subes a {nombres[di - 1]}</b> y cobras {num(D.p)} Puntos de Tienda.</>;
    const atras = g[subeZ];
    if (atras) chip = limpio(atras[0]) + ', ' + (subeZ + 1) + 'º, a ' + num(Math.max(0, pts - atras[1])) + ' pts';
  } else if (bajaZ && pos >= g.length - bajaZ) {
    const arriba = g[g.length - bajaZ - 1];
    msg = <><b className="baja">Zona de descenso</b>: {arriba ? 'te faltan ' + num(Math.max(1, arriba[1] - pts + 1)) + ' pts para salir.' : 'si cierra así, bajas a ' + nombres[di + 1] + '.'}</>;
    if (arriba) chip = 'para salir: pasar a ' + limpio(arriba[0]);
  } else if (subeZ) {
    const corte = g[subeZ - 1];
    msg = <>Te faltan <b>{num(Math.max(1, corte[1] - pts + 1))} pts</b> para entrar en la zona de subida y cobrar {num(D.p)}.</>;
    chip = 'el ' + subeZ + 'º: ' + limpio(corte[0]) + ' · ' + num(corte[1]);
  } else if (di > 0 && !z) {
    // un grupo de menos de 3: un tercio de 1 o 2 es cero, así que nadie sube (`divisiones.zona()`)
    msg = <>Sos {g.length === 1 ? 'el único' : 'uno de los ' + g.length} en {nombres[di]} esta semana: para que alguien suba, el grupo necesita al menos 3.</>;
  } else {
    msg = di === 0 ? <>Estás en <b>Primera</b>: la cima.</> : <>Vas {pos + 1}º de {g.length}.</>;
  }
  const corteP = subeZ && g[subeZ - 1] ? g[subeZ - 1][1] : 0;
  return (
    <section className="dv-tu" aria-label="Tu semana">
      <div className="dv-tu-c"><b>{nombres[di]} División</b><small>{(divs[di] || []).length > 1 ? 'grupo ' + (gi + 1) + ' · ' : ''}vas {pos + 1}º de {g.length}</small></div>
      <p>{msg}</p>
      {/* 📏 tus puntos contra los del primero, y la raya del último que sube */}
      <span className="dv-tu-barra" role="progressbar" aria-label="Tus puntos contra los del primero" aria-valuemin={0} aria-valuemax={max} aria-valuenow={pts}>
        <i style={{ width: Math.min(100, Math.round(100 * pts / max)) + '%' }} />
        {corteP ? <u style={{ left: Math.min(100, Math.round(100 * corteP / max)) + '%' }} title={'el ' + subeZ + 'º: ' + num(corteP) + ' pts'} /> : null}
      </span>
      <div className="dv-tu-chips">{reloj}{chip ? <span className="dv-tu-chip">{chip}</span> : null}</div>
    </section>
  );
}

// 🏷️ las tres zonas de un grupo como bandas con su título (Dlx, 14/10/2026: «Zonas como bandas»): antes eran líneas
// de corte entre filas, debajo de la zona; ahora el título va ARRIBA de cada bloque
function Grupo({ liga, g, gi, gs, sel, nombres, D, esYo }) {
  const ultima = nombres.length - 1;
  const z = zonaDe(g.length, D.z);
  const subeZ = sel > 0 ? z : 0;
  const bajaZ = sel < ultima ? z : 0;
  const desdeBaja = bajaZ ? Math.max(subeZ, g.length - bajaZ) : g.length;
  const banda = (cls, txt) => <li key={'b-' + cls} className={'dv-banda ' + cls}>{txt}</li>;
  const filas = [];
  g.forEach(([raw, pts, ev], i) => {
    if (i === 0 && subeZ) filas.push(banda('sube', '▲ Suben a ' + nombres[sel - 1] + ' · +' + num(D.p) + ' Puntos de Tienda'));
    if (i === subeZ && i < desdeBaja && (subeZ || bajaZ)) filas.push(banda('queda', 'Se quedan en ' + nombres[sel]));
    if (bajaZ && i === desdeBaja) filas.push(banda('baja', '▼ Bajan a ' + nombres[sel + 1]));
    const f = liga.fila(raw);
    const zona = i < subeZ ? 'sube' : i >= desdeBaja ? 'baja' : '';
    filas.push(
      <li key={raw} className={zona + (esYo(raw) ? ' yo' : '')}>
        <span className="dv-i">{i + 1}</span>
        {f ? <Cara liga={liga} k={f.k} nombre={f.n} cls="cara dv-cara" /> : <span className="cara dv-cara ini">{limpio(raw).slice(0, 1).toUpperCase()}</span>}
        {f ? <a className="dv-n" href={'#/r/' + encodeURIComponent(f.k)}>{limpio(raw)}</a> : <span className="dv-n">{limpio(raw)}</span>}
        <span className="dv-ev">{ev} {ev === 1 ? 'evento' : 'eventos'}</span>
        <b className="dv-p">{num(pts)}</b>
      </li>,
    );
  });
  return (
    <section className="dv-g" aria-label={nombres[sel] + ' División' + (gs.length > 1 ? ', grupo ' + (gi + 1) : '')}>
      <h3 className="dv-gt">{nombres[sel]} División{gs.length > 1 ? ' · grupo ' + (gi + 1) : ''}<small>{g.length} jugando</small></h3>
      <ol className="dv-tabla dv-tabla2">{filas}</ol>
    </section>
  );
}

export function Divisiones({ liga }) {
  const D = liga.d.div;
  const yo = liga.yo;
  const nombres = (D && D.n) || [];
  const divs = (D && D.d) || [];
  const esYo = (raw) => !!yo && liga.esDe(raw, yo.k);
  const mia = divs.findIndex((gs) => (gs || []).some((g) => g.some((f) => esYo(f[0]))));
  const elo = esElo(D);
  const conGente = divs.findIndex((gs) => (gs || []).length);
  const [sel, setSel] = useState(mia >= 0 ? mia : Math.max(0, conGente));
  useEffect(() => { if (mia >= 0) setSel(mia); }, [mia]);
  if (!D) return null;
  const ult = D.u;
  const ultYo = ult && yo ? (ult.sube.some(esYo) ? 'sube' : ult.baja.some(esYo) ? 'baja' : '') : '';
  const gs = divs[sel] || [];
  const ultima = nombres.length - 1;
  const nadie = !divs.some((x) => (x || []).length);
  // 🖥️ EN LA COMPU, A DOS COLUMNAS (Dlx, 14/10/2026: «Compu a dos columnas»): a la izquierda tu semana y la tabla; a la
  // derecha la escalera, cómo funciona y la semana pasada. A ~1333 px la escalera ocupaba media pantalla y dejaba un
  // hueco grande a la derecha. En el celular, una columna: tu semana, la escalera, la tabla y lo demás
  return (
    <div className="dv dv2">
      <div className="dv2-tu">{elo ? <TuSemanaElo liga={liga} D={D} nombres={nombres} divs={divs} esYo={esYo} />
        : <TuSemana liga={liga} D={D} nombres={nombres} divs={divs} esYo={esYo} />}</div>
      <div className="dv2-esc"><Escalera liga={liga} nombres={nombres} divs={divs} sel={sel} setSel={setSel} mia={mia} elo={elo} colores={D && D.c} /></div>
      {elo ? (
        <div className="dv2-tab">
          {!gs.length ? <p className="dv-vacia">{sel === 0 ? 'Nadie llegó todavía a ' + nombres[0] + ': es la cima, desde ' + num(D.t[0]) + ' de ELO.' : 'Nadie está hoy en ' + nombres[sel] + '.'}</p> : null}
          {gs.length ? <GrupoElo liga={liga} g={gs[0]} sel={sel} nombres={nombres} D={D} esYo={esYo} /> : null}
        </div>
      ) : <div className="dv2-tab">
        {nadie ? <p className="dv-cab"><b>Semana nueva:</b> todavía nadie jugó. Las tablas arrancan con el primer evento de la semana.</p> : null}
        {!gs.length && !nadie ? (
          <p className="dv-vacia">{sel === 0 ? 'Nadie llegó todavía a Primera División: es la cima. ' : 'Esta semana nadie juega en ' + nombres[sel] + ' División. '}
            {sel < ultima ? 'Se llega subiendo desde ' + nombres[sel + 1] + ': los ' + D.z + ' primeros de cada grupo suben.' : 'Se entra jugando un evento.'}</p>
        ) : null}
        {gs.map((g, gi) => <Grupo key={gi} liga={liga} g={g} gi={gi} gs={gs} sel={sel} nombres={nombres} D={D} esYo={esYo} />)}
      </div>}
      <div className="dv2-info">
        <section className="dv-caja">
          <h4>Cómo funciona</h4>
          {elo ? <p>Como el Ranked de Brawl Stars: tu rango sale de tu <b>ELO</b>, tu nivel según a quién le ganas y con quién pierdes en las batallas 1v1, y subes o bajas con él. Se mira cada lunes a las 11 AM.
            {' '}{nombres.slice(0, D.t.length).map((x, i) => x + ' desde ' + num(D.t[i])).join(', ')}, y {nombres[nombres.length - 1]} abajo; cada uno con tres subniveles, I, II y III.
            {' '}La primera vez que llegas a una piedra cobras <b>{num(D.p)} Puntos de Tienda</b>, y a un subnivel {num(D.ps || 150)}. Al final de la temporada hay premio según el rango más alto que alcanzaste. Con menos de {D.pv || 5} batallas tu ELO es provisional y no te mueve.</p> : <p>Semana del {fechaCorta(D.sem)} al {liga.dia(D.fin)}. Juegas un evento y entras en Sexta; los grupos son de 30.
            {' '}Al cierre, los {D.z} primeros de cada grupo suben y cobran <b>{num(D.p)} Puntos de Tienda</b>, y los {D.z} últimos bajan. En un grupo chico, un tercio.</p>}
        </section>
        {ult ? (
          <section className="dv-caja">
            <h4>La semana pasada</h4>
            <p>{ultYo === 'sube' ? '⬆️ Subiste de división. ' : ultYo === 'baja' ? '⬇️ Bajaste de división. ' : ''}
              Del {fechaCorta(ult.sem)}: subieron {ult.sube.length} y bajaron {ult.baja.length}.</p>
            {ult.sube.length ? (
              <span className="dv-caja-caras" aria-label="Algunos de los que subieron">
                {ult.sube.slice(0, 10).map((raw) => {
                  const f = liga.fila(raw);
                  return f ? <a key={raw} href={'#/r/' + encodeURIComponent(f.k)} title={limpio(raw)}><Cara liga={liga} k={f.k} nombre={f.n} cls="cara dv-esc-cara" /></a>
                    : <span key={raw} className="cara dv-esc-cara ini" title={limpio(raw)}>{limpio(raw).slice(0, 1).toUpperCase()}</span>;
                })}
                {ult.sube.length > 10 ? <small>+{ult.sube.length - 10}</small> : null}
              </span>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
