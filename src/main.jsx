import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles/main.css'
import { initializeSupabaseConnection } from './services/supabaseClient'

// Initialize Supabase connection immediately on page load (before React renders)
console.log('[App] 🚀 Starting application initialization...');
const appStartTime = performance.now();
initializeSupabaseConnection().then(() => {
  const appInitTime = performance.now() - appStartTime;
  console.log(`[App] ⚡ Application ready (init time: ${appInitTime.toFixed(2)}ms)`);
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
