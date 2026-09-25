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
| De FFA, LIVONIA, La Confederación **y Snake Rap**: se saca el ID, **no se verifica** | *«saca su ID, sí, pero no lo verifiques»* (19/09) | `herramientas/cruzar_miembros.py` |
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
| **RAP EXHIBITION 1/8** (Snake Rap, 22/09) **no cuenta** | *«no debería contar»* (24/09) | `datos/decisiones.json` |
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
| **Los logos de los servidores, al día desde Discord** | *«trackear los logos actuales ya que el bot debería ser posible de eso»* | ✅ en el hub · las cartas todavía usan el guardado |
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

---

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

## ❓ Esperando a Dlx

1. **El Score del Competitivo**: tenías razón, es el de antes. El rework dejó dos cambios **para decidir después de simularlos**, y nunca se aplicaron: **G1**, los pesos —hoy ⚡30 · 🎯24 · 👑21 · 🔥15 · 🌍10; el rework propone ⚡25 · 🎯24 · 👑21 · 🔥**10** · 🌍**20**— y **A7**, llevar el Score a 40–99. Simulado sobre las 138 de la pre-temporada, **G1 le cambia la letra a 37 (27 %)**; hoy no le cambia a nadie, porque nadie llegó a 10 eventos. ¿Aplico G1 ahora? A7 pide mover los umbrales de los 8 rangos en la misma pasada: lo dejo para cuando digas.
2. **La segunda página de los paneles** del Inicio la armé con **tu temporada** (tu puesto, tu racha y lo que te falta, si elegiste quién sos en «Mi cuenta») y **lo que viene** (el próximo evento o el último campeón). ¿Va así, o preferís otra cosa ahí?

### La página vieja del Apps Script, comparada (25/09, 5:30 AM)

«Mi Perfil» tenía buscador, perfil por rapero con más de 50 números, Top 3 del Competitivo, cuántos hay en cada rango, Most Wanted, redes sociales, modo VS y 8 pestañas de rankings.

| | |
|---|---|
| **Falta** | el perfil de cada rapero · buscador en el Inicio · Most Wanted · redes sociales · el Competitivo como pestaña del Ranking |
| **Ya está** | el VS (Comparar dos) · la escalera de rangos con cuántos hay · Temporada, Podios, Duelos, Países y Crews |
| **Mejor que antes** | las tarjetas de verdad · datos solos cada media hora · llaves en cuadro, calendario y mapa · avisos · hecha para el teléfono |

**Los avisos en la PC** (Dlx: *«¿arreglaste para que pueda tener las notificaciones en PC también?»*): del lado del servidor no había nada roto para la PC —el aviso sale igual para todos— y anoche no hubo nada que avisar (en los 10 canales, desde el 24/09 al mediodía, sólo está su «Probando…»). El sospechoso es **Opera GX**, que deja activar los avisos y en la compu a veces no los recibe. La campana lo distingue sola: «Mandar una de prueba» espera 20 s y dice si llegó (entonces es Windows) o no (entonces es el navegador: Chrome o Edge en esa compu).

## 🔧 Pendiente mío

- **Los IDs por nombre siguen a mano** (`herramientas/cruzar_miembros.py`): el ciclo sólo toma el ID que llega firmado por `/card`. Emparejar un nombre con una cuenta es el paso que ya costó dos veces.
- **Sin país en ningún servidor**: 8 con ID. **5 ya tienen el Miembro de DRA** —Kevo, aze gian, Adriox, Sedelti y Elsoolar— y es lo único que les falta para la carta: con un rol de país en DRA (o la bandera en el apodo) entran solos en la corrida siguiente. Los otros 3 (Deikka, NarcoMC, TRIPLE7) están sólo en FFA. Otros 9 se miran a las 3:22 AM (hay un tope de 15 por corrida); Fabrizio tiene dos roles, España y Perú, y no lo toco.
- **#13 «¿Por qué no tengo carta?»** en el hub, cuando digas.
- **La campana con gente de verdad**: medir la CPU de un lote de 20 envíos (con 0 suscriptos no hay con qué) e iPhone con la página instalada.
- **Hay dos suscripciones de Apple**: si a tu iPhone le llega el mismo aviso dos veces, está anotado dos veces (la app de inicio y Safari). Desactivá uno.
- **El perfil no tiene redes todavía**: esperan al login con Discord en la página.
- **Inscribirse y no ir** (lo que va a cortar la racha): hay que guardar las inscripciones de cada evento antes de que el servidor las borre. Lo armo cuando lo pidas.
- **Knowledge Sombrío** aparece en Mundo **sin puesto**: de sus seis, sólo Zignos jugó la T1. Tiene puesto en cuanto jueguen tres.
- **Dos personas con el mismo nombre en minúsculas** (Volk y volk) ya se separan en la página, pero **R2 y KV todavía arman la clave del nombre**: el día que los dos estén verificados, sus tarjetas chocan. Hoy ninguno lo está.
- **`/notify` todavía no mandó un DM de verdad**: el primero va a salir con el próximo evento que se anuncie. Lo miro.
- **La identidad de un evento es `(nombre, servidor, fecha)`**: si un organizador le cambia el título a una llave **después** de que se procesó, el ciclo la toma por otro evento y la cuenta dos veces. Lo seguro es anclarla al mensaje de Discord (el link ya se guarda); pide migrar `Eventos Procesados` y lo dejo para cuando haya un rato sin eventos.
- **Las llaves viajan en el payload del lobby, las 24 más nuevas** (~1,5 KB cada una). Con FFA jugando cuatro por día, en unas semanas conviene pasarlas a R2 aparte; hasta entonces las más viejas abren el mensaje de Discord en vez del cuadro.
- **Las cartas siguen con el logo guardado** de cada servidor: el del hub ya sale de Discord, pero el escudo de la carta pasa por `procesar_logos.py` y no se puede cambiar solo sin mirarlo.
- 🌙 **A las 6:52 AM se redibujan todas las cartas**: tocar `comun/respaldo.py` cambia la huella del código. Es la regla (*«se redibuja de más antes que de menos»*), no un error.
- Medir cuántas lecturas del Sheet hace cada corrida, para ver el margen contra la cuota.
