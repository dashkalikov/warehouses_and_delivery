import * as T from './vendor/three.mjs';
import { SceneParts } from './scene-kit.mjs';

const up=new T.Vector3(0,1,0);
const cloth=['#304e54','#416074','#484f59','#53616b'];
const skin=['#c78d69','#ae7654','#e1ae84','#a56b50','#dab08e'];
const safety=['#d8be40','#da8d3f','#bed34d','#d09f3c'];
const sphere=new T.SphereGeometry(1,14,12);
const cylinders=new Map();

export function segment(parts,a,b,radius,colour,surface='matte',endRadius=radius) {
  const direction=new T.Vector3(...b).sub(new T.Vector3(...a));
  const taper=Math.round(endRadius/radius*100)/100;
  if(!cylinders.has(taper)) cylinders.set(taper,new T.CylinderGeometry(taper,1,1,12));
  const center=a.map((value,i)=>(value+b[i])/2);
  const mesh=parts.object(cylinders.get(taper),...center,colour,surface);
  mesh.scale.set(radius,direction.length(),radius);
  mesh.quaternion.setFromUnitVectors(up,direction.normalize());
  return mesh;
}

function oval(parts,x,y,z,width,height,depth,color,surface='matte') {
  const obj=parts.object(sphere,x,y,z,color,surface);
  obj.scale.set(width,height,depth);
  return obj;
}

function head(parts,x,y,z,colour,helmet,cap='#e2cb51',variant=0) {
  // The part is modelled facing local +X.
  const hair=['#362e29','#574439','#241f22','#6d6254'][variant%4];
  oval(parts,x-.009,y+.018,z,.098,.107,.079,colour);
  oval(parts,x+.024,y-.033,z,.072,.074,.071,colour);
  oval(parts,x+.086,y-.001,z,.027,.024,.018,colour);
  oval(parts,x+.094,y-.048,z,.007,.006,.027,'#845749');
  for(const side of [-1,1]) {
    const zz=z+side*.035;
    oval(parts,x+.006,y-.004,z+side*.078,.022,.027,.012,colour);
    oval(parts,x+.084,y+.023,zz,.009,.009,.018,'#e2d3c7');
    oval(parts,x+.091,y+.023,zz,.005,.007,.006,'#3b372f');
    oval(parts,x+.084,y+.040,zz,.009,.005,.020,hair);
  }
  if(helmet) {
    oval(parts,x-.027,y+.051,z,.092,.046,.082,hair);
    oval(parts,x-.005,y+.083,z,.109,.069,.094,cap,'paint');
    oval(parts,x+.020,y+.072,z,.126,.009,.097,cap,'paint');
    oval(parts,x-.016,y+.128,z,.081,.024,.023,cap,'paint');
    for(const side of [-1,1]) segment(parts,[x-.007,y+.066,z+side*.086],[x+.012,y-.075,z+side*.059],.006,'#454549');
  } else {
    oval(parts,x-.022,y+.086,z,.094,.047,.082,hair);
    oval(parts,x-.066,y+.030,z,.046,.074,.074,hair);
    if(variant%3===0) oval(parts,x+.048,y-.065,z,.049,.034,.055,hair);
  }
}

export function warehousePerson(index,task) {
  const parts=new SceneParts();
  const torso=new SceneParts(), face=new SceneParts();
  const coat=task==='cold'?'#486582':cloth[index%cloth.length];
  const tone=skin[index%skin.length], vest=safety[index%safety.length];
  const trousers=index%3===0?'#405260':'#333e46', reflector='#e9e9d8';
  const build=.91+(index%5)*.037;
  const waist=task==='cold'?.12:.105;
  oval(torso,-.013,.045,0,waist,.13,.153*build,trousers);
  const jacket=segment(torso,[0,.035,0],[-.013,.425,0],.151*build,vest,'matte',.19*build);
  jacket.scale.x*=.61;
  oval(torso,-.014,.401,0,.102,.070,.182*build,coat);
  const band=segment(torso,[0,.128,0],[0,.163,0],.166*build,reflector,'matte',.171*build);
  band.scale.x*=.65;
  for(const side of [-1,1]) {
    segment(torso,[.097,.163,side*.087],[.099,.395,side*.104],.015,reflector);
    segment(torso,[-.104,.163,side*.086],[-.121,.388,side*.101],.015,reflector);
  }
  torso.box(.105,.182,-.071,.017,.084,.050,vest);
  torso.box(.114,.316,.038,.015,.037,.056,'#e8e7de');
  torso.box(.108,.168,-.007,.012,.196,.012,'#5d5342');
  segment(torso,[-.015,.426,0],[-.002,.523,0],.041,tone);
  head(face,0,0,0,tone,true,index%4===0?'#e1e4e1':vest,index);
  const headGroup=face.finish();
  headGroup.position.set(-.007,.596,0);
  torso.group.add(headGroup);
  const arms=[], legs=[];
  for(const side of [-1,1]) {
    const shoulder=new SceneParts(), forearm=new SceneParts(), thigh=new SceneParts(), shin=new SceneParts();
    oval(shoulder,0,-.047,0,.064,.100,.066,coat);
    segment(shoulder,[0,-.053,0],[0,-.27,0],.061,coat,'matte',.046);
    segment(forearm,[0,0,0],[0,-.232,0],.047,coat,'matte',.035);
    segment(forearm,[0,-.204,0],[0,-.23,0],.037,'#25383c');
    oval(forearm,0,-.275,0,.024,.048,.039,tone);
    oval(forearm,.023,-.265,-side*.026,.014,.028,.014,tone);
    segment(thigh,[0,0,0],[0,-.410,0],.083,trousers,'matte',.061);
    thigh.box(-.045,-.244,side*.067-.018,.082,.148,.023,trousers);
    segment(shin,[0,0,0],[0,-.337,0],.061,trousers,'matte',.043);
    const boot=new SceneParts();
    oval(boot,.047,-.016,0,.107,.059,.061,'#303638','rubber');
    boot.box(-.057,-.070,-.060,.21,.024,.12,'#25292c','rubber');
    for(let i=0;i<3;i++) boot.box(.019+i*.018,.022,-.036,.008,.006,.071,'#737876');
    const upper=shoulder.finish(), lower=forearm.finish();
    const hip=thigh.finish(), knee=shin.finish(), foot=boot.finish();
    upper.position.set(-.01,.393,side*.179*build);
    lower.position.y=-.27;
    hip.position.z=side*.094*build;
    knee.position.y=-.410;
    foot.position.y=-.337;
    upper.add(lower); torso.group.add(upper);
    knee.add(foot); hip.add(knee); parts.group.add(hip);
    arms.push({upper,lower}); legs.push({hip,knee,foot});
  }
  const tool=new SceneParts();
  const carry=task==='pick'||task==='dispatch'||task==='staging'||task==='stack';
  const freeHands=task==='cart'||task==='pallet'||task==='climb';
  const tablet=task==='supervise'||task==='cold'||task==='dock';
  if(carry) {
    tool.box(-.107,0,-.145,.214,.18,.29,'#ac8057');
    tool.box(-.026,.18,-.145,.052,.003,.29,'#d3b78c');
    tool.box(-.090,.183,-.114,.061,.004,.087,'#eef0e1');
  } else if(tablet) {
    tool.box(-.081,-.132,-.117,.028,.206,.17,'#29363d','rubber');
    tool.box(-.084,-.112,-.100,.008,.155,.137,'#76a4af','glass');
  } else if(task==='seal') {
    tool.cylinder(.01,-.094,0,.050,.047,'#cf9a49','matte','z',14);
    tool.box(-.041,-.143,-.027,.087,.048,.058,'#3f5862','paint');
    tool.box(.042,-.144,-.031,.066,.018,.062,'#78909c','steel');
  } else if(!freeHands) {
    tool.box(-.025,-.118,-.027,.043,.086,.054,'#303b41','rubber');
    tool.box(-.037,-.147,-.031,.085,.040,.061,task==='repair'?'#d49036':'#45545f');
    tool.box(.047,-.134,-.022,.005,.018,.042,'#7caba9','light');
  }
  const equipment=tool.finish();
  if(carry) parts.group.add(equipment);
  else if(!freeHands) {
    equipment.position.y=-.276;
    arms[1].lower.add(equipment);
  }
  const body=torso.finish();
  parts.group.add(body);
  const group=parts.finish();
  const table=task==='stack'?new T.Vector3(.77,.51,.32):new T.Vector3(.79,task==='pick'?1.025:.975,0);
  const hands=[new T.Vector3(),new T.Vector3()];
  function aimLimb(first,second,dx,dy,upper,lower,bend) {
    const d=Math.min(upper+lower-.001,Math.max(Math.abs(upper-lower)+.001,Math.hypot(dx,dy)));
    const joint=Math.acos((d*d-upper*upper-lower*lower)/(2*upper*lower));
    const shoulder=Math.acos((upper*upper+d*d-lower*lower)/(2*upper*d));
    first.rotation.z=Math.atan2(dx,-dy)-bend*shoulder;
    second.rotation.z=bend*joint;
  }

  function plantFeet(feet) {
    const lift=Math.abs(feet[0][1]-feet[1][1]);
    const spread=Math.abs(feet[0][0]-feet[1][0]);
    const pelvis=.755-.49*lift-.069*spread;
    body.position.set(.027,pelvis,0);
    legs.forEach(({hip,knee,foot},side)=>{
      const [x,y]=feet[side];
      hip.position.x=body.position.x;
      hip.position.y=pelvis;
      aimLimb(hip,knee,x-hip.position.x,y+.070-pelvis,.410,.337,-1);
      foot.rotation.z=-hip.rotation.z-knee.rotation.z;
    });
    return pelvis;
  }

  function grasp(x,y,spread=0) {
    for(const [i,{upper,lower}] of arms.entries()) {
      aimLimb(upper,lower,x-(body.position.x+upper.position.x),y-(body.position.y+upper.position.y),.270,.275,1);
      upper.rotation.x=(i===0?1:-1)*spread;
    }
  }

  function walk(distance,pallet) {
    const stride=pallet?.88:1.11;
    const feet=[0,.5].map(offset=>{
      const t=(distance/stride+offset)%1;
      if(t<=.6) return [stride*(.3-t),0];
      const lift=(t-.6)/.4;
      return [stride*(lift*.6-.3),.098*Math.sin(lift*Math.PI)];
    });
    plantFeet(feet);
    grasp(pallet?.405:.465,pallet?1.00:1.04);
    headGroup.rotation.z=-.095;
  }

  function climb(feet,top) {
    const height=plantFeet(feet);
    grasp(top?.28:.36,height+.29,top?.22:.43);
    headGroup.rotation.z=top?-.12:.23;
  }

  function pose({reach,turn,retrieve,bend,inspect}) {
    const squat=task==='repair'||task==='stack'?bend*.78:0;
    const rootY=.07+.410*Math.cos(squat)+.337*Math.cos(squat*.85);
    body.position.set(-.065*squat,rootY,0);
    body.rotation.z=-.32*bend;
    body.rotation.y=(turn-.25)*(carry?.9:.42);
    headGroup.rotation.z=-.24*inspect-.19*reach;
    headGroup.rotation.y=.26*(turn-reach);
    legs.forEach(({hip,knee,foot})=>{
      hip.position.set(.410*Math.sin(squat)-.337*Math.sin(.85*squat),rootY,hip.position.z);
      hip.rotation.z=squat;
      knee.rotation.z=-1.85*squat;
      foot.rotation.z=.85*squat;
    });
    for(const [i,{upper,lower}] of arms.entries()) {
      const active=i===1||carry;
      upper.rotation.z=active?.22+reach*.69+retrieve*.21:.09+inspect*.26;
      upper.rotation.x=(i===1?1:-1)*(carry?.04:.13);
      lower.rotation.z=active?.44+inspect*.58-reach*.22:.25+inspect*.65;
      lower.rotation.x=i===1?.03:-.17*inspect;
    }
    if(carry) {
      for(const [i,hand] of hands.entries()) {
        arms[i].lower.localToWorld(hand.set(0,-.277,0));
        group.worldToLocal(hand);
      }
      const carryPosition=hands[0].lerp(hands[1],.5);
      carryPosition.x+=.058;
      carryPosition.y-=.078;
      equipment.position.copy(table);
      if(task==='stack') {
        equipment.position.y-=.14*inspect;
        equipment.position.z-=.59*inspect;
      }
      equipment.position.lerp(carryPosition,retrieve);
      equipment.rotation.y=body.rotation.y*retrieve;
    }
  }
  return {group,pose,walk,climb};
}

export function seatedDriver(parts,{x,y,z,wheelX,wheelY,variant,forklift=false,empty=false,seat=true}) {
  const tone=skin[variant%skin.length], coat=cloth[variant%cloth.length];
  if(seat) {
    parts.box(x-.18,y-.05,z-.23,.38,.12,.46,'#303c43','rubber');
    parts.profile([[0,0],[.21,0],[.22,.56],[.14,.62],[.05,.61]],x+.10,y,z-.204,.408,'#364952','paint',.022);
    oval(parts,x+.260,y+.661,z,.089,.095,.12,'#38474d','rubber');
    parts.box(x-.15,y-.35,z-.178,.28,.31,.356,'#39474c','steel');
  }
  if(empty) return;
  oval(parts,x-.031,y+.263,z,.113,.244,.169,forklift?safety[variant%safety.length]:coat);
  oval(parts,x-.135,y+.303,z,.036,.192,.155,coat);
  parts.cylinder(x-.067,y+.494,z,.045,.099,tone,'matte','y',12);
  const face=new SceneParts();
  head(face,0,0,0,tone,forklift,'#e2be55',variant);
  const model=face.finish();
  model.position.set(x-.084,y+.615,z);
  model.rotation.y=Math.PI;
  parts.group.add(model);
  for(const side of [-1,1]) {
    const shoulder=[x-.041,y+.388,z+side*.147];
    const elbow=[x-.253,y+.214,z+side*.203];
    const hand=[wheelX+.012,wheelY+.018,z+side*.134];
    segment(parts,shoulder,elbow,.065,coat,'matte',.050);
    segment(parts,elbow,hand,.047,coat,'matte',.038);
    oval(parts,...hand,.056,.045,.036,tone);
    const knee=[x-.313,y-.018,z+side*.10];
    segment(parts,[x-.041,y,z+side*.089],knee,.076,'#36434b','matte',.061);
    segment(parts,knee,[x-.467,y-.293,z+side*.099],.058,'#36434b','matte',.043);
    oval(parts,x-.505,y-.313,z+side*.099,.097,.049,.061,'#252d32','rubber');
  }
  if(forklift) {
    segment(parts,[x-.139,y+.324,z-.090],[x-.139,y+.324,z+.090],.018,'#e9e7d5');
    segment(parts,[x-.032,y+.020,z-.16],[x-.134,y+.035,z+.15],.016,'#242b2f','rubber');
  } else {
    segment(parts,[x+.068,y+.413,z+.16],[x-.129,y+.060,z-.145],.015,'#20282c','rubber');
  }
}
