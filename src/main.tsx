import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { OrderPage } from './pages/OrderPage.tsx';
import './index.css';

const isOrderPage = window.location.pathname === '/order' || window.location.pathname === '/order/';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isOrderPage ? <OrderPage /> : <App />}
  </StrictMode>
);
