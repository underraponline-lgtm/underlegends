# Cómo muestra Discord las cartas — medido, no supuesto

Prueba real hecha el **09/08/2026** subiendo las cinco cartas al servidor DRA,
en PC y en móvil. Está acá porque **no hay documentación de Discord sobre
esto** — sus guías de tamaños cubren íconos de servidor, banners y emojis, no
cómo se muestra un adjunto dentro de un mensaje.

---

## Lo que decide todo: en el feed, Discord recorta por ALTO

Clava la altura de la vista previa y ajusta el ancho según la proporción del
archivo. O sea que **el archivo más alto se ve más angosto**.

Anchos medidos en móvil:

| carta | relación del archivo | ancho en el feed |
|---|---|---|
| Temporada 438 | 1:1.46 | **~640** ← la más grande |
| Competitiva | 1:1.45 | ~605 |
| Servidor 405 | 1:1.62 | ~576 |
| Temporada 485 | 1:1.62 | ~575 |
| Servidor 485 | 1:1.89 | **~500** ← la más chica |

⚠️ **La prueba de que es la proporción y no otra cosa**: `Servidor 405` y
`Temporada 485` tienen la misma relación —1:1.62— y se muestran al mismo
ancho, 576 y 575, **siendo dos cartas completamente distintas**. Lo mismo
arriba: Competitiva y Temporada 438 comparten 1:1.45 y se muestran igual.

**Consecuencia:** estirar una carta la hace más chica en el chat. La Servidor
a 485 perdió ~13% de ancho contra su versión de 405.

---

## ⚠️ Pero en pantalla completa recorta por ANCHO

Al tocar la imagen, las cartas llenan el ancho del teléfono y la más alta
ocupa **más** pantalla. Ahí el orden se invierte: `Temporada 485` se ve más
grande que `Temporada 438`.

**Las dos vistas premian cosas opuestas.** Manda el feed, porque es lo que se
ve scrolleando y la pantalla completa exige que toquen — una carta que se ve
chica en el feed no invita a tocarla.

---

## ⚠️ Varias cartas en un mensaje se RECORTAN

Discord las acomoda en grilla y las corta por arriba y por abajo. En la prueba
con dos Temporadas juntas **no se veía ninguna entera**: se perdían el número,
el pie y el UL.

**Regla para el bot: una carta por mensaje.** No es una preferencia estética,
es que en grilla la carta deja de mostrar sus datos.

---

## EL UMBRAL, Y POR QUE UNA CARTA VERTICAL TIENE TECHO

Dos investigaciones independientes —una de Claude y otra de Gemini— llegaron
al mismo mecanismo que habiamos medido, y aportaron el numero que faltaba.

La caja del feed en escritorio mide **~550 de ancho por ~350 de alto**. El
cociente **550/350 = 1.57** es la relacion donde una imagen choca contra los
DOS topes a la vez, o sea el unico punto donde ocupa el area maxima. **Y es
apaisado.**

De ahi sale la formula que sirve para cualquier diseño:

```
ancho mostrado = tope_de_alto x (ancho / alto del archivo)
```

Nuestra carta esta en 0.65 de ancho/alto, muy por debajo de 1.57, asi que
**siempre choca primero contra el alto**. A 350 de tope da ~228 px de ancho.

⚠️ **UNA CARTA VERTICAL NO PUEDE PASAR DE ~230 px DE ANCHO EN EL FEED, haga
lo que haga.** Los 17 px de ancho que se decidio no perseguir valian ~12 px
de pantalla. Esto cierra la discusion del tamaño con un techo, no con una
opinion.

### Lo que las investigaciones agregaron

- **El mecanismo del recorte en grilla tiene nombre y fecha.** Discord
  reemplazo en 2023 el apilado independiente por el "Media Mosaic", que usa
  `object-fit: cover` en vez de `contain`: recorta desde el centro para
  llenar la celda. En una carta con datos en los bordes eso decapita el
  numero, el pie y el UL. Confirma la regla de una imagen por mensaje, ahora
  con el porque.
- **El modo compacto no da un pixel extra.** `.mediaAttachmentsContainer`
  mantiene su `max-width: 550` aunque desaparezca el avatar.
- **El zoom del cliente es transparente**: escala todo en proporcion, no
  cambia que tope choca primero.

### ⚠️ Donde las fuentes son debiles, y hay que decirlo

- **El tope de alto NO tiene fuente solida.** Gemini lo dice textual: es "una
  heuristica del motor de renderizado", no una constante documentada, a
  diferencia de los 300 px del embed que si lo estan. Los 550 de ancho si
  salen de CSS inspeccionado.
- **Y nuestra medicion no da 350.** La Servidor a 405 se veia ~232 px de
  ancho con proporcion 0.616, lo que implica un tope de ~377. Puede ser
  imprecision al medir sobre una captura, o que el tope varie con el ancho de
  la ventana. **La formula vale igual; el numero exacto del tope, no.**
- Gemini afirma que en la grilla el motor AGRANDA las imagenes chicas. No se
  verifico y contradice la regla de no-upscaling que el mismo enuncia. Como
  se manda una por mensaje, no afecta.

---

## EL FORMATO QUE SE ADOPTA

```
diseño       300 x 405     la silueta, sin cambios
exportacion  4x, recortado a la tinta  ->  1200 x 1839   1:1.53
formato      PNG con alfa, ~1.0 MB
publicacion  adjunto DIRECTO, UNA carta por mensaje
```

**Por que 4x y no 3x.** En el feed sobra: Discord recorta a ~350 px de alto,
asi que 3x ya daba 3.9 veces ese tope. Pero **al tocar la imagen la carta
llena el ancho del telefono**, y el de la prueba mide 1179 px contra los 900
del archivo a 3x — se agrandaba 1.31 veces y salia blanda. Es el mismo error
que ya tuvimos con los avatares guardados a 128 y dibujados a 345. A 4x el
archivo mide 1200 y cubre los dos casos sin upscale, con 1.0 MB sobre un
limite de 10.

⚠️ **Adjunto directo, NO imagen de embed.** Un research posterior lo confirmo
con las cifras: la imagen de un embed se muestra a ~400 px de ancho como
maximo y el `thumbnail` a 80x80, contra los ~520-550 de un adjunto. Y los
campos width/height del embed no hacen nada — esta reportado en el bug tracker
de Discord. **Es una decision de arquitectura del bot, no de diseño**, y hay
que tenerla escrita antes de programarlo.

⚠️ **Lo que NO se persigue.** Llegar a 1:1.45 —la relacion de la Competitiva—
daria otro 5% de ancho mostrado, y cuesta rediseñar por donde sobresalen las
piezas. Se dejo pasar a proposito: el formato vertical ya esta en su mejor
punto y ese 5% no paga el trabajo.

Si algun dia se quiere presencia real en el chat, el camino no es estirar ni
achatar esta carta: es un **composite apaisado** —la carta al lado de sus
stats, en 16:9— que llena los ~520 px de ancho enteros. Es otro producto.

---

## Lo que esto implica para el diseño

1. **La dirección correcta es achatar, no estirar.** Cada punto de relación
   que baje el archivo, la carta se ve más grande.
2. **Lo que sobresale a los costados SUMA.** El archivo de la Competitiva mide
   1017 de ancho contra 900 de las otras, por los chips y rombos que cuelgan,
   y por eso se ve grande a pesar de ser la carta más alta. Ganar ancho de
   archivo es tan bueno como perder alto.
3. **Exportar a 3x sigue siendo correcto.** Discord escala hacia abajo y no
   agranda: un archivo a 300 px de ancho se vería a 300 y en pantalla HiDPI
   saldría blando.
