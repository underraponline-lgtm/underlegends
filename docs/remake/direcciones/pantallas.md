# Las tres pantallas para comparar los cuatro estilos

Los mismos tres pedidos para las cuatro direcciones, **sin cambiarles una
coma**: lo único que cambia entre una y otra es su archivo de diseño
(`barda.md`, `fanzine.md`, `tvpirata.md`, `diario.md`). Móvil, 360 px de
ancho. Los nombres son inventados a propósito: nada de personas reales ni de
menores identificables.

Los colores de los 8 rangos son fijos en las cuatro (salen de
`comun/rangos.py`): SSS `#C77DFF`, SS `#8FE8FF`, S `#FFD24A`, A `#FF6B7A`,
B `#5CE6A5`, C `#6B8FE8`, D `#D8DEE8`, E `#C98A4B`.

## 1. Hoy

> Pantalla móvil (360 px de ancho) «Hoy», la portada de Liga Global: una liga
> de freestyle (batallas de rap improvisado) entre servidores de Discord de
> Latinoamérica. Seguir estrictamente el design system del proyecto. Contenido,
> de arriba abajo:
> 1) Cabecera: «LIGA GLOBAL» y un ícono de campana.
> 2) Bloque en vivo: «TOKYO VOL 16 · servidor FFA · Cuartos de final», con dos
>    cruces en curso: «Kairos vs Nébula» y «Tinta Fina vs El Profe», y un botón
>    «Ver llave».
> 3) Próximo evento: «FRZ FECHA 7» · servidor FRZ · 1 vs 1 · «Hoy 21:00 (tu
>    hora)» · cuenta regresiva «2 h 14 min» · «24 inscriptos» · botón «Quiero
>    aviso».
> 4) «Tu semana»: tres casilleros: 2 eventos · +1.250 puntos · racha de 3
>    semanas.
> 5) «Se busca»: tres buscados con su precio por cabeza: «Nébula — 800»,
>    «Rima Suelta — 650», «Caos MC — 500».
> 6) «Lo que pasó»: dos resultados de ayer, «TOKYO VOL 15 — Campeón: Kairos» y
>    «DRA Nocturna — Campeón: Mística», cada uno con «Ver llave».
> 7) Barra inferior de 4 pestañas: Hoy · Eventos · Ranking · Yo (activa: Hoy).
> Sin fotos de personas: los avatares son monogramas de dos letras.

## 2. Ranking

> Pantalla móvil (360 px de ancho) «Ranking» de Liga Global, una liga de
> freestyle entre servidores de Discord. Seguir estrictamente el design system
> del proyecto. Arriba: título «Ranking · Temporada 1» y pestañas deslizables:
> Temporada · Competitivo · Duelos · Podios · Rachas · Países · Crews (activa:
> Temporada). Un buscador «Buscar rapero». Chips: Todos · Mi servidor · Mi país.
> Tabla de 12 filas con columnas: puesto, cambio (▲, ▼ o =), rapero (monograma
> de dos letras, apodo y el nombre corto de su país), rango (caja pintada con su
> letra; colores fijos: SSS #C77DFF, SS #8FE8FF, S #FFD24A, A #FF6B7A,
> B #5CE6A5, C #6B8FE8, D #D8DEE8, E #C98A4B, con la letra en tinta oscura) y
> puntos con separador de miles. El top 3 destacado. Filas:
> 1 Kairos (Perú) A 12.450 ▲2 · 2 Mística (Argentina) S 11.980 ▼1 ·
> 3 Nébula (Chile) B 10.300 ▲1 · 4 Tinta Fina (Colombia) B 9.870 = ·
> 5 El Profe (México) C 9.400 ▲4 · 6 Rima Suelta (Uruguay) C 8.950 ▼2 ·
> 7 Caos MC (Venezuela) A 8.700 ▲1 · 8 Lupa (Ecuador) D 8.120 ▼3 ·
> 9 Brasa (Argentina) C 7.900 = · 10 Ojo de Halcón (Chile) E 7.640 ▲6 ·
> 11 Verso Libre (Perú) D 7.300 ▼1 · 12 Sombra (Colombia) C 7.050 =.
> Fija abajo, sobre la barra de navegación: «Tu posición: #47 · 3.120 pts ·
> ▲5» con un botón «Encontrarme». Barra inferior de 4 pestañas: Hoy · Eventos ·
> Ranking · Yo (activa: Ranking).

## 3. Perfil

> Pantalla móvil (360 px de ancho) «Perfil» de un rapero de Liga Global, una
> liga de freestyle entre servidores de Discord. Seguir estrictamente el design
> system del proyecto. Cabecera: apodo «KAIROS», país «Perú», servidor «FFA»,
> crew «Los del Barrio», y los botones «Seguir» (128 seguidores) y «Compartir».
> Centro: su carta como un afiche pegado en la pared: un rectángulo vertical
> 5:7 que representa una tarjeta estilo FIFA oscura y brillante (marcador de
> posición con el texto «CARTA»), y debajo un selector de 4 cartas:
> Temporada · Competitiva · Servidor · País (la de País, bloqueada, dice «2/3
> duelos nacionales»). Casilleros: Puntos 12.450 · Eventos 14 · Podios 5 ·
> Duelos 18-7. Rango: caja pintada «A» (#FF6B7A, letra en tinta oscura) con
> «Score 56,4». Progreso hacia la carta Competitiva: «7 de 10 eventos», en 10
> casilleros. «Últimos eventos»: TOKYO VOL 16 — Semifinal · TOKYO VOL 15 —
> Campeón · FRZ FECHA 6 — Cuartos · DRA Nocturna — Octavos · FFA Semanal 12 —
> Final. Botón «Compartir carta». Barra inferior de 4 pestañas: Hoy · Eventos ·
> Ranking · Yo (activa: Yo).
