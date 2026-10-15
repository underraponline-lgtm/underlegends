// 🎨 LOS TEMAS (13/10/2026). Dlx: «ya tenemos Claro y oscuro, pero crea temas con los servidores asociados», y al verlos:
// «ninguno va combinado con el tema blanco… agrega la opción ninguno para que siga simplemente el tema claro o noche».
// Son DOS elecciones: el tema de base (Clara o Noche, `lg:tema`) y los colores de un servidor encima, o ninguno
// (`lg:tema-sv`). Cada servidor tiene su versión clara y su versión oscura: `.clara.t-xxx` y `.noche.t-xxx`, al final de
// vivo.css. La primera versión (del mismo día) guardaba 'sv:FFA' en `lg:tema`: se lee como Noche + FFA.
export const TEMAS_SV = [['DRA', 'Discord Rap Español'], ['FFA', 'FFA'], ['SR', 'Snake Rap'], ['URBF', 'Urban Freestyle'],
  ['FFS', 'FFS'], ['DDF', 'DDF'], ['ACAD', 'La Academia'], ['FVS', 'Freestyle Versus'],
  ['FRZ', 'Freestyle Zone']];

const esSv = (s) => TEMAS_SV.some(([x]) => x === s);

// 🔓 SE DESBLOQUEAN CON TU NIVEL (Dlx, 13/10/2026: «al nivel 2 o 3 o 5 —OJO, nivel de XP, no nivel de Pase— que
// desbloquees las apariencias», «que esté por default desbloqueado Clara y Noche» y «quizás escalonado»). El nivel es el
// de la racha (`nivelDeXp()` en bot/avisos.js: los días que entrás y los eventos que jugás), no el del Pase. Clara,
// Noche y Ninguno, siempre. En el orden de `TEMAS_SV`: los socios más viejos, primero
export const NIVEL_TEMA = { DRA: 2, FFA: 2, SR: 2, URBF: 3, FFS: 3, DDF: 3, ACAD: 5, FVS: 5, FRZ: 5 };
export const nivelTema = (sv) => (sv ? NIVEL_TEMA[sv] || 5 : 1);

// `{base, sv}` de lo guardado
export function leerTemas() {
  try {
    const t = localStorage.getItem('lg:tema') || '';
    const viejo = /^sv:([A-Z]{2,5})$/.exec(t);
    if (viejo) return { base: 'noche', sv: esSv(viejo[1]) ? viejo[1] : '' };
    const sv = localStorage.getItem('lg:tema-sv') || '';
    return { base: t === 'noche' ? 'noche' : 'clara', sv: esSv(sv) ? sv : '' };
  } catch (e) { return { base: 'clara', sv: '' }; }
}

export function guardarTemas(base, sv) {
  try {
    localStorage.setItem('lg:tema', base);
    if (sv) localStorage.setItem('lg:tema-sv', sv); else localStorage.removeItem('lg:tema-sv');
  } catch (e) { /* sin guardar: vale para esta visita */ }
}

// las clases de la app: 'clara', 'noche', 'clara t-ffa' o 'noche t-ffa'
export const claseTema = (base, sv) => base + (sv ? ' t-' + sv.toLowerCase() : '');

export const nombreSv = (sv) => (TEMAS_SV.find(([x]) => x === sv) || [0, sv])[1];

// cómo se llama, para el resumen de Apariencia
export const nombreTema = (base, sv) => (base === 'noche' ? 'Noche' : 'Clara') + (sv ? ' · ' + nombreSv(sv) : '');
