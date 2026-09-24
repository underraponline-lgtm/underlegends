# Diseños de la Servidor — dónde quedamos

Sesión del **29-30/07/2026**. Esto es exploración de diseño, **no** la carta
del proyecto: `normal_gen.py` y `normal_card.css` siguen como estaban.

---

## El concepto que se acordó

La Servidor se trata como **la camiseta de una selección**, no como un logo de
fondo. El reconocimiento lo hace el fondo y el marco; el logo aparece como
escudo, en su rol.

Salió de descartar el enfoque anterior: usar el logo grande como fondo no
funcionaba porque **un logo es una marca, hecha para leerse chica y aislada**.
Cada uno traía su propio problema — el anillo de texto del TFC se volvía ruido,
FFA funcionaba solo porque ya era una composición, y los de trazo no podían
llenar nada.

Investigado de los kits del Mundial 2026: motivo tonal sublimado sacado de la
identidad (Argentina lleva fileteado porteño; Francia la Estatua de la
Libertad), muy sutil, y **la historia codificada en el diseño** — Argentina usa
un degradé de tres tonos por sus tres mundiales.

---

## Las dos versiones guardadas

### `v9.py` → `v9.png` — **la base**

Cada servidor con su estructura de fondo. **Tres ya están aprobados**, el resto
se trabaja de a uno:

| servidor | fondo | estado |
|---|---|---|
| **TFC** | bandas horizontales anchas | ✅ **aprobado** |
| **SR** | corte diagonal naranja sobre negro | ✅ **aprobado** |
| **FFA** | **halftone** de puntos magenta + filo de neón + grano, con la **luz fosforescente subiendo desde el pie** | ✅ **aprobado** |
| **TWR** | franjas diagonales **a 215° (espejadas)** + fantasma de su silueta | ✅ **aprobado** |
| **FTN** | **banda dorada al sesgo, ancha y baja** sobre azul marino | ✅ **aprobado** |
| **FRZ** | **dos cortes al sesgo con los filos encendidos**, sobre degradé oscuro parejo, **sin textura** | ✅ **aprobado** |
| **URBF** | **corte blanco duro + rayones**. Era el único de los nueve sin textura ni gesto duro | ✅ **aprobado** |
| **DRA** | **textura de óxido + tres líneas al pie** | ✅ **aprobado** |
| **EFA** | **cuero fino sobre el cobre de su logo** (`#A95225`) + vivo al borde | ✅ **aprobado** |

### Los tres que se rehicieron al final, y qué los delató

**FFA**: la luz fosforescente estaba arriba al centro, **justo donde va el
emblema**, así que quedaba tapada. Es un error que solo aparece mirando el
fondo **con las piezas puestas**, no solo.

**URBF**: sus "tres capas de pegatina" eran tres degradés encimados sobre un
campo violeta grande y plano — más de lo mismo. Era el único de los nueve
**sin textura ni gesto duro**.

**EFA**: se sospechaba color, iluminación o textura, que son tres arreglos
distintos. Medidos los nueve fondos, EFA salía **9 de 9 en grano** (10.58
contra 8.23 del segundo) pero había cartas aprobadas más apagadas (FTN) y
más oscuras (FFA, TFC). Era la textura.

Después apareció lo de fondo: **`datos/colores_sv_marca.json` ya le asignaba
`#A95225` "del logo · cobre"** y la carta usaba `#3A2412` — **57.9 puntos de
luz de diferencia**. Cotejados los nueve contra el JSON, solo dos se apartan:
FRZ (−70.4, decisión tomada y anotada) y EFA (−57.9, que nadie decidió).

⚠️ **Dos trampas de medición de esa tanda:**

- Achicar el mosaico **sube** el grano, no lo baja: más chico es más
  frecuencia espacial. Lo que gobierna el grano es la **opacidad**. El
  mosaico chico igual mejora cómo se *lee* — cuero en vez de camuflaje —
  pero son dos preguntas distintas.
- Los números de `efa_grano.py` **no se comparan** con los de
  `medir_efa.py`: aquel mide un rectángulo plano y este el elemento ya
  recortado, así que la captura incluye lo que queda fuera de la silueta.
  Dentro de cada hoja sí se comparan entre sí.

⚠️ **Y una que rompió en silencio**: la clase `.cap` de `los_nueve.py` trae
`background-repeat: no-repeat`. Daba igual mientras todas las texturas usaran
`cover` o un porcentaje mayor a 100 — se dibujaban una vez y tapaban todo.
Con el mosaico de 150px de EFA dejó **un solo parche en el medio**. Cada capa
declara su propio `repeat`.

**LOS NUEVE FONDOS ESTÁN CERRADOS.** Lo que sigue son los marcos, también de
a uno, y **sin metal**: ese lenguaje es de la Competitiva, que usa seis paradas
de metal según el rango. Si la Servidor también fuera metálica, las dos cartas
de la misma persona se confundirían.

### ⚠️ La definición canónica vive en `los_nueve.py`

`los_nueve.py` → `los_nueve.png`. La función `defs()` tiene los nueve fondos en
CSS, uno por servidor. **Si algo se rehace, sale de ahí**, no de los scripts de
exploración: esos son la ronda en la que se eligió, no el resultado.

Los scripts de exploración quedan igual porque muestran **lo que se descartó**,
que es la mitad de la decisión. `frz_mezcla.py` guarda las seis mezclas del 5 y
el 6; `ffa3.py` las ocho variantes de neón; `twr_giro.py` los giros.

### Tres se rehicieron sobre el final

| servidor | antes | ahora | por qué |
|---|---|---|---|
| **TWR** | franjas a 126° | **215°, espejadas** | el rincón oscuro cae atrás del número, no al lado opuesto |
| **FRZ** | témpano + facetas de hielo | **dos cortes con filos encendidos, sin esmerilado** | era la única carta clara de las nueve, y el esmerilado la aclaraba más |
| **FFA** | degradé de neón | **halftone de puntos magenta** | quedaba muy cerca de TWR en valor y no tenía material propio |

**Sobre la mezcla de FRZ, para no repetir el error:** el 5 era **oscuro parejo
en toda la carta**. Al pedir "mezclá el 5 y el 6" yo le sumé la zona clara
grande del 6 dos veces seguidas, y con eso dejaba de ser una mezcla: pasaba a
ser **el 6 con textura**. Lo que hacía falta era conservar la oscuridad pareja
del 5 y sumarle **solo el corte** del 6. Después el esmerilado se sacó también.

## El salto de calidad: TEXTURAS GENERADAS

Hasta DRA, todos los fondos eran **degradés de CSS**: geometría plana. Por eso
todo se sentía del mismo material — literalmente lo era. Dlx lo dijo así: *"los
demás solo tienen trazos de línea"*.

La solución fue **generar texturas como imagen** con numpy (`texturas.py` y
`texturas2.py` → carpeta `texturas/`). Hay **16 disponibles**:

`concreto · spray · grietas · vetas · rayones · papel · trama · humo`
`tela · cuero · óxido · esmerilado · estática · craquelado · fibra · salpicadura`

Se aplican con `mix-blend-mode` (soft-light, overlay, screen) sobre el color
del servidor. Son combinables entre sí y con los gestos estructurales.

### Una hipótesis que la medición refutó

Creí que la diferencia entre Snake Rap y los últimos era el **contraste**. Lo
medí (`medir_contraste.py`) y no: **TFC es el más plano de los nueve** —
recorrido de luz 10 contra 163 de Snake Rap— y está aprobado. El contraste no
lo explicaba.

Lo que sí faltaba era **material**. De ahí las texturas.

### Sobre las líneas

La línea de Snake Rap **marca el borde de un corte**: existe porque separa dos
zonas. Copiarla en otro servidor los vuelve parientes.

Lo que sí es propio de una camiseta es el **vivo**: el ribete del cuello, el
puño, la franja. No divide, **remata**. DRA usa tres líneas al pie, que
funcionan como el puño de una manga.

⚠️ Si se usa perímetro, **la gema y el UL lo tapan** arriba y abajo. Hay que
decidir si lo interrumpen a propósito —como un escudo cosido sobre el ribete—
o si esas piezas se corren hacia adentro.

**Aprendido eligiendo TWR y FTN:**

- El **grano en mosaico** de la silueta solo funciona con logos **compactos**.
  El de Fontana es ancho y dice "FONTANA" completo: repetido da renglones de
  texto, no textura. El mismo tratamiento da resultados distintos según la
  forma del logo.
- Las tramas finas (guilloché, rombos, rayas) se ven bien grandes pero son las
  primeras en perderse cuando la carta baja a 300px. Los **gestos grandes**
  —una banda, una diagonal, un corte— sobreviven a cualquier tamaño.
- Conviene decidir **primero el fondo solo** y después verlo con el contenido:
  con la carta llena, el fantasma de TWR parecía un borrón y solo se entendió
  al verlo desnudo.

**El método**: primero los FONDOS de a uno, después los marcos de a uno. Cada
vez que se hicieron los nueve juntos salieron parecidos, porque era aplicar una
receta con variantes en vez de diseñar cada uno.

### `v11_marcos.py` → `v11.png` — **reconstrucción con capas**

Componente propio, 12 capas apiladas. Sirve como referencia técnica de cómo
armar profundidad, **pero el marco quedó metálico y eso está mal**: ver abajo.

---

## ⚠️ Lo que hay que corregir mañana

**El marco NO va metálico.** El metal es el lenguaje de la Competitiva, que usa
seis paradas de metal según el rango. Si la Servidor también es metálica, las
dos cartas de la misma persona se confunden. En v11 lo hice metálico por error.

**Se trabaja UN MARCO POR VEZ.** Intentar los nueve de una vuelta fue lo que
hizo que salieran todos parecidos. El plan es de a uno, sobre los fondos de v9.

---

## Lo que sí quedó resuelto

**Los escudos, normalizados** (`escudos_cuadrados.py` → `comun/escudos_cuad/`).
Cuadrados de 512×512 con esquinas redondeadas, normalizados por **fracción de
área con tinta**, no por caja. El FZ se veía forzado porque son dos glifos
macizos de 62% de densidad contra un crest de 82%: misma caja, peso óptico
distinto. Hay una tabla de ajuste manual (`AJUSTE`) para los cuatro donde la
fórmula no alcanza.

**Las estrellas van en fila horizontal ARRIBA del escudo.** Es la convención
real: arrancó Brasil en 1970 y la siguen todos los campeones.

**Los colores salen del logo, no de svColors.** Ver `datos/colores_sv_marca.json`.

**El layout comparado A vs B** (`comparar_AB_final.png`): ganó B, avatar chico
centrado. La razón no es estética: las cartas de FIFA Mobile ponen la foto
grande porque **el jugador está recortado sin fondo**. Nuestros avatares son
fotos rectangulares, así que agrandarlas tapa el fondo del servidor, que es
justo lo que estamos construyendo.

---

## Calidad de los logos

Cuatro se están **agrandando**, no reduciendo. Si llegan versiones en alta, ahí
se gana calidad real:

| servidor | tinta | escalado |
|---|---|---|
| URBF | 162×129 | **1.61×** |
| SR | 155×183 | **1.68×** |
| TWR | 251×252 | 1.32× |

TFC ya llegó en alta (1080×1080) y pasó a reducir 0.33×. El de Snake Rap es un
**GIF de 165 fotogramas**: se eligió el 43, midiendo cuál tenía más tinta viva.
El gif completo está en `comun/logos_color/sr_animado.gif` por si algún día la
carta es animada.
