// Stroke icons drawn on a 24px grid, plus a few filled ones on their own grid.
// Decorative unless given a label.

const PATHS = {
  book: 'M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM5 17a3 3 0 0 1 3-3h10',
  cart: 'M3 4h2l2.4 11h10.2L20 8H6.2M9 20h.01M17 20h.01',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 6.8M21 20c0-2.6-1.7-4.9-4-5.7',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-8 8-8s8 3.6 8 8',
  plus: 'M12 5v14M5 12h14',
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
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  sync: 'M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3M4 4v4h4M20 20v-4h-4',
  alert: 'M12 4l9 16H3L12 4zM12 10v4M12 17h.01',
  squarePlus: 'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM12 8v8M8 12h8',
  caret: 'M7 10l5 5 5-5',
  backspace: 'M9 5h11v14H9l-6-7 6-7zM12 9l5 6M17 9l-5 6',
  pot: 'M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-6zM2 10h20M9 6c0-1 1-1 1-2M14 6c0-1 1-1 1-2',
} as const;

// Filled artwork (the app's bowl): its own viewBox, no stroke.
const FILLED = {
  bowl: { viewBox: '0 0 256 256', d: 'M81.77,55c5.35-6.66,6.67-11.16,6.12-13.14-.42-1.49-2.41-2.26-2.43-2.26A8,8,0,0,1,88,24a8.11,8.11,0,0,1,2.38.36c1,.31,9.91,3.33,12.79,12.76,2.46,8.07-.55,17.45-8.94,27.89-5.35,6.66-6.67,11.16-6.12,13.14.42,1.49,2.37,2.24,2.39,2.25A8,8,0,0,1,88,96a8.11,8.11,0,0,1-2.38-.36c-1-.31-9.91-3.33-12.79-12.76C70.37,74.81,73.38,65.43,81.77,55Zm31.06,27.89c2.88,9.43,11.79,12.45,12.79,12.76A8.11,8.11,0,0,0,128,96a8,8,0,0,0,2.5-15.6s-2-.76-2.39-2.25c-.55-2,.77-6.48,6.12-13.14,8.39-10.44,11.4-19.82,8.94-27.89-2.88-9.43-11.78-12.45-12.79-12.76A8.11,8.11,0,0,0,128,24a8,8,0,0,0-2.54,15.59s2,.77,2.43,2.26c.55,2-.77,6.48-6.12,13.14C113.38,65.43,110.37,74.81,112.83,82.88Zm40,0c2.88,9.43,11.79,12.45,12.79,12.76A8.11,8.11,0,0,0,168,96a8,8,0,0,0,2.5-15.6s-2-.76-2.39-2.25c-.55-2,.77-6.48,6.12-13.14,8.39-10.44,11.4-19.82,8.94-27.89-2.88-9.43-11.78-12.45-12.79-12.76A8.11,8.11,0,0,0,168,24a8,8,0,0,0-2.54,15.59s2,.77,2.43,2.26c.55,2-.77,6.48-6.12,13.14C153.38,65.43,150.37,74.81,152.83,82.88ZM224,112H32a8,8,0,0,0-8,8,104.35,104.35,0,0,0,56,92.28V216a16,16,0,0,0,16,16h64a16,16,0,0,0,16-16v-3.72A104.35,104.35,0,0,0,232,120,8,8,0,0,0,224,112Z' },
} as const;

export type IconName = keyof typeof PATHS | keyof typeof FILLED;

export function Icon({ name, size = 22, label, strokeWidth = 2 }: { name: IconName; size?: number; label?: string; strokeWidth?: number }) {
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
      fill="none"
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
