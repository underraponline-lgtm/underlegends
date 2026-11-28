/**
 * 🗂️ LOS BOTONES DE LOS FOROS DE DRA (28/11/2026): servidores-rap, crews y ligas (bot/foros_dra.py los publica).
 *
 * Dlx: «pon botones si es necesario, como cómo ascender, etc.» y, de siempre, «no todo debería llevar a la página». Estos
 * contestan ACÁ, sólo a quien toca (efímero): `fo:<qué>[:<de quién>]`.
 *   tiers        cómo sube un servidor de tier            (la fijada de servidores-rap)
 *   sumar        cómo se suma un servidor (/setup)        (idem)
 *   ev:<SV>      los próximos eventos de ese socio        (cada socio)
 *   cu:<crew>    cómo entrar a esa crew, con «Pedir entrar» si se puede
 *   cp:<crew>    «Pedir entrar»: lo mismo que `/crew unirme` (lo hace el Worker, `crewComando()`)
 *   ct:<crew|_>  cómo va su tier y qué le falta (o las reglas, con `_`)
 *   cr           cómo se crea una crew                    (la fijada de crews)
 *   lt:<liga>    el top 10 de la tabla                    (cada liga)
 *
 * 🔑 LOS TEXTOS LOS ARMA EL CICLO, NO ESTE ARCHIVO: salen de las reglas de verdad (bot/tiers.py, bot/crews_tiers.py,
 * bot/crews.js) y quedan en R2 (`INFO_R2`), que se escribe sólo cuando cambian. Acá se lee ese JSON chico (una lectura de
 * R2 por clic: ni KV, que son 1.000 escrituras por día para toda la cuenta, ni el lobby entero, que son 250 KB de parseo
 * dentro de los 10 ms) y se elige qué mostrar. Lo único que se hace acá es sacar los eventos que ya empezaron: el JSON
 * puede tener una hora.
 * ⚠️ `QUE` lo compara el self-check de bot/foros_dra.py con lo que publica: un botón que este archivo no conoce no sale.
 * ⚠️ ESTE ARCHIVO NO GUARDA NADA FUERA DE LAS FUNCIONES (la regla de worker.js).
 */
export const QUE = ['tiers', 'sumar', 'ev', 'cu', 'cp', 'ct', 'cr', 'lt'];
export const INFO_R2 = 'paneles/foros/info.json';
const HUB = 'https://underlegends.pages.dev';
const enlace = (label, url, emoji) => Object.assign({ type: 2, style: 5, label, url }, emoji ? { emoji: { name: emoji } } : {});
const limpio = (s) => String(s == null ? '' : s).replace(/[*_~`|>]/g, '');

/** `[que, arg]` de un custom_id, o `null` si no es de acá. */
export function leerId(id) {
  const p = String(id || '').split(':');
  if (p[0] !== 'fo' || !QUE.includes(p[1])) return null;
  return [p[1], p.slice(2).join(':')];
}

/**
 * Qué contestar: `{texto, botones}` o `{accion: 'unirme', crew}` (lo hace el Worker). `info` es el JSON de R2; sin él, o
 * sin lo pedido, un aviso con el link a la página. `ahora` en ms. Pura.
 */
export function respuesta(info, que, arg, ahora = Date.now()) {
  const I = info || {};
  const nada = { texto: 'Ahora no pude leer eso: prueba en un rato.', botones: [enlace('La Liga', HUB + '/freestyle-rap', '🌐')] };
  if (que === 'cp') return arg ? { accion: 'unirme', crew: arg } : nada;
  if (!info) return nada;
  if (que === 'tiers') return I.tiers ? { texto: I.tiers, botones: [enlace('Suma tu servidor', I.guia_sumar || HUB + '/freestyle-rap/socios/sumar', '🌐')] } : nada;
  if (que === 'sumar') {
    return I.sumar ? { texto: I.sumar, botones: [enlace('Agregar el bot', I.bot, '🤖'), enlace('Suma tu servidor', I.guia_sumar, '🌐')].filter((b) => b.url) } : nada;
  }
  if (que === 'cr') return I.crear ? { texto: I.crear, botones: [enlace('Crear mi crew', HUB + '/cuenta/crew', '🛡️')] } : nada;
  if (que === 'ev') {
    const s = (I.sv || {})[arg];
    if (!s) return nada;
    const corte = Math.floor(ahora / 1000) - 30 * 60;       // lo que arrancó hace media hora todavía «es»
    const evs = (s.ev || []).filter((e) => Array.isArray(e) && e[1] >= corte).slice(0, 6);
    if (!evs.length) {
      return { texto: '### 📅 ' + limpio(s.n) + '\nAhora no tiene eventos anunciados. Cuando anuncie uno, sale en el calendario y suena la campana.',
        botones: [enlace('El calendario', HUB + '/freestyle-rap/eventos', '📅'), enlace('Su página', s.p, '🌐')] };
    }
    const L = ['### 📅 Los próximos eventos de ' + limpio(s.n)];
    for (const [n, u, link] of evs) L.push('**' + limpio(n) + '** · <t:' + u + ':F> (<t:' + u + ':R>)' + (link ? ' · [el anuncio](' + link + ')' : ''));
    return { texto: L.join('\n'), botones: [enlace('Su página', s.p, '🌐')] };
  }
  if (que === 'cu') {
    const c = (I.crews || {})[arg];
    if (!c) return nada;
    const bs = [enlace('Ver la crew', c.p, '👥')];
    if (c.pedir) bs.unshift({ type: 2, style: 1, label: 'Pedir entrar', custom_id: ('fo:cp:' + arg).slice(0, 100), emoji: { name: '➕' } });
    return { texto: c.unir, botones: bs };
  }
  if (que === 'ct') {
    if (arg === '_') return I.crews_tiers ? { texto: I.crews_tiers, botones: [enlace('Las crews', HUB + '/freestyle-rap/crews', '🌐')] } : nada;
    const c = (I.crews || {})[arg];
    return c ? { texto: c.tier, botones: [enlace('Ver la crew', c.p, '👥')] } : nada;
  }
  if (que === 'lt') {
    const l = (I.ligas || {})[arg];
    return l ? { texto: l.tabla, botones: [enlace('La liga', l.p, '🏟️')] } : nada;
  }
  return nada;
}

/** La info de R2, o `null`. */
export async function leerInfo(env) {
  try {
    const o = env && env.CARTAS ? await env.CARTAS.get(INFO_R2) : null;
    return o ? await o.json() : null;
  } catch (e) {
    return null;
  }
}

/**
 * El clic. `ayuda`: `{aviso(texto, botones), crewUnirme(crew)}` del Worker (el freno al spam ya lo pasó el despacho).
 */
export async function botonWorker(i, env, ctx, ayuda) {
  const l = leerId(i && i.data && i.data.custom_id);
  if (!l) return ayuda.aviso('Ese botón ya no anda.');
  const [que, arg] = l;
  const r = respuesta(que === 'cp' ? {} : await leerInfo(env), que, arg);
  if (r.accion === 'unirme') return ayuda.crewUnirme(r.crew);
  return ayuda.aviso(String(r.texto || '').slice(0, 3900), r.botones || []);
}
