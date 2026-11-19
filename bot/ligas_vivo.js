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
//: 🎤 un renglón con EXHIBICIÓN arriba del título: esa batalla no es de la liga (`EXHIBICION` y `_u()` de ligas.py)
const EXHIBICION = /\bEXHIBICION\b/i;
const NO_PAL = '[^\\p{L}\\p{N}_]*';
const GANA = new RegExp('^' + NO_PAL + '(.+?)\\s+GANA\\s+(DIRECTO|DIRECTA|EN\\s+(?:LA\\s+)?R[EÉ]PLICA|DESPU[EÉ]S\\s+DE\\s+[\\p{L}\\p{N}_]+\\s+R[EÉ]PLICAS?)', 'iu');
const GANA_DESPUES = new RegExp('^' + NO_PAL + 'GANA\\s+(.+)$', 'iu');
const POR_PUNTOS = /^[#*\s]*(.+?)\s+(?:POR|X)\s+(\d+(?:[.,]\d+)?)\s*(?:PUNTOS?|PTS?|PTOS?)(?![\p{L}\p{N}_])/iu;
const PTB_LINEA = new RegExp('^' + NO_PAL + '(.+?)\\s*:\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:\\(\\s*[\\d.,]+\\s*\\))?\\s*\\**\\s*(\\+\\s*[0-3])?', 'iu');
const GANADOR = /^#*\s*GANADOR\s*(REPLICA\s*)?:?\s*(.*)$/i;
//: «# MAKMA +3PTO», «# TOKIO+3»: el que suma 3 ganó directo y el que suma 2, en réplica. ⚠️ `bot/ligas.py` tiene el mismo
const MAS_PUNTOS = /^#*\s*(.+?)\s*\+\s*([23])\s*(?:PTOS?|PTS?|PUNTOS?)?\s*$/i;
const X_MINIMA = /^#*\s*(.+?)\s+X\s+LA\s+MINIMA(?![\p{L}\p{N}_])/iu;

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
/** `[a, b, extra_a, extra_b]` de un título `# A vs B`, o `null`. `primera`: el primer renglón del mensaje, donde vale un
 *  título sin `#` que lleve 🆚 (FMS Coliseo, 17/11/2026; el mismo `lados()` de ligas.py) */
export function lados(linea, primera = false) {
  let l = letras(linea).trim();
  if (!l.startsWith('#') && !(primera && l.includes('🆚'))) return null;
  l = l.replace(/^#+/, '').trim();
  if (/EXHIBICION/i.test(plano(l)) || /PTB|TABLA/i.test(plano(l))) return null;
  const partes = l.split(SEP);
  if (partes.length !== 2) return null;
  // 🏛️ el número romano de la batalla adelante («V. LAST»: FMS Coliseo), con su punto y un espacio
  const [a00, b00] = partes;
  const a0 = a00.replace(/^\s*[IVXLC]{1,6}\.\s+/, '');
  // 💥 «KUSOH VS RICARDFLEX 💥 MAIN EVENT»: no es parte del nombre (el mismo que `lados()` de ligas.py)
  const b0 = b00.replace(/\s*[-|]\s*(?:JORNADA\s*\d+|RECUPERATIVA\b).*$/i, '').replace(/\s*[-|]?\s*\b(?:CO-?)?MAIN\s+EVENT\b.*$/i, '');
  const a1 = a0.replace(/^.*?\b(?:CO-?)?MAIN\s+EVENT\b\s*[:|-]?\s*/i, '');
  const a = limpio(a1), b = limpio(b0);
  if (!/[A-Za-z]/.test(a) || !/[A-Za-z]/.test(b) || a.length > 40 || b.length > 40) return null;
  // lo último, como lo escribieron y sin sus emojis: la bandera separa a dos que se llaman igual (`genteChat()`)
  return [a, b, a0.includes('🎮'), b0.includes('🎮'), a1.replace(EMOJI, ' ').trim(), b0.replace(EMOJI, ' ').trim()];
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
  // LKR: el de más puntos, si los números no quedaron antes de una réplica sin resolver (el final de `_lk()`)
  if (!b.gana && b.pt && b.pt[0] !== null && b.pt[1] !== null && b.pt[0] !== b.pt[1] && (b.ptRep || !b.rep)) {
    b.gana = b.pt[0] > b.pt[1] ? b.a : b.b; b.como = b.ptRep ? 'replica' : 'directa';
  }
}

// 🧮 el puntaje de cada uno, aunque no haya cierre: `puntajes_k()` de ligas.py, con sus mismos ejemplos (FMS LATAM, 15/11)
const NUM_K = '\\d+(?:[.,]\\d+)?';
const POR_K = new RegExp('(' + NUM_K + ')\\s*[X×]\\s*\\d+\\s*=\\s*' + NUM_K, 'gi');
const SUMA_K = new RegExp('(?:' + NUM_K + '\\s*\\+\\s*)+' + NUM_K + '\\s*=\\s*(' + NUM_K + ')', 'g');
const MENCION = /<[@#][!&]?\d+>/g;
const CORTE_K = /\s+(?=#)/;
const CORRIGE = /EQUIVOC|EQUIVOQU/i;
// «# MASINO +2 LAST +1»: gana el único que suma 2 o 3 (`MAS_PAR`), y «(BATALLA POR DEFAULT)» no es una batalla (`DF_K`)
const MAS_PAR = /([^+]*?[A-Za-z][^+]*?)\s*\+\s*([0-3])(?![\d.,])/g;
const DF_K = /\bDEFAULT\b|PUNTOS\s+CEDIDOS|\(\s*DF\s*\)|NINGUNO\s+VINO/i;
// 🇪🇸 FMS Ceuta: el número antes del nombre, los DF en un renglón y la réplica con título (los mismos de ligas.py)
const PUNTOS_ANTES = /^#*\s*\+?\s*([0-3])\s*(?:PUNTOS?|PTOS?|PTS?|PT)(?![\p{L}\p{N}_])\.?\s*(?:A\s+)?(?:\d+(?:[.,]\d+)?\s*PTB\s+)?(.*?)\s*(?:\+\s*\d.*)?$/iu;
const DF_LINEA = /\bDF(?:\W?S)?\b|NINGUNO\s+VINO/i;
const TIT_REP = /^(?:R[EÉ]PLICA|REPETIMIENTO\s+DE\s+JORNADA\s*\d*)\s+|\s+R[EÉ]PLICA(?:\s*\d+)?$/i;
const REPLICA_K = /\bR[EÉ]PLICA\b/i;

/** `quien()` y, si no alcanza, por el principio de una palabra o dos: `_lado_k()` de ligas.py. */
export function ladoK(texto, a, b) {
  const q = quien(texto, a, b);
  if (q) return q;
  const ws = plano(texto).replace(EMOJI, ' ').toLowerCase().match(/[a-z0-9]+/g) || [];
  const cands = [...ws, ...ws.slice(0, -1).map((w, i) => w + ws[i + 1])].filter((c) => c.length >= 4);
  const ok = [['a', a], ['b', b]].filter(([, n]) => { const k = clave(n); return k.length >= 4 && cands.some((c) => k.startsWith(c) || c.startsWith(k)); });
  return ok.length === 1 ? ok[0][0] : null;
}
/** `[[nombre, puntaje]]` de un renglón: `puntajes_k()` de ligas.py. */
export function puntajesK(linea) {
  let t = plano(String(linea).replace(MENCION, ' ')).replace(EMOJI, ' ').replace(BANDERA, ' ').replace(/\*/g, ' ');
  t = t.replace(POR_K, ' $1 ').replace(SUMA_K, ' $1 ');
  const el = [];
  for (const x of t.match(/\d+(?:[.,]\d+)?|=|[A-Za-z][A-Za-z0-9_.]*/g) || []) {
    if (x === '=') { if (el.length && el[el.length - 1][0] === 'n') el[el.length - 1][2] = true; }
    else if (/^\d/.test(x)) el.push(['n', num(x), false]);
    else if (el.length && el[el.length - 1][0] === 'w') el[el.length - 1][1] += ' ' + x;
    else el.push(['w', x]);
  }
  const usado = new Set(), out = [];
  el.forEach((e, i) => {
    if (e[0] !== 'w') return;
    const ant = i > 0 && el[i - 1][0] === 'n' && !usado.has(i - 1) ? el[i - 1] : null;
    const sig = i + 1 < el.length && el[i + 1][0] === 'n' && !el[i + 1][2] ? el[i + 1] : null;
    const j = ant && ant[2] ? i - 1 : sig ? i + 1 : ant ? i - 1 : null;
    if (j !== null) { usado.add(j); out.push([e[1], el[j][1]]); }
  });
  return out;
}
function anotaK(b, pares, corrige, vistos, tm) {
  for (const [nom, n] of pares) {
    let lado = ladoK(nom, b.a, b.b);
    const falta = ['a', 'b'].filter((x) => !vistos.has(x));
    if (!lado && corrige && falta.length === 1 && nom.split(/\s+/).length <= 3) { lado = falta[0]; b[lado] = limpio(nom); }
    if (lado) {
      vistos.add(lado);
      if (!b.pt) b.pt = [null, null];
      b.pt[lado === 'a' ? 0 : 1] = n;
      b.ptRep = b.rep;
      b.tp = tm;
    }
  }
}

/** Una línea de una liga de LKR. Los mismos pasos que `_lk()`. */
function lineaK(l, b, corrige = false, vistos = new Set(), tm = 0) {
  const pl = plano(l).replace(EMOJI, ' ').replace(/\*/g, '').trim();
  if (marcaReplica(l) || /^replicax?\d+$/.test(clave(pl))) { b.rep = true; return; }
  if (DF_LINEA.test(pl) && pl.split(/\s+/).length <= 5 && (/NINGUNO/i.test(pl) || ladoK(pl.replace(new RegExp(DF_LINEA.source, 'gi'), ' '), b.a, b.b))) {
    b.df = true;
    return;
  }
  const pa = PUNTOS_ANTES.exec(pl);
  if (pa) {
    const lado = (pa[1] === '2' || pa[1] === '3') && pa[2] ? ladoK(pa[2], b.a, b.b) : null;
    // sin ningún puntaje antes, «3 pt ANDY» es lo que cobró por un DF
    if (lado && (b.rep || (b.pt && (b.pt[0] !== null || b.pt[1] !== null)))) { b.gana = b[lado]; b.como = pa[1] === '3' ? 'directa' : 'replica'; }
    return;
  }
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
  if (l.trim().startsWith('#')) {
    const pt = pl.replace(/^#+\s*/, '').replace(BANDERA, ' ').replace(/\s+/g, ' ').trim();
    const pares = [...pt.matchAll(MAS_PAR)];
    if (pares.length >= 2) {
      const gan = pares.filter((p) => p[2] === '2' || p[2] === '3');
      const lado = gan.length === 1 ? ladoK(gan[0][1], b.a, b.b) : null;
      if (lado) { b.gana = b[lado]; b.como = gan[0][2] === '3' ? 'directa' : 'replica'; return; }
    }
    const mas = MAS_PUNTOS.exec(pt);
    if (mas) {
      const lado = quien(mas[1], b.a, b.b);
      if (lado) { b.gana = b[lado]; b.como = mas[2] === '3' ? 'directa' : 'replica'; }
      return;
    }
    const xm = X_MINIMA.exec(pt);
    if (xm) {
      const lado = ladoK(xm[1], b.a, b.b);
      if (lado) { b.gana = b[lado]; b.como = b.rep ? 'replica' : 'directa'; }
      return;
    }
    // «# MAKMA :28» y «# KUSOH 13 RICARD 12,5» son puntajes, no que ganó
    if (!/\d/.test(pt)) {
      // «# TEITO ( el rey del morbo)🐐»: lo de entre paréntesis es un comentario
      const pt2 = pt.replace(/\([^)]*\)?/g, ' ').replace(/\s+/g, ' ').trim();
      const lado = ladoK(pt2, b.a, b.b);
      const k = clave(pt2), kl = lado ? clave(b[lado]) : '';
      // su nombre largo o el corto: «# RICARDFLEX» bajo RICARD, «# RICARD» bajo RICARD FLEX
      if (lado && ((k.length <= kl.length + 2 && k.includes(kl)) || kl.startsWith(k) || k.startsWith(kl))) {
        b.gana = b[lado]; b.como = b.rep ? 'replica' : 'directa';
        return;
      }
    }
  }
  anotaK(b, puntajesK(l), corrige, vistos, tm);
}

const par = (a, b) => [clave(a), clave(b)].sort().join('|');

/**
 * Lee `msgs` (`[{id, t, content}]`, del más viejo al más nuevo) sobre `bats`, las batallas que ya se conocían de esa liga,
 * también de la más vieja a la más nueva. Modifica `bats` y devuelve las nuevas. Una batalla ya cerrada no se vuelve a abrir, y el
 * mismo título publicado otra vez (`dos_horas`) no es otra batalla.
 */
const PUNTOS_LINEA_K = /^\W*\+|\bP(?:TS?|TOS?|UNTOS?)\b/i;
/**
 * 🆕 Una batalla SIN título: `[a, b]` o null. Con la de arriba (`u`) cerrada, un mensaje sin título con los puntajes de DOS
 * nombres —que no son los de arriba— y un «GANADOR» de uno de los dos es otra (FMS Ceuta, 03/10/2026). El mismo que
 * `sin_titulo_k()` de bot/ligas.py.
 */
export function sinTituloK(texto, u) {
  if (!u || !u.gana || CORRIGE.test(plano(texto || ''))) return null;
  const rs = String(texto || '').split(/\r?\n/);
  if (rs.some((l) => lados(l))) return null;
  const nombres = [];
  for (const l of rs) {
    if (PUNTOS_LINEA_K.test(plano(l))) continue;
    for (const [n] of puntajesK(l)) if (clave(n) && nombres.every((x) => clave(x) !== clave(n))) nombres.push(n);
  }
  if (nombres.length !== 2 || par(nombres[0], nombres[1]) === par(u.a, u.b)) return null;
  for (const l of rs) {
    const g = GANADOR.exec(plano(l).replace(EMOJI, ' ').replace(/\*/g, '').trim());
    if (g && !g[1] && g[2] && ladoK(g[2], nombres[0], nombres[1])) return nombres;
  }
  return null;
}

export function leerMensajes(fam, msgs, bats, dosHoras = 2 * 3600 * 1000) {
  const nuevas = [];
  let j = null;
  for (const m of msgs) {
    const texto = String(m.content || '');
    const tm = Date.parse(m.t) || 0;
    const corrige = fam === 'K' && CORRIGE.test(plano(texto));
    let vistos = new Set();
    // LKR: «15 = LAST 10= SHADOW … # LAST» trae el cierre en el mismo renglón (`CORTE_K` en ligas.py)
    // 🆚 el primer renglón del mensaje puede ser un título sin `#` (FMS Coliseo): sólo en K, como `_lk()` de ligas.py
    const crudos = texto.split(/\r?\n/);
    const prim = crudos.findIndex((x) => x.trim());
    const renglones = crudos.flatMap((l, i) => (fam === 'K' ? l.split(CORTE_K) : [l]).map((x) => [x, fam === 'K' && i === prim]));
    const st = fam === 'K' ? sinTituloK(texto, bats[bats.length - 1]) : null;
    if (st) { const b = nueva(m, [st[0], st[1], false, false, '', ''], j); bats.push(b); nuevas.push(b); }
    // 🎤 «# EXHIBICIÓN» en su renglón y el título abajo (FMH España, 10/11/2026): la batalla se sigue, marcada `exh`
    let exh = false;
    for (const [l, esPrim] of renglones) {
      if (!l.trim()) continue;
      const pp = plano(l);
      const lj = JORNADA.exec(pp);
      const ls = lados(l, esPrim);
      if (fam === 'U' && lj && !ls) { j = Number(lj[1] || lj[2]); continue; }
      if (fam === 'U' && !ls && EXHIBICION.test(pp)) { exh = true; continue; }
      if (ls) {
        if (fam === 'K') {
          // «# REPLICA LAST VS SANTZ», «# LAST VS MARCOS REPLICA 1»: la réplica de la de arriba (`TIT_REP` en ligas.py)
          ls[0] = ls[0].replace(TIT_REP, '').trim() || ls[0];
          ls[1] = ls[1].replace(TIT_REP, '').trim() || ls[1];
          const u = bats[bats.length - 1];
          if (u && par(u.a, u.b) === par(ls[0], ls[1]) && REPLICA_K.test(pp) && Math.abs(tm - (Date.parse(u.t) || 0)) <= 12 * 3600 * 1000) {
            u.rep = true;
            continue;
          }
        }
        const pr = par(ls[0], ls[1]);
        const hay = bats.find((b) => par(b.a, b.b) === pr && Math.abs(tm - (Date.parse(b.t) || 0)) <= dosHoras);
        if (!hay) { const b = nueva(m, ls, j); if (fam === 'K') b.df = DF_K.test(pp); if (exh) b.exh = true; bats.push(b); nuevas.push(b); }
        exh = false;
        vistos = new Set();
        continue;
      }
      if (fam === 'K' && bats.length) {
        const ult = bats[bats.length - 1];
        if (!ult.gana) lineaK(l, ult, corrige, vistos, tm);
      }
    }
    if (fam === 'U' && bats.length) cierreU(texto, bats, tm);
    if ((fam === 'U' || fam === 'K') && bats.length) for (const b of bats) resolverU(b, tm);
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
