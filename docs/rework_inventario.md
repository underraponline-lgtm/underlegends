# Inventario del REWORK — qué falta, qué está, qué no puedo saber

Dlx preguntó si sé todo lo que hay que implementar. La respuesta honesta es
**no del todo**, y este documento separa las tres cosas en vez de mezclarlas.

⚠️ **Buena parte del rework vive FUERA de este repo**: `competitivo.py`, el
acumulador y `Code.gs` están en `underraponline-lgtm/liga-global-sync`, y el
bot no existe todavía. Sobre eso **solo puedo repetir lo que el documento
dice**, no verificarlo.

Estados:
**✅ hecho** (comprobado) · **❌ falta** (comprobado) · **❓ no puedo verificar**
· **🔵 decisión abierta**, no es implementación

---

## PARTE A — los 7 cambios a `competitivo.py`

| # | cambio | estado | cómo se comprobó |
|---|---|---|---|
| 1 | Anclas fijas | **❌ falta** | exactamente **1 persona en 100** por dimensión: firma de normalizar contra el máximo del pool |
| 2 | Confianza desde 1 evento | **❌ falta** | `conf` mínima **0.80**, pool con mínimo **8** eventos |
| 3 | MW aborta si falla | **❓** | vive en `competitivo.py`, fuera del repo |
| 4 | Diversidad por puntos | **❌ falta** | necesita 7 columnas de puntos que **no existen** en ningún dato de acá |
| 5 | Techo → Racha | **❌ falta** | `gencomp.py:33` sigue diciendo `TCH = Techo` |
| 6 | Eficiencia lee `pts_base` | **❓** | vive en el procesamiento de eventos |
| 7 | Score a 40–99 | **❌ falta** | el Score real va de **10.6 a 91.1** |
| 7b | Duelos individuales | **❌ falta** | `duel_real` presente en **4 de 138** |
| — | Pesos | **🔵 abierto** | G1, hay que simular antes |

---

## PARTE B — el OVR de Temporada

| qué | estado | cómo |
|---|---|---|
| Fórmula 36/20/16/16/12 | **✅ hecho** | `construir_pool_temporada.py:42` |
| Raíz en PTS, EVT, POD | **✅ hecho** | línea 135-136, las tres con `math.sqrt` |
| Escala 40–99 | **✅ hecho** | línea 137, `40 + … * 59` |
| Umbrales de rango | **✅ hecho** | en `CLAUDE.md`, y aplicados |
| Que el OVR viva en el pipeline | **❌ falta** | se calcula en el builder, no en el pipeline. El propio rework lo marca pendiente |

---

## PARTE C — lo que el rework afecta afuera

| # | qué | estado |
|---|---|---|
| 1 | +7 columnas de **puntos** por server | **❌ falta** — hoy esas columnas son **eventos** |
| 2 | `pts_base` / `pts_final` | **❓** procesamiento de eventos |
| 3 | Registro de duelos | **❌ falta** — 4 de 138 |
| 4 | Archivar Score al cerrar T1 | **❌ falta** — vence al CERRAR T1, no antes |
| 5 | Renombrar Techo → Racha | **❌ falta** |
| 6 | Stats **por servidor y país** | **❌ falta** — solo existe `pos_sv` y `pos_pais`; faltan PTS, EVT, WR%, POD, CAM |
| 7 | Tres Sheets + ID hardcodeado | **❓** `Code.gs`, fuera del repo |
| 8 | Escala del Score en generadores | **❌ falta** — depende del 7 |

⚠️ **Los puntos 1, 2, 3 y 6 vencen el PRIMER EVENTO DE T1.** Después no se
pueden reconstruir: son datos que nunca se guardaron.

---

## PARTE D — el bot

**❌ no existe.** Está la arquitectura decidida en `CLAUDE.bot.md`; no hay
código. Y queda **🔵 abierto** dónde se renderizan los PNG, porque Playwright
no corre en un Worker.

---

## PARTE E — datos e identidad

| # | qué | estado |
|---|---|---|
| E1 | 32 campeones fuera por el piso de 8 | informativo — lo resuelve el cambio 2 |
| E2 | Herencia de estrellas | **✅ hecho** — `estrellas.json` coincide exacto con la tabla, verificado también contra el render |
| E3 | UL marca / DRA servidor | **✅ hecho** — está escrito en `estrellas.json` |
| E4 | Konan TWR vs EFA | **🔵 abierto** (G9) |
| E5 | Ragna = Ragnar | **❓** el merge vive en el procesamiento |
| E6 | Rebranding UL→DRAP | **🔵** futuro |
| E7 | Jerarquía de eventos | **✅ parcial** — `eventos.json` existe; faltan las llaves de Snake, TWR y Fontana |

---

## PARTE F — trampas y seguridad

| qué | estado |
|---|---|
| Columna `Sv` vacía → argmax | **✅ hecho** |
| Columna 🔥 como texto | **✅ hecho** |
| `KeyError` de `LOGO` | **✅ hecho** — `comun/escudos.py`. **El rework está desactualizado acá** |
| Scopes `readonly` | **✅ hecho** |
| Avatares | **❌ peor de lo que dice** — no faltan, **se mueren**: 11 de 20 dieron 404 |
| Rotar `creds.json` | **❌ falta** — Dlx decidió posponerlo |

---

## PARTE G — las 9 decisiones abiertas

Ninguna es implementación: son cosas a decidir. G1 pesos · G2 ancla de racha ·
G3 techo del Score · G4 rango histórico o activo · G5 color de Servidor y País
· G6 concepto de País · G7 dónde vive el OVR · G8 dónde se renderiza · G9 el
servidor de Konan.

---

## ⚠️ Lo que este inventario NO cubre

- **`competitivo.py` entero.** Los cambios 3 y 6 y buena parte de la Parte C.
- **El acumulador y `Code.gs`.**
- **Si el rework tiene decisiones que quedaron obsoletas** por algo decidido
  después en otro chat. El documento dice que revisó tres transcripts
  completos, pero **eso no lo puedo verificar desde acá.**
