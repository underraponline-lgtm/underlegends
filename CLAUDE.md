# Liga Global — Sistema de Tarjetas

Generador de tarjetas estilo FIFA para los raperos de Liga Global. Cada carta
sale de datos reales del Google Sheet, se arma como HTML/CSS y se exporta a PNG
con fondo transparente para Discord.

**No es un diseño, es un generador.** Todo lo que se decida tiene que funcionar
igual para 138 personas con datos que cambian cada semana.

---

## Las seis tarjetas

| # | carta | forma | qué mide | estado |
|---|---|---|---|---|
| 1 | **Temporada** | rectangular 300×438 | OVR de temporada, acumulación | **terminada** |
| 2 | **Competitivo** | escudo trazado 300×485 | Score competitivo, calidad | **terminada** |
| 3 | **Servidor** | pico trazado 300×405 | datos de ese servidor | **en curso** |
| 4 | **País** | silueta trazada 300×402 | OVR Nacional y tu puesto dentro del país | **en curso** |
| 5 | Prime | sin definir | — | **espera la T2** |
| 6 | Histórico | sin definir | acumulación de todas las temporadas | **espera la T2** |

⚠️ **Prime e Histórico ya tienen FECHA y FUENTE.** Dlx, 16/09/2026: *«la T1 será
la primera, y cuando la T2 salga recién se hará la HISTÓRICA — la cual
desbloqueará la tarjeta histórica, prime»*. O sea que **las dos cuelgan de la
misma cosa**: la Histórica, que vive en **su propio Sheet, en otro proyecto**.
Dejan de ser «sin concepto» y pasan a ser «sin diseño, con fecha». Lo que sigue
faltando es **qué número muestra cada una**, que es la primera regla de acá.

⚠️ **Y LA PRE-TEMPORADA SE BORRA: era data de prueba.** La T1 arranca de cero,
con un Sheet nuevo llamado **«T1 Ranking Global»**. Cualquier número de este
documento que hable de **138 personas** es de la pre-temporada y **no describe
la T1** — sirve como referencia de forma, no de tamaño. Qué tiene que tener ese
Sheet está en **`docs/sheet_t1.md`**, incluido lo que conviene agregarle ahora
que está vacío.

La **Bloqueada** no es una séptima carta: es un *estado* para quien tiene menos
de 8 eventos. **Hecha el 16/09/2026**, en `comun/bloqueada.py` — vive en
`comun/` y no en una carpeta numerada justamente porque no es una carta.

```bash
python comun/bloqueada.py        # los cuatro casos que tiene que aguantar
```

Plantilla gris, candado, progreso `X/8 EVENTOS` y cuántos te faltan.

⚠️ **Es la ÚNICA carta cuyo contenido es un contador, y por eso necesita su
propio sello.** «2/3 DUELOS NACIONALES» cambia cada vez que la persona
compite y **el nombre del archivo no**. Hasta el 22/09/2026 el paso que
decidía si había que redibujar preguntaba si el archivo *existía* —en R2 o en
disco—, así que una Bloqueada se dibujaba una vez y se quedaba con el número
de ese día **para siempre**, diciéndole a alguien que le faltan 3 duelos
cuando ya tiene 2.

Es la forma de *«una cache que mira los datos no ve el código»* pero peor: acá
la cache no miraba **nada**, sólo si el archivo estaba.

El sello es el **hash del HTML** que esa Bloqueada va a dibujar. Hashear los
datos sueltos no alcanzaba: el texto sale de `requisitos.cual_falta()`, que
puede **cambiar de condición** —quien completa sus 3 duelos nacionales pasa a
mostrar los internacionales—, así que un hash de `ev` y poco más dejaría
afuera justo el número que se ve.

⚠️ **Y tampoco estaban en el ciclo**: se dibujaban a mano. Ahora son el paso
**5b** de `bot/pipeline.py`, que corre **también cuando el ciclo dice «nada
cambió»** — quien pasa de 1/3 a 2/3 sigue sin carta de País, así que no hay
carta que redibujar y el contador igual se movió.

⚠️ **Sin número y sin rango, a propósito.** Es la primera regla del proyecto —
*el número de cada carta mide lo que esa carta mide*— y acá no hay nada que
medir: el corte de 8 eventos es **justo** el que desbloquea el Win%, el rango
competitivo y la carta. Poner un número igual sería inventarlo.

⚠️ **Pero la bandera y la foto SÍ van.** *«La bandera es identidad, el número es
ranking»*: quién sos no depende de cuántos eventos jugaste. La foto va apagada
y detrás del velo — sos vos, pero todavía no es tu carta.

⚠️ **Va OVALADA, y no es una silueta del catálogo.** Dlx: *«quiero que las
bloqueadas tengan una forma distinta a las 4 tarjetas»*. Nació con el
**biselado** —la única libre de `comun/siluetas.py`— y eso no alcanzaba: el
biselado **es** una forma de carta, así que se leía como *una carta rota*. Una
forma que no es de carta se lee como **todavía no**.

```bash
python comun/bloqueada.py --formas   # óvalo · píldora · hexágono · biselado
```

⚠️ **La forma cambia cuánto espacio hay.** Un óvalo se come las esquinas: a la
altura del pie el ancho útil cae a la mitad. Por eso cada forma trae **su
margen** y no alcanza con cambiar el `clip-path`.

⚠️ **El gris no es el color de E.** Los ocho de `comun/rangos.py` son ocho
niveles y el bloqueado no está en ninguno: está **antes**. Darle el bronce diría
que es el peor, y no es eso — es que todavía no se sabe.

⚠️ **Y los 597 no existían en `datos/`.** `construir_pool_temporada.py` los
descartaba con un `continue` en cuanto veía `Ev < 8`, así que esta carta no
tenía a quién dibujar. Es la misma forma que el bug de los avatares: **el dato
estaba en el Sheet y el pipeline lo tiraba**. Ahora el builder deja también
`datos/bloqueados.json`; hasta el próximo refresco —que pide credenciales— la
carta se mira con su muestra de cuatro.

---

## Reglas que no se pueden romper

Están escritas porque **parecen errores y no lo son**. Si alguien las "arregla",
rompe el sistema.

### El Competitivo se reinicia por temporada, y una temporada son DOS capítulos

Dlx: *«recuerda que eso del competitivo va por temporada, y ahora las
temporadas tendrán 2 capítulos»*.

⚠️ **Nada del Competitivo es acumulado de toda la historia.** El Score, el
rango, las cinco dimensiones y el requisito de 10 eventos **se miden dentro de
la temporada en curso**. Cuando arranca una nueva, vuelven a cero.

⚠️ **Los DOS CAPÍTULOS por temporada son para más adelante.** Dlx los mencionó
y después pidió dejarlos de lado: *«ignora esa parte de que las temporadas
tengan 2 capítulos, eso será más adelante»*. Queda anotado nada más que para
que no se descubra de nuevo — **no se actúa sobre eso hoy**. Cuando llegue habrá
que contestar si el Score se reinicia por temporada o por capítulo, porque eso
decide qué número lleva la carta.

⚠️ **El que SÍ acumula es el Histórico**, que justamente por eso existe. Si el
Competitivo acumulara, las dos dirían lo mismo.

### El rango sale del Score competitivo. Siempre.

Umbrales, iguales en las tres cartas:
`SSS 82 · SS 73 · S 62 · A 48 · B 37 · C 26 · D 18 · E resto`

El rango es **uno solo por persona** y tiene que dar igual en todas sus cartas.
Subir de rango solo se logra en el competitivo: ser #1 de temporada **no** te
hace #1 del competitivo.

#### ✅ DECIDIDO: MANDAN LOS OCHO. El Sheet dice otra letra porque está viejo

**Dlx, 17/09/2026: «el 8… recordá que el Sheet es viejo y antiguo».** Lo que
sigue describe la discrepancia medida y **ya no es una decisión abierta**: la
fuente es `comun/rangos.py` y el Sheet nuevo nace con sus ocho tramos. Se deja
escrito porque explica **qué hay que mover**, y porque dos de los cinco lugares
donde vive el rango no se arreglan solos — los roles de Discord entre ellos.
Ver `docs/sheet_t1.md`.

#### 🔴 LA DISCREPANCIA MEDIDA, Y SON 26 DE 138

Medido contra el Sheet en vivo el **16/09/2026**. Su columna `Rango` tiene
**seis** valores y la carta usa **ocho**:

| | tramos | umbrales |
|---|---|---|
| **el Sheet** (y su Guía v3.0) | 6 | `S 65 · A 47 · B 36 · C 23 · D 17 · E` |
| **`comun/rangos.py`** (las cartas) | 8 | `SSS 82 · SS 73 · S 62 · A 48 · B 37 · C 26 · D 18 · E` |

**Resultado: 26 de las 138 —el 19 %— llevan una letra distinta en el Sheet que
en su carta.** Y no es ruido, son dos causas sumadas:

1. **La carta parte la cima en tres.** El Sheet tiene un solo `S`; la carta lo
   abre en `S`, `SS` y `SSS`. Los seis mejores cambian por esto solo.
2. **Los cortes no coinciden por uno o dos puntos**: 62 vs 65, 48 vs 47,
   37 vs 36, 26 vs 23, 18 vs 17. El que cae en el medio se da vuelta.

| rapero | Score | el Sheet | su carta |
|---|---|---|---|
| **Konan** | 91.1 | **S** | **SSS** |
| Axinu | 80.7 | S | SS |
| Bau | 64.7 | A | S |
| Rodas | 47.8 | A | B |
| Val | 36.7 | B | C |

⚠️ **Es la regla de arriba rota en el nivel más alto.** El rango da igual en las
cuatro cartas de una persona —eso funciona— **y distinto del número que esa
misma persona lee en el Sheet**. Hoy casi no se nota porque las cartas no
circulan; **con el bot se nota enseguida**: alguien abre el ranking, se ve «A»,
tira `/card` y le sale «B».

✅ **Y se decidió: el Sheet nuevo adopta los ocho.** Dlx, 17/09/2026. Los 26
se van a cero solos en cuanto `config` tome los umbrales de `comun/rangos.py`.

⚠️ **PERO EL RANGO VIVE EN CINCO LUGARES Y SÓLO UNO SIGUE A MANO.**

| dónde | tramos hoy | se arregla |
|---|---|---|
| `comun/rangos.py` | **8** | es la fuente |
| la columna `Rango` del Sheet | **8** | ✅ se calcula, ver `rankings.rangos_de()` |
| la Guía | 6 | sola, se reescribe con el Sheet |
| `Index.html` del Apps Script | — | ✅ **retirada el 24/09/2026**: es un aviso que manda a underlegends.pages.dev |
| los roles de Discord | **8** | ✅ **hechos**, ver abajo |

✅ **LOS ROLES YA SON OCHO, Y ESTA TABLA DIJO «6» DURANTE DIAS.** Dlx,
23/09/2026: *«esos 6 roles ya es cosa vieja q te olvidaste actualizar…
son 8»*. Verificado contra Discord: los ocho existen en DRA, de `Rango
SSS` a `Rango E`, en las posiciones 107 a 100 **y en el orden correcto**.
`Rango SSS` y `Rango SS` tienen IDs `1550996…` contra `1502241…` de los
otros seis, o sea que se crearon después — exactamente los dos que este
documento pedía.

🔴 **EL PROBLEMA NO FUE EL DATO VIEJO, FUE QUE ERA UNA AFIRMACION SIN
CHEQUEO.** Las otras cuatro filas de esta tabla se comprueban solas; la
de los roles decía «a mano», y **lo que no se pregunta no se entera de
que ya se hizo**. Ahora lo pregunta
`herramientas/roles_de_rango.py`, que corre en la auditoría semanal.

🔑 **Y OJO CON EL NOMBRE: está en NEGRITA MATEMATICA.** `𝐑𝐚𝐧𝐠𝐨 𝐒𝐒𝐒` no
es `Rango SSS` —son puntos de código distintos, U+1D400 y siguientes— así
que `.upper()` no los toca, `isalnum()` dice que sí, y buscarlos por
nombre da **cero**: parece que no existen. Hay que pasar por
`unicodedata.normalize('NFKD', …)`. Fue lo que me hizo creer, en la
primera corrida, que la tabla tenía razón.

✅ **El Apps Script salió de la lista el 21/09/2026.**
`.github/workflows/rangos.yml` sube el bloque y **publica la versión** —que
es el paso que hace que la gente lo vea— cuando se pushea `comun/rangos.py`
o `comun/requisitos.py`. Por push y no por horario: el umbral cambia una vez
por temporada, y un cron diario serían 365 corridas para agarrar un cambio.

🔴 **Y POR ESO `docs/appscript_oficial/` PUEDE ESTAR VIEJO: ese workflow
escribe arriba y no en el repo.** Medido el 23/09/2026, bajando el proyecto:
`Index.html` vivo tenía **178 bytes más** que el commiteado, y esos 178 eran
justamente el bloque de los ocho rangos. **Subir el archivo del repo para
arreglar otra cosa habría devuelto la página pública a seis rangos**, que es
la incoherencia que este documento llama «el último de los cinco lugares».

⚠️ **Nunca se sube ese archivo a mano.** Va por `sheet/webapp_subir.py`,
que compara lo vivo contra la versión **commiteada** —no contra el disco, o
tus propios cambios trabarían el candado— y se planta si alguien lo movió
por afuera. `--sincronizar` trae lo vivo al repo, y es lo que hay que
correr después de que un workflow publique.

⚠️ **Y manda siempre los CUATRO archivos.** La API de Apps Script
**reemplaza el proyecto entero** con lo que le mandes: subir uno solo borra
los otros tres.

⚠️ **Y las cartas se enteran del cambio, que era el otro agujero.** El sello
del ciclo miraba sólo los datos, así que mover un umbral publicaba la letra
nueva en la web y dejaba las 138 cartas con la vieja — la incoherencia
mudada de sitio, que es exactamente lo que estas líneas piden no hacer. Ver
*«Una cache que mira los datos no ve el código»*.

✅ **El de los roles ERA el caro y el único irreversible de cara al
público** —la gente ya lleva su rol puesto— y **ya está hecho**: los ocho
existen y los 147 del tramo viejo se sacaron. Se deja escrito el porqué,
que sigue valiendo para el próximo cambio de umbrales: va **antes** de
que arranque una temporada, no a mitad — a mitad es gente viendo cómo le
cambia la letra sin haber competido.

⚠️ **Y no se puede dejar a medias.** La regla de arriba es que el rango es uno
solo por persona. Si el Sheet pasa a ocho y los roles se quedan en seis, la
incoherencia **se muda de sitio en vez de cerrarse**: hoy es Sheet contra
carta, mañana sería rol contra todo lo demás.

### El número de cada carta mide lo que esa carta mide

- Temporada → OVR de temporada
- Competitivo → Score
- Servidor → datos de ese servidor

### En la Temporada, el color y la letra pueden contradecirse

El **color** sale del OVR y la **letra** del Score. Bloody tiene el OVR más alto
de las 138, así que le toca carta negra, y su letra dice **A** porque su Score es
56.5. **No es un bug**, es la consecuencia asumida de que el color diga *qué
hiciste esta temporada* y la letra *quién sos*.

### Los rombos se ordenan por importancia del evento, no por resultado

⚠️ **Y durante un tiempo esta regla NO SE PODÍA VER, porque sólo entraba un
evento.** `gencomp.py` resolvía el ícono de cada evento contra
`02_Competitivo/logos_sv/`, que **no existe** —las siluetas se unificaron en
`comun/logos_sv/`—, y descartaba el evento con un `continue` mudo. Cargaba
`['interserver']` y nada más: el oro de Konan en la TFC Champions, el de
Bloody en el DRA, el de MCO en Urban Nations y el de Ceko en la FRZ **no se
dibujaban**. Con un solo rombo, un orden no se nota.

Es el mismo error que ya está documentado más abajo de `procesar_logos.py`
—una ruta muerta a `logos_sv/`— repetido en otro archivo y callado por un
`continue`. Ahora busca primero en la carpeta de la carta y después en
`comun/`, y **avisa** qué evento se quedó sin ícono en vez de seguir de largo.


```
interserver 0 · SR 1 · TFC 2 · DRA 3 · Stelar Versers 4 · FRZ 5
FFA 6 · TWR 7 · FTN 8 · URBF 9 · EFA 10
```

Konan tiene la plata arriba y el oro abajo: su plata es del Interserver, que es
de toda la Hermandad, y su oro de la TFC Champions. **No es un bug.**

### Los subrangos con signo solo van en A, B, C y D

Cada tramo se parte en tercios: A−, A, A+. SSS, SS, S y E van sin signo.
**El signo cambia la pastilla, no el color**: un A− y un A+ comparten carta de
rubí. Si cada signo tuviera su tono harían falta 16 paletas.

### Solo se resalta el 100 en las stats

Significa liderar esa dimensión en todo el pool. Son 4 cartas de 138. Si se
resaltara el máximo de cada carta lo tendrían las 138, y en 77 caería en
diversidad.

### El brillo del acento se sacó a propósito; el de las medallas se queda

En la Competitiva, los chips salen en `right:-11px` y los rombos en
`left:-10px`. Encima, los dos tenían un `box-shadow` de 14–15px con el color
del rango, así que el halo llegaba a **~25px fuera del escudo**. Sobre el fondo
oscuro de la página se funde y da profundidad; sobre transparencia no tiene con
qué fundirse y queda como una **capa magenta suelta**, con borde recto donde el
recorte la corta. En Discord la carta cae sobre fondos que no controlamos.

Se quitó de `card.css` en `.skills i`, `.chip.on` y `.chip.rkchip`. Queda la
sombra negra, que sí da profundidad sin teñir.

**Dos que NO se tocan:**

- **`.rkbox`** (la pastilla del rango) conserva su brillo: vive *dentro* del
  escudo, no sobresale.
- **Los puntos de nivel** (`.lv-oro`, `.lv-plata`, `.lv-bronce`) conservan el
  suyo, aunque también sobresalgan. **El brillo del acento decoraba; el de las
  medallas informa**: el color del rango ya se lee en el marco, en la pastilla
  y en el 100, pero el dorado del punto es la única señal de que ganaste un
  evento, y que brille es parte de que se lea como medalla.
  Eso sí, **los radios se bajaron a la mitad** (oro 11→5.5, plata 10→5, bronce
  7→3.5). A radio entero el halo se derramaba fuera del escudo y sobre fondo
  claro se leía como una forma suelta. Medido: el halo cae 51% y el núcleo del
  punto queda igual, así que la medalla sigue igual de presente.
  **Los tres se cambian juntos, siempre.** Konan lleva plata arriba y oro
  abajo, pegados: si se baja uno solo, la inconsistencia se ve en una sola
  carta. El `inset` de la plata no es halo sino el anillo del borde: no se toca.

Por eso siguen sobresaliendo ~24px a la izquierda, y **es a propósito**. Si
alguien "empareja" las reglas de brillo, rompe esa distinción.

**Y esos 24px no son brillo: son la rotación del rombo.** Medido apagando cosas
de a una:

| se apaga | sale del escudo |
|---|---|
| nada | 24.3 px |
| el brillo del punto de oro | 24.3 px |
| todos los puntos de nivel | 24.3 px |
| la rotación de los rombos | 18.0 px |
| los rombos enteros | 0.0 px |

Es la regla de rotación de más abajo: un rombo de 44px girado 45° ocupa 62.2, y
con `left:-11.5px` llega ahí solo. **Bajar el radio de cualquier `box-shadow` no
mueve ese número ni un píxel.** Si alguna vez hay que achicar la huella, se
toca el `left` o el tamaño del rombo, no la sombra.

Ojo con la otra cara: el radio del dorado **sí cambia cuánta área brillante se
ve**, aunque no mueva el extremo. Extensión y apariencia son dos preguntas
distintas y se miden distinto.

### Los números de los círculos de abajo se calculan por Score

País, servidor y crew, los tres. Si alguna vez se quiere medir por un combinado
de temporada y competitivo, hay que cambiarlo **en los tres a la vez**, o los
tres números dejan de ser comparables entre sí.

**El umbral de 3 vale para los tres**, no solo para la crew: ser "1 de 1" no
dice nada en una crew, en un país ni en un servidor. Antes solo lo tenía la
crew, así que Mark salía "1º" de un país que no tiene, y Marcos "1º" de DRA,
que tiene una sola persona. Afecta a **12 por país y 3 por servidor**.

Se calcula en `sheet/construir_pool_competitivo.py`, que deja `pos_*` vacío
cuando el grupo no llega a 3. Los tres van juntos a propósito: si se cambia uno
solo, los tres números dejan de ser comparables.

**Sin dato no hay pieza.** Si alguien no tiene país, el círculo de la bandera
**no se dibuja**, igual que el de la crew. Con `cc` vacío la URL quedaba
`flagcdn.com/w80/.png` → 404, y el navegador pintaba su ícono de imagen rota,
que es peor que no mostrar nada. La bandera sí se queda cuando hay país aunque
sea el único: **la bandera es identidad, el número es ranking.**

---

## De dónde salen los datos

🔴 **ESTE SHEET ES EL DE LA PRE-TEMPORADA Y SE VA A REEMPLAZAR.** Dlx,
16/09/2026: *«esa info será borrada e inutilizada, era info de prueba»*. La T1
arranca de cero en un Sheet nuevo, **«T1 Ranking Global»**. Todo lo que sigue
describe **la forma** de los datos, que se conserva; **los números no**.

| documento | qué trae |
|---|---|
| **`docs/sheet_estructura.md`** | el **plano** del viejo: hojas, cabeceras, merges, el lobby — qué repetir, qué mejorar y qué eliminar |
| **`docs/sheet_t1.md`** | **qué columnas** tiene que tener el nuevo, y qué desbloquea cada una |

⚠️ **Lo más importante del plano, porque explica todo lo demás: el Sheet no
calcula nada.** Medido celda por celda — **cero fórmulas** en las cuatro hojas
de ranking. Es una **vitrina** de algo calculado afuera.

✅ **Y DESDE EL 23/09/2026 «AFUERA» SOMOS NOSOTROS.** Esta línea terminaba en
*«por eso `competitivo.py` vive del lado del Sheet y no acá»*, y eso dejó de
ser cierto de la peor manera: ese lugar **ya no existe**, así que con la T1
arrancada nadie tenía Score — y sin Score no hay rango, que es la regla
central del proyecto.

| dónde vive ahora | qué calcula |
|---|---|
| **`sheet/competitivo.py`** | el Score y las cinco dimensiones |
| **`sheet/rankings.py`** | las cinco vitrinas, desde `Resultados` y `1v1` |
| **`Resultados` · `1v1` · `Eventos Procesados`** | los datos crudos, en el Operativo |

O sea que la segunda mitad de esa frase —*«no hay ninguna hoja de datos
crudos»*— tampoco vale: las tres del Operativo son exactamente eso, y se
llenan solas desde `sheet/procesar_entrada.py`.

⚠️ **La fórmula está verificada contra las 138 filas de la pre-temporada**,
con una diferencia máxima de 0.050. Ver el encabezado de
`sheet/competitivo.py`, que dice de cada dimensión **cuánto se pudo
comprobar** — tres exactas, una ±2 y una inferida.

Sheet Oficial `1sDo89FTvnI6FOtz6KSK0jAtDBtJHsB7N54wNLLae62U`

| hoja | cabecera | qué trae |
|---|---|---|
| Ranking Temporada | fila 16 | PTS, EVT, POD, SEM, CAZ, MW, y 7 columnas por servidor |
| Ranking Competitivo | fila 12 | Score, Confianza y las 5 dimensiones |
| Ranking Podios | fila 11 | 264 raperos, sin carta asignada |
| Ranking de Ligas | fila 9 | 32 raperos, sin carta asignada |
| Ranking Mundial | fila 1 | **los países**, por los puntos que su gente hizo |
| Ranking Duelos | fila 1 | **nueva**: quién ganó más duelos 1v1 |

⚠️ **LAS CABECERAS SE BUSCAN, NO SE CLAVAN.** Las de arriba son las de hoy y
**no hay que escribirlas en ningún lector**: `rankings.fila_cabecera()` y
`construir_pool_temporada._cabecera()` las encuentran pidiendo **dos** columnas
—con una sola, un banner que diga «Rapero» gana—. Un número de fila describe
el *diseño* de la hoja, no el dato, y tenerlo escrito rompió tres lectores el
día que la cabecera se movió.

✅ **Y EL MUNDIAL DEJÓ DE SER SELECCIONES.** Dlx, 22/09/2026: *«actualizar el
ranking mundial que ese evento fifa ya no se está haciendo»*. La hoja traía
tres cosas mezcladas —las selecciones, la **Fecha FIFA** y un «ranking
pasivo»—. Lo que se cae es el torneo; lo que queda en pie es el pasivo, que no
necesita ningún evento.

⚠️ Por eso pasa de selecciones a **países**: una selección la elige el capitán,
así que sin Fecha FIFA la tabla diría **quién fue elegido** y no quién rindió.
Sumando por país mide lo que su propia línea prometía y se recalcula sola.

⚠️ **YA NO HAY UN SOLO CORTE DE 8.** Hasta el 16/09/2026 esta línea decía que
*«el pool de las cartas son los que tienen 8 o más eventos: 138 de 735, y ese
mismo corte desbloquea el Win%, el rango competitivo y la carta»*. Dlx lo
partió en cuatro:

| carta | requisito |
|---|---|
| **Temporada** | 1 **participación** |
| **Competitivo** | **10** eventos |
| **País** | **3 duelos nacionales + 3 internacionales + bandera asignada** |
| **Servidor** | nada |

Vive en **`comun/requisitos.py`**, con su self-check — **y esa es la fuente**.
Correr `python comun/requisitos.py` imprime la tabla de arriba con los números
del pool de hoy.

⚠️ **La columna «pasan, de los 138» se sacó a propósito.** Eran números de la
pre-temporada, y desde el reset del 22/09/2026 el pool está en **0**: cualquier
cifra ahí sería de un mundo que ya no existe. El número de hoy lo da el
self-check, que además avisa cuando no hay con qué medirlo.

⚠️ **Y PAÍS ES LA PRIMERA CARTA QUE PIDE MÁS DE UNA COSA.** Dlx, 22/09/2026:
*«3 duelos nacionales y 3 internacionales y bandera asignada»*. Por eso
`REQUISITOS` pasó a ser **una lista de condiciones por carta** —todas, no sólo
País— en vez de una tupla suelta con un caso especial colgado al lado. La
Bloqueada muestra **la primera que falta**, en el orden declarado.

⚠️ **Eso deja a 4 personas con la carta de País bloqueada**, y no por
rendimiento: son las únicas de su país en el padrón, así que no tienen contra
quién hacer un duelo nacional.

✅ **CERRADO EL 22/09/2026, y no hay nada que construir.** Dlx, mirando los
cuatro casos: *«Emiratos y Brasil no deberían existir, no se les toma en
cuenta. Cuba y Nicaragua eventualmente se unirán personas, pero nada que
pueda hacer»*.

| | quién | qué pasa |
|---|---|---|
| **Emiratos** | Betelguese 🇦🇪 | no cuenta como país de la Liga — y además **no pasa el portón**: no tiene Discord ID, así que no tiene ninguna carta |
| **Brasil** | Kip | no cuenta. ⚠️ Y su dato es raro: es el **único de los cuatro sin bandera en el nombre**, o sea que el «Brasil» sale sólo de la columna del Sheet |
| **Cuba** | Ambidextro 🇨🇺 | país real, esperando gente. Tampoco pasa el portón hoy |
| **Nicaragua** | Oponente. 🇳🇮 | idem, y éste sí pasa el portón |

⚠️ **No se les borró nada.** «No se les toma en cuenta» cierra el tema como
problema; sacarles el país les sacaría **todas** las cartas, porque el portón
de identidad pide bandera. La carta de País simplemente no se les emite, que
es lo que ya hacía.

Otras 5 lo tienen difícil (Costa Rica 3, Guatemala 2), y ésas se resuelven
solas en cuanto compitan entre ellas.

⚠️ **Esta tabla decía otra cosa hasta el 20/09/2026** —*«Temporada: 2 eventos»*
y *«País: 1 evento nacional → 0»*— y las dos ya estaban cambiadas en el código.
Ver abajo por qué la de País cambió; la de Temporada pasó a contar
**participación** y no eventos.

⚠️ **EL REQUISITO BLOQUEA LA CARTA, NO EL DATO — y esa distinción es nueva.**
El 8 era las dos cosas a la vez, así que no había que separarlas. El **rango**
es uno solo por persona y tiene que dar igual en sus cuatro cartas; si subir el
Competitivo a 10 sacara a esa gente **del pool**, los 22 que caen se quedarían
**sin rango en su Temporada**, que sí tienen derecho a ver. Por eso los pools
no se tocan: cada carta pregunta por su requisito **antes de dibujar**.

🔴 **EL REQUISITO DE PAÍS CAMBIÓ TRES VECES, Y EL VIAJE ES LO QUE HAY QUE
LEER** — porque el argumento que lo movió en un sentido lo volvió a mover en
el otro.

| | pedía | por qué se cayó |
|---|---|---|
| hasta el 19/09 | 1 evento **nacional** | nadie cumple: la Fecha FIFA arranca en T2, o sea bloqueada para las 735 **para siempre** |
| 19/09 | **tener país** | no pide haber competido — y tras el reset la carta seguía saliendo con los números de la pre |
| **22/09** | **3 nacionales + 3 internacionales + bandera** | — |

⚠️ **El del 19/09 se apoyaba en que «lo nacional es lo que la carta MIDE, no
lo que la desbloquea».** Era cierto mientras lo nacional no se pudiera medir:
el dato no existía, así que pedirlo era pedir lo imposible. Desde el 22/09
**sí se puede** —`clasificar_duelos()` cruza cada duelo contra el país del
padrón— y entonces la frase se da vuelta sola: **lo que la carta mide vuelve a
ser lo que la desbloquea**, que es la regla del proyecto.

⚠️ **Y `bot/paises_nuevos.py` quedó sin sentido con ese cambio.** Existía para
emitir la carta de 309 personas que tenían país y no estaban en el pool; con
el requisito nuevo, tener país ya no alcanza. No se borró —el mecanismo de
emitir fuera del pool puede volver a hacer falta— pero **hoy no hay que
correrlo**.

⚠️ **Salen con los números en `—`, y eso es lo correcto**: esas personas no
tienen Score, así que no tienen OVR Nacional ni puesto. La carta ya sabe
dibujar el hueco — es la misma decisión que SEG, TER, DNA y DIN.

⚠️ **Y «sin requisito» no es «todos».** El `sv` de la Servidor sale del argmax
de 7 columnas del Sheet: quien no jugó nada no tiene servidor asignado.

✅ **EL POOL YA NO ESTÁ FILTRADO EN 8, desde el 23/09/2026.** Esto decía que
*«el pool guardado sigue filtrado en 8»* y que los de 2 a 7 no estaban en
`datos/`. Ese piso era de cuando el 8 era un corte único, y con la T1
arrancando de cero costaba lo máximo posible: **nadie recibía carta durante
semanas**.

Medido con el primer evento cargado: las 6 personas del #349 **cumplían** el
requisito de Temporada y el de Servidor, las dos cartas no se podían dibujar
porque el pool estaba en 0, y **5 de las 6 tenían carta de la pre-temporada en
R2** — así que `/card` les servía el OVR de una temporada reseteada. Nada
falló.

Ahora `MIN_EVENTOS` sale de `comun/requisitos.py` —el requisito más flojo, que
es **1 participación**— y es la regla de arriba aplicada: **el requisito
bloquea la carta, no el dato.** Debajo de su requisito, cada carta va a la
Bloqueada.

### Tres trampas del Sheet

1. **La columna `Sv` está vacía en 134 de 138.** El servidor se deriva de aquel
   donde el rapero tiene más puntos, usando las 7 columnas por servidor.
2. **La columna 🔥 guarda texto `actual/máxima`**, no un número. Si se lee como
   número, todos los TAG de racha desaparecen.
3. **El Score ya viene multiplicado por la Confianza**, que sube de 0.80 a 1.00
   recién a los 20 eventos. 80 de 138 están por debajo de 1.00, y Bau pierde
   16.2 puntos por eso. La carta no lo muestra.

Las credenciales van en `creds.json` en la raíz del proyecto. **No está en el
repo y no debe subirse.**

🔑 **Y TODAS LAS DEMÁS ESTÁN INVENTARIADAS EN `ACCESOS.md`**, en la raíz y
gitignoreado. Es el único lugar que dice **cuáles son todas**: el token del
bot, el de Cloudflare, la cuenta de servicio, el OAuth de Apps Script, los de
MEE6, los secrets de los dos repos de GitHub y los IDs que no son secretos
pero se pierden igual — Sheets, guilds, roles y canales.

⚠️ **Existe porque vivían en cinco lugares y ninguno los listaba**, y el
síntoma fue pedirle a Dlx que cargara un secret **que ya estaba cargado desde
hacía dos días**. Antes de decir «falta X», se mira ahí.

⚠️ **Trae también qué rotar al final y en qué orden.** Dlx: *«cuando todo esté
al 100 % ahí cambiaremos todos los tokens»*. El orden importa porque cada uno
está cargado en más de un lado y **el que queda viejo no falla: se queda
quieto** — ya pasó tres días seguidos con tilde verde.

🔴 **`ACCESOS.md` no se commitea nunca.** Si entra al historial hay que rotar
todo lo que contiene.

### Cómo se refrescan los pools

Los scripts viven en `sheet/`. El orden importa: el competitivo le pide al de
temporada el Win%, la racha y los avatares.

```bash
python sheet/explorar_sheet.py               # solo lee: hojas y cabeceras
python sheet/construir_pool_temporada.py     # -> datos/temporada_pool.json
python sheet/construir_pool_competitivo.py   # -> datos/competitivo_pool.json
```

**`datos/` es la única fuente de verdad.** Los generadores leen de ahí, así que
refrescar surte efecto solo.

Antes cada carpeta de carta tenía su propia copia del pool. Se borraron: los
builders escriben en `datos/` y nadie leía de ahí, así que **refrescar no
cambiaba nada en las cartas y no avisaba**. Si alguna vuelve a aparecer, es un
error: se dibujarían datos viejos en silencio.

⚠️ **`03_Servidor/normal_datos.json` NO es un pool: es una muestra** de 6
personas para trabajar la carta mientras está en curso. Por eso queda en su
carpeta y no en `datos/`, y por eso no lo tocan los builders.

⚠️ **Y por eso mismo ya se quedó vieja: 2 de esos 6 tienen un `score` que no
coincide con el pool**, y el `ovr` no coincide en ninguno. Es justo lo que
predice el párrafo de arriba. **Ya no bloquea nada**: desde que existe
`03_Servidor/generar.py`, ese archivo es la muestra del **layout viejo**, que
vive detrás de `exportar_png.py --viejo`.

⚠️ **`02_Competitivo/comp.json` SÍ parece una de esas copias y no lo es.** Son
8 personas, y `v2/gencomp.py` las lee para armar la hoja HTML de muestra. Pero
`02_Competitivo/exportar_png.py` **no** la usa como fuente: lee
`datos/competitivo_pool.json`, pisa `comp.json` con la persona pedida y **la
restaura siempre**, también si el generador falla. O sea que la carta
Competitiva se emite para las 138 aunque su muestra tenga 8. Verificado
corriendo `gencomp.py` con el pool entero: **138 cartas, sin un error**.

⚠️ **`02_Competitivo/eventos.json`, `interserver.json` y
`03_Servidor/colores_sv.json` eran copias** byte a byte de las de `datos/` y
**se borraron**: `gencomp.py` ya lee `datos/eventos.json`, y las otras dos no
las leía nadie.

⚠️ **Y el pool trae `crew` y `pos_crew` VIEJOS.** Sus 10 filas con `pos_crew`
salieron del dict de 13 personas que tenía el builder, así que Bloody figura
**5/9** cuando con la lista de Dlx es **2/9**. Ninguna carta los usa: las
cuatro sacan la identidad Y el número de `comun/crews.py`. **Los dos del mismo
lugar, a propósito** — si la identidad sale de un lado y el número del otro,
pueden discrepar, y era exactamente el caso de Bloody. Cuando el builder se
vuelva a correr, el pool coincide y se puede volver a leer de ahí.

`explorar_sheet.py` corrido el 29/07/2026: las 31 columnas que piden los
builders están presentes, y los conteos dan 735 / 138 / 264 / 32, que es lo que
esta guía espera. Los tres scripts piden **solo lectura**
(`spreadsheets.readonly`): leen el Sheet y escriben JSON local, ninguno modifica
la planilla.

---

## El hub web — `underlegends.pages.dev`

Seis vistas con menú lateral en escritorio y barra de abajo en teléfono,
enrutado por hash. Vive en **`bot/paginas/`**, sin framework y sin build:
los archivos que están ahí son los que se sirven.

🔑 **EL REPARTO ES TODO EL DISEÑO, y es lo que lo separa del Apps
Script.** Cloudflare Pages sirve estáticos **gratis e ilimitados**, así
que el HTML, el CSS, el JS y las imágenes **no tocan el presupuesto de 10
ms del Worker**. Lo único que pasa por él es `/api/lobby`, un json de ~16
KB que `bot/subir_web.py` deja masticado en KV y que el Worker reenvía
**sin parsear ni armar template** — el camino más barato que esa ruta
puede tener.

⚠️ Buscar, filtrar, ordenar, comparar y abrir tarjetas lo hace **el
navegador de quien mira**. Ordenar 200 filas ahí es gratis; hacerlo en el
Worker sale del presupuesto que comparten todos. Por eso la página puede
crecer sin costar nada.

🔑 **Y MUESTRA LAS TARJETAS DE VERDAD.** El bucket de R2 es público —
tiene que serlo, `/card` se las manda a Discord desde esa misma URL— y la
web no las estaba usando. La clave es `<nombre en minúsculas>/<carta>
.webp`: probarlo con `Makma/temporada.webp` da **404** y con
`makma/…` da 200, así que sale del inventario, no se inventa.

⚠️ **NINGUN COLOR DE RANGO NI DE SERVIDOR VIVE EN SU CSS.** Los ocho
salen de `comun/rangos.py` y los nueve de `datos/colores_sv_marca.json`,
viajan en el payload y se aplican en línea. Escribirlos ahí sería el
**sexto** lugar donde vive el rango.

⚠️ **Y NINGUNA SECCION SE DIBUJA VACIA.** Cada `pinta*()` se apaga sola
si no tiene con qué — es *«sin dato no hay pieza»* aplicado a una página.

---

## El bot de Discord

Se prueba el slash command **después de terminar la carta de País**. La
arquitectura y las decisiones ya tomadas están en **`CLAUDE.bot.md`**.

Lo que hay que saber acá:

⚠️ **El límite que manda son 10 ms de CPU por request**, no los 100.000
requests diarios. El número grande no molesta; el chiquito decide todo. Por
eso el Worker **no lee el Sheet**: lee datos ya masticados en KV o D1.

⚠️ **Playwright no corre en un Worker**, así que el render de las cartas no
puede vivir ahí. O se pregeneran los 414 PNG (138 × 3) o el render vive en
otro lado.

**La carta Servidor es el argumento de venta**: es lo que gana un servidor
aliado al sumarse, y por eso las estrellas del Interserver van en ella y no
en la personal. Conviene tenerlo presente al decidir su tamaño y su
exportación.

⚠️ **Un aviso que no deduplica es una pared de mensajes, y el dedup tiene
que sobrevivir al runner.** El ciclo **relee las llaves cada hora a
propósito**, así que todo lo que actúe sobre «vi esto» tiene que
deduplicar. `bot/avisar.py` lo hacía bien desde el primer día **y no
servía**: `datos/avisados.json` no estaba en el `ARCHIVOS` del `.yml`, así
que cada corrida arrancaba en un runner limpio **sin memoria**. Un dedup
cuyo estado no sobrevive no es un dedup.

⚠️ **Y cuando una llave cambia se EDITA el aviso, no se manda otro.** Una
llave se va completando durante la noche —entran duelos, aparece la final—
así que «mandar de nuevo si cambió» vuelve a sonar igual. Discord no
notifica un PATCH: el aviso sigue diciendo la verdad sin volver a sonar.

⚠️ **El token del bot no se commitea nunca**, misma regla que `creds.json`.
Si entra al historial hay que **regenerarlo en el portal de Discord**. De
paso, el token **arregla los avatares**: se le piden a Discord al generar, con
el hash actual, en vez de arrastrar URLs muertas.

---

## Git

Un commit por tanda de cambios, con un mensaje que diga **qué** se hizo y
**por qué** — el porqué es lo que no se puede reconstruir después leyendo el
diff.

🔴 **ESTA CARPETA ES EL REPO PÚBLICO `underlegends`, y hay otro.** Esta
línea decía *«git local, sin remoto por ahora»* y dejó de ser cierto el
24/09/2026:

| | |
|---|---|
| **`underlegends`** · **público** | esta carpeta. Donde corre el ciclo |
| `liga-global-tarjetas` · privado | la carpeta de arriba: el **archivo**, con el historial y las fotos |

⚠️ **El público es público por plata**: Actions es ilimitado ahí y son
2.000 min/mes en uno privado. Y arrancó con el historial en cero a
propósito — el del privado tiene 421 fotos de gente real.

⚠️ **EL CICLO COMMITEA ACÁ CADA MEDIA HORA** (`datos/`, con
`bot/ci/guardar.sh`). Antes de pushear: `git pull --rebase origin main`.
Y no se toca un archivo de `datos/` mientras corre una corrida (:22 y :52):
los dos commits lo cambian y el segundo choca.

⚠️ **`creds.json` nunca se commitea.** Está en `.gitignore` y ahí se queda. Es
una clave de cuenta de servicio con acceso al Sheet: si alguna vez entra al
repo, **no alcanza con borrarla en el commit siguiente** — queda en el
historial y hay que rotarla en Google Cloud.

Antes del primer commit de cada sesión, una sola cosa:

```bash
python herramientas/secretos_en_git.py
```

Comprueba las dos mitades, que son preguntas distintas: que los cuatro
archivos de credenciales estén ignorados —`.env`, `creds.json`,
`oauth_token.json` y `ACCESOS.md`— y que **ninguno de los nueve valores** que
hay adentro esté en el repo.

⚠️ **Mira el historial, no sólo los archivos de hoy.** Un chequeo que sólo
corre `git check-ignore` da verde el día después de la filtración, que es
justo cuando hace falta que grite.

⚠️ **Y sabe qué NO es un secreto.** `DISCORD_PUBLIC_KEY` está en `.env` **y
versionada en `bot/wrangler.toml` a propósito**: sirve para *verificar* la
firma de Discord, no para actuar. La primera versión del chequeo la marcó
como filtrada, y hacerle caso —resetear el par de claves de la app— habría
roto la verificación del Worker. **Una alarma que pide el arreglo equivocado
hace daño.**

## Cómo trabajar sin romper nada

### Un default que no es la decisión es un bug que no avisa

⚠️ **La forma se repitió tres veces en el mismo día**, así que conviene
reconocerla: la decisión está tomada, mirada y escrita — pero vive en **el
nombre de un archivo de hoja comparativa**, o en **una copia vieja**, y el
código que dibuja la carta usa otra cosa. Nada falla. Sale una carta válida y
distinta de la decidida.

| dónde | qué pasaba |
|---|---|
| `todos_sv.py` `DIV_OP` | decidido en **F** —todas las hojas desde el 20/08 se corrieron con `--div=F`— y el default quedó en **A**. El generador de la Servidor nació heredando A y dibujó otra línea |
| `gencomp.py` y el builder `CREWS` | un dict de **13** personas de antes de que Dlx pasara la lista de **48** el 20/08. 24 sin su rombo y **2 con la crew equivocada** |
| `gencomp.py` `EVENTOS` | el ícono se buscaba en una carpeta que no existe, así que de los **5** eventos entraba **1**, con un `continue` mudo |

**Lo que los tres tienen en común**: la decisión existía en un lugar y el
código la leía de otro. Los tres arreglos son el mismo — **un solo lugar**:
`04_Pais/maqueta.py` tiene `PRESET`, las crews viven en `comun/crews.py`, y el
default del divisor es el decidido. Si una decisión se toma y no entra al
código, no se tomó.

⚠️ **Y los tres pasan la lectura del diff.** El único que los encuentra es
generar la carta y mirarla, o cruzar el código contra los archivos que quedaron
en disco — el `_dF` del nombre de un PNG fue lo que destapó el primero.

### Contar lo que hay en disco no es contar lo que salió

⚠️ **Tres scripts distintos tenían este bug el mismo día**, los tres en el
camino que decide qué se sube, y los tres **dan por bueno lo viejo** en vez de
fallar:

| dónde | qué contaba | qué pasó el 20/09/2026 |
|---|---|---|
| `bot/generar_todas.py` | los PNG de la carpeta | competitivo dejó 8 sin redibujar y dijo `138 de 138 ok` |
| `bot/tanda_servidores.py` | idem, con techo «al menos 138» | 379 archivos donde había 144 de hoy |
| `bot/subir_cartas.py` | nada: subía los dos | `sv_x.png` y `servidor_x.png` dan **la misma clave** y ganaba el que contestara primero, con 8 hilos |

**El nombre del archivo no los separa**: la carta vieja de alguien del pool se
llama igual que la nueva. Lo único que los separa es el **mtime contra el
arranque de la corrida**, y por eso los tres lo toman ahora.

⚠️ **Y `generar_todas.py` existía para evitar exactamente esto**: su docstring
dice *«un pipeline que no cuenta da por buenas 137 cartas de las que vio 96»*.
Contaba — miraba el lugar equivocado. **Un contador que cuenta lo que no es no
se distingue de uno que anda.**

⚠️ **El techo tampoco se escribe.** `!= 138` es de la pre-temporada; sale de
`len(datos/competitivo_pool.json)`, porque la T1 arranca de cero y el pool
cambia de tamaño.

### Una columna que se arrastra de sí misma no tiene semilla

⚠️ **`Rango` estuvo vacío para TODA la vitrina y nadie lo vio**, porque el
mecanismo que tenía que llenarlo era copiarlo de la fila anterior de esa
misma persona (`ARRASTRE` en `sheet/rankings.py`). Después del reset no
había fila anterior con rango, así que quedaba vacío, así que la corrida
siguiente tampoco tenía de dónde copiar. **El dato no podía entrar nunca.**

Es la misma forma que *«quién debe tener carta no puede salir de quién ya
la tiene»*, y falla en el mismo caso: **el primero**. `ARRASTRE` es para lo
que no se puede calcular; el rango sale del Score, o sea que es de lo más
calculable que hay. Hoy lo pone `rankings.rangos_de()`.

✅ **Y SÍ LLEVA PUERTA: debajo de 10 eventos no hay letra.** Dlx,
23/09/2026: *«el ranking competitivo no aparece nadie hasta q tenga 10
eventos. Mira los requisitos de las tarjetas… estas son preguntas con
respuestas muy sencillas»*. Y es así — el número ya estaba en
`comun/requisitos.py`; lo que faltaba era aplicarlo.

⚠️ **EL `Ranking Competitivo` LISTABA A LAS 45, con gente de 1 evento.**
Hoy tiene **0 filas**, que es lo correcto: nadie llegó a 10 todavía.

⚠️ **Y ESO CIERRA LA INCOHERENCIA DE LAS TRES PANTALLAS.** Masino, con 1
evento y Score 56.1: el Sheet decía «Rango A», la página pública «Falta
9 EV» y su carta Competitiva estaba bloqueada. Ahora las tres dicen lo
mismo. El rango **es** el competitivo, y el competitivo pide 10.

🔴 **YO HABÍA LEÍDO ESTO AL REVÉS, apoyado en una línea de más abajo.**
*«El requisito bloquea la carta, no el dato»* y *«los 22 que caen se
quedarían sin rango en su Temporada, que sí tienen derecho a ver»* se
escribieron cuando el corte sacaba gente **del pool** —ahí sí perdían
todo—. No describen esto: acá el pool no se toca, sólo no se inventa una
letra que todavía no se ganó. Se deja escrito porque la frase sigue
valiendo para lo que decía, y confundirla cuesta media planilla.

⚠️ **Y EL POOL DEJÓ DE SER RESPALDO DEL RANGO.** `identidad()` lo saca de
`competitivo_pool.json`, que **no** tiene la puerta: mientras todos
tenían letra daba igual cuál ganara, y con la puerta puesta se volvió una
gotera —`Ranking Temporada` con 0 letras y `Ranking Duelos` con 5—. Un
respaldo que no sigue la regla sirve el dato **justo cuando la regla dice
que no hay dato**.

### El diseño de las vitrinas vive en `sheet/estilo.py`

**Todo color tiene que salir de un dato.** Pintar filas alternadas es
cosmética; pintar la celda de `Rango` con el color de ese rango es la
información que la carta ya da, en la vitrina. Los ocho colores se
**importan** de `comun/rangos.py` — si se copian, vuelve el bug de las
crews y el del divisor.

⚠️ **`addBanding` sobre una hoja que ya tiene banda es un 400 que tumba el
batch entero.** O sea que la primera corrida deja la vitrina linda y la
segunda la rompe. Las condicionales no fallan: **se apilan**, y a la décima
corrida hay diez reglas iguales. `rankings._adornos()` las borra antes —y
las condicionales **de atrás para adelante**, porque borrar la 0 corre las
demás.

⚠️ **`updateCells` con `userEnteredFormat` NO borra ninguna de las dos**:
banding y condicionales son objetos de la hoja, no formato de celda.

⚠️ **Y con 0 filas no se pide nada.** Un pool recién arrancado tiene la
tabla vacía —es un ESTADO, no un error— y una banda sobre un rango de
altura cero es otro 400.

### El exportador toma N nombres, y el `.png` es el que decide

⚠️ **`bot/pipeline.py` llama con los diez de la tanda en una sola línea** —
`exportar_png.py Agus Camila ELSOLAR …`— porque así reusa el navegador.
Temporada y Competitivo leían `argv[2]` como la ruta de salida: dibujaban
**sólo al primero** y lo escribían en un archivo llamado como el segundo.
Playwright saca el formato de la extensión, así que reventaba con
`path: unsupported mime type ""` y las diez figuraban como fallidas.
**38 cartas el 23/09/2026.**

**Ninguna de las dos mitades estaba mal**, y por eso no la encuentra leer
ninguno de los dos archivos: el pipeline manda varios nombres a propósito y
el exportador acepta `<quien> <salida.png>` porque lo dice su README. Lo
único que separa un destino de un nombre es la extensión — **nadie se llama
`algo.png`**.

### Quién debe tener carta no puede salir de quién ya la tiene

⚠️ **Tres lugares distintos sacaban la lista de gente a dibujar de
`datos/cartas_r2.json`**, o sea **de a quién ya se le había dibujado**. Es un
huevo y una gallina, y se nota con el único caso que importa: **quien se
verifica hoy no recibe su primera carta nunca.** El sistema sabía refrescar
cartas y no sabía emitirlas.

Medido el 22/09/2026: **319** pasan el portón de identidad y se dibujaban y
escribían **312**. Los siete que faltaban —KRT, Bull12r, Makmah, elzurdo,
yinn, Flennzs y MILICA— tienen Discord ID, país y el rol Miembro de DRA. Su
única falta era no tener ya una carta.

⚠️ **Y no fallaba.** `/card` les contestaba «todavía no estás verificado» a
siete personas que sí lo estaban — la respuesta equivocada con la cara de la
correcta. Es la misma forma que el bug de los avatares: *el dato estaba y el
pipeline lo tiraba*.

⚠️ **No alcanzaba con arreglar el generador.** El ciclo sube la carta
**después** de armar KV, así que `subir_datos.armar()` tenía que tomar la
**unión** del inventario con los que pasan el portón; si no, entraban recién
al ciclo siguiente — una hora de «no estás verificado» para alguien que acaba
de verificarse.

**El inventario de R2 sigue sirviendo, pero para otra pregunta: qué hay
subido.** Quien *tiene que* tener carta lo decide el portón
(`bot/verificados.py`).

### El pool vacío es un ESTADO, no un error — y aparece cuatro veces

⚠️ **Una temporada recién arrancada tiene el pool en cero**, y eso no es un
caso raro: pasa cada vez que empieza una. El 22/09/2026 se midió qué hacía
cada pieza en ese estado, y **cuatro contestaban mal**:

| dónde | qué hacía |
|---|---|
| `04_Pais/generar.py` | `max()` sobre vacío → `ValueError`, el generador **no arrancaba** |
| `04_Pais/generar.py --auditar` | `k / n` → `ZeroDivisionError`, escondido detrás del anterior |
| `02_Competitivo/exportar_png.py` | `D[quien]` → `KeyError: 'Konan'`, que no dice por qué |
| `comun/requisitos.py` | `pool[0]` → `IndexError` impreso como «falta `ev_por_sv`» |

**Las cuatro se veían distinto y eran la misma causa.** Y ninguna la tapaba
el ciclo, porque `emitibles()` no pide esas cartas cuando nadie está en el
pool: el crash esperaba a la primera persona que entrara, o a quien corriera
la herramienta a mano — que es como aparecieron.

**La regla:** «0 de 0» no es «0 %», es **no hay con qué medir**. Una barra
al 0 % dice que ninguna pieza se puede llenar; lo que pasa es que no hay a
quién llenársela. Lo mismo con «esa persona no cumple» contra «el pool está
vacío».

⚠️ **Y no cambia ningún requisito.** Los de cada carta están cerrados y
viven en `comun/requisitos.py`. Esto es sólo que el código no explote
mientras no haya nadie.

### Una cache que mira los datos no ve el código

⚠️ **El sello del ciclo hasheaba sólo los datos**, así que un arreglo al
dibujo no redibujaba nada: los datos quedaban idénticos, `que_cambio.py` no
veía diferencia y la carta se quedaba vieja **en silencio**, con el ciclo
informando «nada cambió» todos los días.

**Y ya había pasado tres veces**, las tres anotadas más abajo en este mismo
documento: la Competitiva *«tenía las fotos y dibujaba la inicial en 93 de
112»*, el arreglo del emoji y el de los avatares. Los tres fueron **código
puro, con cero cambios en el pool**.

Ahora cada hash es `<datos>:<código>` y el código sale de
**`comun/huella_codigo.py`**. Tres decisiones que conviene no deshacer:

- **Por AST y no por bytes.** Acá se escriben comentarios y docstrings
  enormes; un hash crudo redibujaría 138 cartas cada vez que se corrige una
  redacción. Medido sobre 89 commits: 10 disparos por bytes, **9** por AST.
- **`comun/` entera para las cuatro.** Se pensó seguir el grafo de imports
  y se descartó: a un grafo al que le falta una arista **le falta un
  redibujo**, que es la dirección peligrosa. Es la regla que `huellas()` ya
  tenía escrita — *«se redibuja de más antes que de menos»*.
- **El archivo se excluye de su propia huella.** Vive en `comun/`, así que
  sin eso tocar la herramienta cuesta 552 cartas. Es una regla resuelta con
  `__file__`, no una lista de excepciones a mano.

⚠️ **Y el guardián que existía para esto miraba `mtime`.** `mapa_viejo()`
comparaba la fecha de los archivos contra la del mapa — y **un `git
checkout` le pone a todos la hora del checkout**, así que en Actions, el
único lugar donde el ciclo corre desatendido, no detectaba nada nunca. Un
guardián que sólo funciona donde hay alguien mirando no es un guardián.

### Las dos piezas pueden estar bien y la composición mal

⚠️ `sheet/resultados.guardar()` es idempotente —borra las filas de ese número
antes de escribir—, y `procesar_entrada.py` prometía en su docstring que volver
a correrlo era seguro apoyado en eso. **No lo era**: el número salía de
`Config!B27 + 1`, así que la misma llave daba **#349 y después #350**. El mismo
evento dos veces, con las dos hojas idempotentes haciendo exactamente lo que se
les pidió.

**Apareció corriéndolo dos veces, no leyéndolo**: pasa la lectura del diff
entera, porque cada mitad es correcta. Es la misma forma que el bug de los
avatares —el dato estaba y el pipeline lo tiraba— un nivel más arriba.

**Medir, no mirar.** La regla que más tiempo ahorró en todo el proyecto. Cuando
algo "se ve mal", medirlo con Playwright antes de tocarlo. Varias veces lo que
parecía un problema de diseño era una medición mal hecha.

Tres casos reales:

- Un círculo parecía cortado. Buscar su color no servía: **el borde era del
  mismo color que el marco que lo tapaba**. Se resolvió renderizando con y sin
  el elemento y restando las dos imágenes.
- Un anillo de 2px "tenía huecos". Era el muestreo: a radio fijo se le pasaba
  por al lado. Cuando lo que medís es más chico que la tolerancia de tu
  medición, el número que sale no sirve.
- La fila de abajo se veía apretada aunque los números dieran simétricos. Se
  estaba midiendo contra el **texto** del TAG y no contra su **halo**, que
  arranca 8px antes.
- Una silueta se dibujó a ojo dos tandas seguidas y las dos veces salió
  distinta de la referencia. **Las siluetas se trazan, no se dibujan**:
  `herramientas/trazar_silueta.py` saca el contorno del PNG. Es lo que ya
  decía `shield.py` de la Competitiva —que los intentos a mano habían fallado
  durante horas— pero shield.py solo **lee** los `.txt` ya trazados y el
  script que los generó nunca quedó en el repo, así que la lección no se
  podía aplicar. Por eso el trazador ahora vive en `herramientas/`.

**Nada de regex sobre el CSS.** Tiene reglas multilínea y un regex sobre
`^selector {` se come `.card` entero. Ya pasó dos veces. Para borrar reglas hay
que usar un parser que respete comentarios (está en el historial de este
proyecto).

**Backup antes de cada tanda**, y después verificar: llaves balanceadas, que no
quede texto suelto fuera de reglas, y que el render salga **idéntico píxel a
píxel** cuando el cambio no debía verse.

**Rotación.** Un rombo de 44px rotado 45° ocupa 62. El flex lo mide por su caja
sin rotar. Si centrás la caja, el rombo queda 5px alto. **Siempre centrar lo
pintado, no la caja.**

---

## Exportar PNG

Dos trampas, las dos descubiertas a los golpes:

1. **Apagar la sombra antes de capturar.** `.card` tiene `filter:drop-shadow` en
   la Competitiva y la Servidor, y `box-shadow` en la Temporada. Si no se apaga,
   la sombra pinta toda la caja y el PNG sale rectangular en vez de con la
   silueta.
2. **Medir la unión con lo que cuelga por fuera.** En la Competitiva los chips
   van en `right:-11px` y los rombos en `left:-10px`. Pero hay que **saltear**
   lo que está dentro de `.clip` y los elementos SVG: `.rays` tiene `inset:-22%`
   y los `<path>` tienen `stroke-width:27`, así que sus cajas se salen 54 y 66px
   aunque el recorte no los deje pintar ahí.

Chromium no llega al CDN de Discord ni a Google Fonts desde un entorno aislado.
Hay que embeber avatares, escudos **y fuentes** en base64. Las 9 woff2 viven en
**`comun/fonts/embed.css`**.

⚠️ **Las banderas ya no se embeben: salen del repo.** Tres de los cuatro
generadores se las pedían a `flagcdn.com/w80/` teniéndolas en
`04_Pais/banderas/` — las dieciséis oficiales 3:2, bajadas de ese mismo CDN al
preparar la carta de País. Ahora todas pasan por **`comun/banderas.py`**, que
lee el archivo y deja el CDN sólo de fallback para un país que todavía no esté.

Costaba tres cosas y ninguna avisaba: **sin internet la carta salía sin
bandera**, en silencio; el exportador tenía que bajar una por carta; y **`w80`
son 80 px de ancho contra los 1280 del archivo**, para dibujar en 36×24 — o sea
que el repo da mejor imagen. Medido al cambiar: **País y Servidor no se mueven
un píxel** (ya la leían del disco) y en Temporada y Competitiva cambia el
**0.089 %** y el **0.020 %** del PNG, todo en los bordes de las bandas.

⚠️ **Vivían en las cuatro cartas a la vez.** Eran cuatro archivos de 543 KB con
el mismo md5, y la cuarta copia nació de copiar la tercera al montar el
exportador de País — que es exactamente cómo se propaga. Ahora hay una sola y
las cuatro la leen. Verificado moviéndola: los cuatro PNG salen **idénticos
píxel a píxel**, y los 85 scripts de `03_Servidor/disenos/` que también la
abrían apuntan al lugar nuevo.

⚠️ **`embed.css` trae Archivo 500/700/800/900 y Barlow Condensed 600/700, y NO
trae Archivo 600.** La carta de País lo pide en su `@import`, pero sólo para los
títulos de sus hojas comparativas; la carta usa 800 y 900. No hay que
"arreglarlo" sin leer esto.

⚠️ **Ningún generador embebe las fuentes: lo hace el exportador.** Los tres CSS
traen `@import` de Google Fonts, que anda al abrir el HTML en un navegador con
internet y **no** al renderizar en Chromium aislado. El exportador saca el
`@import` e inyecta `fonts/embed.css`. Si abrís un `salida/*.html` sin internet,
lo vas a ver con las fuentes del sistema y eso **no** es un bug de la carta.

⚠️ **La Servidor ERA el caso fácil y dejó de serlo.** Mientras su `clip-path`
recortaba a todos los hijos alcanzaba con capturar el elemento, y esa
complicación era exclusiva de la Competitiva. Pero el escudo del servidor pasó
a la punta de arriba **sobresaliendo del recorte**, y las estrellas apoyan
encima de él, **enteras afuera**. Las dos cosas viven fuera del `clip-path`,
así que ahora **sí hace falta calcular la unión**, igual que en la
Competitiva. Si se captura solo el elemento, se pierden el escudo y las
estrellas.

**Lo que sobresale se lee sobre un fondo que no controlamos.** El PNG cae en
Discord sobre lo que haya, y afuera del recorte no hay carta atrás que
sostenga nada. Por eso las estrellas llevan **contorno y no solo sombra**: el
acento de TFC es `#F2E9E9` y el de DRA `#FFFFFF`, que contra blanco dan
**1.19:1** y **1.00:1** — desaparecen. La sombra no alcanzaba porque es un
desplazamiento hacia abajo y deja el borde de arriba sin nada. URBF también es
blanco: hoy no tiene estrellas, pero el día que gane un Interserver entraría
en el mismo problema.

---

## Logos e íconos

El rombo y el círculo del estilo usan la imagen como **`mask-image`**: solo
importa el canal alfa. Un ícono de Discord es un cuadrado 100% opaco, así que
como máscara da un rombo blanco sólido. Por eso todo logo pasa por
`herramientas/procesar_logos.py`, con cuatro modos según cómo venga el archivo:

| modo | cuándo |
|---|---|
| `alfa` | el archivo ya trae transparencia útil |
| `fondo` | fondo plano de un color |
| `oscuro` | dibujo oscuro sobre claro (URBF es una pegatina: su alfa marca el contorno blanco entero) |
| `vivo` | dibujo saturado sobre fondo del mismo tono pero apagado (TWR) |

Normaliza por **tinta**, no por caja: un logo ancho metido en un cuadrado queda
con aire arriba y abajo y el rombo lo muestra chico.

También borra manchitas de menos del 2% pegadas al borde: el archivo de DRA
traía una marca de agua de 756px en la esquina que corría el centro del logo de
x=512 a x=603.

**Los 16 estilos** salen del rombo dorado de sus tarjetas originales con
`herramientas/extraer_estilos.py`. La separación **no es por brillo**: se probó
umbral fijo, porcentaje del dorado y Otsu, y ninguno anda en los 16, porque hay
íconos macizos (el puño) y otros de trazo fino (la columna). Lo que los separa
siempre es el **color**: el rombo es cromático y el ícono acromático, así que el
ícono es el rombo relleno menos lo dorado.

Dos son dibujados y no extraídos: **ingenio** es un cerebro y **filosófico** una
columna griega. Filosófico reemplazó a *actitud*.

⚠️ El cargador de `gencomp.py` acepta PNG y SVG. Si vuelve a leer solo `.svg`,
los estilos desaparecen **en silencio**, porque hoy `ESTILO_DE` está vacío y
nadie se daría cuenta.

### El emblema de la Servidor va en `comun/emblema.py`

El escudo del servidor **sobresale por la punta de arriba** y las estrellas
apoyan encima de él, **enteras fuera del recorte**. Geometría, estrellas,
degradé y excepciones están en `comun/emblema.py`; los escudos los genera
`herramientas/escudos_cuadrados.py` en `comun/escudos_cuad/`.

**Los PNG de los escudos traen solo tinta, sin fondo: el fondo lo pone la
carta** con el tono del servidor. Se probaron las dos alternativas y las dos
fallan por el mismo lado — con placa única los logos cuyo **color vive en el
fondo** lo pierden (DRA quedaba en blanco y negro), y con el fondo del
archivo cada uno mete **el color de su archivo** al lado del de la carta
(TFC y FTN traían su negro, y su tinta quedaba chica adentro de ese negro:
el cuadro se llenaba, el logo no).

**Dos excepciones, las dos por el mismo motivo**: cuando el fondo es parte de
la marca, sacarlo no limpia, **borra**. **SR** lleva fondo propio, porque su
cobra encendida existe contra el negro. **TWR** va a sangre con su baldosa
entera: se le pueden separar las letras por saturación, pero las letras solas
no se leen como TWR.

⚠️ **Las manchitas mueven el centro.** El archivo de DRA trae una marca de
agua en la esquina, y como el centrado es por caja de tinta, esa manchita
corría el centro de `x=511.5` a `603.5` sobre 1024 — **46 px sobre 512**, todo
hacia la izquierda. `procesar_logos.py` ya lo resolvía, pero entra por
`logos_originales/` y este por `logos_color/`, así que el arreglo no llegaba.
**Dos scripts, el mismo archivo con el mismo defecto, y solo uno lo sabía.**

### El escudo del servidor va en `comun/escudos.py`. No lo dupliques.

URBF, EFA y FFA no tienen ícono de Discord, así que usan su silueta de
`logos_sv/`. Ese fallback estaba escrito **tres veces**, una por carta, y
`gencomp.py` quedó sin él: hacía `LOGO[sv]` directo.

Resultado: `KeyError: 'URBF'` que **tumbaba las 138 por 2 personas**. Con la
muestra de 8 no aparecía nunca, así que la carta se podía dar por terminada sin
enterarse.

Ahora `LOGO` y `escudo()` viven en `comun/escudos.py` y las tres cartas lo
importan. Si mañana un servidor consigue ícono, se agrega ahí y lo toman las
tres. **Si esto se vuelve a duplicar, el próximo servidor sin ícono va a romper
solo algunas cartas y va a costar encontrarlo de nuevo.**

Las siluetas también estaban triplicadas y se unificaron en `comun/logos_sv/`.
`herramientas/procesar_logos.py` ahora entra por `logos_originales/` y sale
ahí: antes apuntaba a `herramientas/logos_sv/`, que **no existe**, así que
regenerar las siluetas no llegaba a ninguna de las tres cartas.

**El criterio, para no volver a caer:** lo que es de una carta vive en su
carpeta; lo que comparten las tres vive en `comun/`. Los estilos, por ejemplo,
son solo de la Competitiva y se quedan en `02_Competitivo/v2/estilos/`.

---

## Qué falta

### Datos
- **Llaves de Snake Rap, TWR y Fontana.** Cuando lleguen se agregan a
  `datos/eventos.json` con su prioridad y entran solas.
- **Los duelos.** Hoy son reales en 4 raperos; el resto muestra `0/0`. El dato
  vive en el acumulador, que no estaba montado en el entorno donde se armó esto.
- **`ESTILO_DE` está vacío**: nadie tiene estilo asignado. Los 16 íconos están
  listos y toman el color de la carta.
- **32 nombres de las llaves no están en el Ranking Competitivo**, incluidos
  campeones: Rodri LP ganó el Interserver, Ceko el de FRZ, Olaf salió segundo,
  Logan segundo en Urban y Edu segundo en DRA. No llegan a los 8 eventos.
- ⚠️ **Los avatares se están muriendo y nada los repone.** La columna `av`
  guarda un link de `cdn.discordapp.com` con un hash que Discord invalida
  cuando la persona cambia su foto.

  | medido | caídos |
  |---|---|
  | julio 2026 | 6 de 20 |
  | **04/08/2026** | **11 de 20** — quedan **9 vivos** |

  Caídos hoy: Konan, **Valen**, Vize, Bloody, Tam, MCO, Jupiter, Provenza,
  Krtman, Trot y Rayo. Ojo con Valen: es la foto usada en todas las hojas de
  diseño de la Servidor, así que `03_Servidor/disenos/av_valen.png` es una
  **copia guardada de una URL que ya no existe**.

  **Y no se puede refrescar desde el Sheet, porque el Sheet no los tiene.**
  `construir_pool_competitivo.py:105` lo dice: *«lo que ya teníamos: duelos y
  avatares, que no están en el Sheet»*, y los rescata del **JSON anterior**,
  o sea de sí mismo. Cada rebuild arrastra las mismas URLs muriendo, así que
  el número **solo puede empeorar**. Tener las credenciales del Sheet no
  ayuda acá.

  ✅ **ARREGLADO EL 20/09/2026: la foto se congela por temporada.**
  `bot/fotos.py` le pide los avatares a Discord **en bloque** —la lista de
  miembros de DRA trae el hash adentro de cada `user`, mil por llamada, así
  que son cuatro llamadas y no cuatrocientas— y los guarda en R2 bajo
  `fotos/t1/`. **Guardada como archivo propio, esa URL no vence nunca.**

  | | antes | ahora |
  |---|---|---|
  | la foto, sobre las 138 | **110 (79.7 %)** | **112 (81.2 %)** |
  | guardadas en R2 | — | **307** de 443 con Discord ID |

  🔴 **EL «9 DE 138» ERA VIEJO Y SE REPITIO TODO EL DIA.** Esta guia decia
  que habia *«nueve avatares bajados y versionados»*; hay **422**, bajados el
  19/09/2026 y versionados —116 MB en el repo—. O sea que el salto de traer
  las fotos de Discord fue de **+2**, no de +103. El numero se venia
  arrastrando de antes de esa bajada y nadie lo volvio a medir.

  ⚠️ **Lo que si valio la pena de esa tanda no es el conteo**: es que ahora
  la foto esta **congelada por temporada y en R2**, que es lo que necesita la
  Historica y lo que hace falta para dibujar en la nube. `_avatares/` es una
  carpeta plana sin temporada y vive solo en esta maquina.

  🔴 **Y LA COMPETITIVA TENIA LAS FOTOS Y DIBUJABA LA INICIAL EN 93 DE 112.**
  Encontrado auditando el 20/09/2026. `gencomp.py` hacía
  `hay_foto(c['av'])` sobre la `av` **del pool**, que está vacía en **118 de
  las 138** —el Sheet no guarda avatares—, así que decidía dibujar la
  inicial **antes** de preguntarle al respaldo. El exportador tiene un
  rescate (`respaldo.para(url)`) pero actúa sobre un `src="http…"` que en ese
  caso nunca se llega a escribir.

  Medido corriendo las dos versiones sobre el pool entero:

  ```
  el código de antes    19 de 112    17 %
  el de ahora          112 de 112   100 %
  ```

  Ahora pide `respaldo.avatar(nombre, av)`, que pregunta primero por el repo
  — lo mismo que ya hacían la Temporada, la Servidor y la de País.

  ⚠️ **Y la primera medición dio 112 de 112 en las dos**, o sea «no hay
  bug». Estaba buscando `src="data:image` en el HTML, y **la bandera también
  es un `data:` URI**: daba que sí para todo el mundo. El avatar se reconoce
  por su `onerror`, que ninguna otra imagen de la carta tiene. Es la regla de
  siempre — medir la cosa equivocada se parece mucho a medir bien.

  El resto se reparte así: **16 no se pusieron foto** en Discord —y ahí no se
  guarda nada a propósito, porque el blob gris por defecto es peor carta que
  la inicial con el color del rango— y **119 no están en DRA**, así que su
  avatar no se puede ver desde acá.

  ⚠️ **UNA CARPETA POR TEMPORADA, no una que se pisa.** Si se pisara, las
  cartas de la T1 pierden su cara cuando arranque la T2, y eso rompe la
  Histórica — que justamente necesita la cara que cada uno tenía **en cada
  temporada**. La temporada vive en `comun/temporada.py` y en un solo lugar;
  `bot/desplegar.py` se la inyecta al Worker como binding.

  ⚠️ **R2 es la fuente y `comun/fotos/` el espejo local, gitignoreado.** Son
  10.4 MB de fotos de personas reales: el historial de git las volvería
  permanentes, también para quien después se vaya. Se llena con
  `python bot/fotos.py --espejo`, y `comun/respaldo.py` las busca ahí primero.

  ✅ **Y EL ESPEJO YA ES UN PASO DEL CICLO, del 21/09/2026.** Sin él un
  runner limpio dibuja **15 caras de 138**: el checkout trae `_avatares/`
  y no el espejo, que está gitignoreado. Medido sobre las 138:

  | de dónde sale la cara | llega a |
  |---|---|
  | sólo el espejo — lo que ve Actions | **112** |
  | sólo `_avatares/` — lo que hay en git | 110 |
  | en git y **no** en el espejo | **0** |

  O sea que R2 cubría todo lo que cubre git, y dos más.

  🔴 **Y ESE «0» YA NO ES CIERTO: hoy son 7.** Re-medido el 22/09/2026 —
  Fakin Jose, HN 56, Kun Z, Lázaro, Lucas 123, Mr Still Ballin y Rune WS
  tienen su cara en `_avatares/` y **no** en R2.

  ⚠️ **Pero los siete fallan el portón de identidad**, o sea que hoy no
  pueden tener carta: sacar los 116 MB no pierde nada en uso. Y si alguno
  se verifica después, `bot/fotos.py` se la pide a Discord.

  **Lo que cambia es el argumento, no la conclusión**: ya no es «R2 cubre
  todo», es «lo que R2 no cubre no se usa». La primera se comprobaba sola;
  la segunda hay que volver a medirla el día que se borre.

  ⚠️ **El paso vive en `bot/pipeline.py` y no en el `.yml`**, porque la
  precondición es *dibujar*, no «correr en Actions». En el workflow queda
  bien para ese llamador y mal para el otro — alguien con el repo recién
  clonado corriendo `pipeline.py --correr` saca cartas con la inicial y
  nada avisa.

  ⚠️ **Y baja en paralelo**: 507 ms por objeto para traer 25 KB es latencia,
  no ancho de banda. De a uno los 443 daban 225 s; con ocho hilos, **34**.

  ⚠️ **Y `/foto` deja que cada uno la cambie, una vez por temporada.** El
  Worker **no necesita el token** para eso: el hash del avatar **viene en el
  payload que Discord firmó**. Con el rol `1531136241171697807` de DRA se
  puede cambiar cuando se quiera.

  🔴 **EL CDN NO AGRANDA, Y ESTO DECÍA LO CONTRARIO.** La versión anterior de
  este párrafo afirmaba que *«la misma URL con `?size=512` trae la misma foto
  cuatro veces mas grande»*. **Es falso pasado el tamaño original.** Medido
  el 20/09/2026 pidiendo cinco tamaños del mismo hash:

  ```
  Konan     size=128 -> 128    size=256 / 512 / 1024 / 4096 -> 256
  Abyssus   size=128 -> 128    size=256 en adelante         -> 256
  Afidu     size=128 -> 128    size=256 en adelante         -> 170
  ```

  `size` es un **tope**, no un pedido: el CDN devuelve lo que la persona
  subió. El salto real es **128 → 256**, o sea el doble y no ocho veces — la
  carta pasa de agrandar 2.7× a 1.35×. **Se gana la mitad del problema y no
  hay forma de ganar el resto**, porque el píxel no existe en ningún lado.
  Por eso `bot/fotos.py` imprime la **distribución** de tamaños y no un
  promedio: lo que hay que poder ver es cuántas caras van a salir blandas
  igual. Medido sobre las 307: **186 quedan por debajo de 345 px (63 %)**.

  ⚠️ **Y las cartas se dibujaban sin foto TENIENDO la foto en el repo.** Hay
  **422** avatares bajados y **versionados** —421 en
  `03_Servidor/disenos/_avatares/` más `av_valen.png`, 116 MB— y sólo la de País
  los usaba. Las otras tres pedían la URL del pool, se comían el 404 y caían
  en la inicial. Ahora las cuatro caen primero en la copia del repo:
  **`comun/respaldo.py`**, que también tapa el escudo de **SR**, cuyo icono de
  Discord ya no responde y cuya silueta está en `comun/logos_sv/` desde
  siempre.

  Medido sobre la carta Servidor de Juasmio: pasó de **6 imágenes rotas a 1**.

  ⚠️ **Esto TAPA el problema, no lo arregla**, y conviene no confundirlo: el
  respaldo no es el mismo recorte que el CDN —los archivos se bajaron con el
  tamaño que tenían ese día—, así que una carta con respaldo puede verse más
  blanda. Medido: **186 de las 307 guardadas quedan por debajo de los 345 px**
  que la carta dibuja, y ese píxel no existe en ningún lado.

  ⚠️ **Acá decía «son 10 de 138» y hoy son 112.** El respaldo dejó de ser el
  parche de unos pocos y pasó a ser **de dónde sale la cara de casi todos**.
  El número de hoy lo da `python herramientas/puedo_generar.py`.

  ⚠️ **Y hacía falta una segunda cosa en la Temporada**: `normal_v3.py`
  decidía foto-o-inicial con `av.startswith('http')`, así que descartaba el
  `data:` URI del respaldo **en silencio**. Ahora vale `_hay_foto()`.

  El arreglo de fondo sigue siendo **traerlos de Discord al generar**, como
  hace `sync.py`, y eso necesita un **token de bot**. Mientras tanto, los dos
  exportadores avisan: la Temporada cae en iniciales y la Competitiva lista
  las URLs que no dieron 200 (antes ponía `src=""` en silencio y la carta
  salía sin foto).

### Arte
- **FFA no tiene marca usable**: lo que hay es un póster con micrófonos, llamas
  y texto. Haría falta un isotipo suelto.
- **URBF y EFA no tienen ícono de Discord cargado**, así que su color de
  servidor está asignado a mano.

### La carta de País

Son **tres archivos y no uno**, y la diferencia importa:

| archivo | qué hace | de dónde saca la gente |
|---|---|---|
| `maqueta.py` | dibuja la carta y trae once hojas comparativas | **dos personas escritas a mano** |
| `generar.py` | arma las 138 desde `datos/` | los pools |
| `exportar_png.py` | el PNG transparente para Discord | `generar.py` |

⚠️ **La GENTE de `maqueta.py` NO son datos**: son Konan con los números
redondeados a mano y KAIRO, que no existe. Sirve para mirar el diseño y para
las hojas; **cualquier cosa que se quiera saber sobre las 138 se pregunta con
`generar.py --auditar`.**

```bash
python 04_Pais/generar.py --auditar        # qué se puede llenar y qué no
python 04_Pais/generar.py Konan Axinu Am   # una hoja con esos tres
python 04_Pais/generar.py --todas          # las 137 que tienen país
python 04_Pais/generar.py --paises         # una por país, el mejor de cada uno
python 04_Pais/generar.py --paises --caras # la misma, con caras de muestra
python 04_Pais/exportar_png.py Konan       # el PNG transparente
python 04_Pais/exportar_png.py --todas     # los 137 PNG

python 04_Pais/maqueta.py            # la carta de muestra
python 04_Pais/maqueta.py --chips    # las seis formas del chip de duelos
python 04_Pais/maqueta.py --paneles  # las seis texturas del panel
python 04_Pais/maqueta.py --tags     # los 25 TAG y sus tres niveles
python 04_Pais/maqueta.py --stats    # los juegos de stats que se probaron
python 04_Pais/maqueta.py --combos   # las variantes del casillero
```

⚠️ **`--paises` es la hoja que decide el fondo**, y por eso vive en el
generador y no en un script suelto. Cada bandera se comporta distinto contra la
foto, el velo y las stats: **la carta se mira en las dieciséis o no se mira**.
Toma el mejor de cada país, así la hoja muestra también el caso del `#1`.

⚠️ **`--caras` reparte caras que NO son de esa gente, y lo dice al correr.**
Nació cuando sólo 10 de 138 tenían foto y quince de dieciséis salían con la
inicial, así que la hoja no servía para lo único que hay que mirar ahí. **Hoy
son 112 de 138**, con lo cual `--paises` sola ya alcanza para la mayoría de
los casos — pero `--caras` se queda, y **no por inercia**: reparte las que hay
más los cuatro casos armados de `avatares.py` —oscura, clara, contraste,
ruidosa—, que **para juzgar un fundido son mejores que caras lindas: aíslan la
variable**. Las 112 reales son todas caras normales; el fundido se rompe con
las raras, y ésas hay que ponerlas a mano. `generar.py Konan` sigue dibujando
lo que Konan tiene.

#### Qué se puede generar hoy, medido sobre las 138

`generar.py --auditar` lo contesta solo. **Al 20/09/2026**:

| llega a | piezas |
|---|---|
| **138** | nombre, rango, escudo del servidor, TAG, EVN, EVI, **país, bandera, OVR Nacional, SEG, TER** |
| **137** | puesto en el rango |
| 135 | puesto en el servidor |
| 128 | puesto en el país |
| **112** | la foto |
| 31 | crew |
| **0** | **DNA, DIN y los dos trofeos** |

⚠️ **Tres de estas filas se movieron el 20/09 y la tabla vieja decía otra
cosa.** `SEG` y `TER` pasaron de **0 a 138** —estaban en las columnas `🥈` y
`🥉` del Sheet y el builder las leía para sumarlas en `pod` y tirar el
desglose diecisiete líneas después—; la **foto** pasó de «9» a **112**, y ese
9 nunca fue cierto: había 422 avatares bajados y versionados desde el 19/09 y
el número se venía arrastrando de antes; y **país** llegó a 138 porque la
identidad ahora sale del padrón y Mark tiene país ahí.

⚠️ **Las que quedan en cero no son un bug del pipeline.** Los duelos no
guardan de qué país era el rival, así que `DNA` y `DIN` no se pueden separar
—**se desbloquean solas** en cuanto `1v1` tenga filas con el país del rival,
ver `sheet/rankings.py`— y los dos trofeos esperan a la T2. Hoy la carta los
dibuja como `—`, que es la respuesta
honesta: **el agujero se ve en la carta en vez de esconderse detrás de un
número plausible**, que es lo que hacía `DEMO_NAC`.

⚠️ **EVN es 0 para las 138 y eso es correcto**, no un hueco: jugaste en cero
eventos nacionales porque todavía no hubo ninguno.

⚠️ **EVI es una decisión, no un dato crudo.** Es `ev` del pool de temporada,
o sea *todos* tus eventos, porque hoy toda la competencia es de servidor —
afuera de tu país—. El día que existan brackets nacionales hay que partirlo.

⚠️ **El OVR Nacional ya está implementado y NO necesita credenciales.** Es N3
de `docs/pais_hallazgos.md` —la media geométrica entre tu Score y el Score
Selección de tu país—, y el Score Selección se lee de `datos/mundial.json`. Da
un solo 99 (Konan), Am pasa de 99 a 70, y el orden dentro de cada país no
cambia, así que la pastilla de `pos_pais` sigue diciendo la verdad.

⚠️ **La silueta mide 463 de alto pero la carta 402.** El `path()` trazado de
`comun/siluetas.py` llega a 463; la carta usa el remate `recta`, que corta el
pie. Los dos números son correctos y hablan de cosas distintas — al comparar
con las otras cartas, el que vale es **402**, que es lo que se ve.

⚠️ **Y es la más baja de las tres**: Temporada 438, Competitiva 485, País 402.
En Discord el feed escala por ALTO, así que la más baja se muestra **más
ancha**. No es un detalle estético: es cuánto ocupa en el chat.

**Su número es el OVR Nacional** y su pastilla el puesto dentro del país. Sale
del pool, así que se recalibra solo cuando llegue la T1 —
`docs/t1_que_se_mueve.md` lo explica.

**Las seis stats se parten todas igual, nacional contra internacional**:
`EVN·EVI` dónde jugaste, `SEG·TER` cómo te fue, `DNA·DIN` los duelos ganados
sobre jugados contra cada tipo de rival. Que las seis usen **un solo corte** es
lo que hace que el bloque se lea de una: la columna izquierda es lo tuyo dentro
del país y la derecha afuera.

⚠️ **Los duelos estuvieron en dos chips a la derecha y volvieron al bloque.**
La idea funcionaba —los chips son el lenguaje de la Competitiva— pero costaba
más de lo que daba: sacarlos deja una fila vacía y **no hay dos stats más que
valgan**. Las mejores que quedaban eran `MEJ` (tu mejor puesto histórico) y
`SUB` (cuántos puestos subiste), que además de pedir historial que no existe
**no se entienden sin explicación** — el propio Dlx preguntó qué eran. O sea
que el precio de los chips era inventar dos datos para tapar el agujero que
ellos mismos abrían. El código se queda en los juegos `chips-*` y en `--chips`,
pero la carta no los usa.

Se probaron cinco juegos distintos antes de llegar acá, y los que se cayeron lo
hicieron por motivos que conviene no repetir:

- **WIN** repite el win rate de otra carta.
- **POD entero** repite los primeros puestos, que el trofeo ya cuenta con su
  `×N`. Por eso se parte en `SEG` y `TER`.
- **EVT** se pisa con las fechas: si los eventos nacionales *son* las fechas,
  los dos casilleros dicen casi el mismo número.
- **RIV** (rivales distintos) **se satura en 8 meses**: sólo 9 países tienen 3
  o más personas en el pool, y la competencia es mensual.

⚠️ **Tres países tienen 84 de 138.** Argentina 33, Chile 26, Colombia 25, y
ocho países tienen una o dos personas. Cualquier stat que dependa de que
existan brackets nacionales va a estar vacía para casi todos.

#### Las banderas son archivos, no CSS

Están en `04_Pais/banderas/` (oficiales 3:2, para el chip) y en
`04_Pais/banderas_carta/` (preparadas para la carta). Las 17 definiciones CSS
de `fondos.py` **siguen ahí** y no son basura: `??` no tiene bandera, son el
fallback si falta un archivo, y documentan los colores que compara
`ver_fondos.py`.

⚠️ **Una bandera no es una sola cosa: son franjas y a veces un escudo.**
Estirar una franja no se nota; estirar un escudo se nota siempre, y la carta
estira **2.32×** en vertical. `herramientas/banderas_carta.py` los separa
solo: la mediana de cada franja reconstruye la bandera sin nada encima, y lo
que sobra al restar es el escudo.

⚠️ **Lo que toca un borde no es un escudo, es estructura.** Un cantón, una
cruz, cuatro cuartos o un triángulo tienen su tamaño definido *contra* la
bandera, así que sacarlos de la deformación los deja flotando. Esa regla no
necesita ningún umbral y separa las dieciséis exacto.

⚠️ **Pero estirar la estructura estira también lo que tiene adentro, y eso son
DIBUJOS.** Dlx: *«algunos símbolos o escudos de los países tienen que ser
ajustados — por ejemplo las estrellas de Estados Unidos»*. Era lo mismo que
Drako había visto de los escudos, un nivel más adentro. Las **seis**
estructurales tienen todas un dibujo dentro:

| | |
|---|---|
| **us** | 50 estrellas en el cantón — salían como espigas verticales |
| **uy** | el Sol de Mayo — salía ovalado |
| **pa** | dos estrellas, una por cuarto blanco |
| **pr** | una estrella dentro del triángulo |
| **cl** | una estrella en el cantón |
| **do** | el escudo, donde se cruza la cruz |

**La regla no cambió: se aplica a REGIONES, no a la máscara entera.** Antes se
preguntaba *«¿toca un borde algo de lo que sobresale?»* y con un solo sí la
bandera entera se daba por estructura. Ahora se etiquetan las regiones planas
—cada franja, el cantón, cada estrella— y se pregunta una por una. Una franja
toca: estructura. Un cantón toca: estructura. Una estrella no toca ninguno:
dibujo. **El mismo criterio, sin un número nuevo.**

⚠️ **Los dibujos cercanos se agrupan dilatando, no por contención.** Probé
contención primero —*«lo que cae dentro de la caja de otro es del otro»*— y el
escudo dominicano salía partido en **cinco**, porque sus pedazos están uno *al
lado* del otro. Dilatar y volver a etiquetar junta lo que se toca y deja
separado lo que no, que es exactamente la diferencia entre un escudo y un campo
de cincuenta estrellas.

⚠️ **Dos trampas que costaron una vuelta cada una**, las dos del antialiasing:

- **Por área, una estrella de EEUU es ruido.** Mide 500 px sobre 860.000. Se
  filtra por el **lado menor** de la caja, que es lo que separa un hilito de
  borde de una estrella.
- **Quedaba un fantasma.** El halo antialiaseado del dibujo no está en la
  máscara, así que sobrevivía al borrado, se estiraba con la bandera y se veía
  **detrás** del dibujo bien dibujado: un sol alto y pálido atrás del sol
  redondo. Se borra una versión dilatada.

Verificado: las **diez** banderas que ya salían bien salen **byte a byte
idénticas**, y `maqueta.png` no se mueve —Konan es `ar` y Kairo `ec`, las dos
del camino de escudo—.

⚠️ **El corte de color cae en el borde de la banda del nombre.** No es adorno:
dos horizontales casi alineadas se leen como un error de alineación. Diez
banderas se acomodan solas; las fracciones van con **cuatro decimales**, porque
un tercio es `.6667` y con `.67` el corte queda a 2.2 px.

⚠️ **El `background` de la carta se cuenta por capa, y el MATERIAL son
varias.** `fondo()` arma un `background-size` y un `background-position` por
capa, y durante un tiempo metió el MATERIAL entero —cuatro sub-capas separadas
por comas— como si fuera **una**. La cuenta daba 6 capas contra 3 tamaños; CSS
repite la lista cíclicamente y la bandera caía justo en el último del ciclo,
así que **andaba de casualidad**. El que sí pagaba era el *brillo*: recibía el
`100% 435.8px` de la bandera en vez del suyo. Hoy `MATERIAL_CAPAS` es una tupla
que se desarma en `fondo()`, y hay un chequeo de que capas, tamaños y
posiciones son la misma cantidad y que la última capa es la bandera. Si alguien
vuelve a juntarlas en una cadena, la bandera se dibuja con `auto` —corrida y
sin estirar— y no avisa.

⚠️ **El MATERIAL ya no lleva tejido.** Eran dos diagonales cruzadas al 3.5% y
5%. Dlx: «hay una textura en la sección de arriba donde está el avatar y abajo
donde está el tag, quita esas 2 texturas». **No eran dos: era una sola, vista
en los dos únicos lugares donde nada la tapa** — la foto se come la del medio,
la banda del nombre y la sombra de las stats el resto. Medido apagándola sola:
0.11 de media sobre la foto, 0.26 detrás del TAG, 0.15 en el panel. Quedan la
viñeta y el brillo. **La trama de la banda del nombre (`TEXTURA[rg]`) y los
puntos del panel NO son esto y se quedan**: esas dos se eligieron a mano.

#### Lo que hay que medir, y con qué

| script | qué contesta |
|---|---|
| `herramientas/hueco_numeros.py` | si el número pegado a cada icono guarda el mismo hueco — **sólo vale en modo `tinta`**, y avisa si no lo está |
| `herramientas/entra_panel.py` | si el panel aguanta el peor caso: seis casilleros y dos cifras |
| `herramientas/textura_al_achicar.py` | cómo aguanta una textura cuando el PNG se achica en Discord |

Y una que no es de País sino de todas:

| script | qué contesta |
|---|---|
| `herramientas/puedo_generar.py` | si las cuatro cartas salen, y salen para las 138 |

⚠️ **Corre los generadores de verdad, no lee el código**, porque los dos
errores que este proyecto ya se comió —`KeyError: 'URBF'` que tumbaba las 138
por 2 personas, y una carpeta con su copia vieja del pool— **los dos pasan la
lectura**. Uno aparece recién con la persona 137 y el otro no aparece nunca.
Al 21/09/2026 da:

```
Temporada    138 de 138   ok · el pool entero
Competitivo  138 de 138   ok · el pool entero
Servidor     138 de 138   ok · el pool entero
País         138 de 138   ok · el pool menos 0 sin país
Bloqueada      3 de   3   ok · una por cada carta que SÍ se bloquea
```

⚠️ **País decía `137 de 137` y hoy dice 138**, y el cambio no es de esta
herramienta: la identidad pasó a salir del **padrón**, donde Mark sí tiene
país. Su carta se emite desde entonces.

⚠️ **Pero el mecanismo que hacía valer ese 137 sigue siendo la mitad de la
gracia.** El techo de cada carta es distinto y **lo declara ella**: si mañana
entra alguien sin país, País vuelve a decir 137 de 137 y eso está bien.
Comparar todo contra 138 haría que la única carta completa pareciera rota.

⚠️ **El peor caso no es el de nadie.** Konan tiene cuatro casilleros y números
de una cifra: así entra todo con holgura y no se ve ningún problema. El que
decide es el de **seis** con dos cifras, que hoy no lo tiene nadie porque la
Copa de Naciones arranca en T2. Las hojas lo simulan.

⚠️ **Y `KAIRO` no existe**: es una carta inventada, el opuesto de Konan en todo
—otro país, otro rango, con crew y con los dos trofeos, y **no es el #1**—
porque la carta del mejor de su país esconde la mitad de lo que el diseño tiene
que aguantar.

#### La foto muere por los cuatro bordes

⚠️ **Antes moría por dos**, y ahí estaba el problema. Dlx: *«el degradado entre
la bandera del país y el avatar podría ser mejor gestionado — mirá el de
Argentina, con el avatar de Axinu combina pero el de Number queda algo raro con
eso de Uruguay»*. El fundido existía sólo a la **izquierda (13%)** y **abajo
(18%)**; arriba y a la derecha la foto terminaba en un **corte recto** contra el
marco. Cuando funcionaba era **por suerte**: el cielo de esa foto y el celeste
de Argentina comparten paleta.

Hoy es `16 · 92 · 7 · 78`. Se compararon seis maneras sobre tres casos y después
las dos finalistas sobre **ocho imágenes de bordes muy distintos** —cara sobre
fondo claro, sobre fondo oscuro, de perfil, un grupo, un paisaje con detalle,
uno claro, uno plano y el avatar por defecto de Discord—, cada una sobre otra
bandera. Las que se cayeron y por qué están en el comentario de `.foto img`.

⚠️ **Dos se descartaron por una razón que no es estética**: teñir la foto con el
color de la bandera y desaturarla **tratan a la foto como decoración**. Hoy 128
de 138 no tienen foto y no se notaría; el día que el token del bot las traiga
todas, esa decisión pega en las 138.

⚠️ **Y no se fue más marcado.** Con `20 · 88 · 11 · 70` la foto empieza a
perderse: en México se veía la bandera entera y la cara corrida. El fundido
tiene que **integrar** la foto, no taparla.

⚠️ **Los cuatro bordes no alcanzaron, y la segunda causa era otra.** Dlx:
*«siento que el degradado sigue siendo un problema en algunas ocasiones»*. Ya no
era la **forma** del fundido sino **contra qué** se funde: la foto se disuelve y
atrás aparece la bandera, así que con una bandera clara —Uruguay, Perú,
Guatemala, Puerto Rico— la foto queda rodeada de un **halo brillante**.

Va un **plato oscuro** entre la foto y la bandera: un rectángulo `rgba(6,8,16,.55)`
con la misma forma de fundido pero **más ancho** (`8 · 97 · 3 · 88`). La foto
muere contra el plato y el plato contra la bandera, así que la bandera clara
nunca toca el borde de la foto. Es el mismo recurso que ya usan el panel
izquierdo y las stats: **sombra local en vez de subir el velo general**.

⚠️ **`:not(.vacia)` no es un detalle.** Sin eso el plato cae también sobre las
cartas **sin** foto, donde no hay nada que integrar — sólo lava la bandera.
Probado: Uruguay, Perú y Guatemala perdían el color de su bandera en toda la
zona de arriba, que es justo lo único que esas cartas tienen para decir de
dónde sos.

⚠️ **Y eso pasó de ser la norma a ser la excepción: de 128 de 138 a 26.** Esto
decía *«es el caso de 128 de 138»* y desde el 20/09/2026 son **112 las que SÍ
tienen foto**. La regla no cambia —el plato sigue sin ir donde no hay cara—
pero el argumento sí: ya no se justifica por mayoría, se justifica porque en
esas 26 el plato **borra el único dato que la carta tiene**. Correr
`python herramientas/puedo_generar.py` para el número de hoy.

⚠️ **El alfa es .55.** Con .78 la bandera desaparece del todo alrededor de la
foto.

⚠️ **La derecha va en 96, no en 92.** Dlx: *«¿puedes hacer que la foto esté
extendida o más pegada a la derecha?»*. El 92 dejaba una franja de bandera
entre la foto y el marco que se leía como si la foto no llegara. Con 96 llena y
queda un 4% de fundido — que es lo que evita el choque recto contra el marco, y
ese choque era el problema original. A **100** llega al borde y el choque
vuelve. El plato la acompaña: 97 → 99.

#### Las stats llevan su propia sombra, y el alfa está elegido

⚠️ **La bandera no es pareja debajo del bloque.** Medido el fondo bajo los
números en los nueve países que tienen carta, el contraste con el texto iba de
15.4:1 a 2.9:1 y **cuatro no llegaban al mínimo de 4.5** — España, Perú, México
y Uruguay, que son justo las que tienen una franja **blanca o amarilla**
cruzando esa altura. México y Perú la tienen vertical, así que además parten el
bloque en dos mitades de distinto brillo.

Subir el velo general **no servía**: apagaría también a Colombia, que ya está
en 15.4, y lavaría la bandera en las cinco que están bien. La sombra tiene que
ser **local**, como ya lo es la del panel izquierdo.

⚠️ **Y el bloque necesita relleno o el arreglo no llega.** Sin él el
desvanecido ocurre *dentro* de la caja y la primera fila cae justo ahí: con la
sombra al 66% México seguía en 3.70.

⚠️ **El alfa es .32 y no más.** Con relleno, .58 dejaba al peor en 9.75:1 —más
del doble del mínimo— y eso no es seguridad, es bandera apagada de gratis.
Barrido: .30 → 5.31, .38 → 6.27, .46 → 7.46. Cada punto de alfa de más se lo
come lo único que identifica al país.

⚠️ **Re-medido con `generar.py`, sobre las 16 banderas que el pool usa de
verdad.** El arreglo se había verificado sobre **nueve** países, que eran los
que la maqueta dibujaba; con datos reales entran dieciséis, y **las dieciséis
pasan**. El peor es **5.09:1**, empatado entre Guatemala, México, Perú y
Uruguay — y **Guatemala no estaba en las nueve**, así que el peor caso de hoy
es uno que la medición original no llegó a ver. Sigue por encima del 4.5, pero
la lección es la de siempre: **el peor caso no es el que tenés a mano**.

#### Al exportar

`04_Pais/exportar_png.py` lo hace, y **verifica el PNG en vez del proceso**:
las cuatro esquinas tienen que estar transparentes —si alguna está opaca, lo
que se capturó es una caja y no la silueta— y tiene que haber tinta. Los dos
errores que este formato admite sin quejarse son el rectángulo y el vacío.

Hoy **nada sobresale** del recorte, así que alcanza con capturar el elemento.
⚠️ Eso cambia si se activan los chips (`--chips`): salen en `right:-11px`, viven
fuera del `clip-path` a propósito —adentro se cortaban por la mitad— y entonces
hay que **medir la unión**, igual que en la Competitiva. El exportador la
calcula igual, siempre: la Servidor tenía escrito en su propio docstring que no
hacía falta hasta que el escudo se mudó a la punta.

⚠️ **CHROMIUM TIRA CARTAS EN BLANCO CUANDO LA HOJA ES MUY GRANDE, y no avisa.**
Medido con las 137 en grilla de 12:

| escala | píxeles | dibujadas |
|---|---|---|
| 1 | 3952 × 5196 | 137 / 137 |
| 2 | 7904 × 10392 | 137 / 137 |
| **3** | 11856 × 15588 | **96 / 137** |

A escala 3 las últimas 41 salen vacías: el PNG pesa 37 MB, tiene el alto
correcto y no hay ningún error. Por eso `generar.py` **cuenta las cartas que
pintó** y baja la escala si faltan, y `exportar_png.py` trabaja en tandas de 24.
Una hoja de control que no cuente estaría dando por buenas 137 cartas de las
que vio 96.

⚠️ **`fonts/embed.css` NO trae Archivo 600**, y el `@import` de la maqueta lo
pide. No es un error: el 600 es de los **títulos de las hojas comparativas**,
que nunca llegan a un PNG. Medido sobre el DOM contando sólo nodos de texto
propios, la carta usa **800** (etiquetas y siglas) y **900** (el OVR, el nombre,
los números), y los dos están embebidos. Por eso el chequeo de fuentes lee del
DOM los pesos que la carta usa en vez de tenerlos escritos: si mañana entra uno
que no está, lo encuentra solo en vez de dejarlo pasar sintetizado.

### Decisiones abiertas
- ~~**La Temporada y la Servidor tienen brillos equivalentes sin revisar.**~~
  **CERRADA el 16/09/2026, y sin tocar código.** Ahora las cuatro exportan a
  PNG, así que se hizo la prueba que faltaba — renderizar sobre transparencia y
  medir qué pinta **fuera del cuerpo** de la carta:

  | carta | tinta fuera | croma | llega a |
  |---|---|---|---|
  | Temporada | 0.02 % | 0.013 | **0 px** |
  | Competitivo | 1.58 % | 0.028 | 10 px |
  | Servidor | 1.27 % | **0.000** | 15 px |
  | País | 0.12 % | — | 0 px |

  **Ninguna tiene el halo de color que se le sacó a la Competitiva.**

  - La **Temporada** no puede tenerlo: su `.card` lleva `overflow:hidden`, así
    que ni el brillo dorado del TAG (`0 0 20px` + `0 0 44px`) escapa. Cero
    píxeles fuera del cuerpo y esquina exacta en alfa 0.00.
  - Lo que sale 15 px en la **Servidor** son 20.279 px con **croma 0.000**: la
    sombra **negra** del escudo y las estrellas, que es exactamente lo que la
    Competitiva conservó a propósito —*«queda la sombra negra, que sí da
    profundidad sin teñir»*—.

  ⚠️ **La medición tuvo que separar "débil" de "afuera".** El croma medio de
  toda la tinta débil da 0.052 en la Servidor y parecía un halo de color; es el
  borde antialiaseado del **marco**, que está pegado al cuerpo. Mirando sólo lo
  que está a más de 2 px del cuerpo macizo, el croma cae a 0.000. **Medir cerca
  y medir lejos contestan preguntas distintas.**
- **La Servidor**: el estado completo está en **`03_Servidor/disenos/ESTADO.md`**
  — **leerlo antes que cualquier script.** Abre con un mapa de la carta de
  arriba a abajo con todos los numeros vigentes, la tabla de lo cerrado y
  donde vive cada cosa, y las ideas abiertas.

  ⚠️ **Antes de tocar cualquier posicion, correr `python comun/pie.py`.**
  Verifica que las cinco piezas verticales no se pisen. Ya paso que quedara
  roto dos tandas sin que nadie se enterara: un self-check que revienta hace
  creer que lo roto es la carta.

  **Si algo "se ve raro" en esta carta, medilo antes de retocarlo.** Cinco
  cosas parecieron problemas de diseño esta sesion y las cinco eran bugs:
  un panel que no repintaba una capa, un filtro que perdia el vertice del
  medio, bordes que usaban un acento blanco, un lavado con la caja
  equivocada, y un material con una banda diagonal. Estan en ESTADO.md con
  lo que se veia al lado de lo que era. Ahí está qué quedó cerrado, con qué
  número y en qué archivo vive, qué falta, y qué correcciones impuso la
  medición. Ver también `03_Servidor/NOTAS.md` y
  `03_Servidor/disenos/LEEME.md`. Resumen: se trata como **camiseta de
  selección**. **Los nueve fondos están cerrados** y su definición canónica es
  la función `defs()` de `03_Servidor/disenos/los_nueve.py` — si alguno se
  rehace, sale de ahí, no de los scripts de exploración. Falta **el marco**, y
  **NO va metálico** porque ese lenguaje es de la Competitiva. Se trabaja **un
  marco por vez**: hacer los nueve de una vuelta fue lo que los hizo salir
  parecidos.

  ✅ **CERRADO EL 22/09/2026.** Dlx: *«fondo DRA está bien, EFA está bien,
  RZ ya no existe, olvida el marco del servidor»*. **El marco no va** — era
  lo último de diseño abierto en todo el proyecto. El fondo de DRA y el
  choque de EFA con SR quedan como están, y **RZ deja de ser un hueco de
  datos porque el servidor no existe**: su escudo y su fondo quedan en el
  repo sin dueño.
- **Prime e Histórico** no tienen concepto. Antes de construirlas hay que
  definir **qué número muestra cada una**, por la regla de arriba.
- **Cinco siluetas para seis cartas**, catalogadas en `comun/siluetas.py`.
  Rectangular, escudo trazado, pico, biselado y la de País. **Prime e
  Histórico** son las que quedan sin ninguna: van a tener que compartir o
  inventar.

  El biselado quedó **libre otra vez**: era el de la Servidor, después se
  reservó para País, y cuando País trazó la suya de una referencia volvió a no
  tener dueño. Que una forma esté reservada no la usa nadie.

  ⚠️ El pico es un `path()` y no un `polygon()`, porque salió de trazar un
  PNG y polygon solo une puntos con rectas. La contra: `path()` va en
  **píxeles absolutos**, así que la silueta ya no escala sola con el elemento.
  Con cartas de tamaño fijo da igual, pero una versión chica pide reescribir
  el path, no alcanza con cambiar el ancho.

---

## Dónde quedamos

⚠️ **`ESTADO.md`, en la raíz, es el traspaso.** Trae lo que cambió en la última
sesión, lo decidido y sin conectar, y los puntos de retorno. **Leerlo antes que
cualquier script.**

## Estructura

```
01_Temporada/     carta terminada + generar.py + exportar_png.py
02_Competitivo/   carta terminada + exportar_png.py + eventos + estilos + logos
03_Servidor/      en curso, ver NOTAS.md
                    generar.py      el diseño vigente, desde datos/
                    exportar_png.py --viejo saca el layout anterior
                    normal_gen.py   el layout anterior
                    disenos/        la exploracion + ESTADO.md
04_Pais/          en curso.
                    maqueta.py      dibuja la carta + once hojas comparativas.
                                    Su GENTE son DOS personas a mano, no datos
                    generar.py      las 138 desde datos/, con --auditar
                    exportar_png.py el PNG transparente, con --todas
                    fondos.py       banderas y material
                    banderas/       oficiales 3:2 (para el chip)
                    banderas_carta/ preparadas (para el fondo)
                                    (las fuentes NO estan aca: comun/fonts/)
comun/            las definiciones canonicas. Cada una trae la medicion que
                  la justifica en su docstring, y varias traen self-check:
                    siluetas.py  las cuatro siluetas
                    divisor.py   la curva, el panel del pie y el recorte
                    emblema.py   escudo y estrellas
                    brillo.py    la luz de arriba
                    marco.py     el borde de color
                    rangos.py    las 8 figuras + verificar() contra gencomp
                    iconos.py    los 5 iconos de la columna
                    pie.py       posiciones del pie y la columna + huecos()
                    nombre.py    tamaño y posicion del nombre
                    escudos.py   LOGO y escudo(), con su fallback
                    banderas.py  la bandera de cada pais, del repo
                    bloqueada.py el estado de quien no llega al requisito
                    requisitos.py que hace falta para cada carta
                    crews.py     a que crew pertenece cada uno + puestos()
                    respaldo.py  la copia del repo cuando el CDN da 404
                    huella_codigo.py  que codigo dibuja cada carta, para que
                                 el sello vea los cambios de codigo y no
                                 solo los de datos
                  + logos_sv/, logos_color/, escudos_cuad/, fonts/
herramientas/     puedo_generar.py        si las cuatro cartas salen para las 138
                  secretos_en_git.py      si algun secreto entro al repo o a su
                                          historial. Sabe cuales NO son secretos
                  workflows_validos.py    si los .yml valen para GITHUB y no
                                          solo para PyYAML. Existe porque mi
                                          chequeo dio verde dos veces donde
                                          GitHub dijo que no
                  simular_score.py        G1 y A7 del rework, sobre las 138 de
                                          la pre-temporada sacadas de git
                  procesar_logos.py, escudos_cuadrados.py, trazar_silueta.py,
                  extraer_estilos.py, normalizar_estilos.py
                  banderas_carta.py       separa franjas de escudo
                  hueco_numeros.py        el hueco del numero de cada icono
                  entra_panel.py          si el panel aguanta el peor caso
                  textura_al_achicar.py   como aguanta una textura al bajar
                  + los archivos originales de logos y estilos
sheet/            el puente con el Google Sheet: explorar + los dos builders
                  rankings.py     las cinco vitrinas, desde Resultados y 1v1
                  estilo.py       como se ve una vitrina. Un lugar para las 5
                  competitivo.py  el Score y las cinco dimensiones
                  lobby.py        la portada, calculada + la cuenta atras
                  webapp_subir.py sube al Apps Script sin pisar lo ajeno
bot/              el lector de Discord y el ciclo
                  anuncios.py     lee eventos e inscripciones
                  cuando.py       «EN 30 MINUTOS» -> una hora, para el contador
                  avisar.py       avisa en Discord, una vez por llave
                  olvidar.py      la salida: borrar a alguien de R2 y KV
                  subir_web.py    el payload del lobby, a KV (paso 2c)
                  paginas/        underlegends.pages.dev — el hub, 6 vistas
                  paginas_viejas/ liga-global.pages.dev — sólo un 301
                  ci/guardar.sh   lo que se commitea. Lo llaman los DOS
                                  trabajos del ciclo, por eso no vive en
                                  el .yml
datos/            los pools, los eventos y los colores de servidor
docs/             notas de contexto
```

Cada carta corre desde su propia carpeta y escribe en `salida/`. Las rutas son
relativas al script, así que el proyecto se puede mover de lugar.
