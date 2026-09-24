# Dónde quedamos — 24/09/2026

⚠️ **Leer esto antes que cualquier script.**

---

## LO QUE CAMBIÓ LA NOCHE DEL 23 AL 24

### 1. Hay un hub web de verdad: **underlegends.pages.dev**

Seis vistas —Inicio, Ranking, Tarjetas, Duelos, Mundo, Guía— con menú
lateral en escritorio y barra de abajo en teléfono, enrutado por hash
(`#/ranking`, el botón de atrás funciona). **Muestra las tarjetas de
verdad**: el bucket de R2 es público y `/card` se las manda a Discord
desde esa misma URL; la web no las estaba usando.

🔑 **El reparto es todo el diseño.** Pages sirve estáticos gratis e
ilimitados, así que el HTML, el CSS, el JS y las imágenes **no tocan el
presupuesto de 10 ms del Worker**. Lo único que pasa por él es
`/api/lobby`, un json de ~16 KB que ya está masticado en KV y que el
Worker reenvía sin parsear. Buscar, filtrar, ordenar, comparar y abrir
tarjetas lo hace el navegador de quien mira.

⚠️ **Por eso la página puede crecer sin costar nada**, y ésa es la
respuesta a *«no es Apps Script, tenemos más libertad»*.

Vive en `bot/paginas/` — sin framework y sin build: los archivos que
están ahí son los que se sirven. `bot/paginas_viejas/` es sólo un 301
desde `liga-global.pages.dev`, que fue el primer nombre.

### 2. El ciclo está **partido en dos**

| trabajo | cuándo | qué hace | cuesta |
|---|---|---|---|
| `escuchar` | cron `7,37` | Discord → Sheet → pools → KV → web | **~1 min** |
| `dibujar` | sólo si escuchar encontró algo | las tarjetas | lo que tenga que costar |

🔴 **No era sólo plata: era frescura.** Con `concurrency` a nivel
workflow, mientras un redibujo de dos horas corría **nadie escuchaba
Discord**. Ahora son grupos distintos. Y un job salteado cuesta **cero**,
así que dibujar pasó de correr 24 veces al día a las dos o tres que
hacen falta.

⚠️ **El piso real de una corrida quieta es 1 minuto, no 30 s.** Medido:
51 s en total —33 de `pip install`, 11 de checkout— y GitHub cobra
redondeando para arriba. Con eso, cada 15 min son 2.880 min/mes (144 %
del plan privado) y cada 30 son 1.440 (72 %). **`*/45` no existe**: cron
lo lee como «minutos 0 y 45».

### 3. 🔴 SUBIR COSTABA EL DOBLE QUE DIBUJAR, Y ERA UNA LÍNEA

La corrida de las **11:35pm** se cortó en el timeout de 120 min en la
**tanda 5 de 6**. Midiendo su log tanda por tanda —40 personas cada una—:

| | tiempo |
|---|---|
| dibujar | 9–11 min |
| **subir** | **15–19 min** |

⚠️ **No era el navegador ni la red, que es donde busqué primero.** Era
`method=6` en la conversión a webp de `bot/subir_cartas.py`: **2.45–3.38 s
de CPU por carta**. Y cada persona lleva **12.7 objetos**, no 4, porque la
Servidor se dibuja **una vez por cada servidor aliado** (`sv-ffa`,
`sv-dra`, `sv-tfc`…) — que es el argumento de venta de esa carta.

`method=5` hace lo mismo en **0.31–0.35 s**, ocho veces más rápido.

⚠️ **Y los 8 hilos no lo tapaban: el runner tiene 2 núcleos.** Contra un
cuello de CPU, ocho hilos dan dos. El paralelismo sirve para solapar la
red, que es justo lo que el síntoma parecía ser.

⚠️ **Lo que se paga son bytes: +2.4 %** (136.8 → 140.1 KB en la carta de
Agus), o sea ~15 MB más sobre los 10 GB del plan gratis de R2.

⚠️ **Lo que NO se paga es la imagen, y ésa era la pregunta.** El cambio la
mueve **trece veces menos** que la compresión en la que ya vive, medido
contra el PNG original sobre cinco cartas:

```
PNG -> method=6   max 194   media 1.14     la pérdida YA aceptada
method=6 -> 5     max  15   media 0.55     este cambio
el canal alfa     max   0                  idéntico
```

Ese alfa idéntico no es un detalle: era lo único que podía romper la
carta — una webp sin transparencia se ve como un **rectángulo** sobre el
fondo de Discord, y eso no da error en ningún lado.

Los dos valores quedan en **un solo lugar** (`subir_cartas.CALIDAD` y
`.ESFUERZO`) y `a_webp.py` los importa en vez de tener su copia, que es
el bug del divisor otra vez. `bot/fotos.py` sigue en 6 **a propósito**:
son avatares de 256 px una vez por temporada, no 6.475 cartas por ciclo.

### 4. 🔴 EL GASTO: 1.806 MIN EN TRES DÍAS, DE 2.000 AL MES

Medido el 24/09 a la 1:55am sobre las 50 corridas que GitHub todavía
guarda, redondeando cada una para arriba como factura GitHub:

```
ciclo       1781 min        21/09    33 min
auditoria     16 min        22/09   915 min
rangos         8 min        23/09   858 min
TOTAL       1806 min
```

⚠️ **El plan gratis de un repo privado son 2.000 min/mes.** A este ritmo
se agota **hoy**, y cuando se agota los workflows **no se ponen lentos:
se detienen**.

⚠️ **El arreglo de arriba baja el ciclo casi a la mitad** —de ~25 min por
tanda a ~13— pero no alcanza: ~450 min/día siguen siendo 13.500 al mes.

🔑 **Por eso el repo público no es una optimización, es la única salida**:
Actions es **gratis e ilimitado** en repos públicos. Dlx ya dijo «a mí no
me molesta». El inventario está hecho: **467 archivos, 45 MB** de los
1.231 / 451 MB del repo de hoy (que pesa **1.140 MB** medido por la API,
casi todo los 422 avatares versionados).

### 5. POR QUÉ EL CRON CORRÍA 1 DE CADA 7 VECES, Y SON DOS CAUSAS

De las **54** ranuras horarias desde el 22/09:

| | |
|---|---|
| el ciclo **ya estaba corriendo** | **26 (48 %)** |
| libres, y el cron disparó | 3 |
| libres, y GitHub no disparó | 25 |

⚠️ **La mitad era nuestra y se arregla**: una corrida de dos horas se come
las ranuras siguientes. La partición en dos jobs ya libera a `escuchar`, y
el arreglo de compresión acorta a `dibujar`.

⚠️ **La otra mitad es de GitHub**, y es documentada: `schedule` es *best
effort* y se descarta bajo carga. De las ranuras **libres** disparó el
**11 %**. Eso no se arregla desde adentro.

🔑 **La salida que tenemos a mano es el Worker**: Cloudflare Cron Triggers
son parte del plan gratis y **sí** son puntuales, y el Worker ya está
desplegado. Dispararía el `workflow_dispatch` de GitHub por API. Queda
anotado, no hecho.

### 6. LA MADRUGADA DEL 24: IDENTIDAD, LA WEB Y EL CRON

Dlx miró el sitio y reportó cuatro cosas. Las cuatro tenían **una sola
causa de fondo**, y abajo había tres bugs encadenados.

#### Makma es una persona y el sistema veía dos

La web lo mostraba #1 de FFA con 16.000 pts; `/card` le daba una tarjeta
vacía; su `/foto` «no se puso». Todo lo mismo:

| | |
|---|---|
| `Makma 🇻🇪` | sin Discord ID · 4 eventos, 16.000 pts |
| `Makmah 🇦🇷` | con ID y ✅ · 0 eventos |

En R2 eso son **dos claves**: `makma/` con las cuatro cartas frescas y
`makmah/` con sólo `servidor`. La web servía la primera y `/card` resuelve
el ID a la segunda. **No era cache.** Y su `/foto` funcionó perfecto — se
guardó en `fotos/…/makmah.webp` y la carta se dibuja como `makma`.

🔴 **Y SON NUEVE, NO UNO.** El repo lo sabía y lo imprimía: `Lzz/Luzzano`,
`Santz/Santos`, `Erician/Erian`, `Bulldozer/Bull12r`, `KRT/Krtman`,
`Nacho/Nc-Nacho`, `Wachin/El Wachin`, `Inclusivo/Xclusivo`.

🔴 **La causa: el mapa de 186 alias no lo leía nadie.** Medido —
`construir_pool_temporada`, `construir_pool_competitivo`, `padron`,
`subir_web` y `subir_datos` lo mencionaban **cero** veces. Hoy canoniza
`rankings.agregar()`, el embudo único de las cinco vitrinas.

#### El país vivía en TRES columnas de la misma hoja

```
Rapero    'Makmah 🇦🇷'   el emoji pegado al nombre
Bandera   'Venezuela'    lo único que pais_desde_rol.py escribía
País      'ar'           lo que lee el POOL
```

Decía «✅ 1 país escrito» y no cambiaba nada. Y no alcanzó con escribir
las dos: **hay que preguntar por las dos** — el script decidía qué
cambiar mirando `Bandera`, así que una fila con `Bandera` bien y `País`
vieja no entraba nunca. Con las dos cosas encontró **3**, dos de ellas
con `País` vacío teniendo bandera.

#### Los nombres trolls eran basura de parseo, y el paréntesis costó una vuelta

`nhp(sinlimites` y `fleivacheck)` son **las dos mitades del mismo
nombre**. Los 14 lados con paréntesis tienen todos la forma `A(B+C)`.

⚠️ **El primer arreglo lo trató como separador de equipo y movió el
ranking entero**: los puntos se reparten entre integrantes, así que el
ganador cobraba un tercio. Lo resolvió mirar la progresión de una llave —
el paréntesis **crece cada ronda y agrega al que acaba de vencer**. Es la
lista de vencidos; el competidor es lo que va antes.

Y **la bandera del nombre es decoración**: el mismo Hassan aparece como
🇪🇬, 🇮🇶 y 🇦🇴. El fallback las tomaba como país — de ahí la bandera de
Noruega. Hoy sólo acepta los 21 países de la Liga.

| | antes | ahora |
|---|---|---|
| personas | 76 | **71** |
| `nhp(sinlimites` · `money maker(cj)` | estaban | **no** |
| Noruega · Gabón · Azerbaiyán · Jordania | estaban | **no** |
| Hassan | 3 personas | **1** |

#### La web ofrecía 58 cartas que nadie se había ganado

`_cartas()` preguntaba **sólo** al inventario de R2, y estar ahí es
«alguna vez se dibujó», no «le corresponde hoy»: el bucket tiene las de
la pre-temporada. **58 de 72.** El bot ya lo hacía bien — las dos
pantallas leían fuentes distintas para la misma pregunta.

Se agregó **descargar** (no es un `<a download>`: los navegadores lo
ignoran cross-origin, así que va por `fetch`+blob y hubo que habilitar
CORS en R2), **link a Discord** en cada evento, y **«Lo que pasó»**
porque «lo que viene» se apaga sola fuera de la ventana de 90 min.

🔴 **Y EL SITIO NO SE DESPLEGABA MÁS.** Pages está conectado al repo
**privado**, así que desde la mudanza ningún cambio del hub llegaba — y
no fallaba: HTML viejo con datos frescos. Hoy lo despliega el paso 2c
con su sello, vía `bot/paginas_subir.py`.

⚠️ Ese script tiene una trampa anotada: **`_worker.js` no va en el
manifiesto**. Subido como un asset más, Cloudflare lo sirve en vez de
correrlo y `/api/lobby` empieza a devolver el `index.html` **con 200**.
La página carga perfecta y vacía.

#### El cron del Worker: `ctx.waitUntil` tiraba el trabajo

Cuatro slots sin rastro con todo bien configurado. Era
`ctx.waitUntil(async () => {…})` y devolver: un `scheduled` ya tiene su
propia vida. **No falla — la invocación figura como exitosa y no hace
nada.** Con `await` anda: `cron:ultimo` con HTTP 204 y el ciclo arrancó.

Lo que dejó verlo fue mover la marca al principio: con la escritura sólo
al final, «no disparó» y «disparó y murió» se ven igual.

Ahora el ciclo arranca a los **:07 y :37 por GitHub** y a los **:22 y :52
por Cloudflare**.

#### Y el arreglo de compresión, medido por fin

| por tanda de 40 | antes | ahora |
|---|---|---|
| dibujar | 9–11 min | 9m 20s |
| **subir** | **15–19 min** | **1m 21s** |
| total | ~25 min | **~10.7 min** |

**Doce veces**, no ocho: ahora los 8 hilos paralelizan red en vez de
pelear por 2 núcleos. Y la corrida **terminó** — 10 tandas, 400 personas
en 117 min, contra 5 de 6 que no llegaba.

#### Lo que sigue

- **El AKA verificado.** Quedan `XXXXX`, `papa`, `dxg`, `Garxziiscity`:
  **no son basura de parseo, son nombres que la gente escribió**. Hay que
  resolverlos contra el Discord ID de su inscripción.
- Las fuentes y el aprovechamiento del espacio del hub, que Dlx pidió y
  no se pudieron juzgar: los screenshots del navegador expiran con la
  ventana oculta.

### 7. Lo que falta, en orden

1. **Ver salir el cron solo.** Con `*/30` no disparó ni a las 04:00 ni a
   las 04:30 —workflow activo y cron en la rama por defecto, los dos
   verificados contra la API—. Pasó a `7,37` porque GitHub documenta que
   *«los momentos de mayor carga incluyen el comienzo de cada hora»*.
   **Es una cobertura, no una certeza**: si tampoco dispara, la causa es
   otra.
2. **El repo público.** Inventariado: **467 archivos / 45 MB** de los
   1.231 / 451 MB de hoy. Queda afuera `03_Servidor/disenos/` (325 MB,
   con los 116 de `_avatares/` — caras de gente real), `galeria/`,
   `versiones/` y las 14 hojas comparativas de `04_Pais/`, que
   **verifiqué que ningún generador lee**: son todas `screenshot(path=…)`.
   Se arranca limpio; el privado queda como archivo, porque el historial
   tiene las fotos y un repo público las publica para siempre.
   ✅ `secretos_en_git.py` da verde contra el árbol **y el historial**.
3. **El recordatorio antes del evento.** Idea de Dlx y la única de la
   lista que ataca la retención. Va dentro de `escuchar`, sin corrida
   extra.
4. **El plan de estudiante** (dominio `.me` gratis, y Cloudflare for
   Students: 12 meses de Workers Paid). Dlx: *«dejá eso para el final»*.

### 8. Los bugs de esa noche, todos de la misma familia

Ninguno fallaba. Todos devolvían algo plausible.

| qué | qué pasaba |
|---|---|
| la web del Apps Script | leía las columnas por letra fija y la vitrina ganó `Rango` en D: **los eventos salían como Score y el Score como Confianza** |
| su cache | 6 h sin nada que la invalidara al cambiar el código — *«una cache que mira los datos no ve el código»*, en el Apps Script |
| `refreshCache()` | borraba `'allData'` a secas: devolvía «Cache refreshed» y no refrescaba nada |
| «lo que viene» | anunciaba **EN VIVO** un evento empezado hace 160 min |
| el pie de la web | decía «hace 35 m» con datos de hace 2 h: medía cuándo se copió, no cuándo se leyó |
| la barra de duelos | medía cuántos **peleó** con un tooltip que decía «% ganados» — el que ganó 3 de 3 se veía peor que el que ganó 3 de 4 |
| el medallero | leía `seg` y `ter` y el payload mandaba sólo `oro`: plata y bronce en **cero para todos** |
| el récord de racha | «3 · Masino», con Masino en UN evento |
| los países | ordenados por cabezas bajo un título que dice «por puntos» |
| tres `id` duplicados | pintar el contenido **reemplazaba la sección entera** |
| `.vista` | era la vista Y el estado «ya apareció»: cambiar de vista dos veces vaciaba la página |
| `jobs:` dos veces | `yaml.safe_load` lo acepta y GitHub no |
| el composite action | hacía el checkout que hace falta para encontrarlo |

🔴 **Y los dos últimos los dejó pasar un validador mío.** El primero
porque `yaml.safe_load` tolera claves repetidas; el segundo porque miraba
que `action.yml` **existiera** y no que estuviera **disponible en el
runner**. Existir y estar disponible son dos preguntas distintas.
`herramientas/workflows_validos.py` ahora mira las dos, y corre en la
auditoría semanal.

### 9. LA GUÍA DE FORMATOS DE DLX, EN EL PIPELINE (24/09, de día)

Dlx pasó la guía que usa el staff para puntuar llaves, en dos partes
(`GUIA_Formatos_de_Llave` y su `PARTE_2`, 23/09). ⚠️ **Tiene detalles
de la pre-temporada** —la fila de `Entrada` a mano, la columna «Otros»,
el ❓ de Control—: *«lo que importa es el procesamiento de eventos»*.
Eso es lo que entró.

| regla | dónde |
|---|---|
| los equipos DIVIDEN, con floor (§3.2) | `motor.sumar()` |
| walk-in con nombre: 50 / 25 / 0 % (§4.1) | `llaves_a_entrada.marcar_walkins()` |
| revivido: 1ª derrota entera + 50 % de su puesto final (§3.7) | `marcar_revividos()` + motor |
| el podio manda: `3ER PUESTO:` (§4.6) | `escuchar._tercero_del_podio()` |
| alias peligroso: la misma persona a los dos lados (Parte 5) | motor → `Pendientes` |
| los 14 pares que NO son la misma persona (Parte 5) | hoja AKAs + `akas_a_mano.json` |
| `SEMIFINAL` a secas y `FILTROS` (= R32, §3.6) | `escuchar.RONDA` · `motor.DE_LLAVE` |
| ronda que la escala no paga → aviso, no 0 callado (§2) | motor → `Pendientes` |
| **sin campeón no se suma** (Parte 1: «resultado desconocido») | `llaves_a_entrada.main()` |
| pokemon `(P)`: no paga, no divide, sin medalla (P2 §10) | lector + motor |
| `[SUPLENTE]`: cupo vacío (P2 §9.4) | `escuchar.nombres_de_linea()` |
| drafteado: eliminación + parte, enteras (P2 §9.1) | `marcar_revividos()` + motor |
| invitado de honor: no es walk-in (P2 §9.2) | `marcar_walkins()` |
| fase de filtros/cypher sin batallas → se retiene (P2 §12) | `fase_sin_batallas()` |
| llave rumbo al Interserver → se retiene y se pregunta (P2 §11.2) | `llaves_a_entrada.main()` |
| un puesto no reparte más de lo que vale (P2 §13) | motor → `Pendientes` |
| `𝐕𝐒` y letras de fantasía | `escuchar.plano()` |
| desempate: OVR → pts → 🥇 → 🥈 → eventos → WR% (P2 §10.8) | `rankings._desempate()` |

🔴 **SIN CAMPEÓN NO SE SUMA, Y ESO CAMBIA UN DISEÑO.** Hasta hoy una
llave leída a medias se cargaba y la duda iba a `Pendientes`: se sumaba
primero y se preguntaba después. Ahora una llave sin la final ganada
**espera** mientras esté en curso (menos de 12 h sin tocar) y después va
a `Pendientes` como `Bracket incompleto`. La vitrina ya no se mueve a
mitad de un evento: se mueve cuando termina.

⚠️ **Medido sobre las 8 llaves de la T1: ninguna fila cambió** con la
Parte 2 —ninguna usa pokemon, suplente, draft, filtros ni Interserver—.
Lo único que se movió fue una llave sin título de FFA del 23/09 que el
`SEMIFINAL` roto escondía: cuartos donde no pasa nadie, gente en semis
que no estaba en cuartos y una final ilegible. Iba a escribir 3 filas;
ahora es un `Bracket incompleto`.

🔴 **DOS BUGS QUE APARECIERON MIDIENDO ESTO, los dos viejos:**

- **El plantel contaba pedazos de paréntesis como personas.** Partía
  por `+` antes de sacar el «a quién le ganó», así que
  `gekto(chianluka+makma)` daba `gektochianluka`: ELRAP FECHA 6 contaba
  34 y son 29, EL RAP FECHA 5 29 y son 27. Ninguno cambió de escala;
  con 15 reales y una basura, un evento cobra 16+.
- **`Pendientes` agotaba la cuota.** Una lectura por duda: 33 nombres
  desconocidos eran ~66 lecturas contra 60 por minuto, y en el ciclo de
  las 9:22 AM ET una duda se perdió. Ahora es un lote: una lectura y un
  `append`. Y `_filas()` tomaba un 429 por «cola vacía» y duplicaba.

⚠️ **Lo que NO se automatizó, a propósito:** la regla del pozo para 3 o
más empatados (§10.1) —sólo aparece en formatos como 5 VIDAS, que el
lector no lee; el empate de dos ya da el pozo, que es la columna `Semi`—
y puntuar por POSICIÓN y no por nombre de ronda (§3.6): los precedentes
se contradicen, así que se avisa en vez de adivinar.

#### Lo que espera a Dlx

1. **VR y Vargas.** La guía (P2 §15) dice que son la misma persona; la
   hoja AKAs los tiene en `no_confundir` con «Orgs confunden». Siguen
   separados hasta que diga cuál vale.
2. **EL RAP FECHA 5 (#349), la final.** `Pichulitamc👻` y `Neo👻(pollo)`
   del lado campeón, `agus(yinn)` del subcampeón, y el MVP es **pollo**,
   que había caído en cuartos. Si 👻 es «no peleó» y el paréntesis es
   quién peleó en su lugar, hoy se paga mal: los tres campeones cobran
   3.333 y pollo y yinn nada de la final. En FFA el paréntesis venía
   siendo «a quién le ganó» (ELRAP 6), por eso no se tocó.
3. **fleivaman y Fleivacheck**: Dlx dijo que son la misma persona, pero
   pelean ENTRE ELLOS en ELRAP FECHA 6. El alias se sacó hasta que
   confirme.
4. **Volk 🇲🇽 y volk 🇨🇴**, y **ADACCHI / Adachi**: ¿una persona o dos?
5. **«eventos» en el desempate**: la guía no dice el sentido; va de mayor
   a menor (con los mismos puntos y medallas, adelante quien compitió
   más).

### 10. LA CARTA Y EL RANKING, Y UNA COLA QUE SE PUEDE USAR (24/09, tarde)

**La carta y el ranking.** Dlx: *«asegurate de que lo que dicen las
cartas y el ranking sea lo mismo»*. Medido: la hoja, el pool y la web
**coinciden en las 86** (#, puntos, eventos, win%, 🥇🥈🥉). Lo que no
coincidía era la **imagen**: el ranking sale al escuchar y la carta al
terminar de dibujar, ~36 min después, y el OVR relativo cambia la carta
de todos en cada evento — en ese momento 56 de 87 estaban por redibujar.

| qué | dónde |
|---|---|
| las 13 pasadas de una tanda van de a 4 (eran 27 min en fila) | `pipeline.PARALELO` |
| la web pide cada carta con `?v=` del sello, como el Worker | `subir_web._versiones()` |
| la web marca ⏳ la carta que se está redibujando | `app.js` `vieja()` |
| la web se vuelve a subir al terminar de dibujar | `pipeline.py`, paso 6 |
| el pool desempata con el `#` de la vitrina y lo comprueba | `construir_pool_temporada.py` |

⚠️ **Los 56 de golpe fueron el desempate nuevo** (OVR → puntos → 🥇 →
🥈 → eventos → WR%): antes los empatados quedaban en el orden del dict y
**podían reordenarse solos entre corridas**, redibujando sin que nadie
compitiera. Esa fuente de cambios ya no existe.

**✅ Decidir.** Dlx: *«es muy confusa… por eso no la he usado»*, sobre
`Pendientes`. Tenía 21 repetidas, 42 resueltas mezcladas, el panel
partido por los INSERT_ROWS, 15 `alta` del bot escondidas debajo del
panel — y **contestar no hacía nada**. Ahora hay una hoja nueva, la
primera del Operativo, que el ciclo rehace en el paso 1d:

- una fila por pregunta, en palabras, con el evento por su nombre;
- la respuesta se elige de una lista (o se escribe un nombre);
- el ciclo la **aplica**: alias a la hoja AKAs, Discord ID a la Lista
  de Raperos, «cuenta / no cuenta» a `datos/decisiones.json`.

🔴 **Y `construir_akas.py` NO CORRÍA EN EL CICLO.** Un alias escrito en
la hoja AKAs no llegaba nunca al ranking; `datos/akas.json` sólo
cambiaba cuando alguien lo corría a mano. Ahora corre en el 1d, después
de Decidir, y se commitea. (El commit `752e093` decía que el ciclo lo
regeneraba: no era cierto.)

### 11. LOS DOS SHEETS, REVISADOS PESTAÑA POR PESTAÑA (24/09, tarde)

Dlx: *«el hub será esta página y principalmente nuestro servidor… el sheet
es más que todo información raw que cualquiera puede ver»*. Con eso se
recorrieron las 22 pestañas. El patrón fue el de `Pendientes`: **las
tablas que escribe el ciclo estaban bien; lo roto era todo lo que seguía
describiendo el proceso viejo** y que ya no mantenía nadie.

| Sheet | qué se hizo | con qué |
|---|---|---|
| Oficial | `Lobby`: de afiche (66 celdas combinadas) a **índice** de los datos en crudo | `sheet/indice.py`, en el ciclo en lugar de `lobby.py` |
| Oficial | ocultas: `Mi Perfil`, `Guía`, `Ranking de Ligas` | el hub hace las tres |
| Operativo | `Entrada` dice que la llena el ciclo (decía «procesá con IA y pegá en C2») | `sheet/entrada_instrucciones.py` |
| Operativo | `AKAs`: instrucciones verdaderas; fuera la cola de «fusiones» que nadie leía | `sheet/operativo_t1.py` |
| Operativo | `Eventos Procesados`: el resumen era la pre-temporada pegada (348 eventos) → fórmulas | ídem |
| Operativo | `Config`: «Temporada actual» decía Pre-Temporada 1 | ídem |
| Operativo | ocultas: `Entrada`, `Pendientes`, `Anuncios`, `Log`, `MW Puntos` | ídem |
| Apps Script | la página vieja es un aviso que manda al hub (versión 53) | `sheet/webapp_subir.py` |

⚠️ **`rangos.yml` quedó sólo a mano**: la página ya no tiene el bloque
de rangos, y con el disparo por push el próximo cambio a `rangos.py`
habría terminado en rojo. El rango de la web sale del payload del hub.

⚠️ **Todo se ocultó, nada se borró.** Lo reemplazado quedó en
`docs/sheet_respaldo/` y la página vieja en el historial de git.

⚠️ **Dos cosas que conté mal y medí antes de dejarlas**: el resumen de
`Eventos Procesados` dio 1 evento y 258 cazados en mi primera versión —el
`#` viene como texto y quedaron celdas con `""`—; va con `LEN(…)>0`.

### 12. LA CUOTA DE SHEETS, Y UN SERVIDOR NUEVO SIN AVISAR (24/09, noche)

🔴 **Durante tres corridas seguidas las vitrinas de Podios, Duelos y
Mundial no se recalcularon, con el ciclo en verde.** De 2:22 a 3:52 PM ET
el paso `rankings.py --otras` murió con un 429 en tres de cuatro corridas.
Nada figuró como fallido: el ciclo sigue, y las tres hojas se quedaban con
los números de antes. Es la cuota de Sheets —**60 lecturas por minuto**
para la cuenta de servicio, sumando los dos documentos—, y había dos
causas distintas:

| dónde | qué pasaba | el arreglo |
|---|---|---|
| `procesar_entrada.py` (murió a las 11:52 AM, a mitad del #355) | ~8 lecturas **por evento**, y el ciclo reprocesa todos los de la temporada | `resultados.reescribir()`: **una** lectura y **una** escritura por hoja, sean cuantos sean los eventos |
| `rankings.py --otras` | las lecturas que fallaban eran de **metadata**: `requests.get` sueltos **sin el reintento** que ya tenían `_leer()` y `_api()` | `_meta()`: una lectura por documento, con reintento, guardada hasta el próximo `batchUpdate`. De ~27 lecturas a ~14 |
| los dos | el 429 duró **93 s** y los reintentos esperaban 5-12-25-45 | 5-15-30-60-90 |
| `decidir.py` | leía pegado a las vitrinas y sumaba a la ráfaga | paso **2d**, al final del trabajo; no relee si no cerró nada |

⚠️ **El borrado viejo de `Resultados` podía DUPLICAR un evento.** Era un
`requests.put` sin mirar la respuesta: con un 429 las filas viejas
quedaban, se contaban como borradas y se agregaban las nuevas — el doble
de puntos, sin un error. Y leía los valores **formateados**, así que cada
evento reprocesado volvía texto los números de todos los demás (por eso
el `#` de `Eventos Procesados` era texto en 6 de 7 filas). Ahora todo pasa
por `escribir._pedir()`, que reintenta y levanta, y se lee con
`UNFORMATTED_VALUE`. Verificado: mismo contenido —136 / 31 / 7 filas— y
todo numérico.

⚠️ **La lección: un reintento que no cubre TODAS las lecturas no es un
reintento.** `_leer()` y `_api()` lo tenían; la que falló no pasaba por
ninguno. Se ve igual que tenerlo hasta el día que la ráfaga cae justo ahí.

#### Snake Rap: el bot NO está adentro, y el ciclo ya no necesita que avisen

Medido a las 4:30 PM ET: el bot está en **DRA, LIVONIA, FFA y La
Confederación**, y pedirle a Discord el servidor de Snake Rap da **404
Unknown Guild**. El link era el correcto (Under Legends,
`1550026808404217926`) y el servidor también (la invitación de SR apunta a
`492346406976356374`, 7.336 miembros). O quien lo agregó no tiene
«Gestionar servidor» ahí, o un bot anti-raid lo sacó por entrar con
Administrador. El link sin admin —ver canales y leer historial, que es
todo lo que el bot necesita ahí— es `permissions=66560`.

✅ **Cuando entre, entra solo.** `escuchar()` compara la lista de
servidores del bot contra la de la memoria (`datos/canales_llaves.json`,
clave `guilds`) y, si aparece uno, esa corrida barre todo: sus llaves
entran a los 30 minutos y no a las 20 horas. Cuesta un request por
corrida. La memoria arrancó con los cuatro de hoy, así que Snake Rap
cuenta como nuevo aunque entre antes de la primera corrida con este
código. El log lo dice: *«🆕 el bot está en un servidor nuevo»*.

⚠️ **Y ENTRÓ ESE MISMO DÍA, ENTRE LAS 4:32 Y LAS 4:52 PM ET.** La corrida
de las 4:52 lo encontró sola, barrió los 177 canales y dejó anotado su
`［🔑］llaves`. Sus llaves eran de antes de la T1, así que no cargó nada: lo
que cambia es que desde ahí cada llave nueva de ese canal se lee cada media
hora. (El `🆕` no salió en el log porque el resumen del paso 1 filtraba esa
línea; arreglado.)

### 13. SNAKE RAP: VERIFICA, ES DE CARTA Y DA IDs (24/09, noche)

Dlx: *«este es una gran oportunidad para obtener IDs y hacer el setup del
bot al servidor. Además de poder autoverificar debido a que este servidor
tiene 7000 usuarios»*.

Snake Rap está armado igual que DRA: **`・Miembro 🐍`** lo tienen 7.273 de
7.337, y los países son roles con la bandera en el nombre (🇦🇷 887, 🇪🇸 581,
🇲🇽 509, 🇨🇴 502…).

| qué | dónde | medido |
|---|---|---|
| el Miembro 🐍 verifica, como el de DRA | `bot/verificados.py` (`EXTRA`) | el portón pasa de **324 a 404**; 8 ya compiten en la T1, Velatz (#3) entre ellos |
| servidor **de carta** (no de identidad) | `herramientas/servidores_de.py` | 20 personas están sólo ahí |
| IDs por nombre, **con el país como segunda señal** | `herramientas/cruzar_miembros.py` | 27 escritos; atajó 9 que eran otra persona |

⚠️ **ES UNA EXCEPCIÓN DICHA.** Para FFA, LIVONIA y La Confederación sigue
*«sacá su ID, pero no lo verifiques»*.

⚠️ **DE SNAKE RAP SE GUARDAN SÓLO LOS DEL PADRÓN.** `verificados.json` y
`servidores_de.json` van al repo **público**: la lista de miembros de otro
servidor —7.000 personas que en su mayoría nunca jugaron— no es nuestra y
al portón no le sirve. ⚠️ DRA y FFA sí guardan todo (2.574 y 3.892 IDs):
es de antes y queda como sugerencia.

⚠️ **EN SNAKE RAP UN NOMBRE ÚNICO NO ALCANZA.** De 56 IDs que daban las
guardas de siempre, 9 eran otra persona: el «Victor» único de Snake Rap es
🇻🇪 y el del padrón 🇦🇷; «Cesar» 🇪🇨 contra 🇦🇷; «Luka» 🇦🇷 contra 🇨🇴. Por
eso allá se pide que coincida también el país. Y `--solo-ids` escribe los
ID **sin dar el rol de DRA**: se pidió sacar IDs, no verificar gente en
otro servidor.

⚠️ **LOS APODOS `#N` NO LLEGAN A SNAKE RAP**, a propósito:
`herramientas/sincronizar_puesto.py` tiene DRA y FFA escritos. Renombrar
gente en un servidor de 7.000 es una decisión de Dlx y de sus admins, no
un efecto de haber entrado.

#### Lo que la auditoría de ese día encontró, además

| | qué pasaba | arreglo |
|---|---|---|
| 🔴 | las **mismas 186 Bloqueadas** se redibujaban y subían en cada corrida | `bloqueadas_selladas.json` no se guardaba |
| 🔴 | el hub se **desplegaba en cada corrida** | `web_sello.json` tampoco |
| 🔴 | `dibujar` repetía el ciclo entero —y se comía el mismo 429— | `--solo-dibujar` arranca en el paso 3 |
| ⚠️ | la lista de `guardar.sh` se quedó corta por octava vez | ahora **avisa** lo que el ciclo cambió y no guarda |
| ⚠️ | `bot_en.json` tampoco se guardaba | con `--solo-dibujar` lo lee `dibujar` |
| ⚠️ | `utcnow()` deprecado, en el log de cada corrida | `now(timezone.utc)` |

#### Lo que espera a Dlx

1. **Makmah y Makma.** Las llaves dicen siempre «Makma 🇻🇪», y la cuenta
   verificada `makmah_g` tiene el rol Venezuela y el apodo «#2 | Makmah»:
   el sistema los junta y **parece bien**. Pero la hoja AKAs dice «DOS
   Makmahs (Dlx)» y `construir_akas` lo retracta en cada corrida. ¿Esa
   nota era de la pre-temporada?
2. **CJ, Eze y Noone** —los únicos de la T1 con candidatos y sin ID—:
   CJ 🇻🇪 casi seguro `@cj_kloke_`; Eze tiene cinco; Noone 🇵🇪 sólo
   `@001wanted100`, que es 🇨🇴.
3. **El Score Selección de la carta de País** sale de `datos/mundial.json`,
   que es de la **pre-temporada**. `docs/t1_que_se_mueve.md` dice que se
   deriva del pool (promedio del top 5) y `sheet/resetear.py` que se
   conserva: se contradicen. Nadie tiene la carta de País todavía.
4. **Los estilos**: Snake Rap tiene roles de estilo (PUNCH, INGENIO,
   POÉTICO, MÉTRICAS, FLOW…) y la Competitiva tiene 16 íconos sin dueño.
5. **13 del padrón con ID y sin país** que los roles de Snake Rap
   completarían: `pais_por_rol.py` no llena huecos y su escritor no está.

---

# Dónde quedamos — 23/09/2026

⚠️ **Leer esto antes que cualquier script.** Trae lo que cambió, lo decidido
y sin construir, y los puntos de retorno.

---

## LO PRIMERO QUE HAY QUE SABER: LA T1 ARRANCÓ DE VERDAD

Entraron los **dos primeros eventos** y todo el camino se recorrió con datos
reales por primera vez. Eso destapó más bugs en una noche que semanas de
lectura, y **casi ninguno fallaba**: salían números plausibles.

```
#349  EL RAP FECHA 5            FFA  22/09  ·  15 con puntos,  0 duelos (3v3)
#350  DESGRACIAS EN TOKYO VOL.1 FFA  23/09  ·   6 con puntos,  7 duelos 1v1
```

Estado al cierre: **19 personas en los dos pools**, que coinciden persona por
persona, y las cinco cartas salen —Temporada 19/19, Competitivo 19/19,
Servidor 330/330, País 18/18, Bloqueada 3/3—.

---

## 🔴 LO ÚNICO QUE ESPERA UNA DECISIÓN DE DLX

**Nada.** Lo que quedaba —el rango debajo de los 10 eventos— lo contestó
Dlx el 23/09/2026: *«el ranking competitivo no aparece nadie hasta q tenga
10 eventos. Mira los requisitos de las tarjetas… estas son preguntas con
respuestas muy sencillas»*. Aplicado: `Ranking Competitivo` pasó de 45
filas a **0**, y la letra desapareció de las tres hojas. El Sheet, la
página pública y la carta dicen lo mismo.

⚠️ **Yo lo había leído al revés** apoyado en *«el requisito bloquea la
carta, no el dato»*, que se escribió para otro caso —cuando el corte
sacaba gente del pool—. Ver la corrección en `CLAUDE.md`.

🎯 **Y LO QUE IMPORTA AHORA NO ES EL SHEET.** Dlx, en el mismo mensaje:
*«el sheet es antiguo la gran parte, estamos remodelándolo… tampoco es q
vayan a ver eso mucho ahora **porq la cosa es hacer el sv el hub**»*. O
sea que la prioridad es el **servidor como hub**, no seguir puliendo la
planilla ni el Apps Script.

### ~~Los roles de rango de Discord~~ — YA ESTABAN HECHOS

🔴 **Y ESTE DOCUMENTO SE CONTRADECÍA A SÍ MISMO.** Acá arriba decía que
eran 6 y que era la única tarea manual pendiente; **ochocientas líneas más
abajo** ya estaba la fila *«✅ 147 sacados, 0 quedan»*. La versión vieja
era la que estaba primero, o sea la que cualquiera lee.

Dlx, 23/09/2026: *«esos 6 roles ya es cosa vieja q te olvidaste
actualizar… son 8»*. Verificado contra Discord: los ocho existen en DRA,
de `Rango SSS` a `Rango E`, posiciones 107 a 100 y en el orden correcto.
Los IDs lo confirman — SSS y SS empiezan en `1550996…` y los otros seis en
`1502241…`, o sea que se crearon después.

⚠️ **La lección no es el dato viejo, es que era una afirmación sin
chequeo.** De las cinco filas de «dónde vive el rango», cuatro se
comprobaban solas y ésta decía «a mano»: lo que no se pregunta no se
entera de que ya se hizo. Ahora lo pregunta
`herramientas/roles_de_rango.py`, en la auditoría semanal.

🔑 **Y el nombre está en negrita matemática** —`𝐑𝐚𝐧𝐠𝐨 𝐒𝐒𝐒`, U+1D400 y
siguientes— así que buscarlo con `.upper()` da **cero** y parece que no
existe. Hay que pasar por `NFKD`. En mi primera corrida me hizo creer que
el documento tenía razón.

Todo lo demás de abajo está hecho o se puede hacer sin preguntar.

---

## LO DE LA SEGUNDA TANDA DEL 23/09 (después de las capturas de Dlx)

Dlx: *«si ya lo detecto que no me lo detecte mas»*, *«quizás el appscript
puede hacer un countdown»*, *«asegurate que el rediseño se note bastante»*.

### 1 · El aviso repetido: el dedup estaba bien y el archivo se perdía

`bot/avisar.py` deduplicaba desde el commit anterior y **andaba en esta
PC**. `datos/avisados.json` —su única memoria— no estaba versionado ni en
el `ARCHIVOS` del `.yml`, así que **cada corrida arrancaba sin memoria** y
volvía a anunciar todo. Un dedup cuyo estado no sobrevive no es un dedup:
es la misma forma que `mapa_viejo()` mirando `mtime`.

Y aunque persista, «mandar de nuevo si cambió» vuelve a sonar: el ciclo
relee las llaves cada hora **a propósito**. Ahora **edita el mensaje que ya
está** (PATCH). Discord no notifica una edición.

### 2 · 38 cartas fallaban con `path: unsupported mime type ""`

`pipeline.py` llama con los diez de la tanda en una línea; Temporada y
Competitivo leían `argv[2]` como el destino. Dibujaban **sólo al primero** y
lo escribían en un archivo llamado como el segundo. Ninguna de las dos
mitades estaba mal. El `.png` es el que decide, no la cantidad.

### 3 · El rediseño: `sheet/estilo.py`

Un solo lugar para las cinco vitrinas, y **todo el color sale de un dato**:
la celda de `Rango` con el color de ese rango (importado de
`comun/rangos.py`), oro/plata/bronce en el podio, Win% en escala, la racha
encendida sólo si está viva. Lo llaman **las dos rutas** de escritura —
antes las dos hojas que más se miran quedaban sin él porque no se rehacen.

⚠️ Dos reglas que costaron una vuelta cada una: `addBanding` sobre una hoja
que ya tiene banda es un **400 que tumba el batch** (o sea: la segunda
corrida rompe lo que la primera dejó bien), y las condicionales **se
apilan**. Por eso `_adornos()` las borra antes, y de atrás para adelante.

### 4 · `Rango` estaba vacío para todos, y era un candado

Estaba en `ARRASTRE`: cada fila copiaba el Rango de su propia fila
anterior. Tras el reset no había de dónde copiar → quedaba vacío → la
corrida siguiente tampoco tenía. **Una columna que se arrastra de sí misma
no tiene semilla.** El docstring decía «lo pone el pipeline del
Competitivo» y nadie lo ponía.

⚠️ Y al arreglarlo apareció otra cosa: el Sheet decía «B» y la página
pública decía «0 con rango». **Le puse un corte de 10 eventos y estaba
mal** — `CLAUDE.md` lo tiene escrito y razonado: *«el requisito bloquea la
CARTA, no el DATO»*, y el caso exacto — *«los 22 que caen se quedarían sin
rango en su Temporada, que sí tienen derecho a ver»*. Encima partía la
planilla en dos, porque `Ranking Duelos` saca el suyo del pool sin corte:
la misma persona con letra en una hoja y sin letra en la otra. Revertido.

🔴 **LO QUE QUEDA ABIERTO, Y ES DE DLX: el `MIN_EV_RANGO` de la página.**
Su valor sale del requisito de la **carta** Competitiva (10 eventos) y se
usa para decidir si mostrar el **rango** — dos cosas distintas. Hoy la
planilla muestra la letra desde el primer evento y la página dice «Falta N
EV … para tener rango». Las dos son defendibles; lo que no se puede es
tener las dos. **No lo decido yo**: cambiar la página es tocar lo que la
gente lee.

### 5 · La cuenta atrás, en dos piezas porque no hay otra

| dónde | resolución | por qué |
|---|---|---|
| **Lobby** (`E5:E7`) | **minuto** | es el recálculo más rápido que Sheets ofrece |
| **webapp** (`Index.html`) | **segundo** | es HTML: `setInterval` |

`bot/cuando.py` convierte «EN 30 MINUTOS» en una hora. **Contradice a
`anuncios.py` a propósito** y su encabezado dice por qué: el instante no se
inventa, sale de dos datos registrados —la hora del mensaje y el desfase
que declara—. Las horas absolutas **no** se parsean: «21:00» no dice de
cuál de los cinco husos de la Liga.

⚠️ La fórmula del Lobby **expira sola** a las 3 h. Sin eso los tres
anuncios reales —todos de ayer— salían con «▶ EN VIVO» permanente.

🔴 **`getProximos()` de `WebApp.gs` lee esa fórmula con un regex**: es un
contrato entre dos archivos que no se importan. Si cambia la forma de la
fórmula, el webapp devuelve `[]` y el contador **no aparece, sin fallar**.
Hay un test en `lobby.py --auto` con el mismo regex.

### 6 · El repo tenía una foto vieja del Apps Script

Medido: `Index.html` vivo tenía **178 bytes más** que el commiteado — el
bloque de los ocho rangos que `rangos.yml` publica sola. **Subir el del
repo habría devuelto la página pública a seis rangos.** Por eso
`sheet/webapp_subir.py` compara contra la versión **commiteada** y se
planta si alguien lo movió por afuera, y manda siempre los cuatro archivos
(la API reemplaza el proyecto entero: mandar uno borra los otros tres).

### 7 · El webapp ignoraba FFA y EFA

Mapeaba siete servidores y la vitrina tiene nueve. Como **toda la T1 es de
FFA**, la página mostraba a todos con 0 eventos en todos los servidores.
No fallaba: sumaba cero.

---

## LAS CINCO VITRINAS SE RECALCULAN SOLAS

Dlx, 22/09: *«no actualizaste los demás rankings»*, *«deberías hacer un ranking
duelos»*, *«actualizar el ranking mundial que ese evento fifa ya no se está
haciendo»*. Las cinco entran ahora al paso **1c** del ciclo.

| hoja | qué cambió |
|---|---|
| **Temporada** | cabecera en la fila 1, congelada, **+FFA +EFA** |
| **Competitivo** | el Score se **calcula** por primera vez (abajo) |
| **Podios** | su banner decía «Zignos 99 pts» con la T1 arrancada |
| **Duelos** | **nueva**. Ordena por ganados, no por Win% |
| **Mundial** | de selecciones a **países**: sin Fecha FIFA no hay torneo |
| ~~de Ligas~~ | **no entra**: `Pts FMS` y `PTB` son de ligas externas |

⚠️ **El Mundial cambió de sujeto a propósito.** Traía tres cosas mezcladas —las
selecciones, la Fecha FIFA y un «ranking pasivo»—. Lo que se cae es el torneo;
lo que queda en pie es el pasivo, que no necesita ningún evento. Una selección
la elige el capitán, así que sin Fecha FIFA la tabla diría **quién fue elegido**
y no quién rindió.

---

## EL SCORE COMPETITIVO EXISTE POR PRIMERA VEZ

`CLAUDE.md`: *«el rango sale del Score competitivo. Siempre»*. **Ese cálculo no
estaba en el repo**: el Score se *leía* del Sheet y el Sheet lo recibía pegado
desde un lugar que ya no existe. Con la T1 arrancada eso es **nadie con rango**,
y el rango aparece en las cuatro tarjetas.

Vive en **`sheet/competitivo.py`**.

```
Score = (0.30·E + 0.24·C + 0.21·Dm + 0.15·T + 0.10·V) × Confianza
```

**Verificado contra las 138 filas reales de la pre-temporada: peor diferencia
0.050**, que es redondeo.

| dim | qué mide | cuánto se comprobó |
|---|---|---|
| **E** | puntos / evento | **exacta** — Tuca lidera con 4.971 pts/ev y E=100; Konan 4.488 y E=90, o sea un máximo implícito de 4.987: 0,3 % de diferencia, que es la exclusión de MW |
| **Dm** | oros / eventos | **exacta** — 100·97·97·90 clavados |
| **T** | racha consecutiva en SF+ | **exacta** — 100·92·85·85 clavados |
| **C** | (podios+semis) / eventos | ±2 en dos de las cuatro primeras |
| **V** | distribución entre servidores | **inferida** — ver abajo |

⚠️ **La normalización también se midió: el líder del pool vale 100.** En las 138
hay **exactamente una** persona con 100 en E, en C, en Dm y en T. Es la regla
que `CLAUDE.md` ya tenía escrita desde el otro lado —*«sólo se resalta el 100:
significa liderar esa dimensión en todo el pool»*— y da cuatro cartas con un
100, que es el número que ese mismo párrafo dice.

⚠️ **Diversidad es la única inferida, y se sabe por qué.** Contar servidores no
alcanza: cuatro personas con **siete** servidores sacaban 80, 85, 87 y 78. La
Guía dice *«distribución, no sólo conteo»*, así que se usa **entropía**. No se
pudo comprobar porque el pool viejo guarda `srv` (cuántos) y no el desglose.

⚠️ **Que no reproduzca los números viejos no es un problema.** El Competitivo se
reinicia por temporada, así que la T1 arranca de cero igual. Lo que hace falta
es que esté **definido, documentado y reproducible**.

---

## 🔴 LOS DUELOS SE DUPLICABAN CADA HORA, Y ERAN TRES CAUSAS ENCADENADAS

```
corrida 1:  #350 →  7 duelos    29 batallas leídas
corrida 2:  #350 → 14 duelos    42 batallas
corrida 3:  #350 → 21 duelos    55 batallas
```

`Resultados` quedaba **igual** en las tres —`guardar()` es idempotente— así que
no se veía. `1v1` no.

1. **El ciclo no vaciaba `Entrada`.** El lector **agrega**, y Discord sigue
   mostrando las mismas llaves. Ahora el paso 1 corre con `--limpiar`.
2. **Y `--limpiar` no vaciaba del todo.** Borraba `len(batallas)+6` filas, y
   `leer_entrada()` **saltea** las filas sin evento o sin ronda: con un hueco
   en el medio el rango se quedaba corto. Medido: después de un `--limpiar`
   que dijo «Entrada vacía» **sobrevivían 10 filas**. Ahora vacía el área
   entera y **comprueba leyendo**.
3. **Nada impedía repegar una batalla que ya estaba.** Agregado el dedup contra
   lo que la hoja ya tiene. Es la red de abajo: **un error que se compone no
   puede depender de una sola guarda.**

⚠️ **Y esto conecta con cómo funciona el lector, que conviene tener claro:**
**no se entera de que hay una llave nueva — relee todo cada hora y las
reconoce por su forma** (dos rondas distintas y dos líneas de batalla). Lee los
últimos N mensajes de cada canal y **no** usa `after`, porque el **96 % de las
llaves se edita después de publicada**: con `after` el mensaje se lee una vez,
vacío, y su estado final no vuelve nunca.

**Por eso el dedup es la mitad del sistema.** Cualquier eslabón que acumule en
vez de reemplazar duplica **una vez por hora**.

---

## EL LECTOR PERDÍA LA MITAD DE CADA LLAVE

Dlx pidió ir a buscar la llave original y compararla. El mensaje de «EL RAP
FECHA 5» tiene **7 batallas, final y campeón declarado**. Habían entrado 4,
sin final y sin campeón.

Una sola causa: **equipos partidos en dos líneas** —el `⌞` en una y el `⌝` en
la siguiente—. O sea que **los 10.000 puntos del campeón y los 7.500 del
subcampeón no se le asignaron a nadie**, y el evento quedaba ✅ en
`Eventos Procesados`.

`unir_continuadas()` en `bot/escuchar.py` junta esas líneas con **tres señales
exactas y ninguna heurística de «parece corta»**:

- un `⌞` sin su `⌝`
- hay un «vs» y **no** hay dos competidores — el rival está abajo. Este caso ni
  siquiera desbalancea: `⌞lord+camila+dxg⌝ <VS>` cierra bien
- la línea termina en `+` — es la del campeón, que sigue abajo

Resultado: **7 de 7** y el campeón entero. En el Sheet, de 6 filas a **15**.

---

## LOS EQUIPOS: LAS DOS REGLAS YA ESTABAN ESCRITAS Y MIRABAN LA COMA

Dlx, 22/09: *«se reparten entre los 3 pero no cuenta para Duelos»*. **Las dos
mitades ya estaban en el código**: `motor.sumar()` hacía `pts // len(ms)` y
`resultados._filas_uno()` descartaba del `1v1` los lados de equipo. Y las dos
partían por **coma**, cuando la gente escribe `sosa+papa+bna`.

Nunca se activaron, y nada falló. El separador vive ahora en
**`sheet/equipos.py`**, con los dos —`+` y `,`— y sin `&` ni « y »: partir de
más junta a dos personas en una.

⚠️ **Un `+` suelto al final no es un individuo: es un equipo cortado.**
`⌞Hassan🇪🇬 +` tratado como persona le daría el puesto completo de un equipo de
tres.

---

## LA CADENA DE ERRORES QUE SÓLO APARECE CON DATOS

Todos de la misma familia: **una fuente que ERA equivalente y dejó de serlo**
cuando los requisitos se partieron en cuatro el 16/09.

| dónde | qué pasaba |
|---|---|
| `construir_pool_temporada` | piso de **8 eventos**, de cuando el 8 era un corte único. Con la T1 de cero, **nadie recibe carta durante semanas** — y 5 de 6 tenían carta de la pre en R2, así que `/card` les servía el OVR de una temporada borrada |
| el país de los bloqueados | salía sólo del emoji del nombre; la rama del pool ya preguntaba al padrón. **Dos ramas, una sabía** |
| `puedo_generar` | preguntaba al pool **competitivo** a quién dibujar, para las cuatro cartas. Informaba «Temporada **1 de 0**» |
| `04_Pais/generar` | recorría el pool competitivo: con 0 salía con **código 0, sin imprimir nada** |
| `01_Temporada/normal_v3` | importaba `comun` **ocho líneas antes** de poner la raíz en `sys.path` |
| `ovr_nacional()` | dividía por cero con el pool competitivo vacío |
| la carta de País | buscaba `sv_.png` con el servidor vacío → **no salía la carta** |
| `gencomp` | `float(wr)` con `wr` vacío → **tumbaba las 15 cartas**. Sin duelos no hay Win%, y eso es el estado normal al arrancar |
| `1v1` | guardaba el **nombre crudo de la llave** y `Resultados` el resuelto: la misma persona entraba dos veces. Siete de ocho filas del primer Ranking Duelos salieron **sin servidor y sin rango** |
| `Rapero` en `ARRASTRE` | la hoja conservaba **la grafía vieja para siempre**: `MAKMA` contra `Makma` como personas distintas |

---

## LO QUE APARECIÓ DE FONDO Y VALE MÁS QUE CADA BUG

### El sistema sabía poner y no sabía sacar

A *«sacame de ahí»* no había con qué contestarle. **`bot/olvidar.py`** borra
todo lo de alguien y lo anota en `datos/olvidados.json`, que
`verificados.pasa()` lee — ahí y no en cada paso, porque son cinco los que
llaman a esa función.

⚠️ **Y busca por grafía normalizada contra el listado de R2**, no por la clave
que el código armaría hoy: **19 personas tenían DOS fotos** bajo dos grafías.
Un borrado que arma la clave con el código de hoy se lleva una y **deja la
otra**.

### Un «esperá» de Google no puede tirar una corrida entera

El ciclo murió con `429 Quota exceeded` **después** de cargar dos eventos y
escribir las cinco vitrinas. La cuota de Sheets es **por minuto**: no es una
falla, es un «ahora no». `sheet/reintentar.py`.

⚠️ Y el primer intento de arreglarlo **estaba envuelto por la mitad**: en
`_leer(sh.worksheet('X').get_all_values)` Python evalúa `worksheet(...)`
**antes** de entrar al reintento, y esa llamada también pega a la API.

### Una conclusión vieja sobrevive al hallazgo que la deshace

`Último Resultado` estaba dado por imposible —*«pide que la fecha sea
ordenable»*— por el mismo motivo que la racha… **que ya se había resuelto**
ordenando por `Evento #`. Quedó una columna dada por perdida con la respuesta
tres funciones más arriba.

### Una alarma que pide un arreglo imposible enseña a ignorar la alarma

El ciclo avisaba que el mapa campo→carta estaba viejo y mandaba a regenerarlo
— y con los pools en 0 ese comando **no puede funcionar**.

---

## LO QUE FALTA, SIN NECESITAR A NADIE

1. **Que el ciclo corra limpio de punta a punta en la nube.** Cada corrida
   destapó algo distinto; la última fallaba por cuota, ya aguantada.
2. **El Lobby calculado.** Dice «Pre-Temporada · 735 raperos · 348 eventos».
3. **La fecha con año** en `Resultados` y `1v1`. No bloquea nada hoy —el
   `Evento #` ordena— pero es la forma correcta.
4. **Las llaves de 3 bandas.** `A vs B vs C` se cuenta como limitación conocida
   y no se carga. Es una fila de las 13.
5. ~~**Sacar los 116 MB de `_avatares/` del repo.**~~ **MEDIDO EL 23/09/2026,
   y el motivo por el que estaba pendiente NO SE SOSTIENE.**

   CLAUDE.md pedía volver a medirlo el día que se borrara, porque el argumento
   había pasado de *«R2 cubre todo lo que cubre git»* a *«lo que R2 no cubre
   no se usa»* —más débil—. Re-medido:

   | | |
   |---|---|
   | fotos en `_avatares/` (git) | **422** |
   | fotos en `comun/fotos/t1` (R2) | **424** |
   | **en git y NO en R2** | **0** |

   Los **siete** que ESTADO.md listaba como sólo-en-git —Fakin Jose, HN 56,
   Kun Z, Lázaro, Lucas 123, Mr Still Ballin y Rune WS— **ya están los siete
   en R2**. O sea que vuelve a valer la versión fuerte: borrar no pierde nada.

   ⚠️ **PERO NO VALE LA PENA HACERLO, Y ESO ES LO NUEVO.** El motivo era el
   peso del repo, y medido contra la corrida real: el `checkout` tarda **10
   segundos de un job de 34 minutos**. Sacar 116 MB de los 451 versionados
   ahorra ~3 s. No es un problema que exista.

   🔴 **El único argumento que sí queda es la PRIVACIDAD, y pide otra cosa.**
   Son 422 fotos de personas reales versionadas; `CLAUDE.md` ya usa ese
   razonamiento para mantener `comun/fotos/` gitignoreado —*«el historial de
   git las volvería permanentes, también para quien después se vaya»*—. Pero
   un `git rm` **no las saca del historial**: eso pide reescribirlo, que es
   una decisión de Dlx y no una tarea de mantenimiento.

---

# ═══════════════════════════════════════════════════════════════
# LO DE AYER — 22/09/2026
# ═══════════════════════════════════════════════════════════════


---

## 🔴 LO MÁS GRAVE DE HOY: EL SISTEMA NO SABÍA EMITIR UNA PRIMERA CARTA

Tres lugares sacaban «a quién hay que dibujarle» de `datos/cartas_r2.json`, o
sea **de a quién ya se le había dibujado**. Huevo y gallina, y pega justo en
el caso que importa durante la prueba de FFA: **quien se verifica hoy no
recibe su primera carta nunca.**

```
pasan el portón de identidad   319
se dibujaban y escribían       312
```

Los siete: KRT, Bull12r, Makmah, elzurdo, yinn, Flennzs y MILICA. Tienen
Discord ID, país y el rol Miembro de DRA. Su única falta era no tener ya una
carta, y `/card` les decía **«todavía no estás verificado»** — la respuesta
equivocada con la cara de la correcta.

Arreglado en `03_Servidor/generar._los_de_cero()` (recorre el padrón filtrado
por el portón) y en `bot/subir_datos.armar()` (la **unión** del inventario con
los que pasan, porque el ciclo sube la carta *después* de armar KV).

## Lo demás que entró hoy

| | |
|---|---|
| **la identidad, al ciclo** | `verificados.json` y `servidores_de.json` se refrescaban a mano. El segundo estaba **3 días viejo**: al refrescarlo, 19 personas entraron, 11 salieron y **5 cambiaron de servidor** — o sea 5 con la carta del servidor equivocado y 19 sin la suya, en silencio. Ahora es el paso **1b** de `bot/pipeline.py` |
| **las Bloqueadas, al ciclo y con sello** | son la única carta cuyo contenido es un **contador**, y el paso que decidía redibujar preguntaba si el archivo *existía*. Se dibujaban una vez y se quedaban con ese número para siempre. Sello = hash del HTML. Paso **5b** |
| **`--solo-meta` reventaba** | `UnboundLocalError` en su última línea. La tanda de DRA dibujó y subió sus 311 cartas y murió ahí, así que `meta` no se escribió y FFA nunca arrancó |
| **las cartas de servidor** | redibujadas con la lista corregida: **DRA 319/319, FFA 205/205** en R2 |
| **un rol de rango sobrevivió al vaciado** | 𝘾𝙍𝙊𝙉𝙊𝙓, rango C. Se lo sacó: ahora sí están los 148 en cero. Lo encontró el `roles --dry` del repo de sync |

## El repo de sync existe, y esto decía que no

`underraponline-lgtm/liga-global-sync`, 1.700 líneas, corre solo a las **08:00
UTC**. `CLAUDE.bot.md` decía *«el archivo no existe»*. Tres commits hoy, con
su README (tenía una línea). Lo importante para la próxima sesión está en
`CLAUDE.bot.md`, en la tabla de **qué le toca a cada repo**.

⚠️ **Los apodos: el 🐉 se hereda, el 👤 rige de acá en adelante.** Dlx lo pidió
en tres mensajes y el alcance venía en el tercero. Medido antes de tocar:

| prefijo | en DRA | en el padrón | |
|---|---|---|---|
| `#N` | 25 | 25 | 100 % |
| `🐉` | 318 | 299 | 94 % |
| `👤` | 1.860 | 5 | 0 % |

O sea que 🐉 marca «este es de la Liga» y 👤 lo pone otro bot. Cambiar sólo la
constante habría reescrito ~300 apodos en la primera corrida.

## 🔑 `ACCESOS.md` — todas las credenciales, en un solo lugar

**Está en la raíz y en `.gitignore`.** Nació el 22/09/2026 porque las
credenciales vivían en **cinco** lugares —`.env`, `creds.json`,
`oauth_token.json`, los secrets de los dos repos y los bindings de
Cloudflare— y no había ninguno que dijera *cuáles son todas*.

⚠️ **El síntoma de no tenerlo fue pedir algo que ya estaba hecho.** Ese mismo
día se reportó que faltaba `CLOUDFLARE_API_TOKEN` en el repo de sync **y
estaba cargado desde el 20/09**: el aviso venía de una corrida local donde no
se había exportado. Medir el lugar equivocado se parece mucho a medir bien.

Trae qué abre cada credencial, dónde está cargada, qué se rompe si cambia en
un lado y no en los otros, y **la lista de qué rotar al final y en qué orden**
—que es lo que Dlx pidió dejar para el cierre—.

🔴 **No se commitea nunca.** Si entra al historial hay que rotar **todo** lo
que contiene; borrarlo en el commit siguiente no alcanza.

## Necesitan a Dlx

1. ~~**`CLOUDFLARE_API_TOKEN`**~~ **estaba puesto desde el 20/09.** Verificado
   con `gh secret list`: el aviso era de una corrida local sin exportarlo.
2. ~~**La Consola no tiene fila «Temporada»**~~ **hecha el 22/09**: dice
   `T1 · 👤`, o sea que el emoji ya es una **decisión registrada** y no el
   valor que quedó escrito en una constante. Lo confirma
   `sync.py nicks --dry`: «Emoji de temporada: 👤».
3. ~~**Los 25 `#N` de la pre-temporada**~~ **limpiados el 22/09.** Dlx:
   *«obviamente eso de la pre-temporada es viejo, elimina, saca eso»*. Se
   corrió `sync.py nicks --reset`. Medido antes y después en DRA:

   | prefijo | antes | después |
   |---|---|---|
   | `#N` | 25 | **0** |
   | `👤` | 1.860 | **1.885** |
   | `🐉` | 318 | **318** |

   Los dragones quedaron intactos, que era la otra mitad de lo que pidió.
4. ~~**4 personas sin duelo nacional posible**~~ **cerrado.** Dlx: *«Emiratos
   y Brasil no deberían existir, no se les toma en cuenta. Cuba y Nicaragua
   eventualmente se unirán personas, pero nada que pueda hacer»*. No se borró
   nada —sacarles el país les sacaría **todas** las cartas, porque el portón
   pide bandera— y la de País simplemente no se les emite. Ver `CLAUDE.md`.

**No queda nada esperando a Dlx.**

---

# Lo del 21/09/2026, que sigue vigente

## 🔴 LO MÁS GRAVE DE ESA TANDA: OCHO GANADORES INVENTADOS

Medido sobre las 25 llaves vivas. La rama de la línea `CAMPEÓN` de
`bot/escuchar.py` hacía `_parecido(camp, b) or camp`: cuando el texto
capturado no enganchaba con nadie, **devolvía el texto crudo como ganador**.

```
'DEL TORNEO ``🏆``'
'__** <@1345962362615894027> <@1471344428064178248>'
'GEOKA 🇦🇷 + CYK 🇦🇷 + AGUS 🇦🇷'
```

**8 de 202 batallas.** No es un hueco: es peor. Un hueco va a `Pendientes` y
alguien lo mira; esto entra a `Resultados` como puntos de una persona que no
existe, y de ahí al ranking, al rango y a las cuatro cartas. Arreglado: el
campeón tiene que ser **uno de los que pelearon**.

```
antes          176 de 202 «resueltas»  — 8 inventadas
ahora          168 de 202 resueltas    — 0 inventadas
con el padrón  170 de 202 resueltas    — 0 inventadas
```

Tres cosas más que aparecieron mirando las líneas de verdad:

| | |
|---|---|
| `SUBCAMPEON` matchea `CAMPEON` | anda **por el orden en que la gente escribe**; una llave que anuncie sólo al subcampeón daba el ganador dado vuelta |
| `:1ER PUESTO:` | forma real: 24 de 25 dicen CAMPEON y una dice eso |
| `:flag_ve:` | los shortcodes no se limpiaban: `CAMPEON:OG:flag_ve:` no enganchaba con `OG` |

✅ **Y el padrón resuelve la mención.** Tres finales dicen
`CAMPEÓN: <@979878316846768139>` mientras los competidores van por nombre;
con los 498 Discord ID se recuperan 2 — y son **finales**, o sea el campeón de
dos eventos.

⚠️ **`ids` es una LISTA por ID y no un nombre**, porque hay uno repetido
—`979878316846768139` figura como **Oasis** y como **Fullylo4ded**— y el que
decide tiene que ser cuál de los dos peleó.

### Y una llave reposteada entraba como DOS eventos

Dlx lo describió: *«a veces eliminan las llaves x error pero lo vuelven a
poner, y eso sería otro mensaje ID»*. `agrupar()` existe para eso, resuelve
bien que son el mismo evento — y **su resultado no lo usaba nadie para
nombrar**: cada mensaje escribía su propio `titulo()`.

```
titulo()                 «solo para NOMBRARLO, nunca como clave»
numeros_por_evento()     keyea por (nombre, servidor, fecha)
```

Cada mitad es defendible; juntas, lo que un módulo declara inservible como
clave es exactamente lo que el otro usa de clave. Dos nombres → dos números de
evento → **el evento contado dos veces**, que es el único error de esa cadena
que su propio docstring dice que *no se arregla volviendo a correr*.

🔴 **Y `agrupar()` fallaba justo en el caso para el que existe.** El plantel
salía de la **primera ronda**, y lo que se repostea suele ser la versión *con
la ronda que faltaba*: esa ronda nueva **reemplaza** el plantel entero. Medido
con un caso de cuatro, el parecido entre una llave y su propia repostada caía
a **0,20**. Ahora es la unión de todas las rondas, y sobre las 25 llaves vivas
no fusiona nada que antes estuviera separado (25 → 25 grupos con las dos
versiones).

⚠️ **Lo destapó el auditor, no yo.** `chequeo_que_no_chequea` dijo que mi
chequeo nuevo «no se entera» al romperle `IGUAL` — y tenía razón: las dos
llaves del caso de prueba tenían planteles idénticos, así que agrupaban con
cualquier umbral. Al armar el caso realista apareció el bug de verdad.

### Dos cosas de datos que son de Dlx, no del código

| | qué pasa si no se toca |
|---|---|
| **el Discord ID repetido** | la clave `d:<id>` es un mapa: el segundo se lleva la carta del primero. `subir_datos.py` ahora lo **avisa** en vez de pisarlo callado |
| | ⚠️ **y hoy está pasando en KV**: `d:979878316846768139` → `oasis`, o sea que **Fullylo4ded no puede usar `/card`** — le sale la carta de Oasis. Cuál de los dos es esa cuenta es identidad, así que lo decide el padrón, no el código |
| **`fully` no es un AKA de `Fullylo4ded`** | es la única mención que queda sin resolver: el organizador escribió `fully` y el padrón dice `Fullylo4ded`. Agregarlo a la hoja `AKAs` la cierra |

---

## 🟢 EL CICLO YA CORRE SOLO

Dlx, 20/09: *«la estructura ya está hecha, solamente falta que resuelvas y
hagas el código para que todo se automatice»*. Eso es lo que se construyó.

```bash
python bot/pipeline.py            # simulacro: dice qué haría
python bot/pipeline.py --correr   # lo hace
```

```
Sheet ──> pools ──> qué cambió ──> caras (R2) ──┐
                                                │  por tanda de 10:
                                                └──> dibujar ──> R2 ──> sello
                                                                     y al final KV
```

Cada pieza ya existía y **nada las encadenaba**: eran cinco comandos que
alguien tenía que acordarse de correr en orden. `.github/workflows/ciclo.yml`
lo dispara **diario a las 09:00 UTC** —una hora después del sync de
identidades de las 08:00, o el ciclo dibujaría con el padrón de ayer— y
también a mano.

### Lo que lo hace viable: no redibuja todo

⚠️ Una tanda completa son **~26 min** y Actions da **2.000 al mes**: redibujar
todo después de cada evento se come el 40 % del mes para que el 99 % de las
cartas salga idéntica.

`bot/que_cambio.py` contesta **quién cambió y qué carta suya quedó vieja** —no
«cambió algo»—. Usa `datos/campos_por_carta.json`, que **está medido**:
`herramientas/que_pide_cada_carta.py` envuelve el pool en un dict que anota
cada clave que alguien le pide y dibuja las cuatro cartas de verdad.

```
cambia `pts`    -> sólo la Temporada
cambia `score`  -> las cuatro
```

Probado: 4 de 139 personas en vez de todo. **Y un ciclo sin cambios termina en
0.0 s**, que es lo que permite correrlo seguido.

⚠️ **Si un campo no está en el mapa, se redibujan las cuatro.** Puede ser uno
nuevo, y darlo por «no lo usa nadie» apuesta a que la medición está al día.

### 🔴 Va en TANDAS, y sin eso se trababa solo

Medido: **1,7 min por persona** (sus 4 cartas más las 9 por servidor, un
proceso por carta). El job cortaba a los 30 → **17 personas**. Y como el
sello iba al final, un job que moría **no sellaba nada**: la corrida
siguiente rehacía todo y moría en el mismo lugar. Para siempre.

⚠️ **Y no era un caso raro.** El Score sale del ranking del pool entero, así
que el primer evento de la T1 le cambia el Score a **todos** — la corrida
más común de las grandes era justo la que se trababa.

Ahora son **tandas de 10** y cada una se sube y se sella antes de la
siguiente: una corrida cortada pierde como mucho la tanda en curso y la
próxima arranca donde quedó. **Avanza siempre.** El `timeout` del job pasó a
120 min para que una corrida grande termine en dos días y no en ocho.

⚠️ **Arriba de 50 personas avisa que a mano es más rápido** — los scripts en
tanda levantan un solo Chromium y hacen las 1.794 en ~95 min contra 235 — y
sigue igual. No cambia de camino solo a propósito: un segundo flujo con otra
forma de subir y sellar sería uno que casi nunca corre, y uno que casi nunca
corre no está probado el día que hace falta.

### El sello, y sus cuatro reglas

`datos/cartas_selladas.json` — un hash por persona y por carta, con la forma
`<datos>:<código>`.

- **Va después de subir**, nunca antes. Al revés, una corrida cortada deja el
  sello diciendo que todo se dibujó y **los cambios se pierden para siempre**.
- **Sólo se sella a quien se subió.** Los que fallaron quedan sin sellar a
  propósito, para que el próximo ciclo los reintente solo.
- **Es un hash, no un volcado**: va commiteado —Actions lo necesita entre
  corridas— y los pools enteros serían 200 KB por corrida en el historial.
  Son 25, y el diff de git muestra qué persona y qué carta cambió.
- 🔴 **Mira el CÓDIGO además de los datos, y eso es del 21/09.** Antes
  hasheaba sólo los datos, así que un arreglo al dibujo **no redibujaba
  nada**: los datos eran idénticos, el sello no veía diferencia y la carta
  quedaba vieja en silencio con el ciclo diciendo «nada cambió» todos los
  días.

  ⚠️ **Ya pasó tres veces y está en `CLAUDE.md`.** La Competitiva *«tenía
  las fotos y dibujaba la inicial en 93 de 112»* fue código puro, con cero
  cambios en el pool; lo mismo el arreglo del emoji y el de los avatares.

  Vive en **`comun/huella_codigo.py`**, con su self-check. Por AST y no por
  bytes, así un comentario no dispara 138 cartas — medido sobre 89 commits:
  9 disparos por AST contra 10 por bytes, y los 9 son cambios reales.

### Y `mapa_viejo()` no detectaba nada en Actions

Comparaba **mtime**, y un `git checkout` le pone a todos los archivos la hora
del checkout. O sea que en la nube —el único lugar donde el ciclo corre
desatendido— la comparación no encontraba nada nunca. Ahora la huella viaja
dentro de `campos_por_carta.json` y sobrevive al clone.

⚠️ **Y contesta una pregunta distinta de la del sello**, aunque use la misma
cuenta: el sello pregunta «¿hay que redibujar?» y ya se contesta solo; esto
pregunta «¿el mapa campo→carta se quedó corto?», que es peor y más callado —
si un generador empieza a pedir un campo nuevo y el mapa no lo sabe, ese
campo **no dispara nada nunca más**.

### 🌎 EL PAÍS SALE DEL ROL DE LOS TRES SERVIDORES — 21/09

Dlx lo dijo en plural —*«basado en el rol q tenga los servidores, pero
dando prioridad a DRA»*— y `sheet/pais_por_rol.py` leía **sólo DRA**.

| | roles de país | miembros con país |
|---|---|---|
| DRA | 18 | 1.465 |
| **FFA** | **10** | **246** |
| **LIVONIA** | **21** | **677** |

🔴 **Y DRA SÍ TIENE ROL DE USA: faltaban CUATRO países en la tabla.**
Dlx: *«DRA sí tiene rol de USA. Fíjate bien»*. Lo tiene —`🔵﹒U.S.`— y
también `Costa R.`, `Puerto R.` y `Republica D.`. DRA tiene **22** roles
de país y la tabla tenía **18**.

**Los cuatro están abreviados con punto**, y ese es el patrón: quien
armó la lista buscó nombres completos y ninguno matchea. No fallaba,
callaba — una tabla de 18 se ve completa y esa gente caía a la columna.
**Medido: DRA pasa de 1.465 a 1.571 con país, 106 personas más.**

⚠️ **Lo peor fue que el hueco se escribió como un hecho.** El encabezado
del archivo afirmaba que *«DRA NO TIENE ROL DE USA, así que la regla 1
no se puede resolver por rol»* — o sea que la regla que Dlx puso
**primera** quedó documentada como imposible cuando faltaba una línea.
Leyendo el archivo no aparece: afirmaba lo contrario con seguridad.

⚠️ **Y el chequeo que escribí para que no vuelva a pasar falló dos
veces**: primero por nombre completo (perdía los abreviados) y después
con un regex de forma que tenía el codepoint equivocado —U+FE50 en vez
de U+FE52— y **matcheaba cero roles**, o sea devolvía «no falta ninguno»
sin mirar nada. Ahora **no decide: lista los 15 candidatos** para que
una persona mire.

🔴 **Y el rol de España de LIVONIA usa la bandera equivocada.** Es
`⌜🇪🇦⌟╢España`: **🇪🇦 es Ceuta y Melilla**, no España. Las **61 personas**
con ese rol derivaban a `ea`, y `04_Pais/banderas/ea.png` no existe —su
carta saldría sin bandera—. Se encontró comparando el conjunto de países
de cada servidor contra el de DRA: LIVONIA tenía `ea` de más y `es` de
menos, dos anomalías que eran la misma. Ahora el ISO **se valida contra
`04_Pais/banderas/`** —16 archivos, que es la respuesta a «ese país
existe para nosotros»— y si la bandera da algo que no está, manda el
texto del rol.

⚠️ **LIVONIA es `solo_identidad` y eso NO lo excluye.** Sus eventos no
cuentan para la Liga, pero su rol de país es exactamente lo que está ahí
para dar. Dlx, 21/09: *«ese solo reconocimiento de IDs y banderas»*.

⚠️ **El mapa de FFA/LIVONIA se deriva de la bandera del nombre; el de
DRA va por ID.** No es capricho: los de DRA se llaman `🔴﹒Perú`, con un
círculo de color, así que no hay de dónde sacar el país sin una tabla a
mano.

Resultado: **26 de 28 ya estaban bien, ningún cambio aplicado**, y
aparecieron **dos contradicciones antes invisibles** —Revo (hn/ve) y
Henry (bo/ve), con rol distinto en servidores distintos—. No se tocan.

⚠️ **Lo que queda y es de Dlx:** el script sólo mira
`contradicciones()`, así que las **8 personas sin país que sí tienen rol
en FFA/LIVONIA** siguen sin él. Llenar huecos es otra operación que
arreglar contradicciones.

### ✅ ENCENDIDO — y esto decía que faltaban tres cosas

Al 21/09/2026 las tres están:

1. **El remoto**: `underraponline-lgtm/liga-global-tarjetas`, privado.
2. **`CREDS_JSON` y `ENV_FILE`** cargados, y el workflow verifica que
   llegaron **enteros** y no sólo que existen — un JSON con un byte de más
   existe y no parsea, y el fallo aparece tres pasos después dentro de
   gspread, con un error que no dice la palabra «secret».
3. Lo demás lo resuelve el propio workflow.

Corrió verde en Actions en **53 s**. Sigue andando igual a mano:
`python bot/pipeline.py --correr`.

✅ **Y el tercer secret, `OAUTH_TOKEN`, también** — ver «el rango también se
publica solo». Ya no queda nada que dependa de esta máquina.

### 🟢 DE DÓNDE SALEN LOS EVENTOS — resuelto el 21/09

Era el agujero grande: el ciclo llegaba del Sheet a Discord, pero **nada
llegaba AL Sheet**. Los 348 eventos de la pre se procesaron a mano y su
detalle no quedó guardado.

### Las llaves se detectan solas, sin configurar ningún canal

**`bot/escuchar.py`.** Dlx: *«te dije que todo debería ser automatizado
no?»* — y tenía razón, yo había ofrecido dos caminos manuales (configurar
el canal de cada servidor, o pedirle un `/cargar` al organizador). Los dos
sobran: **una llave se reconoce por su contenido**.

Medido sobre **129 canales y 1.728 mensajes** de los cuatro servidores:

```
mensajes que dan LLAVE     28  (1,6 %)
  FFA      ✦🔐︱llaves      21 de 25
  LIVONIA  『🔐』𝑳𝑳𝑨𝑽𝑬𝑺       7 de 11
```

**Cero falsos positivos en los otros 127** — charla, staff, bots. Y el
caso que cierra la discusión: buscar por **nombre** de canal decía que
LIVONIA no tenía ninguno, porque el suyo se llama `𝑳𝑳𝑨𝑽𝑬𝑺` en unicode
estilizado. El contenido lo encontró igual, sin que nadie lo configure.

⚠️ **La firma son DOS condiciones**: dos rondas distintas **y** dos líneas
de batalla. Con una sola entra cualquiera que escriba «octavos» o «yo vs
vos».

### El ganador sale de la ronda siguiente

Regla de Dlx: *«Octavos: A vs B. Cuartos: B vs C. ¿Quién ganó en octavos?»*.
Sobre 100 mensajes reales: **73 %** resuelto (63 % por progresión, 10 % por
la línea `CAMPEÓN:`). De las batallas que **tienen** ronda siguiente, el
**83 %** deja un solo ganador.

Lo que no cierra —91 finales sin campeón, 61 sin nadie después, 28 donde
pasan dos o tres— va a `Pendientes`. Nunca a una suposición: los puntos
equivocados no se ven y se propagan al ranking, al rango y a las cartas.

### La identidad de un evento es el PLANTEL, no el ID ni el título

Dlx: *«a veces eliminan las llaves x error pero lo vuelven a poner, y eso
sería otro mensaje ID»*. Medido sobre **8.515 pares** de llaves reales:

```
pares con 60 % o más de la misma gente:    0
parecido promedio entre eventos distintos: 0.03
```

Dos eventos distintos casi no comparten gente, así que el plantel es una
huella limpia: una llave republicada se reconoce aunque cambie el ID.

⚠️ **El título NO sirve de clave, aunque el 80 % lo tenga**: se reutiliza.
`llave1` aparece en 6 mensajes repartidos en 28 días, `rrpitolachaleco` en
44, y uno se llama literalmente `nombre`.

⚠️ **Y un mensaje borrado desaparece del historial**, así que en el caso
normal ni siquiera hay qué deduplicar: sólo se ve la versión que quedó.

### El bot NO lee en tiempo real, y eso es una ventaja

Consulta por horario; no hay un oído abierto. Tiempo real pediría una
conexión *gateway* sostenida, o sea una máquina prendida siempre.

⚠️ **Y leer más tarde es MEJOR: el 96 % de las llaves se edita después de
publicarse** (193 de 200). El organizador sube el cascarón y lo completa
mientras corre el evento. Leer en vivo daría la llave vacía.

⚠️ **Eso obliga a releer, no sólo a pedir lo nuevo.** Una llave del lunes
completada el martes nunca vuelve a aparecer en un `after=<id>`: hay que
comparar `edited_timestamp`.

**El costo, medido el 21/09/2026 con las dos corridas seguidas:**

| | por corrida | encuentra | cada hora, al mes |
|---|---|---|---|
| barrer los 130 canales | 45,5 s | 25 llaves | ~720 min de 2.000 |
| revisar los 2 donde hay llaves | **0,6 s** | **las mismas 25** | ~6 min |

Así que van dos cadencias: **barrido completo diario** para descubrir
canales nuevos, **chequeo dirigido el resto del tiempo**. La demora real
es ~1 h.

✅ **APLICADO EL 21/09/2026.** Vive en `bot/escuchar.py`: `conocidos()`
recuerda en `datos/canales_llaves.json` dónde apareció una llave,
`toca_completo()` decide la cadencia y **`escuchar()` es lo que hay que
llamar** — `barrer()` sigue existiendo y no elige nada, así que quien la
use directo se queda con el completo para siempre.

⚠️ **Y `canales_llaves.json` se commitea en el ciclo.** Sin eso cada
corrida de Actions arranca sin memoria, cae al completo y la
optimización no existe — sin fallar, sólo saliendo cara.

✅ **El `cron` pasó a `0 * * * *` el 22/09/2026**, que es justo lo que
esta optimización hacía posible.

🔴 **Y SE SACÓ EL `desde=` DE `barrer()`, QUE ERA UNA TRAMPA.** Pedir
sólo los mensajes `after=<último visto>` es la optimización obvia y acá
está mal por lo que dicen las dos líneas de arriba: la llave se completa
**editando el mismo mensaje**, así que su estado final no vuelve a
aparecer nunca. Se ahorra poco y se pierde casi todo, en silencio. Lo
que sí es gratis es mirar **menos canales**, no menos mensajes de cada
canal.

### La cadena, y dónde sigue cortada

| paso | estado |
|---|---|
| leer la llave del canal | ✅ |
| sacar los ganadores | ✅ 73–86 % |
| escribirlo en `Entrada` | ⏸️ construido, apagado hasta el reset |
| `Entrada` → `Resultados`/`1v1` | ✅ paso 1 del ciclo |
| `Resultados` → la vitrina | ⏸️ construido, se enciende solo |
| vitrina → pools → cartas | ✅ |

**Ya no queda ningún eslabón sin construir.** Los dos en pausa lo están
por el mismo motivo y ninguno necesita código nuevo: hoy escribirían
datos de la pre-temporada en hojas que `resetear.py` va a limpiar, o
recalcularían la vitrina desde un `Resultados` vacío. El quinto además
se destraba **solo**: su primera puerta es «¿hay filas en `Resultados`?»,
y esa se abre con el primer evento de la T1.

---

## ✅ EL DÍA DE LA T1 FUE EL 22/09/2026, Y LA LISTA ESTÁ HECHA

Esta sección era *«lo que hay que conectar, en orden»*: siete piezas
construidas y deliberadamente desconectadas. **Se conectaron todas.**

| # | qué | estado |
|---|---|---|
| 1 | `bloqueadas.py --generar` | ✅ las 684 estaban en R2 antes de resetear |
| 2 | `resetear.py --aplicar` | ✅ **1.634 filas a cero**, con respaldo fresco y verificado leyendo |
| 3 | los pools desde el Sheet vacío | ✅ dan 0, que es lo correcto |
| 4 | `llaves_a_entrada.py` escribiendo | ✅ encendido, **con corte de temporada** — ver abajo |
| 5 | el escritor de la vitrina | ✅ construido; **se enciende solo** cuando `Resultados` tenga filas |
| 6 | el `cron` a cada hora | ✅ `0 * * * *` |
| 7 | las copias del ID del Oficial | ✅ hecho el 21/09 |

Y dos que no estaban en la lista y también se hicieron:

| | qué | estado |
|---|---|---|
| 8 | **los roles de rango de Discord** | ✅ **147 sacados**, 0 quedan. Era el único irreversible de cara al público |
| 9 | el parche del Apps Script | ✅ ya estaba aplicado — verificado contra el WebApp vivo |

### 🔴 El reset NO alcanzaba para encender el paso 4

Los canales de llaves **siguen teniendo las 25 llaves de la
pre-temporada** —la más nueva es del 21/09— y el lector las detecta
igual de bien que a una nueva. La primera corrida con `--aplicar` las
habría metido en `Entrada`, procesado y **repoblado las hojas recién
vaciadas**. No fallando: funcionando perfecto, y dejando la T1
arrancando con los datos que se borraron a propósito.

Por eso existe **`comun/temporada.INICIO`** y
`llaves_a_entrada.de_esta_temporada()`: se descarta todo lo publicado
antes del arranque, **por fecha de publicación y no de última
edición** —el 96 % se edita después, así que una llave de la pre
editada hoy sigue siendo de la pre.

⚠️ **Lo que queda afuera se cuenta y se dice**, porque un filtro que
descarta en silencio no se distingue de un lector que dejó de
encontrar nada.

⚠️ **Y el self-check lo prueba en los dos sentidos.** Hoy «0 llaves»
sale igual con el filtro bien escrito que con uno que se coma todo,
porque las 25 que hay son de la pre: sin el caso inverso, el chequeo
no distinguiría.

### El cron: aplicado, y los cuatro límites medidos

✅ **`0 9 * * *` → `0 * * * *` el 22/09/2026.** Lo que lo frenaba era el
costo. Esto es lo que hay que saber para no deshacerlo sin querer:

| límite | cuánto da | hourly gasta | ¿entra? |
|---|---|---|---|
| **minutos de Actions** | 2.000/mes (repo privado) | **~720** | ✅ — eran 1.440 antes de esto |
| **escrituras de KV** | 1.000/día | **0 en un día quieto** | ✅ |
| requests de Discord | sin problema | 2 por corrida | ✅ |
| commits al repo | — | uno por corrida **con cambios** | ✅ ruidoso y nada más |

⚠️ **Los minutos eran el que mordía, y por el redondeo.** Actions cobra
por **minuto empezado**: con el barrido completo la corrida mediana es
1,7 min → se cobran 2 → 24 × 30 × 2 = **1.440 de 2.000**, y un día de
muchos redibujos ya se pasa. Sin el barrido son ~0,95 → se cobra 1 →
**720**. La optimización del paso 1 no ahorra un 45 %: **parte la
factura por la mitad**, porque cruza un umbral de redondeo.

⚠️ **KV parecía el bloqueante y no lo es**, pero sólo por dos cosas que
ya están hechas y conviene no deshacer: `subir_datos.py` es un
**diff-writer** —compara antes de escribir, ver su docstring: la cuota
se agotó de verdad el 17/09— y `pipeline.py` sólo lo llama `if
subidas`. Con las dos, un día quieto son **cero** escrituras. Si
alguien saca cualquiera de las dos, hourly son 24 × 241 = **5.784 sobre
un límite de 1.000**, y lo que se pierde es el **sello**: sin sello
nuevo Discord sigue sirviendo las cartas viejas de su cache.

✅ **El 7 era el que mordía justo ese día y ya está.** La T1 estrena
planilla, así que ese ID **cambia** — y vivía copiado en **nueve**
archivos. Ahora los nueve importan de `sheet/planillas.py`: **se cambia
en un lugar y nada más.**

⚠️ **Y eran nueve, no cinco.** La primera medición dijo cinco porque el
grep salió con `| head -6` y **se reportó el número truncado como si
fuera el hallazgo**. Los otros cuatro los encontró el propio
`verificar()` al buscar por texto en todo el repo. Correr
`python sheet/planillas.py` avisa si alguien vuelve a pegarla.

### El 5 se construyó el 21/09, y construirlo destapó el bug

`sheet/rankings.py` ya escribe la vitrina. Lo que faltaba no era el
código: era **poder correrlo sin vaciar una hoja pública**.

🔴 **Y el motivo por el que no existía resultó ser real.** `DE_DONDE`
prometía la racha `🔥` —*«1v1: racha actual/máxima»*— y `agregar()`
**no la calculaba**; tampoco estaba en `ARRASTRE`. O sea que la primera
escritura le habría borrado la racha a todo el mundo, sin un solo error
en ningún lado: la hoja acepta un blanco igual que un número, y de ahí
se cae el TAG de racha de las cartas.

Ahora la racha se calcula, y existe `sin_dueno()`: **ninguna columna de
la cabecera puede quedar sin que alguien la llene**. Si una lo queda,
`tabla_nueva()` no escribe. Se pregunta contra los datos que salen, no
contra `DE_DONDE` — que era justo el diccionario que mentía.

⚠️ **Y la racha va por `Evento #`, no por `Fecha`.** La fecha es `28/04`
sin año, así que con dos temporadas encima no ordena; el número de
evento es monótono. Ordenar por lo que no ordena no falla: da una racha
plausible y equivocada.

**Cuatro puertas antes de tocar la hoja**: `Resultados` vacía, una
columna sin dueño, sin respaldo del Oficial, o una tabla que encogería
sin `--achicar`. Y se escribe **primero** y se limpia la cola **después**
—al revés hay un instante con la vitrina vacía—.

✅ **Y se ensayó de verdad, que es lo que faltaba.** `--ensayo` crea una
pestaña en el Operativo, corre **el mismo escritor**, comprueba que la
cola se limpia al encoger de 8 filas a 3, y borra la pestaña. Incluye el
caso que el verificador existe para agarrar: con una celda combinada, la
API contesta 200 y se traga el valor — el ensayo confirma que **grita**.
Un escritor que sólo se va a ejecutar una vez, el día del reset, se
estrena con gente mirando.

```bash
python sheet/rankings.py --ensayo
```

⚠️ Su dificultad conocida está escrita en el propio archivo: recalcular
**reordena**, así que hay que reescribir la tabla entera, y reescribirla
con lo que ese módulo sabe calcular **borraría** las cuatro columnas de
Most Wanted y el `Rango`, que salen de otro lado.

---

## 🔑 EL RESET DE TEMPORADA — listo, en un comando

**`sheet/resetear.py`**, con simulacro. Dlx pone la fecha: *«un día antes
de que la temporada empiece»*.

⚠️ **Borrar los números ES el reset**, porque los pools se rebajan del
Oficial. Por eso no se hizo antes: dejaría el ranking público en blanco
durante toda la espera.

```
se borra (1.634 filas)   los 4 rankings, Eventos Procesados, MW Puntos
NO se toca               Lista de Raperos (876 con Discord ID), AKAs,
                         Config, Ranking Mundial, Entrada, Pendientes
```

⚠️ **Dos que parecen de la pre y no lo son.** `Ranking Mundial` son las
selecciones de T2, y de ahí sale el Score Selección del OVR Nacional.
`Config` tiene los umbrales que la T1 necesita para arrancar.

**La regla, escrita arriba del script:** un ranking se reconstruye
volviendo a procesar eventos; **un Discord ID perdido se pierde.**

### Y las cartas: la mitad no hay que redibujarlas

- **Temporada y Competitiva: cero minutos.** Desde el arreglo del
  requisito, `cs` sale de `comun/requisitos.py`: con los números en cero
  nadie llega, esas cartas se sueltan solas y las reemplaza la Bloqueada.
- **País y Servidor: ~10 horas** de Actions en varios días de tandas. Su
  requisito no es un número, así que se siguen emitiendo con los datos
  viejos hasta redibujarse.

⚠️ **Las Bloqueadas se dibujan ANTES de borrar.** `bloqueada()` del Worker
es «está en `bl` y **no** en `cs`»: si `cs` la suelta y `bl` no la tiene,
el botón desaparece —que quiere decir «no existe»— en vez de explicar.

---

## 🔴 LA PRIMERA CORRIDA CON TRABAJO DE VERDAD DIBUJÓ 1 CARTA DE 13

El ciclo corría verde y dibujaba bien **acá**. La primera vez que un runner
limpio tuvo trabajo, salieron tres bugs de golpe — y los tres pasan la
lectura del diff **y el simulacro**, porque un simulacro sale por el
`return 0` de «nada cambió» o no llega a dibujar.

| qué | dónde |
|---|---|
| **la ruta clavada** | `disenos/todos_sv.py`, `los_nueve.py`, `paneles.py` |
| **`numpy` sin declarar** | `requirements.txt` |
| lo vivo de `disenos/` fuera de la huella | `comun/huella_codigo.py` |

⚠️ **La Servidor sólo se podía dibujar en esta PC.** Los tres archivos
tenían `BASE = r'C:\Users\…'` — y **no son exploración**: `generar.py`
importa `todos_sv`, que importa los otros dos. `CLAUDE.md` afirma lo
contrario (*«las rutas son relativas al script»*) y para las otras tres
cartas es cierto. Los 127 restantes con la ruta clavada sí son
exploración: **el camino vivo en `disenos/` son 4 de 136**, y se resolvió
siguiendo los imports, no a ojo.

⚠️ **Y `huella_codigo.py` se comía esos cuatro.** Salteaba `disenos/`
entera con un comentario que decía que «generar.py no los importa», que es
falso. O sea: tocar el motor de layout de la Servidor **no hubiera
disparado ningún redibujo** — el mismo bug que ese archivo existe para
cerrar, reintroducido en el archivo que lo cierra. Ahora rescata lo vivo
por imports y el self-check comprueba las dos direcciones.

⚠️ **`requirements.txt` ya no se mantiene a mano**:

```bash
python herramientas/falta_en_requirements.py
```

Sigue los imports desde los puntos de entrada del ciclo. Así apareció
`numpy` —que tiraba la Competitiva y la de País— y `google-auth-oauthlib`.

**Después del arreglo: 13 de 13, en 1,8 min.** El día entero costó **6,3
minutos** de los 2.000.

### Las caras salen de R2, y sin eso el runner dibuja 15 de 138

`comun/respaldo.py` busca la foto en dos lugares: `_avatares/` —versionado—
y `comun/fotos/<temporada>/`, que es el espejo de R2 y está **gitignoreado**.
El checkout trae el primero y no el segundo. Medido sobre las 138:

| de dónde sale la cara | llega a |
|---|---|
| sólo el espejo (lo que ve Actions) | **112** |
| sólo `_avatares/` (lo que hay en git) | 110 |
| en git y **no** en el espejo | **0** |

O sea que R2 ya cubre todo lo que cubre git, y dos más — queda libre el
camino para sacar los 116 MB de fotos del historial.

⚠️ **Re-medido el 23/09/2026 y sigue valiendo: 422 en git, 424 en R2, y
`en git y no en R2 = 0`** —incluidos los siete que en algún momento
faltaron—. Lo que cambió es que **ya no vale la pena hacerlo**: el
`checkout` tarda 10 s de un job de 34 min, así que los 116 MB no cuestan
nada medible. Ver el punto 5 de «lo que no necesita a Dlx».

El paso vive en `bot/pipeline.py` y **no** en el `.yml`, porque la
precondición es *dibujar*, no «correr en Actions»: en el workflow quedaría
bien para ese llamador y mal para alguien con el repo recién clonado. Y como
está después del `return 0` de «nada cambió», las ~29 corridas de cada 30
que no dibujan nada no lo pagan.

⚠️ **El espejo baja en paralelo**: son 507 ms por objeto para traer 25 KB, o
sea latencia y no ancho de banda. De a uno los 443 daban 225 s; con ocho
hilos, **34**.

### El rango también se publica solo

`.github/workflows/rangos.yml` — al pushear `comun/rangos.py` o
`comun/requisitos.py`, Actions sube el bloque al Apps Script del Oficial y
**publica la versión**, que es el paso que hace que la gente lo vea.

Por push y no por horario: el umbral cambia una vez por temporada, y un cron
diario serían 365 corridas para agarrar un cambio.

✅ **El secret `OAUTH_TOKEN` ya está cargado** (21/09) y el workflow corrió
verde en la nube: se autenticó, leyó el Apps Script en vivo y dijo «ya está
igual, no hay nada que publicar». Sale de `oauth_token.json`, que deja
`python sheet/autorizar.py`; si alguna vez hay que recargarlo:

```bash
gh secret set OAUTH_TOKEN < oauth_token.json
```

La cuenta de servicio **no sirve** para esto: devuelve `403 User has not
enabled the Apps Script API`, que es un interruptor por usuario y una cuenta
de servicio no tiene dónde hacer clic. Por eso las llamadas corren como Dlx.

⚠️ **Es seguro correrlo de más**: `webapp_rangos.py` compara con lo que hay
arriba y sale temprano si ya está igual, así que no deja versiones idénticas
en el historial de despliegues.

### Y nunca se frena: `Pendientes`

⚠️ **Yo había hecho lo contrario.** El pipeline **cortaba** cuando un nombre no
estaba en el padrón. Frenar sirve cuando hay alguien mirando la consola y es
exactamente lo que no sirve en un job: un evento entero sin cargar por una
letra, y el error en un log que nadie lee.

La hoja `Pendientes` ya existía con la forma exacta —y su lista de tipos **ya
tenía `Nombre desconocido`**—, así que la convención estaba acordada antes de
que yo escribiera nada. Ahora la duda se anota con su posible match
(`«Konnan» ¿será Konan?`) y **el evento se carga igual**.

---

## 🔴 LAS CARTAS DE HOY YA ESTÁN EN DISCORD, Y TRES SCRIPTS CONTABAN MAL

Las 552 —las cuatro cartas de las 138— se redibujaron, se subieron a R2 y el
sello quedó en `202609201845`, así que **el arreglo del emoji y el de la foto
existen en Discord y no sólo en el repo**. Eso era el requisito de todo lo de
ayer.

🔴 **Y al subirlas aparecieron tres bugs de la misma familia**, los tres en el
camino que decide qué se sube. Ninguno falla: los tres **dan por bueno lo
viejo**.

| dónde | qué hacía |
|---|---|
| `bot/generar_todas.py` | contaba los PNG **que había en la carpeta**. Competitivo dejó 8 sin redibujar —de `Xclusivo` a `Zignos`— y dijo `138 de 138 ok`, porque los 8 de ayer seguían ahí |
| `bot/subir_cartas.py` | `sv_x.png` y `servidor_x.png` dan **la misma clave** en R2. Los dos se subían, con 8 hilos: cuál quedaba arriba lo decidía **cuál contestaba primero** |
| `bot/tanda_servidores.py` | listaba el directorio: 379 `sv-dra_*` donde había 144 de hoy, y el chequeo «al menos 138» lo daba por bueno |

⚠️ **Es el «da por buenas 137 cartas de las que vio 96» del docstring de
`generar_todas.py`, con el conteo mirando el lugar equivocado.** El archivo
existía para evitar exactamente eso.

⚠️ **El nombre del archivo no puede separarlos**: la carta vieja de alguien del
pool se llama igual que la nueva. El corte es el **mtime contra el arranque de
la corrida**, y está en los tres.

⚠️ **`subir_cartas.py` ahora tiene `--simulacro`**, que no tenía: 1.242
archivos a un bucket público sin forma de mirar antes. Es lo que hizo visibles
las 138 colisiones.

### Lo que sigue arriba con el emoji viejo

R2 sirve **469 personas y 3.220 objetos**; hoy se redibujaron 552.

| | objetos | ¿lo cambia lo de hoy? |
|---|---|---|
| las 4 × 138 | 552 | ✅ **hechas y subidas** |
| **por servidor** (`sv-*`) | 1.706 | **sí** — medido, la carta cambia 3.11 % · ✅ **hechas** |
| País de los que no están en el pool | 300 | **no** |
| las bloqueadas | 662 | **no** |

✅ **Los nueve servidores se redibujaron y subieron**, 72 min en total (DRA
13.5 · FFA 15.3 · EFA 7.6 · el resto ~6 cada uno). La auditoría cierra en
verde: **3.220 webp en R2 contra 3.220 en el inventario**, las 852 URL de
muestra responden, y el sello (`202609201958`) es posterior a la última
subida. R2 va en **361 MB de 10 GB**.

⚠️ **Los nueve corrieron con el código VIEJO de `tanda_servidores.py`** —el
arreglo del conteo se hizo con la tanda ya lanzada—, así que DRA y FFA
subieron también sus archivos del 19/09: por eso figuran **379** y **361** en
vez de 138. No es un error, son las cartas de gente fuera del pool que ya
estaban arriba; se re-subieron idénticas. Desde la próxima corrida se cuentan
bien.

⚠️ **«No» las dos veces, y las dos MEDIDAS.** La primera versión de esta tabla
decía que las 300 de País **sí** cambiaban, *«porque `04_Pais/generar.py` emite
🥈🥉»*. Los emite en un **`print` y un docstring**: consola, no carta. Generada
una y contados los emoji del texto de sus nodos, la carta de País dibuja
**cero**. Las bloqueadas, igual — `comun/bloqueada.py` no emite ninguno y su
foto ya venía del respaldo.

⚠️ **Es la misma trampa que `todos_sv.py`**, que «emite» `❓` dentro de un
regex que lo **borra**. Un emoji en el archivo no es un emoji en la carta, y
la única forma de saberlo es **generar y mirar el HTML**, no leer el `.py`.
Ahorró redibujar 962 cartas.

⚠️ **Y las 300 de País NO son basura**: son de `bot/paises_nuevos.py`, que
existe porque Dlx cambió el requisito el 19/09. 208 son de bloqueados, y el
Worker se las sirve —`bloqueada()` es `bl && !cs`, y como tienen `pais.webp`
real gana la de verdad.

---

## 🔴 LO PRIMERO: EL SHEET YA SE PUEDE ESCRIBIR DESDE EL REPO

`docs/sheet_t1.md` decía que no —*«las credenciales piden
`spreadsheets.readonly`»*— y eso describía **lo que piden los scripts**, no
lo que la cuenta puede. Medido con un `batchUpdate` vacío: **400 por el
payload, no 403 por permiso**.

Eso cambió el trabajo de «especificar el Sheet nuevo» a **construirlo**, y
es lo que se hizo hoy. La pieza es **`sheet/escribir.py`**.

⚠️ **Y el Sheet de la pre-temporada ES el de la T1.** Dlx, 20/09: *«ese
mismo sheet va a ser la misma de la temporada 1. Hay que sobreescribir los
datos, eliminar cosas. Pero ahí vamos a empezar todo»*. No se crea nada
nuevo.

---

## Lo que quedó hecho hoy

| | |
|---|---|
| **las CUATRO cartas llegan a 138** | País pasó de 137: Mark no tenía país y el padrón sí lo tiene |
| **`Config`: los ocho rangos** | y los pesos, los requisitos y la confianza, que no estaban |
| **el padrón: `Nombre`, `País`, `Crew`** | 875 filas · el país ya no sale del emoji del nombre |
| **el panel del padrón, en fórmulas** | decía 817 raperos y son 875 |
| **`guild_id` en la tabla de servidores** | lo que hace posible `/card` |
| **los 8 role ID en `Consola`** | y los ocho roles **ya existían** en Discord |
| **la Guía pública** | ocho rangos, mínimo 10, y que el rango **sí se reinicia** |
| **`SEG` y `TER`** | de 0/138 a 138/138 |
| **el emoji del TAG** | deja de depender de la máquina que dibuja |

### El pipeline lee la identidad del padrón

Los dos builders sacaban **todo** del Oficial, que es una tabla de
rendimiento. Como ahí el país viaja **pegado al nombre como emoji**, `cc`
—que las cuatro cartas piden obligatorio— salía de un regex sobre el texto.

```
cc           137 -> 138     Mark
crew          10 ->  31     antes sólo vivía en comun/crews.py
discord_id     0 -> 113     campo nuevo
verificado     0 ->  87     campo nuevo
```

⚠️ **`discord_id` y `verificado` son el corte de identidad de la T1** y
viajan al pool por primera vez. Hoy se **miden y no filtran**, que es lo
correcto sobre datos de prueba. Sobre el padrón entero da **332**.

⚠️ **Cae con gracia**: `sheet/padron.seguro()` devuelve `{}` si el padrón no
responde y todo vuelve a deducirse como antes.

---

## 🔴 El Operativo tiene la capa de datos, y dos hojas están VACÍAS

`CLAUDE.md` dice que no hay hojas de datos crudos. **Eso describe el
Oficial.** El Operativo —`1DFar2NS…`— tiene doce hojas:

| hoja | filas |
|---|---|
| `Eventos Procesados` | **348** |
| `Lista de Raperos` | **875** |
| `AKAs` | 188 |
| **`Resultados`** | **0** |
| **`1v1`** | **0** |

**Los 348 eventos se procesaron y su detalle por persona no quedó
guardado.** Por eso `DNA` y `DIN` de la carta País no existen.

⚠️ **Y el código para llenarlas YA ESTÁ.** `escribirLogs()` en
`Code.gs:626` escribe las dos, es idempotente, resuelve el país, y se la
llama desde `procesarEvento`. Sus columnas coinciden exacto: 11 y 11, 9 y 9.

🔴 **Nunca se ejecutó.** El `Log` del Operativo dice `Total entradas 0` ·
`Apps Script 0`. Los 348 eventos entraron por otro camino.

⚠️ **Y el pasado no se recupera**: `Entrada` está vacía porque
`limpiarEntrada()` la borra después de cada tanda.

**Dlx, 20/09: «todo es automático, lo del sheet es viejo».** O sea que no hay
que arreglar `procesarEvento` del Apps Script.

🔴 **Pero eso NO quería decir «el bot detecta solo», y lo aclaró después el
mismo día**: *«mayormente los usuarios pondrán las llaves y anunciarán los
eventos manualmente»*. Lo que es legado es **el menú de la planilla**, no la
carga a mano.

⚠️ **La diferencia cambia qué hay que construir.** Con «el bot detecta» lo
que falta es un parser de Discord; con «lo cargan a mano» lo que falta es que
**la carga a mano no se pueda hacer mal en silencio** — que es lo que se hizo:
el freno por nombre desconocido, la sugerencia del parecido, y el instructivo
de la hoja, que mandaba a apretar un botón muerto. Ver «Lo que sigue» #1.

---

## Los dos Apps Script, que son DOS

| Script ID | atado a | qué es |
|---|---|---|
| `1QFNhlyu…` | **Oficial** | `WebApp.gs` + `Index.html` — el buscador público |
| `1feyyQOB…` | **Operativo** | **`Code.gs`, 837 líneas — el motor** |

`herramientas/appscript.py` tenía **uno solo escrito a mano** y era el
equivocado. Ahora maneja los dos, el default es el motor, e imprime cuál
bajó — porque pedir el equivocado **no falla**: devuelve otra cosa.

🔴 **No se puede ESCRIBIR el Apps Script con cuenta de servicio.** Devuelve
`403 User has not enabled the Apps Script API`, que pide un interruptor por
usuario que una cuenta de servicio no tiene. Leer sí.

---

## Lo que queda para Dlx

1. ~~**Pegar `docs/appscript_oficial/PARCHE_rangos.js`** en el `Index.html`
   del WebApp.~~ ✅ **CERRADO — ya está aplicado.** Verificado el 22/09
   bajando el `Index.html` **vivo** con `webapp_rangos.bajar()`:

   ```
   tramos     SSS · SS · S · A · B · C · D · E
   umbrales    82 · 73 · 62 · 48 · 37 · 26 · 18
   MIN_EV_RANGO = 10
   ```

   Es exactamente `comun/rangos.py`, y el requisito real de 10 eventos.

   ⚠️ **El ítem quedó escrito como pendiente después de resolverse.** Decía
   que el 403 —*«User has not enabled the Apps Script API»*— hacía imposible
   hacerlo desde acá, y eso se destrabó con el OAuth del workflow: las dos
   corridas de `.github/workflows/rangos.yml` del 21/09 ya contestaron *«ya
   está igual a comun/rangos.py: no hay nada que publicar»*.

   ⚠️ **Y ese «ya está igual» no es vacío.** `webapp_rangos.main()` **sale
   con error** si no encuentra el bloque `RANK_TIERS/RANK_COLOR/MIN_EV_RANGO`
   — o sea que para decir «igual» tuvo que encontrarlo y compararlo contra
   el live.

   ~~**De los cinco lugares donde vive el rango, quedan los roles de
   Discord y nada más.**~~ **Los roles también estaban hechos** —
   verificado contra Discord el 23/09/2026, los ocho y en orden. De los
   cinco lugares queda sólo **la Guía**, que se reescribe con el Sheet.

2. ~~**Las 28 contradicciones de país.**~~ **Cerrado el 21/09, y no había
   nada que cambiar.** Dlx dio la regla: *«si hay 2 nacionalidades y una de
   ellas es USA, gana USA. Si no, el rol que tenga en los servidores, dando
   prioridad a DRA»*. Aplicada con `python sheet/pais_por_rol.py`:

   ```
   19   el rol de DRA CONFIRMA la columna
    0   el rol difiere de la columna
    2   hay un USA en juego, y la columna ya dice `us`
    7   no está en DRA o sin rol -> queda la columna
   ```

   ⚠️ **La regla quedó en el código y no en la cabeza de nadie**, que es la
   primera lección de `CLAUDE.md`. DRA tiene 18 roles de país —leídos por ID,
   no por nombre, porque un rol se renombra y el ID no— y 1.464 de sus 2.705
   miembros tienen uno.

   ⚠️ **No hay rol de USA en DRA**, así que esa regla se resuelve porque una
   de las dos fuentes diga `us`, no por rol.

3. ~~**Seis nombres de servidor** que no coinciden entre el Sheet y el repo.~~
   **Hecho el 20/09.** Eran **dos** —`TFC` y `URBF`, que tenían la sigla como
   nombre— y las dos se resolvían con la regla que ya existía. El menú del bot
   le mostraba «TFC» a la gente de TFC. Ya está desplegado.

   ⚠️ **Y la tabla vivía en dos lugares sin nada que los comparara**:
   `datos/servidores.json` y una copia dentro de `worker.js`. Ahora
   `bot/desplegar.py` **frena el despliegue** si no dicen lo mismo — los
   nombres son cosméticos, pero un `guild_id` mal copiado no falla: abre la
   carta de otro servidor.

4. **Decidir si se adopta el WebP directo** — 6× más rápido, obliga a
   redibujar todo.

5. ~~**Qué pasa con el que pierde contra un EQUIPO.**~~ **Decidido el
   21/09, y no hubo que tocar nada.** Dlx: *«que eso sea duelos individuales
   nada más. No grupales. Sólo vale cuando el formato es 1v1, no 1v3 o
   2v2»*. Es exactamente lo que el código ya hacía.

   ⚠️ **Y desarma lo que yo había marcado como problema.** Decía que a Am le
   quedaba 100 % habiendo peleado 2 y ganado 1. Es cierto, y está bien:
   `duel_t` no cuenta **batallas**, cuenta **duelos**, y un 1v2 no es un
   duelo. Am tiene uno y lo ganó. La cifra que parecía un error es la
   respuesta correcta a la pregunta que la columna hace.

6. 🔴 **A quién castiga un `Walk-in`, y esto hay que decidirlo ANTES de la
   T1.** Los modificadores caen sobre **los dos lados de la batalla**.
   Medido el 21/09 con una final Konan vs Axinu y la nota `Walk-in 3`:

   ```
   Konan   Campeón       0    Walk-in 3
   Axinu   Subcampeón    0    Walk-in 3     ← éste no hizo nada
   ```

   Lo mismo con `Revivido`: los dos a la mitad.

   ⚠️ **Es del Apps Script original** (`Code.gs:336`,
   `for (const n of [b.ladoA, b.ladoB])`) y lo porté igual a propósito —
   cambiarlo es una decisión de reglas, no de código. Pero con eventos de
   verdad **le baja los puntos a gente que peleó bien**, y el síntoma
   sería «me faltan puntos» sin nada en qué apoyarse.

   ⚠️ Si se decide que sólo castiga al que saltó, la nota tiene que decir
   **a quién** — hoy es una nota de la batalla, no de la persona — así que
   también cambia el formato de la carga.

---

## 🟢 EL CAMINO DE LA LLAVE AL SHEET YA ESTÁ, Y SE PROBÓ ENTERO

Era el punto 1 de esta lista. Son dos piezas nuevas:

```bash
python sheet/motor.py --tablas              las tablas de Config, como las lee
python sheet/motor.py --probar              una llave de 16, de punta a punta
python sheet/procesar_entrada.py            qué haría, NO escribe
python sheet/procesar_entrada.py --aplicar  lo escribe
```

`Entrada!C:K` → `motor.procesar` → `resultados.guardar` + `Eventos
Procesados` + `Config!B27/B28`. Es el menú `🎯 Procesar evento` del Apps
Script, del lado de Python — el que **nunca se ejecutó**.

**Probado contra el Operativo en vivo** con un evento #349 y deshecho después:
17 filas en `Resultados`, 12 en `1v1`, una en `Eventos Procesados`, y al
terminar las tres hojas y el contador quedaron **exactamente** como estaban.

⚠️ **Tres cosas cambian respecto de `Code.gs`, y las tres son por algo:**

- **Los nombres se resuelven contra el padrón entero.** `leerRaperos()` lee
  `A5:A500`, los datos arrancan en la fila 10 y hay 875: **ve 491 y no ve
  384**, y a quien no encuentra lo manda a `Pendientes` — que es justo lo que
  hay ahí. Medido hoy, el padrón resuelve los 875.
- **`_perdedor()` compara por clave, no por texto.** El original hace
  `ladoA === ganador`; con `Konan ` o `KONAN` da falso y devuelve **el lado
  equivocado**, o sea que el campeón pasa a subcampeón sin fallar.
- **La fila `Semifinal` de `Config` se usa.** El original la ignora y calcula
  el promedio. Hoy dan lo mismo en las tres escalas, así que no hay diferencia
  que medir — la diferencia es que **editar esa fila no hacía nada**.

🔴 **Y correrlo dos veces encontró que la idempotencia era falsa.** El número
salía de `Config!B27 + 1`, así que la misma llave daba **#349 y después
#350**: el mismo evento dos veces, con las dos hojas «idempotentes» haciendo
exactamente lo que se les pidió. **Las dos piezas estaban bien y la
composición estaba mal**, y eso pasa la lectura del diff entera. Un evento se
identifica por **nombre, servidor y fecha**, igual que `agruparPorEvento`.

⚠️ **Los puntos de Most Wanted NO están portados**: cada fila sale con `MW
pts` vacío. Es la respuesta honesta, no un cero disfrazado de dato.

---

## 🔵 LO ÚLTIMO DE TODO: avisarle a la gente fuera de Discord

⚠️ **Dlx, 21/09: «esto lo dejaremos para lo último».** Está investigado y
decidido, no construido. **No empezar por acá** — antes van las llaves a
`Entrada`, el lector de inscripciones y el reset.

### La prioridad que eligió Dlx

**1º Web Push** (notificación al dispositivo, privada) · **2º y 3º
Telegram**. El ping de rol de Discord **no se reemplaza**: esto es un
extra para quien no está mirando Discord en ese momento.

### Cuántos avisos entran, medido en la documentación

El límite del plan gratis son **50 subpedidos por invocación**, y por eso
al principio calculé mal —«48 por minuto, 6 minutos para 260 personas»—.
Es incorrecto: los 50 son **por invocación**, y un Worker puede llamar a
otro que arranca con los suyos.

> *«A single request has a maximum of **32 Worker invocations**, and each
> call to a Service binding counts towards this limit.»*

```
1 cron  ──>  31 copias del Worker enviador  ──>  50 avisos c/u
                                                  ≈ 1.500 por vuelta
```

**El padrón entero son 870 personas**, así que aunque se suscribieran
todas entran en una sola despertada. Y como las llamadas entre Workers
**no** cuentan para el tope de 6 conexiones simultáneas, son 31 × 6 = 186
avisos en vuelo a la vez: ~0,6 s para 350 personas.

| | alcance | cuándo |
|---|---|---|
| **fan-out con Service Bindings** | ~1.500 por vuelta | **empezar acá** — cero piezas nuevas |
| **Cloudflare Queues** | 10.000 ops/día gratis = ~3.300 avisos | cuando importen los **reintentos**, no el volumen |
| cursor en KV, 48/min | lento | último recurso |

⚠️ **El motivo para pasarse a Queues no va a ser el volumen sino que hoy,
si el push de Google falla para una persona, ese aviso se perdió.** La
cola lo reintenta sola.

⚠️ **Y queda UNA cosa sin medir: los 10 ms de CPU del Cron Trigger.**
Esperar red no cuenta, pero parsear sí, y la doc dice que parsear cargas
grandes llega a 10-20 ms. Se mide con el Worker real, no antes.

### Lo demás, decidido antes

Dlx, 21/09: *«me gustaría hacerlo porque así la gente se va a encadenar
más»*. Nace del problema del **MD de Discord**, que tiene anti-spam y no
deja avisar en masa. La salida es no usar Discord para eso.

⚠️ **EL CUELLO DE BOTELLA NO ES EL CANAL, ES EL PERMISO.** Telegram pide
`/start`, Web Push pide «permitir», WhatsApp pide que te escriban primero.
La parte difícil es idéntica en las tres, así que la decisión de **cuál**
importa menos que **dónde se pide**.

**Y se pide donde ya están**: alguien tira `/card`, ve su tarjeta, y abajo
va el botón. Está enganchado y es un click.

| canal | veredicto |
|---|---|
| **Discord, ping de rol** | ya funciona, gratis, no se reemplaza |
| **Telegram** | la mejor de las de afuera: gratis, sin aprobación, un POST desde el Worker, y **sin asterisco de plataforma** |
| **Web Push** | sirve, y la página va a existir igual por otras cosas |
| WhatsApp | más alcance, pero Meta Business + plantillas aprobadas + se paga por conversación |
| Email · SMS · app nativa | lento, caro y desproporcionado, en ese orden |

⚠️ **El deep link de Telegram resuelve de paso la identidad.**
`t.me/<bot>?start=<discord_id>` le llega al bot **con el Discord ID
adentro**, así que las dos cuentas quedan unidas sin que nadie tipee nada.

⚠️ **LA PEGA DE iOS ES CHICA ACÁ, y mi primera advertencia estaba mal
calibrada.** Web Push en iPhone sólo anda si agregan el sitio a la
pantalla de inicio — cierto, pero medido sobre el padrón: **86 % está en
Argentina, Chile, Colombia, México, Venezuela, España y Perú** (641 de
742 con país declarado), todos mercados donde Android manda. El caso malo
es una porción chica de una porción chica.

🔴 **Y NADA DE ESTO SIRVE SIN EL VIGILANTE.** Un aviso de un evento que
empezó hace una hora es **peor** que no avisar. Hoy el ciclo corre una vez
por día y bajarlo por Actions no entra (1.440 min/mes cada 30 min, de
2.000). El vigilante es un **Cron Trigger de Cloudflare** que revisa los 2
canales con llaves cada pocos minutos —gratis, no gasta minutos de
Actions— y **sólo dispara el workflow cuando encuentra algo**.

**Por eso el orden es ése y no otro: el vigilante primero.** Baja la
demora de *todo* el sistema, y sirve igual aunque las notificaciones no se
construyan nunca.

⚠️ La página va a tener **más cosas que el botón de notificaciones** —Dlx
lo dijo y quedó como tema aparte—, así que conviene definir eso antes de
elegir su forma.

---

## Lo que sigue, en orden

1. ~~**El camino del bot al Sheet**~~ — **hecho, y la punta también está
   contestada.** Dlx, 20/09: *«mayormente los usuarios pondrán las llaves y
   anunciarán los eventos manualmente»*. O sea que el camino es el de
   siempre —pegar en `Entrada!C:K`— y lo que había que hacer no era
   automatizarlo sino **volverlo a prueba de la carga a mano**:

   - 🔴 **Un nombre mal tipeado creaba un rapero fantasma en silencio.**
     Probado: «Konnan» en la final de una llave de 16 daba un Konnan campeón
     con 10.000 puntos, sin un aviso. Ahora frena, sugiere el parecido
     (`¿será Konan?`) y sale con error. `--igual` lo deja pasar.
   - **La nota `NUEVO` ya existía en la hoja** y significa «rapero no
     registrado»: el motor la honra en vez de inventar una segunda forma de
     decir lo mismo.
   - **El paso 5 del instructivo mandaba a apretar un botón que no hace
     nada** — el menú del Apps Script, que nunca se ejecutó. Si el camino es
     manual, **el instructivo ES el sistema**.
   - ⚠️ **Y lo más útil del flujo manual: DOS FILAS son un podio completo.**
     Una de `Final` da campeón y subcampeón, una de `Tercer puesto` da
     tercero y cuarto, con sus puntos. No hace falta cargar las 16 batallas
     para que el evento cuente — que es justo lo que hace que un flujo
     manual se abandone.

2. ~~**Los duelos**~~ — **cableados.** `construir_pool_competitivo.py` los
   rescataba **del JSON anterior, o sea de sí mismo**, así que cada rebuild
   arrastraba los mismos 4 de 138 y el número sólo podía quedarse igual.
   Ahora, cuando `1v1` tiene filas, manda ella. Medido con la llave de
   prueba: **14 personas contra 4**, sin solapamiento.

   ⚠️ Falta que haya eventos de verdad. Y `DNA`/`DIN` piden además el país
   del rival, que `1v1` todavía no guarda.
3. **Las rankings como fórmulas** en el Oficial, para que la vitrina no se
   pegue a mano.
4. **Separar «verificado» de «en la Liga»** — `python sheet/padron.py --liga`.

   Este punto estaba escrito sin explicar por qué. Medido el 20/09:

   ```
   en el padrón                         875
   compitieron alguna vez (Ev > 0)      735
   verificados ✅                        339
   ✅ + Discord ID — el corte de hoy     332
   ✅ Y compitieron                      243
   ```

   🔴 **El corte de hoy falla en las dos direcciones**: deja afuera a **492
   que sí compitieron** y mete a **96 que nunca compitieron**.

   ⚠️ **Son dos preguntas, no una mal medida.** «Verificado» es *sé quién
   sos* —alguien ató su Discord a su nombre en DRA— y «en la Liga» es
   *competís*. Un rapero de otro servidor compite sin pasar nunca por la
   verificación de DRA. Juntarlas en un solo ✅ obliga a elegir cuál de las
   dos se rompe, y hoy se rompen las dos.

---

## Qué necesita cada tarjeta

Medido con `herramientas/que_pide_cada_carta.py`, que envuelve el pool en un
dict que **anota quién le pide qué** y dibuja las cuatro de verdad.

**34 campos.** Siete los piden las cuatro y ninguno puede faltar:
`raw · cc · sv · ev · score · duel_t · duel_v`. **Dos de esos siete no están
en el Sheet** — los duelos.

El detalle, con de dónde sale cada uno: **`docs/que_necesita_cada_carta.md`**.

---

## Reglas nuevas, que costaron una vuelta cada una

⚠️ **Una celda combinada se traga los valores en silencio.** La API dice
`200` y `4 celdas actualizadas`, y sólo queda el primero. Por eso
`sheet/escribir.poner()` **escribe y después lee para comprobar**.

⚠️ **`COUNTA` cuenta la cadena vacía.** Una celda con `""` no está vacía
para Sheets: `COUNTA` daba 874 donde hay 504. `LEN(...)>0` es lo único que
las separa.

⚠️ **La cabecera de cada hoja está en una fila distinta** —la 9, la 3, la
5— y **adivinarla no falla, devuelve filas**. Están declaradas en
`sheet/escribir.CABECERAS`.

⚠️ **Un bloque no se puede estirar hacia abajo**: siempre hay algo debajo.
Pisé `📖 Instrucciones` escribiendo once filas seguidas.

⚠️ **`RAW` no interpreta el apóstrofo** de «esto es texto»: queda literal en
la celda. Con RAW una cadena ya se guarda como cadena.

⚠️ **El simulacro salvó la página pública**: el generador del `Index.html`
producía `min: 82  color:` **sin la coma**. Un `%d` habría tumbado el WebApp
entero.

⚠️ **El heredoc de bash se come las barras, aunque esté citado.** Para
código con `\n`, Write o un `.py` con `r'''...'''`.

⚠️ **`open(p,'w')` trunca antes de escribir.** Si falla, el archivo queda en
cero. Escribir a `.tmp` y `os.replace`.

---

## Las herramientas nuevas

```bash
python sheet/escribir.py --ver          las 12 hojas, su cabecera y su ancho
python sheet/padron.py                  el padrón y el corte de identidad
python sheet/config_t1.py               los ocho rangos y los bloques nuevos
python sheet/padron_t1.py               Nombre · País · Crew
python sheet/panel_padron.py            el panel, en fórmulas
python sheet/servidores_t1.py           la tabla con guild_id
python sheet/consola_t1.py              los 8 role ID, verificados en Discord
python sheet/guia_t1.py                 la Guía pública
python sheet/webapp_rangos.py           el parche del Index.html
python sheet/explorar_operativo.py      el mapa del Operativo
python sheet/motor.py --probar          una llave de 16, de punta a punta
python sheet/procesar_entrada.py        Entrada -> las tres hojas
python sheet/entrada_instrucciones.py   el instructivo de la hoja Entrada
python sheet/rankings.py --cobertura    qué columna de la vitrina se recalcula
python sheet/padron.py --paises         el emoji del nombre contra la columna
python sheet/padron.py --liga           «verificado» contra «compitió»
python herramientas/numeros_viejos.py   números que el repo afirma y ya no son
python bot/generar_todas.py --prueba    el autochequeo del conteo
python sheet/resultados.py --estado     qué hay en el registro crudo
python herramientas/que_pide_cada_carta.py
python herramientas/emoji_embed.py --ver   y avisa de los emoji sin recortar

python bot/pipeline.py                  el ciclo entero (simulacro)
python bot/que_cambio.py                quién cambió y qué carta le quedó vieja
python sheet/pendientes.py              qué espera a que alguien lo mire
python sheet/respaldar.py               las dos planillas enteras, a docs/
python sheet/rankings.py --escribir     la vitrina recalculada, sin escribir

python bot/subir_cartas.py bot/salida --simulacro   qué subiría, sin subir
python bot/tanda_servidores.py --listar             qué hay en R2 por servidor
```

**Todos tienen simulacro por defecto y escriben sólo con `--aplicar`.**

---

## Los límites, medidos

```
R2                    378 MB / 10 GB        3,8 %
KV · escrituras           141 / 1.000        14 %   ← el más apretado
Browser Run · min/día       0 / 10            0 %   ← ya tiene permiso
Actions · min/mes         530 / 2.000        26 %
```

Y de `Consola` salió un dato que no estaba en ningún documento: **un tercer
Sheet, «Sheet VIP»** — `1cgKD0M0kNZt2jpoFLms86SxPFt4rVnjjsajvG2JuHYA`.
