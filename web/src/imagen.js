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
    // 🔎 cuánto medía la imagen de verdad, para avisar si es más chica de lo que se va a mostrar (Dlx, 12/11/2026: «el fondo
    // no se ve en HD»)
    const origen = { w: img.naturalWidth, h: img.naturalHeight };
    // 📏 si a ese tamaño no entra en el tope ni con la calidad más baja (una foto con mucho grano), se prueba más chica: el
    // 83 % y el 67 %. Medido: un fondo dibujado de 2400×960 pesa 246 KB a 0.92; ruido puro no entra ni a 0.5 (887 KB)
    for (const f of [1, 0.83, 0.67]) {
      const w0 = Math.round(AN * f), h0 = Math.round(AL * f);
      const c = document.createElement('canvas');
      c.width = w0; c.height = h0;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = true;
      x.imageSmoothingQuality = 'high';
      // «cover»: llena el cuadro y recorta lo que sobra, al centro
      const e = Math.max(w0 / img.naturalWidth, h0 / img.naturalHeight);
      const w = img.naturalWidth * e, h = img.naturalHeight * e;
      x.drawImage(img, (w0 - w) / 2, (h0 - h) / 2, w, h);
      // la calidad más alta que entre en el tope: arrancaba en 0.82, y un fondo quedaba en 97 KB con un tope de 600
      for (const q of [0.92, 0.86, 0.8, 0.72, 0.62, 0.5]) {
        const b = await new Promise((ok) => c.toBlob(ok, 'image/webp', q));
        if (b && b.size <= TOPE && b.type === 'image/webp') { b.origen = origen; return b; }
        if (b && b.type !== 'image/webp') break;
      }
      // sin webp (Safari viejo): jpeg
      for (const q of [0.88, 0.78, 0.68]) {
        const jp = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', q));
        if (jp && jp.size <= TOPE) { jp.origen = origen; return jp; }
      }
    }
    throw new Error('la imagen quedó muy pesada');
  } finally { URL.revokeObjectURL(url); }
}

export const aBase64 = (b) => new Promise((ok, mal) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1] || '');
  r.onerror = mal;
  r.readAsDataURL(b);
});
