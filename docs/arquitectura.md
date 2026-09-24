# La arquitectura, medida el 20/09/2026

Son **cuatro sistemas** y **dos planillas**, y ninguno de los cuatro sabía de
todos los otros. Este documento existe porque esa ignorancia ya costó trabajo
repetido: los roles de rango se asignaron a mano el 19/09 sin saber que había
un job diario que lo hacía, y el agujero de los avatares que `CLAUDE.md`
describe como *«nada los repone»* estaba siendo repuesto por ese mismo job.

⚠️ **Todo lo que dice números acá es de la pre-temporada.** Los datos se van a
borrar cuando arranque la T1. Lo que se conserva es **la forma**.

---

## Los cuatro, y qué límite tiene cada uno

| | dónde corre | qué hace | el límite que manda |
|---|---|---|---|
| **Worker** | Cloudflare | contesta los comandos de Discord | **10 ms de CPU** por request |
| **KV / R2** | Cloudflare | los datos y los PNG que el Worker sirve | **1.000 escrituras/día** en KV |
| **Apps Script** | Google, pegado al Oficial | la web app «Mi Perfil» | cuota de ejecución de Google |
| **Actions** | GitHub | el job de identidades y el ciclo de las tarjetas | 2.000 min/mes · **120 min por job** en `ciclo.yml` |
| **este repo** | Actions (`ciclo.yml`) | dibuja las tarjetas y las publica | ✅ ya no es a mano |

⚠️ **El límite de cada uno es lo que decide qué puede vivir dónde**, y no son
intercambiables. Los 10 ms del Worker prohíben calcular; los 30 minutos de
Actions permiten cualquier cosa, incluido Playwright — pero **no son
gratis**: el ciclo redibujando las 319 Servidor son ~74 min de los 2.000
del mes, asi que lo que decide es `que_cambio.py`, no el timeout. Por eso `CLAUDE.bot.md`
dice *«Playwright no corre en un Worker»* y por eso **Actions es el "otro
lado"** que ese mismo documento decía que hacía falta.

---

## Cómo circula un dato, de punta a punta

```
   lo que pasa en Discord
            │
            ▼
   ┌──────────────────┐   canal-log, -addaka, -startseason
   │  Actions diario  │   cron 08:00 UTC, llega 12–15 · backfill →
   │   (sync.py)      │   avatars → roles → nicks → audit
   └────────┬─────────┘
            │  escribe
            ▼
   ┌──────────────────┐            ┌──────────────────┐
   │   OPERATIVO      │            │     OFICIAL      │
   │  12 hojas        │◄──puente───│  8 hojas         │
   │  padrón · AKAs   │            │  los 4 rankings  │
   │  Consola · 1v1   │            │  CERO fórmulas   │
   └────────┬─────────┘            └────────┬─────────┘
            │                               │
            │        ┌──────────────────────┘
            │        │
            ▼        ▼
   ┌──────────────────┐        ┌──────────────────┐
   │   Apps Script    │        │   este repo      │
   │  «Mi Perfil»     │        │  los builders    │
   │  web app pública │        │  los 4 dibujos   │
   └──────────────────┘        └────────┬─────────┘
                                        │ Actions: ciclo.yml
                                        │ CADA HORA · bot/pipeline.py
                                        ▼
                              ┌──────────────────┐
                              │   R2  +  KV      │
                              │  4.244 webp      │
                              │  479 personas    │
                              └────────┬─────────┘
                                       │ sólo lee
                                       ▼
                              ┌──────────────────┐
                              │     Worker       │
                              │  /card /versus   │
                              │  /numeral …      │
                              └──────────────────┘
```

✅ **El tramo del medio se automatizó el 20/09/2026.** Hasta entonces era el
único a mano —y el más caro—: dibujar las tarjetas, subirlas a R2 y refrescar
KV se hacía en la máquina de Dlx, con Playwright.

Ahora es **un solo comando** —`python bot/pipeline.py --correr`— y lo dispara
`.github/workflows/ciclo.yml` **cada hora** (`0 * * * *`) desde el
22/09/2026.

🔴 **Y ESTO DECÍA «todos los días a las 09:00, una hora después del sync de
las 08:00».** Las tres mitades de esa frase dejaron de ser ciertas, y
conviene las tres porque cada una sola parecía suficiente para conservar el
horario:

| decía | mide |
|---|---|
| «todos los días» | **cada hora** desde que Dlx pidió el cron |
| «a las 09:00, después del sync de las 08:00» | el cron del sync pide las 08:00 y **GitHub lo atiende cuando puede**: 12:13, 12:48 y **14:47 UTC** en sus tres últimas corridas por horario. O sea que el ciclo caía *antes* |
| «dibujaría con el padrón de ayer» | las **24** corridas rehacen el padrón (paso 2), y desde el paso **1b** la identidad se le pregunta a Discord en cada una |

⚠️ **O sea que el ciclo ya no depende del sync para nada.** Lo que aquel
repo sigue haciendo solo suyo son los roles, los apodos y el ✅ de la Lista.

🔴 **Y esa hora estuvo mal el primer día.** El workflow nació con `0 4 * * *`
y el comentario *«después del sync de las 03:00»* — el 03:00 es el `Sync hora`
de la hoja `Consola`, que es otra cosa. Quedaba **cuatro horas antes**, justo
al revés de lo que decía evitar. **Dos números parecidos con el mismo
nombre**, que es cómo se cuelan.

⚠️ **Lo que lo hace sostenible es que no redibuja todo.** `bot/que_cambio.py`
contesta qué carta de qué persona quedó vieja, y un ciclo sin cambios termina
en 0.0 s. Sin eso, 26 minutos diarios se comen el 40 % de la cuota mensual
para que el 99 % de las cartas salga idéntica.

---

## Lo que hace cada uno, en detalle

### El Worker (Cloudflare)

Contesta interacciones HTTP de Discord — sin gateway, sin proceso prendido.
Comandos: `/card`, `/versus`, `/numeral`, `/settings`, `/help`, `/ping`.

**No lee el Sheet nunca.** Lee KV, que es un valor chico por persona. Es la
consecuencia directa de los 10 ms: parsear un JSON con las 138 se pasa del
presupuesto, así que hay una clave por persona.

| clave | qué |
|---|---|
| `p:<clave>` | esa persona: nombre, servidores, qué cartas tiene, los números del versus |
| `d:<discord_id>` | el índice que hace que `/card` sepa quién sos sin escribir nada |
| `meta` | el sello de la corrida, los requisitos y en qué servidores está el bot |
| `cfg:<guild>` | los ajustes de `/settings` de ese servidor |
| `pnick:<guild>:<uid>` | lo que esa persona eligió en `/numeral` |

### Las dos planillas

**Oficial** — 8 hojas, **cero fórmulas** en las cuatro de ranking. Es una
**vitrina**: todo se calcula afuera y se pega adentro como texto. Por eso
`competitivo.py` no está en ningún repo — ni acá, ni en el Apps Script.

**Operativo** — 12 hojas, y es donde vive la identidad:

| hoja | qué trae | estado |
|---|---|---|
| `Lista de Raperos` | el padrón: nombre, país, verificación, Discord ID, avatar | viva |
| `AKAs` | los alias, 184 cargados | viva |
| `Eventos Procesados` | 348 eventos con servidor, fecha, escala, MW | viva |
| `Consola` | el cursor del backfill y la temporada activa | viva |
| `Resultados` | Rapero · Posición · Puntos · MW pts | **vacía** |
| `1v1` | Rapero A · Rapero B · Ganador · Perdedor | **vacía** |

⚠️ **`docs/sheet_estructura.md` dice «NO EXISTE NINGUNA HOJA DE DATOS CRUDOS».
Eso es cierto del Oficial, no del Operativo** — que tiene las dos, con sus
columnas definidas y **sin una sola fila**. Por eso SEG, TER, DNA y DIN siguen
dibujándose en `—`: el esquema existe y el dato no.

### El Apps Script

Pegado al Oficial. Sirve la web app **«Mi Perfil»**, que lee las dos planillas
y cachea el resultado 6 horas.

⚠️ **Es `ANYONE_ANONYMOUS` ejecutando como el dueño.** Cualquiera con el link
entra y corre con los permisos de Dlx: **ese link es el control de acceso**.

⚠️ **`General.gs` está vacío a propósito** y dice por qué: todo lo que hacía se
migró a GitHub Actions. La hoja `Control` fue eliminada.

Dos funciones que calcula y **nunca muestra**: `computeEntropy()` —entropía de
Shannon sobre los 7 servidores, que es la definición de Diversidad— y
`comp_raw` —el Score **sin** el castigo de la Confianza—.

### GitHub Actions (`underraponline-lgtm/liga-global-sync`)

Un job diario. El cron pide las **08:00 UTC** y GitHub lo atiende cuando
puede — medido: 12:13, 12:48 y 14:47. Nueve modos, en orden:

```
backfill  →  saca Discord ID del canal-log y detecta la temporada
akaops    →  registra los alias de -addaka
sync      →  verificación ✅/❌ y el puente Operativo → Oficial
avatars   →  repone los avatares (col F)
roles     →  los roles de rango
nicks     →  los apodos «#12 | Konan»
audit     →  salud de las identidades, nunca escribe
```

⚠️ **Estuvo muerto del 17 al 19/09 con tilde verde.** El token del bot cambió,
todas las llamadas a Discord daban «sin respuesta», y el script reportaba «0
cambios» y salía con código 0. Arreglado el 20/09: ahora sale con error.

---

## Lo que se aprendió cruzándolos

**1. El rango vive en SIETE lugares, no en cinco.** `CLAUDE.md` lista cinco;
faltaban el `Index.html` del Apps Script y el `RANGO_ROLES` de `sync.py`.

**2. Los avatares sí se reponían.** Entre 5 y 17 por día, hasta el 16/09.

**3. Dos sistemas escriben el mismo apodo.** `sync.py nicks` y `/numeral`.
Resuelto: la elección de la persona gana.

**4. El cálculo del Competitivo no está en ningún lado que se pueda leer.** Ni
en las planillas, ni en el Apps Script, ni en los dos repos.

---

## Lo que conviene mover a Actions, y por qué

El criterio de Dlx, 20/09/2026: *«que no todo esté dependiendo de una
herramienta, así evitamos limits, payment features»*.

| qué | dónde | estado |
|---|---|---|
| dibujar las 4 tarjetas | **Actions** | ✅ `.github/workflows/ciclo.yml` |
| subir a R2 | **Actions** | ✅ va pegado al dibujo, en el mismo job |
| refrescar KV | **Actions** | ✅ idem |
| rebajar los pools del Sheet | **Actions** | ✅ es el paso 1 del ciclo |
| bajar avatares | `sync.py avatars` | ya estaba, no se duplica acá |
| `verificar.py` | **Actions**, semanal | ✅ `.github/workflows/auditoria.yml` |

✅ **Los cuatro primeros se movieron el 20/09/2026.** Un solo comando
—`python bot/pipeline.py --correr`— hace la cadena entera, y el workflow lo
dispara **cada hora**. Ya no cuelga del sync: la identidad se la pregunta
a Discord en el paso 1b de cada corrida.
Ver `ESTADO.md`.

⚠️ **Y no conviene mover TODO a Actions tampoco.** Son 2.000 minutos al mes:
una tanda de 464 tarjetas tarda ~26 minutos, así que redibujar todo a diario
se come el 40 % del mes.

✅ **La regla de «redibujar sólo lo que cambió» ya no es una intención: es
`bot/que_cambio.py`.** Contesta **qué carta** de **qué persona** quedó vieja,
contra un mapa campo→carta **medido** (`datos/campos_por_carta.json`): si
cambia `pts` se rehace la Temporada y nada más. Medido: 4 de 139 personas en
vez de las 139. Un ciclo sin cambios termina en **0.0 s**, y ése es el número
que hace que se pueda correr todos los días sin gastar la cuota.
