import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';

// Service worker DISABLED during demo phase for reliable updates
// Uncomment to re-enable PWA/offline support
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     const swPath = `${import.meta.env.BASE_URL}sw.js`;
//     navigator.serviceWorker.register(swPath)
//       .then((registration) => {
//         console.log('SW registered:', registration.scope);
//       })
//       .catch((error) => {
//         console.log('SW registration failed:', error);
//       });
//   });
// }

// Unregister any existing service workers (cleanup for users who had it)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
