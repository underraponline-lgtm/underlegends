// 🏟️ LAS BATALLAS DE LIGA, MIENTRAS SE JUEGAN (Dlx, 04/11/2026: «qué podríamos hacer con las ligas… cómo sabe el bot que
// hay una batalla de liga ahora?», y sobre cómo detectarla: «quién está en la llamada… en el canal de visuales… si alguien
// pone algo, significa que ya va a empezar»).
//
// MEDIDO ANTES DE ESCRIBIR ESTO, con BLOODY vs VARGAS de la FMH Tricolor (04/11, ET):
//     6:48 PM  el mismo título en Visuales y en Veredictos
//     6:50     el primer beat (`m!p`, y contesta Jockie Music)
//     7:05     «# BLOODY Por 3 Puntos»
//     7:07     PTB TOTAL
//
// LO QUE VALE COMO SEÑAL, CON SUS NÚMEROS (las seis FMH, sus últimos ~200 mensajes):
//   · «alguien puso algo en Visuales» SOLO NO: la mitad de las tandas no tiene una batalla en los 45 minutos siguientes
//     (FMH España: 34 de 45), porque ahí también van las imágenes y las temáticas.
//   · el TÍTULO `A vs B` en Visuales SÍ: del 80 al 95 % tiene su título en Veredictos, casi siempre en el mismo minuto
//     (a veces 5 o más antes: ésa es la ventaja). El resto no, y por eso sólo deja la batalla como CANDIDATA.
//   · la LLAMADA confirma y no dispara: el 04/11 la de FMH Tricolor tuvo 3 personas con el micrófono abierto durante diez
//     minutos sin batalla. Lo que sirve es preguntar por LOS DOS RIVALES (`GET /guilds/{g}/voice-states/{id}`).
//   · los BEATS confirman: `last_message_id` del canal, sin leerlo.
//
// ESTADOS (`transicion()`):
//     candidata   título en Visuales, nada más. No se muestra; a los 45 minutos sin señal se olvida
//     arranca     título en Veredictos, o candidata con los rivales en la llamada o sonando un beat
//     juego       confirmado por la llamada o los beats
//     espera      sin señal hace 12 minutos y nadie de los dos en la llamada: terminó, falta el resultado
//     terminada   el cierre, con su ganador
//     sinres      nunca llegó un cierre que se pueda leer. Sale el resultado cuando lo lea el ciclo
//
// ⚠️ ES UNA COPIA DE LAS REGLAS DE `bot/ligas.py`, Y ESTÁ ATADA: `bot/ligas_vivo_casos.json` lo corren los dos lados
// (`bot/ligas_vivo_prueba.mjs` y el `--auto` de ligas.py). Si un cierre se lee distinto, CI lo dice. Un duelo inventado
// ensucia el Win% de dos personas; acá ni siquiera llega al Win% —eso sigue siendo del ciclo—, pero dice en el chat que
// ganó quien no ganó. Por eso sólo cierra lo que ligas.py también cierra.

const EMOJI = /<a?:\w+:\d+>/g;
const BANDERA = /[\u{1F1E6}-\u{1F1FF}]/gu;
const SEP = /(?:\s|(?<=[\u{1F1E6}-\u{1F1FF}]))(?:vs\.?|v\/s|versus)(?:\s|(?=[\u{1F1E6}-\u{1F1FF}]))|🆚|<a?:\w*(?:vs|versus)\w*:\d+>/iu;
const JORNADA = /\bJORNADA\s*-?\s*(\d{1,2})\b|\bBATALLA\s+J\s*(\d{1,2})\b/i;
const NO_PAL = '[^\\p{L}\\p{N}_]*';
const GANA = new RegExp('^' + NO_PAL + '(.+?)\\s+GANA\\s+(DIRECTO|DIRECTA|EN\\s+(?:LA\\s+)?R[EÉ]PLICA|DESPU[EÉ]S\\s+DE\\s+[\\p{L}\\p{N}_]+\\s+R[EÉ]PLICAS?)', 'iu');
const GANA_DESPUES = new RegExp('^' + NO_PAL + 'GANA\\s+(.+)$', 'iu');
const POR_PUNTOS = /^[#*\s]*(.+?)\s+(?:POR|X)\s+(\d+(?:[.,]\d+)?)\s*(?:PUNTOS?|PTS?|PTOS?)(?![\p{L}\p{N}_])/iu;
const PTB_LINEA = new RegExp('^' + NO_PAL + '(.+?)\\s*:\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:\\(\\s*[\\d.,]+\\s*\\))?\\s*\\**\\s*(\\+\\s*[0-3])?', 'iu');
const GANADOR = /^#*\s*GANADOR\s*(REPLICA\s*)?:?\s*(.*)$/i;
//: «# MAKMA +3PTO», «# TOKIO+3»: el que suma 3 ganó directo y el que suma 2, en réplica. ⚠️ `bot/ligas.py` tiene el mismo
const MAS_PUNTOS = /^#*\s*(.+?)\s*\+\s*([23])\s*(?:PTOS?|PTS?|PUNTOS?)?\s*$/i;
const X_MINIMA = /^#*\s*(.+?)\s+X\s+LA\s+MINIMA(?![\p{L}\p{N}_])/iu;
const CON_NUMERO = /:\s*\d/;

/** `escuchar.plano()`, el mismo del lector de llaves, con sus tildes. */
export function letras(t) {
  const P = globalThis.LlaveVivo && globalThis.LlaveVivo.plano;
  return String(P ? P(String(t == null ? '' : t)) : (t == null ? '' : t)).normalize('NFC');
}
/** Para buscar y comparar: `letras()` en NFKD y sin tildes. */
export const plano = (t) => letras(t).normalize('NFKD').replace(/\p{M}/gu, '');
export const clave = (n) => plano(n).replace(EMOJI, ' ').toLowerCase().replace(/[^a-z0-9]/g, '');
/** El nombre como se muestra: sin emojis, banderas ni lo que va entre paréntesis. */
export function limpio(n) {
  const t = letras(n).replace(EMOJI, ' ').replace(BANDERA, ' ').replace(/\([^)]*\)/g, ' ').replace(/[^\p{L}\p{N}\p{Z}.'\-_]/gu, '');
  return t.replace(/\s+/g, ' ').replace(/^[ .\-_]+|[ .\-_]+$/g, '');
}
/** `[a, b, extra_a, extra_b]` de un título `# A vs B`, o `null`. */
export function lados(linea) {
  let l = letras(linea).trim();
  if (!l.startsWith('#')) return null;
  l = l.replace(/^#+/, '').trim();
  if (/EXHIBICION/i.test(plano(l)) || /PTB|TABLA/i.test(plano(l))) return null;
  const partes = l.split(SEP);
  if (partes.length !== 2) return null;
  const [a0, b00] = partes;
  const b0 = b00.replace(/\s*[-|]\s*(?:JORNADA\s*\d+|RECUPERATIVA\b).*$/i, '');
  const a = limpio(a0), b = limpio(b0);
  if (!/[A-Za-z]/.test(a) || !/[A-Za-z]/.test(b) || a.length > 40 || b.length > 40) return null;
  // lo último, como lo escribieron y sin sus emojis: la bandera separa a dos que se llaman igual (`genteChat()`)
  return [a, b, a0.includes('🎮'), b0.includes('🎮'), a0.replace(EMOJI, ' ').trim(), b0.replace(EMOJI, ' ').trim()];
}
/** ¿El texto nombra a `a` o a `b`? `'a'`, `'b'` o `null` (los dos o ninguno). */
export function quien(texto, a, b) {
  const t = clave(texto), ka = clave(a), kb = clave(b);
  const ha = !!ka && t.includes(ka), hb = !!kb && t.includes(kb);
  if (ha && hb) return ka.includes(kb) && ka !== kb ? 'a' : kb.includes(ka) ? 'b' : null;
  return ha ? 'a' : hb ? 'b' : null;
}
export const marcaReplica = (linea) => /^replica(\d|final|directa)?$/.test(plano(linea).replace(EMOJI, ' ').toLowerCase().replace(/[^a-z0-9]/g, ''));
const num = (x) => Number(String(x).replace(',', '.'));
const nueva = (m, ls, j) => ({ id: String(m.id), t: m.t, a: ls[0], b: ls[1], ra: ls[4], rb: ls[5], j: j || null, gana: '', como: '', rep: false, df: false, por: null, ptb: null });

//: 🔴 «X POR 4 PUNTOS» Y EL PTB TOTAL NO CIERRAN AL LEERLOS. `_u()` de Python los decide al final, cuando ya leyó todo, y si
//: entremedio hubo una marca de réplica no valen. Acá se leen de a un mensaje, así que se les da este tiempo: medido sobre
//: 246 batallas reales, cerrarlas al leerlas daba 5 ganadores que ligas.py no daba (FORCE vs PLINK salía al revés)
export const PROVISORIO = 10 * 60 * 1000;

/** Lo que dice un mensaje de FMH sobre la batalla que nombra. El mismo orden que `_u_cierre()`: importa. */
function cierreU(texto, bats, tm) {
  const p = plano(texto);
  const lineas = String(texto).split(/\r?\n/).filter((l) => l.trim());
  const batalla = (...ns) => {
    for (let i = bats.length - 1; i >= Math.max(0, bats.length - 8); i--) {
      if (ns.filter(Boolean).every((n) => quien(n, bats[i].a, bats[i].b))) return bats[i];
    }
    return null;
  };
  if (/\bDF\b/.test(p) && lineas.length <= 6) {
    bats[bats.length - 1].df = true;
    return;
  }
  if (lineas.some(marcaReplica)) bats[bats.length - 1].rep = true;
  for (const l of lineas) {
    const pl = plano(l);
    const g2 = GANA_DESPUES.exec(pl);
    if (g2 && !GANA.test(pl)) {
      const b = batalla(g2[1]);
      if (b && b.rep && !b.gana) {
        const lado = quien(g2[1], b.a, b.b);
        if (lado) { b.gana = b[lado]; b.como = 'replica'; }
      }
      continue;
    }
    const g = GANA.exec(pl);
    if (g) {
      const b = batalla(g[1]);
      if (b) {
        const lado = quien(g[1], b.a, b.b);
        if (lado) { b.gana = b[lado]; b.como = /^DIRECT/i.test(g[2]) ? 'directa' : 'replica'; }
      }
      return;
    }
  }
  if (/PTB\s+TOTAL/i.test(p)) {
    const pares = [];
    for (const l of lineas) {
      const mm = PTB_LINEA.exec(plano(l).replace(EMOJI, ' ').replace(/\*\*/g, ''));
      if (mm && !/PTB\s+TOTAL/i.test(mm[1])) pares.push([mm[1], num(mm[2]), mm[3] ? Number(mm[3].replace(/\D/g, '')) : null]);
    }
    if (pares.length >= 2) {
      const b = batalla(pares[0][0], pares[1][0]);
      if (b) {
        const x3 = /X\s*3/i.test(p);
        let [[na, pa, ma], [, pb, mb]] = pares;
        if (quien(na, b.a, b.b) === 'b') [pa, ma, pb, mb] = [pb, mb, pa, ma];
        if ((ma === 2 || ma === 3) && mb !== 2 && mb !== 3) { b.gana = b.a; b.como = ma === 3 ? 'directa' : 'replica'; }
        else if ((mb === 2 || mb === 3) && ma !== 2 && ma !== 3) { b.gana = b.b; b.como = mb === 3 ? 'directa' : 'replica'; }
        else { b.ptb = [pa, pb, x3]; b.tp = tm; }
      }
    }
    return;
  }
  for (const l of lineas) {
    const mm = POR_PUNTOS.exec(plano(l));
    if (mm) {
      const b = batalla(mm[1]);
      if (b) {
        const lado = quien(mm[1], b.a, b.b);
        if (lado) { b.por = [b[lado], num(mm[2])]; b.tp = tm; }
      }
    }
  }
}

/** Un PTB o un «por N puntos» claros, sin réplica de por medio, una vez que pasó `PROVISORIO` sin que nadie dijera otra cosa. */
export function resolverU(b, ahora) {
  if (b.gana || !b.tp || ahora - b.tp < PROVISORIO) return;
  if (!b.gana && b.ptb && !b.rep) {
    const [pa, pb, x3] = b.ptb;
    if (Math.abs(pa - pb) >= (x3 ? 6 : 2)) { b.gana = pa > pb ? b.a : b.b; b.como = 'directa'; }
  }
  if (!b.gana && b.por && !b.rep && b.por[1] >= 2) { b.gana = b.por[0]; b.como = 'directa'; }
}

/** Una línea de una liga de LKR. Los mismos pasos que `_lk()`. */
function lineaK(l, b) {
  const pl = plano(l).replace(EMOJI, ' ').replace(/\*/g, '').trim();
  if (marcaReplica(l)) { b.rep = true; return; }
  const g = GANADOR.exec(pl);
  if (g) {
    const nom = (g[2] || '').trim();
    const esRep = /^replica$/i.test(nom);
    if (g[1] || esRep) {
      b.rep = true;
      if (!nom || esRep) return;
    }
    const lado = quien(nom, b.a, b.b);
    if (lado) { b.gana = b[lado]; b.como = b.rep ? 'replica' : 'directa'; }
    return;
  }
  if (!l.trim().startsWith('#')) return;
  const pt = pl.replace(/^#+\s*/, '').replace(BANDERA, ' ').replace(/\s+/g, ' ').trim();
  const mas = MAS_PUNTOS.exec(pt);
  if (mas) {
    const lado = quien(mas[1], b.a, b.b);
    if (lado) { b.gana = b[lado]; b.como = mas[2] === '3' ? 'directa' : 'replica'; }
    return;
  }
  const xm = X_MINIMA.exec(pt);
  if (xm) {
    const lado = quien(xm[1], b.a, b.b);
    if (lado) { b.gana = b[lado]; b.como = b.rep ? 'replica' : 'directa'; }
    return;
  }
  // «# MAKMA :28» es su puntaje, no que ganó
  if (CON_NUMERO.test(pt)) return;
  const lado = quien(pl, b.a, b.b);
  if (lado && clave(pl).length <= clave(b[lado]).length + 2) { b.gana = b[lado]; b.como = b.rep ? 'replica' : 'directa'; }
}

const par = (a, b) => [clave(a), clave(b)].sort().join('|');

/**
 * Lee `msgs` (`[{id, t, content}]`, del más viejo al más nuevo) sobre `bats`, las batallas que ya se conocían de esa liga,
 * también de la más vieja a la más nueva. Modifica `bats` y devuelve las nuevas. Una batalla ya cerrada no se vuelve a abrir, y el
 * mismo título publicado otra vez (`dos_horas`) no es otra batalla.
 */
export function leerMensajes(fam, msgs, bats, dosHoras = 2 * 3600 * 1000) {
  const nuevas = [];
  let j = null;
  for (const m of msgs) {
    const texto = String(m.content || '');
    const tm = Date.parse(m.t) || 0;
    for (const l of texto.split(/\r?\n/)) {
      if (!l.trim()) continue;
      const pp = plano(l);
      const lj = JORNADA.exec(pp);
      const ls = lados(l);
      if (fam === 'U' && lj && !ls) { j = Number(lj[1] || lj[2]); continue; }
      if (ls) {
        const pr = par(ls[0], ls[1]);
        const hay = bats.find((b) => par(b.a, b.b) === pr && Math.abs(tm - (Date.parse(b.t) || 0)) <= dosHoras);
        if (!hay) { const b = nueva(m, ls, j); bats.push(b); nuevas.push(b); }
        continue;
      }
      if (fam === 'K' && bats.length) {
        const ult = bats[bats.length - 1];
        if (!ult.gana) lineaK(l, ult);
      }
    }
    if (fam === 'U' && bats.length) {
      cierreU(texto, bats, tm);
      for (const b of bats) resolverU(b, tm);
    }
  }
  return nuevas;
}

/** Los títulos `A vs B` de un mensaje de Visuales. */
export function titulosDe(content) {
  return String(content || '').split(/\r?\n/).map(lados).filter(Boolean).slice(0, 2);
}
export const mismoPar = (x, a, b) => par(x.a, x.b) === par(a, b);

//: cuánto sin señal, y sin nadie en la llamada, para decir que terminó. Medido: en una FMH los beats cambian cada 2 a 6 minutos
export const SIN_SENAL = 12 * 60 * 1000;
//: cuánto espera una candidata
export const CANDIDATA_VENCE = 45 * 60 * 1000;
//: cuánto se sigue a una batalla sin cierre: la señal más vieja y el arranque
export const ESPERA_VENCE = 60 * 60 * 1000;
export const TOPE_BATALLA = 3 * 3600 * 1000;
//: cuánto se muestra una que ya terminó
export const FIN_VISIBLE = 20 * 60 * 1000;
//: en LKR el título sale casi con el cierre: sin cierre en este tiempo, se deja de mostrar
export const DEFINIENDO_VENCE = 30 * 60 * 1000;
//: cuánto puede tener un título para contarlo como nuevo: pasa esto y es de antes de que el vigía mirara (la madrugada, un despliegue)
export const TITULO_FRESCO = 30 * 60 * 1000;

/** Lo que muestra la página de una batalla: una línea por estado. */
export const ESTADO_PAGINA = { arranca: 'Está arrancando', juego: 'Se está jugando', espera: 'Falta el resultado', definiendo: 'Definiéndose', terminada: 'Terminó' };

/** Para la página: las que se están jugando y las que terminaron hace poco, las más nuevas primero. Sin IDs de nadie. */
export function paraPagina(filas, ahora) {
  return filas.filter((f) => ESTADO_PAGINA[f.estado] && (f.estado !== 'terminada' || ahora - (f.d.fin || 0) <= FIN_VISIBLE))
    .sort((x, y) => (ESTADO_PAGINA[x.estado] === 'Terminó') - (ESTADO_PAGINA[y.estado] === 'Terminó') || y.ini - x.ini)
    .slice(0, 12)
    .map((f) => ({ l: f.liga, n: f.d.n || '', sv: f.d.sv || '', a: f.d.na || f.d.a, b: f.d.nb || f.d.b, fa: f.d.fa || '', fb: f.d.fb || '', ka: f.d.ka || '', kb: f.d.kb || '',
      e: f.estado, txt: ESTADO_PAGINA[f.estado], ini: f.ini, gana: f.d.gana ? (f.d.gana === f.d.a ? (f.d.na || f.d.a) : (f.d.nb || f.d.b)) : '', como: f.d.como || '' }));
}

/** 🗒️ El mensaje del chat al arrancar y al terminar. Puro, para probarlo. `lineas`: lo de más abajo (el título del cruce, el dato). */
export function textoArranca(n, j, nombres, lineas = []) {
  return ['🔴 **' + n + '**' + (j ? ' · Jornada ' + j : ''), '⚔️ ' + nombres + ' · está arrancando'].concat(lineas).join('\n');
}
export function textoFinal(texto, gana, como) {
  const lin = String(texto || '').split('\n').map((l) => l.replace(/ · está arrancando$/, ''));
  lin[0] = lin[0].replace(/^🔴/, '🏁');
  lin.push('🏆 Ganó **' + gana + '**' + (como === 'replica' ? ' en la réplica' : como === 'directa' ? ', directo' : ''));
  return lin.join('\n').slice(0, 1900);
}
export function textoSinResultado(texto, url) {
  const lin = String(texto || '').split('\n').map((l) => l.replace(/ · está arrancando$/, ''));
  lin[0] = lin[0].replace(/^🔴/, '🏁');
  lin.push('🗒️ Ya terminó. El resultado sale en la página de la liga: <' + url + '>');
  return lin.join('\n').slice(0, 1900);
}

/**
 * 🚦 El estado que sigue. `s` = `{estado, ini, ult}` y `se` = `{titulo, beat, voz, conocidos}`: `titulo`, que apareció en
 * Veredictos; `beat`, que se movió el canal de beats; `voz`, cuántos de los dos están en una llamada del servidor;
 * `conocidos`, de cuántos pudimos preguntar. ⚠️ Sin saber quiénes son no se puede decir que se fueron de la llamada: sólo los
 * beats y el tiempo. Puro, para probarlo sin Discord.
 */
export function transicion(s, se, ahora) {
  const senal = !!(se.beat || se.voz);
  const ult = senal ? ahora : s.ult;
  const fuera = se.conocidos > 0 && !se.voz;
  const callada = ahora - ult >= SIN_SENAL;
  if (s.estado === 'candidata') {
    if (se.titulo || senal) return { estado: 'arranca', ult: ahora };
    return ahora - s.ini >= CANDIDATA_VENCE ? { estado: 'olvidar', ult } : { estado: 'candidata', ult };
  }
  if (s.estado === 'arranca' || s.estado === 'juego') {
    if (senal) return { estado: 'juego', ult };
    if (ahora - s.ini >= TOPE_BATALLA) return { estado: 'sinres', ult };
    if (callada && (fuera || !se.conocidos)) return { estado: 'espera', ult };
    return { estado: s.estado, ult };
  }
  if (s.estado === 'espera') {
    if (senal) return { estado: 'juego', ult };
    if (ahora - ult >= ESPERA_VENCE || ahora - s.ini >= TOPE_BATALLA) return { estado: 'sinres', ult };
    return { estado: 'espera', ult };
  }
  return { estado: s.estado, ult };
}
