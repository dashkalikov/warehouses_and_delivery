import assert from 'node:assert/strict';
import { test } from 'node:test';
import { palettes, resolveAppearance } from '../app/appearance.mjs';

test('a color palette stays selected across light, dark and system modes',()=>{
  assert.ok(Object.keys(palettes).length>=5);
  const light=resolveAppearance('light','ocean',true);
  const dark=resolveAppearance('dark','ocean',false);
  assert.equal(light.palette,'ocean');
  assert.equal(dark.palette,'ocean');
  assert.notEqual(light.colors.action,dark.colors.action);
  assert.deepEqual(resolveAppearance('system','ocean',true),dark);
  assert.deepEqual(resolveAppearance('system','ocean',false),light);
  assert.deepEqual(resolveAppearance('unknown','unknown',true),resolveAppearance('light','kontur',false));
});

function luminance(color) {
  const linear=color.slice(1).match(/../g).map(hex=>{
    const s=parseInt(hex,16)/255;
    return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;
  });
  return linear[0]*.2126+linear[1]*.7152+linear[2]*.0722;
}

test('every palette has readable action and accent text in both modes',()=>{
  const contrast=(a,b)=>{
    const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);
    return (values[0]+.05)/(values[1]+.05);
  };
  for(const [id,palette] of Object.entries(palettes)) {
    for(const mode of ['light','dark']) {
      const {action,ink,accent,canvas,sidebar}=palette[mode];
      assert.ok(contrast(action,ink)>=4.5,`${id}/${mode} primary action`);
      assert.ok(contrast(accent,canvas)>=4.5,`${id}/${mode} accent text`);
      assert.ok(contrast(sidebar,'#acb5c3')>=4.5,`${id}/${mode} sidebar labels`);
    }
  }
});
