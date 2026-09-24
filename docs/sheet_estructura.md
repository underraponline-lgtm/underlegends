# Cómo está armado el Sheet — el plano, no los datos

Levantado del Sheet de la **pre-temporada** el **16/09/2026**, leyendo sólo
estructura.

⚠️ **LOS DATOS DE ESE SHEET SE BORRAN Y NO SE USAN.** Dlx lo dijo dos veces:
*«era info de prueba»*. Este documento **no habla de los datos**: habla de
**cómo está construida la planilla** —hojas, cabeceras, tableros, el lobby— para
saber qué repetir, qué mejorar y qué eliminar en el Sheet nuevo.

Va junto con **`docs/sheet_t1.md`**, que es la otra mitad: *qué columnas* tiene
que tener. Éste es *cómo tienen que estar puestas*.

---

## 🔴 LO PRIMERO, Y EXPLICA TODO LO DEMÁS: EL SHEET NO CALCULA NADA

Medido celda por celda, pidiendo la fórmula en vez del valor:

| hoja | celdas con dato | cuántas son fórmula |
|---|---|---|
| Ranking Temporada | 881 | **0** |
| Ranking Competitivo | 480 | **0** |
| Ranking Podios | 360 | **0** |
| Ranking de Ligas | 218 | **0** |

**Cero.** Las únicas fórmulas de toda la planilla son cuatro `HYPERLINK` en el
Lobby y una en Mi Perfil.

⚠️ **O sea que el Sheet no es la fuente: es una VITRINA.** Todo se calcula
afuera y se pega adentro como texto. Eso explica por qué `competitivo.py` *«vive
del lado del Sheet»* y no está en este repo.

⚠️ **Y hay un Apps Script en la foto.** «Mi Perfil» es un
`=HYPERLINK("https://script.google.com/macros/s/…")`: una **web app** desplegada
aparte. El buscador de perfiles no es una fórmula, es código.

⚠️ **NO EXISTE NINGUNA HOJA DE DATOS CRUDOS.** Las ocho hojas son *salidas*: no
hay registro de eventos, ni de brackets, ni de combates. Lo que realmente pasó
vive **fuera de la planilla**, y la planilla sólo muestra el resultado.

**Consecuencia para el bot**: leer el Sheet es leer una vitrina de algo
calculado en otro lado. Si el pipeline del bot y el que llena el Sheet no salen
del mismo origen, van a discrepar — y nadie se va a enterar.

---

## El molde: las cuatro hojas de ranking son la misma hoja

Todas siguen exactamente el mismo patrón:

```
fila  1     título grande            🏆 RANKING TEMPORADA
fila  2     vacía
fila  3     subtítulo + "Actualizado: 10 julio 2026" + cuántos raperos
fila  4     fila de "pestañas" de ayuda   ¿QUÉ ES? · ¿CÓMO GANAS? · QUÉ CUENTA…
fila  5     párrafo de explicación
filas 6-7   vacías
filas 8-14  BLOQUE DE RÉCORDS / LÍDERES   (celdas mergeadas, texto compuesto)
fila  N-1   vacía
fila  N     LA CABECERA                   # · Rapero · Sv · Puntos · Ev · …
fila  N+1…  los datos
```

**Y por eso la cabecera cae en filas distintas:**

| hoja | cabecera | filas de dato | por qué ahí |
|---|---|---|---|
| Ranking Temporada | **16** | 735 | tiene el bloque de récords más alto (4 filas) |
| Ranking Competitivo | **12** | 138 | bloque de líderes de 3 filas |
| Ranking Podios | **11** | 264 | bloque de 2 filas |
| Ranking de Ligas | **9** | 32 | no tiene bloque de líderes |

⚠️ **LA CABECERA NO ESTÁ EN LA FILA 16 POR DISEÑO: ESTÁ AHÍ POR ACCIDENTE.** Su
número es la **consecuencia** de cuánta decoración se le puso encima. Agregar un
récord la corre. Y tres de los cuatro builders la tienen clavada como
`t[15]`, `c[11]`, `v[15]`.

---

## Los cinco problemas estructurales, en orden de lo que cuestan

### 1. 🔴 Cada hoja es dataset y afiche a la vez, y gana el afiche

Es la raíz de todos los demás. Una misma hoja tiene que servirle a una persona
que la mira y a un script que la lee, y esas dos cosas quieren lo contrario:
la persona quiere títulos, colores y celdas mergeadas; el script quiere la
cabecera en la fila 1 y un valor por celda.

### 2. 🔴 Las celdas mergeadas, y son muchísimas

| hoja | merges | filas | merges por fila |
|---|---|---|---|
| **Ranking Podios** | **553** | 496 | **1.1** |
| Ranking Mundial | 281 | 95 | 3.0 |
| Ranking de Ligas | 201 | 42 | 4.8 |
| Guía | 138 | 60 | 2.3 |
| Lobby | 66 | 500 | — |
| Ranking Temporada | 24 | 1000 | — |

⚠️ **Una hoja con más de un merge por fila de datos es un afiche, no una tabla.**
Y ya cobró: `construir_pool_mundial.py` arranca diciendo que el Mundial *«tiene
cabeceras distintas y filas vacías en el medio, por eso no se puede leer»* como
las otras. Necesitó su propio lector.

✅ **Ranking Temporada y Competitivo están bien** en esto: 24 y 21 merges, todos
en el banner de arriba, ninguno en la zona de datos. **Ése es el molde a
copiar.**

### 3. ⚠️ Cero filas congeladas. En las ocho hojas.

735 filas de datos y la cabecera se va de pantalla al primer scroll. Es un
`frozenRowCount` y no está en ninguna.

### 4. ⚠️ Los récords son texto compuesto, no datos

Una celda del bloque de récords dice, entera:

```
👑 Más campeonatos
Axinu 🇨🇴 — 24 🥇
```

**Eso es una frase escrita a mano, no un dato.** No se puede ordenar, ni
recalcular, ni verificar. Y como el Sheet no tiene fórmulas, **el día que Axinu
deje de ser el que más campeonatos tiene, ese cartel sigue diciendo que lo es**
hasta que alguien lo reescriba.

Lo mismo con `Actualizado: 10 julio 2026` en la fila 3: una fecha tipeada que
envejece sola.

### 5. ⚠️ El país viaja pegado al nombre

La columna `Rapero` guarda `Axinu 🇨🇴`, y el país sale de **parsear el emoji de
bandera**. Los builders hacen `re.sub(r'[\U0001F1E6-\U0001F1FF]', '', ...)` para
sacarlo y quedarse con el nombre.

⚠️ **Funciona, pero es dato metido adentro de una cadena de presentación.** Y
ese mismo campo trae `❓` cuando la persona no tiene país, que también hay que
limpiar a mano.

---

## Lo que SÍ conviene repetir en el nuevo

No todo está mal — estas cuatro son buenas y hay que conservarlas:

1. **La hoja Guía.** Documenta pesos, tablas de puntos, reglas, glosario y
   preguntas frecuentes. Es lo más valioso de la planilla y el repo no tenía
   nada de eso. ⚠️ **Pero tiene que salir de los mismos números que usa el
   sistema**, no de una transcripción: hoy la Guía dice cosas que el código
   contradice.
2. **El Lobby como portada.** Una hoja de entrada con enlaces a las demás está
   bien pensada. Sus `HYPERLINK` son de las pocas fórmulas que hay.
3. **Mi Perfil como buscador.** La idea de «escribí tu nombre y mirá lo tuyo»
   es exactamente lo que el bot va a hacer con `/perfil`. ⚠️ Y hoy vive en un
   **Apps Script** — conviene decidir si el bot lo reemplaza o convive.
4. **El molde de Temporada y Competitivo**: banner arriba, datos limpios abajo,
   sin merges en la zona de datos.

---

## 🎯 EL CAMBIO DE FONDO PARA EL SHEET NUEVO

**Separar DATOS de PRESENTACIÓN en hojas distintas.**

```
HOJAS DE DATOS            una tabla por cosa
                          cabecera en la FILA 1, congelada
                          sin banner, sin merges, un valor por celda
                          país en su columna, racha en dos columnas
                          -> las lee el pipeline y el bot

HOJAS DE PRESENTACIÓN     el afiche: títulos, récords, líderes, la Guía
                          leen de las hojas de datos CON FÓRMULAS
                          -> las mira la gente
```

⚠️ **Esa sola separación arregla cuatro de los cinco problemas de arriba:**

| problema | por qué desaparece |
|---|---|
| la cabecera flota | está en la fila 1 y nada puede empujarla |
| los merges rompen la lectura | la zona de datos no tiene ninguno |
| los récords envejecen | son fórmulas sobre los datos: no pueden discrepar |
| `Actualizado:` a mano | es una fórmula |

Y el quinto —país pegado al nombre— se arregla con una columna.

⚠️ **La hoja de datos puede estar oculta.** No tiene que ser linda: nadie la
mira. La planilla se sigue viendo igual de bien y deja de ser frágil.

⚠️ **Y una decisión que hay que tomar a la vez**: si el Sheet nuevo también va
a ser una vitrina de algo calculado afuera —que es lo razonable, porque
`competitivo.py` ya existe— entonces **lo que se pega son las hojas de datos**,
y las de presentación se calculan solas desde ahí. Hoy se pega el afiche
entero, que es por lo que hay que reescribirlo a mano cuando cambia.

---

## Inventario, para tenerlo a mano

| hoja | grilla | qué es | filas de dato |
|---|---|---|---|
| **Lobby** | 500×13 | portada con enlaces y récords | — |
| **Guía** | 60×15 | la documentación de todo el sistema | — |
| **Mi Perfil** | 500×12 | buscador, con un Apps Script detrás | — |
| **Ranking Temporada** | 1000×27 | la tabla principal | 735 |
| **Ranking Competitivo** | 495×30 | Score y las 5 dimensiones | 138 |
| **Ranking Podios** | 496×11 | oros, platas, bronces | 264 |
| **Ranking Mundial** | 95×15 | **no es tabla**: selecciones por país | — |
| **Ranking de Ligas** | 42×15 | formato FMS | 32 |

Ninguna oculta. Dos rangos protegidos.

⚠️ **Ranking Competitivo declara 30 columnas y la cabecera nombra 12.** Hay 18
columnas de grilla sin encabezado — o sobran, o hay algo sin rotular. En el
nuevo, la grilla debería terminar donde terminan las columnas.
