# 📰 Novedades — Liga Global

Qué cambió, **qué decidió Dlx** y qué falta. Lo más nuevo arriba.

> **Reglas de este papel:** horas siempre en **hora del este (ET)**. Cada
> decisión con las palabras de Dlx y dónde vive en el código. Se actualiza
> al final de cada tanda de trabajo. Si algo de acá contradice al código,
> manda lo que decidió Dlx: se arregla el código.

---

## 📌 Las reglas que Dlx ya decidió

Son las que no se pueden volver a preguntar ni olvidar.

### Quién tiene carta

| regla | Dlx | dónde vive |
|---|---|---|
| **Para tener carta: estar en DRA y verificado**, con Discord ID y país — **sin excepciones desde el 05/10** (fila de abajo). ~~Salvo la Temporada y la Servidor (29/09)~~ | *«to get cards all need to be in DRA server and verified»* (24/09) · *«C»*, *«1. dale»* (05/10) | `bot/verificados.py` |
| **Las tarjetas, en dos pasos (05/10, 2.41)**: sin verificarse, **ninguna**; la **Servidor** al verificarse (la de cada servidor donde está); la **Temporada**, con el **nivel 1 del Pase de rapero** (quien no jugó la tiene con «—»); la Competitiva y la de País, verificado y con su requisito. **Quien ya las tenía las conserva hasta la T1** (`datos/conservan.json`, B); **Dlx, fuera de todas** (prueba las cosas). Lo de la cuenta (/foto, Mis redes, seguir, avisos personales), sólo verificados. ~~29/09: la Temporada y la Servidor eran de todos los que jugaron, verificados o no~~ | *«C»* · *«1. dale, pero a mí no»* · *«2. desde ahora»* · *«3. A»* · *«4. nivel 1»* · *«B»* (05/10) | `verificados.puede()` · `datos/conservan.json` · `datos/pase_niveles.json` · KV `dn:<id>` (sólo los que conservan) |
| **Verificado = sólo el rol Miembro de DRA** | *«El rol de verificado es miembro en DRA únicamente»* (24/09) | `bot/verificados.py` |
| De FFA, LIVONIA, La Confederación, **Snake Rap y Urban Freestyle**: se saca el ID, **no se verifica** | *«saca su ID, sí, pero no lo verifiques»* (19/09) · Urban Freestyle, *«quiero que hagas reconocimiento de IDs»* (25/09) | `herramientas/cruzar_miembros.py` |
| **Autoverificar**: IDs de Snake Rap → Sheet → si están en DRA **y tienen país** (bandera o rol de país en DRA, FFA, LIVONIA o Snake Rap) → Miembro de DRA | *«only those [that] have a country flag or role can be verified»* (24/09) | **en el ciclo** desde el 25/09 (`bot/autoverificar.py`, paso 1a2) · los IDs por nombre, a mano (`herramientas/cruzar_miembros.py`) |
| **El país sale del rol** cuando la Lista no lo tiene: gana USA · el rol de DRA · el de los otros servidores (sólo roles con bandera) · la bandera del nombre. Dos países sin USA: no se toca | *«si dale»* (25/09, #8) | `bot/autoverificar.py` |
| **Quien se anota con `/card` y no está en la Lista, entra solo** con su ID y país. Lo dudoso (sin país, nombre parecido a otro, alias, troll) va a Pendientes | *«necesitamos que todas las personas que se verifiquen estén en DRA»* (25/09, #11) | `sheet/registrar_ids.py` · `bot/worker.js` |
| Requisitos por carta: Competitivo **10 eventos** · País **3 duelos nacionales + 3 internacionales + bandera**. La Temporada y la Servidor ya no tienen requisito de datos: las abre el portón (y la Temporada, el nivel 1 del Pase; fila de arriba). ~~Temporada 1 participación (22/09)~~ | (22/09) · (05/10) | `comun/requisitos.py` · `verificados.puede()` |
| Nadie tiene letra de rango hasta **10 eventos** | *«no aparece nadie hasta q tenga 10 eventos»* (23/09) | `sheet/rankings.py` |
| **8 rangos** (SSS 82 · SS 73 · S 62 · A 48 · B 37 · C 26 · D 18 · E), con el **Score de 0 a 100**; los roles de Discord ya son 8. ❌ **A7 (el Score a 40–99) quedó descartado**: Dlx, 05/10, *«¿por qué cambiaste el score competitivo?… cada OVR de cada tarjeta calcula algo diferente»*. No se vuelve a proponer | (17/09, 23/09, 05/10) | `comun/rangos.py` |

### Eventos y ranking

| regla | Dlx | dónde vive |
|---|---|---|
| La **guía de formatos de llave** manda: sin campeón no suma (12 h), pokémon, suplente, draft, invitado de honor, fases de filtros, Interserver retenido | Partes 1 y 2 (24/09) | `bot/escuchar.py`, `bot/llaves_a_entrada.py`, `sheet/motor.py` |
| Eventos por equipos: los puntos se reparten; la batalla no cuenta como duelo | | `sheet/motor.py` |
| **El comodín no cobra**: el que va entre paréntesis en un lado —`[(PICHULITA 🇦🇷) YINN 🇲🇦]`, `YINN 🇲🇦 + (PICHULITAMC 🇦🇷)` en #votaciones— es *«cualquier persona literal»* elegida para rapear sólo esa ronda (la final «con comodín»). Es un pokémon: no es del lado, no divide, no cobra y no cuenta para la escala; lo que haya ganado antes en la llave lo conserva | *«los que están en () son POKEMON… no creo que deberían ganar nada»* · *«no necesariamente alguien eliminado… es cualquier persona literal»* (03/10, DESGRACIAS EN TOKYO VOL 21) | `escuchar.sin_refuerzos()` y su copia en `llave_vivo.js`; el caso en `bot/llaves_casos.py` |
| **Los troll no entran a ningún ranking**; se marcan en ✅ Decidir con «Es un troll» | *«If it is a troll name right?»* (24/09) | `sheet/decidir.py` → `no_rankear()` |
| **RAP EXHIBITION 1/8** (Snake Rap, 22/09) **cuenta** | *«no sé por qué no cuenta si sus llaves están en #llaves de Snake Rap»* (27/09). El 24/09 se había decidido que no creyendo que su llave no estaba en ningún canal | `datos/decisiones.json` |
| El Ranking Mundial son **países**, no selecciones | *«ese evento fifa ya no se está haciendo»* (22/09) | `sheet/rankings.py` |
| **Avisos fuera de Discord**: 1º Web Push, después Telegram. El ping de rol de Discord **no se reemplaza**. El permiso se pide donde ya están: debajo de `/card` y en el hub | *«así la gente se va a encadenar más»* (21/09) · construido el 24/09 | `bot/avisos.js` · `#/avisos` |

### Personas

| | Dlx |
|---|---|
| **ELSOLAR** (🇨🇴) y **Solar** (🇨🇱, ID `1155972121848201256`) son **dos personas** | 24/09, en ✅ Decidir |
| **JAHNO** y **Juano** son dos personas | 24/09 |
| **Santz** y **Santos** son dos personas | 24/09 |

### Servidores, Sheet y web

| regla | Dlx |
|---|---|
| **El hub (underlegends.pages.dev) y el servidor son la vitrina; el Sheet son datos en crudo** | *«el hub será esta página y principalmente nuestro servidor»* (24/09) |
| **Snake Rap** es servidor de carta: su camiseta, sus IDs y sus eventos en el hub | 24/09 |
| DRA es la fuente principal: el bot muestra, no reemplaza | |
| El Sheet nuevo se sobreescribe, no es otro documento | |

### Cómo se trabaja

| regla | Dlx |
|---|---|
| **Todas las horas en hora del este (ET)**, nunca UTC — en mensajes, commits, archivos y hojas | *«I told you to refer everything as my local time zone EST»* (24/09) |
| **No rotar ni crear tokens hasta el final** del proyecto | |
| Avisar **una vez** por llave; si cambia, se **edita** el aviso | |
| Lo que toque quién está verificado **se pregunta antes**, con el número medido | (lección del 24/09) |


### Lo que contestó Dlx el 25/09 (las 17 preguntas)

| # | regla | Dlx | estado |
|---|---|---|---|
| 1 | **Makmah y Makma son la misma persona**: se saca la nota «DOS Makmahs» de la hoja AKAs | *«supongo. Las 2 son la misma persona»* | ✅ hecho (1:32 AM) |
| 2 | **CJ es `@cj_kloke_`** 🇻🇪 | *«si»* | ✅ CJ con su ID (1:32 AM) · Eze y Noone siguen abiertos (abajo) |
| 3 | **money maker** (y «moneymaker») **es troll** | *«si»* | ✅ hecho (1:32 AM) |
| 4 | **SEBITA es AKA de Liberia**: sus puntos van a Liberia | *«lo agregas SEBITA como AKA de liberia y todos los puntos de sebita específicamente le das a liberia»* | ✅ hecho (1:32 AM) |
| 5 | **Solar entra a la Lista con su ID**, sin confundirlo con ELSOLAR | *«Si. pero ten cuidado como dije que hay 2»* | ✅ hecho (1:32 AM): fila propia, con la nota «No es ELSOLAR 🇨🇴» |
| 6 | **El Score Selección de la carta de País sale de la T1** (los 5 mejores de cada país) | *«si»* | ✅ hecho (1:42 AM) |
| 7 | Los estilos de Snake Rap **no** llenan los íconos de la Competitiva | *«no»* | cerrado |
| 8 | **El escritor de la columna País** con los roles de país de Snake Rap | *«si dale»* | ✅ en el ciclo: 15 países puestos a las 2:52 AM |
| 9 | **Autoverificar, las dos cosas**: automático en el ciclo y a mano | *«podríamos hacer ambos para ahorrar el trabajo»* | ✅ en el ciclo, cada media hora, y a mano |
| 10 | **Alertas: por DM sólo a Dlx** si algo se traba; lo normal, en el canal donde avisa el repo de sync | *«por DM a mi únicamente. si es algo normal avísalo en el canal donde mencionas cosas con el repo de sync»* | ✅ hecho (1:39 AM): el DM de prueba te llegó a la 1:44 AM |
| 11 | **Quien usa `/card` y no está en la Lista, se agrega** con su ID y país. Verificado **sólo si está en DRA** | *«necesitamos que todas las personas que se verifiquen estén en DRA»* | ✅ desde las 2:22 AM |
| 12 | **Se fusionan las 9 filas duplicadas** del padrón **guardando todas las AKAs** | *«si pero guarda las diferentes akas»* | ✅ 9 fusionadas (1:32 AM), con sus AKAs |
| 13 | «¿Por qué no tengo carta?» en el hub: sí, más adelante | *«si ahí vemos del tema»* | después |
| 14 | El bot **sigue siendo Administrador** | *«no»* | cerrado |
| 15 | **Los anuncios de toda la Liga se re-publican en `〢🔥〉eventos-hoy`** de DRA (`1500690475089399858`) | *«si este es el canal»* | ✅ hecho (1:22 AM) |
| 16 | Telegram, **al final** con los demás tokens | *«lo dejamos para el final»* | cerrado |
| 17 | **El vigía escucha sólo eventos y competencias** (10 canales) | *«solo eventos y competencias»* | ✅ hecho (1:22 AM) |

### Lo que pidió Dlx el 25/09 (además)

| regla | Dlx | estado |
|---|---|---|
| **Sólo tres servidores confirmados**: Snake Rap, Discord Rap Español y FFA. El hub muestra esos | *«los únicos servidores confirmados son Snake Rap, Discord Rap y FFA... los demás no están confirmados todavía»* | ✅ hecho · `datos/servidores.json` (`confirmado`) |
| **La descripción oficial**, y nunca «la liga de freestyle de Under Legends» | *«🏆 La Liga Global de Freestyle en Español. Unimos los rankings de los mejores servidores de rap online en una sola tabla mundial…»* | ✅ hecho |
| **Banderas como imagen**, no emoji | *«puedes poner literalmente una imagen pequeña de las banderas»* | ✅ hecho |
| **Mundo con nombre completo, logo y miembros** de cada servidor | *«con sus nombres completos e incluso sus logos y cantidad de miembros»* | ✅ hecho |
| **RACHA = eventos seguidos llegando a semifinal** si la llave es de octavos, **a la final** si es de cuartos (más de 16: «supongo semifinal, ahí veremos») | *«RACHA es llegar a semifinal cuando el formato es de octavos, o cuando es de cuartos a la gran final»* | ✅ hecho (1:35 AM) · quedan detalles (abajo, 3) |
| **«Ver llaves»** en «Lo que pasó»: la llave completa del evento en la web | *«un botón de ver llaves de evento y vemos ahí la info y las llaves de forma detallada»* | ✅ la página desde las 2:01 AM; las llaves, desde la corrida de las 2:22 AM |
| Verificación: un comando en Discord y un apartado en la página (quizás con login de Discord) | *«mi idea original era implementar un comando de verificación en discord y un apartado de verificación en la página también»* | a diseñar |
| **De madrugada, menos corridas**: de 3 a 11 AM ET el ciclo corre dos veces (6:52 y 10:52) y no cada media hora | *«después de las 3am EST hasta las 11am EST que haya un retraso de cada 4 horas»* | ✅ hecho (3:40 AM) · `bot/madrugada.py`, `MADRUGADA` en el Worker |
| **El logo de UL en las notificaciones** | *«puedes usar este logo para las notificaciones y todo lo que conlleva?»* | ✅ hecho (4:29 AM) · sale de `01_Temporada/ul_blanco.png` |
| **La llave como un cuadro de torneo**, con los nombres en los huecos | *«pensé que ibas a crear algo así y rellenar los nombres en esos huecos»* | ✅ hecho (5:15 AM) · `cuadro()` en app.js |
| **Sección Eventos**: calendario con los pasados (color de cada servidor) y los futuros | *«aparecerá en forma de calendario todos los eventos que pasaron con un color diferente»* | ✅ hecho (5:15 AM) · `#/eventos` |
| **Crews arriba de los países**, en Mundo | *«puedes poner las crews encima de los países»* | ✅ hecho |
| **Un mapa en Inicio** con el % de países representados | *«poner como un mapa con el porcentaje de cuántos países están representados»* | ✅ hecho · 15 de 20 (75 %) |
| **Los cinco de arriba = top 5 de todos los rankings**, no sólo Temporada | *«que los cinco de arriba muestre el top 5 de todos los rankings»* | ✅ hecho · seis rankings |
| **Todo más grande**, usando bien el espacio | *«siento que todo está muy pequeño.. hay demasiado espacio»* | ✅ primera pasada · decime qué sigue chico |
| **Los logos de los servidores, al día desde Discord** | *«trackear los logos actuales ya que el bot debería ser posible de eso»* | ✅ en el hub · ✅ en las cartas desde el 25/09 a las 12:17 PM (`datos/iconos_sv.json`) |
| **Comparar con la página vieja del Apps Script** («Mi Perfil»): qué falta y qué mejorar | *«chequea muy bien cómo estaba la página appscript del excel antiguo»* | ✅ comparada · falta el informe |

### Lo que contestó Dlx el 25/09 a las 8 (5:40 AM)

| # | regla | Dlx | estado |
|---|---|---|---|
| 1 | **Eze y Noone**: que el bot los detecte solo | *«de momento dejémoslo que el bot lo detecte automáticamente»* | ✅ cerrado · entran con `/card` o autoverificar |
| 2 | **TFC es «The Freestyle Corpo»**, y no está en la Liga | *«The freestyle corpo, pero no están en la liga global»* | ✅ `datos/servidores.json` y el Worker |
| 3a | **Racha en llaves de más de 16**: lo decidí yo, como pidió. **El cuarto de arriba de la llave**: cuartos en una de 32, octavos en una de 64 (la final en 8, la semi en 16) | *«¿cuál crees?»* | ✅ `rankings._umbral()` |
| 3b | **Llaves de menos de 8**: llegar a la final | *«sí»* | ✅ ya era así |
| 3c | ~~Faltar a un evento corta la racha~~ — **no**: Dlx hablaba de **inscribirse y no ir** (ver abajo). La racha mira sólo los eventos que jugaste | *«sí creo»* → *«nono… a lo que me refería era si un usuario se inscribe a un evento pero luego no va»* | ↩️ deshecho a las 6:43 AM · lo de inscribirse y no ir, más adelante |
| 3d | **La racha del ranking de Duelos es de duelos ganados seguidos**; participar en eventos no es racha | *«duelos ganados únicamente»* | ✅ ya era así |
| 4 | **El logo UL, la trama y la dirección se quedan** | *«así como está ahora está bien»* | ✅ cerrado |
| 5 | **Verificación**: `/verificar` en Discord | *«¿qué crees que deberíamos hacer?»* → *«correcto»* | ✅ hecho (7:35 AM) |
| 6 | **El perfil de cada rapero** | *«ESTARÍA BUENÍSIMO»* | ✅ hecho (6:15 AM) |
| 7 | **Most Wanted**: más adelante | *«sí, pero poco a poco iremos ahí»* | 🔜 en el top 5 como «Próximamente» |
| 8 | **Redes sociales**: sí, y las de los servidores | *«¡Sí! ¿Puedes revisar el feed de las cuentas de Snake Rap, FFA y DRA?»* | ✅ las de los servidores y la Liga · las de cada rapero, con el login (pregunta 3) |

### Lo que contestó y pidió Dlx el 25/09 (6:30 AM, con cinco capturas)

| regla | Dlx | dónde |
|---|---|---|
| **Knowledge Sombrío** es Sombra, Heat, Jere, Kain y Zaylax (más Zignos, que ya estaba) — **no** el rol 🧠 KNOWLEDGE de FFA | *«No. Era Sombra, Heat, Jere, Kain, Zaylax y quizás personas que no sé más»* | `datos/crews.json` |
| **La racha no se corta por faltar.** Lo que la va a cortar es **inscribirse y no ir**, y eso espera a que guardemos las inscripciones | *«creo que es algo muy complicado de aplicar, entonces mejor no»* | `sheet/rankings.py` |
| **`/verificar`**, sí | *«Correcto»* | `bot/worker.js` |
| **Misiones**: lo va a contar él | *«Te hablaré más del tema en el futuro»* | — |
| Los cinco de arriba **sin «…»**, con **Ascenso** y **Ligas** (próximamente) y **Rachas en vez de Países** | *«que todo sea expandido»* | `app.js` |
| **«(actual)»** al lado del campeón de la temporada, y **el campeón del competitivo** al costado | *«porque no acabó la temporada»* | `app.js` |
| **Rankings**: los que faltaban, sin «Camino al competitivo», las columnas del ranking oficial y **todas ordenables** | *«crear más columnas… racha, último evento, sobrevivió, cazó, cazado… y uno nuevo que es misiones»* | `app.js` (`COL`, `SUBS`) |
| **Duelos sale del menú** y entra **Pase de rapero, próximamente** | *«lo de duelos deberías quitarlo y ahí poner PASE de rapero»* | `index.html` |
| **Comparar: primero la categoría** | *«elegir la categoría primero, o sea qué se va a comparar»* | `app.js` |
| **Eventos más vivo**, con logos, DRA y **Google Calendar** | *«se ve algo muerto… sincronizar esto con el calendario de Google»* | `app.js`, `/calendario.ics` |
| **Mundo con números exactos** | *«en el mundo poner números exactos»* | `subir_web.py` |

### Lo que contestó y pidió Dlx el 25/09 (7:50 a 8:20 AM)

| regla | Dlx | dónde |
|---|---|---|
| **`/notify`**: los avisos de eventos **por DM**, eligiendo los servidores desde Discord | *«activar las notificaciones de este servidor… ahí te dejará las opciones en vez de que lo haga en el website»* | `bot/avisos.js`, `bot/worker.js` |
| **`/website`**: el link a la página | *«/website que te redirigiría a la página»* | `bot/worker.js` |
| **Volk 🇲🇽 y volk 🇨🇴 son dos personas**, y los dos son de Guardia Nacional | *«sí, son diferentes; los dos son parte de ello»* | `datos/crews.json`, `bot/subir_web.py` (`_choques()`) |
| **Ascenso y Ligas llegan en la Temporada 2** | *«eso será en la temporada 2»* | `app.js` |
| **Sin «(actual)»** en el Inicio | *«quita el (actual) que dice en inicio»* | `app.js` |
| **El Inicio muestra el top 3** de cada ranking | *«que sólo muestre el top 3 de todo en el inicio»* | `app.js` |
| **Las dos tarjetas de campeones van a la derecha**, no abajo | *«tienen que estar a la derecha, no abajo»* | `estilo.css` |
| **La racha como «1/4»** | *«¿por qué no ponés / X?»* | `app.js` |
| **Las redes en grande arriba del top**, y **las novedades** son la información de la Liga | *«2 bloques con flechas… lo último de la liga que sea como novedades»* | `app.js` |
| **Paneles con páginas en el Inicio**: Most Wanted \| Misiones primero, La Liga hoy al final | *«la primera será MW, a la derecha MISIONES… Liga hoy será la última»* | `app.js` |
| **Mi cuenta** arriba a la derecha y **Ajustes** | *«mi cuenta (mi perfil y cosas más)… y una de ajustes»* | `app.js` |
| **La hora, la de quien mira** | *«que se adapte al usuario… en mi caso yo soy EST»* | `app.js` (`fmtHora`, `diaDe`) |
| **Páginas de crews y de países** | *«crear perfiles para las crews, y quizás países»* | `app.js` |
| **Histórica y Prime** en la Guía, «próximamente» | *«agregá HISTÓRICA y PRIME»* | `app.js` |
| **Sin «Qué se escucha»** en Eventos | *«eliminar eso que se escucha muchas cosas de DRA»* | `index.html` |

### Lo que contestó Dlx el 25/09 (tercera tanda de la mañana)

| regla | Dlx | dónde |
|---|---|---|
| **El Score usa los pesos del rework (G1)**: ⚡25 · 🎯24 · 👑21 · 🔥10 · 🌍20 (antes 30 · 24 · 21 · 15 · 10) | *«sí»* | `sheet/competitivo.py` (`PESOS`) |
| **La Diversidad es la del rework**: reparte los **puntos** por servidor —dónde ganaste—, no las participaciones | *«asegurate que eso de la diversidad del rework aplique»* | ya lo hacía (A4); el texto de la Guía decía otra cosa y se corrigió |
| **A7 (el Score a 40–99), más adelante**, con recordatorio | *«aplicalo en otro momento… hazme recordar, ahora no»* | `bot/alertar.py`: un DM cuando alguien llegue a 8 eventos |
| **Mi cuenta: entrar con Discord** | *«creo que sería mejor meter el login de Discord»* | `bot/worker.js` (`/cuenta`), `bot/paginas/app.js` |

### Lo que pidió Dlx el 25/09 (a media mañana, con capturas)

| regla | Dlx | dónde |
|---|---|---|
| **`/notify` no manda DMs**: lleva a activar los avisos **en el dispositivo** | *«No debería usar el bot para enviarte DMs, sino activar la notificación al celular o dispositivo»* | `bot/worker.js` (`panelNotify`), `bot/paginas/campana.js` |
| **Y se eligen los servidores en Discord** (o todos) | *«que te dé la opción para activar las notificaciones desde Discord… y seleccionar los servidores o para todos»* | el menú de `/notify` arma el link `#/avisos/FFA,SR` o `#/avisos/todos` |
| **Un changelog abajo de Ajustes, sin información sensible** | *«abajo de ajustes agrega un changelog… eso de novedades que vamos llenando, pero sin información sensitiva»* | `bot/paginas/cambios.json`: **se escribe a mano al terminar cada tanda**, junto con este archivo |
| **El podio del Inicio con flechas** por categoría, y más cosas abajo | *«deja unas flechas para cambiar de categoría a competitivo así y así… y agrega más cosas abajo»* | `bot/paginas/app.js` (`catsPodio`, `pintaUnos`) |
| **La llave, que se entienda mejor** | *«mejora esa sección de las llaves brackets que te dije»* | `bot/paginas/app.js` (`cuadro`, `abrirLlave`) |

### Lo que dijo Dlx el 25/09 (10:45 AM)

| regla | Dlx | dónde |
|---|---|---|
| **Estamos en FASE DE PRUEBA; la Temporada 1 va del 5 de octubre al 31 de diciembre** | *«estamos en prueba todavía»* · *«la temporada 1 ya tiene fecha de arranque: 5 de octubre hasta el 31 de diciembre»* | `comun/temporada.py` (`FECHAS`); el Inicio y el pie lo dicen solos |
| **El changelog lleva versión**: hoy **1.06**; cada actualización, grande o chica, **+0.01** | *«estamos actualmente en la actualización 1.05… cada cambio grande o pequeño se aumentará un .01»* | `bot/paginas/cambios.json` (`version`) |
| **Los anuncios de la Liga van en 〢🌍〉rankings-liga-global de DRA**, y salen solos en «Novedades de la Liga» | *«en ranking global de DRA, sólo en ese servidor… el bot debería hacer eso por default»* | `herramientas/anunciar.py`; la página los lee en cada corrida |
| **Crews y países se tocan como un perfil** | *«que aparezca ese cuadrado celeste y el mouse para clickear como cualquier perfil»* | `bot/paginas/estilo.css` |

### Lo que dijo Dlx el 25/09 (11 AM a 11:40 AM)

| regla | Dlx | dónde |
|---|---|---|
| **De 3 a 11 AM ET no corre ninguna sincronización** (antes corría a las 6:52 y 10:52) | *«durante las 3am EST y 11am EST no se hará ninguna sincronización para ahorrar más»* | `bot/madrugada.py` y `MADRUGADA` de `bot/worker.js` |
| **Urban Freestyle es de la Liga**: el bot entró, con su TikTok | *«el bot ya está metido. El ID del servidor es 1467763447117778989»* · *«este es el TikTok de Urban Freestyle»* | `datos/servidores.json` (`confirmado`) |
| **Se escuchan sólo los servidores de la Liga**: TFC no | *«Olvida TFC, ya te dije que no está»* | `confirmado` de `datos/servidores.json`, para el vigía, los anuncios y las llaves |

### Lo que dijo Dlx el 25/09 (11:45 AM a 12:15 PM)

| regla | Dlx | dónde |
|---|---|---|
| **Urban Freestyle en naranja, con la misma textura**, y su **logo nuevo** (la «UK» con corona) | *«el color de la tarjeta de esta misma al naranja pero que la textura sea la misma»* | `03_Servidor/disenos/los_nueve.py` (`#EA7206`), `comun/escudos_cuad/`, `comun/logos_sv/` |
| **Lo que cambia sólo de dibujo se redibuja de madrugada**, de 12 a 4 AM ET. Quien cambió de datos, en el acto. El ciclo a mano tiene `redibujar_ya` para un arreglo urgente | *«prográmalo para la madrugada este cambio ya que no hay muchas cosas»* | `bot/madrugada.py` (`REDIBUJO`), `bot/que_cambio.py` (`cambios()`) |
| **El logo de cada servidor se detecta del servidor**: las cartas usan el ícono que cada uno tiene hoy en Discord, igual que la página | *«mejor usa el nuevo logo, detéctalo del mismo servidor»* | `bot/subir_web.py` → `datos/iconos_sv.json` → `comun/escudos.py` |
| **Urban Freestyle se llama «Urban Freestyle»**, no «Urban Freestyle Battles» | *«para el nombre usa el real»* | `datos/servidores.json` y el menú del Worker |
| **Su tag: NUEVA GENERACIÓN** | *«usa este tag para Urban Freestyle: NUEVA GENERACIÓN»* | `datos/servidores.json` (`tag`) |
| **El alta automática usa el apodo del servidor donde se usó `/card`** (aunque en DRA tenga otro) | *«debería usar el de Urban Freestyle, es correcto»* | `sheet/registrar_ids.py` |
| **Reconocimiento de IDs en Urban Freestyle y Snake Rap**: se saca el ID, no se verifica | *«como el bot está en el servidor de Urban Freestyle y Snake Rap, quiero que hagas reconocimiento de IDs»* | `herramientas/cruzar_miembros.py`, `herramientas/servidores_de.py` |
| **Las de DRA sin tarjeta (1.492 con Miembro y país) la piden ellas** (`/card` o `/verificar`), no se cargan de golpe; la página y un aviso fijo en DRA las empujan | *«la verdad no sabría qué decirte»* · *«Que la pidan ellas»* (25/09) | ✅ «¿Todavía no tenés tu tarjeta?» en **Tarjetas** y en «La comunidad» (`pintaPedi()` de `app.js`) · ✅ aviso fijo en 〢🌍〉rankings-liga-global (26/09, 3:57 PM, sin @everyone: `docs/anuncios/2026-09-26_pedi_tu_tarjeta.json`) |
| **Urban Freestyle, en el anuncio** | *«sí, exacto»* | ✅ publicado con @everyone en DRA y FFA (11:45 AM) |
| **Mi cuenta: todas las ideas** —redes de Discord, próximos eventos, seguir raperos, avisos personales— | *«todas»* | 🔨 en curso |

### Lo que contestó Dlx el 25/09 (1:15 PM)

| regla | Dlx | dónde |
|---|---|---|
| **La foto es libre hasta el 9 de octubre inclusive** (hora del este); desde el 10, una por temporada. **Lo cambiado antes no cuenta** como el cambio de la temporada (había dos marcas de la fase de prueba, dlx y makmah: quedaron libres) | *«Sí. O sea hay cambios ilimitados hasta el 9»* | `FOTO_LIBRE` de `comun/temporada.py` → `FOTO_LIBRE_HASTA` del Worker (`bot/desplegar.py`) → `/foto` y la página |
| **El 5 de octubre lo jugado en la fase de prueba se borra**: la T1 arranca de cero | *«Se borra»* | ✅ programado: `INICIO` cambia solo a las 00:00 ET del 5/10 (`comun/temporada.inicio()`) y el ciclo archiva y vacía lo crudo una vez (paso 0 de `bot/pipeline.py`, `sheet/resetear.py --prueba`) |

### Lo que dijo Dlx el 26/09

| regla | Dlx | dónde |
|---|---|---|
| **El bot no le manda DMs a nadie más que a Dlx.** Lo de cada persona —tarjeta desbloqueada, rango, eventos— va **sólo** por la notificación de la página | *«eso de notificaciones sólo queremos que sea por la website y la notificación. No quiero que haya riesgo de que nos baneen el bot»* | Hoy son dos DMs y los dos a `DUENO`: las alertas (`bot/alertar.py`) y su «probando» (`bot/avisos.js`). `herramientas/sin_dm.py` pone rojo a CI si aparece un DM a otra persona |

### Lo que dijo Dlx el 27/09

| regla | Dlx | dónde |
|---|---|---|
| **La revisión de permisos de Discord va por el camino liviano**: se piden Message Content y Server Members tal como el bot funciona hoy, sin rehacerlo | *«no te preocupes mucho de eso… hay muchos bots que funcionan así»* | el formulario lo llena Dlx; las respuestas, abajo en «🔑 La revisión de permisos» |
| **Cada uno borra lo suyo con un comando** | *«podríamos hacer un comando para delete-my-data»* | ✅ `/borrar-mis-datos` (`/delete-my-data` en inglés), en `bot/worker.js` |
| **El bot es privado**: sólo Dlx lo suma a un servidor | *«Sí, privado»* | lo cambia Dlx en el portal: Bot → «Public Bot» |
| **La página muestra la tarjeta sólo de quien pasa el portón**, igual que `/card` | *«sí»*, a ocultar las de quien no está verificado | `_del_porton()` en `bot/subir_web.py`: el mismo conjunto que KV |
| **Los íconos de estilo de la Servidor se quedan** (hoy salen de un sorteo por nombre) | *«aún no lo saques… te daré más información más adelante»* | `todos_sv.py`, `ESTILO_MUESTRA` |
| **Seguidores, seguidos y un muro de POSTS: todavía no** | *«no lo hagas todavía, tenemos que discutir y arreglar cosas primero»* | mi opinión, abajo en «❓ Esperando a Dlx» |
| **Urban Freestyle tiene que entrar igual que FFA y Snake Rap** | *«acuérdate que el bot está en Urban Freestyle, asegúrate que los eventos y canales sean identificados»* | sus cuatro canales de llaves se leen; ver la tanda 1.16 |
| **Urban Freestyle, con otro naranja** que el de Snake Rap, también en Mundo: **miel** | *«usa otro naranja… y para donde aparece en mundo también»* · entre tres tonos, *«prueba miel»* (7:22 AM) | miel `#F2B33D` en `datos/colores_sv_marca.json` |
| **Las tarjetas del inicio no repiten el nombre** debajo | *«que digan Hassan y Makmah otra vez cuando en la tarjeta sale el nombre es innecesario»* | `campeon()` en `bot/paginas/app.js` |
| **No son campeones todavía**: arriba de las tarjetas del inicio dice **«Líder»** mientras se juega | *«no son campeones todavía, son top 1»* · a «Líder», *«sí»* | «Campeón» desde el día después del cierre (`temporadaCerrada()`) |
| **Privacidad y Términos, dentro de Ajustes o de la cuenta**, y mejor hechas | *«¿quizás lo podamos agregar dentro de la sección de cuenta o ajustes? y hacer mejor esos sitios»* | `legalPop()` en `app.js` · `legal.css` |
| **El changelog es de cambios, no de anuncios**, lleva la hora y usa el ancho de la compu | *«eso sólo es un anuncio, no un cambio… añade la hora de cada changelog… mezclarlo a la derecha»* | `cambios.json` · `acomodarCambios()` |
| **«Tu servidor es donde más jugaste» sale del changelog**; cómo se asigna el servidor lo explica Dlx después | *«quita eso. Luego te comentaré cómo se hará»* | ⏳ esperando la regla |
| **El panel de llaves, con las cinco mejoras** que propuse: seguir a alguien tocando, por rondas, un link por llave, equipos en bloque y etiquetas | *«me gusta todo»* | `abrirLlave()`, `rondasLista()`, `seguirEnLlave()` en `app.js` (1.18) |
| **El cuadro es la vista de siempre**, también en el teléfono; «Por rondas» queda al lado | *«que el default sea cuadros, no por rondas»* | `LL_VISTA` en `app.js` |
| **Llaves en vivo, cada 1 minuto** como los avisos | *«sería de la misma forma que el de minuto… en vez de que sea 30 s que sea 1 m»* | el vigía (`bot/avisos.js`) + `bot/paginas/llave_vivo.js` (1.19) |
| **Los links de Discord abren la app**, no la página de Discord | *«hago clic en la llave pero me lleva a Discord en el website cuando tengo la app»* | `intent://` en Android (`app.js`); en el iPhone ya lo hacía |
| **KENNY y Kenny son una persona**, de Argentina | *«sí, de Argentina»* | `datos/akas_a_mano.json` |
| **FFA y EFA siguen con su silueta** en las cartas | *«eso de las siluetas no lo hagas, que se quede así de momento»* | `comun/escudos.py` (`CON_ICONO`) |
| **La Competitiva dice el puesto entre quienes tienen Competitivo**: Makmah es #1, no #4 | *«él es el único con tarjeta Competitivo, entonces debería decir #1»* | `puestos_competitivo()` en `sheet/construir_pool_competitivo.py` |
| **La hora de un evento, con la bandera de tu país** si entraste con Discord, o «hora local»; nunca «EDT» | *«al decir EDT o EST confunde a algunos»* | `etiquetaHora()` en `app.js` |
| **Los rangos de Snake Rap** —Insignia, 1 a 4, Chill— y sus puntos de ascenso, en cada evento suyo | el mensaje de su servidor, pasado por Dlx | `rangos` de SR en `datos/servidores.json`; **no suman en la Liga** |
| **Que se vea quién no está verificado** | *«que aparezca en alguna parte que no está verificado»* | el perfil, con lo que le falta (`_sin_verificar()`) |
| **Las tarjetas de quien se va se borran a la semana** | *«que sus tarjetas se borren después de 1 semana si se va, así para no ir borrando y rehacer todo»* | `bot/fuera.py`, paso 2e del ciclo |
| **El gráfico de fortalezas del perfil viejo vuelve** | *«había un gráfico donde comparaba las estadísticas del competitivo y te mostraba cuál era más fuerte y menos»* | `pintaJuego()` en `app.js` |
| **Botones más lindos, y al costado cuando entran** | *«ya te dije que hagas que los botones se hagan más bonitos… el botón está abajo sin ninguna razón»* | `.btn` en `estilo.css` |
| **Las tarjetas de los 279 que no pasan el portón se borran el domingo 4/10** si para entonces no se verificaron | *«ok»* (9 AM) | `bot/fuera.py`, paso 2e |
| **Seguir a alguien en la llave no puede saltar**, y el camino se tiene que ver como camino | *«this thing of selecting a person and seeing his path lightned is very buggy, fix that»* | `seguirEnLlave()` en `app.js` (1.20): la barra está siempre y con el mismo alto; se encienden las ramas |
| **El campeón no se repite** arriba de la final | *«I also dont have to see 2 times that this team won»* | la copa va en la etiqueta del borde de la final (`cuadro()`) y en su renglón de «Por rondas» |
| **Cara a cara**: el récord de cada uno contra cada rival | *«maybe we could create a DUELOS WIN RATE between each individual… counting the times they faced before»* | `caraACara()` en `app.js`: el perfil y «Comparar dos» (1.20) |
| **La bandera no se estira** (la de MTZ en el podio de SEVEN STREET) | *«why mtz has the mexican flag all width?»* | `img.bf` con ancho fijo en `estilo.css` |
| **Buscar bugs en todo y mejorar el teléfono** | *«take this time to fix bugs… search everywhere… improve the interface when someone is on MOBILE»* | una auditoría entera de la página: 13 hallazgos, los 13 arreglados (1.20) |
| **De 3 a 11 AM ET no se leen las llaves en vivo ni los anuncios**, igual que el ciclo | *«eso de detección de LLAVES en vivo que sea apagado entre las 3am y 11am, que siga eso de las notificaciones también y el cron»* | `enMadrugada()` en `bot/worker.js` y `vigilar()` en `bot/avisos.js`: el vigía late con `dormido` y no lee Discord. Lo anunciado de madrugada avisa a las 11 si el evento no empezó |
| **«Fuera de concurso»**: nadie desaparece del ranking; el **número de puesto** —y el podio, «Líder» y el `#N` del apodo— es **sólo de los miembros**. Quien no lo es sigue en la tabla, en su lugar por puntos, sin número y con cómo conseguirlo | a esconderlos, *«tampoco quiero desaparecer a todos del ranking»*; a «fuera de concurso», *«me gusta la idea»* (9:30 AM) | ✅ **hecho (1.21)**: `verificados.numerar()` es el único lugar; lo usan las vitrinas (`sheet/rankings.py`), los dos pools, los círculos de país/servidor/crew, la portada del Sheet y la página. Las cuentas (OVR, Score) no cambian |
| **El enganche es para todos**: Most Wanted automático, «Tu semana», avisos al teléfono, pronósticos en las llaves en vivo, Revelación y Novato de la semana, compartir la tarjeta como historia, desafíos | *«me gustó todo eso para todos… exceptuando lo del pase»* | ⏳ por construir; el objetivo, en palabras de Dlx: *«que la gente use el website y pare en nuestro HUB mayormente… atraer a la gente y engancharla»* |
| **El Pase de rapero es sólo para DRA**, y se avanza con **TAREAS** | *«eso sí me gustaría que sólo para DRA»* | ⏳ por diseñar |
| 🔴 **Tareas ≠ Misiones.** Las **Tareas** son del **Pase**; las **Misiones** son del **ranking de Temporada** (para todos) | *«lo de pase viene con TAREAS no misiones.. lo de misiones es para el ranking de temporada. Tareas para el pase no confundas»* | la pestaña «Misiones» del ranking; `comun/requisitos.py` ya suma las misiones para la Temporada |
| **DRA es el hub de la Liga: entrenamiento y eventos principales** | *«DRA será un hub con misión principal a entrenamiento también y eventos principales»* | las Tareas del Pase salen naturalmente de ahí |
| **Most Wanted arranca ya, a diario**, para probarlo | *«podríamos empezar ahora para ver, pero sería a diario porque no tenemos mucho tiempo en esta fase de prueba»* | ✅ **hecho (1.22)**: `bot/most_wanted.py`, paso 2b del ciclo |
| **El diario dura lo que la prueba: hasta el 4/10**. Con la T1, semanal | *«the period ends in october 4… like the periodo de prueba»* | `tipo_de()` en `bot/most_wanted.py`, con la fecha de `comun/temporada.py`: cambia solo el 5/10 a las 11 AM ET |
| **El tablero de buscados va en el panel del Inicio** | *«sí, exacto, por eso puse el panel ahí»* | `pintaMW()` en `app.js`: la primera página del panel |
| **La caza queda escrita en la llave para siempre**, y en vivo se marca a los buscados | a «la caza para siempre», *«sí»* · a «buscados marcados», *«sí»* | `cuadro()` y `abrirLlave()` en `app.js` |
| **Lo del Most Wanted suma a la Temporada: Puntos y OVR**, nunca al Competitivo | a «¿los puntos del MW suman ya a la Temporada (Puntos y OVR)?», *«1. sí»* | ✅ `sumar_mw()` en `sheet/rankings.py` (1.23) |
| **3 buscados por día; 9 por semana** | *«de momento, como es diario, que sean 3… y que cuando sea por semana que sean 9»* | `CUANTOS` y `CUPOS` en `bot/most_wanted.py` (1.23) |
| **Multiplicadores de puntos por servidor cada semana**, de **×0,5 a ×5**; el debuff le puede tocar **a cualquiera**; **desde ya**. Nunca el Competitivo | *«cada semana haya un multiplicador de puntos que tú vas a decidir randomamente»* · *«me gusta hasta x5»* · *«sí, a cualquiera»* · *«desde ya»* | ✅ `bot/multiplicadores.py` (paso 0b) y `rankings.agregar_temporada()` (1.24) |
| **Todas las ideas de enganche, aprobadas**: guerra de servidores, meta de comunidad, evento dorado, encuestas, bonus por llave limpia, ranking de organizadores y destacado del calendario | *«me gustan todas las ideas la verdad»* | ✅ dorado y guerra (1.25) · ⏳ el resto |
| **Y la segunda tanda también**: «Volvé», asistencia, insignias, Clásicos, precio por cabeza, Pasaporte, Semillero, sede de la semana, Lunes de la Liga, pronósticos. **La Fantasy League, más adelante** | *«me gustan todas… la fantasy league es muy buena idea también… pero creo que deberíamos implementarla luego»* | ✅ «Volvé», Pasaporte y Asistencia (1.25) · ⏳ el resto |
| **El diseño del Pase de rapero se habla después** | *«luego hablemos del diseño del pase de rapero y todo eso»* | ⏳ |
| **Sin bonus por llave limpia**: a los organizadores los premian el organizador de la semana, el Semillero y la sede, que son de uno solo por semana. Nada de «×1,5 a todos de gratis» | *«la 2. Pero explícame cómo sería porque tampoco queremos dar 1.5x a todos así de gratis»* | — |
| **La Copa de la Liga es de la persona**, no de su servidor: el próximo evento que organice, donde sea | *«a la persona»* | ✅ `organizados()`, `ranking_org()` y `copa_n()` en `bot/multiplicadores.py` (1.26) |
| **El Semillero cuenta a quien juega por primera vez en su vida en la Liga**, no «nuevo en la temporada»: volver en la T1 no te hace nuevo | *«A»* | ✅ `datos/vistos.json` + `resultado_semillero()` (1.27) |
| **Insignias y Clásicos, ya** | *«sí, dale»* | ✅ `bot/insignias.py` y `multiplicadores.clasicos()` (1.28) |
| **Seguir con la lista** | *«ok sigamos»* | ✅ meta de comunidad, premios de la semana, «con tiempo» y el Lunes de la Liga (1.29) · ✅ encuestas (1.31) · ✅ precio por cabeza (1.32) · ❌ el pronóstico en vivo (ver abajo) |
| **El Lunes de la Liga va en «〢🌍〉rankings-liga-global» de DRA** | *«en el canal ranking global en DRA»* | ✅ `bot/lunes.py`, paso 2b3 (1.30). El bot es admin en DRA |
| **«Con tiempo» desde 12 horas** | *«de 12 h a 24 h a más»* | ✅ `DESTACADO_H = 12` (1.30). Medido: 2 de 48 anuncios llegan |
| **Nada interactivo en vivo, todavía: las llaves en vivo son para mirar.** Sin pronóstico del campeón en vivo y, por la misma regla, sin el aviso de la caza en vivo | *«eso de elegir quién gana en vivo creo que no deberíamos hacerlo aún… eso de ver las llaves en vivo sí, pero lo demás que tenga que ver en vivo no… es muy pronto»* (27/09, 2:40 PM) | — no se llegó a escribir nada. **Se queda** lo que la llave en vivo ya muestra, porque es para mirar: el 🎯 de los buscados, el ×N del servidor y el Clásico |
| **Las encuestas: vota cualquiera que entre con Discord, y en el ×2 nadie vota a su servidor** («tu servidor» = donde más jugaste en la temporada) | *«1. A. 2. A»* | ✅ `bot/encuestas.py` + `validarVoto()` de `bot/avisos.js` (1.31). El Elegido ocupa un lugar del nivel del medio (siguen siendo 3 y 9); el ×2 votado es «×2 como mínimo», antes de la guerra y el Semillero. Hacen falta 3 votos. **Lo agregué yo**: las cuentas de Discord de menos de 30 días no votan (ver «❓ Esperando») |
| **El precio por cabeza se pone con PUNTOS DE TIENDA**, una moneda aparte del ranking: todos arrancan con **5.000**; si nadie lo caza en la semana, **vuelve**; una cabeza vale como mucho **20.000** | *«1. Pues PUNTOS de TIENDA… que todos empecemos con 5k… 2. A 3. sí 20k»* | ✅ `bot/precios.py` + el Durable Object (1.32) |
| **El que caza cobra lo mismo en los dos** (Tienda y Temporada), y **billetera tiene cualquiera que entre con Discord** | *«1. Ambos. 2. B»*, porque *«MW is for puntos temporada mainly but we need more incentives… for people to get through the website»* | ✅ `rankings.sumar_precios()` (1.32). La cuenta de Discord, de más de 30 días, como las encuestas |
| **TIENDA y PUBLICACIONES en el menú; en el celular la barra se desliza** | *«agrega la opción de TIENDA y PUBLICACIONES… en el PC será normal pero en celular haz que se deslice para ver más opciones»* | ✅ (1.32). Publicaciones dice «pronto»: qué va ahí todavía se habla |
| **Publicaciones es un muro automático de la Liga, y los anuncios de todos los servidores** | *«sí un muro automático, pero anuncios de todos los servidores también»* | ✅ `bot/muro.py` (1.33): campeones, rangos, tarjetas, cazas, precios, premios, El Elegido, anuncios y novedades. Contado por la Liga, en tercera persona |
| **El Most Wanted paga además el 10 % en Puntos de Tienda**, al que caza y al que sobrevive (12.000 de Temporada → 1.200 de Tienda) | *«b»* (28/09, 7:45 AM) | ✅ `most_wanted.TIENDA` + `precios.tienda_mw()` (1.34). Se reemplaza entero en cada corrida: una llave corregida no paga dos veces |
| **Entrar con Discord una vez alcanza**: nada de mandar a autorizar en cada voto | *«cada vez que presiono para votar me redirige a DISCORD… lo hice miles de veces»* (28/09, con capturas) | ✅ la sesión (1.35): `sesionNueva()` en `bot/avisos.js`, cookie `lg_ses` HttpOnly, 30 días, sin secreto nuevo |
| **SNAKE ARENA es formato 5 VIDAS** (5 competidores, como la Red Bull), no una llave. Durante un evento en vivo hay que mirar **todos los canales de eventos**; en **veredictos** está quién ganó, quién votó y quién participó | *«por eso tienes que estar pendiente de todos los canales de eventos cuando hay un evento en vivo… en veredictos está todo lo que pasó»* | ✅ **el formato** (1.36): la ronda «5 vidas» en `Entrada`, `motor.lugares_vidas()`, y la Vol. 2 cargada a mano desde #veredictos (#365). ✅ **en vivo** (1.38): el vigía lee los canales de veredictos mientras su servidor juega. ✅ **se carga solo** (1.39): el ciclo lee #veredictos y lo suma |
| **Hay muchos formatos** (5 vidas, pandillas, multiverse…). Lo que el motor necesita de cualquiera es lo mismo: **el lugar final** de cada uno (eso paga) y **las batallas 1v1** (eso es duelo). Un formato nuevo es otra forma de sacar el lugar, no otro motor | *«hay muchos formatos de rap, este es uno de ellos… es confuso, hay pandillas, multiverse, etc.»* (28/09) | ✅ la regla (1.36). En un 5 vidas el lugar es **el orden en que cayeron** (*«sí dale»*); los que terminan en pie con las mismas vidas **empatan y se reparten el pozo** (guía, §10.1: la #320 dio 2.166 cada uno, y el motor da lo mismo) |
| **Los 5 vidas: A y B** — el ciclo los carga solo desde #veredictos, y aparecen en ✅ Decidir para confirmarlos o descartarlos; si una batalla quedó pareja en el texto (un juez que vota con imagen), se pregunta quién ganó | *«1. A y b»* (28/09, 10 AM) | ✅ (1.39): `escuchar.vidas()` + `llaves_a_entrada.filas_vidas()`; en ✅ Decidir, «❤️ Vidas» con «Está bien así / No cuenta», y «No cuenta» **lo saca** del ranking (`procesar_entrada.sacar_descartados()`). La Snake Arena ya estaba aprobada (*«sí dale»*): no se vuelve a preguntar |
| **FULLY y PARK JI-SUNG son Oasis** (la misma cuenta de Discord; ya se sabía que «fullylo4ded» lo era, 18/09) | *«Park Jin sung es Oasis también»* (28/09, 1:30 PM, contestando si FULLY era Oasis) | ✅ alias en la hoja AKAs vía ✅ Decidir y `akas.json` rearmado a mano: desde la corrida de las 1:52 PM Oasis se lleva la World Cup y lo de MARRUECOS. ⚠️ **Oasis no es Miembro de DRA** (sólo está en FFA): suma los puntos pero queda **fuera de concurso**, sin número ni cartas, hasta que tenga el rol |
| **DNK pasa a su cuenta nueva** (la de la Lista no estaba en ningún servidor; la nueva es Miembro de DRA) | *«1. Sí, pásala»* (28/09, 10:55 AM) | ✅ la Lista, fila 296, y la pregunta cerrada con eso |
| **En el menú, Publicaciones y Tarjetas cambian de lugar** | *«quiero que intercambies la posición entre tarjetas y publicaciones»* (28/09) | ✅ (1.40): Inicio · Ranking · Publicaciones · Pase · Tienda · Eventos · Tarjetas · Mundo · Guía |
| **La escala sale del FORMATO de la llave, no de cuántos nombres distintos hay**: si alguien revive y aparece dos veces en la misma ronda, igual es una llave de 16 | *«En sí son 16.. sólo que quizás haya revivido pero en sí el formato es de 16»* (28/09, 5:10 PM, por la COMPE DEL VACILE: Majiztral dos veces en octavos) | ✅ (1.44): `llaves_a_entrada.repetidos_en_la_primera()` suma al revivido a los participantes, y `escuchar.resolver()` le da la batalla que perdió al otro (el revivido es el que aparece otra vez más abajo en la misma ronda, guía §3.7) |
| **El miel de Urban Freestyle queda** | *«Está bien»* (28/09) | ✅ |
| **Banner grande en la vista previa del link** | *«Siii»* (28/09) | ✅ (1.44): `bot/paginas/og.png`, 1200×630, con la piel de la página; lo arma `herramientas/banner_link.py`. Los links ya pegados pueden mostrar la vista vieja un tiempo (Discord la guarda) |
| **Los debutantes de la semana en el Lunes de la Liga, y un DM sólo a Dlx cuando una batalla lleve más de 24 h en ✅ Decidir** | *«B y C»* (28/09) | ✅ (1.44): `lunes.debutantes()` y `alertar.esperando()` (un solo DM con todas las que pasaron las 24 h; la que ya sonó no vuelve a sonar) |
| **«Tu servidor» lo elige cada uno**, no sale de dónde jugaste | *«La idea es que la gente decida por su cuenta»* (28/09) | ✅ (1.45), abajo |
| **«Tu servidor» se elige en Mi cuenta, una vez por temporada como la foto** (libre hasta el 9/10, la misma ventana), y **en el ×2 cualquiera vota a cualquiera**, también al suyo | *«1. A 2. A 3. B y C»* (28/09, 8 PM) | ✅ (1.45): tabla `servidor` del objeto (`miServidor()`, `servidoresElegidos()`); sale en el perfil en lugar de donde más jugó. `validarVoto()` ya no mira el servidor y `encuestas.py` dejó de mandar a KV de qué servidor es cada Discord ID. **La tarjeta de Servidor no cambia**: es de donde jugás |
| **Seguidores y seguidos, guardados de verdad** (con «Entrar con Discord», en el Durable Object; el aviso por la campana, nunca por DM) | *«Si hay que hacer eso»* (28/09) | ✅ (1.44): tabla `sigue` en el objeto (`seguir()`, `sigo()`, `seguidores()`); el aviso sale del muro (`seguidos()` lee `web:muro`, que ahora trae la clave de cada persona: `muro.con_claves()`) — sin KV nuevo. Afuera se ve cuántos, nunca quién; quién te sigue lo ves vos, y sólo los que son raperos. Las cuentas de menos de 30 días siguen pero no cuentan |
| **El remake de la web va después de todo lo demás, incluido lo de seguidores** | *«luego de que hayas hecho todo lo demás y lo 8 haremos eso»* (28/09) | ⏳ |
| **Misiones, Tareas y el diseño del Pase: más adelante**, lo cuenta Dlx | *«Más adelante te contaré»* · *«Sí»* (28/09) | ⏳ |
| **El MULTIVERSE se carga solo, como cualquier llave.** Cada uno va solo o en equipo del tamaño que quiera: 2v2, 1v3, 8v1 | *«En multiverse uno tiene la opción de ir solo o en ir en equipo. Puede haber 2v2, 1v3 o 8v1… yo creo que tú podrías identificar esto fácilmente.. es simplemente entender las llaves»* (28/09, 4:40 PM) | ✅ el #367 quedó cargado. Probado con un 8v1: el lado de 8 se perdía y rompía la llave entera; arreglado en los dos lectores (`escuchar.DELIMS` y `nombres_de_linea()`), con el caso en el contrato |
| **La web se rehace más adelante, con Dlx y con connectors** | *«después de que termines esto planeo REMAKE el website contigo y con unos connectors»* (28/09) | ⏳ cuando Dlx lo abra; hasta entonces, sólo arreglos y pedidos puntuales |
| **MARRUECOS lo resuelve Dlx en ✅ Decidir**, y la hoja tiene que ser más clara y más linda | *«Lo resuelvo yo… pero mejora esa página de decidir incluso más… hazla. Más mejor y bonita»* (28/09) | ✅ **«¿quién ganó esta batalla?»** y la hoja rehecha (ver abajo) |
| **El Clásico cuenta EVENTOS, no batallas** | lo decidí yo: en la Snake Arena, DELUXE y FAZER se cruzaron **5 veces** en una noche, así que la 3.ª ya era «Clásico» y los dos cobraban +10 % | ✅ `multiplicadores.clasicos()` y `rivalidades()` (1.36). Las 4 parejas que ya eran rivales lo siguen siendo: cada una se cruzó en 2 eventos |
| **ISLA DE SOCOTRA V.2 se borra: fue un evento falso que nunca salió** | *«you can delete it bc its a fake event that never got released»* (28/09, 10:40 PM) | ✅ `anuncios_fuera` en `datos/decisiones.json`: `anuncios.guardar()` no lo vuelve a traer (1.47) |
| **Snow no es de Follombia** | *«X cierto SNOW no es parte de follombia me comentó»* (28/09) | ✅ fuera de `datos/crews.json`, con la baja en `_bajas` (1.47) |
| **FFS League es de la Liga**: sus eventos suman como los de los otros cuatro | *«A · sí, como los otros cuatro»* (28/09, 11:22 PM) | ✅ (1.48): `confirmado` en `datos/servidores.json` y las ocho listas de servidores |
| **FFS va en periwinkle claro #8E9BFF** (su logo es el lavanda de DRA) | *«A · periwinkle claro #8E9BFF»* | ✅ `datos/colores_sv_marca.json` |
| **La etiqueta de FFS es EVOLUCIÓN** | *«Pon EVOLUCION para FFS como el tag»* (29/09, 12:15 AM) | ✅ `datos/servidores.json` (con tilde, como NUEVA GENERACIÓN) |
| **Las ligas regionales de FFS van más adelante al Ranking de Ligas**: hoy no se leen | *«A · más adelante, al ranking de ligas»* | ✅ `categorias_fuera` en `datos/servidores.json`: ni llaves, ni veredictos, ni anuncios, ni la campana |
| **La camiseta de FFS**: añil violeta, galón de ascenso en periwinkle y tela | *«oh wow está bueno»* (29/09, 12:05 AM) | ✅ `03_Servidor/disenos/los_nueve.py` |
| **Una llave de alguien que nunca publicó una, y sin anuncio, espera en ✅ Decidir** | *«A · sí»* | ✅ `llave_de_broma()` en `bot/llaves_a_entrada.py`, desde el 29/09 00:00 ET |
| **El podio con mención resuelve el nombre solo, como una inscripción** | *«A · sí, como las inscripciones»* | ✅ `podio_de_grupo()` + `decidir._cuenta_de()` |
| **✅ Decidir: el evento entero en una fila** («Todos son gente nueva») | *«va»* | ✅ `bloques()` y `repartir()` en `sheet/decidir.py` |
| **«¿Algo está mal en esta llave?»**: la gente lo avisa y va a ✅ Decidir, nunca por DM | *«ok»* | ✅ `/avisos/reportar` + `bot/reportes.py` |
| **El ensayo del arranque**, sin la fecha escrita: *«probablemente se extienda por la apelación»* | *«dale»* | ✅ `herramientas/ensayo_arranque.py` |
| **La primera semana de la T1 va sin Elegido votado** | *«1, B»* (29/09, 12:35 AM) | ✅ nada que construir |
| **RAP EXHIBITION 1/8 se jugó con nombres de personaje** (ANTORCHA OLÍMPICA = Six) | *«2. correcto»* | en ✅ Decidir, ese evento no va con «Todos son gente nueva» |
| **La llave en vivo dice el aka principal**: PARK JI SUNG es Oasis, MAKMA es Makmah, PRR es Hassan | *«porq en la llave sigue diciendo park ji sung? deberia mostrarse el aka principal q es oasis.. lo mismo con Makma que no carga su perfil.. PRR»* | ✅ `alias` del lobby (`subir_web._alias()`) + `kDe()` en `app.js` (1.49) |
| **Un equipo con nombre no es un participante, ni una crew**: «TEAM VENECIA» son dos personas de ese evento. Se reconocen sus integrantes; si no se puede, no cobra nadie | *«deberia reconocer los integrantes del equipo si es q no se puede ya fue pero team venecia no es un participante.. es un equipo.. no una crew ojo.. solo un equipo creado x este evento»* | ✅ `llaves_a_entrada.marcar_equipos()` + `motor.nadie` (1.49) |
| **Una invitación permanente de la Liga por servidor**, para contar cuántos entran por ella | *«si puedes crea una invitacion permanente para cada servidor, y de esta manera podemos reconocer cuantas personas se unieron por ti la liga global»* | ✅ `bot/invitaciones.py` (1.49); la cuenta, en el paso 2b5 → `datos/invitaciones.json` |
| **Las redes de FFS**, de su canal de redes | *«agrega las redes de FFS... mas info esta en el canal de redes en FFS»* | ✅ Instagram y YouTube en `datos/servidores.json` |
| **CYPHER, NAVE DE FUNA o aniquilación**: se rapean rondas de beats y al final de cada una **sale el nombre con más reacciones en Discord**; así hasta que el formato diga —a veces el evento entero, lo usual hasta que quedan 4 y ahí semis normales— | *«el nombre que tiene mas reacciones en discord, es eliminado. Asi asi hasta que el formato lo elija»* · con tres llaves de ejemplo: *«lo que sigue está a disposición del organizador»* (29/09) | ✅ (1.50): `escuchar.funa_de()`, `llaves_a_entrada.filas_funa()` y el pozo del motor. **Los que caen en la fase empatan** —la llave no dice el orden— y se reparten lo que valen juntos sus lugares (§10.1); con el puesto del último lugar, para no regalar semifinales |
| **ME TIENE SIN CUIDADO (VOL.13) eran Paria y Kravitz** | *«2. A»* | ✅ `equipos` en `datos/decisiones.json`: cobran el subcampeonato, 3.750 cada uno |
| **El «#» del apodo es sólo de quien está en el Competitivo, en toda la Liga** | *«los que tienen el # … el nombre automáticamente debería cambiar … ÚNICAMENTE a las personas que están en el competitivo… esto en toda la liga»* | ✅ (1.50): `herramientas/sincronizar_puesto.py`, paso 2b6 del ciclo, y `/numeral` |
| **Las inscripciones se miran constantemente** mientras hay un evento: los organizadores limpian el canal | *«cuando anuncian un evento, tienes que estar chequeando las inscripciones constantemente»* | ✅ (1.50): el vigía las lee cada minuto y las guarda 3 días (`inscripciones()` en `bot/avisos.js`); el ciclo las suma (`anuncios.del_vigia()`) |
| **Si ya hay un link permanente de FFS creado por mí, va ése** | *«si ya creaste un link de ffs por tu propia cuenta usa ese»* | ✅ `discord.gg/whrjpJUfuz` (el que pasó Dlx vence el 29/10) |
| **La sección de llaves tiene que mejorar bastante** | *«Como te dije la seccion de llaves de eventos tiene que mejorar bastante»* | ⏳ con el remake de la web |
| **El anuncio y su llave pueden decir distinto número y ser el mismo evento** (TOKYO VOL 17 se anunció «VOL 17 1VS1» y su llave dice «VOL 16»): se juntan por la serie, el horario y la forma; nunca por el número solo, y con dos posibles no se elige | *«aquí se equivocaron en el anuncio. Pusieron 17 cuando era 16… A veces pasa esto que el anuncio y el título de la llave no tienen sentido pero son del mismo… asegúrate de tener cuidado con ello»* (29/09, 4:30 AM) | ✅ `llaves_web._huerfanas()` (1.51) |
| **La NAVE DE FUNA cuenta** | *«1. A»* (29/09, 4 AM) | ✅ ya estaba (1.50) |
| **La llamada se mira sólo con un evento en vivo**, una foto y sin quedarse conectado | *«Si pero fíjate muy bien para no gastar recursos y solo cuando en vivo seria rentable»* | ✅ `bot/en_llamada.py` (paso 1b2), a KV `voz:<SV>`; la pista, en ✅ Decidir (`_en_llamada()`) |
| **La cuenta de las invitaciones no se muestra en ningún lado** | *«3. ninguno. no hagas nada de ahí»* | ✅ nada que hacer: sigue guardándose sola en `datos/invitaciones.json` |
| **IDs y apodos de la gente no van al repo público, tampoco en el historial**; antes de reescribirlo, respaldo | *«4. A y haz el back up xq los akas son importantes»* | ✅ respaldo fuera del repo y **el historial limpio en GitHub desde las 5:43 AM**. GitHub todavía sirve los commits viejos a quien tenga su código exacto (ver ❓) |
| **Los 8 IDs de la T1**: Eze, Noone, TG, Carlos, Santi, Ardean, Kenny y Fleivacheck | *«5. A»* | ✅ la Lista (4 en su fila, 4 filas nuevas) |
| **Pollo Sport = Polosport, Lord = Lord Viruzz, Adachi = Nobu, Sábado = Guess** | *«6. A»* | ✅ `datos/akas_a_mano.json`; el «no confundir» Lord/Lord Viruzz, fuera |
| **Denik es dnk.x** (su ID estaba en la fila de fleivaman) | *«7. A»* | ✅ la Lista, con nota y respaldo |
| **Crack and Krank queda como está** | *«8. No lo sé la verdad»* | ✅ nada que hacer |
| **La llamada resuelve sola** cuando el nombre raro de la llave es **exactamente** el de una sola persona que estaba en la llamada mientras se jugaba y esa persona ya está en la Lista: alias, aunque ese nombre sea de varias cuentas. Si no está en la Lista, la llamada no da de alta a nadie | *«1. A»* (29/09, 6:15 AM) | ✅ `decidir._cuenta_de()`, fuente «llamada» |
| **Los commits viejos no se le piden borrar a GitHub**: quedan sueltos hasta su limpieza | *«2. B»* | ✅ nada que hacer |
| **Para el remake no se usa Penpot**; se conectan todos los demás de la guía, más las Extensiones de la app y los conectores de claude.ai, aunque lleve más tiempo | *«no, no usaremos PENPOT»* · *«si toma más tiempo está bien»* (29/09, 6:10 AM) | ⏳ Dlx corre los pasos; yo verifico cada uno |
| **El remake va con React (o un framework)**: el estilo de la Liga es la razón principal del remake, y no se quiere que la página se parezca a «copero» | *«el estilo de la liga es la razón principal por la cual quiero hacer el remake… usaremos react o framework»* (29/09, 7:20 AM) | ⏳ propuesta: Vite + React + Tailwind exportado a estáticos en Pages (sin SSR: el Worker tiene 10 ms) |
| **Un mapa de la Liga y un mapa del código, los dos**: el del sistema (artifact privado: dónde corre cada pieza, cada cuánto y cuánto del plan gratis gasta) y Serena para navegar el código por símbolos, **sólo lectura** | *«Creo que las 2 no?»* (29/09, 7:23 AM) | ✅ el artifact «El mapa de la Liga» y Serena en Claude Code, fuera del repo |
| **El sync reintenta el 429 igual que el ciclo**: espera 5, 15, 30, 60 y 90 s, y cubre también el abrir la planilla, que era lo que quedaba afuera | *«A»* (29/09, 8:06 AM) | ✅ `liga-global-sync` 5c391bd (`ClienteConEspera`), con su autotest |
| **El mapa, explorable y en vivo**: como el grafo del reel (arrastrar, zoom, abrir cada pieza en sus partes) y con el estado de cada pieza ahora, **sólo para Dlx** | *«1. C»* (29/09, 8:29 AM) | ✅ `bot/paginas/mapa.html` en vivo; el artifact, una foto con los mismos archivos |
| **The Cosmic Rap: el bot está ahí sólo para reconocer IDs** | *«agregué el bot a the cosmic rap pero solo usa eso para reconocimiento de IDs nada más»* (8:29 AM) | ✅ `datos/servidores.json` → `solo_identidad`, como LIVONIA y CONFED |
| **El remake se planea juntos antes de arrancar**: aviso antes de tocar la página nueva | *«cuando vayas a hacer el rework de la página me avisas para antes planearlo»* (9 AM) | ⏳ aviso antes |
| **El remake no toca las cartas**: la web es la pared y las cartas son los afiches pegados | *«A»* (29/09, 11:30 AM) | 📌 regla del remake |
| **La foto queda como hoy**: la web nueva trae «ocultar mi foto» en ajustes, y nada más | *«podemos añadir la opción en ajustes… somos algo muy amateur todavía»* (11:30 AM) | 📌 va con el remake |
| **Primero el remake, después lo nuevo** | *«después del remake haríamos el pase, la tienda… y otras cosas»* (11:55 AM) | 📌 orden |
| **Under Legends es la marca; la Liga Global es de DRA**: UL es como Red Bull y la Liga Global como Red Bull Batalla. DRA y FFA están dentro de UL; DRA patrocina la Liga Global. La web es la de Under Legends | *«UNDER LEGENDS es la marca… DRA es lo que es la liga global»*, *«Red Bull = Under Legends · DRA o LIGA GLOBAL = Red Bull Batalla»* (1 PM) | 📌 las subdivisiones se revisan después |
| **El estilo del remake sale de los colores de UL**: negro, verde agua y magenta del logo, callejero minimalista («Calle», `docs/remake/direcciones/calle.md`); los cuatro estilos anteriores no convencieron | *«usar los colores de UNDER LEGENDS, así como RED BULL usa sus colores para todos»*; Drako: *«estilo callejero minimalista»* (1 PM) | 📌 va con el remake |
| **Tema claro y de noche, a elección en Ajustes** | *«una opción en ajustes de mi tema»* (2 PM) | 📌 va con el remake |
| **El remake cambia la estructura, no sólo el estilo**: el Inicio es «la escena» (`docs/remake/portada.py`) con los servidores y la gente que seguís o te sigue arriba; Publicaciones es el feed; tu perfil es «Tu liga», sin las noticias de la escena (`docs/remake/sitio.py`) | *«que INICIO sea la escena completa pero que tenga los servidores arriba… el feed como está que sea publicaciones… tu liga podría ser tu perfil»* (2:20 PM) | 📌 va con el remake |
| **Eventos es el tablero, mezclado con la página de hoy**: la llave en cuadro, el mes con sus fechas, la campana y los últimos campeones | *«sí, pero con una mezcla del actual, que podamos ver las llaves y eso»* (2:37 PM) | 📌 va con el remake |
| **En tu perfil elegís qué carta ven los demás** («Tus cartas») | *«en mi perfil, que te deje seleccionar la carta»* (2:37 PM) | 📌 va con el remake |
| **Las páginas de cada país y de cada crew, más adelante** | *«también podría ver cuentas de los países y crews… pero vamos poco a poco»* (2:37 PM) | ⏳ después |
| **Arriba dice «Discord Rap En Español / Liga Global · T1»**: es el nombre de DRA; Under Legends queda en el logo y en el pie | *«ahí arriba pon Discord Rap En Español / Liga Global - T1»* (2:42 PM) | 📌 va con el remake |
| **El Inicio suma la Tienda (los Puntos de Tienda) y la Mercancía** | *«pon la sección de tienda puntos, y otra de mercancía»* (2:42 PM) | 📌 va con el remake; sin prendas: *«aún no hay mercancía»* (3:11 PM) |
| **La cabecera va en negro**: sólo la barra de arriba; la fila de servidores sigue con el fondo de la página | *«que la cabecera, la parte de arriba, esté en negro… sólo la de arriba, no la de los servidores… para ver cómo queda»* (3:09 PM) | 📌 va con el remake (*«sí»*, 4 PM) |
| **Las maquetas del remake usan los datos y las tarjetas de verdad**: `docs/remake/reales.py` lee lo mismo que la web (`/api/lobby` y `/api/muro`); las tarjetas y las caras se bajan aparte y no entran al repo | *«usa información real y tarjetas reales para ver más precisamente»* (3:09 PM) | 📌 regla del remake |
| **Sin la franja de la fase de prueba** arriba | *«quita la zona celeste, o sea de la fase de prueba»* (4 PM) | 📌 va con el remake |
| **Los círculos de arriba se abren como historias de Instagram**: lo último de cada servidor; el en vivo va aparte, y se suman las crews | *«cuando se clickea… que te lleve a como una historia donde pasó lo último de cada servidor… agrega crews también… separa el en vivo»* (4 PM) | 📌 va con el remake |
| **Los cruces van en un cuadro compacto**, con líneas y el camino del campeón iluminado; en vivo se marca el cruce de ahora | *«eso de cruces de cuartos tendrías que hacerlo de una manera mejor»* (4 PM) | 📌 va con el remake |
| **Todo compacto, sin huecos**, y **Se busca en una tira que se desliza** (con 12 por semana) | *«make everything compact… weekly it’ll be 12 personas and people can scroll»* (4 PM) | 📌 va con el remake |
| **El campeón sin carta se muestra igual**, con su cara y «SIN CARTA» | *«lo mostramos»* (4 PM) | 📌 va con el remake |
| **La computadora manda: el celular es la misma página**, con el mismo orden y las mismas piezas, sólo apiladas; «Esta semana» es una tabla por servidor igual en las dos | *«que sea el mismo en el celular que la computadora… que la computadora sea la prioridad»* (4:13 PM) | 📌 regla del remake |
| **Arriba siempre hay algo**: el escenario es un carrusel de momentos, en orden: el en vivo (si hay), el próximo evento con su cuenta atrás, la llave de anoche, el último video, el último anuncio de la Liga y lo de los que seguís | *«si no hay ningún en vivo… el mismo fondo pero con otras cosas… siempre tenemos que tener algo así»* (4:30 PM) | 📌 va con el remake |
| **Flechas con estilo a los costados del escenario**: cuadrados blancos con la sombra dura en verde (izquierda) y magenta (derecha), como la barra de arriba | *«con una flecha para ir al siguiente y regresar en los costados, pero que tengan estilo»* (4:46 PM) | 📌 va con el remake |
| **«Esta semana» cambia de formato**: la tabla se lee como una planilla. Tres opciones: **Versus** (las dos guerras como carteles de batalla), **Fichas** (una tarjeta por servidor) o **Tira** (una línea tipo marcador debajo del en vivo) | *«quizás el problema es el formato en el cual está esta semana… ese panel»* (6 PM) · *«me gusta 3»* (7 PM) | 📌 va con el remake: **la Tira**, pegada debajo del en vivo. La meta y la guerra pasan a «Lunes de la Liga» |
| **IR A deja de estar arriba**: aparece como barra negra pegada arriba cuando bajás; en el celular es un selector | *«tendríamos que mover esa línea de opciones blanca… su formato en sí o su posición»* (7 PM) | 📌 va con el remake |
| **En el celular entra todo**: la Tira en grilla de cuatro, las pestañas del escenario en dos filas, y Los que mandan y el panel con un paginador (‹ selector ›). Las tiras de cartas y afiches siguen deslizándose | *«en la versión de celular intenta hacer que todo quepa»* (7 PM) | 📌 va con el remake |
| **El Inicio nuevo sale ya y reemplaza al de hoy**, en React y con los datos en vivo; el resto de la página se cambia por partes. Deja sin efecto el *«1. A»* de las 12:05 PM (el cambio iba de una vez) | *«1. B. 2. B»* (29/09, 7:30 PM) | ✅ **es el Inicio desde las 9:20 PM** (1.53). Estuvo en `/nuevo` desde las 8:45 PM y Dlx lo aprobó: *«1. Sí»* (9:05 PM). Cómo está armado: `CLAUDE.md`, «El Inicio nuevo» |
| **Misiones y Pase, como «Próximamente»** en la versión pública: sin números de ejemplo | *«3. sí»* (7:30 PM) | ✅ en el Inicio (1.53) |
| **El anuncio del remake**: en FFA (novedades), en UL (ranking global) y en las novedades de la página. Dlx ve el texto final antes de que salga | *«4. en FFA novedades y UL en ranking global y agrégalo en novedades de la Liga Global»* (7:30 PM) · el texto: *«2. Sí»* (9:06 PM) | ✅ en el changelog (1.53) · ✅ **en Discord a las 10:19 PM, con @here al principio y el formato del anuncio de la 1.02** (Dlx: *«anuncia el anuncio con here»*): FFA «✦⚡︱novedades» (mensaje `1554678980706177095`) y DRA «〢🌍〉rankings-liga-global» (`1554678996992790528`). Los de las 9:49 PM, sin @here (`1554671591017947228` y `1554671601218486373`), los borra Dlx: borrar mensajes no lo hago yo |
| **RIZAS y PRAISERIZA son la misma persona**: la inscripción de la llave #371 la hizo la cuenta de PRAISERIZA, y en la llave figura RIZAS | *«sí, son la misma persona»* (9:05 PM) | ✅ el par está en `datos/akas_a_mano.json` y **se aplicó en la corrida de las 9:52 PM**: en los dos pools y en las llaves ya es PRAISERIZA. El registro crudo de duelos (`rivales.json`) sigue diciendo RIZAS, pero se lee con `rankings.canon()` |
| **La llave del escenario, más linda**: la cara de cada uno, el ganador en blanco, el camino del campeón en verde, el perdedor apagado sin tachar y el campeón con su sello. En el celular y hasta 1100 px, semis y final: con los cuartos el campeón quedaba afuera | *«estas llaves hay que hacerlas más bonitas»* (30/09, 8 AM) | ✅ 1.54 |
| **Las flechas no se quedan «apretadas» en el celular**: el `:hover` se pegaba después de tocar; ahora sólo existe con mouse | *«se mantienen a veces apretados»* | ✅ 1.54 |
| **El dorado, en rosa** (`#F07DB2`, el magenta aclarado) en todos lados donde marca el evento dorado. En la Tira, además, ya no tapa «Lunes de la Liga» y dice «se jugó» cuando ya pasó | *«eso que está en dorado, ¿puedes hacer que esté en rosadito?»* | ✅ 1.54 |
| **Encuestas, arriba de Misiones**: el ×2 y El Elegido juntos, en filas con su barra. Salen de la Tira y de Se busca; mientras estén abiertas, también en Lo último | *«quién se lleva el ×2… se ve algo feo… ¿por qué no lo ponemos en lo último?»* · *«el elegido… ocupa espacio y no se ve tan bonito»* · *«¿qué tal si arriba de misiones ponemos encuestas?»* | ✅ 1.54 |
| **Las historias son lo tuyo**: los servidores, tu país, tu crew y la gente que seguís (con su carta si no hizo nada nuevo); sin nadie, «Seguí a alguien». Quien no tiene foto va con la inicial sobre su bandera | *«no hay necesidad de seguir a todos… tu país, tu crew si estás en una y las personas que tú sigues… si no sigues a nadie, seguir a alguien»* · *«hay personas sin avatares»* | ✅ 1.54 |
| **Tus eventos son los tuyos**: los que jugaste, con tu puesto y tus puntos; sin entrar, cómo verlos | *«tus últimos eventos son raros porque dice que son los últimos eventos»* | ✅ 1.54 |
| **Sin Tienda en el Inicio: va el Merchandising** (próximamente). **Y sin la lista de servidores de abajo**: ya están arriba | *«la TIENDA no debería estar ahí, debería estar merchandising»* · *«los servidores de la liga estando abajo es algo tonto porque ya están arriba»* | ✅ 1.54 |
| **El dorado, en EL rosa de la Liga** (el magenta de la marca, con texto blanco): el de la mañana era un rosa claro | *«el rosado me refiero al rosa de la liga»* (30/09, 9:30 AM) | ✅ 1.55 |
| **Las flechas del escenario, a los costados de la pantalla** en la computadora (32 px del borde; pegadas al contenido quedaban a 300 px en 1857) | *«¿esas flechas podrían moverse más a los costados en la vista de ordenador?»* | ✅ 1.55 |
| **Tu cuenta de Discord arriba**, con tu cara: el chip en la computadora y un círculo al lado de la campana en el celular. Salía «Entrar» a quien entró con Discord y no es rapero (`lg:dc` sin `clave`) | *«arriba debería estar la opción y el círculo de mi cuenta conectada con discord»* | ✅ 1.55 |
| **El lugar de las encuestas lleva Tus eventos**: con encuestas abiertas, las dos con flechas (primero las encuestas); sin ninguna, Tus eventos solo. **Abajo, sólo las Misiones.** **La Liga en números, debajo del Merchandising** | *«creo que ahí debería ir tus eventos si es que las encuestas ya no están, y dejar abajo solo las misiones»* · *«debajo de merchandising en blanco deberían estar las estadísticas»* | ✅ 1.55 |
| **Las historias con flechas, y el círculo de arriba lleva a su perfil** (persona, país, crew; los servidores, a Mundo) | *«en el modo historias poner las flechitas también y cuando alguien clickea el perfil de arriba se va al perfil de este»* | ✅ 1.55 |
| **En la computadora grande, todo más grande**: `zoom` en `.app` (×1,1 desde 1440 px, ×1,2 desde 1680, ×1,35 desde 2200), con el margen de los costados en % para que no se desborde. En 1857 el contenido pasa de 1200 a 1440 px | *«mira el tipo de fuente de letra»* → a la pregunta: *«C»* (en la computadora todo se ve chico) | ✅ 1.56 |
| **El escenario y «Esta semana», un solo panel**: la Tira adentro, sin la línea, y los círculos del fondo ya no se cortan | *«quita esa línea… hazla como si estuviese dentro de ese panel… el círculo celestito no estaría cortado»* | ✅ 1.56 |
| **Cada momento con los colores de su servidor**: fondo negro, el círculo grande en el color acordado y su logo de hoy abajo. La primera versión teñía el fondo entero y el naranja de SR oscurecido quedaba marrón | *«que haya diferentes fondos»* · *«usa los colores de los servidores que habíamos acordado»* · *«¿por qué el fondo es marrón o naranja?»* | ✅ 1.56 |
| **Pasa solo cada 15 segundos**, contados desde el último cambio, y ya no se frena con el mouse encima | *«que se vaya a la siguiente automáticamente después de 15 segundos»* | ✅ 1.56 |
| **Los logos de hoy de cada servidor**: el payload ya traía el ícono actual de Discord (`svs[].logo`) y el Inicio usaba el archivo guardado. URBF tiene logo nuevo y SR usa hoy la cobra dorada (el color sigue siendo el naranja acordado) | *«usa los LOGOS actuales de cada servidor»* | ✅ 1.56 |
| **La Liga en números, pareja**: los récords ocupaban dos filas por un choque de nombres (`.rec` era una pastilla del prototipo con `grid-row:span 2`) | *«hay algo que nunca me ha gustado… está disparejo»* | ✅ 1.56 |
| **Misiones arriba y Encuestas + Tus eventos abajo** (antes de Se busca); **si ya votaste en todas las abiertas, el panel abre en Tus eventos** y las encuestas quedan de segunda página. El orden se decide al abrir la página, no al votar | *«intercambia la posición entre encuesta todo eso y misiones… que encuesta sea la segunda página de ese panel si ya votaste»* (30/09, 11:45 AM) | ✅ 1.57 |
| **Cada servidor con su perfil** (`#/sv/<SIGLA>`): su gente, sus eventos, lo último, a quién buscan, su semana, sus redes y la invitación. Lo dibuja el Inicio nuevo (app.js no conoce la ruta) y se abre desde las historias, «Esta semana» y la lista de los otros servidores | *«acuérdate cada servidor, crew y país tendrían su propio perfil»* · *«me gustan todas»* (E) | ✅ 1.58 |
| **A · tu puesto debajo del top 5** en cada categoría de Los que mandan, con cuánto te falta para el de arriba (tu país y tu crew también); sin haber entrado, la invitación | *«me gustan todas»* (30/09, 12:10 PM) | ✅ 1.58 |
| **B · lo tuyo primero en el escenario**: «hoy te buscan» y tu último evento de los últimos dos días. «Jugás esta noche» espera a que el payload traiga las inscripciones | *«me gustan todas»* | ✅ 1.58 |
| **C · las historias vistas quedan vistas** (`lg:historias`, con la firma de lo más nuevo de cada una) | *«me gustan todas»* | ✅ 1.58 |
| **D · compartir** la llave, tu carta (la imagen de R2) y las historias: el menú del teléfono o, en la compu, el link copiado | *«me gustan todas»* | ✅ 1.58 |
| **Los perfiles de país y de crew con el estilo nuevo**, como el de servidor | *«sí, eso haremos con el remake a todo. Espera, poco a poco»* (01/10) | 📌 va con el remake, de a una |
| **Instalar la página como app en Android**: un botón en el Inicio cuando el teléfono lo permite | *«Ok…»* (01/10) | ✅ 1.60 · y en el iPhone, cómo se hace a mano (ahí instalarla es lo que habilita los avisos) |
| **El tema por defecto es el normal** (claro): no sigue al del celular | *«por default el normal»* (01/10) | ✅ ya era así |
| **El buscador de arriba encuentra también servidores, países y crews** | *«sí»* (01/10) | ✅ 1.60 · y en el celular vive en el menú ☰, porque arriba no entra |
| **Las llaves guardan la clave de cada persona**, no sólo el nombre: es lo único que separa a los que se llaman igual | *«diría que sí, si eso te facilita las cosas»* (01/10) | ✅ 1.60 · sólo en las filas cuyo nombre se repite (`_quien()` en `bot/subir_web.py`) |
| **«Tu próximo evento»** en el escenario: a quien todavía no tiene letra, el próximo de su servidor en 36 h, con cuánto le falta | *«explícate más»* → *«me gusta tu idea»* (01/10) | ✅ 1.60, como se describió: a todos los que no tienen letra (1 a 9 eventos) |
| **Las secciones que siguen: Mi perfil, Mi cuenta, Ajustes y el changelog** — primero el changelog | *«trabajemos en otras secciones… mi perfil o mi cuenta o ajustes o changelog»* → *«1. A»* (01/10) | ✅ el changelog (1.61) |
| **Mi cuenta y Ajustes, como los ajustes de Discord** — y **primero en previews**, como el Inicio | *«a mí me gusta como lo tiene Discord ahí puesto»* · *«espérate, primero genera PREVIEWS de cómo sería, así mismo como lo que hicimos con INICIO»* (01/10) · *«1. Pero ya lo habíamos hecho, ¿no?… 2. El engranaje en vez de la cuenta. En el celular. En la PC, que esté arriba, por supuesto. 3. Sí, ajustes y cuenta separados, y me gusta cómo lo propusiste»* (02/10) | ✅ 1.79: Ajustes y Verificarme ya estaban en línea; **Mi cuenta entera sale el 02/10** (`#/cuenta`, `web/src/cuenta.jsx`): tu tarjeta arriba y cuatro partes —Mi cuenta, Mi perfil (la foto, tus redes, tu servidor), Siguiendo (y quién te sigue), Privacidad—. **Lo que hace cada botón lo sigue haciendo app.js** (`cuentaFotoSi()`, `cuentaRedes()`, `cuentaServidor()`, `cuentaSalir()`…): la página se entera de cada cambio porque App.jsx envuelve `pintaPopCuenta()`. La vuelta de Discord (entrar, la foto, las redes) va a Mi cuenta y no a la ventana, que queda **de respaldo** si la página nueva no se monta. «Ocultar mi foto» **no está**: un interruptor que no hace nada miente (ver abajo) |
| **En el celular, tu cuenta aparece dos veces** (el círculo de arriba y «Yo» abajo) | *«lo veo algo inútil… aparece arriba y abajo… me gustan ambas, pero es algo tonto»* (01/10) | ~~queda el círculo de arriba (*«B»*)…~~ **Cambió el 02/10** (*«el engranaje en vez de la cuenta. En el celular»*): ✅ 1.79, arriba en el celular **campana, ⚙ y ☰**, y tu cuenta **abajo como «Yo»**, con tu cara (Tarjetas sigue en el ☰). En la compu, el ⚙ arriba al lado de la campana y tu cuenta. ⚠️ Ranking, Eventos y las demás vistas viejas tienen su propio marco: ahí el botón «Mi cuenta» de arriba lleva a la página nueva |
| **«Ocultar mi foto» en ajustes** | *«la foto queda como hoy, con ocultar mi foto en ajustes»* (29/09, decisiones del remake) · *«1. A»* (02/10: hacerlo ya) | ✅ 1.80: en Mi cuenta → Privacidad. **Tu inicial en la página y en tus tarjetas** —también las de Discord: la página muestra las tarjetas, y ocultarla sólo en los círculos no servía (decisión mía; si preferís que las tarjetas la conserven, es un cambio chico)—. Lo guarda el vigía con tu Discord (`miFoto()`, tabla `foto_oculta`) y lo copia a KV (`fotos:ocultas`); el ciclo lo lee antes de sellar y dibujar (`fotos.ocultas()`): la cara entra al sello como «oculta», `comun/respaldo` no da foto y el payload va sin avatar. **No va al repo ni al payload**: la copia vive en el espejo, que está gitignoreado. Se aplica en la próxima vuelta del ciclo |
| **«Ocultar mi foto» también en las tarjetas de Discord** | *«haz lo que tú veas mejor»* (02/10) | ✅ queda como está (1.80): de todo, página y tarjetas |
| **Gente sin cara en las historias y en «lo último»** | *«hay algunas personas que no tienen su tarjeta aún, ejemplo en las historias o en lo último»* · *«o sea, sin los avatares»* (02/10) | ✅ 1.81. Medido sobre las 219 que jugaron: **85 sin cara**. 51 no tienen Discord ID en la Lista (no se puede saber quiénes son), 19 quedaban fuera de la tabla (corta en 200), 8 tenían su cara sólo en Snake Rap o Urban (la página miraba DRA y FFA), 5 no tienen foto en Discord y 2 no están en ningún servidor del bot. **Ahora**: a quien jugó y no aparece en DRA ni FFA se le pide la cara a Discord de a uno (`GET /users/{id}`, 10 de 12), y los de fuera de la tabla viajan aparte por nombre (`avs`, ~45 bytes cada uno; `avNombre()` en `web/src/liga.js`). **De 134 a 154 con cara.** Los 51 sin Discord ID son el resto: salen solos a medida que el bot los identifica |
| **En la compu, tu cuenta sólo arriba**: la barra de abajo salía también ahí desde la mañana del 02/10, con «Yo» abajo además de la cuenta arriba | *«en ordenador la cuenta solo esté arriba, no abajo»* (02/10, 11 AM, con una captura) | ✅ 1.82: el `display:flex` de la tira (`vivo.css`) venía **después** del `display:none` de la compu y lo pisaba, con el mismo peso. Probado a seis anchos: desde 900 px no hay barra. Se me pasó porque la tira la probé sólo en el celular |
| **Los títulos del escenario no parten palabras** (salía «GENERACION / ES UN DESTINO») | la misma captura | ✅ 1.82: la palabra más larga manda el tamaño (`Tit` en `arriba.jsx`, `.ev-pal` en `vivo.css`, con unidades del ancho de la columna). Medido a nueve anchos: ninguna palabra partida, salvo «ACTUALIZACIÓN» justo a 900 px, que no entra ni a 20 px |
| **Reconocer a la gente en las llaves en vivo, por las tres vías**: las inscripciones del canal de inscritos, quién está en la llamada y los veredictos, y también cuando ponen nombres troll | *«esto es lo más difícil de este sistema, reconocer a las personas… necesitaré que te tomes tu tiempo al hacer esto»* (02/10, 11 AM) | 🔨 en curso. ✅ **1.83, la primera parte: la misma persona con otro nombre.** En la DOS GENERACIONES VOL 2 (FFA, 01/10) Oasis jugó octavos como «Park-Ji Sung🇰🇷» y cuartos como «Oasis🇨🇱»: el lector no los unía, así que su octavo se fue a ✅ Decidir (**DXG y tito calderon sin sus octavos**) y Oasis salió «Walk-in 1» — **el campeón cobró 5.000 y no 10.000**. El dato estaba dos veces: la hoja AKAs y la inscripción, que escribió su cuenta. Ahora `llaves_a_entrada.personas()` dice de quién es cada nombre (la Lista, los AKAs, la inscripción de la propia cuenta en ese servidor, la mención) y `escuchar.resolver(quien=)` y `marcar_walkins(quien=)` lo usan; en vivo, `LlaveVivo.aLlave(b, quien)` con `quienVivo()` de app.js. Medido con `comparar_lector.py` sobre las 467 filas que Discord muestra: **cambia sólo esa llave** (entran los dos octavos, se va el walk-in, una pregunta de ✅ Decidir se contesta sola). ✅ **1.84, en vivo cada minuto**: el vigía (`quienes()` en `bot/avisos.js`) cruza los nombres de las llaves en vivo con la **inscripción** de la propia cuenta (un solo nombre, nunca la de quien anota a otros), la **llamada** (`voz:<SV>`, lo visto en las últimas 6 h) y la **mención** (ahora se guarda de quién es cada `@apodo`: columna `men` de `vivo`); un nombre de una sola cuenta → su perfil por `d:`/`dn:` (las claves de `/card`, guardadas 6 h en `idk`, 30 pedidos por minuto como mucho). Va a `/avisos/vivo` como `quien` —**nombre → perfil, nunca el ID**— y la página lo usa en `kDe()` (`kVivo()`), en `liga.fila()` del Inicio nuevo y para unir las rondas (`quienVivo()`). Probado en la página con una llave armada: «ANTORCHA OLÍMPICA» (sólo reconocible por la llamada) sale como Six, pasa de su octavo y su cuartos queda enlazado. Pruebas en `bot/avisos_prueba.mjs`. ✅ **1.85, los veredictos**: medido el 02/10, en #veredictos **las menciones son de jurados y organizadores, no de los que pelean** —no sirven para saber quién es quién—, pero **dicen quién ganó**: el título `A vs B` y abajo el ganador. `escuchar.batallas_veredicto()` arma cada batalla con su ganador (mayoría; empate o «RÉPLICA», de nadie), se guardan 7 días en `datos/veredictos.json` (`batallas`), y `llaves_a_entrada.filas_de()` las usa cuando la llave no dice quién ganó (`escuchar.ganador_por_veredicto()`: los dos lados, el mismo servidor, a menos de 12 h). **POESÍA CRUDA (URBF, 01/10) no tenía la línea del campeón**: sin campeón el evento entero no sumaba; en #veredictos estaba «PICHULAMC vs Riferian» → «PICHULAMC X MÍNIMA». `comparar_lector.py` sobre 470 filas: entra sólo esa final, y su pregunta se contesta sola. Medido después del ciclo de las 11:52 que la 1.83 se aplicó: **Oasis 10.000** (era 5.000), **DXG y tito calderon 1.250** cada uno. ✅ **1.86, el dibujo**: la llave guardada trae también las batallas que esperan en ✅ Decidir, con su gente y la nota `sin ganador: espera en ✅ Decidir` (`llaves_web.armar()` lee `datos/batallas_sin_ganador.json`); el cuadro del Inicio, en una llave terminada, dice «SIN GANADOR» (gris, punteado) y no «AHORA», y un lugar vacío es «—» y no «por jugarse». ✅ **1.88, la llave verdadera es la de veredictos** (Dlx, 02/10: *«el orden verdadero de las llaves para ese evento estaba en el canal de veredictos donde Abyssus participó y ganó»* y *«cuando hay eventos en vivo en X servidor, tienes que estar atento a los canales de eventos también, respectivamente»*). En FFA ese canal es **`✦🗳️︱votaciones`** y el bot no lo leía (buscaba «veredict»); ahora `escuchar.VEREDICTOS` y `avisos.PATRON_VEREDICTOS` son `veredict|votaci|resultad`, sin `postulaci` (Urban y FFS tienen «Resultados-Postulaciones», que es del staff). `escuchar.llaves_de_veredictos()` arma cada evento como se jugó —encabezados de ronda, cada batalla con TODOS sus lados, el ganador del renglón que nombra a uno solo (la réplica «A X B» y el «X» no votan)—, se guarda 21 días en `datos/veredictos.json` (`llaves`: FFA vacía el canal después de cada evento) y `llaves_a_entrada.llave_de_veredictos_para()` la usa EN LUGAR de la del organizador si es el mismo evento (servidor, horario, 60 % de la gente en común), está completa y empieza en la misma ronda; los nombres pasan por la misma canonización que la llave (`escuchar.canonizador()`, sacada de `resolver()` sin cambiarla). La VOL 2, medido con `comparar_lector.py`: **salen** ACH y DXG (no pelearon) y el «pasan 2»; **entran** Lrs y el octavo de Zignos, Abyssus, Korey, Eyou y Tayo (gana Abyssus); **Abyssus y Zignos, revividos**; el cuartos fue Snow vs Zignos. Ninguna otra llave cambia. ⚠️ El «TERCER LUGAR: Abyssus/Six» del organizador no era una batalla: con la llave de veredictos los dos quedan como perdedores de semis. ✅ **1.89, en vivo**: la página lee #votaciones igual que Python (`LlaveVivo.llavesDeVeredictos()`, atada por `llaves_casos.json` → `llaves_v` con las filas reales) y `conVeredictos()` de app.js pone cada batalla de veredictos sobre la de la llave que más gente comparte en su ronda (por persona, de a pares), agrega las que faltaban y saca las que no se jugaron cuando veredictos ya va por la ronda siguiente. **Verificado después del ciclo de las 12:52**: la VOL 2 quedó como se jugó — Oasis 10.000, Snow 7.500, Six 5.250, Abyssus 3.875 (revivido: mitad de semifinal + su octavo), Zignos en cuartos; entran LRS, Korey, LOLOELGAUCHO (Eyou) y Tayo con su octavo; salen ACH y DXG. ✅ **Geoka** ganó su octavo y en cuartos peleó Zignos en su lugar, así que quedaba en 0: el motor paga al que PIERDE cada ronda. Dlx, 02/10 (2:10 PM): *«3. B»*, cobra su octavo. Va como decisión por persona y no como regla —quien gana y no reaparece también puede ser un nombre troll sin unir, y pagarle crearía puntos para nadie—: `datos/decisiones.json` → `cobra`, `decidir.cobra_ronda()`, `llaves_a_entrada.marcar_cobra()` (la nota `cobra: X`) y `sheet/motor.py` le paga la ronda como a quien la perdió. **Verificado después de la corrida de las 2:52 PM**: Geoka, Octavos, 1.250 (el evento pasa de 22 a 23 con puntos). **Falta**: «te toca» con los nombres reconocidos en vivo |
| **El Ranking, rehecho** (el remake sigue por el Ranking) | *«quiero que sigas con el remake de la página de… ranking»* (02/10, 1 PM) · al ver la preview: *«1. Me encanta y sugiere cosas. 2. A»* (2:10 PM; la 2 es «los que no son miembros, como hoy: en su lugar, sin número») | ✅ **1.90, para todos**: `ranking` y `duelos` (el alias viejo) pasaron a `PROPIAS` en `App.jsx` y `web/montar.py`, y el script de `index.html` se rehizo con `montar.py --script`: cada link que circula (`/freestyle-rap/ranking/…`, `#/ranking/…`, `#/duelos`) abre el nuevo desde el primer pintado; la tabla de `app.js` queda escondida, de respaldo. ✅ **1.91, sus ideas** (Dlx, 02/10: *«también debemos quitar eso de puntos porque la tarjeta ya lo dice… 1. me gusta 2. me gusta 3. me gusta 4. me gusta 5. listo 6. siii… hacer esto luego»*): el podio sin los puntos en Temporada y Competitivo · **▲▼ desde el lunes** (`mv`): la «foto del lunes» la saca la primera corrida de cada semana (`subir_web.foto_semana()`, `datos/ranking_semana.json`, que `bot/ci/guardar.sh` guarda; la de esta semana salió del pool de git del domingo 27/09 5:24 PM ET) · **«NUEVO»** (`nu`, `subir_web.debutantes()`): por la fecha del PRIMER evento, no por «no estaba el lunes» —en la fase de prueba las llaves se corrigen hacia atrás: 79 «no estaban» y entre ellos Oasis, que jugó el 26/09—; la semana del arranque, a nadie · **los que tenés cerca** · **la fila que se abre** (con `/api/perfiles` vía `perfiles()` de app.js) · **tu puesto para historias** (1080×1920 en el navegador: R2 manda CORS para underlegends.pages.dev). La 6 (comparar) va con la página de Tarjetas. El lobby crece ~1 KB. Antes estuvo en preview: `web/src/ranking.jsx` se veía sólo con `lg:prev-rk` en el navegador. Los 10 rankings en una tira pegada arriba; el podio con las cartas de verdad en su escalón (1 verde agua, 2 magenta, 3 blanco; banderas en Países y logos en Crews); tu lugar abajo con «Encontrarme», que abre hasta tu fila y la marca; filtros de servidor, país y a quién seguís; en el celular 4 columnas y el resto deslizando; el 12/10, en cero, dice qué pasa. Las mismas reglas que `COL` y `SUBS` de `app.js` (el orden de cada ranking, lo vacío al final, el número salta a quien está fuera de concurso). Medido en 17 pantallas (360, 390 y 1440 px, noche, sin entrar, en cero): nada se sale de la pantalla y ningún error. Al aprobarse, `ranking` pasa a `PROPIAS` (en `App.jsx` y `web/montar.py`) |
| **Eventos, rehecho** (el remake sigue por Eventos) | *«AHORA hay que remake la pagina de eventos»* (02/10, 3:33 PM) · al ver la preview: *«1. si publícalo 2. Me gusta 3. Me gusta»* (4:08 PM; la 2 y la 3 son las ideas «el campeón para historias» y «cuándo suele jugar cada servidor») | ✅ **1.93, para todos** (4:26 PM): `eventos` y `avisos` pasaron a `PROPIAS` (`App.jsx` y `web/montar.py`, script rehecho con `--script`) y se fue `prevEv()`; la vista de `app.js` queda escondida, de respaldo. Verificado en producción: las nueve rutas (también `/#/eventos` y `/#/avisos`, que baja hasta la campana) abren lo que tienen que abrir, sin errores. Día por día (la tira pegada arriba; abre en hoy o en el último día con eventos), lo de ahora (en vivo, el próximo con cuenta atrás o el último campeón con su carta), el evento terminado abierto con su podio y su cuadro, filtro por servidor, la campana (`window.Campana` de `campana.js`) y el calendario, los últimos campeones y cómo se juega · **el campeón para historias** (`imagenCampeon`): el evento, la carta del campeón —las dos si ganó una pareja—, su escalón y «le ganó la final a…» sólo con un campeón y un subcampeón; en cada evento terminado y en el de arriba (en el teléfono sólo el ícono, para no empujar la campana). El marco vive en `web/src/historia.js`, compartido con el Ranking, cuya imagen salió idéntica (0 píxeles distintos) · **cuándo suele jugar cada servidor**: un cuadrito por día de la semana y la franja del medio (20–80 %), en la hora de quien mira, sólo servidores con 3+ eventos; en el día vacío, también qué hubo los mismos días de antes, y en «Cómo se juega» como tercera columna. ⏳ **La idea 1** (tu resultado en cada evento y tus días marcados) no la nombró: preguntada |
| **Las tiras pegadas tapaban el buscador y la barra de abajo** | — (lo encontré mirando la preview de Eventos) | ✅ 1.92: `.rk-subs` y `.evp-dias` de z-index 35 a 20, abajo de lo que sale del buscador (25) y de la barra (30). Medido antes y después con `elementFromPoint`: en el Ranking publicado, en la compu, la tira pintaba encima de los resultados; en Eventos, encima de las etiquetas de la barra. De paso, Ranking y Eventos se cargan aparte (el Inicio, de 124 a 115 KB comprimido) |
| **«Anoche» salía para todo lo de ayer** | — (lo encontré leyendo el código de las horas) | ✅ 1.93: `horaNum()` de `web/src/liga.js` le pedía la hora a `toLocaleDateString`, que le pega la fecha («1/10/2026, 20»), y sacarle lo que no es número daba 110202620: lo de ayer a la tarde decía «anoche» y lo de esta madrugada nunca. Ahora sale de `minutosDelDia()`, con la zona de Ajustes |
| **Eventos en la compu: sin el hueco de la cabecera, el evento abierto a todo el ancho, y lo jugado en «piel»** | *«I think theres a big BLANK space we should fill our reduce or change somehow»* · *«yes I think the space could be better advantaged»* · *«Is too much white I think for that»* (el evento abierto) · *«I like this PIEL color as well maybe we could include it for some stuff as well»* (02/10, ~4:40 PM, con capturas) | ✅ 1.94 (5 PM): la cabecera con el título arriba y los números abajo; la tarjeta del último campeón con la carta a la izquierda (en el teléfono sigue al lado del nombre) y su frase de los 15 minutos pasó a la descripción. Medido a 1333: 0 px vacíos arriba del título (eran 262) y la cabecera 163 px más baja · el evento abierto: el podio en dos columnas desde 560 px de tarjeta (container query: con el zoom de la compu la tarjeta mide ~810 en todas las pantallas) y la llave llenando el ancho (`lugar` en `CuadroMini`, casillas hasta 220; sin `lugar`, el Inicio queda igual): blanco a la derecha de la mitad a 16 px, ningún nombre cortado · **«piel» = `--caja` (#F3F3F0) para lo que ya se jugó**: los eventos terminados y los días del mes con eventos, como `.fecha.hecho` del Inicio; lo que viene, en blanco |
| **Los huecos grandes de toda la web, y flechas en el Ranking** | *«Fijate en general lugares donde hay un espacio tan grande vacio»* · para el Ranking: *«i meant arrows IM SORRY in the black space like we have in INICIO»* (primero escribió «rows»: las filas del 4 al 9 se hicieron y se sacaron con su *«wait dont do that»*) (02/10, ~5:10 PM) | ✅ 1.95 (5:37 PM). Medido con `scratchpad/huecos.py` (cada página a 1333 y a 390, rectángulos sin tinta de 280×160+), antes → después: Inicio · Fechas 135k → 0 (lo que pasó completa la fila de cinco) · Ranking 122k → 0 (el título arriba) y **flechas** `.rk-flecha` al ranking de al lado, desde 1320 px · Misiones 601k → 158k (ejemplos como tarjetas; queda el hero) · Eventos 113k → 0 («cuándo suele jugar» al costado) y el día vacío 560k → 124k (trae lo último que se jugó) · perfil de servidor 171k → 0 · páginas viejas: tarjeta del perfil pegada, Mundo en 3+2, el glosario, el Pase hasta abajo · abajo de una página corta, negro y no blanco. Verificado en producción. ⚠️ **Mi cuenta y Ajustes** se probaron con todas las partes juntas y quedó peor (la columna del menú vacía toda la página): vuelven a menú + una parte, lo aprobado; queda su hueco. **Publicaciones** y la FAQ marcan por ser listas anchas: normal. **Tarjetas** y **Tienda** (viejas) van con su remake |
| **Acomodar bien todo, y «Esta semana» como tira en el celular** | *«Ok pero acomoda bien todo por favor»* · con una captura del iPhone: *«Y te dije q lo de abajo q dice esta semana q sea tiras cómo está el ordenador»* (02/10, ~6 PM) | ✅ 1.96 (6:53 PM). Una ronda de capturas de todo lo tocado hoy a 1333 y 390 (`scratchpad/revision.py`), todo arreglado de una vez y una ronda de confirmación: «Esta semana» en el celular es la tira de la compu (se desliza; entera mide 505 px) · las pestañas del escenario en un renglón (de a tres, «LA LIGA» quedaba sola) · Ranking y Eventos con el texto en un bloque centrado (partido, el hueco se mudaba al medio) · las Fechas del Inicio por fecha y no por número de llave · la llave en vivo llena su tarjeta (`CuadroLleno`) · abajo de una página corta, el negro del pie hasta el final (la app mide al menos la pantalla: sombra desde el pie). Verificado en producción |
| **Eventos · la idea 1 (tu resultado en cada evento y tus días marcados): no** | *«No, creo q tenemos muchas cosas ya. La cosa no es sobrecargar las cosas»* · y de paso, *«La Tira era solo para los eventos que dan buffs o debuffs de puntos»* (02/10, ~7:10 PM) | ✅ descartada. La Tira de «Esta semana» queda sólo para los multiplicadores · después: *«bueno si quieres puedes pasarme previa de lo que querías hacer»* → al verla: *«Sí hazla como sugeriste»* (02/10, ~8:25 PM) → ✅ **1.98**: una línea «VOS · Campeón · +7.500» en cada evento que jugaste, como tu fila del Ranking (`miFila()`), y un punto magenta en los días que jugaste. Se fue `prevYo()` |
| **Mi cuenta y Ajustes en tarjetas, en la compu** (en el celular no cambia) | *«Haz una preview a lo q te refieres»* · al verla: *«hazlo como está las cosas de la derecha. Me gusta rellenar el espacio así como lo previaste»* (02/10, ~8 PM) | ✅ 1.97: cada parte es una tarjeta en dos columnas que se acomodan solas (`column-count`), sin el menú; las tres de «La Liga» juntas. Se fue `prevCu()` |
| **Publicaciones, rehecha, con 👏 Felicitar** | *«luego de esto quiero que hagas lo de publicaciones pero quizás algo más para que enganche a las personas o interactivo»* · al plan: *«Dale me gusta como lo tienes planeado. tomate tu tiempo»* (02/10, ~8:40 PM) | ✅ **1.99, para todos** (02/10, 9:50 PM ET). Al ver la preview: *«1. me gusta pero que lo de encuestas no sea lo primero que uno vea… y como te dije si uno ya votó en ambas que no aparezca encuestas en lo primero sino en lo último. 2. Que le lleguen las notificaciones, además de cuando te sigan o cuando la gente publica cosas o sea tú por ellos»*: las encuestas van después del primer día, y al final si ya votaste en todas (decidido al abrir, como el panel del Inicio); «Que te llegue» queda; y ⭐ **«alguien te sigue»** (`avisarSeguidores()`: con el nombre si es uno solo y de la Liga, a los 10 min, uno por hora como mucho, una vez por par; lo que ya se seguía nació avisado). Lo de «la gente que seguís publica» ya llegaba (`seguidos()`). `publicaciones` en `PROPIAS` y se fue `prevPub()`. El muro día por día con la carta, la letra o el logo de cada cosa; las cartas nuevas de un día en UNA publicación; las encuestas arriba; al costado lo más felicitado, «Que te llegue» (la campana) y a quién seguís. **Felicitar ya anda por detrás** (9 PM): `/api/avisos/felicitar` y `/api/avisos/aplausos` (Worker desplegado y proxy), tablas `aplausos` y `aplaudidas` del objeto, uno por persona, cuentas de 30+ días como el voto; a quien felicitan le avisa el vigía (`avisarAplausos()`): con el primero —esperando 10 min— y en cada hito (3, 5, 10, 25…), nunca dos en una hora, nunca por DM, y sólo si la cuenta del índice de «te toca» es la del perfil de la publicación. El `id` de cada publicación lo pone `bot/muro.py` (`id_de()`, estable entre corridas). Privacidad y /borrar-mis-datos, al día. Probado el objeto de verdad contra SQLite, con los avisos descifrados como en el teléfono |
| **Las historias, sin repetir**: lo visto se saltea historia por historia y lo más nuevo va primero | *«en las historias no arreglaste eso… aún sigo viendo las historias que ya he visto… no skipea las que ya vi y no me muestra lo más reciente PRIMERO»* (02/10, ~10 PM) | ✅ **2.00**: era UNA marca por círculo (la hora de lo último visto) y con algo nuevo volvía todo. Ahora cada historia tiene `id` (la de su publicación del muro; la semana para «esta semana», tu país, tu crew y a quién seguís), se guarda una por una en `lg:historias2` (tope 600; lo de `lg:historias` pasa una vez), cada círculo va de la más nueva a la más vieja, abre pasando sólo las no vistas (si viste todas, todas) y al terminar salta al siguiente con algo sin ver (`Visor` de `web/src/abajo.jsx`, `gruposHistorias` de `arriba.jsx`). Probado en producción |
| **Publicaciones, todos los paneles en piel** | *«¿puedes hacer que todos los paneles tengan ese color PIEL en vez del blanco?»* (02/10) | ✅ 2.00: también anuncios, lo de la Liga y las encuestas; las opciones de voto siguen en blanco (son botones). En Eventos, lo que viene sigue en blanco (la regla del 02/10: piel = ya jugado) |
| **Snow no es de Follombia** (otra vez) | *«SNOW no es de follombia ya te lo dije antes»* (02/10) | ✅ 2.00: la baja del 28/09 estaba en `datos/crews.json` y el perfil y las cartas la leían, pero la fila de la tabla tomaba la crew del pool (que viene de la Lista). Ahora `subir_web.armar()` la saca de `comun/crews.py` |
| **«Hubo muchos eventos hoy y la página sólo detecta los de ayer»** | *«¿rompiste algo?»* (02/10, ~10 PM) | ✅ no se rompió nada: barrido completo de los 249 canales que el bot lee en los 8 servidores (sólo lectura) — el 02/10 ET se publicó **una** llave, KISS OF SHINIGAMI (FFA, cuartos desde las 5:46 PM), incompleta: espera en `Pendientes` hasta que se marquen los ganadores. Preguntado de qué servidores eran los otros |
| **Más variedad en las historias**, con lo que ya hay | a la propuesta (el que más subió, debutantes, rachas, el clásico, Se busca, hoy se juega, premios): *«2. si»* (02/10, ~10:30 PM) | ✅ **2.01**: un círculo «La Liga» (`historiasLiga()` de `web/src/arriba.jsx`), primero después de lo en vivo; cada historia con su `id` (por día, por semana o hasta que cambie lo que cuenta) y sin dato no hay historia. En el celular, lo que cuenta va entre las flechas |
| **Rumores del chat general en las historias** | *«3. C»* | ❌ nada de rumores. Mi recomendación: leer el chat general es publicar lo que alguien dijo sin que sepa, y pone en riesgo el permiso de leer mensajes que Discord revisa (24/12) |
| **La campana como panel de notificaciones**, como Instagram, con los eventos de hoy | *«que en esa campanita aparte para hacer activar tus notificaciones que sea como un panel de notificaciones recientes quizás algo como instagram»* · a «¿también los eventos del día?», *«1. A»* | ✅ **2.02** (03/10, 12:13 AM): *«3. a»*. Para todos: sacado `prevNot()` de `arriba.jsx`. La bandeja anda por detrás (tabla `bandeja` del objeto, `/api/avisos/bandeja` con la sesión, 30 días, `/borrar-mis-datos` la borra) |
| **Mundo → «Socios» o «Patrocinadores», y la Guía, rehechas** | *«Después de esto reworkeemos lo que es MUNDO, llámalo SOCIOS o patrocinadores y reworkeemos GUÍA»* (02/10, ~10:30 PM) | ✅ **2.02** (03/10, 12:13 AM): *«1. A 2. A»*. Socios en los dos menús (el viejo dice 🤝 Socios), `socios`/`mundo`/`guia` en `PROPIAS`, `#/mundo` abre Socios, la barra del celular tiene su ícono, y los «‹ Mundo» de las páginas de crew y país vuelven a `#/ranking/crews` y `#/ranking/paises` |
| **«Sumá tu servidor»: sin la línea de GitHub, escribirle a @itsdlx, y más de lo que hace la Liga** | *«Todo su código está a la vista: en GitHub — quitá esa línea y decí que si querés que tu servidor sea parte escribas a @itsdlx en Discord, y explicá más features que hacemos»* (03/10, ~12:20 AM) | ✅ **2.03**: ocho cosas en tarjetas (`QUE_GANA` de `socios.jsx`: la tabla, la carta de Servidor, la llave en vivo y el «te toca», los avisos y el calendario, Most Wanted, el multiplicador y el ×2 votado, la guerra de servidores, su página y sus anuncios), «Qué hace el bot» con tres, y el botón al perfil de Discord de Dlx. La pregunta de la Guía también dice @itsdlx |
| **Una página aparte para servidores y comunidades**: cómo sumarse o asociarse, con todo lo que hacemos y los beneficios, a full detalle | *«quizás tengamos que crear una página externa para eso de CÓMO AGREGAR TU SERVIDOR O COMUNIDAD O CÓMO ASOCIARTE A NOSOTROS»* (03/10, ~12:25 AM) | 🔍 **en preview**: `underlegends.pages.dev/sumate?prev=sum` (el link prende `lg:prev-sum`). Respuestas: *«3. A»* (en la raíz), *«4. hacer 1 evento a la semana como mínimo… y entre otras cosas que se discutirá conmigo… o… un ticket donde te envía el formulario a ti y me lo envías a mí por Discord»*, *«5. Sí… no sólo comunidades sino otras cosas»*. Trae para quién es (servidores, comunidades y creadores, marcas), lo que hacemos con ejemplos, cómo se suma, qué hace el bot, preguntas y la postulación: con la sesión de Discord, una por día, guardada 90 días (`postulaciones`) y al DM de Dlx (`postular()`; `sin_dm.py` sigue verde). Al aprobarse: sacar `prevSum()` (App.jsx y sumar.jsx) y sumar la postulación a la página de privacidad | |
| **Eventos: el hueco gigante de arriba y la llave repetida** | *«Mirá en eventos el espacio gigantesco que hay… además ahora que me doy cuenta se está repitiendo eso»* (03/10, ~12:05 AM, con capturas) | ✅ **2.03**: la tarjeta «En vivo ahora» ya no trae la llave entera (la hacía 803 px contra 225 del título); trae lo que se juega en una línea —`enJuegoDe()` de `arriba.jsx`, con las reglas del cuadro: «AHORA» sólo si se juega en orden— y cuántas batallas van. El encabezado bajó de 877 a 299 px en la compu y de 1176 a 597 en el celular, y la llave queda una sola vez, en el día |
| **El calendario por mes, más fácil en el celular** | *«quizás también hacer el acceso al calendario vista por mes más sencillo en celular también sería bueno»* (03/10) | ✅ **2.03**: «Mes» sale de la tira de los días que se desliza (estaba al final, detrás de nueve días) y queda fijo a la derecha, en verde; al tocarlo baja hasta el mes |
| **La raya negra entre los íconos de abajo y la cuenta** | *«eliminá la línea negra que hay en los íconos de abajo y la cuenta»* (03/10) | ✅ **2.03**: era el borde izquierdo de «Yo» (`.tb-yo`) |
| **«ESTE EMOJI CONFIRMA TU ASISTENCIA…» como evento en vivo** | con capturas del Inicio y del mensaje de URBF (03/10) | ✅ **2.03**: «# HORARIOS PARA LA FINAL NACIONAL ALBICELESTE» contaba como el campo HORARIO y el título salía de la línea de abajo. Una línea sin dos puntos, de 3 palabras o más y sin número ni marca de hora es una frase (`_frase`/`campoDe`, Python y Worker, con el caso en `avisos_casos`). No llegó a Discord ni a la campana (el vigía no lo vio); sólo al payload, y se va con el ciclo |
| **«Inscribite ya» en vez de «Ir al anuncio»**: que el botón invite al canal de inscripciones del evento | *«en vez que sea EL LINK del mensaje del anuncio, que sea el link de invitación al canal… o el de inscripciones mejor… porque la gente no puede entrar de esa forma»* (03/10, ~12:30 AM) | ✅ **2.04** (03/10, 12:55 AM): *«1. a»* y *«2. A»*. Seis invitaciones permanentes creadas a mano (`bot/invitaciones.py --inscripciones`): FFA, SR, dos en Urban y dos en FFS; DRA no tiene canal de inscripciones (se anota con el botón de la tarjeta, en un canal que @everyone no ve) y usa la del servidor. El aviso de `eventos-hoy` (`mensajeRed`/`invitacionPara()`) y la página (`aDiscord()`) eligen la del canal de inscripciones de la misma categoría del anuncio; en vivo, «Entrar al servidor». Viajan en `meta` (`inscribir`, `invita`) y en `proximos[].ins` | |
| **«1VS1» y «1VS1 sin réplica» en «Cómo se juega»** | captura de los formatos (03/10) | ⏳ preguntado si es lo que se repite: hoy van aparte a propósito (`formato()` de `eventos.jsx`) |
| **Las cajas de «lo que hacemos», con un ejemplo al tocarlas** | *«que quizás cuando se clickee en una de estas cajas te muestre como una imagen de lo que se refiere como ejemplo… para añadir más detalle… creo que es importante»* (03/10, ~12:50 AM, con captura) | 🔍 **en preview** con `lg:prev-sum`: `sumar.jsx` (Socios y /sumate); cada caja abre una captura de la Liga de hoy (`bot/paginas/ejemplos/`, las saca `scratchpad/ejemplos_sumate.py`) con el detalle y «Verlo en la página»; ← → pasan a la siguiente y la imagen se abre en grande |
| **Las redes en Socios, y que compartimos sus posts** | *«agregá de alguna manera las redes sociales en socios y mencioná que compartimos las redes sociales, o sea los posts, en nuestras redes y la Liga Global también»* (03/10, ~12:40 AM) | ✅ **2.04**: las redes de cada servidor en su tarjeta, las de Under Legends debajo de «lo que hacemos», y una caja más: «Sus posts, en nuestras redes» |
| **Pasada de bugs y optimizaciones** | *«Take this to fix bugs, find optimizations, etc»* (03/10, ~1:30 AM) | ✅ **2.05** (03/10, 3:28 AM). Recorrido de 28 rutas × compu y celular en producción (0 errores al final) y dos revisiones de código, cada hallazgo verificado. **Bot**: 🔴 la identidad salía de `/users/@me` y aceptaba el token de CUALQUIER app de Discord (entrar como otra persona): ahora `discordDe()` usa `/oauth2/@me` y exige nuestro `APP_ID`; «ocultar mi foto» podía gastar las 1.000 escrituras de KV del día (tope 10/día y KV cada 15 min); /sumate (la que no llegaba trababa 24 h; antigüedad, tope de 20/día, sin Markdown); borrar mis datos no tocaba `idk`, `inscritos` ni `hechos`; seguidores duplicaba la bandeja; un canal borrado cancelaba sus eventos (sólo 10008); suscripciones falsas sin fin; «Sos el próximo» perdido. **Ciclo**: pisaba una página más nueva con la vieja (`paginas_subir.mas_nueva_en_origin()`). **Web**: una página rota dejaba en blanco las demás; el DORADO ×3 no salía nunca; los cancelados no salían; lo en vivo pasada la medianoche; «SIN LLAVE» falso; los fuera de los 200; títulos, buscador, foco del menú, «Entrar», campana al salir, «:infinity:», la billetera sin sesión. Queda: el presupuesto de pedidos del vigía compartido entre pasos, y el campeón de las llaves viejas en Eventos |
| **El celular: acomodar todo, dos botones por fila, y algo rosadito de la marca** | *«hay que acomodar las cosas bien dentro del celular… fijate en todo específicamente en celular… si 2 botones pueden estar en la misma línea en vez de estar separados. Hazlo. Creo que podrías agregar algo rosadito… de la marca en general porque veo mucho celeste»* (03/10, con captura de Eventos) | ✅ **2.06** (03/10, 11 AM). Medido en 390 px: nueve filas de botones se partían (Inicio, Eventos ×3, Ranking, Tarjetas, Servidor, Sumate ×2). Ahora en el celular cada botón toma media fila (letra 12,5 px, el texto puede bajar a dos renglones) y la fila va a lo ancho (`width:100%`: varias vivían en columnas que encogen a su contenido); Compartir al lado de otro botón queda en su ícono (vuelve a mostrar «Link copiado» si copia), y en una fila con ícono cada botón de texto va con el ícono o a lo ancho —tres en una línea partían «Activar la campana» en tres renglones—. Las redes de Under Legends, de a tres. **Magenta**: la pestaña activa de la barra de abajo, «Mes», las barras de los formatos, los íconos de «lo que hacemos», la mancha de arriba de Eventos y la de abajo de Socios y el changelog (`--mo-c2`); los botones principales siguen verdes. Revisadas las 15 páginas enteras en el celular: lo demás estaba bien (las tarjetas «vacías» de las capturas eran fotos que cargan al bajar: medido bajando, 26 de 26) |
| **Una llave sin nombre no se cargó** (KISS OF SHINIGAMI, FFA, 02/10: anuncio 5:33 PM, llave 5:46 PM) — «¿cómo detectás que esta llave es para este evento? ¿por el tiempo o por la persona que anunció esos 2?» | *«no en todos los servidores ponen nombres tampoco… esto suele pasar seguido»* (03/10, ~10:45 AM, con capturas) | ✅ **2.07** (03/10, 11:15 AM). La causa: quedó **retenida como posible broma** (`llave_de_broma()`): la cuenta nunca había publicado una llave y, sin título, ningún anuncio «la respaldaba» —el respaldo era por NOMBRE—. Ahora, por las dos cosas, en orden (`anuncio_de_llave()`): **1) la hora** —un anuncio de su servidor cuyo evento arranca entre 5 h antes y 1 h después de la llave, la ventana de los 5 vidas, y que no tenga ya su llave—; **2) la persona** —si hay dos, el que publicó la misma cuenta (`autor_h`, huella en `datos/anuncios.json`)—; **3)** si aun así son dos, ninguno: queda «(sin titulo)» y se pregunta. La hora NOMBRA pero no RESPALDA a una cuenta nueva: para eso tiene que ser la misma que publicó el anuncio (cualquiera puede tirar una llave en blanco después de un anuncio de verdad). El nombre se guarda (`datos/nombres_llaves.json`): el anuncio se va del canal y la llave no, y volver a «(sin titulo)» sería otro evento con otro número. Medido con `comparar_lector.py` sobre las 33 llaves de la T1: sólo cambia ésa (mismas filas, ahora con nombre); verificado en Discord que anuncio y llave son de la misma cuenta. Se carga sola en dos corridas (la 1ª deja la huella del anuncio). Quedan sus 3 preguntas de batalla —los dos tríos de cuartos sin ganador claro y Verc vs Provenza—, que no son por el nombre |
| **Rehacer la página de Tarjetas** | *«hay que reworkear la página de las tarjetas y hacerlo mejor, ¿no?»* (03/10, ~11:30 AM) y al plan: *«1. A 2. A 3. A»* (la galería arriba con el buscador · «Las tuyas» arriba si entraste, con lo que te falta en las bloqueadas · una pestaña por tipo) · *«incluso podés sugerir más ideas»* | 🔍 **en preview** (`web/src/tarjetas.jsx`, `?prev=tar`): el marco y el estilo de las páginas nuevas (en la vieja cambiaba hasta la barra de abajo del celular); arriba las tres primeras de ese tipo en abanico (sólo en la compu); «Las tuyas» con tus cuatro —la Bloqueada de verdad, la que dibuja el bot, y las barras de lo que falta (`req` de /api/perfiles, como el perfil)—; la galería por tipo con el buscador (12 en el celular, 24 en la compu, y «Ver las N»); «Comparar dos» con el cara a cara. Los datos y las reglas son los de app.js (`conTarjeta()`, `CMP_FILAS`); arreglado de paso: «fuera de concurso» ganaba el Puesto con «#0». ✅ **2.08 para todos** (03/10, ~12:30 PM, Dlx: *«1. A 2. A 3. A»*), con las dos ideas: **tu tarjeta para historias** (debajo de cada tarjeta tuya: la imagen vertical con la carta de verdad, como «Mi puesto» del Ranking —en la prueba local sale la cara, porque R2 sólo deja leer las cartas desde underlegends.pages.dev—) y **los filtros** de la galería (Nuevas —las de ese tipo que salieron esta semana, del muro—, A quién seguís y por servidor; un filtro que no filtra nada no se dibuja). `tarjetas` pasó a `PROPIAS` (App.jsx y `web/montar.py --script`); la de app.js queda escondida, de respaldo |
| **Rehacer el perfil de cada rapero** | *«Dale… entonces seguí con eso»* (03/10, ~1 PM) y al plan: *«1. A 2. A 3. A»* (pestañas Resumen · Eventos · Duelos · Insignias · en Resumen sus números, sus fortalezas, en cada ranking, lo que le falta y el precio por su cabeza · el cara a cara y sus duelos, juntos) | 🔍 **en preview** (`web/src/perfil.jsx`, `?prev=per`): arriba quién es —su cara, su país, su servidor, su crew, sus redes, sus seguidores, seguir y compartir— con sus números y su tarjeta (con sus cuatro para cambiar; en el celular, sólo en Resumen); Resumen con el radar contra el promedio de la Liga y «Su fuerte / A trabajar»; Eventos con la llave de cada uno; Duelos con el cara a cara —al tocar un rival, sus duelos con él—; Insignias y su cacería. Las acciones son las de app.js (`alternarSigo()`, `ponerPrecio()`, el visor y las llaves; `pintaPrecios` avisa con `lg:precios`). Casos: fuera de concurso (sin precio), sin verificar, tu propio perfil (sin seguir; «Cambiar mi foto»; si no estás en la tabla, con lo de tu cuenta), una clave vieja con mayúsculas. ✅ **2.09 para todos** (03/10, ~3:15 PM, Dlx: *«1. A 2. A Dale»*), con **«Comparar conmigo»**: en el perfil de otro, si entraste, un botón a «Comparar dos» de Tarjetas con los dos puestos (`#/tarjetas?a=<vos>&b=<él>`; la página baja sola hasta ahí), y sólo si los dos están en el comparador —con carta y con cara, `conTarjeta()`—: con uno afuera, «Comparar dos» ponía al #1 en su lugar sin avisar (hoy 54 de las 200 filas tienen carta y no cara). `r` pasó a `PROPIAS` (App.jsx y `web/montar.py --script`) y se fue `prevPer()`; el perfil de app.js queda escondido, de respaldo. De paso, «Fuera de los 200» del Inicio decía *«en tu perfil está todo»* y no era cierto: ahora dice que ahí están tus tarjetas y que eventos y duelos aparecen al entrar entre los 200 |
| **Todo lo que falta rehacer de la web, con un plan** | *«OK ahora haz todo lo demás que tengas que reworkear.. fíjate.. pero primero planea»* (03/10, ~3:20 PM) y al plan: *«1. A 2. A 3. A»* (~3:50 PM) | ⏳ en curso, una tanda por vez y cada una con preview: **1)** la llave y la ventana de la tarjeta; **2)** Tienda y Pase (el Pase sigue siendo el cartel «Próximamente»: su diseño lo habla Dlx); **3)** las páginas de cada crew y de cada país, con la forma de la de cada servidor; **4)** Privacidad y Términos; **5)** sacar la página vieja (`app.js` y su estilo: ~0,5 MB que hoy baja cada visita y nadie ve), cuando todo sea nuevo y pase una semana sin problemas (*«3. A»*) |
| **La llave, nueva**: arriba el podio y abajo el cuadro de a una ronda por pantalla, deslizando —como las apps de fútbol—; tocás un nombre y se marca su camino | *«la sección de llaves tiene que mejorar bastante»* (de antes) y al plan, la 2: *«A»* | ✅ **2.10 para todos** (03/10, 4:55 PM, Dlx: *«1. A»*; antes, en preview con `?prev=ll`): una página con su dirección (`/freestyle-rap/llave/382`; la que se juega, `/llave/v:<id>`), así que se comparte y el «atrás» del celular vuelve. En el celular, pestañas por ronda con sus puntos y la pista que se desliza (el alto es el de la ronda que mirás: sin huecos); en la compu, el cuadro entero con sus ramas, en espejo si entra. Tocar un nombre apaga lo demás, marca con un punto las rondas donde jugó y deja abajo cómo le fue, con su perfil. Las mismas reglas que la de app.js: 5 vidas como tablero, la nave de funa, equipos (y los «equipo» sin integrantes), Clásico, 🎯 del Most Wanted, «pasan N», tercer puesto, los puntos por puesto (cerrados) y «¿Algo está mal?». Probadas las 34 llaves de la temporada, sin errores. Con la misma preview, **la ventana de la tarjeta nueva** (`visor.jsx`): pestañas, la carta, sus números, Descargar y Ver su perfil. El script del principio sabe de la preview (`PREVIEWS` en `web/montar.py`, `window.__esNueva()`): así app.js no abre la suya encima. Al publicarla, `llave` pasó a `PROPIAS` y `PREVIEWS` quedó vacío, para la próxima vista vieja que se rehaga |
| **Un evento recién anunciado no salía en el Inicio** | *«se ha anunciado el evento y no se ve en inicio»* (03/10, ~4:05 PM, con DESGRACIAS EN TOKYO VOL 21) | ✅ arreglado (`629137d`): el vigía lo había visto a las 3:59 y mandó la campana, pero el Inicio sólo conoce lo que trae el payload, que el ciclo escribe cada 30 min. Ahora `/api/avisos/vivo` trae los `anuncios` que el vigía vio en el último día y la página los suma a «próximos» (`Liga.proximos()`) hasta que el ciclo los traiga. Verificado: salió como «Próximo · empieza en 10 min» |
| **Que se vean los anotados** de un evento antes de que haya llave | *«cuando se anuncian los eventos y las llaves no están creadas, que se PREVEA las personas que se han inscrito? Creo que de esta forma ayuda también al sistema a reconocer»* (03/10, ~4:05 PM) | ✅ decidido (03/10, ~4:57 PM, Dlx: *«Suena bien. Me gusta tu A»*): «12 anotados» con las caras en la tarjeta del evento (Inicio y Eventos) y, al tocar, la lista; sólo lo que parece una inscripción (un nombre corto); antes de seguir con la Tienda. ✅ **2.11** (03/10, 5:07 PM): el vigía junta, por evento anunciado, lo que se anotó en su canal de inscripciones (`anotados()` y `anotadosDe()` en bot/avisos.js: cada inscripción al evento de ese servidor ya anunciado que arranca primero; sin preguntas, avisos del organizador, «abiertas/cerradas» ni frases) y la página cuenta sólo lo que trae bandera o un nombre que la Liga conoce (`Liga.anotados()`: la regla de `es_inscripcion()` del ciclo). La cara: la de la cuenta que se anotó, si anotó un solo nombre y su perfil se llama así (quien anota a otro no le presta la cara); si no, por el nombre. Sin Discord IDs en la página. Medido con DESGRACIAS EN TOKYO VOL 21: 22 anotados (la llave tuvo 18); «yo», «ya oe», «vamos juntos» quedan afuera. Va en el Próximo del Inicio (también «tu próximo» y el en vivo sin llave) y en Eventos. De paso: las tarjetas «por jugarse» de Eventos llevaban la clase `prox`, que es global del Inicio (una grilla de tres columnas), y salían con el nombre en una columna angosta: ahora `es-prox`. El vigía ya lee los canales de inscripción cada minuto (`inscritos`) y ya los usa para reconocer a la gente en las llaves en vivo |
| **La Tienda y el Pase, nuevos** (la tanda 2 del plan) | *«Ok ahora qué sigue»* (03/10, ~5:10 PM) | 🔍 **en preview** (`web/src/tienda.jsx`, `?prev=ti`): la Tienda con lo mismo que tenía —tus Puntos de Tienda arriba a la derecha (sin la cuenta, «todos arrancan con 5.000»), el precio por cabeza en tres pasos, las cabezas de la semana y, al tocar una, cuánto ponerle; buscar a quién; lo último que se cobró; «la tienda abre pronto»— y el Pase como el cartel de hoy, llenando la pantalla. La plata la sigue manejando app.js (`BILL`, `valorCabezas()`, `ponerPrecio()` con su vuelta de Discord, `errorPrecio()`) y avisa con `lg:precios`. En la compu, a dos columnas. ✅ **2.12 para todos** (03/10, 5:28 PM, Dlx: *«A.»*): `tienda` y `pase` pasaron a `PROPIAS` (App.jsx y `web/montar.py --script`) y `PREVIEWS` quedó vacío; las de app.js quedan escondidas, de respaldo |
| **Snake Rap se lee SNK y Urban Freestyle URB** | *«cambia el esto de SNAKE RAP de SR a SNK queda mejor y de URBF a URB»* (03/10) | ✅ **sólo lo que se lee**: `sigla` en `datos/servidores.json`, que usan la página (`siglaDe()`), el menú de /card (`SERVIDORES` de `worker.js`) y lo que escribe el bot (`bot/siglas.py`: el mensaje del lunes, Most Wanted, el aviso de llave). **El código sigue siendo SR y URBF**: es la clave de los colores, los logos, las cartas en R2, las columnas del Sheet y los links que ya circulan; `/sv/SNK` y `/sv/SR` abren lo mismo. ✅ **Y el Sheet también** (Dlx: *«sí cámbialas para evitar confusiones»*): las vitrinas escriben SNK y URB (columnas y `Sv`) y los pools las leen de vuelta al código (`rankings.ver()`/`cod()`). 🔴 **De paso, un bug**: las lecturas de las vitrinas pedían `A:AA` (27 columnas) y la Temporada tenía 29 —FRZ y DRA no se leían ni se escribían, con números del 22/09, y FFS y DDF ni estaban—; ahora `A:AZ`, y la cabecera se rehízo con las 11 columnas de servidor |
| **Los anotados: equipos, «+?» y «primera»**, y **lo básico del evento en vivo** | *«me gusta el sistema de inscripciones q pusiste pero… hay algunas fallas»* · *«este evento LA REDENCION es MULTIVERSE… debería decirlo ahí… lo básico»* (03/10) | ✅ medido contra su canal: «Trot 🇪🇸+?» y «Dyzz🇨🇱 +??» no aparecían (el «?» tiraba la inscripción), «primera» se pegaba al nombre, y los equipos del MULTIVERSE quedaban como una persona —ahora uno por lado, con su bandera, también «A B C 🇦🇷 🇦🇷 🇵🇦»—; «ji sung park» es Park Ji Sung. **Y el evento había desaparecido del Inicio**: FFA borró el anuncio y lo volvió a publicar; el borrado tapaba al nuevo y se llevaba los anotados. En vivo, el Inicio dice la modalidad, los cupos y el premio |
| **La pasada de errores con dos revisores** (Worker/vigía y web) | *«asegurate de mejorar todas las cosas… buscar errores»* (04/10, ~12 AM) | ✅ **2.22** (~1 AM): 9 del Worker y el vigía y 11 de la web, cada uno verificado antes de tocar. Lo más grave: **un anuncio borrado y vuelto a publicar mandaba «cancelado» a todos** (LA REDENCION, 6:26 PM) —ahora `repetidos` y el aviso sigue al mensaje nuevo; probado con el objeto real sobre SQLite—; **la cuenta extra de Monet podía borrarle todo a la otra** (`dn:` → `dx:`, sólo cartas); **/sumate en paralelo eran N DMs**; **`/avisos/vivo` publicaba el texto de llaves borradas y los IDs de quien publica**; un **link de crew con `%` tumbaba la página nueva**; **lo terminado seguía «EN VIVO»** 90 min. Más: `/estado` al borde, índice `subs(quien)`, frenos a escrituras de KV, siglas en seis lugares, la última llave por fecha, fechas en la zona elegida |
| **Las historias como Instagram, crew y país nuevas, lo legal y una pasada general** | *«el orden de las tarjetas vistas está invertido… fijate cómo lo hace Instagram»* · *«asegurate de mejorar todas las cosas y optimizar… buscar errores… y si falta reworkear algo, reworkealo»* (04/10, ~12 AM) | ✅ **2.20** (12:10 AM): en cada círculo de la más vieja a la más nueva con todas las barritas, abre en la primera sin ver, y lo visto pasa al final de la fila (`ordenHistorias`, con la foto de lo visto de cuando el visor estaba cerrado). ✅ **2.21** (12:23 y 12:31 AM): **la página de cada crew y de cada país en la web nueva** (`grupo.jsx`; eran las dos últimas vistas de app.js) y **lo legal con la piel del remake** (sin Google Fonts, clara u oscura según `lg:tema`; la Liga ya incluye a DDF). **El paquete principal de 136 a 122 KB** comprimido (Mi cuenta, el changelog y la página de servidor, perezosos). Recorrido de 35 rutas × compu y celular: limpio. ⏳ **Falta del plan sólo «sacar app.js»**: es la cañería (datos, cuenta, campana), no se ve, y conviene hacerlo planeado |
| **Sacar app.js, tanda 1: que no dibuje lo que nadie ve** | a «¿sacar app.js? A lo planeamos ahora y lo hago en tandas»: *«A»* (04/10) | ✅ **2.23** (9:33 AM): con la página nueva, `pintaDatos()` corre sólo lo que ella escucha (cuenta, votaciones, precios, calma): **de 71,7 a 2,2 ms por carga de datos** en esta compu, y otro tanto cada 5 minutos. `ir()` tampoco dibuja el perfil, la crew, el país, la Tienda ni el Ranking viejos, y Publicaciones deja de pedir el muro dos veces. Si la nueva se cae, `__pintarViejo()` dibuja todo: lo llaman los tres respaldos (probados: app rota, app que no llega, datos que no llegan). `node web/efectos_app.cjs` mide que nada de lo que React lee dependa de lo salteado. ⏳ **Tanda 2**: la cuenta, la Tienda y la campana a módulos propios; **3**: los datos; **4**: borrar app.js |
| **Las 60 cosas de las capturas: seguridad y lo que le falta a la página** | *«Make sure our app and website has all these things»* (04/10, con tres capturas de TikTok) | ✅ **2.24** (10:18 AM), con tres revisores (servidor, página, repo) y cada hallazgo verificado antes de tocar. **Servidor**: los permisos de Discord inventados ya no llegan a Discord (no se vuelve a preguntar uno que falló, y con más de 30 fallas por minuto se frena: Discord bloquea la IP que junta muchos y el bot se quedaba mudo); la campana pide una clave real y como mucho 60 dispositivos nuevos por hora (un script la llenaba); «Probar» ya no salva a uno falso de la poda; diez sesiones por persona; los registros del Worker prendidos (`observability`) con `[seguridad]` en cada freno y firma falsa. **Página**: cabeceras de seguridad y CSP (`bot/paginas/_headers`, probada sin una sola violación en 17 páginas × compu y celular), `_routes.json` (sólo la API pasa por `_worker.js`; los archivos eran la mayoría de sus 11.556 pedidos de las últimas 24 h, de una cuota de 100.000 por día que comparte con el bot), un POST con `Origin` ajeno da 403 (la sesión de otro no se puede plantar), el permiso de Discord sale del `#` en el script del principio, sin Google Fonts, d3 firmado en `/mapa`, sólo `https:` en los links armados con datos, segundo toque en lo que gasta o borra (`DosToques`), volver arriba tocando la pestaña, «saltar al contenido». **CI**: cada valor de los secretos se tapa por separado en los logs (`bot/ci/enmascarar.sh`). ➖ No aplican: contraseñas, pagos, IA, subidas, claves de base de datos. **Dlx, 10:21 AM: «1. A 3. A 4. B 5. A»** → borrados los logs de **tres** corridas de CI con un dato que no tenía que salir (las dos de la auditoría del 29/09 y un ciclo del 24/09: se revisaron las 731 desde el 22/09); prendidos el escaneo de secretos, el bloqueo de push con secretos y las alertas de Dependabot; y vite 6.4.3 (`npm audit`: 0; las 4 alertas, «fixed»). El tema sigue en Clara y sin plan pago. La 2 (cambiar ese dato y mover las fotos): **«B»**, al final con los tokens (nadie ocultó su foto) |
| **Las ideas nuevas, /card, quién tiene tarjeta y el Dashboard** | a las preguntas: *«1. A 2. C… 3. A o cualquier participación… 4. A 5. A y B 6. una mezcla… hay que implementar todo 7. A 8. B, como Brawl Stars»* · *«sacá de la lista de opciones en tarjeta de servidor a TFC, EFA»* · *«en stats mostrá cuántas personas usaron o interactuaron con el bot»* · con la captura de Adriagner: *«el hecho de que el bot reconozca unas personas no significa que tengan su tarjeta… actualizá esas respuestas»* · *«que esté en una página nueva creada sólo para el owner»* (04/10, 11:15 AM a 12:15 PM) | ✅ **2.25** (11:40 AM): `/card` dice que las tarjetas son de quien **juega** (y lleva a los próximos eventos); elegirse en `quien:` es «yo»; el menú de la Servidor sin TFC ni EFA (`en_la_liga` en `datos/servidores.json`, `fuera` en el Worker). ✅ **El Dashboard** (`/dashboard`, ~12:10 PM): sólo con la cuenta de Dlx —`/avisos/dueno` comprueba el ID y da 403 a cualquier otro—; trae cuánta gente usó el bot y la página (personas distintas por día, 35 días; las visitas sin cuenta sólo como número), día por día y cómo anda todo. Los números salieron de lo público. ✅ **Las tarjetas que faltaban**: de 262 que jugaron, 54 no estaban en la Lista. **7 cargados** con su cuenta (Teito, ELPIBEOSIRIS, Riferian, Teo, ISAIAS, Sexo, WILLY: «1. A»), **2 alias** (Pichula = PichulaMc, za = Provenza: su cuenta es la misma, «2. A»), **25 esperan a anotarse** («3. B»), y los dudosos en ✅ Decidir **con sus cuentas al lado**: contestar «Es la cuenta @…» lo carga («4. Ok»). Pedir entrar a la página para tener la tarjeta: **no** («5. A»). Adriagner nunca jugó: bien que no tenga. ⏳ racha diaria y niveles → divisiones → el bot en vivo → el diseño del Pase y las Misiones |
| **Los ajustes del Dashboard, y el Dashboard en el Inicio** | a «qué querés poder cambiar desde el Dashboard»: *«todo y muchas más cosas… y que me aparezca a mí únicamente en el inicio también»* (04/10, ~12:30 PM) | ✅ **2.26** (1:31 PM). **Pausar la campana**: en pausa no sale ningún aviso —los de eventos se descartan (estado 2: pendientes, la alarma los retomaba al instante para siempre) y los personales esperan—, y la página de Eventos dice que está en pausa. **El multiplicador de la semana a mano**: vale **desde que se guarda**, no para la semana entera (cada cambio es un tramo con su `desde`; `factor_de()` busca el de cada evento), así lo ya jugado no se mueve; el sorteo queda en `sv_sorteo` y «Volver al sorteo» lo devuelve; lo aplica el ciclo leyendo `/avisos/ajustes` con su clave, y si no puede leerlo no toca nada. **Un aviso arriba de la página**, con vencimiento: viaja dentro de `/avisos/vivo`, que la página ya pide, así que no suma pedidos; cada uno lo cierra. **Lo que llega por DM, junto**: las postulaciones de /sumate y los errores reportados en las llaves. Y atajos (el mapa, ✅ Decidir, el ciclo, Cloudflare). **En el Inicio, sólo para tu cuenta**, un panel con los números de la semana y lo que está prendido; si otra cuenta copia tu ID, la puerta (`/avisos/dueno`) igual dice que no. ⏳ **el bot en vivo por servidor** llega con esa función |
| **La ACADEMIA entra a la Liga** | *«El bot entró a la ACADEMIA… quiero que prepares todo para implementarlos en la liga como se debe. Tag ponle ACADEMIA. Colores amarillo y negro para la tarjeta»* · *«hazla con un diseño único como lo que hiciste con DDF»* (04/10, ~1:30 PM) | ✅ **2.27** (2:18 PM). **El alta**: código `ACAD`, sigla **LCW** (por La Crew: *«1. LCW»*), etiqueta **ACADEMIA**, `confirmado`, guild `765045834647339038` («#LaCrew ‖ ACADEMIA DE RAP», 1.852 miembros), en las mismas listas que DDF; invitación de la Liga a #bienvenida (`tyYC4XejPA`) y otra a #inscripciones-1 (`hDttYp6uzK`). **El logo**: el círculo amarillo con las columnas, del archivo de 3000 px que pasaste (su ícono de Discord es el logo entero con letras: va con silueta, como FFA); amarillo `#EACB0C`, a ΔE 23,9 del miel de Urban. **La tarjeta de Servidor, un templo de noche**: el techo en punta es el frontón y el escudo su remate; abajo, dos columnas estriadas sobre una escalinata con filo dorado, todo sobre mármol negro con vetas doradas (`marmol.py`). **El lector**, en Python y en JS: «## 🇵🇪 SOSA» ahora es «SOSA 🇵🇪»; la RED BULL CREW (letras en cuadradito, el VS que llega como texto, 〘〙, el podio por mención) pasa de no leerse a 15 filas; y las **votaciones con la mano** (🫲 izquierda, 🫱 derecha, ❌ réplica) dan los 17 ganadores de su canal. `comparar_lector` sobre las 549 filas de los otros seis: nada cambió. ⏳ **Para más adelante** (no frena nada): la fase de grupos (⚽️ marca quién pasa; hoy cuentan desde cuartos), el podio de sus 5 vidas y las llaves que publican de a una batalla por mensaje. Sus dos llaves sin campeón (GRUPO A del 03/10 y COMPE DE UDDI) van a Pendientes. **Sus FAT BATTLES PALOOZA cuentan** (*«2. Cómo veas tú»*: cada fecha es un torneo con llave de 16 y campeón; las ligas de FFS y DDF quedaron afuera porque eran jornadas y tabla, no llaves). **La tarjeta, aprobada** (*«3. Está buena»*) |
| **Las tarjetas de Servidor más simples, rehechas: Urban sí, FFA y DRA no** | *«quizás tengamos que reworkear las tarjetas… las más simples»* · *«solo reworkea el de URB y el de DRA»* · *«me gusta la nueva, pero ¿puedes usar no solo el ícono pero todo el logo para el círculo de arriba?»* · *«ya fue, solo actualiza el de Urban»* (04/10, 2:30 a 3:35 PM) | ✅ **2.28** (3:44 PM). **Urban es una pared**: el panel es concreto oscuro y la línea divisoria chorrea pintura naranja, como los chorreados de la «UK» de su logo (`urbf_pared()` en `los_nueve.py`): catorce chorreados puestos a mano —al azar salían parejos, un peine—, cortos en el medio para el nombre y sin tocar los círculos, el TAG ni el UL; la línea se calcula igual que `todos_sv.camino()` (0,12 px). **Su escudo lleva el logo entero**: fondo propio oscuro, como SR (`emblema.FONDO_PROPIO`), porque la corona y los chorreados naranjas se perdían contra el naranja; y más grande (`AJUSTE` 0.86 → 0.93: la tinta llega al 94 % del radio). **FFA queda como estaba** (se probaron escenario, neón y fuego, y Dlx lo dejó). **DRA también**: ni la rejilla con la onda (*«no me gustó nada»*) ni la tormenta, la ciudad o el escenario (*«ya fue»*). Las vistas previas quedaron fuera del repo |
| **¿Por qué no detectó los eventos de hoy?** | *«por alguna razón hay muchos eventos que han pasado hoy pero el bot no los ha detectado, ni siquiera las llaves… ¿puedes fijarte?»* (04/10, ~3:45 PM) | ✅ **2.29** (4:09 PM). **Medido, no supuesto**: el lector entero sobre las 306 salas de los 10 servidores del bot, y todo lo publicado desde las 00:00 ET. Hasta las 4 PM se jugó **un** evento, la COPA SOOLAR de FFA, y el vigía la sigue en vivo (se carga al terminar); el Red Bull Cabrana de Urban (5 PM ET) y el torneo de LCW (7 PM Chile) eran de más tarde; lo de FMH España es la liga de Urban por jornadas, que no cuenta. **Dos huecos de verdad**: (1) **«4 PM COLOMBIA» no tenía hora** —sólo se entendía la bandera—, así que el Red Bull salió sin cuenta atrás: ahora el país escrito vale como la bandera, en Python (`cuando.PAIS_NOMBRE`) y en el Worker (`PAIS_NOMBRE`), con dos casos nuevos en el contrato; (2) **el anuncio de LCW es una imagen** con «@everyone» y el «ARRANCA 7PM CHILE» va en su canal de inscripciones: no hay nombre que leer (⏳ a Dlx). **Y un error del Dashboard**: el vigía guarda tu Discord ID en `this.dueno`, el mismo nombre que la función del Dashboard, así que desde la primera vuelta del vigía daba «this.dueno is not a function». Ahora es `panelDueno()`, y `avisos_prueba.mjs` revisa que ningún método del objeto se pise con un dato |
| **La racha diaria y los niveles** | *«¿y un daily streak? al conectarse en cualquier parte de la Liga Global»* · *«¿quizás hasta niveles? para ver qué tan antiguo eres»* · a las preguntas, *«3. A o cualquier participación detectada 4. A pero podemos pensar en más cosas 5. A y B»* · *«implementa todas las sugerencias sencillas que acordamos»* (04/10) | ✅ **2.30** (4:20 PM). **Un día cuenta** (hora del este) si usaste el bot, hiciste algo en la página con tu cuenta o **jugaste un evento** (con la fecha del evento, no la de la corrida). **La racha** son los días seguidos; sigue viva todo el día si ayer contó. **Cada 7 días seguidos, +500 Puntos de Tienda** (uno por escalón de la racha de ahora: pedirlo dos veces no paga dos). **El nivel**: +10 por evento jugado y +2 por día que contó; el nivel N pide 10·N·(N−1) (20 el 2, 200 el 5, 900 el 10) y **no se reinicia** en las temporadas siguientes. **Arrancan en cero con la T1** (`desde`: lo de la prueba no cuenta). **Dónde**: los números y quién jugó qué días en `bot/racha.py` (viajan con lo del precio por cabeza, `precios:resolucion`, enteros en cada corrida); los días, la cuenta y el premio en el objeto (`activo`, `jugado`, `rachaDe()`, `premiarRacha()`); en la página, 🔥 al lado de tu cuenta, la racha y el nivel con su barra en Mi cuenta, y «Nivel N» y «🔥 N días» en cada perfil (`/api/avisos/niveles`, por clave, nunca por cuenta). Privacidad actualizada (el día, nunca la hora; se borra al pedir que te olvidemos). ⏳ Ideas para después: una racha especial de bienvenida, avisar el premio en la campana, y que las misiones sumen al nivel |
| **Las divisiones de la semana** | idea 7 del research (29/09): *«como otro tipo de eventos semanales»*, *«A»* · a las preguntas (04/10): *«1. A 2. C, subir a una división mejor y más competitiva supongo?»* · *«implementa todas las sugerencias sencillas que acordamos»* | ✅ **2.31** (4:33 PM). **Seis divisiones**, de Sexta a Primera; quien juega por primera vez entra en Sexta. **Estás en la tabla de una semana si jugaste un evento esa semana** (lunes a lunes a las 11 AM ET, la de los multiplicadores); quien no juega se queda en su división. **Grupos de 30** por orden de llegada (el que llega después no le cambia el grupo a nadie; un último grupo de menos de 10 se suma al anterior). **Cuentan los puntos de Temporada de la semana**: cada evento con su multiplicador y los bonos de la semana; el MW y el precio por cabeza no. **Al cerrar, en cada grupo suben los 5 primeros y bajan los 5 últimos** (un tercio en un grupo chico); **subir paga 500 Puntos de Tienda** (como el MW, enteros en cada corrida: `div:` en el objeto) **y da insignia** («Ascenso» y «Primera División»). **Se recalcula entero en cada corrida** desde `Resultados` (paso 1c, `sheet/rankings.py` → `bot/divisiones.py` → `datos/divisiones.json`), así una llave corregida corrige la tabla. Medido con los datos de hoy: la semana del 28/09 tiene 26 en Quinta y 153 en Sexta (cinco grupos), y la del 21/09 hizo subir a 33. En el Ranking, una pestaña nueva después de Temporada. **Arranca de cero con la T1** |
| **El merchandising de ejemplo** | *«en mercancía creá ejemplos de lo que sería nuestra mercancía… con nosotros y nuestros socios… no venderemos nada todavía pero sería un ejemplo»* (04/10) · *«implementa todas las sugerencias sencillas que acordamos»* | ✅ **2.32** (4:38 PM). En el Inicio, donde decía «Próximamente», una tira de prendas dibujadas en SVG plano (las reglas del remake): **remera negra, buzo magenta con «LIGA GLOBAL» y gorra blanca de UL**, **una remera de cada socio** con su color y su logo (los primeros cuatro con logo del lobby) y **una hoja de stickers** con los logos. Cada una dice **«EJEMPLO · NO ESTÁ A LA VENTA»**: sin precio ni botón. Mirado en `prueba.underlegends.pages.dev` a 1333 px antes de publicar |
| **El Score de 40 a 99 (A7), y /card sin FRZ, TWR ni FTN** | a «la escala A7 del Score… conviene decidirla antes de la T1»: *«5. ahora lo hacemos»* · a «sacar FRZ, TWR y FTN del menú de /card»: *«4. a»* (05/10, ~12:20 AM) | 🔁 **A7 se aplicó en la 2.33 (1:15 AM) y se deshizo en la 2.36 (~2:10 AM)**. Leí «ahora lo hacemos» como un sí, y la pregunta no decía en palabras qué cambiaba (sólo «A7»). Dlx: *«¿por qué cambiaste el score competitivo? desde cuándo cambiaste eso? son 8 rangos incluyendo el E… cada OVR de cada tarjeta calcula algo diferente»*. Vuelve todo a como estaba: el Score de 0 a 100, los cortes SSS 82 · SS 73 · S 62 · A 48 · B 37 · C 26 · D 18 · E. Mientras duró, nadie cambió de letra ni de rol. ✅ **/card** (00:40 AM): FRZ, TWR y FTN fuera del menú de la Servidor, como TFC y EFA |
| **El bot lee los afiches** | *«1. ¿no puedes hacer una forma para detectar lo que dicen las imágenes?»* (05/10, ~12:20 AM), con VALHALLA VOL1 de la ACADEMIA, que se anunció sólo con la imagen | ✅ **2.34** (~1:45 AM). **La IA de Cloudflare lee la imagen** (binding `AI` del Worker: sin token nuevo, entra en el plan gratis; modelo Llama 4 Scout): el ciclo baja el afiche achicado (640 px, JPEG) y lo manda a `/avisos/ocr` con su clave — 🔴 el Worker no puede bajarlo solo: el proxy de Discord le contesta 403 a Cloudflare. **El texto pasa por el mismo lector de anuncios** (`bot/anuncios.py`), con los rótulos que un afiche no escribe: el renglón con una hora es el HORARIO, el del día la FECHA, el de PREMIO el premio, y el primero el nombre (`rotular_afiche()`). **Sólo lo que parece un afiche**: un mensaje de eventos con imagen, poco texto y de los últimos 3 días, que el lector de texto no entendió; hasta 8 por corrida, y **cada imagen se lee una vez** (`datos/ocr_anuncios.json`). Medido en vivo: **VALHALLA VOL1** sale con «7PM CHILE · DOMINGO 4 DE OCTUBRE · $10» → el domingo a las 6 PM ET; y apareció otro que tampoco se veía, **MUERTE SUBITA** de DDF (03/10, 7 PM, $15). Lo leyó en 2 segundos. ⏳ El vigía (los avisos al minuto) todavía no lee afiches: entran con el ciclo, cada media hora |
| **El bot en vivo, en el chat de cada servidor** | *«quién ganará, datos extras… para que se enganche la gente»*, prendido por servidor (04/10) · a «¿en qué canal escribe?»: *«2. A»* (el chat general, 05/10 ~12:20 AM) | ✅ **2.35** (~2:20 AM). **Cuatro momentos por llave**, del vigía (`chatVivo()` en `bot/avisos.js`): 🎤 cuando sale la llave («Arrancó COPA SOOLAR · 16 en la llave · los favoritos: …», con su OVR y el link a Eventos), ⏱️ al cerrar cada ronda (un solo mensaje que se va editando: «Octavos: pasaron…»), 🔥 la final y 🏆 el campeón. **Los frenos, los de la propuesta**: nunca menciona a nadie (`allowed_mentions` vacío, sin vista previa del link), **como mucho un mensaje nuevo cada 10 minutos por servidor**, lo que quedó atrás se saltea (si ya hay final, la ronda que no salió no sale tarde) y de una llave quieta hace más de media hora no dice nada nuevo. **Arranca apagado en todos**: lo prende el admin de cada servidor con `/settings` (un menú nuevo: «Canal del bot en vivo»; vacío = apagado), y vos desde el **Dashboard** (por servidor: «lo decide su admin», prendido en el chat general que encontró el vigía, o apagado aunque el admin lo haya prendido). Probado sobre el objeto de verdad (SQLite) con Discord falso: un mensaje al salir la llave, la final y el campeón cada uno a los 10 minutos del anterior, y nada si está apagado |
| **Las tres de la ACADEMIA: VALHALLA, el torneo de grupos y UDDI** | a «¿cómo cuenta VALHALLA?» (A desde octavos · B con los filtros · C no cuenta), «¿quién ganó la final del sábado?» y «¿la COMPE DE UDDI la ganó Erian?»: *«1. B 2. Abyssus 3. Si»* (05/10, ~2 AM) | ✅ **2.37** (2:19 AM). **VALHALLA VOL1 cuenta con sus filtros**: los 8 enfrentamientos (9 a 12 personas, sin marcar quién pasó) estaban en otro mensaje —otro autor, 2 h antes— y la llave se llamaba «COMPE DE 10 DOLARES». `escuchar.con_fase_previa()` junta una fase por grupos con la llave del mismo canal que viene después (8 h como mucho) si el 75 % de su primera ronda está en la fase; quién pasó lo dice la llave, como en una batalla de N bandas, y el que estaba anotado en dos grupos va una vez. Quedan **78 filas y 83 personas**, con el nombre de los filtros. **Lo que Dlx decide de una batalla va antes de preguntar por el campeón**: la final del torneo de grupos del 03/10 la ganó **Abyssus** y la llave ya no queda incompleta (se sigue llamando «GRUPO A»: no tiene anuncio). **COMPE DE UDDI** puso en la final sólo «ERIAN»: la final va como decisión del evento (`final`, `decidir.final_decidida()`), y el otro finalista, **COLESITO**, sale de sus votaciones (le ganó 2 a 1 a ZETRYKO en la segunda réplica). `comparar_lector`: 0 filas cambian en los otros eventos |
| **Las Misiones de la semana** | la propuesta del 04/10 (*«3. A»*): tres por semana, para todos, que suman a la Temporada · *«empezá ya»* (05/10, ~2:30 AM) | ✅ **2.38** (~3 AM). **Las mismas tres para todos**, una fácil, una media y una difícil, sorteadas con la semana como semilla (`bot/misiones.py`): **fácil** «Jugá 2 eventos» · «Ganá un duelo» · «Jugá un evento del servidor con el multiplicador más alto»; **media** «Ganá 3 duelos» · «Llegá a una semifinal» · «Jugá en un servidor donde todavía no jugaste esta temporada»; **difícil** «Llegá a una final» · «Ganá 5 duelos» · «Ganá un evento». Ninguna se repite seguida en su nivel, y no repiten lo que la semana ya paga sola (Pasaporte y Asistencia). **Se cumplen jugando**, con lo que dicen las llaves. **Puntos (provisorios, van con el rebalanceo del final): fácil 300 · media 600 · difícil 1.000, y +1.000 por las tres**, a la Temporada (`rankings.sumar_misiones()`, una corrida atrás como el precio por cabeza; nunca al Competitivo). Se recalculan enteras en cada corrida (paso 1c) y van a `datos/misiones.json`. **En la página**: la pestaña «Misiones» del Ranking (las tres, cuánto llevás si entraste con Discord, quién sumó esta semana y en la temporada) y la columna «Misiones» de la Temporada. **La primera semana es la del lunes 05/10 a las 11 AM ET**: se ven con la corrida de las 11:22 |
| **Las divisiones, también en el Inicio** | *«me gustaría eso de que divisiones tenga su espacio en INICIO también como una previa. Quizás ese pueda ser el primer panel donde está tu temporada y encuestas»* (05/10, ~11:40 AM) | ✅ **2.39** (~11:50 AM). **Una pestaña «Divisiones» en el primer panel del Inicio**, entre Encuestas y Tus eventos (`DivisionPrevia` en `web/src/divisiones.jsx`): tu grupo de la semana —los de la zona de subida, y vos si estás más abajo, con el corte marcado— o, si no jugaste, el grupo de la división más alta con gente; y el link a la tabla entera. 🔴 **Y un error que salió al probarlo**: cada lunes a las 11 AM las divisiones **desaparecían de la página** —la pestaña del Ranking incluida— hasta que se procesara el primer evento de la semana nueva, porque `divisiones.para_web()` devolvía nada si nadie había jugado. Ahora viajan igual: «Semana nueva», en qué división estás, cómo cerró la anterior y los que subieron, con su cara |
| **El Pase de rapero** | la propuesta del 04/10 (*«3. A»*: 30 niveles, Tareas, premios de perfil) · *«Empieza ta.. y no se el nombre»* · *«si sigue con todo eso.»* (05/10, ~11:30 AM) | ✅ **2.40** (~12:45 PM). **Sólo los miembros de DRA** (el rol Miembro, `datos/verificados.json`); los demás ven qué es y cómo sumarse. **Cinco Tareas por semana** (lunes 11 AM ET, con las misiones): entrá 3 días seguidos (los días de la racha), jugá un evento en DRA, completá tus misiones, felicitá a 3 personas (👏) y mirá una llave en vivo (20 s abierta, con tu cuenta). **Cada Tarea es un nivel**, 30 por temporada; una cumplida no se pierde (`pase_hecho` en el objeto). **Premios** (provisorios, van con el rebalanceo): 200 Puntos de Tienda por nivel; el 5 insignia «Pase Bronce», el 10 título «De la casa», el 15 «Pase Plata», el 20 el nombre en dorado, el 25 «Pilar de DRA», el 30 «Pase Oro» para siempre (500 y 1.000). **Dónde vive**: las reglas en `bot/pase.py` (paso 2b4b del ciclo), la cuenta en el objeto (`paseDe()`, `paseRevisar()`), la página en `web/src/pase.jsx`; el aviso de nivel nuevo va a la campana (sin push). 🔑 **El ciclo le habla al objeto directo, no por KV** (`/avisos/pase-ciclo`, con su clave): KV iba 931 de 1.000. **Esta semana es de prueba: el 12/10 vuelve a cero.** También: el Inicio deja de decir «próximamente» en Misiones y el Pase, el perfil muestra «Pase N · título» y el nombre dorado, la Guía explica Misiones, Divisiones y el Pase, y la privacidad lo dice. ⏳ las insignias del Pase en la pestaña Insignias del perfil |
| **Lo que gasta Cloudflare, medido, y el plan para crecer** | «¿cuántas escrituras tiene el KV ahora?» · «¿por qué tanto a estas horas?» · *«poco a poco se unirán más servidores… quiero que veas cómo se ve la curva»* · a la propuesta: *«1. Ok… 2. sólo los que jugaron… 3. ok»* (05/10, de ~11:45 AM a ~2 PM) | ✅ (sin versión: no se ve). **Medido**: KV llegó a 931 de 1.000 escrituras antes del mediodía (el 04/10, 1.062: se pasó desde ~5 PM), y en una semana sus lecturas pasaron de 32 % a 63 % del techo y **las filas que lee el objeto de 97.000 a 1,9 millones por día** (techo: 5 millones). Con 3 o 4 servidores más, las lecturas cruzan antes que las escrituras. **1 · las lecturas**: el objeto cuenta qué consulta lee cuánto y el Worker qué ruta lee KV (`medidas` en `/avisos/estado`, sólo números); el 57 % eran dos limpiezas que recorrían la tabla entera cada minuto, y con sus índices bajaron un 95 %. **2 · las escrituras**: al instante sólo lo de quien jugó; lo que se movió porque jugó otro (puestos, percentil, OVR, «#N»), la gente nueva y los índices esperan a la hora tranquila (11 AM a 5 PM ET) con lo que sobre (`subir_datos.puede_esperar()`): de 209 pendientes, 145 podían esperar. **3 · mudar lo de cada persona al objeto**: cuando con los servidores nuevos las escrituras de los que juegan se acerquen al techo. ⏳ guardar lo público en el borde (la portada, lo en vivo) cuando el contador del Worker diga quién lee KV |
| **Quién tiene cada tarjeta: sin verificarse, ninguna; la Temporada, con el nivel 1 del Pase** | *«no todos tienen que tener una tarjeta»* · *«si alguien nuevo usa el comando, que le diga que tiene que verificarse en la página… y así desbloquea la tarjeta de servidor para cada sv que él se encuentre»* · a la Temporada: *«C»* (la recompensa del nivel 1 del Pase: *«verificarse te une a DRA… y para hacer conocer más la página»*) · *«1. dale, pero a mí no porque así pruebo las cosas · 2. desde ahora · 3. A · 4. nivel 1»* · *«B»* · a la vista previa: *«Si»* (05/10, de ~1 PM a ~3 PM) | ✅ **2.41**. **Sin verificarse, ninguna tarjeta**; la **Servidor**, al verificarse (la de cada servidor donde estás); la **Temporada**, con el **nivel 1 del Pase** —quien llega sin haber jugado la tiene con «—» y se llena con su primer evento—; la Competitiva y la de País, como siempre. **Quien ya las tenía las conserva hasta la T1** (`datos/conservan.json`: 272 Temporadas y 508 Servidor, 142 de gente sin verificar). **Dlx, fuera de todas** (`verificados.DUENO`). Las **Bloqueadas**, sin la de Temporada y sólo para los que juegan. /card explica los dos pasos con el botón del Pase. Todo sale de `verificados.puede()`; el ciclo sabe los niveles por `datos/pase_niveles.json` (`/avisos/pase-niveles`). Medido antes: 669 personas con tarjeta, 345 que jugaron, 8.193 archivos (5.214 camisetas). ⏳ borrar de R2 los ~4.000 archivos que nadie puede abrir (camisetas viejas, la pre-temporada, las Bloqueadas de quien nunca jugó) |
| **El logo de FFA, a color en la Temporada** | *«¿puedes hacer que el logo de FFA en la temporada se haga visible con sus colores? porque aparece blanco»* · a la vista previa: *«Si»* (05/10) | ✅ **2.41**. El escudo a color de la carta Servidor (`comun/escudos_cuad/sv_ffa.png`, sólo la tinta) en vez de la silueta blanca, sobre oscuro y entero adentro del círculo. Sólo en la Temporada (`A_COLOR` en `01_Temporada/normal_v3.py`); la Competitiva y la de País siguen con la silueta |
| **La llave en vivo con el número equivocado: la huérfana, también en vivo** | *«estas llaves en vivo no se detectan por alguna razón, pero el bot en sí envió un mensaje ya»* (05/10, ~3 PM, con captura de la DESGRACIAS EN TOKYO) | ✅ **2.42**. FFA anunció **«DESGRACIAS EN TOKYO VOL 23 1v1»** y la llave dice **«VOL 22 1v1»** —el organizador copió el título de la anterior—. La llave se leía bien (las batallas de a tres también); lo que fallaba era juntarla con su anuncio: por nombre, dos ediciones distintas no se juntan nunca («VOL 11» y «VOL 12» son dos eventos). El ciclo ya lo resolvía desde el 29/09 con la **llave huérfana** (`_huerfanas()` de `sheet/llaves_web.py`) y la página en vivo no. Ahora las dos usan las mismas reglas —la misma serie, una llave que ningún otro anuncio se lleva, publicada después del anuncio y antes del siguiente de esa serie, la misma forma, y una sola candidata—, en **un solo lugar**: `LlaveVivo.deEvento()` de `bot/paginas/llave_vivo.js`, que usan la página (`llaveDeEvento()`) y el bot en vivo. **Y el bot dice el nombre del ANUNCIO**, no el de la llave: había mandado «Arrancó … VOL 22». Probado con la llave de esa tarde (`bot/llave_vivo_prueba.mjs`, parte 8) |
| **Cuánto habla el bot en vivo: lo justo, normal o cada batalla** | *«quisiera que sea por cada llave o que haya un nivel de intensidad de que el bot hable por cada evento en vivo»* (05/10, ~3 PM) | ✅ **2.42**. Tres niveles (`NIVELES_CHAT` de `bot/avisos.js`): **lo justo** (el arranque y el campeón), **normal** (lo de siempre: además quién pasa cada ronda y la final, como mucho un mensaje cada 10 minutos) y **cada batalla** (quién gana cada una apenas la llave lo muestra; si se juntan varias van en el mismo mensaje, como mucho uno cada 2 minutos, y si se juntaron más de 8 van las últimas). Lo elige el admin de cada servidor en `/settings` (la quinta fila, `vivo_nivel`) y vos desde el Dashboard, por servidor (`en_vivo_nivel`, que gana). Sin elegir, **normal**: no cambia nada para nadie hasta que alguien lo elige. Sigue sin mencionar a nadie |
| **El Dashboard: el bot en vivo, lo que está en vivo, las corridas del ciclo, Cloudflare y el Pase** | *«añade eso de intensidad en dashboard para mí. Añade otras opciones al dashboard que tú veas»* (05/10, ~4 PM) | ✅ **2.43** (sólo en tu Dashboard). **Cuánto habla el bot**, por servidor (lo justo · normal · cada batalla), al lado de prendido o apagado. **En vivo ahora**: cada llave que se está tocando, de qué anuncio es y cómo se juntó —por el nombre, «por la serie» (la huérfana) o el nombre que el bot ya le había dado—, en qué ronda va, cuánta gente tiene y qué dijo el bot en el chat (`vivoDueno()` en `bot/avisos.js`). **Las corridas del ciclo**: las últimas de GitHub con su estado y cuánto tardaron, un aviso cuando GitHub Actions tiene un incidente (hoy canceló las de las 3:52 y las 4:22), y **▶️ Correr el ciclo ahora** (dos toques; como mucho una vez cada 10 minutos; `/avisos/dueno/ciclo`). **Cloudflare hoy**: KV, el objeto, el Worker y R2 contra su techo, con lo que mide el ciclo en cada corrida (`datos/estado_*.json`: no cuesta nada nuevo); lo que pasa del 90 % también sale en rojo en el panel del Inicio. **El Pase en números**: miembros, cuántos tienen nivel, las Tareas de la semana y cuántos hay en cada nivel —nunca quién— |
| **La pasada de errores de todo lo nuevo (2.40 a 2.42)** | *«aprovecha esta sesión para terminar eso y también para arreglar bugs y errores porque hemos añadido bastantes cosas nuevas. Tómate tu tiempo»* (05/10, ~4 PM) | ✅ **2.43** (~6 PM). Tres revisiones a la vez (~32 hallazgos), cada uno verificado y con su prueba. **Lo que se ve**: los dos pasos de las tarjetas dichos igual en todos lados —la Guía vieja y la nueva, Mi cuenta, el perfil, Tarjetas, `/card`, `/verificar` y `/foto` todavía decían la regla de «las LIBRES» del 29/09—; Misiones y Divisiones dicen el día en que cierran en tu zona (decían «el lunes» fijo), la fila sin SUBE ni BAJA ya no corre sus números, y quien juega la temporada ve «0» en una misión y no «—». 🔴 **Y una llave en vivo que se perdía, encontrada en vivo**: FFA anunció **«DESGRACIAS EN TOKYO VOL 24 2v2»** con la modalidad **«1v1»** (copió el anuncio de la VOL 23) y su llave era de equipos: por la modalidad, un 1v1 no se lleva una llave de equipos, y el evento se jugaba sin llave en la página. Ahora, si el nombre y la modalidad se contradicen, la forma no se sabe (`forma_del_anuncio()` en Python y en JS; el nombre sólo anula, nunca descarta solo). Medido sobre los 47 anuncios de la temporada: es el único que se contradice y ninguna llave del historial cambia de dueño. **Las llaves en vivo**: la página, el bot y el ciclo asignan igual (`LlaveVivo.asignar()`, las dos pasadas de `cruzar()` sobre todos los anuncios a la vez: preguntando de a uno, la VOL 22 podía llevarse la llave de la 23); un anuncio sin hora se mide desde que se publicó; «1🆚1» ya no cuenta como edición en Python; y el emparejador guarda lo que calculó: un dibujo de la página bajó de 60 ms a menos de 1. **El bot en vivo** conserva el nombre que le dio a una llave aunque el anuncio salga de la ventana (`nombres_vivo`: al editar había mandado «… VOL 22»), en «cada batalla» dice quién pasa de cada grupo, y ante un 403 o 404 se calla 30 minutos y ante un 429 lo que Discord pida. **Lo que no se ve**: lo pausado o vencido ya no cuenta como cancelado (`NO_SALIO`); la fase de grupos de una llave se guarda (`datos/fases_llaves.json`, en `guardar.sh`): si el mensaje de los grupos quedaba fuera de lo que lee una corrida, VALHALLA se procesaba sin sus filtros; `subir_datos` no borra las claves de quien espera su carta; `fuera.py` borra carta por carta; `que_cambio` redibuja la carta que falta en R2; `pase.py` no pisa los niveles con un objeto vacío ni con la mitad de la gente (de ese archivo sale quién tiene la Temporada); la misión del multiplicador más alto mira el de la hora de cada evento; el pago de las Divisiones se fecha en su semana (17 UTC, no 12); índices nuevos en el objeto (`pase_hecho`, `tienda`, `inscritos`); el Pase no acepta un id inventado; una visita se cuenta una vez cada 6 h; y el paquete de la página no creció (128,5 KB): el CSS del Dashboard y del Pase viaja con su pedazo |
| **La ACADEMIA no contaba como el servidor de nadie** | lo encontré revisando *«¿ya arreglamos el problema de las tarjetas? confirmas»* (05/10, ~6 PM) · a la explicación: *«2. perfecto»* | ✅ **2.44** (6:22 PM). La hoja «Ranking Temporada» terminaba en DDF: la columna LCW (ACAD), que entró al código el 04/10, nunca llegó a la hoja, porque la tabla se arma con la cabecera que TIENE la hoja y sólo `rehacer_estructura()` —a mano, vaciándola— la alargaba. Los eventos de ACAD de **108 personas** no se anotaban en ninguna columna, y `construir_pool_temporada.py`, que busca los servidores por la cabecera, les dio otro a **6 que jugaron más en ACAD** (Kochi, Eclipsito, Panchok, NXUZ, Leonart y Carlos): el escudo de su Temporada era el de FFA, URB, DDF o SR. La columna `Sv` de la vitrina sí decía LCW. Ahora la cabecera se alarga sola al final con lo que le falte (`columnas_que_faltan()` y `alargar_cabecera()` en `sheet/rankings.py`): nunca mueve ni borra, y una hoja con otra forma no se toca. Aplicado en la corrida de las 6:22: 32 columnas, 337 filas sin una celda mal, y el pool de temporada pasó a tener **62 personas de ACAD**. El próximo servidor que entre ya no repite esto |
| **SOL y SOL🇵🇪 son la misma persona** | *«3. Sol y Sol pe son la misma»* (05/10, ~6:25 PM) | ✅ el par en `datos/akas_a_mano.json`, como KENNY: «SOL», sin bandera, jugó en Snake (#363) y «SOL🇵🇪» en FFA (#366) y en ACAD; ninguno está en la Lista, así que el ranking los tenía como dos desconocidos con la misma clave. El nombre real lleva la bandera para que conserve Perú. Simulado antes de subirlo: los dos dan SOL🇵🇪, y ElSolar, Soli y Solar no cambian. Lo aplica la corrida de las 6:52 |
| **Los eventos en vivo que el Inicio no contaba** | *«fijate por qué en inicio no están contando los eventos en vivo ni tampoco esa página de paneles negras que había»* (05/10, ~10 PM) | ✅ **2.45** (10:15 PM). Había dos llaves en vivo —COPA SOOLAR 3 (FFA) y GALACTICOS VOL.7 (DDF)— y el Inicio mostraba una: **el calendario daba por jugada a COPA SOOLAR 3 con la llave #394, que es la de COPA SOOLAR del sábado**. Cada anuncio elegía su llave por separado, «3» contra ningún número no choca y la ventana del cruce es de días, así que dos anuncios se llevaban la misma. Ahora **una llave es de un solo evento** (`cruzar()` en Python y `LlaveVivo.asignar()` en JS, la misma regla): del anuncio que más se le parece y, a igual parecido, del más cercano; los que arrancan a la misma hora (±2 h) son el mismo evento anunciado otra vez y la comparten; y una llave publicada más de 12 h antes del arranque no es de ese evento. Medido sobre los 50 anuncios de la temporada: cambian dos, COPA SOOLAR 3 (el arreglo) y el anuncio del sábado de FAT BATTLES FECHA 4, que el lector fechó un día antes («DOMINGO - MAÑANA» leído como sábado) y pasa de un «TERMINÓ» duplicado a «SIN LLAVE». ⏳ Que el lector de anuncios lea el día escrito en el título. ❓ «La página de paneles negras»: creo que es el panel del escenario de ese segundo evento en vivo, que no se armaba por lo mismo — si era otra cosa, falta confirmarlo |
| **El Pase de rapero, como Brawl Stars: con XP** | *«haz un deep research de cómo es BRAWL STARS su pase… solo dar PUNTOS para la tienda es algo tonto»* · al borrador, *«1, sí»*; *«2. B»*, *«4. B»*, *«5. c»*, *«7. A»*; los premios nuevos, *«ninguno de momento»*; en el 30, *«B»* (06/10, ~12:30–1 AM) | ✅ **2.46** (~1:40 AM). **Las Tareas dan XP y la XP sube de nivel**: 2 diarias (cambian a la medianoche del este; «Entrá hoy» siempre y la otra se turna), 5 semanales («Entrá 3 días» ya no pide que sean seguidos; «Mirá 2 llaves en vivo»; «Poné precio a una cabeza») y 8 de temporada, en cualquier orden. **Ninguna es una Misión** (*«hay TAREAS y misiones que son diferentes»*): «Completá tus misiones» salió, y lo que ya se había cumplido en la prueba sigue valiendo. Los tres primeros niveles piden 300 XP y los demás 1.000 (completarlo: 27.900, menos de la mitad de lo que se puede juntar en la T1). **Cada nivel paga poco** (150 Puntos de Tienda) **y después del 30 sigue la cola**: cada 1.000 XP, 300 más. **Quien completa el Pase entra al Salón del Pase**, en el orden en que llegó. **Llegar al 10 («De la casa») y completarlo sale en Publicaciones** para que te feliciten. La página, el Inicio y el Dashboard, con la XP. Las cartas no cambian. ⏳ Los números siguen siendo provisorios: van con el rebalanceo del final |
| **La final de la COPA DE GRUPOS LCW la ganó Zetryko** | *«el zetryko vs abyssus la había ganado zetryko no abyssus»* (06/10, ~1:40 AM) | ✅ La llave de la ACADEMIA (#401, 03/10) no decía quién ganó la final, y el 05/10 la respuesta había sido «2. Abyssus». Corregido en `datos/decisiones.json` (las dos claves: «GRUPO A» y el nombre de ahora); el ciclo reprocesa la temporada entera, así que la corrida siguiente deja a Zetryko campeón, a Abyssus subcampeón y el duelo de la final para Zetryko |
| **TOKIO no tenía tarjeta: es TøKīØ** | *«TOKIO dice que por qué no tiene tarjeta si ganó evento»* · a «¿le pongo esa cuenta a Tokio?», *«A»* (06/10, ~2 AM) | ✅ Sus resultados (campeón de la COPA SOOLAR 3, semifinal en la 2) caían en «Tokio 🇦🇷», una fila de la Lista sin cuenta, y su cuenta (@paratimiringuicaro, que se anota «Tokio» en FFA) ya era la de «TøKīØ🦠🧠 🇺🇸», verificada y sin resultados: por eso `/card` no le daba la Temporada. Unidos como SOL (`akas_a_mano.json`, `pares`), y TøKīØ conserva la Temporada que tenía como «Tokio» (`conservan.json`, con la nota). Las vitrinas los funden en la corrida siguiente al alias, y ahí se dibuja su carta |
| **«La página no puso esa compe»: las dos PRITTY FREE del 05/10, y Pain es Snow** | captura del DM de Snow (06/10, ~5:45 PM): *«la pagina no puso esa compe»* · *«yo soy pain… no me detecta como snow en la pagina»* | ✅ **2.47**. FFA hizo dos PRITTY FREE el mismo día —la Clasificatoria 2 a la 1 AM y la 3 a las 10:55 PM—; las dos llaves tomaron el nombre «PRITTY FREE» de su anuncio (la línea del título dice «CLASIFICATORIA», que el lector lee como ronda) y, con la misma fecha, quedaron en UN evento: el #402, con dos finales. Ahora la de la noche es «PRITTY FREE CLASIFICATORIA 3» (`datos/nombres_llaves.json`) y el lector no vuelve a juntar llaves de dos anuncios distintos: la segunda lleva lo que agrega su título, o la hora (`nombre_propio()` en `bot/llaves_a_entrada.py`). Y «Pain» es alias de Snow (`akas_a_mano.json`): lo dijo él y el organizador lo etiquetó en el equipo «Shisui + Pain». Dlx lo confirmó: *«pain es su otro aka de snow»*, así que DEM UZBEKISTAN (06/10, «Pain🇯🇵» en cuartos y «Snow» en la final con Provenza) también es suyo. Y la DESGRACIAS EN TOKYO VOL 25 1v1 (06/10, Snow subcampeón como «PAIN», con su mención) terminó a las 5:56 PM, cuatro minutos después de que la leyera el ciclo de las 5:52: entra en la corrida de las 6:22, y el alias se funde en las vitrinas en la de las 6:52 |
| **El KV, otra vez cerca del techo: los datos de cada persona, al objeto** | *«primero termina en hacer lo que estabas haciendo y segundo yo pensé que este problema lo habías resuelto, pensé que lo habías movido al object»* · *«me habías propuesto eso y yo te dije cómo quiero que funcione»* (06/10, ~8 PM) | ✅ **Hecho a las 8:35 PM.** Lo del 05/10 —«1. Ok», «2. sólo los que jugaron», «3. Ok»— se hizo a medias: las lecturas y lo de «sólo los que jugaron» sí, y la mudanza (el 3) la dejé «para cuando haga falta». Hizo falta: 909 de 1.000 a las 7:57 PM. Ahora los datos de cada persona para /card viven en el Durable Object (tabla `persona`, 100.000 filas por día) y el ciclo los manda en un pedido; KV queda para los índices de Discord ID y `meta`. Primera corrida: **509 personas al objeto y 22 claves de KV en vez de 203**. Si el objeto no contesta, /card lee KV como antes |
| **Shisui es Velatz** | el mensaje de Velatz que reenviaste (06/10, 8:42 PM): *«Shisui y Velatz son la misma persona osea q Shisui soy yo y pues es mi nombre artístico x un personaje de naruto»*, y que los puntos vayan a la cuenta de Velatz | ✅ (sin versión: es un dato). **Comprobado antes de unirlo, y no sólo por su palabra**: la misma cuenta de Discord —la de Velatz en la Lista— se anotó como «Velatz» hasta el 03/10 y como «Shishui 🇯🇵» y «Shisui 🇯🇵» desde el 04/10, y el organizador de la PRITTY FREE etiquetó esa cuenta como «shisui». Ningún evento tiene a los dos. Unidos «Shisui», «Shishui» y «SHUSUI» (así quedó escrito en la VOL 25, #413) a Velatz, en `akas_a_mano.json`: suma siete eventos de FFA (del 04 al 06/10, con la VOL 26 de esta noche): aplicado en la corrida de las 10:22, pasa de 21 eventos a 28, de 51.414 puntos a **110.414** y **del #12 al #3** (Snow #1 con 133.371, Panchok #2 con 116.338; Oasis tiene más puntos pero no lleva número), con OVR 82. ⚠️ **No es la suma de las cuatro filas (125.801), y está bien**: separados, Shisui cobraba lo de alguien nuevo —el «Volvé», ×1,5 al segundo evento (el subcampeonato de la COPA SOOLAR 3), y los bonos de la semana (Pasaporte, Asistencia)— además de los de Velatz; unido, una vez. Las misiones (2.900) y la cabeza de Lord Viruzz (250) se leen de la corrida anterior, que las tenía a nombre de Shisui: entran en la de las 10:52 (113.564, sigue #3). Su queja de las 9 PM —*«ahora estoy top 12, bajé más de lo q estaba»*— era esto: el #12 era Velatz solo, con Shisui aparte. Lo verificó la corrida de las 8:52 (Miembro de DRA), así que ya lleva número y puede tener cartas. (Los alias los arma una corrida y las vitrinas los funden en la siguiente: por eso entró a las 10:22 y no a las 9:52.) |
| **La PRITTY FREE de la noche del 05/10 salía dos veces en Eventos** | la revisión de *«asegurate de q todo funcione bien»* (06/10, ~8:50 PM) | ✅ **2.48**. Lo que había quedado del arreglo de la 2.47: la llave se llama «PRITTY FREE CLASIFICATORIA 3» y su anuncio sólo «PRITTY FREE», así que el cruce no los juntaba, y el calendario mostraba el anuncio como no jugado y la llave aparte, sin formato ni rango. Ahora una llave sin anuncio también es del anuncio cuya serie empieza igual, con al menos 8 letras para que «COPA» no se lleve cualquier copa (`_serie_de_llave()` en `sheet/llaves_web.py`, con su caso en el self-check). Medido sobre los 143 anuncios: cambia ése y ningún otro |
| **¿A alguien más le pasa lo de Velatz?** | *«revisa que otros usuarios no tengan ese error»* (06/10, ~9:15 PM) | ✅ Revisadas las 331 cuentas que se anotaron o que un organizador etiquetó, buscando una cuenta que juega con otro nombre que suma aparte. **Por qué pasa**: el bot une solo los nombres de una cuenta cuando se anota siempre igual; si usa dos distintos, la trata como alguien que anota a otros —el caso de Player y Steven— y no une ninguno. Y una fila de la Lista sin cuenta («Shisui», «Kude») junta los puntos sin que nadie pregunte quién es. **Unidos tres más**, con la misma prueba que Velatz (su propia cuenta se anotó sola con los dos nombres, ninguna otra los usó y nunca jugaron el mismo evento): **Kude → Mr.Kude**, **NAKAMURA → Hassan** y **Nhp → Andres** (@andresnhp). Ninguno está verificado, así que el portón no cambia. Las otras coincidencias eran cuentas que anotan a amigos u organizadores (Player, CrisZJ, Benjixo…). ❓ Quedan para vos **RT, SOL y Alonso** —verificados, y su cuenta se anotó con ese nombre, pero su fila del ranking no la tiene: sin número ni cartas— y dos dudosos, **Emi** (¿EmiZor?, que también anota a otros) y **DSM-5** (¿MTZ?, una sola vez) |
| **RT, SOL y Alonso con su cuenta; Emi y DSM-5, unidos** | a las preguntas de la revisión: *«1. A»*, *«2. únelos»* (06/10, ~10:50 PM) | ✅ RT y SOL entraron a la Lista con su cuenta y a Alonso se le puso la suya (los tres verificados y sin número: lo toman en la corrida de las 11:22). «Emi» es EmiZor y «DSM-5» es MTZ (`akas_a_mano.json`). 🔴 **Y la Lista de Raperos estaba llena**: tenía las 1.000 filas con que Sheets crea una hoja, escribir en la 1.001 es un 400 y el alta sola de ✅ Decidir iba a fallar con la próxima persona. `escribir.poner()` ahora agranda la hoja y reintenta (le agregó 201) |
| **El ciclo lo hace solo: una cuenta, dos nombres** | a «¿querés que el ciclo lo haga solo?», *«sí»* (06/10, ~10:50 PM) | ✅ **2.49**. En cada corrida, ✅ Decidir mira las inscripciones de UN nombre (sin nota entre paréntesis) y las menciones del organizador —las dos firmadas por Discord— y: **une** el nombre que suma aparte con la fila de su cuenta si hay dos pruebas o más, ninguna otra cuenta lo usó, nunca jugaron el mismo evento y la cuenta juega con su nombre o ése es el único otro que usa; **engancha la cuenta** de quien no está en la Lista con la misma prueba (si está en algún servidor de la Liga); y **pregunta** «¿es la misma persona?» con una sola prueba si los nombres se parecen, o cuando la cuenta anota a varios. Contestar «es la misma» los une y «otra persona» los marca distintos, así no vuelve a preguntar. Un nombre de equipo nunca se une solo: probado en seco, iba a darle a Pcyka los puntos de «Crack and Krank» (su cuenta se anota «CyK»), y ahora lo pregunta. En seco con los datos de hoy: N1k entra con su cuenta y esa pregunta va a ✅ Decidir; lo demás ya estaba hecho a mano (`una_cuenta_dos_nombres()` en `sheet/decidir.py`, con 14 casos en el self-check) |
| **🔴 La PRITTY FREE contó dos veces una corrida (12:52 AM), por un arreglo mío** | lo encontré verificando la corrida de las 12:52 (07/10, ~1 AM) | ✅ Para que el calendario la cruzara con su anuncio le cambié el nombre a la llave («PRITTY FREE 3»), y el evento se identifica por nombre, servidor y fecha: entró como OTRO evento, el #417, con el #412 todavía cargado. Los 16 que la jugaron cobraron ese evento dos veces en la Temporada escrita a esa hora, y **Lord Viruzz**, que tiene 9 eventos, pasó a 10: ganó la insignia de 10 eventos y Publicaciones anunció su «rango D» y su Competitiva. **Arreglado**: la llave vuelve a su nombre (#412), el #417 queda como «no cuenta» en `decisiones.json` y `sacar_descartados()` lo saca en la corrida de la 1:22; la insignia y las dos publicaciones se sacaron a mano (no se deshacen solas) y su estado del muro volvió al de antes, así se publica cuando llegue de verdad. Lo demás se recalcula entero en cada corrida (precios, misiones, rachas, Most Wanted, Tienda). **El calendario se arregló como había que hacerlo**: la llave que el lector nombró con su anuncio guarda el id de ese anuncio en `nombres_llaves.json`, y `cruzar()` ahora lo usa primero —sin medir parecidos—; sobre los 143 anuncios cambia ése solo. ⚠️ **A una llave no se le cambia el nombre en `nombres_llaves.json` una vez cargada**: dice por qué en esa misma entrada |
| **La revisión de todo lo de esta noche, con dos revisores** | *«asegurate que tus cambios hagan que todo siga funcionando como se debe... tomate tu tiempo y arregla esos errores y bugs»* (07/10, ~12 AM) | ✅ Cada hallazgo verificado antes de tocarlo. **El paso que une solo (2.49) era demasiado suelto**: «el único otro nombre» miraba sólo los que tienen puntos —la cuenta de un organizador que anota a Juan dos veces y a otros una se tomaba por Juan—, a una cuenta que juega se le unía cualquier nombre con dos inscripciones —Player, el día que anotara a Steven otra vez—, las pruebas se contaban por mensaje —la misma llave guardada dos veces daba dos— y la bandera de una fila nueva salía de la inscripción aunque fuera de adorno («Shisui 🇯🇵»). Ahora: exclusivo sobre TODOS los nombres de la cuenta, pruebas por servidor y día, si la cuenta no juega el nombre tiene que parecerse al suyo (Kude/Mr.Kude), nunca solo con un nombre de equipo, dos filas o un par ya preguntado, sólo banderas de la Liga, y la pregunta que quedó vieja se cierra sola; con los datos de hoy no cambia nada (21 casos en el self-check). **El calendario**: la regla del prefijo de la 2.48 podía darle una llave al evento equivocado («FREESTYLE 1VS1» se llevaba «FREESTYLE NIGHT KINGS»): se sacó, y esa llave se llama «PRITTY FREE 3», que se cruza por nombre con las reglas de siempre —en vivo ya se juntaban—. **Si el objeto no toma las personas**, un segundo intento y un aviso; ya no van a KV, donde /card no las leía y se comían el cupo. **La auditoría de los lunes fallaba desde el 05/10**: contaba como error el 🔒 de las tarjetas en dos pasos, y además iba a contar como rotas a las personas que sólo están en el objeto; arreglada (`simular.mjs`, `volcar_kv.py`): «TODO BIEN». **`olvidar.py --hacer`** borra también la fila del objeto. `quien_puede_card.py` ya no da «sin indexar» falsos, `verificar.py` lee como /card, el freno de la Temporada tolera 3 filas y no 5, y una prueba nueva comprueba que /card lee del objeto y de KV si el objeto no contesta. **Christopher** (usó /card a las 10:55 PM, justo con la Lista llena) quedó afuera y se agregó. ⏳ Sin hacer, por bajos: un tope de tiempo para leer del objeto, y que el objeto avise si descarta un dato (lo avisa el ciclo) |
| **Los niveles del Pase, dibujados y arriba de todo** | *«hacerle un remake para q se vea mas grafico… como brawl stars que cada nivel tiene su [premio]… en vez de simples cuadrados»*; a la preview, *«está mejor… ponlo arriba de todo en la parte del fondo negro… y no olvides las flechas»* (07/10, ~1 PM) | ✅ **2.50**. Cada nivel es una carta con su premio dibujado (monedas de la Tienda, tu tarjeta, medallas de bronce, plata y oro, la cinta del título, «Aa» dorado y el trofeo del Salón al final), un riel dorado que se llena de nodo a nodo hasta tu XP, ganados con tilde y el siguiente en magenta. Vive en la escena negra, debajo del título; se desliza, abre en tu nivel y lleva flechas que se apagan en las puntas, también en el celular. La grilla de cuadrados se fue (`web/src/pase_pista.jsx`). Los dibujos tienen sombreado (las cajas siguen planas): si se quieren planos, se cambia |
| **La MAÑANA DE LLUVIA VOL 1 contó tres veces (#419, #420, #421)** | *«veo que hubo un evento a las 7 AM… el bot lo interpretó mal… no fue 5 vidas sino un evento regular… asegurate de que no vuelva a pasar (el vigía, de noche apagado, eso no cambies)»* (07/10, ~1 PM) | ✅ **2.51**. FFA votó la llave batalla por batalla en #votaciones y un título mal escrito («JUPITER vs RAYO» en cuartos) repitió una pareja: se leyó como 5 vidas (#420 «5 VIDAS 07:57») y, al aparecer su anuncio, se cargó OTRA VEZ con otro nombre (#421). Ahora un 5 vidas pide además que el que gana se quede (el 60 % de las batallas seguidas comparten a alguien: Snake Rap 23 de 23, esta llave 2 de 7), en el ciclo y en la página, y su nombre queda fijo desde la primera vez. Se sacaron el #420 y el #421 por número (un «no cuenta» por nombre se llevaba el #419), seis insignias que ya no se cumplían y dos publicaciones (el rango D de Trot y la tarjeta de País de Aldre). El vigía no se tocó. ⏳ Los dos avisos del bot en LIGA GLOBAL los borra Dlx |
| **«Mirá una llave en vivo»: la llave dice si contó** | *«ya lo hice pero no recibo nada»* (07/10) | ✅ **2.51**. Cuenta con tu cuenta, abriendo la llave desde «En vivo» mientras se juega y 20 s abierta. Ahora dice «✓ Contó para tu Pase», y con una terminada, si tenés la Tarea pendiente, que cuenta con una que se esté jugando. Dlx es miembro: lo más probable es que la abrió terminada (la de la mañana nunca salió en vivo: el vigía duerme de noche) |
| **El aviso de cada evento, para la Liga, con su nivel** | a las ideas de mensajes, *«dale, me gusta, pero eso de los botones todavía no»*, *«para la liga global, pero añade nivel de intensidad»*; a la vista previa, *«sí»*; y *«cambia el label de pase a pase rapero»* (07/10, ~2:30 PM) | ✅ **2.52**. `bot/aviso_evento.py`: al cargar un evento, un embed en LIGA GLOBAL con el color y el logo del servidor y el campeón; el paso **2c2** del ciclo lo EDITA (no suena) con lo que cambió y con la tarjeta del campeón redibujada (su sello va en la URL). Nivel en el Dashboard (`avisos_nivel`): **Lo justo** (evento, campeón, cuántos) · **Normal** (+ podio y tarjeta; el de siempre) · **Todo** (+ quién subió en el ranking, debut, insignias, rangos, la sorpresa). Sin lo técnico (filas, Pendientes: eso está en ✅ Decidir). Los avisos viejos quedan como estaban. El puesto que se muestra es el oficial (sólo miembros). Sin botones: Dlx, *«todavía no»*. Y el menú dice **Pase rapero** |
| **Riferian es Erian, con su otra cuenta** | *«riferian es erian… en urban freestyle, el bot no detectó que erian se inscribió así o que le inscribieron así… asegurate que el bot detecte bien las cosas»*; de la cuenta @_5thofnovember («Riferian (uma cryu)» en Urban), *«sí, esa es su otra cuenta»* (07/10, ~2:20 PM) | ✅ «Riferian» es alias de Erian y su cuenta va en `cuentas` (abre sus cartas, como la de Monet); en la Lista se le sacó el ID y se fusionó con Erian, junto con las cinco filas dobles que quedaban de uniones ya decididas (Shisui, Emi, Nhp, Kude y Tokio). El 04/10 la pregunta no ofrecía «es otra cuenta de alguien de la Lista». **Ahora ✅ Decidir lo pregunta solo** (`dos_cuentas()` en `sheet/decidir.py`): dos filas con cuentas distintas, del mismo país, un nombre dentro del otro (4 letras o más) o casi iguales, los dos con puntos y nunca en el mismo evento. Nunca une solo: dos cuentas las decidís vos. Sobre los datos reales de antes encontraba exactamente ese par, de 693 filas |
| **Malasia es Liberia** | *«Malasia y Liberia son la misma persona, si es que no lo tienes captado»* (07/10, ~3 PM) | ✅ La cuenta de Liberia es @malasiafighter y se anota como «Sebita» (ya era alias); el 07/10 jugó en FFA como «MALASIA 🇦🇷». «Malasia» y «Malasia Fighter» son alias de Liberia y la fila «Malasia Fighter ❓» (sin cuenta) se fusionó con la suya |
| **Oasis y Snow los dos «#1»** | *«Oasis recién se unió al servidor… cómo detecta el bot que regresó… Snow era el anterior #1»* (07/10) | ✅ Sin bug: el número del apodo es el puesto del Competitivo y sólo cuenta a los miembros; el ciclo lee los Miembros de DRA cada media hora (11:22 AM a ~3 AM). Oasis volvió y en la vuelta de las 2:22 PM pasó al #1 y Snow al #2; la captura agarró el minuto en que se cambian de a uno. ⚠️ En cada vuelta fallan 28 apodos en DDF y ACAD: el bot no tiene «Gestionar apodos» ahí (lo dan sus admins) |
| **Tu servidor al verificarte, con «Ninguno»** | *«que al final te pregunte de qué servidor venís y/o a qué servidor querés representar… todos los socios y la opción ninguno»*; a la vista previa, *«sí, dale»* (07/10, ~3:20 PM) | ✅ **2.53**. `#/cuenta/verificar` termina con «Último paso: tu servidor» (la misma elección de Mi cuenta). «Ninguno» es `sv: ''` en el objeto: queda contestado, no fija la temporada, no suma a ningún servidor y el perfil vuelve a «donde más jugó». Worker desplegado |
| **La llave en vivo de «WETTTSIIIDEE #2» no aparecía** | *«¿por qué el bot no detecta las llaves?»*, *«asegurate de que el vigía no tenga ese problema en el futuro»* (07/10, ~3:20 PM) | ✅ El vigía tenía la llave («[ WETTSIDDEE #2 ]») pero la página y el vigía la juntaban con su anuncio sólo por palabras IGUALES, y no había ninguna; el ciclo, que mide el nombre entero (0,83), sí. `LlaveVivo.mejorPorNombre()` ahora, sin palabras iguales, compara el nombre entero con el mismo umbral del ciclo (0,8), por debajo de cualquier palabra igual; dos números distintos siguen chocando. Worker y página desplegados; tres casos en `llave_vivo_prueba.mjs` |
| **Las crews actualizadas** | la lista de Dlx (07/10) y, de PichulaMc en Arte del Chakalaje, *«está bien»* | ✅ `datos/crews.json`: 34 crews, 99 personas (60 con carta), cada nombre por los alias. Snow a Sexosos, Erian y Juasmio a Follombia, Makmah a Fuera de Rango; Jere, Kain y Zaylax fuera de KS; «Solo» y «Nose» no son crews |
| **Los roles de rango, cada media hora** | los IDs de SSS, SS y S, *«esto se basa en el competitivo»*; y *«si no consume nada hazlo, como con los apodos»* (07/10) | ✅ Los ocho ya estaban (en `Consola` y en DRA). Oasis tenía A: al volver, Utili («Role Persist») le devolvió el viejo; ahora S, 19 de 19. `roles_rango.py` usaba el Score sin la puerta de 10 eventos: ahora la letra del Competitivo. Y es el paso **2b7** del ciclo (`--ciclo`): sólo DRA, sólo a quien lo tiene mal, tope de 30; 4 s, sin KV ni Sheet |
| **Buscar por aka** | *«cuando buscan a alguien con cualquiera de sus akas, que le aparezca el mismo rapero»* (07/10) | ✅ **2.54**. El buscador usa `alias` del payload (los de quien tiene perfil): «riferian» → Erian, «malasia» → Liberia, «park ji» → Oasis, con «aka «x»» abajo del nombre. Vize (aka Vice) no sale: esta temporada no tiene perfil |
| **Llaves raras: un `⌞` sin cerrar** | *«hay a veces llaves raras… tendrás que adaptarte… asegurate de que puedas detectar las cosas»* (07/10, ~4 PM) | ✅ **2.55**. `⌞tuca  vs.   ⌞malasia⌝` (sin el ⌝) se comía los cruces de abajo: salía UN cruce de cuatro. Arreglado en `escuchar.unir_continuadas()` y en `llave_vivo.js`: un cruce entero no se pega al siguiente. La WETTSIDDEE de la mañana (#418) tenía lo mismo ya cargado («kul vs nc» se comió dos cuartos): la corrida siguiente la reprocesa; «prodigy vs setes» va a ✅ Decidir (ninguno sigue en semis). `comparar_lector`: sólo cambian esas dos llaves |
| **Ranking de Eventos** | *«en Ranking agrega la sección de eventos… las personas que participaron más»* (07/10) | ✅ **2.55**. Entre Rachas y Países: eventos jugados en la temporada, a igual cantidad el de más puntos, con su último resultado |
| **✅ Decidir: «Nadie siguió»** | Las cuatro batallas de la DEM UZBEKISTAN FECHA 1 (FFA, 06/10): *«pasó Za»*; *«Saz reemplazó a alguien, no sé si RT o Jupiter ganó»*; *«Yo MC reemplazó a alguien… deberías saberlo, chequeá las inscripciones»*; *«lo mismo»* (07/10) | ✅ Respuesta nueva en ✅ Decidir: **«Nadie siguió (cobran la ronda)»** — jugaron, no pasó ninguno: cobran esa ronda y no hay duelo. «No se jugó» los dejaba sin el evento. Los siete de esos octavos cobran 1.250. **«Yo mc» en FFA es Cronox**: su cuenta (@cronoxzito) se anota como «Yo mc», «Yo» y «Yo + tenor»; va por servidor (`por_servidor`), porque en la ACADEMIA otra cuenta escribió «Yo mc» hablando de sí misma. Y el `cobra:` de la nota pasa por ese alias: le pagaba a otro |
| **Walk-ins bien contados** | Saliendo de lo anterior (07/10) | ✅ Tres arreglos: «za» (Provenza, Dlx 04/10) el lector lo descartaba por tener 2 letras —ahora valen los cortos que Dlx confirmó—; los walk-ins se vuelven a marcar con las batallas de ✅ Decidir; y el motor castiga a **todos** los walk-ins de una batalla, no al primero. Provenza 2.250 → 4.500 (walk-in 1, no 2); Saz y Nc (WETTSIDDEE 2) pasan a cobrar como walk-in. En las 705 filas de la T1 no cambia nada más |
| **Llaves de Snake Rap que no se veían** | *«ahora hay un evento en Snake Rap… porq el evento no es detectado x el bot y el website?»* y *«agrega también soporte para formatos similares»* (07/10) | ✅ **2.56**. El organizador nuevo escribe `(< A >) ⚔️ (< B >)`: los dos lectores sacaban cero rondas y el filtro del vigía (`pareceLlave()`) ni la guardaba. Ahora sí, y también 【】 〔〕 ［］ 《》 ⟨⟩ ⟦⟧ 〖〗 ⦗⦘ con 🗡️ ✖️ ⚡ 💥 🥊 🤜🤛 🔪 «versus» «contra» «x», sólo entre dos marcos (`MARCOS_MAS`, `VS_ENTRE`). Afuera a propósito: «», ｢｣, ❌ y 🔥. Y el título: «LLAVES» no es un nombre — sale «Gallos del Under Amateur I» y se une a su anuncio. Medido: las 705 filas de la T1 iguales |
| **El «Arrancó LLAVES» en el chat de Snake Rap** | *«Elimina este mensaje»* (07/10) | ✅ Borrado. Era del bot en el chat en vivo, con el título mal leído; no se vuelve a mandar (`chat_vivo` ya lo tiene) |
| **Cancelado, en pausa o atrasado por mensaje** | *«asegurate de q el bot pueda entender cuando pasa estas situaciones… el evento se canceló o se va a atrasar»* (07/10) | ✅ **2.56**. `estadoDeMensaje()` (avisos.js) lee los mensajes que no son anuncio ni llave; `anotarEstado()` los une a su anuncio; `/avisos/vivo` trae `estados`. Cancelado → el camino de siempre (`cancelaciones()`, por «mensaje»: campana y eventos-hoy). En pausa → «⏸ EN PAUSA» en la página y el ciclo espera 36 h antes de Pendientes (`pausada()`). Atrasado → «⏰ SE ATRASÓ» con la hora nueva si viene como `<t:…>` o «en N min». La campana avisa también «se pausó» y «se atrasó» desde la **2.57** |
| **El dibujo colgado 2 horas** | El 🔴 de las 4:45 PM (07/10) | ✅ Bajar Chromium se trabó sin error y GitHub cortó el trabajo a los 120 min; las tres corridas de atrás se cancelaron en la cola. Ahora `navegador.py` tiene tope: 4 min por intento, dos intentos |
| **Cronox y el winrate (Molusco)** | *«Molusco dice que Cronox no debería tener mucho winrate a diferencia de él… me dijo que me fije si algo está mal»* (07/10) | ✅ Estaba bien: Molusco 6 de 11, Cronox 2 de 6. Pero aparecieron **dos eventos contados dos veces** y, con *«sí, dale»*, se sacaron por número: **#358** «MARRUECOS EN VENTA V.1» 23/09 (era el #352, DESGRACIAS CON TöKĪØ V.1: el mismo mensaje) y **#409** «(sin titulo)» 27/09 (la segunda mitad del FFA WORLD CUP, #366). Respaldo en `.cache/sacados_358_409.json`. Molusco queda 5 de 9 |
| **Las cuatro mejoras** | *«algunas mejoras en el sistema que veas?»* → *«dale, haz todo»* (07/10) | ✅ **1** ✅ Decidir pregunta solo por el evento cargado dos veces (`duplicados_corrida()`, tipo «Evento duplicado»; «sí» lo saca POR NÚMERO, «no» no se vuelve a preguntar) y `ya_cargada()` frena que entre. **2** El vigía avisa al canal de Logs la llave que no sabe leer (`llaveRara()`). **3** Cada paso del ciclo con tope de 25 min (`TOPE_PASO`) y alerta si se cancelan 2+ corridas esperando (`en_cola_canceladas()`). **4** La campana dice «⏸ En pausa» y «⏰ Se atrasó» a quien le llegó el aviso del evento (**2.57**) |
| **El bot en vivo con datos y apuestas** | *«podrías hacer apuestas, con puntos de la tienda en vivo… en chat general… EL CLÁSICO… sabías que tal usuario X… un nuevo nivel de intensidad mayor, que haya 5 o 7»* y a las preguntas: botones en el chat, pozo compartido, hasta 500 y cierra a los 3 min (07/10) | ✅ **2.58** (Worker). Cinco niveles: Lo justo · Normal · Cada batalla · **Con datos** (el título del cruce, un «¿sabías que…?», los anotados en inscripción) · **A full** (además la apuesta: botones 50/100/250/500, uno por persona, un lado, tope 500, cierra a los 3 min, pozo compartido con piso; sin ganador, se devuelve). Tablas `apuestas` y `apostado`; la plata son filas `ap:` de `tienda`. Se elige por servidor en el Dashboard o con /settings: **nadie lo ve hasta que un servidor lo prenda** |
| **Win% y fortalezas, desde 10 eventos** | *«asegurate que nadie pueda tener un win rate hasta que tenga 10 eventos»* (07/10) · *«para que te muestre sus fortalezas necesita tener desbloqueada la tarjeta competitiva»* · *«muéstrales una preview de lo que sería»* | ✅ Win%: **2.58** (`rankings.agregar()`, el piso sale de `comun/requisitos.py`). Fortalezas: **2.59** (vista previa bloqueada con el radar de ejemplo; también en el perfil de respaldo de app.js) |
| **El aviso de cada evento, al chat del servidor** | *«¿por qué esto aparece en el canal de logs, o sea registros? Pensé que sería en el chat general»* y a las preguntas: chat del servidor, y de registros *«sacarlo de ahí»* (07/10, ~9 PM) | ✅ **2.58**. LIGA GLOBAL está en la categoría «registros» de DRA. Ahora va al chat donde habla el bot en vivo de ese servidor (`avisar.canales_chat()` → `/avisos/chat-canales`); **sin el bot en vivo prendido en ese servidor no se manda**. Los que ya salieron se siguen editando donde están |
| **Un equipo escrito con «x»** | *«estas son 3 personas diferentes: Nemi x presagio x dantedelux… pero la página no lo detectó»* (PRITTY FREE, FFA, 07/10) | ✅ **2.58**. Adentro de un marco, « x » separa integrantes **si hay una bandera por cada uno** (`_equipo_con_x()` en Python y en JS, con dos casos en el contrato: el equipo y la «x» que no lo es) |
| **«dantedelux» y el #425** | *«dantedelux? puedes averiguar más… si son 2 personas diferentes o dante o delux?»* (07/10, ~9:35 PM) | ✅ Es UNA cuenta, @delux.13 —la de **Delux 🇦🇷** en la Lista—, «Dante Delux» en Snake Rap: alias a mano. Y apareció lo grande: el #425 (PRITTY FREE) se cargó de la llave de **#votaciones**, donde los equipos van sin separar («NEMI PRESAGIO DELUX»), y nueve personas no cobraban. **Un evento de equipos se queda con la llave del organizador** (`llave_de_veredictos_para()`); recargado a las 10:22 PM con cada uno en su lugar |
| **Doble eliminación, y llaves en imagen** | la plantilla de 8 de PLEXKITS: *«haz que el bot reconozca este tipo de llaves y formato»*; a las preguntas, *«ya deberías poder reconocer las imágenes, ¿no?»*, el puesto «por dónde cae» y que las batallas de las dos llaves cuenten como duelos (07/10, ~10 PM) | ✅ **2.60**. El lector lee «WINNER/LOSER BRACKET», «LLAVE DE GANADORES/PERDEDORES» y «MATCH N:» (Python y JS, con dos casos en el contrato); quién ganó sale de dónde sigue cada uno (`_resolver_doble()`); el motor paga por el orden en que caen: 1.º campeón, 2.º sub, 3.º, 4.º, 5.º-6.º Cuartos, 7.º-8.º Octavos (`lugares_doble()`, `puesto_doble()`). La imagen la lee la IA de los afiches (`/avisos/ocr?tipo=llave`), sólo en canales de llaves, 4 por corrida (`datos/ocr_llaves.json`). Probado con una llave llena: 14 de 14 ganadores. **Y el formato de FFA** (Doble Eliminación Vol. 2, esa misma noche; Dlx: *«¿estás seguro que puede detectar esto?»* — no podía): «Llaves de Ganadores» con OCTAVOS/CUARTOS/Semifinal/«Winner's Final», «Lost Bracket Nth round», «Loser's Final», y la de perdedores en OTRO mensaje de OTRA persona (se pega si empieza en perdedores y sale a menos de 30 min). Probado con los dos mensajes reales. ⚠️ **La página en vivo dibuja las dos llaves como rondas, no como cuadro doble todavía** |
| **Doble eliminación: del 9.º para abajo** | a la pregunta «¿R32 u Octavos del 9.º al 16.º?»: *«lo que tú consideres»* (08/10, 12:10 AM) | ✅ Del 9.º al 16.º cobra **Octavos quien ganó alguna batalla** y **R32 quien perdió las dos que jugó**; del 17.º para abajo, R32 (`puesto_doble()`). Con R32 para todos, la primera batalla de la llave de perdedores no movía los puntos de nadie, y quien acaba de perder no tenía por qué quedarse a jugarla. Del 1.º al 8.º, lo que Dlx eligió el 07/10. **Y dos errores que salieron al probarlo con una doble de 16**: la «Semifinal» de la llave de ganadores (FFA la escribe así) se pagaba OTRA vez como semifinal —5.250 de más al 5.º y al 6.º—, y la escala de 8-15 no tiene Octavos, así que en una doble de 8 el 7.º y el 8.º cobraban **cero**: ahora la mitad de Cuartos (1.000), que es como baja la de 16+ (`pago_doble()`). Y la página contaba «14 raperos» en la de 8 (la llave de ganadores repite a quien gana): 8 |
| **La llave doble, dibujada como doble** | *«sí, dale»* a dibujarla en dos llaves (08/10, ~12 AM), y a la vista previa, *«dale»* | ✅ **2.62**. Tres partes, una abajo de la otra: llave de ganadores, de perdedores y gran final (`Doble` en `web/src/llave.jsx`). Las rondas que el lector junta salen de por dónde aparece cada uno (`partirDoble()` en `arriba.jsx`): «Ronda 1»… y «Final de perdedores» cuando ya hay gran final; en ganadores, «Final de ganadores». Ramas por quién ganó, el camino del campeón en verde, los puntos sólo en perdedores. **Sin «AHORA»**: las dos llaves se juegan intercaladas. El cuadro chico del Inicio la muestra por rondas y la llave corta no sale |
| **Snow sale de Sexosos** | *«Quita a Snow de la crew de sexosos»* (07/10, 10:54 PM) | ✅ `datos/crews.json`, con su baja anotada (`_bajas`: la lista de las dos, Follombia y Sexosos) |
| **Más ajustes en el Dashboard** | *«dame más configuraciones»*, y a la lista: *«Apuestas, Aviso de cada evento, Horario de silencio»* (07/10, ~11 PM) | ✅ **2.61** (sólo Dlx): las apuestas (botones, minutos, tope, servidores sin), el aviso de cada evento por servidor (donde habla el bot / su chat general siempre / apagado, y a dónde va el que no tiene), el horario de silencio (hora del este; las apuestas se siguen cerrando) y el ritmo del bot en vivo. Sin ajuste, lo de siempre (`chat.def`) |
| **«Sus datos», más formal y con más detalle; sus eventos con buscador; el pie con la fecha** | *«en sus datos sé más detallista»*, *«más formal lo de verdugo e hijo… y su clásico»*, *«poner eventos en lo último… buscar evento y filtrar»*, *«abajo de todo… cuándo fue creado el proyecto»* (07/10) | ✅ **2.61**, con *«dale»*. La fecha es la del primer commit: 29/07/2026 |
| **El perfil en una página, más datos y letras más grandes** | *«que todo esté en una página… que días usualmente participa, su win rate en réplicas… sus otros servidores… HACE MEJOR EQUIPO con X… su verdugo… su hijo»*, *«el tamaño de las letras… normal»*, *«intercala con el negro»*, *«sé más descriptivo… te falta participar en 10 eventos más…»*, y para Dlx: *«visitas, pero visitas a qué?»* y *«una X para cerrar ese panel»* (07/10) | ✅ **2.59** (*«ok, subilo ahora»*, 07/10, ~9:30 PM): perfil en una página con «Sus datos», las Servidor de sus otros servidores, lo desbloqueado ya no está en «Lo que le falta», fortalezas bloqueadas con vista previa, bandas negras como el Inicio, ninguna letra bajo 12 px, lo que falta dicho para gente nueva (`web/src/requisitos.js`, también en Tarjetas, el Ranking y la Guía) y el panel del Dashboard con X y «Abrieron la página» |
| **«Ranking Temporada no se está escribiendo» (11:24 PM)** | la captura del aviso del bot: *«DICE ESTO»* (06/10, ~11:25 PM) | ✅ Era el guardián que no deja escribir una tabla más chica —está para atajar un `Resultados` leído a medias—: 359 contra 358. No faltaba ningún resultado: el lector reconoció a XNOAH como Elbesaabuelas por su cuenta de Discord (✅ Decidir lo había dado de alta solo a las 10:57) y la tabla nueva los juntó, con la vieja todavía en dos filas, porque el alias que las une se arma al final de esa misma corrida. Ahora, con hasta 5 filas menos y los eventos sin bajar, es gente que se unió y se escribe (`aviso_encoge()` en `sheet/rankings.py`, con su caso en el self-check); con eventos de menos frena como siempre. Esa corrida se perdió: la Temporada se actualiza en la de las 11:52 |
| **Quien se verificaba a la noche no tenía /card hasta las 11 AM** | la misma revisión (06/10, ~9:25 PM) | ✅ Velatz recibió Miembro de DRA en la corrida de las 8:52, pero su índice de /card (`d:`) quedó «para la hora tranquila» (11 AM a 5 PM) con otros 22, y /card y la página lo seguían tratando como no verificado. Esperaba desde el 05/10 para cuidar el cupo de KV, cuando ahí estaban los datos de todos; desde que viven en el objeto, en KV quedan los índices y `meta`, así que ahora van al instante (`puede_esperar()` en `bot/subir_datos.py`). **Y la primera vuelta en la nube con el objeto** (8:52 PM): 509 personas, 149 cambiaron, y 24 claves de KV |
| **✅ Decidir, los IDs y reconocer gente, con los 10 servidores del bot** | *«ahora que estás en varios servidores puedes ayudarme a decidir… recolectar Ids y reconocer usuarios?»* · *«hAZ A y B»* (05/10, ~9:50 PM) | ✅ Cruzadas las 88 preguntas abiertas contra los miembros de los 10 servidores (16.591), sus roles de país y las inscripciones. **A**: 6 IDs de la ACADEMIA (Sara, Mixso, Kyron, Umbral, xz, Erika; nombre exacto y una sola cuenta en los 10), sin tocar roles de DRA. **B**: Mathhias 🇻🇪, CHOCLITO 🇦🇷, Corvo 🇧🇴, LV 🇦🇷 y Tiagoms 🇦🇷 a la Lista con su cuenta; la cuenta de King, Zanti y Leyenda (estaban sin); SNE pasa a su cuenta nueva (SNE_v2); y 17 respuestas en ✅ Decidir —los alias «manteca sixseven»→King, «Zanti SkT»→Zanti, «Leyenda.X5»→Leyenda, «mathias»→Mathhias; Ññ/Ñn y Dash, misma persona; Marcos, otra persona; tus dos «probando»—, que aplicó la corrida de las 10:22. ⏳ Lo que queda: las probables (C), lo que sólo sabés vos (D) y sumar LIVONIA, COSMIC y La Confederación a las pistas automáticas (E) |
| **Las alertas del ciclo no te llegaban desde el mediodía** | la pasada de errores (*«arregla bugs y errores»*, 04/10) | ✅ (sin versión: no se ve en la página). El registro del ciclo decía «no pude abrir el DM con Dlx (400)»: `alertar.dueno()` buscaba tu Discord ID en `worker.js`, y con el Dashboard (`e965d90`, 12:12 PM) se mudó a `avisos.js`. Devolvía vacío y Discord contestaba 400: **ninguna alerta te llegó desde ese mediodía**. Ahora lo busca en los dos, `alertar.py --auto` lo prueba en CI, y se verificó abriendo el DM sin mandar nada (200; con el ID vacío, 400, como antes) |
| **NXUZ (antes «Nexus») y la otra cuenta de Monet** | *«averiguá bien, quizás haya otro nexus»* · *«VA»* · a Monet: *«A»* (04/10, ~12 AM) | ✅ hay tres cuentas «Nexus» y ninguna es de Chile: la de la Lista (elinzano1009) es Perú en SNK, URB y LIVONIA y firma «nxuz con zeta»; se renombró **NXUZ 🇵🇪** (fila 337, `lista_raperos.py --pais`, nuevo) y Nexus, Nexuz y NXUS son alias suyos. nexxus0344 (Perú) y nexus103_ (México) no jugaron. **Monet**: `cuentas` en `akas_a_mano.json` y `subir_datos.cuentas_extra()` —su @monet_x. abre sus cartas en `dn:`, sólo las cartas— |
| **La silueta de rapero para quien no tiene foto** — 🔁 *«la verdad no me gusta… buscá en Google imágenes»* y, entre cinco de Pixabay, *«la segunda»* (04/10, ~12 AM): ✅ es **silhouette-3391415** de Pixabay (licencia libre, sin atribución; Google pidió CAPTCHA), sombrero y micrófono en alto, trazada a vector con `herramientas/trazar_figura.py` (guarda los huecos; 3 KB). Lo de abajo es la primera versión, dibujada a mano | *«para aquellas personas sin fotos, ya sea que lo eligieron esa opción o que no tienen nada, usar una silueta de un rapero en negro en las tarjetas»* (03/10, ~10:45 PM, con la Temporada de Oasis) | ✅ `comun/sin_foto.py`: de perfil, con gorra y micrófono (de frente el micrófono se pierde contra la cara), negro con un contraluz suave para las cartas oscuras. Va **en el lugar de la foto, como una foto**, así cada carta le aplica lo suyo: Temporada, Competitiva, Servidor, País (sin el plato oscuro, que apagaría la bandera) y la Bloqueada (apagada detrás del candado). También cuando la foto no carga (`onerror`). Reemplaza a la inicial. 🔴 **Y «no tiene nada» incluye la foto lisa**: la de Oasis existía y era un papel blanco —su avatar de Discord—, así que su carta salía vacía teniendo foto. `respaldo.plana()`: desvío de gris < 5 a 64×64, medido sobre las 427 del espejo: ocho lisas (Oasis y Fullylo4ded en blanco, Geremy, Crk, Keider y Sergare en negro, Dantemx gris, Fin verde) y la siguiente es J.R (6,0), casi negra pero con su nombre: ésa se respeta. Vive en `comun/`: redibuja todas las cartas en el ciclo siguiente. Verificado: las cuatro salen para las 261 (`puedo_generar.py`). En la página, las caras lisas siguen igual |
| **LA REDENCION dice CANCELADO, las siglas de Eventos, Carlosss y Number VE en DDF, y /sumate para todos** | *«la redención debería decir cancelado también»* · *«aún sigue diciendo SR y URBF»* · *«acá hay 2 carlos»* · a las preguntas: *«2. A … 8. A 9. A 10. así como dijiste»* · *«esta persona está preguntando por su tarjeta… numby, ¿ese nombre no está en la Liga?»* (03/10, ~10:20–10:45 PM) | ✅ **2.19** (10:43 PM). **Cancelado con el anuncio en pie**: si la llave de un evento se borró y no hubo otra, la página lo dice al minuto (`canceladoCal()`, con las borradas del vigía) y el ciclo lo guarda (`_cancelados()` de subir_web, `datos/cancelados.json`, en guardar.sh): el vigía olvida a las 6 h y el calendario es de toda la temporada. LA REDENCION va anotada por Dlx (su llave se borró antes de que existiera el registro). Uno con su llave procesada nunca sale cancelado; el .ics lo marca CANCELLED. **Las siglas**: los filtros, la leyenda, «el más activo» y los horarios de Eventos, y la Tira, pasan por `siglaDe()`. **DDF**: `por_servidor` en `akas_a_mano.json` y `otro_en_servidor()` en el lector —CARLOS🇪🇨 es Carlosss y NUMBER es Number VE (numby = @numbyng)—; medido: cambian exactamente 10 filas, todas de DDF; más NXUZ/NXUS/NEXUZ → Nexus y CRIZJ → CrisZJ. Number VE no está en DRA: le salen Temporada y Servidor (DDF), con candado la Competitiva y la de País. **/sumate** sin preview, y Socios enlaza ahí. 🔴 El `\b` del regex de «1VS1» había entrado como un retroceso (otra vez el `\b` de Python sin `r''`): arreglado antes de publicarse |
| **La carta de Servidor con lo de ESE servidor, lo recién terminado, La Liga en números y la llave sobre la piel** | *«la info de cada servidor en sus tarjetas tiene que ser diferente para cada tarjeta de servidor… para cada usuario»* (con la de Catarsis en URBF toda en «—») · *«el evento no aparece aquí… el de la nave»* · *«si puedes agregar más info aquí… cuántos nuevos hay, cuántas personas rapearon estas 2 semanas»* · *«ahora está muy negro… todo»* · *«soul es esta persona»* (03/10, ~9:35–9:57 PM) | ✅ **2.18** (9:57 PM). **La Servidor**: `rankings.por_servidor()` —`agregar()` sobre las filas de cada servidor, con los multiplicadores de la Temporada y sin MW, bonos ni precios— escribe `datos/por_servidor.json` en el paso 1c (`guardar.sh` lo guarda); `03_Servidor/generar.py` (`del_servidor()`) le da a la propia y a cada camiseta su OVR, títulos, podios, racha, duelos y eventos de ese servidor; el OVR con la (b) de `disenos/ESTADO.md` (`ovr.con_topes()`: la fórmula de la Temporada contra los topes de la temporada entera); y la huella de la Servidor lo incluye (`que_cambio`). Hoy: 259 personas, 56 en más de un servidor; Catarsis en URBF 64 con 1 título y 3/3 (antes todo «—»); Hassan FFA 81, SNK 68. **Lo recién terminado** (`Liga.recienTerminadas()`): las llaves en vivo ya terminadas y sin procesar, menos las que ya tienen su procesada (el link no siempre coincide), en Fechas y en Eventos con su campeón y su llave. **La Liga en números**: esta semana, dos semanas, nuevos y volvieron (`subir_web._actividad`); hoy 176 · 256 · 98 · 78 de 158. **La llave sobre la piel** (`--caja`) y el pie pegado. **SOULSi es Soulb** (Dlx, con la captura): en `akas_a_mano.json`. 🔴 Corrí `construir_akas.py --help` creyendo que era ayuda: reescribió `akas.json` (igual a lo que haría el ciclo; anotado en la memoria) |
| **La NAVE DE EXTERMINACIÓN, la página de la llave y el «en vivo» de una llave borrada** | *«no detectó las llaves de nave de exterminación, la ronda de exterminación»* · *«¿podrías dar más detalles?… en este caso sí»* · *«estas cosas dentro de la llave deberían estar arriba de todo»* · *«es muy blanco eso de las llaves página»* · *«regresá eso como estaba antes, a la izquierda»* (03/10, ~8–9:30 PM) | ✅ **2.17** (9:34 PM). **El lector** (Python y JS, con la llave real en el contrato): «EXTERMINACIÓN» es encabezado de la fase; «ELIMINADO #N» (y «ELIMNINADO») es caer y dice la ronda (`funa_rondas()`/`funaRondas()`); el adorno pegado al último renglón ya no se lo come; «Shisui (VELATZ)» es VELATZ (el de los paréntesis sigue en la llave, y la inscripción «Shisui 🇯🇵» la escribió la cuenta de Velatz). La ronda va en la nota de la fila («cayó en la ronda 3») y en la llave procesada; **sólo se muestra: la fase sigue empatada en puntos**. comparar_lector: 486 filas, nada cambió. **La página de la llave**: botones y puntos arriba (en el escenario), el cuadro en negro pegado a él, la fase ronda por ronda con «A la llave» en verde, y el título largo que no se parte en el celular. **El «en vivo» de una llave borrada**: LA REDENCION se canceló y FFA borró la llave pero no el anuncio; ahora el vigía anota las llaves borradas (`vivo_borradas`, `borradas` en `/api/avisos/vivo`) y `Liga.vivo()` saca del vivo al evento cuya llave se borró hace 5 min o más sin otra. **La tira de historias**, a la izquierda otra vez. **IDs**: el cruce exacto (cruzar_miembros) escribió 6 y verificó 2 en DRA (Launok, MathiasMC); de DDF, nada exacto. ⏳ **Esperan a Dlx** (identidad): el «Carlos» de DDF es CARLOS🇪🇨 (campeón ecuatoriano, otra cuenta) y suma en el Carlos 🇲🇽 de la Lista; «Number» de DDF es NUMBER🇻🇪 y suma en Number 🇺🇾; y NXUZ, Xplicit, 19 y CRIZJ con cuenta probable. En la nave: Monet se anotó desde otra cuenta que la de la Lista; SOULSi y MaYeuTyK, sin rastro |
| **La llave del escenario: los equipos, la letra y la llave corta** | *«aquí no aparece que es el equipo de Oasis.. solo Park Ji Sung.. debería aparecer el AKA principal»* · *«¿puedes hacer que el tipo de letras sea mejor?… minúsculas exceptuando la inicial… textura»* · *«hacer una previa de la anterior llave a la actual, la actual y la siguiente… y dejar la opción de VER LAS LLAVES completas… si es que es octavos… estético y bonito»* · *«prefiero que esté dentro del espacio negro como estaba antes»* (03/10, LA REDENCION en vivo) | ✅ **2.15** (7:17 PM): un lado puede ser un equipo —se parte por `+`, `&` y `,`— y va con las caras juntas y el AKA principal de cada uno (`LadoCm`/`integrantes()` en arriba.jsx); si no entran, el primero y «+N» sobre las caras. Las caras del cuadro medían 6 px (`.cm-m span` les metía relleno: ahora `>span`). Nombres con `capital()` (sólo lo que viene todo en mayúsculas o todo en minúsculas; lo de 1–2 letras, en mayúsculas), letra 700 sin ensanchar, trama de puntos en las casillas y rayas al sesgo en lo que falta jugar. La tira de historias: SNK/URB, 68 px y centrada. ✅ **2.16** (7:43 PM, desplegado a mano con `paginas_subir.py` porque Dlx pidió publicar ya): **la llave corta** (`LlaveCorta`, `cortaDe()`): con la primera ronda de 8 cruces o más, ANTES (apagada, con quién PASA) · AHORA (magenta, más grande) · SIGUE en una línea de tiempo y «N de M batallas»; con menos, el cuadro entero. Va en el escenario y **adentro de la tarjeta negra de Eventos** (la 2.03 la había sacado por el hueco de los Octavos); en «Hoy» no se repite. 🔴 **De paso, `jugado()`**: en el grupo de Park Ji Sung + Yinn pasaron dos y la llave no marca ganador, así que ese cruce quedaba «por jugarse» detrás de tres jugados y `enOrden()` daba que no: **no había AHORA en ningún lado** (escenario, Eventos, la página de la llave). Ahora un cruce se jugó si tiene ganador o si alguno de sus lados ya está en la ronda siguiente. Y `cancelacionesVisibles()`: un anuncio borrado y vuelto a publicar (LA REDENCION, 6:26 PM) ya no dice CANCELADO en Fechas ni en Eventos. ⚠️ LA REDENCION se canceló a último momento; Dlx arma una NAVE DE FUNA para probar |
| **Dimensión del Freestyle (DDF) entra a la Liga**: «haz todo lo necesario para que esta sea una buena inclusión» | *«Dimensión Del Freestyle agregó nuestro bot… son un servidor con mucho potencial»* · a las preguntas: *«1. D 2. a 3. A. que no cuenten aún pero podría contar para el ranking ligas»* · a la carta: *«Me gusta el B pero… el morado ese es el mismo que FFA… esa barra de azul de abajo… que no toque el UL»*, *«debería aún tener el color morado en la línea»*, *«ok hazlo así»* (03/10) | ✅ **sigla DDF, etiqueta ESPECTÁCULO**, `confirmado` en `datos/servidores.json` y las listas de servidores; **sus ligas (LIGA AK47 y FMS TITANS) afuera** (`categorias_fuera`) — ⏳ más adelante, al Ranking de Ligas. **El lector** ya entiende sus llaves (22 de 22: el emoji `versus`, los marcos 『』, las rondas con letras separadas) y sus anuncios («1⚔1» es 1vs1, «YAYAYA» es ya mismo). **Su carta de Servidor**: una galaxia —estrellas, nebulosa violeta y el borde azul de un planeta detrás del tag—, el marco en **azul eléctrico** (el violeta de su logo era el de FFA: ΔE 2,6) con **la línea en morado** (`los_nueve.LINEA`), y su escudo redondo entero. Color de marca `#00ADEC`. Invitaciones: la de la Liga (`9jxbKT9Hfv`, a #Bienvenida) y dos de inscripción |
| **Un link del bot para sumar un servidor**, «general, para que cualquiera pueda agregarlo» | (03/10, ~11:40 AM, «urgente») | ✅ pasado en el chat: `discord.com/oauth2/authorize?client_id=1550026808404217926&permissions=66561&integration_type=0&scope=bot+applications.commands`. El bot es público y no pide code grant (medido en `/applications/@me`); los tres permisos son los que dice /sumate —ver canales, leer el historial y crear invitaciones—, sin Administrador. El botón «Agregar app» de su perfil instala con permisos 0, por eso el link. Un servidor nuevo cuenta recién cuando tiene su sigla en `datos/servidores.json` |
| **Los links de preview (`?prev=…`) no prendían nada** — tampoco el de /sumate que te pasé | (encontrado al probar el de Tarjetas, 03/10, ~11:50 AM) | ✅ arreglado y desplegado: el `` del final de los dos regex de App.jsx había quedado como el carácter de retroceso (0x08) —un parche de Python sin cadena cruda, la misma familia que «los heredocs se comen las barras»—, así que el regex nunca coincidía. Medido en Playwright: el mismo regex daba null en el módulo y coincidía escrito a mano; su `source` terminaba en `.29.8`. Revisado el repo entero: ningún otro carácter de control. Verificado en producción: `/sumate?prev=sum` y `/freestyle-rap/tarjetas?prev=tar` prenden su preview |
| **CI estuvo en rojo seis pushes** (01/10 11:05 PM → 02/10 9 AM) | — | ✅ el 02/10: pasé los links del bot a `/freestyle-rap` y no las pruebas de `probar_local.mjs` que los esperaban con `#/…`. Ahora, antes de cada push, corro en local todos los pasos del workflow |
| **Los que mandan sin el texto de abajo**: Temporada y Competitivo, la tarjeta sola; Duelos, Podios y Rachas, una línea con lo que la tarjeta no dice. También en «Los que mandan» de cada servidor | *«las cosas de abajo son innecesarias porque la tarjeta ya tiene esa info»* (01/10) | ✅ 1.62 |
| **El pie sin la línea de números** (personas, servidores y verificados: ya están en La Liga en números) | *«hay info que se repite»* (01/10) | ✅ 1.63 |
| **Ajustes con su ⚙ arriba**, al lado de la campana y la cuenta (más chicos, para que entre todo) o en lugar de la cuenta en el celular; el ☰ queda como está | *«como está la de hoy… ¿podrías agregar el símbolo de engranaje de ajustes al costado de la campanita y la cuenta?»* (01/10) · la A: *«creo que ya te había dicho»* | ✅ 1.64: los cuatro íconos, a 36 px en el celular (medido: en 360 px quedan 10 px de aire); Ajustes con su página (`#/ajustes`), que guarda en el mismo `AJ` que la ventanita de hoy; abajo, Tarjetas |
| **Verificarse desde la página** (lo que hace `/verificar`: qué te falta, con botones, y te anota; el rol lo sigue dando el ciclo) | *«ahí dice sin tarjeta… haz una opción para que la gente se verifique desde la página web»* (01/10) | ✅ 1.65: `#/cuenta/verificar`. Con el permiso «unirse a servidores» **el bot te mete en DRA** si no estás; **el país se elige en la página** y el bot pone ese rol (*«A»*), **recién después de aceptar las reglas de DRA** (un rol puesto a alguien «pendiente» puede saltearlas); **el Miembro lo da el ciclo** (*«A»*). `/card` y `/verificar` llevan un solo botón: «Verificarme en la página». ⏳ falta probarlo con una cuenta de verdad que no esté en DRA |
| **Instalar la app, más específico y con imágenes de cada paso** | *«sé más específico, e incluso si puedes crea y saca imágenes o genera imágenes que reflejen cada paso»* (01/10, con la captura de Ajustes) | ✅ 1.66: Android (4 pasos) y iPhone (5), cada uno con un dibujo de la pantalla y lo que se toca marcado en verde. **Dibujos y no capturas**: el menú de Chrome y el de Safari no se pueden fotografiar desde la página y cambian con cada versión; por eso sólo se escribe lo que se toca y el resto son barras grises (`web/src/instalar.jsx`) |
| **Las tarjetas sin foto: que aparezca la opción de verificarse en la página** | *«todavía hay algunas personas sin su foto… en vez de que le aparezca esto, que le aparezca la opción… para verificarse a través del website»* (01/10, con el `/card` de MILICA) | ✅ 1.66. **La causa era otra**: las fotos se bajaban a mano y la última vez fue el 20/09, así que **24 verificados con foto en Discord** tenían la inicial (MILICA entre ellos). Se bajaron 23 (una el CDN ya no la sirve) y ahora **el ciclo las trae solo** (paso 2f). Y al pedir tu carta sin foto, el bot te avisa sólo a vos: sin verificar, «verificate en la página» con el botón; verificado, te la guarda ahí mismo; sin foto en Discord, que te pongas una |
| **La lista de 20 cosas legales** (privacidad, términos, cookies, edad, contacto, borrado, contraste, teclado…) | *«también asegurémonos de todo esto»* (01/10, con la captura de la lista) | ✅ 1.67 lo que no pedía decisión: la privacidad corregida (cuatro cosas que no eran ciertas, qué guarda el navegador, el repositorio público), el borrado de los `dn:`, «Mis redes» sin marcar, el aviso de «Reportar», los Términos en el pie, contraste y foco · ❓ el contacto fuera de Discord, la edad y quién figura · 📌 con el remake: «ocultar mi foto», fuentes propias y caras desde R2, el teclado del Ranking viejo · los IDs del repo público **se quedan** (*«B»*) |
| **1 · Los 24 nombres viejos sin ninguna pista** en ✅ Decidir | *«sí, pero la cosa es aguantar hasta ver… déjalo ahí, quizás se conecten más a cosas»* (01/10, 9:40 PM) | ✅ **se quedan abiertos**: nada de darlos de alta solos por ahora. Se cierran cuando aparezca una pista (inscripción, podio, mención, la llamada) |
| **2 · VOL 11, ONZASS contra gus** | *«pásame el link de la llave y la invitación del servidor»* | ✅ pasados en el chat (la llave en el canal de llaves de FFA y la invitación permanente de la Liga) · ⏳ lo decide Dlx mirándola |
| **3 · ONE PIECE / REGRESO A SABAODY** (FFA, 30/09) | *«el campeón es PRAISERIZA… asegúrate de chequear bien las llaves»* | ✅ 1.73: su podio iba con medallas (`🏆 \|PRAISERIZA 🇻🇪`, `🥈 \|…`, `🥉 \|A + B`) y el lector sólo entendía la palabra CAMPEÓN; y la 🥉 sola de encabezado no era la batalla por el tercero. Ahora se traducen a la forma de FFA (`escuchar._podio_con_medallas()` y la página igual). Sobre las 30 llaves de la T1 cambia sólo ésta: campeón PRAISERIZA, y sus dos dudas se cierran. DENME MODERADOR LPM sigue siendo la de broma de URBF (`anuncios_fuera`) |
| **4 · La «R» suelta después de la bandera** | *«C»* (es revivido y cobra la mitad) | ✅ `REVIVIDO_R` en `llaves_a_entrada.marcar_revividos()` y el motor: el revivido que aparece UNA vez —ya entra revivido— cobra la mitad de su puesto (antes, entero). Medido sobre la T1: cambia sólo **VOL 18 2VS2**: **Six** (subcampeón) 3.750 → 1.875 y **RICKYFORT** 625 → 312 |
| **5 · Quién está en la llamada, más seguido** | *«sí, yo pensé que ya hacía eso… y cada minuto de hecho si es posible, así como se actualizan las llaves, pero como veas necesario»* | ✅ (01/10, 10:50 PM) `bot/en_llamada.py --seguir` y `.github/workflows/llamada.yml`, que larga el vigía (`llamada()`): mientras haya un evento en vivo, una conexión al Gateway anota cada minuto quién está; KV cada 10 min. El primero arrancó solo a las 10:50 PM con Dos Generaciones en vivo (FFA 10–11 en la llamada). La privacidad lo dice (1.75). **Una** conexión por noche, no una por minuto: Discord permite 1.000 por día y si se pasa resetea el token. Da también los minutos de cada uno (la tarea del Pase) |
| **6 · Los logos en máxima calidad** | *«busca en mis archivos de esta carpeta»* | ✅ los originales estaban en el repo: `herramientas/logos_web.py` los achicaba a 128; ahora a 512, sin agrandar los que vienen chicos (SR 338, TWR y FFS 256: no hay versiones más grandes a color en toda la carpeta). Las crews, desde `comun/logos_crew/` (512) |
| **7 · Un evento cancelado** | *«B»* (que diga «Cancelado» y avise a quien activó la campana) | ✅ 1.75: el vigía, cada 2 minutos, le pregunta a Discord por cada anuncio avisado que no empezó (`cancelaciones()`): borrado (404) o editado a «cancelado» después de avisarlo es cancelado; lo que no salió no sale y a quien le llegó le llega «❌ Cancelado» (reemplaza al del evento). El Inicio no lo muestra en vivo ni en próximos, y Fechas dice «CANCELADO». ✅ 1.76 (*«1. A»*): la re-publicación en `eventos-hoy` de DRA también —si todavía no salió, no sale; si salió, el bot la edita a «❌ CANCELADO», sin mencionar a nadie (una edición no le suena a nadie)—. El caso de hoy: **DESGRACIAS EN TOKYO VOL 21 2v2** (FFA, 7:20 PM), borrado entre las 8:11 y las 8:25 PM |
| **Eyou es LOLO EL GAUCHO** | *«EYOU :flag_mx: es LOLO EL GUACHO :flag_ar: x cierto»* (01/10, 9:50 PM) | ✅ alias a mano (`datos/akas_a_mano.json`: EYOU -> LOLOELGAUCHO) |
| **Las llaves en vivo, como se juegan** | *«A VECES se hacen batallas de otras llaves antes que la anterior»* · *«no se solucionó todavía creo»* · *«siento que se desactualizó… el tamaño, los colores y las mejoras de antes»* (01/10, 9:40 a 10:15 PM) | ✅ 1.73 y 1.74: `⌞Geoka⌝ VS ⌞⌝` es un cruce que espera rival (se pegaba con el de abajo: «Geoka vs Cinexfilo», que no existía); si los cruces no se arman como árbol, el cuadro de siempre —caras, colores, tope de alto— en el orden en que los escribieron y sin líneas; el «AHORA» sólo si se juega en orden; de un grupo donde pasan dos, los dos; y `enlazar()` no cuelga «al hueco de al lado» si lo enganchado por nombre no va en orden (corrige la #362) |
| **«Te toca»** —avisar cuando te toca, o una batalla antes— | *«he estado pensando en 2 ideas…»* (01/10, 10:15 PM) · *«2. podrías arrancar eso que te avisen por la web cuando te toque»* · *«si no viene durante un tiempo esa misma persona es reemplazada por el mismo organizador… no hay necesidad de seguir llamándolo. Otra forma para parar esto es cuando confirmas que el usuario está en la llamada compitiendo»* (01/10, 11 PM) | ✅ 1.76: el vigía lee cada minuto las llaves en vivo con el lector de la página y manda **«⏳ Sos el próximo»** a la batalla que sigue y **«🎤 ¡Te toca!»** a la de ahora, que vuelve a sonar cada minuto (hasta 3). Deja de llamar cuando **ya no está en la llave** (lo reemplazaron), cuando **está en la llamada** (se le pregunta a Discord antes de cada aviso) o cuando **su batalla tiene ganador**. Por la notificación de la página, sólo a quien **vinculó la campana con su Discord** —hoy 1 dispositivo—; el índice de nombres (786 con Discord ID, de la Lista y los alias) lo arma el ciclo. ⚠️ No avisa la **primera** batalla (la llave se publica antes de que arranque), ni una llave quieta hace 40 min, ni cuando no se sabe cuál va. Con «Dos Generaciones Vol 2» de esta noche, revelada batalla por batalla, habría avisado 10 de 15 |
| **El anuncio de «te toca»** | *«A»* (mostrámelo antes) · *«me gusta pero hacé el anuncio más conciso… y envialo al chat general de FFA y DRA, aparte, pero también a esos 2 canales de novedades y ranking global pero con el @everyone»* (02/10) | ✅ (02/10, 7:45 AM) de 1.216 a 509 caracteres: con **@everyone** en FFA ✦⚡︱novedades y DRA 〢🌍〉rankings-liga-global (sonó en los dos), y **sin mención** en los dos chat-general —el @everyone ya le avisó a esa misma gente—. Texto en `scratchpad/anunciar_te_toca.py` de la sesión |
| **La fecha de la T1 y los 8 servidores** | *«creo que esto se va a extender hasta que me acepten eso de Discord privileges… no sé si eso nos está restringiendo algo… podríamos continuar con la temporada, pero me gustaría agregar más servidores… mínimo son 8»* (02/10) | ✅ (02/10, 7:55 AM) *«El 12»*: **la T1 arranca el lunes 12/10 a las 12:00 AM ET** (`FECHAS` en `comun/temporada.py`) y termina el 31/12; la fase de prueba dura una semana más. La **foto libre pasa del 9 al 16/10** —los mismos cuatro días después del arranque— y el Worker ya lo tiene. Lo único que el ciclo había guardado con la fecha vieja era la semana de multiplicadores en curso (cortada a las 00:00 del 5: el lunes quedaban once horas sin multiplicador); ahora se acomoda sola si el arranque se mueve. Ensayo otra vez: todo corrido una semana. Los intents **no restringen nada hoy** (los tres en modo «limitado», el normal debajo de 100 servidores; el bot está en 8): la revisión pesa recién el 24/12. **El anuncio del cambio lo hace Dlx** (*«No lo anuncies. Lo anunciaré yo eventualmente»*): en Discord no sale nada mío. ⏳ **Los 8 servidores**: hoy hay **6** confirmados (DRA, FFA, Snake Rap, Urban Freestyle, FFS y, desde el 03/10, Dimensión del Freestyle); los 5 de la pre-temporada (TWR, TFC, Fontana, Freestyle Zone, EFA) ya tienen logo, colores y fondo de carta, y sólo les falta confirmar e invitar al bot |
| **La página con el ranking en cero, ensayada** (lo que el ensayo del 29/09 no cubría) | *«quiero que sigas trabajando en lo siguiente»* (02/10) | ✅ 1.78: armada en una copia aparte (`git worktree`) con lo que deja el paso 0 —pools vacíos, llaves de la prueba fuera— y el reloj de la temporada, y servida en local sin escribir nada afuera. **Las 17 vistas cargan, sin errores ni «undefined»**; los rankings vacíos dicen «Todavía no hay nadie», Publicaciones su vacío, «Los que mandan» y «Se busca» se esconden solos. **Tres arreglos**: «Lo que pasó» seguía mostrando los seis últimos de la prueba (sin llave) → ahora sólo lo de la temporada, como el calendario; la tira «Lo que se jugó · dos semanas» salía en ceros → se esconde sin eventos; el perfil de cualquiera decía «No lo encontré» → «Todavía no jugó esta temporada». ⏳ Visto de paso: el lobby de hoy pesa **135 KB** (el chequeo pide menos de 120); el día del arranque baja solo |
| **Idea: tarea del Pase «escuchá 10 minutos de batallas en vivo»** | *(la misma)* | 💡 **idea, sin decidir**. Sale de la 5 si guarda los minutos de cada uno durante el evento |
| **Tres en vivo, y uno no lo estaba** | *«ahora hay 3 en vivos CHEQUEA»* (01/10, 9:05 PM) | ✅ 1.72: «DESGRACIAS EN TOKYO VOL 20 1v1» (FFA, 5:34 PM) salía en vivo con la llave de «Dos Generaciones Un Destino Vol 2» (FFA, 8:44 PM): `llaveDeEvento()` de app.js juntaba por UNA palabra en común, y era «vol». Ahora las palabras de relleno no cuentan y los números tienen que coincidir, la regla de `_chocan()` de `sheet/llaves_web.py`. Las otras dos sí estaban en vivo: POESÍA CRUDA con la final por jugarse y Dos Generaciones recién empezado |
| **El evento de URBF en vivo desapareció** | *«no veo el evento de URBF que está en vivo, desapareció»* (01/10, 8 PM) | ✅ 1.70: «en vivo» duraba `vivo_min` (90 min) desde el anuncio aunque la llave se siguiera jugando; ahora sigue mientras su llave en vivo (`VIVO_L`) no tenga campeón, hasta 8 h, y si ya salió de `proximos` se la busca en el calendario (`liga.vivo()`). Y el escenario mostraba UN evento en vivo: ahora hasta tres a la vez («En vivo · FFA», «En vivo · URBF»), cada uno con su `clave` |
| **Las horas del Inicio, corridas** | (lo encontré mirando el «empezó 14:29» de POESÍA CRUDA en tu captura) | ✅ 1.70: `liga.dia()` le pasaba a `hora()` un `Date` y `utc()` lo volvía texto y lo releía como UTC: toda hora del Inicio salía corrida por el huso de quien mira (4 h antes en la hora del este). `utc()` devuelve el `Date` tal cual |
| **El video, en la página** | *«lo del video se ve algo raro de ese formato»* · *«deja que se vea el video en la página misma»* (01/10) | ✅ 1.70: «▶ Mirar acá» abre el reproductor (youtube-nocookie) en una ventana encima (`web/src/video.jsx`); el escenario no pasa solo mientras se mira y al cerrar deja de sonar. Lo «raro» era un choque de clases: la diapositiva y la miniatura se llamaban `mo-video`, así que toda la diapositiva tomaba el recuadro gris 16:9 (917 px de alto); la miniatura ahora es `mo-yt` y la de 1280×720. La privacidad dice lo de YouTube |
| **Las historias repetidas** | *«cada vez que hay algo nuevo me hace repetir las historias que ya vi, no me muestra la actual»* (01/10) | ✅ 1.70: cada círculo va de la más vieja a la más nueva, abre en la primera que no viste, y lo visto avanza historia por historia (`Visor`) |
| **Los logos en máxima calidad** | *«las imágenes o logotipos en todos los lugares que estén en máxima calidad»* (01/10) | ✅ 1.70: los íconos de los servidores venían a 128 px (`subir_web.py`); van a 512 y a 1024 donde se ven grandes (`liga.logo(sv, true)`); las caras a 256. ⏳ Los logos guardados de respaldo y los de las crews son archivos de 128: para subirlos hace falta la imagen original |
| **Mejorar la detección de llaves y de personas** | *«quiero que te enfoques en MEJORAR el sistema de DETECCIÓN de llaves y de PERSONAS automáticamente… el formato, las personas, etc.»* (01/10, 6:50 PM) | ✅ 1.69, medido sobre las 30 llaves de la T1 con `herramientas/comparar_lector.py` (ninguna otra fila cambia). **Llaves**: el refuerzo entre paréntesis ADENTRO del marco (`[ENEK + NEO (EZE)]`) ya no es del lado —dejaba sin ganador la semi de antes: Molusco, Gian, Eze y Zignos sin su semifinal en la VOL 18 2VS2—; la «R» suelta después de la bandera se limpia; el nombre que crece de una ronda a otra (MATI -> MATICERNA, PARIA -> PARIA SIN REMEDIO) pasa con su nombre nuevo (`escuchar._crecio()`, exacto: mismo principio desde 4 letras, misma bandera, resto del equipo igual, y lo agregado no es gente de la llave); la negrita de un lado entero decide cuando nada más lo dice y ya acertó 3 veces en esa llave (39 de 39 en la T1). Preguntas de batalla: **18 -> 12** (las que quedan: llaves de broma, la final en vivo y una para vos). **Personas** (`sheet/decidir.py`): lo que dice la llave (`NOMBRE <@id>`, la mención que pasó de ronda, el nombre que crece; `datos/identidad_llaves.json`), todos los eventos de un nombre, quien se anotó con su nombre de la Lista, y se cierra solo lo que tiene respuesta segura. ✅ Decidir: **55 -> 41** |
| **La llave en vivo de POESÍA CRUDA no se veía** | *«ahora hay otro evento en vivo pero no se publican las llaves en vivo»* (01/10, 7:20 PM, con captura) | ✅ 1.69: `[ CYPHER ]` solo en su renglón es la fase previa, en el lector del ciclo y en el de la página (`CYPHER_ENC`; el contrato `bot/llaves_casos.json` suma el caso). Un título con «cypher» sigue contando como antes. El escenario muestra la fase mientras el resto está vacío, completa cada ronda con los cruces que dice su nombre (un cruce de Cuartos se dibujaba como la Final) y no tacha a nadie sin ganador |
| **Makmah #3 y cuarto en Los que mandan** | *«por qué Makmah está en la cuarta posición del panel si es #3»* (01/10, captura) | ✅ 1.69: el orden era el de ahora —Liberia y Makmah empatan en 81 y Liberia va #3 por puntos— y las tarjetas eran las de antes, mientras el ciclo las redibujaba (7:32 y 7:38 PM). El Inicio ahora dice «⏳ SE ESTÁ REDIBUJANDO» debajo, como ya hacía la página vieja |
| **El dorado que ya se jugó** | *«si ya se jugó, que desaparezca esta cosa»* (01/10) | ✅ 1.69: se ve hasta 5 h después de empezar («se juega ahora») y después sale de la Tira, de las historias y del perfil del servidor |
| **Las llaves de cualquier formato** («check the llaves», con la de la DESGRACIAS EN TOKYO VOL 20 de Discord; *«asegúrate que las llaves puedan interpretar bastantes diferentes formatos»*) | 01/10, con capturas | ✅ 1.68: los Octavos eran **triangulares** y el Inicio cortaba cada cruce en dos nombres —se perdían ELSOLAR y ZIGNOS, que habían ganado—. Ahora `lados()` trae todos, cada casilla mide lo que su cruce, y un lado solo dice «pasa directo». Probado con 11 formatos en tres pantallas (`probar_llaves.py`, en el scratchpad): 1v1 de 16 y de 32, en vivo y terminada, triangulares, cuadrangulares, 2v2, pase directo, Filtros y tercer puesto, una sola final y una irregular de 12, que cae al cuadro por rondas |
| **Que la llave no crezca de alto sin necesidad** | *«tampoco hagas que se expanda demasiado en altura innecesariamente, porque se ve algo raro»* (01/10) | ✅ 1.68: las filas de los cruces de tres o más son más bajas, y si la primera ronda **ya terminó** y la llave no entra en 540 px, se ve desde la que se juega (la de hoy: de 814 a ~300 px). Una ronda que se está jugando no se saca nunca |
| **Quién es quién: el bot, solo y esa noche; ✅ Decidir sólo para lo imposible** | *«la cosa es que el BOT haga la mayoría de las cosas por su propia cuenta… hasta el máximo»* · *«ahora es el momento»* (01/10) | ✅ 1.68, dos reglas nuevas en `sheet/decidir.py`: **el nombre exacto de UNA cuenta que estaba en la llamada** del evento es esa persona, aunque no esté en la Lista (entra, si está en el servidor del evento); y **un nombre parecido al de UNA sola persona de la Lista que estaba en la llamada** es alias suyo. Con dos candidatos sigue preguntando. Medido con la VOL 20: de los 24, 17 ya conocidos, 5 por inscripción o apodo, y **los 2 que quedaban** —TITO CALDERON y ELSOLAR (Elsoolar)— ahora también |
| **El contacto y la edad, en la privacidad y los términos** | *«underlegendscontacto@gmail.com»* · la edad: *«si es por las 20 cosas… sí»* · el responsable: *«No»* (01/10) | ✅ 1.68: el mail como contacto y para pedir el borrado; la edad mínima (13, o la de la ley de cada país, con el camino para madres, padres y tutores). Sin responsable con nombre |
| **La llave en vivo, entera, con el texto más a la izquierda; y se veía gris** | *«para mostrar todas las llaves incluso el texto se podría ir más a la izquierda, y el color se ve raro… el contraste está gris»* (01/10, con captura) | ✅ 1.67: con los Cuartos a medio jugar la llave no daba «pareja» y caía al cuadro de respaldo (casillas blancas con letras blancas, sin Semis ni Final). Ahora `completar()` arma la llave entera —los cruces que faltan, vacíos y en su lugar—, en pantallas de 1280 o más entran las cuatro rondas, el escenario usa hasta 1400 px y en el celular se ven las rondas que se juegan |
| **Los enlaces de Under Legends como Red Bull**: la portada es la marca y la Liga Global vive en su sección | *«sería underlegends.pages.dev/onlinerap quizás… underlegends será más cosas… dame ideas de enlaces»* (01/10) → *«freestyle — todo lo de la liga global estará dentro de ahí»* → *«/freestyle-rap, put it like that, better»* | ✅ **`/freestyle-rap`**: la Liga Global entera adentro (`/freestyle-rap/ranking`, `/freestyle-rap/r/hassan`…); tu cuenta y el changelog en la raíz (`/cuenta`, `/cambios`); la portada, de UL. ✅ **1.71 (01/10)**: en línea. La raíz sola lleva a `/freestyle-rap/` hasta que UL tenga portada; `/ajustes` también va en la raíz (es parte de tu cuenta). Los links viejos `/#/…` llegan solos a la dirección nueva (`limpiar()` en el script del principio, que sale de `web/montar.py`), y `<base href="/">` arregla lo de los archivos con ruta relativa. ✅ (01/10, 11:10 PM) Los botones y links del bot (`bot/worker.js`, `bot/avisos.js`, `sw.js`) ya mandan `/freestyle-rap/…` (`/cuenta/verificar` en la raíz) |
| **Los que mandan con flechas**: Temporada, Competitivo, Duelos, Podios, Rachas, Países y Crews, cinco por categoría | *«donde dice los que mandan podrías añadir las flechas para ir hacia competitivo el top 5, países, rachas, etc.»* (6:20 PM) | 📌 va con el remake |
| **El panel de abajo con flechas** en lugar del Ranking (que ya está en Los que mandan): **Misiones** con la previa del Pase al costado · **Tus eventos** con Tu temporada · **La Liga en números** | *«el default sería misiones y al costado una previa del pase de temporada… luego… últimos eventos y tus resultados y al costado tu temporada… luego otra flecha con estadísticas de la liga global»* (6:20 PM) | 📌 va con el remake. Las Misiones y el Pase van de ejemplo: todavía no existen |
| **Se busca y el pie en negro**; los afiches de Se busca pasan a papel pegado en la pared. **Los servidores, en blanco** | *«quizás poner todo negro esa parte, igualmente los servidores de la liga»* (6:20 PM) · *«los servidores de la liga make it white»* (6:50 PM) | 📌 va con el remake |
| **Lo último va arriba de Esta semana** | *«I feel LO ÚLTIMO should be above ESTA SEMANA»* (6:50 PM) | 📌 va con el remake |
| **La Temporada y la Servidor son de todos los que jugaron y están en la Lista**, verificados o no; la Competitiva, la de País y las que vengan, sólo de los verificados en DRA. BNA (baneado) y los de `no_verificar` no entran | *«Dale»* (4:46 PM), con el número: de 79 a 146 de los 185 que jugaron | ✅ la mitad de adentro (`add70e2`): el ciclo dibuja, bloquea y borra con la regla nueva · ✅ **la de afuera** (1.52): `/card` y `/versus` los encuentran por `dn:<id>` y muestran la Temporada y la Servidor; la Competitiva y la de País van **con candado 🔒** y al apretarlas dicen «verificate» (la tuya) o «todavía no se verificó» (la de otro). La página muestra sus dos tarjetas y la Guía dice qué pide cada una. Medido sobre los 185 que jugaron: **79 verificados, 57 sin el rol y 10 sin Discord ID** tienen sus libres dibujadas; 39 no están en la Lista y 1 no se toca |
| **Se mide quién vuelve a jugar un segundo evento**: por semana de debut, otro evento **otro día** dentro de 14; va en el mapa en vivo | *«Va»* (29/09) | ✅ `rankings.retencion()` → `datos/estado_escuchar.json` → el medidor «Vuelven a jugar» |

⚠️ **FFA y EFA siguen con la silueta, y ya lo decidió Dlx** (*«que se quede así de momento»*): el ícono de FFA es un póster con micrófonos, llamas y texto, y a 30 px es ruido. Si algún día va con el ícono, es una línea (`CON_ICONO` en `comun/escudos.py`).

---

## 📅 Jueves 01/10 (5:50 PM) — versión 1.66: instalar paso a paso, y las fotos que faltaban

**Instalar la app.** Dlx, con la captura de la parte de Ajustes: *«sé más específico, e incluso si
puedes crea y saca imágenes o genera imágenes que reflejen cada paso»*. Ahora son pasos con un
dibujo cada uno —Android con Chrome y iPhone con Safari, elegido solo según el teléfono—, y si
el navegador deja instalar de un toque, el botón va arriba. **No son capturas**: los menús del
navegador no son parte de la página y cambian con cada versión, así que se dibuja la pantalla, se
escribe sólo lo que hay que tocar y lo demás son barras grises. Un renglón gris no envejece.

**Las fotos.** Dlx, con el `/card` de MILICA: *«todavía hay algunas personas sin su foto»*. Medido:

| | |
|---|---|
| verificados | 346 |
| con su foto de la T1 | 302 |
| **con foto en Discord y sin la de la T1** | **24** — se bajaron 23; la de ropomc el CDN no la sirve |
| sin foto en Discord | 20 — van con la inicial, a propósito |
| en la Lista sin verificar, fuera de DRA | 36 — la foto es de los verificados |

🔴 **La causa: las fotos se bajaban a mano** (`bot/fotos.py --bajar`) y nada lo volvió a correr
desde el 20/09. Y el conteo de `--ver` leía un volcado de KV de una semana: decía 324 verificados.
Ahora `fotos.para_el_ciclo()` lee KV en vivo y es el **paso 2f** del ciclo, justo antes de «qué
cambió», así la cara entra al sello y la tarjeta sale con ella en la misma vuelta.

**Y lo que pidió Dlx, en el bot**: quien pide **su** carta y no tiene foto recibe un mensaje que
ve sólo él (`avisoFoto()` en `bot/worker.js`). Sin verificar: «la foto es de los verificados»,
con el botón «Verificarme en la página». Verificado y con foto en Discord: se la guarda ahí mismo
(la primera no gasta el cambio de la temporada). Sin foto en Discord: que se ponga una.

---

## 📅 Jueves 01/10 (5:15 PM) — versión 1.65: verificarte desde la página

Dlx, con la captura de un `/card` que decía «todavía no estás verificado»: *«en vez de que le
aparezca así, haz que la gente se verifique por la página web, así más rápido, y que esto te
redirija, y que te entres a DRA automáticamente al hacer eso»*. Con sus dos «A»: el país se elige
en la página (el bot pone el rol en DRA) y el Miembro lo da el ciclo.

| pieza | qué hace | dónde |
|---|---|---|
| **la página** | `#/cuenta/verificar`: qué tenés y qué te falta, con el botón que lo arregla | `PaginaVerificar` en `web/src/cuenta.jsx` |
| **el permiso** | Discord pide `identify guilds.join` (modo `d` de `urlLogin()`); se usa una vez y no se guarda | `verificarme()` en `app.js` |
| **el Worker** | te mete en DRA (`PUT /guilds/{dra}/members/{vos}`), pone el rol de país elegido y te anota (`reg:`), como `/verificar` | `cuentaVerificar()` en `bot/worker.js` |
| **el bot** | `/card`, `/verificar` y el candado de las libres: un solo botón, «Verificarme en la página» | `comoVerificarse()` |

⚠️ **El país va DESPUÉS de las reglas de DRA.** DRA tiene pantalla de reglas (medido con su API: y
su bienvenida no pregunta el país), así que quien entra queda «pendiente» hasta aceptarlas. Un rol
puesto por un bot a alguien pendiente puede saltearse esa pantalla: mientras estés pendiente, la
página te manda a DRA y recién después te pone el país. Tampoco te anota hasta entonces.

⚠️ **Sólo a quien no tiene rol de país.** Con uno ya puesto no se toca: cambiar de país es cosa de
DRA. Con dos banderas en el nombre y ningún rol, sí: el rol gana sobre las banderas, como en
`pais_por_rol`.

Probado: 28 pruebas nuevas del Worker (`bot/probar_local.mjs`: nunca pone el Miembro, nunca a un
pendiente, el freno, «lleno», «no te deja entrar», el proxy) y la página en el navegador con cada
respuesta, la vuelta de Discord y la cancelación. Al probar «Cancelar» apareció un bug viejo: si
`app.js` cambiaba la dirección antes de que el Inicio nuevo escuchara, se quedaba en la vieja.
Arreglado en `App.jsx`.

---

## 📅 Jueves 01/10 (3:45 PM) — versión 1.61: el changelog nuevo

Dlx: *«trabajemos en otras secciones»* y, para empezar, el changelog (*«1. A»*). Es **la primera
página que el Inicio nuevo le saca a la de hoy**: hasta acá sólo dibujaba rutas que `app.js` no
conocía (`#/sv/<SIGLA>`).

- 📜 **Por día, con la última abierta y lo no visto marcado y abierto**; los días viejos se
  pliegan con cuántas versiones traen. Medido en el celular: de **31.000 px a 3.300**.
- 🔗 **`#/cambios/<versión>`** abre esa sola, con su día, y la deja a la vista. Cada versión trae
  «Compartir».
- ☰ **El menú** tiene la fila «Changelog», con «NUEVO» si hay algo que no viste.

🔑 **Cómo se queda con una vista que `app.js` SÍ conoce** (`PROPIAS`, la misma lista en
`web/montar.py` y en `web/src/App.jsx`): el script del principio la trata como del Inicio, el
CSS esconde **todas** las vistas viejas mientras manda el Inicio nuevo (antes escondía sólo la
del Inicio) y `app.js` la sigue dibujando escondida. Si la app no carga, a los 8 s vuelve la vieja
sola: probado bloqueando `inicio.js`.

⚠️ **`app.js` da el changelog por visto apenas dibuja el suyo**, y lo hace antes que el Inicio
nuevo: abriendo `#/cambios` directo no salía ningún «NUEVO». El script del principio guarda qué
habías visto antes (`window.__cambiosVisto`) y, si se llega navegando, el Inicio lo toma justo
antes de que `app.js` vuelva a pintar (envuelve `pintaCambios`).

⚠️ **`index.html` estaba distinto de lo que arma `web/montar.py`**: el aviso de instalar de la 1.60
se había agregado a mano. Ahora el bloque sale igual de los dos lados (comprobado comparándolos).

## 📅 Jueves 01/10 (2:07 PM) — versión 1.60: tu próximo evento, el buscador, la app y las llaves con la clave

Lo que Dlx aprobó de las sugerencias de la revisión (*«me gusta tu idea»*, *«ok…»*, *«sí»*,
*«diría que sí»*). Probado con una prueba por cosa (`probar_bce.py`, `probar_f.py`) y la
auditoría completa, que sigue limpia.

- 🎯 **Tu próximo evento** (`momentosTuyos()` en `web/src/arriba.jsx`): a quien todavía no
  tiene letra, el próximo de **su** servidor en 36 h —si no hay, el que sigue en la Liga—, con
  la cuenta atrás, «Quiero aviso», «+ Calendario» y cuánto le falta para su letra. El
  «Próximo» de la Liga no repite ese mismo evento. Lo ve sólo esa persona, en la página.
- 🔎 **El buscador** encuentra raperos, servidores, países y crews (exacto, después «empieza
  así», después «contiene»; a igual coincidencia, raperos primero). **En el celular el de
  arriba está escondido**, así que vive también en el menú ☰.
- 📲 **Instalar como app** (`Instalar`): Chrome avisa una sola vez que se puede, y puede ser
  antes de que el Inicio monte, así que `index.html` guarda el aviso (`window.__instalar`).
  Sólo en pantallas táctiles; con la ✕ no vuelve (`lg:instalar`). En el iPhone no hay botón
  posible: va cómo se hace a mano.
- 👥 **Las llaves con la clave de cada uno** (la F). Las llaves traen sólo el nombre, y a dos
  «SOL» —uno de Perú y otro sin país— los separa **la bandera escrita**: así los agrupa
  `rankings.canon()`. `_quien()` compara primero contra las banderas del nombre con el que
  cada uno está en el ranking (`full`) y después contra el país del padrón, que era lo único
  que se miraba. La clave va como cuarto elemento de la fila **sólo cuando el nombre se
  repite** (hoy, seis filas). La misma búsqueda arregla dos cosas que estaban rotas:
  - **Los perfiles de `sol-x` y `pariasinremedio-x` salían sin eventos**, y su último
    resultado vacío: «SOL» sin bandera y «PARIA SIN REMEDIO 🇧🇲» (Bermudas no es un país de
    la Liga) no encontraban a nadie.
  - **La página vieja** usa la clave en los campeones de cada llave (`porK(r[3] || kDe(r[0]))`)
    y el Inicio nuevo en «Tus eventos».

⚠️ **Dos que se escriben IGUAL y con las mismas banderas ya son una sola fila del pool**: eso
no lo separa nada de acá. Haría falta llevar la identidad desde que se lee la llave —los IDs
de las menciones ya están en `bot/llaves_a_entrada.py`— hasta `Resultados` y el pool.

⚠️ **El lobby pesa 133,4 KB y su propio self-check pide menos de 120** (`subir_web.py --auto`
da 🔴). No es de esta tanda —sin ella pesa 133,4 igual; las seis claves suman 0,1 KB— y no
frena nada: ni el ciclo ni los chequeos de CI corren ese self-check. Es el pendiente de
siempre: qué columnas de la tabla pasan a los perfiles, que se piden sólo al abrir uno.

## 📅 Jueves 01/10 (1:19 PM) — versión 1.59: la revisión de bugs del Inicio

Dlx, 30/09: *«Ok lets check some bugs in this new system… Take ur time»* y *«Sigue.
Tómate tu tiempo»*. Se buscaron **midiendo la página**, no leyendo el diff: una
auditoría con Playwright en ocho anchos (360 a 2560), cuatro personas (sin entrar,
Discord sin ser rapero, rapero, buscado) y el tema de noche, más una prueba por
cada arreglo. Lo que salió:

| bug | cómo se vio | arreglo |
|---|---|---|
| **El visor de historias y el escenario seguían lo que mirás por su LUGAR** | los datos se rehacen cada minuto: si empezaba un evento en vivo, su círculo entraba primero y corría a todos un lugar, y saltabas a otra historia a mitad. El reloj de cada historia volvía a cero en cada refresco | por **id** (historias) y por **tipo** (momentos); el visor se cierra si su historia desaparece (`abajo.jsx`, `arriba.jsx`) |
| **Dos personas, un nombre** | hoy «Volk» 🇲🇽 y «volk» 🇨🇴, dos «SOL» y dos «PARIA SIN REMEDIO». Las llaves traen sólo el nombre y se comparaba sin mayúsculas: cada uno veía en «Tus eventos» y en «Tu último evento» los del otro | si el nombre se repite vale sólo el exacto, como en el perfil de `app.js` (`liga.esDe()`). ⚠️ **Los dos «SOL» y los dos «PARIA SIN REMEDIO» se escriben igual y siguen sin separarse**: para eso las llaves tendrían que traer la clave de cada uno |
| **Los cuatro servidores de «Esta semana» no se alcanzaban con el teclado** | medido: `display:contents` en el `<a>` lo deja en 0×0 y sin foco, ni con Tab | el link es la caja; el dibujo sale igual (diferencia máxima 4 de 255) |
| **Una carta de R2 que no cargaba** mostraba el ícono de imagen rota | cortando las `.webp` en la prueba | un reintento y después «SIN CARTA»; las fallas cuentan por dirección, así que una carta nueva se vuelve a intentar |
| **Una cara que fallaba quedaba fallada** para la persona siguiente en el mismo lugar | `mal` era un sí/no | se recuerda la dirección que falló (`Cara`, `CaraH`, `CaraDc`, `Bandera`, la barra de abajo) |
| **Quien entró con Discord y no es rapero** leía «Entrá con Discord» en Tus eventos y Tu temporada | la persona «discord» de la auditoría | su propio texto y «Mi cuenta» |
| **Un `%` suelto en `#/sv/…` tiraba el Inicio entero** al de respaldo | `URIError` | `decodeURIComponent` con `try` |
| **Armar las historias fuera de las secciones aisladas**: si fallaba, se caía todo el Inicio | leyendo `App.jsx` | con `try`: sin historias, el resto sigue |
| **Dos eventos en vivo a la vez** compartían el id `vivo` | | `vivo-<sv>-<nombre>` |
| **El IR A dejaba de marcar** las secciones que aparecen después de montar (Lo último llega con el muro) | | el observador se rearma cuando cambian |
| **Los enlaces de cada sección sin `href`** («Entrar», «Mi cuenta») no se abrían con Enter | | Enter y espacio |
| **Las pestañas de un panel que se achica** apagaban la sección | `items[i]` ya no existía | el índice se recorta |
| **El puesto de la Temporada** debajo del top 5 decía el lugar en la lista, no el oficial (hay empates) | | `pos` |
| **Compartir en la computadora** abría el menú de Windows | | sólo en pantallas táctiles; en la compu se copia el link |
| **«R32», «Cuartos»** en grande no decían nada | | «LLEGASTE A 16AVOS», «SEMIFINALISTA», «3.º» (`resultado()`) |
| **El dorado que ya se jugó** decía su fecha en la historia del servidor | | «se jugó el …» |
| **Tu voto de El Elegido** desaparecía si no estaba entre los cuatro más votados | | queda a la vista |
| **Una fecha que falta** se escribía «el undefined» | | vacía |

⚠️ **La auditoría se trabó una vez en IR A y no era un bug**: después de «Ahora» la barra
se esconde —estás arriba— y no se puede tocar, como tiene que ser. Con el CSS de antes
fallaba igual. La prueba ahora vuelve a bajar antes de cada clic.

⚠️ **Y los tres avisos que deja son de diseño, no bugs**: «Ahora» y «Esta semana» viven
adentro del panel de arriba, así que al ir ahí la barra se esconde; y «La Liga» es la
última sección, así que en una pantalla grande la página no puede bajar lo suficiente para
dejarla pegada a la barra. Los ocho anchos con las cuatro personas, sin un solo hallazgo.

⚠️ **No correr dos pruebas a la vez contra el servidor local de pruebas**: se colgó y
parecía que la página no cargaba un perfil de servidor.

## 📅 Martes 29/09 (11:10 AM) — quién vuelve a jugar

- 📈 **Se mide en cada corrida quién vuelve a jugar un segundo evento**: de
  los que debutaron cada semana, cuántos jugaron otro **otro día** dentro de
  los 14 días (dos llaves la misma noche no es volver). Sale de las filas que
  ya arma `rankings.agregar()`, con los alias resueltos y sin trolls, así que
  no lee nada de más. Sólo conteos. En el mapa: el medidor «Vuelven a jugar»
  y el detalle en la pieza de las Llaves.
- 📏 **El primer número** (11 AM): 188 jugaron en la T1 y 106 jugaron un solo
  evento. De los 164 que debutaron la semana del 21/09, **75 ya volvieron**
  (46 %); esa semana se cierra el 11/10.
- 🔑 `secretos_en_git.py` marcaba `GH_REPO` como filtrado: es el nombre del
  repo público, que el mapa usa para leer las corridas. Ahora está en su lista
  de lo que no es secreto.

## 📅 Martes 29/09 (9:15 AM) — el mapa en vivo, The Cosmic Rap y la auditoría

Sin versión nueva para la gente: nada de esto se ve en el menú.

- 🗺️ **El mapa, en vivo** (tu *«1. C»*): `underlegends.pages.dev/mapa.html`,
  sólo si entraste con tu Discord en la página. Se explora como el grafo del
  reel: arrastrar, zoom, **Libre** u **Ordenado**, cada pieza se abre en sus
  partes (los 19 pasos de escuchar, las hojas del Operativo, las claves de
  KV…), buscar por nombre y los cinco recorridos. Y cada pieza tiene un punto
  que dice cómo está **ahora**, de tres fuentes que ya eran públicas: el
  vigía (`/api/avisos/estado`), las corridas de GitHub y lo que deja el ciclo
  en `datos/estado_<trabajo>.json` (pasos, cuánto tardó cada uno, qué falló,
  las preguntas de ✅ Decidir y las cuotas). **No gasta KV.**
- ⚠️ **La puerta no es un candado**: la vista se abre si la página dice que
  sos vos; los datos que muestra ya son públicos (el repo y Actions lo son).
- 📸 El artifact «El mapa de la Liga» pasa a ser la **foto** del mismo mapa,
  armada con los mismos archivos: un artifact no puede pedir datos afuera.
- 🛰 **The Cosmic Rap** quedó como servidor **de identidad**, igual que
  LIVONIA y CONFED: sus miembros sirven para sacar Discord ID y nada más (ni
  eventos, ni llaves, ni carta de servidor, ni campana, ni #N). Medido al
  entrar: 371 miembros y **ningún ID nuevo hoy** — ninguno de los 264 del
  padrón sin ID coincide con alguien de ahí.
- 🔴 **La auditoría del lunes había fallado** (28/09, 3:53 PM ET; te llegó
  el DM): tres scripts —`navegador.py`, `olvidar.py`, `invitaciones.py`—
  podían caerse al imprimir un emoji en una consola de Windows. Arreglado
  con el arreglo de la propia herramienta. Y **no era una sola: eran tres**, y la primera tapaba a las otras dos. Al correrla de nuevo cayó en «¿los self-check chequean algo?» —una carpeta de fotos que el repo público no lleva; la regla fue a la herramienta y no a `comun/`, para no redibujar el pool— y en «la web contra sus casos de borde» —no tenía navegador y no conocía las rutas de la campana—. ✅ **Arregladas las tres: la de las 9:27 AM pasó entera.**
- 🧩 **¿Hay una extensión que haga esto?** Para el **código**, sí: el plugin
  **code-map** del directorio de Anthropic arma un mapa así (grafo, panel,
  búsqueda, recorridos) desde los archivos. Lo que ninguno sabe es cómo está
  el **sistema** ahora (si el ciclo falló, cuánto KV va), que es lo que suma
  este.

## 📅 Martes 29/09 (8 AM) — el mapa de la Liga y Serena

Sin versión nueva: la página no cambia. Tu *«Creo que las 2 no?»*, después
del reel del grafo:

- **El mapa de la Liga**, en un artifact privado (el link va por el chat):
  las 23 piezas en cinco columnas —dónde corren— y cuatro franjas —cada
  cuánto—, con lo que lee y escribe cada una, cinco recorridos que siguen un
  dato de punta a punta y un reloj en vivo con la próxima corrida.
- **Serena**, un mapa del código para mí: busca funciones por nombre en vez de
  leer archivos de 2.000 líneas. Va **sólo lectura** y con un modo propio: el
  que trae para Claude Code prohíbe las herramientas de siempre y guarda sus
  propias memorias, y las dos cosas eran lo «raro» que no querías. Su
  configuración y su índice viven fuera del repo (`~/.serena`).

Lo que se midió para el mapa (7:40 AM ET):

| | medido | el límite |
|---|---|---|
| KV, escrituras | **396** hoy (desde las 8 PM ET) | 1.000 por día; el ciclo se frena en 850 |
| KV, por hora | casi siempre 0 a 10; ráfagas al redibujar, **192** el lunes a las 6 PM | — |
| Worker, CPU | la mitad 0,98 ms, el peor 1 % 3,44 ms | 10 ms |
| Worker, pedidos | 3.885 en 24 h, 0 errores | 100.000 por día |
| R2 | 8.869 archivos, 0,91 GB | 10 GB |
| el ciclo | escuchar 2 a 6 min; dibujar de 40 s a 31 min | 20 y 120 min |
| quién lo arranca | **10 de las últimas 12** corridas, el Worker (:22 y :52) | — |

⚠️ **El repo de sync falló el 28/09 a las 12:22 PM ET** por la cuota de
lecturas por minuto de Sheets (429), a la misma hora que arrancaba el ciclo.
El ciclo reintenta los 429 (`sheet/escribir.py`, hasta 90 s); el sync no.

✅ **Tu «A» (8:06 AM): el sync ya reintenta.** Y no le faltaba del todo:
tenía `sheet_read()`, pero envolvía la llamada de afuera, así que el
`open_by_key()` —el pedido que murió— corría antes de entrar. Ahora la espera
vive en el cliente de gspread (`ClienteConEspera`) y cubre todo pedido. Su
autotest suma cuatro casos sin red, y se probó abriendo el Operativo con el
cliente nuevo.

---

## 📅 Martes 29/09 (5:30 AM) — versión 1.51

Tus ocho respuestas de las 4 AM y tu captura de TOKYO: *«pusieron 17 cuando
era 16… asegúrate de tener cuidado con ello»*. Y *«¿puedes poner lo más
reciente arriba?»*: el artifact de novedades ahora arranca por tus preguntas y
lo del día, y deja las reglas al final (en cada tema, la más nueva primero).

- 🔗 **TOKYO VOL 17 ya tiene su llave.** El anuncio decía «VOL 17 1VS1» y la
  llave «VOL 16», y `cruzar()` exige el mismo número —«VOL 11» y «VOL 12» sí
  son dos eventos—. No se relajó el número: hay una **segunda pasada**
  (`_huerfanas()`) sólo para el anuncio que quedó sin llave, que pide la misma
  **serie** (el nombre sin números ni modalidad), una llave que **ningún otro
  anuncio se llevó** (contando todos, no sólo los seis de «Lo que pasó»),
  publicada **después del anuncio y antes del siguiente de esa serie**, y de
  la misma **forma** (1vs1 contra equipos). Con dos posibles no elige.
  **Medido sobre los 113 anuncios: cambia uno solo.** El lobby se subió a
  las 5:15 AM: ya está en la página.
- ⚠️ La forma entró también a la primera pasada: esa noche las dos llaves
  dicen «VOL 16» (el 2VS2 y el 1VS1). Y la medición encontró un error mío
  antes de subir: con «Pandillas = equipos», **ELRAP FECHA 6 perdía su
  llave** —sus batallas son de 3 y 4 personas, cada una sola—. «Pandillas»,
  «MULTIVERSE» y «4x4» (compases) quedan como «no se sabe».
- 🪪 **Tus 5, 6 y 7**, en la Lista y en `akas_a_mano.json` (commit de las
  4:04 AM). Eze y Kenny son Miembros: su tarjeta sale en la corrida de las
  11:22 AM (a verificar).
- 🧹 **El historial (4 · A), subido a las 5:43 AM.** Respaldo verificado
  fuera del repo (`LigaGlobal_Tarjetas_respaldos/`: el bundle de 88 MB con
  los 593 commits y los 4 archivos de apodos) y los 593 commits reescritos
  con el árbol idéntico. Los tres primeros intentos se cortaron: el
  historial nuevo no comparte commits con el viejo, así que git manda los
  88 MB enteros, y sobre HTTP/2 la subida se colgaba (una vez llegó al
  100 % y GitHub cortó al final). **Forzar HTTP/1.1 lo destrabó**
  (`git -c http.version=HTTP/1.1 push`). Un atajo —una rama puente que
  volvía a colgar los commits viejos en el repo público— lo frenó el
  control de seguridad, con razón: republicaba justo lo que se quería
  sacar.
  - Antes del push se pasaron al historial limpio los dos commits de hoy
    (TOKYO y estas novedades) y el lease fue sobre la punta del remoto.
    En la PC se borraron `refs/original`, el reflog y los objetos viejos:
    no queda ningún `docs/apodos_*`. 0 forks del repo.
  - ⚠️ **GitHub todavía sirve el commit viejo a quien tenga su código
    exacto** (`9505f4e…` responde): queda suelto, sin rama que lo muestre,
    hasta que GitHub haga su limpieza. Para borrarlo ya, se le pide a
    GitHub Support desde la cuenta dueña (ver ❓).
- 🎙️ **La llamada (2), hecha: `bot/en_llamada.py`, paso 1b2 del ciclo.**
  - **Sólo con un evento en vivo**, con la ventana del vigía: de 15 min
    antes del arranque a 5 h después, o una llave publicada en las últimas
    3 h (`/avisos/vivo`). Sin eso no se conecta.
  - **Discord sólo lo dice por el Gateway** (no hay ruta REST que liste un
    canal de voz): una conexión de segundos con `GUILDS` y
    `GUILD_VOICE_STATES`, ninguno privilegiado. Sin el de presencias, el
    estado de cada servidor trae como miembros sólo al bot y a quien está
    en voz. Probado contra Discord a las 5:50 AM: READY con los 7
    servidores, y cada uno con miembros=1 (el bot) y nadie en voz a esa
    hora. La red de la PC estaba en ~10 KB/s; en el runner son segundos.
  - 🔒 **Son IDs de gente**: van a KV (`voz:<SV>`, vence a los 3 días) y el
    log dice cuántos, nunca quién —los logs de Actions son públicos—. Se
    guarda **cuándo se vio a cada uno**, no la fecha: un evento de las
    11:50 PM con la llave de las 12:05 AM cae en dos días.
  - **✅ Decidir lo usa como pista** del «¿quién es X?»: *«🎙️ En la llamada
    de FFA, mientras se jugaba, estaba «MOTERA» (en la Lista: Jult)»*, y si
    esa cuenta está en la Lista, «Es Jult» entra como opción. Sólo cuenta
    quien se vio desde 1 h antes de publicada la llave hasta 5 h después.
    Un nombre parecido es sólo pista (en la llamada también hay público);
    el nombre EXACTO de una sola persona que ya está en la Lista se
    resuelve solo como su alias (*«1. A»*, 6 AM).
  - Se prueba de verdad la primera noche con un evento (a verificar).
  - `websocket-client` entra a `requirements.txt`, y la auditoría de
    dependencias ya sabe que `import websocket` es ese paquete.
## 📅 Martes 29/09 (2:30 AM) — versión 1.50

Tus tres NAVES DE FUNA de ejemplo, *«2. A»*, *«3. no lo sé… tienes que estar
chequeando las inscripciones constantemente»*, *«5. A, ya se lo dije»* y el «#»
del apodo.

- 🌀 **La NAVE DE FUNA se lee y se paga.** Hasta hoy la fase de eliminación
  no la leía nadie: la llave quedaba con la final sola (2 o 3 personas: «no
  hay escala») y los otros 9 a 13 no existían. Ahora la fase —la lista con
  ❌, en los tres estilos de tus ejemplos— entra entera; la final de tres se
  ordena con el podio; el 🥇 sirve de campeón; y **los que cayeron empatan**:
  la llave dice quién cayó, no en qué orden, así que se reparten lo que valen
  juntos sus lugares, como el empate de los 5 vidas (§10.1). Probado con tus
  ejemplos (16+): tam 10.000, Guess 7.500, multi 6.000 y los 13 de la fase
  1.884 cada uno; un solo duelo, la final. En la página, la fase es una
  lista (los que siguen primero, los que cayeron apagados con ❌), también en
  vivo antes de que haya final. Ninguna de las 74 llaves reales guardadas se
  confunde con una. ⚠️ Tu guía (§12) decía descartar las fases de cypher sin
  batallas: ésta no se descarta porque dice quién cayó (pregunta abajo).
- 👥 **ME TIENE SIN CUIDADO eran Paria y Kravitz** (*«A»*): cobran el
  subcampeonato de la VOL.13, 3.750 cada uno.
- ✅ **TEAM VENECIA confirmado fuera**: la corrida de la 1:22 lo sacó de la
  tabla de su evento y del pool; la llave lo muestra como equipo. Y **la VOL
  16 quedó con Oasis campeón** (PARK JI SUNG), Hassan (PRR) y Makmah (MAKMA)
  con su nombre.
- #️⃣ **El «#» del apodo, sólo del Competitivo y en toda la Liga.** Había
  **139 apodos con un número de la pre-temporada** (57 en DRA, 82 en FFA).
  Aplicado a la 1:53 AM: 136 perdieron el número (queda su nombre) y
  **Hassan es «#1 | Hassan» y Makmah «#2 | Makmah»** —los dos que hoy tienen
  número: pasan los 10 eventos y son Miembros (Velatz los pasa pero no es
  Miembro: fuera de concurso)—. Sigue solo en cada ciclo (2b6), en los cinco
  servidores; en FFS el bot no puede cambiar apodos. Y `/numeral`, a quien
  no tiene número, le saca el viejo y le explica que se entra con 10 eventos.
- 📝 **Las inscripciones, cada minuto.** El canal de inscripciones de FFA no
  tenía ni un mensaje de la noche de la 2VS2: el organizador lo limpia.
  Ahora el vigía lee los canales de inscripciones cada minuto mientras hay un
  evento anunciado o en juego, y guarda tres días lo que se anota —aunque
  después lo borren—; el ciclo lo suma. En el primer minuto ya tenía 34. La
  ruta trae Discord IDs y no es pública.
- 🔴 **Y dos cosas mías o viejas, arregladas**: los respaldos de apodos del
  19/09 (Discord IDs y apodos de ~140 personas) estaban commiteados en
  `docs/` del repo público: salieron del árbol (en el historial siguen,
  pregunta abajo). Y la herramienta del «#», con el número apagado, le
  **ponía** un apodo a quien no tenía: ahora sólo saca el número.

## 📅 Martes 29/09 (1:30 AM) — versión 1.49

Tus tres capturas de las llaves, y *«1, B · 2. correcto · 3. crea una
invitación permanente para cada servidor… agrega las redes de FFS»*.

- 🏷️ **La llave en vivo dice el aka principal.** El ciclo ya sabía que
  PARK JI-SUNG es Oasis (la hoja AKAs, 28/09), pero la llave **en vivo** la
  arma la página, y la página sólo conocía los nombres de la tabla. Ahora el
  lobby trae los AKAs de quien tiene perfil (85; `alias`): **PARK JI SUNG →
  Oasis, MAKMA → Makmah, PRR → Hassan**, con su cara y su perfil. Sólo de
  respaldo: si el nombre es de otra persona, gana esa persona.
- 👥 **TEAM VENECIA ya no es una persona.** Una llave de parejas que nombra a
  un equipo con UN nombre lo cargaba como un rapero, y cobraba la parte del
  equipo entero: **5.250 puntos, tarjetas y un lugar en el ranking** para
  alguien que no existe. Y había otro: **ME TIENE SIN CUIDADO** (VOL.13,
  25/09), **7.500**. Ahora `marcar_equipos()` busca quiénes son —lo que
  digas vos, o su inscripción «NOMBRE (A+B)» de esa noche— y si no se puede
  saber, «Sin integrantes»: nadie cobra, no hay duelo, ✅ Decidir no pregunta
  «¿quién es TEAM VENECIA?», y la llave lo dibuja como equipo (👥, sin
  perfil). Comparado sobre las llaves reales: **cambian esas 6 filas y
  ninguna más**. TEAM VENECIA no tiene inscripción; ME TIENE SIN CUIDADO sí
  —*«(PARIA+KRAVITZ)»*—, pero la llave pone además a PARIA + KRAVITZ como
  pareja aparte en octavos, y eso no se adivina (pregunta abajo).
- 🔗 **Una invitación permanente por servidor** (sin vencimiento ni tope, al
  canal de bienvenida que ve @everyone): DRA `5jUM3WXDXe`, FFA `JrmE78qdMd`,
  SR `EME4p3RhAp` (su bienvenida no la ve @everyone: va a su canal de
  reglas), URBF `WSXBZDumBb` y FFS `whrjpJUfuz`. Son las de «Mundo» y las
  del bot; las de antes quedaron en `invitacion_antes`. El ciclo cuenta cada
  media hora cuántos entraron por ellas (`datos/invitaciones.json`). **En FFS
  no se puede contar**: el bot sólo puede crear invitaciones, no verlas.
- 📱 **Las redes de FFS**: Instagram **@freestylefutureseries** y YouTube
  **@FreestyleFutureSeries** (sus videos entran al feed del Inicio). Su canal
  「📱」redes enlaza publicaciones, no cuentas: la de Instagram salió de sus
  posts.
- 🔔 **La campana ya escucha a FFS** («「👑」DATA-EVENTOS»), dos minutos
  después de que el ciclo escribió la lista nueva: la búsqueda por cambio de
  lista (`firmaLiga()`, 1.48) anduvo a la primera.

## 📅 Martes 29/09 (12:30 AM) — versión 1.48

Tus respuestas del formulario (11:22 PM) y las tres ideas (*«1. dale… 2. ok
3. va»*).

- 🌍 **FFS League entra a la Liga** (*«A · sí»*): sus eventos suman como los
  de DRA, FFA, Snake Rap y Urban; **periwinkle claro #8E9BFF** (su logo es el
  mismo lavanda que DRA, ΔE 3,8); etiqueta **EVOLUCIÓN**; y su **camiseta**
  de la tarjeta de Servidor, la décima (*«está bueno»*). Sus **seis ligas
  regionales no se leen** hasta el Ranking de Ligas: sus ANUNCIOS y
  VEREDICTOS son jornadas, no eventos (`categorias_fuera`, en los tres
  lectores y la campana). El anuncio de broma de PLAZAS («EL Q SE INSCRIBE
  SE CANCELA LA COMPE», CUPOS: 0) va a `anuncios_fuera`, como SOCOTRA. Sin
  invitación todavía: «Mundo» saca su logo y sus 455 miembros del servidor
  mismo, con el bot. Los multiplicadores la suman el lunes 5/10 (la semana
  ya sorteada no se toca).
- 🃏 **Llaves de broma a ✅ Decidir** (*«A»*): autor que nunca publicó una
  llave que se cargó **y** sin anuncio de su servidor que la respalde.
  Simulado sobre las 23 llaves de la T1: frena las 2 de broma y ninguna
  real. Rige desde el 29/09 00:00 ET, y se suelta sola si el anuncio aparece.
- 🥇 **El podio con mención** (*«A»*): «1ER PUESTO: @alguien» contra el
  campeón de la final. En la primera corrida resolvió **ANTORCHA OLÍMPICA =
  Six** (la cuenta que menciona el podio es la de Six en la Lista).
- ⚡ **✅ Decidir por evento** (*«va»*): la fila «⚡ Todo el evento» cuando
  hay 2 o más nombres nuevos; la respuesta de cada fila manda.
- ⚑ **«¿Algo está mal en esta llave?»** (*«ok»*): al pie de cada llave, con
  la sesión de Mi cuenta (cuentas de 30 días o más, 5 por día). El ciclo lo
  pone en ✅ Decidir en la sección de su evento, con el nombre de quien lo
  mandó y nunca su ID.
- 🧪 **El ensayo del arranque** (*«dale»*): `herramientas/ensayo_arranque.py`
  pregunta a cada pieza con fecha qué hace a las 00:00 ET, y corre el paso 0
  en simulacro. La fecha sale de `comun/temporada.py`: si la apelación la
  corre, se cambia ahí y se vuelve a desplegar el Worker.
- 🔴 **Un error mío de la regla de inscripciones, y deshecho**: la cuenta de
  **Eliot** anotó a una pareja como «27 🇺🇸 Piyi 🇲🇽» (sin «+»), y la corrida
  de las 11:22 dio de alta a **«27 Piyi»** en la Lista como una persona con la
  cuenta de Eliot. Vaciada la fila (era la última, con respaldo) y arreglado
  en tres lugares: la bandera **entre** dos nombres separa, ✅ Decidir no
  resuelve un lado que son dos nombres, y la canonización ya no convierte a
  un equipo en una persona. **La VOL 16 le paga 5.000 a cada uno.**
- 🔔 **La campana vuelve a buscar canales cuando cambia la lista de
  servidores** (`firmaLiga()`): con FFS recién sumado, la búsqueda siguiente
  era a las 6 h —de madrugada, dormida—. El próximo servidor tampoco espera.
- 🔴 **CI estuvo en rojo media hora**: el self-check de ✅ Decidir leía datos
  de esta máquina y fallaba en la nube. Aislado; verde.
- 🔴 **Y otro error mío, sin daño**: corrí `construir_pool_temporada.py
  --auto` creyendo que era un chequeo —no tiene— y reescribió el pool local.
  Devuelto antes de commitear; anotado en la memoria para el loop que lo
  hizo.

## 📅 Lunes 28/09 (11:15 PM) — versión 1.47

Dlx, 10:35 PM: *«enfocate en buscar errores para solucionar, generar nuevas
ideas, chequear donde hay más errores que es la detección de llaves,
optimizaciones… piensa otros POV»*. Y en el medio, tres pedidos.

- 🗑️ **ISLA DE SOCOTRA V.2, fuera** (*«it's a fake event that never got
  released»*): queda en `anuncios_fuera` de `datos/decisiones.json` y
  `anuncios.guardar()` no lo vuelve a traer.
- 👥 **Snow no es de Follombia**: fuera de `datos/crews.json`, con la baja
  anotada.
- ⏳ **«Lo que viene» ya no muestra lo que se jugó** (tu captura: CCFF V.3
  seguía ahí con su llave cargada): `subir_web` arma «Lo que viene» sólo con
  los anuncios que no tienen llave procesada.
- 🛡️ **Un canal adentro de una categoría de staff no se lee**, aunque el
  canal no lo diga (`categorias_staff()` en los tres lectores). 🔴 **Corrijo
  lo que dije en el commit** («en los otros cuatro no hay canales de eventos
  adentro de una categoría así»): en URBF había uno, **«Registro»** adentro de
  «【🧰】Staff【🧰】», que por el nombre se leía como inscripciones. Medido:
  **ninguna** inscripción salió de ahí. Y FFS tiene «ℝ𝔼𝔾𝕀𝕊𝕋ℝ𝕆» adentro de
  su ADMINISTRACIÓN: con esto, si entra, no se lee.
- 🏆 **La llave en vivo sabe lo que el ciclo ya sabía.** Comparé el lector
  de la página contra el de Python sobre **las 74 llaves reales** guardadas:
  las rondas dan iguales en las 74, pero **el campeón y la cuenta de gente
  diferían en 29** —el contrato de CI sólo mira las rondas—. Ahora:
  - el **SUB-CAMPEÓN dice quién ganó** una final de dos (TOKYO VOL 11:
    «CAMPEÓN: JOVEN ALA» con el lado PRR, dos alias de Hassan);
  - el **campeón partido en dos renglones** se lee (EL RAP FECHA 5), y el
    nombre en el renglón de abajo, nunca si es el del segundo;
  - la **cuenta de gente es la del ciclo**: ELRAP FECHA 6 decía 34 en vivo y
    29 al cargarse; COMPE DEL VACILE 1, 15 y 16.
  Quedan 13, y siete son de Livonia (no es de la Liga). El resto necesita el
  padrón —menciones con otro nombre— o es Python preguntando donde la página
  muestra su mejor lectura. Seis casos nuevos en `llave_vivo_prueba.mjs`.
- ✅ **Decidir: 8 preguntas se contestan solas desde la corrida de las 11:22
  PM.** El «¿quién es X?» automático descartaba la cuenta «que no está en
  ningún servidor de la Liga» mirando `datos/servidores_de.json`, que de
  Snake Rap y Urban guarda **sólo a quien ya está en la Lista** (va al repo
  público). O sea, justo a quien se pregunta. Ahora mira también el caché
  de apodos, que tiene a todos y nunca sale del runner. **6 se habían
  anotado con ese nombre en inscripciones** (leteletras, rayito, SMAFF,
  Soft, maldita enfermedad, Aby) y **2 son la única cuenta con ese nombre
  en el servidor del evento** (JIMMY, Clitax).
  🔴 **Y se endureció**: la cuenta que sale sólo por el nombre tiene que
  estar en el servidor del evento (antes, sólo los nombres cortos). Con los
  7.297 de Snake Rap en la cuenta, «ISAIAS», que jugó en FFA, daba la única
  cuenta «Isaias», que está sólo en Snake Rap. Sigue como pregunta.
- 🧹 **Y una pregunta vieja se cierra sola**: el «algo raro al puntuar» de
  COMPE DEL VACILE 1 («octavos no tiene valor en la escala 8-15») era de
  cuando contaba 15; con 16 ya paga 1.250. `pendientes.barrer()` ahora
  reproduce ese aviso contra la escala con la que el evento quedó cargado.
  **✅ Decidir: de 65 a 56.**
- 📦 **El lobby pesa 117 KB, pero viaja comprimido: 26 KB por visita.** No
  urge. Para el remake, cuatro recortes medidos: los campos vacíos de cada
  fila, el color del rango repetido en las 180 filas, la lista de tarjetas y
  la clave igual al nombre (~25 % menos).
- 🔔 **El vigía tiene 50 pedidos por minuto y en el peor minuto suma ~52**
  (14 canales + publicar + llaves + veredictos + avisos). Ya estaba
  previsto: lo que no entra sale al minuto siguiente, y los canales van
  primero. FFS no le suma canales: no tiene ninguno con «evento» en el
  nombre, salvo DATA-EVENTOS.
- 🔎 **Lo que miré y no era bug**: un 2v2 escrito «[ANA & BETO]» se cuenta
  como dos personas y no cuatro, pero es a propósito —hay gente que se
  llama «prove&shows», y los puntos tampoco parten por «&»—; una llave así
  termina en ✅ Decidir, no en puntos mal pagados. Ninguna de las 74 lo usa.

## 📅 Lunes 28/09 (10 PM) — versión 1.46

Dlx, con capturas del calendario de Eventos y de la DESGRACIAS EN TOKYO VOL
16 2VS2 mientras se jugaba.

✅ **Verificado en la corrida de las 10:22 PM**: la COMPE sale una vez, a las
2:48 PM y con su llave; CCFF V.3 a las 7:32 PM; la VOL 13 y la VOL 14 del
25/09 unidas con su llave; los 9 organizadores con perfil en el payload; e
**Izaya 🇨🇱 entró solo a la Lista por su inscripción**. La VOL 16 todavía no
tiene campeón: PRRR → Hassan y TEAM VENECIA = 2 se ven cuando se procese.

- 🔴 **Un evento salía dos veces**: «COMPE DEL VACILE T2 #1» (anunciado,
  2:21 PM) y «COMPE DEL VACILE 1» (jugado, 2:48 PM). `llaves_web.cruzar()`
  junta anuncio y llave si los números del nombre coinciden —para no juntar
  «VOL 11» con «VOL 12»— y comparaba todos los dígitos juntos: «21» contra
  «1». Ahora `_numeros()` separa la **temporada del organizador** (T2) de la
  **edición**: la edición tiene que coincidir, la temporada sólo choca si la
  dicen los dos.
- 🔴 **Y lo mismo con la modalidad**, que apareció al medir los 97 anuncios
  de la T1: «DESGRACIAS EN TOKYO VOL 14 **1vs1**» contra su llave «VOL.14»
  era «1411» contra «14»; la VOL 13 «2VS2» igual. De 17 a **20** anuncios con
  su llave, ninguno cambia de llave, y queda una sola llave sin anuncio (la
  primera MARRUECOS, del 23/09, cuyo anuncio no está en lo que leemos).
- ⏱️ **Lo jugado lleva la hora de su llave** si el anuncio no decía a qué
  hora: CCFF V.3 decía «19:28 · anunciado» al lado de «jugado». Lo que no se
  jugó y no tiene hora dice «del anuncio».
- 📡 **Eventos no dejaba ver la llave en vivo** (Dlx, con la VOL 16 2VS2 en
  cuartos): el calendario sólo miraba la llave ya procesada. Ahora lo que se
  juega dice «en vivo» y abre su llave en vivo (`llaveDeEvento()`, la misma
  unión que «En vivo»); «por jugarse» sale con el reloj de quien mira.
- 🪪 **Las inscripciones resuelven nombres** (Dlx: *«en el canal de
  inscripciones puedes observar los inscritos y combinar con sus IDs porque
  hay personas nuevas o con nombres trolls»*): `decidir._inscritos()` —quién
  se anotó SOLO y con qué nombre, por servidor— va antes que el apodo en el
  «¿quién es X?» automático (tu «2. A»). Sólo inscripciones de un nombre, y
  no las de cuentas que anotan a otros (la del organizador de URBF anotó a
  «Player» y a «Steven»). **Y PRRR es Hassan**: se anotó «Prrr🇦🇴» desde
  su cuenta (*ndfue*), la misma de su avatar; cuando se procese la VOL 16,
  PRRR queda como su alias y los puntos van a él.
- 👥 **Un equipo con nombre cuenta completo**: «[TEAM VENECIA]» en un 2VS2
  son dos, y el plantel contaba 15 donde el formato es de 16 (la escala
  bajaba a «8-15» para todos). `faltan_en_equipos()` en el ciclo y en la
  llave en vivo; comparado sobre las llaves de la T1, sólo cambia la VOL 13
  2VS2 (31 → 32, la misma escala).
- 🎤 **Organizadores con su perfil y su cara** (Dlx: *«¿puedes hacer que los
  organizadores se muestren sus perfiles también con su avatar?»*):
  `subir_web._orgs()` lleva el «Organiza:» a un perfil por nombre o por su
  usuario de Discord (nachonc_ es NC, ignac.07 es FAZER, CANTU es DELUXE:
  9 hoy). Y «Cómo se juega» cuenta junto «1vs1», «1V1» y «1 VS 1».
- ⚡ **Multiplicadores de la semana, con páginas** (Dlx: *«es interesante
  pero es bastante incómodo de ver… es demasiado… no encaja con lo demás»*,
  y a las tres formas, *«A»*): cuatro páginas con las flechas y puntitos de
  «Paneles» —las fichas · la votación del ×2 · los premios de la semana ·
  meta y semillero—, un renglón por cosa y un link a la Guía. De ~750 px a
  entre 230 y 406.
- 🔃 **El día, de lo más nuevo a lo más viejo**, y 🔴 **la celda de hoy
  entera**: llevaba la clase `hoy`, que es la grilla de dos columnas del
  panel del Inicio, y se partía en dos (pasa a `es-hoy`).
- 🔎 **«¿Por qué no deja ver las llaves de URBF?»** (Dlx, 10 PM, con el canal
  `1511963625793912892`). El canal se lee bien: #368 y #369 salen de ahí y
  «Ver llave» las abre. La fila de su captura no tenía el botón por lo de
  arriba («T2 #1» contra «1»); ya lo tiene. El único evento de URBF de la T1
  sin llave es **ISLA DE SOCOTRA V.2** (27/09, 10:29 PM): lo único que hay
  después en ese canal es una llave de broma, «DENME MODERADOR LPM» (10:32
  PM, la final «(pichula) 🆚 (mi mamá)», campeón «MAMÁ ERIAN»), que el ciclo
  **no cargó**. Pregunta abajo.

## 📅 Lunes 28/09 (12 PM) — versión 1.40

Dlx: *«estas 2 horas voy a estar ocupado pero me gustaría que te tomes el
tiempo para arreglar y buscar bugs. Mejorar el sistema completo. Buscar
optimizaciones»*.

- 🔴 **`Pendientes` se escribía ENCIMA de sus primeras filas.**
  `anotar_varios()` agregaba con `append` sobre `A2` y `OVERWRITE`, y la API
  busca la tabla en esa celda: la columna A (`#`) está vacía en todas las
  filas, así que escribía desde la fila 2 **pisando lo que había**. En la
  corrida de las 11:22 el lector anotó las 11 batallas y `procesar_entrada`
  las pisó siete segundos después con 35 nombres, que además borraron las 7
  preguntas de identidad. Los nombres volvían solos en la corrida siguiente
  —por eso no se veía—; se perdía justo lo que no se regenera. Ahora la fila
  la calculamos nosotros (`pendientes._poner()`). **Restauradas** las 7 de
  identidad (la de DNK, cerrada). ⚠️ **Lo que se perdió en corridas
  anteriores no se puede saber**: si una pregunta que ya contestaste vuelve
  a aparecer —un «Es alguien nuevo», sobre todo—, es por esto; contestala
  otra vez y ya queda.
- 🔴 **✅ Decidir: preguntas en blanco.** Una fila que en la pintada anterior
  era franja estaba combinada de A a H, y escribir en una combinada se traga
  el valor sin error. Con las batallas nuevas las secciones se corrieron y 4
  preguntas salieron vacías. Ahora se descombina antes de escribir.
- 🔎 **Pista de Discord en los nombres desconocidos**: si el nombre es el
  apodo, el nombre visible o el usuario de alguien de los servidores de la
  Liga, la pista lo dice —«En Discord es la cuenta de «Jult» en la Lista»— y
  «Es Jult» va primero. **32 de 66** preguntas la tienen; 4 son cuentas que
  ya están en la Lista con otro nombre: KULRW = Jult, nacioenmilan = Deuxs,
  ADACCHI = Nobu, DENIK = fleivaman. El índice va en `.cache/` (en
  `.gitignore`): son los nombres de ~10.000 personas y el repo es público.
- ⚡ **El ciclo, más liviano**: las 427 caras se guardan de una corrida a la
  otra (caché de Actions: eran 16 s y 427 pedidos en ráfaga a Cloudflare, un
  tercio de su tope); las cinco vitrinas no se reescriben si ya dicen lo
  mismo (`rankings.ya_dice()`: eran 37 s y la cuota de Google); y el ID del
  Operativo se confirma una vez por ciclo y no en cada uno de los ~15
  scripts (una de esas preguntas tardó 30 s a las 11:54).
- 🔴 **El sorteo rehecho** (1:45 PM): DESGRACIAS EN TOKYO VOL 15
  MULTIVERSE se publicó dos veces con otro sorteo y la vieja quedó en el
  canal. «En vivo» mostraba dos tarjetas del mismo evento, y el lector iba
  a preguntar en ✅ Decidir por batallas del sorteo abandonado. Ahora manda
  la llave nueva (`llaves_a_entrada.sin_sorteos_viejos()` y `pintaVivo()`).
- 🎨 **Vitrinas con huella de diseño**: si cambia `sheet/estilo.py`, se
  vuelven a vestir aunque los números sean los mismos
  (`datos/vitrinas_diseno.json`). Y medido: desde las 12:52 las cinco dan
  «✓ igual» y el ciclo bajó de ~150 s a ~100 s.
- 🧹 5 vidas: el número de batalla va en la nota y en la guarda de `Entrada`
  (dos revanchas con el mismo ganador eran la misma clave), y lo guardado
  espera 21 días a que contestes.
- 🗓️ La llave «(sin titulo)» de FFA estaba con fecha en UTC (23/09) y el
  lector la calcula en hora del este (22/09): iba a abrir una segunda
  pregunta por la misma llave. Corregida la fila.
- 📊 **La corrida de las 11:22**: entró la **FFA World Cup (#366)**, la Snake
  Arena ya la carga el ciclo (igual que a mano), MARRUECOS pasó a 16+,
  Publicaciones se publicó (73) y salió el Lunes de la Liga. ⚠️ **FULLY**
  (27.500, campeón de la World Cup) queda sin puesto hasta que contestes
  «¿Quién es FULLY?»: su cuenta en la Lista es **Oasis**.
- 🔑 Para la tanda final de tokens: los `#` de los logs de GitHub salen
  `***` porque `.env` tiene dos renglones que son sólo `#` (ver
  `ACCESOS.md`).
- 🔕 **La alarma que sonaba en cada corrida** (2 PM): *«cambió el CÓDIGO
  de la pais: le toca a todo el pool»*, y no se redibujaba ninguna País.
  Eran 5 personas sin país con un sello viejo de esa carta, más **132
  nombres viejos** —los de antes de cada fusión y cada alias— que el sello
  no borraba nunca: lo que una corrida sacaba volvía del commit anterior al
  guardar. Ahora se borra (`herramientas/unir_sellos.py`) y la alarma sólo
  cuenta cartas que se pueden dibujar (`que_cambio.por_que()`). **Ninguna
  tarjeta salió mal por esto**: era ruido, pero ruido que tapaba la vez que
  fuera de verdad. Los 132 se limpian solos en la próxima corrida que
  dibuje.
- 👯 La corrida de la 1:52 PM **arrancó dos veces** (34 s de diferencia):
  Cloudflare repitió el cron. Inofensivo —la segunda esperó a la primera y
  no encontró nada nuevo— y pasó 2 veces en las últimas 40 corridas. No lo
  toco.
- ✅ **Las vitrinas, verificadas**: la corrida de la 1:52 PM las vistió una
  vez para guardar la huella del diseño, y la segunda ya dijo «✓ igual» en
  las cinco.
- 🔴 **Un equipo de 4 perdía a su cuarto** (2:05 PM). Al corregir typos
  contra las inscripciones, el lector aceptaba un equipo «parecido» con
  **otra gente adentro**: en el MULTIVERSE de hoy pelean Bootrax Humilde +
  Trot + Tokio + **Tuca**, la inscripción era del trío, y los nombres
  pegados se parecen un 92 %. Simulado con la llave completada a mano, el
  motor repartía entre tres y Tuca no cobraba. Ahora un equipo sólo se
  corrige a otro con **los mismos integrantes** (un typo cambia una letra,
  no saca ni agrega a nadie): 625 para cada uno de los cuatro. Si algún
  evento viejo tenía el mismo problema, se corrige solo en la próxima
  corrida, que relee toda la temporada.
- 🔴 **Tres números de las tarjetas no se actualizaban** (2:15 PM), porque
  dependen de otra gente y el sello sólo miraba los datos de cada uno: el
  **OVR Nacional** (el número grande de la de País: sale de tu Score, de los
  cinco mejores de tu país y de los mejores del pool), **la crew y el puesto
  adentro** (Competitiva y Servidor; `datos/crews.json` no estaba en ninguna
  huella, así que sumar a alguien a una crew no redibujaba nada) y **el
  puesto dentro de tu letra** (País y Servidor). Ahora entran los tres. La
  corrida de las 2:22 PM redibuja una vez **137 de País, 25 Competitivas y
  25 Servidor** (~5 min); después, sólo las que cambian de verdad. Era el
  pendiente del 25/09 («el sello no ve lo que depende de otros»).
  Verificado: la corrida de las 2:22 PM pidió justo esas 187 y ya no dijo
  «cambió el CÓDIGO».
- 🔴 **MARRUECOS: 7 de sus 8 preguntas de ✅ Decidir se contestan solas**
  (2:30 PM). La llave del 26/09 escribe los octavos **sólo con menciones**
  (`<@…>`) y los cuartos con nombres, y el lector no sabía seguir una
  mención a la ronda siguiente: las 8 batallas de octavos iban a ✅ Decidir
  y **los 10 que cayeron en octavos no cobraban nada** (tormen, yinn,
  Partim, Jult, Sin Límites, marto, Xclusivo, Erian, Geoka, Elinge). Los
  nombres de cada cuenta ya estaban (Lista, alias, inscripción, Discord);
  ahora se usan también para esto, y el que pasa se llama como lo
  escribieron en cuartos (si no, la misma persona entraba con dos nombres y
  cobraba dos veces). De paso, PROVENZA —que pasó una batalla de cuatro
  donde pasan dos— iba a salir «walk-in» en cuartos (la mitad de sus
  puntos): también arreglado. **Queda una sola pregunta**, Richard contra
  Number: ninguno de los dos aparece en cuartos, así que ahí hace falta tu
  respuesta. Medido sobre todas las llaves de la T1, viejo contra nuevo:
  ninguna otra fila cambia.
- 🔴 **✅ Decidir seguía preguntando lo que ya se había resuelto solo**
  (3 PM). El barrido que cierra esas preguntas corría sólo cuando había
  tarjetas para dibujar; en una tarde tranquila, una batalla que la llave ya
  resolvía o un nombre que ya tenía alias se seguían preguntando. Ahora
  corre en cada corrida, antes de pintar ✅ Decidir. Lo mostró MARRUECOS: la
  corrida de las 2:52 PM ya resolvía sus 7 batallas y la hoja las seguía
  mostrando.
- 🧰 **`herramientas/comparar_lector.py`**: el lector de un commit contra el
  de ahora, sobre todas las llaves reales (sin escribir nada). Todos los
  arreglos al lector de hoy se midieron así antes de subirlos.
- 🔴 **Urban Freestyle escribe `{A} VS {B}`** (3:30 PM): la COMPE DEL VACILE
  #1, que se está jugando, marca cada lado con llaves. Se leía, pero los
  nombres quedaban `{Steven🇨🇴}` y así iban a entrar al ranking y a ✅
  Decidir. Arreglado en los dos lectores (el del ciclo y el de la página) y
  verificado en la página: la llave en vivo ya sale con los nombres limpios.
  Sólo convierte llaves en par: la única otra llave con una `}` (una vieja de
  Snake Rap) queda igual.
- 🔴 **«En vivo» mostraba llaves borradas** (4:35 PM). Dlx: *«no sé por qué
  hay 2 eventos en vivo de URBF»*. Uno era de verdad (COMPE DEL VACILE #1);
  el otro, «PLAYER ES CACORRO», una llave de broma publicada a las 4:07 PM
  en el mismo canal y borrada al rato. El vigía guarda cada llave hasta 6
  horas y no se enteraba de los borrados. Ahora, si un mensaje que tenía ya
  no está en la lectura del canal, lo saca (`borradasDelCanal()` en
  `bot/avisos.js`, probado y desplegado): salió en la primera pasada.
- 🔴 **Un MULTIVERSE con un equipo de 8 rompía la llave entera** (4:45 PM).
  Probado a partir de lo que dijo Dlx (*«puede haber 2v2, 1v3 o 8v1»*): el
  lado de 8 se perdía por dos topes de largo pensados para nombres sueltos,
  y la línea se pegaba con la de abajo —salía un triple que no existe y la
  final desaparecía—. Un equipo de 4 con nombres cortos entraba justo. Ahora
  un equipo se mide por integrante. Medido sobre las llaves de hoy: 313
  filas, ninguna cambia.

---

## 📅 Lunes 28/09 (11 AM) — versión 1.39

**Los 5 vidas se cargan solos, y se confirman en ✅ Decidir.** Dlx:
*«1. A y b»*.

- ❤️ **A — el ciclo los carga**: `escuchar.vidas()` busca los #veredictos
  de la Liga (hoy Snake Rap tiene 2 y Urban Freestyle 8), lee las últimas
  36 h y arma las batallas con **las mismas reglas que «En vivo»**: gana la
  mayoría de los jueces; si queda parejo, el que siguió peleando; la réplica
  la decide la de después. El nombre sale del **anuncio de ese servidor a
  esa hora** («SNAKE ARENA VOL. 2»); sin anuncio, «5 VIDAS 17:38».
  Medido con la Snake Arena real: **las mismas 23 batallas, en el mismo
  orden y con el mismo podio** que la carga a mano del #365.
- 🔑 **Python y la página leen igual**: el contrato
  (`bot/llaves_casos.json`) tiene ahora los 106 mensajes reales de la Snake
  Arena, con los jueces tapados; CI se pone rojo si uno de los dos lectores
  cambia solo.
- ⚖️ **Una batalla pareja en el texto se pregunta** en ✅ Decidir, con su
  número («5 vidas, batalla 24»: la misma pareja puede empatar dos veces), y
  **el evento espera la respuesta** — no suma a medias ni pasa a «bracket
  incompleto». Contestada, **entra en su lugar**: en un 5 vidas el orden es
  quién cayó primero.
- ✅ **B — se confirma o se saca**: cada 5 vidas cargado solo aparece como
  «❤️ Vidas» con el campeón y el orden; «Está bien así» queda como decisión
  del evento y **«No cuenta» lo saca** de `Resultados`, `1v1`, `Eventos
  Procesados` y del hub. 🔴 **Antes «no cuenta» no sacaba nada**: sólo
  impedía volver a escribirlo, así que lo ya cargado quedaba para siempre.
- 🔒 **Lo que se guarda es el evento armado, no los mensajes**
  (`datos/veredictos.json`): el repo es público, y la charla de los jueces
  y quién votó qué quedarían en git para siempre. Se guarda para no perder
  un evento que espera una respuesta más de 36 h.
- 🐍 La Snake Arena ya estaba aprobada (*«sí dale»*), así que lleva las dos
  decisiones anotadas: cuenta, y la última batalla —1–1 en el texto, un
  juez votó con una imagen— la ganó DELUXE. No se vuelve a preguntar.

**✅ Decidir, pulida** (10:25 AM):

- 🐛 **Las franjas de evento salían grises, chicas y centradas** desde la
  segunda: el formato de las columnas iba de la primera pregunta a la
  última y las pisaba. Ahora va por tramo.
- 🔗 **Los links se tocan**: «ver la llave ↗» en cada franja y «perfil ↗»
  en las preguntas de identidad, en vez de 120 caracteres de URL que no
  eran link.
- 🪪 **Las preguntas de identidad dicen qué es cada cuenta**: en qué
  servidores está, si es Miembro de DRA, cómo figura en la Lista y cuántos
  eventos jugó. Salen cosas: la cuenta de la Lista de **DNK** no está en
  ningún servidor de la Liga, y la «otra» cuenta de **o.e.p** es la de
  **MILICA**. Las opciones pasan a «Es la misma persona / Es otra persona»
  y dicen que **sólo se anota** (ningún Discord ID se mueve).
- 🧹 La llave sin campeón muestra sus batallas en Pistas, y las pistas de
  una versión anterior ya no se copian a 📝 NOTA.

---

## 📅 Lunes 28/09 (10:10 AM) — ✅ Decidir rehecha

Dlx: *«Lo resuelvo yo… pero mejora esa página de decidir incluso más…
hazla. Más mejor y bonita»*.

- ⚔️ **«¿Quién ganó esta batalla?»**: una pregunta por batalla sin
  ganador, con las opciones «Ganó A», «Ganó B», «No se jugó». Lo contestado
  queda en `datos/decisiones.json` (`batallas`) y el lector lo aplica en la
  corrida siguiente: el que perdió cobra su ronda y, de a dos, es un duelo
  (`decidir.detalle_batalla()` / `decision_batalla()`). 🔴 **Antes esto no
  se podía resolver desde la hoja**: iba como «No pude leer estas batallas»
  con «La corrijo en Discord / Dejala así», y encima se cerraba sola en
  cuanto el evento tenía campeón — o sea que los que perdieron esas batallas
  no cobraban y nadie lo volvía a preguntar. Hoy son **11**: las 8 de
  MARRUECOS, MATI contra MTZ en la World Cup y dos de TOKYO. Se cierra sola
  si el organizador completa la llave (`datos/batallas_sin_ganador.json`).
- 👤 **Las menciones son gente**: la pregunta dice «Richard 🇪🇨 🆚 Number
  🇺🇾» y no `<@750…>`, y el plantel las cuenta. **MARRUECOS pasa de 8 a 22
  participantes** → escala 16+ (la guía: más de 16, 16+), así que sus
  puntos suben en la corrida de las 11:22. ⚠️ La cuenta que ahí es «PARK
  JI-SUNG» y en la World Cup «FULLY» figura en el padrón como **«Oasis»**:
  no lo toco (identidad), queda para «¿Quién es FULLY?».
- 🎨 **La hoja**: una sección por EVENTO con todo lo de ese evento
  —batallas primero, después los nombres— con su franja de color, servidor,
  fecha y el link a la llave; la pregunta corta (la instrucción que se
  repetía en 44 filas va una vez, arriba); una columna **«Pistas»** con cómo
  terminó esa persona en la llave y con quién peleó («Terminó Subcampeón
  (3.750 pts) · 5 vidas: le ganó a Humildad»), más a quién se parece; la
  fila se pone **verde** al contestarla y **roja** si no se entendió; sin
  cuadrícula, con la franja oscura del hub. Las columnas se leen por nombre,
  así que lo ya escrito no se pierde.
- 🔴 **Walk-in de la FFA WORLD CUP** (9:55 AM): filtros de tres por UN lugar
  hacían «Walk-in 1» a los quince que entraron directo a octavos — FULLY
  cobraba 5.000 en vez de 10.000. Si la primera ronda es una previa que no
  llena la siguiente, la entrada es la siguiente. Medido: sólo cambia la
  World Cup, de 8 walk-ins falsos a 0.

---

## 📅 Lunes 28/09 (9:10 AM) — versión 1.38

**Los 5 vidas, en vivo.** Dlx: *«tienes que estar pendiente de todos los
canales de eventos cuando hay un evento en vivo… en veredictos está todo lo
que pasó»*.

- 🔑 **El vigía descubre los canales de veredictos** por nombre (`/veredict/`,
  sin los que dicen «llave», que ya lee `llaves()`): SR tiene dos, Urban
  Freestyle **ocho**. Por eso **no se leen siempre**: sólo mientras su
  servidor tiene un evento en juego —de 15 min antes a 5 h después del
  arranque de un anuncio, o con una llave que se está tocando— y el que tuvo
  mensajes hace poco; hasta 6 por minuto, rotando. Las dos decisiones son
  funciones puras con prueba (`svsEnVivo()` y `veredictosALeer()` en
  `bot/avisos.js`); los mensajes, 12 h en la tabla `veredictos`, y viajan
  en `/avisos/vivo`.
- 🔑 **La página arma las batallas** (`LlaveVivo.veredictos()`): el título
  `# A 🆚 B` abre una, cada juez vota con un renglón (con o sin negrita, con
  o sin `#`) y gana la mayoría. Una tanda es un 5 vidas si la misma pareja
  vuelve a pelear **no seguida** (en una llave sólo se repite la réplica, que
  va seguida). Lo que el texto no dice no se inventa: el juez que vota con
  imagen no cuenta, y un empate lo desempata **el que siguió peleando**
  (el ganador se queda); la misma pareja otra vez es réplica.
- ✅ **Probado con los 106 mensajes reales de la Snake Arena Vol. 2**: saca
  las mismas 24 batallas que armé a mano ayer, con la 19 por «siguió
  peleando» y la 23 como réplica; la 24 queda «se está votando» porque el
  tercer voto fue una imagen. 🔴 **Y encontró un bug**: el título pone la
  bandera antes o después del nombre, y «🇦🇷 DELUXE» y «DELUXE 🇦🇷» eran
  dos personas con la mitad de las derrotas cada una. Ahora cada una queda
  con su primer nombre de la tanda.
- La tarjeta de «En vivo» lleva el nombre del anuncio que le corresponde, y
  abre el tablero de vidas (el mismo de 1.36), ordenado en vivo por las
  vidas que quedan.
- ⏳ **Lo que falta**: que el **ciclo** cargue solo un 5 vidas desde los
  veredictos (hoy se carga a mano, como el #365), y el tablero de corazones
  de FFA (su plantilla: `[PARTICIPANTE] ❤️❤️❤️❤️❤️` y el podio).

---

## 📅 Lunes 28/09 (8:55 AM) — versión 1.37

**Lo que empezó, en vivo; y la FFA WORLD CUP, que no entraba.** Los bugs de
las capturas de Dlx (*«así se veía esto cuando había 2 en vivo… es un
bug»*), más lo que apareció buscándolos.

- 🏆 **La FFA WORLD CUP (27/09) no iba a entrar nunca.** La llave vino en dos
  mensajes con la final **con los dos en negrita**, y el campeón estaba en un
  tercero, sólo el podio. Suelto no es una llave y se tiraba: quedaba «en
  curso, sin campeón» y a las 12 h iba a `Pendientes` como Bracket
  incompleto. `escuchar.unir_partidas()` ahora pega el podio a su llave con
  las mismas condiciones (misma persona, mismo canal, menos de 3 h), si la
  llave ya llegó a la FINAL y **si el campeón que nombra es uno de los
  finalistas** (`_podio_de()`): así no se le pega a una llave el podio de
  otra. Igual en la página (`llave_vivo.js`) y en el vigía (`pareceLlave()`
  guarda el podio suelto). Entra en el ciclo de las 11:22 con FULLY
  campeón; queda **una** batalla a `Pendientes` (MATI contra MTZ en
  octavos: en cuartos está escrito «MATICERNA»).
- 🥉 **El tercero compartido, al promedio** (guía §4.5 y §10.7). El podio de
  FFA pone el segundo tercero **en el renglón de abajo, sin etiqueta**, y
  `_tercero_del_podio()` leía uno solo: EZEE salía tercero y MOLUSCO cuarto.
  Ahora un renglón que sigue sin etiqueta es otro nombre del mismo puesto.
- 🐛 **La fila «⌝ ⌞» de la captura: los huecos de la plantilla.** Las llaves
  se llenan sobre la plantilla, así que en vivo las rondas que faltan son
  `⌞⌝ 🆚 ⌞⌝`: el marco pedía un carácter adentro y la captura saltaba de un
  ⌞ al siguiente ⌝ (un lado llamado «⌝ ⌞»); y `⌞ + ⌝` o `［ ］` daban lados
  vacíos que nadie ganó, así que la página decía «Final en juego» con los
  cuartos en juego. Arreglado en **los dos lectores** (Python y JS), con la
  plantilla a medio llenar como caso nuevo del contrato
  (`bot/llaves_casos.json`). ⚠️ Una **mención** sí es alguien aunque
  `norm()` la borre: MARRUECOS EN VENTA escribe sus octavos sólo con
  `[<@…>]`, y la primera versión del arreglo los hacía desaparecer sin
  preguntar. Lo encontró comparar las dudas antes y después (11 → 3 → 11).
- 🔴 **«Lo que viene» → «En vivo».** Al llegar a cero la cuenta atrás, el
  evento sale de «Lo que viene» y pasa a «En vivo» (sin recargar: ver
  `redibujarPorHora()`); los adelantos de Eventos y de Mi cuenta pasan al
  siguiente. En «En vivo»: su llave si la hay (`llaveDeEvento()`: mismo
  servidor, publicada entre 1 h antes y 5 h después, y comparte palabras
  con el nombre), y si no, una tarjeta «Empezó a las… la llave todavía no
  está publicada». Es lo que faltaba con la SNAKE ARENA: se jugaba en
  #veredictos y no había llave que leer. Los 90 minutos salen del payload
  (`vivo_min`, `VENTANA_VIVO` de `subir_web.py`), no se escriben en la
  página.
- ⏳ **Lo que sigue**: leer los 5 vidas en vivo — #veredictos de Snake Rap
  y el tablero de corazones de FFA (su plantilla: `[PARTICIPANTE]
  ❤️❤️❤️❤️❤️` y el podio 🥇🥈🥉).
- ❓ **MARRUECOS EN VENTA V.1 (#359) tiene 8 batallas de octavos en
  `Pendientes`**, escritas sólo con menciones, y en cuartos aparece un
  nombre de fantasía («PARK JI-SUNG» es la mención de FULLY en el podio).
  Se cargó con 8 participantes (escala 8-15) cuando jugaron unos 20: los que
  cayeron en octavos no cobraron. Es para mirarlo en ✅ Decidir.

---

## 📅 Lunes 28/09 (8:25 AM) — versión 1.36

**Los 5 vidas.** Dlx: *«SNAKE ARENA es formato TIPO 5 VIDAS donde sólo hay
5 competidores, como la Red Bull 5 Vidas… en veredictos está todo lo que
pasó»*, y al plan: *«sí dale»*. Después: *«hay muchos formatos de rap…
pandillas, multiverse, etc.»*.

- 🔑 **El motor entiende «N vidas»** (`sheet/motor.py`): si TODAS las
  batallas de un evento tienen la ronda «5 vidas», no busca final ni semis:
  cuenta las derrotas batalla por batalla, el que llega a 5 queda afuera, y
  el lugar es **el orden en que cayeron** (el que sigue en pie, campeón).
  Del 5.º al 8.º paga lo de cuartos, que es lo que pagó la #320 de la guía.
  Si el evento se corta con varios en pie, se ordenan por las vidas que les
  quedan y **los que tienen las mismas empatan y se reparten el pozo**
  (§10.1): probado, da 2.166 cada uno, el número de la guía. Una batalla sin
  ganador no quita vidas. Todo lo raro se avisa como `VIDAS:` y va a
  `Pendientes`.
- 🐍 **SNAKE ARENA VOL. 2, #365**, cargada desde #veredictos de Snake Rap:
  23 batallas (la réplica empatada de las 7:18 PM no entra, como se
  aprobó). Deluxe 5.000 · JIMMY 3.750 · Fazer 3.000 · Humildad (DTR, su AKA
  registrado) 2.250 · Lhyon 1.250, antes del multiplicador. **JIMMY no está
  en el padrón**: fue a `Pendientes` como nombre desconocido. La hora del
  evento sale del primer veredicto (27/09, 5:38 PM ET). El ciclo de las
  11:22 la pasa a las vitrinas, los pools y las tarjetas (el paso 1c corre
  siempre).
- ❤️ **La página**: un evento de vidas se ve como vidas (`vidasVista()` en
  `app.js`): el lugar, los corazones que le quedan a cada uno y en qué
  batalla cayó, y batalla por batalla con «−1 ♥». Sin el botón de «Cuadro /
  Por rondas»: no hay ramas que dibujar.
- 🤜 **El Clásico cuenta eventos** (`multiplicadores.clasicos()` y
  `rivalidades()`): lo que pasa dentro de un evento no hace rivalidad para
  ese evento.
- 🔴 **El motor no estaba en CI**: su self-check pedía el Sheet. Ahora usa
  la copia de `datos/escala.json` si no hay credenciales
  (`motor.tablas_guardadas()`, verificada igual a `Config`) y entró a
  `chequeos.yml`. Probado de las dos formas.

---

## 📅 Lunes 28/09 (8 AM) — versión 1.35

**Entrar con Discord una vez.** Dlx, con capturas: *«cada vez que presiono
para votar me redirige a DISCORD para autorizar mi cuenta… lo hice miles de
veces»*.

- 🔴 **Era un ciclo**: un 401 del Worker borraba el permiso y volvía a
  votar, que volvía a mandar a Discord. Y el Worker daba 401 también cuando
  Discord **no contestaba** (un 429 o un 5xx): todo lo que no fuera 200 era
  «permiso malo». `discordDe()` ahora separa los dos, y un Discord ocupado es
  un 503 que la página dice, sin mandar a nadie a ningún lado.
- 🔑 **La sesión**: al entrar con Discord (`/cuenta`), el Durable Object anota
  una sesión de 30 días (tabla `sesiones`, con el **hash** del número, no el
  número) y el navegador la guarda en una cookie `lg_ses` **HttpOnly, Secure,
  SameSite=Strict, sólo `/api`**: el JS de la página no la ve. El proxy de
  Pages la pasa como `x-lg-ses`. **Sin secreto nuevo**: es un número al azar
  que sólo existe en el objeto, no una firma.
- La página prueba primero con la sesión, después con el permiso recién
  traído, y va a Discord **una sola vez**: si recién volvió y el servidor
  sigue sin saber quién es, lo dice. La billetera se muestra sola al abrir
  la Tienda si hay sesión.
- 🚪 «Salir» (y «borrar ajustes») cierran la sesión; `/borrar-mis-datos`
  borra todas las de esa persona. La privacidad lo dice.
- Probado: 10 pruebas nuevas en `probar_local.mjs` (sin sesión 401, con
  sesión vota con el ID de la sesión, Discord ocupado 503, la cookie al
  entrar y al salir, el proxy de ida y de vuelta) y los cuatro caminos de la
  página en el navegador.

---

## 📅 Lunes 28/09 (8:05 AM) — versión 1.34

**El Most Wanted paga también en la Tienda.** Dlx: *«b»*.

- 🎯 Al que caza, el 10 % de lo que cobró en Puntos de Tienda; al que
  sobrevive, el 10 % de lo que se llevó (`most_wanted.TIENDA`). Lo manda a
  la billetera `bot/precios.py` (`tienda_mw()`), por la misma KV que los
  precios (`precios:resolucion`, clave `mw`).
- ⚠️ **Se reemplaza entero en cada corrida** (el objeto borra lo `mw:` y lo
  vuelve a anotar): si una llave se corrige y el cazador es otro, lo cobra el
  nuevo y el viejo lo pierde. Los precios por cabeza no se tocan.
- Sólo la temporada del período de ahora: con la T1, lo de la prueba sale.
- La página lo dice con el número del payload (`tienda.mw`): en el tablero
  del Most Wanted, en la Tienda y en la Guía.

---

## 📅 Lunes 28/09 (8 AM) — versión 1.33

**Publicaciones: el muro de la Liga.** Dlx: *«sí un muro automático, pero
anuncios de todos los servidores también»*.

- 📰 `bot/muro.py`, corrido desde `subir_web.py --aplicar` (paso 2c, porque
  usa la tabla que arma ahí). Entran: 🏆 campeones (de las llaves), ⬆️
  subidas de rango y 🎖️ primer rango, 🃏 tarjetas desbloqueadas, 🎯 cazas y
  🛡️ sobrevivientes del Most Wanted, 🗳️ El Elegido, 💰 precios cobrados, 🥇
  premios de la semana, 📢 los anuncios de eventos de todos los servidores
  (`datos/anuncios.json`) y 📰 las novedades de la Liga en DRA.
- ⚠️ **Subir de rango y desbloquear no se pueden recalcular**: son un cambio
  entre dos corridas, así que se anotan en `datos/muro.json` con cómo estaba
  cada uno. La primera vez que se ve a alguien sólo se anota (si no, el muro
  arrancaría con cien «desbloqueó» que no pasaron hoy). Lo demás se rearma
  en cada corrida desde su fuente.
- Viaja **aparte del lobby** (`web:muro`, `/api/muro`): se pide al abrir la
  vista, y el lobby sigue en 107 KB. Lo de los últimos 21 días, y desde el
  arranque de la T1 nada de la prueba.
- El «Organiza: yo» o «staff» de un anuncio no se muestra: es la regla de la
  Copa (`multiplicadores._org()`).
- Probado: self-check de `muro` (11), `subir_web`, `probar_local.mjs` (con
  `/api/muro` en el proxy), y la vista en local con los datos de verdad —69
  publicaciones: 46 anuncios, 16 campeones y 7 novedades—, en escritorio y en
  teléfono.

---

## 📅 Lunes 28/09 (7:45 AM) — versión 1.32

**La Tienda y el precio por cabeza.** Dlx: *«PUNTOS de TIENDA… que todos
empecemos con 5k»*, *«2. A 3. sí 20k»*, *«1. Ambos. 2. B»* y *«agrega la
opción de TIENDA y PUBLICACIONES»*.

- 💰 **El precio por cabeza** (`bot/precios.py`, paso **2b4** del ciclo): se
  pone con Puntos de Tienda sobre alguien de la temporada que no sea fuera de
  concurso, desde 500 y de a 100, y nunca a uno mismo. Lo cobra **el primero
  que le gana** en un evento de 8 o más (la regla del Most Wanted,
  `primera_derrota()`), **en un evento que arrancó después del precio** —a
  mitad de llave no se puede apostar sabiendo con quién le toca—. Cobra lo
  mismo en Tienda y en Temporada; por equipos se reparte. Si nadie lo caza,
  vuelve 12 h después del lunes 11 AM.
- 🪙 **La billetera** vive en el Durable Object (`precios` y `tienda`): saldo =
  5.000 + lo cobrado − lo puesto (lo devuelto no cuenta). El saldo y el tope
  de 20.000 los mira el objeto, que es uno solo: dos precios a la vez no
  gastan la misma plata. Quién cazó lo resuelve el ciclo y se lo pasa por KV
  (`precios:resolucion`); si una llave se corrige, **se reemplaza** lo
  cobrado, no se suma. Con la temporada, las billeteras arrancan de nuevo.
- 🔐 Como las encuestas: el ID lo da Discord, cuenta de más de 30 días, y
  afuera se ve cuánto vale cada cabeza, nunca quién puso. Con
  `/borrar-mis-datos` se borra lo cobrado y lo puesto queda **sin nombre**
  (si se borrara, al que cazó se le irían sus puntos de Temporada).
- ⚠️ Quien caza sin Discord en el padrón cobra igual la Temporada; los
  Puntos de Tienda le llegan cuando se sepa su Discord.
- 🛒 **La Tienda** (`#/tienda`): tu billetera (entrando con Discord), las
  cabezas con precio, un buscador para ponerle precio a cualquiera y lo
  último que se cobró. En cada **perfil**, cuánto vale su cabeza y los montos;
  en el **Inicio**, las tres que más valen. La tienda en sí dice «pronto».
- 📰 **Publicaciones** (`#/publicaciones`): «pronto».
- 📱 **La barra del celular se desliza**: se ven cinco y media, el borde de la
  derecha se apaga mientras hay más, y la opción de la vista abierta se trae
  a la vista sola.
- Probado: self-checks de `precios` (13), `rankings` (con `sumar_precios`),
  `subir_web`; `bot/probar_local.mjs` (309, con la ruta entera del precio);
  el SQL de la billetera contra SQLite; y la página en local, en escritorio
  y en teléfono, poniendo un precio contra un servidor de mentira.

---

## 📅 Domingo 27/09 (3:40 PM) — versión 1.31

**Las encuestas: El Elegido y el ×2 votado.** Dlx: *«1. A. 2. A»* —vota
cualquiera que entre con Discord, y en el ×2 nadie vota a su servidor—.

- 🗳️ **El Elegido**: mientras corre un período del Most Wanted se vota quién
  es buscado en el siguiente (en el Inicio, abajo de los carteles, con
  buscador). El más votado entra primero, como «El Elegido», y **ocupa un
  lugar del nivel del medio**: siguen siendo 3 por día y 9 por semana. Tiene
  que poder ser buscado (activo, no fuera de concurso, no buscado ahora; la
  misma regla, `most_wanted._activos()`) y nadie se vota a sí mismo. El
  último día de la prueba no se vota: lo que sigue es de la T1, y en su
  primera semana se vota El Elegido del lunes 12/10.
- 🗳️ **El ×2 votado**: durante la semana se vota el servidor de la
  siguiente; el más votado sale del sorteo del lunes con **×2 como mínimo**
  (si le tocó más, se queda con lo suyo), y la guerra y el Semillero van
  encima. En el Lunes de la Liga sale «Lo votó la gente» y una línea que
  invita a votar.
- 🔐 **Cómo se vota**: el voto va al Durable Object (tabla `votos`, uno por
  Discord ID y por encuesta, se cambia hasta que cierra, se borra a los 30
  días y con `/borrar-mis-datos`). **El ID lo da Discord, nunca la página**:
  el Worker verifica el permiso y valida contra lo que dejó el ciclo en KV
  (`encuestas`, sólo si cambió). Afuera se ve cuántos, nunca quién. Hacen
  falta **3 votos**; el empate se sortea con el id de la encuesta.
- 🧷 **«Tu servidor»** es donde más jugaste en la temporada (el `sv` del
  pool): hoy la regla alcanza a **80 de 161**, los que tienen su Discord en
  el padrón. Los demás todavía no se sabe de dónde son, y votan a cualquiera.
- ⚠️ **Nunca traba el ciclo**: si no se pueden leer los votos, el Most Wanted
  se elige y el lunes se sortea sin ellos, y lo dice.
- 📅 Las primeras: **El Elegido del lunes 28** (28 candidatos) y **el ×2 de
  la semana del 28**, las dos hasta mañana a las 11 AM.
- Probado: los self-checks de `encuestas`, `most_wanted`, `multiplicadores`,
  `lunes` y `subir_web`; `bot/probar_local.mjs` con la ruta entera (el ID de
  la página no pasa, tu servidor no, vos no, cuenta nueva no, cerrada no); y
  la página en local, en escritorio y en teléfono, votando de verdad contra
  un servidor de mentira.

---

## 📅 Domingo 27/09 (2:20 PM) — versión 1.30

**El Lunes de la Liga, en su canal.** Dlx: *«en el canal ranking global en
DRA»* y, para el destacado, *«de 12 h a 24 h a más»*.

- 🗓️ `CANAL = 1498326749748924416` («〢🌍〉rankings-liga-global», categoría
  LIGA GLOBAL; canal de anuncios). Chequeado antes: el bot es
  **administrador** en DRA. Paso **2b3** del ciclo: manda el de la semana
  una vez y después lo edita **sólo si cambió** (firma en
  `datos/lunes.json`, que guarda `guardar.sh`). Desde la semana del lunes
  28: la de hoy, de un día, no se publica.
- 📣 `DESTACADO_H = 12`.

---

## 📅 Domingo 27/09 (2:15 PM) — versión 1.29

**Meta de comunidad, premios de la semana, «con tiempo» y el Lunes de la
Liga.** Dlx: *«ok sigamos»*.

- 🎯 **Meta de comunidad** (`sortear_metas()`): al sortear, cada servidor
  recibe como meta de gente distinta un 10 % más que su promedio de las
  semanas en que tuvo gente (hasta 4), con 8 como mínimo. Si la junta, cada
  fila de ese servidor esa semana suma +10 % (por `agregar_temporada()`).
  Medido para el lunes 28: **FFA 140, SR 66, DRA 8, URBF 8** (la semana
  pasada, 127 y 60).
- 🏅 **Premios de la semana** (`premios_semana()`), al cerrar: figura (más
  puntos de Temporada, con todo lo de esa semana), revelación (la figura de
  los que debutaron, por `datos/vistos.json`), cazador (más cobrado en el
  MW) y servidor (más gente). Dos insignias nuevas: **Figura** y
  **Revelación** (15 en total).
- 📣 **Con tiempo** (`DESTACADO_H`): la etiqueta en «Lo que viene» y en el
  calendario. ⚠️ **Medido: 1 de 48 anuncios sale con 24 h; la mitad, 12
  minutos antes.** Ver «❓».
- 🗓️ **`bot/lunes.py`**: el mensaje de la semana, con todo (`--ver`,
  `--ver --lunes` para el del lunes que viene). Se manda una vez y se edita
  (la regla de `avisar.py`). **`CANAL` está en `None` hasta que Dlx diga
  dónde va**: no está en el ciclo.

---

## 📅 Domingo 27/09 (2 PM) — versión 1.28

**Insignias y Clásicos.** Dlx: *«sí, dale»*.

- 🏅 **`bot/insignias.py`, paso 2b2 del ciclo** (después de los pools y del
  MW): 13 insignias —debut, 10 y 25 eventos, podio, campeón, tricampeón,
  trotamundos, en llamas, duelista, Clásico, cazador, regicida,
  sobreviviente—, todas de datos que ya hay. Se anotan para siempre en
  `datos/insignias.json`, con la temporada en que se ganaron: **las de la
  prueba no se muestran desde la T1**. Hoy: 222 en 160 personas.
- 🤜 **Clásicos**: `datos/rivales.json` guarda todos los duelos y **no se
  borra con la temporada** (los de la temporada de ahora se rehacen desde
  las llaves en cada corrida: una llave corregida no deja duelos viejos). Un
  duelo es Clásico si esos dos ya se cruzaron 2 veces; el que lo gana suma
  +10 % en ese evento (por `agregar_temporada()`, nunca el Competitivo).
  Medido: 87 duelos, ningún Clásico todavía y 4 parejas cuyo próximo cruce
  lo es.
- 🔑 **Los duelos de las llaves, en un solo lugar**: `llaves_web.duelos()`,
  con la regla de `equipos.es_duelo()` —la de la hoja `1v1`—. Lo usan el
  perfil, las insignias y los Clásicos: cuentan igual en los tres (87, como
  la hoja).
- 🖥️ La página: las insignias en el perfil (las que faltan, en gris y con
  cómo se ganan) y la etiqueta «🤜 Clásico 2–0» en la batalla, jugada o en
  vivo.

---

## 📅 Domingo 27/09 (1:30 PM) — versión 1.27

**El Semillero.** Dlx: *«A»* — nuevo es el que juega por primera vez en su
vida en la Liga.

- 🔑 **`datos/vistos.json`: quién jugó alguna vez**, con la fecha y el
  servidor de su primer evento. **No se borra con la temporada** (el paso 0
  vacía las llaves, no esto). Sembrado con los **735 de la pre-temporada**
  —los 138 del pool y los 597 bloqueados, del repo privado al 20/09; 733
  personas distintas— y los **72 que jugaron por primera vez en la prueba**
  (FFA 52, SR 20). El padrón NO sirve para esto: su versión más vieja ya
  tenía 876, gente que se registró sin haber jugado.
- **La identidad** es la de la vitrina: sin banderas y con su AKA
  (`_clave_persona()`), así «MAU KC 🇨🇴» de una llave es «Mau Kc» de la
  pre-temporada.
- **Gana** el que más nuevos tiene en proporción a su gente de la semana,
  con 3 como mínimo; «trajo» a alguien el servidor de su primer evento. Lleva
  ×1,5 la semana siguiente (`premios`, que ahora es una lista por servidor:
  guerra y semillero se apilan con techo ×5).
- ⚠️ **Sin el registro no hay Semillero**: si el archivo faltara, todos
  serían nuevos y ganaría el más grande. El paso 0b lo actualiza cada
  corrida.

---

## 📅 Domingo 27/09 (1 PM) — versión 1.26

**El organizador de la semana y la Copa de la Liga.** Dlx: la Copa, *«a la
persona»*.

- 🔑 **El organizador sale del anuncio** («Organiza: X», sin arroba; «yo» no
  es nadie: no hay campo de quién publicó). Anuncio y llave se unen con
  `llaves_web.cruzar()`, lo mismo que cuelga «Ver llave». Medido: **8 de las
  16 llaves** de la temporada quedan con su organizador.
- **Puntos**: cada evento de 8 o más le suma su gente distinta. El primero de
  la semana es la sede de la siguiente: su próximo evento (el primero de esa
  semana con él de organizador) es la Copa, ×2. Se anota en el paso 0b, que
  tiene el anuncio; la vitrina la multiplica una corrida después.
- 🖥️ La tabla de la semana en vivo, la Copa, y la etiqueta 🏆 en «Lo que
  viene» (que ahora lleva el organizador).
- ⏳ **El Semillero espera a Dlx**: qué es «gente nueva» (ver «❓»).

---

## 📅 Domingo 27/09 (12:30 a 1 PM) — versión 1.25

**El evento dorado, la guerra de servidores y los bonos.** Dlx: *«me gustan
todas»*. Todo en `bot/multiplicadores.py`, que ahora es «la semana de la
Liga», con sus tests.

- 🌟 **Dorado**: con el sorteo del lunes sale un servidor y un día (martes a
  sábado): el primer evento de ese servidor desde ese día vale ×3 encima de
  su multiplicador. Se elige entre los servidores que jugaron en las dos
  últimas semanas; en «Lo que viene» el candidato lleva 🌟.
- ⚔️ **Guerra**: pares sorteados el lunes; gana el de más puntos CRUDOS por
  persona (si no, ganaría siempre el del ×5), y lleva ×1,5 sobre su
  multiplicador de la semana siguiente (`premio`).
- 🎁 **«Volvé»** (×1,5 al segundo evento si cae dentro de los 7 días del
  primero), **Pasaporte** (+1.500 por 3 servidores en la semana) y
  **Asistencia** (+1.000 por 3 días distintos).
- 🔑 **Todo entra por `agregar_temporada()`**: `agregar()` deja cada fila en
  `agregar.filas` y el factor recibe el evento y la persona. El techo de una
  fila es ×5. **El Competitivo no ve nada de esto.**
- 📅 **Nada para atrás**: «Volvé» corre desde hoy 1 PM ET; lo semanal, desde
  el sorteo del lunes 28 (`DESDE`).
- ⚠️ **El bonus por llave limpia quedó afuera, a propósito**: medido, lo
  cumplían casi todas (179 batallas, 3 sin ganador, ninguna llave sin
  campeón). Así sería un ×1,5 para todos, no un incentivo. Ver «❓
  Esperando a Dlx».

---

## 📅 Domingo 27/09 (12 a 12:30 PM) — versión 1.24

**Los multiplicadores de la semana.** Dlx: *«me gusta hasta x5»*, el debuff
*«a cualquiera»*, *«desde ya»*.

- 🔑 **`bot/multiplicadores.py`, paso 0b del ciclo** (antes de las
  vitrinas). Cada lunes a las 11 AM ET sortea uno por servidor de los que el
  bot lee (`datos/bot_en.json`): uno fuerte (×2 o ×3, y ×5 una semana de
  cada cuatro), quizás un ×0,5, y el resto ×1 a ×2. **Lo sorteado se guarda
  y no se vuelve a sortear**: cada evento usa el de su semana para siempre.
  El primero arrancó en el momento del sorteo (lo de antes no se multiplica)
  y el arranque de la temporada corta la semana, como en el MW.
- 🔑 **`rankings.agregar_temporada()` es la puerta de la Temporada**:
  `agregar()` con el multiplicador de cada evento y el MW. La usan las
  vitrinas de la Temporada, Podios y Mundial, y la portada. **El Competitivo
  usa `agregar()` pelado**: no ve ni multiplicadores ni MW. Si el archivo no
  se puede leer, revienta en vez de escribir sin multiplicar.
- 🖥️ **En la página**: la sección del Inicio y la etiqueta «×N» en Lo que
  viene, Lo que pasó, el calendario y la llave en vivo. Y **la página se
  refresca sola** cada 5 minutos y al volver a la pestaña: Dlx seguía viendo
  los 10 MW de la mañana porque la página pedía los datos una sola vez.

---

## 📅 Domingo 27/09 (12 a 12:30 PM) — versión 1.23

**Most Wanted: 3 por día, y suma a la Temporada.** Dlx: *«1. sí»* y *«que
sean 3… y cuando sea por semana que sean 9»*.

- 🔑 **`sumar_mw()` en `sheet/rankings.py`**: lo que cada uno cobró va a
  `Puntos`, y 🎯 💀 🛡️ se calculan —salieron de `ARRASTRE`, donde no tenían
  semilla: nadie las había llenado nunca—. 🎯 es el quinto componente del
  OVR (`sheet/ovr.py`, 12 %), así que también lo mueve. Va en las vitrinas
  de la Temporada, Podios, Mundial y la portada; **no en `agregar()`**, que
  también alimenta el Score: el Competitivo no lo ve.
- ⚠️ **Una corrida atrás**: las vitrinas (1c) leen el `mw.json` de la
  corrida anterior, porque el MW (2b) necesita los pools que salen de
  ellas. Media hora.
- ⚠️ **El nombre se cruza como el pool** (`_como_pool()`: sin banderas, con
  mayúsculas). Con la clave de la vitrina, MTZ —que no está en el padrón y
  lleva la bandera en la clave— no enganchaba.
- 🔑 **Una sola cuenta**: `most_wanted.suma()` la usan la web y el Sheet.
- 💀 **3 por día y 9 por semana, repartidos por nivel** (`CUPOS`): por día,
  uno de cada nivel —un pez gordo, uno del medio y uno al alcance de
  cualquiera—, con la categoría sorteada adentro del nivel. Sin eso, con
  tres lugares salían siempre El Rey, El Imparable y El Verdugo. El día de
  hoy arrancó con 10 y, como nadie había cazado todavía, se volvió a elegir
  con 3.

---

## 📅 Domingo 27/09 (11 AM a 12 PM) — versión 1.22

**Most Wanted, en prueba y a diario.** Dlx: *«podríamos empezar ahora para
ver»*, y *«the period ends in october 4»*.

- 🔑 **`bot/most_wanted.py`, en el ciclo (paso 2b, entre los pools y la
  web)**. Cada período elige de 10 a 15 buscados, uno por categoría, entre
  los **activos** (2 eventos en la última semana) y **miembros** —los fuera
  de concurso no son buscados; cazar, sí—. Recorre las llaves procesadas en
  cada corrida: el primero que le gana a un buscado lo caza. Guarda sólo a
  quiénes eligió; la caza se recalcula entera, así que una llave que entra
  tarde o se corrige cambia el resultado sin dejar nada viejo.
- 📅 **Diario hasta que termina la prueba, semanal en la T1**, solo, con la
  fecha de `comun/temporada.py` (si la T1 se corre, se cambia ahí y nada
  más):
  - el último día de prueba termina **a las 00:00 ET del arranque**, no a
    las 11 AM: a esa hora el paso 0 archiva las llaves de la prueba, y un día
    abierto se recalcularía sin ellas y cerraría con todos «escondidos». Por
    lo mismo, un período de la prueba se cierra con lo último calculado
    (`cerrar_periodo()`);
  - **la primera semana de la T1 no hay buscados**: con todo en cero no hay
    a quién buscar. El tablero dice cuándo salen: **el lunes 12/10 a las 11
    AM ET**, que es lo que Dlx había aprobado (`_primera_semana()`);
  - lo de la prueba **no cuenta en la T1** (se borra, como el resto): la
    tabla de cazadores arranca de cero. Y si un período arranca sin nadie a
    quien buscar, se vuelve a elegir en cada corrida, y la caza cuenta desde
    que se eligió.
- 🖥️ **En la página**: el tablero en el panel del Inicio (en el teléfono se
  desliza), la pestaña **Ranking → Most Wanted** (cazadores de la temporada),
  **«Su cacería»** en el perfil, las columnas Cazó · Cazado · Sobrevivió del
  ranking de Temporada (ya no leen del pool: salen de `datos/mw.json`) y en
  las llaves: «🎯 Acá cazaron a…» en la batalla que perdió, y en vivo, qué
  buscados juegan.
- ✅ ~~Los puntos del Most Wanted todavía no suman~~: suman desde la 1.23.
- ⚠️ **`El Muro` pide 60 % de duelos ganados**: sin piso, el primer día salió
  uno con 4 de 8.

---

## 📅 Domingo 27/09 (10 a 11 AM) — versión 1.21

**«Fuera de concurso».** Dlx: *«1, sí»*. Nadie sale del ranking; el número
es de los miembros (Discord vinculado, país y Miembro de DRA).

- 🔑 **Un solo lugar**: `verificados.por_nombre()` dice quién es miembro y
  `verificados.numerar()` numera: `[1, 2, None, 3]` para Hassan, Makmah,
  Velatz, PichulaMc. Sin `datos/verificados.json` numeran todos: un corte de
  Discord no deja a nadie sin puesto.
- **Dónde se aplica**: las vitrinas del Sheet (Temporada, Competitivo,
  Podios, Duelos: «—» en el `#`), el pool de Temporada (`pos` oficial, `fc`,
  `o` = orden por mérito entre todos, `total` = los que tienen número), el
  Competitivo (Makmah #1 de 1), los círculos de país, servidor y crew de las
  tarjetas, la portada del Sheet y la página (el ranking, el podio, los
  líderes, los tres de arriba, los mejores de cada lado, los récords, el
  perfil). El `#N` del apodo lee la vitrina del Competitivo, así que sigue.
- ⚠️ **Quien está fuera de concurso lleva `pos` igual en el pool**, después
  de los miembros: `gencomp` compara `pos` con números y un `None` lo
  tumbaría. No se ve nunca (sin portón no hay carta, y la página muestra «—»).
  `puedo_generar.py`: las cuatro cartas salen para el pool entero.
- **Medido hoy**: 57 con número, 96 fuera de concurso. PichulaMc pasa de #4 a
  #3; el «#N de la temporada» del perfil es «de 57».
- ⚡ **El lobby, más liviano**: `LLAVES_WEB` de 24 a 12, ahora que las viejas
  se piden aparte; los botones «Ver llave» del calendario y del perfil las
  piden si no viajaron. 124 KB → 109 KB por visita.

## 📅 Domingo 27/09 (9 a 9:30 AM) — versión 1.20

Lo que Dlx pidió a las 9 AM mirando el panel de llaves, y la búsqueda de
errores que pidió: una auditoría entera de la página hecha en paralelo (13
hallazgos) más una pasada del teléfono vista por vista a 320, 375 y 900 px.

- 🏆 **Seguir a alguien en la llave, sin saltos.** La causa del «very buggy»
  era la barra: aparecía arriba del cuadro al pasar el mouse, el cuadro bajaba
  50 px, el nombre se iba de abajo del mouse, la barra se escondía… Ahora está
  siempre (64 px medidos en reposo, con mouse y tocando) y sin nadie seguido
  dice cómo se usa. Además se encienden **las ramas** del camino y el resto se
  apaga; soltar tiene una pausa de 250 ms, y el renglón entero cuenta, no sólo
  el nombre.
- 🏆 **El campeón, una vez**: sin el recuadro de arriba de la final; la copa va
  en una etiqueta del borde, como «Revivido». Y **un equipo que no sumó parejo**
  (GENESIS: el revivido se llevó 3000 y sus compañeros 2500) dice «2500 a 3000»
  en vez de «3000» para los tres.
- 🥊 **Cara a cara** en el perfil —contra cada rival, cuántas veces y cómo le
  fue— y arriba de «Comparar dos» si los dos se cruzaron. Sale de los mismos
  duelos del perfil; no hay dato nuevo.
- 🔗 **Los links de llaves viejas**: el lobby trae las 24 más nuevas y un link
  más viejo caía al calendario sin decir nada. Ahora el ciclo sube todas a una
  clave aparte (`web:llaves`, sólo si cambió) y la página la pide nada más en
  ese caso. La primera escritura la hace la corrida de las 11:22.
- 🌙 **De 3 a 11 AM ET el vigía duerme**: ni llaves en vivo ni anuncios.
  Sigue latiendo (con `dormido`) para que la alerta no lo tome por caído, y
  `madrugada.py` lo verifica en CI.
- 📱 **El teléfono**: los rankings y las banderas en una fila que se desliza
  (la tabla arranca 280 px más arriba), el podio de la llave compacto, y tres
  cosas que se salían de la pantalla —las dos tarjetas del Inicio (12 px), un
  botón largo en Tarjetas y el podio del Inicio con «Guardia Nacional»—. En
  «Los tres de arriba», las medallas se apilan: «Colesito» se partía letra
  por letra a 320 px.
- 🔧 **De la auditoría**: la llave en vivo volvía a la primera ronda cada
  minuto; la llave no arrancaba centrada en la final; un link viejo a un perfil
  dejaba «Lo que le falta» en «Cargando…» para siempre; decía «✓ Desbloqueada»
  a quien no está verificado (96 de 153); cambiar la zona cerraba Ajustes y no
  actualizaba «Lo que viene»; si el líder no tuviera tarjeta se escondían las
  dos; banderas de 9 px en el comparador; pestañas «bloq-temporada» en tu
  perfil; búsquedas que distinguían tildes; y el cuadro no se rearmaba al girar
  el teléfono. Más un nombre con tilde distinta («ANTORCHA OLIMPICA») que la
  llave no reconocía.

## 📅 Domingo 27/09 (7:30 a 9 AM) — versiones 1.18 y 1.19

Las respuestas de Dlx de las 7:22 AM y lo que pidió en el mismo mensaje.
Cinco commits, la página y el Worker desplegados, el payload subido. El
ciclo no se corrió (de 3 a 11 no hay sincronización): lo que depende de él
—AGREEMENT DOOMSDAY, el #1 de Makmah, KENNY con Kenny— entra a las 11:22.

- 🔴 **Llaves en vivo (1.19).** El vigía del Worker lee cada minuto los 6
  canales de llaves de la Liga —los que tuvieron una llave en las últimas 3 h;
  los demás, uno cada 5 minutos— y guarda el texto, con las menciones como
  nombres. No lo lee: lo lee el navegador con `llave_vivo.js`, una copia de
  las reglas de `escuchar.py` atada por CI a 14 llaves reales (las 14 dan
  idéntico a Python). El Inicio muestra «🔴 En vivo» y el panel la abre como
  a las oficiales, redibujándose cada minuto. La primera de verdad va a ser
  SNAKE ARENA VOL. 2, hoy a las 5 PM.
- 🏆 **El panel de llaves (1.18)**: tocar un nombre sigue su camino con su
  puesto y sus puntos (el segundo toque abre el perfil); «Cuadro» o «Por
  rondas»; `#/llave/362` con «Copiar el link»; los equipos en bloque con sus
  caras; y revivido, walk-in, «pasan 2», «no pasó nadie» y «por el podio»
  como etiquetas.
- 🕐 **La hora con tu bandera**: si entraste con Discord y tu dispositivo
  está en la hora de tu país, la bandera; si no, «hora local». En el
  calendario, «Lo que viene», Eventos, la llave y el changelog.
- 📱 **Discord en la app**: en Android los links abren la app de Discord
  (`intent://`, y si no está, el navegador). **Sin probar en un teléfono de
  verdad**: acá no hay uno.
- 💪 **Sus fortalezas**, en el perfil: el radar de las cinco dimensiones del
  Score contra el promedio de la Liga, «su fuerte» y «a trabajar». Con menos
  de 10 eventos dice que es provisorio.
- 🔎 **«Sin verificar»** en el perfil, con lo que falta: 76 sin Discord
  vinculado, 19 que no son Miembro de DRA y 1 sin país.
- 🐍 **Los rangos de Snake Rap**: GENESIS BATTLES dice «Rango 4» y RAP
  EXHIBITION «Rango 2», con sus puntos de ascenso en Snake Rap. **No suman en
  la Liga**: se muestran.
- 🏅 **El #1 de la Competitiva**: `pos` salía del Score entre las 153
  personas; ahora primero quienes pasan la puerta de 10 eventos. Makmah pasa
  de #4 a **#1** («🏆 #1 COMPETITIVO») en la corrida de las 11:22.
- 🗑️ **Las tarjetas de quien se va, a la semana** (paso 2e, `bot/fuera.py`):
  un reloj por persona que vuelve a cero si vuelve a pasar el portón, y que
  se commitea. **Hoy 279 personas tienen tarjetas en R2 y no pasan el
  portón** (160 no son Miembro de DRA, 82 no están en la Lista, 28 sin
  Discord ID, 9 sin país): si nadie se verifica, **se borran el domingo
  4/10**, el día antes de la T1. La foto no se toca.
- 🎨 **Botones nuevos** (10 px, luz arriba, sombra del color del servidor y
  texto negro o blanco según el fondo) y, en «Lo que pasó», al costado.
  Urban Freestyle en **miel**.
- 🔴 **Mis errores de esta tanda**, los cuatro sin daño pero los cuatro
  evitables: corrí `construir_akas.py` y `subir_datos.py` con un `--auto` que
  no tienen —rehicieron `akas.json` y escribieron `meta` en KV, lo mismo que
  iba a escribir el ciclo—, **con una nota en mi memoria que avisaba de esos
  dos scripts**; ahora la regla es mecánica (grep antes de correr). Un
  simulacro del ciclo hizo un barrido completo de Discord y movió su reloj
  (lo devolví). Y dos veces la herramienta de archivos rompió una barra o un
  `\u2028` (los arreglé antes de subir).

## 📅 Domingo 27/09 (6:15 a 7:15 AM) — versión 1.17

Lo que Dlx pidió mirando la página. Dos commits (`957ab90` la página,
`b1965fb` el lector), la página desplegada a las ~7:05 AM y el payload subido
a mano una vez (una escritura de KV) para que el color nuevo no esperara a
las 11:22. **El ciclo no se corrió**: de 3 a 11 AM no hay sincronización
(*«para ahorrar más»*).

- 📅 **Google Calendar en el teléfono**: lo que no anda es **suscribirse al
  calendario entero** —lo dice la ayuda de Google: *«You can't subscribe to a
  calendar in the Google Calendar app»*—, y eso no tiene arreglo de nuestro
  lado. Lo que **sí** anda es agregar **un evento**: el botón abre la app con
  el evento cargado. Está en «Lo que viene» y en Eventos, y la nota del
  teléfono lo explica.
- ⏱️ **«Lo que viene» rehecho**: con un solo evento anunciado —lo normal— era
  un renglón. Ahora el próximo va grande (servidor, día y hora de quien mira,
  cuenta atrás, anuncio, Google Calendar, avisos) y, si no hay más, una línea
  que invita a activar los avisos.
- 👑 **«Líder de la temporada» / «Líder del competitivo»** mientras se juega;
  el día después del cierre pasa solo a «Campeón». Las dos tarjetas quedan
  **centradas entre sí** (la Competitiva es 47 px más alta y colgaba) y
  **sin el nombre abajo**.
- 🎨 **Urban Freestyle en ámbar `#FFA928`.** Medido: su naranja y el de Snake
  Rap estaban a **ΔE 3** (a simple vista, el mismo). Y había una segunda
  causa: la página aclaraba todo color de luz menor al 50 %, **también el de
  Snake Rap, que ya se leía** (5,7:1). Ahora sólo se aclara lo que no llega a
  4,5:1, así Snake Rap muestra su naranja real: **ΔE 19,8** entre los dos. Es
  sólo la web: el fondo de la carta de Servidor de Urban vive en
  `los_nueve.py` y no cambió. En Mundo, los cuatro servidores van **dos y
  dos** (Urban quedaba solo en la segunda fila).
- 🔒 **Privacidad y Términos**: fuera del pie del menú; ahora en **Ajustes** y
  en **Mi cuenta** («🔒 Tus datos»). Las dos páginas rehechas: español e
  inglés, «Lo importante» arriba, índice, secciones numeradas. El texto legal
  es el mismo.
- 🕐 **«Datos hace 3 horas»**: era una línea de 11 px en mayúsculas
  condensadas. Ahora dos renglones legibles y, cuando pasa de una hora, el
  porqué: de 3 a 11 AM no se actualiza.
- 📰 **Changelog**: la hora de cada versión (en la de quien mira), dos columnas
  sin huecos en la compu, sin «Tu servidor es donde más jugaste» y la 1.15
  titulada como cambio («Tus tarjetas en la página, y tus avisos a tiempo»).
- 🏆 **AGREEMENT: DOOMSDAY V.1 se lee entera** (entra en la corrida de las
  11:22 AM). Quedaba «sin campeón» por tres cosas de la misma llave: el
  negrito entre la bandera y el `&` (`**FULLY🇨🇱**&DXG🇲🇽` era una persona);
  en la semi **pasa uno de cada equipo y juntos arman el de la final**, y
  ningún lado «aparecía después»; y el campeón viene como **una mención por
  integrante**. Probado con las 16 llaves guardadas: 15 idénticas y ésta pasa
  a 9 filas, campeón FULLY + SNOW, como el podio. Además, las menciones del
  mensaje traen el nombre de Discord de cada uno y ahora se usan como
  candidatos (siempre contra quien peleó).
- 🔴 **Mi error de esta tanda, frenado a tiempo**: iba a sacar el `__` del
  título de las llaves («__ AGREEMENT DOOMSDAY V.1 __») y lo había «medido»
  en `datos/llaves_t1.json` —cero eventos con `_`—. **Era el archivo
  equivocado**: ése ya viene limpio para la web. En `Eventos Procesados`
  **11 eventos** se llaman «__ … __», y el nombre es su identidad: el cambio
  los habría cargado **dos veces**. La prueba A/B lo mostró antes de
  commitear y se revirtió; queda escrito en `titulo()`.
- 👤 **Velatz, Provenza, Geoka y Neo** no tienen tarjeta en la página porque
  **no están en DRA** (Discord contesta 404 a su ID): es tu regla del portón.

## 📅 Domingo 27/09 (4 a 6 AM) — versión 1.16

Las llaves de los otros servidores y lo que la tarjeta y el perfil decían
distinto. Cinco commits, y un ciclo corrido a mano a las 5:05 AM —adentro de
la ventana de 3 a 11 AM— para que el redibujo grande pasara antes del día.

- 🐍 **Las llaves de Snake Rap entran.** Las tres de la T1 daban **cero filas,
  sin ningún error**: el lector se escribió mirando FFA y Snake Rap escribe
  otro dialecto (el «vs» es un emoji propio, marcos 〈〉 y 「」, equipos sin
  `+`, el podio con emoji y menciones). `escuchar.traducir()` pasa cada forma
  a la de FFA. Entraron **#360 GENESIS BATTLES** y **#362 SNAKE INSIGNIA 3/8**
  (28 de 28 personas, cero dudas), y **#361 SEVEN STREET** de FFA, que
  tampoco entraba. **RAP EXHIBITION** entra en la próxima corrida (ver arriba).
- ✂️ **SNAKE INSIGNIA vino partida en dos mensajes** (Discord corta a 2.000
  letras): leída así, la segunda mitad era **otro evento con otro campeón**.
  `unir_partidas()` las pega: misma persona, menos de 3 h, y la segunda
  empieza en una ronda posterior.
- 🎯 **En los FILTROS de Snake Rap pasan los mejores del total**, no uno por
  grupo: de tres grupos no pasó nadie, y esas **11 personas** se quedaban sin
  su participación. Ahora caen en filtros (625 en 16+).
- ⭐ **El negrito de Discord llegaba al ranking**: había alguien llamado
  «\*\*PARK JI-SUNG \*\*». Y las banderas en emoji propio
  (`<a:Uruguay:…>`) se leen como país.
- 🃏 **La tarjeta y el perfil dicen lo mismo.** Revisado con un agente carta
  por carta: ninguna estaba vieja, pero había siete diferencias:
  - todas las **Servidor mostraban una letra de rango** que el perfil no (sin
    la puerta de 10 eventos);
  - el **TAG de la Servidor corría un puesto**: Makmah, #2 de FFA, salía
    «DUEÑO DE CASA»;
  - los **duelos** del perfil contaban el tercer puesto sin batalla (Colesito
    3/4 en el perfil, 2/3 en la carta): perfil = carta en 103 de 106;
  - el **OVR Nacional** de la carta de País usaba la pre-temporada (72 de 104
    distintos del `/versus`; ahora 0);
  - **banderas de afuera** de la Liga en la Servidor (🇯🇵, 🇦🇿, 🇯🇴);
  - **10 Temporada con el ícono de imagen rota** (sin país), y **1.250 puntos
    salía «1.2K»** (Python redondea al par).
- 🔤 **La letra de rango sale de un solo lugar**, `comun.rangos.letra_de()`:
  la Temporada, la página y los avisos la calculaban con otro Score que el de
  la Servidor y la País, y diferían en 7 personas. **Makmah llegó a 10
  eventos en esta corrida**: es el primero con letra (C).
- 🏠 **Hassan no es de Snake Rap.** Con el primer evento de SR, el pool de
  temporada dijo que Hassan, Colesito y Zignos eran de SR: su lista de
  servidores era la de la pre-temporada, **sin FFA**. `rankings.py` la había
  arreglado el 22/09 y la copia del pool nunca se tocó. Ahora la importa.
- 🛡️ **La página muestra la tarjeta sólo de quien pasa el portón**: 64 de las
  121 personas con tarjeta en la página no lo pasaban (tu «sí»).
- 🏙️ **Urban Freestyle**: el bot lee sus cuatro canales de llaves (55 llaves,
  la última del 18/09; en la T1 todavía no publicó ninguna) y sus anuncios.
  Pero **sus eventos se iban a llamar «-----------------------------»**: abren
  la llave con una línea de guiones. Arreglado, y ningún título de la T1 cambia.
- 🔴 **El campeón salía al revés** en una llave vieja de Urban Freestyle: con
  la línea `CAMPEÓN 🏆 : YINN HASSAN SEBITAS` sin enganchar, el respaldo del
  «renglón de abajo» leía `SEGUNDO … : POLLO MARTYNEZ NC` y le daba la final
  al subcampeón. Ya no: el renglón de abajo no puede ser el del segundo, y el
  campeón escrito con espacios se parte con los integrantes de la final. Y
  **los equipos con espacios** («HASSAN SEBITAS») se leen como equipo cuando
  esos nombres pelearon solos antes. Ninguna llave de la T1 cambia.
- 🔴 **KENNY tumbó 11 cartas de País** en la corrida de las 5:07 AM: el pool
  trajo a «Kenny» (FFA, 🇦🇷) y a «KENNY» (Snake Rap, sin bandera), con la
  misma clave, y el exportador de País cortaba la tanda entera ante uno sin
  país. Jupiter, KC, Kravitz y otros ocho se quedaron sin la suya. Ahora lo
  saltea; se reintentaron en la corrida de las 5:36 AM.
- 📅 **Google Calendar**: el calendario estaba bien (Google lo baja: 200) y el
  problema es el teléfono, donde **ni la app ni la web de Google dejan sumar
  un calendario por link**. En el teléfono ahora la página lo explica y deja
  copiar el link.
- 🧪 **Mis errores de esta tanda**: una prueba A/B que corría la copia vieja
  sin el padrón (me hizo creer que cambiaba nombres de FFA); una primera
  traducción que tocaba texto de FFA sin hacer falta (la agarraron las
  pruebas); un heredoc que se comió las barras; una falsa alarma de «los de
  filtros cobran 0» (mi prueba usaba la etiqueta de la página y no la del
  Config), y casi cambio la regla de `&` que yo mismo había dejado escrita como
  «no se toca sin decidirlo»: se resolvió sólo con banderas a los dos lados.
- 🌙 **Esta madrugada se redibujan todas** (~720): `comun/rangos.py` cambió y
  entra en la huella de código de las cuatro. No cambia nada que se vea.

## 📅 Viernes 25/09 (2:30 PM) a sábado 26/09 (4 PM) — versión 1.15

Dos revisiones (el JavaScript y el Python de ese día) y una lectura de los
logs del ciclo. Lo que encontraron, y cómo quedó:

- 🔴 **`Ranking Temporada` estuvo congelada de 2:22 a 2:52 PM del 25/09, y fue mío.** Al sacar los respaldos del Sheet del repo público, la puerta de `rankings.py --escribir` —que pedía uno— dijo «no hay» en cada corrida, y el paso quedaba en verde. Ahora el respaldo de lo que la vitrina no recalcula (las columnas de Most Wanted) es `datos/temporada_pool.json` en git, que tiene media hora y no tres días; si la vitrina no se escribe, te llega un DM (uno cada 6 h). Verificado en la corrida de las 2:52 PM: 85 filas.
- 🌙 **El redibujo de la madrugada podía perder cartas**: el sello era por persona, así que si de día le cambiaban los datos de una carta se sellaban las cuatro, también la Servidor que esperaba el naranja. Ahora es **por carta**. Verificado anoche: a las 11:52 PM se dibujaron sólo las cartas con datos nuevos (93 personas) y a las **12:22 AM las 292 Servidor** que esperaban, en 16 min. Hoy no queda nada pendiente.
- 🧹 **El arranque del 5/10 quedaba a medias** y la T1 habría arrancado con los puntos de la prueba: `Ranking Temporada` no se vaciaba sola (ahora se archiva en el Operativo y se vacía), `Eventos Procesados` conservaba la columna `#`, y una corrida cortada a la mitad se daba por hecha. Ensayado otra vez con pestañas de prueba (borradas) y simulado contra las hojas reales.
- 👕 **Las camisetas entran al sello**: quien entra a un servidor —o el bot a uno nuevo— tiene su camiseta en la madrugada siguiente. Y el logo de un servidor que cambia redibuja sus cartas.
- 🏅 **La letra de rango de la página y de los avisos salía del color de la carta** (el OVR), no del Score. Nadie la veía porque nadie llegó a 10 eventos; Hassan habría recibido «Subiste a rango SSS» siendo B.
- 🖼️ **5 raperos no veían sus tarjetas en la página** (los que tienen espacios o tildes en el nombre): la página armaba otra clave que R2 y KV.
- 🔗 **Mi cuenta**: «Mis redes» no escribe KV si no cambió y tiene tope por día; una red que deja de ser pública sale sola; salir de la cuenta suelta los avisos de ese dispositivo; los avisos personales ya no se pierden si el ciclo reescribe la cola.
- 📋 **De los logs**: un timeout de Discord ya no tumba la lectura de anuncios; el DM del vigía dice el error en vez de «no late hace 0 min»; el registro no se reescribe si queda igual (eran 167 filas cada media hora); `Pendientes` no duplica un alta de la misma cuenta y la cierra sola cuando el ID ya está en la Lista.
- 🐧 **Los workflows quedan en Ubuntu 24.04**: `ubuntu-latest` pasa a Ubuntu 26 el 19/10 y podía romper el Chromium del dibujo sin aviso. El cambio de versión se hace a propósito, probándolo.
- 💸 **Una sola vez, 331 escrituras de KV** (25/09, 2:52 PM): cada persona pasó de ofrecer las 9 camisetas a las de sus servidores. Las corridas siguientes ya no reescriben.

## 📅 Viernes 25/09 (1:25 a 1:45 PM) — versión 1.14

- 🧹 **El 5/10 la fase de prueba se borra, y lo hace el ciclo solo**, como dijiste (*«Se borra»*):
  - **La fecha cambia sola**: `INICIO` pasa a las 00:00 ET del 5/10 en la primera corrida de ese día (`comun/temporada.inicio()`), así que las llaves de la prueba dejan de leerse.
  - **El paso 0 del ciclo**, una sola vez (`datos/arranque.json`), en la corrida de las 12:22 AM: cada hoja cruda del Operativo —`Entrada`, `Resultados`, `1v1`, `Eventos Procesados`— se **duplica como «… · prueba»** y recién después se vacía. Nada se pierde. Las vitrinas quedan en cero solas, porque salen de esas hojas. Las llaves de la página arrancan de cero, y esa corrida acepta que el pool quede vacío.
  - **No se toca** la Lista de Raperos, los AKAs, Config, Pendientes ni las fotos.
  - Te llega un **DM** cuando se hace, o si falla. Si falla, el ciclo no procesa nada hasta que ande y reintenta cada media hora.
- ✅ **Ensayado de punta a punta** con pestañas «ENSAYO-…» en el Operativo, que después se quitaron: archiva, vacía sólo las columnas de la tabla (el panel de `Entrada` en A y B queda), y **la segunda vez no toca nada**, ni siquiera un dato nuevo. Simulado contra el Operativo real: hoy archivaría 136 filas de `Resultados`, 31 de `1v1` y 7 de `Eventos Procesados`.
- Lo que el 5/10 se anuncie para ese día o después sigue en el calendario: la página filtra por la hora del evento, no por cuándo se anunció.

## 📅 Viernes 25/09 (1:15 a 1:25 PM) — versión 1.13

- 📷 **La foto, libre hasta el 9 de octubre**, como dijiste. La fecha vive en `comun/temporada.py` (`FOTO_LIBRE`) y el despliegue se la pasa al Worker; `/foto` y la página usan la misma regla. Una marca de uso hecha antes de esa fecha no cuenta, así que las dos de hoy (dlx y makmah) quedaron libres sin borrar nada. 3 pruebas nuevas.

## 📅 Viernes 25/09 (1 a 1:15 PM) — versión 1.12

- 📷 **La foto desde la página**, que pediste: *«¿podrías hacer que se pueda cambiar la foto desde la página web de la tarjeta también? Esto respetando lo de 1 vez por temporada»*. En Mi cuenta y abajo de tu tarjeta en tu propio perfil. Es `/foto` con otra puerta: **la misma regla** (`meta.arrancada`, `foto:<temporada>:<clave>`, el pase de DRA la saltea), **el mismo guardado** (`fotoAR2()`, que ahora comparten los dos) y **la misma cara**: la global de Discord, que el Worker pide con el permiso de entrar —nadie puede subir otra imagen—. Primero muestra cuál quedaría y se guarda recién con «Usar esta foto». 6 pruebas nuevas.
- 🏙️ **Urban Freestyle le dio al bot su rol** (administrador): «Data⋅Eventos», que daba 403, ya se lee. Se forzó la búsqueda de canales (`CANALES_V` 5) para no esperar las 6 h.
- La corrida de las **12:52 PM** fue la primera con todo lo de hoy: escuchó, no dibujó (las 633 cartas de diseño esperan a la madrugada), escribió la comunidad (**10.004**) y anotó a los **331** de los avisos personales. La página ya está en la **1.11** con todo en vivo.

## 📅 Viernes 25/09 (12:50 PM a 1:10 PM) — versión 1.11

- 👤 **Los avisos de cada uno** (de «todas», la 4, la última): «subiste de rango» y «desbloqueaste tu tarjeta», al celular. **Sin ningún secreto nuevo** —los tokens nuevos quedaron para el final—: el ciclo arma la cola (`bot/avisos_personales.py`, un paso nuevo en los dos trabajos) y la deja en KV (`avisos:personales`); el vigía del Worker, que ya corre cada minuto, la lee y la manda.
- **Sólo a quien vinculó un dispositivo**: en la campana, «Vincular con mi Discord» entra con Discord (`prompt=none`, no pide nada nuevo) y el Worker le pregunta a Discord de quién es —el ID nunca lo pone la página—. «Desvincular» y «Desactivar» lo sacan.
- ⚠️ **La primera corrida no avisa nada**: anota cómo está cada uno (331). Si no, le diría a todos «desbloqueaste tu Servidor». **Bajar de rango no se avisa** (lo decidí yo: un aviso para decirte que bajaste no suma; es una línea, `AVISA_BAJADA`, si lo querés).
- Cada aviso sale **una vez**: el objeto lo anota antes de mandarlo (`hechos`), así una cola repetida no vuelve a sonar. El rango sigue la misma puerta que la carta: nada debajo de 10 eventos.
- Con eso quedan hechas las cuatro ideas de Mi cuenta.

## 📅 Viernes 25/09 (12:35 a 12:50 PM) — versión 1.10

- 🔗 **Tus redes en tu perfil** (de «todas», la 1): en Mi cuenta, **«Mis redes en mi perfil»** pide a Discord el permiso `connections` —aparte: entrar sigue pidiendo sólo `identify`— y ofrece **sólo las conexiones que la persona ya muestra en su perfil de Discord** (Instagram, TikTok, YouTube, X, Twitch, Spotify, Reddit, Bluesky). Se guardan **sólo las que marca**, en `redes:<clave>` de KV, y **sólo si tiene perfil en la Liga**; «Quitar todas» las borra. El ciclo las suma a `web:perfiles` (`subir_web._con_redes()`: un listado y un `bulk/get` por corrida) y el perfil las muestra arriba. El permiso de redes vive en la memoria de la página, nunca en el dispositivo. Worker: `cuentaRedes()`, con 8 pruebas.

## 📅 Viernes 25/09 (12:20 a 12:35 PM) — versión 1.09

- ⭐ **Seguir raperos** (de «todas», la 3): botón en el perfil, la lista en Mi cuenta con el puesto de hoy y una ★ al lado del nombre en toda la página. Vive en el dispositivo (`lg:sigo`), como `lg:yo`: no viaja a ningún lado.
- 📅 **Tus próximos eventos**, en Mi cuenta: los anunciados en los servidores donde estás (`/api/cuenta` devuelve `svs`; Worker desplegado), con el anuncio —que es donde cada servidor dice cómo anotarse— y «+ Calendario». Sin servidores, los de toda la Liga.
- 👥 **La comunidad, en «La Liga hoy»**, que pediste: *«¿cuántas personas diferentes tenemos, y con ID y verificadas? Quizás ese dato podríamos agregarlo a La Liga hoy»*. Medido a las 12:26 PM: **10.004 personas distintas** en los 4 servidores (sumando serían 12.036), **876 en la Lista**, **545 con Discord ID** y **331 verificadas con tarjeta**. La primera la cuenta `herramientas/servidores_de.py` en cada corrida (sin bots, sólo el número al repo: `datos/comunidad.json`); las otras tres, `subir_web._comunidad()`.
- ❓ **Por qué el reconocimiento dio sólo 4 IDs**: el cruce busca en los servidores a los **331 de la Lista que no tienen ID**. De ésos, 268 no tienen ninguna cuenta con ese nombre en los 4 servidores (se fueron o usan otro) y 63 son ambiguos. Las otras ~9.100 personas de los servidores nunca compitieron: no están en la Lista y entran solas con `/card` o `/verificar`.
- Faltan de «todas»: **las redes de Discord en el perfil** y **los avisos personales**.

## 📅 Viernes 25/09 (11:45 AM a 12:20 PM) — versión 1.08

- 🟠 **Urban Freestyle en naranja** (`#EA7206`, el tono más vivo de su logo nuevo), con el mismo corte blanco y los mismos rayones. El logo nuevo va en el escudo de la Servidor, en la silueta de los rombos y en la página, que también pasa a naranja.
- 🌙 **Se redibuja esta madrugada**: 633 cartas cambiaron sólo de dibujo (382 Servidor y las tres del pool por el escudo) y esperan a la corrida de las 12:22 AM. De día se dibujan 0.
- 🖼️ **Los logos de los servidores, los de hoy, también en las cartas.** Los hashes escritos a mano de **DRA, Snake Rap y TWR daban 404** y sus cartas caían en la silueta blanca sin avisar. Ahora salen de la invitación pública de cada servidor, como en la página.
- 🏷️ **Urban Freestyle con su nombre y su tag** (NUEVA GENERACIÓN), en la página y en el menú del bot (desplegado a las 12:14 PM).
- 🆔 **Reconocimiento de IDs**: Urban Freestyle (429 miembros) entra al cruce. 4 IDs nuevos, exactos, sólo de Urban Freestyle; Snake Rap no dio ninguno nuevo (ya se había cruzado el 24/09). 0 verificaciones, ningún rol tocado. 63 quedan para mirar, sin escribir.
- 👤 **Valen tiene su carta**: se anotó con `/card` en Urban Freestyle, la corrida de las 11:52 lo dio de alta a las 11:53 AM con su apodo de ahí y le subió la Servidor a las 11:57 AM. La Temporada, la Competitiva y la de País esperan a que juegue (Bloqueadas).
- 🔧 `sheet/lista_raperos.py --renombrar` cambia el nombre de una fila sin borrarla (el ID, el país y la verificación se quedan). No se usó: ganó el nombre de Urban Freestyle.

## 📅 Viernes 25/09 (11 a 11:40 AM) — versión 1.07

- 🏙️ **Urban Freestyle conectado**: el bot está adentro (429 miembros), quedó confirmado con su TikTok y el vigía escucha sus 4 canales de eventos (Eventos, RedBull, SMCRN y Data-Eventos). Sus llaves entran solas con el barrido diario.
- 🔴 **Sus canales se llaman «𝙀𝙫𝙚𝙣𝙩𝙤𝙨», en letras decoradas**, y el vigía y el lector de anuncios no los iban a reconocer nunca, sin avisar. Ahora los nombres se normalizan.
- 🔴 **La alerta de las 11:24 AM («el vigía no anda»)** la causó eso mismo: apareció un canal de TFC que el bot no puede leer. Ahora un canal sin acceso no es una falla, y **los tres lectores miran sólo los servidores de la Liga** (DRA, FFA, Snake Rap y Urban Freestyle). En vivo: 14 canales, sin errores.
- 🔴 **`/verificar` le contestaba a todos «ya te anoté»** en vez de decir qué falta: la información del portón no estaba en KV (la última `meta` era de las 6:52 AM, anterior al comando). Escrita a mano a las 11:25 AM; desde ahí dice ✅/❌ para DRA, Miembro y país.
- 🌙 **Madrugada sin sincronización**: de 3 a 11 AM ET no corre el ciclo. El vigía de avisos sigue.
- 👤 **Mi cuenta**: «↻ Actualizar mi cuenta» en vez de «Volvé a entrar con Discord» para una sesión vieja, **Mi perfil** aunque no hayas jugado, y **Cambiar mi foto**.

## 📅 Viernes 25/09 (10:45 AM) — versión 1.06

- 📅 **Fase de prueba y la fecha de la T1**: el Inicio dice «Fase de prueba · la Temporada 1 arranca el 5 de octubre (faltan 10 días)» y el pie, «Fase de prueba». El 5/10 cambia solo a «Temporada 1 en juego».
- 🔢 **El changelog con versiones**, de la 1.01 a la **1.06**. La entrada del 22/09 decía «Arrancó la Temporada 1»: ahora dice «Arrancó la fase de prueba».
- 🎥 **Las miniaturas de YouTube en alta**: eran de 320 px y se estiraban al doble. Ahora 640 en el teléfono y 1280 en la compu.
- 🤝 **Crews y países con la manito y el resaltado celeste** en «Los tres de arriba», el podio, «Los mejores de cada lado» y la ficha de cada tarjeta.
- 📰 **«Novedades de la Liga» lee también los anuncios decorados** del bot (antes sólo el texto).
- ⚠️ Tocar `comun/temporada.py` hace que la próxima corrida **redibuje todas las cartas** una vez (salen iguales; ~50 min de GitHub, gratis).

## 📅 Viernes 25/09 (10 a 10:40 AM) — tu cuenta, `/notify` sin DMs, el podio, el changelog y la llave

- 👤 **Mi cuenta decía «todavía no tenés tarjeta»** con tu carta de Servidor emitida: la página te buscaba en el ranking de la T1, donde no estás porque todavía no jugaste. Ahora dice «todavía no jugaste esta temporada» y **Mis tarjetas** abre la de Servidor y las tres Bloqueadas. Tu sesión guardada es de antes: **salí y volvé a entrar con Discord** para verlas.
- 🔔 **`/notify` sin DMs** (se fueron con 0 anotados): un menú para elegir servidores —o **Todos**— y el botón **Activar** abre la campana con eso elegido. Un toque y listo; si ese dispositivo ya estaba activado, cambia los servidores. El permiso de notificaciones lo da el navegador, así que eso no se puede hacer desde Discord: es lo único que queda del lado de la página. La descripción del comando en Discord se actualiza en hasta una hora.
- 🥇 **El podio con flechas**: Temporada, Competitivo (dice que se desbloquea a los 10 eventos), Duelos, Podios, Rachas, Países (con banderas grandes) y Crews (con logos). Recuerda la última que mirabas.
- 🌎 **Los mejores de cada lado**, abajo del podio: el #1 de cada país (16) y de cada crew (2); por servidor, cuando juegue gente de más de uno.
- 📜 **El changelog**, abajo de Ajustes (en el teléfono, dentro de Ajustes), con un punto rosa cuando hay algo nuevo. Es para jugadores: sin nombres de gente con problemas, ni IDs, ni tokens, ni cuotas, ni spoilers.
- 🏟️ **La llave**: cómo leerla, arriba; cuántos puntos vale cada ronda; el ganador de cada batalla marcado y el que perdió apagado; y con el mouse encima de un nombre se ilumina todo su camino.

## 📅 Viernes 25/09 (9:20 a 9:50 AM) — la revisión: errores, gasto y seguridad

Dlx: *«check other bugs, improvements, optimization stuff you can do»*. Lo que apareció, medido:

- 🧩 **La llave por equipos se salía de su caja** en EL RAP FECHA 5 y DESGRACIAS EN TOKYO VOL.12: cada integrante medía 24 px y el cuadro le reservaba 21. Arreglado (9:22 AM). Y los menús de arriba (Mi cuenta, Ajustes) se cierran al cambiar de página.
- 🔗 **El link de la página pegado en Discord** ahora sale con el logo; antes era sólo texto.
- 🔁 **Un alias encadenado** (gekto → geekto → Presagio) se resolvía distinto según qué parte lo leyera: seis contestaban «geekto», que ya no es nadie. Ahora el mapa se guarda resuelto hasta el nombre final (9:26 AM).
- 🤖 **El bot, los días sin cupo de KV**: el 24/09 a las 7 PM se agotaron las escrituras y el Worker tiró 5 errores («la aplicación no respondió»). Ahora `/numeral` y `/settings` dicen que no pudieron guardar. Y `/numeral` mandaba a usar `/puesto`, **un comando que no existe** (9:30 AM).
- 💾 **KV se pasó de la cuota 3 de los últimos 7 días** (1.063, 1.110 y 1.117 de 1.000). Una corrida sin ningún cambio escribía 6 claves. Tres arreglos (9:41 AM):
  - 🔴 **Krtman y Presagio tenían su `/card` alternando de perfil cada media hora** (krt/krtman y geekto/presagio, el 24/09): un Discord ID repetido dejaba dos entradas que se turnaban. Hoy ya no había repetidos, pero el próximo iba a caer igual. Arreglado.
  - Las marcas del disparador del ciclo van al Durable Object, que tiene cien veces más cupo: **~70 escrituras por día menos**.
  - `meta` ya no se reescribe si la corrida no subió cartas: **~34 por día menos**. Por eso `/owner estado` dice ahora «cartas al día del» y «último disparo», **en hora del este** (antes salía UTC sin decirlo).
- ⏱️ **Una corrida que se corta por tiempo ahora te avisa** (9:43 AM). GitHub la marca «cancelled», no «failure», y la alerta sólo miraba esa palabra. El redibujo entero de hoy tardó 53 min contra un tope de 120.
- 🛡️ **Prueba de inyección**: la página servida con los 1.279 textos terminados en código HTML y recorrida entera. Los nombres, llaves, crews y títulos salen bien; lo único que se ejecutaba era el ícono de las dimensiones en la Guía, que no escribe nadie de afuera. Arreglado igual (9:51 AM).
- 👤 **Tu redirect de Discord está**: lo leí de la configuración de la app (sólo lectura), y es la misma dirección que usa la página. El «URL Generator» de esa pantalla no hace falta.
- ✅ **Revisado y bien**: ningún token vence solo (GitHub, Cloudflare y el bot); el secret `OAUTH_TOKEN` está (su falla del 24/09 fue 22 segundos antes de cargarlo); el Durable Object usa 957 de 100.000 invocaciones; la página sin datos dice «No pude cargar»; al volver de Discord el permiso se borra de la dirección.

## 📅 Viernes 25/09 (8:40 AM) — el Score del rework y entrar con Discord

- ⚖️ **El Score, con los pesos del rework** desde las **8:40 AM**. No le cambió la letra a nadie: todavía nadie tiene 10 eventos. La hoja Config y la Guía ya los muestran, y la Config los lee de `competitivo.py` en vez de tenerlos escritos a mano.
- 🌍 **La Diversidad** ya repartía los puntos por servidor (rework A4). Lo que decía «en cuántos servidores competís» era el texto de la Guía; ahora dice lo que mide.
- 🔔 **A7 con recordatorio**: cuando el primero llegue a **8 eventos** (Hassan va 6), el bot te manda **un** DM para decidirlo antes de que haya letras. Una vez, no cada 6 horas.
- 👤 **Entrar con Discord** en «Mi cuenta» (publicado a las **8:41 AM**). Sólo lee tu nombre y tu foto; el Worker le pregunta a Discord quién sos y tira el permiso. Si estás en la Liga, te lleva a tu perfil; si no, te dice que escribas `/verificar`. **Falta tu paso en el portal** (abajo).

## 📅 Viernes 25/09 (8 AM) — Mi cuenta, `/notify`, la llave por equipos y las crews con página

**Lo que se ve** (publicado a las **8:27 AM**)
- 🏠 **Inicio**: sin «(actual)»; **las dos tarjetas de campeones a la derecha** en cualquier pantalla menos el teléfono (antes bajaban por debajo de 860 px); **«Los tres de arriba»** con el número a la derecha; **paneles con páginas** —Most Wanted | Misiones, tu temporada | lo que viene, La Liga hoy—; **Novedades de la Liga** con flechas; y **En las redes**, dos videos grandes por página.
- 👤 **Mi cuenta**, arriba a la derecha: elegís quién sos y el navegador lo recuerda (sin contraseña, no sale de ahí): tu perfil, tus tarjetas, tu país y tus avisos. ⚙️ **Ajustes**: formato de hora, zona horaria y menos animaciones. **Todas las horas están en tu zona**, y lo dice («hora EDT»).
- 🏆 **Rankings**: la racha como «🔥1/4»; Ligas dice «Temporada 2».
- 🤝 **Crews y países con página** (`#/crew/…`, `#/pais/…`): su puesto, sus números y su gente. Se abren desde Mundo, los rankings y el perfil de cada rapero.
- 📅 **Eventos**: el día ordenado —la hora con su zona, el formato, el rango, el campeón y los botones en una fila—; **los últimos campeones** y **cómo se juega** (formatos y quién organiza); y los avisos por DM en lugar de «Qué se escucha».
- 🏆 **La llave**: arriba, la ficha del evento (formato, rango, cuándo, cuántos, quién organizó, el premio); en el cuadro, **cada integrante de un equipo en su renglón**; abajo, **los puntos agrupados por puesto**.
- 📖 **Guía**: Histórica y Prime, «llegan con la Temporada 2».

**En Discord** (desplegado a las **8:00 AM**; los comandos nuevos tardan hasta una hora en aparecerle a todos)
- 🔔 **`/notify`**: un panel para elegir de qué servidores querés el aviso de cada evento **por DM**. Adentro de un servidor, el primer botón activa ése. El primer DM es la confirmación, y si Discord no deja escribirte (DMs cerrados) no te anota y te dice cómo abrirlos. Los DMs salen de la misma cola que los avisos de la página.
- 🌐 **`/website`**: el link a la página.

**Por dentro**
- 🔴 **Volk y volk tenían la misma clave**: el segundo abría el perfil del primero y heredaba sus tarjetas. Ahora son `volk-mx` y `volk-co`.
- Si una sección de la página falla, las demás siguen.

## 📅 Viernes 25/09 (7 AM) — los rankings, los campeones y `/verificar`

**Lo que se ve** (publicado antes de las **7:30 AM**)
- 🏆 **Los rankings**: Temporada, Competitivo, Duelos, Podios, Rachas, Países y Crews, más **Most Wanted, Misiones y Ligas** como «pronto». **Todas las columnas se ordenan**, de mayor a menor o al revés. Temporada suma las del ranking oficial: **racha** («🔥2 máx 4»), **último evento** (cómo le fue y cuándo), **cazó, cazado, sobrevivió** y **misiones** (en — hasta que arranquen). Sin «Camino al competitivo».
- 👑 **Los dos campeones** arriba: el de la temporada con **(actual)** y el del **competitivo**, que hoy dice **vacante**: se define a los 10 eventos y el más cerca es Hassan, con 6.
- 📰 **Lo último de la Liga**, abajo de «La Liga hoy», **con flechas**: los anuncios de DRA y los videos de YouTube de Under Legends, FFA y Snake Rap. Instagram y TikTok no dejan leer sus publicaciones sin una app aprobada: de esas van los links.
- 🗓️ **Lo que pasó**: el logo del servidor, el **rango del evento** en su servidor («Bronce III»), «hace 1 día» grande y los botones del color del servidor.
- 🔝 **Los cinco de arriba**: diez cajas, **Rachas** en vez de Países, **Ascenso** y **Ligas** próximamente, y el nombre entero siempre.
- 📅 **Eventos**: arriba el próximo evento con cuenta atrás (o el último campeón), los números de la semana y **«Sumar a Google Calendar»** / Apple · Outlook: el calendario de la Liga se actualiza solo en tu calendario. Los eventos por jugarse tienen «Agregar a Google» de a uno.
- 🌍 **Mundo**: miembros exactos (1.676 · 7.334 · 2.720) y **las nueve crews con gente en la T1**, con logo y su gente; el puesto sigue pidiendo 3 raperos.
- 🎟️ **Pase de rapero**: su lugar en el menú, «próximamente».
- 📖 **Guía**: cuántos puntos da cada puesto (de `Config`: el campeón de una llave de 16 o más se lleva 10.000), de qué está hecho el OVR y el Score, **15 palabras** explicadas y **7 preguntas frecuentes**.
- 🃏 **Comparar**: primero la tarjeta (Temporada, Competitiva, País, Servidor) y después a quiénes.

**`/verificar`** (Worker desplegado y comando registrado a las **7:35 AM**; tarda hasta una hora en aparecerle a todos)
- La persona lo escribe y el bot mira **en ese momento**, en DRA, las tres cosas del portón: estar en el servidor, el **Miembro** y un **país**. Dice cuál falta, con el botón que lo arregla, y a qué hora arranca la próxima vuelta.
- **No da el rol**: lo sigue dando el ciclo cada media hora (`bot/autoverificar.py`), con sus topes y su lista de a quién no. Si también lo diera el Worker, las reglas de quién entra vivirían en dos lugares. Y la tarjeta igual sale recién con la vuelta que carga a la persona.

**Por dentro**
- ↩️ **6:43 AM**: la racha volvió a mirar sólo los eventos jugados, antes del ciclo de las 6:52.
- 🧱 Si una sección de la página falla, **ya no apaga las demás**.

## 📅 Viernes 25/09 (6 AM) — el perfil, las caras y el iPhone

**Lo que se ve** (publicado a las **6:15 AM**)
- 👤 **El perfil de cada rapero**: tocás un nombre en cualquier lado —o lo buscás en el Inicio— y abre su página: sus tarjetas con descarga, sus números, **lo que le falta para cada tarjeta** condición por condición (Hassan: 6 de 10 eventos para la Competitiva), su puesto en cada ranking, sus eventos con «Ver llave» y sus duelos con quién ganó.
- 🙂 **Las caras**: un círculo con el avatar de Discord y la bandera a la derecha del nombre, en el ranking, el top 5, los duelos, el medallero, «Lo que pasó» y la llave. **47 de los 50** con Discord ID tienen cara; el resto, la inicial.
- 🏠 **Inicio**: «Lo que pasó» con los **3 últimos**, quién organizó y quién ganó · **«La Liga hoy»**: el mapa a la mitad y **la actividad** al lado (7 eventos esta semana, 143 participaciones, 86 raperos, y las barras de 14 días) · **«Novedades de la Liga»**: los 3 últimos de 〢🌍〉rankings-liga-global y las redes de la Liga · el top 5 suma **Most Wanted y Misiones** (próximamente) · **14 récords** (antes 6).
- 🛡️ **Mundo**: cada servidor con su etiqueta —**COMUNIDAD, TALENTOS, ENTRENAMIENTO**—, sus redes y un **«Entrar al servidor»** grande de su color.
- 🏆 **La llave**: el logo del servidor, quién organizó y el podio arriba del cuadro.
- 🔔 El botón «Avisame» del Inicio **se va para quien ya activó** los avisos, y tiene una ✕.
- **DRA no aparece en Eventos porque no anunció nada desde que arrancó la T1**: sus 8 canales de eventos no tienen un mensaje desde el 22/09 (el último, el 06/09). Cuando anuncie, sale solo.

**Los avisos en el iPhone** (Dlx: *«no me llegó nada a mi iPhone, a menos que haya clickeado ese botón que dice prueba»*)
- 🔴 **Apple rechazaba todo aviso de evento**: `400 {"reason":"BadWebPushTopic"}`, por un encabezado que Google acepta. «Mandar una de prueba» no lo lleva, y por eso eso sí llegaba. **Ningún aviso de evento le había llegado nunca a un iPhone.** Arreglado a las **6:07 AM**; medido a las 6:10 con un simulacro: **4 de 4** entregados (antes 2 de 4).
- Tus pruebas con «probando» no le llegaban a nadie porque ningún dispositivo tenía **🧪 Pruebas** marcado. Ahora el bot **te contesta por DM** a cuántos dispositivos la mandó.

## 📅 Viernes 25/09 (5 AM) — el rediseño del hub

**Lo que se ve** (publicado a las **5:15 AM**, [underlegends.pages.dev](https://underlegends.pages.dev))
- 🏆 **La llave es un cuadro de torneo**, como el de tu imagen: la final en el medio, una mitad de cada lado, el **campeón en dorado** y su camino marcado desde la primera ronda, y el tercer puesto debajo de la final. Las batallas de 3 y 4 bandas son cajas más altas. En el teléfono va de un solo lado y se desliza. Abajo, los puntos de cada uno en dos columnas.
- 📅 **Sección «Eventos»** (reemplaza «Avisos» en el menú): el mes en calendario, cada evento con el **color de su servidor**; jugado, anunciado sin llave o por jugarse se distinguen. Tocás un día y ves sus eventos con «Ver llave» y el link a Discord. La campana de avisos vive abajo, en la misma sección (el botón de `/card` sigue llevando ahí).
- 🗺️ **Inicio con mapa**: los países con raperos en la temporada pintados, y **75 %: 15 de los 20 países de habla hispana**. Abajo, los que todavía no (Cuba, Guatemala, Nicaragua, Paraguay y Puerto Rico).
- 🏅 **«Los cinco de arriba» son seis rankings**: Temporada, Competitivo, Duelos, Podios, Países y Crews. El Competitivo dice que se desbloquea a los 10 eventos y quién está más cerca.
- **Todo más grande**: letra de base, títulos, cifras, tablas, galería y tarjetas; más contraste en los textos grises (el más oscuro daba 2,5:1). Inicio y Mundo usan dos columnas donde antes había una fila larga con aire.
- **Mundo**: las crews arriba de los países, y el **logo de cada servidor sale de Discord** —el que tiene puesto hoy— en cada corrida.
- **«7 eventos» y no «134»**: la cifra del Inicio sumaba participaciones.
- El color de FFA es casi negro (#26045B): en la página se usa el mismo violeta con más luz, para que se vea.

## 📅 Viernes 25/09 (3 a 5 AM)

**Lo que se ve**
- 🌙 **De madrugada el ciclo descansa** (3:40 AM): entre las 3 y las 11 AM ET corre a las **6:52 y 10:52** y no dieciséis veces. El vigía de avisos sigue cada minuto: un evento que se anuncie a esa hora igual suena.
- 🐉 **El logo de UL en las notificaciones** (4:29 AM): el dragón sale como ícono del aviso y, en Android, como la silueta blanca de la barra. Sobre un círculo oscuro, porque el blanco solo desaparece en el fondo claro de Windows.
- 🧪 **Tu «Probando» ya suena**: si escribís un mensaje que empiece con *prueba* o *probando* en un canal de anuncios, te llega a vos solo —y sólo si en la campana elegiste «🧪 Pruebas»—. Lo que no tiene forma de anuncio no le suena a nadie más.
- **«Lo que viene»** trae el link al anuncio y lo que dice (cupos, modalidad); un anuncio sin hora que se pueda leer aparece igual, con «anunciado hace X». **«Lo que pasó»** se ordena por la hora de arranque.

**La revisión de errores** (Dlx: *«chequea por suposiciones de errores que puedan haber»*) — 22 encontrados, 21 arreglados (el que queda, en «Pendiente mío»)
- 🔴 **Las fechas de las llaves estaban en UTC.** Un evento de las 10:25 PM del 23/09 figuraba del 24/09. Dos de los siete de la T1 tenían el día corrido (CARABOBO y TOKYO VOL.10). Se corrigieron en las tres hojas (**50 celdas**, a las 4:41 AM) antes de cambiar el código, porque la fecha es parte de la identidad del evento: cambiarla sin más los habría **duplicado**. Verificado: los siete siguen con su número.
- 🔴 **La racha leía los eventos del mismo día en orden alfabético.** El 23/09 FFA jugó cuatro, y la racha los leía TöKĪØ antes que TOKYO VOL.12, que fue una hora antes. Ahora manda **la hora en que se publicó cada llave** (el ID del mensaje de Discord la trae). Cambia en **3 de 85**: Hassan pasa de una racha máxima de 3 a una de 4. Los eventos nuevos se numeran en el orden en que se jugaron.
- 🔴 **Autoverificar**: el tope de 5 por corrida se cortaba *antes* de mirar quién tiene país, así que cinco sin país ocupaban los cinco lugares siempre. Y la bandera del **apodo** —que `/card` promete— no se leía.
- 🔴 **Un anuncio que se arma en dos pasos no sonaba nunca**: imagen primero y el horario editado después. Ahora, si se edita después de que el vigía lo descartó, se vuelve a leer (lo ya avisado no suena dos veces).
- **«Rachas» del hub** muestra la que cada uno **lleva ahora**; la más larga sigue en Récords. Antes mostraba la máxima con el título de «vienen encadenando».
- **Personas**: dos alias del mismo rapero se pisaban al fusionar; el nombre con banderas o letras raras se compara como el resto; la cola de `/card` pasa a «se anotó él» si después se anota solo.
- **✅ Decidir**: la pregunta de una llave «(sin titulo)» podía llevar al mensaje de **otra** llave sin título. Ahora el link va por servidor y, ante la duda, no va.
- **El guardado del ciclo** no veía un archivo que creaba por primera vez (`git diff` no lo mira): lo perdía en cada corrida.

## 📅 Viernes 25/09 (madrugada)

**Tus respuestas, aplicadas** (1:22 a 2:22 AM)
- ✅ **El hub**: banderas como imagen, los **tres servidores confirmados** con nombre completo, logo y miembros, y la **descripción oficial** (nunca más «la liga de freestyle de Under Legends»).
- ✅ **Personas** (#1 a #5 y #12): **9 filas dobles fusionadas** guardando sus AKAs, CJ con su ID, Solar con fila propia (no es ELSOLAR), SEBITA es AKA de Liberia, money maker es troll.
- ✅ **La racha es la tuya** (1:35 AM): eventos seguidos llegando a semifinal, o a la final si la llave es de 8. La tarjeta y el Inicio salen del mismo número.
- ✅ **Alertas** (1:39 AM): si algo se traba te llega un DM a vos solo; lo normal va al canal de Logs.
- ✅ **Carta de País** (1:42 AM): el Score Selección sale de la T1 (los 5 mejores de cada país).
- ✅ **«Ver llave» en «Lo que pasó»** (2:01 AM): el botón abre la llave del evento —podio, las rondas de la primera a la final con el ganador en verde, los puntos y el link a Discord—; tocar un nombre abre su tarjeta. Las batallas de 3 y 4 bandas se ven como una sola. El anuncio y la llave se juntan por servidor, fecha y nombre: «CARABOBO **NUNCA** SE RINDE» (anuncio) es «CARABOBO **NO** SE RINDE» (llave), y «TOKYO VOL 11» **no** se confunde con la VOL 12.
- ✅ **El país y el Miembro de DRA, solos** (#8 y #9, en cada corrida): quien tiene ID y no tiene país recibe el de sus roles; quien está en DRA con ID y país recibe el Miembro. **12 personas ya tenían el Miembro y no tenían carta sólo por no tener país.** A las **2:52 AM** se pusieron **15 países** —de los roles de Snake Rap y LIVONIA— y **7 de esos 12 pasan el portón** desde esa corrida: Meidei, Chilau, Nevon, Pwpwo, Kravitz, Nitt y Saturb. El portón pasó a **331**.
  - 🔴 **La corrida de las 2:22 los encontró y no escribió ninguno**, sin decir por qué: la hoja pone **«❓»** donde no hay país, y lo tomé por un país que ya estaba. Y la prueba en seco no lo mostró porque contaba lo que quería escribir, no lo que pasaba la guarda. Arreglado a las 2:27: «❓» cuenta como vacío y la prueba cuenta lo mismo que la corrida.
- ✅ **Quien usa `/card` y no está, entra solo** (#11): si se anotó él mismo y Discord sabe su país. Lo dudoso sigue yendo a Pendientes. `/card` ya no le promete «un admin te va a cargar» a quien entra solo.

**La revisión de todo** (Dlx: *«verifica que todo esté bien»*, 12:20 AM)
- ✅ **El ciclo**: todas las corridas desde las 8:22 PM terminaron bien, cada media hora. A las 9:52 PM redesplegó el hub solo, con la campana.
- ✅ **El Worker, `/card`, el vigía de avisos** (14 canales, sin errores, late cada minuto), **la web** (datos de la última corrida) y **CI**, en verde.
- 🔴 **Las Bloqueadas salían sin foto.** Estaba decidido que llevan tu foto apagada detrás del velo —«sos vos, pero todavía no es tu carta»— y el generador nunca se la pasaba: la de Hassan tenía una «H». Arreglado: las **1.214** de quien tiene foto se redibujaron con su cara y están publicadas desde las **12:35 AM**.
- 🔴 **La auditoría de los lunes iba a dar rojo sobre un Worker correcto** (ahora son dos archivos y el chequeo leía uno), y marcaba **97 «cartas clonadas»** que eran gente que no pasa el portón. Arreglado: la auditoría completa da **TODO BIEN**.
- 🔴 **Un nombre llegaba roto al Sheet** —«Kingđź‡¦đź‡·» en vez de «King🇦🇷»— y es el **mismo origen de los textos raros** que viste en ✅ Decidir: se leía lo que manda el bot adivinando la codificación. Arreglado en la fuente y en lo que ya estaba escrito.
- **Chromium se bajaba en cada corrida aunque no hubiera nada que dibujar.** Ahora sólo cuando hay algo: una corrida quieta pasó de **168 s a 115 s** (medido a las 12:47 AM).
- Nada roto: el «0 inscripciones» de cada corrida es porque FFA y Snake Rap **vacían** sus canales de inscripciones después de cada evento.

---

## 📅 Jueves 24/09

**Lo que se ve**
- 🔔 **Avisos de eventos en el hub** (9:30 PM): en [underlegends.pages.dev/#/avisos](https://underlegends.pages.dev/#/avisos) cualquiera toca *Activar avisos* y le llega una notificación al teléfono o a la compu **cuando un servidor anuncia un evento**, aunque no tenga Discord abierto. Elige de qué servidores. Debajo de cada carta de `/card` hay un botón 🔔 **Avisos** que lleva ahí.
  - **Al minuto y no «30 min antes»**, porque se midió: de 26 eventos con hora, **18 se anunciaron con 15 min o menos** de aviso. El Worker revisa **14 canales** de DRA, FFA y Snake Rap cada minuto; no depende del ciclo ni de GitHub.
  - Probado de punta a punta con el servicio de push de Mozilla: llega en **0,7 s** y se descifra. Si un evento se anuncia con más de una hora (Snake Rap), además va un recordatorio 30 min antes.
- **Snake Rap entró** (~4:40 PM ET) y el ciclo lo encontró solo: lee su canal `［🔑］llaves` y **sus eventos salen en el hub**. Se sacaron **23 IDs** de ahí (27 en total), con el país como segunda señal: atajó 9 que eran otra persona.
- **Autoverificar** funcionando: **Skratch 🇨🇱 verificado** en DRA (7:24 PM). De los 540 del padrón con ID: 337 ya verificados, **202 no están en DRA** (no se pueden verificar hasta que entren).
- **«El ultra knowledge instintivo» fuera del ranking** (visible en el hub desde las 8:02 PM). Hassan conserva su duelo ganado.
- **✅ Decidir** (hoja del Operativo): preguntas en palabras, la respuesta se aplica sola. Después de que Dlx la usó: columna **📝 NOTA** que se conserva, la misma persona escrita distinto es **una** pregunta, los pedazos de equipo se cierran solos, textos raros arreglados, conflictos del sync con links a los perfiles.

**Lo que se corrigió (y no se veía)**
- **Podios, Duelos y Mundial** no se recalcularon de 2:22 a 3:52 PM (cuota de Google). Arreglado desde las 4:52 PM.
- El ciclo **redibujaba las mismas 186 Bloqueadas** y **re-desplegaba el hub** en cada corrida; `dibujar` repetía todo lo de `escuchar`. Arreglado.
- La verificación por el rol de Snake Rap (5:09 PM) **fue un error mío** y se sacó a las 7:03 PM: **104 personas** tuvieron `/card` unas horas. Desde las 7:52 PM, quien pierde el portón sale del bot en la corrida siguiente.
- La **cuota de KV se agotó** (1.117 de 1.000, ~7:50 PM) y el hub se congeló hasta las 8:00 PM. Ahora cada corrida tiene presupuesto y deja reserva para la web.
- **Chequeos automáticos**: en cada push de código corren 20 self-checks en GitHub.
- **Horas en ET** en los commits del ciclo, `decisiones.json`, los avisos de cuota y (desde las 9:35 PM) el pie de `/lobby` del Worker.

---

## 🔑 La revisión de permisos de Discord (plazo: 24/12/2026)

Discord avisó el 25/09 que LIGA GLOBAL pasó los 10.000 usuarios, y desde ahí
los permisos privilegiados necesitan revisión. **Si no se envía antes del
24/12, se quitan**, y sin ellos el bot deja de leer las llaves, los anuncios y
las inscripciones (texto de los mensajes) y de ver quién tiene el Miembro
(miembros). Hasta esa fecha todo sigue andando igual.

**Qué hay hecho:** la [política de privacidad](https://underlegends.pages.dev/privacidad)
y los [términos](https://underlegends.pages.dev/terminos), en español y en
inglés, y `/borrar-mis-datos`.

**Qué hace Dlx, cuando quiera:**
1. *General Information*: Privacy Policy URL `https://underlegends.pages.dev/privacidad` y
   Terms of Service URL `https://underlegends.pages.dev/terminos`.
2. *Bot*: apagar «Public Bot» y «Presence Intent» (no lo usa nada).
3. El formulario: marcar **Server Members** y **Message Content** (Presence no). Las
   respuestas están en el chat del 27/09 y en `docs/revision_discord.md`; faltan
   los links a capturas que pide para cada permiso.

## ❓ Esperando a Dlx

- ✅ ~~**Lo de la cuenta, ¿también para los que no se verificaron?**~~
  *«A»* (29/09, 5:55 PM): la foto (`/foto`), Mis redes, seguir y los avisos
  personales siguen **sólo para verificados**. Ya estaba así: no se tocó
  nada.
- ✅ ~~**El mapa, más interactivo**~~ *«1. C»* (8:29 AM): hecho, arriba.
- **El remake**: te aviso antes de arrancar y lo planeamos juntos (*«me
  avisas para antes planearlo»*).
- ✅ ~~**El sync y la cuota de Sheets**~~ *«A»* (8:06 AM): hecho, arriba.
- ✅ ~~**Para el remake: ¿sin framework o React?**~~ **React** (29/09, 7:20 AM): *«el
  estilo de la liga es la razón principal… usaremos react o framework»*.
- ✅ ~~**Para el remake: ¿«copero» es otra página?**~~ Es **copero.com.ar**: fútbol argentino (resultados, prodes, minijuegos) y un juego de navegador de carrera de futbolista con valoraciones estilo FIFA («99»). Lo que hace que se confunda: fondo casi negro, títulos blancos en una sans geométrica, tarjetas redondeadas con arte degradado, botones blancos tipo píldora con flecha y números de valoración grandes. Y **copero.org**, la página del juego: verde oscuro, crema y lima, títulos altos en mayúsculas (Bebas Neue), etiquetas chicas espaciadas, banderas con código de país, pastilla «LIVE» y una carta final para compartir — el mismo vocabulario que ya usa nuestra página. Eso es lo que el remake evita.
- ✅ ~~**¿La llamada también resuelve sola?**~~ *«1. A»*: hecho, sólo alias y
  sólo con el nombre exacto de una persona de la Lista.
- ✅ ~~**Los commits viejos en GitHub**~~ *«2. B»*: no se pide nada.
- ✅ ~~**El historial limpio no sube**~~: subió a las 5:43 AM, con HTTP/1.1.
- **Y para mirar juntos después**: 5 con cuenta nueva probable (el ID que
  tenían ya no existe): Incognito, DUI, JUANK, Ambidextro (JANDER) y Camila,
  que juega la T1.
- ✅ ~~**Las ocho del reconocimiento**~~ (29/09, 4 AM): *«1. A. 2. Sí pero
  fíjate muy bien… 3. ninguno… 4. A y haz el back up… 5. A 6. A 7. A 8. No lo
  sé»*. Hechas (1.51), salvo la llamada (en construcción) y subir el historial
  (arriba). Medido ese día: 341 pasan el portón, 190 con ID fuera de DRA, 44
  con un ID que ya no existe; 64 de la T1 sin ID.
- ✅ ~~**NAVE DE FUNA / CYPHER**~~: tres ejemplos (29/09), hecha en la 1.50.
- ✅ ~~**ME TIENE SIN CUIDADO**~~ *«A»* y ~~**TEAM VENECIA**~~ *«no lo sé»*:
  hechos (1.50).
- ✅ ~~**FFS, «Gestionar servidor»**~~: *«A, ya se lo dije»*. Cuando lo dé, el
  ciclo empieza a contar solo.
- ✅ ~~**FFS**~~: color A, etiqueta EVOLUCIÓN, eventos A, ligas A, camiseta
  «está bueno» (1.48); su invitación y sus redes, en la 1.49.
- ✅ ~~**Llaves de broma**~~ *«A»* y ~~**el podio con mención**~~ *«A»*: hechas
  (1.48).
- ✅ ~~**La primera semana de la T1 sin Elegido votado**~~: *«1, B»*, así está
  bien.
- ✅ ~~**RAP EXHIBITION 1/8 con nombres de personaje**~~: *«2. correcto»*.
- ✅ ~~**¿Se jugó ISLA DE SOCOTRA V.2?**~~ *«A»* (28/09, 10:35 PM) y después
  *«you can delete it bc its a fake event that never got released»*:
  **borrado** (1.47).

- ✅ ~~«Miembros oficiales»: ¿esconder a los 96?~~ Resuelto a las 9:30 AM con
  **«fuera de concurso»** (arriba, en las reglas): nadie desaparece, el número
  es de los miembros. Medido ese día: 57 miembros, 19 verificados fuera de DRA,
  76 sin Discord vinculado, 1 sin país.
- ✅ ~~¿Los puntos del Most Wanted suman ya a la Temporada?~~ *«1. sí»*: hecho
  en la 1.23.
- ✅ ~~El bonus por llave limpia~~: afuera (*«la 2»*).
- ✅ ~~El Semillero: ¿quién es «gente nueva»?~~ *«A»*: hecho en la 1.27.
- ✅ ~~El canal del Lunes de la Liga~~ y ~~«con tiempo»~~: contestadas (1.30).
- ✅ ~~Las encuestas: ¿quién vota y se vota al propio servidor?~~ *«1. A. 2.
  A»*: hechas en la 1.31.
- ✅ ~~Las cuentas de Discord de menos de 30 días no votan~~: *«Listo»* (27/09).
  Vale también para poner un precio por cabeza.
- ✅ ~~¿El Most Wanted también paga Puntos de Tienda?~~ *«b»*: el 10 %, hecho
  en la 1.34. (La pregunta se entendió a la tercera, con el ejemplo del Rey.)
- ✅ ~~¿Qué va en Publicaciones?~~ *«sí un muro automático, pero anuncios de
  todos los servidores también»*: hecho en la 1.33.
- ✅ **«Es alguien nuevo» con cuenta de Discord: A** (Dlx, 28/09, 5 PM, después
  de *«tú que tienes acceso a los 5 servidores puedes buscar los nombres de
  los MCs»*). Los nombres con UNA cuenta en los servidores se resuelven
  solos: si la cuenta ya está en la Lista, alias; si no, entra a la Lista con
  esa cuenta y la bandera de la llave (los nombres cortos, sólo si la cuenta
  está en el servidor del evento). Ese día eran 4 alias y 25 nuevos. Y
  **Richard contra Number (MARRUECOS): ganó Number** (*«3. A»*). Lo que sigue
  es cómo estaba planteada.
- ~~**«Es alguien nuevo» con cuenta de Discord**~~ (28/09): cuando la pista de
  ✅ Decidir muestra que el nombre es una cuenta de Discord que no está en la
  Lista, ¿al contestar «Es alguien nuevo» lo agrego a la Lista con esa
  cuenta? Así, con bandera y el Miembro de DRA, le salen las cartas solo.
  **A** · sí · **B** · no, que sólo quede anotado (como hoy). Toca el portón,
  por eso se pregunta.
- ✅ ~~**¿Un MULTIVERSE se carga solo o se retiene para que lo mires?**~~
  **Se carga solo** (Dlx, 4:40 PM: *«es simplemente entender las llaves»*;
  ver las reglas). Lo que sigue es cómo estaba planteada.
  (28/09). Tu guía (§3.8) dice que es «el formato donde más se rompe todo» y
  que los de Fontana y TFC piden revisión humana —«Marcá y preguntá»—. Hoy
  el lector no tiene una regla para eso (sí para los Interserver). Hoy a la
  1:54 PM FFA juega **DESGRACIAS EN TOKYO VOL 15 MULTIVERSE**, con lados de
  1, 2, 3 y 4 personas y un pase libre. **Lo probé** con su llave de las
  2 PM completada a mano: se leen las 14 batallas sin una duda, los equipos
  se reparten el puesto y no cuentan como duelo. **Y encontré un error, ya
  arreglado**: el trío inscripto (Bootrax Humilde + Trot + Tokio) «corregía»
  al equipo de cuatro que peleó, y **Tuca se quedaba sin sus puntos**. Con
  eso, mi voto es la **A**. **A** · que cargue solo (y si algo no se lee, ✅
  Decidir pregunta la batalla) · **B** · que se retenga entero hasta que
  digas «Sí cuenta».
  **Terminó a las 3:55 PM** (campeón PRAISERIZA, subcampeón Panchok) y lo
  pasé por el lector y el motor antes de que lo cargue el ciclo: 15 batallas
  sin una duda, 24 participantes (escala 16+) y los equipos reparten bien
  —Bloody y Saz 2.625 cada uno, el equipo de Snow 1.312 cada uno, Bootrax,
  Trot y Tuca 416 cada uno—. Como no hay regla, **entra solo en la corrida
  de las 4:22 PM**; si preferís la B, decímelo y lo saco (queda anotado en
  `datos/decisiones.json` como que no cuenta, y el ciclo lo retira solo).
- ✅ **«Tu servidor»: 1A, 2A, 3B y C** (28/09, 8 PM). Hecho en la 1.45: en
  Mi cuenta, uno por temporada como la foto, y en el ×2 se vota a cualquiera.
  Lo que sigue es cómo estaba planteada.
- ~~**«Tu servidor» lo elige cada uno**~~ (28/09, *«la idea es que la gente
  decida por su cuenta»*). Hoy «tu servidor» es donde más jugaste, y sirve
  para una sola cosa: **en el ×2 votado no podés votar al tuyo**. Tres
  preguntas antes de hacerlo:
  1. **¿Dónde se elige?** **A** · en Mi cuenta de la página (con Discord) ·
     **B** · también con un comando en Discord.
  2. **¿Cada cuánto se puede cambiar?** **A** · una vez por temporada, como la
     foto · **B** · cuando quieras.
  3. **Si cada uno elige, alguien de FFA puede elegir otro servidor para
     votar a FFA en el ×2.** **A** · se acepta: el ×2 excluye el que elegiste
     y listo · **B** · el ×2 deja de excluir: cualquiera vota a cualquiera ·
     **C** · se elige una sola vez por temporada y eso lo frena.
  Mi voto: **1A, 2A, 3C**. La carta de Servidor **no cambia**: mide los datos
  de ese servidor, y elegir uno donde no jugaste la dejaría en cero.
- ✅ ~~**Tres ideas** (28/09)~~: *«B y C»* — los debutantes en el Lunes de la
  Liga y el DM a vos por lo que espera más de 24 h, hechos (1.44). El
  probador de llaves en la web queda para cuando quieras.
- **Las reglas de Misiones y las Tareas del Pase**: qué cuenta, cuánto da y
  qué se gana (Most Wanted ya corre: ver 1.22). Y para las Tareas, **cómo se
  hacen los entrenamientos de DRA** (dónde se anuncian y dónde queda quién
  fue), porque de ahí salen.
- ✅ ~~¿El tono miel te gusta para Urban Freestyle?~~ *«Está bien»*.
- ✅ **Seguidores y seguidos: hechos** (1.44, *«sí, hay que hacer eso»*, 28/09)
  tal como estaba planteado abajo. **Los POSTS de la gente siguen sin
  hacerse**: el muro es automático.
- ~~**Seguidores, seguidos y POSTS**~~ (27/09, para discutir). Mi opinión: primero
  el **muro automático** —«🏆 X ganó…», «subió a rango B», «desbloqueó su
  tarjeta»—, que sale de datos que ya calcula el ciclo y no le pide nada a
  nadie; contado **por la Liga**, no en primera persona «en nombre de» alguien,
  y cada uno puede ocultarlo. En DRA, sólo los campeones, editando en vez de
  mandar otro. **Seguir ya existe** («☆ Seguir», 1.09), pero queda **sólo en
  tu navegador**: nadie sabe que lo seguís. Para tener **seguidores** hay que
  guardarlo del lado del servidor, y alcanza con lo que ya hay: «Entrar con
  Discord» (Mi cuenta) da un token que el Worker verifica, sin ningún secreto
  nuevo. Se guardaría en el Durable Object y no en KV (KV tiene 1.000
  escrituras por día). El aviso de «alguien que seguís ganó», por la campana,
  nunca por DM. *(Esto lo dije mal en el chat del 27/09: dije que la página no
  tenía login.)*

1. ✅ ~~Los 16 respaldos completos del Sheet en el repo público~~: **salieron del árbol el 25/09** (siguen en esta máquina y en el repo privado) y `.gitignore` no los deja volver. El historial **no** se reescribió, a propósito: es irreversible y los mismos IDs siguen públicos en `datos/padron.json`, que el ciclo necesita. Si querés reescribirlo igual, decime.
2. ✅ ~~¿Una imagen grande en la vista previa del link?~~ *«Siii»*: hecha con el diseño de la página (1.44).

### La página vieja del Apps Script, comparada (25/09, 5:30 AM)

«Mi Perfil» tenía buscador, perfil por rapero con más de 50 números, Top 3 del Competitivo, cuántos hay en cada rango, Most Wanted, redes sociales, modo VS y 8 pestañas de rankings.

| | |
|---|---|
| **Falta** | el perfil de cada rapero · buscador en el Inicio · Most Wanted · redes sociales · el Competitivo como pestaña del Ranking |
| **Ya está** | el VS (Comparar dos) · la escalera de rangos con cuántos hay · Temporada, Podios, Duelos, Países y Crews |
| **Mejor que antes** | las tarjetas de verdad · datos solos cada media hora · llaves en cuadro, calendario y mapa · avisos · hecha para el teléfono |

**Los avisos en la PC** (Dlx: *«¿arreglaste para que pueda tener las notificaciones en PC también?»*): del lado del servidor no había nada roto para la PC —el aviso sale igual para todos— y anoche no hubo nada que avisar (en los 10 canales, desde el 24/09 al mediodía, sólo está su «Probando…»). El sospechoso es **Opera GX**, que deja activar los avisos y en la compu a veces no los recibe. La campana lo distingue sola: «Mandar una de prueba» espera 20 s y dice si llegó (entonces es Windows) o no (entonces es el navegador: Chrome o Edge en esa compu).

## 🔧 Pendiente mío

- **El payload del lobby está al borde de su techo** (28/09, 6 PM): 116 KB
  compacto contra 117 (`subir_web --auto` lo marca en rojo; CI no lo corre
  porque pide el token). No es un error: crece con cada persona nueva —la
  tabla son 63 KB para 179— y hoy entraron 16. Viaja comprimido (~20 KB),
  así que no apura; lo que hay que decidir es qué columnas de la tabla
  pasan a `/api/perfiles`, que se pide sólo al abrir un perfil.
- **Seguir raperos, de punta a punta con un teléfono de verdad**: todo lo
  que se puede probar sin una cuenta está probado (el objeto contra SQLite,
  las rutas, la página en local y el Worker en vivo). Falta que alguien
  siga a otro desde la página, con la campana vinculada, y le llegue el
  aviso cuando esa persona gane.

- **Mirar la corrida de las 11:22 AM del 27/09**: tiene que entrar AGREEMENT
  DOOMSDAY V.1 (#364 si no entra otro antes), con FULLY + SNOW campeones;
  Makmah tiene que pasar a #1 en su Competitiva, y KENNY sumarse a Kenny.
- **La primera llave en vivo de verdad**: SNAKE ARENA VOL. 2, hoy a las 5 PM
  ET. Mirar que el vigía la guarde, que la página la lea igual que Python y
  que se esconda cuando el ciclo la procese.
- **Los links de Discord en la app**: probarlo en un Android de verdad.
- **Una llave EN VIVO escrita con menciones se ve con `<@123…>`** en la
  página (28/09): el lector de la página no tiene los nombres de cada cuenta,
  y el vigía no los manda. Sólo pasa con el organizador que escribe así
  (MARRUECOS); cuando la llave se procesa, sale con nombres. Va con el remake
  de la web: el vigía tendría que mandar el nombre de cada mención, como ya
  hace Python.
- **11 eventos se llaman «__ … __» en el Operativo** (el subrayado de Discord
  en el título). En la página salen limpios; en el Sheet no. Limpiarlos pide
  migrar `Eventos Procesados`, `Resultados` y `1v1` a la vez, porque el nombre
  es la identidad del evento: va con el pendiente de anclar el evento al
  mensaje de Discord (más abajo).

- **Las dudas que quedan en las llaves viejas de Urban Freestyle** (21 de 46
  llaves): casi todas son llaves a medio llenar —la final vacía, o el campeón
  de una plantilla anterior—, que es lo que Pendientes tiene que ver.
- **Dos llaves con el mismo nombre el mismo día son un evento**: la identidad
  sigue siendo `(nombre, servidor, fecha)`. Urban Freestyle tiene tres pares
  así en sus llaves viejas («compe chill» dos veces el 08/09). Es el
  pendiente de anclar el evento al mensaje de Discord (más abajo).
- ✅ ~~**3 duelos distintos entre carta y perfil** (Sin Límites, Focox, KC)~~:
  no se iban a corregir solos. El pool arrancaba los duelos de **su propio
  JSON anterior** y la hoja `1v1` sólo pisaba a quien tiene duelos ahí, así
  que un duelo que dejó de serlo quedaba para siempre. Arreglado el 28/09
  (2:40 PM): con la hoja con datos, manda entera. Medido: cambian esos tres
  y nada más.
- ✅ ~~**El sello no ve lo que depende de otros**: el OVR Nacional, el puesto en
  el rango y en la crew~~: los tres entran al sello desde el 28/09 (2:15 PM),
  y también **quién está en cada crew** (`datos/crews.json` no estaba en
  ninguna huella). Ver la 1.40.

- **Los IDs por nombre siguen a mano** (`herramientas/cruzar_miembros.py`): el ciclo sólo toma el ID que llega firmado por `/card`. Emparejar un nombre con una cuenta es el paso que ya costó dos veces. Última pasada: 25/09, 12:16 PM, con Urban Freestyle (4 escritos, 63 para mirar).
- **Sin país en ningún servidor**: 8 con ID. **5 ya tienen el Miembro de DRA** —Kevo, aze gian, Adriox, Sedelti y Elsoolar— y es lo único que les falta para la carta: con un rol de país en DRA (o la bandera en el apodo) entran solos en la corrida siguiente. Los otros 3 (Deikka, NarcoMC, TRIPLE7) están sólo en FFA. Otros 9 se miran a las 3:22 AM (hay un tope de 15 por corrida); Fabrizio tiene dos roles, España y Perú, y no lo toco.
- **#13 «¿Por qué no tengo carta?»** en el hub: la parte general ya está («¿Todavía no tenés tu tarjeta?», 1.15). La personal —qué le falta a cada uno— la dice `/verificar`; en la página, cuando digas.
- **La campana con gente de verdad**: medir la CPU de un lote de 20 envíos (con 0 suscriptos no hay con qué) e iPhone con la página instalada.
- **Hay dos suscripciones de Apple**: si a tu iPhone le llega el mismo aviso dos veces, está anotado dos veces (la app de inicio y Safari). Desactivá uno.
- **Inscribirse y no ir** (lo que va a cortar la racha): hay que guardar las inscripciones de cada evento antes de que el servidor las borre. Lo armo cuando lo pidas.
- **Knowledge Sombrío** aparece en Mundo **sin puesto**: de sus seis, sólo Zignos jugó la T1. Tiene puesto en cuanto jueguen tres.
- **Dos personas con el mismo nombre en minúsculas** (Volk y volk) ya se separan en la página, pero **R2 y KV todavía arman la clave del nombre**: el día que los dos estén verificados, sus tarjetas chocan. Hoy ninguno lo está.
- ✅ ~~**La corrida de las 10:52 AM** es la primera con las marcas del disparador en el Durable Object~~: verificado el 28/09 en `/avisos/estado` —`arranco` y `ultimo` a las 1:52 PM, `ok` con `204`—.
- 🔔 **A7** (el Score a 40–99): te llega un DM cuando el primero llegue a 8 eventos. Pide mover los umbrales de los 8 rangos en la misma pasada.
- **La identidad de un evento es `(nombre, servidor, fecha)`**: si un organizador le cambia el título a una llave **después** de que se procesó, el ciclo la toma por otro evento y la cuenta dos veces. Lo seguro es anclarla al mensaje de Discord (el link ya se guarda); pide migrar `Eventos Procesados` y lo dejo para cuando haya un rato sin eventos.
- ✅ ~~Las llaves viajan en el payload del lobby, las 24 más nuevas~~: desde la 1.20 **todas** van además a `web:llaves` y la página las pide sólo para un link viejo. Si el lobby pesa (hoy 115 KB), se puede bajar `LLAVES_WEB` sin romper ningún link.
- **El emblema de arriba de la Servidor sigue siendo un archivo** (`comun/escudos_cuad/`, de `herramientas/escudos_cuadrados.py`): si un servidor cambia de logo, ése hay que rehacerlo mirándolo. El círculo del servidor en las otras cartas ya sale solo de Discord.
- ✅ ~~🖼️ El paso 5b baja las 427 caras en cada corrida~~: desde la 1.40 la carpeta se guarda de una corrida a la otra (caché de Actions) y se bajan sólo las que cambiaron.
- ✅ ~~🌍 **El OVR Nacional de la carta de País depende del país entero**~~: entra al sello desde el 28/09 (ver la 1.40).
- ⚠️ **El mapa campo→carta no se puede regenerar con el pool de hoy**: nadie cumple el requisito de País, así que la medición casi no la dibuja y le faltan `cc`, `sv` y los duelos. El aviso del ciclo dice «Regenerá» y **hoy no hay que hacerle caso**; lo probé y lo revertí.
- Medir cuántas lecturas del Sheet hace cada corrida, para ver el margen contra la cuota. **Visto el 28/09**: en 2 de 4 corridas la carga de `Resultados` esperó por 429 hasta el 3.er intento (≈60 s). No es riesgo —son 6 intentos con hasta 200 s y la cuota se renueva por minuto— pero es tiempo. Lo que queda es contar quién lee cuánto.
