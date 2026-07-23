import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

// The CIP-0056 hooks (the `@partylayer/react/query` entrypoint) are built on
// TanStack Query, so they need a QueryClient in context. Create one here and wrap
// the app, exactly as the react-vite scaffold template does.
const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
