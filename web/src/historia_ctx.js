// 📖 EL CONTEXTO DE UNA HISTORIA (22/11/2026): si es la que se ve —la que sigue se dibuja escondida, para que sus imágenes
// bajen antes— y cómo pedirle al reloj que espere (un video abierto adentro). Lo pone `Visor` (abajo.jsx) y lo lee
// `PromoVideo` (arriba.jsx)
import { createContext } from 'react';

export const HistoriaCtx = createContext({ activa: false, onFoco: null });
