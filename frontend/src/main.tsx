import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider, createTheme, ColorSchemeScript } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/code-highlight/styles.css';
import './index.css';
import { loadConfig } from './config';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 5000 } }
});

const theme = createTheme({
  primaryColor: 'linear',
  primaryShade: { light: 6, dark: 5 },
  colors: {
    linear: [
      '#EDEEFC', '#D8DAF7', '#B0B4EF', '#888EE7', '#6F76E0',
      '#5E6AD2', '#4C56B8', '#3D4699', '#2F3675', '#212652'
    ]
  },
  fontFamily: 'Inter, system-ui, sans-serif',
  defaultRadius: 'md',
  headings: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '2rem',   lineHeight: '1.2', fontWeight: '700' },
      h2: { fontSize: '1.5rem', lineHeight: '1.25', fontWeight: '700' },
      h3: { fontSize: '1.15rem', lineHeight: '1.3', fontWeight: '600' },
      h4: { fontSize: '1rem',    lineHeight: '1.35', fontWeight: '600' }
    }
  },
  fontSizes: { xs: '11px', sm: '13px', md: '14px', lg: '16px', xl: '20px' },
  spacing: { xs: '8px', sm: '12px', md: '16px', lg: '24px', xl: '32px' },
  other: {
    bgBase: 'var(--bg-base)',
    bgSecondary: 'var(--bg-secondary)',
    bgTertiary: 'var(--bg-tertiary)'
  }
});

(async () => {
  try { await loadConfig(); } catch (e) { console.error('Config load failed', e); }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ColorSchemeScript defaultColorScheme="dark" />
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <Notifications position="top-right" />
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </MantineProvider>
    </React.StrictMode>
  );
})();
