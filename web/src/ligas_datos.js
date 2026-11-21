// ── 🏟️ LAS LIGAS, APARTE DEL LOBBY (25/10/2026). El lobby viaja en cada visita y se pasó del tope de peso (el self-check
// de bot/subir_web.py: 52.000 bytes comprimido), y su comentario ya lo había decidido: «lo próximo es mudar `ligas`». Dlx:
// «ok, sácalo entonces». Lo de las ligas —lo de la portada (`lobby`) y el detalle de cada una (`ligas`: las fechas, el
// flyer entero)— vive en `/api/ligas` (la KV `web:ligas`), y se pide UNA vez por cada lobby nuevo (`sello`): App.jsx
// lo vuelve a poner en `liga.d.ligas`, así quien lo lee no cambia, y ligas.jsx toma de acá el detalle
let pedido = null, de = null, cuando = 0;
// ⏳ CON PLAZO (21/11/2026, revisión de robustez): un pedido que la red dejaba colgado no fallaba nunca, y como queda
// guardado para el mismo lobby, Ligas seguía en «Cargando…» y App.jsx no reintentaba (sólo reintenta cuando falla). A los
// 20 s se corta —`AbortController` + `setTimeout`: `AbortSignal.timeout` no está en Safari viejo— y cuenta como un fallo
const PLAZO = 20000;
export function pedirLigas(sello) {
  // el mismo lobby, o un pedido de hace menos de un minuto (ligas.jsx lo pide con otra clave): el que ya está
  if (pedido && (de === sello || Date.now() - cuando < 60000)) return pedido;
  de = sello;
  cuando = Date.now();
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const plazo = setTimeout(() => { if (ctl) ctl.abort(); }, PLAZO);
  const este = fetch('/api/ligas', { headers: { accept: 'application/json' }, signal: ctl ? ctl.signal : undefined })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    // sin respuesta, la próxima vez se pide de nuevo (y se suelta sólo el suyo: si ya salió otro, ése es el que queda)
    .then((x) => { clearTimeout(plazo); if (!x && pedido === este) pedido = null; return x; });
  pedido = este;
  return pedido;
}
