import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { OrderPage } from './pages/OrderPage.tsx';
import { OrderTrackingPage } from './pages/OrderTrackingPage.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

const path = window.location.pathname.replace(/\/$/, '');
const isOrderPage = path === '/order';
const isTrackPage = path === '/order/track';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isTrackPage ? <OrderTrackingPage /> : isOrderPage ? <OrderPage /> : <App />}
  </StrictMode>
);
