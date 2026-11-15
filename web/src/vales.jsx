// 🏆 EL PASE PREMIUM DE LOS CAMPEONES DE LIGA (Dlx, 15/11/2026: «los campeones de liga reciben una temporada de 1 pase
// premium, que lo pueden usar en su inventario, ya sea para esta o para cualquier temporada que deseen»). Uno por título
// (lo da el ciclo desde el Salón de campeones: `pase.vales_campeones()`), guardado en el Inventario hasta que lo usas.
// Usarlo lo prende en la temporada que corre (`valeUsar()` en bot/avisos.js): si esta temporada ya tienes el premium, o
// prefieres otra, lo guardas. Sin ninguno, esta pieza no se dibuja.
import { useEffect, useState } from 'react';
import { pasePost, refrescarPases } from './pase.js';
import { Ico } from './piezas.jsx';

const temporadaDe = (t) => (/^t\d+$/i.test(t || '') ? 'la ' + String(t).toUpperCase() : 'esta temporada');

const ERROR = {
  ya_premium: 'Ya tienes el premium esta temporada: guárdalo para la que viene.',
  no_miembro: 'El Pase es de los miembros de DRA: verifícate y vuelve a usarlo.',
  usado: 'Ese Pase ya se usó.',
  no_es_tuyo: 'Ese Pase es de otro perfil.',
  sin_temporada: 'El Pase de esta temporada todavía no arrancó: guárdalo un rato.',
};

export function ValesPremium() {
  const [d, setD] = useState(null);
  const [ocup, setOcup] = useState('');
  const [preg, setPreg] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let vivo = true;
    pasePost('vales', {}).then((r) => { if (vivo && r && r._ok) setD(r); });
    return () => { vivo = false; };
  }, []);
  const vales = (d && d.vales) || [];
  if (!vales.length) return null;
  const libres = vales.filter((v) => !v.usado);
  const usar = async (id) => {
    setOcup(id); setMsg(''); setPreg('');
    const r = await pasePost('vale-usar', { vale: id });
    if (r && r._ok) {
      setD(r);
      refrescarPases();
      setMsg('Listo: el premium está prendido ' + (r.temp ? 'en ' + temporadaDe(r.temp) : 'esta temporada') +
        (r.nivel ? ' y ya cobraste lo de tus ' + r.nivel + ' niveles de la fila premium.' : '.'));
    } else {
      setMsg(ERROR[r && r.error] || 'No se pudo usar. Prueba de nuevo.');
    }
    setOcup('');
  };
  const tmp = temporadaDe(d.temp);
  return (
    <section className="vp" aria-label="Tus Pases premium de campeón">
      <div className="vp-cab">
        <span className="vp-ic" aria-hidden="true"><Ico n="pase" t={24} /></span>
        <div>
          <i className="vp-et">Premio de campeón</i>
          <h3>{libres.length ? (libres.length === 1 ? 'Tienes una temporada de Pase premium' : 'Tienes ' + libres.length + ' temporadas de Pase premium')
            : 'Tus Pases premium de campeón'}</h3>
          <small>Úsalo cuando quieras: en {tmp} o guárdalo para la temporada que elijas.</small>
        </div>
      </div>
      <ul className="vp-l">
        {vales.map((v) => (
          <li key={v.id} className={v.usado ? 'usado' : ''}>
            <span className="vp-tr" aria-hidden="true"><Ico n="copa" t={18} /></span>
            <span className="vp-tx"><b>{v.m || 'Campeón de liga'}</b>
              <small>{v.usado ? 'Usado en ' + temporadaDe(v.usado) : d.premium ? 'Guardado: esta temporada ya tienes el premium'
                : 'Sin usar · vale una temporada entera'}</small></span>
            {!v.usado && !d.premium ? (
              preg === v.id ? (
                <span className="vp-ok">
                  <button type="button" className="btn verde chico" disabled={!!ocup} onClick={() => usar(v.id)}>{ocup === v.id ? '…' : 'Sí, usarlo'}</button>
                  <button type="button" className="btn borde2 chico" disabled={!!ocup} onClick={() => setPreg('')}>Guardarlo</button>
                </span>
              ) : (
                <button type="button" className="btn verde chico" disabled={!!ocup} onClick={() => { setPreg(v.id); setMsg(''); }}>
                  Usar en {tmp}
                </button>
              )
            ) : null}
          </li>
        ))}
      </ul>
      {preg ? <p className="vp-nota">Al usarlo, el premium queda prendido hasta que termine {tmp} y no se puede pasar a otra. Si prefieres otra temporada, guárdalo.</p> : null}
      {!d.miembro && libres.length ? <p className="vp-nota">El Pase es de los miembros de Discord Rap Español: verifícate para poder usarlo. Mientras tanto, queda guardado.</p> : null}
      {msg ? <p className="vp-msg" role="status">{msg}</p> : null}
    </section>
  );
}
