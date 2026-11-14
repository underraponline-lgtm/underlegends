// 🧭 EL TUTORIAL: ¿ES LA PRIMERA VEZ DE ESTE NAVEGADOR? (Dlx, 12/10/2026, a las ideas: «A pero que no sea
// necesariamente con jugar tu primer evento… B me gusta, C me gusta pero que sea lo que B no mostró, D me gusta así
// atrapamos la atracción, E. Dale»). Lo que se dibuja vive en tutorial.jsx, que se baja sólo si hace falta; acá va lo
// que tiene que correr al cargar la página, antes de que App.jsx anote la visita del día (`lg:visita`).
//
// 🔑 NUEVO ES «ESTE NAVEGADOR NUNCA VINO», NO «ESTA PERSONA NUNCA VINO». Sin cuenta no hay otra forma de saberlo, y
// falla si cambia de celular o borra los datos: por eso el recorrido se vuelve a ver desde la Guía. Quien ya tenía
// algo guardado de la Liga (la visita del día, su cuenta, sus historias vistas…) NO es nuevo: el día que esto salió,
// nadie de los que ya venían vio un recorrido que no pidió.
//
// ⚠️ Sin almacenamiento (ventana privada, datos bloqueados) no hay tutorial: sin poder acordarse, saldría en cada visita.

const CLAVE = 'lg:tuto';
// lo que deja la página en el navegador de quien ya vino (`inventario.md` §3)
const TRAZAS = ['lg:visita', 'lg:dc', 'lg:yo', 'lg:historias2', 'lg:historias', 'lg:cambios', 'lg:tema', 'lg:sigo',
  'lg:ajustes', 'campana:activada'];
const DIA = 86400000;
//: cuántos días después de la primera visita siguen saliendo la lista en el Inicio y las notas de cada página
export const DIAS_NUEVO = 21;

function leer() {
  try { return JSON.parse(localStorage.getItem(CLAVE)) || null; } catch (e) { return null; }
}
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(T)); } catch (e) { /* sin almacenamiento */ }
}

/** La ruta de la página como `pagina` (lo que App.jsx llama así): '' es el Inicio */
function paginaDe() {
  const h = location.hash || '';
  if (/^#(access_token|error)=/.test(h)) return '';
  const r = window.rutaLG ? window.rutaLG() : h.replace(/^#\/?/, '');
  return String(r || '').split('?')[0].split('/')[0];
}

// `T`: { t: primera visita (ms), nuevo, tour: '' | 'fin' | 'salto', pasos: '' | 'fin' | 'cerrado', c: {lo contado},
// notas: {página vista}, franja: 'no' }
let T = null;
try {
  T = leer();
  if (!T) {
    const viejo = TRAZAS.some((k) => localStorage.getItem(k) != null);
    T = { t: Date.now(), nuevo: !viejo, tour: '', pasos: '', c: {}, notas: {} };
    guardar();
    if (!leer()) T = null;
  }
} catch (e) { T = null; }

//: la página donde entró esta visita: el recorrido sale solo en el Inicio, y en otra página va la franja (D)
export const LLEGADA = (() => { try { return paginaDe(); } catch (e) { return ''; } })();
// 🧭 la franja de «¿primera vez?» es de la visita en la que llegó, no de las siguientes
let sesion = false;
try {
  if (T && T.nuevo && !T.tour && !sessionStorage.getItem('lg:tuto-s') && Date.now() - T.t < DIA) {
    sessionStorage.setItem('lg:tuto-s', '1');
    sesion = true;
  } else if (sessionStorage.getItem('lg:tuto-s') === '1') sesion = true;
} catch (e) { sesion = false; }
export const PRIMERA_VISITA = sesion;

export const tuto = () => T;
/** Cambia el estado y lo guarda */
export function tutoPoner(cambios) {
  if (!T) return;
  Object.assign(T, cambios);
  guardar();
}
/** ¿Este navegador llegó hace poco por primera vez? */
export const reciente = () => !!(T && T.nuevo && Date.now() - T.t < DIAS_NUEVO * DIA);

// 📊 E · LO QUE VE EL DASHBOARD: cada cosa una vez por navegador (salvo volver a mirar el recorrido), y el servidor sólo
// suma un número por día. Nada de quién: ni cuenta, ni nombre. La lista cerrada es `TUTO_EV` de bot/avisos.js
export function contar(ev) {
  if (!T) return;
  if (ev !== 'repite') {
    T.c = T.c || {};
    if (T.c[ev]) return;
    T.c[ev] = 1;
    guardar();
  }
  try {
    fetch('/api/avisos/tutorial', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ev }), keepalive: true }).catch(() => {});
  } catch (e) { /* no se cuenta */ }
}

/** ¿Hay que bajar el tutorial? Si este navegador es nuevo, o alguien pidió el recorrido desde la Guía */
export const quiereTutorial = () => !!(T && (reciente() || PRIMERA_VISITA));

/**
 * 🧭 A · «PRIMEROS PASOS» EN EL INICIO: para quien llegó hace poco, o entró con Discord y todavía no se verificó. Quien
 * ya venía no la ve aparecer de golpe —está siempre en la Guía—, y se va sola cuando está completa
 */
export function pasosEnInicio(dc) {
  if (!T || T.pasos === 'fin' || T.pasos === 'cerrado') return false;
  // 🐣 la primera semana ya está la pista de nuevos, que pide lo mismo y más: dos listas iguales serían ruido
  if (enSemanaNueva()) return false;
  return reciente() || !!(dc && !dc.rapero);
}

/**
 * 🎮 ¿LA PANTALLA DE BIENVENIDA? (19/10/2026, bienvenida.jsx) Una vez: quien llega por primera vez, por el Inicio y sin
 * cuenta —quien entra por un link va directo a eso—. Y el paso 2, al volver de Discord después de «Unirme a la Liga»
 * (`lg:bienv` de la sesión), donde sea que vuelva.
 */
export function quiereBienvenida(dc) {
  try { if (sessionStorage.getItem('lg:bienv') === 'paso2') return true; } catch (e) { return false; }
  return !!(T && T.nuevo && !T.bienv && !T.tour && PRIMERA_VISITA && LLEGADA === '' && !(dc && dc.id));
}

/**
 * Ir a otra ruta EN EL MISMO LUGAR DEL HISTORIAL (`replaceState` + `lg:ruta`, que App.jsx escucha). Para la bienvenida: ir
 * a ella desde el Inicio o volver de ella al Inicio con un paso nuevo dejaría el «atrás» rebotando entre las dos
 */
export function irSinHistoria(r) {
  try { history.replaceState(history.state, '', window.urlLG ? window.urlLG(r) : r); } catch (e) { try { location.hash = r; } catch (e2) { /* queda */ } }
  try { window.dispatchEvent(new Event('lg:ruta')); } catch (e) { /* nada */ }
}

/**
 * Pedir el tutorial: lo escucha App.jsx. `que`: 'corto' (el de cinco pasos), 'cap:<id>' (un capítulo del completo, ver
 * capitulos.js) o nada (la pantalla de elegir, como la primera vez)
 */
export function pedirRecorrido(que) {
  try { window.dispatchEvent(new CustomEvent('lg:tour', { detail: que || 'elegir' })); } catch (e) { /* nada */ }
}

// 🐣 MISIONES PARA NUEVOS (13/11/2026): lo que sabe este navegador, para `/api/avisos/nuevo` (ver nuevos.jsx). Los
// tutoriales y las redes que abrió se acuerdan acá aunque no haya entrado con Discord: al entrar, se cobran
//: cuántos días dura la pista
export const DIAS_PISTA = 7;
/** ¿Este navegador es de alguien que llegó hace menos de una semana? */
export const enSemanaNueva = () => !!(T && T.nuevo && Date.now() - T.t < DIAS_PISTA * DIA);
/** Lo que manda la página: si es nuevo, desde cuándo y lo que hizo que el servidor no ve */
export function nuevoLocal() {
  const hechos = [];
  if (T && T.corto === 'fin') hechos.push('corto');
  if (T && T.completo) hechos.push('completo');
  for (const r of (T && T.redes) || []) hechos.push('red:' + r);
  return { nuevo: enSemanaNueva(), desde: T ? T.t : 0, hechos };
}
/** Anota una red que abrió (una vez cada una) */
export function redAbierta(red) {
  if (!T) return;
  const xs = new Set(T.redes || []);
  xs.add(red);
  tutoPoner({ redes: [...xs] });
}
