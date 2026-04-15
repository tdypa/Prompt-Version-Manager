import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// #region agent log
function debugLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown> = {}) {
  window.promptManagerApi
    ?.writeDebugLog?.({
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    })
    .catch(() => {});
}

window.addEventListener('error', (event) => {
  debugLog('A', 'src/main.tsx:window:error', 'Renderer window error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  debugLog('A', 'src/main.tsx:window:unhandledrejection', 'Renderer unhandled rejection', {
    reason: event.reason instanceof Error ? event.reason.message : String(event.reason),
  });
});
// #endregion

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
