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
| **Autoverificar**: IDs de Snake Rap → Sheet → si están en DRA **y tienen país** (bandera o rol de país en DRA, FFA, LIVONIA o Snake Rap) → Miembro de DRA | *«only those [that] have a country flag or role can be verified»* (24/09) | `herramientas/cruzar_miembros.py` · **a mano por ahora** |
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

---

## 📅 Viernes 25/09 (madrugada)

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

1. **Makmah / Makma**: las llaves dicen «Makma 🇻🇪» y la cuenta verificada (`makmah_g`) tiene el rol Venezuela y el apodo «#2 | Makmah» → el sistema los junta. ¿Se saca la nota «DOS Makmahs» de la hoja AKAs?
2. **CJ** ¿es `@cj_kloke_` (🇻🇪)? · **Eze**: 5 cuentas posibles · **Noone** 🇵🇪: la única cuenta, `@001wanted100`, es 🇨🇴.
3. **money maker** ¿es troll?
4. **SEBITA 🇱🇷**: tu nota dice «Es Liberia» — ¿qué hay que hacer?
5. **Solar** no está en la Lista de Raperos: ¿lo agrego con su ID?
6. **Carta de País**: el «Score Selección» de cada país sale de la **pre-temporada**. ¿Se calcula con la T1 (promedio de los 5 mejores de cada país)?
7. **Estilos**: Snake Rap tiene roles de estilo (PUNCH, INGENIO, POÉTICO…) y la Competitiva tiene 16 íconos sin dueño. ¿Se llenan de ahí?
8. **13 países** que darían los roles de Snake Rap: ¿construyo el escritor de la columna País?
9. **Autoverificar**: ¿corre solo en el ciclo (p. ej. una vez al día) o a mano?
10. **Alertas**: ¿te aviso por Discord cuando algo se traba? ¿Por mensaje directo o en un canal?
11. **«Es alguien nuevo»** de quien usó `/card`: ¿que lo agregue a la Lista con su ID y país?
12. **9 filas duplicadas** del padrón (KRT/Krtman, Lzz/Luzzano…): ¿las fusiono?
13. **«¿Por qué no tengo carta?»** en el hub: ¿lo hago?
14. El bot es **Administrador en 4 de los 5 servidores**. No es urgente; sacárselo evita que vea canales de staff.
15. **Canal «📡 eventos de la Liga» en DRA**: el bot re-publica ahí, al minuto, los anuncios de **todos** los servidores. Es la otra mitad de los avisos: sin instalar nada y sin token nuevo. ¿Lo creo? ¿Con qué nombre y en qué categoría?
16. **Telegram** (el 2º de tu lista del 21/09): pide crear un bot en BotFather, o sea **un token nuevo** — ¿lo dejamos para el final con los demás tokens?
17. **Los 14 canales que escucha el vigía** incluyen los de *novedades* y *anuncios* (misma búsqueda por nombre que el hub). Sólo avisa lo que tiene forma de anuncio de evento. ¿Está bien, o sólo los de eventos/competencias?

## 🔧 Pendiente mío

- **La campana con gente de verdad**: medir la CPU de un lote de 20 envíos (con 0 suscriptos no hay con qué) e iPhone con la página instalada.
- En ✅ Decidir, las preguntas de eventos («(sin titulo)») deberían traer el link a la llave en Discord.
- Medir cuántas lecturas del Sheet hace cada corrida, para ver el margen contra la cuota.
