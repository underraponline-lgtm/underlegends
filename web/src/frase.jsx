// 💬 TU FRASE ENTRE COMILLAS (la tanda 2 del perfil, 27/10/2026): la que sale debajo de tu nombre en tu perfil. Se escribe
// en «Tu cuenta» (Foto y redes) o en los ajustes de tu perfil: el mismo editor en los dos. Hasta 80 caracteres, sin links
// ni @ (`fraseValida()` en bot/avisos.js); cualquiera la puede reportar desde «⋯» y el Dashboard la quita.
import { useEffect, useState } from 'react';
import { FRASE_MAX, errorPerfilTx, guardarPerfilMio, usePerfilExtra } from './perfil_extra.js';

export function FraseEditor({ k }) {
  const ex = usePerfilExtra(k);
  const actual = (ex && ex.fr) || '';
  const [t, setT] = useState(actual);
  const [est, setEst] = useState('');
  const [toco, setToco] = useState(false);
  // lo guardado llega después del primer dibujo: se pone mientras no hayas escrito nada
  useEffect(() => { if (!toco) setT(actual); }, [actual]); // eslint-disable-line react-hooks/exhaustive-deps
  const guardar = (frase) => {
    setEst('va');
    guardarPerfilMio({ frase }).then((j) => {
      if (j.error) { setEst(errorPerfilTx(j.error)); return; }
      setT(j.frase || ''); setToco(false);
      setEst(j.frase ? 'Listo: ya se ve en tu perfil.' : 'Listo: quitaste tu frase.');
    });
  };
  const limpia = t.replace(/\s+/g, ' ').trim();
  const mal = /[<>@]/.test(limpia) || /(https?:|www\.|discord\.gg|\.(com|gg|net|org|ly|io)\b)/i.test(limpia);
  return (
    <div className="fr-ed">
      <div className="fr-ed-c">
        <span aria-hidden="true">«</span>
        <input type="text" value={t} maxLength={FRASE_MAX} placeholder="Una frase que te represente"
          aria-label="Tu frase" onChange={(e) => { setT(e.target.value); setToco(true); setEst(''); }} />
        <span aria-hidden="true">»</span>
      </div>
      <div className="fr-ed-b">
        <small className={mal ? 'mal' : ''}>{mal ? 'Sin links ni @' : limpia.length + ' / ' + FRASE_MAX}</small>
        <button type="button" className="btn verde chico" disabled={est === 'va' || mal || limpia === actual || limpia.length === 1} onClick={() => guardar(limpia)}>Guardar</button>
        {actual ? <button type="button" className="btn borde2 chico" disabled={est === 'va'} onClick={() => guardar('')}>Quitar</button> : null}
      </div>
      {est && est !== 'va' ? <p className="fr-ed-e" role="status">{est}</p> : null}
    </div>
  );
}
