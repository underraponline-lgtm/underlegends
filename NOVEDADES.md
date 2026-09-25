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

---

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

1. **Eze y Noone** (del #2): Eze tiene 5 cuentas posibles; la única cuenta de Noone 🇵🇪 (`@001wanted100`) es 🇨🇴. ¿Cuál es cada uno, o los dejo sin ID?
2. **TFC**: el Sheet dice «The Freestyle Community»; su Discord y su logo dicen «The Freestyle **Corpo**». ¿Cuál es? (No es confirmado todavía, así que hoy no se ve en el hub.)
3. **Racha**: (a) llaves de más de 16 —¿semifinal o cuartos?—; (b) llaves de menos de 8 —¿llegar a la final?—; (c) faltar a un evento, ¿corta la racha o sólo cuentan los que jugaste?; (d) en el ranking de **Duelos**, ¿la racha sigue siendo de duelos ganados seguidos (con otro nombre) o pasa a ser la de eventos?
4. **«Under Legends» en el resto**: saqué la frase y puse la descripción oficial. Quedan el **logo UL**, la trama «UNDER LEGENDS» del fondo y la dirección `underlegends.pages.dev`. ¿Se quedan como marca o también se van?
5. **Verificación con login de Discord**: para que la página sepa quién sos hace falta registrar la dirección del hub en el portal de Discord de la app (lo hacés vos, es un campo). ¿Lo hacemos, o arrancamos por el comando `/verificar` en Discord?

## 🔧 Pendiente mío

- **Los IDs por nombre siguen a mano** (`herramientas/cruzar_miembros.py`): el ciclo sólo toma el ID que llega firmado por `/card`. Emparejar un nombre con una cuenta es el paso que ya costó dos veces.
- **Sin país en ningún servidor**: 8 con ID. **5 ya tienen el Miembro de DRA** —Kevo, aze gian, Adriox, Sedelti y Elsoolar— y es lo único que les falta para la carta: con un rol de país en DRA (o la bandera en el apodo) entran solos en la corrida siguiente. Los otros 3 (Deikka, NarcoMC, TRIPLE7) están sólo en FFA. Otros 9 se miran a las 3:22 AM (hay un tope de 15 por corrida); Fabrizio tiene dos roles, España y Perú, y no lo toco.
- **#13 «¿Por qué no tengo carta?»** en el hub, cuando digas.
- **La campana con gente de verdad**: medir la CPU de un lote de 20 envíos (con 0 suscriptos no hay con qué) e iPhone con la página instalada.
- En ✅ Decidir, las preguntas de eventos («(sin titulo)») deberían traer el link a la llave en Discord.
- Medir cuántas lecturas del Sheet hace cada corrida, para ver el margen contra la cuota.
