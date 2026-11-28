/**
 * 🎫 EL PASE EN DISCORD, AHÍ MISMO (28/11/2026).
 *
 * Dlx, mirando el cartel de 〢🎫〉pase-rapero: *«No todo debería simplemente llevar a la página. En pase rapero debería
 * ser más interactuable, incluso la opción de ver en qué track estás ahora y recompensas cercanas, y ver tus misiones de
 * ahí mismo»*. El cartel (`bot/paneles_dra.py`, clave `pase`) lleva tres botones que se contestan acá, sólo a quien toca
 * (efímero), y el link a la página al final:
 *
 *   · 🎫 Mi Pase    `pse:pase`    tu nivel, la barra de XP al siguiente, si tienes el Premium y los 3 premios que vienen
 *                                 (la fila gratis y la Premium), con su imagen
 *   · 🎯 Mis Tareas `pse:tareas`  las diarias, las semanales y las de temporada, con cuánto llevas de cada una
 *   · 🗺️ El track   `pse:track`   dónde estás en los 50 niveles: los de alrededor y los premios grandes que vienen
 *
 * 🔑 LOS DATOS SON LOS DE LA PÁGINA: `alObjeto('pase', {quien})` es `paseDe()` de bot/avisos.js, lo mismo que pide la
 * página del Pase (`/avisos/pase`). Pedirlo ya revisa tus Tareas, como en la página. Acá NO se calcula nada del Pase:
 * sólo se muestra. Las reglas y los números viven en `bot/pase.py`.
 * 🔑 QUIÉN ES, LO DICE DISCORD (la interacción viene firmada): el Discord ID es la cuenta. Sin ser Miembro de DRA (la lista
 * del ciclo, `paseDatos().miembros`), el Pase no es tuyo todavía: la respuesta te manda a #verificate-aqui.
 *
 * ⚠️ EL OBJETO PUEDE ESTAR DORMIDO (~4 s en frío): «Un momento» primero y el mensaje después (`pensandoYEditar`). Tocado
 *    desde el mensaje efímero de acá, se cambia ESE mensaje (`actualizarLuego`): las tres vistas se recorren sin apilar.
 * ⚠️ El freno de clics (`frenado(…, 'click')`) lo pone el Worker antes de llamar acá, como a los demás botones.
 * ⚠️ NADA DE ESTADO (la regla de worker.js): funciones puras, salvo `boton()`, que sólo recibe y devuelve.
 * ⚠️ Las imágenes de los premios son las pegatinas de la página pasadas a PNG (`herramientas/pase_premios_png.py`, en
 *    `bot/paginas/discord/pase/`, las sirve Pages). Si se redibujan, se sube `IMG_V`: Discord guarda por dirección.
 */
import * as V from './vista.js';

export const ACCIONES = ['pse:pase', 'pse:tareas', 'pse:track'];
export const GUILD_DRA = '841017460341604382';
//: •「✅」verificate-aqui de DRA (leído de Discord el 28/11/2026; el cartel lo busca por nombre, `canal_de()`)
export const CANAL_VERIFICAR = '1506094409438199988';
export const URL_VERIFICAR = `https://discord.com/channels/${GUILD_DRA}/${CANAL_VERIFICAR}`;
export const URL_PASE = V.PAGINAS + '/freestyle-rap/pase';
export const URL_TAREAS = V.PAGINAS + '/freestyle-rap/pase/tareas';
export const IMG_V = '1';
//: las imágenes que hay (las dibuja `herramientas/pase_premios_png.py`, que lee esta lista)
export const CLAVES_IMG = ['pdt', 'titulo', 'carta', 'drop', 'star', 'caja', 'color', 'brillo', 'marco', 'reaccion', 'fondo',
  'insignia-bronce', 'insignia-plata', 'insignia-oro', 'insignia-platino', 'insignia-diamante', 'insignia-premium'];
//: el dorado del Pase (`COLOR` de bot/pase.py): el color de lo tuyo del Pase
export const COLOR_PASE = V.COLOR.amar;
//: cuántos premios que vienen muestra «Mi Pase», cuántos niveles alrededor «El track» y cuántas de temporada «Mis Tareas»
export const PROXIMOS = 3;
export const VENTANA = 7;
export const TEMPORADA_MAX = 5;
//: 🛡️ el nivel cuyo premio suma el fondo de tu crew (`NIVEL_FONDO_CREW` de web/src/pase.js)
export const NIVEL_FONDO_CREW = 10;

const num = (n) => Math.round(Number(n) || 0).toLocaleString('es-AR');
const seg = (ms) => Math.floor(Number(ms) / 1000);

// ── 🎁 los premios: el texto y la imagen ─────────────────────────────────────────────────────────────────────────────
/** El premio en una frase, como en la página (`premioLargo()` de web/src/pase_iconos.jsx). `p`: `[nivel, puntos, tipo, valor]` */
export function premioTexto(p, prem = false) {
  if (!p) return '';
  const [n, tienda, tipo, valor] = p;
  if (!prem && n === NIVEL_FONDO_CREW) return premioTexto([0].concat(p.slice(1)), false) + ' y el fondo de tu crew para tu fila';
  if (prem) {
    if (tipo === 'marco') return valor === 'Premium' ? 'Marco de carta «Premium»' : 'Marco de carta ' + String(valor || '').toLowerCase();
    if (tipo === 'reaccion') return 'Reacción ' + valor + ' en Publicaciones';
    if (tipo === 'fondo') return valor === 'pagina' ? 'Fondo para tu página' : 'Fondo para tu perfil';
    if (tipo === 'color') return 'Tu nombre del color que elijas';
    if (tipo === 'titulo') return 'Título «' + valor + '»';
    if (tipo === 'emblema') return 'Emblema ' + valor;
    if (tipo === 'carta') return 'Tu carta, edición premium';
    return '+' + num(tienda) + ' Puntos de Tienda';
  }
  if (tipo === 'tarjeta') return 'Tu carta de ' + valor;
  if (tipo === 'insignia') return 'Insignia ' + valor;
  if (tipo === 'titulo') return 'Título «' + valor + '»';
  if (tipo === 'color') return 'Tu nombre en dorado';
  if (tipo === 'llave') return 'Tu carta brilla en las llaves';
  if (tipo === 'drop') return 'Un Dragón Drop';
  if (tipo === 'caja') return valor === '50' ? 'Caja del Campeón: un Micrófono de Oro seguro y 5.000 Puntos'
    : 'Caja del Campeón: 3 drops de Vinilo o más y 2.000 Puntos';
  return '+' + num(tienda) + ' Puntos de Tienda';
}

/** El premio con los Puntos que también da el nivel: «Insignia Pase Plata · +150 Puntos» */
export function premioConPuntos(p, prem = false) {
  const t = premioTexto(p, prem);
  return p && p[2] && p[1] ? t + ' · +' + num(p[1]) + ' Puntos' : t;
}

/** La clave de su imagen: el objeto de la página (`objetoDe()` de web/src/pase_objetos.jsx) y, la insignia, su metal */
export function claveImg(p) {
  const tipo = p && p[2];
  if (!tipo) return 'pdt';
  if (tipo === 'tarjeta' || tipo === 'carta') return 'carta';
  if (tipo === 'llave') return 'brillo';
  if (tipo === 'insignia' || tipo === 'emblema') {
    const v = String(p[3] || '').toLowerCase();
    const m = ['bronce', 'plata', 'oro', 'platino', 'diamante', 'premium'].find((x) => v.includes(x));
    return 'insignia-' + (m || (tipo === 'emblema' ? 'premium' : 'bronce'));
  }
  return CLAVES_IMG.includes(tipo) ? tipo : 'pdt';
}
export const urlImg = (clave) => `${V.PAGINAS}/discord/pase/${clave}.png?v=${IMG_V}`;
export const imagenPremio = (p) => urlImg(claveImg(p));

/** `[nivel, …]` de una fila (`premios` o `fila_premium`) por nivel */
const deNivel = (fila, n) => (fila || []).find((x) => x && x[0] === n) || null;

// ── 📏 la barra ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** Una barra de `n` casillas: `▰▰▰▱▱▱`. `f` de 0 a 1 */
export function barra(f, n = 12) {
  const k = Math.max(0, Math.min(n, Math.round((Number(f) || 0) * n)));
  return '▰'.repeat(k) + '▱'.repeat(n - k);
}

/** ¿Tiene el Premium ahora? (`premium` de `paseExtras()`: `null`, o `{desde, hasta}` con `hasta: null` si no vence) */
export const tienePremium = (p, ahora = Date.now()) => !!(p && p.premium && (p.premium.hasta == null || p.premium.hasta > ahora));

/** El progreso al siguiente nivel: `{nivel, niveles, xp, lleva, falta, tramo, f, max}` */
export function progreso(p) {
  const niveles = Number(p.niveles) || 50, nivel = Math.min(Number(p.nivel) || 0, niveles), xp = Number(p.xp) || 0;
  const max = nivel >= niveles || p.hasta == null;
  const desde = Number(p.desde) || 0, hasta = max ? desde : Number(p.hasta);
  const tramo = Math.max(1, hasta - desde), lleva = Math.max(0, xp - desde);
  return { nivel, niveles, xp, max, lleva: max ? 0 : Math.min(lleva, tramo), tramo, falta: max ? 0 : Math.max(0, hasta - xp),
    f: max ? 1 : Math.min(1, lleva / tramo) };
}

// ── 🚧 los estados que no son un Pase ────────────────────────────────────────────────────────────────────────────────
export const TXT = {
  red: '🎫 No pude leer tu Pase: prueba de nuevo en un minuto.',
  noListo: '🎫 El Pase de esta temporada arranca en un rato: vuelve a tocar el botón más tarde.',
  verificar: '🎫 El Pase es de los **Miembros de DRA**. Verifícate en <#' + CANAL_VERIFICAR + '> (eliges tu país y tu AKA, '
    + 'es un minuto) y vuelve a tocar el botón: tu Pase arranca en el nivel 0 y con la primera Tarea ya sumas XP.',
  boton: 'Ese botón ya no anda: abre tu Pase en la página.',
  quien: 'No pude saber quién eres: prueba de nuevo.',
};

/** Lo que se contesta en vez del Pase, o `null` si hay un Pase para mostrar */
export function antes(p) {
  if (!p || typeof p !== 'object' || p.error) return V.avisoMsg(TXT.red, [V.enlace('Abrir mi Pase', URL_PASE, '🎫')]);
  if (!p.listo) return V.avisoMsg(TXT.noListo);
  if (!p.miembro) return V.avisoMsg(TXT.verificar, [V.enlace('Ir a verificarme', URL_VERIFICAR, '✅')]);
  return null;
}

// ── la fila de abajo: las otras dos vistas y la página ──────────────────────────────────────────────────────────────
/** Las otras dos vistas (la que se está viendo, gris y apagada) y el link a la página, último */
export function filaPase(cual) {
  const b = (id, et, emo) => V.boton(et, 'pse:' + id, 2, { emoji: { name: emo }, disabled: cual === id });
  return [b('pase', 'Mi Pase', '🎫'), b('tareas', 'Mis Tareas', '🎯'), b('track', 'El track', '🗺️'),
    V.enlace('Abrir mi Pase', cual === 'tareas' ? URL_TAREAS : URL_PASE)];
}

const efimero = (dentro, cual) => V.mensaje({ familia: 'pase', color: COLOR_PASE, dentro, filas: [filaPase(cual)], efimero: true });

// ── 🎫 «Mi Pase» ─────────────────────────────────────────────────────────────────────────────────────────────────────
export function mensajePase(p, ahora = Date.now()) {
  const pre = antes(p);
  if (pre) return pre;
  const g = progreso(p), prem = tienePremium(p, ahora);
  const dentro = [];
  const plan = prem
    ? '💎 **Pase Premium**' + (p.boost ? ' · +' + p.boost + ' % de XP en cada Tarea' : '') + (p.premium && p.premium.prueba ? ' · de prueba' : '')
    : '🆓 **Pase gratis**' + (p.boost ? ' · con el Premium sumas un ' + p.boost + ' % más de XP y la fila 💎' : '');
  dentro.push(V.T(`## 🎫 Nivel ${g.nivel} de ${g.niveles}\n${plan}`));
  if (g.max) {
    const cada = p.cada || [];
    dentro.push(V.T(`\`${barra(1)}\` **¡Completaste el Pase!**` + (p.salon ? ` · entraste al Salón del Pase en el puesto **#${p.salon}**` : '')
      + `\n-# Llevas ${num(g.xp)} XP` + (cada[0] ? ` · cada ${num(cada[0])} XP más te dan +${num(cada[1])} Puntos de Tienda` : '')));
  } else {
    dentro.push(V.T(`\`${barra(g.f)}\` **${num(g.lleva)} / ${num(g.tramo)} XP** para el nivel ${g.nivel + 1}\n`
      + `-# Te faltan ${num(g.falta)} XP · llevas ${num(g.xp)} en total` + (p.cobrado ? ` · ya cobraste ${num(p.cobrado)} Puntos de Tienda` : '')));
  }
  const prox = [];
  for (let n = g.nivel + 1; n <= g.niveles && prox.length < PROXIMOS; n++) prox.push(n);
  if (prox.length) {
    dentro.push(V.sep(), V.T('### 🎁 Lo que viene'));
    for (const n of prox) {
      const libre = deNivel(p.premios, n), pp = deNivel(p.fila_premium, n);
      const lineas = [`**Nivel ${n}**`];
      if (libre) lineas.push('🆓 ' + premioConPuntos(libre));
      if (pp) lineas.push('💎 ' + premioTexto(pp, true) + (prem ? '' : ' 🔒'));
      // la imagen: el premio gratis si es algo más que Puntos; si no, el de la fila Premium
      const img = libre && libre[2] ? libre : pp && pp[2] ? pp : libre;
      dentro.push(V.seccion(lineas.join('\n'), V.mini(img ? imagenPremio(img) : '')));
    }
  }
  return efimero(dentro, 'pase');
}

// ── 🎯 «Mis Tareas» ──────────────────────────────────────────────────────────────────────────────────────────────────
/** Una Tarea en una línea: hecha, tachada; si no, en negrita con cuánto llevas. `como`: la explicación debajo */
export function lineaTarea(t, como = true) {
  if (!t) return '';
  if (t.hecha) return `✅ ~~${t.t}~~ · +${num(t.xp)} XP`;
  const lleva = t.meta > 1 ? ` · ${num(t.lleva)}/${num(t.meta)}` : '';
  return `⬜ **${t.t}**${lleva} · +${num(t.xp)} XP` + (como && t.d ? `\n-# ${t.d}` : '');
}

/** Las de temporada que se muestran: las que faltan, primero las más avanzadas, hasta `TEMPORADA_MAX` */
export function temporadaQueFaltan(ts) {
  return (ts || []).filter((t) => !t.hecha).sort((a, b) => (b.lleva / (b.meta || 1)) - (a.lleva / (a.meta || 1))).slice(0, TEMPORADA_MAX);
}

/** ¿Corre la XP doble ahora? (`doble`: `[[desde, hasta, ×], …]`) → el multiplicador, o 0 */
export const dobleAhora = (p, ahora = Date.now()) => ((p.doble || []).find((d) => ahora >= d[0] && ahora < d[1]) || [0, 0, 0])[2];

export function mensajeTareas(p, ahora = Date.now(), como = true) {
  const pre = antes(p);
  if (pre) return pre;
  const dentro = [V.T('## 🎯 Tus Tareas\n-# Cada una da XP una vez; el nivel sale de la XP.'
    + (dobleAhora(p, ahora) ? ` ⚡ **Esta semana la XP vale ×${dobleAhora(p, ahora)}.**` : ''))];
  const bloque = (titulo, ts) => { dentro.push(V.sep(), V.T(`### ${titulo}\n` + ts.map((t) => lineaTarea(t, como)).join('\n'))); };
  const bien = (p.bienvenida || []).filter((t) => !t.hecha);
  if (bien.length) bloque('🐣 Para empezar', bien);
  const esp = (p.especiales || []).filter((t) => t && !t.hecha && t.ini <= ahora && ahora < t.fin);
  if (esp.length) bloque('⭐ Especiales · hasta <t:' + seg(Math.min(...esp.map((t) => t.fin))) + ':R>', esp);
  if (p.hoy && (p.hoy.tareas || []).length) bloque(`☀️ Hoy · cambian <t:${seg(p.hoy.fin)}:R>`, p.hoy.tareas);
  else { dentro.push(V.sep(), V.T('### ☀️ Hoy\nHoy no hay diarias: vuelven mañana.')); }
  if (p.semana && (p.semana.tareas || []).length) bloque(`📅 Esta semana · termina <t:${seg(p.semana.fin)}:R>`, p.semana.tareas);
  else { dentro.push(V.sep(), V.T('### 📅 Esta semana\nLas semanales arrancan el lunes a las 11 AM ET.')); }
  if (p.gracia && (p.gracia.tareas || []).length) bloque(`🛟 La semana pasada · todavía cuenta hasta <t:${seg(p.gracia.fin)}:R>`, p.gracia.tareas);
  const temp = p.temporada || [];
  if (temp.length) {
    const hechas = temp.filter((t) => t.hecha).length, faltan = temporadaQueFaltan(temp);
    const resto = temp.length - hechas - faltan.length;
    dentro.push(V.sep(), V.T(`### 🏆 De la temporada · ${hechas} de ${temp.length} hechas\n`
      + (faltan.length ? faltan.map((t) => lineaTarea(t, false)).join('\n') : '¡Hiciste todas las de la temporada!')
      + (resto > 0 ? `\n-# Y ${resto} más en la página.` : '')));
  }
  const m = efimero(dentro, 'tareas');
  // 📏 si no entra en las 4.000 letras de Discord, sin las explicaciones (las tiene la página)
  return como && V.medir(m).letras > V.TOPES.letras - 200 ? mensajeTareas(p, ahora, false) : m;
}

// ── 🗺️ «El track» ────────────────────────────────────────────────────────────────────────────────────────────────────
/** Los niveles que se ven alrededor del tuyo: `VENTANA` en total, dos antes del tuyo si hay */
export function ventana(nivel, niveles, n = VENTANA) {
  const desde = Math.max(1, Math.min(nivel - 2, niveles - n + 1));
  const out = [];
  for (let k = desde; k <= niveles && out.length < n; k++) out.push(k);
  return out;
}

/** La tira de todo el Pase: una casilla cada dos niveles (25 para 50), llenas las que pasaste y `◆` la tuya */
export function tiraTrack(nivel, niveles) {
  const casillas = Math.ceil(niveles / 2);
  return Array.from({ length: casillas }, (_, k) => {
    if (nivel > 0 && nivel < niveles && Math.ceil(nivel / 2) === k + 1) return '◆';
    return 2 * k + 2 <= nivel || nivel >= niveles ? '▰' : '▱';
  }).join('');
}

/** Los premios grandes que vienen (los que dan algo más que Puntos), después de `desde` */
export function grandes(p, desde, n = 3) {
  return (p.premios || []).filter((x) => x && x[0] > desde && x[2]).slice(0, n);
}

export function mensajeTrack(p, ahora = Date.now()) {
  const pre = antes(p);
  if (pre) return pre;
  const g = progreso(p), prem = tienePremium(p, ahora);
  const tira = tiraTrack(g.nivel, g.niveles);
  const dentro = [V.T(`## 🗺️ El track · nivel ${g.nivel} de ${g.niveles}\n\`${tira}\`\n-# Llevas el ${Math.round(100 * g.nivel / g.niveles)} % del Pase`
    + (g.max ? ' · ¡completo!' : ` · ${num(g.falta)} XP para el nivel ${g.nivel + 1}`))];
  const lineas = [];
  if (g.nivel === 0) lineas.push('📍 **Nivel 0 · estás acá** · con tu primera Tarea arrancas');
  for (const n of ventana(g.nivel, g.niveles)) {
    const libre = deNivel(p.premios, n), pp = deNivel(p.fila_premium, n);
    const extra = pp && pp[2] ? ` · 💎 ${premioTexto(pp, true)}${prem ? '' : ' 🔒'}` : '';
    if (n < g.nivel) lineas.push(`✅ ${n} · ${premioTexto(libre)}${extra}`);
    else if (n === g.nivel) lineas.push(`📍 **${n} · estás acá** · ${premioTexto(libre)}${extra}`);
    else lineas.push(`${n === g.nivel + 1 ? '⏭️' : '⬜'} ${n} · ${premioTexto(libre)}${extra}`);
  }
  dentro.push(V.sep(), V.T(lineas.join('\n')));
  // 🏆 los grandes que vienen después de lo que se ve, con su imagen
  const ult = ventana(g.nivel, g.niveles).slice(-1)[0] || g.nivel;
  const gr = grandes(p, ult);
  if (gr.length) {
    dentro.push(V.sep(), V.T('### 🏆 Los grandes que vienen'),
      V.galeria(gr.map((x) => ({ media: { url: imagenPremio(x) }, description: `Nivel ${x[0]} · ${premioTexto(x)}`.slice(0, 1000) }))),
      V.T(gr.map((x) => `**${x[0]}** · ${premioTexto(x)}`).join('\n')));
  } else if (g.max) {
    const cada = p.cada || [];
    dentro.push(V.sep(), V.T('🏆 **Completaste los ' + g.niveles + ' niveles.**' + (cada[0] ? ` Cada ${num(cada[0])} XP más te dan +${num(cada[1])} Puntos de Tienda.` : '')));
  }
  return efimero(dentro, 'track');
}

/** La vista de una acción (`pase`, `tareas` o `track`), con el Pase de `paseDe()` */
export function vista(accion, p, ahora = Date.now()) {
  if (accion === 'tareas') return mensajeTareas(p, ahora);
  if (accion === 'track') return mensajeTrack(p, ahora);
  return mensajePase(p, ahora);
}

// ── 🔌 lo que llama el Worker ────────────────────────────────────────────────────────────────────────────────────────
/**
 * El clic en un botón `pse:<acción>`. `a`: lo que presta el Worker —`{aviso, alObjeto, pensandoYEditar, actualizarLuego,
 * esEfimero, idDe}`—. El freno lo pone el Worker antes. Desde el panel público, un mensaje nuevo sólo para quien toca;
 * desde uno de estos (efímero), cambia ese mismo.
 */
export function boton(i, env, ctx, a) {
  const accion = String((i && i.data && i.data.custom_id) || '').split(':')[1] || '';
  if (!ACCIONES.includes('pse:' + accion)) return a.aviso(TXT.boton, [V.enlace('Abrir mi Pase', URL_PASE, '🎫')]);
  const yo = a.idDe(i);
  if (!yo) return a.aviso(TXT.quien);
  const trabajo = async () => vista(accion, await a.alObjeto(env, 'pase', { quien: yo }));
  return a.esEfimero(i) ? a.actualizarLuego(i, ctx, trabajo, 'pase') : a.pensandoYEditar(i, ctx, trabajo, 'pase');
}
