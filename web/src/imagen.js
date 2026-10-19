// 🖼️ ACHICAR UNA IMAGEN ANTES DE MANDARLA: el fondo, la foto de tarjeta y el logo de una crew. Se mudó de cuenta.jsx el
// 19/10/2026, cuando el logo de las crews la necesitó también (y crewpanel.jsx no puede importar cuenta.jsx, que lo importa)

/**
 * Recorta al centro a `AN`×`AL` («cover») y la pasa a webp por debajo de `TOPE` bytes; sin webp (Safari viejo), jpeg.
 * 🛡️ El canvas no copia los metadatos: la ubicación de una foto del celular no viaja (ver `tieneMetadatos()` en avisos.js).
 */
export async function achicar(archivo, AN, AL, TOPE) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
    const c = document.createElement('canvas');
    c.width = AN; c.height = AL;
    const x = c.getContext('2d');
    // «cover»: llena el cuadro y recorta lo que sobra, al centro
    const e = Math.max(AN / img.naturalWidth, AL / img.naturalHeight);
    const w = img.naturalWidth * e, h = img.naturalHeight * e;
    x.drawImage(img, (AN - w) / 2, (AL - h) / 2, w, h);
    for (const q of [0.82, 0.7, 0.58, 0.45]) {
      const b = await new Promise((ok) => c.toBlob(ok, 'image/webp', q));
      if (b && b.size <= TOPE && b.type === 'image/webp') return b;
    }
    // sin webp (Safari viejo): jpeg
    const j = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.7));
    if (j && j.size <= TOPE) return j;
    throw new Error('la imagen quedó muy pesada');
  } finally { URL.revokeObjectURL(url); }
}

export const aBase64 = (b) => new Promise((ok, mal) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1] || '');
  r.onerror = mal;
  r.readAsDataURL(b);
});
