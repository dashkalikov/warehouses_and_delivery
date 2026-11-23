import * as T from './vendor/three.mjs';
import { disposeScene, studioEnvironment } from './scene-kit.mjs';
import { makeWarehouse } from './warehouse-scene.mjs';
import { makeVehicle } from './vehicle-scene.mjs';
import { facilityLayout, shellPose } from './spatial.mjs';
import { approach, bindCameraKeys, cameraBasis, navigationAxes, planFrameHalf, shortArc, travelVector } from './camera-motion.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const PI=Math.PI;

export class ModelView {
  constructor(canvas, mode, asset, zone, clock, actions={}) {
    this.canvas=canvas;
    this.mode=mode;
    this.asset=asset;
    this.zone=zone;
    this.clock=clock;
    this.clockAt=performance.now();
    this.rate=0;
    this.actions=actions;
    this.abort=new AbortController();
    this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
    this.pose=this.homeView();
    this.target={...this.pose};
    const context=canvas.getContext('webgl2',{antialias:true,alpha:true});
    if (context) this.createScene(context);
    else {
      this.flat=canvas.getContext('2d');
      this.actions.fallback?.();
    }
    this.resize=new ResizeObserver(()=>{this.draw();this.wake();});
    this.resize.observe(canvas);
    this.bind();
    this.draw();
  }

  homeView() {
    return {yaw:this.mode==='warehouse'?.63:-.76,pitch:this.mode==='warehouse'?.63:.37,zoom:1,x:0,y:0,z:0};
  }

  createScene(context) {
    const renderer=new T.WebGLRenderer({canvas:this.canvas,context,antialias:true,alpha:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=T.PCFShadowMap;
    renderer.shadowMap.autoUpdate=false;
    renderer.shadowMap.needsUpdate=true;
    renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.23;
    this.renderer=renderer;
    this.scene=new T.Scene();
    this.scene.environment=studioEnvironment();
    this.scene.environmentIntensity=this.mode==='vehicle'?.72:.43;
    this.camera=this.mode==='vehicle'
      ?new T.PerspectiveCamera(31,1,.1,180)
      :new T.OrthographicCamera(-1,1,1,-1,.1,240);
    if(this.mode==='vehicle') this.planCamera=new T.OrthographicCamera(-1,1,1,-1,.1,180);
    this.contents=this.mode==='warehouse'?makeWarehouse(this.asset,this.zone):makeVehicle(this.asset);
    const {body,walls,roof,size,center}=this.contents;
    this.scene.add(body);
    if(walls||roof) {
      const shells=[['roof',roof],['walls',walls]].filter(([,group])=>group);
      this.shells=Object.fromEntries(shells.map(([key,group])=>{
        this.scene.add(group);
        const meshes=[];
        group.traverse(mesh=>{if(mesh.isMesh) meshes.push({mesh,shadow:mesh.castShadow});});
        const materials=[...new Set(meshes.flatMap(({mesh})=>mesh.material))]
          .map(material=>({material,transparent:material.transparent,depthWrite:material.depthWrite,opacity:material.opacity}));
        return [key,{ group, meshes, materials, value:0,target:0,from:0,start:0 }];
      }));
    }
    if(this.contents.doors?.length) this.doorMotion={value:0,target:0,from:0,start:0};
    this.aim=new T.Vector3(...center);
    this.center=center;
    this.scene.add(new T.HemisphereLight('#daeaff','#67798c',1.65));
    const light=new T.DirectionalLight('#fff1da',2.70);
    light.position.copy(this.aim).add(new T.Vector3(-size,1.7*size,.7*size));
    light.target.position.copy(this.aim);
    light.castShadow=true;
    const extent=size*1.3;
    Object.assign(light.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:.1,far:size*5});
    light.shadow.mapSize.set(2048,2048);
    light.shadow.bias=-.00025;
    light.shadow.normalBias=this.mode==='warehouse' ? .012 : .035;
    this.scene.add(light,light.target);
    const rim=new T.DirectionalLight('#a3c4ff',1.2);
    rim.position.copy(this.aim).add(new T.Vector3(.8*size,.5*size,-1.2*size));
    this.scene.add(rim);
    this.ray=new T.Raycaster();
    this.contents.animate?.(this.clock);
  }

  restore() {
    this.keys?.clear();
    this.followedPerson=null;
    this.leaveTopView();
    const home=this.homeView();
    home.yaw=this.pose.yaw+shortArc(this.pose.yaw,home.yaw);
    this.target=home;
    this.wake();
  }

  toggleTopView() {
    if(!this.renderer) return;
    this.keys.clear();
    this.followedPerson=null;
    if(this.topRestore) {
      const previous=this.topRestore;
      this.leaveTopView();
      this.target={...previous,yaw:this.pose.yaw+shortArc(this.pose.yaw,previous.yaw)};
    } else {
      this.topRestore={...this.target};
      this.target={...this.homeView(),yaw:this.pose.yaw+shortArc(this.pose.yaw,0),pitch:PI/2};
      this.actions.cameraMode?.(true);
    }
    this.wake();
  }

  leaveTopView() {
    if(!this.topRestore) return;
    this.topRestore=null;
    this.actions.cameraMode?.(false);
  }
  magnify(amount) {
    const maximum=this.contents?.meters?this.contents.size*this.contents.meters*.8:5.2;
    this.target.zoom=clamp(this.target.zoom*amount,.5,maximum);
    this.wake();
  }
  focusDriver() {
    if(!this.contents?.driver) return;
    this.leaveTopView();
    const [x,y,z]=this.contents.driver.map((value,i)=>value-this.center[i]);
    this.target={yaw:this.pose.yaw+shortArc(this.pose.yaw,-.41),pitch:.17,zoom:Math.max(2.65,this.contents.size*.41),x,y,z};
    this.wake();
  }

  togglePeople() {
    const people=this.contents?.people;
    if(!people) return false;
    people.visible=!people.visible;
    this.contents.operator.visible=people.visible;
    if(!people.visible) this.followedPerson=null;
    this.renderer.shadowMap.needsUpdate=true;
    this.wake();
    return people.visible;
  }

  focusZone() {
    if(!this.renderer||this.mode!=='warehouse') return;
    this.leaveTopView();
    this.followedPerson=null;
    const area=facilityLayout(this.asset).zones.find(zone=>zone.id===this.zone);
    const zoom=clamp(this.contents.size/Math.max(area.w,area.d),2.1,4.8);
    this.target={...this.target,x:area.x+area.w/2-this.center[0],y:0,z:area.z+area.d*.72-this.center[2],pitch:.65,zoom};
    this.wake();
  }

  focusPerson(id) {
    const person=this.contents?.peopleFocus?.get(id);
    if(!person) return;
    this.leaveTopView();
    this.contents.people.visible=true;
    this.contents.operator.visible=true;
    this.followedPerson=person;
    const heading=person.carrier?.rotation.y??person.group.rotation.y;
    const yaw=Math.PI*.26+heading;
    const zoom=this.contents.size*this.contents.meters*(person.carrier||person.lead ? .31 : .43);
    this.target={...this.target,yaw:this.pose.yaw+shortArc(this.pose.yaw,yaw),pitch:.33,zoom};
    this.trackPerson();
    this.wake();
  }

  trackPerson() {
    if(!this.followedPerson) return;
    const {group,offset,lead=0}=this.followedPerson;
    const {x,y,z}=group.getWorldPosition(this.aim);
    this.target.x=x+Math.cos(group.rotation.y)*lead-this.center[0];
    this.target.y=y+offset-this.center[1];
    this.target.z=z-Math.sin(group.rotation.y)*lead-this.center[2];
  }

  setYard(activities) {
    if(!this.contents?.setYard?.(activities)) return;
    this.renderer.shadowMap.needsUpdate=true;
    this.wake();
  }
  setCargoLoaded(loaded) {
    const payload=this.contents?.payload;
    if(!payload||payload.visible===loaded) return;
    payload.visible=loaded;
    this.renderer.shadowMap.needsUpdate=true;
    this.wake();
  }
  dispose() {
    this.resize.disconnect();
    this.abort.abort();
    cancelAnimationFrame(this.frame);
    if(this.renderer) {
      this.scene.environment.dispose();
      disposeScene(this.scene);
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
  }

  setClock(clock,rate) {
    this.clock=clock;
    this.rate=rate;
    this.clockAt=performance.now();
    if(this.contents?.animate) this.wake();
  }

  selectZone(zone) {
    this.followedPerson=null;
    this.zone=zone;
    this.contents?.highlights?.forEach((mesh,id)=>{ mesh.visible=id===zone; });
    this.wake();
  }

  setShell(name,hidden) {
    const shell=this.shells?.[name];
    if(!shell) return;
    if(shell.target===Number(hidden)) return;
    shell.from=shell.value;
    shell.target=Number(hidden);
    shell.start=performance.now();
    if(hidden&&this.mode==='vehicle') {
      this.target.pitch=Math.max(this.target.pitch,.58);
      this.target.x=this.target.y=this.target.z=0;
    }
    this.wake();
  }

  toggleDoors() {
    const doors=this.doorMotion;
    if(!doors) return false;
    doors.from=doors.value;
    doors.target=1-doors.target;
    doors.start=performance.now();
    if(doors.target) {
      this.leaveTopView();
      this.target.yaw=this.pose.yaw+shortArc(this.pose.yaw,1.006);
      this.target.pitch=.43;
      this.target.x=this.target.y=this.target.z=0;
    }
    this.wake();
    return Boolean(doors.target);
  }

  updateDoors(now) {
    const motion=this.doorMotion;
    if(!motion||motion.value===motion.target) return false;
    const fraction=this.reducedMotion.matches?1:clamp((now-motion.start)/1650,0,1);
    motion.value=fraction===1?motion.target:motion.from+(motion.target-motion.from)*fraction;
    const {lift}=shellPose(motion.value,1.78);
    for(const {pivot,direction} of this.contents.doors) pivot.rotation.y=direction*lift;
    this.renderer.shadowMap.needsUpdate=true;
    return fraction<1;
  }

  updateShells(now) {
    let changing=false;
    const duration=this.reducedMotion.matches?0:1250;
    for(const shell of Object.values(this.shells??{})) {
      if(shell.target===shell.value) continue;
      this.renderer.shadowMap.needsUpdate=true;
      const progress=duration ? clamp((now-shell.start)/duration,0,1) : 1;
      shell.value=progress===1?shell.target:shell.from+(shell.target-shell.from)*progress;
      const {lift,opacity}=shellPose(shell.value,this.contents.lift);
      shell.group.position.y=lift;
      shell.group.visible=opacity>0;
      shell.meshes.forEach(({mesh,shadow})=>{mesh.castShadow=shadow&&opacity>.72;});
      for(const base of shell.materials) {
        const {material}=base;
        const blending=base.transparent||opacity<1;
        if(material.transparent!==blending) {
          material.transparent=blending;
          material.needsUpdate=true;
        }
        material.depthWrite=base.depthWrite&&opacity===1;
        material.opacity=base.opacity*opacity;
      }
      changing ||= progress<1;
    }
    return changing;
  }

  wake() {
    if(this.frame || !this.canvas.clientWidth || !this.canvas.clientHeight) return;
    this.frame=requestAnimationFrame(now=>this.tick(now));
  }

  tick(now) {
    this.frame=0;
    if(!this.canvas.isConnected || !this.canvas.clientWidth) { this.lastFrame=0; return; }
    const delta=this.lastFrame?clamp((now-this.lastFrame)/1000,.001,.05):1/60;
    this.lastFrame=now;
    const active=this.keys?.active()??new Set();
    if(active.size) this.nudge(navigationAxes(active),delta,false);
    const animate=Boolean(this.contents?.animate);
    const running=animate&&this.rate>0&&!this.reducedMotion.matches;
    if(animate) this.contents.animate(this.clock+(running?(now-this.clockAt)*this.rate/1000:0));
    this.trackPerson();
    const response=this.reducedMotion.matches?Infinity:17;
    let moving=false;
    for(const key of Object.keys(this.pose)) {
      const value=approach(this.pose[key],this.target[key],delta,response);
      if(Math.abs(value-this.target[key])<.00045) this.pose[key]=this.target[key];
      else {this.pose[key]=value;moving=true;}
    }
    const shellMoving=this.updateShells(now);
    const doorsMoving=this.updateDoors(now);
    if(animate) {
      if(!this.lastShadow || now-this.lastShadow>72 || !running) {
        this.renderer.shadowMap.needsUpdate=true;
        this.lastShadow=now;
      }
    }
    this.draw();
    if(active.size || moving || shellMoving || doorsMoving || running) this.wake();
    else this.lastFrame=0;
  }

  bind() {
    const on=(type,fn,opt={})=>this.canvas.addEventListener(type,fn,{signal:this.abort.signal,...opt});
    const pointers=new Map();
    let start=null, moved=false;
    on('pointerdown',event=>{
      if(event.button!==0) return;
      this.canvas.focus({preventScroll:true});
      this.canvas.setPointerCapture(event.pointerId);
      if(!pointers.size) {
        start=[event.clientX,event.clientY];
        moved=false;
      } else moved=true;
      pointers.set(event.pointerId,[event.clientX,event.clientY]);
    });
    on('pointermove',event=>{
      if(!pointers.has(event.pointerId)) return;
      const [x,y]=pointers.get(event.pointerId);
      const nx=event.clientX, ny=event.clientY;
      moved ||= Math.hypot(nx-start[0],ny-start[1])>4;
      if(pointers.size===2) {
        const [,other]=[...pointers].find(([id])=>id!==event.pointerId);
        const old=Math.hypot(x-other[0],y-other[1]);
        if(old>4) this.magnify(Math.hypot(nx-other[0],ny-other[1])/old);
      } else if(moved && this.renderer) {
        this.orbit((x-nx)*.010,(ny-y)*.009);
      }
      pointers.set(event.pointerId,[nx,ny]);
    });
    on('pointerup',e=>{
      if(pointers.has(e.pointerId)&&!moved) this.pick(e.clientX,e.clientY);
      pointers.delete(e.pointerId);
    });
    on('pointercancel',e=>pointers.delete(e.pointerId));
    on('wheel',e=>{
      e.preventDefault();
      this.magnify(Math.exp(-e.deltaY*.001));
    },{passive:false});
    this.keys=bindCameraKeys(this.canvas.closest('.scene-panel'),{
      signal:this.abort.signal,enabled:()=>Boolean(this.renderer&&this.canvas.clientWidth),
      tap:axes=>this.nudge(axes,.12,true),wake:()=>this.wake(),
    });
    on('keydown',e=>{
      if(e.key==='+'||e.key==='='||e.key==='-') {
        e.preventDefault();
        this.magnify(e.key==='-'?1/1.15:1.15);
      }
    });
  }

  orbit(deltaYaw,deltaPitch) {
    this.target.yaw+=deltaYaw;
    if(!this.topRestore) this.target.pitch=clamp(this.target.pitch+deltaPitch,.07,PI/2-.055);
    this.wake();
  }

  nudge({right,forward,turn,tilt},delta,tap) {
    if(right||forward) this.followedPerson=null;
    const target=this.target;
    target.yaw+=turn*delta*1.42;
    if(!this.topRestore) target.pitch=clamp(target.pitch+tilt*delta*.82,.07,PI/2-.055);
    const [dx,dz]=travelVector(target.yaw,right,forward);
    const size=this.contents.size;
    const distance=delta*size*(tap?.68:.58)/target.zoom;
    target.x=clamp(target.x+dx*distance,-size*1.05,size*1.05);
    target.z=clamp(target.z+dz*distance,-size*1.05,size*1.05);
  }

  pick(x,y) {
    if(!this.contents?.floorHits || this.shells.roof.value<.93) return;
    const r=this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new T.Vector2(2*(x-r.x)/r.width-1,1-2*(y-r.y)/r.height),this.camera);
    const hit=this.ray.intersectObjects(this.contents.floorHits)[0];
    if(hit) this.actions.selectZone?.(hit.object.userData.zone);
  }

  draw() {
    const {clientWidth:w,clientHeight:h}=this.canvas;
    if(!w||!h) return;
    if(!this.renderer) { this.drawPlan(w,h); return; }
    if(w!==this.width||h!==this.height) {
      this.width=w; this.height=h;
      this.renderer.setSize(w,h,false);
    }
    const aspect=w/h;
    const size=this.contents.size;
    const {yaw,pitch,zoom,x,y,z}=this.pose;
    const plane=this.topRestore&&pitch===PI/2;
    const camera=plane&&this.planCamera?this.planCamera:this.camera;
    const normalHalf=size*Math.max(.58,.82/aspect);
    const planHalf=planFrameHalf(...this.contents.footprint,aspect);
    const blend=clamp((pitch-1.15)/(PI/2-1.15),0,1);
    const half=normalHalf+(planHalf-normalHalf)*blend;
    let r=camera.isPerspectiveCamera?half/Math.tan(camera.fov*PI/360):Math.max(18,size*2.3);
    if(this.followedPerson && this.contents.meters) {
      // Ease the camera into the aisle so a distant rack cannot block the close-up.
      const detail=zoom/(size*this.contents.meters);
      const close=clamp((detail-.07)/.19,0,1);
      r=r+(4.3/this.contents.meters-r)*close;
    }
    if(camera.isPerspectiveCamera) {
      camera.aspect=aspect;
      camera.zoom=zoom;
    } else {
      camera.left=-half*aspect/zoom;
      camera.right=half*aspect/zoom;
      camera.top=half/zoom;
      camera.bottom=-half/zoom;
    }
    this.aim.set(this.center[0]+x,this.center[1]+y,this.center[2]+z);
    const basis=cameraBasis(yaw,pitch);
    camera.position.set(...basis.direction).multiplyScalar(r).add(this.aim);
    camera.up.set(...basis.up);
    camera.lookAt(this.aim);
    camera.updateProjectionMatrix();
    this.renderer.render(this.scene,camera);
  }

  drawPlan(w,h) {
    const ctx=this.flat;
    if(!ctx) return;
    const dpr=Math.min(devicePixelRatio||1,1.7);
    this.canvas.width=Math.round(w*dpr); this.canvas.height=Math.round(h*dpr);
    ctx.scale(dpr,dpr);
    ctx.font='600 15px Segoe UI';
    ctx.textAlign='center';
    ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--ink');
    if(this.mode==='vehicle') {
      ctx.fillText(this.asset.id+' · '+this.asset.name,w/2,h/2);
      return;
    }
    const plan=facilityLayout(this.asset);
    const scale=Math.min((w-28)/plan.w,(h-30)/plan.d)*this.pose.zoom;
    const dx=(w-plan.w*scale)/2, dz=(h-plan.d*scale)/2;
    for(const hall of plan.halls) {
      ctx.fillStyle='#a4bbc9';
      ctx.fillRect(dx+hall.x*scale,dz+hall.z*scale,hall.w*scale,hall.d*scale);
    }
    for(const zone of plan.zones) {
      ctx.fillStyle=zone.id===this.zone?'#2864a8':'#476885';
      ctx.fillRect(dx+zone.x*scale,dz+zone.z*scale,zone.w*scale,zone.d*scale);
      ctx.fillStyle='white';
      ctx.fillText(zone.id,dx+(zone.x+zone.w/2)*scale,dz+(zone.z+zone.d/2)*scale);
    }
  }
}
