---
name: Fanzine de plaza
direccion: 2 de 4
colors:
  fondo: "#F2F2EF"        # papel blanco frío
  tinta: "#141414"        # negro de fotocopia
  riso_rosa: "#FF48B0"    # rojo riso fluo (acción)
  riso_azul: "#3255A4"    # azul riso (principal)
  riso_naranja: "#FF6C2F" # alternativa del rosa, para sellos
  gris_copia: "#D6D6D1"
  noche: "#16161A"        # fondo del modo oscuro
typography:
  titulos: "Anybody"          # ancho variable: titulares que se estiran
  datos: "IBM Plex Mono"      # números, tablas, fechas
  texto: "IBM Plex Mono"
  escala_px: [12, 14, 16, 20, 26, 34, 44]
rounded: 0px
border: 1.5px solid tinta
shadow: none
spacing_px: [4, 8, 12, 16, 24, 32, 48]
---

# Liga Global — dirección «Fanzine de plaza»

## 1. Tema y atmósfera
La batalla nace en la plaza: flyers fotocopiados, cinta, fibrón y sellos. La
web es un fanzine impreso en risografía: dos tintas que no calzan del todo,
grano de fotocopia, papeles pegados un poco torcidos. Hecho a mano, urgente,
de barrio.

## 2. Paleta y roles
- Papel `#F2F2EF` de fondo, tinta negra `#141414` para el texto.
- Azul riso `#3255A4` es el color principal; rosa riso fluo `#FF48B0` es la
  acción y lo que grita. Las dos tintas se **superponen con un desfase de
  2–3 px** en títulos y sellos (como una impresión que no calzó).
- Los **8 rangos** (SSS a E) tienen colores fijos que NO son de esta paleta:
  SSS `#C77DFF`, SS `#8FE8FF`, S `#FFD24A`, A `#FF6B7A`, B `#5CE6A5`,
  C `#6B8FE8`, D `#D8DEE8`, E `#C98A4B`. El rango va **siempre como caja
  pintada de ese color con la letra en tinta oscura adentro**.
- Modo oscuro: papel negro `#16161A` con tintas claras, como un flyer invertido.

## 3. Tipografía
- Titulares en **Anybody**, estirados a lo ancho como graffiti de letra, en
  mayúscula.
- Datos, tablas, fechas y texto en **IBM Plex Mono**, como planilla
  fotocopiada.

## 4. Componentes
- Sellos de goma para estados: «CAZADO», «ASCENDIÓ», «EN VIVO», «INSCRIPCIÓN
  ABIERTA», rotados 1–3°.
- Tarjetas de contenido como papelitos pegados con cinta, algunos rotados 1°.
- Tablas como planilla fotocopiada: líneas finas, cifras en mono.
- Fotos y avatares en semitono (puntos de trama).
- Botones: rectángulos sin radio, borde de tinta, relleno rosa riso o azul
  riso. Mínimo 44 px de alto.
- Fila fija abajo con la posición propia.

## 5. Layout
Móvil primero (360 px), una columna, márgenes de 16 px. Barra inferior de 4
pestañas: Hoy, Eventos, Ranking, Yo.

## 6. Movimiento
Sólo CSS: un sello que cae («golpe») al subir de rango o cazar a alguien.
Con `prefers-reduced-motion`, nada se mueve.

## 7. Restricciones duras
- SIN degradés, brillos, glassmorphism, blur ni sombras difusas.
- Sin esquinas redondeadas ni píldoras.
- El grano y el semitono, livianos (CSS o SVG chico, nada de imágenes pesadas).
- Nada de fondo negro en el modo claro.

## 8. Anti-referencias
Copero (copero.com.ar y copero.org): fondo casi negro o verde oscuro, títulos
condensados en mayúscula tipo Bebas, tarjetas redondeadas con degradé, botones
píldora blancos, pastilla «LIVE» con punto, banderas con código de país. También
el look de plantilla SaaS: aurora, bento, glass, bordes animados.
