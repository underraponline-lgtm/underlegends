# Revisión del REWORK del 20/08/2026, contra el repo

## ⚠️ ANTES DE NADA: QUIÉN MANDA SOBRE QUÉ

Dlx avisó que en este proyecto se tomaron decisiones **más nuevas** que las del
rework, y que hay que tener cuidado de no revertir cosas que ya están bien.
Verificado, y no hay riesgo de eso, porque **los dos documentos no se pisan**:

| tema | manda |
|---|---|
| diseño de las cartas | **el repo** — `CLAUDE.md` y `ESTADO.md` |
| pipeline, ranking, datos, bot | **el rework** |

El propio rework lo dice en su línea 10: *«El diseño de las tarjetas NO está
acá»*. Y se comprobó: **no menciona ni una vez** subrango, signo, rombo,
silueta, brillo, emblema, escalera ni TAG. Cero solapamiento.

⚠️ **Donde SÍ se tocan es en los NÚMEROS que la carta muestra** — Score, rango,
umbrales y de dónde salen los datos. Todo lo que sigue es sobre eso, y **nada
de lo que sigue propone cambiar una decisión de diseño del proyecto.**

---

Dlx pidió leerlo y verificar. Lo que sigue es **solo lo que se verificó
corriendo código contra el repo**, no impresiones.

---

## ✅ Confirma un hallazgo de hoy, y por escrito

La línea 86, en el punto 4 (Diversidad), dice:

```python
c = [num(r.get(s)) for s in SRV if num(r.get(s))>0]   # ← estas columnas son EVENTOS
```

**El documento ya sabía que las 7 columnas por servidor son eventos.** Hoy lo
verifiqué por otro camino —la suma da exactamente `Ev` en 136 de 138— sin
haberlo leído. Las dos verificaciones coinciden.

⚠️ **Y eso vuelve más grave el punto 4 del rework**: la Diversidad se calcula
con esas columnas, así que hoy mide *dónde apareciste*, no *dónde ganaste*.
El propio documento lo dice y propone el arreglo.

---

## ⚠️ 1 · El documento se contradice a sí mismo

| dónde | qué dice |
|---|---|
| línea 86 (Parte A.4) | «estas columnas son **EVENTOS**» |
| línea 335 (Parte F) | «derivar el servidor de dónde tiene más **puntos**» |

Son las mismas 7 columnas. **La correcta es la primera.**

⚠️ Y el repo arrastra el mismo error: `sheet/construir_pool_temporada.py:109`
dice *«el servidor sale de donde tiene MAS PUNTOS»*. El código está bien —usa
el argmax de esas columnas, que es lo correcto—, **el comentario está mal**.

---

## ~~2 · La Parte I contradice al repo~~ — **DESCARTADO, yo estaba equivocado**

Había marcado esto como «lo más serio»: la Parte I dice que los datos de las
cartas salen de `ranking_final.json` y no del Sheet, y los builders leen el
Sheet.

**No es un conflicto.** Dlx lo aclaró: `ranking_final.json` es el archivo con
todo lo **finalizado de la pre-temporada**, y como T1 todavía no arrancó, **ese
archivo y el Sheet tienen hoy el mismo contenido**. No hay dos fuentes: hay una
sola, congelada en dos lugares.

**El Sheet es la fuente y se actualiza.** Los builders están bien.

⚠️ Lo único que queda de esto, y ya estaba en `CLAUDE.md`: cuando T1 arranque el
Sheet empieza a moverse, así que **los pools hay que refrescarlos** —
`datos/` es la única fuente de verdad de los generadores y refrescar surte
efecto solo.

**Lección para mí:** marqué como contradicción algo que era una diferencia de
momento. Antes de declarar que dos fuentes se contradicen hay que preguntar
**cuándo** dice cada una lo suyo.

## ⚠️ 3 · Lo que el documento tiene desactualizado

- **Parte F, «el dict `LOGO` no tiene URBF, EFA ni FFA → `KeyError`»** — ya
  está arreglado. Vive en `comun/escudos.py` con `SIN_ICONO` y las tres cartas
  lo importan.
- **«Avatares: 118 de 138 no tienen»** — hoy el problema medido es otro y peor:
  de los que SÍ tienen, **11 de 20 dieron 404** el 04/08. Se están muriendo, no
  faltando.

---

## ✅ 4 · Lo que se verificó y está bien

- **`datos/estrellas.json` coincide exactamente con la tabla de herencia** de
  E2: TFC 1, SR 1, DRA 1, FTN 1, y TWR en 0. Verificado además contra el
  render: las cuatro cartas con estrella la dibujan y las seis sin ella no.
- **El umbral de 3** de la Parte G está implementado tal cual: número omitido,
  círculo mantenido si es identidad.
- **Los scopes ya son `spreadsheets.readonly`** en los tres scripts.

---

## 🔴 5 · Lo urgente que sigue sin hacerse

**La clave del service account NO fue rotada.** Verificado: el
`private_key_id` de `creds.json` sigue siendo el que el propio rework marca
como comprometido por haberse pegado en texto plano en un chat.

Es lo único de todo el documento que **no depende de T1 ni de ninguna otra
decisión** y que empeora cuanto más se espera. Se rota desde la consola de
Google Cloud.

---

## Lo que esto habilita para la carta Servidor

**Parte C, punto 1: «+7 columnas de PUNTOS por server, antes del 1er evento de
T1».** Eso es exactamente el ingrediente que le falta al OVR de la Servidor —
hoy solo hay eventos, y por eso el número grande dice *cuántas veces fuiste* y
no *cuánto hiciste*.

**Parte C, punto 6** ya tiene planificado lo demás: PTS, EVT, WR%, POD, CAM y
POS **por servidor**. Son los cinco números de la columna que hoy están
inventados.

⚠️ O sea que la carta Servidor **no está esperando una decisión de diseño:
está esperando el punto 1 y el 6 de la Parte C**, y los dos tienen fecha
límite el primer evento de T1.

---

# ADDENDUM — qué del rework NO se aplicó, verificado sobre los datos

Dlx avisó que el documento tiene cambios decididos **que nunca se hicieron**,
y que hay que tener precaución. Lo comprobé sobre `datos/competitivo_pool.json`
en vez de suponerlo.

## Los cuatro que se pueden verificar desde acá, y ninguno está aplicado

| # | cambio | evidencia de que NO se aplicó |
|---|---|---|
| **1** | Anclas fijas | **exactamente 1 persona en 100** en cada una de las 4 dimensiones. Esa es la firma de normalizar contra el máximo del pool — el propio rework lo describe así |
| **2** | Confianza desde 1 evento | `conf` mínima **0.80** (la curva vieja arranca ahí) y el pool sigue teniendo mínimo **8 eventos** |
| **5** | Techo → Racha | `gencomp.py:33` sigue diciendo `TCH = Techo` |
| **7** | Score a 40–99 | el Score real va de **10.6 a 91.1** — sigue en 0–100 |

Los cambios **3 (MW aborta)**, **4 (Diversidad por puntos)** y **6 (`pts_base`)**
no se pueden verificar desde este repo: viven en `competitivo.py`, que está en
`underraponline-lgtm/liga-global-sync`.

## 🔴 La consecuencia que el documento no menciona

**Si el cambio 7 se aplica, los umbrales de rango se rompen.**

Los umbrales `SSS 82 · SS 73 · S 62 · A 48 · B 37 · C 26 · D 18 · E resto`
están calibrados contra un Score que hoy **arranca en 10.6**. Si el Score
nace en 40:

| rango | umbral | qué pasa con Score 40–99 |
|---|---|---|
| SSS · SS · S · A | 82 · 73 · 62 · 48 | siguen discriminando |
| **B · C · D** | 37 · 26 · 18 | **todos los superan** |
| **E** | resto | **queda vacío** |

⚠️ **Cuatro de los ocho rangos dejarían de existir.** Nadie sería B, C, D ni E
— el peor de la Liga sería A.

Y eso pega directo en las tres cartas:

- **`comun/rangos.py`** tiene **8 figuras** dibujadas y **4 quedarían muertas**
- la paleta de 8 acentos queda reducida a 4
- los **subrangos con signo** (A−, A, A+) hoy viven en A, B, C y D: tres de
  esos cuatro tramos desaparecen
- `rangos.verificar()`, que compara la paleta contra `gencomp`, seguiría
  pasando sin avisar de nada, porque **verifica coherencia, no cobertura**

**Los umbrales hay que recalibrarlos en el mismo pase que el cambio 7.** El
rework ya dice que 1, 2, 3 y 9 van juntos; **los umbrales de rango tienen que
entrar en ese mismo paquete**, y no están en la lista.

⚠️ **PARA QUE NO SE MALINTERPRETE: esto NO es un problema del diseño de las
cartas.** Las ocho figuras, la paleta y la regla de subrangos están bien y no
se tocan. Lo que hay acá es **una omisión del rework**: propone reescalar el
Score sin decir que eso invalida los umbrales que él mismo lista. Si el
cambio 7 se hace bien —recalibrando los umbrales junto con la escala—, la
carta no necesita ni una modificación.
