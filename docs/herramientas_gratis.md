# Qué hay gratis que nos sirva, y qué parece que sí y no

Investigado el 20/09/2026 contra documentación oficial. Todo lo que dice un
límite fue verificado en la página del proveedor; lo que no se pudo confirmar
está marcado.

⚠️ **Los free tier se mueven.** Entre 2024 y 2026 varios desaparecieron o
pasaron a pedir tarjeta. Este documento tiene fecha a propósito: si lo leés
dentro de seis meses, **volvé a verificar antes de construir encima**.

---

## Tres correcciones a cosas que este proyecto daba por ciertas

**1. El cron del Worker NO tiene más CPU.** Se dijo en esta misma sesión que
el handler programado «tiene hasta 15 minutos, no 10 ms». Son **las dos
cosas**: 15 minutos de reloj **y los mismos 10 ms de CPU**. La conclusión
seguía siendo correcta —esperar I/O no gasta CPU, así que leer diez canales
entra— pero el motivo estaba mal.

**2. `MESSAGE_CONTENT` ya no necesita aprobación.** El **10/06/2026** Discord
cambió el umbral de *100 servidores* a **10.000 usuarios únicos**. Debajo de
eso se prende con un toggle. `CLAUDE.bot.md` dice lo viejo.

⚠️ Y algo que corrige el razonamiento entero: **con `GUILD_MESSAGES` sin el
intent privilegiado igual llega `MESSAGE_CREATE`**, sólo que con `content`
vacío. Si lo único que hace falta es *saber que alguien escribió* —actividad,
rachas, presencia— no hace falta pedir permiso de nada. Lo que falta sigue
siendo el proceso, no el permiso.

**3. El cálculo de puntos SÍ existía y es legible.** `docs/arquitectura.md`
decía que no estaba en ningún lado. Está en el Apps Script del **Operativo**
(`docs/appscript_operativo/Code.gs`, 837 líneas): `leerTablaPuntos`,
`getEscala`, `calcularPuntos`, `resolverNombre`, `procesarEvento`, y ya tiene
`onEdit`.

---

## Lo que conviene adoptar

### Cloudflare D1, para lo que se escribe

**El hallazgo más fuerte.** KV gratis son **1.000 escrituras por día**, y un
solo sync de 469 personas se come el **47 %**. D1 da **100.000**.

| | KV | D1 |
|---|---|---|
| escrituras/día | **1.000** | 100.000 |
| lecturas/día | 100.000 | 5M filas escaneadas |
| entra como | binding | binding |
| consistencia | *"up to 60 seconds or more"* | inmediata |

Y la doc de Cloudflare contesta por escrito la pregunta que decide todo:
*«esperar una consulta a base de datos **no cuenta** contra el tiempo de
CPU»*. Lo que gasta CPU es **parsear y serializar** el resultado, que es
exactamente lo que `CLAUDE.bot.md` ya había identificado.

⚠️ **Dos trampas de D1**: el tope es **50 queries por invocación** en gratis,
y *«fila leída» significa fila ESCANEADA*, no devuelta — sin índice, un
`SELECT` sobre 469 filas gasta 469 lecturas. Las dos se arreglan con índices.

🔴 **Y una consecuencia inmediata**: si el polling del canal de inscripciones
corre **cada minuto**, son **1.440 escrituras/día** para guardar el cursor.
**No entra en KV.** El cursor va en D1.

### Capturar directo a WebP, antes de mirar cualquier servicio

Hoy el pipeline codifica un PNG de 2,2 megapíxeles **y después** lo convierte
a webp con PIL: dos codificaciones para un archivo que termina siendo uno.

El protocolo de Chrome confirma que `Page.captureScreenshot` acepta
`format: "webp"`. Desde Playwright Python se llega con
`page.context.new_cdp_session(page)`.

✅ **MEDIDO el 20/09/2026**, 6 cartas de Servidor por camino, q90:

| | s/tarjeta | peso | tamaño |
|---|---|---|---|
| hoy: PNG + PIL recorte + PIL webp | **8,38** | 134 KB | 1200×1839 |
| `clip` de Chrome, sin PIL | **1,40** | 138 KB | 1200×**1840** |

**Seis veces más rápido**, y el peso del archivo casi no se mueve.

🔴 **PERO NO SALE LA MISMA IMAGEN, Y NO ES UN BUG QUE SE ARREGLE.** El `clip`
de CDP va en **píxeles CSS** y el archivo sale en CSS × escala. El alto de
`CAJA_SET` es **1839 device px = 459,75 CSS** a escala 4, y **1839 no es
divisible por 4**: ese alto *no se puede pedir*. Chrome trunca a 459 CSS y
**se come tres filas de tinta abajo** — eso fue el 1200×1836 de la primera
medición. La única caja alineada que contiene la tinta entera es
`(0, 28, 1200, 1868)`, o sea la de hoy **más una fila transparente arriba**.

⚠️ **`optimizeForSpeed` no hace nada acá**: con él y sin él la salida es
idéntica y el tiempo queda dentro del ruido. Lo que sobra en la cadena de hoy
**no es el encode del webp: es el PNG del medio** — se codifica un PNG de 2,2
megapíxeles, se abre, se recorta, se vuelve a guardar como PNG y recién ahí se
convierte. Ese PNG es el 83 % del tiempo.

⚠️ **La tinta difiere 2,30/255 de media** contra la de hoy, por usar otro
libwebp (el de Chrome contra el de PIL con `method=6`), los dos a q90. Para
comparar: `bot/a_webp.py` midió el salto de PNG a webp q90 en **1,24/255**, y
Dlx lo miró: *«lo veo igual»*.

🔴 **Adoptarlo obliga a redibujar el set entero.** La `recortar()` de
`03_Servidor/disenos/todos_sv.py` documenta justo este error: *«la MISMA
carta, dos tamaños, y en Discord eso es tamaño en el chat»*. Dejar unas en
1839 y otras en 1840 es esa misma forma, más chica. O van todas, o ninguna.
La decisión es de Dlx; la medición ya no falta.

### Looker Studio, para mostrar sin tocar

Gratis, se conecta directo al Sheet, sólo lectura. Sirve para el ranking
público, el embudo de retención y la actividad por servidor, con un link que
se pega en el hub. No toca el pipeline.

---

## Lo que parece bueno y no lo es

**Satori** (renderizar sin navegador, en el borde). La idea más seductora, y
se cae por dos lados independientes:

- medido por un tercero en un Worker: **~82 ms de CPU** para un 1080×1350.
  El plan gratis da **10 ms**, y nuestra carta tiene **1,5× esos píxeles**
- su `backgroundImage` acepta *"single value"* y **no hay `z-index`**.
  `04_Pais/fondos.py` apila **seis capas**

Sería reescribir las cuatro cartas para perder justo lo que las sostiene.
⚠️ El viejo argumento de «no entra el WASM» ya no aplica: el límite de bundle
pasó a **64 MiB el 04/09/2026**. Ahora el que descalifica es la CPU.

**Browser Rendering como reemplazo del pipeline.** Sí acepta **HTML crudo**
con `omitBackground`, `clip` y `deviceScaleFactor` —encaja exacto con el
exportador— pero el techo son **10 min de navegador por día ≈ 270 cartas**.
Sirve para `/card` a pedido; **el que lo lea como «ya no hace falta
pregenerar» se estrella en la carta 271**.

**Servicios de screenshot.** ScreenshotOne y ApiFlash: **100/mes**.
HTMLCSStoImage: **50/mes**. Hay 3.220 imágenes. Está a dos órdenes de
magnitud.

**AppSheet.** El plan gratis es **sólo para prototipar**: 10 usuarios, y
*«cuando tu app está lista para desplegarse deberías comprar una
suscripción»*. La automatización —mails, bots programados— **no funciona sin
pagar**.

**Oracle Always Free.** Bajó a la mitad: hoy son **2 OCPU / 12 GB**, no 4/24.
Pide tarjeta. Y su política de reclamo por ociosidad está vigente y escrita:
7 días con CPU p95 <20 % **y** red <20 % **y** memoria <20 %. Un cron semanal
cumple las tres.

---

## Leer mensajes en tiempo real: sigue cerrado, y ahora verificado

**Los webhooks de aplicación de Discord son doce eventos**, y ninguno es un
mensaje de canal: autorización, deautorización, entitlements, quests y
tráfico del **Social SDK**. `LOBBY_MESSAGE_CREATE` parece el que sirve y es
de lobbies de juego.

⚠️ La propia doc avisa: *«events sent over webhooks are **not realtime or
guaranteed to be in order**»*.

**Durable Objects tampoco es la escapatoria.** La aritmética casi cierra —128
MB × 86.400 s = **10.800 GB-s/día** contra 13.000 gratis, el 83 %— pero tres
frases oficiales lo rompen:

- *«Outgoing WebSockets **do not hibernate**»*
- una conexión saliente mantiene vivo el objeto **15 minutos máximo**
- los `setInterval` **se pierden** en cada eviction

🔴 Y el costo de equivocarse está documentado: pasarse de **1.000 identifies
en 24 h** hace que *«all active sessions will be terminated, **the bot token
will be reset**, and the owner will receive an email»*. Reconectando cada dos
minutos son ~1.234 por día.

⚠️ **Y GitHub Actions está prohibido por sus términos** para esto, textual:
*«any other activity unrelated to the production, testing, deployment, or
publication of the software project»*. Dibujar tarjetas es parte del
software; sostener un gateway no.

**Conclusión: el polling REST por Cron Trigger es la vía correcta**, y quedó
verificado — mínimo **1 minuto**, **5 cron triggers** en gratis, y
`GET /channels/{id}/messages?after=` trae 100 por llamada contra un techo de
50 req/s que ni se roza.

---

## Dos cosas gratis que no estábamos usando

- **Cloudflare Queues entró al plan gratis el 04/02/2026** — 10.000
  operaciones/día, retención 24 h. Sirve para desacoplar el dibujado del
  `/card` y tener reintentos. ⚠️ El consumer **sigue siendo un Worker con
  10 ms**: la cola compra reintentos, no CPU.
- **El límite de bundle del Worker pasó a 64 MiB** el 04/09/2026.

---

## Una mala que conviene saber

🔴 **Los logs del Worker no pueden salir de Cloudflare en el plan gratis.**
Tail Workers y Logpush son de pago. Quedan 200.000 logs/día con **3 días** de
retención, y si te pasás *«se aplica un muestreo del 1 % por el resto del
día»* — **degrada en silencio**.

Alternativas que sí sirven y son gratis: **UptimeRobot** (50 monitores, cada
5 min) para saber si el bot responde, y **Healthchecks.io** (20 jobs) para
saber si el cron corrió.

---

## Lo que no se pudo confirmar

El intervalo mínimo de los triggers de Apps Script · si el free tier de Cloud
Run cubre **Jobs** · el endpoint `/attachments/refresh-urls` de Discord (no
está en la doc oficial) · el tamaño máximo de origen en Cloudflare Images ·
cuánto gana exactamente capturar directo a webp.
