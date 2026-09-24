# El bot — cómo levantarlo la primera vez

El **porqué** de cada decisión está en `CLAUDE.bot.md`. Acá están los pasos.

⚠️ **Esta primera prueba NO necesita el Sheet ni un solo dato.** Se prueba el
circuito —Discord → Worker → respuesta— y recién después se enchufan las
cartas. Probar las dos cosas a la vez es cómo no se entiende cuál de las dos
falló.

---

## Lo que hace falta de Dlx

### 1 · La aplicación de Discord

**discord.com/developers/applications** → *New Application*.

De la pestaña **General Information** salen dos datos, **los dos públicos**:

| dato | para qué | ¿secreto? |
|---|---|---|
| **Application ID** | registrar los comandos | no |
| **Public Key** | el Worker verifica la firma con ella | **no** — verifica, no firma |

Y de la pestaña **Bot**, uno que sí lo es:

🔴 **Bot Token.** Va en `.env`, **nunca en un chat ni en un commit**. Si entra
al historial de git **no alcanza con borrarlo después**: hay que regenerarlo en
el portal.

### 2 · Un servidor de prueba

Uno nuevo y descartable. ⚠️ **No DRA**: si algo sale mal, que salga mal donde
no mira nadie.

En **OAuth2 → URL Generator**, marcar los scopes **`bot`** y
**`applications.commands`**, y abrir la URL para invitarlo.

⚠️ **Sin `applications.commands` el registro da 403** y el mensaje de Discord no
dice que sea por eso.

### 3 · El `.env`

En la **raíz del proyecto** (no en `bot/`). Ya está en `.gitignore`:

```
DISCORD_APP_ID=...
DISCORD_TOKEN=...
DISCORD_GUILD_PRUEBA=...
```

El ID del servidor sale con click derecho sobre el servidor → *Copiar ID de
servidor*, con el Modo Desarrollador activado en Ajustes → Avanzado.

### 4 · Cloudflare

Cuenta gratuita. Hay **dos maneras de desplegar** y las dos sirven:

| | cuándo |
|---|---|
| **el panel web** | Workers & Pages → *Create* → *Worker*, y pegar `worker.js` en el editor. ⚠️ **Es el camino de hoy**: `wrangler` pide **Node 22** y en esta máquina hay **18** |
| `npx wrangler deploy` | cuando Node esté en 22+. Hace falta igual para R2 y para el Action |

⚠️ Si se usa el panel, la **Public Key** se carga como variable de entorno del
Worker con el nombre **`DISCORD_PUBLIC_KEY`** (Settings → Variables). Con
wrangler sale de `wrangler.toml`.

---

## ✅ LA CARTA ESTA EN DISCORD — 17/09/2026

`/card` probado de punta a punta en FFA. Funciona **todo lo que se decidio**:

```
sin embed                la carta ES el mensaje
sin texto suelto         ni una letra: la carta ya dice nombre, rango y numero
el boton activo          gris y apagado; hace de etiqueta
los otros tres           azules, porque el contraste no puede venir de la opacidad
el mismo mensaje         dice (edited): no se llena el canal
el menu de servidores    solo con la Servidor activa, en su propia fila
(BLOQUEADA)              con el requisito en la descripcion, y SE PUEDE ELEGIR
elegir una bloqueada     devuelve la ovalada de ESE servidor
efimero                  Only you can see this
```

⚠️ **Y la Bloqueada probo cinco decisiones de una**: el ovalo se lee como
*todavia no* y no como una carta rota; el candado es un `path` SVG y no un
emoji, asi que no cambia de forma segun el sistema; no lleva numero ni rango
porque no hay nada que medir; **si** lleva la bandera, porque *la bandera es
identidad y el numero es ranking*; y el texto dice **EN URBF**, que es el
primer requisito con parametro.

**Eso es lo que va a ver toda la Hermandad el dia 1 de la T1**, en las cuatro
cartas, porque nadie va a tener eventos todavia.

---

## Desplegado y andando — 17/09/2026

`/ping` contestó en FFA. El circuito está probado de punta a punta:
Discord firma → el Worker verifica Ed25519 → contesta efímero → se ve en el
chat, **sin un proceso prendido en ningún lado**.

```
app          LIGA GLOBAL   1550026808404217926   (Team app)
bot          LIGA GLOBAL
servidor     FFA           1468472442925092958
comandos     /ping         registrados por guild -> instantaneos
```

⚠️ **LA APP DE LA LIGA NO ES LA MISMA QUE `AKA UL`, Y ESO COSTO UNA VUELTA.**
El primer intento usó `Under Legend` / `AKA UL`, que **ya estaba en uso**: es
la *cara* del bot personalizado de **MEE6 Premium** en DRA, con ~51 comandos.

Al ponerle el Interactions Endpoint URL, Discord **dejó de mandarle las
interacciones a MEE6** y se las mandó al Worker — porque las dos vías son
**mutuamente excluyentes**, lo dice la documentación. Probado: `/next-birthdays`
en DRA contestó *«No conozco /next-birthdays»*, que es **una línea de
`worker.js`**.

**La regla que queda**: una app de Discord sirve para **un** bot. Si ya hay algo
corriendo con ella —MEE6, un webhook, lo que sea— hay que crear otra. Y antes
de tocar el endpoint de una app, mirar qué comandos tiene:

```bash
# GET /applications/{id}/commands            los globales
# GET /applications/{id}/guilds/{g}/commands los de cada servidor
```

⚠️ **El campo de `AKA UL` tiene que quedar VACÍO.** Está en `.env` con su aviso.

✅ **Y el bot de la Liga no pide NINGÚN intent.** Presence, Server Members y
Message Content van apagados, porque los intents son del **gateway** y este bot
no se conecta ahí. Sumado a `permissions=0` en la invitación: **un servidor
aliado lo agrega sin darle acceso a nada** — no puede leer mensajes, ni ver la
lista de miembros, ni quién está conectado. MEE6 pedía los tres.

---

## Desplegado

```
cuenta       Underraponline@gmail.com's Account
Worker       liga-global-bot
subdominio   liga-global-ul.workers.dev
binding      DISCORD_PUBLIC_KEY  (plain_text)
URL          https://liga-global-bot.liga-global-ul.workers.dev
```

Se subió con `python bot/desplegar.py`, **sin wrangler** — ver ese archivo.

⚠️ **EL SUBDOMINIO NO ADMITE GUIÓN BAJO.** Dlx pidió `liga_global_ul` y
Cloudflare lo rechazó: *«Subdomain is invalid. Please make sure you're using a
DNS-compliant name»*. Quedó **`liga-global-ul`**, con guión medio. Vale para
cualquier nombre que se elija después.

⚠️ **Y la cuenta no tenía subdominio hasta ese momento.** El primer despliegue
falla con `[10007] You do not have a workers.dev subdomain`. Se crea una sola
vez, con `PUT /accounts/{id}/workers/subdomain`, y **ese nombre queda en la URL
pública del bot**: conviene elegirlo antes de que algo apunte ahí.

⚠️ **Un subdominio recién creado tarda unos minutos en tener certificado TLS**,
y mientras tanto todo da `SSLV3_ALERT_HANDSHAKE_FAILURE`. **Importa porque
Discord diría «no se pudo verificar la URL»** — el mismo mensaje que da cuando
la firma está mal. Son dos causas distintas con el mismo cartel: hay que
descartar ésta **antes** de tocar la firma.

---

## Los pasos, y cómo se sabe que cada uno anduvo

| # | paso | anduvo si |
|---|---|---|
| 1 | desplegar el Worker | abrir su URL en el navegador muestra *«el endpoint está vivo»* |
| 2 | pegar esa URL en el portal, en **Interactions Endpoint URL** | **Discord la acepta** — ahí se probó la firma |
| 3 | `node bot/registrar.mjs` | imprime `Registrados … 1 comando(s)` |
| 4 | tipear `/ping` en el servidor de prueba | contesta, y sólo lo ves vos |

⚠️ **El paso 2 es el que más pelea y el que menos código tiene.** Discord manda
un PING firmado y espera un PONG; si la firma no valida sólo dice *«no se pudo
verificar la URL»*, sin decir por qué.

**Las dos causas, por frecuencia:**

1. **Se verificó sobre el body ya parseado.** `JSON.parse` + `JSON.stringify`
   cambia el texto —espacios, escapes, orden— y la firma deja de dar. Por eso
   `worker.js` lee el body **una vez como texto**, verifica ese texto, y
   **recién después** lo parsea.
2. **Se contestó 200 a una firma inválida.** Discord **prueba a propósito** con
   una firma mala y espera un **401**. Si recibe 200, rechaza la URL aunque el
   PONG esté perfecto.

---

## Después

- Subir las cuatro de Konan a **R2** y que `/card` las muestre
- Los cuatro botones, con el activo **apagado y gris**
- El menú de servidores, sólo con la Servidor activa
- El Action que genera y sube — **ése sí necesita Node 22 y un remoto de git**
