# Inventario del hub web — underlegends.pages.dev

Estado al 29/09/2026, antes del remake (React + Vite + Tailwind, estático en Cloudflare Pages).
Es la lista de control del remake: todo lo que hoy hace la página, para que nada se pierda sin avisar.

Cómo leer las anclas: son rutas desde la raíz del repo `underlegends`. `app.js` es
`bot/paginas/app.js`, `index.html` es `bot/paginas/index.html`, y así con el resto.
Sólo se leyó código. No se corrió la página ni se llamó a ningún endpoint.

---

## 0. Los archivos del sitio

| archivo | tamaño | qué es |
|---|---|---|
| `bot/paginas/index.html` | 48 KB · 819 líneas | La única página del hub. Todas las vistas ya están en el HTML y se muestran u ocultan. |
| `bot/paginas/app.js` | 353 KB · 6.440 líneas · ~976 funciones | Todo el hub: enrutado, dibujo, cuenta, llaves, tienda, encuestas. Sin framework y sin build. |
| `bot/paginas/campana.js` | 23 KB · 471 líneas | Los avisos push («la campana»). Aparte a propósito: si falla, sólo se apaga la campana. |
| `bot/paginas/llave_vivo.js` | 40 KB · 831 líneas | Lector de llaves en vivo. Copia en JS de `bot/escuchar.py`, atada por CI. Expone `window.LlaveVivo`. |
| `bot/paginas/sw.js` | 7 KB · 149 líneas | Service worker. Sólo push. Sin `fetch` handler, a propósito. |
| `bot/paginas/_worker.js` | 12 KB · 231 líneas | Worker de Pages (modo avanzado). Proxy cerrado de `/api/*` al Worker del bot. |
| `bot/paginas/estilo.css` | 155 KB · 2.383 líneas | Todo el estilo. Sólo tema oscuro. Sin `url()` ni `@import`. |
| `bot/paginas/manifest.json` | 1 KB | PWA: instalar en la pantalla de inicio (en iPhone es requisito para recibir avisos). |
| `bot/paginas/cambios.json` | 43 KB | El changelog público, escrito a mano. 51 entradas, la última es la v1.51. |
| `bot/paginas/privacidad.html`, `terminos.html`, `legal.css` | 16 + 9 + 6 KB | Páginas legales, bilingües (ES y `#en`). |
| `bot/paginas/mapa.html`, `mapa.js`, `mapa_datos.js` | 20 + 49 + 24 KB | Mapa de la Liga en vivo, sólo para el dueño. **Queda intacto.** Ver §6. |
| `bot/paginas/banderas/` | 24 PNG + `g/` con 24 WEBP | Banderas chicas (tablas) y grandes (podio de países). Las arma `herramientas/banderas_web.py`. |
| `bot/paginas/logos/` | 10 WEBP + `crews/` con 2 | Logos de servidores y crews. Los arma `herramientas/logos_web.py`. |
| `ul.png`, `ul-192.png`, `og.png`, `aviso.png`, `insignia-ul.png`, `insignia.png` | imágenes | Ícono, PWA, vista previa del link, ícono y badge de la notificación. `insignia.png` no se usa. |
| `bot/paginas_viejas/_worker.js` | 1 KB | El dominio viejo `liga-global.pages.dev`: sólo un 301. Es otro proyecto de Pages. |
| `bot/paginas_subir.py` | 226 líneas | El despliegue (API directa de Pages, sin wrangler). |

---

## 1. Vistas

La página tiene **13 vistas** (`section.vista[data-vista]`), **3 alias** de ruta, **4 capas encima**
(visor de tarjeta, visor de llave, Mi cuenta, Ajustes) y **3 páginas HTML aparte** (privacidad,
términos, mapa). Todas las vistas usan el mismo payload (`D`, de `/api/lobby`), salvo las que se
indican.

Regla que vale para todas: **«sin dato no hay pieza»**. Cada `pinta*()` esconde su bloque si no tiene
datos (`app.js:22-25`). Y cada `pinta*()` corre aislado en un `try`: si uno falla, el resto de la
página sale igual (`app.js:6332-6346`).

### 1.0 El marco (siempre visible)

- **Menú** (`index.html:53-93`). En escritorio es una columna fija a la izquierda. Debajo de 900 px es
  la barra de abajo, que se desliza de costado (`estilo.css:1974-2005`). Es el mismo elemento en las
  dos formas.
  - Marca «Liga Global · Freestyle en español» → `#/`.
  - 9 enlaces, en este orden: Inicio `#/`, Ranking `#/ranking`, Publicaciones `#/publicaciones`,
    Pase `#/pase`, Tienda `#/tienda`, Eventos `#/eventos`, Tarjetas `#/tarjetas`, Mundo `#/mundo`,
    Guía `#/guia`. El activo lleva `.on`, y en el teléfono se desplaza a la vista (`app.js:336-342`).
  - El borde derecho de la barra se apaga para decir «hay más» y deja de apagarse al final
    (`bordeNav()`, `app.js:4676-4679`).
  - Botón **Ajustes** `#bAjustes` (`index.html:86`).
  - Enlace **Changelog** `#/cambios`, con la versión (`#verCambios`) y un punto de «nuevo»
    (`#cambiosNuevo`) (`index.html:91`, `app.js:5630-5637`).
  - **Pie** `#pie`: «Fase de prueba» o «Temporada T1», y «Datos actualizados hace X». Si los datos
    tienen más de 75 min, lo marca y dice que de 3 a 11 AM (hora del este) no se actualiza
    (`app.js:6357-6364`). Usa `D.leido` y, si falta, `D.sello`.
- **Barra de arriba** (`index.html:102-109`): botón de Ajustes para el teléfono `#bAjustes2` (lleva
  punto si hay changelog nuevo) y botón **Mi cuenta** `#bCuenta` con cara y nombre
  (`pintaCuenta()`, `app.js:5441-5449`). Abren los paneles `#popCuenta` y `#popAjustes`.
- **Fondo**: aurora, trama de texto «UNDER LEGENDS» (`trama()`, `app.js:368-375`) y velo. Cero
  imágenes.
- **Título de la pestaña**: `«<h1 de la vista> · Liga Global de Freestyle»`, sin repetir el nombre
  (`app.js:356-364`). Perfil, crew y país ponen el suyo.
- **Estado de error**: si `/api/lobby` falla, se esconden todos los bloques y aparece «No pude cargar
  los datos» con el código del servidor (`app.js:6416-6440`). Lo prueba `herramientas/web_en_borde.py`.

### 1.1 Inicio — `#/` (o vacío) · `data-vista=""`

Título visible: «LA NUEVA ERA · Liga Global» (`index.html:112-156`).

Qué se ve, de arriba abajo:

1. **Hero**: lema fijo; **fase** (`#fase`: «Fase de prueba · la Temporada 1 arranca el… (faltan N
   días)» o «Temporada 1 en juego · termina el…», `pintaFase()`, `app.js:5573-5597`); **cifras**
   raperos / eventos / países / tarjetas (`pintaHero()`, `app.js:419-433`).
2. **Buscador del Inicio** `#buscarInicio`: sugiere hasta 6 nombres; Enter abre el primer perfil;
   Escape limpia (`pintaBusca()`, `app.js:3996-4008`; teclas en `app.js:5811-5821`).
3. **Aviso de la campana** `#campanaCta`: «Avisame cuando anuncien un evento» → `#/avisos`, con ✕ que
   lo cierra para siempre en ese navegador. Se esconde si ya se activó, si no se puede o si el
   permiso está negado (`campana.js:231-236`, `campana.js:317-319`).
4. **Los dos campeones** `#campeones`: la tarjeta del #1 de la Temporada y la del #1 del Competitivo.
   Dice «Líder» mientras se juega y «Campeón» al día siguiente del cierre. Si el Competitivo no tiene
   a nadie, «Vacante» con «el más cerca» (N de 10 eventos). Sin tarjeta, dice por qué (sin verificar)
   (`pintaCampeones()`, `app.js:542-581`).
5. Columna izquierda (`index.html:162-216`):
   - **Multiplicadores de la semana** `#secMult`, con páginas y flechas: los ×N por servidor, «El ×2
     de la semana que viene» (encuesta), «Premios de la semana» y «Meta y Semillero». Se esconde
     cuando vence la semana (`pintaMult()`, `app.js:624-751`).
   - **En vivo** `#secVivo`: llaves que se juegan ahora (leídas en el navegador), los «5 vidas» de
     veredictos, y eventos que empezaron sin llave publicada. Cada una con «Ver la llave» y
     «Discord ↗» (`pintaVivo()`, `app.js:887-983`).
   - **Lo que viene** `#viene`: el próximo evento grande (servidor, día y hora en la zona de quien
     mira con bandera o «hora local», cuenta atrás, cupos, modalidad, premio, «Agregar a Google
     Calendar», «Ver el anuncio», «Avisame») y el resto en lista, con etiquetas ×N, 🌟 dorado, 🏆 Copa
     y 📣 con tiempo. Lo que no tiene hora dice «anunciado hace X» (`app.js:437-508`).
   - **Lo que pasó** `#secPaso`: los 3 últimos eventos, con organizador (con su perfil si lo tiene),
     cuántos raperos, rango del evento, campeón, «Ver llave» y «El anuncio ↗»; botón «Ver el
     calendario» (`pintaPasados()`, `app.js:784-821`).
6. Columna derecha (`index.html:218-271`):
   - **Paneles con páginas** `#secPaneles` (flechas y puntitos, `pintaPaneles()`, `app.js:4784-4797`):
     - Página 1: **Most Wanted**. Si no hay datos, un aviso fijo «Most Wanted · Misiones —
       Próximamente» (`index.html:230-239`). Con datos, el tablero de buscados (categoría, motivo,
       recompensa, estado: suelto / cazado / sobrevivió / se escondió), cuándo vence, la votación de
       **El Elegido** (`#encElegido`) y el **precio por cabeza** (`#prInicio`), más «Los cazadores de
       la temporada ›» → `#/ranking/mw` (`pintaMW()`, `app.js:4214-4250`).
     - Página 2: **Tu temporada**: tu tarjeta de «quién soy» (OVR, puntos, racha, cuánto falta para
       la Competitiva) o «¿Quién sos? · Elegir quién soy», y el próximo evento o el último campeón
       (`pintaYoPanel()`, `app.js:4798-4849`).
     - Página 3: **La Liga hoy**: mapa de países (% de los 20 países hispanos con gente), actividad de
       las últimas 2 semanas (barras por día y servidor) y la comunidad (personas, en la Lista, con
       Discord, verificadas, y «¿Todavía no tenés tu tarjeta? Pedila →»)
       (`pintaMapa()` `app.js:3242`, `pintaActividad()` `app.js:4065`, `pintaComunidad()`
       `app.js:4017`).
   - **Novedades de la Liga** `#secNov`: lo que la Liga publica en Discord, paginado de a 1 o 2
     (`pintaNovedades()`, `app.js:4174-4179`).
7. **En las redes** `#secRedes`: los últimos videos de YouTube de cada servidor, en grande, de a 1 o 2
   con flechas, y «Seguí a la Liga» con sus redes (`pintaFeed()`, `app.js:4162-4170`).
8. **Los tres de arriba** `#secTop`: el top 3 de Temporada (OVR), Competitivo (rango), Duelos,
   Podios, Rachas, Crews y Most Wanted, cada uno con «Ver todo» → `#/ranking/<sub>`; y cajas
   «Próximamente» para Misiones, Ascenso y Ligas (`pintaTops()`, `app.js:3344-3433`).
9. **El podio** `#secPodio`: por categoría (Temporada, Competitivo, Duelos, Podios, Rachas, Países,
   Crews), con flechas y puntitos; la categoría elegida se recuerda (`lg:podio`). Debajo, los
   **récords** (`pintaPodio()`, `app.js:1612-1718`).
10. **Los mejores de cada lado** `#secUnos`: el #1 por país, por crew y por servidor
    (`pintaUnos()`, `app.js:1724-1762`).

Qué se puede hacer: buscar y abrir un perfil; abrir una tarjeta (visor); tocar cualquier nombre
(perfil), crew o país; abrir llaves (pasadas y en vivo); pasar páginas de los paneles, el feed, las
novedades y el podio; votar El Elegido y el ×2; ir a la Tienda; agregar un evento a Google Calendar;
activar avisos.

Datos: `tabla`, `gente`, `eventos`, `paises`, `fase`, `temporada`, `proximos`, `vivo_min`,
`pasados`, `llaves`, `calendario`, `orgs`, `mult`, `enc`, `mw`, `tienda`, `requisitos`, `duelos`,
`rachas`, `crews`, `records`, `svs`, `actividad`, `comunidad`, `novedades`, `feed`, `redes`,
`rivales`, `alias`. Además pide `/api/avisos/vivo`, `/api/avisos/encuestas`, `/api/avisos/precios`
y el dibujo del mundo (jsDelivr).

### 1.2 Ranking — `#/ranking` y `#/ranking/<sub>` · alias `#/duelos`

Título visible: «Los rankings» (`index.html:345-402`).

- **Una sola tabla** que cambia de filas, columnas y orden según la subcategoría (`SUBS`,
  `app.js:1919-2014`; columnas en `COL`, `app.js:1834-1908`).
- 10 pestañas (`#subRanking`): **Temporada** (orden por OVR), **Competitivo** (por Score; vacío con
  «el más cerca»), **Duelos** (por ganados), **Podios** (medallero: oros, platas, bronces), **Rachas**,
  **Países**, **Crews** (las de menos de 3 raperos van sin número), **Most Wanted** («pronto» hasta
  que haya buscados), **Misiones** (pronto) y **Ligas** (T2).
- Filtros: buscador `#buscar` (sin tildes), chips de servidor `#chipsSv` (sólo si hay 2 o más) y chips
  de país `#chipsCc` (top 12, sólo si hay 2 o más) (`pintaChips()`, `app.js:1765-1784`).
- **Todas las columnas se ordenan** tocando el encabezado, también con Enter o Espacio; tocar la que
  manda la da vuelta. Lo vacío va siempre al final (`ordenadas()`, `app.js:2031-2043`; eventos en
  `app.js:5753-5770`).
- Una columna que dice lo mismo en todas las filas no se dibuja (hoy «Sv») (`COL.sv.si`,
  `app.js:1855-1858`).
- **Fuera de concurso** (`fc`): quien no es miembro va en su lugar por mérito (`o`) pero sin número
  («—»); la numeración lo salta. Nota explicativa si hay alguno (`app.js:2067-2071`, `2086-2092`).
- Top 1, 2 y 3 llevan clase propia; pie con «N raperos» o «N de M» (`app.js:2113-2125`).
- Tocar una fila abre el perfil (o la crew, o el país). Tocar una pestaña reescribe el hash a
  `#/ranking/<sub>` con `replaceState` (se puede copiar el link) (`app.js:6018-6023`).

Datos: `tabla`, `duelos`, `paises`, `crews`, `mw` (`b`, `caz`), `requisitos`, `svs`.

### 1.3 Publicaciones — `#/publicaciones`

Título visible: «Publicaciones» (`index.html:479-494`).

- El **muro** de la Liga, pedido aparte al abrir la vista: `GET /api/muro` (`pedirMuro()`,
  `app.js:4569-4574`). No viaja en el lobby.
- Tipos de publicación (`itemMuro()`, `app.js:4588-4642`): campeón (con «Ver la llave»), rango
  (subió o tiene su primer rango), tarjeta desbloqueada («Ver sus tarjetas»), caza del Most Wanted,
  sobrevivió, precio cobrado, premios de la semana, El Elegido, **anuncio** de evento de cualquier
  servidor («Ver en Discord ↗») y novedad de la Liga.
- Filtros (`data-mufil`): Todo, En la Liga, Anuncios, y **★ A quien sigo** (sólo si seguís a alguien)
  (`app.js:4645-4672`).
- De a 20, con «Ver más» `#muroMas`. Cada nombre abre su perfil.

### 1.4 Pase — `#/pase`

Título visible: «Pase de rapero» (`index.html:436-449`). **Es un cartel fijo «Próximamente»**, sin
datos. Dos botones: «Activar los avisos» → `#/avisos` y «Mientras tanto, los rankings» →
`#/ranking`.

### 1.5 Tienda — `#/tienda`

Título visible: «La tienda» (`index.html:457-472`; `pintaTienda()`, `app.js:4685-4743`).

- **Tus Puntos de Tienda** `#secBilletera`: botón «Ver mis Puntos de Tienda» (pide entrar con
  Discord). Con cuenta: saldo, lo cobrado cazando y tus precios activos de la semana. Al abrir la
  vista se prueba sola con la sesión, sin mandar a Discord (`app.js:318-321`, `pedirBilletera()`
  `app.js:4493-4503`).
- **Precio por cabeza** `#secPrecios`: reglas de la semana (hasta cuándo, tope por cabeza), la lista
  de cabezas con precio, un buscador para elegir a quién, el panel con montos (mínimo ×1, ×2, ×5,
  ×10; apagados si no entran en la cabeza o en tu saldo), y «Lo último que se cobró».
  Nadie ve quién puso un precio.
- Un cartel «La tienda abre pronto» con «Activar los avisos» (`index.html:462-471`).

Datos: `tienda`, `tabla`. Pide `/api/avisos/precios` (público) y `/api/avisos/billetera`,
`/api/avisos/precio` (con cuenta).

### 1.6 Eventos — `#/eventos` · alias `#/avisos`, `#/avisos/<SV,SV>`, `#/avisos/todos`, `#/llave/<n>`

Título visible: «Los eventos» (`index.html:500-574`).

1. **Cabecera** `#evCab` (`pintaEvCab()`, `app.js:3120-3197`): el próximo evento con cuenta atrás y
   «Agregar este evento a Google Calendar», o el último campeón; cifras (eventos de la temporada,
   esta semana, raperos esta semana, servidor más activo); botones «Avisame de cada evento» →
   `#/avisos`, «Sumar a Google Calendar» (sólo en compu), «Apple · Outlook» (`webcal://`, no en
   Android), «Copiar el link» del `.ics`; y cómo suscribirse a mano.
2. **Calendario** `#secCal`: mes con flechas; cada día con puntos del color de su servidor (hasta 3 y
   «+N»); leyenda por servidor con logo y cuenta, más «Anunciado, sin llave» y «Por jugarse». El día
   se calcula **en la zona de quien mira** (`pintaCalendario()`, `app.js:2897-2947`).
3. **El día** `#secDia`: tarjetas de cada evento de ese día (lo más nuevo arriba), con hora, servidor,
   ×N, 📣, modalidad, rango, estado (jugado / en vivo / terminó / por jugarse / anunciado), campeón y
   acciones: «Ver llave», «Ver la llave en vivo», «Agregar a Google», «Discord ↗»
   (`pintaDia()`, `app.js:2949-3010`). En pantallas chicas, tocar un día baja hasta acá.
4. **Los últimos campeones** `#secCampeones`: las 6 llaves más nuevas, cada una abre su llave
   (`app.js:3024-3041`).
5. **Cómo se juega** `#secFormatos`: formatos más jugados (barras) y quién organiza (con su perfil),
   con el promedio de raperos por llave (`app.js:3062-3097`).
6. **Avisos de eventos** (`h2#avisos`, `index.html:549`): la **campana** (§1.18) y el bloque fijo
   «Desde Discord» que explica `/notify` e iPhone (`index.html:561-572`).

Alias: `#/avisos` abre Eventos y baja hasta `#avisos` (`app.js:352-355`). `#/avisos/<lista>` además
preselecciona servidores en la campana. `#/llave/<n>` abre Eventos con la llave encima.

Datos: `calendario`, `llaves`, `pasados`, `svs`, `eventos`, `actividad`, `orgs`, `mult`.

### 1.7 Tarjetas — `#/tarjetas`

Título visible: «Las tarjetas» (`index.html:405-430`).

- **¿Todavía no tenés tu tarjeta?** `#secPedi`: explica `/verificar`, botón «Entrar a Discord Rap
  Español ↗» (invitación de DRA del payload) y «Cómo funciona» → `#/guia`. Se esconde para quien ya
  tiene tarjeta (`pintaPedi()`, `app.js:4043-4064`).
- **Comparar dos** `#secComparar`: primero la categoría (Temporada, Competitiva, País, Servidor;
  apagada si la tienen menos de 2), después dos nombres con buscador propio (sugiere por contenido,
  flechas ↑↓, Enter, Escape). Muestra las dos tarjetas y filas donde el que gana va en verde. Si se
  cruzaron en duelos, fila «Cara a cara» (de `/api/perfiles`) (`app.js:2200-2381`).
- **Todas las tarjetas** `#galeria`: sólo quien tiene tarjeta **y cara** (`fo !== 0`); buscador
  `#buscarC`; de a 24 y «Ver las N» (`conTarjeta()` y `pintaGaleria()`, `app.js:2150-2190`). Una
  tarjeta que se está redibujando va marcada.
- Tocar una tarjeta abre el visor (§1.14).

Datos: `tabla` (`c`, `cv`, `vj`, `fo`, `ovr`, `pts`, `ev`, `pod`, `sc`, `wr`, `oro`, `pos`), `r2`,
`cartas`, `svs`. Pide `/api/perfiles` para el cara a cara.

### 1.8 Mundo — `#/mundo`

Título visible: «El mundo» (`index.html:577-600`).

- **Los servidores** `#svs`: logo, nombre completo, etiqueta, miembros, gente en la T1, puntos, redes y
  «Entrar al servidor ↗» (invitación) (`pintaServidores()`, `app.js:2391-2417`).
- **Las crews** `#crews`: logo, gente (cada nombre abre su perfil), puntos y puesto (sin número si
  tienen menos de 3). Tocar una abre `#/crew/<clave>` (`app.js:2437-2454`).
- **Los países** `#listaPaises`: puesto, bandera, nombre, raperos, puntos. Tocar uno abre
  `#/pais/<cc>` (`app.js:2419-2435`).

Datos: `svs`, `crews`, `paises`.

### 1.9 Guía — `#/guia`

Título visible: «Cómo funciona» (`index.html:603-760`).

- **Cómo conseguir tu tarjeta** `#listaComo`: qué pide cada tarjeta, más Histórica y Prime
  «Próximamente · Llega con la Temporada 2» (`pintaComo()`, `app.js:2488-2505`).
- **Los ocho rangos** `#escalera`: letra, material y cuántos hay hoy (o el umbral si no hay nadie)
  (`pintaRangos()`, `app.js:2458-2485`).
- **Cuántos puntos da cada puesto** `#puntos`: tabla por tamaño de llave, walk-in y revivido.
- **El OVR y el Score** `#numeros`: barras con el peso de cada parte y la confianza
  (`pintaGuia()`, `app.js:4856-4908`).
- **Las palabras de la Liga**: glosario **fijo en el HTML**, 31 términos (`index.html:638-725`).
- **Preguntas frecuentes**: 8 desplegables **fijos en el HTML**, con links a `#/avisos`, `#/eventos` y
  `privacidad.html` (`index.html:727-759`).

Datos: `requisitos`, `rangos`, `tabla`, `guia`.

### 1.10 Changelog — `#/cambios`

Título visible: «Changelog» (`index.html:763-768`).

- Lee `cambios.json` (estático, `cache: 'no-cache'`), no pasa por el Worker (`cargarCambios()`,
  `app.js:5608-5617`).
- Cada entrada: versión, fecha y hora en la zona de quien mira, título y puntos con **negrita** y
  `código` (`pintaCambios()`, `app.js:5642-5675`).
- Marca «Nuevo» lo que es de una versión posterior a la última vista (`lg:cambios`). Al abrir la
  vista, se da por visto.
- Desde 1.100 px va en dos columnas equilibradas (`acomodarCambios()`, `app.js:5682-5707`).
- El punto de «nuevo» del menú y de Ajustes se calcula en cada carga de la página (`app.js:6369`).

### 1.11 Perfil de un rapero — `#/r/<clave>`

Sin título fijo: el `<h1>` es el nombre (`pintaPerfil()`, `app.js:3666-3925`).

- Acepta **claves viejas** (el nombre en minúsculas con espacios) y corrige el link con
  `replaceState` a la clave nueva (`porK()` `app.js:217-227`, `app.js:3680`).
- Quien entró con Discord y no jugó la temporada ve su propio perfil igual (`filaCuenta()`,
  `app.js:243-248`).
- **Cabecera**: «‹ Ranking», cara, puesto («#N de la temporada», «Fuera de concurso» o «Todavía sin
  eventos»), nombre, «Sin verificar» con el motivo (y el consejo `/verificar` si sos vos), país
  (→ `#/pais/<cc>`), servidor elegido o donde más jugó, crew (→ `#/crew/<clave>`), redes, cuántos
  seguidores, botón **Seguir** (no en tu propio perfil), cifras OVR / Rango / Puntos / Eventos / Win%.
- **Sus tarjetas**: pestañas (en tu perfil, también las Bloqueadas), la imagen, **Descargar** y, si
  sos vos, **Cambiar mi foto**.
- **Sus números**: podios, veces que quedó en semis, duelos ganados, racha de duelos.
- **Sus fortalezas**: radar de las 5 dimensiones del Score contra el promedio de la Liga, su fuerte y
  su flojo, aviso de «provisorio» con pocos eventos (`radar()` y `pintaJuego()`, `app.js:3608-3665`).
- **Lo que le falta**: por tarjeta (Temporada, Competitiva, País), barras por condición o
  «Desbloqueada» / «Falta verificarse».
- **En cada ranking**: su puesto en Temporada, Duelos, Podios, su país y su crew.
- **Precio por su cabeza**: cuánto vale y montos para ponerle (§1.20).
- **Sus eventos**: cada evento con fecha, servidor, raperos, puesto, puntos y «Ver llave».
- **Insignias**: ganadas a color y las que faltan en gris con cómo se ganan («N de M»).
- **Su cacería** (Most Wanted): cazó, lo cazaron, sobrevivió, se escondió, y a quién / quién.
- **Cara a cara**: por rival, ganados–perdidos y barra; si son más de 11, «Los otros N» plegado.
- **Sus duelos**: lista de ganados y perdidos.
- Si el rapero no existe: «No lo encontré».

Datos: `tabla`, `crews`, `svs`, `insignias`, `guia`, `requisitos`, `oficiales`, `tienda`. Pide
`/api/perfiles` (una sola vez por visita), `/api/avisos/seguidores` y `/api/avisos/servidores`
(cada 5 min como mucho).

### 1.12 Página de una crew — `#/crew/<clave>`

`pintaCrew()`, `app.js:3503-3532`. «‹ Mundo», logo, «#N de las crews» o «Sin puesto: hacen falta tres
raperos», banderas de su gente, cifras (Raperos, Puntos, Por rapero, Su mejor) y la lista de su gente
en la temporada. Si no existe: «No la encontré». Datos: `crews`, `tabla`.

### 1.13 Página de un país — `#/pais/<cc>`

`pintaPais()`, `app.js:3533-3565`. «‹ Mundo», bandera grande, «#N de los países», chips de sus crews,
cifras y su gente. Si no hay nadie: «No lo encontré». Datos: `paises`, `tabla`, `crews`.

### 1.14 Capa: visor de tarjeta `#visor`

`index.html:791-813`; `abrir()` `app.js:2559-2613`; `cerrar()` `app.js:2615-2620`.

- Puesto, nombre, país (link), servidor, crew (link), pestañas por tarjeta (incluye Bloqueadas
  `bloq-*` para tu propia cuenta), la imagen de R2 con `?v=` de su versión, aviso «se está
  redibujando» si la carta es vieja, cifras OVR / Puntos / Eventos / Win%.
- **Descargar**: baja la pestaña activa con `fetch` + blob y la guarda como «Nombre - Carta.webp»; si
  falla (CORS), abre la imagen en otra pestaña (`bajarCarta()`, `app.js:2533-2557`).
- **Ver su perfil** (oculto si no está en el ranking).
- Se cierra con ✕, tocando el fondo o con Escape. Bloquea el scroll de la página.
- Se abre desde cualquier elemento con `data-carta` (galería, podio, campeones, muro, Mi cuenta).

### 1.15 Capa: visor de llave `#visorLlave`

`index.html:776-789`; `abrirLlave()` `app.js:1057-1247`. Va **debajo** del visor de tarjeta: tocar un
nombre abre su tarjeta encima y al cerrarla se vuelve a la llave.

- **Cabecera**: logo del servidor, nombre del evento, chips (servidor, ×N si es en vivo, modalidad,
  rango del evento y sus puntos de ascenso en su servidor), fecha y hora (en la zona de quien mira),
  raperos, organizador con perfil y premio.
- **Podio** arriba (campeón, subcampeón, tercero, con puntos o rango de puntos si el equipo no sumó
  parejo).
- **Most Wanted en la llave**: a quién cazaron acá y quién cobró; en vivo, qué buscados juegan.
- **Leyenda** de colores (ganó, quedó afuera, camino del campeón) o la regla de las vidas.
- **Dos vistas** (`data-lvista`): **Cuadro** (por defecto) y **Por rondas** (`app.js:1205-1209`).
  - Cuadro: SVG + cajas; en espejo (final al medio) si el ancho es de 760 px o más y la final tiene
    dos ramas; si no, de izquierda a derecha y «Deslizá para ver hasta la final →»; puntos de cada
    ronda arriba de su columna; tercer puesto debajo de la final; se arrastra con el mouse; se rearma
    si cambia el ancho (`cuadro()`, `app.js:2649-2835`; arrastre `app.js:6267-6286`).
  - Por rondas: lista de arriba abajo (`rondasLista()`, `app.js:1552-1592`).
  - Formato **N vidas**: tablero con corazones y «batalla por batalla» (`vidasVista()`,
    `app.js:1481-1548`).
  - **Nave de funa** (cypher): lista con ❌ en los que cayeron (`funaVista()`, `app.js:1312-1322`).
  - Etiquetas en cada batalla: revivido, walk-in, pokémon, refuerzo, por el podio, pasan N, **Clásico
    a–b** (`app.js:1411-1448`).
  - Equipos: caras juntas; un equipo nombrado con un solo nombre va como «equipo», sin perfil.
- **Seguir a alguien por la llave**: con mouse, al pasar por un nombre se ilumina su camino; en el
  teléfono, el primer toque sigue y el segundo abre el perfil. Barra fija abajo con quién, puesto y
  puntos, «Perfil» y ✕ (`seguirEnLlave()` y `pintaBarraSigue()`, `app.js:1361-1406`;
  eventos `app.js:6136-6166`, `6225-6234`).
- **Los puntos, por puesto**: grupos (Campeón, Subcampeón, …) con cada nombre y sus puntos.
- **Acciones**: links a la llave en Discord («Llave 1», «Llave 2»…), **Copiar el link de esta llave**
  (`#/llave/<n>`; sólo en llaves procesadas; si el portapapeles falla, `prompt`) y **¿Algo está mal
  en esta llave?** (§1.21).
- **Llaves en vivo** (`v:<id>`): cabecera «En vivo · se actualiza sola cada minuto · último cambio
  hace X»; se redibuja en su lugar sólo si cambió, sin perder el scroll (`app.js:972-982`).
- **Llaves viejas**: si `#/llave/<n>` o un botón apunta a una que no viaja en el lobby, se piden todas
  una vez (`GET /api/llaves`); si no está, aviso «Esa llave no está» en Eventos
  (`llaveVieja()`, `app.js:1032-1056`).
- Al cerrar una llave abierta por su link, el hash vuelve a `#/eventos` sin reabrirla
  (`cerrarLlave()`, `app.js:1594-1601`).

### 1.16 Capa: Mi cuenta `#popCuenta`

`_pintaPopCuenta()`, `app.js:5462-5526`. Cuatro estados:

1. **Sin nada**: explica «Entrar con Discord» (botón `#dcEntrar`) y un desplegable «O elegí tu nombre
   sin entrar» con buscador `#yoBusca` (se guarda en `lg:yo`, no autoriza nada).
2. **Con Discord y con perfil de rapero sin eventos**: cara, «Conectado con Discord», menú (Mi perfil,
   Mis tarjetas, Mi país, Mis avisos → `#/avisos`, Cambiar mi foto, Salir). Si la sesión es de antes
   del 25/09 sin clave: «Actualizar mi cuenta».
3. **Con Discord sin tarjeta**: «/verificar», «Cómo conseguir tu tarjeta» → `#/guia`, Mis avisos, Salir.
4. **Con «quién soy» elegido**: cara, puesto y OVR, menú (Mi perfil, Mis tarjetas, Mi país, Mis
   avisos, Cambiar mi foto si hay Discord, Salir / «No soy yo»); sin Discord, invita a entrar.

Secciones extra según el caso:

- **Tu foto de la tarjeta** (`secFoto()`, `app.js:5264-5296`): vista previa de la foto de Discord,
  «Usar esta foto» / «Cancelar»; una por temporada (libre hasta una fecha; el pase de DRA la saltea);
  errores sin foto / sin perfil / ya usada / CDN / esperá.
- **Mis redes en mi perfil** (`secRedes()`, `app.js:5304-5338`): pide el permiso `connections`, lista
  las redes públicas con casillas, «Guardar en mi perfil», «Quitar todas»; topes por día.
- **Tu servidor** (`secMiServidor()`, `app.js:5120-5147`): elegir el servidor que representás (uno por
  temporada; libre hasta una fecha; después se confirma con «Elegir X»).
- **Tus próximos eventos** (`secProximos()`, `app.js:5152-5174`): los de tus servidores (o todos), con
  «Anuncio e inscripción ↗» y «+ Calendario».
- **Siguiendo** y **Te siguen** (`secSigo()`, `app.js:5026-5056`).
- Pie con «Tus datos · Privacidad · Términos» (`legalPop()`, `app.js:5454-5457`).

Se abre con `#bCuenta` o cualquier `[data-abrir-cuenta]`; se cierra tocando afuera, con Escape o al
cambiar de vista.

### 1.17 Capa: Ajustes `#popAjustes`

`pintaPopAjustes()`, `app.js:5537-5557`.

- **Formato de la hora**: automático, 12 h o 24 h.
- **Zona horaria**: la del dispositivo o una de 9 zonas fijas (`ZONAS`, `app.js:89-94`).
- **Menos animaciones**: clase `html.calma` (`estilo.css:1600-1601`).
- **Olvidar quién soy y mis ajustes**: borra ajustes, «quién soy», Discord, seguidos, cierra la sesión
  y desvincula los avisos del dispositivo (`app.js:5940-5958`).
- Link al Changelog con versión y «Nuevo», y los links legales.
- Cambiar zona o formato **redibuja todo lo que tiene horas sin moverte de lugar**
  (`repintarHoras()`, `app.js:5713-5732`).

### 1.18 Dentro de Eventos: la campana (avisos push) `#campana`

`campana.js` entero. Estados que dibuja (`pinta()`, `campana.js:306-375`):

- iPhone sin instalar: pasos «Compartir → Agregar a inicio → abrí desde el ícono».
- Navegador sin soporte: qué navegadores sirven.
- Permiso bloqueado: cómo desbloquearlo.
- Sin activar: explicación y **Activar avisos** (el permiso se pide sólo con un clic). Si vino de
  `/notify`, dice qué servidores va a activar.
- Activado: chips de servidores (Todos, cada servidor que el vigía escucha, **🧪 Pruebas**), **Mandar
  una de prueba** (espera 20 s y dice si llegó al navegador o no), **Desactivar**, y **Avisos míos**:
  **Vincular con mi Discord** / **Desvincular** (rango, tarjetas y gente que seguís).
- Línea de estado (`role="status"`).

Detalles: re-alta automática una vez por día; si cambió la clave VAPID, re-suscribe sola sin preguntar
(`campana.js:441-458`); el link de `/notify` se aplica **una vez** y el hash vuelve a `#/avisos`
(`campana.js:80-93`).

### 1.19 Encuestas (en el Inicio)

`app.js:4261-4450`. Dos: **El Elegido** del Most Wanted (en el panel MW, con buscador y los más
votados arriba) y **el ×2 de la semana que viene** (en el panel de multiplicadores, un botón por
servidor). Muestran cuándo cierra, votos totales, «hacen falta N», barras, tu voto (✓) y «sos vos»
(no te podés votar). Votar pide Discord; el voto pendiente sobrevive el viaje a Discord
(`sessionStorage lg:voto`). Tu voto se recuerda en `lg:votos`. Nadie ve a quién votaste.

### 1.20 Precio por cabeza (Tienda, perfil e Inicio)

`app.js:4451-4783`. Ver §1.5. En el perfil: `#pfPrecioSec`. En el Inicio: las 3 cabezas que más valen
(`#prInicio`). Poner un precio pide Discord; el pendiente sobrevive el viaje (`sessionStorage
lg:precio`, con la vista a la que volver).

### 1.21 Reportar un error en una llave

`app.js:1254-1294`. Desde el visor de llave: elegir qué está mal (ganador, falta o sobra alguien, un
nombre, otra cosa), texto opcional (300 caracteres, obligatorio en «otra cosa») y **Enviar**. Pide
estar dentro con Discord; errores: cuenta muy nueva, tope por día.

### 1.22 Seguir raperos

`app.js:4917-5056`. Botón **☆ Seguir / ★ Siguiendo** en el perfil; una **★** al lado del nombre en toda
la página; lista en Mi cuenta; filtro «A quien sigo» en Publicaciones; aviso por la campana cuando
alguien que seguís gana, sube de rango o desbloquea una tarjeta. Sin Discord queda en el navegador
(`lg:sigo`); con Discord se guarda en el servidor y lo local sube una sola vez (`lg:sigo_srv`). Tope:
200.

### 1.23 Páginas aparte

- `privacidad.html` y `terminos.html`: bilingües, el inglés con `#en`; idioma recordado en
  `lg:idioma-legal`; enlazan a `/` y entre sí.
- `mapa.html`: el mapa en vivo del sistema. No está en el menú, lleva `noindex`. Ver §6.

---

## 2. Rutas y links

### 2.1 Cómo enruta hoy

- **Por hash**, sin rutas de servidor (`app.js:265-281`). `ruta()` = el hash sin `#/` y sin lo que va
  después de `?`.
- `ir()` (`app.js:290-365`) se llama al cargar y en cada `hashchange`. Cierra paneles y visores,
  muestra la vista, pinta las que dependen de un parámetro, marca el menú, anima los bloques, vuelve
  arriba (o baja a un ancla) y pone el título de la pestaña.
- Primer segmento = vista. `ALIAS = { avisos: 'eventos', duelos: 'ranking', llave: 'eventos' }`
  (`app.js:288`). Un segmento que no es una vista cae al Inicio.
- Los parámetros se decodifican con `decodeURIComponent` dentro de `try` (un `%` suelto no rompe).
- Si el hash no es la vista (`#/avisos`), se busca un elemento con ese id y se baja hasta él
  (`app.js:352-355`).
- **Antes del enrutado** se lee la vuelta de Discord (`#access_token=…&state=…` o `#error=…`) y se
  limpia con `replaceState` (`volverDeDiscord()`, `app.js:5339-5440`; orden en `app.js:6370-6373`).
- Cloudflare Pages hoy contesta cualquier ruta desconocida con `index.html` (no hay `404.html`), así
  que `/lo-que-sea` muestra el Inicio.

### 2.2 Todas las rutas hash

| ruta | abre | notas |
|---|---|---|
| `#/` o vacío | Inicio | |
| `#/ranking` | Ranking (Temporada) | |
| `#/ranking/<sub>` | Ranking en esa pestaña | `temporada, competitivo, duelos, podios, rachas, paises, crews, mw, misiones, ligas` (`app.js:330-335`) |
| `#/duelos` | Ranking › Duelos | alias del menú viejo (`index.html:64-67`) |
| `#/publicaciones` | Publicaciones | pide `/api/muro` la primera vez |
| `#/pase` | Pase | |
| `#/tienda` | Tienda | pinta y prueba la billetera |
| `#/eventos` | Eventos | |
| `#/avisos` | Eventos, bajando a la campana | alias; lo usa `/card` |
| `#/avisos/<SV>,<SV>` · `#/avisos/todos` | Eventos + campana con servidores elegidos | el link de `/notify`; se aplica una vez (`campana.js:45-93`) |
| `#/llave/<n>` | Eventos + visor de llave `n` | si no viaja en el lobby, pide `/api/llaves` |
| `#/llave/v:<id>` | llave en vivo | sólo si ya se leyó; si no, no hace nada |
| `#/tarjetas` | Tarjetas | pinta el cara a cara |
| `#/mundo` | Mundo | |
| `#/guia` | Guía | |
| `#/cambios` | Changelog | carga `cambios.json` |
| `#/r/<clave>` | Perfil | acepta claves viejas y las corrige |
| `#/crew/<clave>` | Crew | `encodeURIComponent` |
| `#/pais/<cc>` | País | 2 letras, minúsculas |
| `#access_token=…&state=…` · `#error=…` | vuelta del login | se consume antes de enrutar |

Legales: `privacidad.html#en` y `terminos.html#en` eligen el inglés.

### 2.3 Links que ya circulan (hay que seguir abriéndolos)

**Los que arma el bot o el ciclo** (van en Discord o en notificaciones):

| link | dónde se arma | dónde aparece |
|---|---|---|
| `https://underlegends.pages.dev/#/avisos` | `bot/worker.js:795-799` (botón «Avisos» bajo cada `/card`, `worker.js:476`); `bot/avisos.js:175` y `:822` (botón «Avisos en tu teléfono» en cada aviso de evento que publica el vigía); `bot/avisos.js:2259`, `:2263` (textos de ayuda); `bot/avisos.js:2991` (simulacro) | Discord, notificaciones |
| `https://underlegends.pages.dev/#/avisos/<SV,SV>` y `…/#/avisos/todos` | `bot/worker.js:1517` (botón «Activar» de `/notify`) | Discord |
| `https://underlegends.pages.dev` (raíz) | `bot/worker.js:796` y `:2449` (`/website`); `bot/lunes.py:48`, `:178` (mensaje del lunes); `sheet/indice.py:40`, `:96` (índice del Sheet) | Discord, Sheet |
| `https://underlegends.pages.dev/#/r/<clave>` | `bot/avisos_personales.py:53`, `:104` (avisos «desbloqueaste tu tarjeta», «subiste de rango»); `bot/avisos.js:977` (avisos de gente que seguís). ⚠️ `cuerpoPersonal()` sólo acepta URLs que empiezan con `https://underlegends.pages.dev/` (`bot/avisos.js:1481-1485`) | notificaciones push |
| `/#/avisos` (relativo) | `bot/paginas/sw.js:44` (la notificación de prueba) | notificaciones |
| `https://underlegends.pages.dev/#/eventos` | `bot/subir_web.py:968` (URL del evento en el `.ics` cuando no tiene link) | calendarios suscritos |
| `https://underlegends.pages.dev/aviso.png` | `bot/avisos.js:816` (ícono del pie de cada aviso de evento en Discord); `sw.js:85` | Discord, notificaciones |

**Los que se publicaron a mano** (anuncios de la Liga): `https://underlegends.pages.dev/#/tarjetas`
(`docs/anuncios/2026-09-26_pedi_tu_tarjeta.json:65`), `…/#/avisos/todos`
(`docs/anuncios/2026-09-25_fase_de_prueba.json:97`), la raíz, y `…/ul.png` como imagen de los dos
anuncios.

**Los que comparte la gente**: `#/llave/<n>` (botón «Copiar el link de esta llave», `app.js:6216-6223`),
`#/ranking/<sub>` (queda en la barra al tocar una pestaña, `app.js:6021-6022`), `#/r/<clave>`,
`#/crew/<clave>`, `#/pais/<cc>` y cualquier vista.

**Los que no son hash**:

| URL | por qué no se puede mover |
|---|---|
| `/calendario.ics` (y `webcal://underlegends.pages.dev/calendario.ics`) | Google, Apple y Outlook ya se suscribieron a esa URL (`app.js:3166-3182`). También existe `/api/calendario.ics`. |
| `/privacidad` y `/terminos` | Cargadas en el portal de Discord y en el formulario de revisión de permisos (plazo 24/12/2026) (`docs/revision_discord.md:9-10`, `:29`). Hoy andan porque Pages sirve `privacidad.html` sin la extensión. |
| `/privacidad.html`, `/terminos.html` | Links de la página, del FAQ y de Mi cuenta (`app.js:5456`, `index.html:756`). |
| `/og.png` | `og:image` y `twitter:image` con URL absoluta: la vista previa del link en Discord (`index.html:19-26`). |
| `/ul.png`, `/ul-192.png` | Favicon, ícono de iPhone, PWA y anuncios. |
| `/aviso.png`, `/insignia-ul.png` | Ícono y badge de cada notificación (`sw.js:85-89`). El navegador guarda estos íconos: cambiar el nombre es la forma de forzar uno nuevo. |
| `/lobby` y `/lobby/` | Ruta vieja: 301 a `/` (`_worker.js:220-224`). |
| `/api/lobby` | La lee también `herramientas/web_vs_padron.py:47`. |
| `/api/avisos/*` | La usa también `herramientas/probar_avisos.py:47`, `:150`, `:207` (incluye `/api/avisos/simular`). |
| `/mapa.html` | El mapa del dueño. |

### 2.4 El dominio viejo

`liga-global.pages.dev` es otro proyecto de Pages. Su `_worker.js` contesta **301** a
`https://underlegends.pages.dev` + la ruta + la query (`bot/paginas_viejas/_worker.js:21-27`). El hash
no llega al servidor, pero el navegador lo conserva en la redirección: `liga-global.pages.dev/#/tarjetas`
termina en `underlegends.pages.dev/#/tarjetas`. No hay que tocarlo; sólo seguir aceptando las mismas
rutas hash.

---

## 3. Endpoints

### 3.1 Lo que pide la página

Todo lo de `/api/*` va al mismo origen y lo reenvía `_worker.js`. «Sesión» = la cookie `lg_ses`
(§4.3). «Permiso» = el token de Discord en memoria, mandado en el cuerpo como `token`.

| método | ruta | para qué | auth | quién la llama |
|---|---|---|---|---|
| GET | `/api/lobby` | el payload entero (~117 KB, ~26 KB comprimido) | pública | al abrir (`app.js:6416`) y cada 5 min con la pestaña visible, o al volver a ella si pasó 1 min (`app.js:6399-6414`, `6386-6389`) |
| GET | `/api/perfiles` | historial de cada perfil (`web:perfiles`) | pública | al abrir un perfil o Tarjetas, una vez (`app.js:3582-3591`) |
| GET | `/api/llaves` | todas las llaves (`web:llaves`) | pública | sólo con un link a una llave vieja (`app.js:1032-1043`) |
| GET | `/api/muro` | el muro de Publicaciones (`web:muro`) | pública | al abrir la vista; y en cada refresco si ya se abrió (`app.js:4569-4574`, `6405`) |
| GET | `/api/avisos/vivo` | texto crudo de llaves en vivo y veredictos | pública | cada 60 s si hay algo en vivo o un evento entre −5 h y +15 min; si no, cada 5 min; nunca con la pestaña oculta (`app.js:842-865`) |
| GET | `/api/avisos/encuestas` | votos por opción `{votos, t}` | pública | al abrir y en cada refresco, si hay encuestas (`app.js:4263-4274`) |
| GET | `/api/avisos/precios` | lo que vale cada cabeza `{precios, t}` | pública | al abrir y en cada refresco, si hay tienda (`app.js:4462-4473`) |
| GET | `/api/avisos/seguidores` | cuántos siguen a cada perfil `{n}` | pública | al abrir un perfil; caché de 5 min (`app.js:5000-5009`) |
| GET | `/api/avisos/servidores` | «tu servidor» de cada perfil `{n}` | pública | al abrir un perfil; caché de 5 min (`app.js:5065-5074`) |
| GET | `/api/avisos/clave` | la clave pública VAPID | pública | campana al activar y al arrancar (`campana.js:143`); `sw.js:138` |
| GET | `/api/avisos/estado` | qué canales escucha el vigía, suscripciones, último aviso | pública | campana al arrancar (`campana.js:437`); también `mapa.js:120` |
| POST | `/api/avisos/alta` | anotar este dispositivo `{sub, svs?, anterior?}` | ninguna (la suscripción es la llave) | campana (`campana.js:146-158`); `sw.js:143` |
| POST | `/api/avisos/baja` | borrar este dispositivo `{endpoint}` | ninguna | campana al desactivar (`campana.js:243`) |
| POST | `/api/avisos/probar` | mandar una de prueba `{endpoint}` | ninguna; 429 si se repite | campana (`campana.js:204`) |
| POST | `/api/avisos/vincular` | atar el dispositivo a tu Discord `{endpoint, token}` | **permiso** (el Worker pregunta a Discord) | a la vuelta del login modo `v` (`app.js:5234-5249`) |
| POST | `/api/avisos/desvincular` | soltar los avisos personales `{endpoint}` | ninguna | campana (`campana.js:256`); al salir (`app.js:5216-5229`) |
| POST | `/api/avisos/votar` | votar `{enc, op}` | sesión, o permiso | `votar()` (`app.js:4327-4344`) |
| POST | `/api/avisos/reportar` | error en una llave `{llave, que, texto}` | sesión, o permiso | `enviarReporte()` (`app.js:1271-1294`) |
| POST | `/api/avisos/precio` | poner un precio `{cabeza, monto}` | sesión, o permiso | `ponerPrecio()` (`app.js:4504-4522`) |
| POST | `/api/avisos/billetera` | tu saldo y tus precios `{}` | sesión, o permiso | `pedirBilletera()` (`app.js:4493-4503`) |
| POST | `/api/avisos/seguir` | seguir o dejar `{a: clave o [claves], si}` | sesión, o permiso | `alternarSigo()` y subida inicial (`app.js:4954-4998`) |
| POST | `/api/avisos/sigo` | a quién seguís y quién te sigue `{}` | sesión | `pedirSigo()` (`app.js:4984-4998`) |
| POST | `/api/avisos/mi-servidor` | leer `{}` o elegir `{sv}` tu servidor | sesión, o permiso | `app.js:5089-5119` |
| POST | `/api/cuenta` | quién sos `{token}` → abre la sesión (Set-Cookie) | **permiso** | a la vuelta de Discord (`app.js:5393-5439`) |
| POST | `/api/cuenta/redes` | leer o guardar tus redes `{token, mostrar?}` | **permiso** con `connections` | `pedirRedes()` (`app.js:5297-5303`) |
| POST | `/api/cuenta/foto` | vista previa o confirmar foto `{token, confirmar}` | **permiso** | `pedirFoto()` (`app.js:5254-5258`) |
| POST | `/api/cuenta/salir` | cerrar la sesión (borra la cookie) `{}` | sesión | `cerrarSesion()` (`app.js:5207-5212`) |
| GET | `/cambios.json` | el changelog | estático | `app.js:5610` |
| (link) | `/calendario.ics` | suscribir el calendario | estático vía Worker | `app.js:3166-3182` |

Cómo se pide con cuenta (`conCuenta()`, `app.js:4292-4320`): primero con la sesión; si da 401 y hay
permiso en memoria, se reintenta con él; si sigue en 401 y la acción lo pide, se guarda lo pendiente en
`sessionStorage` y se va a Discord. `DC_VUELTA` evita el bucle «volver a Discord» a la vuelta. Errores
comunes: `discord_ocupado` (503), `discord`, `sin_sesion`.

### 3.2 Lo que maneja `_worker.js` (proxy de Pages, modo avanzado)

`ORIGEN = https://liga-global-bot.liga-global-ul.workers.dev` (`_worker.js:37`). Lista **cerrada**, ruta
por ruta: nombrar un prefijo dejaría pasar cualquier ruta nueva, y `POST /` del Worker son las
interacciones de Discord (`_worker.js:23-26`, `39-44`).

| rutas | método | a dónde | caché | notas |
|---|---|---|---|---|
| 20 de `/api/avisos/*`: `clave, estado, vivo, encuestas, precios, seguidores, servidores` (GET) y `alta, baja, probar, simular, vincular, desvincular, votar, reportar, precio, billetera, seguir, sigo, mi-servidor` (POST) | el de la tabla; si no, 405 | `ORIGEN/avisos/<x>` | borde: `clave` 3600 s; `vivo`, `encuestas`, `precios` 30 s; `seguidores`, `servidores` 60 s. Navegador: GET `max-age=20`, POST `no-store` | POST hasta 4096 bytes (413). Pasa la cookie `lg_ses` como cabecera `x-lg-ses` (`_worker.js:45-138`) |
| `/api/cuenta`, `/api/cuenta/redes`, `/api/cuenta/foto`, `/api/cuenta/salir` | sólo POST | `ORIGEN/cuenta…` | `no-store` | hasta 2048 bytes; pasa `x-lg-ses`; **devuelve el `Set-Cookie` del Worker** (`_worker.js:89-95`, `191-204`) |
| `/api/lobby` | sólo GET | `ORIGEN/lobby?json=1` | borde 60 s; navegador `max-age=60, stale-while-revalidate=120` | (`_worker.js:146-175`) |
| `/api/calendario.ics` y `/calendario.ics` | cualquiera | `ORIGEN/calendario.ics` | borde 600 s; `max-age=900` | `text/calendar` (`_worker.js:180-190`) |
| `/api/perfiles`, `/api/llaves`, `/api/muro` | sólo GET | `ORIGEN/perfiles|llaves|muro` | borde 60 s; `max-age=60, swr=120` | (`_worker.js:207-218`) |
| `/lobby`, `/lobby/` | cualquiera | 301 a `/` | — | (`_worker.js:220-224`) |
| todo lo demás | — | `env.ASSETS.fetch(req)` | — | los estáticos (`_worker.js:226-229`) |

En total: **32 rutas exactas** más el reenvío a estáticos.

Del lado del Worker del bot (`bot/worker.js:3320-3404` y `bot/avisos.js:877-897`, `1283-1451`) existe
además `/avisos/inscritos`, que es sólo para el ciclo y **no** pasa por el proxy.

### 3.3 Pedidos a terceros

| a dónde | para qué | dónde |
|---|---|---|
| `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json` | el dibujo del mundo; se pide recién cuando el mapa entra en pantalla | `app.js:3238`, `3257-3272` |
| R2 `…/<clave>/<carta>.webp` con `fetch(mode:'cors')` | descargar una tarjeta | `app.js:2533-2557` |
| `https://discord.com/oauth2/authorize?…` | login (navegación, no fetch) | `app.js:5192-5204` |

---

## 4. Estado en el navegador

### 4.1 localStorage

| clave | qué guarda | quién | notas |
|---|---|---|---|
| `lg:ajustes` | `{tz, h12, calma}`: zona, formato de hora, menos animaciones | `app.js:88`, `6013` | se borra con «Olvidar…» |
| `lg:yo` | la clave del rapero que sos («quién soy») | `app.js:4914`, `5402-5403`, `5872` | sin Discord no autoriza nada |
| `lg:dc` | `{id, n, av, rapero, clave, cs[], bl[], ev, sv, cc, svs[]}`: quién sos según Discord | `app.js:5186`, `5398-5401` | **`mapa.js:95` lo lee para decidir si muestra el mapa** |
| `lg:sigo` | lista de claves que seguís (tope 200) | `app.js:4931-4939` | |
| `lg:sigo_srv` | `true` si lo local ya subió al servidor | `app.js:4933`, `4940-4943` | |
| `lg:votos` | `{idEncuesta: opción}` tu voto | `app.js:4262`, `4335` | nunca sale del navegador |
| `lg:podio` | la categoría elegida del podio | `app.js:1698`, `1704` | |
| `lg:cambios` | la última versión vista del changelog | `app.js:5607`, `5672` | |
| `campana:svs` | servidores de los avisos (`[]` = todos; `ZZZ` = Pruebas) | `campana.js:43`, `88`, `156`, `171`, `288` | |
| `campana:alta` | cuándo se anotó por última vez (re-alta cada 24 h) | `campana.js:157`, `453` | |
| `campana:activada` | que alguna vez se activó (esconde el aviso del Inicio) | `campana.js:317-318` | clave para iPhone: Safari y la app instalada no comparten suscripción |
| `campana:cerrada` | que se cerró el aviso del Inicio | `campana.js:233`, `319` | |
| `campana:yo` | `{id, n}`: este dispositivo está vinculado a tu Discord | `campana.js:244`, `257`, `363`; `app.js:5217-5218`, `5245` | lo escriben los dos archivos |
| `lg:idioma-legal` | idioma de las páginas legales | `privacidad.html:267-270`, `terminos.html` | |
| `mapa:orden` | vista ordenada del mapa | `mapa.js:553`, `786` | sólo el mapa |
| `lg:tema` | `clara` o `noche`, el tema del Inicio nuevo | `web/src/App.jsx`, `index.html` | el inline lo lee antes de pintar |
| `lg:historias` | `{id: firma}` las historias vistas | `web/src/App.jsx` | el verde vuelve si cambia la firma |
| `lg:instalar` | `no`: se cerró «La Liga en tu celular» | `web/src/arriba.jsx` (`Instalar`) | no vuelve a aparecer |

Todo va dentro de `try`: en ventana privada la página anda igual (`app.js:74-87`).

### 4.2 sessionStorage

| clave | qué guarda | dónde |
|---|---|---|
| `lg:estado` | el `state` del login (primera letra = modo) | `app.js:5199`, `5364` |
| `lg:voto` | el voto pendiente `{enc, op}` mientras vas a Discord | `app.js:4307`, `4330`, `5388-5391` |
| `lg:precio` | el precio pendiente `{cabeza, monto, volver}` | `app.js:4307`, `4507-4508`, `5358`, `5379` |

No hay IndexedDB ni Cache Storage.

### 4.3 La cookie

`lg_ses` (`bot/avisos.js:1137-1143`): `Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`
(**30 días**). Es un número al azar que sólo existe en el Durable Object (guarda su hash). La crea
`POST /api/cuenta`, la borra `POST /api/cuenta/salir`. El JS de la página no la ve. El proxy la lee con
una expresión regular (30 a 100 caracteres `[A-Za-z0-9_-]`) y la manda como `x-lg-ses`, sólo en los
POST (`_worker.js:97-104`). Por eso **la API tiene que seguir en el mismo origen, bajo `/api`**.

### 4.4 Service worker, push y permisos

- **Registro**: `navigator.serviceWorker.register('/sw.js')`, sin `scope` explícito, o sea scope `/`
  (`campana.js:166`, `432`). Se registra al arrancar si el navegador soporta push, aunque no se haya
  activado nada.
- **`sw.js` no tiene `fetch` handler, a propósito** (`sw.js:9-12`): no intercepta ni guarda nada. No hay
  caché offline. `install` → `skipWaiting()`, `activate` → `clients.claim()` (`sw.js:21-22`).
- **`push`** (`sw.js:65-97`): arma la notificación según `tipo`:
  - `prueba` → «🔔 Avisos activados», abre `/#/avisos`.
  - `evento` / `antes` → «🏆 / ⏰ nombre», servidor, «empieza en X (hora)», modalidad, cupos, premio;
    abre `d.url` (el anuncio en Discord).
  - `personal` → título y cuerpo que manda el vigía, abre `d.url` (`#/r/<clave>`).
  - otro → «Liga Global».
  - Ícono `/aviso.png`, badge `/insignia-ul.png`, `tag` por evento (reemplaza en vez de apilar),
    `renotify`, `lang: 'es'`. **Siempre muestra algo** (si no, el navegador quita el permiso).
  - Avisa a las pestañas abiertas con `postMessage({avisos:'llego', tipo})`; la campana lo usa para
    decir si la prueba llegó (`campana.js:181-198`).
  - La hora se escribe con el huso del dispositivo (el SW no ve `lg:ajustes`).
- **`notificationclick`** (`sw.js:99-119`): si la URL empieza con `/`, enfoca una pestaña del hub y
  navega; si no, abre ventana nueva (Discord abre su app en el teléfono).
- **`pushsubscriptionchange`** (`sw.js:133-149`): re-suscribe con la clave de `/api/avisos/clave` y
  avisa a `/api/avisos/alta` con `anterior`, para conservar los servidores elegidos.
- **Clave VAPID**: la suscripción queda atada a ella. Si cambia, la campana se re-suscribe sola al
  volver (`campana.js:441-452`). Las claves VAPID no se rotan con los demás tokens (`CLAUDE.md`).
- **El permiso se pide sólo con un clic** en «Activar avisos», nunca al cargar (`campana.js:14-17`,
  `160-175`).
- **Manifest** (`manifest.json`): `start_url "/"`, `scope "/"`, `display standalone`, fondo y tema
  `#030304`, íconos `ul-192.png` y `ul.png`. En iPhone, sin instalar no hay push.

### 4.5 El login con Discord, paso a paso

1. Botón «Entrar con Discord» (o una acción que lo pide). `urlLogin(modo)` arma
   `https://discord.com/oauth2/authorize?client_id=<DC_APP>&response_type=token&redirect_uri=<origen>/&scope=identify&prompt=none&state=<modo+azar>`
   (`app.js:5185`, `5192-5204`). Es el **flujo implícito**: no hay backend de OAuth ni secreto.
   - Modos (primera letra del `state`): `i` entrar, `r` redes (`scope=identify connections`,
     `prompt=consent`), `v` vincular avisos, `f` foto, `e` votar, `t` tienda. Seguir y «tu servidor»
     mandan `s`, que no está en la lista y termina como `i`.
   - El `state` se guarda en `sessionStorage lg:estado`.
   - `DC_APP` es el ID público de la app (no es secreto).
2. **La dirección de vuelta registrada en el portal de Discord es `https://underlegends.pages.dev/`**
   (`app.js:5182-5184`). Discord vuelve con `#access_token=…&token_type=…&expires_in=…&scope=…&state=…`.
3. `volverDeDiscord()` (`app.js:5342-5440`) corre **antes** del enrutado: lee el hash, lo reemplaza por
   el destino (`#/avisos` si vino a vincular, la tienda o la vista guardada si vino por un precio, `#/`
   en el resto), valida el `state`, y guarda el token **sólo en memoria** (`DC_TOKEN`) para los modos
   `r`, `f`, `e`, `t`. Nunca en el dispositivo.
4. Ejecuta lo pendiente (el voto o el precio) y manda `POST /api/cuenta {token}`. El Worker le pregunta
   a Discord `users/@me`, abre una **sesión de 30 días** (cookie `lg_ses`) y devuelve quién sos y tus
   cartas (`bot/worker.js:1274-1316`).
5. La página guarda `lg:dc` y `lg:yo`, pide a quién seguís (y sube lo local una vez), y repinta. Según
   el modo: vincula los avisos, muestra la foto o las redes, o se queda donde estabas.
6. Después, votar, reportar, precios, billetera, seguir y «tu servidor» usan la **sesión** (la cookie)
   sin volver a Discord. Foto y redes piden siempre un permiso nuevo.
7. **Salir** (`#yoOlvidar`): desvincula los avisos del dispositivo, `POST /api/cuenta/salir`, borra
   `lg:dc`, `lg:yo` y la lista local de seguidos (`app.js:5923-5938`). «Olvidar quién soy y mis ajustes»
   además borra `lg:ajustes`.

### 4.6 Temporizadores

- Relojes de cuenta atrás: cada 1 s (`app.js:6374`). Al llegar a cero, el evento pasa de «Lo que viene»
  a «En vivo» y se redibuja lo que depende de la hora (`app.js:381-416`).
- Lobby, encuestas, precios y muro: cada 5 min con la pestaña visible, y al volver si pasó 1 min. El
  lobby sólo se redibuja si cambió `sello`, y **sin** llamar a `ir()` (no cierra lo que tengas abierto)
  (`app.js:6392-6414`).
- Llaves en vivo: 60 s o 5 min, pausado con la pestaña oculta (`app.js:851-865`).
- Campana: re-alta cada 24 h al abrir (`campana.js:453-458`).

---

## 5. Recursos externos

| recurso | uso | dónde |
|---|---|---|
| Google Fonts: **Archivo** 400–900 y **Barlow Condensed** 500–700 | toda la tipografía | `index.html:33-36`; las legales piden Archivo 400/500/700/800/900 y Barlow 600/700; el mapa, lo mismo que el index |
| R2 público `https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev` (`D.r2`) | las tarjetas: `<r2>/<encodeURIComponent(clave)>/<carta>.webp?v=<versión>`; `carta` ∈ `temporada, competitivo, servidor, pais` y, sólo para tu cuenta, `bloq-*` | `app.js:187-192`; `preconnect` en `index.html:35`; `bot/subir_web.py:68` |
| CORS del bucket R2 | la descarga necesita `access-control-*`; hoy está limitado a los **dos dominios de Pages** | `app.js:2515-2532` |
| Discord CDN, avatares | `https://cdn.discordapp.com/avatars/<id>/<hash>.webp?size=64|128` (`f.av`, `DC.av`). Si da 404, se cambia por la inicial | `app.js:3444-3470` |
| Discord CDN, íconos de servidor | `https://cdn.discordapp.com/icons/<guild>/<hash>.webp?size=128`, llegan en `svs[].logo` | `bot/subir_web.py:1862`, `1950` |
| Logos locales | `logos/<sv>.webp` y `logos/crews/<clave>.webp`, **rutas relativas que vienen en el payload** | `bot/subir_web.py:1952`, `2076` |
| Banderas locales | `banderas/<cc>.png` (21×14 en tablas; 120×80 en la página de país) y `banderas/g/<cc>.webp` (podio de países, con respaldo a la PNG). Sólo para los 24 países de `PAIS` | `app.js:57-62`, `253-260`, `1653-1654`, `3552` |
| YouTube | miniaturas `https://i.ytimg.com/vi/<id>/hq720.jpg`, `sddefault.jpg`, respaldo `hqdefault.jpg`; links a los videos | `app.js:4124-4149` |
| jsDelivr `world-atlas@2` | el mapa del Inicio (TopoJSON dibujado a mano, sin librería) | `app.js:3238`, `3278-3331` |
| Google Calendar | `calendar.google.com/calendar/render?action=TEMPLATE…` (un evento, 90 min) y `…render?cid=webcal://…/calendario.ics` (suscribir) | `app.js:3112-3119`, `3166-3168` |
| Discord | links a anuncios, llaves y canales (`discord.com/channels/…`), invitaciones (`discord.gg`, `svs[].invita`). En **Android**, un clic se reescribe a `intent://…;package=com.discord;S.browser_fallback_url=…` para abrir la app | `app.js:3200-3215` |
| Redes de servidores y de la Liga | Instagram, YouTube, X, TikTok, Twitch, Kick, Spotify, Reddit, Bluesky, con íconos SVG propios | `app.js:4100-4119` |
| Imágenes propias | `ul.png` (512), `ul-192.png`, `og.png` (1200×630, la arma `herramientas/banner_link.py`), `aviso.png`, `insignia-ul.png` | ver §2.3 |
| Sólo el mapa | d3 7.9.0 de cdnjs, `api.github.com` y `raw.githubusercontent.com` del repo público | `mapa.html:303`, `mapa.js:28-29` |

No hay analytics, píxeles ni ningún script de terceros en el hub.

---

## 6. Lo que no se puede romper

Cada punto trae su evidencia. Los cinco primeros son los más caros de romper.

- [ ] **`/sw.js` en la raíz, con scope `/`**, y con los mismos manejadores `push`, `notificationclick` y
  `pushsubscriptionchange`. Las suscripciones que ya existen están atadas a ese registro y a la clave
  VAPID. **Sin `fetch` handler ni precaché**, por decisión (`sw.js:9-12`). Si un plugin de PWA genera
  otro service worker, tiene que conservar esto o las campanas activas dejan de sonar sin avisar.
  (`campana.js:166`, `432`; `sw.js` entero; contrato del cuerpo en `bot/avisos.js:1481-1485`.)
- [ ] **El login**: `redirect_uri` exacto `https://underlegends.pages.dev/` (registrado en Discord),
  flujo implícito con el token **en el hash**, leído **antes** del router; `state` en
  `sessionStorage lg:estado`; los modos `i r v f e t`. Un router que trate `#access_token=…` como ruta
  rompe el login. (`app.js:5182-5204`, `5339-5440`, `6370-6373`.)
- [ ] **La cookie `lg_ses` con `Path=/api`**: la API tiene que seguir en el mismo origen y bajo `/api`.
  (`bot/avisos.js:1137-1143`; `_worker.js:97-104`.)
- [ ] **El proxy `_worker.js`** con su lista cerrada (20 de avisos, 4 de cuenta, lobby, perfiles,
  llaves, muro, calendario, `/lobby` → 301) y el reenvío a estáticos. Pages en modo avanzado. Y se
  despliega como **campo aparte del multipart**, nunca como un archivo servible: si se sube como asset,
  `/api/lobby` devuelve el `index.html` con 200 y la página sale vacía sin fallar
  (`bot/paginas_subir.py:153-176`, `204-206`).
- [ ] **Las rutas hash que ya circulan** (§2.3): `#/avisos`, `#/avisos/<SV,…>|todos`, `#/r/<clave>`
  (también claves viejas), `#/llave/<n>`, `#/ranking/<sub>`, `#/duelos`, `#/eventos`, `#/tarjetas`,
  `#/crew/<clave>`, `#/pais/<cc>`, `#/cambios` y el resto de las vistas, más el salto al ancla de
  `#/avisos`. Si el remake pasa a rutas de verdad (`/r/<clave>`), los links con `#/` tienen que seguir
  abriendo lo mismo.
- [ ] **`/calendario.ics`** (y `/api/calendario.ics`): hay calendarios suscritos a esa URL
  (`_worker.js:180-190`).
- [ ] **`/privacidad` y `/terminos`** (sin `.html`): están en el portal de Discord y en el formulario de
  revisión con plazo 24/12/2026 (`docs/revision_discord.md:9-10`, `:29`). También `privacidad.html`,
  `terminos.html` y `#en`. Hoy andan porque Pages sirve el `.html` sin la extensión.
- [ ] **El manifest y la instalación**: `manifest.json`, `start_url "/"`, `scope "/"`, íconos. En iPhone
  los avisos sólo andan con la página instalada (`index.html:29-32`, `campana.js:31-38`).
- [ ] **Imágenes con URL fija**: `/og.png` (vista previa del link), `/aviso.png` (ícono de notificación
  y del pie de cada aviso en Discord, `bot/avisos.js:816`), `/insignia-ul.png` (badge), `/ul.png`
  (anuncios y favicon), `/ul-192.png` (PWA).
- [ ] **El mapa del dueño queda intacto**: `mapa.html`, `mapa.js`, `mapa_datos.js`, servidos tal cual en
  la raíz. Depende de `localStorage['lg:dc'].id` para mostrarse (`mapa.js:92-101`), así que **la clave
  `lg:dc` y su campo `id` no pueden cambiar de nombre ni de forma**. El despliegue compara su `DUENO`
  con el de `bot/worker.js` antes de subir (`bot/paginas_subir.py:96-118`). También lee
  `/api/avisos/estado`.
- [ ] **Las claves del navegador y su forma** (§4.1): `lg:dc`, `lg:yo`, `lg:sigo`, `lg:sigo_srv`,
  `lg:ajustes`, `lg:votos`, `lg:podio`, `lg:cambios` y `campana:*`. Si cambian, la gente pierde «quién
  soy», a quién sigue, sus ajustes y la elección de servidores de su campana, sin avisar. Si hay que
  renombrar, migrar al arrancar.
- [ ] **Rutas relativas que vienen en el payload**: `logos/<sv>.webp`, `logos/crews/<clave>.webp`
  (`bot/subir_web.py:1952`, `2076`), y las banderas `banderas/<cc>.png`, `banderas/g/<cc>.webp`.
  Tienen que resolverse desde la raíz. Con rutas de verdad (`/r/x`), un `logos/…` relativo se rompe:
  usar raíz absoluta o dejar el documento siempre en `/`.
- [ ] **Las tarjetas de R2**: la URL `<r2>/<clave>/<carta>.webp`, el `?v=` que evita la imagen vieja
  (`app.js:182-192`), la lectura de `cv` y `vj` en las dos formas (compacta y vieja) (`app.js:185-198`),
  y el **CORS del bucket** para descargar. Si cambia el dominio (o se prueban despliegues de vista
  previa), hay que sumarlo a la política de CORS.
- [ ] **El contrato del payload** (`bot/subir_web.py:445-543`): el remake lee `/api/lobby` tal cual; no
  se cambia de forma sin cambiar el constructor. Reglas que viajan como dato y se respetan en la página:
  `fc` (fuera de concurso: sin número, orden por `o`), `fo !== 0` (y no `=== 1`) para la galería,
  `nv` (sin verificar), `rg` vacío debajo de 10 eventos, colores de rango y de servidor **en el payload
  y no en el CSS** (`estilo.css:18-23`).
- [ ] **`cambios.json` estático en la raíz**, escrito a mano en cada tanda, con `version`, `dia`,
  `cuando`, `titulo`, `items`; el punto de «nuevo» compara versiones (`app.js:5618-5637`).
- [ ] **Las horas**: todas pasan por `fmtHora()`, `fmtFecha()` y `diaDe()` con la zona y el formato de
  Ajustes (`app.js:95-178`). El calendario pone cada evento **en el día de quien mira**. Las horas del
  payload llegan en UTC **sin zona**: hay que agregar la `Z` antes de leerlas (`app.js:6313-6320`).
  La bandera del país en vez de «EDT» sólo si coincide el desfase (`app.js:122-164`).
- [ ] **Comportamientos que parecen detalles y no lo son**: ninguna sección vacía («sin dato no hay
  pieza»); cada sección aislada con su `try`; con la API caída, un solo bloque «No pude cargar los
  datos»; nada de pedir el permiso de notificaciones sin clic; no refrescar con la pestaña oculta;
  redibujar sin cerrar lo abierto; `rel="noopener noreferrer"` en todo link externo; el `intent://` de
  Android para los links de Discord.
- [ ] **`llave_vivo.js`** conserva exactamente lo que lee: CI lo carga con `vm` y lo compara contra
  Python (`bot/llave_vivo_prueba.mjs:24` carga `paginas/llave_vivo.js` y espera el global `LlaveVivo`).
  Sin lookbehind en las expresiones (Safari < 16.4) (`llave_vivo.js:22-23`).
- [ ] **Scripts y pruebas que leen archivos del sitio** (se rompen si cambian las rutas):
  - `bot/probar_local.mjs:1533-1557`: saca de `paginas/app.js` y `paginas/campana.js` cada `'/api/…'`
    (y cada `pedir('x')`) y prueba que el proxy lo deja pasar; importa `paginas/_worker.js`.
  - `bot/llave_vivo_prueba.mjs`: ver arriba. Los dos corren en `chequeos.yml:92-95`.
  - `herramientas/web_en_borde.py`: sirve `bot/paginas/` y recorre las vistas por hash con pool vacío,
    uno sin tarjeta y API caída; exige que no quede ningún `.blk` vacío y el texto «no pude cargar los
    datos» (corre en `auditoria.yml:188`).
  - `herramientas/banderas_web.py:37-48`: **lee `var PAIS = {…}` de `app.js`** para armar las banderas.
  - `herramientas/logos_web.py:30` y `herramientas/banner_link.py:26-32`: escriben en `bot/paginas/`.
  - `bot/subir_web.py:1928`, `2056`: mira `bot/paginas/logos/` para decidir el logo.
  - `bot/pipeline.py:1165-1199`: el ciclo hashea `bot/paginas/` y, si cambió, despliega con
    `paginas_subir.py --aplicar`. Con un paso de build, el ciclo tiene que construir antes (o el hash y
    el despliegue tienen que apuntar a la salida del build).
  - `bot/paginas_subir.py:72-80`: sube **todo** lo que hay en `bot/paginas/` (incluye `mapa.*`,
    `cambios.json`, legales, imágenes).
- [ ] **El dominio viejo** `liga-global.pages.dev` sigue redirigiendo con 301 conservando ruta y query
  (`bot/paginas_viejas/_worker.js`). No se toca.
- [ ] **Decisiones del dueño para el remake** (en `NOVEDADES.md:349-358`): va con React (o un framework)
  y sin SSR; el remake **no toca las cartas**; la foto queda como hoy y se suma «ocultar mi foto» en
  Ajustes; primero el remake y después lo nuevo (Pase, Tienda); se planea juntos antes de arrancar.

---

## 7. Números

| qué | cuántos |
|---|---|
| Vistas (`data-vista`) | **13**: Inicio, Ranking, Publicaciones, Pase, Tienda, Eventos, Tarjetas, Mundo, Guía, Changelog, Perfil, Crew, País |
| Alias de ruta | 3 (`avisos`, `duelos`, `llave`) |
| Capas encima | 4 (visor de tarjeta, visor de llave, Mi cuenta, Ajustes) |
| Páginas HTML aparte | 3 (privacidad, términos, mapa) |
| Pestañas de ranking | 10 (7 con datos, 3 «pronto» o T2) |
| Formatos de llave que se dibujan | 4 (cuadro, por rondas, N vidas, nave de funa) + en vivo |
| Controles en el HTML fijo | 36 botones, 19 enlaces, 3 buscadores, 8 desplegables (FAQ), 31 términos de glosario |
| Tipos de control que dibuja el JS | ~46 (lista abajo) |
| Endpoints `/api` que usa la página | **27** (11 GET, 16 POST), más `cambios.json` y el link a `/calendario.ics` |
| Rutas exactas del proxy `_worker.js` | **32** (20 avisos + 4 cuenta + 8 otras) y el reenvío a estáticos |
| Rutas del proxy que la página no usa | 3: `/api/avisos/simular` (la usa `herramientas/probar_avisos.py`), `/api/calendario.ics` (alias), `/lobby` (301) |
| Claves de almacenamiento | **19**: 15 de localStorage (8 `lg:*` del hub, 5 `campana:*`, `lg:idioma-legal`, `mapa:orden`), 3 de sessionStorage, 1 cookie. Sin IndexedDB ni Cache Storage |
| Formatos de link al hub ya circulando | **9** con ruta: `/`, `#/avisos`, `#/avisos/<lista>|todos`, `#/r/<clave>`, `#/eventos`, `#/tarjetas`, `#/llave/<n>`, `#/ranking/<sub>`, `/calendario.ics`; más `/privacidad`, `/terminos` y las imágenes |
| Claves de primer nivel del payload (`/api/lobby`) | **37**; la página usa las **37** |
| Claves que se separan antes de subir | 2: `_perfiles` → `web:perfiles` (`/api/perfiles`) y `_llaves` → `web:llaves` (`/api/llaves`) (`bot/subir_web.py:2850-2851`) |
| Campos de cada fila de `tabla` | 31 (`n pos o fc sv cc pts ev rg rgc sc ovr wr pod oro seg ter sem crew k c cv vj fo rch caz czd sob ult av nv`); la página usa los 31 |
| Subcampos que viajan y nadie lee | al menos 5: `mw.id`, `mw.ini`, `mw.ant`, `mult.id`, `tienda.paso` |
| Funciones en `app.js` | ~976 |

**Las 37 claves del payload y quién las usa:**

| clave | la usa |
|---|---|
| `temporada` | pie, fase |
| `fase` | fase del Inicio, «Líder» o «Campeón», pie |
| `gente` | cifra de raperos; «#N de» del perfil (respaldo) |
| `oficiales` | «#N de M» del perfil |
| `tabla` | casi todo: ranking, perfil, tarjetas, tops, podio, buscadores, cuenta, llaves |
| `proximos` | Lo que viene, En vivo, Copa y dorado |
| `vivo_min` | cuánto sigue «en vivo» algo sin llave |
| `pasados` | Lo que pasó, ficha de la llave, cabecera de Eventos |
| `llaves` | visor de llave, Lo que pasó, calendario, últimos campeones, formatos, panel «Tu temporada» |
| `calendario` | calendario, cabecera de Eventos, «Tu temporada», ritmo de las llaves en vivo, próximos de Mi cuenta |
| `orgs` | el organizador con perfil y cara |
| `eventos` | cifra de eventos |
| `r2` | URL de las tarjetas |
| `cartas` | orden de `cv` y `vj` |
| `svs` | logos, colores, nombres, Mundo, chips, invitación, «tu servidor», leyenda del calendario |
| `paises` | cifra, chips, Mundo, podio, mejores por país, mapa, ranking y página de país |
| `rangos` | escalera de la Guía, pastilla de rango del muro |
| `duelos` | ranking Duelos, tops, podio |
| `rachas` | respaldo de «Rachas» en los tops |
| `crews` | Mundo, ranking, página de crew, tops, podio, mejores por crew, visor |
| `records` | récords bajo el podio |
| `mw` | tablero del Inicio, ranking Most Wanted, marcas en la llave, tops |
| `mult` | multiplicadores, ×N de cada evento, Copa, dorado |
| `enc` | El Elegido y el ×2 |
| `tienda` | Tienda, precio en perfil e Inicio, % del Most Wanted |
| `insignias` | catálogo del perfil |
| `rivales` | «Clásico» en llaves en vivo |
| `actividad` | «La Liga hoy», cabecera de Eventos |
| `comunidad` | «La comunidad» |
| `novedades` | Novedades de la Liga |
| `feed` | En las redes (YouTube) |
| `guia` | tabla de puntos, OVR y Score, pesos del radar |
| `redes` | «Seguí a la Liga» |
| `alias` | nombres de las llaves en vivo (AKAs) |
| `requisitos` | «Cómo conseguir tu tarjeta», los 10 eventos del Competitivo |
| `sello` | detectar un lobby nuevo; respaldo del pie |
| `leido` | «Datos actualizados hace X» |

**Los ~46 tipos de control que dibuja el JS** (para no olvidar ninguno): `data-carta`, `data-k`,
`data-crew`, `data-pais`, `data-llave` (número o `v:id`), encabezados `th[data-col]` (clic, Enter,
Espacio), chips `data-sv` y `data-cc` del ranking, pestañas `data-sub`, categorías `data-cat` del
comparador, buscadores `.cmp-busca` con sugeridor `.sug` (↑ ↓ Enter Escape), pestañas `.pest` del
visor, «Descargar» y «Ver su perfil», cerrar visores (✕, fondo, Escape), `data-lvista`, seguir en la
llave (hover o toque) con «Perfil» y `data-sigue-x`, `data-copiar-llave`, reporte (`data-rep-abrir`,
`data-rep-que`, texto, `data-rep-enviar`), arrastrar el cuadro, pestañas `data-pfc` y `#pfBajar` del
perfil, `data-foto`, `data-seguir`, buscador del Inicio, `#bCuenta`, `#bAjustes`, `#bAjustes2`,
`data-abrir-cuenta`, `#dcEntrar`, `#dcRedes`, casillas de redes, `#dcRedesGuardar`, `#dcRedesQuitar`,
`#dcFotoSi`, `#dcFotoNo`, `#yoOlvidar`, `#yoBusca` con `data-yo`, `data-misv` y `data-misv-ok`,
`#ajH12`, `#ajTz`, `#ajCalma`, `#ajBorrar`, votar `data-votar`/`data-op` y `.enc-busca`, tienda
`data-precio`/`data-monto`, `data-pr-sel`, `data-billetera`, `.pr-busca`, filtros `data-mufil` y
`#muroMas`, paginadores (multiplicadores `data-mp`, paneles `data-pn`, novedades, feed, podio
`data-pod`), calendario (`.cal-d` y flechas), `#evcCopia`, `#masCartas`, `#buscar`, `#buscarC`, la ✕
del aviso de la campana, la campana (`data-cp`: activar, probar, desactivar, vincular, desvincular;
chips de servidores y Pruebas), los desplegables («Los otros N», «O elegí tu nombre sin entrar») y
Escape global.

---

## 8. Rarezas

Cosas muertas, duplicadas o que sorprenden. Ninguna es urgente; conviene decidir cada una en el remake.

**Código muerto o sin uso**

- `pintaVigia()` de la campana escribe en `#secVigia` y `#vigia`, que **no existen** en `index.html`:
  la sección de «qué canales se revisan» nunca se ve (`campana.js:377-412`).
- `insignia.png` no la usa nadie (el badge actual es `insignia-ul.png`).
- `/api/avisos/simular` y `/api/calendario.ics` están en el proxy pero la página no los llama.
- Un comentario promete «las flechas del teclado» en el podio y no hay tal manejador
  (`app.js:6167`).
- Viajan en el payload y no se leen: `mw.id`, `mw.ini`, `mw.ant`, `mult.id`, `tienda.paso`.

**«Próximamente» y marcadores**

- La vista **Pase** entera es un cartel fijo (`index.html:436-449`).
- En **Tienda**, «La tienda abre pronto» convive con la billetera y el precio por cabeza, que sí andan
  (`index.html:462-471`).
- El panel 1 del Inicio arranca con un aviso fijo «Most Wanted · Misiones — Próximamente» que
  `pintaMW()` reemplaza cuando hay datos (`index.html:230-239`).
- Ranking: «Misiones» (pronto) y «Ligas» (T2); «Most Wanted» dice pronto hasta que hay buscados. La
  columna «Misiones» del ranking de Temporada siempre muestra «—» (`app.js:1880-1881`).
- Tops: Misiones, Ascenso y Ligas son cajas «Próximamente» (`app.js:3419-3425`).
- Guía: Histórica y Prime «Llega con la Temporada 2» (`app.js:2492-2495`).

**Inconsistencias**

- Seguir y «tu servidor» mandan el modo `s` a `urlLogin()`, que no lo conoce y lo trata como `i`: quien
  toca «Seguir» sin sesión vuelve de Discord al **Inicio** y no al perfil. El seguido igual se sube
  (queda en `lg:sigo`), pero la elección de servidor se pierde (`app.js:4963`, `5105`, `5196-5198`,
  `5360-5361`).
- El FAQ dice que de 3 a 11 AM «corre dos veces» (`index.html:736-738`); el pie dice «no se actualiza»
  (`app.js:6363`) y Mi cuenta dice «no corre» (`app.js:5270-5271`).
- `CLAUDE.md` habla de 24 llaves en el lobby y el código manda 12 (`bot/subir_web.py:88-96`), y describe
  «nueve vistas» (son 13 contando perfil, crew, país y changelog).
- La notificación muestra la hora del dispositivo y no la zona elegida en Ajustes: el service worker no
  puede leer `lg:ajustes` (`sw.js:24-37`).
- `ICS_HOST` usa `location.host`: en un despliegue de vista previa, el link del calendario apunta a la
  vista previa (`app.js:3110-3111`).

**Duplicados (candidatos a un solo lugar en el remake)**

- «Agregar la `Z` a una hora sin zona» está repetido en `empezo()`, `pintaRelojes()`, `cuandoSe()`,
  `edadMin()` y en varios `Date.parse(… + 'Z')`.
- `esc()`, `bytes()`, `leer`/`guardar` y un «hace X» propio están en `campana.js` además de `app.js` y
  `sw.js`.
- Tres listas de países: `PAIS` (`app.js:253-260`), `ZONA_PAIS` (`app.js:133-138`) e `ISO_NUM`
  (`app.js:3234-3237`), más `PAIS_DE_EMOJI` en `llave_vivo.js:63-70`.
- La lógica «el más cerca del Competitivo» está copiada en campeones, tops, podio y ranking.

**Pendientes que `NOVEDADES.md` deja para el remake**

- «La sección de llaves tiene que mejorar bastante» (`NOVEDADES.md:337`).
- Una llave en vivo escrita con menciones se ve con `<@123…>`: el vigía tendría que mandar los nombres
  (`NOVEDADES.md:2238-2242`).
- El lobby pesa 117 KB (26 KB comprimido); hay cuatro recortes medidos: campos vacíos por fila, el color
  del rango repetido en cada fila, la lista de tarjetas y la clave igual al nombre (~25 %)
  (`NOVEDADES.md:706-709`).
- Nueva en el remake: «ocultar mi foto» en Ajustes (`NOVEDADES.md:357`).

**Detalles que sorprenden pero son a propósito**

- El mapa del dueño **no es un candado**: se muestra si `lg:dc` dice que entró con su Discord; los datos
  que muestra ya son públicos (`mapa.js:15-18`).
- La galería de Tarjetas sólo muestra a quien tiene **cara**, pero el ranking muestra a todos.
- Hoy la T1 es casi toda de un servidor, así que la columna «Sv» y los chips de servidor se esconden
  solos; vuelven cuando haya gente de otro.
