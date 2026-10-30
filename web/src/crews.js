// 👥 LAS CREWS QUE ARMA LA GENTE, EN LA PÁGINA (Dlx, 19/10/2026; las reglas viven en bot/crews.js). Dos cosas en vivo:
// todas las crews (`/api/avisos/crews`, pública, sin ningún Discord ID) y la tuya (`/api/avisos/crew-mia`, con tu
// cuenta: tu rol, tus invitaciones, lo que espera tu respuesta). Se piden una vez y se recuerdan mientras la página está
// abierta; después de cada acción, de nuevo. El payload (`liga.d.crews`) sigue trayendo los PUNTOS: esto trae la GENTE.
import { useEffect, useState } from 'react';

const W = typeof window !== 'undefined' ? window : {};
export const ROL_NOMBRE = { lider: 'Líder', colider: 'Colíder', veterano: 'Veterano', miembro: 'Miembro' };
export const ENTRADA_NOMBRE = { abierta: 'Abierta: entra quien quiera', pedido: 'Con pedido: el Líder o un Colíder acepta',
  invitacion: 'Sólo por invitación' };

const E = { todas: null, mia: null, pidiendo: false, pidiendoMia: false, oyentes: new Set() };
const avisar = () => E.oyentes.forEach((f) => f());

export function pedirCrews(forzar = false) {
  if ((E.todas && !forzar) || E.pidiendo) return;
  E.pidiendo = true;
  fetch('/api/avisos/crews').then((r) => r.json()).then((j) => {
    E.pidiendo = false;
    if (j && Array.isArray(j.crews)) { E.todas = j; avisar(); }
  }).catch(() => { E.pidiendo = false; });
}

export function pedirMia(forzar = false) {
  if (!W.conCuenta || !W.DC || ((E.mia && !forzar) || E.pidiendoMia)) return;
  E.pidiendoMia = true;
  W.conCuenta('/api/avisos/crew-mia', {}).then((j) => {
    E.pidiendoMia = false;
    if (j && j.ok) { E.mia = j; avisar(); }
  }).catch(() => { E.pidiendoMia = false; });
}

/** Todas las crews y la tuya, y que la pantalla se entere cuando cambian. */
export function useCrews() {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    E.oyentes.add(f);
    pedirCrews();
    pedirMia();
    // al entrar con Discord (o salir), lo tuyo cambia: `lg:cuenta` (bot/paginas/cuenta.js), como en App.jsx
    const dc = () => { E.mia = null; pedirMia(true); };
    W.addEventListener('lg:cuenta', dc);
    return () => { E.oyentes.delete(f); W.removeEventListener('lg:cuenta', dc); };
  }, []);
  return { todas: E.todas, mia: E.mia };
}

/** La crew en vivo de una clave de crew (o de su nombre). */
export function crewViva(id) {
  const cs = (E.todas && E.todas.crews) || [];
  return cs.find((c) => c.id === id) || cs.find((c) => String(c.nombre).toLowerCase() === String(id).toLowerCase()) || null;
}

/** La crew y el rol de un perfil, o `null`. */
export function crewDe(k) {
  for (const c of (E.todas && E.todas.crews) || []) {
    const g = (c.gente || []).find((x) => x[0] === k);
    if (g) return { c, rol: g[1] };
  }
  return null;
}

/**
 * 👥 Una acción (`accion` y lo suyo). Devuelve la respuesta, o `null` si se fue a Discord a entrar. Después, todo de
 * nuevo: lo tuyo y la lista.
 */
/** 🔗 El código del link de invitación de la dirección (`?u=…`), o `''`. Viene en la dirección de verdad
 *  (`/freestyle-rap/crew/X?u=…`) o en un `#/crew/X?u=…` de antes. */
export function codigoLink() {
  try {
    const q = (W.location.search || '') || ('?' + ((W.location.hash || '').split('?')[1] || ''));
    const c = new URLSearchParams(q).get('u') || '';
    return /^[a-hjkmnp-z2-9]{10}$/.test(c) ? c : '';
  } catch (e) { return ''; }
}

/** 🔗 El link para compartir: la página de la crew con el código. */
export function linkCrew(id, cod) {
  const r = '#/crew/' + encodeURIComponent(id) + '?u=' + cod;
  return 'https://underlegends.pages.dev' + (W.urlLG ? W.urlLG(r) : '/' + r);
}

export function accionCrew(cuerpo) {
  if (!W.conCuenta) return Promise.resolve({ error: 'red' });
  return W.conCuenta('/api/avisos/crew', cuerpo, 's').then((j) => {
    if (j && j.ok) { pedirCrews(true); pedirMia(true); }
    return j;
  });
}

const dias = (ms) => Math.max(1, Math.ceil((Number(ms) || 0) / 86400000));

/** ⏳ Hasta cuándo tiene una crew nueva para sumar a su gente, en palabras: «lunes 26 de octubre a las 14:30». */
export function cuandoVence(ms) {
  const d = new Date(ms);
  const dia = W.fmtFecha ? W.fmtFecha(d.toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })
    : d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  const h = W.fmtHora ? W.fmtHora(d) : d.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });
  return dia + ' a las ' + h;
}

/** «lun 26/10», en la zona de quien mira: para el plazo de quien está sin verificarse. */
export function diaCrew(ms) {
  const d = new Date(ms);
  return W.fmtFecha ? W.fmtFecha(d.toISOString(), { weekday: 'short', day: 'numeric', month: 'numeric' })
    : d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

/** «Quedan 5 días», «Queda 1 día y 20 horas», «Quedan 20 minutos»: para abajo, que una fecha límite nunca diga MÁS
 *  tiempo del que hay (con 5 días y 1 hora, «6 días» hace creer que sobra). */
export function quedan(ms) {
  const H = 3600000, D = 24 * H;
  const pl = (n, u) => n + ' ' + (n === 1 ? u[0] : u[1]);
  const dias = Math.floor(ms / D), horas = Math.floor((ms % D) / H);
  const t = dias >= 2 ? pl(dias, ['día', 'días']) : dias === 1 ? pl(1, ['día', 'días']) + (horas ? ' y ' + pl(horas, ['hora', 'horas']) : '')
    : ms >= H ? pl(Math.floor(ms / H), ['hora', 'horas']) : pl(Math.max(1, Math.floor(ms / 60000)), ['minuto', 'minutos']);
  return (/^1 /.test(t) && !/ y /.test(t) ? 'Queda ' : 'Quedan ') + t;
}

/** Lo que se le dice a quien no pudo. */
export function errorCrew(j) {
  const e = (j && j.error) || '';
  const c = W.errorCuenta && W.errorCuenta(e);
  if (c) return c;
  return ({
    verificate: 'Primero verifícate: las crews son de los Miembros de Discord Rap Español.',
    link_vencido: 'Ese link ya venció o lo borraron: pídele uno nuevo a la crew.',
    link_usado: 'Ese link ya se usó todas las veces que tenía: pídele uno nuevo a la crew.',
    links_max: 'Ya tienen ' + ((j && j.max) || 5) + ' links abiertos: borra uno para armar otro.',
    cod: 'Ese link está mal copiado: pídelo de nuevo.',
    ya_en_crew: 'Ya está en esa crew.',
    no_recibe: 'Esa persona no recibe invitaciones mientras está en su crew.',
    no_verificado: 'Esa persona todavía no es Miembro verificado de DRA: las crews son sólo de verificados.',
    requisitos: 'Esa crew pide ' + ((j && j.falta) || []).join(' y ') + ': todavía no llegas.',
    req: 'Los requisitos no valen: una letra de la Liga y de 0 a 100 eventos.',
    espera: 'Saliste de una crew hace poco: puedes entrar a otra en ' + dias(j && j.faltan_ms) + ' días.',
    nombre: 'Ese nombre no vale: de 3 a 24 letras o números, sin símbolos.',
    nombre_usado: 'Ya hay una crew con ese nombre.',
    nombre_espera: 'El nombre se cambia una vez cada 30 días.',
    sigla: 'La sigla es obligatoria: de 2 a 4 letras o números.',
    desc: 'La descripción: de 10 a 160 letras, sin links ni menciones.',
    logo: 'Falta el logo de la crew.',
    img: 'No pude leer esa imagen: elígela de nuevo.',
    filtro: 'Ese logo no pasó el filtro automático' + (j && j.texto ? ': parece tener ' + j.texto : '') + '. Elige otro.',
    metadatos: 'La imagen trae datos escondidos (como dónde se sacó): elígela de nuevo desde acá y se limpian solos.',
    'no es una imagen': 'Eso no es una imagen.',
    'demasiado grande': 'La imagen es muy pesada.',
    sin_crew: 'No estás en ninguna crew.',
    saldo: 'No te alcanzan los Puntos de Tienda: cuesta ' + ((j && j.precio) || 2500).toLocaleString('es')
      + (j && typeof j.saldo === 'number' ? ' y tienes ' + j.saldo.toLocaleString('es') : '') + '.',
    llena: 'La crew está llena: son ' + ((j && j.max) || 20) + ' como máximo.',
    solo_invitacion: 'A esta crew se entra sólo por invitación.',
    sin_invitacion: 'Esa invitación ya no está.',
    sin_pedido: 'Ese pedido ya no está.',
    rol: 'Tu rango en la crew no te deja hacer eso.',
    lider_pasa_primero: 'Eres el Líder: antes de irte o de cambiarte de crew, pasale el liderazgo a alguien de la tuya.',
    reps: 'Elige hasta ' + ((j && j.max) || 5) + ' representantes de la crew.',
    espera_dia: 'Ya hiciste mucho de esto hoy: prueba mañana.',
    no_existe: 'Esa crew ya no existe.',
    todavia: 'La Tienda todavía no abrió la temporada: prueba en un rato.',
  })[e] || 'No pude. Prueba de nuevo en un rato.';
}

const DIA_C = 86400000;
/** El orden de las letras, de la peor a la mejor, del payload (`rangos`): acá no se escribe ninguna. */
const ordenLetras = (liga) => (liga.d.rangos || []).map((r) => r.r).reverse();

/** Todo lo que la página de Crews dice de cada crew, armado una vez (19/10/2026: también lo usan las «Crews que te
 *  aceptan» del perfil y de Mi crew, sin bajarse la página entera). */
export function armarCrews(liga, todas, mia) {
  const T = liga.d.crews_tiers && liga.d.crews_tiers.nombres ? liga.d.crews_tiers : null;
  const pay = new Map((liga.d.crews || []).map((c) => [c.clave || c.crew, c]));
  const yo = liga.yo;
  const sigo = new Set(liga.sigue || []);
  const L = ordenLetras(liga);
  const max = (todas && todas.max) || 20;
  const miId = mia && mia.crew ? mia.crew.id : '';
  const invitado = new Set(((mia && mia.inv) || []).map((x) => x.crew));
  return ((todas && todas.crews) || []).map((c) => {
    const ks = (c.gente || []).map((g) => g[0]);
    const filas = ks.map((k) => liga.T[k]).filter(Boolean);
    const [tier, semPts, jugaron] = (T && T.crews && T.crews[c.id]) || [0, 0, 0];
    const ult = filas.map((f) => (f.ult && f.ult[0]) || '').filter(Boolean).sort().pop() || '';
    const dias = ult ? Math.max(0, Math.floor((liga.ahora - new Date(ult + 'T16:00:00Z')) / DIA_C)) : null;
    const act = jugaron >= 3 ? 3 : (jugaron >= 1 || (dias !== null && dias <= 7)) ? 2 : (dias !== null && dias <= 21) ? 1 : 0;
    // el nivel competitivo: la letra del medio de los que tienen letra (la tiene quien llegó a 10 eventos)
    const idx = filas.map((f) => L.indexOf(f.rg)).filter((i) => i >= 0).sort((a, b) => a - b);
    const letra = idx.length ? L[idx[Math.floor((idx.length - 1) / 2)]] : '';
    const mejor = idx.length ? L[idx[idx.length - 1]] : '';
    const ccs = [...new Set(filas.map((f) => f.cc).filter(Boolean))];
    const conozco = ks.filter((k) => sigo.has(k));
    const deMiSv = yo && yo.sv ? filas.filter((f) => f.sv === yo.sv && f.k !== yo.k).length : 0;
    const deMiPais = yo && yo.cc ? filas.filter((f) => f.cc === yo.cc && f.k !== yo.k).length : 0;
    const req = c.req || { rg: '', ev: 0 };
    // lo que te falta para lo que pide: con tu fila de la temporada (el objeto lo vuelve a mirar al pedir)
    const falta = [];
    if (req.rg && L.indexOf(yo ? yo.rg : '') < L.indexOf(req.rg)) falta.push('letra ' + req.rg);
    if (req.ev && ((yo && yo.ev) || 0) < req.ev) falta.push(req.ev + ' eventos');
    const llena = ks.length >= max;
    const puede = !llena && (c.entrada !== 'invitacion' || invitado.has(c.id)) && (!falta.length || invitado.has(c.id));
    // 🔢 «Recomendadas»: las que te aceptan, vivas, con gente que conocés; un empujón a las nuevas que buscan gente
    const reco = (puede ? 30 : 0) + act * 10 + Math.min(conozco.length, 3) * 12 + Math.min(deMiSv, 3) * 6 + Math.min(deMiPais, 3) * 4
      + (c.vence ? 8 : 0) + Math.min(jugaron, 5) * 2 + tier * 3 + (invitado.has(c.id) ? 100 : 0) - (act === 0 ? 40 : 0) - (llena ? 20 : 0);
    const p = pay.get(c.id) || {};
    // el logo: el que subió el Líder (R2) o, en las de la Liga, el del repo (`logos/crews/`, del payload)
    const logo = c.logo || p.logo || '';
    return { c, logo, ks, filas, tier, semPts, jugaron, dias, act, letra, mejor, ccs, conozco, deMiSv, deMiPais, req, falta, llena, puede,
      reco, mia: c.id === miId, invitado: invitado.has(c.id), pts: p.pts || 0, max };
  });
}

/** 🗓️ Los puntos de ESTA semana de cada uno, `Map(clave → puntos)`: de las divisiones del payload (`liga.d.div`), la
 *  misma fuente que usa bot/crews_tiers.py para la semana de cada crew. Con el modo ELO de las divisiones el número de
 *  cada fila es el ELO y no los puntos: ahí no hay semana de cada uno y vuelve vacío. */
const SEM = new WeakMap();
export function ptsSemana(liga) {
  const D = liga.d.div;
  if (!D || D.m === 'elo') return new Map();
  if (SEM.has(D)) return SEM.get(D);
  const m = new Map();
  for (const gs of D.d || []) for (const g of gs || []) for (const f of g || []) {
    if (!f || f.length < 2) continue;
    const k = (liga.fila(f[0]) || {}).k;
    if (k) m.set(k, (m.get(k) || 0) + (Number(f[1]) || 0));
  }
  SEM.set(D, m);
  return m;
}
