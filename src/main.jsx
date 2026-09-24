import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles/main.css'
import { preloadAppData } from './utils/preloadAppData'
// Data is loaded from local msgpack/JSON. No remote DB on startup.
console.log('[App] 🚀 Starting application initialization...');
const appStartTime = performance.now();
Promise.resolve().then(() => {
  const appInitTime = performance.now() - appStartTime;
  console.log(`[App] ⚡ Application ready (init time: ${appInitTime.toFixed(2)}ms)`);
});

// After a deploy, an already-open tab (or a cached index.html) may ask for chunks that no longer
// exist. Reload once to pick up the new build instead of leaving features half-broken.
function reloadForStaleChunks(event) {
  const key = 'chunk-reload-at';
  let last = 0;
  try { last = Number(sessionStorage.getItem(key) || 0); } catch { /* storage unavailable */ }
  if (Date.now() - last < 30000) return; // already reloaded recently; let the error surface
  try { sessionStorage.setItem(key, String(Date.now())); } catch { /* storage unavailable */ }
  event?.preventDefault?.();
  window.location.reload();
}
window.addEventListener('vite:preloadError', reloadForStaleChunks);
window.addEventListener('unhandledrejection', (event) => {
  const message = String(event.reason?.message || event.reason || '');
  if (/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message)) {
    reloadForStaleChunks(event);
  }
});

// Disable browser scroll restoration
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// Force scroll to top on page load
window.scrollTo(0, 0);
document.documentElement.scrollTop = 0;
document.body.scrollTop = 0;

// Get basename for React Router (matches vite.config.js base setting)
const basename = document.location.pathname.includes('/FFXIV_Market') ? '/FFXIV_Market/' : '/';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter 
    basename={basename}
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true
    }}
  >
    <App />
  </BrowserRouter>
)

// Warm search data in the background once the first frame is up
preloadAppData();
