---
name: Barda
direccion: 1 de 4
colors:
  fondo: "#F3EEE3"        # cal
  superficie: "#E8E0D0"
  papel: "#FFFFFF"
  tinta: "#1C1917"
  tinta2: "#4A443D"
  primario: "#1F3FBF"     # añil
  accion: "#C2330F"       # bermellón
  destaque: "#FFC21A"     # cromo (sólo relleno, nunca texto sobre cal)
  exito: "#1E8A50"        # verde loro
  crew: "#6B3FC4"         # uva
  noche: "#1A1C2E"        # fondo del modo oscuro
typography:
  titulos: "Bungee"                     # Google Fonts, OFL
  titulos_portada: "Bungee Shade"       # sólo en la portada
  texto: "Atkinson Hyperlegible Next"   # cifras tabulares en tablas
  escala_px: [12, 14, 16, 20, 25, 31, 39]
rounded: 2px
border: 2px solid tinta
shadow: "4px 4px 0 0 tinta"   # sombra dura, sin blur
spacing_px: [4, 8, 12, 16, 24, 32, 48]
---

# Liga Global — dirección «Barda»

## 1. Tema y atmósfera
El rótulo pintado a mano que existe en todos los países de la Liga: bardas
sonideras, carteles de almacén, pintas de barrio. La web es **la pared**; las
cartas (tarjetas estilo FIFA, oscuras y brillantes) son **los afiches pegados**
en ella. Se lee de un vistazo, como un cartel. Plano, directo, con oficio.

## 2. Paleta y roles
- Fondo cal `#F3EEE3`; superficies `#E8E0D0`; tarjetas de contenido en papel
  blanco con borde de tinta.
- Añil `#1F3FBF` es el color principal (navegación activa, enlaces, títulos de
  sección). Bermellón `#C2330F` es la acción (botones que hacen algo). Cromo
  `#FFC21A` marca el podio y lo destacado, **siempre como relleno con letra
  oscura**, nunca como texto sobre cal.
- Los **8 rangos** (SSS a E) tienen colores fijos que NO son de esta paleta:
  SSS `#C77DFF`, SS `#8FE8FF`, S `#FFD24A`, A `#FF6B7A`, B `#5CE6A5`,
  C `#6B8FE8`, D `#D8DEE8`, E `#C98A4B`. El rango va **siempre como caja
  pintada de ese color con la letra en tinta oscura adentro** y borde de 2 px.
- Modo oscuro «barda de noche»: fondo `#1A1C2E` (pizarra, no negro), texto
  `#F3EEE3`, añil claro `#8FA3FF`.

## 3. Tipografía
- Títulos y números grandes en **Bungee** (letra ancha de señalética, en
  mayúscula, frases cortas, 20 px o más). Sombra dura desplazada, como la letra
  sonidera.
- Texto en **Atkinson Hyperlegible Next**; en tablas, cifras tabulares.
- Nada de tipografías condensadas altas.

## 4. Componentes
- Botones: rectángulo de radio 2 px, borde 2 px de tinta, sombra dura 4 px;
  al tocar, la sombra desaparece y el botón baja 2 px. Mínimo 44 px de alto.
- Chips de filtro: rectángulos con borde; el activo, relleno añil y letra cal.
- Filas del ranking como pizarra de almacén: el puesto pintado en Bungee dentro
  de una caja; el top 3 con fondo cromo, bermellón y añil.
- Fila fija abajo con la posición propia.
- Avatares: monograma de 2 letras en un óvalo de rótulo.
- Íconos de trazo 2 px con puntas redondas.

## 5. Layout
Móvil primero (360 px), una columna, márgenes de 16 px. Barra inferior de 4
pestañas: Hoy, Eventos, Ranking, Yo.

## 6. Movimiento
Sólo CSS: la carta «se pega» en la pared (escala 1,04 → 1 y rotación −2° → 0).
Con `prefers-reduced-motion`, nada se mueve.

## 7. Restricciones duras
- SIN degradés, brillos, glassmorphism, blur ni sombras difusas.
- Radio 2 px (máximo 4). Nada de píldoras ni tarjetas muy redondeadas.
- Bordes de 2 px sólidos. Sombra dura sin desenfoque.
- Colores planos, sin texturas rasterizadas.
- Nada de fondo negro.

## 8. Anti-referencias
Copero (copero.com.ar y copero.org): fondo casi negro o verde oscuro, títulos
condensados en mayúscula tipo Bebas, tarjetas redondeadas con degradé, botones
píldora blancos, pastilla «LIVE» con punto, banderas con código de país. También
el look de plantilla SaaS: aurora, bento, glass, bordes animados.
