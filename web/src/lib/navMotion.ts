// Screen-to-screen motion. Every navigation runs as a view transition (where
// the browser has them), and data-nav on <html> tells app.css which way the
// screens slide: deeper into the app comes in from the right, back goes off to
// the right, between tabs and other screens at the same level crossfades.

import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router';

type Router = { navigate: (...args: never[]) => Promise<void> };

const TABS = ['/', '/recipes', '/groceries', '/us'];

/** Onboarding goes step by step: a later step is "forward" though it's no deeper. */
const ONBOARDING = [
  '/welcome', '/signin', '/join', '/onboarding/profile', '/onboarding/household',
  '/onboarding/invite', '/onboarding/goals', '/onboarding/tastes', '/onboarding/quiz',
];

const depth = (path: string) => (TABS.includes(path) ? 0 : path.split('/').filter(Boolean).length);

const step = (path: string) => ONBOARDING.findIndex((p) => path === p || path.startsWith(`${p}/`));

export function navDirection(from: string, to: string): 'forward' | 'back' | 'fade' {
  const a = step(from);
  const b = step(to);
  if (a >= 0 && b >= 0 && a !== b) return b > a ? 'forward' : 'back';
  const d = depth(to) - depth(from);
  return d > 0 ? 'forward' : d < 0 ? 'back' : 'fade';
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Turns on view transitions for every navigation the app makes (links,
 * navigate(), redirects). Going back with the browser reuses the transition
 * of the way in, which the router does by itself.
 */
export function enableNavMotion(router: Router) {
  if (typeof document === 'undefined' || !('startViewTransition' in document)) return;
  const navigate = router.navigate.bind(router) as (to: unknown, opts?: Record<string, unknown>) => Promise<void>;
  (router as { navigate: unknown }).navigate = (to: unknown, opts?: Record<string, unknown>) =>
    navigate(to, typeof to === 'number' || reducedMotion() || opts?.viewTransition === false ? opts : { ...opts, viewTransition: true });
}

/**
 * Sets data-nav for the screen being shown, before the browser animates to it.
 * A layout effect: it runs inside the transition's update, ahead of its frames.
 */
export function useNavDirection() {
  const { pathname } = useLocation();
  const prev = useRef(pathname);
  useLayoutEffect(() => {
    if (prev.current === pathname) return;
    document.documentElement.dataset.nav = navDirection(prev.current, pathname);
    prev.current = pathname;
  }, [pathname]);
}
