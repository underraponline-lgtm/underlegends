/* EL MAPA DE LA LIGA — las piezas, sus partes, lo que las une y los recorridos.

   Lo leen `mapa.js` (el dibujo) y dos lugares: `mapa.html`, la versión en vivo
   (sólo para Dlx), y el artifact privado «El mapa de la Liga», que es una foto
   armada con estos MISMOS archivos. Si una pieza cambia, se cambia acá y
   llega a los dos.

   Dlx, 29/09/2026: «Creo que las 2 no?» (el mapa y Serena) y después «1. C»
   (el mapa que se explora como el del reel, y además en vivo).

   ⚠️ Todo lo que dice cada pieza salió del código o de una medición. Los
   números que cambian no se escriben acá: los trae el estado (`mapa.js`).

   Columnas (c): dónde corre. 1 Discord · 2 GitHub Actions · 3 Google Sheets ·
   4 Cloudflare · 5 la gente. `y`: la altura en el mapa ordenado, que también
   dice cada cuánto corre (las franjas de `FRANJAS`).
   `partes`: [id, nombre, texto]. En `escuchar` y `dibujar` el id es el número
   de paso de `bot/pipeline.py`, y así el mapa en vivo sabe cómo salió cada uno. */
window.MAPA_DATOS = {
  COLUMNAS: [
    { c: 1, t: 'DISCORD', s: 'lo que pasa' },
    { c: 2, t: 'GITHUB ACTIONS', s: 'el ciclo · repo público' },
    { c: 3, t: 'GOOGLE SHEETS', s: 'las planillas' },
    { c: 4, t: 'CLOUDFLARE', s: 'lo que se sirve' },
    { c: 5, t: 'LA GENTE', s: 'donde se ve' }
  ],
  FRANJAS: [
    { y0: 58, y1: 222, t: 'CADA MINUTO' },
    { y0: 230, y1: 664, t: 'CADA 30 MINUTOS', s: 'nada de 3 a 11 AM ET' },
    { y0: 672, y1: 850, t: 'CUANDO ALGUIEN PIDE' },
    { y0: 858, y1: 1010, t: '1 VEZ AL DÍA', s: 'o por semana' }
  ],
  KIND: { fuente: 'Fuente', corre: 'Corre', guarda: 'Guarda', gente: 'Gente' },

  N: [
    { id: 'anuncios', c: 1, y: 139, k: 'fuente', t: 'Anuncios', s: 'cada servidor avisa',
      donde: 'Discord · un canal por servidor', cada: 'cuando un servidor anuncia',
      que: 'Cada servidor avisa sus eventos a su manera: «EN 30 MINUTOS», la hora de su país, un póster. 18 de cada 26 eventos se anuncian con 15 minutos o menos, por eso la campana no puede esperar al ciclo.',
      arch: ['bot/anuncios.py', 'bot/cuando.py', 'bot/avisos.js'],
      partes: [['DRA', 'DRA', 'Discord Rap En Español, el servidor principal.'], ['FFA', 'FFA', 'Freestyle For All.'], ['SR', 'Snake Rap', ''], ['URBF', 'Urban Freestyle', ''], ['FFS', 'FFS League', ''], ['DDF', 'Dimensión del Freestyle', '']] },
    { id: 'llaves', c: 1, y: 309, k: 'fuente', t: 'Llaves', s: 'las batallas del evento',
      donde: 'Discord · los canales de llaves', cada: 'mientras se juega',
      que: 'Las batallas de cada evento, con quién ganó. La llave y el anuncio no comparten ninguna clave: se juntan por servidor, fecha y nombre. Si el anuncio trae otro número —pasó con TOKYO VOL 16 y 17—, la llave que ningún anuncio reclamó se asigna por horario.',
      arch: ['bot/llaves_a_entrada.py', 'sheet/llaves_web.py'] },
    { id: 'roles', c: 1, y: 409, k: 'fuente', t: 'DRA', s: 'roles, país y apodo #N',
      donde: 'Discord · el servidor DRA', cada: 'en cada corrida',
      que: 'El servidor principal. El rol de Miembro de DRA y el de país deciden quién pasa el portón y puede tener tarjeta. El ciclo pone el #N del ranking en el apodo; el repo de sync pone el rol de rango.',
      arch: ['bot/autoverificar.py', 'bot/verificados.py', 'herramientas/servidores_de.py', 'herramientas/sincronizar_puesto.py'],
      partes: [['miembro', 'Miembro de DRA', 'El portón: sin este rol no hay tarjeta. Verificado es esto y nada más.'], ['pais', 'rol de país', 'La bandera: identidad, no ranking.'], ['rango', 'rol de rango', 'Los ocho, de SSS a E. Lo pone el repo de sync.'], ['apodo', 'apodo #N', 'El puesto del ranking en el apodo. Lo pone el paso 2b6.']] },
    { id: 'llamada', c: 1, y: 509, k: 'fuente', t: 'La llamada', s: 'voz, sólo en vivo',
      donde: 'Discord · la llamada de voz del servidor', cada: 'sólo con un evento en vivo',
      que: 'Una foto de quién está en la llamada, sin quedarse conectado. Vence a los 3 días y nunca va al repo ni al log. Es pista en ✅ Decidir, y si el nombre de la llave es exactamente el de una sola persona de la llamada que ya está en la Lista, se resuelve solo.',
      arch: ['bot/en_llamada.py', 'sheet/decidir.py'] },
    { id: 'invit', c: 1, y: 609, k: 'fuente', t: 'Invitaciones', s: 'quién entra por la Liga',
      donde: 'Discord · cada servidor', cada: 'en cada corrida',
      que: 'La invitación permanente de la Liga en cada servidor, y cuánta gente entra por ella.',
      arch: ['bot/invitaciones.py', 'datos/invitaciones.json'] },

    { id: 'disparo', c: 2, y: 279, k: 'corre', t: 'Los disparadores', s: ':22 y :52 · de noche no',
      donde: 'GitHub Actions + un cron del Worker', cada: ':22 y :52 · nada de 3 a 11 AM ET',
      que: 'Dos relojes para el mismo ciclo. El de GitHub (:07 y :37) dispara cuando puede: medido, el 11 % de las veces. El del Worker (:22 y :52) es puntual. De 3 a 11 AM ET no corre ninguno: la última corrida es la de las 2:52 y la siguiente la de las 11:22.',
      arch: ['.github/workflows/ciclo.yml', 'bot/madrugada.py', 'bot/desplegar.py'],
      partes: [['gh', 'cron de GitHub', ':07 y :37. Dispara cuando puede: el 11 % de las veces.'], ['cf', 'cron del Worker', ':22 y :52. Puntual: es el que arranca casi todas.'], ['noche', 'la madrugada', 'De 3 a 11 AM ET no corre el ciclo ni mira el vigía.']] },
    { id: 'escuchar', c: 2, y: 389, k: 'corre', t: 'escuchar', s: 'cada 30 min · 2 a 6 min',
      donde: 'GitHub Actions · repo público', cada: 'cada 30 min · tarda de 2 a 6 min',
      que: 'Todo lo que no es dibujar: lee Discord y las planillas, calcula y publica. Al final pregunta qué cambió; si nada, el ciclo termina acá.',
      ojo: 'Si algo se traba, alertar.py le manda un DM a Dlx. Lo normal va al canal de Logs.',
      arch: ['bot/pipeline.py --sin-dibujar', 'bot/que_cambio.py', 'bot/alertar.py'],
      partes: [['0', 'arranque de temporada', 'Sólo el día que arranca una temporada: la fase de prueba se archiva y se vacía.'], ['0b', 'multiplicadores', 'Los de la semana, cada lunes: de ×0,5 a ×5 por servidor.'], ['1', 'llaves → Entrada', 'Las llaves nuevas pasan a Entrada, y de ahí a Resultados, 1v1 y Eventos Procesados.'], ['1c', 'las vitrinas', 'Recalcula el Score y reescribe las vitrinas del Oficial que cambiaron.'], ['1a', 'la cola de /card', 'Quien tiró /card y no está en la Lista queda anotado.'], ['1a2', 'país y Miembro', 'El rol de país y el de Miembro de DRA, solos.'], ['1b', 'quién es quién', 'Quién está verificado y en qué servidores de la Liga, preguntándole a Discord.'], ['1b2', 'la llamada', 'Sólo con un evento en vivo.'], ['2', 'padrón y pools', 'El padrón y los pools de Temporada y Competitivo, desde el Sheet.'], ['2b', 'Most Wanted', ''], ['2b2', 'insignias', ''], ['2b3', 'el Lunes de la Liga', ''], ['2b4', 'precio por cabeza', ''], ['2b5', 'invitaciones', ''], ['2b6', 'el #N del apodo', ''], ['2c', 'la web', 'Arma web:lobby y sube la página si cambió.'], ['2d', '✅ Decidir y AKAs', 'Lo contestado se aplica y se arman los alias.'], ['2e', 'quien se fue', 'Las tarjetas que alguien ya no puede tener, a la semana. A quien sigue en la Lista le quedan la Temporada y la Servidor.'], ['3', 'qué cambió', 'que_cambio.py decide qué cartas quedaron viejas.']] },
    { id: 'dibujar', c: 2, y: 499, k: 'corre', t: 'dibujar', s: 'si algo cambió',
      donde: 'GitHub Actions · repo público', cada: 'sólo si hay cartas viejas',
      que: 'Arma con Playwright cada carta que quedó vieja —y sólo esa— y la sube como .webp. que_cambio.py mira datos y código: medido, redibuja 4 personas en vez de 139. Un cambio de dibujo que le toca a todos espera a la noche, de 12 a 4 AM ET.',
      arch: ['bot/pipeline.py --solo-dibujar', 'bot/subir_cartas.py', 'bot/subir_datos.py', '0N_*/exportar_png.py'],
      partes: [['4', 'las caras', 'Las fotos desde R2 (fotos/t1/).'], ['5', 'dibujar', 'Playwright arma las cartas, por tandas.'], ['5b', 'las Bloqueadas', 'La carta de quien todavía no llega al requisito, con su contador.'], ['6', 'refrescar KV', 'La clave de cada persona apunta a su carta nueva.']] },
    { id: 'repo', c: 2, y: 619, k: 'guarda', t: 'El repo · datos/', s: 'la memoria del ciclo',
      donde: 'GitHub · underlegends, público', cada: 'un commit por corrida',
      que: 'Los dos trabajos terminan guardando datos/: pools, sellos, llaves, lo ya avisado y el estado que lee este mapa. Es la memoria del ciclo, porque cada corrida arranca en una máquina limpia.',
      ojo: 'No se toca datos/ a las :22 ni a las :52: los dos commits lo cambian y el segundo choca.',
      arch: ['bot/ci/guardar.sh', 'datos/'],
      partes: [['pools', 'los pools', 'Temporada y Competitivo, lo que dibujan las cartas.'], ['sellos', 'los sellos', 'Qué carta de quién está dibujada, y con qué datos y código.'], ['llaves', 'llaves_t1.json', 'La llave de cada evento, para «Ver llave».'], ['avisados', 'avisados.json', 'Lo que ya se avisó en Discord, para no repetirlo.'], ['estado', 'estado_*.json', 'Lo que lee este mapa: cómo salió cada paso y las cuotas.']] },
    { id: 'sync', c: 2, y: 905, k: 'corre', t: 'Repo de sync', s: '1 vez al día · rangos',
      donde: 'GitHub Actions · liga-global-sync, otro repo (privado)', cada: '1 vez al día, cuando GitHub puede',
      que: 'El dueño del rol de rango, el apodo y el avatar de la columna F. Pide las 4 AM ET y GitHub lo corre tarde: 8:37 AM el 26/09, 9:29 AM el 27/09 y 12:22 PM el 28/09.',
      ojo: 'El 28/09 a las 12:22 PM ET falló por la cuota de lecturas por minuto de Sheets (429). Desde el 29/09 espera y reintenta en todo pedido, igual que el ciclo (Dlx: «A»).',
      arch: ['liga-global-sync · sync.py'],
      partes: [['backfill', 'backfill', 'Los Discord ID del canal-log.'], ['akaops', 'akaops', 'Los alias de -addaka.'], ['sync', 'sync', 'El ✅ de la Lista y el puente al Oficial.'], ['avatars', 'avatars', 'La foto de la columna F.'], ['roles', 'roles', 'El rol de rango.'], ['nicks', 'nicks', 'El apodo.'], ['audit', 'audit', 'La salud de las identidades. Nunca escribe.']] },
    { id: 'audit', c: 2, y: 975, k: 'corre', t: 'Auditoría', s: 'lunes 9 AM · y cada push',
      donde: 'GitHub Actions · repo público', cada: 'lunes 9 AM ET · y en cada push',
      que: 'La auditoría semanal revisa lo que se desfasa sin avisar: los roles de rango, los workflows, que Python y JS lean igual, los requisitos. Los chequeos corren en cada push que toca código.',
      arch: ['.github/workflows/auditoria.yml', '.github/workflows/chequeos.yml'],
      partes: [['verificar', 'verificar.py', ''], ['rangos', 'roles de rango', '¿Siguen siendo ocho en DRA?'], ['wf', 'workflows válidos', 'Que los .yml valgan para GitHub y no sólo para PyYAML.'], ['jspy', 'Python y JS leen igual', 'El lector de anuncios vive en los dos.'], ['req', 'los requisitos', '']] },

    { id: 'operativo', c: 3, y: 277, k: 'guarda', t: 'Sheet Operativo', s: 'Entrada · Lista · ✅',
      donde: 'Google Sheets', cada: 'lo lee y lo escribe cada corrida',
      que: 'Los datos crudos y la identidad: Entrada (las llaves cargadas), Resultados, 1v1, Eventos Procesados, la Lista de Raperos, AKAs, Pendientes y ✅ Decidir.',
      ojo: 'Google cuenta las lecturas por minuto y por cuenta. Un 429 no es una falla, es un «ahora no»: el ciclo y el sync esperan y reintentan.',
      arch: ['sheet/procesar_entrada.py', 'sheet/escribir.py', 'sheet/pendientes.py', 'sheet/decidir.py'],
      partes: [['entrada', 'Entrada', 'Las llaves recién cargadas, antes de procesarse.'], ['resultados', 'Resultados', 'Rapero, puesto, puntos y MW de cada evento.'], ['1v1', '1v1', 'Cada duelo: quién contra quién y quién ganó.'], ['eventos', 'Eventos Procesados', 'Cada evento cargado, con servidor, fecha y escala.'], ['lista', 'Lista de Raperos', 'El padrón: nombre, país, Discord ID.'], ['akas', 'AKAs', 'Los alias de cada uno.'], ['pendientes', 'Pendientes', 'Lo que el ciclo no pudo resolver solo.'], ['decidir', '✅ Decidir', 'Las preguntas para Dlx, armadas desde Pendientes.'], ['config', 'Config', 'Los puntos por puesto de cada escala.'], ['consola', 'Consola', 'La temporada activa.']] },
    { id: 'oficial', c: 3, y: 349, k: 'guarda', t: 'Sheet Oficial', s: 'las vitrinas',
      donde: 'Google Sheets', cada: 'se reescribe sólo si cambió',
      que: 'La vitrina: Temporada, Competitivo, Podios, Duelos y Mundial. Cero fórmulas: el Score y los rankings los calcula el ciclo y se pegan como texto.',
      arch: ['sheet/rankings.py', 'sheet/competitivo.py', 'sheet/estilo.py'],
      partes: [['temporada', 'Ranking Temporada', ''], ['competitivo', 'Ranking Competitivo', 'Nadie aparece hasta tener 10 eventos.'], ['podios', 'Ranking Podios', ''], ['duelos', 'Ranking Duelos', ''], ['mundial', 'Ranking Mundial', 'Los países, por los puntos de su gente.']] },

    { id: 'vigia', c: 4, y: 107, k: 'corre', t: 'El vigía', s: 'cada minuto',
      donde: 'Cloudflare · un cron del Worker', cada: 'cada minuto · duerme de 3 a 11 AM ET',
      que: 'Lee los anuncios y las llaves en vivo. Cuando aparece algo nuevo lo anota una sola vez y manda la campana. No es parte del ciclo porque 30 minutos llegan tarde para un evento anunciado con 15.',
      arch: ['bot/avisos.js', 'bot/worker.js'] },
    { id: 'do', c: 4, y: 179, k: 'guarda', t: 'Durable Object', s: 'SQLite · avisos y votos',
      donde: 'Cloudflare · Durable Object con SQLite', cada: 'cuando el vigía o alguien escribe',
      que: 'Una base chica adentro de Cloudflare: las suscripciones de la campana, lo ya avisado, los votos, la billetera y los precios de la Tienda, a quién sigue cada uno, el servidor que cada uno elige, las sesiones y lo que está en vivo. El Worker también la usa para votar, seguir y comprar.',
      arch: ['bot/avisos.js'],
      partes: [['subs', 'subs', 'Quién se anotó a la campana, y a qué servidores.'], ['avisos', 'avisos', 'Lo ya avisado: cada anuncio sale una sola vez.'], ['vivo', 'vivo', 'Lo que se está jugando ahora.'], ['inscritos', 'inscritos', 'Las inscripciones que vio el vigía.'], ['votos', 'votos', 'Uno por persona, en cada encuesta.'], ['tienda', 'tienda', 'La billetera de Puntos de Tienda.'], ['precios', 'precios', 'El precio por cabeza.'], ['sigue', 'sigue', 'A quién sigue cada uno.'], ['servidor', 'servidor', 'El servidor que eligió cada uno.'], ['sesiones', 'sesiones', ''], ['reportes', 'reportes', 'Los errores en llaves que avisó la gente.'], ['posts', 'posts', ''], ['claves', 'claves', ''], ['estado', 'estado', ''], ['hechos', 'hechos', ''], ['veredictos', 'veredictos', '']] },
    { id: 'r2', c: 4, y: 499, k: 'guarda', t: 'R2', s: 'las cartas y las fotos',
      donde: 'Cloudflare R2 · público', cada: 'lo escribe dibujar',
      que: 'Las cartas como .webp (<clave>/<carta>.webp) y las fotos congeladas por temporada (fotos/t1/). Es público a propósito: /card le pasa a Discord la URL tal cual y la página muestra las mismas.',
      arch: ['bot/subir_cartas.py', 'bot/fotos.py'],
      partes: [['cartas', 'las cartas', '<clave>/<carta>.webp: temporada, competitivo, servidor, país.'], ['fotos', 'fotos/t1/', 'La cara de cada uno, congelada por temporada.']] },
    { id: 'kv', c: 4, y: 619, k: 'guarda', t: 'KV', s: 'quién es quién',
      donde: 'Cloudflare KV', cada: 'lo escribe el ciclo, lo lee el Worker',
      que: 'Una clave por persona (p:<clave>) y su índice por Discord ID (d:<id>), el sello de la corrida (meta), la web ya armada (web:lobby, web:muro, web:ics), las encuestas, los precios y la llamada (voz:<SV>).',
      ojo: 'Es la cuota que ya se acabó dos veces (17/09 y 24/09). Desde entonces subir_datos.py se frena en 850 y deja lo que no entra para la corrida siguiente, así la web siempre tiene lugar.',
      arch: ['bot/subir_datos.py', 'bot/subir_web.py', 'bot/cuotas.py'],
      partes: [['p', 'p:<clave>', 'Una por persona: nombre, servidores, qué cartas tiene.'], ['d', 'd:<id>', 'El índice que hace que /card sepa quién sos.'], ['meta', 'meta', 'El sello de la corrida y los requisitos.'], ['lobby', 'web:lobby', 'La portada de la página, ya armada.'], ['muro', 'web:muro', 'Publicaciones.'], ['ics', 'web:ics', 'El calendario.'], ['llaves', 'web:llaves', ''], ['perfiles', 'web:perfiles', ''], ['encuestas', 'encuestas', 'Qué se vota y hasta cuándo.'], ['precios', 'precios', ''], ['voz', 'voz:<SV>', 'La llamada: vence a los 3 días.'], ['cfg', 'cfg:<guild>', 'Los ajustes de /settings de cada servidor.']] },
    { id: 'worker', c: 4, y: 729, k: 'corre', t: 'Worker', s: '/card · /api',
      donde: 'Cloudflare Workers · liga-global-bot', cada: 'cuando alguien pide',
      que: 'Contesta los comandos de Discord (/card, /versus, /numeral, /foto, /settings) y la /api de la página. Nunca lee el Sheet: sólo KV, R2 y el Durable Object. Tiene dos crons: el vigía y el disparador del ciclo.',
      ojo: 'El límite que manda son los 10 ms de CPU por pedido, no los 100.000 pedidos: por eso no calcula nada y sólo sirve lo ya armado.',
      arch: ['bot/worker.js', 'bot/desplegar.py', 'bot/cuotas.py'],
      partes: [['card', '/card', 'Tu carta.'], ['versus', '/versus', 'Dos cartas frente a frente.'], ['numeral', '/numeral', 'El # en tu apodo.'], ['foto', '/foto', 'Cambiar tu foto, una vez por temporada.'], ['settings', '/settings', 'Los ajustes de cada servidor.'], ['lobby', '/api/lobby', 'Reenvía web:lobby tal cual.'], ['cuenta', '/api/cuenta', 'Entrar con Discord: pregunta quién sos y tira el permiso.'], ['ics', '/calendario.ics', 'El calendario para Google, Apple y Outlook.'], ['cron1', 'cron :22 y :52', 'Dispara el ciclo.'], ['cron2', 'cron del vigía', 'Cada minuto.']] },
    { id: 'pages', c: 4, y: 809, k: 'guarda', t: 'Pages', s: 'la página, gratis',
      donde: 'Cloudflare Pages', cada: 'se sube cuando la página cambia',
      que: 'underlegends.pages.dev: HTML, CSS, JS e imágenes, gratis e ilimitados, sin tocar el Worker. Lo único que pasa por el Worker es /api (el lobby, la cuenta, los votos), que _worker.js le reenvía.',
      arch: ['bot/paginas/', 'bot/paginas/_worker.js', 'bot/paginas_subir.py'],
      partes: [['inicio', 'Inicio', ''], ['ranking', 'Ranking', 'Siete rankings en una tabla.'], ['tarjetas', 'Tarjetas', ''], ['pase', 'Pase', 'Próximamente.'], ['tienda', 'Tienda', 'Puntos de Tienda y el precio por cabeza.'], ['eventos', 'Eventos', 'El calendario y la campana.'], ['publicaciones', 'Publicaciones', 'El muro de la Liga.'], ['mundo', 'Mundo', ''], ['guia', 'Guía', '']] },

    { id: 'tel', c: 5, y: 143, k: 'gente', t: 'La campana', s: 'el aviso al minuto',
      donde: 'el teléfono o la compu de cada uno', cada: 'al minuto de un anuncio',
      que: 'Quien se anota en la página recibe el aviso aunque la tenga cerrada. Es push cifrado con las claves VAPID, que no se rotan con los demás tokens: las suscripciones quedan atadas a ellas.',
      arch: ['bot/paginas/campana.js', 'bot/paginas/sw.js', 'bot/avisos.js'] },
    { id: 'dlx', c: 5, y: 277, k: 'gente', t: 'Dlx', s: '✅ Decidir · alertas',
      donde: 'Discord y el Sheet', cada: 'cuando el ciclo pregunta',
      que: 'Contesta ✅ Decidir: los nombres que el ciclo no puede reconocer solo. Recibe un DM sólo si algo se traba; lo normal va al canal de Logs. El bot no le manda DMs a nadie más.',
      arch: ['sheet/decidir.py', 'bot/alertar.py'] },
    { id: 'card', c: 5, y: 729, k: 'gente', t: '/card', s: 'la carta en Discord',
      donde: 'Discord · cualquier servidor con el bot', cada: 'cuando alguien lo pide',
      que: 'Alguien tira /card: el Worker busca su Discord ID en KV y le pasa a Discord la URL de la carta en R2. En ese momento no se dibuja nada: la carta ya está hecha.',
      arch: ['bot/worker.js'] },
    { id: 'web', c: 5, y: 809, k: 'gente', t: 'La página', s: 'underlegends.pages.dev',
      donde: 'el navegador de quien mira', cada: 'cuando alguien la abre',
      que: 'Ranking, tarjetas, eventos, tienda, publicaciones. Buscar, filtrar, ordenar y comparar lo hace el navegador de quien mira: ordenar 200 filas ahí no le cuesta nada a la Liga. Entrar con Discord no guarda ningún permiso.',
      arch: ['bot/paginas/app.js', 'bot/subir_web.py'] }
  ],

  /* de quien escribe a donde se escribe; `dos`: lee y escribe */
  E: [
    { a: 'anuncios', b: 'vigia', l: 'cada minuto' },
    { a: 'vigia', b: 'do', l: 'lo nuevo, una sola vez' },
    { a: 'do', b: 'tel', l: 'push cifrado' },
    { a: 'anuncios', b: 'escuchar', l: '1c · anuncios.py' },
    { a: 'llaves', b: 'escuchar', l: '1 · llaves_a_entrada.py' },
    { a: 'roles', b: 'escuchar', l: '1a2 · 1b lee · 2b6 pone el #N', dos: true },
    { a: 'llamada', b: 'escuchar', l: '1b2 · una foto' },
    { a: 'invit', b: 'escuchar', l: '2b5 · cuántos entran' },
    { a: 'disparo', b: 'escuchar', l: 'arranca' },
    { a: 'escuchar', b: 'operativo', l: 'lee y escribe', dos: true },
    { a: 'escuchar', b: 'oficial', l: '1c · las vitrinas' },
    { a: 'escuchar', b: 'dibujar', l: 'si algo cambió' },
    { a: 'escuchar', b: 'kv', l: '2b · 2c · lo ya armado' },
    { a: 'escuchar', b: 'pages', l: '2c · si la página cambió' },
    { a: 'escuchar', b: 'repo', l: 'guardar.sh' },
    { a: 'dibujar', b: 'repo', l: 'guardar.sh' },
    { a: 'dibujar', b: 'r2', l: '4 · las caras · 5 · las cartas', dos: true },
    { a: 'dibujar', b: 'kv', l: '6 · p: · d: · meta' },
    { a: 'worker', b: 'disparo', l: ':22 y :52' },
    { a: 'kv', b: 'worker', l: 'lee' },
    { a: 'worker', b: 'do', l: 'votos · seguir · tienda', dos: true },
    { a: 'worker', b: 'card', l: 'contesta', dos: true },
    { a: 'r2', b: 'card', l: 'la imagen' },
    { a: 'pages', b: 'worker', l: '/api', dos: true },
    { a: 'pages', b: 'web', l: 'gratis', dos: true },
    { a: 'r2', b: 'web', l: 'las tarjetas' },
    { a: 'operativo', b: 'dlx', l: '✅ Decidir', dos: true },
    { a: 'sync', b: 'operativo', l: 'la Lista · el avatar', dos: true },
    { a: 'sync', b: 'roles', l: 'rango · apodo' }
  ],

  REC: [
    { id: 'evento', t: 'Se juega un evento', pasos: [
      ['llaves>escuchar', 'Las batallas quedan en Discord. En la próxima corrida —a las :22 o :52— escuchar las carga en Entrada.'],
      ['escuchar>operativo', 'Pasan a Resultados y 1v1, y el evento queda en Eventos Procesados.'],
      ['escuchar>oficial', 'Se recalcula el Score y se reescriben las vitrinas que cambiaron.'],
      ['escuchar>dibujar', 'que_cambio.py marca qué cartas quedaron viejas. Si hay alguna, arranca dibujar.'],
      ['dibujar>r2', 'Playwright arma esas cartas y las sube a R2 como .webp.'],
      ['dibujar>kv', 'KV se refresca: la clave de cada persona apunta a su carta nueva.'],
      ['kv>worker', 'El próximo /card ya la muestra.']] },
    { id: 'anuncio', t: 'Un servidor anuncia', pasos: [
      ['anuncios>vigia', 'Un servidor publica el anuncio. El vigía lo ve dentro del minuto.'],
      ['vigia>do', 'El Durable Object lo anota una sola vez, así nadie recibe dos avisos.'],
      ['do>tel', 'La campana suena en el teléfono o la compu de quien se anotó.']] },
    { id: 'card', t: 'Alguien tira /card', pasos: [
      ['worker>card', 'Alguien tira /card en cualquier servidor donde está el bot.'],
      ['kv>worker', 'El Worker busca su Discord ID (d:<id>) y su ficha (p:<clave>) en KV: menos de 1 ms.'],
      ['r2>card', 'Contesta con la URL de la carta en R2, y Discord la trae de ahí.']] },
    { id: 'pagina', t: 'Alguien abre la página', pasos: [
      ['pages>web', 'El navegador baja la página de Pages: gratis e ilimitado.'],
      ['pages>worker', 'Pide /api/lobby, que pasa por el Worker.'],
      ['kv>worker', 'El Worker reenvía web:lobby de KV tal cual, sin armar nada.'],
      ['r2>web', 'Las tarjetas llegan directo de R2. Ordenar y comparar lo hace el navegador.']] },
    { id: 'nombre', t: 'Un nombre que no se reconoce', pasos: [
      ['llaves>escuchar', 'En una llave aparece un nombre que no está en la Lista.'],
      ['escuchar>operativo', 'El ciclo lo anota en Pendientes y arma la pregunta en ✅ Decidir, con pistas.'],
      ['llamada>escuchar', 'Una pista: quién estaba en la llamada mientras se jugaba.'],
      ['operativo>dlx', 'Si el nombre es exacto de una sola persona de la llamada que ya está en la Lista, se resuelve solo. Si no, contesta Dlx.'],
      ['escuchar>operativo', 'La corrida siguiente guarda la respuesta como alias, y ese nombre ya no vuelve a preguntarse.']] }
  ]
};
