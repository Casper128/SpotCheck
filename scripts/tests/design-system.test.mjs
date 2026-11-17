import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const css=fs.readFileSync('frontend/src/presentation/styles/globals.css','utf8');
test('brand tokens define dark surfaces, accessible text and amber active pins',()=>{
  for(const [name,value] of [['background','#09090B'],['surface','#121215'],['border','#27272A'],['text-primary','#FAFAFA'],['text-secondary','#A1A1AA'],['accent','#F59E0B']]) assert.ok(css.includes(`--${name}: ${value}`));
  assert.match(css,/\.pin-marker\s*\{[^}]*background:\s*var\(--accent\)/);
  assert.match(css,/\.button-primary\s*\{[^}]*background:\s*var\(--action\)/);
  assert.ok(!css.includes('.guest-'));
  assert.ok(!css.includes('route-selector form'));
});
test('interactive UI supports keyboard focus, reduced motion and scoped visual tokens',()=>{
  assert.ok(css.includes(':focus-visible'));
  assert.ok(css.includes('prefers-reduced-motion: reduce'));
  assert.ok(css.includes('backdrop-filter: blur(12px)'));
  assert.ok(css.includes('--motion-duration: 200ms'));
  assert.ok(css.includes('var(--surface)'));
  assert.ok(css.includes('var(--text-primary)'));
});
