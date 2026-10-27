// Generates src/styles/tokens.css from design/tokens.json so colours, type,
// spacing, radii and shadows are never copied by hand. Run: npm run theme
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const tokens = JSON.parse(readFileSync(new URL('design/tokens.json', root), 'utf8'));
const out = fileURLToPath(new URL('web/src/styles/tokens.css', root));

const px = (n) => (typeof n === 'number' ? `${n}px` : n);
const block = (selector, vars, indent = '') =>
  `${indent}${selector} {\n${Object.entries(vars).map(([k, v]) => `${indent}  --${k}: ${v};`).join('\n')}\n${indent}}\n`;

const base = {};
for (const [k, v] of Object.entries(tokens.color.light)) base[`c-${k}`] = v;
tokens.color.member.forEach((c, i) => (base[`c-member-${i}`] = c));
base['font'] = tokens.font.family;
base['font-rounded'] = tokens.font['family-rounded'];
for (const [k, t] of Object.entries(tokens.type)) {
  base[`t-${k}`] = `${t.weight} ${px(t.size)}/${px(t.line)} var(--font)`;
  base[`t-${k}-tracking`] = `${(t.tracking / t.size).toFixed(4)}em`;
}
for (const [k, v] of Object.entries(tokens.space)) base[`s-${k}`] = px(v);
for (const [k, v] of Object.entries(tokens.radius)) base[`r-${k}`] = px(v);
for (const [k, v] of Object.entries(tokens.shadow)) base[`shadow-${k}`] = v;
base['touch'] = px(tokens['touch-target']);

const dark = {};
for (const [k, v] of Object.entries(tokens.color.dark)) dark[`c-${k}`] = v;
// Brown-tinted shadows vanish on a dark ground; use neutral ones there.
Object.assign(dark, {
  'shadow-card': '0 1px 2px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.25)',
  'shadow-raised': '0 2px 6px rgba(0, 0, 0, 0.3), 0 18px 40px rgba(0, 0, 0, 0.4)',
  'shadow-bar': '0 6px 30px rgba(0, 0, 0, 0.45)',
});

const css =
  `/* Generated from design/tokens.json by scripts/gen-theme.mjs. Do not edit. */\n\n` +
  block(':root', base) +
  `\n@media (prefers-color-scheme: dark) {\n` +
  block(':root:not([data-theme="light"])', dark, '  ') +
  `}\n\n` +
  block(':root[data-theme="dark"]', dark);

writeFileSync(out, css);
console.log(`Wrote ${out}`);
