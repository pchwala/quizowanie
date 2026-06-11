import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { defineCustomElements as defineJeepSqlite } from 'jeep-sqlite/loader';
import App from './App.tsx';

// Web-only SQLite fallback: register the jeep-sqlite wasm web component
// before anything touches local/db.ts (native Android uses the real plugin).
if (Capacitor.getPlatform() === 'web') {
  defineJeepSqlite(window);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
