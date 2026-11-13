// 🌐 LAS REDES CON SU ÍCONO DE VERDAD, en blanco (Dlx, a la v6 del perfil: «hacer los íconos más reales… en blanco o en
// colores del tema»). Vivían adentro de perfil.jsx; desde el 13/11/2026 también las usa el pie del Inicio (Dlx: «asegúrate
// que todo tenga su ícono de verdad… de las redes sociales»), así que están acá, en un solo lugar. Una red que no está
// acá sale con su nombre
export const RED_SVG = {
  youtube: <><rect x="1.5" y="5" width="21" height="14" rx="4" fill="currentColor" /><polygon points="10,9 15.5,12 10,15" fill="#030304" /></>,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5.2" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="17.3" cy="6.7" r="1.3" fill="currentColor" /></>,
  tiktok: <path d="M14 3v11a3.4 3.4 0 1 1-2.6-3.3V7.6A6.6 6.6 0 1 0 17.1 14V8.7a7 7 0 0 0 4 1.3V6.9A4.2 4.2 0 0 1 17 3Z" fill="currentColor" />,
  spotify: <><circle cx="12" cy="12" r="10" fill="currentColor" /><path d="M6.5 9.3c3.7-1.1 7.8-.8 11 1M7.2 12.5c3-.8 6.2-.5 8.8.9M7.9 15.5c2.3-.6 4.6-.4 6.6.7" fill="none" stroke="#030304" strokeWidth="1.7" strokeLinecap="round" /></>,
  x: <path d="M3.5 3h4.6l4.1 5.6L17 3h3.2l-6.5 7.5L21 21h-4.6l-4.5-6.1L6.6 21H3.4l7-8.1Z" fill="currentColor" />,
  twitch: <path d="M5 3h16v11l-5 5h-4l-3 3H7v-3H3V7l2-4Zm3 4v7M13 7v7" fill="none" stroke="currentColor" strokeWidth="2" />,
  kick: <path d="M4 3h5v5h2V6h2V4h6v5h-2v2h-2v2h2v2h2v5h-6v-2h-2v-2H9v5H4Z" fill="currentColor" />,
};
RED_SVG.twitter = RED_SVG.x;
// y su nombre, para el `title` y el lector de pantalla (el mismo que `REDES` de servidor.jsx, que no se baja en el Inicio)
export const RED_NOMBRE = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', twitch: 'Twitch', x: 'X', twitter: 'X', kick: 'Kick', spotify: 'Spotify' };
