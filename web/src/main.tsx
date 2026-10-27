import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { registerSW } from 'virtual:pwa-register';
import { I18nProvider } from './i18n/index.tsx';
import { SessionProvider } from './lib/session.tsx';
import { router } from './router.tsx';
import './styles/tokens.css';
import './styles/app.css';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </I18nProvider>
  </StrictMode>,
);
