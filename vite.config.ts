import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [preact(), tailwindcss()],
  resolve: {
    alias: {
      react: '@preact/compat',
      'react-dom': '@preact/compat',
      'react-dom/client': '@preact/compat/client',
      'react/jsx-dev-runtime': '@preact/compat/jsx-dev-runtime',
      'react/jsx-runtime': '@preact/compat/jsx-runtime',
      'react-dom/test-utils': 'preact/test-utils',
      'preact-compat': '@preact/compat',
    },
  },
});
