// 🧭 EL TUTORIAL NUEVO: QUÉ SEÑALA CADA PASO (13/11/2026). Dlx: «remakear también el tutorial para nuevos usuarios… no
// solo en el inicio sino en general… un tutorial corto y la opción de tener un tutorial más completo», y a la maqueta,
// «el completo en la guía tmb». Acá viven los textos y a qué apunta cada paso; lo que se dibuja, en tutorial.jsx.
//
// 🎯 Y A ALGO CHICO (19/11/2026): una marca sobre una sección entera deja el velo sin nada que tapar y no se nota qué se
// señala. `sel` puede ser una lista: la primera marca que esté en esa pantalla (el celular y la compu no dibujan lo mismo).
//
// 🔑 CADA PASO APUNTA A UN `data-tuto`, NO A UN LINK NI A UNA CLASE. El recorrido de antes buscaba el link del menú por
// su `href`, y cuando el menú pasó a tener listas (Ranking, Eventos, Comunidad) tres de sus cuatro pasos dejaron de
// encontrar nada sin que nada fallara: la caja salía flotando. Una clase tampoco sirve: se renombra por estilo. El
// `data-tuto` existe sólo para esto, y `herramientas/tuto_marcas.py` (en CI) avisa si un paso apunta a uno que ya no
// está en ninguna página. Si no se encuentra en la pantalla (no se dibujó para esa persona), la caja sale al centro.
//
// Este archivo es chico a propósito: lo leen la Guía y el «¿Cómo funciona?» de cada página, que no bajan el tutorial.

//: 🏃 el corto: cinco pasos en el Inicio (`sel` es el `data-tuto`; `pSin`, el texto para quien no entró con Discord)
export const CORTO = [
  { sel: 'historias', k: 'LAS HISTORIAS', h: 'Lo nuevo de cada lado',
    p: 'Lo que pasó en cada servidor, en tu país, en tu crew y con la gente que sigues. El aro magenta: tienes algo sin ver.' },
  // (19/11/2026: el escenario del Inicio ya no es «el evento de hoy» sino una tira de momentos; se señala la tira)
  { sel: ['hoy-tira', 'hoy'], k: 'LO DE AHORA', h: 'Lo que pasa ahora',
    p: 'Lo que se juega en vivo, lo próximo, el Most Wanted y lo nuevo de la Liga, uno por uno. Toca uno de la tira para verlo.' },
  { sel: 'menu-ranking', k: 'EL RANKING', h: 'Un solo ranking',
    p: 'Juega un evento en cualquier servidor de la Liga y ya entras. Acá están todas las tablas: Temporada, Competitivo, Duelos y más.' },
  { sel: 'campana', k: 'LA CAMPANA', h: 'Que no se te pase',
    p: 'Te avisa al minuto cuando un servidor anuncia un evento, y cuando alguien te sigue, te felicita o te reta.' },
  { sel: 'cuenta', k: 'TU CUENTA', h: 'Todo lo tuyo, en tu cara',
    p: 'Tu inventario, tu perfil, el Pase rapero y la Tienda. Si manejas un servidor, también su panel.',
    pSin: 'Entra con Discord y tienes tu perfil, tus avisos, el Pase rapero y la Tienda. Es gratis y tarda diez segundos.' },
];

//: 📖 el completo: nueve capítulos de un minuto, cada uno en su página (`pag`: las páginas donde su «¿Cómo funciona?» lo abre)
export const CAPITULOS = [
  { id: 'ranking', ruta: '#/ranking', pag: ['ranking'], t: 'La Liga y el ranking', d: 'Qué es, quién juega y cómo se suma: las tablas y tu puesto.',
    linea: 'Juega un evento en cualquier servidor de la Liga y ya entras: cada puesto suma a tu Temporada.',
    pasos: [
      { sel: 'rk-cab', k: 'EL RANKING', h: 'Las tablas de la temporada', p: 'Juega un evento en cualquier servidor de la Liga y ya entras. Cada puesto suma puntos a tu Temporada.' },
      { sel: 'rk-tablas', k: 'LAS TABLAS', h: 'Cada una mide algo', p: 'Temporada es lo que sumaste; Competitivo, qué tan bien juegas (desde 10 eventos); y también Duelos, Podios, Rachas, Países y Crews.' },
      { sel: ['rk-buscar', 'rk-tabla'], k: 'TU PUESTO', h: 'Búscate', p: 'Escribe tu nombre y te encuentra. En la tabla, toca una columna para ordenar y un nombre para abrir su perfil y sus tarjetas.' },
    ] },
  { id: 'eventos', ruta: '#/eventos', pag: ['eventos'], t: 'Eventos y la campana', d: 'El calendario de todos los servidores y el aviso al minuto.',
    linea: 'Cada servidor anuncia sus eventos unos 15 minutos antes: con la campana te llega al minuto.',
    pasos: [
      { sel: 'ev-cab', k: 'EVENTOS', h: 'El calendario de todos', p: 'Lo que se juega en la Liga, con el color de cada servidor. Juegas en el Discord de ese servidor.' },
      { sel: 'ev-dias', k: 'DÍA POR DÍA', h: 'Un punto por evento', p: 'Toca un día para ver qué se juega, a qué hora en la tuya y de qué servidor.' },
      { sel: 'ev-campana', k: 'LA CAMPANA', h: 'Que te llegue al minuto', p: 'Los eventos se anuncian con poco tiempo. Actívala y te avisa, también en el teléfono.' },
    ] },
  { id: 'tarjetas', ruta: '#/tarjetas', pag: ['tarjetas'], t: 'Tus tarjetas', d: 'Las cuatro cartas, qué mide cada una y cómo se consiguen.',
    linea: 'La de Servidor sale al verificarte; la de Temporada, con el nivel 1 del Pase.',
    pasos: [
      { sel: 'tj-album', k: 'TU ÁLBUM', h: 'Tus números, en una carta', p: 'Temporada, Competitiva, Servidor y País, con tus números de verdad. La de Servidor sale al verificarte y la de Temporada con el nivel 1 del Pase.' },
      { sel: 'tj-gal', k: 'LAS DE TODOS', h: 'Busca a cualquiera', p: 'Las tarjetas de toda la Liga, por tipo. Toca una para verla grande y compartirla.' },
      { sel: 'tj-cmp', k: 'COMPARAR', h: 'Una al lado de la otra', p: 'Elige dos raperos y compara sus tarjetas número por número.' },
    ] },
  { id: 'pase', ruta: '#/pase', pag: ['pase'], t: 'El Pase de rapero', d: 'Premios, Tareas y Premium: subir de nivel sin jugar.',
    linea: 'Subes de nivel con Tareas, sin necesidad de jugar. Cada nivel trae un premio, y el 1 abre tu carta de Temporada.',
    pasos: [
      { sel: 'ps-cab', k: 'EL PASE', h: 'Tu nivel', p: 'Con tu cuenta ves tu nivel y tu XP. Es de los Miembros de Discord Rap Español: verifícate y empieza a subir.' },
      { sel: 'ps-pista', k: 'LA GIRA', h: 'Un premio por nivel', p: 'Cinco fechas de diez niveles: la plaza, el bar, el club, el teatro y el estadio. Gratis arriba; los de Premium llevan candado hasta que lo tengas.' },
      { sel: 'ps-tabs', k: 'DETRÁS DEL SHOW', h: 'El setlist, el backstage y el Salón', p: 'El setlist son tus Tareas, lo que te da XP: diarias, semanales y de temporada. El backstage, el Premium: la otra fila de premios. El Salón, los que más lejos llegaron.' },
    ] },
  { id: 'tienda', ruta: '#/tienda', pag: ['tienda'], t: 'La Tienda', d: 'Los Puntos de Tienda: probarte y comprar lo tuyo, y el precio por cabeza.',
    linea: 'Arrancas con 5.000 Puntos de Tienda: pruébate lo que quieras y compra lo que te guste.',
    pasos: [
      { sel: 'tz-vitrina', k: 'LA VITRINA', h: 'Lo de la semana', p: 'Piezas que sólo están acá y vuelven cada tanto, ya puestas en ti para que veas cómo te quedan.' },
      { sel: ['tz-piezas', 'tz-probador'], k: 'EL PROBADOR', h: 'Pruébate todo', p: 'Toca una pieza y te la pones. Compras sólo lo que te guste, y si no te la pusiste la puedes deshacer en 24 horas.' },
      { sel: 'tz-mas', k: 'MÁS CON TUS PUNTOS', h: 'Precio por cabeza y más', p: 'Ponle precio a alguien: el primero que le gane en un evento se lleva los Puntos. También tu promo y tu crew.' },
    ] },
  { id: 'crews', ruta: '#/crews', pag: ['crews', 'crew'], t: 'Crews', d: 'Armar la tuya o sumarte, los roles y los tiers.',
    linea: 'Una crew suma los puntos de su gente: súmate a una o arma la tuya.',
    pasos: [
      { sel: 'crw-cab', k: 'CREWS', h: 'Tu gente', p: 'Un grupo de raperos que suma sus puntos. Tiene Líder, Colíder, Veteranos y Miembros.' },
      { sel: 'crw-todas', k: 'SÚMATE', h: 'O arma la tuya', p: 'Busca una y pide entrar. Para armar una hace falta estar verificado y 2.500 Puntos de Tienda.' },
      // (los tiers en escalera sólo se ven con «Cómo funciona» abierto: si no, la tabla de la semana, que los muestra por crew)
      { sel: ['crw-tiers', 'crw-semana'], k: 'LOS TIERS', h: 'De Bronce a Leyenda', p: 'La tabla de la semana, por tier. Cada lunes la crew sube o baja según lo que jugó su gente esa semana.' },
    ] },
  { id: 'competencias', ruta: '#/competencias', pag: ['competencias', 'ligas'], t: 'Competencias y ligas', d: 'La Copa, la Liga de 10, la Rapid y las ligas de cada servidor.',
    linea: 'Cada semana hay Copa, Rapid y mini eventos, y las ligas de 10 corren toda la temporada.',
    pasos: [
      { sel: 'cm-cab', k: 'LA SEMANA', h: 'Lo de esta semana', p: 'Tu liga, tu Copa y tu Rapid: cómo vas, o lo que te falta para entrar. Toca la Copa o la Rapid para ver tu llave.' },
      // (18/11/2026: «a las 11 AM» sin zona se leía como hora local, y es la del este; como competencias.jsx y la Guía)
      { sel: 'cm-dias', k: 'EL CIERRE', h: 'Cuánto falta', p: 'Qué día de la semana va y cuánto falta para el próximo cierre. Las jornadas de las ligas cierran lunes, miércoles y viernes a las 11 AM (hora del este).' },
      { sel: 'cm-ligas', k: 'LAS LIGAS', h: 'Ligas de 10', p: 'Tres jornadas por semana y nueve por temporada. Los dos primeros suben de división.' },
    ] },
  { id: 'publicaciones', ruta: '#/publicaciones', pag: ['publicaciones'], t: 'Publicaciones e historias', d: 'Felicitar, comentar y seguir lo que pasa.',
    linea: 'Lo que pasa en la Liga: felicita un logro y a quien felicitas le llega el aviso.',
    pasos: [
      { sel: 'pb-cab', k: 'PUBLICACIONES', h: 'Lo que pasa en la Liga', p: 'Campeones, rangos nuevos y los anuncios de cada servidor. Felicita un logro y le llega el aviso.' },
      { sel: 'pb-fil', k: 'FILTRA', h: 'Lo que te interesa', p: 'Por tipo de publicación o por servidor.' },
      { sel: 'pb-encs', k: 'ENCUESTAS', h: 'Vota las de la semana', p: 'Votarlas todas te da un cofre de Dragón Drops.' },
    ] },
  { id: 'cuenta', ruta: '#/cuenta', pag: ['cuenta'], t: 'Tu cuenta y verificarte', d: 'Tu perfil, tu foto, tus redes y el rol de Miembro.',
    linea: 'Verifícate en Discord Rap Español con tu país: se abre tu tarjeta de Servidor y puedes comentar.',
    pasos: [
      { sel: 'cu-nav', k: 'TU CUENTA', h: 'Todo lo tuyo', p: 'Tu perfil, tu foto, tus redes, los avisos y los ajustes, en un solo lugar.' },
      { sel: ['cu-pasos', 'cu-entrar', 'cu-quien', 'cu-parte'], k: 'VERIFÍCATE', h: 'El rol de Miembro', p: 'En Discord Rap Español, con tu país. Se abre tu tarjeta de Servidor, el Pase rapero y los comentarios.' },
    ] },
];

/** El capítulo de una página (su «¿Cómo funciona?»), o `null` */
export const capituloDe = (pagina) => CAPITULOS.find((c) => c.pag.includes(pagina)) || null;
