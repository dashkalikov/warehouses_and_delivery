import { test } from 'node:test';
import assert from 'node:assert/strict';

const domain = await import('../app/domain.mjs').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});

const edges = [
  { a: 'A', b: 'B', km: 100, speed: 100, delay: 2, limit: 20, toll: 0, name: 'A' },
  { a: 'A', b: 'C', km: 110, speed: 100, delay: 0, limit: 20, toll: 0, name: 'B' },
  { a: 'C', b: 'B', km: 90, speed: 100, delay: 0, limit: 20, toll: 0, name: 'B' },
];
const vehicle = { capacity: 18, status: 'reserve', refrigerated: true, consumption: 25, condition: 90 };

test('routing balances distance and congestion according to the selected criterion', () => {
  assert.equal(typeof domain.planRoutes, 'function', 'Route planner is available');
  assert.deepEqual(domain.planRoutes(edges, 'A', 'B', vehicle, 10, 'fast')[0].nodes, ['A', 'C', 'B']);
  assert.deepEqual(domain.planRoutes(edges, 'A', 'B', vehicle, 10, 'cost')[0].nodes, ['A', 'B']);
});

test('routing rejects overload, service vehicles, blocked roads and cold-chain incompatibility', () => {
  assert.equal(typeof domain.planRoutes, 'function', 'Route planner is available');
  assert.deepEqual(domain.planRoutes(edges, 'A', 'B', vehicle, 19), []);
  assert.deepEqual(domain.planRoutes(edges, 'A', 'B', { ...vehicle, status: 'service' }, 10), []);
  assert.deepEqual(domain.planRoutes(edges, 'A', 'B', { ...vehicle, refrigerated: false }, 10, 'fast', { cold: true }), []);
  const blocked = domain.planRoutes(edges, 'A', 'B', vehicle, 10, 'fast', { closed: ['A:C'] });
  assert.deepEqual(blocked[0].nodes, ['A', 'B']);
});

test('position uses traveled leg time and reaches the destination without looping', () => {
  assert.equal(typeof domain.tripPosition, 'function', 'Trip simulation is available');
  const route = { nodes: ['A', 'B', 'C'], legs: [{ hours: 1 }, { hours: 3 }], hours: 4 };
  assert.deepEqual(domain.tripPosition(route, 2.5), { from: 'B', to: 'C', fraction: 0.5, progress: 0.625 });
  assert.equal(domain.tripPosition(route, 10).progress, 1);
});

test('predictive warning follows telemetry and a higher risk reduces remaining resource', () => {
  assert.equal(typeof domain.predictMaintenance, 'function', 'Condition estimator is available');
  const healthy = domain.predictMaintenance({ temperature: 65, vibration: 2, wear: 10 });
  const worn = domain.predictMaintenance({ temperature: 98, vibration: 7, wear: 72 });
  assert.equal(healthy.level, 'normal');
  assert.equal(worn.level, 'critical');
  assert.ok(worn.rul < healthy.rul);
});
