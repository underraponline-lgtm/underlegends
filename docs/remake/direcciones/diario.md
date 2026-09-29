---
name: Diario deportivo
direccion: 4 de 4
colors:
  fondo: "#EDEAE2"        # papel de diario
  papel: "#FFFFFF"        # recuadros
  tinta: "#111111"
  rojo_tapa: "#D7141A"    # principal y acción
  resaltador: "#FFE14D"   # un solo acento amarillo
  gris: "#6B6860"
  noche: "#15161A"        # fondo del modo oscuro
typography:
  titulares: "DM Serif Display"   # serifa de alto contraste, en frase
  titulares_alt: "Fraunces"
  tablas: "Inter Tight"           # cifras tabulares
  texto: "Inter Tight"
  escala_px: [12, 14, 16, 20, 26, 34, 46]
rounded: 0px
border: 1px solid tinta
shadow: none
spacing_px: [4, 8, 12, 16, 24, 32, 48]
---

# Liga Global — dirección «Diario deportivo»

## 1. Tema y atmósfera
Cada fecha es una tapa de diario deportivo latinoamericano: titulares de
impacto, fotos recortadas en silueta, tabla de posiciones, recuadros. Y la
carta como figurita de álbum. Editorial, con jerarquía de tapa.

## 2. Paleta y roles
- Papel de diario `#EDEAE2` de fondo, recuadros en blanco, tinta negra.
- Rojo tapa `#D7141A` es el color principal y la acción. Un solo acento
  amarillo `#FFE14D`, como resaltador sobre texto.
- Los **8 rangos** (SSS a E) tienen colores fijos que NO son de esta paleta:
  SSS `#C77DFF`, SS `#8FE8FF`, S `#FFD24A`, A `#FF6B7A`, B `#5CE6A5`,
  C `#6B8FE8`, D `#D8DEE8`, E `#C98A4B`. El rango va **siempre como caja
  pintada de ese color con la letra en tinta oscura adentro**.
- Modo oscuro: `#15161A` con texto papel.
- Para no parecerse al crema de copero.org: más blanco y rojo, y nada de lima.

## 3. Tipografía
- Titulares en **DM Serif Display** (serifa de alto contraste), en frase y no
  en mayúscula.
- Tablas y texto en **Inter Tight**, con cifras tabulares.
- Los números grandes (puesto, puntos) como «cifras de tapa» en serifa.

## 4. Componentes
- Columnas y filetes finos, como la maqueta de un diario.
- Recuadros: «La figura de la semana», «Resultados de ayer».
- Fotos recortadas en silueta; avatares como figurita con borde blanco.
- La tabla del ranking como tabla de posiciones de diario.
- Botones: rectángulos sin radio, rojo tapa con letra blanca. Mínimo 44 px de
  alto.
- Fila fija abajo con la posición propia.

## 5. Layout
Móvil primero (360 px), una columna, márgenes de 16 px. Barra inferior de 4
pestañas: Hoy, Eventos, Ranking, Yo.

## 6. Movimiento
Sólo CSS, mínimo. Con `prefers-reduced-motion`, nada se mueve.

## 7. Restricciones duras
- SIN degradés, brillos, glassmorphism, blur ni sombras difusas.
- Sin esquinas redondeadas ni píldoras.
- Nada de fondo negro en el modo claro. Nada de verde lima.

## 8. Anti-referencias
Copero (copero.com.ar y copero.org): fondo casi negro o verde oscuro, títulos
condensados en mayúscula tipo Bebas, tarjetas redondeadas con degradé, botones
píldora blancos, pastilla «LIVE» con punto, banderas con código de país. También
el look de plantilla SaaS: aurora, bento, glass, bordes animados.
