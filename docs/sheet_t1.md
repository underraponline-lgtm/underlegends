# El Sheet de la T1 — «T1 Ranking Global»

Decidido por Dlx el **16/09/2026**. Va junto con **`docs/sheet_estructura.md`**,
que es el plano del viejo: *cómo* estaba armado. Éste es *qué hacer con el
nuevo*.

⚠️ **La pre-temporada se borra: era data de prueba.** Todo número del repo que
hable de 138 personas es de ahí y **no describe la T1**.

⚠️ **El Sheet lo crea Dlx.** Las credenciales del repo piden
`spreadsheets.readonly`: leen y escriben JSON local, **nunca tocan la planilla**.

---

## 🔴 DOS PREMISAS DE ESTE DOCUMENTO SON FALSAS. Medido el 20/09/2026

Las dos se escribieron el 16/09 y eran ciertas ese día. Las dos cambian
bastante el plan, así que van arriba de todo.

### 1 · La cuenta de servicio **sí puede escribir**

La frase de arriba describe **lo que piden los scripts**, no lo que la
cuenta puede. Probado contra la planilla real con un `batchUpdate` vacío:

```
scope spreadsheets (escritura)   ->  400 «Must specify at least one request»
```

Un **400 por el payload**, no un 403 por permiso: la autorización pasa. O
sea que **el Sheet de la T1 se puede construir desde acá**, no hace falta
armarlo a mano.

⚠️ **Lo único que falta es crear el archivo.** La **Drive API está apagada**
en el proyecto `liga-global` (`403 has not been used in project 955617870184`).
Se enciende con un clic en *console.cloud.google.com → APIs & Services →
Enable APIs → Google Drive API*. La alternativa es que Dlx cree el Sheet
vacío y lo comparta como **Editor** con
`liga-global-bot@liga-global.iam.gserviceaccount.com`.

### 2 · La capa de datos crudos **ya existe**: está en el OPERATIVO

`CLAUDE.md` dice que *«no hay ninguna hoja de datos crudos: ni eventos, ni
brackets, ni combates»*. **Eso describe el Oficial.** El **Operativo** es
otro archivo —`1DFar2NSlC9YvkMQ_uKzLmfOrmthJ1lp-l3exP0NFHm8`, sacado del
`parentId` de su Apps Script— y tiene doce hojas:

```
Entrada · Pendientes · Lista de Raperos · AKAs · Resultados · 1v1
Eventos Procesados · Anuncios · Config · Log · Consola · MW Puntos
```

**Cuatro de las que este documento pide crear de cero ya están ahí**, con
otro nombre: `Resultados` = `datos_resultados`, `1v1` = `datos_duelos`,
`Lista de Raperos` = `datos_raperos`, `Config` = `config`.

⚠️ **PERO DOS ESTÁN VACÍAS, Y ESA ES LA NOTICIA DE VERDAD.** Medido:

| hoja | filas con datos |
|---|---|
| `Eventos Procesados` | **348** |
| `Lista de Raperos` | **875** |
| `AKAs` | **188** |
| **`Resultados`** | **0** |
| **`1v1`** | **0** |

O sea: **los 348 eventos se procesaron y su detalle por persona no quedó
guardado.** La estructura para guardarlo existe desde siempre y nunca se
llenó. Por eso `SEG`, `TER`, `DNA` y `DIN` de la carta País dan 0 — no
porque «el dato no exista en ningún lado», sino porque **hay una hoja
esperándolo vacía**.

🔴 **Eso convierte el trabajo de la T1 en otro**: no es *diseñar* la capa de
datos, es **hacer que `procesarEvento` escriba en ella**. El motor ya
calcula todo (`calcularPuntos`, `getEscala`, `resolverNombre`); lo que falta
es que además de sumar al ranking, deje la fila cruda.

### El padrón, medido contra lo que usa el bot

`Lista de Raperos` tiene `Rapero · Bandera · SV · Verificado · Discord ID ·
Avatar · Notas`, con la cabecera en la **fila 9**.

| | |
|---|---|
| raperos | **875** |
| con bandera | 875 — **100 %** |
| con Discord ID | 503 — 57,6 % |
| verificados ✅ | 339 · ❓ 329 · ❌ 207 |
| **verificados CON ID** | **332** ← el corte de identidad de la T1 |

Contra KV, que es lo que el bot usa hoy:

```
IDs en el padrón   503        el bot conoce 443, y KV esta contenido en el padron
solo en el Sheet    60        IDs cargados que el bot no tiene
verificados con ID 332        de esos, 7 el bot no conoce
```

⚠️ **El bot trabaja con 469 personas y el padrón tiene 875.** No es que
falten datos: es que el pipeline parte del Oficial —filtrado por
rendimiento— en vez del padrón. El corte de identidad de la T1
(`discord_id` + verificado) da **332**, y ése es el número con el que hay
que pensar la T1, no los 138 ni los 469.

⚠️ **La cabecera de cada hoja está en una fila distinta** — `Lista de
Raperos` en la 9, `Resultados` y `1v1` en la 3, `Eventos Procesados` en la
5. Suponer la fila 1 devuelve cero filas y **parece que la hoja está
vacía**; me pasó con el padrón. `sheet/explorar_operativo.py` la busca.

---

---

## 🎯 LO QUE CAMBIÓ NO ES EL SHEET: ES PARA QUÉ EXISTE

Dlx, 16/09/2026: *«el objetivo era que este sheet era la única manera de ver los
datos de la gente. Ahora es diferente»*.

**Y ahí está la explicación de todo lo que `sheet_estructura.md` encontró mal.**

| | el Sheet viejo | el Sheet nuevo |
|---|---|---|
| **qué era** | **el producto**: la única ventana a los datos | **la base de datos**, con vitrina encima |
| quién lo mira | todo el mundo, porque no había otra | **el pipeline, el bot — y el curioso que quiera scrollear** |
| las hojas lindas | eran todo lo que había | **se quedan**, pero calculadas |
| las tablas de datos | no existían | **nuevas, y pueden ir ocultas** |

⚠️ **LA VITRINA NO SE BORRA.** Dlx, 16/09/2026: *«tampoco te digo que borremos
el Sheet para ver la información; me gustaría mantenerlo ahí igualmente, por si
hay curiosos»*. Y tiene sentido: es la puerta de entrada de quien todavía no
tiene el bot.

✅ **Lo que cambia es de dónde salen esas hojas lindas.** Hoy se pegan a mano —
por eso `Axinu 🇨🇴 — 24 🥇` sigue diciendo eso aunque Axinu deje de ser el que
más campeonatos tiene. **Calculadas desde `datos_resultados` con fórmulas,
siguen siendo igual de lindas y ya no pueden envejecer.** Se gana por los dos
lados: la vitrina se queda y deja de mentir.

⚠️ **Los cinco problemas del plano viejo NO eran errores: eran el precio de ser
el producto.** Si una planilla es la única vitrina, tiene que ser linda, y una
planilla linda es una mala base de datos. **Ese precio ya no hay que pagarlo**,
porque la vitrina ahora es Discord.

### A dónde se muda cada cosa que hacía el Sheet

| lo que hacía | dónde vive ahora |
|---|---|
| **Lobby** (portada) | **DRA**, que pasa a ser el lobby principal de todo |
| **Mi Perfil** (buscador por nombre) | **`/perfil`** y el click derecho → Apps → *Carta* |
| **Récords y líderes** | comandos, y un canal fijo de DRA |
| **Las tablas de ranking** | `/ranking` — y el Sheet sigue ahí para quien quiera scrollear |
| ⚠️ **La Guía** | **se queda afuera de Discord** — ver abajo |

⚠️ **La Guía es la única excepción, y conviene verla.** Es texto largo con
tablas, reglas, glosario y preguntas frecuentes: **lo único que Discord maneja
mal**. Un embed no aguanta eso y nadie lee un mensaje de 40 líneas. **Ése es
exactamente el hueco que llena el Google Site.** El resto del Site sería
repetir lo que el bot ya hace mejor.

---

## EL ESQUELETO

Tres capas, y el orden importa: **cada una se calcula desde la de arriba.**

```
1. CONFIG      los números que definen el sistema. UN solo lugar.
2. DATOS       los hechos: quién, qué evento, qué resultado.
               cabecera fila 1, congelada, sin merges, un valor por celda.
               PUEDEN IR OCULTAS: son las únicas que nadie mira.
3. RANKINGS    lo calculado. Conservan su nombre público.
4. VITRINA     el Lobby, los récords, la Guía. SE QUEDAN, para el curioso
               que entra sin tener el bot — pero salen de las de arriba
               CON FORMULAS, no pegadas a mano.
```

### 1 · `config` — una hoja, y arregla tres peleas viejas

Hoy los rangos viven en `comun/rangos.py` **y** en la Guía **y** en la columna
`Rango`, y los tres no coinciden. Una hoja `config` los pone en **un** lugar,
que además el pipeline puede leer.

| bloque | qué guarda |
|---|---|
| **rangos** | los 8 tramos y sus umbrales — ⚠️ hoy el Sheet tiene 6 y la carta 8 |
| **pesos** | Eficiencia 30 · Consistencia 24 · Dominancia 21 · Techo 15 · **Diversidad 10** |
| **requisitos** | Temporada 2 · Competitivo 10 · País 1 nacional · Servidor 1 en ese servidor |
| **confianza** | la rampa 0.80 → 1.00 y entre qué cantidades de eventos |
| **calendario** | inicio y fin de la T1 — ⚠️ de acá sale **qué se reinicia y cuándo** |
| **tabla de puntos** | posición × tamaño de bracket |

### 2 · Las hojas de datos

#### `datos_raperos` — el padrón. **Hoy no existe.**

| columna | nota |
|---|---|
| **`discord_id`** | 🔴 **la clave, y ÚNICA.** Ver abajo por qué es la columna más importante, y *2b* por qué la unicidad hay que validarla en la hoja: hoy hay un duplicado y le cuesta la carta a una persona |
| `nombre` | sin emoji y sin `❓` |
| `pais` | 🔴 **en su columna**, código ISO. Hoy viaja pegado al nombre como bandera |
| `crew` | hoy vive en `comun/crews.py` porque el Sheet no la tiene |
| `alta` | desde cuándo compite |

#### `datos_eventos` — el registro de eventos. **Hoy no existe.**

`id` · `fecha` · `servidor` · `nombre` · `tipo` · `tamaño` · `prioridad`

⚠️ **`fecha` con AÑO** (`2026-09-21`, no `21/09`) y **`id` es la clave** — el
`nombre` nunca. Los dos están medidos en *2b*, abajo.

⚠️ `tipo` distingue **bracket / liga / MW / nacional**, y de ahí sale `ev_nac`,
el requisito de la carta País. ⚠️ `prioridad` es el orden de los rombos de la
Competitiva, que hoy vive en `datos/eventos.json`.

#### `datos_resultados` — **la hoja que cambia todo**

Una fila por **persona y evento**:

`id_evento` · `discord_id` · `posicion` · `pts` · `pts_base` · `revivido` ·
`walk_in` · `wo` · `equipo`

🔴 **De acá sale TODO lo demás, calculado:** los puntos, `Ev`, los podios, el
win rate, la racha, las 7 columnas por servidor **en eventos y en puntos**, la
Diversidad, el desglose de 🥈 y 🥉 — todo.

⚠️ **Y es la hoja que el Sheet viejo no tenía.** Sus ocho hojas eran todas
*salidas*: no había registro de qué pasó. Por eso cada número había que pegarlo
a mano y por eso, cuando algo no coincidía, no había contra qué chequearlo.

#### `datos_servidores` — los 7+, y el puente con Discord

`codigo` · `nombre` · **`guild_id`** · `color` · `activo` · `aliado_desde`

⚠️ **Y va `RZ`, que hoy no está en ningún lado.** Tiene escudo
(`comun/escudos_cuad/sv_rz.png`) y fondo (`los_nueve.defs()`), pero como no es
una columna del Sheet, **nadie recibe esa carta**. Ver *2b*.

🔴 **`guild_id` es lo que hace posible `/card`.** Dlx decidió que abra en la
carta *del servidor donde escribiste*; para saber cuál es, hace falta traducir
el ID del servidor de Discord a `DRA`, `TWR`, etc. **Hoy esa tabla no existe en
ningún lado.**

⚠️ **DRA carga además el canal y el ROL de verificación** — `verificacion`,
`verificacion_mensaje` y `verificacion_rol` (el rol «Miembro»). Es el puente que
usa el corte de identidad del pool (ver *«el pool se filtra por `discord_id` +
rol Miembro»* más arriba). Hoy viven en `datos/servidores.json`; en la T1 van
acá o en `config`, porque son de un solo servidor —la puerta de entrada.

#### `datos_duelos` *(opcional, pero desbloquea dos stats)*

`id_evento` · **`ronda`** · `a` · `b` · `ganador`. Hoy los duelos son reales en
4 de 138, y `DNA`/`DIN` de la carta País —duelos por nacionalidad del rival—
**no existen en ningún lado**.

⚠️ **`a` y `b` van como `discord_id`, no como nombre, y `ronda` no es
opcional.** Sin lo primero `DNA`/`DIN` **no salen** —hace falta el país del
rival, que se joinea por ID— y sin lo segundo la racha no tiene orden dentro
de un evento. Los dos están medidos en *2b*.

### 2b · Cinco cosas que el 21/09 midió y este esqueleto no decía

Salieron de construir el lector de llaves y el escritor de la vitrina contra
datos reales. Las cinco son **baratas ahora y caras después**: son columnas de
una hoja que todavía no existe.

#### 1 · `fecha` va con AÑO, y la racha no se ordena por ella

Hoy la hoja guarda `28/04`. Con dos temporadas encima, *«el duelo anterior»*
deja de estar definido — y **«el último resultado» también**, que es otra
columna de la vitrina.

⚠️ **Pero el año no alcanza.** Dentro de un evento, todos los duelos comparten
fecha, así que la fecha **no los ordena entre sí**. La racha necesita dos
niveles: **`id_evento`** entre eventos —es monótono— y **`ronda`** adentro.
Por eso `sheet/rankings.py` la calcula así y no por fecha.

#### 1b · Los rankings necesitan columnas para **DNA** y **DIN**

Dlx, 22/09: *«en el sheet necesitamos crear más huecos para DNA y DIN»*.

| columna | qué es | de dónde sale |
|---|---|---|
| **`DNA`** | duelos ganados/jugados contra **compatriota** | `datos_duelos` + `datos_raperos.pais` |
| **`DIN`** | los mismos, contra **extranjero** | idem |

🔴 **Y no son dos columnas de adorno: son EL REQUISITO de la carta País.**
Desde el 22/09 esa carta pide *3 duelos nacionales **y** 3 internacionales **y**
bandera asignada*. O sea que si estas dos columnas no existen, la carta de País
queda bloqueada para todo el mundo y **no falla**: da 0 y 0.

⚠️ **Van en `Ranking Temporada` junto a `Win%` y `🔥`**, que es donde ya viven
los números de duelos. El formato es `ganados/jugados` —texto, como `🔥`— y no
un porcentaje: el denominador es lo que dice si el número significa algo.

⚠️ **Se CALCULAN, no se cargan a mano.** Salen de agrupar `datos_duelos`, igual
que el resto de la vitrina. La columna existe para que se vea, no para que
alguien la escriba.

#### 2 · `datos_duelos`: `a` y `b` son **`discord_id`**, y falta `ronda`

`id_evento` · **`ronda`** · **`a`** · **`b`** · `ganador`

- **Como `discord_id` y no como nombre**, el join con `datos_raperos.pais` es
  exacto y **ahí es donde salen `DNA` y `DIN`** — los duelos por nacionalidad
  del rival, las dos únicas stats de la carta País que hoy dan 0 de 138. Con
  nombres hay que volver a adivinar, que es de lo que `discord_id` nos saca.
- **`ronda`** es lo que ordena los duelos dentro de un evento. Sin ella la
  racha depende del orden de las filas, que es un accidente.

#### 3 · `discord_id` tiene que ser ÚNICO, y hoy no lo es

Medido el 21/09 sobre el padrón: **1 de 498 está repetido** —
`979878316846768139` figura como **Oasis** y como **Fullylo4ded**—. La clave
`d:<id>` de KV es un mapa, así que el segundo pisa al primero y **uno de los
dos se queda sin `/card`**. Hoy le pasa a Fullylo4ded.

⚠️ Es una sola persona y por eso no se nota; con el Sheet nuevo, `discord_id`
pasa a ser **la** clave de tres hojas. Un duplicado ahí no es un caso raro:
es dos personas compartiendo su historial. Va con validación de unicidad en la
hoja, no con un chequeo que alguien tiene que acordarse de correr.

#### 4 · RZ tiene arte y no existe como servidor

`comun/escudos_cuad/sv_rz.png` está listo y `los_nueve.defs()` tiene su fondo,
pero **RZ no está en `datos/servidores.json` ni en las 7 columnas del Sheet**.
El servidor de cada rapero se deriva de esas columnas, así que **nadie recibe
esa carta aunque esté diseñada**. Entra en `datos_servidores` o el trabajo
queda dibujado y apagado.

#### 5 · El nombre del evento NO puede ser parte de la clave

Hoy `procesar_entrada` identifica un evento por `(nombre, servidor, fecha)`,
y `llaves_a_entrada.titulo()` dice en su propio docstring *«solo para
NOMBRARLO, nunca como clave»*. Las dos cosas son razonables y juntas hacen que
una llave reposteada entre **dos veces**.

✅ **`datos_resultados` ya lo resuelve con `id_evento`**, y conviene que quede
escrito: el nombre es una etiqueta para la gente, y **nada se keyea por él**.
Ver `datos_eventos.id`.

### 3 · Los rankings

`Ranking Temporada` · `Ranking Competitivo` · `Ranking Podios` ·
`Ranking de Ligas` · `Ranking Mundial`

**Conservan su nombre**, porque la gente los conoce y hay enlaces apuntando ahí.
Lo que cambia es adentro: **cabecera en la fila 1, congelada, cero merges, sin
banner**.

---

## 🔴 `discord_id`: la columna que más rinde de todas

| arregla | cómo |
|---|---|
| **nombres repetidos** | hoy el Sheet se indexa por nombre. Con 8 servidores, dos personas iguales **colisionan en silencio** |
| **avatares muertos** | hoy `av` guarda una URL con un hash que Discord invalida. Con el ID, el bot **pide la foto al generar** |
| **`/card` sin argumento** | la interacción trae el ID de quien escribió |
| **⚠️ quién puede cobrar** | si algún día hay suscripción, el entitlement viene **por `guild_id`**, y el padrón por `discord_id`. Sin esos dos, no hay a quién darle el beneficio |

### 🔴 EL POOL DE LA T1 SE FILTRA POR `discord_id` + ROL «MIEMBRO» EN DRA

Dlx, 19/09/2026: *«para q el bot funcione osea las tarjetas se necesita el ID y
tener el rol de `1101257512273055745` en DRA»*. Ese rol es **«Miembro»**, el
que se da al verificarse. O sea que **tener carta pide DOS cosas**, y ninguna
es de rendimiento:

1. **`discord_id` cargado** — si no, el bot no reconoce a la persona y no hay a
   quién preguntarle a Discord.
2. **el rol Miembro en DRA** — estar verificado.

⚠️ **ES UN REQUISITO DE IDENTIDAD, NO DE EVENTOS, así que NO va en
`comun/requisitos.py`.** Ese archivo mide desempeño (2 eventos para Temporada,
10 para Competitivo, etc.) y sale del Sheet. Este corte es *quién entra al
pool*, y va **antes** de dibujar: `construir_pool_temporada.py` deja fuera a
quien no cumpla las dos cosas. Es la misma forma que *«sin dato no hay
pieza»* — sin identidad verificada, no hay carta.

⚠️ **Y SE SUMA AL REQUISITO DE CADA CARTA, NO LO REEMPLAZA.** Dlx, 19/09/2026:
*«para alguien tener tarjeta competitiva necesita estar sí o sí en DRA, estar
verificado y con ID también, **aparte de los requisitos q ya tiene**»*. O sea
que la Competitiva pide **identidad + 10 eventos**: pasar la identidad no
regala la carta, y tener los 10 eventos tampoco alcanza si no estás verificado.
La única que no pide eventos es la Servidor — pero identidad sí pide.

⚠️ **EL ROL SE PREGUNTA DE A UNO, Y ESO DECIDE EL DISEÑO.** `GET
/guilds/{id}/members` (la lista entera) y la búsqueda por rol piden el intent
privilegiado → **403**. `GET /guilds/{id}/members/{user}` —una persona— trae
sus roles y **no pide nada**. Por eso el builder parte del padrón (la lista) y
le confirma a Discord **de a uno** si cada uno tiene el rol. Con el token del
bot, sin intents. Ya está hecho el medidor: **`herramientas/en_dra.py`** —
corrió el 19/09/2026 sobre los 138 de prueba y dio **76 listos, 6 en DRA sin el
rol, 29 fuera, 27 sin ID**. Ese script es el que el builder de la T1 tiene que
consultar (o replicar su chequeo) para filtrar.

⚠️ **EL ROL VIVE EN `datos/servidores.json`** (`canales.DRA.verificacion_rol`),
no como número suelto. Si DRA lo cambia, se toca ahí y el medidor lo toma solo.

⚠️ **Y HOY SÓLO SE MIDE, NO SE FILTRA.** Las cartas de prueba existen igual —
son datos que se borran. El filtro se enciende **con este Sheet**, no antes:
apagarlo sobre datos de prueba no gana nada y esconde a quién le falta qué.

---

## Lo que ya no hace falta pelear

Estas estaban en la versión anterior de este documento como «agregar columnas».
**Con `datos_resultados` salen calculadas y dejan de ser columnas que alguien
tiene que acordarse de llenar:**

| | por qué deja de ser un problema |
|---|---|
| las 7 por servidor, en eventos **y en puntos** | se agrupan desde los resultados. Desbloquea el **punto 4 del rework**: que la Diversidad mida *dónde ganaste* |
| `pts_base` | es una columna de `datos_resultados` (punto 6 del rework) |
| 🥈 y 🥉 por separado | se cuentan por posición. ⚠️ Hoy el builder los **suma en `pod` y tira el desglose**, y por eso `SEG` y `TER` de País dan 0 |
| `ev_nac` | se cuenta filtrando `tipo = nacional` |
| la racha | se calcula, en vez de guardarse como el texto `actual/máxima`. ⚠️ **por `id_evento`, NO por fecha** — ver abajo |
| `Score` crudo y ajustado | los dos salen, porque la Confianza está en `config` |
| `Sv` | se deriva, y ahora **con el dato guardado** en vez de tirarlo |

---

## ✅ Resuelto: el rango va con OCHO tramos

**Dlx, 17/09/2026: «el 8… recordá que el Sheet es viejo y antiguo».** O sea que
la discrepancia no era entre dos definiciones vivas: era **una definición y un
resto**. El Sheet nuevo nace con los ocho de `comun/rangos.py`, que es la
fuente:

```
SSS 82 · SS 73 · S 62 · A 48 · B 37 · C 26 · D 18 · E resto
```

El viejo tenía seis (`S 65 · A 47 · B 36 · C 23 · D 17 · E`), y sobre la
pre-temporada eso daba **26 de 138** con una letra distinta en el Sheet que en
su carta. Ese número se va a cero solo en cuanto `config` tome los ocho.

⚠️ **PERO EL RANGO VIVE EN CINCO LUGARES Y SÓLO DOS SE ARREGLAN SOLOS.**
`CLAUDE.md` los tiene contados: `comun/rangos.py` (8), la columna del Sheet
(6), la Guía (6), el `Index.html` del Apps Script (6) y **los roles de Discord
(6)**. Cambiar el Sheet arregla la columna y la Guía; los otros dos hay que
tocarlos:

| dónde | qué hay que hacer |
|---|---|
| `config` del Sheet nuevo | los ocho umbrales, y que todo lo demás los lea de ahí |
| la Guía | reescribirla con ocho — es pública |
| `Index.html` del Apps Script | hoy pinta seis a mano |
| **los roles de Discord** | **crear dos roles nuevos (`SS` y `SSS`) y reasignar** |

⚠️ **El de los roles es el caro y es el único irreversible de cara al público**:
la gente ya lleva su rol puesto. Conviene hacerlo **antes** de que la T1
arranque y no a mitad, porque a mitad son 26 personas viendo cómo les cambia
la letra sin haber competido.

⚠️ **Y no se puede dejar a medias.** La primera regla de `CLAUDE.md` es que el
rango es **uno solo por persona** y da igual en sus cuatro cartas. Si el Sheet
pasa a ocho y los roles se quedan en seis, la incoherencia se muda de sitio en
vez de cerrarse: hoy es Sheet-contra-carta, mañana sería rol-contra-todo.

## ⚠️ Lo que sigue abierto

### ✅ Resuelto: el rango SÍ se reinicia

La Guía vieja lo ponía en *«no se reinicia»*. **Dlx, 16/09/2026: se reinicia, la
Guía está vieja.** Vale lo de `CLAUDE.md`: Score, rango, las cinco dimensiones y
el requisito de 10 eventos se miden **dentro de la temporada en curso**.

⚠️ **Y la Guía nueva no puede nacer diciendo lo contrario**: es pública, y
prometería algo que el sistema no hace.

---

## El Apps Script

Dlx ofreció pasarlo. **Conviene**, porque es lo que calcula todo y hoy es
invisible desde acá: diría de dónde salen los rankings, dónde está el registro
de eventos que la planilla no tiene, y si `competitivo.py` es en realidad eso.

⚠️ **Antes de pasarlo, revisar que no traiga secretos**: IDs de despliegue,
tokens, claves o URLs privadas. Si trae algo de eso, sacarlo primero — lo que
entra al repo queda en el historial.
