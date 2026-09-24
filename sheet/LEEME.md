# sheet/ — el puente con el Google Sheet

Estos tres scripts son los que refrescan los datos. **Sin ellos los pools son
fotos estáticas** y `creds.json` no lo usa nadie.

```bash
python sheet/explorar_sheet.py               # ver hojas y cabeceras
python sheet/construir_pool_temporada.py     # -> datos/temporada_pool.json
python sheet/construir_pool_competitivo.py   # -> datos/competitivo_pool.json
```

En Linux o Mac el comando es `python3`. En Windows es `python`: ahí `python3`
es el stub de la Microsoft Store y no ejecuta nada.

Los tres piden **solo lectura** (`spreadsheets.readonly`). Leen el Sheet y
escriben JSON local; ninguno modifica la planilla.

El orden importa: el competitivo le pide prestados al de temporada el Win%, la
racha y los avatares.

Necesitan `creds.json` en la raíz del proyecto. **No va al repo.**

## Lo que NO hacen

**No traen los avatares.** No están en el Sheet. Los rescatan del JSON anterior,
así que si una URL caducó, sigue caducada. Hoy 118 de 138 no tienen avatar y 6
de los 20 que hay están rotos. El arreglo de fondo es traerlos de Discord al
generar, y eso vive en `sync.py`, que está en otro repo.

**No traen los duelos.** Tampoco están en el Sheet: viven en el acumulador. Se
rescatan del JSON anterior; hoy son reales en 4 personas.

**No tocan `eventos.json`.** Las llaves de los eventos insignia se cargan a mano
porque no salen de ninguna hoja.

## Antes de correrlos

Si el Sheet cambió de columnas, los pools van a salir mal **sin avisar**. Por eso
está `explorar_sheet.py`: corrélo primero y comparé las cabeceras con las que
esperan los scripts.

Las cabeceras que asumen hoy:

| hoja | fila |
|---|---|
| Ranking Temporada | 16 |
| Ranking Competitivo | 12 |
| Ranking Podios | 11 |
| Ranking de Ligas | 9 |
