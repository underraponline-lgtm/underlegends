# La Servidor — estado al 07/08/2026

⚠️ **Y ya se puede dibujar para gente de verdad**: `03_Servidor/generar.py`
ensambla esto para cualquiera de las 138 desde `datos/`. Lo que sigue
describiendo este documento es lo que esa carta dibuja.

# ⚠️ ESTA NO ES LA VERSIÓN FINAL

**Falta el marco, faltan casi todos los datos, y hay dos ideas abiertas que
todavía no se dibujaron.** Lo cerrado está marcado como cerrado; lo demás
no lo está.

---

## LA CARTA HOY, DE ARRIBA A ABAJO

```
                    ┌── el emblema sobresale por la punta ──┐
   estrella(es)     ·  20 px, hueco 36% de la estrella
   escudo           ·  66 px, baja 6, aro en degradé del borde
   ────────────────────────────────────────────────────────────
   la foto          ·  zoom 115%, pos 0.44
                       recortada CON la curva del divisor
   ────────────────────────────────────────────────────────────
   la COLUMNA       ·  derecha, 56 px, lavado B (13/25/43)
     el número      ·  y 46, 3rem, con filo
     TÍTULOS        ·  y 118, paso 27
     PODIOS
     RACHA          ·  par 8/12
     DUELOS         ·  par 9/14
     EVENTOS
   ────────────────────────────────────────────────────────────
   el divisor       ·  extremos 66.366% del alto, recorrido 4.658% del ancho
   el nombre        ·  y 282.4, se achica por largo
   el PIE           ·  y 326 — bandera · COMPET · TEMPOR · SERVIDOR · figura
   el UL            ·  y 364, alto 20.7
```

**Dos zonas, dos criterios**, y esto ordena todo lo demás:

| zona | mide | qué lleva |
|---|---|---|
| **la columna** | **cuánto** — acumulación | OVR sv · títulos · podios · racha · duelos · eventos |
| **el pie** | **calidad** — Score | país · 3 puestos · rango |
| el emblema | de dónde sos | escudo · estrellas del Interserver |

---

## ⚠️ LAS DOS IDEAS ABIERTAS (07/08/2026)

### 1. La carta no tiene TAG y debería

Las otras dos sí: la Temporada lleva la pastilla dorada («DINASTÍA») y la
Competitiva la suya («#1 COMPETITIVO»). **La Servidor no lleva ninguna.**
No está decidido qué diría ni dónde va.

### 2. Un rango PROPIO DEL SERVIDOR, debajo del número

Dlx: *«mirá cómo está la tarjeta competitiva: debajo del número está el
rango, su label. Acá podríamos hacer lo mismo pero con un rango diferente,
no del competitivo sino algo más del servidor — por ejemplo campeón,
leyenda»*.

Pasó capturas de escaleras de roles de servidores reales. **Son ejemplos, no
la escalera a usar.** Las dos formas que aparecen:

```
por CAMPEONATOS ganados          por PUNTOS
  CAMPEÓN              1           DIOS          +999
  GRAN CAMPEÓN         3           DEIDAD     901-998
  ILUMINADO            5           INVICTO    851-900
  MAESTRO              8           DRAGÓN     791-800
  GRAN MAESTRO        11           …
  ESPÍRITU SUPERIOR   14           ORO I      146-160
  PRIMORDIAL          17           PLATA III  116-130
  ELITE               22           BRONCE I    41-45
  PORTADOR DE ALMAS   30           ROOKIE       3-5
  PROTECTOR CUÁNTICO  40           ASPIRANTE    1-2
  …hasta AZAThoth 300
```

**Lo que ya se sabe y hay que tener en cuenta antes de dibujarlo:**

⚠️ **La escalera por campeonatos diría dos veces el mismo número.** La
columna ya lleva **TÍTULOS**. Un rango basado en campeonatos sería el conteo
y su nombre — que es *exactamente* lo que hace la Competitiva (el 91 y su
«RANGO SSS»), así que **es coherente**, pero hay que decidirlo a sabiendas,
no descubrirlo después.

⚠️ **Esas escaleras son de cada servidor, no de la Liga.** Las capturas son
de servidores distintos con escaleras distintas. Si la carta muestra un
rango de servidor, **el label lo define el servidor y no nosotros** — y eso
es nuevo: hasta hoy todo lo que la carta dibuja sale de la Liga. Habría que
decidir si la escalera es **una sola para todos** (la inventamos nosotros) o
**la de cada servidor** (y entonces el bot tiene que traerla).

⚠️ **Y si es una sola para todos, choca con el umbral de 3.** Un «CAMPEÓN
con 1 título» es alcanzable en un servidor de 1 persona. La escalera tendría
que estar pensada para que el escalón más bajo signifique algo.

### ⚠️ QUÉ MIDE EL OVR — `03_Servidor/disenos/ovr_que_mide.py`

Dlx: *«no todo tiene que estar relacionado a campeonatos… ¿quizás por
overall? pero necesitamos decidir también qué va a medir el overall»*.
Tiene razón en las dos: **el número grande hoy está inventado**, y colgarle
una escalera sin decidir qué mide es construir sobre nada.

**Medido leyendo el Sheet** (las 7 columnas por servidor no están en ningún
pool: `construir_pool_temporada.py` las usa en la línea 110 para el argmax y
en la 120 para contar, **y después las tira**).

⚠️ **Partido por servidor, el Sheet tiene UN solo ingrediente de los cinco.**
El OVR de temporada es `PTS 36% · EVT 20% · WR 16% · POD 16% · CAZ 12%`.
De esos, **solo los puntos existen por servidor**. Los otros cuatro son
totales de la persona, así que copiar la fórmula daría una carta con 36% de
sus ingredientes y **el 64% restante idéntico en las diez cartas** de esa
persona. Eso descarta copiar la fórmula, no es un detalle de implementación.

**Entonces el OVR de la Servidor mide PUNTOS EN ESE SERVIDOR.** Es lo único
que existe, y además cumple la regla del proyecto: el número de cada carta
mide lo que esa carta mide.

⚠️ **Y ESO RESUELVE LA CONTRA DE LA ESCALERA — pero solo con tope fijo.**
Los puntos no se pierden nunca, así que una escalera colgada de ellos no se
cae. **Pero depende del tope por el que se divide**, y ahí me equivoqué
primero: simulé el modo absoluto dejando el tope quieto y me dio que no baja
nadie — lo había clavado yo. El tope global **sale del pool**, así que si el
puntero mejora, baja todo el mundo igual:

| tope | si el puntero mejora 20% |
|---|---|
| del servidor (del pool) | **bajan 138 de 138**, hasta −5 |
| global (del pool) | **bajan 138 de 138**, hasta −5 |
| **constante, fuera del pool** | **bajan 0** |

⚠️ **Esto ya pasa en una carta terminada:** el OVR de temporada se normaliza
igual (`construir_pool_temporada.py:127`, `tope = max(...)` del pool), así
que el OVR de las 138 baja cuando el puntero mejora. **No se tocó** — es de
la Temporada y no se pidió. Pero acá importa, porque un escalón que se cae
es un reclamo.

Y el tope relativo tiene un segundo problema: **el 1º de cada servidor saca
99**, también el de uno de 3.

### La escalera, dibujada — `03_Servidor/disenos/escalera_ver.py`

Cuatro formas × cuatro servidores, **solo esa zona** → `escalera_ver.png`.
Los cortes no son redondos a propósito: salen del reparto real (con tope 60
y raíz, la mediana cae en 51–62, así que los escalones se abren ahí y no en
70–90, que estarían casi vacíos).

⚠️ **A y C repiten la trampa del acento por CUARTA vez.** Un texto pintado
con el acento sobre el lavado del mismo servidor sale del mismo color: se
parecen por construcción. Contraste WCAG del texto contra lo que tiene atrás:

| | A texto | B pastilla | C contorno | D blanco |
|---|---|---|---|---|
| **no pasan (<4.5)** | **3/10** | **0/10** | **3/10** | **0/10** |

Los tres que fallan son SR 3.0, TWR 2.4 y EFA 2.9 — los mismos sospechosos
de siempre. **B y D pasan en los diez.**

**⚠️ La B ya está puesta en `todos_sv.py`, con la tipografía de la `.rkbox`
de la Competitiva** (`02_Competitivo/v2/card.css:187`): 0.6rem, weight 900,
radio 6, `inline-block` — o sea que **abraza su texto**, que es la mitad de
lo que la hace leer como pastilla y no como barra.

El espaciado **no** se pudo copiar, y el motivo es la forma, no el tamaño.
Con `letter-spacing:1.6` y `padding:9`, «VETERANO» mide 91.8 px y llega a
x=297.9 — **nueve de los diez pisaban el marco**, hasta 4.4 px. La `.rkbox`
arranca en `left:8%` con toda la carta a su derecha; ésta va centrada a 28 px
del borde. **Centrada ahí entran 83 px.** Se bajó el espaciado a 0.9 y el
padding a 6 —el cuerpo NO, porque 0.6rem es lo que se lee como «el mismo
tamaño»—, y la más larga quedó en 80.2.

⚠️ **Y eso le pone un límite a los nombres: entran ~8 letras.** CAMPEÓN anda;
GRAN CAMPEÓN no.

⚠️ **El vertical ya estaba bien y la caja lo desmentía.** El hueco de caja
contra el número daba 1.8 px y parecía pegado, pero **el de tinta es 7.7–8.3**
—prácticamente el 7 de la `.rkbox`—. La diferencia es el `line-height`: el
número de la Competitiva usa 0.78, caja apretada, y el nuestro 0.92, así que
debajo del último píxel sobra caja que no se ve. **Copiar el margen de caja
no copia el hueco que se ve.** Se midió con `escalera_medir.py`, que además
compara contra **el filo interno del marco** y no contra la silueta: en su
primera versión medía contra la silueta y daba «0 px fuera» con la pastilla
montada sobre el borde — cierto y sin valor.

**Recomendación: B.** Pasa en todos, es lo único que le da al acento un
trabajo útil, y **de paso resuelve las dos ideas con una sola pieza**: una
pastilla es exactamente el formato del TAG que llevan las otras dos cartas,
así que la escalera *es* el TAG. Cuesta correr las filas 8 px (el hueco
columna→divisor pasa de 30.2 a 22.2, sigue positivo). **D es la opción sin
costo** si se prefiere el idioma de la Competitiva —texto bajo el número, sin
pastilla— y también pasa en los diez.

### Las sugerencias, medidas — `03_Servidor/disenos/sugerencias.py`

Dlx pidió dejarlas preparadas. **No están elegidas: están medidas**, que es
lo que hace falta para poder elegir. Correr el script las reproduce.

**a) El TAG y el rango del servidor son, muy probablemente, la misma pieza.**
«DINASTÍA» y «#1 COMPETITIVO» son *el nombre de un logro*, y «CAMPEÓN» o
«LEYENDA» también. Hacer las dos pone **dos pastillas diciendo lo mismo con
distinta palabra**. Conviene resolverlo como una decisión sola: o el TAG *es*
la escalera, o hay que decir qué otra cosa dice.

Si no es la escalera, tres candidatos — y **solo el primero se puede dibujar
hoy**:

| diría | de dónde sale | estado |
|---|---|---|
| `#1 DE TFC` | `pos_sv` | **existe, 135 de 138** |
| `CAMPEÓN INTERSERVER` | `datos/estrellas.json` | existe pero **por servidor, no por persona** |
| `FUNDADOR` | fecha de ingreso | solo el bot |

**b) ⚠️ La escalera por campeonatos NO SE LLENA. 53 de 138 tienen cero
títulos: el 38%.** El escalón de abajo se lo llevan cuatro de cada diez, y en
FRZ, FTN, TWR y RZ —donde casi nadie ganó nada— **la escalera no ordena a
nadie: los empata a todos en el mismo escalón**. Y ese 38% es sobre el total
global; los títulos *de cada servidor* son un pedazo de esos, así que el
porcentaje de ceros **solo puede subir**.

Repartido por percentiles en vez de números redondos, lo mejor que da es:

```
RAPERO   0 títulos   53 (38%)      ← el problema está acá
CAMPEÓN  1           26 (19%)
MAESTRO  2–4         34 (25%)
LEYENDA  5–8          9 (7%)
DIOS     9–14        11 (8%)
MITO     15+          5 (4%)
```

**c) La que sí se llena siempre: escalera por PUESTO dentro del servidor.**
El puesto existe por construcción —si hay diez personas hay un 1º y un 10º—
así que ningún escalón queda vacío y ninguno se lleva al 40%:

```
CAMPEÓN   top 5%     9  (7%)
LEYENDA   top 20%   20  (15%)
ELITE     top 40%   27  (20%)
VETERANO  top 70%   41  (30%)
RAPERO    resto     38  (28%)
```

Y se defiende solo: **«top 5% de tu servidor» quiere decir lo mismo en uno de
79 que en uno de 6**, mientras que «3 campeonatos» quiere decir cosas
distintas en cada uno.

⚠️ **La contra, y hay que decirla: un escalón por puesto SE PUEDE PERDER.**
Si entra alguien mejor, te corre para abajo sin que hicieras nada. Los
campeonatos no se pierden nunca. **Las escaleras que pasó Dlx son todas de
las que no se pierden, y eso no es casualidad**: son roles de Discord, y un
rol que se cae solo genera reclamos.

Cuesta caro de las dos formas, así que **es una decisión de Dlx y no una
medición**: ¿la escalera dice *dónde estás hoy* o *dónde llegaste alguna vez*?

**d) Dónde entra, si entra.** Debajo del número —donde la Competitiva pone su
rango— hay **28 px** libres: el número termina en ~90 y la primera fila de la
columna arranca en 118. Una pastilla mide ~17 px con su padding: **entra, pero
deja 5 px de cada lado, o sea pegada.** Tres caminos:

| | cuesta |
|---|---|
| subir la primera fila 118 → 128 | el bloque se aprieta abajo: 30.2 px hasta el divisor pasan a 20.2 |
| sacar una fila | volver a elegir cuál de las cinco sale |
| **texto sin pastilla**, como el «SSS» de la Temporada | **nada: ocupa 8 px y entra sin mover un número** |

---


Documento de traspaso. Si venís a esto sin haber estado en la sesión, leé
esto antes que cualquier script.

**Nada de acá se decidió a ojo.** Cada número tiene una medición atrás y el
archivo donde vive. Si algo se rehace, sale de su definición canónica, no de
un script de exploración.

---

## Lo que está cerrado

| pieza | dónde vive | el número |
|---|---|---|
| **Silueta** | `comun/siluetas.py` → `PICO` | 300 × 405, prop. 0.741 |
| **Divisor, panel y recorte** | `comun/divisor.py` | extremos 66.366% del alto, recorrido **4.658% del ANCHO** |
| **Emblema y estrellas** | `comun/emblema.py` | escudo **66**, baja **6**; estrella **20**, hueco **36%** |
| **Figuras de rango** | `comun/rangos.py` | 8 siluetas + facetas, verificadas contra `gencomp.py` |
| **Íconos de la columna** | `comun/iconos.py` | 5, cada uno con silueta y luz |
| **Brillo de arriba** | `comun/brillo.py` | tiñe **.55**, llega al **24%** |
| **Borde de color** | `comun/marco.py` | degradé del propio **encendido** al acento |
| **Pie y columna** | `comun/pie.py` | posiciones + `lavado()` + self-check de huecos |
| **Nombre** | `comun/nombre.py` | y **282.4**, cuatro escalones por largo |
| **Los diez fondos** | `03_Servidor/disenos/los_nueve.py` → `defs()` | uno por servidor |
| **Escudos** | `herramientas/escudos_cuadrados.py` → `comun/escudos_cuad/` | 512×512, solo tinta |

**Corré `python comun/pie.py` antes de tocar posiciones.** Verifica que las
cinco piezas verticales no se pisen y hoy da todo positivo:

```
techo -> OVR         26.4 px
columna -> divisor   30.2 px
nombre -> fila       21.0 px
fila -> UL           25.0 px
UL -> punta          20.3 px
```

### Los cinco bugs que esta sesión encontró midiendo

Van juntos porque **los cinco se veían como problemas de diseño y ninguno lo
era**. Si algo «se ve raro» en esta carta, medilo antes de retocarlo.

| lo que se veía | lo que era |
|---|---|
| «el panel de abajo está roto» | repintaba `FONDO` pero **no la capa `EXTRA`** — 6 de 10 perdían su textura en el divisor |
| «falta panel en la punta» | el filtro partía los vértices con `> 150` y `< 150`, y **la punta está justo en x=150** — se perdía en los dos |
| «los bordes desaparecieron» | usaban el **acento**, que es blanco en URBF y DRA y casi blanco en TFC |
| «el panel tiene una reflexión rara» | el lavado usaba **otra caja** que el fondo, así que pintaba el mismo degradé **comprimido 30%** |
| «se ve el fondo en SR, FTN y FRZ» | el material **tiene una banda diagonal** justo ahí — rango de luz 197 / 143 / 189 |

### La silueta

Trazada de `referencia/ref1.png` con `herramientas/trazar_silueta.py`.
Caja de tinta 454×613, 1226 puntos → 11 con tolerancia 1.5, **error medio
0.54 px**. Simetrizada contra x=150.

**Dos tandas se dibujaron a ojo antes y las dos fallaron** (`punta.py`,
`punta2.py`). Las siluetas se trazan.

### El divisor — la curva de abajo

**Recuperada, no copiada.** El PNG es el rasterizado de una curva vectorial;
el ajuste lo deshace. Residuo del modelo elegido: **0.1238 px**.

```
polinomio de 6to          0.1238 px   <- elegido
polinomio de 4to          0.1548 px
coseno alzado             0.6105 px
parabola                  0.8125 px
arco de circunferencia    5.0420 px
```

Procedimiento en `herramientas/ajustar_divisor.py`. **Se aplica al 130%**
del recorrido recuperado → 18.2 px en nuestra carta.

⚠️ El recorrido va como fracción del **ANCHO**. Una curva cruza a lo ancho:
su pendiente es subida sobre ancho. Escalarla por el alto la deja un tercio
más empinada en una carta más angosta.

### La columna del costado — **ya estaba implementada, en el diseño de País**

⚠️ **La busqué tres veces en el lugar equivocado.** Mis tres mediciones
fueron sobre las referencias de FC Mobile buscando una línea. La pieza que
Dlx pedía **ya existe en este repo**, escrita y comentada:
`03_Servidor/normal_card.css:250` — el diseño viejo de la Servidor, el que
quedó reservado para País.

> *«Repinta el degradado propio de la carta sobre la franja izquierda y lo
> desvanece hacia la derecha. Así el número queda sobre el material de la
> carta, no sobre el avatar — que es como funciona la carta de FIFA.»*

**No es una línea ni una caja: es un lavado.**

```
mask   linear-gradient(90deg, #000 0%, #000 13%,
                       rgba(0,0,0,.5) 25%, transparent 43%)
alto   58% de la carta
```

Lo que gana no es decoración: es que **los datos caigan sobre el material de
la carta y no sobre una foto que no controlamos** — el mismo problema que ya
resolvimos en el emblema y en el pie, otra vez.

⚠️ **Va espejado a la derecha.** Ya lo había pedido Dlx: *«the left thing
could we move it to the right instead? so it looks different than other
ones»*. El diseño viejo lo tiene a la izquierda **y ese diseño es el de
País**: si la Servidor lo copia igual, las dos se confunden.

⚠️ **Y hay un choque a resolver**: si la columna lleva el número y el rango
—que es lo que llevan en el layout FIFA— **el pie ya elegido se queda sin dos
de sus tres piezas**. O el rango vive abajo en su figura, o vive en la
columna. Opciones en `columna.png`.

**La lección de método**: antes de medir una referencia externa, revisar si
la pieza ya está resuelta adentro del repo. Van dos veces en esta misma
carta — el contorno ya estaba en las estrellas, y la columna estaba acá.

### El neón de la referencia es LA U del divisor — otra pieza, también medida

Dlx: *«tiene como una luz neón que separa la parte del avatar y las
estadísticas»*. Tenía razón, y **me equivoqué dos veces antes de verlo**.

**Por qué las dos mediciones anteriores no podían encontrarlo**: las dos
buscaban **el borde más fuerte**. El gradiente más fuerte de la imagen es el
marco, y el segundo es el dibujo del fondo. **La luz neón es más fina que
los dos y por eso nunca aparecía primera.** Hay que buscarla **por color** —
es lo más claro y saturado— y no por contraste.

Medido así sobre la FINAL REFERENCIA (`lado_neon.py`):

```
vertical izquierda   x 14.8%   cobertura 95.0%   y  5.6% .. 69.3%
vertical derecha     x 84.8%   cobertura 96.2%   y  5.6% .. 69.7%
fila con más neón abajo                          y 62.5%
                                                 -> ESPEJADAS
```

TOTS23_EVENT lo confirma: 14.3% / 86.1%, espejadas, fila de neón en 62.5%.

⚠️ **Y eso cambia todo el planteo: no son dos verticales más un divisor. Es
UNA SOLA PIEZA en U** que rodea la zona del avatar — baja por un lado, cruza
por abajo, sube por el otro. **La fila de neón de abajo cae en y 62.5%, que
es exactamente donde está nuestro divisor.**

**O sea que nuestra carta ya dibuja el fondo de esa U y le faltan los
lados.** El «panel del costado» y el divisor son **la misma pieza**.

Por eso se traza **continua**, en un solo `path`: si se dibujaran como tres
cosas sueltas, las uniones se verían.

Opciones en `lado_comparar.png`: **A** solo el divisor · **B** la U al borde
· **C** la U metida 11 px · **D** la U metida y más marcada.

### El filo del marco — otra cosa, y también medida

**Esto corrige lo que decía antes este mismo documento.** La versión vieja
afirmaba que la vertical estaba «al 32.4% del panel» y que «repinta el
material de la carta y se desvanece hacia el centro». Re-medido sobre las
**siete** referencias con `lado_medir.py`:

```
                  izquierda   derecha
FINAL REFERENCIA     11.9%     88.1%
UCL_ICON_A4          16.7%     82.8%
TOTS_ICON_A4         18.1%     81.9%
ICON_PRIME_5         19.4%     83.1%
TOTS23_EVENT         16.0%     84.0%
UCL23_ICON_5         16.4%     82.3%
                              -------
                    promedio    84.3%
```

⚠️ **El dato que lo cierra: todas tienen el pico espejado a la izquierda.**
Un panel de contenido **no está espejado**. Si la misma línea aparece a
izquierda y derecha a la misma distancia del borde, no es una columna de
datos: es **el filo interno del marco**. Con zoom 7× se confirma — adentro de
esa línea el campo está **vacío**, solo el material y unas chispitas.

**Cómo se coló el error**: la medición vieja buscaba un pico y lo encontró,
pero **nunca miró el lado izquierdo**. Un detector que solo mira donde espera
encontrar algo siempre encuentra algo. Es el mismo error que el de las «dos
líneas» del divisor, en otra forma.

⚠️ **Y ninguna de nuestras dos cartas tiene panel lateral:**

| carta | qué hace en el costado |
|---|---|
| **Temporada** | **nada**. Solo el `#11` arriba, que es el puesto |
| **Competitiva** | **pastillas colgadas del borde**, `right:-11px`, **sobresaliendo** de la silueta. No es un panel: son piezas sobre el filo |

Si la Servidor estrena un panel de contenido, estrena **un lenguaje que no
existe en el juego de cartas**, y encima en la única carta que va a vivir en
servidores ajenos.

**Así que la decisión no es «qué dato va ahí» sino cuánto se marca ese filo
— y eso es parte del marco**, que es lo que falta. Tres opciones en
`lado_comparar.png`: nada · filo interno · filo marcado. **El filo va en los
dos lados**: ponerlo solo a la derecha es exactamente lo que lo convertiría
en un panel.

### El resto del contenido

- **La foto** va a sangre por debajo de todo, con máscara que la disuelve
  hacia abajo, y **sube hasta el tope** para pasar por debajo del emblema.
  Va **debajo del wash**: al revés, el número queda sobre el avatar.
  Encuadre: zoom **115%**, posición **0.52** — bajó de 0.62 para dejar aire
  arriba.
- ⚠️ **Los avatares se piden a 512, no a 128.** Se veían blandos y **no era
  el diseño: era la fuente**. El pool trae `?size=128` clavado en la URL y la
  foto se dibuja a **345 px** de ancho — se agrandaba **2.7 veces**. El
  `size` **no es parte del hash**, así que se puede reescribir.
  `herramientas/bajar_avatares.py` lo hace, y su chequeo de «ya está» mira el
  **ancho de la imagen**, no si el archivo existe — con lo segundo, el arreglo
  no habría llegado a ningún avatar ya guardado y todo seguiría igual de
  blando.

  🔴 **PERO ESTO DECÍA «CUATRO VECES MÁS GRANDE» Y ES FALSO.** Medido el
  20/09/2026 pidiendo cinco tamaños del mismo hash: `size` es un **tope**, no
  un pedido — el CDN devuelve lo que la persona subió y nada más.

  ```
  Konan     size=128 -> 128    size=256 / 512 / 1024 / 4096 -> 256
  Afidu     size=128 -> 128    size=256 en adelante         -> 170
  ```

  El salto real es **128 → 256**, o sea el doble y no cuatro veces: la carta
  pasa de agrandar 2.7× a **1.35×**. Se gana la mitad del problema y **no hay
  forma de ganar el resto**, porque el píxel no existe en ningún lado. Medido
  sobre las 307 guardadas, **186 quedan por debajo de 345 px (63 %)** y van a
  salir blandas igual. Por eso `bot/fotos.py` imprime la **distribución** de
  tamaños y no un promedio.
- **El nombre** en **y=281.6** —280 → 281 → 281.6, dos pedidos— y **se achica
  solo según el largo**: `comun/nombre.py`, los mismos cuatro escalones que
  la Competitiva. La posición también vive ahí (`nombre.Y['servidor']`)
  porque ya estaba escrita en dos archivos.
- **Las estrellas van sobre el arco del escudo y giran con él.** Cuando son
  más, **se estrechan; no se achican**: `E` no cambia con la cantidad, cede
  el aire entre ellas. Si el de tres se dibujara más chico que el de uno, la
  carta diría que ese título vale menos. Falta elegir el factor de arco.
- ⚠️ **El hueco contra el escudo es una fracción, no un píxel.** `HUECO =
  0.30` = 30% del alto de la estrella. Antes eran 2.8 px sobre una estrella
  de 21 = **13%**, y por eso se veían **apoyadas** en vez de flotando encima.
  Es proporción y no píxel porque **eso es lo que se copia de una camiseta**
  y es lo único que sobrevive a cambiar de tamaño. **No hay foto de camiseta
  en el repo**: si aparece una, se mide y se cambia ese número solo.
- **El UL** en y=372, alto **20.7 px** — el mismo de la Competitiva
  (`02_Competitivo/v2/card.css:382`). No es una decisión de esta carta.
- **Sin gema** al pie. El rango ya está en la columna, y colorear por rango
  es el lenguaje de la Competitiva.
### El brillo de arriba — CERRADO. Sale del color propio, no del acento

`comun/brillo.py`. Tiñe **.55**, llega al **24% del alto**, velo **.30**.
Elegido por Dlx sobre la tanda de cuatro intensidades: *«como están los de
abajo están perfecto»* — los de abajo eran los cuatro servidores a
intensidad **media**.

**Verificado en los diez**, no en uno: `brillo_arriba.png` los dibuja a esa
intensidad, con **FFA primero a propósito** porque es el de menos croma
(**42**, contra 194 de DRA). Si la regla se rompiera en alguno se rompería
ahí, y no se rompe.

Espeja al del pie: el panel de abajo enciende su filo mirando hacia arriba,
así que el tope se enciende mirando hacia abajo, hasta la altura del escudo.

⚠️ **La primera tanda salió invisible y medirla dio vuelta el planteo.**
Estaba hecha con el **acento** y `mix-blend-mode:screen`. Medido en la franja
del hombro (`y=70..112`, sacando el escudo), como cambio contra la carta sin
brillo:

```
                          FOTO CLARA        FOTO OSCURA
variante                luz     color      luz     color
acento screen .40      +4.4     -1.3     +24.7     +0.7
propio velo+tinte .55 -61.3    +12.3      -2.4    +17.9
```

Dos hallazgos, los dos contra lo que yo suponía:

1. **Sobre una foto clara no se puede agregar luz.** `screen` satura: +4.4
   sobre 211. Lo único que todavía entra ahí es **color**.
2. **El acento no tiene color en tres de diez.** TFC croma **9**, URBF y DRA
   croma **0** — son blancos. En esos tres el brillo no estaba flojo:
   **no podía teñir nada.** El color propio del servidor sí tiene croma en
   los diez (el más pobre es FFA con 42).

⚠️ Y **hace falta el velo**. El brillo del pie se lee porque cae sobre **el
material de la carta**, que es oscuro. Arriba no hay material: hay foto. Hay
que empujar la foto hacia atrás para que la luz tenga dónde apoyarse — es el
**mismo precio que ya paga el pie**, no un agregado.

⚠️ **No usar `emblema.tono()` para encender el color.** Aclara hacia el
**blanco**, y eso le saca justo el croma que es lo único que se ve sobre una
foto clara. `brillo_arriba.encender()` sube el canal más alto hacia el tope y
los otros en proporción: sube la luz y **mantiene el color**.

Es el mismo gesto que el del pie, pero **no simétrico exacto**: abajo el
brillo está *en una línea* —el divisor— y lo que ilumina es su propio filo.
Arriba no hay línea que iluminar, el borde ya lo tiene el marco. Lo que se
enciende es **el aire detrás del escudo**.

---

## La textura del panel derecho — **medido: no lleva**

Dlx: *«realmente no sé qué hacer con el estilo de la textura del panel
derecho, he estado pensando en muchísimas opciones pero no me decido»*.

Medido, y las tres razones apuntan al mismo lado:

**1. Casi no hay superficie donde ponerla.** La columna mide 56 × 192 y las
piezas ocupan el **68%**. Lo que queda son franjas de **10–12 px** entre fila
y fila. Una textura ahí no se lee como textura: se lee como **ruido entre los
números**.

**2. Seis de diez ya tienen la suya.** FFA, TWR, URBF, DRA, EFA y RZ llevan
capa `EXTRA`, y **el lavado la repinta, no la tapa**. Ponerle una propia
significa **dos texturas superpuestas en 56 px** en seis cartas y una sola en
las otras cuatro: las diez dejarían de verse hermanas.

**3. El panel ya hace su trabajo, y está medido.** Su único trabajo es que
los números caigan sobre el material de la carta: **13:1 de contraste sobre
la foto más clara, contra 1.44:1 sin él**. Una textura no agrega nada a eso.

⚠️ **Y lo que más pesa: es el momento equivocado para decidirlo.** El marco
entra por el borde derecho, que es justo donde vive la columna. Cualquier
textura que se elija hoy **hay que volver a mirarla cuando el marco esté** —
o sea, elegirla dos veces.

**Si más adelante se quiere diferenciar el panel**, la vía que no rompe nada
es **la luz, no la textura**: un degradé propio del panel, que no compite con
las seis texturas porque no es una trama. Pero eso también conviene mirarlo
con el marco puesto.

---

## ⚠️ EL CRITERIO QUE ORDENA LA CARTA: dos zonas, dos alcances

Salió al decidir dónde va el puesto competitivo, y **reordena cosas que ya
estaban puestas**:

| zona | mide | qué lleva |
|---|---|---|
| **la columna** (derecha) | **cuánto** — acumulación | OVR sv · campeonatos sv · racha sv |
| **el pie** | **calidad** — Score | país · **puesto en el servidor** · rango |
| el emblema | de dónde sos | escudo · estrellas del Interserver |

⚠️ **El puesto es el de DENTRO del servidor, no el global**, y se calcula
**por Score** — es exactamente lo que ya hace el círculo del país en la
Competitiva. Es `pos_sv`, 135 de 138, **ya existe**, y CLAUDE.md ya fija la
regla: país, servidor y crew se calculan por Score, los tres, y si se cambia
hay que cambiarlos a la vez.

⚠️ **Y por eso la columna NO lleva un puesto.** Yo lo había propuesto ahí,
calculado por acumulación. Medido, los dos órdenes se contradicen fuerte
dentro del mismo servidor:

```
desacuerdo medio      4.5 puestos
cambian de puesto     105 de 135  (78%)
se mueven 3 o más      64  (47%)
se mueven 5 o más      38  (28%)
el peor: Gus, 36º por Score y 11º por acumulación
```

Dos puestos del mismo servidor que no coinciden, sin ninguna pista de por
qué. **No hay forma de explicarlo dentro de la carta.** Va uno solo.

Así cada zona tiene **un solo criterio**: el pie mide calidad, la columna
mide cuánto. Es la misma división que ya existe entre la Competitiva y la
Temporada.

**El orden del pie**: bandera · **puesto** · figura del rango. El puesto va
al medio porque la pieza central del pie es **el número**, no el material —
la figura remata, no encabeza.

Antes estaban mezcladas: el OVR del servidor estaba abajo y el rango
también, así que **las dos zonas hablaban de las dos cosas**. Con el corte,
la carta se lee de un vistazo: **a la derecha lo que hiciste acá, abajo
quién sos en la Liga.**

**El puesto competitivo sí va, y no es redundante con la figura**: el rango
es una **banda** —27 personas comparten «A», 36 comparten «C»— y el puesto
es **exacto**. Dos personas con la misma figura pueden estar a 30 puestos.
La figura dice de qué material sos; el puesto, cuántos hay delante.

⚠️ **Pero no como la Competitiva.** Allá es una pastilla colgada en
`right:-11px`, y funciona porque tiene cuatro en columna y un marco que las
sostiene. Acá no, por dos motivos que no son de gusto: **(1)** el costado
derecho ya lo ocupa la columna y chocaría con el lavado; **(2)** lo que
sobresale de esta carta **ya está decidido y medido** —el emblema y las
estrellas— y una tercera cosa que sobresale complica la exportación, que ya
necesita calcular la unión.

Variantes en `pie_puesto.png`.

---

## El pie — **A elegida**. Bandera cuadrada · figura del rango · OVR

`pie_A.py`. Dlx eligió la A y pidió: gema al tamaño de la bandera (**26 px
las dos**), bandera **cuadrada**, y a la derecha el **OVR en el servidor**.

### La figura por rango — `comun/rangos.py`

⚠️ **El primer juego de figuras falló y la medición lo dijo.** Las había
elegido por **cantidad de lados** —hexágono, octágono, escudo, cuadrado— y a
26 px sin color dieron IoU **0.847 / 0.836 / 0.820 / 0.769**: los **cuatro
del medio**, que son **114 de 138 (83%)**, todos entre 0.75 y 0.85.

**Contar lados no separa siluetas.** Los cuatro eran bloques convexos que
llenaban casi lo mismo de su caja (33.0 / 34.4 / 32.6 / 34.2%), y dos figuras
que tapan la misma área se parecen aunque se describan distinto. Las únicas
que se separaban solas eran las que llenaban **poco**: la estrella (23.6%) y
el triángulo (27.4%).

Lo que sí separa es **cuánto llenan y hacia dónde van**. El juego de ahora
cruza las proporciones: **A alto y angosto**, **B ancho y chato** —son
perpendiculares a propósito, es el par más visto—, **C marquesa apuntada y
hueca**, **D cuadrado neutro**.

| | antes | ahora |
|---|---|---|
| pares sobre IoU 0.75 | **9 de 28** | **2 de 28** |
| peor de los cuatro del medio | A vs B **0.847** | A vs D **0.723** |
| A vs B | 0.847 | **0.455** |

⚠️ **Quedan dos pares al límite, los dos con S** (círculo de oro): S vs D
0.806 y S vs A 0.765. Se aceptan porque S son 8 personas y su color es el
único dorado, pero **si alguna vez se toca una figura, esos dos son los que
hay que volver a medir.**

⚠️ **C se ensanchó a propósito.** Con la curva cerrada tapaba 15% contra el
34% del cuadrado, y **C es el rango más numeroso** (36 de 138): la figura más
flaca le habría tocado justo a la mayoría.

⚠️ **D es cuadrado y no rombo.** Rombo y cuadrado son la misma figura girada,
y D es justo el rango más parecido a SS en luz (**0.9 de L\***). Habría sido
la peor combinación posible sin darse cuenta.

⚠️ **Y sobre por qué la figura vale la pena**: la medición **dio vuelta el
argumento con el que yo iba a defenderla**. Los colores **no se confunden**
—de 28 pares, **cero** bajan de dE 20—. Lo que sí pasa es otra cosa:
**nunca se ven dos juntos**, la carta cae sola en Discord, así que el trabajo
es **nombrar uno de ocho de memoria**, que es mucho más difícil que comparar
dos muestras. Y en **claro/oscuro se apelmazan**: A vs SSS 0.7 de L\*, SS vs
D 0.9, S vs SS 1.4.

La paleta **se verifica contra `gencomp.py`**: `rangos.verificar()` lee el
archivo y revienta si se separaron. El síntoma de una copia desincronizada es
el **silencio**, y las dos cartas de la misma persona saldrían de dos colores.

### La figura del rango NO choca con el color de la carta — medido

Dlx preguntó bien: son **dos sistemas de color independientes** sobre la
misma superficie —el del **servidor** dice de dónde sos, el del **rango**
dice quién sos— y ninguno puede ceder, porque los dos significan algo. Y el
rango además es el mismo en las tres cartas por regla, así que no se puede
retocar solo acá. Son **80 combinaciones** y a nadie se le asigna una: te
toca la que te toca.

Medido en `pie_choque.py`, las 80:

```
en problemas (dE<25 o contraste<3):   0 de 80
peor dE:          55   (C zafiro sobre DRA)
peor contraste:  4.3   (C zafiro sobre TWR)
personas de las 138 en una combinación mala:   0
```

⚠️ **Y el motivo importa más que el resultado: lo salva el VELO.** El panel
del pie lleva un velo de 30→64% de negro, así que **los diez paneles
terminan casi negros** —`#280309`, `#0C0803`, `#09020E`…— y los ocho acentos
de rango son **claros** (L\* 60 a 88). Toda figura de rango es una forma
clara sobre un panel oscuro, sea cual sea el servidor.

**Si alguna vez se afloja el velo del pie, esto se rompe.** No es que los
colores no choquen: es que el pie los separa por luz. El emblema de arriba
tiene el problema justamente porque **ahí no hay velo**, está en la zona
encendida y con el tono del servidor.

⚠️ Por eso **no hace falta mover el rango a la derecha**. Y moverlo tendría
un costo: la derecha es lo único que queda sin decidir, y meterle el rango
la cierra con la pieza que ya está resuelta en otro lado.

### ⚠️ El OVR del servidor NO EXISTE. Lo que se ve es inventado

Dlx preguntó bien: «¿en qué estamos midiendo? ¿tendríamos que crear un
ranking separado por cada servidor?». Medido:

El Sheet **sí** tiene un número por servidor —las 7 columnas de Ranking
Temporada— pero `construir_pool_temporada.py` las lee **solo** para el argmax
(línea 110) y el conteo (línea 120), y **tira los valores**. Ningún pool los
tiene. **Ponerlo no es dibujar: hay que tocar el builder.**

⚠️ **Solo 7 de los 10 servidores tienen columna.** Faltan **FFA, EFA y RZ**.
Y como `sv` sale del argmax de esas 7, **nadie puede quedar asignado a esos
tres**: sus cartas hoy no le tocan a ninguna persona. El pool lo confirma —
FFA 0, EFA 0, RZ 0.

⚠️ **Y la mitad de los servidores no da para un ranking:**

```
TFC 79 · SR 22 · TWR 18 · FTN 11 · FRZ 5 · URBF 2 · DRA 1
```

DRA tiene **1** persona y URBF **2**. Ya existe la regla —el umbral de 3 de
los círculos de abajo— y dice que ser «1 de 1» no significa nada. Un OVR
renormalizado dentro del servidor le daría **100** al único de DRA.

**Las tres maneras, y qué rompe cada una:**

| | |
|---|---|
| **a)** renormalizar el Score dentro del servidor | no toca el builder, pero **no es comparable entre servidores**: un 99 de un server de 5 y uno de 40 se dibujan igual |
| **b)** los **puntos de ese servidor** normalizados contra el máximo del pool | es de verdad «datos de ese servidor», que es lo que la carta dice que mide, y **es comparable**. Necesita el builder; sin número quedan FFA, EFA, RZ |
| **c)** el Score global | **rompe la regla** de que el número de cada carta mide lo que esa carta mide — eso ya lo dice la Competitiva |

**(b) es la única que cumple la regla.** Hasta que exista, el número de la
hoja es de muestra y está marcado como tal.

---

## Cómo se llegó a la A

`pie_comparar.py` (los números) y `pie_opciones.py` (las tres opciones).

**Qué lleva abajo cada carta:**

| carta | qué lleva |
|---|---|
| **Temporada** | TAG chico izq · pastilla centro · **UL a la derecha**, los tres en la **misma línea**, y=383..409 |
| **Competitiva** | círculos (bandera + servidor, con aro que mide y el puesto) y=357 · pastilla de TAG y=398 · **UL al centro** y=429 — un stack de tres pisos |
| **FINAL REFERENCIA** | el panel está **vacío**. Solo una **gema hexagonal sobre el borde**, y=462 de 485 = **95%** |

**Cuánto lugar hay en la Servidor:**

```
nombre        y 265.6 .. 291.2
LIBRE         y 291.2 .. 372.0   = 80.8 px, ~294 de ancho
UL            y 372.0 .. 392.7
punta         y 392.7 .. 405     = 12.3 px, y se cierra a 0
```

⚠️ **La gema de la referencia cae justo donde va el UL.** Ella está al 95%;
nuestras tres cartas ponen el UL al 88–92%. En la Servidor la gema al 95%
caería en y≈385, **encima del UL**. Por eso las tres opciones se diferencian
ahí y no en el adorno.

⚠️ **Dos cosas que no se pueden proponer:**

1. **El círculo del servidor.** La Competitiva lo lleva abajo con su aro,
   pero acá el servidor **ya es el emblema de arriba**. Repetirlo es decirlo
   dos veces en la carta que existe para decirlo una vez bien.
2. **Racha y duelos por servidor.** `rch_act`/`rch_max` son **globales** y
   `duel_real` está en **4 de 138**. No es que falten en el JSON: ese número
   **no está calculado en ningún lado**. Hay que construirlo en el builder
   antes de poder dibujarlo.

Lo que sí existe y es propio de esta carta es **`pos_sv`**, 135 de 138.

⚠️ **La gema decide parte de la derecha.** Estaba descartada porque «el rango
ya está en la columna» — pero la columna es lo que **no está decidido**. Si
el rango baja a la gema, el lado derecho **no puede volver a mostrarlo**.

**El color de la gema es el mismo acento de rango de la Competitiva**
(`gencomp.py:19-26`), no uno nuevo: el rango sale del Score y es **uno solo
por persona** en todas sus cartas.

---

## El contorno del escudo — **DECIDIDO: de dos tonos**

`comun/emblema.py` → `pieza()`. Medido en `emblema_fondos.py`.

**El problema, en una línea**: con `BAJA=6` el escudo tiene el **61% de su
área y el 56% de su contorno fuera de la carta**, sobre el fondo de Discord.
Lo único que tenía era un aro **del acento** más una sombra hacia abajo — y
las dos fallan igual que ya habían fallado en las estrellas: el acento es
**blanco en URBF y DRA** (un aro blanco sobre blanco no es un borde), y la
sombra va **hacia abajo**, así que el borde de **arriba** —el que está 100%
afuera— queda sin nada.

Mejor contraste que ofrece el filo contra el fondo, **peor caso** sobre
blanco / Discord claro / Discord oscuro / negro:

```
como está                 1.80    <- DRA sobre Discord claro
contorno fino             2.33
contorno normal           2.33
contorno + filo interno   2.64
CONTORNO DE DOS TONOS     3.55    <- el único que pasa 3:1
```

⚠️ **Por qué dos tonos y no uno.** Un contorno de un solo tono **no puede
ganar en los dos extremos**: el oscuro arregla el fondo claro y se pierde en
el oscuro. Con un filo oscuro **y** una línea clara por fuera, siempre hay
uno de los dos contrastando. Las estrellas se ahorran esto porque su relleno
es **blanco fijo**; el escudo cambia de color con el servidor y no puede.

⚠️ **Tres veces tuve que corregir la métrica en esta misma pregunta**, y las
tres el error fue el mismo: **el número miraba al costado de lo que se estaba
probando.**

1. Comparé el color medio del emblema con el de la carta. Eso **diagnostica**
   —dio 6.0, son el mismo color— pero un anillo no cambia ninguno de los dos:
   mete un **tercero** en el medio.
2. Medí el filo contra el fondo, pero **solo donde hay carta** (`alpha>250`).
   Es el 39%. Medí el anillo justo donde el anillo importa menos.
3. Medí el filo contra el fondo **promediando la banda**. Eso castiga
   justamente al contorno de dos tonos: negro + blanco promedian gris, y
   contra un fondo gris el promedio dice «no se ve» cuando en pantalla se ven
   las dos líneas.

**La regla que queda: cuando lo que se prueba es una estructura de varias
capas, un promedio la borra. Hay que preguntar por el extremo.**

---

## El emblema contra su propia carta — sigue abierto

`emblema_separa.py`. Dlx lo vio a ojo («compiten con los colores de la
tarjeta») y medirlo lo confirmó y lo empeoró.

**El diagnóstico**: distancia entre el color medio del emblema y el de la
carta que lo rodea.

```
TFC 5.9 · SR 20.3 · FFA 2.4 · TWR 9.6 · FTN 5.2
FRZ 1.3 · URBF 1.1 · DRA 4.4 · EFA 2.1 · RZ 7.9      promedio 6.0
```

**Los diez por debajo de 25**, que es donde dos colores empiezan a leerse
como dos. No es que compitan: **son el mismo color**. Y es *por
construcción* — la placa sale del mismo base que la carta, y ahora el brillo
de arriba tiñe la zona de atrás con ese mismo color.

**Probé cuatro tratamientos y ninguno mueve el número** (3.6 / 3.6 / 3.6 /
3.5). Están en la hoja y no los vendo como el arreglo.

⚠️ **Pero midiendo apareció algo más grande.** Al subir el escudo (baja 10 →
6), **el 61% de su área cae fuera de la carta** y el **56% de su contorno**
no se apoya en la carta sino en **el fondo de Discord**. El problema no es
solo que compita con la carta: es que la mayor parte del escudo **no tiene
carta detrás**.

Y eso es **la misma pregunta que esta carta ya se hizo una vez**: las
estrellas llevan **contorno y no solo sombra** porque una figura blanca sobre
blanco da 1.00:1 y desaparece. **El escudo está hoy en esa situación y no
tiene contorno.**

⚠️ **Y ojo con la métrica.** La primera vuelta medí solo la distancia entre
las dos zonas grandes, y con eso los cuatro tratamientos daban idénticos —
porque **un anillo no cambia ninguno de los dos colores, mete un tercero en
el medio**. La conclusión habría sido «el anillo no sirve» cuando el número
no lo estaba mirando. Por eso ahora también se mide **el escalón al cruzar el
borde**.

---

## Lo que falta

✅ **CERRADO EL 22/09/2026 — Dlx: «fondo DRA está bien, EFA está bien,
RZ ya no existe, olvida el marco del servidor».** Los cuatro puntos que
seguían abiertos acá dejaron de estarlo, y tres de ellos no porque se
resolvieran sino porque **la pregunta se cayó**. Se dejan tachados y no
borrados: lo que costó medirlos sigue sirviendo si alguno vuelve.

1. ~~**El marco.**~~ **No va.** Era lo último de diseño de todo el
   proyecto. Referencias en `referencia/marcos/` por si alguna vez se
   retoma.
2. ✅ **El exportador — HECHO.** `03_Servidor/generar.py` arma esta carta
   para cualquiera de las 138 desde `datos/`. El emblema y las estrellas
   viven fuera del `clip-path`, así que **no se captura el elemento**: se
   captura la página entera con `omit_background` y después `recortar()` la
   ajusta a la tinta. Eso resuelve la unión sin calcularla — verificado, la
   tinta arranca en `y=0`, o sea que la estrella entra.
3. ~~⚠️ **EFA pisa a SR.**~~ ✅ **Dlx: «EFA está bien».** Queda medido
   abajo porque el número es real —3,7° de tono y 0,00 de luz— y el día
   que alguien vuelva a mirarlo va a encontrar lo mismo; la decisión es
   que así está bien.

   **EFA pisa a SR.** Al pasar EFA al cobre de su logo quedó en 20°/0.40
   y SR está en 24°/0.40: **mismo tono y misma luz**. Antes EFA era `#3A2412`
   con luz 0.15 y estaba separado.

   Re-medido el 16/09/2026 sobre `los_nueve.defs()`: **3.7° de tono y 0.00 de
   luz**. Sigue vigente y es el único par que choca — los otros que comparten
   tono se separan por luz: FTN/DRA/RZ están los tres en ~230° con 0.34, 0.62
   y 0.20; FFA y URBF en ~267° con 0.11 y 0.51.
4. ~~**El fondo de DRA.**~~ ✅ **Dlx: «fondo DRA está bien».** Seis
   tandas y ninguna elegida —y la respuesta fue que la que está puesta
   sirve. Drako rechazó el
   óxido por «sucio», y está medido: era el segundo en mancha.
5. ~~**RZ no está en el Sheet.**~~ ✅ **Dlx, 22/09: «RZ ya no
   existe».** No es un hueco de datos: el servidor no existe. Su escudo
   y su fondo quedan en el repo sin dueño.

   **RZ no está en el Sheet.** El servidor de cada rapero se deriva de las
   columnas por servidor: si RZ no está en la planilla, **nadie recibe esa
   carta** aunque esté diseñada.

---

## Lo que la medición corrigió, para no repetirlo

- **La segunda línea del divisor no existía.** Buscando «filas brillantes»
  salieron dos, a 62.4% y 66.4%. Son **la misma línea**: 62% en el centro y
  66% en los bordes. Un detector que mira fila por fila cuenta dos veces una
  curva.
- **La cima plana era del píxel.** Con 10 px de recorrido sobre 152
  columnas, varias columnas en el mismo entero es lo normal al rasterizar.
- **El grano no mide manchas.** Capta contraste a 9 px; las manchas del
  óxido son grandes y blandas. Hay que medir a 61 px sobre la imagen
  suavizada.
- **Achicar un mosaico SUBE el grano**, no lo baja. Lo que lo gobierna es la
  opacidad.
- **El centroide del panel cae más abajo que su media altura**, no más
  arriba: la curva del techo bulge hacia arriba y esa franja aporta menos
  área de la que parece.
- **Una hoja de muestras necesita una variable que se vea.** Una tanda
  comparó seis variantes cuya diferencia era una línea de 1.7 px empezando
  45 px más arriba: nadie la distinguió, con razón.
- **«No se ve» tiene dos arreglos opuestos y mirar no dice cuál.** El brillo
  de arriba salió invisible: podía estar flojo —subirle la intensidad— o
  estar hecho con el método equivocado —cambiarlo. Era lo segundo, y de
  haberlo subido a ojo habría seguido invisible en TFC, URBF y DRA con el
  triple de opacidad.
- **Un promedio de brillo no alcanza para juzgar un brillo.** Hacen falta
  **luz y color por separado**: sobre foto clara la luz está saturada y solo
  se mueve el color. Con un solo número, la variante que sí funciona sobre
  las claras aparece como la peor.
- ⚠️ **`estrellas.json` se lee por `estrellas_por_servidor`, no por la raíz.**
  El archivo tiene además las ediciones y los servidores eliminados. Leer la
  raíz devuelve 0 para todos **en silencio**: las estrellas desaparecen de la
  hoja y nada avisa. Ya pasó una vez en `brillo_arriba.py`.

---

## Los datos, y lo que no existe

`03_Servidor/disenos/avatares.py` rota un avatar distinto por muestra.
**Sirvió en su primera corrida**: la única variante sin wash tocó el avatar
claro y el número quedó blanco sobre blanco. Con la misma foto en las seis,
esa variante pasaba como válida.

| dato | estado |
|---|---|
| `pos_sv` puesto en el servidor | **135 de 138** |
| racha **por servidor** | **no existe** — la global es `rch_max` 118/138, `rch_act` solo 42 |
| duelos **por servidor** | **no existe** — `duel_real` está en **4 de 138**, y es global |
| avatares | ⚠️ **9 vivos de 20** |

⚠️ **Los avatares se mueren y nada los repone.** El Sheet **no los tiene**
(`construir_pool_competitivo.py:105`): el builder los rescata del JSON
anterior, o sea de sí mismo. En julio eran 6 caídos de 20, hoy son 11.
**Valen está entre los caídos** y es la foto usada en todas las hojas.

Los 9 vivos quedaron guardados en `_avatares/` con
`herramientas/bajar_avatares.py`. El arreglo de fondo es traerlos de Discord
al generar, y eso necesita un **token de bot**, no las credenciales del
Sheet.

---

## ⚠️ CORRECCIÓN: las 7 columnas son EVENTOS, no puntos (10/08/2026)

Dlx dijo que el OVR no tiene máximo, que lo define el primero del
competitivo. Verificando eso apareció que **yo venía llamando «puntos» a algo
que son eventos**.

**Medido:** la suma de las 7 columnas por servidor da exactamente `Ev` —el
total de eventos— en **136 de 138**. No es coincidencia: son la partición de
`Ev` por servidor.

O sea que todo el análisis de `ovr_que_mide.py` usó **los números correctos
con el nombre equivocado**. Las conclusiones sobre el tope fijo siguen
valiendo; lo que cambia es **qué dice el número**.

### 1 · Los 2 que no cuadran son un hallazgo, no un error

| | suma de las 7 | Ev | falta |
|---|---|---|---|
| Deuxs | 23 | 29 | **6** |
| Molusco | 12 | 15 | **3** |

Esos eventos ocurrieron en un servidor **que no tiene columna**. Es la primera
evidencia de que **FFA, EFA o RZ sí tienen participación** — hasta ahora se
daba por hecho que nadie podía quedar asignado ahí porque no están en el
Sheet, y esto muestra que el problema es de la planilla, no de la realidad.

### 2 · El tope fijo de 60 está por ser superado

Eventos en el servidor principal: mediana **9**, p90 **25**, p99 **49**,
**máximo 57**. El tope que fijamos es 60.

⚠️ **Y los eventos solo suben.** El tope fijo se eligió justamente porque un
tope sacado del pool hace bajar a las 138 cuando el puntero mejora —medido—,
pero un tope fijo demasiado bajo **satura**: al pasar de 60, el OVR se clava
en 99 y deja de decir nada.

### 3 · La salida que sale de la observación de Dlx

Si el número son eventos, hay un techo **real y conocible**: **los eventos que
ese servidor organizó**. No se pueden haber ido a más eventos de los que
hubo.

```
OVR = eventos tuyos en ese servidor / eventos que ese servidor hizo
```

- tiene un 100% natural, no inventado
- **no baja nunca** cuando otro mejora, que era el requisito de la escalera
- y dice algo: «estuviste en el 80% de lo que pasó acá»

⚠️ **Necesita un dato que no tenemos**: cuántos eventos hizo cada servidor. El
máximo que alguien tiene ahí es una cota inferior, no el número.

### 4 · ⚠️ Y un choque que hay que resolver antes

Si el número grande son **eventos en ese servidor**, y la columna ya muestra
una fila **EVENTOS**, la carta dice dos veces algo muy parecido. Hay que
decidir cuál se queda con el dato o qué mide cada uno.
