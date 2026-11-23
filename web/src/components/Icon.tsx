// Stroke icons drawn on a 24px grid, plus a few filled ones on their own grid.
// Decorative unless given a label.

const PATHS = {
  book: 'M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM5 17a3 3 0 0 1 3-3h10',
  cart: 'M3 4h2l2.4 11h10.2L20 8H6.2M9 20h.01M17 20h.01',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 6.8M21 20c0-2.6-1.7-4.9-4-5.7',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-8 8-8s8 3.6 8 8',
  plus: 'M12 5v14M5 12h14',
  sliders: 'M4 7h9M17 7h3M15 5v4M4 17h3M11 17h9M9 15v4',
  minus: 'M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8L3.5 9.7l5.9-.8z',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 5l7 7-7 7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  history: 'M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5M3.5 4v4.5H8M12 8v4l3 2',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  pencil: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2zM10 21h4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  calendar: 'M6 4.5h12a2.5 2.5 0 0 1 2.5 2.5v11a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18V7A2.5 2.5 0 0 1 6 4.5zM3.5 9.5h17M8 2.5v4M16 2.5v4M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01',
  sync: 'M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3M4 4v4h4M20 20v-4h-4',
  alert: 'M12 4l9 16H3L12 4zM12 10v4M12 17h.01',
  squarePlus: 'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM12 8v8M8 12h8',
  caret: 'M7 10l5 5 5-5',
  backspace: 'M9 5h11v14H9l-6-7 6-7zM12 9l5 6M17 9l-5 6',
  pot: 'M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-6zM2 10h20M9 6c0-1 1-1 1-2M14 6c0-1 1-1 1-2',
  // Household Warm v2 line set.
  bowlSteam: 'M3.5 12h17a8.5 8.5 0 0 1-17 0zM9 21h6M9 3.5c-.9 1 .9 2 0 3.5M12 3.5c-.9 1 .9 2 0 3.5M15 3.5c-.9 1 .9 2 0 3.5',
  basket: 'M3 10h18l-1.8 9.2a1 1 0 0 1-1 .8H5.8a1 1 0 0 1-1-.8L3 10zM7.5 10L12 4l4.5 6',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  home: 'M4 10.5L12 4l8 6.5V20H4zM10 20v-5h4v5',
  bolt: 'M13 2.5L5 13.5h6.5L10.5 21.5l8-11H12z',
  flame: 'M12 21a6 6 0 0 0 6-6c0-4.5-3.5-6.5-4.5-11-2 2-3.5 4.5-3.5 7-1-.7-1.5-1.7-1.5-3C6.8 10 6 12.6 6 15a6 6 0 0 0 6 6z',
  camera: 'M4 8h3.2L9 5h6l1.8 3H20v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  pan: 'M3 11h13v1a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-1zM16 12h5',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  chart: 'M4 20h16M7 16v-4M12 16V8M17 16v-7',
  // Install instructions draw the browser's own buttons.
  share: 'M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1',
  lines: 'M5 7h14M5 12h10M5 17h7',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  lock: 'M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  mail: 'M3.5 6h17v12h-17zM4 6.5l8 6.5 8-6.5',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  // Diets (onboarding, Us > Tastes).
  utensils: 'M7 3v18M4.5 3v5a2.5 2.5 0 0 0 5 0V3M17.5 21V3c-2.2 1.2-3.5 4-3.5 7.5V13h3.5',
  sprout: 'M12 21v-9M12 12c0-3.9-2.7-6.5-7-6.5 0 3.9 2.7 6.5 7 6.5zM12 10c0-3.9 2.7-6.5 7-6.5 0 3.9-2.7 6.5-7 6.5z',
  fish: 'M2.5 12c2.4-3.8 5.8-5.8 9.6-5.8 3.2 0 5.7 1.5 7.4 3.8L22 8v8l-2.5-2c-1.7 2.3-4.2 3.8-7.4 3.8-3.8 0-7.2-2-9.6-5.8zM15.5 11h.01',
  leaf: 'M5 20c-.5-8.5 4.5-15 15-15.5.5 10.5-5.5 15.5-14 15.5M5 20l9.5-9.5',
} as const;

// Filled artwork (the app's bowl): its own viewBox, no stroke.
const FILLED = {
  bowl: { viewBox: '0 0 256 256', d: 'M81.77,55c5.35-6.66,6.67-11.16,6.12-13.14-.42-1.49-2.41-2.26-2.43-2.26A8,8,0,0,1,88,24a8.11,8.11,0,0,1,2.38.36c1,.31,9.91,3.33,12.79,12.76,2.46,8.07-.55,17.45-8.94,27.89-5.35,6.66-6.67,11.16-6.12,13.14.42,1.49,2.37,2.24,2.39,2.25A8,8,0,0,1,88,96a8.11,8.11,0,0,1-2.38-.36c-1-.31-9.91-3.33-12.79-12.76C70.37,74.81,73.38,65.43,81.77,55Zm31.06,27.89c2.88,9.43,11.79,12.45,12.79,12.76A8.11,8.11,0,0,0,128,96a8,8,0,0,0,2.5-15.6s-2-.76-2.39-2.25c-.55-2,.77-6.48,6.12-13.14,8.39-10.44,11.4-19.82,8.94-27.89-2.88-9.43-11.78-12.45-12.79-12.76A8.11,8.11,0,0,0,128,24a8,8,0,0,0-2.54,15.59s2,.77,2.43,2.26c.55,2-.77,6.48-6.12,13.14C113.38,65.43,110.37,74.81,112.83,82.88Zm40,0c2.88,9.43,11.79,12.45,12.79,12.76A8.11,8.11,0,0,0,168,96a8,8,0,0,0,2.5-15.6s-2-.76-2.39-2.25c-.55-2,.77-6.48,6.12-13.14,8.39-10.44,11.4-19.82,8.94-27.89-2.88-9.43-11.78-12.45-12.79-12.76A8.11,8.11,0,0,0,168,24a8,8,0,0,0-2.54,15.59s2,.77,2.43,2.26c.55,2-.77,6.48-6.12,13.14C153.38,65.43,150.37,74.81,152.83,82.88ZM224,112H32a8,8,0,0,0-8,8,104.35,104.35,0,0,0,56,92.28V216a16,16,0,0,0,16,16h64a16,16,0,0,0,16-16v-3.72A104.35,104.35,0,0,0,232,120,8,8,0,0,0,224,112Z' },
} as const;

export type IconName = keyof typeof PATHS | keyof typeof FILLED;

/** Filled glyphs only for heart (like), star (indispensable) and sparkle (smart suggestion). */
export function Icon({ name, size = 22, label, strokeWidth = 2, filled }: {
  name: IconName; size?: number; label?: string; strokeWidth?: number; filled?: boolean;
}) {
  if (name in FILLED) {
    const f = FILLED[name as keyof typeof FILLED];
    return (
      <svg width={size} height={size} viewBox={f.viewBox} fill="currentColor"
        role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
        <path d={f.d} />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={PATHS[name as keyof typeof PATHS]} />
    </svg>
  );
}
