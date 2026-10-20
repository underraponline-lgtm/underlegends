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
