// ── 📅 LA TEMPORADA ENTERA DEL CALENDARIO, APARTE DEL LOBBY (29/10/2026). El lobby viaja en cada visita y el calendario
// era la única clave que crecía sin techo (toda la temporada, ~1,6 KB comprimidos por semana): ahora trae sólo desde
// `cal_desde` (4 semanas, `CAL_DIAS` de bot/subir_web.py), que es lo más atrás que mira la página fuera de Eventos. La
// temporada entera vive en `/api/calendario` (la KV `web:calendario`) y se pide al abrir Eventos o una llave, una vez
// por cada lobby nuevo (`sello`). App.jsx la junta con la del lobby (`juntarCalendario()`), así quien lo lee no cambia
let pedido = null, de = null;
export function pedirCalendario(sello) {
  if (pedido && de === sello) return pedido;
  de = sello;
  pedido = fetch('/api/calendario', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    // sin respuesta, la próxima vez se pide de nuevo
    .then((x) => { if (!x || !Array.isArray(x.calendario)) { pedido = null; return null; } return x.calendario; });
  return pedido;
}

// lo de antes del corte, de la temporada entera; desde el corte, lo del lobby (que es lo más nuevo). Sin `cal_desde`
// el lobby ya trae todo (uno viejo en caché): se deja como está
export function juntarCalendario(D, entero) {
  if (!D || !D.cal_desde || !entero) return D;
  const viejo = entero.filter((c) => c && c.t < D.cal_desde);
  return Object.assign({}, D, { calendario: viejo.concat(D.calendario || []) });
}
