// 🖼️ LA CARTA SOLA, CON SU MARCO (#/marco/<clave>/<carta>/<servidor>/<país>, 26/10/2026). Dlx: «pon la decoración en
// mi tarjeta». El marco se dibuja en la página (`ConMarco`, marcos.jsx), así que para meterlo en la IMAGEN —la de /card
// y la descarga— `bot/con_marco.py` abre esta ruta con Chromium, le saca una foto con fondo transparente y la sube como
// `<clave>/<carta>-m.webp`. Es la MISMA pieza que se ve en el perfil: lo que se elige y lo que sale en Discord no pueden
// ser dos dibujos distintos. Sin cabecera, sin menú y sin nada alrededor; `data-listo` le dice al fotógrafo cuándo.
import { useState } from 'react';
import { ConMarco } from './marcos.jsx';
import { usePases } from './pase.js';

export function MarcoSolo({ liga, k, cual, sv, cc }) {
  const pub = usePases();
  const [ok, setOk] = useState(false);
  const [t] = useState(() => Date.now().toString(36));
  const mk = pub && pub.m ? pub.m[k] || null : undefined;
  const svc = sv && liga.svs && liga.svs[sv] ? liga.svs[sv].color : '';
  // la carta recién subida, sin la copia del navegador
  const src = liga.d.r2 + '/' + k + '/' + cual + '.webp?m=' + t;
  const img = <img className="ms-img" src={src} alt="" onLoad={() => setOk(true)} />;
  return (
    <div className="ms" data-listo={ok && mk !== undefined ? '1' : ''} data-marco={mk ? '1' : '0'}>
      {mk ? <ConMarco m={mk} cual={cual} ancho={300} svColor={svc} cc={cc} src={src}>{img}</ConMarco> : img}
    </div>
  );
}
