import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fleet, roads, warehouses } from '../app/data.mjs';
import { planRoutes } from '../app/domain.mjs';
import { SensorHistory, sensorReading } from '../app/telemetry-store.mjs';

test('the full fleet shares a captured time window with accurate readings and provenance',()=>{
  const history=new SensorHistory([...fleet,...warehouses]);
  const asset=fleet.find(vehicle=>vehicle.refrigerated);
  const day=24*3600;
  assert.equal(history.capture(120),true);
  assert.equal(history.capture(130),false);
  assert.deepEqual(history.samples(asset.id,180,120).map(({observed})=>observed),[false,true,false]);
  assert.equal(history.records?.size??0,0);
  history.capture(day+600);
  const samples=history.samples(asset.id,day+660,day+120);
  assert.deepEqual(samples.slice(0,3).map(({observed})=>observed),[false,true,true]);
  assert.deepEqual(samples.at(-2),{time:day+600,observed:true,...sensorReading(asset,day+600)});
  assert.equal(samples.at(-1).observed,false);
});

test('reusing the road index preserves route choices and keeps per-trip costs and constraints',async()=>{
  const {createRoutePlanner}=await import('../app/domain.mjs');
  const plan=createRoutePlanner(roads);
  const v=fleet.find(asset=>asset.id==='TR-421');
  for(const [criterion,options] of [['fast',{maxRoutes:1}],['distance',{}],['balanced',{closed:['ufa:ekb'],traffic:4}]]) {
    assert.deepEqual(plan('msk','ekb',v,12,criterion,options),planRoutes(roads,'msk','ekb',v,12,criterion,options));
  }
  const [light]=plan('msk','ekb',v,8,'fast',{maxRoutes:1});
  const [heavy]=plan('msk','ekb',v,14,'fast',{maxRoutes:1});
  assert.deepEqual(light.nodes,heavy.nodes);
  assert.ok(heavy.fuel>light.fuel);
  assert.deepEqual(plan('msk','ekb',v,100,'fast'),[]);
});

test('automatic graphics selects a lighter profile on low-resource devices',async()=>{
  const {chooseGraphics,graphicsProfiles}=await import('../app/graphics.mjs');
  assert.equal(chooseGraphics('auto',{hardwareConcurrency:4}),graphicsProfiles.economy);
  assert.equal(chooseGraphics('auto',{hardwareConcurrency:8,deviceMemory:4}),graphicsProfiles.economy);
  assert.equal(chooseGraphics('auto',{hardwareConcurrency:8,deviceMemory:8}),graphicsProfiles.balanced);
  assert.equal(chooseGraphics('high',{hardwareConcurrency:2}),graphicsProfiles.high);
  assert.ok(graphicsProfiles.economy.maxPixelRatio<graphicsProfiles.high.maxPixelRatio);
  assert.ok(graphicsProfiles.economy.shadowSize<graphicsProfiles.high.shadowSize);
});

test('prepared map layers retain disconnected rings and projected road bounds',async()=>{
  const {prepareMapLayer}=await import('../app/map-geometry.mjs');
  const {projectMapPoint}=await import('../app/spatial.mjs');
  const ring=[[34,54],[36,55],[35,56],[34,54]];
  const inland=[[35,54.6],[35.1,54.6],[35.2,54.8],[35,54.6]];
  const regions=prepareMapLayer('regions.geojson',{features:[{geometry:{type:'Polygon',coordinates:[ring,inland]}}]});
  assert.equal(regions.path.match(/M/g).length,2);
  assert.equal(regions.path.match(/Z/g).length,2);
  const details=prepareMapLayer('cartography.json',{roads:[[1,'М-1',ring]],rail:[inland],places:[],airports:[]});
  const major=details.major[0];
  assert.equal(major.box.x,projectMapPoint(...ring[0])[0]);
  assert.ok(major.box.w>0&&major.box.h>0);
  assert.equal(details.rail.length,1);
});

test('semi-trailer wheels retain all their geometry in three instanced batches',async()=>{
  const {makeVehicle}=await import('../app/vehicle-scene.mjs');
  const original=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
  try {
    const {body}=makeVehicle(fleet.find(vehicle=>vehicle.kind==='semi'));
    const counts=[];
    body.traverse(mesh=>{
      if(mesh.isInstancedMesh&&(mesh.geometry.type==='LatheGeometry'||mesh.geometry.parameters.radialSegments===6)) counts.push(mesh.count);
    });
    assert.deepEqual(counts.sort((a,b)=>a-b),[10,80,100]);
  } finally { globalThis.document=original; }
});
