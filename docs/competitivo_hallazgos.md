# `competitivo.py` y `Code.gs` — verificado sobre el código real

Dlx pasó los dos archivos. Esto cierra lo que el inventario marcaba como
«no puedo verificar».

---

## Los 7 cambios de la Parte A: **ninguno está hecho**

| # | cambio | la línea que lo prueba |
|---|---|---|
| 1 | Anclas fijas | `mE=max(v[0] for v in D.values())` — sigue el máximo del pool |
| 2 | Confianza desde 1 ev | `conf=round(0.80+0.20*min((ev-8)/12,1),2)` y `Q=[r for r in R if num(r['ev'])>=8]` |
| 3 | MW aborta | `except FileNotFoundError: … return {}` — **avisa y sigue**, exactamente lo que el rework describe |
| 4 | Diversidad por puntos | `c=[num(r.get(s)) for s in SRV …]` — usa las columnas, que son eventos |
| 5 | Techo → Racha | la variable es `tec` y el líder dice `🔥 Mejor techo` |
| 6 | `pts_base` | `eff=(num(r['puntos'])-MW…)/ev` — lee `puntos` |
| 7 | Score 40–99 | `raw=0.30*E+…` y `score=raw*conf` — sigue en 0–100 |
| — | Pesos | `0.30 · 0.24 · 0.21 · 0.15 · 0.10` — los viejos |

**Coincide exactamente con lo que había medido desde los datos**, sin ver el
código. Las dos verificaciones son independientes.

---

## ✅ HALLAZGO 1 — CORREGIDO: el bug era nuestro, y ya está arreglado

Había marcado como sospechoso que `competitivo.py` conservara el servidor
anterior en vez de recalcularlo:

```python
def sv(r):
    if k in SV_VIEJO: return SV_VIEJO[k]   # ← se queda con el valor ANTERIOR
```

**Eso es correcto y a propósito.** Dlx lo explicó: *«Konan decidió ser de TWR;
elección manual supera a la del bot»*. Ese `SV_VIEJO` **preserva las
elecciones manuales**, y sin él se perderían en cada corrida.

**El que estaba mal era `construir_pool_temporada.py`, en este repo:**

```python
sv = argmax(...) if hay_eventos else columna_Sv    # el argmax PISABA la elección
```

Hacía exactamente lo contrario. Medido: **10 de 138 salían con distinto
servidor** según qué pool se leyera, Konan entre ellos —TWR elegido, TFC por
argmax—. Y como la carta de **Temporada** dibuja el escudo del servidor,
**a esos 10 les ponía el equivocado**.

**Arreglado**: ahora lee el `Sv` de la hoja `Ranking Competitivo`, que es donde
vive la elección manual, y solo cae al argmax si no hay nada.

```
antes   DIFIEREN 10 de 138   ·   Konan en temporada = TFC
ahora   DIFIEREN  0 de 138   ·   Konan en temporada = TWR
```

⚠️ **Se lee la HOJA y no `datos/competitivo_pool.json`, a propósito**: el pool
competitivo se construye **después** que el de temporada —le pide el Win%, la
racha y los avatares— así que depender de su JSON sería un ciclo. Las dos
hojas viven en el mismo Sheet: es una llamada más y ninguna dependencia nueva.

### 🔴 Y al arreglarlo salió otro, más grave: refrescar el pool ROMPÍA la carta

Al regenerar el pool de temporada, `01_Temporada` reventó con
`KeyError: 'score'`.

**El pool commiteado tenía un campo `score` que NINGÚN script del repo
generaba.** Estaba ahí de una versión anterior. Al regenerar, desaparecía — y
`normal_v3.py:101` lo necesita para la letra del rango.

⚠️ **O sea que refrescar el pool rompía la carta de Temporada, y nadie lo
sabía.** Se habría descubierto **al refrescar para T1**, que es exactamente
cuando hay menos margen.

Es la misma clase de trampa que `CLAUDE.md` ya tenía anotada —«refrescar no
cambiaba nada y no avisaba»—, pero al revés: acá refrescar **sí** cambia, y lo
que cambia es que deja de funcionar.

**Arreglado en la misma lectura**: el Score vive en la hoja `Ranking
Competitivo`, la misma que ahora se lee para el `Sv`, así que sale sin una
llamada extra. Verificado: **138 de 138 con score**, y la carta se genera.

**Y esto responde G9 del rework** —«¿de qué servidor es Konan?»—: **TWR**,
porque lo eligió. No había contradicción de datos; había un builder que
ignoraba la elección.

---

## ⚠️ HALLAZGO 2 — los scopes, con una salvedad de Dlx

```python
sc=['…/auth/spreadsheets','…/auth/drive']
```

`competitivo.py` conserva escritura completa y acceso a todo el Drive, mientras
el repo de tarjetas ya usa `spreadsheets.readonly`.

⚠️ **Pero esto no es necesariamente lo que corre hoy.** Dlx aclaró que el Sheet
y su pipeline **no se tocan desde la última actualización del ranking**, porque
el trabajo está puesto en el rework para T1. O sea que este archivo puede ser
de antes de que los scopes se redujeran.

Lo que sí queda para cuando se retome: **la escritura la necesita** —el script
escribe—, pero **`drive` no**, porque solo abre archivos por ID y nunca por
búsqueda.

---

## ⚠️ HALLAZGO 3 — el bug que arreglaron sigue vivo en otros dos archivos

El propio código cuenta que `MW_pts.json` vivía en `/home/claude/` y **se
perdía entre sesiones**, y que por eso lo movieron a la hoja.

Pero quedaron dos con el mismo problema:

```python
R = json.load(open('/home/claude/WRITE.json'))['ranking']
SVDEC = json.load(open('/home/claude/SV.json'))
```

⚠️ **`WRITE.json` es el ranking entero** — la entrada principal del script. Si
falta, `competitivo.py` no arranca. Es más crítico que el que ya arreglaron, y
tiene exactamente la misma fragilidad.

---

## ⚠️ HALLAZGO 4 — `Code.gs` tiene DOS IDs quemados, no uno

```js
SpreadsheetApp.openById('1sDo89…')   // el Oficial
SpreadsheetApp.openById('1DFar2NS…') // el Operativo
```

El rework avisa de la trampa de los tres Sheets **mencionando un solo ID**. Al
copiar hay que revisar los dos, y el segundo apunta a un Sheet distinto que
quizás no se copie.

---

## Nota menor

`computeEntropy()` está definida al final de `Code.gs` y **no aparece llamada
en ningún lado** del código que se pasó. La diversidad se lee ya calculada de
la hoja del Competitivo. Probablemente sea código muerto de cuando la web app
la calculaba sola.
