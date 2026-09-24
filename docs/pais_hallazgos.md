# La carta de País — lo que dice el Sheet y lo que se puede construir

Dlx: *«Un OVR Nacional sería.. y la posición dentro del país exacto — chequeá
bien el sheet de ranking mundial»*. Está chequeado.

---

## El Ranking Mundial no es una tabla: son tres bloques

Y por eso ningún script lo leía. Ahora sí:
`sheet/construir_pool_mundial.py` → `datos/mundial.json`.

| bloque | qué trae | filas |
|---|---|---|
| **Las selecciones** | 1 capitán + 4 representantes, elegidos por él | **4 países** |
| **Ranking de países** | suma de los puntos de **todos** sus raperos | **25 países** |
| **Países más competitivos** | promedio del Score de sus **mejores 5** | **17 países** |

Lo que la hoja dice de sí misma:

> «Cada país arma una selección: 1 capitán + 4 representantes elegidos por él.
> Los capitanes los define la Directiva.»
> «Ranking pasivo: suma los puntos de Temporada de los 5 representantes.»
> «⏳ SE ACTIVA EN TEMPORADA 2 (desde 19 jul 2026)»
> «Actualizado: 10/07/2026»

⚠️ **Esa fecha no se puede tomar al pie de la letra.** La hoja se actualizó el
10/07 y dice que la T2 arranca el 19/07, pero la T1 todavía no empezó: el Sheet
quedó congelado en la pre-temporada mientras se hacía el rework. **La hoja
describe un plan, no el estado.**

### Tres trampas

⚠️ **Los países vienen como emoji de bandera**, no como código: dos indicadores
regionales que hay que traducir a las dos letras.

⚠️ **Hay uno que no es una bandera: `❓`, «sin país».** Y no es un caso raro —
son **145 raperos**, más que cualquier país salvo Argentina. En el ranking de
países entra 6º con 523.000 puntos.

⚠️ **De las 4 selecciones, sólo 2 están completas.** Chile y México tienen
**4 cupos libres cada una**, y los cupos vacíos suman 0 igual. Su número bajo
no dice que sean flojos: dice que no eligieron.

---

## Lo que ya está resuelto: la posición dentro del país

**Ya se calcula.** `construir_pool_competitivo.py` deja `pos_pais` con el
formato `"1/33"`, por **Score**, con el mismo umbral de 3 que rige todo el pie.

| | |
|---|---|
| tienen país | **137 de 138** (el que falta es Mark, el `❓` del Sheet) |
| países que llegan a 3 | **9 de 16** |
| cubiertos por esos 9 | **126 de 138** |
| ya tienen `pos_pais` | **126** |

Los 9: `ar 33 · cl 26 · co 25 · mx 11 · ve 10 · pe 8 · es 6 · uy 4 · ec 3`.

---

## Lo que hay que decidir: qué mide el OVR Nacional

⚠️ **El Score Selección del Sheet mide al PAÍS, no a la persona.** Sirve como
ingrediente, no como el número de la carta: si la carta muestra 71.1, los 25
colombianos con carta llevan todos el mismo número y sólo 9 números distintos
existen en toda la Liga.

⚠️ **Y se puede calcular sin el Sheet.** Verificado contra la hoja: la peor
diferencia es **0.04** en los 17 países. El pool alcanza, así que el generador
no necesita credenciales.

### Tres candidatos, medidos sobre las 138

| | qué mide | valores distintos | en el tope | reordena vs Score |
|---|---|---|---|---|
| **N1** | contra el mejor de **tu país** | 36 | **17** | 17.5 puestos |
| **N2** | contra el mejor de la **Liga** | 37 | 1 | **0.0** |
| **N3** | tu Score **×** la fuerza de tu país | 32 | 1 | **19.8 puestos** |

⚠️ **N2 queda descartado por medición, no por gusto: no reordena a nadie.**
Cero personas se mueven de puesto. Es el Score con otra escala, así que la
carta de País sería **la Competitiva repintada**.

⚠️ **N1 tiene el problema del «1 de 1»**, que este proyecto ya conoce. Pone a
**17 personas en 99**, y cuatro de ellas son el único de su país: Am es 99 por
ser el único guatemalteco. Es exactamente lo que el umbral de 3 existe para
evitar.

### ⚠️ Los dos factores de N3 son el MISMO número

Dlx preguntó: *«tu score de qué? de país?»*. La respuesta importa.

**«Tu Score» es el Score Competitivo** — el mismo que muestra la Competitiva. Y
**«la fuerza de tu país» es el Score Selección**, que es *el promedio del Score
Competitivo de los mejores 5 de tu país*. O sea que **N3 está hecho entero con
el número de la Competitiva**, uno tuyo y otro de tus compatriotas.

Y el Sheet mide países con **dos ejes distintos, no uno**:

| bloque de la hoja | eje |
|---|---|
| Ranking de países | suma de los **puntos** de todos sus raperos |
| Países más competitivos | promedio del **Score** de sus mejores 5 |

Así que hay otra pareja de ingredientes posible. Medidas las tres:

| | de qué está hecho | valores | en el tope | se despega de Competitiva | de Temporada |
|---|---|---|---|---|---|
| N3 | tu **Score** × el Score de tu país | 59–99 | 1 | 19.8 | 25.1 |
| **N4** | tus **Puntos** × los Puntos del país | 50–99 | 1 | **26.3** | **22.8** |
| N5 | tus Puntos × el Score de tu país | 53–99 | 2 | 21.1 | 13.5 |

⚠️ **Lo que decide es el PEOR de los dos, no el mejor.** Una carta que se
despega mucho de una y poco de la otra sigue repitiendo a la otra:

- N3 se despega **19.8** de la Competitiva → es su peor caso
- N4 se despega **22.8** de la Temporada → es su peor caso
- N5 se despega **13.5** de la Temporada → repite a la Temporada

Por separación pura, N4 gana. **Y pierde por otra cosa que hay que mirar
antes: choca de frente con la posición.**

### ⚠️ N4 contradice a `pos_pais` en la misma carta

`pos_pais` se calcula **por Score**, igual que servidor y crew — y `CLAUDE.md`
dice que los tres van juntos o dejan de ser comparables entre sí.

- **N3 es el Score multiplicado por un factor que es constante dentro de un
  país**, así que el orden adentro **no cambia**. `pos_pais` sirve tal cual.
- **N4 es puntos**, y ordena distinto. Medido:

| país | n | cambian de puesto | el que más |
|---|---|---|---|
| ar | 33 | **30 (91 %)** | Bau: **5º por Score, 25º por puntos** |
| cl | 26 | 22 (85 %) | Fullylo4ded: 3º → 14º |
| co | 25 | 22 (88 %) | NFK: 3º → 14º |
| mx | 11 | 10 (91 %) | Kourier: 1º → 6º |

**En total, 97 de 126 cambian de puesto — el 77 %.**

O sea que con N4 la carta mostraría el 5º mejor número de Argentina con una
pastilla que dice **25º**. Las dos cosas se contradicen a la vista, en la
misma carta. Arreglarlo pidiría recalcular `pos_pais` por puntos, y eso
arrastra a servidor y crew, que van juntos por regla.

### Entonces: N3

Media geométrica entre tu Score y el Score Selección de tu país, normalizada
contra el máximo posible:

```
OVR Nacional = 40 + √( √(score × score_pais) / √(mejor_score × mejor_pais) ) × 59
```

- **reordena de verdad** — 19.8 puestos de corrimiento medio, 92 personas se
  mueven 10 o más
- **un solo 99**, y es Konan, que es #1 de la Liga y de Argentina
- **los países chicos no se inflan**: Am pasa de 99 (N1) a 70
- **y no rompe nada**: el orden dentro del país es idéntico al del Score

⚠️ **Lo que se acepta a cambio** es que sus dos ingredientes son el Score
Competitivo. Es lo mejor disponible **hoy**; cuando la T2 dé resultados
nacionales propios, ahí el ingrediente cambia.

---

## Las otras cinco ideas, y por qué cayeron

Dlx: *«explorá más ideas, pero si no encontrás otra pues quedate con esa»*.
Se probaron cinco más contra las mismas tres pruebas.

| | idea | despega (el peor) | en 99 | el único de su país | `pos_pais` |
|---|---|---|---|---|---|
| **A** | **N3 · tu Score × el Score del país** | 19.8 | **1** | 59–77 | ✅ |
| B | aporte · qué % de tu país sos | 30.7 | **19** | hasta **99** | ❌ |
| C | selección · vs el corte del top 5 | 27.7 | 5 | todos **82** | ✅ |
| C2 | igual, con piso para los chicos | **24.9** | 4 | 71–**99** | ✅ |
| D | marginal · cuánto bajaría sin vos | 23.1 | 0 | 61–80 | ✅ |
| E | aditiva · 65 % vos + 35 % país | 18.4 | 1 | 63–84 | ✅ |
| F | tu Score × cuánta gente compite | 19.6 | 0 | 71–82 | ✅ |

⚠️ **D muere por el reparto, que es una prueba que no habíamos hecho.** Su
número parecía bueno — 23.1 de separación, cero en el tope — pero **84 de 138
caen en el piso (61 %)**: sólo los 5 mejores de cada país aportan algo, así que
todos los demás valen 40. Un escalón con 84 personas adentro no distingue a
nadie. **Un promedio de separación alto no sirve si la mitad de la gente
comparte número.**

⚠️ **B muere dos veces**: 19 personas en 99 y rompe `pos_pais`.

⚠️ **E y F no aportan**: separan igual o peor que A.

### La única que compite de verdad: C2

Separa mejor (24.9 contra 19.8) y se reparte mejor — A deja a **135 de 138 por
encima de 70**, C2 los estira de 57 a 99. Pero:

- **cuenta la historia al revés.** C2 te mide *contra* tu país, así que ser
  argentino te **perjudica**: la vara son los 5 mejores de 33. A te mide *con*
  tu país. Para una carta de País, cargar una bandera fuerte debería sumar, no
  restar.
- **necesita un parche que A no necesita**: 7 de los 16 países no llegan a 5
  clasificados, así que su corte no dice nada y hay que compararlos contra un
  corte prestado. Son **19 personas, el 14 %**.
- **4 en 99 contra 1.**

**Queda A.** C2 queda escrita acá por si la T2 cambia el criterio: cuando el
Mundial se juegue de verdad, «cuánto superás el nivel de entrada a tu
selección» va a tener datos propios detrás y ahí la balanza puede darse
vuelta.

---

## Lo que falta, y no es código

⚠️ **Hoy no existe ningún resultado nacional.** La Fecha FIFA (mensual, best of
3) y la Copa de Naciones (al cierre) arrancan en T2. Todo lo de arriba se
construye con datos **prestados** de las otras dos cartas — puntos de Temporada
y Score Competitivo — porque es lo único que hay.

Cuando la T2 genere resultados propios, el OVR Nacional debería pasar a
medirlos a ellos. **Conviene dejarlo escrito ahora**, porque si no la fórmula
prestada se va a leer como definitiva.

Decisiones abiertas:

1. **Los 12 sin país que llega a 3** — ¿círculo sin número, como en el pie, o
   la carta no se emite?
2. **El `❓`** — 145 personas sin bandera en el Sheet, 1 sola con carta. ¿Se les
   emite carta de País?
3. **Capitán y representante** — hoy son 4 países y 12 personas. Es un dato
   fuerte para la carta (una insignia, no un número), pero cubre al 9 %.
