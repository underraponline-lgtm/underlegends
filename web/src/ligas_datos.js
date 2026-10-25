// ── 🏟️ LAS LIGAS, APARTE DEL LOBBY (25/10/2026). El lobby viaja en cada visita y se pasó del tope de peso (el self-check
// de bot/subir_web.py: 52.000 bytes comprimido), y su comentario ya lo había decidido: «lo próximo es mudar `ligas`». Dlx:
// «ok, sácalo entonces». Lo de las ligas —lo de la portada (`lobby`) y el detalle de cada una (`ligas`: las fechas, el
// flyer entero)— vive en `/api/ligas` (la KV `web:ligas`), y se pide UNA vez por cada lobby nuevo (`sello`): App.jsx
// lo vuelve a poner en `liga.d.ligas`, así quien lo lee no cambia, y ligas.jsx toma de acá el detalle
let pedido = null, de = null, cuando = 0;
export function pedirLigas(sello) {
  // el mismo lobby, o un pedido de hace menos de un minuto (ligas.jsx lo pide con otra clave): el que ya está
  if (pedido && (de === sello || Date.now() - cuando < 60000)) return pedido;
  de = sello;
  cuando = Date.now();
  pedido = fetch('/api/ligas', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    // sin respuesta, la próxima vez se pide de nuevo
    .then((x) => { if (!x) pedido = null; return x; });
  return pedido;
}
