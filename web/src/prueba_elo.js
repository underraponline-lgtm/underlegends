// 🧪 LA PRUEBA EN SOMBRA DEL ELO NUEVO (Dlx, 20/11/2026: «podemos probar con el ELO ahora con el nuevo, o sea todos
// inician de 0 ahora, y vemos cómo funciona estos días»; a quién mostrarla: «Sólo yo»).
//
// Con `?prev=elo` (queda `lg:prev-elo` en este navegador; `?noprev=elo` la saca, ver App.jsx) la página muestra las
// divisiones del ELO de temporada que corre aparte desde el 20/11 con todos en 0 —`bot/divisiones.py`
// `correr_prueba()`— en vez de las de la T1: el Ranking ELO, la escalera, tu perfil con el histórico y los textos de la
// Guía y de «Invita y gana». Viajan en `/api/divisiones` → `prueba`: `{desde, d: como el `div` del lobby, b: las
// últimas batallas y `_hist`}` (`bot/subir_web.py` `_div_prueba()`). Para los demás no cambia nada: el lobby es el
// mismo, y la prueba no paga Puntos de Tienda ni da insignias.

export function prevElo() {
  try { return !!localStorage.getItem('lg:prev-elo'); } catch (e) { return false; }
}

// una vez por lobby nuevo (`sello`): `{desde, d, b}`, o `{}` si `/api/divisiones` todavía no la trae
let P = null, pDe = null, pidiendo = null;
export function pedirPrueba(sello) {
  if (P && pDe === sello) return Promise.resolve(P);
  pidiendo = pidiendo || fetch('/api/divisiones', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    .then((j) => { pidiendo = null; return j; });
  return pidiendo.then((j) => {
    P = (j && j.prueba && typeof j.prueba === 'object') ? j.prueba : {};
    pDe = sello;
    return P;
  });
}

// lo que leen «Tus últimas batallas» (divisiones.jsx) y el histórico del perfil (perfil_v10.jsx) de `/api/divisiones`:
// con la prueba prendida, los de la prueba
export function bDe(j) {
  if (!j) return null;
  if (prevElo() && j.prueba && j.prueba.b && typeof j.prueba.b === 'object') return j.prueba.b;
  return j.b;
}
