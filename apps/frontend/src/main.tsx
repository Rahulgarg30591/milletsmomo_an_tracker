import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeModeProvider } from './context/ThemeContext';
import { disableDevTools } from './utils/disableDevTools';
import { setupOfflineSync, flushOfflineQueue } from './utils/offlineQueue';
import { queryClient } from './api/queryClient';
import App from './App';

disableDevTools();

setupOfflineSync();

flushOfflineQueue().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeModeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeModeProvider>
    </QueryClientProvider>
  </StrictMode>,
);