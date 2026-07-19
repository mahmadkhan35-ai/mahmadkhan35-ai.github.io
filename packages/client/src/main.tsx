import { startApp } from './bootstrapApp';

const root = document.getElementById('root');

function show(msg: string): void {
  console.info('[chessforge]', msg);
  if (root) root.textContent = msg;
}

show('Запуск…');

try {
  startApp();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[chessforge]', err);
  if (root) {
    root.innerHTML = `<div style="margin:2rem;font-family:system-ui;color:#e8edd8;max-width:36rem">
      <h1 style="font-size:1.25rem">Ошибка запуска</h1>
      <p style="opacity:.85">${message}</p>
    </div>`;
  }
}
