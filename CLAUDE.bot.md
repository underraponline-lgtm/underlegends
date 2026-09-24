# El bot de Discord — arquitectura y decisiones tomadas

Contexto de una sesión anterior, traído el **04/08/2026**. Ampliado el
**16/09/2026** con las dos cosas que faltaban: **cómo sale gratis** —que no es
lo que parece— y **los dos números que este mismo documento pedía medir
primero**, que ya están medidos.

**No hay que construir nada de esto todavía.** Está escrito para que las
decisiones de las cartas no se peleen con el bot después.

---

## El límite que manda: 10 ms de CPU

⚠️ **Lo más importante de todo el documento, y es contraintuitivo: el número
grande no molesta y el chiquito manda.**

El plan gratuito de Cloudflare Workers da **100.000 requests por día**. Aunque
toda la Hermandad tire comandos, no se llega ni cerca. Ese número no es el
problema.

El que sí lo es: **10 ms de CPU por request**. Esperar respuesta de red **no
gasta CPU**, pero **parsear sí**. Si el Worker se bajara el ranking entero
—735 raperos por 27 columnas— y le hiciera `JSON.parse` en cada comando, se
pasa de los 10 ms y **muere**.

De ahí sale toda la arquitectura.

✅ **Revisado el 16/09/2026: los 10 ms siguen siendo el límite del plan
gratuito.** El plan pago está en 30 s por defecto, o sea que el salto es de
**3.000 veces** — si alguna vez se paga, esta restricción desaparece entera y
media arquitectura deja de hacer falta. Conviene saber que el día que duela,
duele poco.

---

## CÓMO SALE GRATIS, que no es lo que parece

⚠️ **La pieza que evita el hosting NO es el plan gratuito de Cloudflare. Es el
_Interactions Endpoint URL_ de Discord.**

Un bot normal abre un **WebSocket al gateway** y se queda conectado. Eso es un
proceso prendido 24/7 → eso **es** hosting → eso se paga. Y peor: **un Worker no
puede sostener un WebSocket abierto**, así que sin esta pieza la arquitectura de
arriba **ni siquiera es posible**, no es que sale más cara.

La otra puerta: se registra una URL en el portal de Discord, y Discord manda un
**POST HTTP sólo cuando alguien usa un comando**. Sin gateway, sin proceso, sin
nada corriendo entre comando y comando.

El precio son dos cosas, las dos obligatorias:

1. **Verificar la firma Ed25519** de cada request: `X-Signature-Ed25519` y
   `X-Signature-Timestamp`, concatenando el timestamp con el **body crudo**
   —crudo, no el JSON ya parseado y vuelto a serializar, que es donde se cae
   todo el mundo—. Workers trae Ed25519 en WebCrypto nativo: no hace falta
   librería, y por eso tampoco cuesta CPU.
2. **Contestar el PING tipo 1 con un PONG.** Discord lo manda al registrar la
   URL y no la acepta hasta que responda.

⚠️ **La contra, y conviene saberla ahora y no después:** un bot HTTP-only
recibe **sólo interacciones**. No ve los mensajes normales del chat, no puede
reaccionar a lo que alguien escribe, no puede escuchar. Para comandos y botones
alcanza de sobra. El día que se quiera que el bot **lea el chat**, eso ya no es
gratis: vuelve el gateway y vuelve el proceso prendido. **Es la única puerta
que esta arquitectura cierra**, y conviene no prometer nada que la necesite.

---

## LOS BOTONES: el estado viaja en el botón

⚠️ **Los botones encajan con los 10 ms MEJOR que el propio comando.** Suena al
revés y no lo es.

- El **`custom_id`** de un botón vuelve **tal cual** en el payload. O sea que el
  estado viaja **en el botón** y no en una base: `c:konan:pais` y el Worker ya
  sabe todo **sin consultar nada**.
- Se contesta con **tipo 7 (`UPDATE_MESSAGE`)**, que **pisa el mismo mensaje**.
  `/perfil Konan` da un embed efímero con cuatro botones —Temporada ·
  Competitivo · Servidor · País— y clickear **cambia la carta en el lugar**, sin
  mensaje nuevo y sin llenar el canal.
- ⚠️ **Y ahí se cancelan los dos problemas de este documento:** si el PNG está
  pregenerado en una URL fija, la respuesta del botón es **un JSON de ~200
  bytes** que cambia `embed.image.url`. Cero fetch, cero parseo, cero render.
  Es lo más barato que un Worker puede hacer.

⚠️ **Un botón que se contesta sólo desde su `custom_id` NO CADUCA.** El token de
una interacción muere a los **15 minutos**, pero **cada click trae token
nuevo**. Si la respuesta necesitara algo guardado de la interacción original,
los botones se morirían al cuarto de hora y nadie entendería por qué. Como no lo
necesita, una carta de hace un mes sigue andando. **Es la misma razón por la
que el estado va en el `custom_id`, y no son dos decisiones sino una.**

Caben **5 botones por fila y 5 filas**. Las cuatro cartas entran en una sola.

### ⚠️ LA CARTA NO VA DENTRO DE UN EMBED

Dlx, 16/09/2026: *«la imagen y los botones pero no dentro de un embed»*. **Y no
es sólo estética.**

Un embed te obliga a poner al lado, en texto, el nombre, el rango y el OVR —
que ya están **dibujados en la carta**. Eso es el mismo dato en dos lugares, que
es exactamente la forma que mordió a Bloody: *identidad y número saliendo de
sitios distintos pueden discrepar*. **Sin embed hay un solo lugar donde el dato
vive, y ese lugar es el PNG.**

Se hace con **Components V2**, el flag `1 << 15` (`IS_COMPONENTS_V2`). La imagen
va en un **Media Gallery**, que acepta *«both uploaded media and externally
hosted media»* — o sea que **apunta directo a la URL de R2** y no hace falta
adjuntar nada.

⚠️ **Lo que el flag te saca, y hay que saberlo antes de escribir el primer
handler:**

| se pierde | qué hacer en cambio |
|---|---|
| `content` | el texto va en un **Text Display** |
| `embeds` | no se pueden mezclar: es uno **o** el otro, por mensaje |
| adjuntos visibles por defecto | se referencian desde un componente |
| `poll` y `stickers` | no se usan acá |

Límite: **40 componentes por mensaje**, y el Media Gallery aguanta **1–10**
imágenes. Con una carta y cuatro botones sobra — pero ese 1–10 es lo que hace
posible un `/vs` con **las dos cartas en un mismo mensaje**, sin embeds.

⚠️ **Y el update tiene que ser V2 también.** Si el mensaje nació con el flag, la
respuesta tipo 7 del botón lo lleva igual. Mezclar los dos formatos en el mismo
mensaje no es una opción.

### ⚠️ Y TAMPOCO VA TEXTO SUELTO: el botón apagado es la etiqueta

Dlx, 16/09/2026: *«tampoco quiero que haya plain text porque básicamente el
plain text muestra la info de la tarjeta»*. Es la misma regla que el embed, un
paso más allá — y deja el mensaje en **dos cosas**: la carta y los botones.

Lo que reemplaza al texto: **el botón de la carta que estás viendo va
`disabled` y en gris** (Secondary), y los otros tres quedan en azul (Primary).
Así la fila de botones hace **las dos cosas a la vez**: te dice dónde estás y a
dónde podés ir.

⚠️ **Y no es sólo estético: un botón apagado no se puede clickear.** Pedir la
carta que ya estás viendo es un request que Discord manda igual y el Worker
tiene que contestar. Apagarlo lo **evita en el cliente**, así que el botón que
informa es el mismo que ahorra.

⚠️ **Los otros tres NO pueden ser grises.** Si todos son Secondary, la única
diferencia es el `opacity: 0.5` del deshabilitado, que sobre el gris de Discord
casi no se ve. El contraste tiene que venir del color, no de la opacidad.

---

## 🔴 LA T1 ARRANCA DE CERO, Y ESO DA VUELTA EL LANZAMIENTO

Dlx, 16/09/2026: *«vamos a empezar de 0 para la T1, entonces poco a poco habrá
más datos; además usaremos un Google Sheet nuevo, específicamente para la T1, y
de ahí también uno para el ranking histórico, que es otro proyecto aparte»*.

⚠️ **TODOS LOS NÚMEROS DE ESTE DOCUMENTO SON DE LA PRE-TEMPORADA.** Las 138
personas, los 574 pares persona-servidor, los 987 PNG, los 771 MB: **eso es el
pool de hoy, que se va a tirar.** Sirven como cota superior —la T1 tarda meses
en llegar ahí— no como el tamaño del día 1.

### ⚠️ EL DÍA 1 DE LA T1, TODO EL MUNDO ESTÁ BLOQUEADO. LAS CUATRO CARTAS.

No es una hipótesis, es aritmética con los requisitos ya decididos:

| carta | pide | el día 1 nadie tiene |
|---|---|---|
| Temporada | 2 eventos | ✅ bloqueada |
| Competitivo | 10 eventos | ✅ bloqueada |
| País | 1 evento nacional | ✅ bloqueada |
| ~~Servidor~~ | ~~1 evento **en ese servidor**~~ | **YA NO — ver abajo** |

**O sea que la Bloqueada no es el caso raro: es LA CARTA DEL LANZAMIENTO.** Lo
primero que la Hermandad entera va a ver del bot es una ovalada gris que dice
`0/2 EVENTOS · TE FALTAN 2`. **La barra de progreso es el producto el día 1**, y
conviene mirarla con esa importancia y no como un cartel de error.

✅ **SALVO LA SERVIDOR, Y ESO CAMBIA EL DÍA 1 ENTERO.** Dlx sacó su requisito
el 17/09/2026 (la sección de abajo). O sea que el día 1 de la T1 **hay una
carta de verdad**: la de tu servidor, con tu nombre, tu rango, tu bandera y
tu escudo, y los contadores en cero. Tres ovaladas grises y **una carta**.

Y es justo la que conviene que sea: *«la carta Servidor es el argumento de
venta — es lo que gana un servidor aliado al sumarse»*. El día 1 es el único
día en que todos los servidores aliados miran a la vez.

### 🔴 Y POR ESO `/card` REVIENTA EL DÍA 1

Seguí el camino con los requisitos ya decididos:

```
/card  →  ¿Competitiva desbloqueada?  NO (0 eventos)
       →  Servidor del guild
       →  ¿llega al requisito?        NO (0 eventos)
       →  Bloqueada de ese servidor
       →  bloqueada.html(carta='servidor')
       →  ☠️ ZeroDivisionError
```

✅ **CERRADO EL 17/09/2026, Y NO POR EL CAMINO QUE PARECÍA.** El arreglo
obvio era que `bloqueada.py` no dividiera por cero. El que quedó es que ese
camino **no se recorre**: sin requisito, la Servidor no llega nunca a la
Bloqueada. `bloqueada.py` igual revienta con `ValueError` en vez de dividir
por cero —eso se arregló aparte— pero ya no lo llama nadie con `'servidor'`.

⚠️ **La lección es la de siempre acá: un bug latente cambia de tamaño cuando
cambia lo que se ejecuta primero.** Este pasó de «detalle» a «lo primero del
día 1» sin que nadie tocara el código, y volvió a «no existe» por una
decisión de producto. Ninguno de los tres estados se ve leyendo la función.

**El primer `/card` de la T1 es exactamente el que falla.** El bug parecía un
detalle latente cuando lo encontré —la Servidor no tenía requisito y nadie la
llamaba así— y con la T1 arrancando de cero pasa a ser **lo primero que se
ejecuta**. `herramientas/puedo_generar.py` ya lo reporta (`Bloqueada 3 de 4`).

### El ritmo de actualización también se da vuelta

Una Bloqueada **cambia cada vez que alguien compite**: `0/2` → `1/2` →
desbloqueada. Al principio de la T1 las cartas se mueven **por evento**, no por
día.

⚠️ **Así que el cron diario deja de ser el mecanismo principal y pasa a ser la
red.** El que manda al arrancar es el **`workflow_dispatch`** —el botón en
GitHub— apretado cuando cierra cada evento. Al revés de como está escrito más
arriba, que asumía un pool estable.

✅ **La buena noticia**: al principio hay **muchísimo menos** que pregenerar, así
que el presupuesto de R2 y de Actions sobra por un margen enorme durante meses.

### ⚠️ EL SHEET NUEVO ROMPE EL PIPELINE, Y YA HAY UNA PIEZA QUE LO HACE BIEN

Dos acoplamientos duros a **este** Sheet:

1. **El ID está clavado en 5 archivos**: `sheet/explorar_sheet.py`,
   `construir_pool_temporada.py`, `construir_pool_competitivo.py`,
   `construir_pool_mundial.py` y `03_Servidor/disenos/ovr_que_mide.py`. Más
   `CLAUDE.md` y `01_Temporada/README.md`. **Tiene que ser configuración, no
   una constante repetida siete veces** — si no, cambiar de Sheet es cambiar
   siete lugares y olvidarse de uno.

2. ⚠️ **Tres de los cuatro builders buscan la cabecera por NÚMERO DE FILA**:
   `t[15]`, `c[11]`, `v[15]`, `c[12:]`. Eso vale para un Sheet cuyo encabezado
   está donde está hoy. **El Sheet de la T1 casi seguro mueve esas filas.**

   ✅ **Y el cuarto ya lo resuelve bien.** `construir_pool_mundial.py` tiene
   `fila_de(v, texto)` y busca las filas **por su rótulo**
   —`fila_de(v, 'LA SELECCIÓN')`, `fila_de(v, 'RANKING DE PAÍSES')`—, así que
   sobrevive a que la planilla se corra. **El patrón que aguanta ya está en el
   repo, usado por uno de cuatro.** Es la misma forma de siempre: la solución
   existe en un archivo y los otros no la conocen.

### El ranking histórico es la carta #6

`CLAUDE.md` lista **Histórico** como *«acumulación de todas las temporadas»* y
**sin concepto**. Con esto ya tiene **fuente**: su propio Sheet, en su propio
proyecto. Sigue faltando decidir **qué número muestra** —la primera regla del
proyecto— pero deja de ser una carta sin nada detrás.

### Qué conviene hacer AHORA, entonces

⚠️ **Correr el builder hoy contra el Sheet viejo no sirve**: gasta credenciales
y produce datos que se tiran. Lo que sí conviene, y **nada de esto necesita ni
credenciales ni el Sheet nuevo**:

1. **Arreglar el crash** de `carta='servidor'` — es lo primero que ejecuta la T1.
2. **Sacar el ID del Sheet a configuración**, y pasar las tres cabeceras a
   buscarse por rótulo como ya hace `construir_pool_mundial.py`.
3. **Guardar las 7 columnas por servidor** en el builder, que es el cambio de
   código que ya estaba decidido.
4. **Escribir el Worker**, que no depende de la forma de los datos.

El día que exista el Sheet de la T1 se apunta la configuración y se corre.

---

## `/card`: QUÉ CARTA SALE PRIMERO

Decidido por Dlx el 16/09/2026:

```
/card
 ├─ ¿tiene la Competitiva desbloqueada (10+ eventos)?  →  Competitiva
 └─ si no                                              →  Servidor DEL GUILD
                                                           donde escribió
```

Medido sobre las 138: **116 abren en la Competitiva y 22 en la Servidor.**

⚠️ **Vale saber el número del otro lado**: la Servidor es *el argumento de venta*
de cada aliado y con esta regla sólo 22 personas la ven primero. Está a un
click, y la Competitiva sí es la carta de prestigio — pero el número no era
obvio y conviene tenerlo escrito antes de que sorprenda.

### ⚠️ «El servidor donde escribió» NO es el `sv` de hoy, y ahí estaba el problema

Hoy el `sv` de cada persona sale del **argmax de 7 columnas del Sheet** — aquel
donde tiene más puntos. Medido:

| | |
|---|---|
| jugaron en **2 o más** servidores | **134 de 138** |
| jugaron en uno solo | 4 |
| tienen `sv = TFC` | **79** |
| tienen `sv = DRA` | **1** |

⚠️ **O sea que hoy, si uno de esos 79 escribe `/card` en el Discord de DRA, le
sale una carta de TFC.** Y DRA —un servidor aliado— le mostraría su carta a
**una sola persona** de las 138. La carta que es el argumento de venta de cada
aliado es justamente la que casi nadie ve ahí. **La decisión de Dlx lo da vuelta:
cada servidor muestra SU carta a SU gente.**

### ⚠️ Y por eso el cambio del builder pasó de pendiente a BLOQUEANTE

`construir_pool_temporada.py` lee las 7 columnas por servidor **sólo para el
argmax y tira los valores**. Verificado: el pool guarda `sv` y `srv`, y **cero
columnas por servidor**.

**Hoy es literalmente imposible dibujar «la carta de DRA» de alguien cuyo argmax
es TFC.** El dato está en el Sheet y el pipeline lo descarta — la misma forma
que el bug de los 597 bloqueados: *el dato estaba y el pipeline lo tiraba*.

### Lo que cuesta, y sigue entrando

| | antes | con esta regla |
|---|---|---|
| cartas de Servidor | 138 (una por persona) | **574** (una por persona-y-servidor, ×4.2) |
| PNG totales | 552 | **987** |
| peso en R2 | 431 MB | **771 MB** — el **7.5 %** de los 10 GB |
| render por corrida | 13 min | **24 min** → **83 corridas/mes** |

⚠️ `herramientas/puedo_generar.py` va a pasar a esperar **574** en Servidor, no
138. Si sigue esperando 138, la herramienta que existe para avisar no avisa.

### El menú de servidores

Dlx: *«debajo de los botones, cuando ÚNICAMENTE sea la opción de SERVIDOR la
activada, un dropdown que te deje elegir otros servidores — aparecerán todos
pero algunos estarán como (BLOQUEADA) y abajo en la descripción aparecerá el
requisito»*.

Un **String Select**, y las restricciones de Discord están verificadas:

| | |
|---|---|
| campos de cada opción | `label` · `value` · `description` · `emoji` · `default` |
| máximo de opciones | **25** — sobran para 7 servidores |
| `label` y `description` | **100 caracteres** cada uno |
| marcar el actual | `default: true` en esa opción |
| dónde vive | **su propia Action Row**: un select NO comparte fila con botones |

⚠️ **NO SE PUEDE APAGAR UNA OPCIÓN SUELTA.** El campo `disabled` existe **sólo
en el select entero**, no por opción. O sea que un `(BLOQUEADA)` **se puede
elegir igual**.

**Y está bien que se pueda**, porque encaja con la otra decisión de Dlx: elegir
un servidor donde no jugaste **devuelve la Bloqueada de ese servidor**. El
`(BLOQUEADA)` del label es un aviso, no un candado — y la descripción dice
exactamente qué falta. Si algún día Discord agrega `disabled` por opción, **no
hay que usarlo**: apagarla escondería la invitación a sumarse.

⚠️ **El select aparece SÓLO con la Servidor activa.** En las otras tres no se
dibuja, así que los componentes del mensaje cambian según la carta. Con el tipo
7 (`UPDATE_MESSAGE`) eso es normal: se manda el array de componentes nuevo.

### Dos cosas que este cambio destapó en el código

1. ⚠️ **`comun/bloqueada.py` REVIENTA con `carta='servidor'`.** `REQUISITOS`
   tiene la Servidor en `(0, None, ...)` y la barra de progreso hace
   `100 * ev / meta` → **ZeroDivisionError**. Hoy no lo llama nadie así porque
   la Servidor no tenía requisito; **con esta decisión es lo primero que se
   llama**. Verificado: las otras tres cartas salen bien y ésa sola explota.

2. **La Servidor deja de ser «sin requisito».** Pasa a pedir **1 evento en ESE
   servidor**, y es el **primer requisito que lleva un parámetro** — no es
   «¿llegás?» sino «¿llegás *acá*?». `comun/requisitos.py` está escrito para
   requisitos globales; hay que abrirle esa puerta.

   ⚠️ **No se conecta hasta que el builder guarde las columnas por servidor.**
   Si se conectara hoy, `ev_sv` valdría 0 para todos y las 138 quedarían
   bloqueadas en los 7 servidores — un requisito que mide un campo que no
   existe **bloquea a todos y parece que funciona**.

---

## OCHO SERVIDORES A LA VEZ: por qué no se pisan

Dlx, 16/09/2026: *«qué pasa si Pepito y yo usamos el comando en diferentes
servidores y en diferentes personas casi al mismo tiempo, ¿se buguea?»*.

**No, y no es por suerte: es porque el Worker no guarda nada.** Cada
interacción es una petición HTTP independiente y **todo viaja adentro**:

| qué | de dónde sale |
|---|---|
| quién preguntó, en qué servidor y canal | del payload de la interacción |
| a quién le pidió la carta | del argumento del comando |
| qué carta está mirando | del **`custom_id`** del botón |
| a dónde vuelve la respuesta | del **token** de esa interacción |

⚠️ **Y ahí se cobra la decisión del `custom_id`.** El estado se puso en el botón
para que el Worker no tuviera que consultar nada. Que aguante concurrencia **es
una consecuencia de eso**, no una funcionalidad aparte: no hay estado compartido
que dos pedidos puedan pisar. Además los mensajes son **efímeros**, así que el
de Dlx y el de Pepito son dos mensajes distintos que nunca se cruzan.

### ⚠️ PERO HAY UNA SOLA MANERA DE ROMPERLO, Y HAY QUE CONOCERLA

**Una variable global en el Worker.** Cloudflare **reutiliza el isolate entre
peticiones**, y un mismo isolate puede atender **varias a la vez** en un event
loop de un solo hilo: mientras una espera un `await`, entra otra. Su propia
documentación lo dice —*«no uses ni mutes estado global»*— y el ejemplo que usan
para ilustrarlo es literalmente nuestro caso:

```js
let usuarioActual = null;          // ☠️ MAL: vive entre peticiones

export default {
  async fetch(req, env) {
    usuarioActual = leerNombre(req);        // Pepito la pisa acá
    const datos = await env.KV.get(usuarioActual);  // y vos leés la de él
    return carta(usuarioActual, datos);
  }
}
```

Lo correcto es que **nada salga del `fetch`**: el nombre se pasa por argumento,
y lo único que vive afuera son los *bindings* de `env`, que son de sólo lectura.

⚠️ **Es exactamente la clase de bug que este proyecto ya persigue.** Pasa la
lectura del diff, anda perfecto probándolo vos solo, y falla **sólo cuando hay
dos personas a la vez** — o sea, recién en producción y de forma intermitente.
Es el `KeyError: 'URBF'` otra vez: invisible con la muestra, seguro con el pool.

### ⚠️ El `custom_id` lleva la IDENTIDAD, nunca la URL

`c:konan:pais`, **no** `c:https://.../konan-pais-a3f9.png`.

Si llevara la URL, funcionaría hoy y se rompería mañana: el job versiona el
nombre del archivo en cada corrida —hay que versionarlo, porque Discord cachea
por URL— así que el botón de un mensaje de ayer apuntaría a un PNG que **ya no
existe**. Con la identidad adentro, el Worker resuelve la URL vigente en KV y un
mensaje de hace un mes sigue andando.

### Lo que 8 servidores SÍ obligan a decidir

- **Los comandos van globales, no por servidor.** Registrados una vez, aparecen
  en los ocho. Tardan hasta una hora en propagarse; los de un servidor puntual
  son instantáneos y sirven para probar.
- ⚠️ **El dato es global: desde TWR se puede pedir la carta de alguien de DRA.**
  No es un bug —la liga es una sola— pero **la carta de Servidor es el argumento
  de venta de cada servidor aliado**, así que conviene decidir a propósito si
  `/server` deja mirar el de al lado.
- ⚠️ **Nombres repetidos.** El Sheet se indexa por nombre; dos personas iguales
  en servidores distintos hoy colisionan en silencio.

**De carga no hay problema por ningún lado**: ocho servidores tirando comandos
todo el día no llegan a una décima parte de los 100.000 diarios, y cada petición
son un par de milisegundos.

---

## ⚠️ EL PREFIJO (`!konan`) NO SE PUEDE, Y NO ES POR CLOUDFLARE

Dlx preguntó si hay alguna manera. **La hay, pero rompe justo la pieza que hace
que esto sea gratis**, así que conviene entender por qué antes de descartarlo.

Un prefijo obliga al bot a **leer lo que la gente escribe**. Eso pide el
**Message Content Intent**, que es un intent **del gateway** y además
privilegiado. O sea: gateway → WebSocket abierto → proceso prendido 24/7 →
hosting. Es exactamente lo que el Interactions Endpoint URL evita.

⚠️ **Y no es un límite de Cloudflare: Discord no empuja mensajes por HTTP.**
Por esa puerta sólo salen **interacciones**. No hay forma de recibir un
`!konan` sin estar conectado al gateway, con ningún proveedor.

⚠️ **Encima el intent se paga dos veces.** A partir de cierto tamaño Discord
pide justificarlo en una revisión, y para un bot que sólo muestra cartas, *«necesito
leer todos los mensajes de tu servidor»* es difícil de sostener — y los
servidores aliados lo ven en la ficha del bot.

### Las tres alternativas, y las tres SON gratis

Son **application commands**, así que entran por el mismo endpoint HTTP:

| | cómo se usa | por qué es mejor que un prefijo |
|---|---|---|
| **comando de usuario** | click derecho en la persona → Apps → *Carta* | **no escribís el nombre**: el bot ya sabe a quién |
| **comando de mensaje** | click derecho en un mensaje → Apps → *Carta* | sirve para el que acaba de escribir |
| **nombre corto** | `/lg konan` | una tecla más que `!lg`, y con autocompletado escribís `kon` |

⚠️ **El comando de usuario es el que hay que mirar**, porque un prefijo se
inventó para escribir menos y ese escribe **cero**.

### Si algún día se quiere el prefijo igual

Hace falta un proceso prendido. La única opción realmente gratis es una VM
*Always Free* de Oracle Cloud — pero **conviene saber cómo se porta**: el
15/06/2026 Oracle bajó la cuota de 4 OCPU/24 GB a **2/12 sin anunciarlo**
—editaron la documentación— y avisaron que las instancias por encima del límite
nuevo **se terminan**. Mucha gente se enteró cuando se le apagó.

⚠️ **Es la forma que este proyecto ya conoce: algo que cambia en silencio y te
enterás cuando está roto**, igual que los avatares del CDN. No se recomienda.

✅ **La buena noticia: la decisión no es permanente.** Si algún día hay un bot
de gateway, **no reemplaza nada de esto** — leería el prefijo y llamaría a las
mismas URLs de R2 y a los mismos datos de KV. El prefijo sería una puerta más,
no una arquitectura distinta.

---

## La arquitectura, ya decidida

```
Discord              la vidriera     Interactions Endpoint URL, sin gateway
Cloudflare Workers   el puente       sólo lee; 10 ms de CPU
KV                   lo masticado    una clave por persona
R2                   los PNG         egress cero
GitHub Actions       el pipeline     Playwright + el Sheet, en cron
el Sheet             la fuente de verdad
```

**Nada se procesa en Discord.**

### El Worker NO lee el Sheet

Decisión tomada, consecuencia directa de los 10 ms. El Worker lee **datos ya
masticados** guardados en **KV**.

Los límites de **escritura** de KV son **1.000 por día**, así que el reparto es:

- **el pipeline escribe** una vez por actualización;
- **el Worker sólo lee.**

⚠️ **Una clave por persona, NO un blob único.** Si el Worker se baja un JSON con
los 138 y le hace `JSON.parse`, vuelve el problema de los 10 ms que este
documento identificó primero — y vuelve **disfrazado**, porque "leer de KV"
suena a que ya se respetó la regla. Con `p:konan` lee un valor chico y parsea un
objeto. 138 escrituras por refresco contra un límite de 1.000: entra.

### Los comandos previstos

| | |
|---|---|
| `/perfil <nombre>` | la carta + los cuatro botones |
| `/card <nombre> <tipo>` | una carta suelta |
| `/ranking [servidor\|país\|crew]` | texto, con `◀ ▶` |
| `/stats <nombre>` | las seis dimensiones |
| `/server <sv>` | la carta del servidor + su top |
| `/mw` | el Ranking Mundial — ⚠️ arranca en T2 |

**Y tres formas de pedir lo mismo sin escribir el nombre**, decididas el
16/09/2026 en lugar del prefijo (ver más abajo por qué el prefijo no se puede):

| | cómo |
|---|---|
| **comando de usuario** | click derecho en la persona → Apps → *Carta* |
| **comando de mensaje** | click derecho en un mensaje → Apps → *Carta* |
| **nombre corto** | `/lg konan` |

⚠️ **Los tres son `application commands`**, así que se registran en el **mismo**
endpoint `PUT /applications/{id}/commands` que los slash y entran por la misma
puerta HTTP. No son una integración aparte: son el mismo handler con otro
`type`.

La respuesta va **efímera y sin embed**: la carta y los botones, nada más.

---

## YA ESTÁ MEDIDO (16/09/2026)

Este documento cerraba pidiendo *«una carta, una persona, a mano, cronometrada
de punta a punta, y su peso en PNG. Esos dos números deciden lo demás»*. Hecho:

| | |
|---|---|
| Temporada · Competitivo · Servidor · País, **en frío** | 7.4 · 7.0 · 4.9 · 5.3 s |
| seis cartas **de un tirón** | 8.7 s → **1.45 s por carta** |
| peso del PNG | **800 KB de media** (1037 · 769 · 756 · 636) |

⚠️ **El arranque de Chromium se come casi todo**: 5.3 s de arranque contra
1.45 s de carta. **El número que decide es el segundo**, y son distintos por un
factor de 3.6. Medir una sola carta y sacar conclusiones habría dado una
respuesta 3.6 veces peor que la real — es la regla de siempre: *medir el caso
que manda, no el que se tiene a mano*.

### Qué deciden esos dos números

⚠️ **Renderizar a pedido está descartado, y no sólo por Playwright.** Discord
exige ACK en **3 segundos** y una carta en frío tarda 5–7. Se puede diferir
—tipo 5 da 15 minutos— pero el usuario **igual espera**. Sumado a que Playwright
no corre en un Worker, la respuesta es **pregenerar**.

**Y ahora son 552, no 414**, porque la carta de País existe: 138 × **4**.

| | |
|---|---|
| 552 PNG × 800 KB | **431 MB** |
| free tier de R2 | **10 GB** → se usa el **4 %** |
| generar las 552 a 1.45 s | **~13 min** |
| free tier de GitHub Actions | **2.000 min/mes** → **~150 corridas/mes** |

O sea: **cuatro refrescos completos por día, gratis**, y sobra.

---

## El stack completo, y sale en cero

| pieza | dónde | gratis por |
|---|---|---|
| el comando y los botones | **Cloudflare Workers** + Interactions Endpoint URL | 100k req/día, y **sin proceso prendido** |
| los datos masticados | **KV**, una clave por persona | 1.000 escrituras/día sobran para 138 |
| los 552 PNG | **R2** | 10 GB, 10M lecturas/mes, **egress cero** |
| el render (Playwright) | **GitHub Actions** en cron | 2.000 min/mes, y usa 13 |
| el Sheet → KV | el mismo Action | ya es el Python que corre hoy |

⚠️ **R2 y no KV para los PNG.** KV aguanta valores grandes, pero servir un PNG
**a través del Worker** gasta CPU en relayear bytes, y vuelve el problema de los
10 ms. R2 con dominio propio sirve el archivo **sin pasar por el Worker**: el
botón devuelve una URL y Discord la busca solo.

---

## Tres trampas, y una es un déjà vu

1. ⚠️ **Discord cachea la imagen del embed POR URL.** Si se regenera la carta y
   la URL no cambia, su proxy puede seguir sirviendo la vieja, y no avisa. Hay
   que **versionar la URL** (`pais-<hash>.png`). **Es el bug de los avatares
   otra vez**: *el contenido cambió y el link no*. A este proyecto esa forma ya
   lo mordió dos veces — con los avatares del CDN y con el `?size=128`.
2. ⚠️ **Tres de los cuatro exportadores escriben en el directorio actual.**
   Sólo `04_Pais/exportar_png.py` usa `04_Pais/salida/`; los otros tres toman
   `argv[2]` y si no se les pasa, dejan el PNG **donde estés parado**. Hoy no
   molesta porque se corren a mano; en un job de Actions sí, porque la ruta
   tiene que ser predecible para subirla a R2.
3. ⚠️ **El repo no tiene remoto.** Actions lo necesita, y ahí entran
   `creds.json` y el token como *secrets* del repo. Es el paso que va antes que
   ninguno, y el que más cuidado pide.

---

## Qué significa esto para las cartas

### ⚠️ Un PNG pregenerado envejece

Los avatares caducan — medido: **6 caídos de 20 en julio, 11 el 04/08**, y
**dos murieron en seis días** en la muestra exportada el 29/07.

Una carta pregenerada hoy puede mostrar una foto que mañana ya no existe. Eso
**refuerza** el pendiente de traerlos de Discord al generar, que necesita el
token del bot — y que el bot exista es justamente lo que lo destraba.

⚠️ **Y hoy sólo hay 10 fotos de 138**, así que 128 cartas salen con la inicial.
`comun/respaldo.py` tapa lo que puede. El token arregla las dos cosas de una.

### El tamaño de cada carta no es un detalle estético

En Discord el feed escala **por alto**, así que la carta más baja se muestra
**más ancha**. Temporada 438, Competitiva 485, Servidor 405, País 402.

---

## El modelo de negocio, y lo que implica para el diseño

Dlx, 16/09/2026: *«la mayoría de cosas me gustaría que esté integrado en el
servidor mismo, principalmente DRA, y hacer que DRA sea el lobby principal de
todo. Tampoco estoy restringiendo todo únicamente a DRA, ya que el objetivo es
que la gente agregue nuestro bot poco a poco a 8 servidores mínimamente, y
eventualmente quizás cobrar mensual por los beneficios de este y lo que conlleva
ser parte de LA LIGA GLOBAL»*.

### DRA es el lobby, y eso mueve la portada del Sheet a un servidor

La hoja **Lobby** del Sheet existía porque la planilla era la única ventana.
**Ese trabajo ahora es de DRA.** Lo mismo «Mi Perfil», que es literalmente lo
que hace `/perfil`. Está desarrollado en `docs/sheet_t1.md`.

⚠️ **Y ahí hay una tensión que conviene nombrar antes de que sorprenda: DRA
pasa a ser dos cosas a la vez** — el hub de toda la Liga **y** uno de los ocho
servidores aliados. Su carta de Servidor mide lo segundo; su rol de lobby es lo
primero. **Si se mezclan, el argumento de venta se diluye**: un aliado se suma
para tener *lo suyo*, no para ser sucursal de DRA.

### ✅ COBRAR NO ROMPE LA ARQUITECTURA GRATUITA

Verificado el 16/09/2026. Discord tiene monetización nativa, y encaja exacto:

- **Guild Subscriptions**: el beneficio es **de todo el servidor**, no por
  persona. Es el modelo que Dlx describe.
- ⚠️ **El entitlement viene DENTRO del payload de la interacción.** O sea que
  *«¿este servidor paga?»* se contesta **leyendo el mismo POST que el Worker ya
  parsea** — sin pasarela de pago, sin webhook, sin base de quién pagó, sin un
  solo request extra. **Sigue entrando en los 10 ms.**
- **El corte es 85/15** hasta el primer millón de dólares acumulado, y 70/30
  después.

⚠️ **Y hay una obligación, no una opción**: la *Monetization Requirements* de
Discord exige que, si la app ofrece capacidades pagas, **se puedan comprar por
Discord** a un precio no mayor que por cualquier otra vía. O sea que cobrar por
afuera y saltearse a Discord **no es una alternativa disponible**.

⚠️ **Lo que sí hay que decidir es qué se paga y qué no**, y conviene hacerlo
temprano: el `custom_id` de un botón es público y adivinable, así que **el
candado tiene que estar cuando el Worker resuelve**, no en qué botones dibuja.

---

El bot en otros servidores es un **beneficio exclusivo por tenerlo**.

**Por eso existe la carta de Servidor**: es lo que un servidor aliado gana al
sumarse.

**Y por eso las estrellas del Interserver van en esa carta y no en la
personal**: son del servidor, y son el **argumento de venta**.

⚠️ **Una tensión que conviene mirar antes de cerrar la Servidor.** Si las
estrellas son el argumento de venta, hoy están en la posición más frágil de la
carta:

- se achicaron de 26 a 24 y después a **21 px**;
- viven **fuera del `clip-path`**;
- sobre fondo claro lo único que las sostiene es su contorno.

Ninguna de esas tres cosas está mal por separado. Pero si son lo que se vende,
merecen una revisión deliberada y no quedar como quedaron por decisiones
sueltas.

---

## El token es un secreto, igual que `creds.json`

⚠️ **El token del bot no se commitea nunca.** Si entra al historial, **no
alcanza con borrarlo en el commit siguiente**: queda ahí y hay que
**regenerarlo en el portal de Discord**.

### ✅ DECIDIDO: NO SE ROTA NADA HASTA QUE TODO ESTÉ AL 100 %

Dlx lo dijo dos veces, el 19 y el 20/09/2026: *«igualmente lo cambiaremos al
final pero de momento guardalo»* y *«recuerda guardar todo lo que
supuestamente es secreto para no perder acceso tanto como tú y yo. Cuando
todo esté al 100 % ahí cambiaremos todos los importantes tokens, tranquilo»*.

⚠️ **Esto no contradice la regla de arriba: la ordena en el tiempo.** Las
claves siguen sin entrar al repo —eso no se negocia— pero **tampoco se rotan
de motu propio**. Rotar una a mitad de camino deja al pipeline sin acceso y
cuesta una sesión entera reconectarlo, que es justo lo contrario de lo que
protege.

**Qué hay hoy, y dónde vive cada cosa** (20/09/2026):

| dónde | qué | para qué |
|---|---|---|
| `.env` | `DISCORD_APP_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_TOKEN` | el bot |
| `.env` | `DISCORD_GUILD_PRUEBA` | el servidor de registro instantáneo |
| `.env` | `MEE6_*` (4) | la app vieja, no la usa nada hoy |
| `.env` | `CLOUDFLARE_API_TOKEN` | KV, R2 y desplegar el Worker |
| `creds.json` | cuenta de servicio `liga-global-bot@…` | los dos Sheets y el Apps Script |
| llavero de Windows | el token de `gh` | GitHub, cuenta `underraponline-lgtm` |

⚠️ **Los dos archivos están en `.gitignore` y NUNCA estuvieron en un commit.**
Medido el 20/09/2026 con `herramientas/barrer_historial.py` sobre los 414
commits y los 2.038 blobs de texto del historial: **cero claves**. O sea que
el repo se puede empujar entero sin rotar nada — que es exactamente lo que
esta decisión pedía comprobar antes.

⚠️ **Y el barrido se vuelve a correr antes de cada primer push a un remoto
nuevo**, no una sola vez. `.gitignore` protege de acá en adelante; el
historial es hacia atrás, y es lo que sube completo la primera vez.

**Cuando se rote, al final, son seis lugares**: el token de Discord (portal),
la cuenta de servicio (Google Cloud), el token de Cloudflare, el de GitHub, y
las dos apps MEE6 si para entonces siguen existiendo.

`.gitignore` ya cubre `token.json`, `bot_token*` y `.env`. Verificado el
16/09/2026: los cuatro ignorados. La comprobación es la de siempre:

```bash
git check-ignore -v creds.json token.json
```

Si no imprime nada, **frenar**.

⚠️ **Y hay un secreto más que este documento no nombraba**: el **Application
ID** y el token van como variables del Worker, nunca en el código. La **clave
pública** con la que se verifica Ed25519 **no** es secreta —es pública a
propósito— pero conviene saber cuál es cuál antes de pegar ninguna.

---

## Lo que bloquea, y lo que falta decidir

### ✅ Lo que ya NO bloquea

- ~~**El exportador no captura lo que sobresale.**~~ **Resuelto el 16/09/2026.**
  Los cuatro exportadores calculan la unión, y `herramientas/puedo_generar.py`
  verifica el PNG —esquinas transparentes y tinta— en vez del proceso.
- ~~**La Bloqueada no está construida.**~~ **Hecha el 16/09/2026**, ovalada, en
  `comun/bloqueada.py`. Y el corte ya no es uno solo: son **cuatro requisitos**,
  en `comun/requisitos.py`.

### ✅ `sync.py` está en OTRO repo, y esto decía que no existía

**Encontrado el 22/09/2026.** Vive en
[`underraponline-lgtm/liga-global-sync`](https://github.com/underraponline-lgtm/liga-global-sync),
son 1.700 líneas, y **corre solo todos los días a las 08:00 UTC**. Este
párrafo decía *«el archivo no existe»* y por eso se lo citaba como una
referencia perdida.

Es el mismo error que describe, un nivel más arriba: **no estaba perdido,
estaba en un lugar que este documento no miraba.** Su README explica qué hace
cada uno de sus nueve modos.

⚠️ **Y lo que le toca a él NO se duplica acá.** Es dueño de la identidad:
quién es quién, el ✅ de la Lista, los roles de rango, los apodos y los
alias. Este repo es dueño de las cartas. La regla de reparto que quedó
escrita el 22/09, con su medición:

| | vive en | por qué |
|---|---|---|
| quién está verificado | **este repo**, `bot/pipeline.py` paso 1b | el ciclo corre **cada hora** y aquel **una vez por día**: con el portón allá, quien se verifica a las 09:00 espera 23 h por su carta |
| en qué servidores está | idem | idem, y además el transporte entre repos sería un agujero nuevo que se queda viejo en silencio |
| el rol de rango | **el repo de sync** | ya habla con Discord para eso y tiene los ocho umbrales |
| el apodo | **el repo de sync** | idem |
| el avatar en la columna F | **el repo de sync** | y desde hoy pide `size=256` y no 128 |

⚠️ **El portón de identidad se mide de los DOS lados a propósito**, y tiene
que dar igual. Su `audit` diario lo imprime; acá lo calcula
`bot/verificados.py`. Medido el 22/09, los dos: **504 con ID → 476 con
bandera → 319 con el rol Miembro.** Si un día difieren, una de las dos está
mal — que es exactamente lo que pasó la primera vez, cuando el de allá contó
«parecido» y dio 330.

### Decisiones abiertas

- 🔴 **Quién puede pedir cartas — SE DECIDIÓ SOLO, Y NO SE DECIDIÓ.** Esto
  decía *«hay que decidirlo **antes** de subir nada»*. Se subieron **4.244
  objetos** y nadie lo decidió, así que quedó resuelto por omisión: **todo
  es público**.

  Medido el 22/09/2026 desde afuera, sin credenciales:

  ```
  GET pub-…r2.dev/konan/servidor.webp    200   138 KB
  GET pub-…r2.dev/bloody/temporada.webp  200    82 KB
  GET pub-…r2.dev/fotos/t1/konan.webp    200    12 KB
  ```

  La clave es `clave(nombre)`, o sea **adivinable desde el nombre**.

  ⚠️ **Y LAS FOTOS NO NECESITAN SER PÚBLICAS.** Es lo peor del hallazgo y es
  gratis: **nada** usa su URL pública. Se escriben y se leen sólo por la API
  con token (`API_R2`), y el Worker no las sirve nunca. Están expuestas por
  un efecto lateral de que el bucket sea público **para las cartas**.

  ⚠️ **Y eso contradice una decisión que este proyecto ya tomó.** `CLAUDE.md`
  se niega a versionar las caras porque *«el historial de git las volvería
  permanentes, también para quien después se vaya»*. Están en un bucket
  público con URL adivinable: igual de permanentes y además enlazables.

  ⚠️ **NO HAY SALIDA.** `bot/fotos.py` no borra nada, y **160 personas** que
  ya no pasan el portón conservan sus cartas públicas. El bot deja de
  ofrecerlas —salen de KV— pero la URL sigue contestando 200.

  **Las dos opciones, para decidir con datos:**

  | | qué cuesta | qué resuelve |
  |---|---|---|
  | **clave con hash** en `comun/temporada.clave_foto()` | renombrar 443 fotos; nada más las referencia | deja de ser adivinable, sin mover infraestructura |
  | **bucket aparte, privado**, para `fotos/` | tocar `fotos.py` y el espejo | las saca del alcance público del todo |

  Y en cualquiera de las dos hace falta **un modo de borrar**, para que la
  respuesta a «sacame de ahí» no sea «no se puede».

- ⚠️ **EN FFA, «NO TENÉS CARTA» ES LA MAYORÍA, NO LA EXCEPCIÓN.** Medido el
  22/09/2026:

  ```
  gente de FFA en Discord         1.662
  ...que está en el padrón          316
  ...que pasa el portón (carta)     205
  ```

  O sea que **1.457 de 1.662** corren `/card` y caen en la rama de «todavía
  no estás». El flujo está escrito para que ése sea el caso raro —se los
  anota en `reg:` y se les dice que un admin los va a cargar— y durante la
  prueba va a ser el normal.

  ⚠️ **Eso no rompe nada**: el mensaje ya les dice lo que de verdad tienen
  que hacer —entrar a DRA y verificarse— y la cola no se duplica, porque
  `anotar()` saltea a quien ya está encolado y `registrar_ids.py` la vacía.

  ⚠️ **Lo que conviene mirar es el volumen de `Pendientes`.** Hoy son 12
  filas y la cola venía de semanas; si la prueba trae cientos, el ruido
  entierra los conflictos de verdad —dos personas con el mismo ID, un
  nombre que calza con dos— que es para lo que esa hoja existe. Si pasa,
  la salida no es dejar de anotar: es separar «altas» de «conflictos».
- **Qué manda el bot debajo del requisito.** Ya hay respuesta —la Bloqueada—
  pero falta decidir si la manda o dice «todavía no».
- **Los 32 nombres que no están en el Ranking Competitivo**, incluidos campeones
  como Rodri LP. El bot les va a decir «no existís» a personas que sí
  compitieron.
- **RZ no está en el Sheet.** El servidor se deriva de las columnas por
  servidor: si RZ no está en la planilla, nadie recibe esa carta aunque esté
  diseñada.

---

## El orden en que conviene construirlo

Cada paso se prueba solo, y ninguno necesita al siguiente para verificarse:

| # | paso | se prueba con |
|---|---|---|
| 1 | remoto privado + secrets | `git push` y `git check-ignore` |
| 2 | el Worker contesta el PING con PONG | Discord acepta la URL |
| 3 | `/ping` → un embed efímero | se ve en el chat |
| 4 | un PNG a mano en R2 → `/card` lo muestra | se ve la carta |
| 5 | cuatro botones que cambian la imagen | clickear y que cambie |
| 6 | el Action que genera las 552 y sube a R2 | contar 552 objetos |
| 7 | el Action que masca el Sheet a KV | leer `p:konan` |

⚠️ **El 2 es el que más pelea y el que menos código tiene.** La firma Ed25519
falla en silencio si se re-serializa el body, y Discord sólo dice *«no se pudo
verificar la URL»*. Vale la pena hacerlo solo, sin nada más alrededor.

---

## 17/09/2026 — La Servidor deja de bloquearse, y aparece el freno al spam

Dlx, mirando el menú del bot ya funcionando: *«el servidor siempre va a estar
desbloqueado... quiero que ese sea el default pero que muestre el servidor de
donde este ha sido convocado... Si el servidor que quiere acceder el usuario no
se encuentra haz q el bot le envíe un mensaje invisible al usuario con la
invitación. También hay que hacer una manera para evitar el spam aquí»*.

### 1. La Servidor es la default, siempre

El 16/09 la regla era *«si tiene la Competitiva desbloqueada, abre ahí; si no,
en la Servidor»*, y por eso Konan abría en Competitivo. Ahora **abre en la
Servidor para todos**, y lo que varía es **en qué servidor**: el del `guild_id`
donde escribiste, traducido por `datos/servidores.json`.

⚠️ **El requisito de la Competitiva sigue en KV y ya no decide esto.** Se dejó
`req_competitivo` en `meta` porque lo va a necesitar la Bloqueada de esa carta;
si alguien lo borra por "no se usa", el día que vuelva hay que reponerlo.

### 2. El candado era mentira, y se vio al usarlo

El menú decía **«Te falta 1 evento en TWR»** a alguien que **ni siquiera está
en TWR**. El requisito de la Servidor había entrado **un día antes** y parecía
correcto leyendo el código: era el primero con parámetro, tenía su plural, su
`{sv}`, su self-check. Lo que no tenía era sentido puesto delante de una
persona.

**Lo que te separa de la carta de TWR no es un evento: es no estar en TWR.**
Así que el candado se va y en su lugar va **la invitación**, efímera.

| antes | ahora |
|---|---|
| `TWR (BLOQUEADA)` · *Te falta 1 evento en TWR* | `TWR` · *The Warren Rap* |
| elegirlo → la ovalada gris de TWR | elegirlo → la carta de TWR, y la invitación aparte |

⚠️ **EL BOT NO PUEDE SABER EN QUÉ SERVIDORES ESTÁS, y esto es un límite duro
de la arquitectura, no una simplificación.** Con interacciones por HTTP,
Discord manda el guild donde escribiste y **nada más**. Saber el resto pide el
**gateway** con el **intent de miembros**, que es justo lo que este bot no
pide —y no pedirlo es lo que hace que un servidor aliado lo agregue con
`permissions=0`—.

Así que la señal es la que hay: **ni es donde estás parado, ni es el tuyo**.
Por eso el mensaje **pregunta** («¿no estás adentro?») en vez de afirmar.

⚠️ **Una interacción se contesta UNA VEZ.** Para mandar la carta **y** la
invitación hace falta un segundo mensaje, y va por
`POST /webhooks/{application_id}/{interaction_token}` — **sin el token del
bot**: se firma con el token que vino en el propio payload. Va dentro de
`ctx.waitUntil()`, porque la respuesta a Discord tiene 3 segundos y un
servidor lento haría fallar la carta entera.

### 3. El freno al spam, y los dos números son distintos a propósito

```
/card      4 cada 30 s      crea un mensaje PÚBLICO cada vez
botones   10 cada 10 s      contesta con ACTUALIZAR: pisa el mismo mensaje
```

Diez comandos son diez cartas en el canal; diez clicks son **el mismo
mensaje**, editado diez veces. El daño es distinto, el número también.

⚠️ **Contesta con un mensaje nuevo y efímero (tipo 4), NUNCA con el 7.** Con
el 7 el castigo por apurarse sería **borrarle la carta a quien la pidió**.
Es la misma razón por la que el aviso de «esa carta la pidió otra persona»
tampoco actualiza.

⚠️ **Es el primer estado de módulo del Worker**, contra la regla escrita
arriba de `worker.js`. La regla de verdad siempre fue *«nada que pertenezca a
ALGUIEN»* — un contador de clicks por ID no lo es, y el peor caso de una
carrera es contar uno de más o de menos.

⚠️ **La alternativa era KV y no servía: 1.000 ESCRITURAS POR DÍA.** Un freno
que escribe en cada click se come el presupuesto **del pipeline** —que es el
que de verdad necesita escribir— antes del mediodía.

⚠️ **Y es aproximado a propósito.** Cada isolate lleva su propia cuenta, así
que alguien repartido entre varios pasaría más veces. No importa para lo que
hay que frenar: las interacciones salen de los datacenters de Discord, o sea
que la ráfaga de una misma persona cae en el mismo puñado de colos.

### 4. Lo que falta: 138 × 8 cartas, y por qué el bot no se rompe sin ellas

Hoy en R2 está `<quien>/servidor.png` —la del servidor **propio**— y no las de
los otros ocho. `03_Servidor/generar.py --sv=FFA` ya las dibuja.

El Worker pregunta por **`meta.por_servidor`** antes de mandar una URL, y
`bot/subir_datos.py` **lo mide** contra `datos/cartas_r2.json` en vez de
escribirlo a mano. Sin esa pregunta el menú devolvería una imagen rota, **y
Discord no avisa de eso** — es el mismo silencio que la caché del `?v=`.

⚠️ **`sv-<codigo>.png` CAMBIÓ DE SIGNIFICADO Y LA CLAVE NO.** Antes era la
**Bloqueada ovalada** de ese servidor; ahora es **tu carta con la camiseta de
ese servidor**. Si alguien encuentra un `sv-twr.png` viejo en R2, es de las
de Konan del 16/09 y no es lo mismo.

### 5. El bug que apareció al dibujarlas

En `03_Servidor/disenos/todos_sv.py` la bandera y el escudo colgaban del mismo
`if tot >= 3`, o sea del total **del servidor**. Con menos de tres personas en
tu servidor desaparecía también **la bandera**.

Le pasaba a **NFK, Marcos y Vandu** en su carta propia, hoy. Mirando una carta
no se ve. Se vio al dibujar la de otro servidor, donde el puesto **no existe
por definición** y las nueve salían sin bandera.

⚠️ **Es la regla de `CLAUDE.md` rota en su propio enunciado**: *«la bandera es
identidad, el número es ranking»*. Y *«sin dato no hay pieza»* habla del
**dato** —si no tenés país no hay bandera— no del **umbral del puesto**.

---

## 18/09/2026 — DRA adentro, los botones se apagan solos, y todo pesa 87 % menos

El día que el bot dejó de vivir en un solo servidor. Casi todo lo que sigue es
consecuencia de eso: **la cuenta se dio vuelta**. En FFA, quien tiraba `/card`
era casi siempre alguien del pool; en DRA son miles de personas y **109 tienen
carta**. Varias decisiones que estaban bien para el caso chico pasaron a estar
mal para el caso grande.

### 1. Meterlo en un servidor son DOS pasos, y el segundo no avisa

El link de invitación mete el bot. **Los comandos se registran aparte.** Con
comandos por servidor —que es como están hoy— entrar a uno nuevo y no volver a
registrar deja al bot **adentro y mudo**: aparece en la lista de miembros y
`/card` simplemente no existe ahí. Desde afuera se ve igual que un bot roto.

```bash
node bot/registrar.mjs --invitar    # los nueve links, y dice cuál falta
node bot/registrar.mjs --sv=DRA     # los comandos en ése, instantáneo
node bot/registrar.mjs --global     # una vez, cubre a los nueve
```

⚠️ **El link lleva los DOS scopes: `bot` y `applications.commands`.** Con el
segundo solo, los comandos entran pero **el bot no se hace miembro**: no sale
en la lista y `GET /guilds/{id}/members/search` da 403, así que no se le pueden
buscar los Discord ID a esa gente. `permissions=0` no se toca — es el argumento
entero para que un servidor aliado lo acepte.

⚠️ **Y los guild ID salen de la tabla del Worker, no de una lista nueva.** Es
la forma que `CLAUDE.md` documenta tres veces: la decisión en un lado y el
código leyéndola de otro.

⚠️ **`bot/verificar.py` dejó de exigir los nueve.** Exigirlos lo dejaba en rojo
desde el día uno y por meses —Dlx: *«de momento solo estará en FFA y DRA»*—, y
un rojo permanente no es una alarma, es ruido. Lo que ahora **sí** falla es el
bot mudo, que es el caso invisible. También comprueba que las nueve
invitaciones **sigan vivas** y lleven al servidor que dicen: un invite se
revoca o caduca en cualquier momento y de este lado no falla nada.

### 2. Los botones se apagan solos, sin guardar un solo byte

`VENCE = 10 min`. Lo que hace que esto salga gratis es que **cada respuesta de
tipo 7 es una edición**, así que **Discord ya guarda la última actividad**:
`message.edited_timestamp`. No hace falta estado nuestro.

```js
if (m.edited_timestamp) return Date.parse(m.edited_timestamp);
if (m.timestamp)        return Date.parse(m.timestamp);
if (m.id) return Number(BigInt(m.id) >> 22n) + SNOWFLAKE_CERO;  // el id trae su fecha
```

⚠️ **Vencida se APAGA la carta y se explica aparte.** El tipo 7 redibuja la
misma carta con todo deshabilitado —así el mensaje queda en un estado correcto
para siempre, no sólo «no responde»— y el porqué va en un efímero, porque una
interacción se contesta una sola vez.

⚠️ **Se redibuja con `carta()`, no devolviendo `i.message.components`.** Lo que
Discord manda de vuelta trae campos que agregó él (`proxy_url`, `width`) y
reenviarlos puede hacer que rechace la edición.

### 3. WebP: de 1.095 KB a 138 KB, y nadie ve la diferencia

Medido sobre las cartas reales a q90: **−87 %**, diferencia media **1.24 sobre
255**, alfa intacto. Dlx, mirando las dos: *«To be honest is the same for me. I
dont see any differences... Plus it can load more faster»*.

R2 pasó de **2.01 GB a 0.23 GB** — el 2.3 % del tier gratis, como 43 temporadas
de margen. Los 1.793 PNG viejos se borraron **después** de comprobar clave por
clave que cada uno tuviera su `.webp` arriba: contar 1.793 de cada lado daría
el mismo número aunque estuvieran cruzados.

⚠️ **`listar()` ahora REVIENTA en vez de devolver una lista vacía.** Con el
rate limit de R2 (`[971] Please wait and consider throttling`) devolvía `[]` en
silencio, y eso, pasado a `--sincronizar`, habría dejado el inventario en
blanco → `cs: []` → el bot deja de dibujar botones. Un fallo de red se habría
leído como «esta persona no tiene cartas».

### 4. El mensaje para quien el bot no conoce

Es el que más gente va a leer ahora, y decía lo que le servía al caso chico:
*«te falta el Discord ID en el Sheet Operativo»* — que le da a entender a un
desconocido que ya está anotado y que hay un trámite pendiente.

Dlx, 18/09/2026: *«aquellos q no están en DRA significa que perderán su
tarjeta. Necesitan estar en DRA y ser verificados para tener acceso»*. Así que
el mensaje dice eso, y además dice **cómo**.

⚠️ **Cambia según de dónde venga, y no es adorno.** Una mención `<#id>` sólo se
dibuja para quien **ya ve** ese canal: a alguien que no está en DRA le queda
una mención rota, que es peor que no poner nada. Desde DRA va la mención; desde
afuera, la invitación más la URL completa.

⚠️ **Y el canal y el mensaje son DOS id.** El que Dlx pasó primero daba **404
Unknown Channel** y no era permisos —un canal sin acceso contesta **403**, se
probó—: era el id del **mensaje** de YAGPDB, adentro del canal. El link que
Discord copia con «Copiar enlace del mensaje» termina ahí. Se aprovecha: desde
afuera la URL apunta al mensaje, así la persona cae en la instrucción.

⚠️ **El que pregunta por OTRO recibe otra cosa.** Ahí el que tiene que
verificarse no es el que lee; mandarle a él la invitación sería decirle que
entre a un servidor donde ya está.

### 5. Lo que se puede preguntarle a Discord sin intents, medido

| | |
|---|---|
| `GET /guilds/{id}/members/{persona}` | **200** — roles y apodo de UNO |
| `GET /guilds/{id}/members` | **403** |
| `POST /guilds/{id}/members-search` | **403** |

O sea: **de a uno se puede todo, la lista entera no.** Y eso alcanza, porque
nunca se parte de Discord: se parte del padrón. `herramientas/en_dra.py`
pregunta de a uno por los 138 y contesta quién cumple la regla nueva — hoy
**81 adentro, 28 afuera, 29 sin ID**, o sea que 57 perderían la carta.

⚠️ **Por eso el rol «Verificado» puede ser la única fuente** cuando exista, sin
activar el intent privilegiado y sin una columna paralela que alguien tenga que
acordarse de tildar.

⚠️ **Pero el Worker no debe leerlo en vivo.** Para que `/card` muestre algo, la
carta tiene que estar **generada y subida a R2**: el cuello de botella es
generar, no consultar. Chequear en vivo no adelantaría un segundo.

#### 🔴 EL WORKER SÍ TIENE EL TOKEN, DESDE EL 19/09/2026

Hasta ese día acá decía que no tenerlo era *«una propiedad, no un olvido»*.
**Era una descripción del estado, no una regla**, y Dlx la corrigió: *«no es a
propósito, yo te los di para que lo guardes hasta que terminemos todo esto y
ahí sí lo reiniciamos el token, pero para acabar todo esto falta demasiado»*.

Va como **`secret_text`** en `bot/desplegar.py` —se escribe y no se vuelve a
leer, ni desde el panel ni desde la API—, nunca como `plain_text`.

⚠️ **Lo que SÍ es regla es que el token se rota al terminar.** Está en el borde
prestado, no instalado. Se rota en el portal de Discord y se vuelve a
desplegar.

⚠️ **Y el binding es opcional a propósito**: si `DISCORD_TOKEN` no está en
`.env`, el Worker despliega igual y `/puesto` guarda la preferencia avisando
que se aplica en la próxima corrida del sincronizador. O sea que el día que el
token se rote y todavía no esté cargado, **nada se rompe** — sólo deja de ser
instantáneo.

⚠️ **Esto no reabre lo de leer roles en vivo.** Ahí el argumento nunca fue el
token: era que no adelanta nada porque la carta tiene que estar generada igual.

### Los cuatro comandos, y quién decide qué

| | qué hace | dónde |
|---|---|---|
| `/card` | la carta de alguien | servidor · DM · cualquier lado |
| `/ping` | ¿está vivo? | igual |
| `/puesto` | tu `#N` en tu apodo, prendido o apagado | **sólo en servidor** |
| `/settings` | los ajustes del servidor, con botones | **sólo en servidor**, admins |

⚠️ **`/puesto` y `/settings` van sólo en servidor y no es un olvido.** Los dos
hablan de un servidor concreto —tu apodo *ahí*, los canales *de ahí*— y en un
DM no hay ninguno del que hablar. Declararlos en `contexts:[0]` hace que Discord
ni los ofrezca, que es mejor que ofrecerlos y contestar que no se puede.

#### 🔴 EL `#N` LO DECIDEN DOS, Y SON TRES ESTADOS

Dlx, 19/09/2026: *«si un usuario estaba en on y después yo lo apago, gana el
usuario y conserva su apodo, porque eso es algo suyo. Si no lo usaron, siguen
lo que deciden los admins»*.

| el usuario | el servidor | resultado |
|---|---|---|
| **eligió** (`/puesto`) | lo que sea | **manda el usuario** |
| no eligió | `/settings` | manda el servidor |
| no eligió | tampoco | prendido |

⚠️ **Por eso `pnick:<guild>:<id>` guarda `on: true|false` y no alcanza con que
la clave exista.** La primera versión usaba la presencia como «apagado», y eso
no distingue *lo prendió a propósito* de *nunca lo tocó* — sin esa distinción
la regla de arriba no se puede escribir. **No existir es el tercer estado.**

⚠️ **Y por eso `/puesto mostrar:True` escribe aunque el número ya se vea.**
Parece que no hace nada; lo que hace es **blindar** el apodo contra un futuro
apagón del servidor. Sin eso nadie puede protegerse antes de que lo apaguen.

⚠️ **Los apodos los cambia el Worker, pero el que los mantiene es
`herramientas/sincronizar_puesto.py`**, que lee las mismas dos claves y aplica
la misma precedencia. Si las dos se separan, el apodo vuelve solo en la próxima
corrida y nadie entiende por qué.

#### Los avisos de rango

`/settings` guarda **dónde** avisar (`cfg:<guild>.avisos`);
`herramientas/avisar_rangos.py` compara y postea.

⚠️ **El «ayer» es un archivo y no KV.** Son ~138 valores que cambian juntos: en
KV serían 138 escrituras por corrida sobre un límite de 1.000, para un dato que
sólo lee ese script. Vive en `datos/rangos_previos.json`, versionado.

⚠️ **La primera corrida no avisa nada a propósito.** Sin un «ayer», los 138
rangos son cambios y el canal se llena anunciando que la gente tiene el rango
que siempre tuvo.

### 6. El apodo del servidor vale más que el nombre de la cuenta

`herramientas/ids_cruzados.py` nació comparando el `username`/`global_name` de
Discord contra los nombres del padrón, y marcó **9 de 332**. Con el bot dentro
de DRA se pudo preguntar algo mejor —**cómo lo llama el servidor**, que lo pone
el staff— y **desmintió seis de las nueve** de una: `malasiafighter` se apoda
*«🐉 | Liberia»*, `kidbuu02124` se apoda *«🐉 | Lord Viruzz»*, `agusdema` se
apoda *«#5 | Gus»*.

⚠️ **El handle dice cómo se llama la cuenta; el apodo dice a quién reconoce el
servidor.** Era lo segundo lo que había que preguntar.

⚠️ **Y el apodo se parte ANTES de normalizar.** `norm()` tira todo lo no
alfanumérico, así que «#5 | Gus» queda «5gus» y deja de ser igual a «gus».

Quedan dos sin resolver: **Oasis/Fullylo4ded** —esa cuenta no está en DRA ni en
FFA, así que no hay apodo que consultar— y **Mc arepa**, cuya cuenta se apoda
«Revito» en DRA y «Revo» en FFA.

### 7. Un ID de Discord se destruye dentro del Sheet, y no avisa

`aze gian` tenía `1.94176670318592E+17`. Un snowflake tiene 19 dígitos y un
`double` es exacto hasta 2⁵³ —**16 dígitos**—, así que al tipearlo en una celda
con formato de número **Sheets le come los últimos tres al guardarlo**.

⚠️ **Lo que se ve es el caso amable.** Con la columna ancha, la misma celda
muestra 19 dígitos **ya redondeados** y se lee como un ID perfecto que no es de
nadie — o, peor, que es de otro. Para ése no alcanza la forma: hay que
preguntarle a Discord.

`sheet/construir_padron.py` lo rechaza y lo canta **arriba** de los
porcentajes, porque un ID destruido no baja ningún número: la celda está llena.
Se arregla en el Sheet formateando la columna como **texto plano** y volviendo
a pegar el ID — formatearla después no lo devuelve.

### 8. ✅ R2 se queda en `r2.dev`, y el dominio propio valía menos de lo que parecía

Dlx, 18/09/2026: *«de momento no pagaré nada»*. **No es un pendiente, es una
decisión**, y conviene dejar escrito por qué casi no cuesta nada.

El argumento a favor del dominio propio eran dos cosas, y **una era falsa**:

| se dijo | lo real |
|---|---|
| «saca el `[971] Please wait and consider throttling`» | 🔴 **no**: ese error sale de `api.cloudflare.com`, la API de administración, en la subida y el borrado masivo. No tiene nada que ver con servir por `pub-*.r2.dev` |
| «cachea en el borde» | cierto, pero da poco |

⚠️ **Y da poco por una razón concreta: quien pide estas URL no es la gente, es
el proxy de Discord.** Discord se baja la imagen una vez por URL y después la
sirve él —por eso existe el `?v=<sello>`, justamente para forzarlo a
re-bajarla cuando la carta cambia—. O sea que el bucket recibe cada URL **una
vez**, no una por persona que mira la carta. Una caché delante de algo que ya
se pide una sola vez no ahorra casi nada.

⚠️ **Lo que sí mide el verificador es nuestro tiempo, no el de la gente.** Los
~1,4 s de mediana con 24 pedidos en paralelo son los de la comprobación, que
se salta el proxy de Discord a propósito para tocar el bucket de verdad. Nadie
espera eso mirando una carta.

Queda anotado para cuando exista un dominio de la Liga por otras razones: ahí
sale gratis sumarlo, y lo que se gana son URLs que no muestran un id random.
