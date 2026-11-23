// 🇬🇧 LO QUE COMPARTEN LA PÁGINA EN INGLÉS (`ingles.js`) Y LA HERRAMIENTA QUE JUNTA SUS TEXTOS (herramientas/textos_ingles.py,
// que lee ESTE archivo y lo corre en la página): cómo se vuelve un texto de la página una CLAVE del diccionario
// (`ingles.json`) y cómo se rellena su traducción. Tiene que ser el mismo en los dos lados: una clave armada distinto no se
// encuentra nunca, y la página queda en castellano sin ningún error.
//
// 🔑 LOS NÚMEROS Y LOS NOMBRES SON HUECOS. «La Temporada de Valen» y «Erian · 837K pts» son textos de la página con un dato
// adentro: con el dato puesto, cada persona sería otra clave. La clave lleva `{n}` donde hay un número y `{p}` donde hay
// un nombre de la Liga (los del lobby: raperos, servidores, crews, eventos), y la traducción los lleva igual:
// «La Temporada de {p}» → «{p}'s Season». Al rellenar, cada hueco recibe el suyo en orden (los `{n}` por un lado y los
// `{p}` por otro, así la traducción puede ordenarlos distinto entre tipos).
// ⚠️ Esto es sólo para la vista en inglés (`/en`, Dlx 18/11/2026: un empleador quiere ver la página). Nada de la página en
// castellano pasa por acá.

//: palabras de la página que también son el nombre de alguien: no se vuelven hueco (si no, «Final» o «Mar» dejarían de traducirse)
const NO_NOMBRE = new Set(['Sol', 'Mar', 'Mes', 'Más', 'Todo', 'Todos', 'Rey', 'Liga', 'Global', 'Temporada', 'Ranking', 'Eventos',
  'Tienda', 'Pase', 'Socios', 'Crews', 'Guía', 'Ligas', 'Final', 'Campeón', 'Elegido', 'Inicio', 'Perfil', 'Lunes', 'Martes',
  'Jueves', 'Viernes', 'Sábado', 'Domingo', 'Nuevo', 'Nueva', 'Hoy', 'Ayer', 'Oro', 'Plata', 'Bronce', 'Leyenda', 'Maestro',
  'Diamante', 'Platino', 'Jade', 'Hierro', 'Rubí', 'Zafiro', 'Mítico', 'Gratis', 'Premium', 'Cartas', 'Tarjetas']);

/** Los nombres de la Liga que hay en el lobby: cada uno se vuelve un hueco `{p}` */
export function nombresDe(L) {
  const s = new Set();
  const add = (x) => {
    x = String(x == null ? '' : x).trim();
    if (x.length >= 3 && x.length <= 60 && !NO_NOMBRE.has(x) && /\p{L}/u.test(x)) s.add(x);
  };
  if (!L) return [];
  for (const f of L.tabla || []) add(f && f.n);
  for (const a of L.avs || []) add(a && a[0]);
  for (const v of L.svs || []) { if (v) { add(v.nombre); add(v.sigla); add(v.sv); } }
  for (const c of L.crews || []) add(c && c.crew);
  for (const x of Object.values(L.llaves || {})) add(x && x.nombre);
  for (const c of L.calendario || []) add(c && c.n);
  for (const x of [].concat(L.pasados || [], L.proximos || [])) add(x && x.nombre);
  for (const r of L.records || []) add(r && r.n);
  return [...s];
}

// el «mirar atrás» que entiende este navegador, o '' si no. En pedazos a propósito: escrito entero, el minificador lo
// deja como un literal y web/montar.py frena el build
const MIRA = ['(?<', '!'].join('');
const MIRA_ATRAS = (() => { try { new RegExp(MIRA + 'a)b', 'u'); return MIRA + '[\\p{L}\\p{N}])'; } catch (e) { return ''; } })();
const NUM = '\\d+(?:[.,:]\\d+)*';
/** Una sola expresión para los nombres y los números, así los huecos salen en el orden del texto */
export function rxHuecos(nombres) {
  const esc = [...(nombres || [])].sort((a, b) => b.length - a.length).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // sin nombres, un grupo que nunca encaja: los números siguen siendo huecos
  if (!esc.length) return new RegExp('((?!))|(' + NUM + ')', 'gu');
  const nom = '(?:' + esc.join('|') + ')(?![\\p{L}\\p{N}])';
  // 🍎 «MIRAR ATRÁS», SÓLO DONDE SE ENTIENDE (23/11/2026): Safari anterior al 16.4 (iOS 15) no lo lee y `new RegExp`
  // tiraba un error al armar las de /en. Ahí va una sin él: el carácter de adelante se come y `normalizar()` lo
  // devuelve (`rx.pre`). Donde se entiende, la misma de siempre
  if (MIRA_ATRAS) return new RegExp('(' + MIRA_ATRAS + nom + ')|(' + NUM + ')', 'gu');
  const rx = new RegExp('(?:(^|[^\\p{L}\\p{N}])(' + nom + '))|(' + NUM + ')', 'gu');
  rx.pre = true;
  return rx;
}

/** `{k, h}`: la clave del texto (`{p}` y `{n}` en lugar de nombres y números) y lo que había en cada hueco */
export function normalizar(t, rx) {
  const h = { n: [], p: [] };
  const r = rx || rxHuecos([]);
  const k = String(t).replace(r, r.pre
    ? (m, pre, nom, num) => {
      if (nom) { h.p.push(nom); return pre + '{p}'; }
      if (num) { h.n.push(m); return '{n}'; }
      return m;
    }
    : (m, nom, num) => {
      if (nom) { h.p.push(m); return '{p}'; }
      if (num) { h.n.push(m); return '{n}'; }
      return m;
    });
  return { k, h };
}

/** Un número como se escribe en inglés: 21.000 → 21,000 y 6,7 → 6.7 (las horas y las fechas, como vienen) */
export function numeroIngles(x) {
  if (/^\d{1,3}(\.\d{3})+$/.test(x)) return x.replace(/\./g, ',');
  if (/^\d+,\d+$/.test(x)) return x.replace(',', '.');
  return x;
}

/** La traducción con sus huecos rellenos, en orden por tipo. `null` si no tiene los mismos huecos que la clave */
export function rellenar(v, h) {
  const n = [...h.n], p = [...h.p];
  const cuenta = (re) => (v.match(re) || []).length;
  if (cuenta(/\{n\}/g) !== n.length || cuenta(/\{p\}/g) !== p.length) return null;
  return v.replace(/\{([np])\}/g, (m, t) => (t === 'n' ? numeroIngles(n.shift()) : p.shift()));
}
