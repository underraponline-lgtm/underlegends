# El Sheet Operativo — el mapa

Medido el **20/09/2026** con `sheet/explorar_operativo.py` y
`sheet/escribir.py --ver`.

`1DFar2NSlC9YvkMQ_uKzLmfOrmthJ1lp-l3exP0NFHm8`

⚠️ **El ID no se escribe a mano.** Sale del `parentId` del proyecto de Apps
Script, que es donde Google guarda a qué planilla está atado. Un ID a mano
que *exista* apunta a otra planilla y **no avisa**.

---

## 🔴 Este archivo existe porque `CLAUDE.md` describe el OTRO

`CLAUDE.md` dice, midiéndolo: *«el Sheet no calcula nada — cero fórmulas en
las cuatro hojas de ranking — y no hay ninguna hoja de datos crudos: ni
eventos, ni brackets, ni combates»*.

**Eso es cierto del Oficial.** El Operativo es otro archivo y sí tiene la
capa de datos: `Resultados`, `1v1`, `Lista de Raperos`, `Config`. La
confusión costó una vuelta entera de trabajo.

```
Oficial     1sDo89F…   la VITRINA: Lobby, Guía, los cinco rankings
Operativo   1DFar2N…   el MOTOR: padrón, eventos, config, el Apps Script
Sheet VIP   1cgKD0M…   ⚠️ un tercero, que aparece en `Consola` y del que
                       no hay una sola línea en el repo
```

---

## Las doce hojas

| hoja | cabecera | filas | qué es |
|---|---|---|---|
| **`Lista de Raperos`** | **9** | **875** | 🔴 **el padrón.** La identidad de todos |
| **`Eventos Procesados`** | **5** | **348** | un evento por fila, con su escala y su MW |
| `AKAs` | 1 | 188 | alias → nombre real |
| `Pendientes` | 1 | 17 | lo que el motor no supo resolver |
| **`Resultados`** | **3** | **0** | 🔴 una fila por **persona y evento**. VACÍA |
| **`1v1`** | **3** | **0** | 🔴 los duelos. VACÍA |
| `Entrada` | 1 | 15 | donde se pegan las batallas crudas. Se limpia |
| `Config` | — | — | tablero: puntos, modificadores, rangos, calendario |
| `Consola` | 4 | 12 | 🔴 la configuración real del bot |
| `Log` | 1 | 0 | **cero entradas**, y eso es un hallazgo |
| `Anuncios` | 1 | 2 | — |
| `MW Puntos` | — | 0 | — |

⚠️ **La cabecera está en una fila distinta en cada hoja** —la 9, la 5, la
3, la 1— porque todas tienen banner arriba. **Adivinarla no falla:
devuelve filas.** Con «la primera fila con 3+ celdas», `Eventos
Procesados` daba *351 filas con todos los campos vacíos*. Están declaradas
en `sheet/escribir.CABECERAS`.

---

## 🔴 `Resultados` y `1v1` están vacías, y el código para llenarlas existe

`escribirLogs()` (`Code.gs:626`) escribe las dos, **es idempotente**,
resuelve el país, y **se la llama desde `procesarEvento`**. Sus columnas
coinciden exacto con las hojas: 11 y 11, 9 y 9, en el mismo orden.

**Nunca se ejecutó.** El `Log` lo dice con números:

```
Total entradas   0
Apps Script      0
```

Y `logAccion` se llama en cinco puntos de ese flujo. O sea que los 348
eventos **entraron por otro camino**.

⚠️ **El pasado no se recupera**: `Entrada` —las batallas crudas— está
vacía, porque `limpiarEntrada()` la borra después de cada tanda.

✅ **Decidido (Dlx, 20/09): el flujo manual es legado.** *«Todo es
automático, lo del sheet es viejo»* — lo legado es **el menú de la
planilla**. La pieza de escritura desde Python es **`sheet/resultados.py`**.

🔴 **Y «automático» NO era «el bot detecta solo».** Dlx lo aclaró el mismo
día: *«mayormente los usuarios pondrán las llaves y anunciarán los eventos
manualmente»*. Lo que se construyó, entonces, no es un parser de Discord
sino que **la carga a mano no se pueda hacer mal en silencio**:
`sheet/procesar_entrada.py` frena si un nombre no está en el padrón y
sugiere el parecido.

---

## `Lista de Raperos` — el padrón

`Rapero · Bandera · SV · Verificado · Discord ID · Avatar · Notas` más las
tres que se agregaron el 20/09: **`Nombre` · `País` · `Crew`**.

```
raperos                875
con bandera            875   100 %
con país (ISO)         747    85 %
con Discord ID         504    58 %
verificados ✅          339    39 %
✅ CON Discord ID      332    ← el corte de identidad de la T1
```

⚠️ **`Rapero` trae la bandera pegada** (`Ivan 🇨🇴`, `Benju ❓`) y `Bandera`
guarda el nombre en castellano, no el ISO. Por eso se agregaron `Nombre` y
`País`: el pipeline sacaba `cc` de un regex sobre el texto del nombre.

⚠️ **`✅ sin Discord ID` es el número más útil del padrón**: son **7
personas a las que les falta un solo paso** para tener tarjeta.

🔴 **El motor sólo ve la mitad.** `leerRaperos()` lee `A5:A500` y
`construirMapaPais()` lee `A10:B500`. Con los datos arrancando en la fila
10 y 875 raperos —hasta la 884—, **ve 491 y no ve 384**. Un nombre que no
está en esa lista no se resuelve y termina en `Pendientes`, que es
exactamente lo que hay ahí.

---

## `Consola` — la configuración real del bot

| | |
|---|---|
| Guild ID | `841017460341604382` (DRA) |
| Sheet Público / VIP / Operativo | los tres IDs |
| Canal Logs · Sync hora | `1504110449535483924` · 03:00 |
| Cuenta de servicio | `liga-global-bot@liga-global.iam…` |
| **Role IDs por rango** | **los ocho**, desde el 20/09 |
| Backfill / AKAOP cursor | dos cursores |
| Último sync | prueba de que `sync.py` está vivo |

✅ **Los ocho roles ya existen en Discord**, verificado contra su API. El
ítem de `CLAUDE.md` —*«crear dos roles nuevos y reasignar»*, marcado como
el único irreversible— **ya estaba hecho**; lo que faltaba era que el Sheet
lo supiera.

---

## `Config` — el tablero

No es una tabla: son bloques sueltos en columnas distintas. Pedirle una
cabecera no tiene sentido, y por eso está declarado como no-tabla.

| bloque | dónde | nota |
|---|---|---|
| Tablas de puntos | `A5:D23` | 🔴 **el motor las lee en rangos FIJOS** |
| Modificadores | `F5:G15` | idem: `G7`, `G8`, `G12` |
| Sistema | `A25:B30` | `B27` = último evento |
| MW | `J2:M22` | registro e historial |
| Servidores | `J25:N35` | **con `guild_id` desde el 20/09** |
| Calendario | `O4:R19` | **la T1 va del 19/07 al 09/10/2026** |
| **Rangos** | `T4:W13` | **los ocho, desde el 20/09** |
| Ligas | `T21:W28` | movido para hacerles lugar |
| Pesos · Requisitos · Confianza | `A38:D62` | **nuevos** |

🔴 **No se pueden insertar ni borrar filas en `Config`.** Mover una corre
`G12` y el walk-in pasa a leer otra celda. **No falla: calcula mal.**

---

## Lo que hay que saber antes de escribir

⚠️ **Una celda combinada se traga los valores en silencio.** La API dice
`200` y `4 celdas actualizadas`, y sólo queda el primero. `Config` tiene
**34** y la `Guía` del Oficial **43**. Por eso `sheet/escribir.poner()`
escribe y **después lee para comprobar**.

⚠️ **`COUNTA` cuenta la cadena vacía.** Una celda con `""` no está vacía
para Sheets: daba **874** donde hay **504**. `LEN(...)>0` las separa.

⚠️ **`RAW` no interpreta el apóstrofo** de «esto es texto»: queda literal.
Con RAW una cadena ya se guarda como cadena, así que un snowflake de 18
dígitos no se redondea.

⚠️ **Un bloque no se estira hacia abajo**: siempre hay algo debajo.

---

## Las herramientas

```bash
python sheet/explorar_operativo.py      el mapa, y una hoja en detalle
python sheet/escribir.py --ver          las 12, con su cabecera y su ancho
python sheet/padron.py                  el padrón y el corte de identidad
python sheet/resultados.py --estado     qué hay en el registro crudo
```
