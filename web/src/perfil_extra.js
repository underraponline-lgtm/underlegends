// 👤 LA TANDA 2 DEL PERFIL (27/10/2026): lo que cada uno pone en su perfil y lo que hace en la página. Lo guarda el
// objeto (`perfilMio()` y `perfilExtra()` en bot/avisos.js) y llega por clave de perfil, nunca por cuenta:
// · `fr` su frase entre comillas y `em` los emblemas que eligió para que se vean al lado de su nombre;
// · `dra` su rol de DRA (Freestyler, Rapero…), el que eligió al entrar;
// · `apl` las felicitaciones que recibió y `voz` los meses que votó en los MES AWARDS (dos emblemas que no tenían dato);
// · `act` lo que hizo en la página los últimos 14 días, para «Lo último»: sólo cuántos, nunca a quién ni qué.
// Un pedido por perfil y por minuto; lo tuyo se vuelve a pedir al guardarlo (`lg:perfil-extra`).
import { useEffect, useState } from 'react';

const memo = new Map();
const MEMO_MS = 60000;

function pedir(k) {
  const m = memo.get(k);
  if (m && (m.p || Date.now() - m.t < MEMO_MS)) return m.p || Promise.resolve(m.d);
  const p = fetch('/api/avisos/perfil-extra', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ k }) })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    .then((d) => { memo.set(k, { t: Date.now(), d, p: null }); return d; });
  memo.set(k, { t: 0, d: m ? m.d : null, p });
  return p;
}

export function usePerfilExtra(k) {
  const [d, setD] = useState(() => (memo.get(k) || {}).d || null);
  useEffect(() => {
    let vivo = true;
    setD((memo.get(k) || {}).d || null);
    const traer = () => { if (k) pedir(k).then((x) => { if (vivo) setD(x); }); };
    traer();
    const f = (e) => { if (!e.detail || e.detail === k) { memo.delete(k); traer(); } };
    window.addEventListener('lg:perfil-extra', f);
    return () => { vivo = false; window.removeEventListener('lg:perfil-extra', f); };
  }, [k]);
  return d;
}

/**
 * Guardar tu frase (`frase`) o tus emblemas a la vista (`emb`), con tu cuenta. Devuelve `{ok, frase, emb}` o
 * `{error}`: `sin_verificar`, `frase` (no vale), `tope` (muchos cambios hoy), `sin_sesion` o `red`.
 */
export function guardarPerfilMio(cuerpo) {
  if (typeof window.conCuenta !== 'function') return Promise.resolve({ error: 'sin_sesion' });
  return window.conCuenta('/api/avisos/perfil-mio', cuerpo || {}).then((j) => {
    if (!j) return { error: 'sin_sesion' };
    if (j.status !== 200) return { error: j.error || 'mal' };
    memo.delete(j.k);
    window.dispatchEvent(new CustomEvent('lg:perfil-extra', { detail: j.k }));
    return j;
  }).catch(() => ({ error: 'red' }));
}

export const FRASE_MAX = 80;
export const errorPerfilTx = (e) => (e === 'sin_verificar' ? 'Para esto tienes que estar verificado.'
  : e === 'frase' ? 'Esa frase no vale: hasta 80 caracteres, sin links ni @.'
    : e === 'tope' ? 'Ya la cambiaste varias veces hoy: prueba mañana.'
      : e === 'sin_sesion' || e === 'discord' ? 'Entra con Discord para cambiarlo.'
        : e === 'red' ? 'Sin conexión: prueba de nuevo.' : 'No pude guardarlo. Prueba de nuevo en un rato.');
