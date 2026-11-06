// Generates src/styles/tokens.css from design/tokens.json (Household Warm v2,
// as delivered by the design system) plus design/tokens.app.json (the few
// tokens only the app needs), so colours, type, spacing, radii and shadows are
// never copied by hand. Run: npm run theme
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const ds = read('design/tokens.json');
const app = read('design/tokens.app.json');
const out = fileURLToPath(new URL('web/src/styles/tokens.css', root));

const light = {};
const dark = {};
const both = (name, value) => {
  if (typeof value === 'string') light[name] = value;
  else {
    light[name] = value.light;
    dark[name] = value.dark;
  }
};

for (const t of ds.color.tokens) both(t.name, t.value);
for (const [name, value] of Object.entries(app.color)) both(name, value);
app.member.forEach((c, i) => both(`member-${i}`, c));

for (const t of ds.spacing.tokens) both(t.name, t.value);
for (const [name, value] of Object.entries(app.spacing)) both(name, value);
for (const t of ds.radius.tokens) both(t.name, t.value);
for (const t of ds.shadow.tokens) both(t.name, t.value);
for (const [name, value] of Object.entries(app.shadow)) both(name, value);
// Brown-tinted shadows vanish on a dark ground; use neutral ones there.
Object.assign(dark, {
  'shadow-card': '0 1px 2px rgba(0,0,0,.3), 0 6px 18px rgba(0,0,0,.25)',
  'shadow-raised': '0 1px 2px rgba(0,0,0,.3), 0 14px 34px rgba(0,0,0,.4)',
  'shadow-accent': '0 8px 20px rgba(0,0,0,.35)',
});

light['font-sans'] = ds.type.families.sans;
light.touch = app['touch-target'];

// Type: a `font` shorthand per style (--t-body) and its tracking (--t-body-tracking).
const styles = [...ds.type.groups.flatMap((g) => g.styles), ...Object.entries(app.type).map(([name, s]) => ({ name, ...s }))];
for (const s of styles) {
  light[`t-${s.name}`] = `${s.fontWeight} ${s.fontSize}/${s.lineHeight} var(--font-sans)`;
  light[`t-${s.name}-tracking`] = s.letterSpacing ?? 'normal';
}

const block = (selector, vars, extra = '', indent = '') =>
  `${indent}${selector} {\n${Object.entries(vars).map(([k, v]) => `${indent}  --${k}: ${v};`).join('\n')}\n${extra ? `${indent}  ${extra}\n` : ''}${indent}}\n`;

const css =
  `/* Generated from design/tokens.json + design/tokens.app.json by scripts/gen-theme.mjs. Do not edit. */\n\n` +
  block(':root', light, 'color-scheme: light;') +
  `\n@media (prefers-color-scheme: dark) {\n` +
  block(':root:not([data-theme="light"])', dark, 'color-scheme: dark;', '  ') +
  `}\n\n` +
  block(':root[data-theme="dark"]', dark, 'color-scheme: dark;');

writeFileSync(out, css);
console.log(`Wrote ${out}`);
