import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as spatial from '../app/spatial.mjs';

const motion = await import('../app/camera-motion.mjs').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});

test('the Russian coast stays continuous across the antimeridian', async () => {
  assert.equal(typeof spatial.projectMapPoint, 'function');
  const source = JSON.parse(await readFile(new URL('../app/assets/russia.geojson', import.meta.url)));
  const rings = source.geometry.coordinates.flat();
  const xs = rings.flat().map(point => spatial.projectMapPoint(...point)[0]);
  assert.ok(Math.max(...xs) - Math.min(...xs) < 1800);
  for (const ring of rings) {
    for (let i = 1; i < ring.length; i++) {
      const a = spatial.projectMapPoint(...ring[i-1]);
      const b = spatial.projectMapPoint(...ring[i]);
      assert.ok(Math.abs(a[0]-b[0]) < 1000, JSON.stringify([ring[i-1],ring[i]]));
    }
  }
});

test('keyboard aliases share an action even on a Cyrillic keyboard layout', () => {
  assert.equal(typeof motion.cameraCommand, 'function');
  assert.equal(motion.cameraCommand('KeyW','ц'), 'forward');
  assert.equal(motion.cameraCommand('KeyA','ф'), 'left');
  assert.equal(motion.cameraCommand('KeyS','ы'), 'back');
  assert.equal(motion.cameraCommand('KeyD','в'), 'right');
  assert.equal(motion.cameraCommand('KeyQ','й'), 'turn-left');
  assert.equal(motion.cameraCommand('ArrowLeft','ArrowLeft'), 'turn-left');
  assert.equal(motion.cameraCommand('KeyE','у'), 'turn-right');
  assert.equal(motion.cameraCommand('ArrowRight','ArrowRight'), 'turn-right');
  assert.equal(motion.cameraCommand('KeyZ','я'), undefined);
});

test('forward follows the camera heading and diagonal movement is normalized', () => {
  assert.equal(typeof motion.travelVector, 'function');
  assert.deepEqual(motion.travelVector(0,0,1), [0,-1]);
  const clockwise = motion.travelVector(Math.PI/2,0,1);
  assert.ok(Math.abs(clockwise[0]+1)<1e-9 && Math.abs(clockwise[1])<1e-9);
  assert.ok(Math.abs(Math.hypot(...motion.travelVector(.31,1,1))-1)<1e-9);
});

test('damping is consistent at different frame rates and arcs interpolate without a snap', () => {
  assert.equal(typeof motion.approach, 'function');
  const single = motion.approach(0,1,1/30,13);
  const double = motion.approach(motion.approach(0,1,1/60,13),1,1/60,13);
  assert.ok(single>0 && single<1 && Math.abs(single-double)<1e-9);
  assert.ok(Math.abs(motion.shortArc(2*Math.PI-.2,.1)-.3)<1e-9);
});
