import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/theme.css';
import { initProviders } from './app/providers';

initProviders().then(() => {
  const el = document.getElementById('root');
  if (!el) throw new Error('#root not found');
  createRoot(el).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
