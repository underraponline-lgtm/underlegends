// 🎨 LOS TEMAS (13/10/2026). Dlx: «ya tenemos Claro y oscuro, pero crea temas con los servidores asociados». Clara y
// Noche como siempre; los de los servidores son Noche con sus colores encima (`.t-xxx` al final de vivo.css). Se guarda
// en `lg:tema` como 'clara', 'noche' o 'sv:FFA'.
export const TEMAS_SV = [['DRA', 'Discord Rap Español'], ['FFA', 'FFA'], ['SR', 'Snake Rap'], ['URBF', 'Urban Freestyle'], ['FFS', 'FFS'], ['DDF', 'DDF'], ['ACAD', 'La Academia'], ['FVS', 'Freestyle Versus']];

// el tema guardado, si es uno que existe
export function temaValido(t) {
  if (t === 'clara' || t === 'noche') return t;
  const m = /^sv:([A-Z]{2,5})$/.exec(String(t || ''));
  return m && TEMAS_SV.some(([s]) => s === m[1]) ? t : 'clara';
}

// las clases de la app: 'clara', 'noche' o 'noche t-ffa'
export const claseTema = (t) => (t === 'clara' || t === 'noche' ? t : 'noche t-' + String(t).slice(3).toLowerCase());

// cómo se llama, para el resumen de Apariencia
export const nombreTema = (t) => (t === 'clara' ? 'Clara' : t === 'noche' ? 'Noche' : ((TEMAS_SV.find(([s]) => 'sv:' + s === t) || [0, 'Noche'])[1]));
