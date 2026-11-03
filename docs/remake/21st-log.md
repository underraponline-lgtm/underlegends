# Lo que se trajo de 21st

CLAUDE.md: *«21st: buscar sí, traer código NO sin el OK de Dlx»*. `search`, `search_picker`, `get_inspiration`,
`get_theme` y `search_logo` son gratis; `get_component`, `21st get`, `21st add` y `npx shadcn add https://21st.dev/r/…`
gastan de 2 por día. Cada copia de código se anota acá, con el OK de Dlx que la autorizó. Las búsquedas que sólo dieron
ideas también, para saber de dónde salió cada cosa.

## 19/10/2026 · los thumbnails de cada página (sólo búsquedas, 0 del cupo)

`search` por «open graph social share card», «leaderboard ranking podium», «team roster crest badge grid» y «event ticket
calendar card». Sirvieron como idea, no como código: «Rank Bars» (fila héroe acentuada + barras) para el Ranking, «Admit
One Ticket» (talón perforado) para Eventos, la grilla de insignias para las Crews y «Social Post Card» para
Publicaciones. Lo dibujado está en `herramientas/banner_paginas.py`, todo HTML y CSS nuestro.

## 19/10/2026 · «Vos»: Mi cuenta, Mi perfil y Ajustes en una sola página (sólo búsquedas, 0 del cupo)

`search` por «account settings page sidebar navigation profile», «user profile hub gamer stats card tabs mobile» y
«settings list grouped sections mobile app». Dos patrones que se repiten: la cabecera de identidad («Profile Card») y la
lista agrupada de ajustes («Settings Sidebar Layout», «Settings Sidebar Accordion», «Vertical Settings Tabs»). Se
llevaron a una maqueta con dos opciones (A: una página; B: perfil + ajustes) y Dlx eligió A. Lo hecho está en
`web/src/cuenta.jsx` (`grupos()`, `Quien`), todo nuestro.

## 19/10/2026 · una pasada por todas las páginas (sólo búsquedas, 0 del cupo)

Dlx: «quiero que veas cada página para remakear con los diseños que vayamos viendo del 21st». Doce búsquedas, una por
página; lo que sirvió como idea: Ranking → «Leaderboard Table» (medallas al top 3, movimiento semanal ▲▼) y «Rank Bars»
(barras contra el #1); Eventos → «Activity Timeline» (agenda por día con riel) y «Event Countdown Card»; Guía → «Table of
Contents» (índice que sigue el scroll); Tarjetas → «Card Hand Gallery» (las tuyas en mano) y «Glow Card Grid»; Perfil →
«Stats cards with progress»; Publicaciones → «Activity Feed» por día; Socios → «Pixel Logo Grid» (apagados, color al
tocar); Salón → «Award» (placas). Nada para la Llave ni la Tienda. Ningún código traído; lo que se haga se anota acá.

## 19/10/2026 · la pasada ancha, por piezas y no por páginas (sólo búsquedas, 0 del cupo)

Dlx: «¿estás seguro que sacaste todo eso de 21st? ¿algo más que puedas sacar?». Dieciocho búsquedas más, por pieza, y
`get_inspiration` con la descripción del hub. **Plantillas**: ninguna de esports, ligas ni comunidades (las tres
búsquedas, vacías). **Temas**: nada por «dark neon magenta» (y ya tenemos paleta). Lo que sirvió como idea:

- Enganche: «Habit Tracker Calendar» y «Activity Heatmap» (la racha como calendario; los días que jugaste, como grilla),
  «Achievement List / Unlocked / badge locked» (insignias con estado y el «¡desbloqueaste!» al momento), «Sprint Task
  Checklist» (las Tareas del Pase con festejo al completar), «Circle Progress» (el nivel como anillo en la foto),
  «Onboarding Steps with Progress» (el «¿primera vez?» como checklist).
- Navegación: «Notification Panel» (la campana por día y por tipo, visto ≠ atendido), «Chip Group» (filtros con «+N»),
  «Command Search» (el buscador con ejemplos que se tipean solos), «Empty» (los «no hay nada» con qué hacer).
- Datos de un vistazo: «Sparkline» (tendencia al lado del número), «Avatar Stack» (quiénes van / están), «Status» con
  punto que late (EN VIVO), «Leaderboard Card» (el top 3), «Us vs Them» (el versus por categorías), «World Map» (SVG).
- No aplica: «Shader Metal», «3D Globe», «Country Flags Globe», «ASCII Swirl» (WebGL pesado para Android; el remake
  prohíbe blur y degradés) y «Bottom Nav Bar» con píldora (la barra de abajo va limpia: Dlx, 03/10 y 17/10).

## 20/10/2026 · «Vos», la página real como la maqueta (3.78)

- Lo que se había tomado de 21st para la maqueta de «Vos» (Profile Card + Settings Sidebar como lista de teléfono)
  pasó a `css/cuenta.css`: tarjeta de identidad con borde de color y línea de estado, filas en cajas con cuadradito de
  ícono. Sin búsquedas nuevas: es la maqueta del 19/10 aplicada.

## 20/10/2026 · «Tu cuenta» en la compu (3.79), y la regla de los dos anchos

- La maqueta de «Vos» era sólo de teléfono y la compu quedó con la vista vieja; Dlx: «make sure all these page
  redesigns are also for the PC». Desde acá **cada maqueta trae su versión de compu** y se mide en los dos anchos.
- En la compu, el «Settings Sidebar» de 21st es literal: la lista en cajas a la izquierda es el menú; las tarjetas a
  la derecha en dos columnas (lo que Dlx pidió el 02/10). La página pasa a llamarse «Tu cuenta».

## 20/10/2026 · la racha como calendario y los días que jugó (3.80; sólo búsquedas, 0 del cupo)

- Dlx: «utiliza los nuevos conectores que te hice instalar». 21st, dos búsquedas: «Habit Tracker Calendar» (calendario
  mensual con los días hechos marcados y **cuántos van**: de ahí el «15 de 35 días» al lado de la grilla), «GitHub
  Activity Grid» (un solo tooltip que se desliza entre días y un *reveal* que ondula desde hoy: anotado, no puesto —el
  remake prohíbe animar por animar—), «Activity Heatmap Calendar» (resalta **el día de la semana que más pesa**: de ahí
  el «más los sábados» del perfil). Magic UI: sólo progresos circulares (ya tenemos el anillo). shadcn: sin registro
  configurado, nada. Ningún código traído: la grilla es `GrillaDias` en piezas.jsx, CSS propio.

## 21/10/2026 · Eventos (3.91; 17 búsquedas, 0 del cupo)

- Dlx, a la primera maqueta con 3 búsquedas: «¿Por qué buscaste 2 o 3? Puedes buscar más, tómate tu tiempo». Desde acá,
  15 o más por página, una por pieza.
- Tomado: «Timeline» y «Calendar With Event List» (la agenda del día como línea de tiempo), «Calendar with Event
  Indicators» (la semana como guía de TV), «Admit One Ticket» y «Event RSVP Card» (el boleto de lo próximo), «Avatar
  Stack» (las caras del campeón con +N), «Grouped Notification Toggles» (la campana por servidor), «Activity Heatmap
  Calendar» (las barras por día de la semana). Dlx eligió la A con un selector Día · Semana · Mes.
- No aplica: «Drawer» (la hoja que sube, de la opción B) quedó sin usar.

## 21/10/2026 · Perfil (maqueta; 20 búsquedas, 0 del cupo)

- Una por pieza: cabecera de perfil, carta de jugador, pestañas, historial de partidas, logros, radar, cara a cara,
  bento, meta con barra, índice que sigue, videos, precio, trayectoria, rango, contra el promedio, mapa de días,
  perfil de juego en el teléfono; Magic UI: Avatar Circles, Number Ticker, Bento Grid.
- Tomado para la maqueta: «Telegram Profile Header» (la carta a la vista que se achica al bajar), «Card Tabs» (A),
  «Scroll Spy» (el índice de B), «Bento Grid» (de un vistazo), «Leaderboard Bars» y «Performance Benchmark Card»
  (contra quién, con su barra), «Radar Chart» de dos series (la Liga punteada), «Achievement badge» con progreso (lo
  que le falta poco), «Activity Heatmap», «8-bit XP Bar» (la meta), «Thumbnail Carousel» y «Linear Carousel» (las tres
  cartas en abanico).
- No aplica: las tarjetas con brillo 3D y glass («ProfileCard» con tilt): el remake prohíbe blur y degradés.

## 02/11/2026 · el Panel del socio y Verificarme (4.22; 32 búsquedas, 0 del cupo)

- Llegó **después de publicar las dos páginas** (Dlx: «Publica y haz todo… sube todo»), que salieron de lo que ya hacían
  y de una crítica independiente. Queda como lista para cuando Dlx opine. Magic UI y shadcn no contestaron.
- Ideas de: Meter (redrob-labs), Leaderboard Bars, Rank Bars, Heat Strip, Bench Matrix (eugeneshilow), Charts & KPI
  Cards (uvain), KPI Tile (konsstepnov), Insight Cards, Leaderboard Table (arihantcodes_1f7b8c4d), Permission Grant
  (syeddhasnainn), Onboarding Steps with Progress (ephraimduncan), Bar Stack (airbnb-visx), Welcome Checklist Card,
  Validation Checklist Input (dhxwhy), Weekly KPI Chart (isaiahbjork), Notification Channel Matrix (felipemenezes098),
  Switch List Card (sean0205), Segmented Control (balick), Checkbox Group (edwinvakayil), Data Refresh State
  (rmahammad), OAuth Consent Card (supabase), Task Steps (ddoemonn), Stepper with Square Badges, Configuration Stepper
  (shadcnspace), Auth Verify Email (preetsuthar17), Country Combobox (cnippet-dev), Achievement Card (trophyso).
- Ya coincidía con lo publicado: la semana que corre marcada (no un derrumbe), el botón de Verificarme en la primera
  pantalla del celular, los permisos debajo del botón.
- Para una vuelta siguiente: el puntaje como **una sola barra de 0 a 100 partida en sus cuatro pesos** (en vez de cuatro
  cajas); cada sugerencia con **su número y un «Ir al ajuste»** (pide que el ciclo mande a dónde lleva); los ajustes de
  canal en **una tabla de «dónde publica el bot»** y los de comportamiento como interruptores; en Verificarme, **una sola
  lista viva** (lo hecho plegado, sólo el paso actual abierto) que **se revisa sola al volver de Discord**, y la carta de
  Servidor de verdad al terminar.
- Preguntas para Dlx: (1) el magenta hoy dice tres cosas en el panel —gente nueva, el día más lleno, lo que baja—:
  ¿magenta sólo para «atención» y lo nuevo en verde agua? (2) ¿los ajustes se guardan solos (como hoy) o con un
  «Guardar» por grupo? (3) ¿Verificarme se revisa sola al volver de Discord?
- No aplica: medidores en anillo y radar (el puntaje son cuatro pesos, no ejes), sparklines en los números, la barra de
  «cambios sin guardar» (choca con el guardado solo), el selector de país con un globo (WebGL, y adivinar el país del
  navegador es adivinar la identidad), un mapa de calor de 7×5 (el payload no trae día por hora).
