# El ELO por temporada y el histórico — el diseño (para la T2)

> **Estado (20/11/2026, 3:19 AM ET): decidido entero, por construir.** Los números están simulados sobre la T1 y
> los aprobó Dlx. Todo lo que se decidió está acá. Las simulaciones son
> scripts de una sesión (no están en el repo): cada número dice de dónde sale.

Dlx, 20/11/2026: *«el ELO tendría que empezar de 0 así como en Brawl Stars y que dependiendo del rango máximo de la
temporada se resetee… Que haya ELO por temporada y ELO histórico»*. Y después, en orden: *«no quiero que el ELO se base
sólo en la nota»*, *«el ELO va por áreas»*, *«si Oasis se enfrenta al top 2 de la misma piedra, uno ganaría y otro
perdería»*, *«la mayoría va por rondas: es injusto perder ELO por perder la final»*, *«estamos confundiendo cosas al traer
las notas al ELO»* y *«también planeo un 1v1 como el ranked de Brawl… y eventos en DRA de ciertas piedras… pero esto
debería cubrir también los eventos, para que la gente suba sin depender del 1v1 ni de los eventos de piedras»*. Y a las
2 AM, la que manda: *«la idea principal es que el ELO se suba y se baje solamente cuando luchas con personas de tu misma
piedra; el problema es que hay pocas de momento»*.

## 1 · Tres cosas distintas, que no se mezclan

| | qué mide | cómo se mueve | para qué sirve |
|---|---|---|---|
| **ELO histórico** | el nivel de verdad | batalla por batalla, suma cero, **nunca se reinicia** | armar los cruces: grupos de las Competencias, pronóstico del VS, la nota, el emparejamiento del 1v1 |
| **La nota** | cómo te fue esa noche, del 1 al 10 | no se acumula | la carta, el perfil, el MVP (`bot/notas.py`, ya existe) |
| **ELO de temporada** | tu ranked de la temporada | se acumula, **se reinicia con cada temporada** | las piedras, los premios, el ranking de la temporada |

🎯 **PARA QUÉ SIRVE EL DE TEMPORADA, Y POR QUÉ NO ES EL COMPETITIVO** (Dlx, 20/11/2026: *«el competitivo ya dice
quiénes son los mejores en general, pero con esto veremos quiénes son los mejores en sus respectivos niveles, y esa es la
meta»*). El Competitivo (`sheet/competitivo.py`) pone a todos en una sola escala con sus **resultados** —eficiencia 25 %,
consistencia 24 %, dominancia 21 %, diversidad 20 % y racha 10 %, × la confianza— y **nunca mira a quién le ganaste**.
El de temporada es al revés: **las piedras son los niveles** y la tabla de cada piedra, los mejores de ese nivel.

Medido sobre la T1 con el diseño decidido (el área de la piedra, la semana y la A; `elo_niveles.py` de la sesión; el
nivel es el ELO histórico al final): la mediana del nivel sube piedra por piedra —978 · 1066 · 1128 · 1199 · 1339—, el
**99 % queda en la piedra de su nivel o en la de al lado** (con el área anterior, 93 %) y el ELO de temporada se parece
**0,85** al Competitivo, que se parece 0,87 al nivel: se tocan, no es una copia. Y arriba de cada piedra aparece gente
que el Competitivo no pone arriba: la cima de Jade son Prosu y Giansito (sin letra todavía) y Tuca (B); la de Hierro,
Velatz y Mayeutyk (C) y NC (D).

⚠️ **La nota NO entra al ELO de temporada**, aunque mire cosas parecidas (el rival, la ronda, el veredicto): si entra,
lo mismo se cuenta dos veces. Es la descripción de la noche; el ELO es la consecuencia.

## 2 · El ELO histórico

Es el de hoy (`bot/elo.py`: Elo de suma cero, arranca en 1000, escala 400) con **dos arreglos medidos** sobre la T1:

- **las batallas de 3 o más con un ganador cuentan**, el ganador contra cada uno con medio K (369 en la T1, hoy no cuentan);
- **K 48 las primeras 10 batallas y 24 después** (los nuevos se acomodan rápido).

Predice mejor: log-loss de 0,641 a 0,622 y acierta 65,6 % de las batallas en vez de 63,2 %; 210 personas con un ELO
firme en vez de 185. Las batallas por equipos **no cuentan** (`es_equipo()`); el solo contra solo de un MULTIVERSE sí.
Junta todas las temporadas.

## 3 · El ELO de temporada

### La escalera

- Arranca en **0**, nunca baja de 0. Quien empieza la temporada sin historia, en 0.
- **Abajo de todo perder resta menos**: en Hierro no resta; en Jade y Zafiro, la mitad (borrador).
- Las **piedras** salen de él (Hierro, Jade, Zafiro, Rubí, Diamante, Mítico, con sus I · II · III de `bot/divisiones.py`).
  **De 65 a 85, cada una 5 más larga que la anterior** (abajo).

**El tamaño de las piedras: 75 de promedio** (Dlx, 20/11/2026: *«sí»*) **y distinto en cada una** (*«pero que varíe
con cada piedra»*). Primero, piedras parejas, medidas sobre la T1 con el diseño decidido (`elo_tamano.py` de la sesión; los 196 activos con 5
batallas o más; la protección de abajo y el reinicio se miden por piedra, así que se mueven con el tamaño):

| por piedra | Mítico · Diamante · Rubí · Zafiro | en la piedra de su nivel | cuentan | bajaron de piedra alguna vez |
|---|---|---|---|---|
| 100 (el borrador) | 0 · 1 · 9 · 23 | 72 % | 78 % | 13 % |
| **75** | **1 · 4 · 15 · 20** | **68 %** | **71 %** | **16 %** |
| 60 | 4 · 9 · 16 · 25 | 59 % | 66 % | 22 % |
| 50 | 8 · 11 · 18 · 29 | 49 % | 63 % | 24 % |
| creciente (50 · 60 · 70 · 80 · 90) | 1 · 8 · 19 · 31 | 56 % | 66 % | 23 % |
| Hierro 100 y las demás 60 | 1 · 9 · 9 · 20 | 67 % | 72 % | 16 % |

Las piedras chicas llenan la cima pero mezclan niveles (el área se angosta con ellas) y hacen rebotar a más gente.
Y esto es al día 58 de los 100 de la T1: del 21/10 al 20/11, con 75, Rubí o más pasó de 3 a 20 personas y Mítico de
0 a 1, así que a fin de temporada serían unos 2 o 3 en Mítico y unos 10 en Diamante. Con 100, Mítico seguiría vacío;
con 60 tendría unos 10.

✅ **La suave, cada piedra 5 más larga que la anterior** (Dlx, 20/11/2026: *«Sí, la suave»*) —Hierro de 0 a 64 · Jade desde 65 ·
Zafiro 135 · Rubí 210 · Diamante 290 · Mítico 375, el mismo Mítico que con 75 parejo—. Salir de Hierro cuesta unas 4
victorias netas y llegar a Mítico desde Diamante, unas 6; cada subnivel es un tercio de su piedra. Medido igual
(`elo_variable.py`; todas con Mítico en 375):

| cómo cambia | salen de Hierro (batallas, mediana) | Mítico · Diamante · Rubí · Zafiro | en la piedra de su nivel | bajaron de piedra |
|---|---|---|---|---|
| pareja: 75 todas | 46 % (12) | 1 · 4 · 15 · 20 | 68 % | 16 % |
| **suave: 65 · 70 · 75 · 80 · 85** | **51 % (11)** | **1 · 5 · 16 · 26** | **62 %** | **17 %** |
| media: 60 · 70 · 75 · 80 · 90 | 53 % (11) | 1 · 6 · 15 · 30 | 62 % | 20 % |
| fuerte: 55 · 65 · 75 · 85 · 95 | 55 % (10) | 1 · 7 · 15 · 31 | 62 % | 19 % |
| al revés: 85 · 80 · 75 · 70 · 65 | 43 % (13) | 1 · 5 · 11 · 22 | 65 % | 12 % |

Crecer de abajo hacia arriba hace que más gente salga de Hierro, y más rápido —lo que importa con la retención: el
42 % jugó una sola vez—, y que arriba cueste más. Lo que cuesta: las de abajo quedan algo más mezcladas (62 % contra
68 %). De las que crecen, la suave es la que menos rebote suma; al revés rebota menos, pero deja a más gente en
Hierro.

### La unidad: la batalla

Cada batalla que cuenta es **un traspaso entre los dos**: lo que suma el que gana lo resta el que pierde.

    lo que se juega = K × (1 − la chance que tenía el que ganó, por el ELO DE TEMPORADA) × los factores

✅ **La chance sale del mismo ELO de temporada, como Brawl** (Dlx, 20/11/2026: *«Sí, la A»*): adentro de tu piedra
cada victoria vale parecido —unos 15, según la ronda y el evento— y el que gana más sube, así que la escalera encuentra
sola el nivel de cada uno. Hasta esa decisión salía del histórico, y no servía: el que gana lo que se esperaba de su
nivel casi no suma —ganarle a uno más flojo paga poco y perder con él resta mucho—, así que el de temporada terminaba
midiendo **quién le ganó a lo esperado** (cuánto subió su histórico), no quién es el mejor de su piedra. En la T1 casi
no se nota porque el histórico también arrancó en 1000 para todos; **en la T2 ya sabe quién es quién**. Medido:

| | en la piedra de su nivel | parecido con el nivel |
|---|---|---|
| T1, la semana · chance del histórico → de la temporada | 68 % → **73 %** | 0,68 → **0,77** |
| T2 de prueba (las mismas batallas, con el histórico ya armado) · la semana | 64 % → **71 %** | 0,61 → **0,76** |
| T2 de prueba · sólo tu piedra | 66 % → **73 %** | 0,55 → **0,69** |

El histórico sigue para lo que hace bien: los cruces, el pronóstico del VS, la nota y el emparejamiento del 1v1. La
sorpresa de ganarle a alguien mucho mejor se la siguen llevando la nota y el 🔥 Batacazo.

| factor | qué hace | borrador |
|---|---|---|
| **el rival y lo esperado** | por el ELO de temporada: adentro de tu piedra, casi parejo; ganarle a alguien con más puntos suma un poco más | la base: K 30, ±15 en una pareja |
| **el formato** | una batalla más larga se juega más | evento ×1 · **1v1 ranked ×1,5** (Dlx, 20/11/2026: *«Sí, ×1,5»*) |
| **la ronda** | la final pesa más que unos octavos | cuartos ×1,1 · semis ×1,2 · final ×1,3 |
| **nivel del evento** | un evento fuerte pesa más | ×0,7 a ×1,3 (el ELO promedio de los que jugaron) |
| **tamaño del evento** | una llave grande pesa más | ×0,85 a ×1,25 (de 4 a 83 en la T1) |
| **el veredicto** | un 3–0 se juega más que un 2–1 | unánime ×1,2 · dividido ×0,8 (con 2 jurados o más) |
| **lo que votaba el público** | ganar cuando el chat daba al otro se juega más | sólo hacia adelante, en los servidores con el bot en vivo |

### El área: tu piedra y los subniveles de al lado (Dlx, 20/11/2026, 2 y 2:45 AM)

**El ELO de temporada se mueve sólo en las batallas contra alguien de tu área**; afuera no cuenta, ni ganando ni
perdiendo (Dlx: *«la idea principal es que el ELO se suba y se baje solamente cuando luchas con personas de tu misma
piedra»*). **El área de cada piedra** (Dlx, 2:45 AM: *«una piedra debería jugar con la anterior y la siguiente, pero la
anterior que esté en rangos altos, digamos Hierro 2 y Hierro 3, y para el siguiente Oro 1 y Oro 2»* y *«sólo Mítico
juegue con la anterior piedra»*): **toda tu piedra, II y III de la anterior, y I y II de la siguiente**. Mítico, que
no tiene siguiente, juega con **toda Diamante**. Una batalla entre dos piedras distintas cuenta cuando **cada uno está
en la lista del otro**, porque lo que gana uno lo pierde el otro y tiene que valer para los dos: un Jade III contra un
Zafiro I, sí; un Jade I contra un Zafiro II, no, porque Zafiro juega con Jade II y III. Cuenta la piedra de cada uno
**al empezar la noche**. Una batalla fuera del área igual **mueve la nota y el ELO histórico** (los dos miran el
nivel), y la sorpresa del de abajo se la lleva el 🔥 Batacazo. Vale también para lo de la noche (ver abajo).

⚠️ **Sola, se traba arriba** (T1 simulada con la chance del histórico, `elo_piedra.py` del scratchpad de esa sesión; con la A
da casi lo mismo: 85 → 57 → 44 % y nadie pasa de Rubí): al principio todos son Hierro
y cuenta casi todo, y a medida que la gente se separa cuenta cada vez menos —**83 % de las batallas en septiembre, 55 %
en octubre, 44 % en noviembre**—. Nadie pasa de Rubí en toda la T1: Oasis llega el 07/11 y, como es el único, desde ahí
juega y no le cuenta nada (de sus 77 batallas contaron 20). **No es sólo que haya poca gente: en un evento abierto el
rival lo pone la llave, no la piedra** —con el área anterior, la mitad de las batallas del top 8 eran contra alguien 2
piedras o más abajo—. Lo que lo resuelve de verdad es el 1v1 ranked (empareja por piedra) y los eventos de piedras de
DRA.

✅ **Encima de los subniveles, el área se abre sola si te quedas sin rivales** (Dlx, 20/11/2026: *«Sí, las dos»*). Si pasa **una
semana** sin que te toque nadie de tu piedra, cuenta también toda la de al lado (arriba y abajo); **dos semanas**, dos
piedras. Se cierra apenas te
toca alguien de tu piedra, y al cambiar de piedra el reloj arranca de nuevo. Es lo que hace cualquier emparejamiento
cuando no aparece nadie de tu nivel: ampliar la búsqueda.

Medido con la A ya decidida (`elo_con_a.py`; «en su nivel»: si se ordena a todos por nivel y se reparten las piedras
con las mismas cantidades, cuántos caen en la misma):

| cuándo se abre a la piedra de al lado | cuentan (sep → oct → nov) | arriba al final | en su nivel · a una o menos |
|---|---|---|---|
| nunca | 58 % (85 → 57 → 44) | Rubí 1 | 71 % · 98 % |
| si en tu piedra hay menos de 8 jugando (último mes) | 60 % (94 → 57 → 45) | Rubí 2 | 69 % · 99 % |
| si hay menos de 12 | 62 % (100 → 59 → 46) | Diamante 1 · Rubí 2 | 74 % · 98 % |
| **una semana sin rival de tu piedra** | **74 % (85 → 71 → 75)** | **Diamante 1 · Rubí 7** | **73 % · 99 %** |
| dos semanas | 65 % (85 → 62 → 62) | Rubí 5 | 70 % · 99 % |
| 2 noches jugadas sin rival de tu piedra | 72 % (90 → 71 → 64) | Diamante 1 · Rubí 8 | 68 % · 98 % |

Por qué la de la semana: para casi todos sigue siendo «sólo tu piedra» (se abre para el que se quedó solo), es la que
más batallas cuenta, **con el tiempo no se vacía** (las otras bajan mes a mes) y junta los niveles casi tan bien como
la mejor. «Menos de 12 jugando» deja la cima abierta todo el tiempo y hasta 3 piedras: casi como no tener área. Con la
chance del histórico, contar noches jugadas en vez de días ponía 1.º a Makmah por volumen; con la A ya no, pero se
vacía en noviembre (64 %).

Y con los subniveles de Dlx (`elo_subniveles.py`, con la A):

| área | cuentan (sep → oct → nov) | arriba al final | en su nivel · a una o menos | a Oasis le cuentan |
|---|---|---|---|---|
| sólo tu piedra | 58 % (85 → 57 → 44) | Rubí 1 | 71 % · 98 % | 18 de 77 |
| la semana | 74 % (85 → 71 → 75) | Diamante 1 · Rubí 7 | 73 % · 99 % | 26 de 77 |
| los subniveles | 65 % (87 → 65 → 52) | Rubí 4 | 68 % · 98 % | 20 de 77 |
| los subniveles, si alcanza con que uno tenga al otro | 79 % (96 → 79 → 69) | Diamante 1 · Rubí 10 | 72 % · 97 % | 26 de 77 |
| **los subniveles + la semana** | **78 % (88 → 75 → 78)** | **Diamante 1 · Rubí 9** | **72 % · 98 %** | **34 de 77** |

Los subniveles solos arreglan los bordes (antes, un Jade III contra un Zafiro I, a un paso, no contaba) y cuentan más
que «sólo tu piedra», pero arriba siguen sin alcanzar: Oasis queda solo en Diamante y en los últimos 12 días de la T1
no le cuenta nada, porque en un evento abierto casi nunca le toca alguien cerca de su piedra. Con la semana encima es
lo mejor de todo lo medido: la que más cuenta sin vaciarse con el tiempo, y al final de la T1 a los cinco de arriba les
había contado una batalla en los últimos 6 días. Mítico con toda Diamante no se ve en la T1: nadie llega.

Historia: hasta las 2 AM el área eran **2 piedras de diferencia hasta Zafiro y 1 de Rubí para arriba** (12 % de las
batallas afuera). Antes se probó que perder fuera del área SÍ reste (y ganar no sume) y no sirve (Dlx, 1:34 AM: *«¿de
cuánto ELO va a ganar Oasis que está en Mítico si todos los demás son de Hierro?»*): a alguien de arriba un evento flojo
sólo le podía restar. Y sin regla de área, que la cuenta del ELO decida: Oasis 790, +13 por noche arriba.

### Dónde se juega, y cómo se cierra cada cosa

| de dónde viene la batalla | cómo se cierra |
|---|---|
| **un evento abierto** (las llaves de los servidores) | se juntan todas sus batallas y **se cierra la noche**: llegar a la final **nunca resta**; salir campeón **suma** (el mínimo, +5) si esa noche peleó con alguien de su área. El área, como arriba |
| **el 1v1 ranked** (por construir) | cada partida se cierra sola, como en Brawl. Empareja por piedra, así que cuenta todo; si no hay nadie de tu piedra buscando, la búsqueda se amplía como el área |
| **los eventos de piedras de DRA** (por construir) | como un evento abierto, con todos en el área; el nivel del evento ya los hace pesar más |

⚠️ **Se tiene que poder subir sólo con los eventos abiertos** (Dlx): el 1v1 y los eventos de piedras son otra forma de
subir, no la única. En la T1 simulada, Oasis llega a Mítico sólo con eventos abiertos.

### Lo de la noche que no le quita nada a nadie

Chicos, y **pagan menos si eras mucho más fuerte que el resto del evento** (× entre 0,3 y 1 según lo esperado):
campeón **+15**, MVP **+8**, 🔥 Batacazo **+6**, racha **+2 / +4 / +6** desde la 3.ª victoria seguida. El subcampeón, el
tercero y la nota **no suman solos**: perdieron una batalla, o repiten lo que ya cuentan las batallas.

⚠️ **Y sólo si esa noche peleaste con alguien de tu área** (la regla de la piedra vale para todo): si no, no se mueve
nada, ni el campeón; la racha cuenta sólo las batallas del área. Con el área anterior, **la mitad de los puntos del top
8 salían de acá** (Oasis: 395 de 623); con la de la piedra, un tercio.

### Cuándo se pierde ELO de temporada

- **Saliendo temprano** contra alguien de tu área; cuanto más débil era (dentro del área), más resta.
- Perder contra alguien mejor resta poco. Contra alguien fuera de tu área, nada (sí la nota y el histórico).
- **Llegar a la final nunca resta.** Las semis no llevan regla propia: *«depende con quién ha peleado»* (Dlx,
  20/11/2026); restan sólo si perdiste con alguien de tu área. Medido con el área anterior: 15 noches de la T1 restaron
  después de ganar 2 batallas o más, −8,5 de promedio.
- Abajo de todo, perder resta menos o nada.

### El reinicio de cada temporada

Según tu **piedra más alta** de la temporada, un **multiplicador con piso** (Dlx: *«el multiplicador depende de qué tan
alto llegaste pero sirve hasta cierta piedra y ELO»*). Borrador: Mítico ×0,6 sin bajar del piso de Rubí · Diamante ×0,55 sin
bajar del piso de Zafiro · Rubí ×0,5 sin bajar del piso de Jade · Zafiro ×0,4 · Jade y Hierro a 0 (con 100 por piedra eran
300 · 200 · 100). **La primera vez, de la T1 a la T2**, sale de la
piedra más alta de la T1.

**Medido en una T2 de prueba** (`elo_reinicio.py`: las batallas de la T1 otra vez, arrancando del reinicio, con el
histórico ya armado y todo lo decidido): ✅ **el borrador se queda** (Dlx, 20/11/2026, 3:12 AM: *«Sí, el borrador»*). Que la T2 arranque con el
82 % en Hierro no es un problema: son los que terminaron la T1 en Hierro o en Jade, y arriba cada uno arranca una o dos
piedras abajo de la más alta.

| reinicio | arrancan en Hierro | de los 40 de más nivel, en Hierro | ordena por nivel al final | premio de fin (contra la T1) |
|---|---|---|---|---|
| **el borrador** | **82 %** | **11** | **61 %** | **+11 %** |
| más suave (×0,6 a todos, Jade ×0,5) | 73 % | 4 | 56 % | +30 % |
| más duro (×0,5 · 0,45 · 0,4 · 0,3, pisos más bajos) | 86 % | 16 | 58 % | +8 % |
| como Brawl hoy: bajas 2 subniveles | 68 % | 1 | 58 % | +37 % |
| como Brawl antes: bajas 6 subniveles | 89 % | 19 | 59 % | +2 % |

Los más suaves pagan hasta un 37 % más de premio de fin de temporada y ordenan peor, porque la escalera tiene menos
para reordenar; el más duro manda a Hierro a más gente buena. Lo que cuesta el borrador: 11 de los 40 de más nivel
arrancan en Hierro —casi todos jugaron poco en la T1— y tardan unos 16 días en salir.

⚠️ **La primera vez no hay ELO de temporada de la T1**, así que vale la piedra más alta que cada uno vio en las
divisiones de la T1 (`datos/divisiones.json`, `mejor`) y se arranca de su piso: **Mítico → Rubí I, Diamante → Zafiro
I, Rubí → Jade I, el resto a Hierro I**. Al 20/11: 13 llegaron a Mítico, 13 a Diamante y 32 a Rubí, de 692.

### Los números: como están (Dlx, 20/11/2026, 3:19 AM: *«Sí, como están»*)

Con todo lo demás decidido (`elo_numeros.py` de la sesión, la T1, los 196 activos con 5 batallas o más): una batalla
que cuenta vale **±15** (la mediana, con los factores); salir campeón de una llave de 16 o más da **unos +70** en la
noche, casi una piedra, y de una chica unos +53; los premios (campeón +15, MVP +8, 🔥 +6, racha +2 · +4 · +6, × lo
esperado) son el 38 % de los puntos del top 8.

| | Mítico · Diamante · Rubí · Zafiro | en la piedra de su nivel | bajaron de piedra | premio de fin |
|---|---|---|---|---|
| **como están: ±15 y los premios** | **1 · 5 · 16 · 26** | **62 %** | **17 %** | **64.300 PdT** |
| batalla ±10 | 0 · 1 · 13 · 21 | 70 % | 10 % | 43.700 |
| batalla ±20 | 1 · 13 · 12 · 36 | 55 % | 24 % | 83.500 |
| premios a la mitad | 0 · 2 · 13 · 28 | 68 % | 18 % | 51.200 |
| sin premios | 0 · 1 · 8 · 20 | 72 % | 20 % | 42.400 |

Por qué como están: las piedras se eligieron con estos números, y con ±10 o con los premios a la mitad la cima se
vuelve a vaciar; con ±20 rebota uno de cada cuatro y el premio de fin sale un 30 % más caro. Sacar premios ordena
mejor por nivel, pero arriba no llega casi nadie. Los factores (ronda, nivel y tamaño del evento, veredicto), la
protección de abajo y el mínimo del campeón, también como están.

## 4 · Lo que se probó y no sirve

- **La escalera batalla por batalla, sin reglas de llave**: premia jugar mucho (Makmah 1.º con 52 % en 167 batallas).
- **Moverlo sólo por la nota**: no mira suficientes cosas, y la nota no es el ELO.
- **Premios de la noche sin mirar lo esperado**: Oasis 2.526 contra 1.331 de Makmah (el doble), con ~2.080 de premios.
- **El subcampeón con premio**: el que perdía la final terminaba sumando por esa misma batalla.
- **«Lo esperado por tu lugar en la llave»** (el 1.º gana todo, el 2.º llega a la final…): supone que siempre gana el
  favorito; restaba el 63 % de las noches y arriba quedaban los de menos nivel.

## 5 · La T1 simulada con este diseño (sin el 1v1 ni el público, que no existen todavía)

**Con la semana y la A** (antes de los subniveles; con ellos cuenta el 78 %: Oasis 423 · Walker 353 · Carlosss 340 ·
Mats 333 · Motera 330 · Panchok 327 · Yinn 324 · Agus 318, y Diamante 1 · Rubí 9 · Zafiro 24 · Jade 49 · Hierro 534):
cuenta el 74 % de las batallas. Oasis 410 · Agus 356 · Walker 349 · Carlosss 347 · Mats 334 · Motera 330 · Panchok
314 · OG 306. Piedras: Diamante 1, Rubí 7, Zafiro 20, Jade 53, Hierro 534. Con el reinicio del borrador, **la T2
arrancaría con 395 de los 410 activos en Hierro**: se sube menos que con el área anterior, así que el reinicio y el
tamaño de las piedras hay que recalcularlos con esta regla.

Con el área anterior (2 piedras / 1): Oasis 623 (21 noches que cuentan, 3 restaron: −23 las peores, saliendo temprano contra alguien de su área; arriba de
300, +6 por noche) · Makmah 484 (70 noches, 36 restaron) · Praiseriza 475 · Carlosss 460 · Panchok 433 · Abyssus 424 ·
Mats 415 · Erian 411. 25 finalistas habrían restado y no restan. El 12 % de las batallas, fuera de área. Piedras en
pirámide (Mítico 1, Diamante 7, Rubí 16, Zafiro 13, Jade 54, Hierro 579): con 100 por piedra la cima queda muy vacía, y
hay que ajustar el tamaño.

## 6 · Lo que se decidió

No queda nada por decidir. El 20/11/2026: los números, como están (*«Sí, como están»*); el 1v1 ranked pesa ×1,5 una batalla de evento; el área es tu piedra con los subniveles de al
lado (II y III de la anterior, I y II de la siguiente; Mítico, toda Diamante) y, encima, la semana para el que se queda
sin rivales (*«Sí, las dos»*); el reinicio es el del borrador, y la primera vez sale de la piedra más alta de las divisiones de la T1
(*«Sí, el borrador»*); las semis no llevan regla propia; las piedras crecen de a 5, de 65 a 85 —Hierro 0 a 64, Jade 65, Zafiro 135, Rubí 210,
Diamante 290, Mítico 375— (*«sí, pero que varíe con cada piedra»* y *«Sí, la suave»*); la chance de cada batalla sale del ELO de temporada,
como Brawl (*«Sí, la A»*). El resto de **cuánto** se gana o se pierde es otro tema (Dlx: *«cuánto, pues ahí es otro
caso»*).

## 7 · Qué se toca al construirlo

- `bot/elo.py`: el histórico con los dos arreglos, y el de temporada aparte (con su escalera, su área y el cierre por
  noche). El área pide guardar, por persona, **la fecha de su última batalla contra alguien de su piedra** (vuelve a
  arrancar al cambiar de piedra). La chance de cada batalla del de temporada se calcula con el mismo de temporada: el
  histórico no entra ahí.
- `bot/divisiones.py`: las piedras salen del de temporada, con tramos nuevos: 65 · 135 · 210 · 290 · 375 (hoy son 950 a
  1150 sobre el de 1000).
- Las Competencias, la nota (`bot/notas.py`), el pronóstico del VS y el emparejamiento del 1v1: del **histórico**.
- El cambio de temporada (`sheet/espejo_t1.py --nueva-temporada`): el reinicio por piedra máxima.
- La página (el Ranked, el perfil, `/apodo`): las piedras y el número de temporada; el histórico, en el perfil.

## 8 · Cómo se prende (construido el 20/11/2026, 3:48 AM ET)

**Lo que ya está, apagado hasta la T2** (`bot/elo_temporada.py`, con su self-check en CI):

- **El motor**: el histórico con los dos arreglos y el de temporada con todo lo decidido. La T1 rehecha con él
  (`python bot/elo_temporada.py`) da lo mismo que el diseño: Oasis 412, y Mítico 1 · Diamante 5 · Rubí 18 entre los 196
  activos con 5 batallas o más (el diseño: 414 y 1 · 5 · 16). La semana abre **como mucho dos piedras**
  (`ABIERTA_TOPE`), que es lo que dice el diseño: sin tope, Oasis llegaba a 435.
- **Las divisiones** (`bot/divisiones.py`): en la T1, idénticas —probado contra el código de antes con el ELO de
  verdad: la división y el subnivel de 700 ELO, las divisiones enteras y el lobby—. Desde la T2 salen del de temporada,
  con las piedras nuevas, sin provisional y desde la semana del arranque. Simulada la T2 con las batallas de la T1:
  Oasis solo en Mítico y cuatro en Diamante; y el pago por subir queda parecido al de la T1 (unos 145.000 Puntos de
  Tienda en una temporada, contra 163.500 de la T1 hasta hoy).
- **El reinicio**: `python sheet/espejo_t1.py --nueva-temporada t2 --aplicar` deja `datos/t2_elo_arranque.json`. Con
  lo de hoy, 13 arrancarían en Rubí I, 13 en Zafiro I y 32 en Jade I, y el resto en Hierro I. Si falta, el self-check
  de la temporada se pone rojo.
- **La página** (`web/src/divisiones.jsx`, `perfil_v10.jsx`): el ancho de cada piedra, sin provisional y los textos
  del ELO de temporada, **sólo si el lobby los trae** (`a`, `et`: desde la T2). Está en el código y **no construido**:
  sale con el próximo build sin cambiar nada de la T1 (el lobby de la T1 no los trae).

**El día del cambio** (después de la gala, el 1/1 desde las 11 AM ET): lo de siempre de `nueva_temporada()`. Las
piedras se prenden solas con `ACTUAL = 't2'`.

- **El histórico, para lo que hoy usa `bot/elo.py`**: desde la T2, `elo.calcular()` —los grupos y las simulaciones de
  las Competencias— y `notas.fuerzas()` —la nota y el MVP— salen de `elo_temporada.historico()`, con todas las
  temporadas. Con las batallas de la T1: Oasis 1339 con el nuevo, contra 1306 con el de hoy. Y nada lee el número de
  las divisiones como nivel: las chances salen de ahí, no de las piedras.

- **«La noche de…»** (`bot/noche.py`, `elo_noche()`): desde la T2 muestra lo que se movió el **ELO de temporada** esa
  noche, con lo de la noche adentro (Dlx, 20/11/2026, 4:02 AM: *«Sí, el de temporada»*). Con el #649 de prueba: Mats de
  106 a 192, que lo ganó. En la T1 sigue mostrando el de siempre.

- **La página, construida y publicada** (20/11/2026, 4:33 AM): desde la T2 el perfil dice «ELO de temporada» y suma el
  histórico, que viaja con las últimas batallas en `/api/divisiones` (`_hist`: en el lobby no entra), y «Invita y gana»
  y la Guía explican el ELO de temporada (la Guía, con un tercer texto en su fila: `textoSemana()`). Comprobado en la
  página publicada: el perfil de Oasis y la Guía se ven como antes.

**Lo único que falta**: el 1v1 ranked (×`FORMATO_1V1`) y lo que votaba el público, cuando existan.
