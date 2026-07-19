import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');

try {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[Chessforge boot]', err);
  root.innerHTML = `<div style="margin:2rem;font-family:system-ui;color:#e8edd8;max-width:36rem">
    <h1 style="font-size:1.25rem">Не удалось запустить Chessforge</h1>
    <p style="opacity:.85">${message}</p>
  </div>`;
}
