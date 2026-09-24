# Las cuatro cartas al 16/09/2026

**Esto es un punto de retorno.** Dlx: *«guarda estas versiones actuales que
tenemos y asegurate que sus generadores se guarden también antes de proseguir»*.

---

## Qué guarda cada cosa

| qué | dónde | por qué así |
|---|---|---|
| **los generadores** | el tag `cartas-2026-09-16` | git ya guarda el código exacto; copiarlo acá sería una copia más que se desincroniza |
| **lo que dibujan** | los ocho PNG de esta carpeta | `salida/` está en `.gitignore`, así que el resultado **no** lo guarda nadie más |

⚠️ **Las dos mitades hacen falta.** El tag sin los PNG no dice qué salía; los
PNG sin el tag no dicen con qué. Juntas permiten la única verificación que vale:
volver al tag, regenerar, y comparar **píxel a píxel** contra estos archivos.

---

## Las dos personas no son casuales

| | por qué está |
|---|---|
| **Juasmio** | tiene foto en disco — el caso de **10 de 138** |
| **Bloody** | **no** tiene foto: cae en la inicial, el caso de **128 de 138** |

Y entre los dos cubren tres cosas más que sólo se ven con alguien puesto:
Bloody lleva **crew con logo** (Follombia, 2 de 9) y **tres rombos de evento**;
Juasmio no lleva crew —Sexosos no tiene logo— y lleva uno solo.

---

## Cómo volver

```bash
git checkout cartas-2026-09-16      # los cuatro generadores, exactos
python 01_Temporada/exportar_png.py Juasmio
python 02_Competitivo/exportar_png.py Juasmio
python 03_Servidor/generar.py Juasmio
python 04_Pais/exportar_png.py Juasmio
```

Y para comprobar que volvió de verdad, no alcanza con mirar:

```python
import numpy as np; from PIL import Image
a = np.asarray(Image.open('versiones/2026-09-16/Juasmio_pais.png').convert('RGBA'), dtype=int)
b = np.asarray(Image.open('04_Pais/salida/pais_juasmio.png').convert('RGBA'), dtype=int)
print(a.shape == b.shape, np.abs(a - b).max())   # tiene que dar True 0
```

---

## En qué estado quedaron las cuatro

Lo dice `python herramientas/puedo_generar.py`. Al 16/09/2026:

```
Temporada    138 de 138   ok · el pool entero
Competitivo  138 de 138   ok · el pool entero
Servidor     138 de 138   ok · el pool entero
País         137 de 137   ok · el pool menos 1 sin país
```

⚠️ **Que salga no es que esté completa.** Lo que sale con datos prestados o sin
dato está listado en la segunda mitad de ese informe — cuatro de las seis stats
de País, los cuatro números de la columna de la Servidor, `ESTILO_DE` vacío en
la Competitiva, y **10 fotos de 138** en las cuatro.

⚠️ **Y a la Servidor le falta el marco.** Ver `03_Servidor/disenos/ESTADO.md`:
lo que dibuja `generar.py` es la carta *vigente*, no la terminada.
