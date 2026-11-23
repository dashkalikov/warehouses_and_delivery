import { cities, zones } from './data.mjs';
import { tripDistance } from './domain.mjs';
import { siteActivities, tripHours, warehouseStaff } from './operations.mjs';
import { projectMapPoint } from './spatial.mjs';
import { duration, escapeText, icon, num, status } from './ui.mjs';
import { workLabels } from './warehouse-work.mjs';

const city=id=>cities[id][0];
export const yardFilters={
  all:'Все',incoming:'Прибывающие',outgoing:'Отправляемые',transit:'Транзитные',onsite:'На территории',
  parked:'На стоянке',loading:'Загрузка',unloading:'Разгрузка',repair:'Ремонт',
};
const directions={incoming:'Прибытие',outgoing:'Отправление',transit:'Транзит'};

function matchesYard(row,filter) {
  if(filter==='all') return true;
  if(filter==='onsite') return row.onSite;
  if(filter==='incoming') return row.direction===filter&&!row.onSite;
  return row.direction===filter||row.activity===filter;
}

export function renderYard(rows,filter) {
  const facilities=rows.filter(row=>row.onSite);
  const counts={
    all:rows.length,onsite:facilities.length,
    ...Object.fromEntries(Object.keys(yardFilters).filter(key=>key!=='all'&&key!=='onsite').map(key=>[key,rows.filter(row=>matchesYard(row,key)).length])),
  };
  const entries=rows.filter(row=>matchesYard(row,filter)).map(row=>{
    const {vehicle:v,trip}=row;
    const [label,state]=siteActivities[row.activity];
    const when=row.eta>0?duration(row.eta):row.passed?'Узел пройден':row.onSite?'На площадке':row.activity==='delivered'?'Завершено':'Выполняется';
    return `<tr><td><button class="table-object yard-asset" type="button" data-action="vehicle" data-id="${v.id}">${icon('truck',17)}<span><b>${v.id}</b><small>${v.name}</small></span></button></td>
      <td>${row.direction?directions[row.direction]:'—'}<small>${trip?city(trip.route.nodes[0])+' → '+city(trip.route.nodes.at(-1)):'Местная стоянка'}</small></td>
      <td>${status(state,label)}</td><td>${when}</td><td>${v.driver}</td></tr>`;
  }).join('');
  return `<div class="yard-filters" role="group" aria-label="Фильтры транспорта склада">${Object.entries(yardFilters).map(([id,label])=>`<button class="btn secondary" type="button" data-action="yard-filter" data-id="${id}" aria-pressed="${id===filter}">${label}<b>${counts[id]}</b></button>`).join('')}</div>
    ${entries?`<div class="table-wrap"><table class="yard-table"><thead><tr><th>Транспорт</th><th>Поток и направление</th><th>Операция</th><th>До события</th><th>Водитель</th></tr></thead><tbody>${entries}</tbody></table></div>`:'<p class="empty-state">По этому фильтру машин нет.</p>'}`;
}

export function renderStaff(warehouse,filter) {
  const roster=warehouseStaff(warehouse);
  const roles=[...new Set(roster.map(person=>person.role))];
  const staff=roster.filter(person=>!filter||person.role===filter);
  return `<div class="staff-controls"><label>Должность <select id="staff-role"><option value="">Все должности</option>${roles.map(role=>`<option ${role===filter?'selected':''}>${role}</option>`).join('')}</select></label><span>${staff.length} из ${roster.length} сотрудников</span></div>
    <div class="table-wrap"><table class="staff-table"><thead><tr><th>Сотрудник</th><th>Должность</th><th>Рабочая зона</th></tr></thead><tbody>
    ${staff.map(person=>`<tr><td><span class="person-initials">${person.name.split(' ').map(p=>p[0]).join('')}</span><b>${person.name}</b><small>${person.id}</small></td>
    <td>${person.role}<small>${workLabels[person.task]}</small></td><td><b>${person.zone}</b> · ${zones.find(zone=>zone.id===person.zone).name}
    <button class="text-btn staff-model-link" type="button" data-action="show-person" data-id="${person.id}" aria-label="Показать ${person.name} в 3D">${icon('locate',14)} На модели</button></td></tr>`).join('')}</tbody></table></div>`;
}

const boxes=new WeakMap();
function routeOverview(route) {
  if(boxes.has(route)) return boxes.get(route);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const leg of route.legs) for(const coord of leg.shape) {
    const [x,y]=projectMapPoint(...coord);
    minX=Math.min(x,minX); maxX=Math.max(x,maxX); minY=Math.min(y,minY); maxY=Math.max(y,maxY);
  }
  const viewW=436,viewH=134,pad=13;
  const scale=Math.min((viewW-pad*2)/Math.max(1,maxX-minX),(viewH-pad*2)/Math.max(1,maxY-minY));
  const toScreen=position=>{
    const [x,y]=projectMapPoint(...position);
    return [viewW/2+(x-(minX+maxX)/2)*scale,viewH/2+(y-(minY+maxY)/2)*scale].map(value=>value.toFixed(1));
  };
  boxes.set(route,toScreen);
  return toScreen;
}

export function routeDiagram(route,trace) {
  const toScreen=routeOverview(route);
  const path=parts=>parts.map(shape=>{
    const step=Math.max(1,Math.ceil(shape.length/220));
    const line=shape.filter((_,i)=>i%step===0||i===shape.length-1);
    return 'M'+line.map(position=>toScreen(position).join(',')).join('L');
  }).join('');
  const [x,y]=toScreen(trace.past.at(-1)?.at(-1)??route.legs[0].shape[0]);
  const [sx,sy]=toScreen(route.legs[0].shape[0]);
  const [ex,ey]=toScreen(route.legs.at(-1).shape.at(-1));
  return `<svg viewBox="0 0 436 134" role="img" aria-label="Полная линия маршрута с пройденным и оставшимся путём" class="route-diagram">
    <path class="trace-ahead" d="${path(trace.ahead)}"/><path class="trace-past" d="${path(trace.past)}"/><circle class="trace-node" cx="${sx}" cy="${sy}" r="3.5"/>
    <circle class="trace-node" cx="${ex}" cy="${ey}" r="3.5"/><circle class="trace-vehicle" cx="${x}" cy="${y}" r="4.4"/></svg>`;
}

export function renderTripTimeline(trip,clock) {
  const route=trip.route;
  const elapsed=tripHours(trip,clock);
  let hours=0,km=0;
  return route.nodes.map((id,i)=>{
    const incoming=route.legs[i-1];
    if(incoming) { hours+=incoming.hours; km+=incoming.km; }
    const passed=elapsed>=hours;
    return `<li class="${passed?'passed':''}"><i></i><div><b>${city(id)}</b><small>${i===0?'Отправление':i===route.nodes.length-1?'Назначение':'Точка маршрута'}</small></div><span>${num(km)} км</span><span>${passed?'Пройдено':duration(hours-elapsed)}</span></li>`;
  }).join('');
}

export const tripTrace=(trip,clock,shape=true)=>tripDistance(trip.route,tripHours(trip,clock),shape);

export function mapObjectList(kind,warehouses,trips,hidden,term) {
  const rows=kind==='warehouses'
    ?warehouses.map(site=>({id:site.id,title:site.name,description:city(site.id)+' · '+site.code}))
    :trips.map(trip=>({id:trip.vehicle.id,title:trip.vehicle.id+' · '+trip.vehicle.name,description:city(trip.route.nodes[0])+' → '+city(trip.route.nodes.at(-1))}));
  const matched=rows.filter(i=>(i.title+' '+i.description).toLowerCase().includes(term.trim().toLowerCase()));
  const list=matched.map(item=>`<label><input type="checkbox" data-map-object="${kind}" value="${item.id}" ${hidden.has(item.id)?'':'checked'}>
      <span><b>${escapeText(item.title)}</b><small>${escapeText(item.description)}</small></span></label>`).join('');
  return {list:list||'<p class="empty-state">Объекты не найдены.</p>',visible:rows.filter(row=>!hidden.has(row.id)).length,total:rows.length,ids:matched.map(row=>row.id)};
}
