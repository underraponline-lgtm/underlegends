# Qué se mueve cuando llegue la T1

Dlx: *«estamos usando info de la sheet actual, no de la sheet de la temporada 1
que tendrá todo lo que necesitamos»*.

Tiene razón, y el riesgo no es que los datos sean viejos — eso se arregla
corriendo los builders. **El riesgo es que la mitad del sistema se recalibra
sola contra el pool y la otra mitad tiene números clavados, y nada avisa cuál
es cuál.**

---

## Lo que se recalibra solo

Estos leen el pool y se acomodan. Refrescar es suficiente.

| qué | dónde | cómo se acomoda |
|---|---|---|
| OVR de Temporada | `construir_pool_temporada.py:187` | cada componente se normaliza contra el **máximo del pool** |
| las 5 dimensiones del Competitivo | fuera del repo, en `competitivo.py` | ídem — ver abajo |
| `pos_pais`, `pos_sv`, `pos_crew` | `construir_pool_competitivo.py` | son posiciones: relativas por definición |
| Score Selección de cada país | se deriva del pool | promedio del top 5 |
| **OVR Nacional (N3)** | a construir | normalizado contra el máximo del pool |

⚠️ **Y «se acomoda solo» tiene su propia trampa**: un tope que sale del pool
**siempre se mueve**. Si alguien entra y rompe el récord, **todos los demás
bajan** sin haber hecho nada. Ya pasó una vez en esta sesión: simulé un tope
absoluto dejándolo fijo y la simulación dijo que nadie bajaba. Un tope derivado
del pool no se puede simular fijándolo.

---

## Lo que se queda viejo

Estos son números clavados. Si la forma de los datos cambia, **siguen
corriendo y significan otra cosa**.

| qué | valor | copias |
|---|---|---|
| **Umbrales de rango** (por Score) | 82 · 73 · 62 · 48 · 37 · 26 · 18 | **4 archivos** |
| Umbrales de color (Temporada) | 88 · 82 · 74 · 67 · 61 · 56 · 52 | 2 archivos |
| Mínimo de eventos para entrar | 8 | varios |
| Umbral de los círculos del pie | 3 | `construir_pool_competitivo.py` |
| Tope del OVR por servidor | 60.0 puntos | `escalera_larga.py` |
| Escalones de título de la Servidor | 85 · 72 · 62 · 52 | `todos_sv.py` |
| Cortes del TAG | varios | `comun/titulos.py` |

✅ **Los umbrales de rango ya avisan.** Estaban copiados en cuatro archivos y
**nada los comparaba** — `rangos.verificar()` miraba sólo los colores. Ahora
`rangos.verificar_umbrales()` los cruza y revienta si se separaron. Corre solo
con `python comun/rangos.py`.

---

## ⚠️ El cambio grande: hoy el Score es relativo, después va a ser absoluto

Medido sobre el pool de hoy:

| dimensión | máximo | cuántos en 100 |
|---|---|---|
| Eficiencia | 100.0 | **1** |
| Consistencia | 100.0 | **1** |
| Dominancia | 100.0 | **1** |
| Techo | 100.0 | **1** |
| Diversidad | 95.0 | 0 |

**Exactamente una persona en 100 es la firma de normalizar contra el máximo del
pool**: el mejor de cada eje saca 100 *sea quien sea y valga lo que valga*.

O sea que **hoy el rango es una posición relativa disfrazada de número
absoluto.** Konan no es SSS por llegar a 82 puntos de algo: es SSS porque es el
mejor, y el sistema le pone 91.

**El rework cambia justo eso** (`docs/rework_inventario.md`, Parte A):

| # | cambio | qué le hace al Score |
|---|---|---|
| 1 | anclas fijas | deja de ser relativo → **infla durante la temporada** |
| 4 | diversidad por puntos | cambia una de las 5 dimensiones |
| 5 | Techo → Racha | cambia otra |
| 7 | escala a 40–99 | cambia el rango entero de valores |

⚠️ **Y con el cambio 7 los umbrales de hoy mueren.** Si el Score va de 40 a 99,
nadie baja de 40 y los tramos de **B (37), C (26), D (18) y E** quedan vacíos:
**cuatro de los ocho rangos dejan de existir**, con sus cuatro figuras, sus
cuatro colores y sus subrangos con signo.

Ya está escrito en `docs/rework_revision.md`: **los umbrales hay que
recalibrarlos en el mismo pase que el cambio 7**, no después.

---

## Qué hacer con la carta de País mientras tanto

**Construirla igual, y que su número sea pool-relativo.** Es lo que hace N3:
se normaliza contra el máximo del pool, así que cuando llegue la T1 se
recalibra sola. No hereda ninguno de los números clavados de arriba.

Lo único que hereda del Score es su **forma**, y ahí:

- si el Score cambia de escala (cambio 7), N3 **no se rompe** — divide por el
  máximo, así que la escala se cancela;
- si el Score cambia de **definición** (cambios 1, 4, 5), N3 cambia de
  significado igual que la Competitiva, que es lo correcto: las dos deberían
  hablar del mismo Score.

⚠️ **Lo que NO se puede calibrar todavía** son los cortes de cualquier escalera
de títulos nacional. Los de la Servidor salieron de percentiles del pool de
hoy; los de País saldrían igual y habría que rehacerlos. **Conviene no
inventarlos ahora.**

---

## Lo que la T1 va a traer y hoy no existe

| dato | para qué sirve | hoy |
|---|---|---|
| Fecha FIFA (mensual, best of 3) | el OVR Nacional de verdad | no existe |
| Copa de Naciones (al cierre) | ídem | no existe |
| Selecciones completas | hoy 2 de 4 países las tienen llenas | 12 personas |
| Duelos individuales | una stat de las cartas | reales en **4 de 138** |
| Llaves de SR, TWR y Fontana | eventos que faltan | no están |
| Avatares vivos | 11 de 20 caídos | necesita token de bot |
