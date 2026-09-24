# Dejá acá los PNG de referencia de la carta de País

Uno por archivo, con nombre claro. Los que Dlx mencionó:

```
pais1.png   la dorada de Cristiano
pais2.png   la dorada en blanco ("TU NOMBRE")
pais3.png   la plantilla amarilla   <- la que él dice que es distinta
pais4.png   la de Champions
```

Después:

```bash
python 04_Pais/comparar_siluetas.py
```

⚠️ **Sirve cualquier PNG, pero no cualquiera igual de bien.** El trazador
saca la máscara de dos formas y una es mucho más confiable:

- **con alfa** (fondo transparente) → usa el canal alfa. Es el caso bueno.
- **sin alfa** → toma el color de las cuatro esquinas, verifica que coincidan
  y descarta lo parecido. Si las esquinas **no** coinciden entre sí, frena:
  el fondo no es plano y recortar por color se comería pedazos de la carta.

O sea que **la de Champions es la más útil de las cuatro** — viene sobre
transparente. Las doradas sobre blanco también sirven; una captura con
degradé de fondo, no.

⚠️ **Y una captura recortada al ras del contorno sirve mejor que una con
márgenes raros**, porque la proporción sale de la caja de tinta.

---

Esta carpeta no lleva los archivos en el repo: son material de referencia de
terceros. Está en `.gitignore`.
