# El ELO por temporada y el histórico — el diseño (para la T2)

> **Estado (20/11/2026, 3 AM ET): decidido en lo grande, por construir.** Los números son un borrador simulado sobre la
> T1 y esperan el OK de Dlx. Todo lo que se decidió está acá; lo que falta decidir, al final. Las simulaciones son
> scripts de una sesión (no están en el repo): cada número dice de dónde sale.

Dlx, 20/11/2026: *«el ELO tendría que empezar de 0 así como en Brawl Stars y que dependiendo del rango máximo de la
temporada se resetee… Que haya ELO por temporada y ELO histórico»*. Y después, en orden: *«no quiero que el ELO se base
sólo en la nota»*, *«el ELO va por áreas»*, *«si Oasis se enfrenta al top 2 de la misma piedra, uno ganaría y otro
perdería»*, *«la mayoría va por rondas: es injusto perder ELO por perder la final»*, *«estamos confundiendo cosas al traer
las notas al ELO»* y *«también planeo un 1v1 como el ranked de Brawl… y eventos en DRA de ciertas piedras… pero esto
debería cubrir también los eventos, para que la gente suba sin depender del 1v1 ni de los eventos de piedras»*. Y a las
3 AM, la que manda: *«la idea principal es que el ELO se suba y se baje solamente cuando luchas con personas de tu misma
piedra; el problema es que hay pocas de momento»*.

## 1 · Tres cosas distintas, que no se mezclan

| | qué mide | cómo se mueve | para qué sirve |
|---|---|---|---|
| **ELO histórico** | el nivel de verdad | batalla por batalla, suma cero, **nunca se reinicia** | armar los cruces: grupos de las Competencias, pronóstico del VS, la nota, el emparejamiento del 1v1 |
| **La nota** | cómo te fue esa noche, del 1 al 10 | no se acumula | la carta, el perfil, el MVP (`bot/notas.py`, ya existe) |
| **ELO de temporada** | tu ranked de la temporada | se acumula, **se reinicia con cada temporada** | las piedras, los premios, el ranking de la temporada |

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
- **Abajo de todo perder resta menos**: abajo de 100 no resta, de 100 a 299 resta la mitad (borrador).
- Las **piedras** salen de él (Hierro, Jade, Zafiro, Rubí, Diamante, Mítico, con sus I · II · III de `bot/divisiones.py`).
  Borrador: 100 por piedra.

### La unidad: la batalla

Cada batalla que cuenta es **un traspaso entre los dos**: lo que suma el que gana lo resta el que pierde.

    lo que se juega = K × (1 − la chance que tenía el que ganó, por el ELO HISTÓRICO) × los factores

| factor | qué hace | borrador |
|---|---|---|
| **el rival y lo esperado** | ganarle a alguien mejor suma más; perder siendo favorito resta más | la base: K 30, ±15 en una pareja |
| **el formato** | una batalla más larga se juega más | evento ×1 · **1v1 ranked ×1,5** (Dlx, 20/11/2026: *«Sí, ×1,5»*) |
| **la ronda** | la final pesa más que unos octavos | cuartos ×1,1 · semis ×1,2 · final ×1,3 |
| **nivel del evento** | un evento fuerte pesa más | ×0,7 a ×1,3 (el ELO promedio de los que jugaron) |
| **tamaño del evento** | una llave grande pesa más | ×0,85 a ×1,25 (de 4 a 83 en la T1) |
| **el veredicto** | un 3–0 se juega más que un 2–1 | unánime ×1,2 · dividido ×0,8 (con 2 jurados o más) |
| **lo que votaba el público** | ganar cuando el chat daba al otro se juega más | sólo hacia adelante, en los servidores con el bot en vivo |

### El área: tu piedra (Dlx, 20/11/2026, 3 AM)

**El ELO de temporada se mueve sólo en las batallas contra alguien de tu piedra**; afuera no cuenta, ni ganando ni
perdiendo (Dlx: *«la idea principal es que el ELO se suba y se baje solamente cuando luchas con personas de tu misma
piedra»*). Cuenta la piedra de cada uno **al empezar la noche**. Una batalla fuera del área igual **mueve la nota y el
ELO histórico** (los dos miran el nivel), y la sorpresa del de abajo se la lleva el 🔥 Batacazo. Vale también para lo
de la noche (ver abajo).

⚠️ **Sola, se traba arriba** (T1 simulada, `elo_piedra.py` del scratchpad de esa sesión): al principio todos son Hierro
y cuenta casi todo, y a medida que la gente se separa cuenta cada vez menos —**83 % de las batallas en septiembre, 55 %
en octubre, 44 % en noviembre**—. Nadie pasa de Rubí en toda la T1: Oasis llega el 07/11 y, como es el único, desde ahí
juega y no le cuenta nada (de sus 77 batallas contaron 20). **No es sólo que haya poca gente: en un evento abierto el
rival lo pone la llave, no la piedra** —con el área anterior, la mitad de las batallas del top 8 eran contra alguien 2
piedras o más abajo—. Lo que lo resuelve de verdad es el 1v1 ranked (empareja por piedra) y los eventos de piedras de
DRA.

**Propuesta, espera el OK: la piedra se abre sola si te quedas sin rivales.** Si pasa **una semana** sin que te toque
nadie de tu piedra, cuenta también la de al lado (arriba y abajo); **dos semanas**, dos piedras. Se cierra apenas te
toca alguien de tu piedra, y al cambiar de piedra el reloj arranca de nuevo. Es lo que hace cualquier emparejamiento
cuando no aparece nadie de tu nivel: ampliar la búsqueda.

| cuándo se abre a la piedra de al lado | cuentan (sep → oct → nov) | arriba al final | 1.º |
|---|---|---|---|
| nunca | 57 % (83 → 55 → 44) | Rubí 1 | Oasis 324 |
| si en tu piedra hay menos de 8 jugando (último mes) | 59 % | Rubí 2 | Oasis 365 |
| si hay menos de 12 | 62 % | Mítico 1 · Rubí 4 | Oasis 535 |
| **una semana sin rival de tu piedra** | **71 % (83 → 68 → 72)** | **Diamante 1 · Rubí 7** | **Oasis 413** |
| dos semanas | 63 % | Rubí 4 | Oasis 369 |
| 2 noches jugadas sin rival de tu piedra | 74 % | Mítico 1 · Diamante 3 · Rubí 5 | Makmah 535 |

Por qué la de la semana: para casi todos sigue siendo «sólo tu piedra» (se abre para el que se quedó solo), **con el
tiempo no se vacía** (las otras bajan mes a mes) y arriba el orden se parece al del nivel (Oasis 1.º, con 86 % por
batalla). «Menos de 12 jugando» deja la cima abierta todo el tiempo y hasta 3 piedras: casi como no tener área. Contar
noches jugadas en vez de días premia jugar mucho (Makmah 1.º, lo que se le criticó a la escalera sin reglas).

Historia: hasta las 3 AM el área eran **2 piedras de diferencia hasta Zafiro y 1 de Rubí para arriba** (12 % de las
batallas afuera). Antes se probó que perder fuera del área SÍ reste (y ganar no sume) y no sirve (Dlx, 2:15 AM: *«¿de
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
alto llegaste pero sirve hasta cierta piedra y ELO»*). Borrador: Mítico ×0,6 sin bajar de 300 · Diamante ×0,55 sin bajar
de 200 · Rubí ×0,5 sin bajar de 100 · Zafiro ×0,4 · Jade y Hierro a 0. **La primera vez, de la T1 a la T2**, sale de la
piedra más alta de la T1.

## 4 · Lo que se probó y no sirve

- **La escalera batalla por batalla, sin reglas de llave**: premia jugar mucho (Makmah 1.º con 52 % en 167 batallas).
- **Moverlo sólo por la nota**: no mira suficientes cosas, y la nota no es el ELO.
- **Premios de la noche sin mirar lo esperado**: Oasis 2.526 contra 1.331 de Makmah (el doble), con ~2.080 de premios.
- **El subcampeón con premio**: el que perdía la final terminaba sumando por esa misma batalla.
- **«Lo esperado por tu lugar en la llave»** (el 1.º gana todo, el 2.º llega a la final…): supone que siempre gana el
  favorito; restaba el 63 % de las noches y arriba quedaban los de menos nivel.

## 5 · La T1 simulada con este diseño (sin el 1v1 ni el público, que no existen todavía)

**Con el área de la piedra y la semana** (y lo de la noche sólo con batallas del área): cuenta el 71 % de las batallas.
Oasis 413 · Carlosss 339 · Abyssus 333 · Panchok 333 · Walker 322 · Agus 308 · Makmah 307 · Motera 302. Piedras:
Diamante 1, Rubí 7, Zafiro 19, Jade 58, Hierro 529. Con el reinicio del borrador, **la T2 arrancaría con 391 de los 409
activos en Hierro**: se sube menos que con el área anterior, así que el reinicio y el tamaño de las piedras hay que
recalcularlos con esta regla.

Con el área anterior (2 piedras / 1): Oasis 623 (21 noches que cuentan, 3 restaron: −23 las peores, saliendo temprano contra alguien de su área; arriba de
300, +6 por noche) · Makmah 484 (70 noches, 36 restaron) · Praiseriza 475 · Carlosss 460 · Panchok 433 · Abyssus 424 ·
Mats 415 · Erian 411. 25 finalistas habrían restado y no restan. El 12 % de las batallas, fuera de área. Piedras en
pirámide (Mítico 1, Diamante 7, Rubí 16, Zafiro 13, Jade 54, Hierro 579): con 100 por piedra la cima queda muy vacía, y
hay que ajustar el tamaño.

## 6 · Lo que falta decidir

1. **Cuándo se abre tu piedra** si te quedas sin rivales: la propuesta es una semana (§3).
2. **Los números**: K, los factores, los extras, la protección de abajo y el reinicio (con la regla de la piedra se
   sube menos, y el reinicio del borrador deja la T2 casi entera en Hierro).
3. **El tamaño de las piedras**, que ahora depende del 1.

Decidido el 20/11/2026: el 1v1 ranked pesa ×1,5 una batalla de evento; el área es tu piedra; las semis no llevan regla
propia. **Cuánto** se gana o se pierde en cada batalla es otro tema (Dlx: *«cuánto, pues ahí es otro caso»*).

## 7 · Qué se toca al construirlo

- `bot/elo.py`: el histórico con los dos arreglos, y el de temporada aparte (con su escalera, su área y el cierre por
  noche). El área pide guardar, por persona, **la fecha de su última batalla contra alguien de su piedra** (vuelve a
  arrancar al cambiar de piedra).
- `bot/divisiones.py`: las piedras salen del de temporada, con tramos nuevos (hoy son 950 a 1150 sobre el de 1000).
- Las Competencias, la nota (`bot/notas.py`), el pronóstico del VS y el emparejamiento del 1v1: del **histórico**.
- El cambio de temporada (`sheet/espejo_t1.py --nueva-temporada`): el reinicio por piedra máxima.
- La página (el Ranked, el perfil, `/apodo`): las piedras y el número de temporada; el histórico, en el perfil.
