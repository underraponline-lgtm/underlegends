---
name: Calle (Under Legends)
direccion: 5 — después de que ninguna de las cuatro convenciera (29/09/2026)
colors:
  # los del logo de Under Legends (bot/paginas/ul.png), medidos píxel a píxel
  negro: "#030304"
  verde_agua: "#29B298"   # sobre claro NO va como texto (2,65:1): relleno con letra negra (7,42:1)
  magenta: "#E41373"      # texto sobre blanco 4,53:1; blanco sobre magenta 4,53:1
  blanco: "#F6F6F6"
  papel: "#FFFFFF"
  cemento: "#EDEDEA"      # la pared donde va la carta
typography:
  titulos: "Archivo, ancho 125, peso 900"   # la letra de la marca (og.png), ensanchada
  texto: "Archivo, ancho 100, pesos 400 a 700"
  etiquetas: "Space Mono, 700, mayúscula"
rounded: 0px
border: 2px solid negro
shadow: none
---

# Under Legends — dirección «Calle»

## De dónde sale
- Dlx, 29/09/2026: *«Ninguna me gusta… podrías usar los colores de UNDER LEGENDS, quizás así como RED BULL usa sus colores para todos»*.
- Drako: *«Hazle estilo callejero minimalista»*.

## 1. Tema
Una marca de calle, minimalista. Los colores de Under Legends van en todo, como Red Bull con los suyos: negro, verde agua y magenta, con mucho blanco alrededor. Letra ancha y pesada, etiquetas en mono como las de la ropa, y un sticker de vez en cuando. Nada decorativo que no diga algo.

## 2. Paleta y roles
- **Base clara**: blanco y negro. El verde agua y el magenta se usan en bloques de color plano, nunca en degradé.
- **El verde agua es relleno, no texto**: sobre blanco no se lee (2,65 a 1). Con letra negra encima sí (7,42 a 1).
- **El magenta** es la acción («Quiero aviso», «Compartir») y lo que grita (el precio de un buscado, «EN VIVO»).
- **La barra partida** verde agua | magenta, como la de `og.png`, es la firma de la marca: arriba de todo.
- **Los 8 rangos** mantienen sus colores fijos (`comun/rangos.py`), como caja pintada con la letra oscura.
- **La versión de noche** usa negro de base: ahí el verde agua sí va como texto (7,42 a 1) y el magenta sólo en letra grande o de relleno con blanco.

## 3. Tipografía
- **Títulos y números** en Archivo ensanchada (ancho 125) y peso 900, en mayúscula. Es la letra que ya usa la marca en `og.png`, pero ancha y no condensada.
- **Etiquetas** en Space Mono, en mayúscula y con aire entre letras, como una etiqueta de ropa: «01 — PRÓXIMO EVENTO».
- **Nada condensado alto**: eso es lo que la acerca a Copero.

## 4. Componentes
- Secciones separadas por una raya negra de 2 px, con la etiqueta encima. Sin tarjetas flotando.
- Botones rectangulares: negro con letra blanca, o magenta para la acción. Nada de píldoras.
- El puesto del ranking, en número ancho y grande. El 1 va en verde agua, el 2 en magenta y el 3 en negro.
- El sticker del dragón de UL aparece en la carta del perfil, pegado en la esquina, y en ningún otro lado.
- «EN VIVO» es un rectángulo magenta con un cuadrado, no una pastilla con punto.

## 5. Layout
En el celular (360 px de ancho), una columna con márgenes de 16 px y barra de abajo de 4 pestañas. En la computadora, el menú va al costado.

## 6. Restricciones duras
- Sin degradés, brillos, blur, glass ni sombras.
- Cero radios.
- Letra ancha, nunca condensada.
- El fondo general, claro (salvo la versión de noche).

## 7. Anti-referencias
Copero y la web de hoy comparten los colores de la marca. Lo que los separa es el fondo claro, la letra ancha, las formas rectas, las etiquetas en mono y los stickers.
