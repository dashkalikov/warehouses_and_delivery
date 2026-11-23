import * as T from './vendor/three.mjs';
import { SceneParts } from './scene-kit.mjs';
import { seatedDriver, segment } from './people-scene.mjs';

export const hasCargoRoof=kind=>kind!=='flat';

export const vehicleSpecifications = {
  semi: { length:16.45,width:2.55,height:3.95, cab:2.45, radius:.51, axles:[1.18,3.65,11.82,13.04,14.26], paint:'#267b95', label:'Тягач и полуприцеп' },
  box:  { length:7.42,width:2.4,height:3.32, cab:2.08, radius:.46, axles:[1.16,5.50], paint:'#d08638', label:'Среднетоннажный фургон' },
  cold: { length:8.72,width:2.55,height:3.74, cab:2.46, radius:.50, axles:[1.28,6.39], paint:'#467bb1', label:'Изотермический кузов' },
  van:  { length:5.69,width:2.08,height:2.56, cab:2.18, radius:.36, axles:[.98,4.14], paint:'#ad514d', label:'Цельнометаллический фургон' },
  flat: { length:8.51,width:2.55,height:3.10, cab:3.03, radius:.58, axles:[1.31,5.92,7.14], paint:'#63865b', label:'Бортовая платформа' },
};
const black='#23303c', charcoal='#293846', steel='#697a89', alloy='#b1bdc3', glass='#264866';

function windowPane(s,points,color=glass,surface='glass') {
  const vertices=points.flat();
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  g.setIndex([0,1,2,0,2,3]);
  g.computeVertexNormals();
  const window=s.object(g,0,0,0,color,surface);
  window.material.side=T.DoubleSide;
  if(surface==='cab-glass') window.castShadow=false;
  return window;
}

function frontPanel(s,outline,x,y,z,depth,color,surface,bevel=.009) {
  const piece=s.profile(outline,x,y,z,depth,color,surface,bevel);
  piece.rotation.y=-Math.PI/2;
  return piece;
}

function headlamp(s,w,bottom,kind,side) {
  const width=kind==='van'?.32:kind==='flat'?.34:.39;
  const height=kind==='van'?.22:.177;
  const x=-.084,y=bottom+.235,z=side<0?.09:w-.09;
  const shell=[[0,0],[width-.04,0],[width,.043],[width-.018,height*.78],[.046,height],[0,height-.049]];
  const lens=[[.026,.026],[width-.046,.023],[width-.026,.058],[width-.05,height*.64],[.057,height-.030],[.022,height-.060]];
  const outline=points=>points.map(([u,v])=>[u*-side,v]);
  frontPanel(s,outline(shell),x,y,z,.062,'#343e44','paint',.019);
  frontPanel(s,outline(lens),x-.054,y,z,.012,'#a3bac5','glass',.007);
  const optic=x-.071;
  for(const offset of [.108,.228]) {
    s.cylinder(optic+.005,y+height*.49,z-offset*side,.043,.019,'#627783','steel','x',24);
    s.cylinder(optic-.007,y+height*.49,z-offset*side,.027,.008,'#dbe6e4','light','x',22);
  }
  segment(s,[optic,y+.016,z-.030*side],[optic,y+.016,z-(width-.055)*side],.007,'#ecf4ed','light');
  segment(s,[optic,y+.018,z-.030*side],[optic,y+.107,z-.025*side],.007,'#d9a34e','light');
}

function wheel(s,x,y,z,r,w,outer) {
  const ring=[[-.48,.64],[-.48,.78],[-.40,.94],[-.28,.994],[.28,.994],[.40,.94],[.48,.78],[.48,.64]];
  const tire=new T.LatheGeometry(ring.map(([side,height])=>new T.Vector2(height*r,side*w)),40);
  s.object(tire,x,y,z,'#252932','rubber',[Math.PI/2]);
  s.cylinder(x,y,z,r*.69,w*.88,'#75818d','steel');
  const face=z+outer*w*.47;
  s.cylinder(x,y,face,r*.58,.022,alloy,'steel');
  s.cylinder(x,y,face+outer*.014,r*.47,.023,'#8e9ba7','aluminum');
  s.cylinder(x,y,face+outer*.018,r*.27,.072,'#34465b','steel');
  s.cylinder(x,y,face+outer*.052,r*.15,.028,alloy,'aluminum');
  for(let n=0;n<10;n++) {
    const a=n*Math.PI/5;
    s.cylinder(x+r*.219*Math.cos(a),y+r*.219*Math.sin(a),face+outer*.056,r*.026,.038,'#a7b0b3','steel','z',6);
  }
  for(let i=0;i<8;i++) {
    const angle=i*Math.PI/4;
    s.cylinder(x+Math.cos(angle)*r*.396,y+Math.sin(angle)*r*.396,face+outer*.020,r*.047,.019,'#415364','steel','z',6);
  }
  for(let i=0;i<28;i++) {
    for(const band of [-1,1]) {
      const a=(i+band*.21)*Math.PI/14;
      const xx=x+Math.cos(a)*r*.991, yy=y+Math.sin(a)*r*.991;
      s.box(xx-.012,yy-.025,z+band*w*.16-w*.125,.024,.05,w*.25,'#33373e','rubber',[band*.19,0,a]);
    }
  }
}

function vehicleFrame(s,d,kind) {
  const {width:w,length:l,radius:r,axles}=d;
  for(const z of [.45,w-.56]) {
    s.box(.27,r+.08,z,l-.52,.18,.13,black,'steel');
    s.box(.33,r+.05,z+.049,l-.64,.051,.053,alloy,'steel');
  }
  for(let x=.92;x<l-.3;x+=1.24) s.box(x,r+.045,.43,.09,.14,w-.86,charcoal,'steel');
  for(const z of [.58,w-.66]) {
    s.cylinder(axles.at(-1)-.59,.46,z,.087,.64,'#737d80','steel','x',22);
    s.box(.39,.57,z-.06,.78,.114,.14,'#526067','steel');
  }
  const width=r*.66;
  for (const [index,x] of axles.entries()) {
    s.cylinder(x,r,.50,r*.18,w-1.0,steel,'steel');
    for (const side of [-1,1]) {
      const z=side===-1?width*.49:w-width*.49;
      wheel(s,x,r,z,r,width,side);
      if((kind==='semi'||kind==='flat')&&index>0) {
        s.cylinder(x,r,z-side*width*.77,r*.93,width*.55,'#272c35','rubber');
      }
      const flange=side<0?-.035:w-.038;
      for(let t=1;t<8;t++) {
        const angle=t*Math.PI/8, edge=r+.062;
        const xx=x+Math.cos(angle)*edge, yy=r+Math.sin(angle)*edge;
        s.box(xx-.098,yy-.026,flange,.196,.052,.113,black,'paint',[0,0,angle-Math.PI/2]);
      }
      s.box(x+r*.91,r*.55,flange,.097,r*.78,.123,'#303f4c','rubber');
      s.cylinder(x,r+.26,side<0?.46:w-.46,r*.23,.14,'#606d73','steel','y',18);
      s.box(x-.24,r+.152,side<0?.43:w-.64,.48,.073,.21,'#46525a','steel');
    }
  }
  if(kind!=='van') {
    const fuelAt=d.cab+.32;
    for(const z of [.34,w-.34]) {
      s.cylinder(fuelAt,r+.13,z,.23,.90,alloy,'steel','x',30);
      for(const x of [fuelAt-.27,fuelAt+.28]) s.cylinder(x,r+.13,z,.234,.039,'#4e6071','steel','x',26);
      s.cylinder(fuelAt+.14,r+.369,z,.053,.045,'#c3cbd0','aluminum','y',16);
      s.box(fuelAt-.28,.35,z-.114,.64,.067,.228,'#4b5c69','steel');
    }
    s.cylinder(d.cab+.77,.49,w*.50,.069,.40,'#536675','steel','x',15);
    s.box(d.cab+.90,.63,.405,.51,.37,.34,'#414d56','steel');
    for(let x=d.cab+1.02;x<l-.43;x+=1.36) for(const z of [.115,w-.155]) {
      s.box(x,.56,z,.67,.068,.038,'#9dabad','aluminum');
      s.box(x+.013,.624,z,.055,.092,.041,'#303d43','steel');
    }
  }
  s.box(l-.29,.46,-.023,.30,.21,w+.046,black,'steel');
  s.box(l-.03,.49,.12,.04,.093,w-.24,'#b5c1c6','steel');
  for(const z of [.11,w-.37]) {
    s.box(l+.014,.55,z,.086,.13,.25,'#981e33','light');
    s.box(l+.103,.575,z+.173,.013,.061,.067,'#ffba68','light');
  }
  for(let i=0;i<6;i++) s.box(l+.029,.443,.40+i*(w-.80)/6,.013,.04,(w-.80)/6,i%2?'#f0e8d2':'#a6473d','light');
}

function vehicleCab(s,d,kind,asset) {
  const {width:w,cab:l,paint}=d;
  const high=kind==='semi'||kind==='cold';
  const tall=kind==='semi'?3.42:kind==='cold'?3.13:kind==='flat'?2.78:kind==='van'?2.34:2.66;
  const bottom=kind==='van'?.53:.78;
  const screenBase=kind==='semi'?2.08:kind==='cold'?1.86:kind==='flat'?1.86:kind==='van'?1.48:1.60;
  const screenFront=high?.09:kind==='flat'?1.47:kind==='van'?.56:.74;
  const screenTop=screenFront+(high?.19:.43);
  const front=high?[[.08,bottom],[.0,bottom+.31],[.036,screenBase],[screenTop,tall-.20]]
    :[[.04,bottom],[-.018,bottom+.23],[.10,screenBase-.35],[screenFront,screenBase],[screenTop,tall-.18]];
  const [frontAxle]=d.axles;
  const archRadius=d.radius+.115;
  const start=Math.asin((bottom-d.radius)/archRadius);
  const arch=Array.from({length:16},(_,i)=>{
    const phase=start+(Math.PI-start*2)*i/15;
    return [frontAxle+Math.cos(phase)*archRadius,d.radius+Math.sin(phase)*archRadius];
  });
  const upper=[[screenTop+.33,tall],[l-.27,tall],[l-.080,tall-.06],[l-.025,tall-.19]];
  const outline=[...front,...upper,[l-.01,bottom],...arch];
  const opening=[[screenFront+.135,screenBase+.06],[l-.24,screenBase+.06],[l-.28,tall-.27],[screenTop+.106,tall-.27]];
  for(const side of [.055,w-.136]) s.profile(outline,0,0,side,.081,paint,'paint',.021,[opening]);
  const frontFace=front.slice(0,-1);
  const lining=frontFace.toReversed().map(([x,y])=>[x+.102,y]);
  s.profile([...frontFace,...lining],0,0,.096,w-.192,paint,'paint',.021);
  s.profile([[screenTop-.035,tall-.236],...upper,[l-.038,tall-.236]],0,0,.076,w-.152,paint,'paint',.047);
  s.box(l-.152,bottom+.10,.109,.118,tall-bottom-.29,w-.218,paint,'paint');
  s.box(l-.169,screenBase+.06,.161,.020,tall-screenBase-.33,w-.322,'#52646c','rubber');
  s.box(.23,bottom+.024,.142,l-.40,.107,w-.284,'#3c4850','rubber');
  const lowerX=front.at(-2)[0]-.044, upperX=screenTop-.035;
  const windscreen=[
    [lowerX,screenBase+.024,.117],[lowerX,screenBase+.024,w-.117],
    [upperX,tall-.239,w-.125],[upperX,tall-.239,.125],
  ];
  windowPane(s,windscreen,'#90bcc8','cab-glass');
  for(let i=0;i<4;i++) segment(s,windscreen[i],windscreen[(i+1)%4],.022,'#303d45','rubber');
  for(const z of [w*.31,w*.69]) {
    segment(s,[lowerX-.019,screenBase+.031,z-.21],[lowerX+.009,screenBase+.137,z+.125],.011,'#233038','rubber');
    segment(s,[lowerX+.011,screenBase+.139,z-.104],[lowerX+.011,screenBase+.155,z+.253],.014,'#233038','rubber');
  }
  const dashX=lowerX+.17;
  const steerZ=w*.732, steerX=dashX+.29, steerY=screenBase+.016;
  s.profile([[0,0],[.41,0],[.39,.11],[.16,.19],[0,.17]],dashX,screenBase-.205,.135,w-.27,'#3a484e','rubber',.020);
  s.box(dashX+.076,screenBase-.007,steerZ-.19,.17,.09,.38,'#243239','paint');
  s.box(dashX+.236,screenBase+.022,steerZ-.151,.024,.043,.303,'#4e858e','light',[0,0,.18]);
  s.box(dashX+.091,screenBase-.004,w*.40,.094,.064,.24,'#27383f','rubber');
  for(let i=0;i<4;i++) {
    s.box(dashX+.14,screenBase+.012,steerZ-.265+i*.035,.09,.007,.013,'#778b91','steel');
    s.box(dashX+.284,screenBase-.078,w*.43+i*.05,.031,.018,.014,'#586c74','rubber');
  }
  s.object(new T.TorusGeometry(.151,.019,10,32),steerX,steerY,steerZ,'#293338','rubber',[0,Math.PI/2,-.22]);
  s.cylinder(steerX-.074,steerY,steerZ,.043,.155,'#314048','rubber','x',18);
  for(const z of [-.104,.098]) segment(s,[steerX,steerY,steerZ],[steerX,steerY-.039,steerZ+z],.023,'#3c4c52','rubber');
  const seatY=screenBase-.266, seatX=Math.min(steerX+.48,l-.49);
  seatedDriver(s,{x:seatX,y:seatY,z:steerZ,wheelX:steerX,wheelY:steerY,variant:Number(asset.id.replace(/\D/g,''))});
  s.box(seatX-.16,seatY-.076,w*.19,.38,.135,.39,'#3d4c53','rubber');
  s.box(seatX+.18,seatY-.025,w*.185,.171,.53,.39,'#37454e','paint');
  for(const side of [-1,1]) {
    const lip=side<0?-.032:w+.003;
    const pane=side<0?.062:w-.07;
    const glassSide=opening.map(([x,y])=>[x,y,pane]);
    windowPane(s,glassSide,'#8eafb6','cab-glass');
    for(let i=0;i<4;i++) segment(s,glassSide[i],glassSide[(i+1)%4],.018,'#2c393f','rubber');
    s.box(l-.52,screenBase+.055,pane-.011,.036,Math.max(.22,tall-screenBase-.332),.021,'#26363a','rubber');
    s.box(l-.28,screenBase-.15,lip,.16,.037,.026,black,'paint');
    s.box(Math.max(l-.97,.18),bottom+.24,lip,.085,.037,.033,'#e3a647','light');
    s.box(l-.18,bottom+.29,lip,.018,Math.max(.42,screenBase-bottom-.40),.019,'#535c64');
    s.box(l-.52,screenBase-.101,lip,.264,.014,.018,'#586873','rubber');
    s.box(l-.311,screenBase-.156,lip+side*.008,.189,.045,.027,paint,'paint');
    for(let i=0;i<5;i++) s.box(l-.41+i*.045,bottom+.152,lip,.013,.024,.019,'#606f78','rubber');
    const mirrorX=Math.max(.13,screenFront-.058), mirrorZ=side<0?-.22:w+.08;
    s.box(mirrorX,screenBase+.04,mirrorZ,.066,.109,.20,black,'paint');
    s.box(mirrorX-.034,screenBase+.02,mirrorZ,.127,high?.36:.25,.166,black,'paint');
    s.box(mirrorX+.093,screenBase+.055,mirrorZ+.018,.016,high?.26:.17,.123,'#a1b4c7','glass');
    s.box(mirrorX+.089,screenBase+.044,mirrorZ+.013,.024,.019,.133,black,'rubber');
    if(high) {
      s.box(mirrorX-.015,screenBase-.092,mirrorZ+.008,.112,.101,.148,black,'paint');
      s.box(mirrorX+.097,screenBase-.078,mirrorZ+.021,.017,.069,.120,'#8eacb5','glass');
    }
    if(kind!=='van') {
      s.box(l-.56,bottom-.29,side<0?-.09:w-.13,.52,.055,.22,alloy,'steel');
      s.box(l-.56,bottom-.15,side<0?-.06:w-.16,.52,.053,.22,black,'steel');
      for(let p=0;p<5;p++) {
        s.box(l-.51+p*.091,bottom-.232,side<0?-.077:w-.119,.018,.011,.18,'#bfccd1','aluminum');
      }
    }
  }
  s.profile([[.07,0],[.30,0],[.30,.213],[.02,.213],[-.013,.126]],-.06,bottom-.071,.045,w-.09,black,'paint',.033);
  const grilleWidth=w*(high?.59:.41);
  const grilleZ=(w-grilleWidth)/2;
  const grilleH=high?.83:.37;
  const grillOutline=[[0,.06],[.11,0],[grilleWidth-.11,0],[grilleWidth,.06],[grilleWidth,grilleH],[0,grilleH]];
  frontPanel(s,grillOutline,-.015,bottom+.242,grilleZ,.070,'#243137','rubber',.027);
  for(let i=0;i<(high?13:5);i++) {
    const y=bottom+.27+i*.061;
    s.box(-.117,y,grilleZ+.049,.019,.018,grilleWidth-.098,'#535e63','steel');
    if(high&&i%3===2) s.box(-.136,y+.014,grilleZ+.01,.026,.024,grilleWidth-.02,'#a7b0b0','aluminum');
  }
  if(high) {
    s.box(-.086,bottom+1.048,w*.33,.104,.088,w*.34,'#334b55','paint');
    s.label(kind==='semi'?'K5':'KAMAZ',-.112,bottom+1.095,w*.50,.36,.085,{angle:0,heading:-Math.PI/2,color:'#d6e3e0',font:69});
    for(const z of [grilleZ-.035,grilleZ+grilleWidth+.016]) {
      s.box(-.101,bottom+.244,z,.052,.85,.025,'#4e5f66','aluminum');
    }
    for(const side of [-1,1]) {
      const edge=side<0?.053:w-.053, inner=-side;
      const cheek=[[0,0],[.26,.042],[.234,.154],[.073,.181],[.013,.157]].map(([z,y])=>[z*inner,y]);
      frontPanel(s,cheek,-.026,bottom+.491,edge,.070,paint,'paint',.022);
      for(let i=0;i<3;i++) {
        const port=[[0,0],[.132,0],[.105,.012],[0,.016]].map(([z,y])=>[z*inner,y]);
        frontPanel(s,port,-.100,bottom+.552+i*.030,edge+.042*inner,.004,'#465963','steel',.003);
      }
    }
  }
  s.box(-.112,bottom+.135,w*.39,.026,.094,w*.22,alloy,'steel');
  for(const side of [-1,1]) {
    headlamp(s,w,bottom,kind,side);
    const left=side<0?.152:w-.389;
    frontPanel(s,[[0,0],[.196,0],[.231,.043],[.218,.095],[.034,.095]],-.142,bottom+.027,left,.036,'#232d30','rubber',.012);
    s.cylinder(-.177,bottom+.065,left+.145,.031,.016,'#9aa8a8','glass','x',18);
  }
  const roofStart=Math.min(l-.32,screenTop+.41);
  s.box(roofStart,tall+.001,w*.38,.29,.049,w*.24,'#47647a','paint');
  s.cylinder(roofStart+.091,tall+.113,w*.50,.014,.165,'#303c4a','steel','y',10);
  if(kind==='flat') {
    s.cylinder(l-.39,2.36,w-.155,.061,1.38,'#4b5b61','steel','y');
    s.box(.27,screenBase-.29,.32,1.02,.033,w-.64,'#6e8e71','paint');
  } else if(kind==='van') {
    s.box(l-.48,screenBase-.26,.18,.31,.025,w-.36,'#46555c','rubber');
  } else if(high) {
    for(const z of [.19,w-.28]) s.box(screenTop+.22,tall-.016,z,.157,.042,.087,'#a0814c','light');
  }
  return [seatX,screenBase+.18,steerZ];
}

function cargoDoors(s,d,floor,height,color) {
  const doors=[];
  for(const side of [-1,1]) {
    const parts=new SceneParts();
    const width=d.width/2-.095;
    const z=side<0?0:-width;
    parts.box(0,.017,z,.08,height-.035,width,'#8798a5','aluminum');
    parts.box(.082,.075,z+.057,.036,height-.14,width-.115,color,'paint');
    parts.box(-.047,.058,z+.039,.054,height-.11,width-.08,'#a6b4bd','aluminum');
    for(const edge of [z+.013,z+width-.025]) parts.box(.093,.044,edge,.031,height-.088,.012,'#3f4e55','rubber');
    const bar=z+(side<0?width-.18:.18);
    parts.cylinder(.142,height*.51,bar,.025,height-.25,'#8f9ca7','aluminum','y',15);
    for(let i=0;i<3;i++) {
      const y=.21+i*(height-.37)/2;
      parts.box(.12,y,side<0?-.034:-.129,.056,.065,.15,alloy,'aluminum');
      parts.box(.13,y,bar-.036,.054,.044,.072,steel,'steel');
      for(const screw of [-.023,.024]) parts.cylinder(.176,y+.022,bar+screw,.008,.014,'#c2c9cb','aluminum','x',8);
    }
    parts.box(.153,.31,bar-.06,.041,.079,.12,'#313d45','paint');
    parts.box(.16,.348,bar-.059,.052,.021,.105,alloy,'aluminum');
    parts.box(.123,.104,z+.069,.028,.036,width-.138,'#c94a3b','light');
    parts.box(.121,height-.105,z+.069,.018,.03,width-.138,'#d7ded7','aluminum');
    const pivot=parts.finish();
    pivot.position.set(d.length+.008,floor,side<0?.089:d.width-.089);
    s.group.add(pivot);
    doors.push({pivot,direction:-side});
  }
  return doors;
}

function cargoBody(s,d,kind,asset) {
  const roof=new SceneParts(), walls=new SceneParts(), payload=new SceneParts();
  const {width:w,length:l,height,cab,paint}=d;
  const start=kind==='semi'?4.27:cab+.035;
  const floor=kind==='semi'?1.18:kind==='van'?.66:1.05;
  if(kind==='flat') {
    s.box(start,floor,.016,l-start,.17,w-.032,'#746754','matte');
    for(let x=start+.07;x<l-.02;x+=.275) s.box(x,floor+.173,.066,.015,.011,w-.13,'#45535a');
    for(const z of [.025,w-.105]) {
      walls.box(start,floor+.177,z,l-start,.36,.084,paint,'paint');
      for(let x=start+.12;x<l;x+=.82) {
        walls.box(x,floor+.15,z-.029,.065,.405,.115,'#40594a','steel');
        walls.box(x+.061,floor+.205,z-.044,.074,.061,.135,'#7c8989','aluminum');
        s.box(x+.075,floor+.116,z-.024,.051,.024,.119,'#d7c08c','aluminum');
      }
    }
    walls.box(start,floor+.164,.028,.114,1.35,w-.056,'#526f60','paint');
    walls.box(l-.106,floor+.17,.035,.095,.34,w-.07,paint,'paint');
    if(asset.pallets) for(let x=start+.35;x<l-.78;x+=1.12) {
      for(const z of [.26,1.35]) {
        payload.box(x,floor+.18,z,.92,.11,.88,'#a47b54');
        payload.box(x+.033,floor+.29,z+.05,.83,.54,.77,'#9b8b72');
        for(const band of [.12,.64]) payload.box(x+band,floor+.832,z+.042,.052,.024,.80,'#d8a650','paint');
      }
    }
    return {walls:walls.finish(),payload:payload.finish(),lift:1.35};
  }
  const y=height-floor;
  const color=kind==='van'?paint:kind==='cold'?'#e4e9eb':kind==='box'?'#aab7bd':'#bfcbd1';
  const outline=[[0,0],[l-start,0],[l-start,y-.08],[l-start-.14,y],[.12,y],[0,y-.08]];
  walls.profile(outline,start,floor,.034,.066,color,'paint',.024);
  walls.profile(outline,start,floor,w-.10,.066,color,'paint',.024);
  s.box(start,floor,.041,l-start,.094,w-.082,kind==='cold'?'#6b7072':'#655b52','aluminum');
  roof.box(start+.071,height-.083,.049,l-start-.12,.084,w-.098,color,'paint');
  walls.box(start+.033,floor+.085,.083,.077,y-.148,w-.166,'#b2bec6','paint');
  for(const z of [.032,w-.079]) roof.box(start+.06,height-.041,z,l-start-.106,.071,.047,'#8e9da4','aluminum');
  roof.box(start+.037,height-.065,.082,.075,.09,w-.164,'#a3adb0','aluminum');
  for(let x=start+.23;x<l-.04;x+=.48) {
    s.box(x,floor+.095,.113,.015,.009,w-.226,kind==='cold'?'#515c64':'#393932');
    roof.box(x,height-.116,.104,.035,.035,w-.208,'#8b9ba6','aluminum');
    if(kind==='van'||kind==='box') roof.box(x,height+.003,.18,.025,.007,w-.36,color,'aluminum');
  }
  for(const outer of [-1,1]) {
    const inner=outer<0?.102:w-.112;
    for(const level of [.41,1.08]) {
      if(level>=y-.28) continue;
      walls.box(start+.14,floor+level,inner,l-start-.28,.061,.023,'#7e909a','aluminum');
      for(let x=start+.31;x<l-.15;x+=.43) walls.box(x,floor+level+.014,inner+outer*-.011,.045,.031,.013,'#475662','steel');
    }
  }
  if(kind==='cold') {
    roof.box(start+.17,height-.174,.28,.27,.087,w-.56,'#bac5ca','aluminum');
    for(let z=.42;z<w-.48;z+=.14) roof.box(start+.22,height-.186,z,.14,.018,.051,'#536875','steel');
  }
  const rows=Math.min(Math.ceil(asset.pallets/2),Math.floor((l-start-.51)/.97));
  for(let row=0;row<rows;row++) for(let column=0;column<2;column++) {
    if(row*2+column>=asset.pallets) continue;
    const x=start+.29+row*.96, z=.18+column*(w*.5-.025);
    const depth=w*.5-.22, h=row%3===1?.73:.48;
    for(const xx of [x,x+.37,x+.757]) payload.box(xx,floor+.102,z,.12,.047,depth,'#907452','concrete');
    for(const zz of [z,z+depth*.31,z+depth*.63,z+depth-.136]) payload.box(x,floor+.149,zz,.88,.035,.136,'#b19978','concrete');
    const shade=kind==='cold'?['#d7d9ce','#bec8c0','#c8cec3']:['#b38d68','#9d7554','#bc9a70'];
    for(let layer=0;layer<2;layer++) for(let c=0;c<3;c++) {
      payload.box(x+.035,floor+.184+layer*h*.5,z+.045+c*(depth-.08)/3,.812,h*.5-.008,(depth-.08)/3-.013,shade[(layer+c+row)%3]);
    }
    for(const off of [.14,.59]) payload.box(x+off,floor+.185+h,z+.051,.038,.013,depth-.104,'#d6c5a5');
    payload.box(x+.844,floor+.44,z+.14,.005,.082,.117,'#edece4');
  }
  for(const outer of [-1,1]) {
    const z=outer<0?.001:w-.02;
    s.box(start,floor+.017,z,l-start,.095,.032,alloy,'aluminum');
    walls.box(start,floor+y-.14,z,l-start,.073,.026,'#8b9aa5','aluminum');
    for(let x=start+.22;x<l-.10;x+=kind==='cold'?.71:kind==='van'?1.08:.52) {
      walls.box(x,floor+.113,z,.019,kind==='van'?y*.67:y-.29,.029,kind==='van'?'#733b3b':'#8f9da7','steel');
      if(Math.round(x*10)%3===0) walls.box(x,floor+.156,z+outer*.018,.118,.047,.029,'#ddb268','light');
    }
    if(kind==='van') {
      walls.box(start+.18,floor+y*.55,z+.006,Math.min(1.23,l-start-.26),.026,.016,'#382c39','paint');
      walls.box(start+1.20,floor+y*.58,z,.176,.047,.035,'#312e34','paint');
    }
    if(kind==='semi') {
      const side=outer<0?-.026:w+.026;
      walls.label('WD',start+(l-start)*.44,floor+y*.60,side,3.09,.79,{angle:0,heading:outer<0?Math.PI:0,color:'#30556f',font:112});
      for(let x=start+.31;x<l-.50;x+=.91) s.box(x,floor+.117,z+.004,.33,.042,.024,'#e7ddd5','light');
    }
  }
  if(kind==='cold') {
    walls.box(start-.30,height-.80,.35,.34,.65,w-.70,'#e9eef1','paint');
    walls.box(start-.323,height-.697,.47,.037,.39,w-.94,charcoal,'steel');
    for(let i=0;i<5;i++) walls.box(start-.348,height-.677+i*.075,.52,.033,.023,w-1.04,alloy,'steel');
    walls.cylinder(start-.352,height-.487,w*.73,.126,.024,'#88a0a8','steel','x',24);
    walls.cylinder(start-.368,height-.487,w*.73,.085,.024,'#536774','steel','x',24);
    walls.box(start-.362,height-.719,w*.27,.019,.153,.23,'#b8cbd0','paint');
    walls.box(start-.383,height-.666,w*.298,.014,.075,.155,'#73a998','glass');
  }
  if(kind==='semi') {
    s.profile([[0,0],[2.10,0],[2.10,.34],[1.73,.44],[1.52,.44],[.88,.32],[.42,.16]],.42,3.395,.23,w-.46,paint,'paint',.078);
    for(const z of [.46,w-.57]) s.box(start+.74,.32,z,.097,.83,.105,steel,'steel');
  }
  const doors=cargoDoors(walls,d,floor,y,color);
  return {roof:roof.finish(),walls:walls.finish(),payload:payload.finish(),doors,lift:2.05};
}

export function makeVehicle(asset) {
  const spec=vehicleSpecifications[asset.kind];
  const platform=new SceneParts(), s=new SceneParts();
  const {width,length}=spec;
  platform.box(-1.30,-.138,-1.18,length+2.60,.107,width+2.36,'#555f60');
  platform.box(-1.29,-.031,-1.17,length+2.58,.036,width+2.34,'#626968','asphalt');
  for(let x=-1.15;x<length+1.15;x+=.86) {
    platform.box(x,.010,-.78,.46,.008,.037,'#d6dcd8');
    platform.box(x,.010,width+.74,.46,.008,.037,'#d6dcd8');
  }
  vehicleFrame(s,spec,asset.kind);
  const driver=vehicleCab(s,spec,asset.kind,asset);
  const cargo=cargoBody(s,spec,asset.kind,asset);
  s.group.add(cargo.payload);
  s.label(asset.id,-.143,spec.radius+.49,width*.50,.57,.13,{angle:0,heading:-Math.PI/2,color:'#27334b',background:'#dee7ec',font:69});
  platform.group.add(s.finish());
  return { body:platform.finish(), center:[length/2,1.36,width/2], size:Math.max(length*.64,5.0),
    footprint:[length+2.6,width+2.36], driver, ...cargo };
}
