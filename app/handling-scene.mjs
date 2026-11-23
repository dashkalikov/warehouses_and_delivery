import { SceneParts } from './scene-kit.mjs';
import { segment } from './people-scene.mjs';
import { handlingMotion, stair, stairMotion } from './warehouse-work.mjs';

const floor=.047;
const frame='#48626a', metal='#869496', tire='#2f3a3d';

function wheel(parts,x,z,radius,width) {
  const wheel=new SceneParts();
  wheel.cylinder(0,0,0,radius,width,tire,'rubber','z',18);
  for(const side of [-1,1]) {
    wheel.cylinder(0,0,side*width*.53,radius*.64,.011,'#829298','steel','z',14);
    wheel.cylinder(0,0,side*width*.65,radius*.27,.016,'#bec5c3','aluminum','z',10);
    wheel.box(-.023,radius*.33,side*width*.55-.005,.046,.017,.019,'#56636a','steel');
  }
  const group=wheel.finish();
  group.position.set(x,radius,z);
  parts.group.add(group);
  return {group,radius};
}

function carton(parts,x,y,z,w,h,d,color) {
  parts.box(x,y,z,w,h,d,color);
  parts.box(x+w*.43,y+h,z,w*.14,.006,d,'#dbc4a6');
  parts.box(x+w*.13,y+h*.58,z+d,.092,.048,.005,'#e9e7dc');
  parts.box(x+w*.17,y+h*.59,z+d+.005,.048,.018,.004,'#6e6f68');
}

function cart(pallet) {
  const parts=new SceneParts();
  const paint=pallet?'#d99739':'#47877f';
  const deck=pallet?.155:.255, gripX=pallet?.405:.465, gripY=pallet?1.0:1.04;
  const wheels=[];
  if(pallet) {
    for(const z of [-.23,.14]) {
      parts.box(.725,.069,z,.85,.056,.098,paint,'paint');
      parts.box(1.44,.059,z+.007,.145,.048,.084,'#37464b','rubber');
      wheels.push(wheel(parts,1.48,z+.048,.045,.047));
    }
    parts.box(.63,.065,-.26,.185,.177,.52,paint,'paint');
    parts.cylinder(.70,.265,0,.067,.225,'#818d91','steel','y',14);
    parts.cylinder(.735,.401,0,.033,.14,'#afbfc0','aluminum','y',10);
    segment(parts,[.69,.28,0],[gripX,gripY,0],.027,frame,'steel');
    parts.box(.758,deck-.032,-.32,.808,.031,.64,'#a5835c');
    for(const z of [-.27,0,.22]) parts.box(.77,deck-.065,z,.775,.029,.086,'#886b4c');
    for(const z of [-.19,.19]) wheels.push(wheel(parts,.716,z,.095,.073));
  } else {
    parts.box(.55,.19,-.33,1.02,.063,.66,paint,'paint');
    parts.box(.59,.253,-.29,.94,.025,.58,'#435457','rubber');
    for(const z of [-.265,.265]) {
      segment(parts,[.58,.22,z],[gripX,gripY,z],.020,metal,'steel');
      for(const x of [.72,1.44]) {
        parts.box(x-.08,.115,z-.044,.16,.083,.088,frame,'steel');
        wheels.push(wheel(parts,x,z,.092,.062));
      }
    }
    for(const x of [.58,1.50]) parts.box(x,.21,-.33,.069,.032,.66,'#26383d','rubber');
  }
  segment(parts,[gripX,gripY,-.27],[gripX,gripY,.27],.025,tire,'rubber');
  const top=deck+(pallet?0:.022);
  carton(parts,.79,top,-.27,.36,.244,.253,'#bb9468');
  carton(parts,.79,top,.012,.365,.266,.254,'#d8ad7b');
  carton(parts,1.18,top,-.265,.344,.327,.506,'#b78d63');
  carton(parts,.805,top+.266,.017,.292,.187,.214,'#d1a773');
  return {group:parts.finish(),wheels};
}

function mobileStair() {
  const parts=new SceneParts();
  const amber='#d4a247', deck=stair.count*stair.rise, lip=stair.count*stair.run+.31;
  for(const side of [-1,1]) {
    const z=side*.34;
    segment(parts,[.13,.065,z],[lip,.065,z],.045,frame,'steel');
    segment(parts,[.13,.093,z],[1.34,deck-.072,z],.038,frame,'steel');
    for(const x of [.20,.77,1.30]) {
      const y=(x-.12)/1.18*deck+.06;
      segment(parts,[x,y,z],[x,y+.94,z],.026,amber,'paint');
    }
    segment(parts,[.13,.94,z],[1.30,deck+.99,z],.027,amber,'paint');
    segment(parts,[1.30,deck+.99,z],[lip,deck+.99,z],.028,amber,'paint');
    segment(parts,[lip,deck-.08,z],[lip,deck+.99,z],.031,amber,'paint');
    wheel(parts,.29,z,.079,.058);
    wheel(parts,1.49,z,.079,.058);
  }
  for(let i=1;i<=stair.count;i++) {
    const x=i*stair.run,y=i*stair.rise;
    const width=i===stair.count?.425:.24;
    parts.box(x-.13,y-.041,-.357,width,.041,.714,metal,'steel');
    parts.box(x-.13,y-.027,-.345,.026,.030,.69,amber,'paint');
    for(let j=0;j<5;j++) parts.box(x-.08+j*.036,y,-.299,.012,.005,.598,'#5c6f73','steel');
  }
  for(const z of [-.39,.335]) parts.box(1.84,.0,z,.057,2.25,.055,frame,'steel');
  for(const y of [.28,1.12,1.95]) {
    parts.box(1.80,y,-.385,.56,.062,.772,frame,'steel');
    carton(parts,1.84,y+.062,-.32,.32,.205,.30,'#bc946b');
    carton(parts,1.84,y+.062,.035,.36,.25,.31,'#cca177');
  }
  return parts.finish();
}

export function handlingEquipment(scene,member,person,meters) {
  if(member.track) {
    const pallet=member.task==='pallet';
    const {group,wheels}=cart(pallet);
    group.scale.setScalar(1/meters);
    scene.group.add(group);
    return clock=>{
      const {x,y,z,yaw,travelled}=handlingMotion(member.track,clock+7+member.index%9*1.33);
      group.position.set(x,y,z);
      group.rotation.y=yaw;
      for(const wheel of wheels) wheel.group.rotation.z=-travelled/wheel.radius;
      person.group.position.copy(group.position);
      person.group.rotation.y=yaw;
      person.walk(travelled,pallet);
    };
  }
  if(member.task!=='climb') return null;
  const unit=mobileStair();
  unit.position.set(member.x,floor,member.z);
  unit.scale.setScalar(1/meters);
  scene.group.add(unit);
  return clock=>{
    const {feet,top}=stairMotion(clock+1.8);
    const x=(feet[0][0]+feet[1][0])*.5, y=(feet[0][1]+feet[1][1])*.5;
    person.group.position.set(member.x+x/meters,floor+y/meters,member.z);
    person.climb(feet.map(([step,height])=>[step-x,height-y]),top);
  };
}
