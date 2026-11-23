import test from 'node:test';
import assert from 'node:assert/strict';
import { warehouses } from '../app/data.mjs';
import { warehouseStaff } from '../app/operations.mjs';
import { facilityLayout, yardLoopState } from '../app/spatial.mjs';
import { handlingMotion, planShift, stairMotion, workMotion } from '../app/warehouse-work.mjs';

test('every shift member has a distinct station or the forklift seat', () => {
  for (const site of warehouses) {
    const layout=facilityLayout(site);
    const crew=planShift(layout,warehouseStaff(site));
    assert.equal(crew.length,site.staff);
    assert.equal(crew.filter(worker=>worker.task==='drive').length,1);
    assert.ok(new Set(crew.map(worker=>worker.task)).size>=8);
    assert.equal(new Set(crew.map(worker=>worker.id)).size,site.staff);
    const stations=crew.filter(worker=>worker.task!=='drive');
    assert.equal(new Set(stations.map(({x,z})=>`${x},${z}`)).size,stations.length);
    for (const station of stations) {
      const zone=layout.zones.find(zone=>zone.id===station.zone);
      assert.ok(station.x>zone.x && station.x<zone.x+zone.w);
      assert.ok(station.z>zone.z && station.z<zone.z+zone.d);
    }
  }
});

test('station work is staggered and eases through a full handling cycle', () => {
  const start=workMotion('pick',0,0);
  assert.deepEqual(start,workMotion('pick',13,0));
  assert.ok(Math.abs(workMotion('pick',12.999,0).reach-start.reach)<.001);
  assert.ok(workMotion('pick',4,0).reach>.7);
  assert.ok(workMotion('pick',8,0).turn>.5);
  assert.ok(workMotion('repair',2,0).bend>workMotion('pick',2,0).bend);
  assert.notDeepEqual(workMotion('pick',4,0),workMotion('pick',4,1));
});

test('forklift travel and its lifting window agree at both ends of a loop', () => {
  const length=80, speed=1.25;
  const half=3+length/2/speed+2;
  assert.deepEqual(yardLoopState(0,length,speed),{phase:0,travelled:0,dwell:0});
  assert.equal(yardLoopState(1.5,length,speed).dwell,.5);
  assert.equal(yardLoopState(half+1.5,length,speed).phase,.5);
  assert.equal(yardLoopState(2*half,length,speed).travelled,length);
  assert.ok(yardLoopState(2*half-.001,length,speed).travelled>length-.001);
});

test('each shift includes loaders and has room for their equipment routes',()=>{
  for(const site of warehouses) {
    const plan=facilityLayout(site);
    const crew=planShift(plan,warehouseStaff(site));
    const loaders=crew.filter(person=>person.role==='Грузчик');
    assert.ok(loaders.length>=6,site.id);
    for(const task of ['climb','cart','pallet','stack','seal']) assert.ok(loaders.some(x=>x.task===task),site.id);
    for(const member of loaders.filter(person=>person.track)) {
      const zone=plan.zones.find(zone=>zone.id===member.zone);
      const course=member.track;
      for(let seconds=0;seconds<40;seconds+=.41) {
        const point=handlingMotion(course,seconds);
        const facingX=Math.cos(point.yaw), facingZ=-Math.sin(point.yaw);
        for(const along of [-.26,1.62]) for(const side of [-.34,.34]) {
          const x=point.x+(along*facingX-side*facingZ)/plan.meters;
          const z=point.z+(along*facingZ+side*facingX)/plan.meters;
          assert.ok(x>=zone.x&&x<=zone.x+zone.w&&z>=zone.z&&z<=zone.z+zone.d,member.id);
        }
      }
    }
  }
});

test('a loader alternates feet on the stairs and returns to the floor',()=>{
  const floor=stairMotion(0);
  assert.deepEqual(floor.feet,[[0,0],[0,0]]);
  const step=stairMotion(1.44);
  assert.ok(step.feet[0][1]>0 && step.feet[1][1]===0);
  const top=stairMotion(6);
  assert.ok(top.feet.every(([,y])=>y>=1.1));
  assert.deepEqual(stairMotion(13).feet,floor.feet);
});
