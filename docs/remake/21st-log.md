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
