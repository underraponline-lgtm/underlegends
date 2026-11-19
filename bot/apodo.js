// 🏷️ EL APODO DE CADA UNO EN DISCORD: SEIS ESTILOS (Dlx, 18/11/2026). El gemelo de `bot/apodo.py`: el ciclo arma el apodo
// de todos con ese y `/apodo` lo cambia al toque con éste, así que tienen que armar EXACTAMENTE lo mismo —si no, el ciclo
// «corrige» cada media hora lo que el bot acaba de poner—. Los dos pasan los casos de `bot/apodo_casos.json`
// (`node bot/apodo_prueba.mjs` y `python bot/apodo.py --auto`, los dos en CI). Las razones de cada regla, allá.
//
//   1  #23 | FLB | Bloody   el Competitivo (por defecto) · 2  40º | FLB | Bloody   la Temporada
//   3  💎 | FLB | Bloody    el ELO                       · 4  🇨🇴 | FLB | Bloody   la bandera
//   5  B- | FLB | Bloody    el rango                     · 6  Bloody               solo el nombre

export const ESTILOS = [
  [1, 'Competitivo', '#23 | FLB | Bloody'],
  [2, 'Temporada', '40º | FLB | Bloody'],
  [3, 'ELO', '💎 | FLB | Bloody'],
  [4, 'Bandera', '🇨🇴 | FLB | Bloody'],
  [5, 'Rango', 'B- | FLB | Bloody'],
  [6, 'Solo el nombre', 'Bloody'],
];
export const POR_DEFECTO = 1;
export const SOLO_NOMBRE = 6;
// Mítico, Diamante, Rubí, Zafiro, Jade, Hierro: el orden de `bot/divisiones.PIEDRAS`
export const ELO = ['🔮', '💎', '♦️', '🔷', '🟢', '⚙️'];
export const TOPE = 32;
const SEP = ' | ';

const RI = /[\u{1F1E6}-\u{1F1FF}]/u;
const RI_G = /[\u{1F1E6}-\u{1F1FF}]/gu;
const BANDERA = /^[\u{1F1E6}-\u{1F1FF}]{2}$/u;
const RANGO = /^(SSS|SS|S|[ABCD][+-]?|E)$/;
const PUESTO = /^#\s*\d+$/;
const TEMPORADA = /^\d+\s*º$/;
const ELO_BASE = new Set(ELO.map((e) => e.replace(/️/g, '')));

// el largo como lo cuenta Discord en la página: unidades de UTF-16
export const largo = (s) => String(s).length;

export function bandera(cc) {
  const c = String(cc || '').trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(c)) return '';
  return String.fromCodePoint(...[...c].map((x) => 0x1F1E6 + x.charCodeAt(0) - 97));
}

const sinBandera = (s) => String(s || '').replace(RI_G, '').trim();

// el nombre hasta `cabe` unidades de UTF-16, sin partir un emoji ni dejar media bandera
function recortar(nombre, cabe) {
  const out = [];
  let n = 0;
  for (const ch of String(nombre)) {
    if (n + ch.length > cabe) break;
    out.push(ch);
    n += ch.length;
  }
  let cola = 0;
  for (let i = out.length - 1; i >= 0 && RI.test(out[i]); i--) cola++;
  if (cola % 2) out.pop();
  return out.join('').trimEnd();
}

export function adelante(estilo, p) {
  p = p || {};
  if (estilo === 1 && p.c) return '#' + Math.trunc(Number(p.c));
  if (estilo === 2 && p.t) return Math.trunc(Number(p.t)) + 'º';
  if (estilo === 3 && Number.isInteger(p.e) && p.e >= 0 && p.e < ELO.length) return ELO[p.e];
  if (estilo === 4) return bandera(p.b);
  if (estilo === 5 && p.r) return String(p.r);
  return '';
}

export function armar(estilo, nombre, piezas) {
  const e = [1, 2, 3, 4, 5, 6].includes(estilo) ? estilo : POR_DEFECTO;
  const p = piezas || {};
  const marca = adelante(e, p);
  const sigla = e === SOLO_NOMBRE ? '' : String(p.k || '').trim();
  let nom = String(nombre || '').trim();
  if (e === 4 && marca) nom = sinBandera(nom);
  const partes = [marca, sigla].filter(Boolean);
  if (!partes.length) return recortar(nom, TOPE);
  const pre = partes.join(SEP);
  if (!nom) return pre.slice(0, TOPE);
  return pre + SEP + recortar(nom, TOPE - largo(pre + SEP));
}

// ⚠️ una bandera o una letra sola son nuestras SÓLO si son las de esa persona: mucha gente lleva su bandera por su cuenta
export function esNuestra(seg, siglas, piezas) {
  const s = String(seg || '').trim();
  if (!s) return false;
  const p = piezas || {};
  if (BANDERA.test(s)) return !!p.b && s === bandera(p.b);
  if (RANGO.test(s)) return !!p.r && s === String(p.r);
  const sg = new Set((siglas || []).filter(Boolean).map((x) => String(x).toUpperCase()));
  return PUESTO.test(s) || TEMPORADA.test(s) || ELO_BASE.has(s.replace(/️/g, '')) || sg.has(s.toUpperCase());
}

export function nombreDe(apodo) {
  const a = String(apodo || '').trim();
  if (PUESTO.test(a)) return '';
  const partes = a.split('|');
  return partes[partes.length - 1].trim();
}

export function soloNuestras(apodo, siglas, piezas) {
  const a = String(apodo || '').trim();
  if (PUESTO.test(a)) return true;
  const partes = a.split('|');
  return partes.length > 1 && partes.slice(0, -1).every((x) => esNuestra(x, siglas, piezas));
}

// qué se pone: con marca, el apodo armado; si no, sólo se sacan las nuestras (ver `decidir()` de bot/apodo.py)
export function decidir(actual, p, estilo, base, siglas) {
  const a = actual || '';
  if (p) {
    const nuevo = armar(estilo, base, p);
    if (nuevo !== armar(SOLO_NOMBRE, base, p)) return nuevo;
  }
  if (a && soloNuestras(a, siglas, p)) return nombreDe(a) || null;
  return a;
}

// las piezas de KV (`apodos`, `[c, t, e, b, r, k, nombre]`, las sube herramientas/sincronizar_puesto.py) como objeto
export function piezasDe(fila) {
  if (!Array.isArray(fila)) return null;
  const [c, t, e, b, r, k] = fila;
  const p = {};
  if (c) p.c = c;
  if (t) p.t = t;
  if (Number.isInteger(e) && e >= 0) p.e = e;
  if (b) p.b = b;
  if (r) p.r = r;
  if (k) p.k = k;
  return p;
}

export function estiloValido(v) {
  const n = Number(v);
  return [1, 2, 3, 4, 5, 6].includes(n) ? n : null;
}
