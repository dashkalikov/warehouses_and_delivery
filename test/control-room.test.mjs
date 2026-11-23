import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as domain from '../app/domain.mjs';
import * as data from '../app/data.mjs';

const route={nodes:['a','b','c'],km:120,hours:4,legs:[
  {from:'a',to:'b',km:90,hours:2,shape:[[36,55],[37,55],[37,56]]},
  {from:'b',to:'c',km:30,hours:2,shape:[[37,56],[37.5,56]]},
]};
const truck={id:'TR-011',home:'a',status:'reserve'};
const trip={vehicle:truck,route,elapsed:0,at:0};

test('driven kilometres follow leg distance, and the drawn sections meet',()=>{
  const detail=domain.tripDistance(route,1);
  assert.equal(detail.driven,45);
  assert.equal(detail.remaining,75);
  assert.equal(detail.past.length,1);
  assert.deepEqual(detail.past.at(-1).at(-1),detail.ahead[0][0]);
  assert.equal(domain.tripDistance(route,10).driven,120);
});

test('the roster distinguishes loading, unloading, incoming and repair',async()=>{
  const {siteVehicles}=await import('../app/operations.mjs');
  assert.equal(siteVehicles('a',[truck],[{...trip,elapsed:-.2}],0)[0].activity,'loading');
  assert.equal(siteVehicles('c',[truck],[trip],0)[0].direction,'incoming');
  assert.equal(siteVehicles('c',[truck],[trip],4*3600+90)[0].activity,'unloading');
  assert.equal(siteVehicles('a',[{...truck,status:'service'}],[],0)[0].activity,'repair');
  assert.equal(siteVehicles('b',[truck],[trip],0)[0].direction,'transit');
});

test('sampling a simulated sensor window records each minute once',async()=>{
  const {SensorHistory}=await import('../app/telemetry-store.mjs');
  const history=new SensorHistory([{id:'asset'}],(asset,time)=>({temperature:70+time/60}));
  history.capture(0);
  history.capture(45);
  history.capture(125);
  const values=history.samples('asset',120,120).filter(row=>row.observed);
  assert.deepEqual(values.map(row=>[row.time,row.temperature]),[[0,70],[60,71],[120,72]]);
});

test('the expanded warehouse network has more than forty sites and dispatchable reserve vehicles',()=>{
  assert.ok(data.warehouses.length>40);
  assert.ok(data.fleet.filter(v=>v.destination).length>=18);
  for(const site of data.warehouses) {
    assert.ok(data.roads.some(r=>r.a===site.id||r.b===site.id),site.id);
    assert.ok(data.fleet.some(v=>v.home===site.id&&v.status==='reserve'),site.id);
  }
});

test('telemetry CSV preserves units, order and sample provenance',async()=>{
  const {SensorHistory}=await import('../app/telemetry-store.mjs');
  const {telemetryCSV}=await import('../app/telemetry-dashboard.mjs');
  const asset=data.warehouses[0];
  const history=new SensorHistory([asset]);
  history.capture(30);
  const csv=telemetryCSV(asset,history.samples(asset.id,60,120));
  const lines=csv.split('\r\n');
  assert.equal(lines.length,4);
  assert.match(lines[0],/Температура \(°C\).*влажность \(%\)/);
  assert.match(lines[2],/;msk;Замер симуляции;/);
  assert.match(lines[3],/;msk;Стартовая история;/);
});
