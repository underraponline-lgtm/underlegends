# El ELO por temporada y el histórico — el diseño (para la T2)

> **Estado (20/11/2026, 2 AM ET): decidido en lo grande, por construir.** Los números son un borrador simulado sobre la
> T1 y esperan el OK de Dlx. Todo lo que se decidió está acá; lo que falta decidir, al final. Las simulaciones son
> scripts de una sesión (no están en el repo): cada número dice de dónde sale.

Dlx, 20/11/2026: *«el ELO tendría que empezar de 0 así como en Brawl Stars y que dependiendo del rango máximo de la
temporada se resetee… Que haya ELO por temporada y ELO histórico»*. Y después, en orden: *«no quiero que el ELO se base
sólo en la nota»*, *«el ELO va por áreas»*, *«si Oasis se enfrenta al top 2 de la misma piedra, uno ganaría y otro
perdería»*, *«la mayoría va por rondas: es injusto perder ELO por perder la final»*, *«estamos confundiendo cosas al traer
las notas al ELO»* y *«también planeo un 1v1 como el ranked de Brawl… y eventos en DRA de ciertas piedras… pero esto
debería cubrir también los eventos, para que la gente suba sin depender del 1v1 ni de los eventos de piedras»*.

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
| **el formato** | una batalla más larga se juega más | evento ×1 · **1v1 ranked ×1,5 (a confirmar)** |
| **la ronda** | la final pesa más que unos octavos | cuartos ×1,1 · semis ×1,2 · final ×1,3 |
| **nivel del evento** | un evento fuerte pesa más | ×0,7 a ×1,3 (el ELO promedio de los que jugaron) |
| **tamaño del evento** | una llave grande pesa más | ×0,85 a ×1,25 (de 4 a 83 en la T1) |
| **el veredicto** | un 3–0 se juega más que un 2–1 | unánime ×1,2 · dividido ×0,8 (con 2 jurados o más) |
| **lo que votaba el público** | ganar cuando el chat daba al otro se juega más | sólo hacia adelante, en los servidores con el bot en vivo |

### Las áreas (como el emparejamiento de Brawl)

**Ganarle a alguien muy por debajo de tu piedra no suma** (y a él no le resta): no es tu área. Hasta Zafiro, el área son
2 piedras de diferencia; de Rubí para arriba, 1. **Perder contra alguien muy por debajo sí resta**: fallaste. En la T1,
el 7 % de las batallas quedan fuera de área.

### Dónde se juega, y cómo se cierra cada cosa

| de dónde viene la batalla | cómo se cierra |
|---|---|
| **un evento abierto** (las llaves de los servidores) | se juntan todas sus batallas y **se cierra la noche**: llegar a la final **nunca resta**; salir campeón **siempre suma**. Las áreas, como arriba |
| **el 1v1 ranked** (por construir) | cada partida se cierra sola, como en Brawl. Empareja por área, así que casi nunca hay batallas fuera de área |
| **los eventos de piedras de DRA** (por construir) | como un evento abierto, con todos en el área; el nivel del evento ya los hace pesar más |

⚠️ **Se tiene que poder subir sólo con los eventos abiertos** (Dlx): el 1v1 y los eventos de piedras son otra forma de
subir, no la única. En la T1 simulada, Oasis llega a Mítico sólo con eventos abiertos.

### Lo de la noche que no le quita nada a nadie

Chicos, y **pagan menos si eras mucho más fuerte que el resto del evento** (× entre 0,3 y 1 según lo esperado):
campeón **+15**, MVP **+8**, 🔥 Batacazo **+6**, racha **+2 / +4 / +6** desde la 3.ª victoria seguida. El subcampeón, el
tercero y la nota **no suman solos**: perdieron una batalla, o repiten lo que ya cuentan las batallas.

### Cuándo se pierde ELO de temporada

- **Saliendo temprano** contra alguien de tu nivel o de abajo; cuanto más débil, más resta.
- Perder contra alguien mejor resta poco.
- **Llegar a la final nunca resta.** Perder en semis después de ganar dos casi siempre deja la noche en positivo.
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

Oasis 592 (23 noches, 6 restaron: −25 y −23 las peores, saliendo temprano) · Mats 426 · Abyssus 411 · Panchok 408 ·
Praiseriza 394 · Over 375 · … · Makmah 308 (en 54 de sus 87 noches salió temprano). 36 finalistas habrían restado y no
restan. Piedras en pirámide (Mítico 1, Diamante 3, Rubí 17, Zafiro 21, Jade 51, Hierro 580): con 100 por piedra la cima
queda muy vacía, y hay que ajustar el tamaño.

## 6 · Lo que falta decidir

1. **Cuánto pesa el 1v1 ranked** contra una batalla de evento (borrador ×1,5: es un formato más largo).
2. **Los números**: K, los factores, los extras, la protección de abajo y el reinicio.
3. **El tamaño de las piedras**, para que la pirámide tenga gente arriba.
4. **Las semis**: ¿llegar a semis en una llave grande también debería no restar?

## 7 · Qué se toca al construirlo

- `bot/elo.py`: el histórico con los dos arreglos, y el de temporada aparte (con su escalera, sus áreas y el cierre por
  noche).
- `bot/divisiones.py`: las piedras salen del de temporada, con tramos nuevos (hoy son 950 a 1150 sobre el de 1000).
- Las Competencias, la nota (`bot/notas.py`), el pronóstico del VS y el emparejamiento del 1v1: del **histórico**.
- El cambio de temporada (`sheet/espejo_t1.py --nueva-temporada`): el reinicio por piedra máxima.
- La página (el Ranked, el perfil, `/apodo`): las piedras y el número de temporada; el histórico, en el perfil.
