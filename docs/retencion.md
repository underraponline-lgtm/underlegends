# Por qué la gente juega una vez y no vuelve

Medido el 20/09/2026 sobre el Ranking Temporada, los dos pools y los registros
de Most Wanted de `Config`. Este documento no es una idea: es lo que dicen los
números, y el diseño de la T1 sale de acá.

⚠️ **Los números son de la PRE-TEMPORADA y se van a borrar.** Lo que se
conserva es la **forma**: el acantilado, la concentración y la matemática del
bracket no dependen de estos datos, dependen del formato.

---

## El acantilado

**735 personas compitieron en los 4 meses de pre-temporada.** Para un nicho
del rap en español eso es mucho, y significa que el problema **no es de
alcance**. Es de lo que pasa después.

```
1 evento     311 personas   42,3 %  ██████████████████████████████████████
2 eventos    113            15,4 %  ██████████████
3 eventos     48             6,5 %  ██████
4-5 ev        86            11,7 %  ██████████
6-7 ev        39             5,3 %  ████
8-10 ev       29             3,9 %  ███
11-20 ev      55             7,5 %  ██████
21-50 ev      37             5,0 %  ████
51+ ev        17             2,3 %  ██
```

- **311 jugaron exactamente una vez.** Es el grupo más grande del proyecto,
  más del doble que los 138 que tienen tarjeta competitiva.
- el 58 % jugó dos veces o menos
- **el 81 % de los que alguna vez compitieron nunca llegó a 8 eventos**

⚠️ **Un 42 % parado exactamente en «1» no es interés decreciente.** Una curva
de aburrimiento baja suave; ésta cae de golpe. La gente no se va cansando:
**viene una vez y no vuelve.**

⚠️ **Y esto no se ve desde `datos/`.** Los pools están filtrados en 8 eventos,
así que los 597 que no llegan son invisibles ahí — hay que leer el Sheet. Es
la misma forma que el bug de los avatares: *el dato estaba y nadie iba a
buscarlo*.

---

## Contra quién pierden

```
416 campeonatos repartidos entre 138 personas
   los 5 mejores se llevan   25,0 %
   los 10                    40,6 %
   los 20                    62,3 %
   nunca ganaron uno:  53 de 138  (38 %)
```

Y el corte más claro es por cuánto jugás:

```
jugaron 6-15    59 personas   win% 36,7   campeonatos  55
jugaron 16-40   56 personas   win% 38,6   campeonatos 117
jugaron 41+     23 personas   win% 51,1   campeonatos 244
```

**23 personas se llevan 244 de 416 campeonatos: el 59 %.**

⚠️ **Ojo con leer causalidad de más.** «De los que jugaron 1-3 eventos sólo el
9 % pisó un podio, contra el 97 % de los que jugaron 20+» suena demoledor,
pero es en buena parte mecánico: jugá veinte veces y subís a un podio por
repetición. Lo que **sí** es sólido es la forma del acantilado.

---

## Por qué Most Wanted funcionó, y es reproducible

Dlx: *«hicimos Most Wanted, que fue un éxito»*. No fue suerte. Cruzando los
registros de `Config` contra el puesto de cada uno en el pool:

```
Deuxs    #79   cazó a  Abyssus  #3      ← 76 puestos abajo
Dui      #115  cazó a  Velatz   #62
Vandu    #71   cazó a  Hassan   #26
Snow     #51   cazó a  Juasmio  #16
Colesito #34   cazó a  Juanpa   #5
```

**10 de 16 cazadores estaban peor ubicados que su presa.**

### La matemática, que es todo el secreto

En un bracket de 16 hay que ganar **cuatro veces seguidas**. Para alguien que
gana 4 de cada 10 batallas:

```
bracket de 16   →  0,4⁴  =   2,6 %   de llevarse algo
Most Wanted     →  0,4   =  40,0 %
```

**Quince veces más probable, con la misma habilidad.** El de abajo no es que
no gane: es que el formato le pide una racha que su nivel no produce. Y lo
sabe, y por eso juega una vez y no vuelve.

⚠️ **La regla que sale de acá:** lo que engancha al 42 % no es emparejar
mejor, es **pedir una sola victoria**. Cualquier formato donde jugar una vez
deje algo funciona; cualquier eliminación deja al que pierde con cero.

| formato | victorias seguidas | para el de abajo |
|---|---|---|
| bracket de 16 | 4 | 2,6 % |
| **Most Wanted** | **1** | **40 %** · probado |
| misión («ganale a alguien de rango mayor») | 1 | 40 % |
| ranked / duelos | 1 por vez, y acumula | no elimina |
| eventos por rango | 4, contra pares | sube cada ronda, no el formato |

⚠️ **«Eventos por rango» es el más débil de los cuatro para este problema.**
Empareja a los rivales pero sigue siendo eliminación: el que pierde en primera
ronda se va con cero igual.

---

## Lo que ya está construido y no se usa

| idea de la T1 | qué existe hoy |
|---|---|
| **misiones** | `comun/requisitos.py:175` ya suma `('ev','mw','mis','misiones')` para desbloquear la Temporada. El comentario dice *«las misiones todavía no están»* |
| **eventos por rango** | Snake Rap ya etiqueta `[Rango 4]`. `Config` tiene la tabla `RANGOS` con `Score mín` y cuántos hay por tramo |
| **ranked / duelos** | `DNA` y `DIN` son stats de la carta de País que salen en `—`. La hoja `1v1` del Operativo tiene las columnas y **cero filas**: un modo ranked es lo que la llena |
| **cyphers** | `Config`: `Cypher ❌ No cuenta`. Ya está decidido que no puntúa |
| **pases** | el rol `1531136241171697807` en DRA |
| **la Bloqueada** | `comun/bloqueada.py`, con `X/8 EVENTOS` y cuánto falta. Es una barra de progreso para los 597, y hoy no la ve nadie |

---

## 🔴 El choque que hay que resolver antes de separar por rangos

**El rango sale del Score competitivo, y el Score pide 10 eventos.**

Entonces el que llega **no tiene rango** — no es E, es que no tiene. Y los 597
que están entre 1 y 7 eventos tampoco.

⚠️ **El 81 % de los que alguna vez compitieron quedaría afuera de un sistema
por rangos**, que es exactamente la gente que ese sistema quiere incluir.

La salida es la de los juegos ranked: **partidas de colocación.** Los primeros
N eventos no te dan rango, te lo *asignan*. Jugás contra cualquiera desde el
día uno y a los pocos eventos caés donde te corresponde, antes de acumular
diez derrotas.

---

## El tamaño de lo que está en juego

~180 personas nuevas por mes encontraron la Liga solas, sin un sistema que las
retuviera. Si la retención pasara del **19 %** actual —los que llegan a 8
eventos— a un **30 %**, el pool competitivo iría de **138 a ~220** sin
conseguir una sola persona nueva.

El alcance está resuelto. Lo que falta es que el que llega tenga algo que
hacer la segunda vez.
