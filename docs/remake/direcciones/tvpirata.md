---
name: En el aire (TV pirata)
direccion: 3 de 4
colors:
  fondo: "#1020C8"        # azul señal
  zocalo: "#000000"       # negro, sólo en los zócalos
  texto: "#FFFFFF"
  amarillo: "#FFE600"     # amarillo teletexto (acción y números)
  cian: "#00E5FF"         # secundario
  rojo_rec: "#FF2B2B"     # sólo el punto de ●REC
typography:
  marcadores: "VT323"         # pixel: números, marcadores, rangos
  marcadores_alt: "Silkscreen"
  texto: "Space Grotesk"
  escala_px: [14, 16, 18, 22, 28, 36, 48]
rounded: 0px
border: 2px solid texto
shadow: none
spacing_px: [4, 8, 12, 16, 24, 32, 48]
---

# Liga Global — dirección «En el aire» (TV pirata)

## 1. Tema y atmósfera
La Liga como un canal de TV pirata de barrio que transmite batallas: zócalos
de TV deportiva de los 80–90, páginas de teletexto numeradas, marcadores y
VHS de batallas grabadas. Colores primarios planos y letra de píxel.

## 2. Paleta y roles
- Fondo azul señal `#1020C8`; texto blanco.
- Amarillo teletexto `#FFE600` para lo importante: números, puesto, botones.
  Cian `#00E5FF` como secundario.
- Negro sólo en los **zócalos** (franjas de información abajo o arriba, como
  los carteles de TV).
- Los **8 rangos** (SSS a E) tienen colores fijos que NO son de esta paleta:
  SSS `#C77DFF`, SS `#8FE8FF`, S `#FFD24A`, A `#FF6B7A`, B `#5CE6A5`,
  C `#6B8FE8`, D `#D8DEE8`, E `#C98A4B`. El rango va **siempre como caja
  pintada de ese color con la letra en negro adentro**.
- Es de un solo tema (siempre «en el aire»).

## 3. Tipografía
- Números, marcadores, puestos y rangos en **VT323** (píxel), grandes.
- Texto de lectura en **Space Grotesk**.

## 4. Componentes
- En vez de una pastilla «LIVE»: un rectángulo «EN EL AIRE ●REC».
- El ranking como **página de teletexto numerada**: «P.101 TEMPORADA», con
  columnas alineadas en píxel.
- Barras de progreso hechas de bloques.
- Líneas de barrido (scanlines) muy sutiles sobre el fondo.
- Botones: rectángulos sin radio, relleno amarillo con letra negra. Mínimo
  44 px de alto.
- Fila fija abajo con la posición propia, como un zócalo.

## 5. Layout
Móvil primero (360 px), una columna, márgenes de 16 px. Barra inferior de 4
pestañas: Hoy, Eventos, Ranking, Yo.

## 6. Movimiento
Sólo CSS: cambio de canal (un corte seco) entre pantallas. Con
`prefers-reduced-motion`, nada se mueve.

## 7. Restricciones duras
- SIN degradés, brillos, glassmorphism, blur ni sombras difusas.
- Cero esquinas redondeadas o biseladas. Nada de píldoras.
- Colores primarios planos.
- El negro sólo en los zócalos, nunca como fondo general.

## 8. Anti-referencias
Copero (copero.com.ar y copero.org): fondo casi negro o verde oscuro, títulos
condensados en mayúscula tipo Bebas, tarjetas redondeadas con degradé, botones
píldora blancos, pastilla «LIVE» con punto, banderas con código de país. También
el look de plantilla SaaS: aurora, bento, glass, bordes animados.
