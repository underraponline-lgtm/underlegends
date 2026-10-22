// ✍️ CÓMO SE DICE LO QUE PIDE CADA TARJETA, PARA ALGUIEN QUE RECIÉN LLEGA. Dlx, 07/10/2026: *«sé más descriptivo… pon
// te falta participar en 10 eventos más de cualquier servidor asociado a la Liga Global, por ejemplo… y hacelo con
// otras cosas para que la gente nueva entienda a qué se refiere»*. «6/10 eventos» o «0/3 duelos nacionales» no decían
// qué cuenta como evento ni qué es un duelo nacional. Un solo lugar para el perfil, Tarjetas, el Ranking y la Guía.
//
// ⚠️ LOS NÚMEROS NO VIVEN ACÁ: salen de `comun/requisitos.py` por el payload (`req` de /api/perfiles, `requisitos` del
// lobby). Acá sólo qué es cada cosa y cómo se consigue. Una condición que no esté en `tipo()` se dice como viene.
// ⚠️ Y TAMPOCO EL PASE: que el nivel 1 sean dos diarias o una semanal sale de `bot/pase.py` (300 XP; 150 y 500), medido
// el 07/10/2026. Si cambia la XP, se cambia `PASE_COMO`.

const PASE_COMO = 'con dos Tareas diarias o una semanal';
const LIGA = 'de cualquier servidor asociado a la Liga Global';
const plural = (n, uno, varios) => (n === 1 ? uno : varios);

// qué condición es, por su etiqueta de `comun/requisitos.py` («EVENTOS», «BANDERA ASIGNADA», «DUELOS NACIONALES»…)
export function tipo(et) {
  const s = String(et || '').toUpperCase();
  if (/BANDERA/.test(s)) return 'pais';
  // 🤝 «CRUCES» desde el 22/10/2026 (un duelo 1v1 o cada rival de un triple); «DUELOS» es la etiqueta de antes
  if (/(DUELOS?|CRUCES?) NACIONAL/.test(s)) return 'dnac';
  if (/(DUELOS?|CRUCES?) INTERNACIONAL/.test(s)) return 'dint';
  if (/EVENTO/.test(s)) return 'ev';
  if (/PARTICIPACI/.test(s)) return 'part';
  return '';
}

/**
 * Lo que falta de una condición, en una frase. `tu`: si es la persona que mira («te falta») u otra («le falta»).
 * Cumplida, `null`: lo cumplido no necesita explicación (la barra ya está llena).
 *   falta('EVENTOS', 6, 10, true) → «Te falta participar en 4 eventos más de cualquier servidor asociado a la Liga Global.»
 */
export function falta(et, lleva, pide, tu) {
  const resto = Math.max(0, (pide || 0) - (lleva || 0));
  if (!resto) return null;
  const L = tu ? 'Te falta' : 'Le falta';
  const su = tu ? 'tu' : 'su';
  const duelo = (que, contra) => L + (tu ? ' cruzarte' : ' cruzarse') + ' con ' + resto + ' ' + plural(resto, 'rival', 'rivales') + ' más ' + contra
    + ' (' + plural(resto, 'un cruce ' + que, 'cruces ' + que + 'es') + '): en un 1 contra 1 o en un triple, en la llave de cualquier evento de la Liga.';
  switch (tipo(et)) {
    case 'ev':
    case 'part':
      return L + ' participar en ' + resto + ' ' + plural(resto, 'evento', 'eventos') + ' más ' + LIGA + '.';
    case 'pais':
      return (tu ? 'Te falta elegir tu país' : 'Le falta elegir su país') + ': se elige en «Verificarme», en Mi cuenta, y el bot '
        + 'pone el rol de ese país en Discord Rap Español.';
    case 'dnac':
      return duelo('nacional', 'de ' + su + ' mismo país');
    case 'dint':
      return duelo('internacional', 'de otro país');
    default:
      return L + ' ' + resto + ' ' + String(et || '').toLowerCase() + '.';
  }
}

/** Qué es cada condición, sin números: para la Guía, que lo explica a quien todavía no jugó */
export function queEs(et, pide) {
  const n = pide || 0;
  switch (tipo(et)) {
    case 'ev':
    case 'part':
      return 'Participar en ' + n + ' ' + plural(n, 'evento', 'eventos') + ' ' + LIGA + ', en la temporada.';
    case 'pais':
      return 'Tener tu país: lo eliges en «Verificarme», en Mi cuenta.';
    case 'dnac':
      return 'Cruzarte con ' + n + ' ' + plural(n, 'rival', 'rivales') + ' de tu mismo país (' + plural(n, 'cruce nacional', 'cruces nacionales') + '): en un 1 contra 1 o en un triple, en la llave de un evento.';
    case 'dint':
      return 'Cruzarte con ' + n + ' ' + plural(n, 'rival', 'rivales') + ' de otro país (' + plural(n, 'cruce internacional', 'cruces internacionales') + '): en un 1 contra 1 o en un triple, en la llave de un evento.';
    default:
      return n + ' ' + String(et || '').toLowerCase();
  }
}

/** La Temporada no pide jugar: sale con el nivel 1 del Pase de rapero (2.41) */
export const pase = (tu) => (tu
  ? 'Sale al llegar al nivel 1 del Pase de rapero: ' + PASE_COMO + ', en la página del Pase.'
  : 'Sale al llegar al nivel 1 del Pase de rapero, ' + PASE_COMO + '.');
export const paseGuia = 'Llegar al nivel 1 del Pase de rapero: ' + PASE_COMO + '.';

/** Verificarse: lo primero que le falta del portón (`nv` del payload: `id`, `pais`, `dra`), en una frase */
export function sinVerificar(nv, tu) {
  if (nv === 'id') {
    return tu ? 'Tu Discord todavía no está vinculado a la Liga: entra con Discord y toca «Verificarme», en Mi cuenta.'
      : 'Su Discord todavía no está vinculado a la Liga: se vincula entrando con Discord, en «Verificarme» (Mi cuenta).';
  }
  if (nv === 'pais') {
    return tu ? 'Te falta elegir tu país: lo eliges en «Verificarme», en Mi cuenta.'
      : 'Le falta elegir su país, en «Verificarme» (Mi cuenta).';
  }
  if (nv === 'dra') {
    return tu ? 'Te falta el rol de Miembro de Discord Rap Español (DRA): en «Verificarme», en Mi cuenta, el bot te mete al servidor y te lo da solo.'
      : 'Le falta el rol de Miembro de Discord Rap Español (DRA): se consigue en «Verificarme», en Mi cuenta.';
  }
  return tu ? 'Te falta verificarte: entra con Discord y toca «Verificarme», en Mi cuenta.'
    : 'Le falta verificarse, en «Verificarme» (Mi cuenta).';
}
// en la Guía va en las cuatro tarjetas: corta, y lo largo queda en «Verificado» de sus palabras
export const verificadoGuia = 'Estar verificado: se hace una vez, en «Verificarme» (Mi cuenta).';
