import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeModeProvider } from './context/ThemeContext';
import { disableDevTools } from './utils/disableDevTools';
import { setupOfflineSync, flushOfflineQueue } from './utils/offlineQueue';
import App from './App';

disableDevTools();

setupOfflineSync();

flushOfflineQueue().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

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