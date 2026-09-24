# PRESET de la carta Servidor — 20/08/2026

**Esta es la versión vigente.** Se regenera con:

```bash
python 03_Servidor/disenos/todos_sv.py --div=F
```

⚠️ **El `--div=F` no es opcional**: sin él sale el divisor viejo de 1.9 px con
el acento, que se descartó. Es la única bandera que hace falta; todo lo demás
es el default.

---

## Los números que definen la carta

| pieza | valor | dónde vive |
|---|---|---|
| silueta | pico **300 × 405** (`ESTIRA = 0`) | `comun/siluetas.py` |
| exportación | **4×**, recortado a la tinta → **1200 × 1839**, 1:1.53 | `todos_sv.py` |
| divisor | 4.5 px, degradé **monocromo** del color del logo, puntas empalmadas al marco | `--div=F` |
| marco | `MK.oscuro` → `MK.claro` → `MK.oscuro`, sin metálico | `comun/marco.py` |
| número | 3 rem, `right: 26` | `SEP_NUM` |
| filas de stats | `right: 15`, paso 27, 5 filas desde y=126 | `SEP_FILAS`, `comun/pie.py` |
| título (escalón) | pastilla, relleno `claro`, borde `oscuro`, texto `tinta` | `comun/marco.py` |
| sello de temporada | `PRE`, vertical, `right: 9`, blanco 10%, 7.6 px | `TEMPORADA` |
| nombre | 1.5 rem, y **282.4** | `comun/nombre.py` |
| fila de círculos | **y 312**, flex centrado, diámetro por cantidad | `comun/pie.py`, `diametro()` |
| pastilla del puesto | **dos tercios afuera**, todo escalado con el diámetro | `POS_OPS`, CSS `.ar > b` |
| gema del rango | `rangos.icono()`, la pieza tallada completa, .74 del disco | `comun/rangos.py` |
| TAG | **centrado por carta**, ver abajo · alto **20** | `pie.tag_centrado()` |
| UL | y **371**, alto **17.4** (4.29 % del alto) | `comun/pie.py` |
| emblema | `BAJA = 5.5`, lado 66 | `comun/emblema.py` |

## La fila de círculos

Flex **centrado en la carta entera**. El diámetro sale de cuántos haya, con el
largo del grupo constante:

```
ANCHO_GRUPO 150 · tope 35 · piso 26
1–3 círculos → 35   ·   4 → 31   ·   5 → 26
```

⚠️ **El tope de 35 es vertical, no estético.** Del final del nombre al TAG hay
49.5 px y la tinta de la fila es el disco **más** la pastilla del número, que
cuelga una fracción del diámetro. A 42 la fila pisaba el TAG.

**El orden:** país · servidor · estilo · crew · **gema del rango**.

### La pastilla del puesto

⚠️ **Escala con el diámetro, y antes no lo hacía.** El círculo sí escalaba —lo
decide `diametro(n)`— pero la pastilla estaba clavada en píxeles. Con cinco
piezas el círculo baja a 26 y la pastilla de 21×11 tapaba el **81 % del ancho**
y el **21 % del disco**, justo la franja de abajo: de la bandera de Colombia
sobrevivía sólo el amarillo.

Ahora todo sale de `--d`. Y se apoya **dos tercios afuera** (`--pos=D`, el
default), que tapa **4.7 %**. Las otras tres opciones siguen disponibles:
`A` centrada encima 10.6 %, `B` esquina 2.3 %, `C` entera abajo 0 %.

⚠️ **Cada opción corrige la altura de la fila por la mitad de lo que cuelga**
(`POS_SUBE`). Sin eso, comparar las cuatro estaría arreglado: C y D se pisaban
con el halo del TAG mientras A y B no.

### El reparto vertical

⚠️ **Los tres huecos entre el nombre y el UL van parejos: 8.5 / 8.4 / 8.5.**
Antes eran 16.0 / 7.6 / 9.5 — la fila pegada al TAG y despegada del nombre.

Se mide contra la **tinta** del nombre (286.0), no contra su caja (290.4): es
mayúscula y no tiene descendentes. `huecos()` traía 292.0 clavado, 6 px de más.

### El TAG va centrado por carta

⚠️ **Su `y` depende del diámetro de los círculos.** El UL no se mueve y el
centro de la fila tampoco, pero **lo que baja la fila sí**: el disco crece con
cuántos círculos haya y la pastilla del puesto cuelga una fracción de ese
disco.

| círculos | diámetro | fin de la fila | TAG |
|---|---|---|---|
| 5 | 26 | 330.9 | 341.0 |
| 4 | 31 | 334.2 | 342.6 |
| 3 | 35 | 336.8 | 343.9 |

Un TAG fijo sólo puede estar centrado para **uno** de los tres casos. Se paga
que el TAG quede 3 px más arriba en unas cartas que en otras: la asimetría se
ve **dentro** de una carta (los dos huecos están uno al lado del otro) y el
corrimiento sólo se vería comparando dos cartas al lado.

⚠️ **Y hay cartas donde la fila no cuelga nada**: la pastilla del puesto sólo
se dibuja con el umbral de 3, y NFK tiene 2 en su servidor y Marcos 1. Dar por
hecho que siempre cuelga dejaba el TAG **5.25 px descentrado** en esas dos.

Verificado en las diez muestras: **la peor diferencia entre los dos huecos es
0.02 px**.

### La gema del rango

⚠️ **Es `rangos.icono()`, la misma pieza tallada de la Competitiva.** Era un
relleno plano y a 15 px se leía como mancha: se veía que había algo de color,
no *qué forma* tenía. Ahora trae degradé del acento, las facetas del material
—amatista, diamante, oro, rubí, esmeralda, zafiro, plata, bronce—, filo negro
por fuera y filo blanco por dentro. Son 33 caminos y **no se copian**: viven en
`comun/rangos.py` y de ahí salen las dos cartas.

⚠️ **Las ocho figuras se miden, no se eligen.** El método es el mismo que ya
usó `rangos.py` para tirar el primer juego: IoU de las siluetas, sin color, al
tamaño real. Estado hoy: **peor par 0.706 · promedio 0.558 · ninguno arriba de
0.75**. El primer juego se descartó con 0.847.

⚠️ **El cuadrado de plata se cambió por un lingote**, y por medición. Estaba
escrito que fuera «el único neutro, el que contrasta con los tres de arriba sin
parecerse a ninguno» — y ser neutro es **no tener dirección**, así que se
solapaba con todas: estaba en 3 de los 5 peores pares y contra el círculo daba
**0.82**, casi lo que hundió al juego anterior.

⚠️ **Y su escala se queda en 0.98.** La subí a 1.04 razonando que un lingote
ancho y chato «se ve más chico» — el número lo desmiente por los dos lados: la
presencia ganaba 11 % y el parecido con la esmeralda subía **26 puntos**, porque
las dos son anchas y agrandar una la mete dentro de la otra.

⚠️ **Ninguna figura toca el borde de su círculo**, y dos lo hacían. El
continente es **redondo** y la caja del SVG es cuadrada, así que el límite no
es el lado sino el radio de la **tinta** — que incluye el filo negro, porque
sale 4.5 unidades del camino. `rangos.R_TINTA` guarda cuánto llega cada una y
`icono(r_max=…)` baja a la que se pasa. Verificado: **aire mínimo 1.56 px** con
círculo de 26, 1.66 con 31, 1.97 con 35.

El bronce se salía y **el círculo lo recortaba**, que es peor que verse mal
porque el corte es limpio y redondo y parece parte del dibujo. La amatista
quedaba a 0.94 px, que a este tamaño es rozar.

⚠️ **El tope no empareja los radios, sólo baja al que se pasa.** Emparejarlos
dibujaría la estrella y el triángulo —que llegan lejos con poca tinta— tan
grandes como el círculo macizo.

⚠️ **El aro de la gema va del color del SERVIDOR**, igual que los otros cuatro.
Le había puesto el acento del rango razonando que la gema habla de la Liga —el
razonamiento es cierto y la conclusión estaba mal—: **el aro no es la pieza, es
el continente**, el mismo borde que el marco, la línea y el título. Lo que
identifica al rango es la figura de adentro, que sí conserva su acento.

## Lo que se probó y se descartó

| qué | por qué |
|---|---|
| estirar la carta a 485 | **la hace más chica en Discord** — el feed recorta por alto |
| gema al lado del número | obligaba a bajar el OVR de 3 rem a 2.6 y **repetía el rango**, que ya dice la pastilla |
| divisor blanco pleno | vale igual en los diez: la línea deja de decir de qué servidor es |
| divisor con el degradé del marco | su parada del medio **es el propio**, así que en una línea horizontal se funde con el panel |
| aro que mide | la Competitiva **ya lo probó y lo revirtió**: ampliado se ve como anillo roto |
| aro de la gema con el color del rango | partía la fila en dos grupos; el aro es continente, no pieza |
| gema con relleno plano | a 15 px se lee como mancha: se ve que hay algo, no qué forma tiene |
| costura punteada en el marco | a 77 % el hueco cae a 3.07 px y se empasta |

## Lo que falta

1. **Los cinco números de la columna no existen por servidor.** Son inventados.
2. **`ESTILO_DE` vacío** — nadie tiene estilo asignado.
3. **Fondos de DRA y EFA.** EFA solo se separa de SR **por luz**.
4. **Nombres de los cinco escalones** — entran ~8 letras.
5. **Logos de crew** — hay **2 de 17**: Follombia y KS, en `comun/logos_crew/`,
   generados por `herramientas/logos_crew.py` desde
   `herramientas/logos_originales/*_color.png`. Las otras quince siguen en **las
   dos primeras letras** (`SE` = Sexosos). Es un placeholder y conviene que se
   note que lo es.

   ⚠️ **Van con su color, y los iconos de Discord NO son la marca.** Procesé
   `follombia_icon.png` (blanco y negro) y salió una mano blanca; el logo de
   verdad es la mano rellena con la bandera de Colombia. Y el icono de KS es la
   lechuza sola: la marca lleva **además dos barras**, una de cada lado.

   ⚠️ **Follombia no se puede separar por color**: su fondo es la bandera y la
   mano es la misma bandera. Lo único que los separa es el **disco negro** del
   medio, así que se rellena el disco y se le resta lo oscuro.

   ⚠️ **Llevan filo oscuro, o medio logo desaparece.** El círculo se pinta con
   el tono del servidor y ese tono no es oscuro en todos: el rojo de la bandera
   da **1.04 contra URBF** y 1.08 contra TWR, el azul **1.12 contra FTN**, el
   gris de KS 1.27 contra FRZ. Es lo mismo que ya está anotado para las
   estrellas del Interserver. **No se resuelve devolviéndole su disco negro**:
   los otros cuatro círculos toman el tono de la carta y uno con fondo propio se
   leería como un agujero.
6. **`pos_pais`** — se dibuja con un total fijo de 24.
7. **FFA, EFA y RZ no tienen columna en el Sheet**, así que **nadie** puede
   quedar asignado ahí. Sus cartas están diseñadas y hoy no le tocan a nadie.
