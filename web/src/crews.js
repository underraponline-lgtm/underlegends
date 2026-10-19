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
    verificate: 'Primero verificate: las crews son de los Miembros de Discord Rap Español.',
    ya_en_crew: 'Ya está en una crew.',
    espera: 'Saliste de una crew hace poco: podés entrar a otra en ' + dias(j && j.faltan_ms) + ' días.',
    nombre: 'Ese nombre no vale: de 3 a 24 letras o números, sin símbolos.',
    nombre_usado: 'Ya hay una crew con ese nombre.',
    nombre_espera: 'El nombre se cambia una vez cada 30 días.',
    sigla: 'La sigla es obligatoria: de 2 a 4 letras o números.',
    desc: 'La descripción: de 10 a 160 letras, sin links ni menciones.',
    logo: 'Falta el logo de la crew.',
    img: 'No pude leer esa imagen: elegila de nuevo.',
    filtro: 'Ese logo no pasó el filtro automático' + (j && j.texto ? ': parece tener ' + j.texto : '') + '. Elegí otro.',
    metadatos: 'La imagen trae datos escondidos (como dónde se sacó): elegila de nuevo desde acá y se limpian solos.',
    'no es una imagen': 'Eso no es una imagen.',
    'demasiado grande': 'La imagen es muy pesada.',
    sin_crew: 'No estás en ninguna crew.',
    saldo: 'No te alcanzan los Puntos de Tienda: crear una crew cuesta ' + ((j && j.precio) || 2500).toLocaleString('es') + '.',
    llena: 'La crew está llena: son ' + ((j && j.max) || 20) + ' como máximo.',
    solo_invitacion: 'A esta crew se entra sólo por invitación.',
    sin_invitacion: 'Esa invitación ya no está.',
    sin_pedido: 'Ese pedido ya no está.',
    rol: 'Tu rango en la crew no te deja hacer eso.',
    lider_pasa_primero: 'Antes de irte, pasale el liderazgo a alguien de la crew.',
    reps: 'Elegí hasta ' + ((j && j.max) || 5) + ' representantes de la crew.',
    espera_dia: 'Ya hiciste mucho de esto hoy: probá mañana.',
    no_existe: 'Esa crew ya no existe.',
    todavia: 'La Tienda todavía no abrió la temporada: probá en un rato.',
  })[e] || 'No pude. Probá de nuevo en un rato.';
}
