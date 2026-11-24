import { cities, roads, roadEndpoints, warehouses } from './data.mjs';
import { roadPosition, tripDistance, tripLegPosition } from './domain.mjs';
import { mapDetail, projectMapPoint as project } from './spatial.mjs';
import { boundsFor, loadMapLayer, mapLayers, mapLine as line, transitPath } from './map-geometry.mjs';
import { approach, bindCameraKeys, navigationAxes } from './camera-motion.mjs';
import { icons, escapeText } from './ui.mjs';

const svgNS='http://www.w3.org/2000/svg';
const rad=Math.PI/180;
const world=3600;
const nodes=Object.fromEntries(Object.entries(cities).map(([id,[,x,y]])=>[id,project(...(roadEndpoints[id]??[x,y]))]));
const routePaths=new WeakMap();
const legPaths=new WeakMap();
function legPath(shape) {
  if(!legPaths.has(shape)) legPaths.set(shape,line(shape));
  return legPaths.get(shape);
}
function routePath(route) {
  if(!routePaths.has(route)) routePaths.set(route,route.legs.map(leg=>legPath(leg.shape)).join(''));
  return routePaths.get(route);
}
const networkBounds=boundsFor(warehouses.filter(site=>!site.metro).map(site=>nodes[site.id]),40);
const countryBounds={x:145,y:-1740,w:1780,h:1270};
const leftLabel=new Set(['msk_khimki','spb_shushary']);
const metroLabel={msk:'Москва',spb:'Санкт-Петербург',kzn:'Казань',ekb:'Екатеринбург',nsk:'Новосибирск',rnd:'Ростов-на-Дону',krsk:'Красноярск',khv:'Хабаровск'};
const mapDetailNames={country:'Страна',region:'Регионы',metro:'Города',street:'Детально'};
const nationalLabels=new Set([...Object.keys(metroLabel),'kal','mur','arh','krasnodar','vor','vlg','sur','nrl','tom','yak','mag','pevek','pka','sakhalin','vvo']);
export const tileProvider='https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const grid=[];
for(let lon=0;lon<201;lon+=10) grid.push(line([[lon,37],[lon,82]]));
for(let lat=40;lat<82;lat+=5) grid.push(line([[10,lat],[195,lat]]));

export class LogisticsMap {
  constructor(host, actions) {
    this.host=host;
    this.card=host.closest('.map-card');
    this.actions=actions;
    this.bounds={...networkBounds};
    this.countryBounds=countryBounds;
    this.angle=0;
    this.targetAngle=0;
    this.pendingPan=[0,0];
    this.pendingZoom=0;
    this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
    this.layer={regions:true,routes:true,warehouses:true,vehicles:true,coverage:true,districts:true,cities:true,roads:true,hubs:true};
    this.online=false;
    this.hidden={warehouses:new Set(),trips:new Set()};
    this.pinEntries=[];
    this.pinClusters=new Map();
    this.detailEntries=[];
    this.trucks=new Map();
    this.tiles=new Map();
    this.inView=true;
    host.innerHTML=`<svg class="geo" role="group" aria-label="Интерактивная карта логистической сети" aria-describedby="map-controls" tabindex="0">
      <defs><clipPath id="countryClip"><path class="outline-data" fill-rule="evenodd"/></clipPath>
        <filter id="pin-shadow" x="-80%" y="-80%" width="260%" height="260%"><feDropShadow dx="0" dy="2" stdDeviation="1.8" flood-color="#172b49" flood-opacity=".32"/></filter></defs>
      <g class="map-world"><path class="graticule" d="${grid.join('')}"/><path class="land outline-data"/>
        <g clip-path="url(#countryClip)"><path class="land-grid" d="${grid.join('')}"/><path class="region-lines"/>
          <path class="real-road major-road"/><path class="real-road local-road"/><path class="rail-line"/></g>
        <g class="tile-layer" aria-hidden="true"></g>
        <g clip-path="url(#countryClip)"><g class="delivery-districts"></g><g class="coverage"></g></g>
        <g class="route-map"></g><g class="trip-focus-map"><path class="focus-halo"/><path class="trace-ahead"/><path class="trace-past"/></g>
        <g class="city-map"></g><g class="hub-map"></g><g class="pin-map"></g><g class="truck-map"></g>
      </g>
    </svg>`;
    this.svg=host.querySelector('svg');
    const layers=new Map();
    this.lookup=name=>{
      if(!layers.has(name)) layers.set(name,this.svg.querySelector('.'+name));
      return layers.get(name);
    };
    this.createMarkers();
    this.bind();
    this.sizeObserver=new ResizeObserver(()=>this.redraw());
    this.sizeObserver.observe(host);
    this.intersectionObserver=new IntersectionObserver(([entry])=>{
      this.inView=entry.isIntersecting;
      if(this.inView) this.redraw(); else this.stopDrawing();
    });
    this.intersectionObserver.observe(host);
    this.redraw();
    this.load();
  }

  load() {
    const pending=new Set(mapLayers);
    const readLocally=()=>{
      for(const name of pending) {
        loadMapLayer(name).then(data=>this.addMapLayer(name,data),()=>this.addMapLayer(name));
      }
    };
    let worker;
    try { worker=new Worker(new URL('./map-worker.mjs',import.meta.url),{type:'module'}); }
    catch { readLocally();return; }
    worker.addEventListener('message',({data:{name,data}})=>{
      pending.delete(name);
      this.addMapLayer(name,data);
      if(!pending.size) worker.terminate();
    });
    worker.addEventListener('error',()=>{worker.terminate();readLocally();},{once:true});
  }

  addMapLayer(name,db) {
    if(!db) {
      const errors={'russia.geojson':'Контур страны не загрузился. Проверьте запуск через локальный сервер.',
        'coverage.json':'Границы зон покрытия не загрузились.','cartography.json':'Слой дорог и транспортных узлов недоступен.'};
      if(errors[name]) this.actions.error(errors[name]);
      return;
    }
    if(name==='russia.geojson') {
      this.host.querySelectorAll('.outline-data').forEach(el=>el.setAttribute('d',db.path));
      this.countryBounds=db.bounds;
    } else if(name==='regions.geojson') this.lookup('region-lines').setAttribute('d',db.path);
    else if(name==='coverage.json') {
      const {sites,districts}=db;
      this.lookup('coverage').innerHTML=warehouses.map(site=>`<path data-area="${site.id}" d="${sites[site.id].path}"><title>${escapeText(site.name)} · ${sites[site.id].minutes} мин</title></path>`).join('');
      this.lookup('delivery-districts').innerHTML=Object.entries(districts).map(([id,area])=>`<path data-district="${id}" d="${area.path}"><title>${escapeText(area.city)} · район доставки</title></path>`).join('');
      this.selectWarehouse(this.selected);
    } else {
      this.transport={
        major:[...db.major,...roads.map(r=>transitPath(r.shape))],local:db.local,rail:db.rail,
      };
      this.createDetailMarkers(db);
    }
    this.queueRedraw();
  }

  createMarkers() {
    const group=this.lookup('pin-map');
    for(const w of warehouses) {
      const name=w.metro?w.name:metroLabel[w.id]??cities[w.id][0];
      const localSites=warehouses.filter(place=>place.metro===w.id);
      // A second control beside the pin opens an agglomeration without opening a warehouse card.
      group.insertAdjacentHTML('beforeend',`<g class="map-anchor map-pin ${w.metro?'local-pin':''}" data-map-action="warehouse" data-id="${w.id}" tabindex="0" role="button" aria-label="${w.name}, ${cities[w.id][0]}">
        <circle class="warehouse-ring" r="15"/><circle class="warehouse-pin" r="11"/><g transform="translate(-6,-6) scale(.5)" fill="none" stroke="currentColor" stroke-width="2">${icons.warehouse}</g>
        <text x="${leftLabel.has(w.id)?-15:16}" y="-9" text-anchor="${leftLabel.has(w.id)?'end':'start'}">${escapeText(name)}</text></g>`);
      const entry={id:w.id,el:group.lastElementChild,position:nodes[w.id],local:!!w.metro,core:nationalLabels.has(w.id),name,left:leftLabel.has(w.id)};
      this.pinEntries.push(entry);
      if(!w.metro) {
        group.insertAdjacentHTML('beforeend',`<g class="map-anchor metro-count" data-map-action="metro" data-id="${w.id}" tabindex="0" role="button" aria-label="Склады рядом · ${escapeText(name)}">
          <rect x="12" y="-3" rx="6" width="24" height="15"/><text x="24" y="8" text-anchor="middle"></text></g>`);
        entry.badge={id:w.id,el:group.lastElementChild,position:entry.position,overview:true};
        entry.children=localSites.map(site=>site.id);
        this.pinEntries.push(entry.badge);
      }
    }
  }

  createDetailMarkers({places,airports}) {
    const cityGroup=this.lookup('city-map');
    // Add the nodes used by the planning graph. Data-source duplicates are suppressed.
    const network=Object.entries(cities).filter(([id])=>!warehouses.some(w=>w.id===id&&w.metro))
      .map(([id,[name,x,y]])=>[name,x,y,['nn','prm','ufa','chl','vor','oms','tym','irk','vvo','mur','arh','yak','mag','pka','nrl','vlg','sam','sur','sochi'].includes(id)?600000:160000]);
    const networkNames=new Set(network.map(p=>p[0]));
    const points=[...network,...places.filter(p=>!networkNames.has(p[0]))].sort((a,b)=>b[3]-a[3]);
    for(const [name,lon,lat,pop] of points) {
      const position=project(lon,lat);
      cityGroup.insertAdjacentHTML('beforeend',`<g class="map-anchor city map-hidden"><circle r="2.25"/><text x="6" y="-5">${escapeText(name)}</text></g>`);
      this.detailEntries.push({el:cityGroup.lastElementChild,position,pop,name,type:'city'});
    }
    const hubGroup=this.lookup('hub-map');
    for(const [name,lon,lat,code] of airports) {
      const full=/аэропорт/i.test(name)?name:'Аэропорт '+name;
      hubGroup.insertAdjacentHTML('beforeend',`<g class="map-anchor map-hub map-hidden" tabindex="0" role="button" data-map-action="hub" aria-label="${escapeText(full)}"><title>${escapeText(full)}</title>
        <circle r="9"/><g transform="translate(-5.6,-5.6) scale(.47)" fill="none" stroke="currentColor" stroke-width="2">${icons.plane}</g><text x="12" y="-6">${escapeText(code||name)}</text></g>`);
      hubGroup.lastElementChild.dataset.id=full;
      this.detailEntries.push({el:hubGroup.lastElementChild,position:project(lon,lat),name:code||name,type:'hub'});
    }
  }

  bind() {
    let drag=null, moved=false;
    const pointers=new Map();
    this.keys=bindCameraKeys(this.svg,{
      enabled:()=>this.canDraw(),
      tap:axes=>this.nudge(axes,.11),wake:()=>this.wake(),
    });
    this.svg.addEventListener('pointerdown',e=>{
      if(e.button!==0&&e.button!==2) return;
      pointers.set(e.pointerId,[e.clientX,e.clientY]);
      const marker=e.target.closest('[data-map-action]');
      if(marker&&pointers.size===1&&!e.shiftKey&&e.button===0) return;
      this.svg.focus({preventScroll:true});
      this.svg.setPointerCapture(e.pointerId);
      this.svg.classList.add('dragging');
      moved=false;
      drag={rotate:e.shiftKey||e.button===2};
    });
    this.svg.addEventListener('pointermove',e=>{
      if(!pointers.has(e.pointerId)) return;
      const [x,y]=pointers.get(e.pointerId);
      const dx=e.clientX-x, dy=e.clientY-y;
      if(drag) {
        moved ||= Math.abs(dx)+Math.abs(dy)>1;
        if(pointers.size===2) {
          const [,other]=[...pointers].find(([id])=>id!==e.pointerId);
          const a=Math.hypot(x-other[0],y-other[1]);
          const b=Math.hypot(e.clientX-other[0],e.clientY-other[1]);
          if(a>4&&b>4) this.zoom(a/b);
        } else if(drag.rotate) this.rotate(dx*.5);
        else this.pan(dx,dy);
      }
      pointers.set(e.pointerId,[e.clientX,e.clientY]);
    });
    const release=e=>{
      pointers.delete(e.pointerId);
      if(pointers.size) return;
      drag=null;
      this.svg.classList.remove('dragging');
      setTimeout(()=>{moved=false;},0);
    };
    this.svg.addEventListener('pointerup',release);
    this.svg.addEventListener('pointercancel',release);
    this.svg.addEventListener('contextmenu',e=>e.preventDefault());
    this.svg.addEventListener('wheel',e=>{
      e.preventDefault();
      const rect=this.svg.getBoundingClientRect();
      this.queueZoom(Math.exp(Math.max(-.8,Math.min(.8,e.deltaY*.0015))),(e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height);
    },{passive:false});
    const activate=e=>{
      const marker=e.target.closest('[data-map-action]');
      if(!marker||moved) return;
      const {mapAction:action,id}=marker.dataset;
      if(action==='metro') {
        const cluster=this.pinClusters.get(id);
        if(cluster?.length>1) this.frame(boundsFor(cluster.map(entry=>entry.position),12));
        else {this.focusCity(id);this.actions.city?.(id);}
        return;
      }
      if(action==='hub') {this.actions.error(id);return;}
      const vehicle=action==='vehicle'&&this.trucks.get(id);
      if(vehicle?.count>1&&this.pixel>.015) {
        this.frame(boundsFor([vehicle.position],Math.max(.45,this.viewport.h*.23)));
        return;
      }
      this.actions.select(action,id);
    };
    this.svg.addEventListener('click',activate);
    this.svg.addEventListener('dblclick',e=>{
      if(e.target.closest('[data-map-action]')) return;
      const rect=this.svg.getBoundingClientRect();
      this.queueZoom(.58,(e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height);
    });
    this.svg.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' ') {e.preventDefault();activate(e);}
      if(e.key==='+'||e.key==='='||e.key==='-') {
        e.preventDefault();
        this.queueZoom(e.key==='-'?1.30:.77);
      }
      if(e.key==='Home') {e.preventDefault();this.north();}
    });
  }

  pan(x,y) {
    const [dx,dy]=this.worldOffset(x*this.pixel,y*this.pixel);
    this.bounds.x-=dx; this.bounds.y-=dy;
    this.queueRedraw();
  }

  worldOffset(x,y) {
    const angle=this.angle*rad;
    return [x*Math.cos(angle)+y*Math.sin(angle),y*Math.cos(angle)-x*Math.sin(angle)];
  }

  zoom(factor,x=.5,y=.5,redraw=true) {
    const b=this.bounds;
    factor=Math.max(.14/b.w,Math.min(2550/b.w,factor));
    const [dx,dy]=this.worldOffset((x-.5)*this.viewport.w,(y-.5)*this.viewport.h);
    b.x+=(b.w/2+dx)*(1-factor);
    b.y+=(b.h/2+dy)*(1-factor);
    b.w*=factor; b.h*=factor;
    if(redraw) this.redraw();
  }

  queueZoom(factor,x=.5,y=.5) {
    this.pendingZoom=Math.max(-2,Math.min(2,this.pendingZoom+Math.log(factor)));
    this.zoomAnchor=[x,y];
    this.wake();
  }

  rotate(delta) { this.targetAngle+=delta; this.wake(); }
  north() {
    this.targetAngle=Math.round(this.angle/360)*360;
    this.wake();
  }
  frame(bounds) {
    this.angle=this.targetAngle=0;
    this.pendingPan=[0,0];
    this.pendingZoom=0;
    this.bounds={...bounds};
    this.redraw();
  }

  nudge({right,forward,turn,tilt},delta) {
    const dy=-(forward+tilt);
    const speed=310*this.pixel*delta/Math.max(1,Math.hypot(right,dy));
    const [dx,y]=this.worldOffset(right*speed,dy*speed);
    this.pendingPan[0]+=dx;
    this.pendingPan[1]+=y;
    this.targetAngle+=turn*delta*82;
  }

  canDraw() { return this.host.isConnected&&this.inView&&!this.suspended; }

  stopDrawing() {
    cancelAnimationFrame(this.animation);
    clearTimeout(this.tileTimer);
    this.keys?.clear();
    this.animation=this.lastFrame=0;
  }

  setSuspended(on) {
    if(this.suspended===on) return;
    this.suspended=on;
    if(on) this.stopDrawing(); else this.redraw();
  }

  queueRedraw() {
    this.needsRedraw=true;
    this.wake();
  }

  wake() {
    if(this.animation||!this.canDraw()) return;
    this.animation=requestAnimationFrame(now=>this.animate(now));
  }

  animate(now) {
    this.animation=0;
    if(!this.canDraw()) { this.lastFrame=0; return; }
    const delta=this.lastFrame?Math.min(.05,Math.max(.001,(now-this.lastFrame)/1000)):1/60;
    this.lastFrame=now;
    const held=this.keys.active();
    if(held.size) this.nudge(navigationAxes(held),delta);
    const response=this.reducedMotion.matches?Infinity:18;
    const step=(from,to,tolerance)=>Math.abs(from-to)<=tolerance?to:approach(from,to,delta,response);
    const angle=step(this.angle,this.targetAngle,.09);
    const tolerance=.08*this.pixel;
    const [x,y]=this.pendingPan.map(value=>step(0,value,tolerance));
    const zoom=step(0,this.pendingZoom,.0005);
    const cameraMoved=angle!==this.angle||x!==0||y!==0||zoom!==0;
    this.angle=angle;
    if(this.angle===this.targetAngle) this.angle=this.targetAngle=((angle%360)+360)%360;
    this.bounds.x+=x;
    this.bounds.y+=y;
    this.pendingPan[0]-=x;
    this.pendingPan[1]-=y;
    this.pendingZoom-=zoom;
    if(zoom) this.zoom(Math.exp(zoom),...this.zoomAnchor,false);
    const running=cameraMoved||this.needsRedraw?this.redraw(now):this.drawVehicles(now);
    if(held.size||this.angle!==this.targetAngle||this.pendingPan.some(Boolean)||this.pendingZoom||running) this.wake();
    else this.lastFrame=0;
  }
  reset() { this.frame(networkBounds); }
  country() { this.frame(this.countryBounds); }

  focusCity(id) {
    const positions=warehouses.filter(w=>w.id===id||w.metro===id).map(w=>nodes[w.id]);
    if(!positions.length && nodes[id]) positions.push(nodes[id]);
    if(!positions.length) return;
    this.frame(boundsFor(positions,5.2));
  }

  fitRoute(route) {
    if(route) {
      const points=route.legs.flatMap(leg=>leg.shape.map(p=>project(...p)));
      const extent=boundsFor(points,0);
      this.frame(boundsFor(points,Math.max(7,Math.max(extent.w,extent.h)*.14)));
    }
  }

  toggle(layer,value) { this.layer[layer]=value; this.redraw(); }
  setOnline(on) { this.online=on; this.redraw(); }

  setVisibility(hidden) {
    this.hidden=hidden;
    if(this.pathData) this.setPaths(...this.pathData,true);
    this.redraw();
  }

  showTrip(trip,clock) {
    this.focused=trip;
    this.focusStep=null;
    this.host.classList.toggle('focused-route',Boolean(trip));
    this.lookup('focus-halo').setAttribute('d',trip?routePath(trip.route):'');
    if(!trip) for(const name of ['trace-past','trace-ahead']) this.lookup(name).setAttribute('d','');
    this.updateFocus(clock);
    if(trip) this.fitRoute(trip.route);
    else this.redraw();
  }

  updateFocus(clock) {
    const trip=this.focused;
    if(!trip) return;
    const bucket=Math.floor(clock/3);
    if(this.focusStep===bucket) return;
    this.focusStep=bucket;
    const trace=tripDistance(trip.route,trip.elapsed+(clock-trip.at)/3600);
    this.lookup('trace-past').setAttribute('d',trace.past.map(shape=>line(shape)).join(''));
    this.lookup('trace-ahead').setAttribute('d',trace.ahead.map(shape=>line(shape)).join(''));
  }

  redraw(now=performance.now()) {
    if(!this.canDraw()) return false;
    this.needsRedraw=false;
    const b=this.bounds;
    const width=this.host.clientWidth||800, height=this.host.clientHeight||440;
    const pixel=this.pixel=Math.max(b.w/width,b.h/height);
    const cx=b.x+b.w/2, cy=b.y+b.h/2;
    const w=width*pixel,h=height*pixel;
    this.viewport={w,h,cx,cy,width,height};
    const angle=this.angle;
    this.screenCos=Math.cos(angle*rad);
    this.screenSin=Math.sin(angle*rad);
    this.svg.setAttribute('viewBox',`${cx-w/2} ${cy-h/2} ${w} ${h}`);
    this.lookup('map-world').setAttribute('transform',`rotate(${angle} ${cx} ${cy})`);
    const detail=mapDetail(pixel);
    this.host.dataset.detail=detail;
    this.host.dataset.bearing=angle;
    this.lookup('region-lines').classList.toggle('map-hidden',!this.layer.regions);
    this.lookup('coverage').classList.toggle('map-hidden',!this.layer.coverage);
    this.lookup('delivery-districts').classList.toggle('map-hidden',!this.layer.districts);
    this.lookup('route-map').classList.toggle('map-hidden',!this.layer.routes);
    this.lookup('trip-focus-map').classList.toggle('map-hidden',!this.layer.routes);
    this.lookup('pin-map').classList.toggle('map-hidden',!this.layer.warehouses);
    this.lookup('truck-map').classList.toggle('map-hidden',!this.layer.vehicles);
    this.lookup('city-map').classList.toggle('map-hidden',!this.layer.cities);
    this.lookup('hub-map').classList.toggle('map-hidden',!this.layer.hubs);
    this.renderPins(detail);
    this.renderLabels(detail);
    this.renderLines(detail);
    const running=this.drawVehicles(now,true);
    const label=this.card.querySelector('.scale-label');
    const latitude=2*Math.atan(Math.exp(-cy*rad/10))-Math.PI/2;
    const distance=pixel*76*11.132*Math.cos(latitude);
    if(label) label.textContent=distance>=1?`≈ ${Math.round(distance)} км`:`≈ ${Math.max(10,Math.round(distance*100)*10)} м`;
    const compass=this.card.querySelector('.compass-mark');
    if(compass) compass.style.transform=`rotate(${angle}deg)`;
    const zoom=this.card.querySelector('.map-level');
    if(zoom) zoom.textContent=mapDetailNames[detail];
    clearTimeout(this.tileTimer);
    if(this.online && pixel<=.085) this.tileTimer=setTimeout(()=>this.renderTiles(),110);
    else this.clearTiles();
    if(running) this.wake();
    return running;
  }

  place(el,[x,y]) {
    el.setAttribute('transform',`translate(${x} ${y}) scale(${this.pixel}) rotate(${-this.angle})`);
  }

  screenPoint([x,y]) {
    const {cx,cy,width,height}=this.viewport;
    const dx=x-cx,dy=y-cy,c=this.screenCos,s=this.screenSin;
    return [width/2+(dx*c-dy*s)/this.pixel,height/2+(dx*s+dy*c)/this.pixel];
  }

  renderPins(detail) {
    const {width,height}=this.viewport;
    const local=detail==='metro'||detail==='street';
    const pitch=detail==='country'?40:30;
    const groups=new Map(), visible=new Set();
    this.pinClusters.clear();
    if(this.layer.warehouses) for(const entry of this.pinEntries) {
      if(entry.overview||entry.local&&!local) continue;
      const [x,y]=this.screenPoint(entry.position);
      if(x < -9 || x > width+12 || y < -9 || y > height+12) continue;
      const own=Number(!this.hidden.warehouses.has(entry.id));
      if(local) {if(own) visible.add(entry);continue;}
      const count=own+entry.children.filter(id=>!this.hidden.warehouses.has(id)).length;
      if(!count) continue;
      const key=`${Math.floor(x/pitch)},${Math.floor(y/pitch)}`;
      const group=groups.get(key)??{members:[],count:0};
      group.members.push(entry);
      group.count+=count;
      groups.set(key,group);
    }
    for(const {members,count} of groups.values()) {
      const primary=members.find(entry=>entry.id===this.selected)??members.find(entry=>entry.core)??members[0];
      const own=!this.hidden.warehouses.has(primary.id);
      if(own) visible.add(primary);
      if(count>Number(own)) {
        const badge=primary.badge;
        badge.el.querySelector('text').textContent=`+${Math.min(99,count-Number(own))}`;
        badge.el.setAttribute('aria-label',members.length>1?`Приблизить группу складов · ${count}`:`Склады рядом · ${primary.name}`);
        this.pinClusters.set(primary.id,members);
        visible.add(badge);
      }
    }
    for(const entry of this.pinEntries) {
      const on=visible.has(entry);
      entry.el.classList.toggle('map-hidden',!on);
      entry.el.classList.toggle('secondary-pin',!entry.core&&!entry.local&&!entry.overview);
      if(on) this.place(entry.el,entry.position);
    }
  }

  renderLabels(detail) {
    const v=this.viewport, p=this.pixel;
    const occupied=[];
    const visible=this.pinEntries.filter(e=>!e.el.classList.contains('map-hidden')).sort((a,b)=>
      Number(b.id===this.selected)-Number(a.id===this.selected)||Number(Boolean(b.core))-Number(Boolean(a.core)));
    for(const e of visible) {
      const [x,y]=this.screenPoint(e.position);
      const labelWidth=15+(e.name?.length??4)*6.3;
      const box=e.left?[x-labelWidth,y-20,x-6,y-1]:[x+8,y-20,x+labelWidth,y-1];
      const overlaps=occupied.some(([l,t,r,b])=>box[0]<r&&box[2]>l&&box[1]<b&&box[3]>t);
      const hide=!e.overview&&e.id!==this.selected&&((detail==='country'&&!e.core)||overlaps);
      e.el.classList.toggle('label-hidden',hide);
      occupied.push(hide?[x-9,y-9,x+9,y+9]:box);
    }
    for(const entry of this.detailEntries) {
      const [x,y]=this.screenPoint(entry.position);
      const eligible=entry.type==='hub'?this.layer.hubs&&p<.24
        :this.layer.cities&&(detail==='country'?entry.pop>=800000:detail==='region'?entry.pop>=85000:true);
      const visible=eligible&&x>=-7&&y>=-7&&x<=v.width+7&&y<=v.height+7;
      entry.el.classList.toggle('map-hidden',!visible);
      if(!visible) continue;
      this.place(entry.el,entry.position);
      const box=[x,y-16,x+entry.name.length*5.85+11,y-1];
      const overlaps=occupied.some(([l,t,r,b])=>box[0]<r&&box[2]>l&&box[1]<b&&box[3]>t);
      entry.el.classList.toggle('label-hidden',overlaps);
      if(!overlaps) occupied.push(box);
    }
  }

  renderLines(detail) {
    if(!this.transport) return;
    const {w,h,cx,cy}=this.viewport;
    const radius=Math.hypot(w,h)*.52;
    const set=(name,values,enabled)=>{
      const path=this.lookup(name);
      path.classList.toggle('map-hidden',!enabled);
      if(!enabled) return;
      const previous=this.lineExtents?.[name];
      if(previous&&radius*2>previous.radius&&Math.max(Math.abs(cx-previous.cx),Math.abs(cy-previous.cy))+radius<=previous.radius) return;
      const padding=radius*1.32;
      const inside=({box:b})=>b.x+b.w>=cx-padding&&b.x<=cx+padding&&b.y+b.h>=cy-padding&&b.y<=cy+padding;
      path.setAttribute('d',values.filter(inside).map(q=>q.d).join(''));
      this.lineExtents??={};
      this.lineExtents[name]={cx,cy,radius:padding};
    };
    set('major-road',this.transport.major,this.layer.roads&&detail!=='country');
    set('local-road',this.transport.local,this.layer.roads&&this.pixel<.76);
    set('rail-line',this.transport.rail,this.layer.hubs&&this.pixel<.31);
  }

  renderTiles() {
    const zoom=Math.min(18,Math.max(6,Math.round(Math.log2(world/(this.pixel*256)))));
    const tileCount=2**zoom, size=world/tileCount;
    const {cx,cy,w,h}=this.viewport;
    const radius=this.angle?Math.hypot(w,h)/2:0;
    const dx=radius||w/2, dy=radius||h/2;
    const left=Math.floor((cx-dx+world/2)/size), right=Math.floor((cx+dx+world/2)/size);
    const top=Math.max(0,Math.floor((cy-dy+world/2)/size)), bottom=Math.min(tileCount-1,Math.floor((cy+dy+world/2)/size));
    const visible=new Set();
    for(let y=top;y<=bottom;y++) for(let x=left;x<=right;x++) {
      const key=`${zoom}/${x}/${y}`;
      visible.add(key);
      if(this.tiles.has(key)) continue;
      const wrappedX=((x%tileCount)+tileCount)%tileCount;
      const tile=document.createElementNS(svgNS,'image');
      for(const [key,value] of Object.entries({x:x*size-world/2,y:y*size-world/2,width:size+.002,height:size+.002})) tile.setAttribute(key,value);
      tile.setAttribute('preserveAspectRatio','none');
      tile.addEventListener('load',()=>{tile.classList.add('loaded');this.tileAttribution();},{once:true});
      tile.addEventListener('error',()=>{tile.classList.add('missing');this.tileAttribution();},{once:true});
      tile.setAttribute('href',tileProvider.replace('{z}',zoom).replace('{x}',wrappedX).replace('{y}',y));
      this.lookup('tile-layer').append(tile);
      this.tiles.set(key,tile);
    }
    for(const [key,tile] of this.tiles) if(!visible.has(key)) {tile.remove();this.tiles.delete(key);}
    this.tileAttribution();
  }

  tileAttribution() {
    const tiles=[...this.tiles.values()];
    const hasTiles=tiles.some(tile=>tile.classList.contains('loaded'));
    const zoom=this.card.querySelector('.map-level');
    if(zoom) {
      zoom.textContent=hasTiles?'Улицы OSM':mapDetailNames[this.host.dataset.detail];
      zoom.title=tiles.length&&tiles.every(tile=>tile.classList.contains('missing'))
        ?'Подложка OpenStreetMap недоступна. Показана локальная карта.':'';
    }
  }

  clearTiles() {
    if(!this.tiles.size) return;
    this.lookup('tile-layer').replaceChildren();
    this.tiles.clear();
    this.tileAttribution();
  }

  selectWarehouse(id) {
    this.selected=id;
    this.host.querySelectorAll('.map-pin').forEach(el=>el.classList.toggle('selected',el.dataset.id===id));
    this.lookup('coverage').querySelectorAll('[data-area]').forEach(el=>el.classList.toggle('selected',el.dataset.area===id));
    const district=warehouses.find(site=>site.id===id)?.metro??id;
    this.lookup('delivery-districts').querySelectorAll('[data-district]').forEach(el=>el.classList.toggle('selected',el.dataset.district===district));
    if(this.viewport&&this.canDraw()) {
      this.renderPins(this.host.dataset.detail);
      this.renderLabels(this.host.dataset.detail);
    }
  }

  setPaths(trips,planned,alternative,force=false) {
    if(!force&&this.pathData?.[0]===trips&&this.pathTripCount===trips.length
      &&this.pathData[1]===planned&&this.pathData[2]===alternative) return;
    this.pathData=[trips,planned,alternative];
    this.pathTripCount=trips.length;
    const segments=new Map();
    for(const [i,trip] of trips.entries()) {
      if(this.hidden.trips.has(trip.vehicle.id)) continue;
      for(const leg of trip.route.legs) {
        const key=[leg.from,leg.to].sort().join(':');
        if(!segments.has(key)) segments.set(key,`<path class="trip-line ${i===0?'primary':'secondary-route'}" d="${legPath(leg.shape)}"/>`);
      }
    }
    const plans=[alternative,planned].map((r,i)=>r?`<path class="plan-line plan-${i}" d="${routePath(r)}"/>`:'');
    this.lookup('route-map').innerHTML=[...segments.values(),...plans].join('');
  }

  setVehicles(trips,clock,rate) {
    if(this.playback?.trips!==trips||this.tripCount!==trips.length) {
      this.tripCount=trips.length;
      const current=new Set();
      for(const {vehicle:{id}} of trips) {
        current.add(id);
        if(!this.trucks.has(id)) this.trucks.set(id,{id,visible:false});
      }
      for(const [id,entry] of this.trucks) if(!current.has(id)) {entry.el?.remove();this.trucks.delete(id);}
    }
    const now=performance.now();
    this.playback={trips,clock,rate,now};
    if(!this.canDraw()) return;
    this.updateFocus(clock);
    if(this.drawVehicles(now)) this.wake();
  }

  truckMarker(entry) {
    const {id}=entry;
    const group=this.lookup('truck-map');
    group.insertAdjacentHTML('beforeend',`<g class="map-anchor moving-truck map-hidden" data-map-action="vehicle" data-id="${id}" tabindex="0" role="button" aria-label="Машина ${id}">
          <g class="truck-marker"><rect class="truck-pin" x="-12" y="-11" width="24" height="22" rx="7"/><g transform="translate(-6.6,-6.6) scale(.55)" fill="none" stroke="currentColor" stroke-width="2">${icons.truck}</g>
          <g class="truck-cluster-count"><rect x="5" y="-15" width="21" height="13" rx="5"/><text x="15.5" y="-5.5" text-anchor="middle"></text></g></g>
        </g>`);
    entry.el=group.lastElementChild;
    entry.label=entry.el.querySelector('text');
  }

  drawVehicles(now,force=false) {
    const playback=this.playback;
    if(!playback||!this.viewport||!this.layer.vehicles||!this.canDraw()) return false;
    const rate=this.reducedMotion.matches?0:playback.rate;
    if(!force&&rate&&now-this.lastTruckFrame<70) return this.trucksMoving;
    this.lastTruckFrame=now;
    const clock=playback.clock+(now-playback.now)*rate/1000;
    let moving=false;
    const cells=new Map(), shown=new Set();
    const pitch=this.pixel>1.8?58:this.pixel>.11?43:28;
    for(const trip of playback.trips) {
      const id=trip.vehicle.id;
      const isFocus=this.focused?.vehicle.id===id;
      if(this.hidden.trips.has(id)||this.focused&&!isFocus) continue;
      const entry=this.trucks.get(id);
      const {leg,fraction,progress}=tripLegPosition(trip.route,trip.elapsed+(clock-trip.at)/3600);
      if(progress>=1&&!isFocus) continue;
      const position=project(...roadPosition(leg.shape,fraction));
      const [x,y]=this.screenPoint(position);
      if(x < -16 || x > this.viewport.width+16 || y < -16 || y > this.viewport.height+16) continue;
      const key=`${Math.floor(x/pitch)},${Math.floor(y/pitch)}`;
      const bin=cells.get(key);
      if(bin) bin.count++;
      else cells.set(key,{entry,position,count:1,arrived:progress>=1});
      moving ||= progress<1;
    }
    for(const {entry,position,count,arrived} of cells.values()) {
      shown.add(entry);
      if(!entry.el) this.truckMarker(entry);
      if(entry.count!==count) {
        entry.count=count;
        entry.el.classList.toggle('cluster',count>1);
        entry.label.textContent=count>99?'99+':count;
      }
      const name=count>1&&this.pixel>.015?`Приблизить группу машин · ${count}`:`Машина ${entry.id}`;
      if(entry.name!==name) {entry.name=name;entry.el.setAttribute('aria-label',name);}
      if(entry.arrived!==arrived) {entry.arrived=arrived;entry.el.classList.toggle('arrived',arrived);}
      if(force||entry.position?.[0]!==position[0]||entry.position?.[1]!==position[1]) {
        entry.position=position;
        this.place(entry.el,position);
      }
      if(!entry.visible) {entry.el.classList.remove('map-hidden');entry.visible=true;}
    }
    for(const entry of this.shownTrucks??[]) if(!shown.has(entry)) {
      entry.el.classList.add('map-hidden');
      entry.visible=false;
    }
    this.shownTrucks=shown;
    this.trucksMoving=Boolean(rate&&moving);
    return this.trucksMoving;
  }
}
