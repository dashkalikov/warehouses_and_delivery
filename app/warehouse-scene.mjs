import * as T from './vendor/three.mjs';
import { SceneParts, disposeScene } from './scene-kit.mjs';
import { facilityLayout, yardLoopState } from './spatial.mjs';
import { warehouseStaff } from './operations.mjs';
import { seatedDriver, segment, warehousePerson } from './people-scene.mjs';
import { planShift, workMotion } from './warehouse-work.mjs';
import { handlingEquipment } from './handling-scene.mjs';

const finish = {
  steel:'#6b7d8d', girder:'#465e70', shelf:'#e19746', rubber:'#233243', asphalt:'#677481',
  yardStripe:'#f5c972', floor:'#9daab6', office:'#bccad5', panel:'#d3dfe6', window:'#326283',
};
const sectionColors={A:'#496f83', B:'#8a6351', C:'#54738e', D:'#4c7061', E:'#3b8199', F:'#756594', G:'#9a7643', K:'#56657e'};
const cargo=['#b69065','#d2ad7e','#c5986a','#957961','#ad8456','#be9c71','#a6aa92'];

function pallet(s,x,y,z,seed,meters,loaded=true) {
  const wood='#89694c';
  const add=(a,b,c,w,h,d,color)=>s.box(x+a/meters,y+b/meters,z+c/meters,w/meters,h/meters,d/meters,color);
  for(let i=0;i<3;i++) add(i*.49,0,0,.22,.088,.8,wood);
  for(let i=0;i<5;i++) add(0,.091,i*.162,1.2,.04,.149,'#c29a6b');
  if (!loaded) return;
  for(let a=0;a<2;a++) for(let b=0;b<2;b++) {
    const xx=.025+a*.581, zz=.027+b*.373;
    const color=cargo[(seed+a+b*2)%cargo.length];
    const h=.44+((seed+a+b)%3)*.127;
    add(xx,.132,zz,.55,h,.349,color);
    add(xx+.22,.133+h,zz,.062,.008,.349,'#debf98');
    add(xx+.073,.27,zz+.349,.150,.086,.004,'#e9e4d8');
    for(let bar=0;bar<4;bar++) add(xx+.084+bar*.016,.285,zz+.354,.006,.035,.003,'#73736b');
  }
}

function rack(s,x,z,w,d,seed,meters,tiers=3) {
  const bays=Math.max(1,Math.floor(w*meters/2.8));
  const bayWidth=w/bays;
  for(let i=0;i<=bays;i++) {
    const px=x+bayWidth*i-.023;
    for(const pz of [z,z+d-.05]) {
      s.box(px,.025,pz,.046,1.77,.05,finish.girder,'steel');
      s.box(px-.015,.025,pz-.015,.076,.023,.079,'#4e5962','steel');
      s.box(px-.010,.045,pz+.046,.066,.125,.022,'#dca647','paint');
    }
    for(let level=0;level<4;level++) {
      const brace=Math.hypot(.37,d-.06);
      s.box(px+.014,.335+level*.389-brace/2,z+d/2-.009,.018,brace,.018,'#77909e','steel',Math.atan2(d-.06,.37));
    }
  }
  for(let t=0;t<tiers;t++) {
    const y=.19+t*.51;
    for(const z0 of [z,z+d-.07]) s.box(x,y,z0,w,.075,.075,finish.shelf,'paint');
    s.box(x+.025,y+.068,z+.035,w-.05,.026,d-.07,finish.steel,'steel');
    for(let p=0;p<bays;p++) {
      const bx=x+p*bayWidth;
      s.box(bx+.042,y+.020,z+d+.007,.092,.029,.006,'#e5e6dc');
      for(let slot=0;slot<2;slot++) if((p+slot*3+seed+t)%6!==0) {
        pallet(s,bx+bayWidth*(.25+slot*.5)-.60/meters,y+.10,z+d-.045-.8/meters,seed+p+t+slot,meters);
      }
    }
  }
}

function bench(s,x,z,width=1.1) {
  for(const xx of [x,x+width-.052]) for(const zz of [z,z+.40]) s.box(xx,.026,zz,.052,.44,.052,finish.girder,'steel');
  s.box(x,.46,z,width,.062,.46,finish.office);
  s.box(x+.08,.53,z+.12,.27,.055,.21,'#495769');
  s.box(x+.13,.585,z+.21,.155,.14,.025,'#263f58','glass');
  s.box(x+width-.35,.52,z+.06,.27,.215,.31,'#b88a5e');
}

function forklift(meters,paint,driver) {
  const s=new SceneParts(), lift=new SceneParts();
  const wheels=[];
  const steel='#3c494d', tire='#262c30', step='#596468';
  s.profile([[-1.27,.28],[-1.29,.64],[-1.10,.89],[-.65,.93],[-.41,.80],[-.41,.42],[.38,.42],[.38,.61],[.91,.61],[.92,.27]],0,0,-.47,.94,paint,'paint',.058);
  s.box(-.49,.56,-.402,1.03,.067,.804,tire,'rubber');
  for(const sign of [-1,1]) {
    const side=sign*.475;
    for(const [x,radius] of [[-.77,.273],[.56,.339]]) {
      const wheel=new SceneParts();
      wheel.cylinder(0,0,0,radius,.173,tire,'rubber','z',24);
      wheel.cylinder(0,0,sign*.089,radius*.58,.033,step,'steel','z',20);
      wheel.cylinder(0,0,sign*.114,radius*.26,.047,'#a3a6a6','steel','z',16);
      for(let n=0;n<6;n++) {
        const a=n*Math.PI/3;
        wheel.cylinder(radius*.42*Math.cos(a),radius*.42*Math.sin(a),sign*.11,.013,.024,'#aeb2ad','steel','z',8);
      }
      const hub=wheel.finish();
      hub.position.set(x,radius,side);
      wheels.push({hub,radius});
      s.group.add(hub);
    }
    s.box(-.40,.393,side-.074,.45,.067,.15,step,'steel');
    for(let n=0;n<5;n++) s.box(-.38+n*.079,.461,side-.065,.034,.010,.13,'#97a1a0','steel');
    segment(s,[-.91,.83,sign*.436],[-.82,2.05,sign*.436],.040,steel,'steel');
    segment(s,[.60,.68,sign*.436],[.41,2.05,sign*.436],.044,steel,'steel');
    s.box(-.89,2.035,side-.041,1.37,.071,.082,steel,'steel');
    s.box(.383,1.889,side-.04,.089,.092,.089,'#d8e4dd','light');
    s.box(-1.302,.67,side*.91-.036,.04,.055,.073,'#a8343a','light');
    s.box(.82,.394,sign*.34-.043,.086,1.69,.086,steel,'steel');
    s.box(.906,.39,sign*.34-.017,.039,1.59,.035,'#748186','aluminum');
    s.cylinder(.738,.78,sign*.253,.037,.66,steel,'steel','y',12);
    s.cylinder(.738,1.33,sign*.253,.021,.62,'#a8b6bc','aluminum','y',12);
    lift.box(.873,.12,sign*.255-.049,.112,.455,.098,steel,'steel');
    lift.profile([[0,0],[.89,0],[1.03,.024],[1.00,.049],[0,.079]],.94,.107,sign*.255-.049,.098,steel,'steel',.012);
  }
  for(let n=0;n<6;n++) s.box(-.88+n*.246,2.051,-.442,.07,.044,.884,steel,'steel');
  for(let n=0;n<7;n++) s.box(-1.294,.43+n*.044,-.258,.029,.021,.516,'#39454a','rubber');
  for(let n=0;n<4;n++) lift.box(.949,.33+n*.105,-.375,.043,.041,.75,'#506166','steel');
  s.box(.79,2.038,-.363,.13,.088,.726,steel,'steel');
  s.cylinder(-.65,2.116,.35,.083,.044,steel,'rubber','y',18);
  s.cylinder(-.65,2.192,.35,.071,.113,'#f3ab39','light','y',18);
  segment(s,[.44,.63,.01],[.094,1.235,.01],.075,steel,'rubber');
  s.object(new T.TorusGeometry(.146,.019,10,32),.08,1.25,0,tire,'rubber',[Math.PI/4,Math.PI/2]);
  for(const z of [.26,.318]) segment(s,[.47,.69,z],[.39,1.06,z],.019,steel,'steel');
  const cabin=new T.Group();
  cabin.position.x=-.35;
  cabin.rotation.y=Math.PI;
  const chair=new SceneParts(), avatar=new SceneParts();
  const settings={x:0,y:.99,z:0,wheelX:-.43,wheelY:1.25,variant:driver?.index??0,forklift:true};
  seatedDriver(chair,{...settings,empty:true});
  if(driver) seatedDriver(avatar,{...settings,seat:false});
  const operator=avatar.finish();
  cabin.add(chair.finish(),operator);
  s.group.add(cabin);
  if(driver) pallet(lift,.98,.167,-.40,driver.index,1);
  const carriage=lift.finish();
  s.group.add(carriage);
  const group=s.finish();
  group.scale.setScalar(1/meters);
  return {group,carriage,operator,wheels};
}

function zoneInterior(s, zone, seed, conveyors, meters, clearance=0) {
  const {x,z,w,id} = zone;
  const d=zone.d-Math.max(.48,clearance);
  const insideX=x+.25, insideZ=z+Math.min(.35,d*.29);
  if (id==='C'||id==='D') {
    const rows=Math.max(1,Math.floor((d-.40)/1.48));
    const segments=Math.max(1,Math.floor(w/2.4));
    for(let r=0;r<rows;r++) for(let i=0;i<segments;i++) {
      const width=(w-.52-(segments-1)*.18)/segments;
      rack(s,insideX+i*(width+.18),insideZ+r*1.45,width,.69,seed+i+r,meters);
    }
  } else if(id==='E') {
    s.box(insideX,.04,insideZ,w-.50,1.57,.13,'#b1cad7','paint');
    s.box(insideX,.04,insideZ,.12,1.57,Math.max(.22,Math.min(d-.85,2.1)),'#b8d6df','paint');
    s.box(insideX+.28,1.18,insideZ+.15,.58,.26,.18,'#608391','steel');
    for(let i=0;i<Math.floor((w-.60)/.59);i++) pallet(s,insideX+.10+i*.58,.04,insideZ+.63,seed+i,meters);
    for(let row=1.50;row<d-1.12;row+=1.55) {
      rack(s,insideX+.12,insideZ+row,w-.80,.51,seed+Math.round(row),meters,2);
    }
  } else if(id==='F') {
    const length=Math.max(.8,w-1.1);
    s.box(insideX,.50,insideZ,length,.065,.49,'#454f63','steel');
    s.box(insideX,.568,insideZ+.025,length,.06,.44,'#455368','rubber');
    for(const z0 of [insideZ,insideZ+.46]) s.box(insideX,.618,z0,length,.041,.044,'#8398ac','aluminum');
    for(let p=.035;p<length-.045;p+=.106) s.box(insideX+p,.63,insideZ+.05,.041,.024,.39,'#8293a0','steel');
    for(let p=0;p<length-.13;p+=.42) {
      s.box(insideX+p,.07,insideZ+.015,.045,.43,.40,'#596d83','steel');
      s.box(insideX+p+.064,.065,insideZ+.383,.042,.44,.039,'#63778a','steel');
    }
    const packages=[];
    const count=Math.max(1,Math.floor(length/.85));
    const sliding=new SceneParts();
    for(let i=0;i<count;i++) {
      const parcel=new SceneParts();
      const height=i%2===0?.145:.215;
      parcel.box(-.15,0,-.132,.30,height,.264,cargo[(seed+i)%cargo.length]);
      parcel.box(-.027,height,-.132,.054,.004,.264,'#e4c79e');
      parcel.box(-.11,height,.018,.079,.005,.064,'#eff0e6');
      const mesh=parcel.finish();
      sliding.group.add(mesh);
      packages.push(mesh);
    }
    s.group.add(sliding.group);
    conveyors.push({boxes:packages,x:insideX+.16,z:insideZ+.245,length:length-.32});
    for(const end of [insideX+.03,insideX+length-.24]) {
      s.box(end,.659,insideZ,.20,.25,.05,'#355273','paint');
      s.box(end,.659,insideZ+.439,.20,.25,.05,'#355273','paint');
      s.box(end,.905,insideZ,.20,.065,.489,'#587b97','steel');
    }
    if(d>2.45) bench(s,insideX,insideZ+1.2,Math.min(1.25,w-.50));
    for(let row=1.38;row<d-.63;row+=1.22) {
      for(let col=.31;col<length-.25;col+=.92) {
        pallet(s,insideX+col,.046,insideZ+row,seed+Math.floor(row+col),meters,(Math.floor(col+row)+seed)%4!==0);
      }
      s.box(insideX,.045,insideZ+row-.07,length,.005,.018,'#d1be85');
    }
  } else if(id==='K') {
    for(let i=0;i<Math.max(1,Math.floor((w-.42)/1.2));i++) {
      s.box(insideX+i*1.14,.03,insideZ,.57,.97,.52,'#47637c','paint');
      s.box(insideX+.11+i*1.14,.79,insideZ+.526,.34,.09,.018,'#91e8bb','light');
      s.box(insideX+.072+i*1.14,.31,insideZ+.526,.037,.25,.027,'#273d4d');
    }
    if(d>1.8) {
      const parked=forklift(meters,'#597989').group;
      parked.position.set(insideX+.58,.045,insideZ+.98);
      s.group.add(parked);
    }
  } else {
    const stepX=Math.max(.30,2.45/meters), stepZ=Math.max(.53,4.2/meters);
    const endX=x+w-.24-1.20/meters;
    const endZ=z+d-.13-.8/meters;
    let row=0;
    for(let pz=insideZ;pz<=endZ;pz+=stepZ) {
      let col=0;
      for(let px=insideX;px<=endX;px+=stepX) {
        const slotW=1.45/meters, slotD=1.08/meters;
        s.box(px-.025,.045,pz-.028,slotW,.005,.011,'#c7b480');
        s.box(px-.025,.045,pz+slotD-.035,slotW,.005,.011,'#c7b480');
        if((row*3+col+seed)%5!==0) pallet(s,px,.044,pz,seed+col+row,meters,id!=='B'||col%4!==1);
        col++;
      }
      row++;
    }
  }
}

function sideBox(parts,hall,side,along,y,normal,w,h,d,color,surface) {
  const x=hall.x,z=hall.z;
  if(side==='south') parts.box(x+along,y,z+hall.d+normal,w,h,d,color,surface);
  if(side==='north') parts.box(x+along,y,z-normal-d,w,h,d,color,surface);
  if(side==='east') parts.box(x+hall.w+normal,y,z+along,d,h,w,color,surface);
  if(side==='west') parts.box(x-normal-d,y,z+along,d,h,w,color,surface);
}

function dockNumber(parts,hall,dock) {
  const {x,z,w,d}=hall;
  const offset=dock.offset;
  const positions={
    north:[x+offset,z-.18,Math.PI],south:[x+offset,z+d+.18,0],
    west:[x-.18,z+offset,-Math.PI/2],east:[x+w+.18,z+offset,Math.PI/2],
  };
  const [px,pz,heading]=positions[dock.side];
  parts.label(String(dock.number).padStart(2,'0'),px,1.73,pz,.42,.16,{angle:0,heading,font:87,background:'#29445a'});
}

function facade(walls,site,hall,side,docks,color) {
  const vertical=side==='east'||side==='west';
  const length=vertical?hall.d:hall.w;
  const top=hall.height;
  const exterior=(along,y,normal,w,h,d,col,material)=>sideBox(walls,hall,side,along,y,normal,w,h,d,col,material);
  const paint=(start,end)=>{
    if(end-start<.035) return;
    exterior(start,.01,-.049,end-start,top,.11,color,'paint');
    exterior(start,.02,.066,end-start,.28,.024,'#b3bdc4');
    for(let a=start+.08;a<end-.10;a+=.26) exterior(a,.31,.065,.020,top-.40,.022,'#a0b3c0','steel');
    for(let a=start+.18;a<end-.14;a+=1.94) {
      exterior(a,.004,.097,.034,top-.12,.038,'#82929b','aluminum');
      exterior(a-.015,.20,.132,.063,.041,.011,'#9aa7aa','steel');
      exterior(a-.015,top-.62,.132,.063,.041,.011,'#9aa7aa','steel');
    }
    if(end-start>1.35) for(let a=start+.30;a<end-.92;a+=1.17) {
      exterior(a,top-.68,.075,.75,.25,.050,'#183d57','glass');
      exterior(a+.027,top-.64,.126,.693,.17,.012,'#5388a1','glass');
      exterior(a+.362,top-.655,.14,.021,.21,.017,'#7e9bab','aluminum');
      exterior(a+.01,top-.696,.141,.73,.022,.046,'#a6b7bf','aluminum');
    }
  };
  let cursor=0;
  for(const dock of docks) {
    const left=dock.offset-dock.width/2;
    paint(cursor,left);
    exterior(left,1.43,-.055,dock.width,top-1.43,.11,color,'paint');
    exterior(left,.075,.026,dock.width,1.36,.085,'#203749','rubber');
    exterior(left+.105,.16,.113,dock.width-.21,1.22,.055,'#b4c4cf','steel');
    for(let y=.23;y<1.34;y+=.119) exterior(left+.105,y,.17,dock.width-.21,.017,.022,'#768c9e','steel');
    for(const rail of [left+.079,left+dock.width-.104]) {
      exterior(rail,.13,.176,.029,1.23,.036,'#33464f','steel');
      exterior(rail-.007,.176,.211,.042,.28,.036,'#2a353b','rubber');
    }
    exterior(left+.12,.14,.189,dock.width-.24,.043,.046,'#3c4446','rubber');
    exterior(left+dock.width*.44,.28,.191,dock.width*.12,.041,.024,'#3c505d','steel');
    exterior(left-.07,1.50,.08,dock.width+.14,.073,.48,'#526879','paint');
    exterior(left-.07,1.48,.54,dock.width+.14,.101,.047,'#8b9ea9','aluminum');
    dockNumber(walls,hall,dock);
    for(const edge of [left-.085,left+dock.width+.055]) {
      sideBox(site,hall,side,edge,.025,.20,.05,.68,.066,'#eab84b','paint');
      exterior(edge,.17,.184,.065,.11,.077,'#293841','rubber');
      exterior(edge,1.31,.131,.047,.11,.06,'#81cfaf','light');
    }
    sideBox(site,hall,side,left-.10,-.035,.08,dock.width+.20,.21,.80,'#8395a2');
    sideBox(site,hall,side,left+.11,.164,.32,dock.width-.22,.022,.485,'#5b686e','steel');
    for(let a=left+.15;a<left+dock.width-.12;a+=.083) {
      sideBox(site,hall,side,a,.187,.348,.023,.003,.418,'#9da9ad','steel');
    }
    sideBox(site,hall,side,left,.003,.93,dock.width,.024,.055,finish.yardStripe);
    for (const edge of [left,left+dock.width-.050]) sideBox(site,hall,side,edge,.001,.98,.05,.014,2.1,finish.yardStripe);
    cursor=left+dock.width;
  }
  paint(cursor,length);
  exterior(-.026,top-.07,.01,length+.052,.103,.09,'#596e82','steel');
}

function roof(parts,hall,color) {
  const {x,z,w,d,height,roof:form}=hall;
  const y=height+.07;
  if(form==='gable') {
    const rise=d*.102;
    const angle=Math.atan(rise/(d/2));
    const hypot=Math.hypot(d/2+.22,rise);
    for(const sign of [-1,1]) {
      const z0=z+d/2+sign*d/4-hypot/2;
      parts.box(x-.19,y+rise/2,z0,w+.38,.12,hypot,color,'paint',sign*angle);
      for(let p=.2;p<w;p+=.55) parts.box(x+p,y+rise/2+.117,z0,.028,.028,hypot,'#aebac7','paint',sign*angle);
      parts.box(x+w*.25,y+rise/2+.137,z0+hypot*.40,w*.47,.055,hypot*.20,'#6e9ab4','glass',sign*angle);
    }
    parts.box(x-.18,y+rise+.03,z+d/2-.084,w+.36,.085,.168,'#a5b4c2','steel');
    for (const end of [x+.065,x+w+.077]) {
      const trim=parts.profile([[0,0],[d/2,rise+.04],[d,0]],end,height,z,.12,'#8296ab','paint',0);
      trim.rotation.y=-Math.PI/2;
    }
  } else if(form==='saw') {
    const span=d/3, rise=.56, angle=Math.atan(rise/span);
    for(let bay=0;bay<3;bay++) {
      const z0=z+bay*span;
      parts.box(x-.15,y+rise*.5,z0,w+.30,.13,span+.14,color,'paint',angle);
      for(let p=.3;p<w;p+=.61) parts.box(x+p,y+rise*.5+.11,z0,.025,.027,span,'#a0acbd','steel',angle);
      parts.box(x-.12,y+.07,z0+.03,w+.24,rise,.093,'#5a829e','glass');
    }
  } else {
    parts.box(x-.14,y,z-.14,w+.28,.16,d+.28,color,'paint');
    for(let p=.3;p<w;p+=.85) parts.box(x+p,y+.15,z-.06,.036,.021,d+.12,'#a3b3c4','steel');
    for(let p=.9;p<w-.7;p+=2.3) parts.box(x+p,y+.16,z+d*.34,.96,.095,d*.22,'#628aa3','glass');
    for(const side of ['south','north','east','west']) {
      const size=side==='south'||side==='north'?w:d;
      sideBox(parts,hall,side,0,y+.14,-.085,size,.16,.11,'#9faebb','steel');
    }
  }
  for (let i=0;i<Math.max(1,Math.floor(w/9));i++) {
    const rr=x+.7+i*2.0;
    const motor=y+(form==='gable'?d*.048:form==='saw'?.5:.18);
    parts.box(rr,motor,z+d*.74,.72,.24,.57,'#6e8195','steel');
    parts.box(rr-.031,motor-.091,z+d*.74-.030,.782,.100,.63,'#627381','steel');
    parts.box(rr+.051,motor+.044,z+d*.74+.571,.61,.173,.018,'#3d505c','steel');
    for(let j=0;j<5;j++) parts.box(rr+.062,motor+.057+j*.029,z+d*.74+.591,.589,.009,.011,'#71848c','aluminum');
    parts.cylinder(rr+.36,motor+.253,z+d*.74+.28,.19,.036,'#394b60','steel','y',20);
    for(let j=0;j<5;j++) parts.box(rr+.08+j*.117,motor+.276,z+d*.74+.076,.033,.014,.40,'#9faebc','aluminum');
  }
}

function yard(site,plan) {
  site.box(-3.7,-.33,-3.55,plan.w+7.4,.18,plan.d+7.1,'#3a4b59');
  site.box(-3.5,-.15,-3.4,plan.w+7.0,.15,plan.d+6.8,finish.asphalt,'asphalt');
  for(const x of [-3.37,plan.w+3.24]) site.box(x,0,-3.35,.13,.13,plan.d+6.7,'#93a2ad','concrete');
  site.box(-3.29,0,-3.35,plan.w+6.58,.13,.13,'#93a2ad','concrete');
  for(let x=-2.8;x<plan.w+2.6;x+=.84) site.box(x,.009,plan.d+2.92,.49,.008,.043,'#dce2dc');
  site.box(-2.95,.006,plan.d+3.16,plan.w+5.90,.009,.035,'#afb7ae');
  for(let x=.20;x<plan.w;x+=2.5) {
    site.box(x,.008,plan.d+3.03,.22,.010,.073,'#3c4649','steel');
    for(let slot=0;slot<5;slot++) site.box(x+.02+slot*.042,.018,plan.d+3.04,.013,.003,.050,'#68747a','steel');
  }
  for(const x of [-2.71,plan.w+2.65]) {
    const z=plan.d+1.91;
    site.box(x-.135,0,z-.13,.27,.087,.26,'#9eacb6','concrete');
    site.cylinder(x,1.0,z,.045,1.95,'#566d80','steel','y',12);
    site.box(x-.28,1.91,z-.041,.56,.049,.082,'#566d80','steel');
    for(const x0 of [x-.284,x+.164]) site.box(x0,1.884,z-.062,.12,.052,.123,'#d9e3e3','light');
  }
  site.box(-2.9,0,-2.73,1.35,.91,1.08,'#adbcc6','paint');
  site.box(-2.97,.91,-2.80,1.49,.065,1.22,'#5f768a','steel');
  site.box(-2.78,.47,-1.641,1.13,.29,.038,'#33617a','glass');
  site.box(-1.546,.49,-2.53,.038,.28,.71,'#33617a','glass');
  for(let i=0;i<5;i++) site.box(-1.44+i*.165,.009,-2.5,.080,.013,.83,'#f0e8ca');
}

function drivingLane(hall) {
  const horizontal=hall.w>=hall.d*.8;
  const length=horizontal?hall.w:hall.d;
  const center=(horizontal?hall.d:hall.w)/2;
  const at=(along,offset)=>new T.Vector3(hall.x+(horizontal?along:center+offset),.045,hall.z+(horizontal?center+offset:along));
  return new T.CatmullRomCurve3([
    at(2.20,-.35),at(length-2.20,-.35),at(length-1.60,0),
    at(length-2.20,.35),at(2.20,.35),at(1.60,0),
  ],true);
}

function workstation(site,{x,z,task,index},meters) {
  const s=new SceneParts();
  const metal='#5f7179', painted='#475f70';
  const stack=task==='stack', low=task==='repair'||stack;
  const height=stack?.455:low?.49:.92, width=stack?.61:task==='pick'?1.6:1.23;
  const tableX=stack?.043:-width/2;
  const tableZ=-1.08, tableD=.54;
  for(const xx of [tableX,tableX+width-.06]) for(const zz of [tableZ,tableZ+tableD-.06]) {
    s.box(xx,0,zz,.06,height,.06,metal,'steel');
    s.box(xx-.033,0,zz-.032,.126,.026,.126,metal,'steel');
  }
  s.box(tableX,height,tableZ-.007,width,.055,tableD+.014,low?metal:'#ad9d82','steel');
  s.box(tableX+.045,.19,tableZ+.08,width-.09,.035,.35,metal,'steel');
  for(const xx of [tableX+.063,tableX+width-.127]) s.box(xx,.3,tableZ+.02,.064,.05,.50,metal,'steel');
  if(stack) {
    for(const xx of [-.67,-.43,-.18]) s.box(xx,.018,tableZ,.079,.070,.59,'#81674e');
    s.box(-.72,.088,tableZ,.67,.052,.59,'#b4956e');
    s.box(-.62,.140,tableZ+.089,.505,.23,.43,'#ba9369');
    s.box(-.435,.371,tableZ+.089,.047,.004,.43,'#dbc19c');
    s.box(-.58,.23,tableZ+.519,.102,.057,.006,'#e5e1d0');
  } else if(low) {
    s.cylinder(-.07,.66,tableZ+.33,.146,.32,painted,'paint','x',20);
    for(let p=0;p<6;p++) s.cylinder(-.19+p*.046,.66,tableZ+.33,.153,.019,metal,'steel','x',16);
    s.cylinder(.105,.66,tableZ+.33,.051,.116,'#a0abad','aluminum','x',14);
    s.box(.22,.546,tableZ+.13,.277,.044,.103,'#9bacaa','steel');
  } else if(task==='pick') {
    for(let n=0;n<9;n++) s.cylinder(-.69+n*.174,.994,tableZ+.28,.029,.43,metal,'steel','z',12);
  } else if(task==='cold'||task==='supervise'||task==='dock') {
    s.box(-.47,.975,tableZ+.045,.37,.024,.21,painted,'paint');
    s.profile([[0,0],[.37,0],[.37,.23],[0,.23]],-.47,1.11,tableZ+.08,.026,painted,'paint',.009);
    s.box(-.454,1.124,tableZ+.107,.341,.20,.006,'#7ca6ad','glass');
  } else if(task==='seal') {
    s.box(-.24,.975,tableZ+.17,.49,.21,.30,'#c8a579');
    s.box(-.024,1.186,tableZ+.17,.052,.006,.30,'#ecd5ad');
    s.cylinder(-.42,.999,tableZ+.12,.086,.048,'#d2a768','matte','y',20);
    s.cylinder(-.42,1.024,tableZ+.12,.044,.005,'#ae8761','matte','y',16);
    s.box(.29,.976,tableZ+.06,.23,.032,.18,'#b2bab7','steel');
  } else {
    const h=.17+(index%4)*.055;
    s.box(-.47,.975,tableZ+.15,.34,h,.28,cargo[index%cargo.length]);
    s.box(-.328,.975+h,tableZ+.15,.057,.007,.28,'#dac3a1');
    s.box(-.433,1.035,tableZ+.434,.12,.055,.004,'#f1ebdc');
  }
  s.box(-width/2-.10,.006,-.46,width+.20,.005,.80,'#697471','rubber');
  for(const e of [-width/2-.12,width/2+.10]) s.box(e,.011,-.46,.025,.004,.80,'#e2b462');
  const group=s.finish();
  group.position.set(x,.045,z);
  group.scale.setScalar(1/meters);
  site.group.add(group);
}

function batchWorkers(workers) {
  const group=new T.Group();
  const batches=new Map();
  for(const {group:rig} of workers) rig.traverse(mesh=>{
    if(!mesh.isMesh) return;
    const {geometry,material}=mesh;
    const key=[geometry.uuid,material.color.getHex(),material.roughness,material.metalness,material.clearcoat,material.emissive.getHex()].join(':');
    if(!batches.has(key)) batches.set(key,{geometry,material,parts:[]});
    const {parts}=batches.get(key);
    const local=[];
    if (mesh.isInstancedMesh) for(let i=0;i<mesh.count;i++) {
      const matrix=new T.Matrix4();
      mesh.getMatrixAt(i,matrix);
      local.push(matrix);
    }
    parts.push({mesh,local});
  });
  const ordered=[...batches.values()].map(({geometry,material,parts})=>{
    const count=parts.reduce((sum,{local})=>sum+(local.length||1),0);
    const mesh=new T.InstancedMesh(geometry,material,count);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    mesh.frustumCulled=false;
    group.add(mesh);
    return {mesh,parts};
  });
  const world=new T.Matrix4();
  return {group,update() {
    for(const {group:rig} of workers) rig.updateMatrixWorld();
    for(const {mesh:batch,parts} of ordered) {
      let index=0;
      for(const {mesh,local} of parts) {
        if(local.length) for(const matrix of local) batch.setMatrixAt(index++,world.multiplyMatrices(mesh.matrixWorld,matrix));
        else batch.setMatrixAt(index++,mesh.matrixWorld);
      }
      batch.instanceMatrix.needsUpdate=true;
    }
  }};
}

function peopleOnFloor(site,plan,crew) {
  const workers=crew.filter(member=>member.task!=='drive').map(member=>{
    const {x,z,task,index}=member;
    const person=warehousePerson(index,task);
    person.group.position.set(x,.047,z);
    person.group.rotation.y=task==='climb'?0:Math.PI/2;
    const animate=handlingEquipment(site,member,person,plan.meters);
    person.group.scale.setScalar((animate?1:.95+index%4*.045)/plan.meters);
    if(!animate) workstation(site,member,plan.meters);
    return { ...person,member,animate };
  });
  const batch=batchWorkers(workers);
  const focus=new Map(workers.map(({group,member,animate})=>[member.id,{
    group,offset:1.04/plan.meters,lead:animate ? .60/plan.meters : 0,
  }]));
  return {group:batch.group,focus,update(clock) {
    for(const {member,pose,animate} of workers) {
      if(animate) animate(clock);
      else if(batch.group.visible) pose(workMotion(member.task,clock,member.index));
    }
    if(batch.group.visible) batch.update();
  }};
}

function yardFleet(plan,activities){
  const group=new T.Group();
  const dockJobs=activities.filter(job=>job.activity==='loading'||job.activity==='unloading').slice(0,4);
  const parked=activities.filter(job=>job.activity==='parked'||job.activity==='repair').slice(0,3);
  const make=(job)=>{
    const parts=new SceneParts();
    const paint=job.activity==='repair'?'#97815b':'#4d7573';
    parts.box(-.17,.119,-.67,.34,.61,1.05,'#aebbc0','aluminum');
    const cabin=parts.profile([[0,0],[.43,0],[.43,.32],[.35,.47],[.24,.56],[.03,.56]],.15,.119,.37,.30,paint,'paint',.022);
    cabin.rotation.y=-Math.PI/2;
    parts.box(-.123,.458,.736,.246,.091,.028,'#344f5a','glass');
    parts.box(.151,.443,.459,.022,.097,.173,'#344f5a','glass');
    for(const x of [-.144,.144]) for(const z of [-.46,.16,.652]) {
      parts.cylinder(x,.101,z,.10,.06,'#283239','rubber','x',14);
      parts.cylinder(x+Math.sign(x)*.027,.101,z,.045,.013,'#a7b1b3','aluminum','x',10);
    }
    const vehicle=parts.finish();
    group.add(vehicle);
    return vehicle;
  };
  dockJobs.forEach((job,i)=>{
    const dock=plan.docks[i];
    const hall=plan.halls[dock.hall];
    const transforms={
      south:[hall.x+dock.offset,hall.z+hall.d+.84,0],
      north:[hall.x+dock.offset,hall.z-.84,Math.PI],
      west:[hall.x-.84,hall.z+dock.offset,-Math.PI/2],
      east:[hall.x+hall.w+.84,hall.z+dock.offset,Math.PI/2],
    };
    const [x,z,yaw]=transforms[dock.side];
    const truck=make(job); truck.position.set(x,.012,z); truck.rotation.y=yaw;
  });
  parked.forEach((job,i)=>{
    const truck=make(job);
    truck.position.set(1+i*1.05,.013,plan.d+2.63);
    truck.rotation.y=Math.PI;
  });
  return group;
}

export function makeWarehouse(asset, selected) {
  const plan=facilityLayout(asset);
  const site=new SceneParts(), walls=new SceneParts(), roofs=new SceneParts();
  yard(site,plan);
  let vehicles, fleetKey;
  function setYard(activities) {
    const next=activities.map(job=>job.vehicle.id+':'+job.activity).join('|');
    if(next===fleetKey) return false;
    if(vehicles) {
      site.group.remove(vehicles);
      disposeScene(vehicles);
    }
    fleetKey=next;
    vehicles=yardFleet(plan,activities);
    site.group.add(vehicles);
    return true;
  }
  setYard(asset.activities??[]);
  for (const [index,hall] of plan.halls.entries()) {
    site.box(hall.x,.004,hall.z,hall.w,.035,hall.d,finish.floor,'concrete');
    for(let x=hall.x+.5;x<hall.x+hall.w-.25;x+=2.45) {
      site.box(x,.040,hall.z+.13,.009,.004,hall.d-.26,'#818b90');
    }
    for(let z=hall.z+.5;z<hall.z+hall.d-.25;z+=2.25) {
      site.box(hall.x+.13,.040,z,hall.w-.26,.004,.009,'#818b90');
    }
    const hallDocks=plan.docks.filter(dock=>dock.hall===index);
    for(const side of ['south','north','east','west']) facade(walls,site,hall,side,hallDocks.filter(dock=>dock.side===side),plan.finish);
    roof(roofs,hall,index%2?'#758596':'#8496a8');
    const standZ=hall.z+hall.d/2;
    const standX=hall.x+hall.w/2;
    if(hall.w>=hall.d*.8) {
      for(let x=hall.x+.8;x<hall.x+hall.w-.8;x+=1.18) site.box(x,.045,standZ,.57,.013,.06,'#f3d47a');
    } else {
      for(let z=hall.z+.8;z<hall.z+hall.d-.8;z+=1.18) site.box(standX,.045,z,.06,.013,.57,'#f3d47a');
    }
  }
  const highlights=new Map();
  const floorHits=[];
  const conveyors=[];
  const crew=planShift(plan,warehouseStaff(asset));
  const clearances=new Map(crew.filter(member=>member.clearance).map(member=>[member.zone,member.clearance]));
  for(const [index,zone] of plan.zones.entries()) {
    const stripe=sectionColors[zone.id];
    for(const x of [zone.x,zone.x+zone.w-.045]) site.box(x,.041,zone.z,.045,.012,zone.d,stripe);
    for(const z of [zone.z,zone.z+zone.d-.045]) site.box(zone.x,.041,z,zone.w,.012,.045,stripe);
    zoneInterior(site,zone,index+asset.docks,conveyors,plan.meters,clearances.get(zone.id));
    const hit=new T.Mesh(new T.PlaneGeometry(zone.w,zone.d),new T.MeshBasicMaterial({
      color:'#4da58e',transparent:true,opacity:.24,depthWrite:false,
    }));
    hit.rotation.x=-Math.PI/2;
    hit.position.set(zone.x+zone.w/2,.06,zone.z+zone.d/2);
    hit.userData.zone=zone.id;
    hit.visible=zone.id===selected;
    site.group.add(hit); highlights.set(zone.id,hit); floorHits.push(hit);
    const sign=site.label(zone.id,zone.x+.56,.075,zone.z+zone.d-.36,1.00,.47,{background:'#172b41',font:110});
    sign.userData.zone=zone.id;
    floorHits.push(sign);
  }
  site.label(asset.code,plan.w/2,.014,plan.d+2.17,5.9,.55,{font:61,color:'#dce5ed'});
  const assignedDriver=crew.find(member=>member.task==='drive');
  const mover=forklift(plan.meters,'#d9a041',assignedDriver);
  site.group.add(mover.group);
  const drive=drivingLane(plan.halls[0]);
  const driveLength=drive.getLength()*plan.meters;
  const direction=new T.Vector3();
  const people=peopleOnFloor(site,plan,crew);
  site.group.add(people.group);
  if(assignedDriver) people.focus.set(assignedDriver.id,{group:mover.operator,carrier:mover.group,offset:1.27/plan.meters});
  let peopleAt, peopleVisible;
  return {
    body:site.finish(), walls:walls.finish(), roof:roofs.finish(), center:[plan.w/2,.73,plan.d/2], meters:plan.meters,
    size:Math.max(plan.w+7,plan.d+7)*.665, lift:plan.halls[0].height+3.2,
    footprint:[plan.w+7.4,plan.d+7.1], highlights, floorHits, people:people.group, peopleFocus:people.focus, operator:mover.operator, setYard,
    animate(clock) {
      const {phase,travelled,dwell}=yardLoopState(clock+12,driveLength,1.25);
      drive.getPointAt(phase,mover.group.position);
      drive.getTangentAt(phase,direction);
      mover.group.rotation.y=Math.atan2(-direction.z,direction.x);
      for(const {hub,radius} of mover.wheels) hub.rotation.z=-travelled/radius;
      const lift=dwell*dwell*(3-2*dwell);
      mover.carriage.position.y=.04+.24*(phase<.5?lift:1-lift);
      if(clock!==peopleAt || people.group.visible!==peopleVisible) {
        people.update(clock);
        peopleAt=clock;
        peopleVisible=people.group.visible;
      }
      for(const conveyor of conveyors) conveyor.boxes.forEach((parcel,i)=>{
        const at=(clock*.38/(conveyor.length*plan.meters)+i/conveyor.boxes.length)%1;
        parcel.position.set(conveyor.x+at*conveyor.length,.65,conveyor.z);
        // The end scanners conceal the hand-off as a package enters or leaves the visible belt.
        parcel.scale.setScalar(Math.min(1,at/.045,(1-at)/.045));
      });
    },
  };
}
