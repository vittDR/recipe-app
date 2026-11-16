import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { registerSW } from 'virtual:pwa-register';
import { I18nProvider } from './i18n/index.tsx';
import { SessionProvider } from './lib/session.tsx';
import { applyTheme, getTheme } from './lib/theme.ts';
import { router } from './router.tsx';
import './styles/tokens.css';
import './styles/app.css';

applyTheme(getTheme());
// A new version takes over by itself, but reloading mid-use would throw away
// where the person is: wait until the app is in the background.
registerSW({
  immediate: true,
  onNeedReload: () => {
    if (document.visibilityState === 'hidden') return window.location.reload();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') window.location.reload();
    });
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </I18nProvider>
  </StrictMode>,
);
