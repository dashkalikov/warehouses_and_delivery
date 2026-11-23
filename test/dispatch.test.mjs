import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as domain from '../app/domain.mjs';
import * as spatial from '../app/spatial.mjs';
import { fleet, roads, roadEndpoints, warehouses } from '../app/data.mjs';

const vehicle={ capacity:18, status:'reserve', consumption:28, condition:95 };
const road=(a,b,km,speed,shape)=>({a,b,km,speed,shape,delay:0,toll:0,limit:26,name:'Шоссе'});

test('minimum distance uses road length and leg geometry follows the direction of travel',()=>{
  const direct=road('a','c',14,40,[[38,55],[38,55.04],[38.14,55.04]]);
  const fast=[road('a','b',10,95,[[38,55],[38.10,55]]),road('b','c',9,95,[[38.10,55],[38.14,55.04]])];
  const route=domain.planRoutes([direct,...fast],'c','a',vehicle,4,'distance')[0];
  assert.equal(route.km,14);
  assert.deepEqual(route.legs[0].shape,direct.shape.toReversed());
});

test('the vehicle goes through bends by travelled road distance',()=>{
  const edge=road('a','b',14,40,[[38,55],[38,55.015],[38,55.10],[38.2,55.10]]);
  const first=domain.roadPosition(edge.shape,.25);
  const last=domain.roadPosition(edge.shape,.75);
  assert.equal(first[0],38);
  assert.ok(first[1]>55.015);
  assert.equal(last[1],55.10);
  assert.deepEqual(domain.roadPosition(edge.shape,1),edge.shape.at(-1));
});

test('warehouse travel pauses, accelerates, and cruises at a measured speed',()=>{
  assert.equal(spatial.yardLoopProgress(2,100,1.25),0);
  const start=spatial.yardLoopProgress(3.1,100,1.25);
  assert.ok(start>0&&start<.001);
  const first=spatial.yardLoopProgress(12,100,1.25);
  const second=spatial.yardLoopProgress(13,100,1.25);
  assert.ok(Math.abs((second-first)*100-1.25)<1e-9);
});

test('loaded road corridors have continuous endpoints across the whole warehouse network',()=>{
  for(const edge of roads) {
    assert.ok(edge.shape.length>3);
    assert.deepEqual(edge.shape[0],roadEndpoints[edge.a]);
    assert.deepEqual(edge.shape.at(-1),roadEndpoints[edge.b]);
  }
  const truck=fleet.find(item=>item.id==='TR-421');
  const path=domain.planRoutes(roads,'msk','khv',truck,9,'distance')[0];
  assert.ok(path.km>7000);
  for(let index=1;index<path.legs.length;index++) {
    assert.deepEqual(path.legs[index-1].shape.at(-1),path.legs[index].shape[0]);
  }
});

test('each warehouse has a local road-reachable catchment and a delivery district',()=>{
  const {sites,districts}=JSON.parse(readFileSync(new URL('../app/assets/coverage.json',import.meta.url),'utf8'));
  assert.equal(Object.keys(sites).length,warehouses.length);
  for(const site of warehouses) {
    const area=sites[site.id], district=districts[site.metro??site.id];
    assert.ok(area.ring.length>=12 && district?.ring.length>=8,site.id);
    assert.deepEqual(area.ring[0],area.ring.at(-1));
    assert.deepEqual(district.ring[0],district.ring.at(-1));
    assert.ok(area.ring.every(point=>domain.roadKilometres(roadEndpoints[site.id],point)<=85),site.id);
    const ranges=area.ring.slice(0,-1).map(point=>domain.roadKilometres(roadEndpoints[site.id],point));
    assert.ok(Math.max(...ranges)>1.10*Math.min(...ranges),site.id);
  }
});

test('a national network has city and suburban sites, and each scheduled truck uses a road connection',()=>{
  assert.ok(warehouses.length>=150);
  assert.ok(fleet.length>=warehouses.length*7);
  for(const city of ['mur','arh','kal','krasnodar','tym','yak','mag','pka','vvo','sakhalin','pevek']) {
    assert.ok(warehouses.some(site=>site.id===city),city);
    assert.ok(fleet.some(truck=>truck.destination&&(truck.home===city||truck.destination===city)),city);
  }
  const active=fleet.filter(truck=>truck.destination);
  assert.ok(active.length>=warehouses.length);
  assert.equal(new Set(fleet.map(truck=>truck.id)).size,fleet.length);
  const connected=new Map(warehouses.map(site=>[site.id,new Set()]));
  for(const {a,b} of roads) { connected.get(a).add(b); connected.get(b).add(a); }
  for(const {home,destination,id,capacity,load} of active) {
    assert.ok(load>0&&load<=capacity,id);
    const visited=new Set([home]);
    for(const node of visited) for(const next of connected.get(node)) visited.add(next);
    assert.ok(visited.has(destination),id);
  }
});
