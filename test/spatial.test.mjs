import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cities, fleet, roads, warehouses, zones } from '../app/data.mjs';
import { planRoutes } from '../app/domain.mjs';

const spatial = await import('../app/spatial.mjs').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});

test('each warehouse has its own plan with zones inside halls and the advertised number of docks', () => {
  assert.equal(typeof spatial.facilityLayout, 'function', 'Warehouse plans are available');
  const plans = warehouses.map(spatial.facilityLayout);
  assert.equal(new Set(plans.map(plan => JSON.stringify(plan.halls))).size, warehouses.length);
  assert.ok(plans.some(plan => plan.halls.length > 1));
  plans.forEach((plan, i) => {
    assert.equal(plan.docks.length, warehouses[i].docks);
    assert.deepEqual(plan.zones.map(zone => zone.id).sort(), zones.map(zone => zone.id).sort());
    for (const zone of plan.zones) {
      assert.ok(plan.halls.some(hall => zone.x >= hall.x && zone.z >= hall.z
        && zone.x + zone.w <= hall.x + hall.w && zone.z + zone.d <= hall.z + hall.d));
    }
  });
});

test('roof and wall transitions use continuous offsets and become invisible at the top', () => {
  assert.equal(typeof spatial.shellPose, 'function', 'Animated shell pose is available');
  assert.deepEqual(spatial.shellPose(0, 6), { lift: 0, opacity: 1 });
  assert.deepEqual(spatial.shellPose(1, 6), { lift: 6, opacity: 0 });
  const a = spatial.shellPose(0.25, 6);
  const b = spatial.shellPose(0.75, 6);
  assert.ok(a.lift > 0 && a.lift < b.lift && b.lift < 6);
  assert.ok(a.opacity > b.opacity && b.opacity > 0);
});

test('map exposes local warehouses and transport nodes only as the view approaches', () => {
  assert.equal(typeof spatial.mapDetail, 'function', 'Map scale bands are available');
  assert.equal(spatial.mapDetail(2), 'country');
  assert.equal(spatial.mapDetail(0.35), 'region');
  assert.equal(spatial.mapDetail(0.04), 'metro');
  assert.equal(spatial.mapDetail(0.008), 'street');
});

test('metro warehouses can be selected for origin and are connected to the dispatch network', () => {
  const local = warehouses.filter(w => w.metro === 'msk');
  assert.ok(local.length >= 3);
  for (const facility of local) {
    const vehicle = fleet.find(v => v.home === facility.id && v.status === 'reserve');
    assert.ok(cities[facility.id] && vehicle);
    const [route] = planRoutes(roads, facility.id, 'ekb', vehicle, 2, 'fast');
    assert.equal(route.nodes[0], facility.id);
    assert.equal(route.nodes[1], 'msk');
  }
});
