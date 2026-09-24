# Qué información necesita cada tarjeta

Medido el **20/09/2026** con `herramientas/que_pide_cada_carta.py`, que no
lee el código: envuelve cada entrada del pool en un dict que **anota quién
le pide qué**, y dibuja las cuatro cartas de verdad sobre 50 personas.

⚠️ **Se corre sobre las 25 de arriba y las 25 de abajo del pool**, no sobre
una. Konan tiene crew, país, títulos y racha; quien no tenga algo hace que
su rama no se ejecute y ese campo no aparece. Con una persona la lista sale
corta y parece completa.

```bash
python herramientas/que_pide_cada_carta.py
```

---

## Los 34 campos, y quién los pide

**● obligatoria** — se pide con `p[campo]`: si falta, **la carta revienta**.
**○ opcional** — se pide con `.get()`: si falta, **sale una carta peor y
nadie se entera**. Ésa es la columna que hay que mirar al rediseñar el
Sheet.

| campo | Temporada | Competitiva | Servidor | País |
|---|---|---|---|---|
| `raw` | ● | ● | ● | ● |
| `cc` | ● | ● | ● | ● |
| `sv` | ● | ● | ● | ● |
| `ev` | ● | ● | ● | ● |
| `score` | ● | ● | ● | ● |
| `duel_t` | | ● | ● | ● |
| `duel_v` | | ● | ● | ● |
| `rango` | | | ● | ● |
| `av` | ● | ○ | ○ | ○ |
| `pts` | ● | | | |
| `oro` | ● | | ○ | ○ |
| `pod` | ● | | ○ | ○ |
| `ovr` | ● | | ○ | |
| `racha` | ● | | | |
| `srv` | ● | | | |
| `sem` | ○ | | | ○ |
| `caz` · `czd` · `sob` | ○ | | | |
| `pos` | ○ | ● | | |
| `wr` | | ● | | ○ |
| `total` | | ● | | |
| `E`·`C`·`Dm`·`T`·`V` | | ● | | |
| `rch_act` · `rch_max` | | ● | ○ | ○ |
| `duel_real` | | | ○ | ○ |
| `pos_pais` · `pos_sv` | | ○ | ○ | ○ |
| `arc_pais` · `arc_sv` | | ○ | | |

```
Temporada    12 obligatorias ·  5 opcionales
Competitiva  17 obligatorias ·  5 opcionales
Servidor      8 obligatorias ·  9 opcionales
País          8 obligatorias ·  9 opcionales
```

🔴 **Siete campos los piden las cuatro y ninguno puede faltar:**
`raw` · `cc` · `sv` · `ev` · `score` · `duel_t` · `duel_v`.

⚠️ **Y dos de esos siete no están en el Sheet** — ver abajo.

---

## De dónde sale cada uno HOY

### Del Sheet, directo

| campo | columna |
|---|---|
| `raw` | `Rapero`, limpiando la bandera y el `❓` |
| `ev` | `Ev` |
| `pts` | `Puntos` |
| `wr` | `Win%` |
| `oro` · `seg` · `ter` | `🥇` · `🥈` · `🥉` |
| `sem` · `caz` · `czd` · `sob` | `🎖️` · `🎯` · `💀` · `🛡️` |
| `score` · `conf` | `Score` · `Confianza` |
| `E`·`C`·`Dm`·`T`·`V` | `⚡ Eficiencia` · `🎯 Consistencia` · `👑 Dominancia` · `🔥 Techo` · `🌍 Diversidad` |
| `pos` | `#` |

### Derivados en el pipeline

| campo | cómo |
|---|---|
| `cc` | 🔴 **del emoji de bandera pegado al nombre** |
| `sv` | argmax de las 7 columnas por servidor |
| `srv` | cuántas de esas 7 son > 0 |
| `pod` | `🥇 + 🥈 + 🥉` |
| `racha` · `rch_act` · `rch_max` | partiendo el texto `actual/máxima` de `🔥` |
| `rango` | de `score`, con `comun/rangos.py` |
| `ovr` | calculado |
| `pos_pais` · `pos_sv` · `arc_pais` · `arc_sv` | ordenando el pool |
| `total` | cuántas filas hay |
| `crew` | **no sale del Sheet**: vive en `comun/crews.py` |

### 🔴 Los que NO están en el Sheet

| campo | hoy | quién lo pide |
|---|---|---|
| **`duel_t` · `duel_v`** | se rescatan **del JSON anterior**, o sea de sí mismos | **tres cartas, obligatorio** |
| `duel_real` | idem | Servidor · País |
| **`av`** | idem — y el hash caduca | Temporada, obligatorio |

⚠️ **`construir_pool_competitivo.py` los saca del pool anterior**, no de una
fuente. Cada rebuild arrastra lo mismo, así que **sólo pueden empeorar**.
La foto ya se resolvió por afuera (`bot/fotos.py` + R2); **los duelos no**.

---

## 🔴 Lo que le falta al Sheet, en orden de lo que más destraba

### 1 · Los duelos — tres cartas los piden y no hay fuente

`duel_t` y `duel_v` son **obligatorios en tres de las cuatro cartas** y hoy
son reales en **4 de 138**. El resto muestra `0/0`.

El Operativo **ya tiene la hoja**: `1v1`, con
`Evento # · Fecha · Servidor · Ronda · Rapero A · Rapero B · Ganador ·
Perdedor · Notas`. **Está vacía.** Llenarla desde `procesarEvento`
resuelve los duelos de las tres cartas de una.

⚠️ **Y con el país del rival salen DNA y DIN**, las dos que siguen en 0 en
la carta País. El país ya está en `Lista de Raperos`, así que no hace falta
una columna nueva: se cruza.

### 2 · `pais` en su propia columna

`cc` lo piden las cuatro, y hoy sale de **detectar el emoji de bandera
adentro del nombre**. Funciona hasta que alguien escriba el nombre sin la
bandera, o con dos.

⚠️ **`Lista de Raperos` del Operativo ya tiene la columna `Bandera`, con el
100 % de las 875 filas llenas.** O sea que el dato limpio existe y el
pipeline lo sigue sacando del nombre.

### 3 · `discord_id` como clave, en vez del nombre

Hoy el pool se indexa por nombre normalizado. `Lista de Raperos` tiene
**503 con ID** y el bot usa 443. Con dos personas de nombre parecido en
ocho servidores, el nombre **colisiona en silencio**.

### 4 · La racha, como número

`🔥` guarda el texto `actual/máxima`. Si alguien lo lee como número, **todos
los TAG de racha desaparecen** — ya está documentado como trampa. Dos
columnas lo cierran.

### 5 · Las 7 por servidor, también en puntos

Hoy las 7 columnas traen **eventos**, y de ahí sale `sv` y `srv`. Con los
puntos por servidor, la **Diversidad** puede medir *dónde ganaste* y no
sólo dónde jugaste.

---

## Lo que ya no hace falta pedirle al Sheet

| | por qué |
|---|---|
| ~~`SEG` y `TER`~~ | ✅ **20/09/2026**: estaban en `🥈`/`🥉`, el builder los leía y los tiraba. Ver el commit |
| ~~la foto~~ | ✅ congelada en R2 por temporada, `bot/fotos.py` |
| ~~el desglose de podios~~ | sale de los tres emoji |
| `crew` | vive en `comun/crews.py` y las cuatro cartas la sacan de ahí |

---

## El orden que sale de esto

1. **Llenar `1v1` y `Resultados`** desde `procesarEvento` — destraba los
   duelos (3 cartas) y, cruzando con el país, `DNA`/`DIN`.
2. **`pais` y `discord_id`** como columnas de primera clase.
3. **La racha en dos columnas** y **los puntos por servidor**.

⚠️ Los tres son del **Operativo**, no del Oficial. El Oficial es la vitrina
y se calcula desde el otro.
