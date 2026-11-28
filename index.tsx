import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { captureAuthRedirect } from './services/supabase';

// Si se llegó desde el enlace del correo de contraseña, se atiende antes de abrir la app
captureAuthRedirect();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);