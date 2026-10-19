// 🔎 ESLINT PARA LA PÁGINA (Dlx, 19/10/2026: «dale», a «¿lo bajo para CI?»). Existe por Publicaciones: un
// `export { useAplausos } from './aplausos.js'` NO define `useAplausos` adentro del archivo, vite lo construyó sin
// avisar y la página se rompió en producción al abrir. `herramientas/web_nombres.py` tapó ese caso con expresiones
// regulares; esto lo mira con el árbol de verdad, y también lo que las expresiones no ven.
//
// ⚠️ SÓLO LO QUE ROMPE: un nombre sin definir, un hook fuera de lugar, una clave repetida, código que no se alcanza.
// Lo de estilo (variables sin usar, dependencias de los efectos) queda afuera a propósito: CI se pone rojo por lo que
// tumba la página, no por gustos. `npx eslint src` en web/.
import js from '@eslint/js';
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', '**/*.cjs'] },
  {
    files: ['src/**/*.{js,jsx}', '*.js'],
    // los `eslint-disable` de reglas que acá están apagadas (las dependencias de los efectos) no son un problema
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: { react, 'react-hooks': hooks },
    settings: { react: { version: '18.3' } },
    rules: {
      ...js.configs.recommended.rules,
      // los componentes que se usan en JSX cuentan como usados, y uno sin importar es un error (el caso de Publicaciones)
      'react/jsx-uses-vars': 'error',
      'react/jsx-no-undef': 'error',
      'react/jsx-key': 'error',
      'react/no-danger-with-children': 'error',
      'react-hooks/rules-of-hooks': 'error',
      // (el código ya los nombra en sus `eslint-disable`: se quedan apagados, que no son errores)
      'react-hooks/exhaustive-deps': 'off',
      'no-unused-vars': 'off',
      'no-empty': 'off',
    },
  },
];
