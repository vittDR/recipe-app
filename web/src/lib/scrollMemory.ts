// Where each screen was scrolled to, so going back lands where you left off.
// The app scrolls .scroller rather than the page, so the browser's own scroll
// restoration never applies. Positions are kept per history entry
// (location.key) in sessionStorage, which survives a reload of the page.

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';

const STORE = 'dineamite.scroll.v1';
const MAX_ENTRIES = 50;

let positions: Record<string, number> = {};
try {
  positions = JSON.parse(sessionStorage.getItem(STORE) ?? '{}') as Record<string, number>;
} catch {
  // unavailable: positions live for this page only
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function remember(key: string, top: number) {
  delete positions[key];
  positions[key] = top;
  const keys = Object.keys(positions);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) delete positions[k];
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(positions));
    } catch {
      // full or unavailable
    }
  }, 200);
}

/**
 * Keeps the scroll position of `.scroller` per history entry: back and
 * forward restore it, a new screen starts at the top. Call once, in the
 * layout around every screen.
 */
export function useScrollMemory(scroller: React.RefObject<HTMLElement | null>) {
  const { key, pathname } = useLocation();
  const type = useNavigationType();
  const current = useRef(key);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => remember(current.current, el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scroller]);

  // A layout effect: it runs inside the view transition's update, so the new
  // screen is captured at its restored position.
  useLayoutEffect(() => {
    const el = scroller.current;
    const samePath = lastPath.current === pathname;
    current.current = key;
    lastPath.current = pathname;
    if (!el) return;
    // Changing only the query (a filter, a tab inside a screen) keeps the place.
    if (type !== 'POP' && samePath) return;
    const target = type === 'POP' ? (positions[key] ?? 0) : 0;
    el.scrollTop = target;
    if (el.scrollTop >= target - 1) return;

    // The screen is still loading (e.g. after a reload): keep trying while it
    // grows, until it fits, the person scrolls, or a moment has passed.
    let frame = 0;
    const started = performance.now();
    const stop = () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('touchstart', stop);
      el.removeEventListener('wheel', stop);
    };
    const retry = () => {
      el.scrollTop = target;
      if (el.scrollTop >= target - 1 || performance.now() - started > 2000) stop();
      else frame = requestAnimationFrame(retry);
    };
    el.addEventListener('touchstart', stop, { passive: true });
    el.addEventListener('wheel', stop, { passive: true });
    frame = requestAnimationFrame(retry);
    return stop;
  }, [key, pathname, type, scroller]);
}
