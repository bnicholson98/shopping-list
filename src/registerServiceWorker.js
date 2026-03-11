export function registerServiceWorker() {
  if (process.env.NODE_ENV !== 'production') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/serviceWorker.js')
      .catch((error) => console.error('Service worker registration failed:', error));
  });
}