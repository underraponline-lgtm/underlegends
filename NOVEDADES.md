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
| **Para tener carta: estar en DRA y verificado**, con Discord ID y país | *«to get cards all need to be in DRA server and verified»* (24/09) | `bot/verificados.py` |
| **Verificado = sólo el rol Miembro de DRA** | *«El rol de verificado es miembro en DRA únicamente»* (24/09) | `bot/verificados.py` |
| De FFA, LIVONIA, La Confederación, **Snake Rap y Urban Freestyle**: se saca el ID, **no se verifica** | *«saca su ID, sí, pero no lo verifiques»* (19/09) · Urban Freestyle, *«quiero que hagas reconocimiento de IDs»* (25/09) | `herramientas/cruzar_miembros.py` |
| **Autoverificar**: IDs de Snake Rap → Sheet → si están en DRA **y tienen país** (bandera o rol de país en DRA, FFA, LIVONIA o Snake Rap) → Miembro de DRA | *«only those [that] have a country flag or role can be verified»* (24/09) | **en el ciclo** desde el 25/09 (`bot/autoverificar.py`, paso 1a2) · los IDs por nombre, a mano (`herramientas/cruzar_miembros.py`) |
| **El país sale del rol** cuando la Lista no lo tiene: gana USA · el rol de DRA · el de los otros servidores (sólo roles con bandera) · la bandera del nombre. Dos países sin USA: no se toca | *«si dale»* (25/09, #8) | `bot/autoverificar.py` |
| **Quien se anota con `/card` y no está en la Lista, entra solo** con su ID y país. Lo dudoso (sin país, nombre parecido a otro, alias, troll) va a Pendientes | *«necesitamos que todas las personas que se verifiquen estén en DRA»* (25/09, #11) | `sheet/registrar_ids.py` · `bot/worker.js` |
| Requisitos por carta: Temporada **1 participación** · Competitivo **10 eventos** · País **3 duelos nacionales + 3 internacionales + bandera** · Servidor **nada** | (22/09) | `comun/requisitos.py` |
| Nadie tiene letra de rango hasta **10 eventos** | *«no aparece nadie hasta q tenga 10 eventos»* (23/09) | `sheet/rankings.py` |
| **8 rangos** (SSS 82 · SS 73 · S 62 · A 48 · B 37 · C 26 · D 18 · E); los roles de Discord ya son 8 | (17/09, 23/09) | `comun/rangos.py` |

### Eventos y ranking

| regla | Dlx | dónde vive |
|---|---|---|
| La **guía de formatos de llave** manda: sin campeón no suma (12 h), pokémon, suplente, draft, invitado de honor, fases de filtros, Interserver retenido | Partes 1 y 2 (24/09) | `bot/escuchar.py`, `bot/llaves_a_entrada.py`, `sheet/motor.py` |
| Eventos por equipos: los puntos se reparten; la batalla no cuenta como duelo | | `sheet/motor.py` |
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
| **La web se rehace más adelante, con Dlx y con connectors** | *«después de que termines esto planeo REMAKE el website contigo y con unos connectors»* (28/09) | ⏳ cuando Dlx lo abra; hasta entonces, sólo arreglos y pedidos puntuales |
| **MARRUECOS lo resuelve Dlx en ✅ Decidir**, y la hoja tiene que ser más clara y más linda | *«Lo resuelvo yo… pero mejora esa página de decidir incluso más… hazla. Más mejor y bonita»* (28/09) | ✅ **«¿quién ganó esta batalla?»** y la hoja rehecha (ver abajo) |
| **El Clásico cuenta EVENTOS, no batallas** | lo decidí yo: en la Snake Arena, DELUXE y FAZER se cruzaron **5 veces** en una noche, así que la 3.ª ya era «Clásico» y los dos cobraban +10 % | ✅ `multiplicadores.clasicos()` y `rivalidades()` (1.36). Las 4 parejas que ya eran rivales lo siguen siendo: cada una se cruzó en 2 eventos |

⚠️ **FFA y EFA siguen con la silueta, y ya lo decidió Dlx** (*«que se quede así de momento»*): el ícono de FFA es un póster con micrófonos, llamas y texto, y a 30 px es ruido. Si algún día va con el ícono, es una línea (`CON_ICONO` en `comun/escudos.py`).

---

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
- 🆕 **«Es alguien nuevo» con cuenta de Discord** (28/09): cuando la pista de
  ✅ Decidir muestra que el nombre es una cuenta de Discord que no está en la
  Lista, ¿al contestar «Es alguien nuevo» lo agrego a la Lista con esa
  cuenta? Así, con bandera y el Miembro de DRA, le salen las cartas solo.
  **A** · sí · **B** · no, que sólo quede anotado (como hoy). Toca el portón,
  por eso se pregunta.
- 🆕 **¿Un MULTIVERSE se carga solo o se retiene para que lo mires?**
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
- 🆕 **Tres ideas** (28/09), para cuando quieras: **un probador de llaves en la
  web** (el organizador pega su llave y ve cómo la lee el bot antes de
  publicarla; corre en el navegador, no gasta nada); **los debutantes de la
  semana en el Lunes de la Liga** (el 42 % jugó una sola vez); **un DM sólo a
  vos** cuando una batalla lleve más de 24 h esperando en ✅ Decidir (frena los
  puntos de todo el evento).
- **Las reglas de Misiones y las Tareas del Pase**: qué cuenta, cuánto da y
  qué se gana (Most Wanted ya corre: ver 1.22). Y para las Tareas, **cómo se
  hacen los entrenamientos de DRA** (dónde se anuncian y dónde queda quién
  fue), porque de ahí salen.
- **¿El tono miel te gusta** para Urban Freestyle, ya en la página?
- **Seguidores, seguidos y POSTS** (27/09, para discutir). Mi opinión: primero
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
2. **¿Una imagen grande en la vista previa del link?** Hoy el link pegado en Discord sale con el logo chico a la derecha. Si querés una imagen grande abajo del texto (1200×630, tipo banner), pasame la imagen o la armo con el diseño de la página.

### La página vieja del Apps Script, comparada (25/09, 5:30 AM)

«Mi Perfil» tenía buscador, perfil por rapero con más de 50 números, Top 3 del Competitivo, cuántos hay en cada rango, Most Wanted, redes sociales, modo VS y 8 pestañas de rankings.

| | |
|---|---|
| **Falta** | el perfil de cada rapero · buscador en el Inicio · Most Wanted · redes sociales · el Competitivo como pestaña del Ranking |
| **Ya está** | el VS (Comparar dos) · la escalera de rangos con cuántos hay · Temporada, Podios, Duelos, Países y Crews |
| **Mejor que antes** | las tarjetas de verdad · datos solos cada media hora · llaves en cuadro, calendario y mapa · avisos · hecha para el teléfono |

**Los avisos en la PC** (Dlx: *«¿arreglaste para que pueda tener las notificaciones en PC también?»*): del lado del servidor no había nada roto para la PC —el aviso sale igual para todos— y anoche no hubo nada que avisar (en los 10 canales, desde el 24/09 al mediodía, sólo está su «Probando…»). El sospechoso es **Opera GX**, que deja activar los avisos y en la compu a veces no los recibe. La campana lo distingue sola: «Mandar una de prueba» espera 20 s y dice si llegó (entonces es Windows) o no (entonces es el navegador: Chrome o Edge en esa compu).

## 🔧 Pendiente mío

- **Mirar la corrida de las 11:22 AM del 27/09**: tiene que entrar AGREEMENT
  DOOMSDAY V.1 (#364 si no entra otro antes), con FULLY + SNOW campeones;
  Makmah tiene que pasar a #1 en su Competitiva, y KENNY sumarse a Kenny.
- **La primera llave en vivo de verdad**: SNAKE ARENA VOL. 2, hoy a las 5 PM
  ET. Mirar que el vigía la guarde, que la página la lea igual que Python y
  que se esconda cuando el ciclo la procese.
- **Los links de Discord en la app**: probarlo en un Android de verdad.
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
