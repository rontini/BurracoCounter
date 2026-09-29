import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root mancante');

// Errori fuori da React (per esempio all'avvio): li mostro nella pagina.
function showFatal(message: string) {
  if (root!.dataset.fatal) return;
  root!.dataset.fatal = '1';
  const box = document.createElement('pre');
  box.className = 'error-detail';
  box.textContent = `Errore all'avvio di BurraCount:\n${message}\n\n${navigator.userAgent}`;
  document.body.prepend(box);
}
window.addEventListener('error', (e) => showFatal(e.message || String(e.error)));
window.addEventListener('unhandledrejection', (e) => showFatal(String(e.reason)));

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
