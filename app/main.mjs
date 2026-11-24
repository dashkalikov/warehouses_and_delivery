import { cities, roads, warehouses, zones, fleet, equipment, statusText } from './data.mjs';
import { createRoutePlanner, predictMaintenance, telemetry, tripPosition } from './domain.mjs';
import { LogisticsMap } from './map.mjs';
import { facilityLayout } from './spatial.mjs';
import { hasCargoRoof, vehicleSpecifications } from './vehicle-specs.mjs';
import { chooseGraphics, graphicsOptions } from './graphics.mjs';
import { icon, button, num, duration, status, spark, escapeText } from './ui.mjs';
import { driverProfile, siteVehicles, tripHours, tripPhase, warehouseStaff } from './operations.mjs';
import { mapObjectList, renderStaff, renderTripTimeline, renderYard, routeDiagram, tripTrace } from './dispatch-ui.mjs';
import { SensorHistory, sensorReading } from './telemetry-store.mjs';
import { chartScrub, telemetryContent, telemetryToolbar, telemetryCSV } from './telemetry-dashboard.mjs';
import { inventorySummary, manifestFor, stockFor } from './inventory.mjs';
import { cargoPreview, filterInventory, inventoryPanel, inventoryRows, productSheet } from './inventory-ui.mjs';
import { palettes, resolveAppearance, themeNames } from './appearance.mjs';

const $=selector=>document.querySelector(selector);
const warehousesById=new Map(warehouses.map(w=>[w.id,w]));
const fleetById=new Map(fleet.map(v=>[v.id,v]));
const warehouse=id=>warehousesById.get(id);
const vehicle=id=>fleetById.get(id);
const city=id=>cities[id][0];
const attr=(name,id)=>`data-action="${name}" data-id="${id}"`;
const action=(name,text,glyph,cls='secondary')=>`<button type="button" class="btn ${cls}" data-action="${name}">${glyph?icon(glyph,17):''}${text}</button>`;
const badge=(key)=>status(key,statusText[key]);
const forecast=(v,t=state.clock)=>predictMaintenance(telemetry(v,t));
const lab=(a,b)=>`<div class="detail-pair"><span>${a}</span><strong>${b}</strong></div>`;
const routeName=route=>city(route.nodes[0])+' → '+city(route.nodes.at(-1));
const graphOptions={allowActive:true,maxRoutes:1};
const planRoute=createRoutePlanner(roads);
const pages={
  overview:['Пульт управления','overview'],
  warehouses:['Склады','warehouse'],
  fleet:['Транспорт','truck'],
  routes:['Маршруты','route'],
  analytics:['Телеметрия','activity'],
  service:['Обслуживание','tool'],
  settings:['Настройки','settings'],
};
const descriptions={
  overview:'Состояние складов, рейсов и техники в едином окне.',
  warehouses:'Зоны хранения, доки, грузы и оборудование распределительных центров.',
  fleet:'Парк, водители, загрузка и техническое состояние машин.',
  routes:'Сравнение маршрутов с учётом груза, дорожных ограничений и состояния техники.',
  analytics:'История датчиков и статистика по каждому активу.',
  service:'Диагностика складской техники и автопарка по данным симуляции.',
  settings:'Тема интерфейса и источники картографических данных.',
};
const systemTheme=matchMedia('(prefers-color-scheme: dark)');
function readSetting(key,fallback) {
  try { return localStorage.getItem('kontur.'+key)??fallback; } catch { return fallback; }
}
function saveSetting(key,value) {
  try { localStorage.setItem('kontur.'+key,value); } catch { /* Preferences remain active for this session. */ }
}
const savedTheme=readSetting('theme','light');
const savedPalette=readSetting('palette','kontur');
const savedGraphics=readSetting('graphics','auto');
const preferences={theme:Object.hasOwn(themeNames,savedTheme)?savedTheme:'light',
  palette:Object.hasOwn(palettes,savedPalette)?savedPalette:'kontur',streets:readSetting('streets','off')==='on',
  graphics:Object.hasOwn(graphicsOptions,savedGraphics)?savedGraphics:'auto'};
function graphicsProfile() { return chooseGraphics(preferences.graphics,navigator); }
function applyGraphics() {
  document.documentElement.classList.toggle('economy-graphics',!graphicsProfile().antialias);
}
const networkLayers=[['warehouses','Склады','pin'],['vehicles','Машины','truck'],['routes','Маршруты','line'],['districts','Районы доставки','district'],['coverage','Покрытие складов','cover']];
const mapLayers=[...networkLayers,['regions','Границы регионов'],['cities','Населённые пункты'],['roads','Дороги'],['hubs','Аэропорты и ж/д']];
const layerSetting=id=>id==='coverage'?'coverage':'layer.'+id;
const visibleLayers=Object.fromEntries(mapLayers.map(([id])=>[id,readSetting(layerSetting(id),'on')==='on']));
const visibility={warehouses:readHidden('warehouses'),trips:readHidden('trips')};
function readHidden(kind) {
  try {
    const values=JSON.parse(readSetting('hidden.'+kind,'[]'));
    return new Set(Array.isArray(values)?values:[]);
  } catch { return new Set(); }
}
function applyTheme() {
  const {mode,palette,colors}=resolveAppearance(preferences.theme,preferences.palette,systemTheme.matches);
  const root=document.documentElement;
  root.dataset.theme=mode;
  root.dataset.palette=palette;
  for(const [key,value] of Object.entries(colors)) root.style.setProperty('--palette-'+key,value);
  document.querySelector('meta[name="theme-color"]').content=colors.canvas;
}
systemTheme.addEventListener('change',applyTheme);
applyTheme();
applyGraphics();
const state={
  page: 'overview', clock: 0, warehouseClock:0, playing:true, speed:1, selected:'msk',
  zone:'D', dialog:null, vehicleFilter:'all', serviceFilter:'all',
  telemetryGroup:'vehicle',telemetryAsset:'TR-104',telemetryWindow:3600,telemetryMinute:null,
  mapFolder:'warehouses',mapQuery:'',focusedTrip:null,
  listPages:{warehouses:0,fleet:0,service:0,trips:0},
  draft:{ from:'msk',to:'ekb',vehicle:'TR-421',load:14,pallets:22,goods:'Комплектующие',cold:false,criterion:'distance',traffic:false,blocked:false },
  plans:[], planIndex:0, planError:'', planned:null, scheduled:new Map(),
};
state.trips=fleet.filter(v=>v.destination).flatMap(v=>{
  const route=planRoute(v.home,v.destination,v,v.load,'fast',graphOptions)[0];
  if(!route) return [];
  const elapsed=v.progress<0?v.progress:v.progress>1?route.hours+.08:route.hours*v.progress;
  return [{ vehicle:v, route, at:0, elapsed, load:v.load, pallets:v.pallets, goods:v.goods }];
});
const tripsByVehicle=new Map(state.trips.map(trip=>[trip.vehicle.id,trip]));
const telemetryAssets={vehicle:fleet,equipment,warehouse:warehouses};
const history=new SensorHistory(Object.values(telemetryAssets).flat());
let map, model, modelModule, mapCard, toastTimer;
let clockUpdated=performance.now();
function advanceTime() {
  const now=performance.now();
  if(state.playing) {
    const seconds=(now-clockUpdated)/1000;
    state.clock+=seconds*state.speed;
    state.warehouseClock+=seconds;
  }
  clockUpdated=now;
}
const animationRate=()=>state.playing?state.speed:0;
const elapsed=t=>tripHours(t,state.clock);
const tripFor=id=>tripsByVehicle.get(id);
const movement=t=>tripPosition(t.route,elapsed(t));
const vehicleState=v=>tripFor(v.id)?tripPhase(tripFor(v.id),state.clock):v.status;
const vehicleBadge=key=>key==='loading'?status('watch','Загрузка'):key==='unloading'?status('watch','Разгрузка'):badge(key);
const maintainedAssets=[...fleet,...equipment];
function alertList() {
  const alerts=[];
  for(const asset of maintainedAssets) {
    const {risk}=forecast(asset);
    if(risk>=45) alerts.push({asset,risk});
  }
  return alerts.sort((a,b)=>b.risk-a.risk).map(row=>row.asset);
}
const clockFormat=new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'UTC'});
const clockStart=Date.UTC(2026,10,23,9,42);
const clockLabel=()=>clockFormat.format(clockStart+state.clock*1000);

$('#sidebar').innerHTML=`<button type="button" class="brand" data-page="overview" aria-label="WD — пульт управления"><img src="./assets/mark.svg" alt="" width="48" height="48"/><span><b>WD</b><small>Warehouses &amp; Delivery</small></span></button>
  <div class="side-label">РАБОЧАЯ ОБЛАСТЬ</div>
  <nav aria-label="Разделы приложения">${Object.entries(pages).filter(([key])=>key!=='settings').map(([key,[text,glyph]])=>`<button type="button" data-page="${key}">${icon(glyph,19)}<span>${text}</span>${key==='service'?'<span class="nav-count" id="nav-count"></span>':''}</button>`).join('')}</nav>
  <div class="side-foot"><button type="button" class="settings-link" data-page="settings">${icon('settings',19)} Настройки</button><div class="sim-box"><span class="sim-light"></span><div><b>Демонстрационный режим</b><small>Учебная модель МАИ</small></div></div></div>`;
$('#topbar').innerHTML=`<div class="top-left">${button('toggle-nav','menu','Открыть меню')}<span class="crumb-root">Логистика</span><span class="crumb-sep">/</span><strong id="crumb"></strong></div>
  <div class="top-right">
    <div class="search-area"><label class="search">${icon('search',17)}<input id="search" type="search" placeholder="Склад, город или машина" aria-label="Поиск склада, города или машины" autocomplete="off"><kbd>/</kbd></label><div class="popover search-results" id="search-results" hidden></div></div>
    <div class="notification-wrap">${button('notifications','bell','Оповещения')}<span id="bell-dot" class="bell-dot"></span><div id="notifications" class="popover notices" hidden></div></div>
    <span class="avatar" title="Диспетчер">АД</span>
  </div>`;

function makeMap() {
  mapCard=document.createElement('section');
  mapCard.className='panel map-card';
  mapCard.innerHTML=`
    <div class="panel-head map-head"><div><h2>Карта сети</h2><p>Городские площадки и рейсы по России</p></div>
      <div class="map-head-actions"><div class="segment" aria-label="Охват карты"><button type="button" data-action="map-reset" class="selected">Сеть</button><button type="button" data-action="map-country">Вся Россия</button></div><select id="map-city" aria-label="Приблизить город"><option value="">Города</option>${warehouses.filter(w=>!w.metro).sort((a,b)=>city(a.id).localeCompare(city(b.id),'ru')).map(w=>`<option value="${w.id}">${escapeText(city(w.id))}</option>`).join('')}</select>${button('map-full','expand','Полноэкранная карта')}</div>
    </div>
    <div class="map-body"><div id="geo-host"></div>
      <button type="button" class="map-caption" data-action="map-north" aria-label="Север сверху" title="Вернуть север вверх"><span class="compass-mark"><svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path fill="#f16a61" d="M12 2 17.4 12 12 10.7 6.6 12Z"/><path fill="currentColor" d="m12 22 5.4-10-5.4 1.3L6.6 12z"/></svg></span><span>С</span></button>
      <span class="map-level" aria-label="Масштаб карты"></span>
      <div class="map-tools">
        ${button('map-in','plus','Увеличить карту')}${button('map-out','minus','Уменьшить карту')}${button('map-turn','compass','Повернуть карту')}${button('map-layers','layers','Слои карты')}${button('map-objects','grid','Объекты на карте')}
        <div class="map-layers popover" id="map-layers" hidden>
          ${mapLayers.map(([id,label])=>`<label><input type="checkbox" data-map-layer="${id}" ${visibleLayers[id]?'checked':''}> ${label}</label>`).join('')}
        </div>
        <div id="map-objects" class="map-objects popover" hidden>
          <div class="panel-head"><h3>Объекты на карте</h3>${button('map-objects','close','Закрыть список объектов')}</div>
          <div class="map-objects-tabs" role="group" aria-label="Тип объектов"><button type="button" class="btn secondary" data-action="map-folder" data-id="warehouses" aria-pressed="true">Склады</button><button type="button" class="btn secondary" data-action="map-folder" data-id="trips" aria-pressed="false">Рейсы</button></div>
          <label class="sr-only" for="map-object-query">Найти объект на карте</label><input id="map-object-query" type="search" placeholder="Название, город или номер">
          <div class="map-objects-actions"><span id="map-object-count"></span><button type="button" data-action="map-show-matches">Показать все</button><button type="button" data-action="map-hide-matches">Скрыть все</button></div>
          <div id="map-object-list" class="map-object-list"></div>
        </div>
      </div>
      <div class="map-attribution"><span class="scale-label"></span><a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener">Natural Earth</a><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a></div>
    </div>
    <div class="map-foot"><div class="map-key" role="group" aria-label="Видимость слоёв сети">${networkLayers.map(([id,label,key])=>`<button class="cover-switch" ${attr('network-layer',id)} type="button" aria-pressed="${visibleLayers[id]}"><i class="key-${key}"></i> ${label}</button>`).join('')}</div><div class="map-live"><span></span><b data-clock></b></div></div>
    <div class="map-trip-bar" id="map-trip-bar" hidden></div>
    <p class="sr-only" id="map-controls">Выберите карту. W, A, S, D перемещают карту, Q, E или стрелки влево и вправо поворачивают её. Home возвращает север вверх.</p>`;
  $('#main').append(mapCard);
  map=new LogisticsMap($('#geo-host'),{select:openAsset,error:notify,city:id=>setMapSegment(null,id)});
  Object.assign(map.layer,visibleLayers);
  map.setVisibility(visibility);
  map.setOnline(preferences.streets);
}

function overview() {
  const summaries=[
    ['warehouse','Склады в сети',warehouses.length,'Распределительные центры','green','warehouses'],
    ['truck','Рейсы в движении','<span id="kpi-trips"></span>',`${num(fleet.length)} машин в парке`,'blue','fleet'],
    ['box','Груз в пути','<span id="kpi-load"></span> <small>т</small>','По активным рейсам','teal','routes'],
    ['alert','Предупреждения','<span id="kpi-alerts"></span>','Требуют внимания механика','orange','service'],
  ];
  return `<div class="kpis">${summaries.map(([glyph,label,value,meta,color,page])=>`<button type="button" class="panel kpi" data-page="${page}"><div class="kpi-top"><span class="metric-icon ${color}">${icon(glyph,19)}</span><span>${label}</span></div><div class="kpi-value">${value}</div><span class="kpi-meta">${meta}</span></button>`).join('')}</div>
    <div class="map-layout"><div class="map-slot"></div><aside class="overview-side">
      <section class="panel focus" id="focus-warehouse"></section>
      <section class="panel events"><div class="panel-head"><h2>Требует внимания</h2>${button('see-service','arrow','Открыть обслуживание')}</div><div id="event-list"></div></section>
    </aside></div>
    <section class="panel trips"><div class="panel-head"><div><h2>Журнал рейсов</h2><p>Маршруты, операции на площадках и время прибытия</p></div>${action('open-planner','Планировщик','route')}</div>
    <div id="trips-table"></div></section>`;
}

function focusCard() {
  const w=warehouse(state.selected);
  const nearby=warehouses.filter(item=>item.id!==(w.metro??w.id)&&item.metro===(w.metro??w.id)).length;
  return `<div class="panel-head"><div class="focus-eyebrow">${icon('pin',16)}<span>${w.region}</span></div><span class="code">${w.code}</span></div>
    <div class="focus-content"><h2>${w.name}</h2><p>${w.subtitle} · ${city(w.id)}</p>
    <div class="progress-head"><span>Загрузка склада</span><b data-fill="${w.id}">${w.fill}%</b></div><div class="load-bar"><span data-fill-bar="${w.id}" style="width:${w.fill}%"></span></div>
    <div class="focus-facts"><span><b>${w.docks}</b> доков</span><span><b>${w.staff}</b> в смене</span></div>
    <button class="btn primary full" ${attr('warehouse',w.id)}>${icon('cube',19)} Открыть 3D-модель</button>
    <button class="btn secondary full nearby-btn" ${attr('warehouse-yard',w.id)}>${icon('truck',17)} Транспорт площадки</button>
    ${nearby?`<button class="btn secondary full nearby-btn" ${attr('map-show-city',w.metro??w.id)}>${icon('locate',17)} Склады рядом</button>`:''}</div>`;
}

function listPage(key,items,limit) {
  const last=Math.max(0,Math.ceil(items.length/limit)-1);
  const index=state.listPages[key]=Math.max(0,Math.min(last,state.listPages[key]));
  const start=index*limit;
  const controls=last?`<nav class="registry-pages" aria-label="Страницы списка" data-list="${key}">
    <span>${num(start+1)}–${num(Math.min(items.length,start+limit))} из ${num(items.length)}</span>
    <button class="btn secondary" type="button" ${attr('list-page',key+'/'+(index-1))} ${index===0?'disabled':''}>Назад</button>
    <button class="btn secondary" type="button" ${attr('list-page',key+'/'+(index+1))} ${index===last?'disabled':''}>Далее</button>
  </nav>`:'';
  return {shown:items.slice(start,start+limit),controls};
}

function listWarehouses() {
  const {shown,controls}=listPage('warehouses',warehouses,24);
  return `${controls}<div class="cards warehouses">${shown.map(w=>`<article class="panel object-card">
    <div class="object-top"><span class="metric-icon green">${icon('warehouse',22)}</span><span class="code">${w.code}</span></div>
    <h2>${w.name}</h2><p>${city(w.id)} · ${facilityLayout(w).type}</p>
    <div class="object-meta">${lab('Площадь',num(w.area)+' м²')}${lab('Доки',w.docks)}${lab('В смене',w.staff+' чел.')}</div>
    <div class="progress-head"><span>Загрузка</span><b data-fill="${w.id}">${w.fill}%</b></div><div class="load-bar"><span data-fill-bar="${w.id}" style="width:${w.fill}%"></span></div>
    <button class="btn secondary full" ${attr('warehouse',w.id)}>${icon('cube',17)} Модель и показатели</button>
  </article>`).join('')}</div>`;
}

function listFleet() {
  const options={ all:'Весь парк',active:'В пути',reserve:'В резерве',loading:'Загрузка',unloading:'Разгрузка',service:'ТО',done:'Прибыли' };
  const filter=Object.entries(options).map(([key,label])=>`<button type="button" data-action="fleet-filter" data-id="${key}" class="${state.vehicleFilter===key?'selected':''}">${label}</button>`).join('');
  const {shown,controls}=listPage('fleet',fleet.filter(v=>state.vehicleFilter==='all'||vehicleState(v)===state.vehicleFilter),36);
  const rows=shown.map(v=>{
    const t=tripFor(v.id);
    return `<tr><td><button class="table-object" ${attr('vehicle',v.id)}><span class="metric-icon blue">${icon('truck',20)}</span><span><b>${v.id} · ${v.name}</b><small>${v.subtitle}</small></span></button></td><td id="fleet-state-${v.id}">${vehicleBadge(vehicleState(v))}</td><td>${v.driver}</td><td>${t?num(t.load,1)+' / ':''}${num(v.capacity,1)} т</td><td>${t?routeName(t.route):city(v.home)}</td><td id="fleet-risk-${v.id}">${badge(forecast(v).level)}</td><td>${button('vehicle:'+v.id,'cube','Открыть модель '+v.id)}</td></tr>`;
  }).join('');
  return `<section class="panel"><div class="panel-head"><h2>Реестр машин</h2><div class="segment">${filter}</div></div>${controls}<div class="table-wrap"><table><thead><tr><th>Машина</th><th>Статус</th><th>Водитель</th><th>Груз</th><th>Направление</th><th>Диагностика</th><th><span class="sr-only">Модель</span></th></tr></thead><tbody>${rows||'<tr><td colspan="7">В этой группе пока нет машин.</td></tr>'}</tbody></table></div></section>`;
}

function formField(label,html) { return `<label class="field"><span>${label}</span>${html}</label>`; }
function selectOptions(rows,selected) { return rows.map(([id,label])=>`<option value="${id}" ${selected===id?'selected':''}>${label}</option>`).join(''); }
function reserveOptions(origin,selected) {
  const available=fleet.filter(v=>v.home===origin&&vehicleState(v)==='reserve');
  return selectOptions(available.length?available.map(v=>[v.id,`${v.id} · ${v.subtitle} · ${num(v.capacity,1)} т`]):[['','Нет свободных машин']],selected);
}
function planner() {
  const d=state.draft;
  const cityOptions=warehouses.map(w=>[w.id,w.metro?city(w.id)+' · '+w.code:city(w.id)]);
  return `<div class="planner-layout"><section class="panel planner"><div class="panel-head"><div><h2>Параметры рейса</h2><p>Выберите груз и машину на складе отправления.</p></div></div>
    <form id="planner-form" class="planner-form"><div class="form-row">
      ${formField('Откуда',`<select name="from">${selectOptions(cityOptions,d.from)}</select>`)}
      ${formField('Куда',`<select name="to">${selectOptions(cityOptions,d.to)}</select>`)}
    </div>
    ${formField('Транспорт',`<select name="vehicle">${reserveOptions(d.from,d.vehicle)}</select>`)}
    <div class="form-row">
      ${formField('Масса, т',`<input name="load" type="number" min="0.1" max="40" step="0.1" value="${d.load}" required>`)}
      ${formField('Палеты, шт.',`<input name="pallets" type="number" min="1" max="40" value="${d.pallets}" required>`)}
    </div>
    ${formField('Наименование груза',`<input name="goods" maxlength="60" value="${escapeText(d.goods)}" required>`)}
    ${formField('Критерий',`<select name="criterion">${selectOptions([['distance','Кратчайший по дорогам'],['fast','Минимум времени'],['cost','Минимум затрат'],['safe','Минимум риска'],['balanced','Баланс времени, затрат и риска']],d.criterion)}</select>`)}
    <div class="form-toggles"><label><input type="checkbox" name="cold" ${d.cold?'checked':''}> Холодовая цепь</label><label><input type="checkbox" name="traffic" ${d.traffic?'checked':''}> Рост задержек на дорогах</label><label><input type="checkbox" name="blocked" ${d.blocked?'checked':''}> Закрыть участок Уфа — Екатеринбург</label></div>
    <button class="btn primary full" type="submit">${icon('route',18)} Рассчитать варианты</button><p id="plan-error" role="alert" ${state.planError?'':'hidden'}>${state.planError}</p>
  </form></section><div class="map-slot"></div></div>
  <section class="panel results"><div class="panel-head"><div><h2>Сравнение вариантов</h2><p>Расстояние по дорожной сети · время движения без остановок на отдых</p></div></div><div id="route-results"></div></section>`;
}

function service() {
  const list=[...fleet,...equipment].map(asset=>({asset,risk:forecast(asset).risk}))
    .filter(row=>state.serviceFilter==='all'||row.risk>=45).sort((a,b)=>b.risk-a.risk);
  const {shown,controls}=listPage('service',list,32);
  const rows=shown.map(({asset:v})=>{
      const meters=telemetry(v,state.clock), f=forecast(v);
      return `<tr><td><button class="table-object" ${attr(v.kind?'vehicle':'equipment',v.id)}><span class="metric-icon ${v.kind?'blue':'green'}">${icon(v.kind?'truck':'tool',18)}</span><span><b>${v.id} · ${v.name}</b><small>${v.kind?'Автопарк':'Складская техника · РЦ Север'}</small></span></button></td><td data-svc="${v.id}" data-metric="level">${badge(f.level)}</td><td data-svc="${v.id}" data-metric="temperature">${num(meters.temperature,1)} °C</td><td data-svc="${v.id}" data-metric="vibration">${num(meters.vibration,1)} мм/с</td><td data-svc="${v.id}" data-metric="risk">${f.risk}%</td><td data-svc="${v.id}" data-metric="rul">≈ ${f.rul} ч</td><td><button class="btn secondary ${state.scheduled.has(v.id)?'scheduled':''}" ${attr('schedule',v.id)}>${state.scheduled.has(v.id)?'ТО назначено':'Назначить ТО'}</button></td></tr>`;
    }).join('');
  return `<div class="service-banner panel"><span class="metric-icon orange">${icon('activity',24)}</span><div><h2>Оценка по состоянию</h2><p>Модель вычисляет индекс риска по температуре, вибрации и износу. Остаточный ресурс — оценка в часах работы.</p></div></div>
  <section class="panel"><div class="panel-head"><h2>Состояние активов</h2><div class="segment"><button type="button" data-action="service-filter" data-id="all" class="${state.serviceFilter==='all'?'selected':''}">Все активы</button><button type="button" data-action="service-filter" data-id="risk" class="${state.serviceFilter==='risk'?'selected':''}">Требуют внимания</button></div></div>
  ${controls}<div class="table-wrap"><table><thead><tr><th>Техника</th><th>Статус</th><th>Температура</th><th>Вибрация</th><th>Индекс риска</th><th>Ресурс</th><th>Обслуживание</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function settings() {
  return `<div class="settings-layout">
    <section class="panel settings-panel"><div class="panel-head"><div><h2>Режим оформления</h2><p>Светлый, тёмный или по настройкам устройства.</p></div><span class="metric-icon blue">${icon('sun',21)}</span></div>
      <div class="theme-choices" role="group" aria-label="Тема интерфейса">${Object.entries(themeNames).map(([id,[label,glyph]])=>`
        <button type="button" class="theme-choice" ${attr('set-theme',id)} aria-pressed="${preferences.theme===id}">
          <span class="theme-preview ${id}" aria-hidden="true"><i></i><span><i></i><i></i><i></i></span></span>
          <span class="theme-name">${icon(glyph,18)} <b>${label}</b><span class="theme-check">${icon('check',15)}</span></span>
        </button>`).join('')}</div>
    </section>
    <section class="panel settings-panel"><div class="panel-head"><div><h2>Цветовая палитра</h2><p>Цвета интерфейса меняются сразу. Выбор сохраняется в этом браузере.</p></div><span class="metric-icon blue">${icon('layers',21)}</span></div>
      <div class="theme-choices palette-choices" role="group" aria-label="Цветовая палитра">${Object.entries(palettes).map(([id,{label,light,dark}])=>{
        const swatches=['canvas','sidebar','action'].flatMap(key=>[`--sample-${key}-light:${light[key]}`,`--sample-${key}-dark:${dark[key]}`]).join(';');
        return `<button type="button" class="theme-choice palette-choice" ${attr('set-palette',id)} aria-pressed="${preferences.palette===id}">
          <span class="theme-preview palette-preview" aria-hidden="true" style="${swatches}"><i></i><span><i></i><i></i><i></i></span></span>
          <span class="theme-name"><b>${label}</b><span class="theme-check" aria-hidden="true">${icon('check',15)}</span></span>
        </button>`;
      }).join('')}</div>
    </section>
    <section class="panel settings-panel"><div class="panel-head"><div><h2>Карта</h2><p>Геометрия, дороги и транспортные узлы доступны локально.</p></div><span class="metric-icon teal">${icon('layers',21)}</span></div>
      <label class="setting-switch"><span><b>Улицы OpenStreetMap</b><small>Подгружать подробную подложку при приближении. Для этого слоя нужен интернет.</small></span><input id="street-tiles" type="checkbox" role="switch" ${preferences.streets?'checked':''}></label>
    </section>
    <section class="panel settings-panel"><div class="panel-head"><div><h2>Производительность</h2><p>Режим влияет на разрешение 3D, тени и частоту отрисовки.</p></div><span class="metric-icon blue">${icon('cube',21)}</span></div>
      <label class="setting-switch"><span><b>Качество 3D-графики</b><small>«Экономия» подходит для слабых ноутбуков.</small></span><select id="graphics-mode" aria-label="Качество 3D-графики">${selectOptions(Object.entries(graphicsOptions),preferences.graphics)}</select></label>
    </section>
  </div>`;
}

const analytics=()=>telemetryToolbar(state.telemetryGroup,telemetryAssets,state.telemetryAsset,state.telemetryWindow);

function renderTelemetry(force=false) {
  const host=$('#telemetry-results');
  if(!host) return;
  const minute=Math.floor(state.clock/60);
  if(!force&&state.telemetryMinute===minute) return;
  state.telemetryMinute=minute;
  const asset=history.assets.get(state.telemetryAsset);
  const samples=history.samples(asset.id,state.clock,state.telemetryWindow);
  host.innerHTML=telemetryContent(asset,samples);
}

function renderPage() {
  if(mapCard) mapCard.remove();
  const key=state.page;
  $('#crumb').textContent=pages[key][0];
  document.querySelectorAll('#sidebar [data-page]:not(.brand)').forEach(el=>{
    el.classList.toggle('current',el.dataset.page===key);
    if(el.dataset.page===key) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
  });
  const control=['overview','analytics'].includes(key)?`<div class="page-controls"><button class="btn secondary sim-toggle" data-action="pause" id="pause"></button><label class="speed-label"><span>Темп рейсов</span><select id="speed" aria-label="Скорость симуляции рейсов">${selectOptions([['1','×1'],['5','×5'],['20','×20'],['60','×60']],String(state.speed))}</select></label>${key==='overview'?action('open-planner','Новый маршрут','plus','primary'):''}</div>`:'';
  const views={overview,warehouses:listWarehouses,fleet:listFleet,routes:planner,service,settings,analytics};
  $('#main').innerHTML=`<div class="page-title"><div><h1>${pages[key][0]}</h1><p>${descriptions[key]}</p></div>${control}</div>${views[key]()}`;
  const slot=$('.map-slot');
  if(slot) {
    slot.append(mapCard);
    map.selectWarehouse(state.selected);
    map.setPaths(state.trips,state.plans[state.planIndex],state.plans.find((_,i)=>i!==state.planIndex));
  }
  if(key==='overview') { $('#focus-warehouse').innerHTML=focusCard(); renderTrips(); }
  if(key==='routes') renderPlans();
  if(key==='analytics') state.telemetryMinute=null;
  refresh();
}

function renderTrips() {
  const host=$('#trips-table');
  if(!host) return;
  const {shown,controls}=listPage('trips',state.trips,30);
  const rows=shown.map(t=>`<tr><td><button class="table-object" ${attr('vehicle',t.vehicle.id)}><span class="metric-icon blue">${icon('truck',19)}</span><span><b>${t.vehicle.id}</b><small>${t.vehicle.subtitle}</small></span></button></td><td><b>${routeName(t.route)}</b><small class="table-note">${num(t.route.km)} км</small></td><td>${escapeText(t.goods)}<small class="table-note">${num(t.load,1)} т · ${t.pallets} палет</small></td><td id="trip-status-${t.vehicle.id}"></td><td id="trip-eta-${t.vehicle.id}"></td><td><button class="text-btn" ${attr('vehicle',t.vehicle.id)}>${icon('cube',18)}<span>Карточка</span></button></td></tr>`).join('');
  host.innerHTML=`${controls}<div class="table-wrap"><table><thead><tr><th>Машина</th><th>Направление</th><th>Груз</th><th>Статус</th><th>До прибытия</th><th><span class="sr-only">Подробности</span></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderPlans() {
  const host=$('#route-results');
  if(!host) return;
  if(!state.plans.length) { host.innerHTML='<div class="empty-state">Задайте параметры рейса и рассчитайте варианты.</div>'; return; }
  const active=state.plans[state.planIndex];
  host.innerHTML=`<div class="route-options">${state.plans.map((r,i)=>`<button class="route-option ${i===state.planIndex?'selected':''}" ${attr('choose-plan',i)} aria-pressed="${i===state.planIndex}">
    <span class="option-tag">${i===0?'Рекомендованный':`Вариант ${i+1}`}</span><b>${duration(r.hours)}</b><span>${num(r.km)} км · ${num(r.fuel)} л · ${num(r.cost)} ₽</span><small>Баллы риска ${num(r.risk,1)}</small></button>`).join('')}</div>
    <div class="plan-summary"><div><h3>${routeName(active)}</h3><p>${active.nodes.slice(1,-1).map(city).join(' · ')||'Прямой участок'}</p><p>${[...new Set(active.legs.map(l=>l.name))].join(' · ')}</p></div>${action('launch','Запустить рейс','play','primary')}</div>`;
}

function calculate(form) {
  const f=new FormData(form);
  state.draft={
    from:f.get('from'),to:f.get('to'),vehicle:f.get('vehicle'),load:Number(f.get('load')),
    pallets:Number(f.get('pallets')),goods:f.get('goods').trim(),criterion:f.get('criterion'),
    cold:f.has('cold'),traffic:f.has('traffic'),blocked:f.has('blocked'),
  };
  const d=state.draft, v=vehicle(d.vehicle);
  clearTripFocus();
  const palletLimit={semi:33,cold:24,box:18,van:6,flat:20};
  state.planError=d.from===d.to?'Выберите разные склады отправления и назначения.'
    :!v||vehicleState(v)!=='reserve'?'Выберите свободную машину.'
    :v.home!==d.from?'Машина находится на другом складе.'
    :d.load>v.capacity?'Масса превышает грузоподъёмность машины.'
    :d.pallets>palletLimit[v.kind]?'Количество палет превышает вместимость машины.'
    :d.cold&&!v.refrigerated?'Для этого груза нужен рефрижератор.'
    :!d.goods?'Укажите наименование груза.':'';
  state.planIndex=0;
  state.plans=state.planError?[]:planRoute(d.from,d.to,v,d.load,d.criterion,{
    traffic:d.traffic?4:1,closed:d.blocked?['ufa:ekb']:[],cold:d.cold,
  });
  if(!state.plans.length&&!state.planError) state.planError='Нет подходящего пути по учебному дорожному графу.';
  if(state.plans.length) {
    state.planned={...d};
    map.fitRoute(state.plans[0]);
    setMapLayer('routes',true);
  } else state.planned=null;
  const error=$('#plan-error');
  error.textContent=state.planError;
  error.hidden=!state.planError;
  map.setPaths(state.trips,state.plans[0],state.plans[1]);
  renderPlans();
}

function launch() {
  const d=state.planned;
  const route=state.plans[state.planIndex];
  if(!d||!route||vehicleState(vehicle(d.vehicle))!=='reserve') return notify('Пересчитайте маршрут для свободной машины.');
  advanceTime();
  const v=vehicle(d.vehicle);
  const trip={vehicle:v,route,at:state.clock,elapsed:0,load:d.load,pallets:d.pallets,goods:d.goods,cold:d.cold};
  state.trips.push(trip);
  tripsByVehicle.set(v.id,trip);
  state.plans=[]; state.planned=null; state.playing=true;
  changePage('overview');
  highlightTrip(v.id);
  notify(`Рейс ${v.id} запущен. Машина появилась на карте.`);
}

function zonePanel(w,z) {
  const compatible=w.id==='msk'?equipment.filter(eq=>eq.zone===z.id):[];
  const people=warehouseStaff(w).filter(person=>person.zone===z.id);
  const stock=inventorySummary(stockFor(w).filter(row=>row.zone===z.id));
  return `<div class="zone-header"><span class="zone-chip">${z.id}</span><div><h3>${z.name}</h3><p>Ячейки ${z.locations} · ${z.goods}</p></div></div>
    <div class="object-meta">${lab('Загрузка',`<span data-zone-fill="${z.id}">${z.fill}%</span>`)}${lab('В зоне',people.length+' чел.')}${lab('Хранится',num(stock.units)+' ед. · '+num(stock.pallets)+' пал.')}</div>
    ${compatible.map(eq=>`<button type="button" class="zone-equipment" ${attr('equipment',eq.id)}>${icon('tool',17)} <span>${eq.id} · ${eq.name}</span>${badge(forecast(eq).level)}</button>`).join('')}`;
}

function assetBody(kind,asset) {
  const w=kind==='warehouse'?asset:null;
  const v=kind==='vehicle'?asset:null;
  const t=v?tripFor(v.id):null;
  const eq=kind==='equipment'?asset:null;
  const layout=w?facilityLayout(w):null;
  const spec=v?vehicleSpecifications[v.kind]:null;
  const title=w?w.name:v?v.id+' · '+v.name:eq.id+' · '+eq.name;
  const subtitle=w?city(w.id)+' · '+w.subtitle:v?v.subtitle:'РЦ Север · Зона '+eq.zone;
  const roof=Boolean(w||v&&hasCargoRoof(v.kind));
  const walls=roof?'стены':'борта';
  const quickRoute=t?`<div class="asset-section quick-route"><div class="section-title"><h3>Маршрут рейса</h3><b id="route-percent">0%</b></div>
      <div class="route-progress-numbers"><div><small>Пройдено</small><strong id="route-driven"></strong></div><div><small>Осталось</small><strong id="route-left"></strong></div></div>
      <div class="route-preview" id="trip-mini"></div><button class="btn secondary full" ${attr('show-trip-map',v.id)}>${icon('locate',16)} Показать на карте</button></div>`:'';
  const modelPanel=eq?'':`<section class="scene-panel"><div class="scene-toolbar"><span>${icon('cube',17)} ${w?'3D-модель склада':'3D-модель транспорта'}</span>
    <div class="scene-actions"><button class="btn secondary scene-top" type="button" data-action="model-top" aria-pressed="false" data-3d-only>${icon('plan',17)} <span>Вид сверху</span></button>
      <div class="scene-zoom" data-3d-only>${button('model-in','plus','Приблизить модель')}${button('model-out','minus','Отдалить модель')}${button('model-reset','reset','Сбросить ракурс')}</div>
      <button class="icon-btn scene-full-action" data-action="model-full" type="button" aria-pressed="false" aria-label="Полноэкранная 3D-модель" title="Полноэкранная 3D-модель">${icon('expand',18)}</button>
    </div></div>
    <div class="shell-bar" role="group" aria-label="${w?'Корпус склада':'Грузовой кузов'}" data-3d-only>
      ${roof?`<button type="button" class="btn secondary shell-toggle" ${attr('shell','roof')} aria-pressed="true">${icon('roof',17)}<span>Скрыть крышу</span></button>`:''}
      <button type="button" class="btn secondary shell-toggle" ${attr('shell','walls')} aria-pressed="true">${icon('wall',17)}<span>Скрыть ${walls}</span></button>
      ${v&&roof?`<button class="btn secondary" type="button" data-action="cargo-doors" aria-pressed="false">${icon('box',17)}<span>Открыть грузовые двери</span></button>`:''}
      ${w?`<button type="button" class="btn secondary" data-action="scene-people" aria-pressed="true">${icon('users',17)} Люди в 3D</button>`:''}
      ${w?`<button type="button" class="btn secondary" data-action="zoom-zone">${icon('locate',17)} Зона крупно</button>`:''}
      ${v?`<button type="button" class="btn secondary" data-action="driver-view">${icon('users',17)} Кабина</button>`:''}
      <button type="button" class="btn primary shell-view" data-action="shell-view">${icon('layers',17)}<span>${w?'Показать интерьер':'Показать груз'}</span></button>
    </div>
    ${v?'<section class="cargo-preview" id="cargo-preview" aria-label="Изображения груза" hidden></section>':''}
    <canvas id="asset-model" tabindex="0" role="img" aria-describedby="scene-hint scene-keys" aria-label="${w?'Трёхмерный план склада с крышей, доками и оборудованием':'Трёхмерная модель транспортного средства'}"></canvas>
    <div class="scene-caption"><span id="scene-hint">Перетащите для вращения · колесо мыши для масштаба</span><b>${layout?`${num(layout.widthMeters)} × ${num(layout.depthMeters)} м`:num(spec.length,2)+' м'}</b></div>
    <div class="scene-keys" id="scene-keys" data-3d-only>
      <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Перемещение</span>
      <span><kbd>Q</kbd><kbd>E</kbd><span class="key-or">или</span><kbd>←</kbd><kbd>→</kbd> Поворот</span>
    </div>
  </section>`;
  const vehicleMedia=v?`<div class="segment asset-media-switch" role="group" aria-label="Вид транспорта">
    <button type="button" ${attr('asset-media','model')} class="selected" aria-pressed="true">${icon('cube',16)} 3D-модель</button>
    ${t?`<button type="button" ${attr('asset-media','route')} aria-pressed="false">${icon('route',16)} Полный маршрут</button>`:''}
    <button type="button" ${attr('asset-media','inventory')} aria-pressed="false">${icon('box',16)} Груз</button>
  </div><div id="vehicle-model-pane">${modelPanel}</div>${t?`<section class="asset-section route-detail" id="vehicle-route-pane" hidden aria-label="Полный маршрут">
    <h3>${routeName(t.route)}</h3><div id="trip-large" class="route-preview"></div>
    <div class="route-legend"><span><i class="past"></i> Пройдено</span><span><i></i> Осталось</span><b>${num(t.route.km)} км всего</b></div>
    <ol class="route-timeline" id="trip-timeline"></ol>
  </section>`:''}<section id="asset-inventory-pane" class="asset-section inventory-pane" hidden aria-label="Груз автомобиля"></section>`:'';
  const zoneMenu=w?`<div class="zone-nav"><b>Зоны склада</b><div>${zones.map(z=>`<button class="zone-select ${z.id===state.zone?'selected':''}" ${attr('select-zone',z.id)} aria-label="Зона ${z.id}, ${z.name}" aria-pressed="${z.id===state.zone}">${z.id}</button>`).join('')}</div></div>`:'';
  const warehouseInfo=w?`<div class="asset-section"><h3>План площадки</h3><p class="asset-kind">${layout.type}</p>
    ${lab('Площадь',num(w.area)+' м²')}${lab('Габариты',layout.widthMeters+' × '+layout.depthMeters+' м')}${lab('Корпуса',layout.halls.length)}${lab('Доки',w.docks)}${lab('Занято у доков',`<span id="detail-docks"></span> / ${w.docks}`)}
    ${lab('Категория грузов',w.goods)}${lab('В смене',w.staff+' чел.')}${lab('Отгрузки в работе','<span id="detail-shipments"></span>')}
    <button class="btn secondary full asset-map-btn" ${attr('warehouse-tab','inventory')}>${icon('box',17)} Товары на складе</button>
    <button type="button" class="btn secondary full asset-map-btn" ${attr('map-show-city',w.metro??w.id)}>${icon('locate',17)} Показать район на карте</button>
    </div><div class="asset-section"><h3>Состав смены</h3>${lab('На площадке',w.staff+' чел.')}${lab('Грузчиков',w.loaders.length)}${lab('Должностей',new Set(warehouseStaff(w).map(person=>person.role)).size)}
    <button class="btn secondary full asset-map-btn" ${attr('warehouse-tab','staff')}>${icon('users',16)} Поимённый список</button>
    <button class="btn secondary full asset-map-btn" ${attr('asset-telemetry',w.id)}>${icon('activity',16)} Датчики склада</button></div>
    ${w.id==='msk'?`<div class="asset-section"><h3>Оборудование</h3><div>${equipment.map(eq=>`<button type="button" class="zone-equipment" ${attr('equipment',eq.id)}>${icon('tool',17)} <span>${eq.id} · ${eq.name}</span></button>`).join('')}</div></div>`:''}`:'';
  const tripInfo=v?`<div class="asset-section"><h3>Перевозка</h3><p class="asset-kind">${spec.label}</p>
    ${lab('Направление',t?routeName(t.route):city(v.home))}
    ${lab('Водитель',v.driver)}${lab('Статус водителя','<span id="detail-driver"></span>')}
    ${lab('Груз',t?escapeText(t.goods):v.goods)}${lab('Количество',t?`${t.pallets} палет · ${num(t.load,1)} т`:'—')}
    ${lab('Грузоподъёмность',num(v.capacity,1)+' т')}
    ${lab('Габариты модели',`${num(spec.length,2)} × ${num(spec.width,2)} × ${num(spec.height,2)} м`)}
    ${t?`${lab('До прибытия','<span id="detail-eta"></span>')}${lab('Скорость','<span id="detail-speed"></span>')}<div class="load-bar"><span id="trip-progress"></span></div>`:''}
    ${v.refrigerated?lab('Температура отсека','<span id="detail-cold"></span>'):''}
    <button class="btn secondary full asset-map-btn" ${attr('asset-media','inventory')}>${icon('box',17)} Состав груза</button>
  </div>`:'';
  const person=v?driverProfile(v):null;
  const driverInfo=person?`<div class="asset-section driver-profile"><h3>Водитель</h3>
    <div class="driver-title"><span class="person-initials">${person.name.split(' ').map(p=>p[0]).join('')}</span><div><b>${person.name}</b><small>${person.id}</small></div></div>
    ${lab('Категория',person.category)}${lab('Стаж за рулём',person.experience+' г.')}${lab('База',city(v.home))}</div>`:'';
  const sensor=(v||eq)?`<div class="asset-section telemetry-card"><h3>Показания датчиков</h3>
    ${lab('Температура','<span id="detail-temp"></span>')}${lab('Вибрация','<span id="detail-vib"></span>')}${lab('Износ','<span id="detail-wear"></span>')}
    ${v?lab('Топливо','<span id="detail-fuel"></span>'):''}${eq?lab('Заряд батареи','<span id="detail-battery"></span>'):''}
    ${lab('Индекс риска','<span id="detail-risk"></span>')}${lab('Остаточный ресурс','<span id="detail-rul"></span>')}
    <div id="sensor-chart" aria-label="График температуры за предыдущий час"></div>
    <p class="telemetry-note">Температура за последний час симуляции</p>
    <button class="btn secondary full" ${attr('asset-telemetry',asset.id)}>${icon('activity',17)} История датчиков</button>
    <button class="btn secondary full asset-map-btn" ${attr('schedule',asset.id)}>${icon('tool',17)} ${state.scheduled.has(asset.id)?'Снять с плана ТО':'Назначить обслуживание'}</button></div>`:'';
  const warehouseTabs=w?`<div class="segment asset-media-switch" role="group" aria-label="Разделы площадки">
    ${[['model','3D-модель','cube'],['inventory','Товары','box'],['yard','Транспорт площадки','truck'],['staff','Персонал','users']].map(([id,label,glyph])=>`<button type="button" ${attr('warehouse-tab',id)} class="${id==='model'?'selected':''}" aria-pressed="${id==='model'}">${icon(glyph,16)} ${label}</button>`).join('')}
    </div><div id="warehouse-model-pane">${modelPanel}${zoneMenu}<section id="zone-panel" class="zone-panel">${zonePanel(w,zones.find(z=>z.id===state.zone))}</section></div>
    <section class="asset-section site-yard" id="warehouse-yard-pane" hidden><h3>Транспорт площадки</h3><div id="warehouse-yard"></div></section>
    <section class="asset-section site-staff" id="warehouse-staff-pane" hidden><h3>Персонал смены</h3><div id="warehouse-staff">${renderStaff(w,'')}</div></section>
    <section class="asset-section inventory-pane" id="asset-inventory-pane" hidden aria-label="Товары склада"></section>`:'';
  return `<div class="asset-head"><div><div class="asset-subtitle">${subtitle}</div><h2>${title}</h2></div><div><span id="detail-status"></span>${button('close-asset','close','Закрыть карточку')}</div></div>
    <div class="asset-content ${eq?'equipment-detail':''}">${eq?'':`<div class="scene-column">${v?vehicleMedia:warehouseTabs}</div>`}
    <div class="asset-metrics">${warehouseInfo}${quickRoute}${tripInfo}${driverInfo}${sensor}</div></div>`;
}

function openAsset(kind,id) {
  const asset=kind==='warehouse'?warehouse(id):kind==='vehicle'?vehicle(id):equipment.find(e=>e.id===id);
  if(!asset) return;
  advanceTime();
  if(kind==='warehouse') {
    if(state.selected!==id) state.zone='D';
    state.selected=id;
    map.selectWarehouse(id);
    if($('#focus-warehouse')) $('#focus-warehouse').innerHTML=focusCard();
  }
  hidePopovers();
  $('#search').value='';
  model?.dispose();
  model=null;
  const dialog=$('#asset-dialog');
  dialog.classList.remove('scene-expanded');
  state.dialog={kind,asset,shell:{roof:false,walls:false},tab:'model',yardFilter:'all',staffFilter:'',yardMinute:null,traceBucket:null,
    inventory:{group:'all',query:'',sku:null,phase:null}};
  dialog.classList.toggle('compact',kind==='equipment');
  dialog.innerHTML=assetBody(kind,asset);
  if(!dialog.open) dialog.showModal();
  map.setSuspended(true);
  const opened=state.dialog;
  if(kind!=='equipment') queueMicrotask(()=>{
    if(state.dialog===opened&&opened.tab==='model') ensureModel();
  });
  refreshDialog();
}

function ensureModel() {
  const opening=state.dialog;
  if(!opening||opening.kind==='equipment'||model) return Promise.resolve(model);
  if(opening.modelReady) return opening.modelReady;
  const dialog=$('#asset-dialog');
  const canvas=$('#asset-model');
  const controls=dialog.querySelectorAll('[data-3d-only] button, button[data-3d-only]');
  controls.forEach(el=>el.disabled=true);
  canvas.setAttribute('aria-busy','true');
  set('scene-hint','Загружается 3D-модель…');
  modelModule??=import('./model.mjs').catch(error=>{modelModule=null;throw error;});
  opening.modelReady=modelModule.then(({ModelView})=>{
    if(state.dialog!==opening||!dialog.open) return;
    const {kind,asset}=opening;
    const trip=kind==='vehicle'?tripFor(asset.id):null;
    const sceneAsset=kind==='warehouse'?{...asset,activities:siteVehicles(asset.id,fleet,state.trips,state.clock).filter(row=>row.onSite)}:
      trip?{...asset,pallets:trip.pallets}:asset;
    controls.forEach(el=>el.disabled=false);
    canvas.removeAttribute('aria-busy');
    set('scene-hint','Перетащите для вращения · колесо мыши для масштаба');
    model=new ModelView(canvas,kind,sceneAsset,state.zone,kind==='warehouse'?state.warehouseClock:state.clock,{
      selectZone:id=>actions['select-zone'](id),
      cameraMode:on=>{
        const control=dialog.querySelector('[data-action="model-top"]');
        control.setAttribute('aria-pressed',String(on));
        control.querySelector('span').textContent=on?'Наклонный вид':'Вид сверху';
      },
      fallback:()=>{
        dialog.querySelectorAll('[data-3d-only]').forEach(el=>el.hidden=true);
        if(kind==='warehouse') dialog.querySelector('.scene-zoom').hidden=false;
        set('scene-hint',kind==='warehouse'?'План склада · WebGL недоступен':'Для вращаемой модели нужен браузер с WebGL 2');
      },
    },graphicsProfile());
    if(model.renderer&&opening.tab==='model') canvas.focus({preventScroll:true});
    refreshDialog();
    return model;
  }).catch(error=>{
    if(state.dialog!==opening) return;
    canvas.removeAttribute('aria-busy');
    set('scene-hint','Не удалось загрузить 3D-модель. Откройте карточку ещё раз.');
    console.error(error);
  });
  return opening.modelReady;
}

function set(id,text) {
  const el=document.getElementById(id);
  if(el&&el.textContent!==String(text)) el.textContent=text;
}
function setHtml(selector,html) {
  const el=$(selector);
  if(el && el.innerHTML!==html) el.innerHTML=html;
}
const fillAt=(base,seed)=>Math.round(Math.max(9,Math.min(99,base+3*Math.sin(state.clock/420+seed))));
function inventoryContext() {
  const {kind,asset,inventory}=state.dialog;
  const warehouse=kind==='warehouse';
  const trip=warehouse?null:tripFor(asset.id);
  return {inventory,warehouse,rows:warehouse?stockFor(asset):manifestFor(asset,trip),
    phase:warehouse?'warehouse':vehicleState(asset)};
}

function refreshCargoPreview(trip,phase) {
  const pane=$('#cargo-preview');
  if(!pane) return;
  const dialog=state.dialog;
  pane.hidden=!(dialog.shell.roof||dialog.shell.walls||dialog.doorsOpen);
  if(pane.hidden) return;
  if(dialog.cargoSnapshot?.trip===trip&&dialog.cargoSnapshot?.phase===phase) return;
  dialog.cargoSnapshot={trip,phase};
  pane.innerHTML=cargoPreview(manifestFor(dialog.asset,trip),phase);
}

function refreshVehicleCargo() {
  if(state.dialog?.kind!=='vehicle') return;
  const {asset}=state.dialog;
  refreshCargoPreview(tripFor(asset.id),vehicleState(asset));
}

function refreshInventory() {
  if(state.dialog?.tab!=='inventory') return;
  const {kind,asset,inventory}=state.dialog;
  const phase=kind==='warehouse'?'warehouse':vehicleState(asset);
  if(inventory.phase===phase) return;
  const {warehouse,rows}=inventoryContext();
  inventory.phase=phase;
  $('#asset-inventory-pane').innerHTML=inventoryPanel(rows,{warehouse,phase});
  if(!rows.length) return;
  $('#inventory-query').value=inventory.query;
  renderInventoryList();
  if(inventory.sku) openProduct(inventory.sku,false);
}

function renderInventoryList() {
  const {inventory,warehouse,rows}=inventoryContext();
  const filtered=filterInventory(rows,inventory.group,inventory.query);
  setHtml('#inventory-results',inventoryRows(filtered,warehouse));
  set('inventory-count',num(filtered.length)+' из '+num(rows.length));
  document.querySelectorAll('[data-action="inventory-group"]').forEach(btn=>
    btn.setAttribute('aria-pressed',String(btn.dataset.id===inventory.group)));
}

function openProduct(sku,focus=true) {
  const {inventory,warehouse,rows}=inventoryContext();
  const row=rows.find(item=>item.product.sku===sku);
  if(!row) return;
  inventory.sku=sku;
  $('#inventory-index').hidden=true;
  const detail=$('#inventory-product');
  detail.innerHTML=productSheet(row,warehouse);
  detail.hidden=false;
  if(focus) detail.querySelector('button').focus();
}

function closeProduct() {
  const {inventory}=state.dialog;
  const sku=inventory.sku;
  inventory.sku=null;
  $('#inventory-product').hidden=true;
  $('#inventory-index').hidden=false;
  $(`[data-action="inventory-product"][data-id="${sku}"]`)?.focus();
}

function refreshDialog() {
  if(!state.dialog) return;
  const {kind,asset}=state.dialog;
  refreshInventory();
  if(kind==='warehouse') {
    const z=zones.find(q=>q.id===state.zone);
    const fill=fillAt(z.fill,zones.indexOf(z)+Number(asset.code.slice(3))-1);
    const fields=$('[data-zone-fill]'); if(fields) fields.textContent=fill+'%';
    const reading=sensorReading(asset,state.clock);
    set('detail-docks',reading.docks);
    set('detail-shipments',Math.max(3,Math.round(asset.docks+(reading.fill-42)/3)));
    setHtml('#detail-status',status('normal','На связи'));
    model?.setClock(state.warehouseClock,state.playing?1:0);
    const yardBucket=Math.floor(state.clock/15);
    if(state.dialog.yardBucket!==yardBucket) {
      state.dialog.yardBucket=yardBucket;
      model?.setYard(siteVehicles(asset.id,fleet,state.trips,state.clock).filter(row=>row.onSite));
    }
    if(state.dialog.tab==='yard') refreshYard();
    return;
  }
  const meters=sensorReading(asset,state.clock), f=forecast(asset);
  setHtml('#detail-status',kind==='vehicle'?vehicleBadge(vehicleState(asset)):badge(f.level));
  set('detail-temp',num(meters.temperature,1)+' °C'); set('detail-vib',num(meters.vibration,1)+' мм/с');
  set('detail-wear',num(meters.wear,1)+'%'); set('detail-risk',f.risk+'%'); set('detail-rul','≈ '+f.rul+' ч');
  const anchor=Math.floor(state.clock/60)*60;
  if(state.dialog.sensorMinute!==anchor) {
    state.dialog.sensorMinute=anchor;
    const samples=history.samples(asset.id,state.clock,3600);
    setHtml('#sensor-chart',spark(samples.filter((_,i)=>i%3===0).map(row=>row.temperature),f.level==='normal'?'#236759':'#ce7341'));
  }
  if(kind==='equipment') { set('detail-battery',num(meters.battery,1)+'%'); return; }
  const t=tripFor(asset.id);
  const st=vehicleState(asset);
  model?.setCargoLoaded(Boolean(t)&&st!=='done');
  refreshCargoPreview(t,st);
  const driver={active:'За рулём',reserve:'Готов к рейсу',done:'На стоянке',service:'Рейс не назначен',loading:'Ожидает погрузку',unloading:'На разгрузке'};
  set('detail-driver',driver[st]);
  if(asset.refrigerated) set('detail-cold','+'+num(meters.cold,1)+' °C');
  set('detail-fuel',num(meters.fuel,1)+'%');
  if(t) {
    const left=Math.max(0,t.route.hours-elapsed(t));
    const p=movement(t);
    set('detail-eta',left?duration(left):'Прибыл');
    const leg=t.route.legs.find(l=>l.from===p.from&&l.to===p.to);
    set('detail-speed',num(st==='active'?leg.km/leg.hours:0)+' км/ч');
    const bucket=Math.floor(state.clock/5);
    if(state.dialog.traceBucket!==bucket) {
      state.dialog.traceBucket=bucket;
      const trace=tripTrace(t,state.clock);
      const percent=trace.driven/t.route.km*100;
      set('route-percent',num(percent,1)+'%');
      set('route-driven',num(trace.driven,1)+' км');
      set('route-left',num(trace.remaining,1)+' км');
      const svg=routeDiagram(t.route,trace);
      setHtml('#trip-mini',svg);
      if(state.dialog.tab==='route') {
        setHtml('#trip-large',svg);
        setHtml('#trip-timeline',renderTripTimeline(t,state.clock));
      }
      $('#trip-progress').style.width=percent+'%';
    }
  }
}

function refreshYard(force=false) {
  const dialog=state.dialog;
  const minute=Math.floor(state.clock/60);
  if(!force&&dialog.yardMinute===minute) return;
  dialog.yardMinute=minute;
  const rows=siteVehicles(dialog.asset.id,fleet,state.trips,state.clock);
  setHtml('#warehouse-yard',renderYard(rows,dialog.yardFilter));
}

function highlightTrip(id) {
  const trip=tripFor(id);
  if(!trip) return;
  state.focusedTrip=trip;
  const bar=$('#map-trip-bar');
  bar.hidden=false;
  bar.innerHTML=`<div>${icon('route',18)}<span><b>${trip.vehicle.id}</b> · ${routeName(trip.route)}</span></div><strong id="map-driven"></strong>
    <button class="btn secondary" type="button" data-action="clear-trip">Вся сеть</button>`;
  map.showTrip(trip,state.clock);
  refreshMapTrace();
}

function clearTripFocus() {
  if(!state.focusedTrip) return;
  state.focusedTrip=null;
  const bar=mapCard.querySelector('#map-trip-bar');
  bar.hidden=true;
  map.showTrip(null,state.clock);
}

function refreshMapTrace() {
  if(!state.focusedTrip||!mapCard.isConnected) return;
  const trace=tripTrace(state.focusedTrip,state.clock,false);
  set('map-driven',num(trace.driven,1)+' / '+num(state.focusedTrip.route.km)+' км');
}

function objectListState() {
  const folder=state.mapFolder;
  return mapObjectList(folder,warehouses,state.trips,visibility[folder],state.mapQuery);
}

function renderMapObjects() {
  const {list,visible,total}=objectListState();
  setHtml('#map-object-list',list);
  set('map-object-count',visible+' из '+total);
}

function saveMapVisibility(kind) {
  saveSetting('hidden.'+kind,JSON.stringify([...visibility[kind]]));
  map.setVisibility(visibility);
}

function eventMarkup(list,limit=3) {
  return list.slice(0,limit).map(v=>{
    const f=forecast(v);
    const text=f.level==='critical'?'Нужна диагностика':'Запланировать проверку';
    return `<button type="button" class="event" ${attr(v.kind?'vehicle':'equipment',v.id)}>
      <span class="event-sign ${f.level}">${icon('alert',17)}</span><span><b>${v.id} · ${v.name}</b><small>${state.scheduled.has(v.id)?'ТО назначено':text}</small></span><span class="event-risk">${f.risk}%</span></button>`;
  }).join('')||'<p class="event-empty">Все показатели в норме.</p>';
}

function refresh() {
  advanceTime();
  history.capture(state.clock);
  if(state.page==='analytics') renderTelemetry();
  const alerts=alertList();
  set('nav-count',alerts.length);
  $('#bell-dot').hidden=!alerts.length;
  if(state.page==='overview') {
    let inTransit=0, cargo=0;
    for(const trip of state.trips) if(tripPhase(trip,state.clock)==='active') {
      inTransit++;
      cargo+=trip.load;
    }
    set('kpi-trips',inTransit);
    set('kpi-load',num(cargo,1));
  }
  set('kpi-alerts',alerts.length);
  const playback=$('#pause');
  if(playback) {
    playback.setAttribute('aria-label',state.playing?'Пауза симуляции':'Продолжить симуляцию');
    setHtml('#pause',icon(state.playing?'pause':'play',17)+(state.playing?'Пауза':'Продолжить'));
  }
  if(state.page==='overview') setHtml('#event-list',eventMarkup(alerts));
  if(!$('#notifications').hidden) setHtml('#notifications','<h3>Оповещения</h3>'+eventMarkup(alerts,12));
  const clockText=clockLabel();
  document.querySelectorAll('[data-clock]').forEach(el=>{if(el.textContent!==clockText) el.textContent=clockText;});
  document.querySelectorAll('.map-live').forEach(el=>el.classList.toggle('paused',!state.playing));
  for(const entry of document.querySelectorAll('[data-fill]')) {
    const w=warehouse(entry.dataset.fill);
    const fill=Math.round(sensorReading(w,state.clock).fill);
    const text=fill+'%';
    if(entry.textContent!==text) {
      entry.textContent=text;
      const bar=$(`[data-fill-bar="${w.id}"]`);
      if(bar) bar.style.width=text;
    }
  }
  for(const entry of document.querySelectorAll('[id^="trip-status-"]')) {
    const t=tripFor(entry.id.slice(12));
    setHtml('#trip-status-'+t.vehicle.id,vehicleBadge(vehicleState(t.vehicle)));
    set('trip-eta-'+t.vehicle.id,elapsed(t)<t.route.hours?duration(t.route.hours-elapsed(t)):'—');
  }
  if(state.page==='fleet') for(const entry of document.querySelectorAll('[id^="fleet-state-"]')) {
    const v=vehicle(entry.id.slice(12));
    setHtml('#fleet-state-'+v.id,vehicleBadge(vehicleState(v)));
    setHtml('#fleet-risk-'+v.id,badge(forecast(v).level));
  }
  if(state.page==='service') for(const entry of document.querySelectorAll('[data-svc][data-metric="level"]')) {
    const asset=history.assets.get(entry.dataset.svc);
    const m=telemetry(asset,state.clock), f=forecast(asset);
    const sel=`[data-svc="${asset.id}"]`;
    setHtml(sel+'[data-metric="level"]',badge(f.level));
    const metrics={temperature:num(m.temperature,1)+' °C',vibration:num(m.vibration,1)+' мм/с',risk:f.risk+'%',rul:'≈ '+f.rul+' ч'};
    for(const [key,value] of Object.entries(metrics)) {
      const el=$(sel+`[data-metric="${key}"]`); if(el) el.textContent=value;
    }
  }
  if(mapCard.isConnected) map.setVehicles(state.trips,state.clock,animationRate());
  refreshMapTrace();
  refreshDialog();
}

function notify(text) {
  const el=$('#toast');
  el.textContent=text;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('visible'),3600);
}
function hidePopovers() {
  for(const el of document.querySelectorAll('.popover')) el.hidden=true;
}
function changePage(page) {
  if(!pages[page]) return;
  state.page=page;
  hidePopovers();
  $('#sidebar').classList.remove('open');
  renderPage();
  window.scrollTo({top:0,behavior:'instant'});
}

function search(value) {
  const list=$('#search-results');
  const query=value.trim().toLowerCase();
  list.hidden=!query;
  if(!query) return;
  const matches=[
    ...warehouses.map(w=>({id:w.id,kind:'warehouse',name:w.name,meta:city(w.id)+' · '+w.code})),
    ...fleet.map(v=>({id:v.id,kind:'vehicle',name:v.id+' · '+v.name,meta:v.driver})),
  ].filter(v=>(v.name+' '+v.meta).toLowerCase().replaceAll('ё','е').includes(query.replaceAll('ё','е')));
  list.innerHTML=matches.length?matches.slice(0,8).map(v=>`<button ${attr(v.kind,v.id)} class="search-result">${icon(v.kind==='warehouse'?'warehouse':'truck',18)}<span><b>${v.name}</b><small>${v.meta}</small></span></button>`).join(''):'<p>Совпадений нет.</p>';
}

$('#asset-dialog').addEventListener('close',event=>{
  if(event.currentTarget.open) return;
  event.currentTarget.classList.remove('scene-expanded');
  model?.dispose();
  model=null;
  state.dialog=null;
  map.setSuspended(document.hidden);
});
$('#asset-dialog').addEventListener('cancel',event=>{
  const dialog=event.currentTarget;
  const scene=dialog.querySelector('.scene-panel');
  if(dialog.classList.contains('scene-expanded')||(scene&&document.fullscreenElement===scene)) {
    event.preventDefault();
    toggleSceneFullscreen();
  }
});
document.addEventListener('fullscreenchange',updateSceneFullButton);
document.addEventListener('visibilitychange',()=>{
  map.setSuspended(document.hidden||$('#asset-dialog').open);
  if(!document.hidden) refresh();
});
document.addEventListener('submit',e=>{
  if(e.target.id==='planner-form') { e.preventDefault(); calculate(e.target); }
});
document.addEventListener('change',e=>{
  const target=e.target;
  if(target.id==='telemetry-group') {
    state.telemetryGroup=target.value;
    state.telemetryAsset=telemetryAssets[target.value][0].id;
    renderPage();
    $('#telemetry-group').focus({preventScroll:true});
    return;
  }
  if(target.id==='telemetry-asset'||target.id==='telemetry-window') {
    if(target.id==='telemetry-asset') state.telemetryAsset=target.value;
    else state.telemetryWindow=Number(target.value);
    renderTelemetry(true);
    return;
  }
  if(target.id==='staff-role') {
    state.dialog.staffFilter=target.value;
    setHtml('#warehouse-staff',renderStaff(state.dialog.asset,target.value));
    $('#staff-role').focus({preventScroll:true});
    return;
  }
  if(target.dataset.mapObject) {
    const kind=target.dataset.mapObject;
    if(target.checked) visibility[kind].delete(target.value); else visibility[kind].add(target.value);
    saveMapVisibility(kind);
    const {visible,total}=objectListState();
    set('map-object-count',visible+' из '+total);
    return;
  }
  if(e.target.id==='speed') {
    advanceTime();
    state.speed=Number(e.target.value);
    refresh();
  }
  if(e.target.dataset.mapLayer) setMapLayer(e.target.dataset.mapLayer,e.target.checked);
  if(e.target.id==='map-city'&&e.target.value) {
    map.focusCity(e.target.value);
    setMapSegment(null,e.target.value);
  }
  if(e.target.id==='street-tiles') {
    preferences.streets=e.target.checked;
    saveSetting('streets',preferences.streets?'on':'off');
    map.setOnline(preferences.streets);
  }
  if(target.id==='graphics-mode'&&Object.hasOwn(graphicsOptions,target.value)) {
    preferences.graphics=target.value;
    saveSetting('graphics',target.value);
    applyGraphics();
  }
  if(e.target.name==='from'&&e.target.form?.id==='planner-form') {
    e.target.form.elements.vehicle.innerHTML=reserveOptions(e.target.value,'');
  }
});
document.addEventListener('input',e=>{
  if(e.target.id==='search') search(e.target.value);
  if(e.target.id==='inventory-query') {
    state.dialog.inventory.query=e.target.value;
    renderInventoryList();
  }
  if(e.target.id==='map-object-query') {
    state.mapQuery=e.target.value;
    renderMapObjects();
  }
  if(e.target.closest('#planner-form') && (state.plans.length||state.planError)) {
    state.plans=[]; state.planned=null; state.planError='';
    $('#plan-error').hidden=true;
    map.setPaths(state.trips);
    renderPlans();
  }
});
document.addEventListener('keydown',e=>{
  chartScrub(e);
  if(e.key==='/'&&!e.target.matches('input,select,textarea')&&!state.dialog) { e.preventDefault(); $('#search').focus(); }
  if(e.key==='Escape') {
    hidePopovers();
    $('#sidebar').classList.remove('open');
    mapCard.classList.remove('fullscreen');
  }
  if(e.key==='Enter'&&e.target.id==='search'&&!$('#search-results').hidden) $('#search-results button')?.click();
});
for(const event of ['pointermove','pointerleave','focusout']) document.addEventListener(event,chartScrub,event==='pointerleave');

function setMapLayer(id,on) {
  visibleLayers[id]=on;
  saveSetting(layerSetting(id),on?'on':'off');
  mapCard.querySelector(`[data-action="network-layer"][data-id="${id}"]`)?.setAttribute('aria-pressed',String(on));
  mapCard.querySelector(`[data-map-layer="${id}"]`).checked=on;
  map.toggle(id,on);
}

function setShell(name,hidden) {
  if(!model) {
    const dialog=state.dialog;
    dialog?.modelReady?.then(ready=>{if(ready&&state.dialog===dialog) setShell(name,hidden);});
    return;
  }
  if(!model?.shells?.[name]) return;
  state.dialog.shell[name]=hidden;
  model.setShell(name,hidden);
  const el=$(`[data-action="shell"][data-id="${name}"]`);
  const title=name==='roof'?'крышу':model.shells.roof?'стены':'борта';
  el.setAttribute('aria-pressed',String(!hidden));
  el.querySelector('span').textContent=`${hidden?'Показать':'Скрыть'} ${title}`;
  const view=$('[data-action="shell-view"] span');
  const doors=$('[data-action="cargo-doors"]');
  if(doors) doors.disabled=state.dialog.shell.walls;
  const opened=state.dialog.shell.walls&&(!model.shells.roof||state.dialog.shell.roof);
  if(state.dialog.kind==='vehicle') {
    view.textContent=opened?(doors?'Вернуть кузов':'Вернуть борта'):'Показать груз';
    refreshVehicleCargo();
  } else view.textContent=opened?'Вернуть корпус':'Показать интерьер';
}

function warehouseTab(id) {
  state.dialog.tab=id;
  for(const key of ['model','yard','staff']) $('#warehouse-'+key+'-pane').hidden=key!==id;
  $('#asset-inventory-pane').hidden=id!=='inventory';
  for(const tab of document.querySelectorAll('.asset-media-switch [data-action="warehouse-tab"]')) {
    const selected=tab.dataset.id===id;
    tab.setAttribute('aria-pressed',String(selected));
    tab.classList.toggle('selected',selected);
  }
  if(id==='yard') refreshYard(true);
  if(id==='staff') setHtml('#warehouse-staff',renderStaff(state.dialog.asset,state.dialog.staffFilter));
  if(id==='inventory') refreshInventory();
  if(id==='model') return ensureModel();
}

function updateSceneFullButton() {
  const dialog=$('#asset-dialog');
  const key=dialog.querySelector('[data-action="model-full"]');
  if(!key) return;
  const expanded=dialog.classList.contains('scene-expanded')||document.fullscreenElement===dialog.querySelector('.scene-panel');
  const name=expanded?'Выйти из полноэкранного режима':'Полноэкранная 3D-модель';
  key.setAttribute('aria-label',name);
  key.setAttribute('aria-pressed',String(expanded));
  key.title=name;
  key.innerHTML=icon(expanded?'contract':'expand',18);
}

async function toggleSceneFullscreen() {
  const dialog=$('#asset-dialog');
  const scene=dialog.querySelector('.scene-panel');
  if(!scene||!dialog.open) return;
  if(dialog.classList.contains('scene-expanded')) {
    dialog.classList.remove('scene-expanded');
  } else if(document.fullscreenElement===scene) {
    await document.exitFullscreen();
  } else {
    try { await scene.requestFullscreen(); }
    catch { if(scene.isConnected&&dialog.open) dialog.classList.add('scene-expanded'); }
  }
  updateSceneFullButton();
}

function adjustMapMatches(show) {
  const kind=state.mapFolder;
  for(const id of objectListState().ids) {
    if(show) visibility[kind].delete(id); else visibility[kind].add(id);
  }
  saveMapVisibility(kind);
  renderMapObjects();
}

function setAppearancePreference(key,id,choices) {
  if(!Object.hasOwn(choices,id)) return;
  preferences[key]=id;
  saveSetting(key,id);
  applyTheme();
  document.querySelectorAll(`[data-action="set-${key}"]`).forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.id===id)));
}

const actions={
  pause:()=>{advanceTime();state.playing=!state.playing;refresh();},
  'toggle-nav':()=>$('#sidebar').classList.toggle('open'),
  notifications:()=>{const el=$('#notifications');el.hidden=!el.hidden;refresh();},
  'see-service':()=>changePage('service'),
  'open-planner':()=>changePage('routes'),
  warehouse:id=>openAsset('warehouse',id),
  'warehouse-yard':id=>{openAsset('warehouse',id);warehouseTab('yard');},
  'warehouse-tab':warehouseTab,
  'yard-filter':id=>{
    state.dialog.yardFilter=id; refreshYard(true);
    $("[data-action='yard-filter'][data-id='"+id+"']")?.focus({preventScroll:true});
  },
  vehicle:id=>openAsset('vehicle',id),
  equipment:id=>openAsset('equipment',id),
  'close-asset':()=>$('#asset-dialog').close(),
  'map-in':()=>map.queueZoom(.76),
  'map-out':()=>map.queueZoom(1/.76),
  'map-turn':()=>map.rotate(20),
  'map-north':()=>map.north(),
  'map-reset':()=>{clearTripFocus();map.reset();setMapSegment('map-reset');},
  'map-country':()=>{clearTripFocus();map.country();setMapSegment('map-country');},
  'map-show-city':id=>{
    if($('#asset-dialog').open) $('#asset-dialog').close();
    if(state.page!=='overview'&&state.page!=='routes') changePage('overview');
    clearTripFocus();
    map.focusCity(id);
    setMapSegment(null,id);
  },
  'map-layers':()=>{const el=$('#map-layers');el.hidden=!el.hidden;$('#map-objects').hidden=true;},
  'map-objects':()=>{
    const el=$('#map-objects');el.hidden=!el.hidden;$('#map-layers').hidden=true;
    if(!el.hidden) {renderMapObjects();$('#map-object-query').focus({preventScroll:true});}
  },
  'map-folder':id=>{
    state.mapFolder=id;
    state.mapQuery='';
    $('#map-object-query').value='';
    document.querySelectorAll('[data-action="map-folder"]').forEach(tab=>tab.setAttribute('aria-pressed',String(tab.dataset.id===id)));
    renderMapObjects();
  },
  'map-show-matches':()=>adjustMapMatches(true),
  'map-hide-matches':()=>adjustMapMatches(false),
  'show-trip-map':id=>{
    if($('#asset-dialog').open) $('#asset-dialog').close();
    if(state.page!=='overview') changePage('overview');
    highlightTrip(id);
    mapCard.scrollIntoView({block:'nearest',behavior:'instant'});
  },
  'clear-trip':()=>{clearTripFocus();map.reset();setMapSegment('map-reset');},
  'network-layer':id=>setMapLayer(id,!visibleLayers[id]),
  'list-page':value=>{
    const [key,page]=value.split('/');
    state.listPages[key]=Number(page);
    if(key==='trips') {renderTrips();refresh();}
    else renderPage();
    $(`[data-list="${key}"] button:not(:disabled)`)?.focus({preventScroll:true});
  },
  'map-full':async()=>{
    if(mapCard.classList.contains('fullscreen')) { mapCard.classList.remove('fullscreen'); return; }
    if(document.fullscreenElement) { await document.exitFullscreen(); return; }
    try { await mapCard.requestFullscreen(); } catch { mapCard.classList.add('fullscreen'); }
  },
  'model-in':()=>model?.magnify(1.16),
  'model-out':()=>model?.magnify(1/1.16),
  'model-reset':()=>model?.restore(),
  'model-top':()=>model?.toggleTopView(),
  'model-full':toggleSceneFullscreen,
  'driver-view':()=>model?.focusDriver(),
  'zoom-zone':()=>{
    setShell('roof',true);
    setShell('walls',true);
    model?.focusZone();
  },
  'show-person':async id=>{
    const dialog=state.dialog;
    const person=warehouseStaff(dialog.asset).find(member=>member.id===id);
    if(!person) return;
    await warehouseTab('model');
    if(state.dialog!==dialog||dialog.tab!=='model') return;
    actions['select-zone'](person.zone);
    setShell('walls',true);
    model?.focusPerson(id);
    $('#asset-dialog').scrollTop=0;
    $('#asset-model').focus({preventScroll:true});
    $('[data-action="scene-people"]').setAttribute('aria-pressed','true');
  },
  'scene-people':()=>{
    const on=model?.togglePeople();
    $('[data-action="scene-people"]').setAttribute('aria-pressed',String(on));
  },
  'cargo-doors':()=>{
    const open=model?.toggleDoors();
    state.dialog.doorsOpen=open;
    const el=$('[data-action="cargo-doors"]');
    el.setAttribute('aria-pressed',String(open));
    el.querySelector('span').textContent=open?'Закрыть грузовые двери':'Открыть грузовые двери';
    refreshVehicleCargo();
  },
  shell:id=>setShell(id,!state.dialog.shell[id]),
  'shell-view':()=>{
    const hidden=!(state.dialog.shell.walls&&(!model?.shells?.roof||state.dialog.shell.roof));
    setShell('roof',hidden);
    setShell('walls',hidden);
  },
  'select-zone':id=>{
    state.zone=id; model?.selectZone(id);
    if(!state.dialog.shell.roof) setShell('roof',true);
    document.querySelectorAll('.zone-select').forEach(btn=>{
      const active=btn.dataset.id===id;
      btn.classList.toggle('selected',active);
      btn.setAttribute('aria-pressed',active);
    });
    $('#zone-panel').innerHTML=zonePanel(state.dialog.asset,zones.find(z=>z.id===id));
    refreshDialog();
  },
  'fleet-filter':id=>{state.vehicleFilter=id;state.listPages.fleet=0;renderPage();},
  'asset-media':id=>{
    $('#vehicle-model-pane').hidden=id!=='model';
    $('#asset-inventory-pane').hidden=id!=='inventory';
    const route=$('#vehicle-route-pane');
    if(route) route.hidden=id!=='route';
    state.dialog.tab=id;
    if(id==='route') {state.dialog.traceBucket=null; refreshDialog();}
    if(id==='inventory') refreshInventory();
    document.querySelectorAll('.asset-media-switch [data-action="asset-media"]').forEach(el=>{
      const selected=el.dataset.id===id;
      el.classList.toggle('selected',selected);
      el.setAttribute('aria-pressed',String(selected));
    });
    if(id==='model') {ensureModel();$('#asset-model').focus({preventScroll:true});}
  },
  'inventory-group':id=>{
    state.dialog.inventory.group=id;
    renderInventoryList();
  },
  'inventory-product':openProduct,
  'cargo-product':async sku=>{
    const dialog=$('#asset-dialog');
    const current=state.dialog;
    if(dialog.classList.contains('scene-expanded')||document.fullscreenElement===dialog.querySelector('.scene-panel')) await toggleSceneFullscreen();
    if(state.dialog!==current) return;
    actions['asset-media']('inventory');
    openProduct(sku);
  },
  'inventory-back':closeProduct,
  'inventory-zone':async id=>{
    const dialog=state.dialog;
    await warehouseTab('model');
    if(state.dialog!==dialog||dialog.tab!=='model') return;
    actions['select-zone'](id);
    actions['zoom-zone']();
  },
  'asset-telemetry':id=>{
    state.telemetryGroup=vehicle(id)?'vehicle':warehouse(id)?'warehouse':'equipment';
    state.telemetryAsset=id;
    if($('#asset-dialog').open) $('#asset-dialog').close();
    changePage('analytics');
  },
  'telemetry-export':()=>{
    const asset=history.assets.get(state.telemetryAsset);
    const csv=telemetryCSV(asset,history.samples(asset.id,state.clock,state.telemetryWindow));
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=url; link.download='WnD-'+asset.id+'-telemetry.csv'; link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  },
  'service-filter':id=>{state.serviceFilter=id;state.listPages.service=0;renderPage();},
  'set-theme':id=>setAppearancePreference('theme',id,themeNames),
  'set-palette':id=>setAppearancePreference('palette',id,palettes),
  'choose-plan':id=>{
    state.planIndex=Number(id);
    map.setPaths(state.trips,state.plans[state.planIndex],state.plans.find((_,i)=>i!==state.planIndex));
    map.fitRoute(state.plans[state.planIndex]); renderPlans();
  },
  launch,
  schedule:id=>{
    const present=state.scheduled.has(id);
    if(present) state.scheduled.delete(id); else state.scheduled.set(id,state.clock);
    const dialog=state.dialog;
    if(dialog) openAsset(dialog.kind,dialog.asset.id);
    if(state.page==='service') renderPage();
    refresh();
    notify(present?`${id} снят с плана ТО.`:`${id} добавлен в план ТО.`);
  },
};
function setMapSegment(id,cityId='') {
  mapCard.querySelectorAll('.segment button').forEach(b=>b.classList.toggle('selected',b.dataset.action===id));
  mapCard.querySelector('#map-city').value=cityId;
}
document.addEventListener('click',e=>{
  const el=e.target.closest('button');
  if(!e.target.closest('.search-area')) $('#search-results').hidden=true;
  if(!e.target.closest('.notification-wrap')) $('#notifications').hidden=true;
  if(!e.target.closest('.map-tools') && mapCard) {
    mapCard.querySelector('#map-layers').hidden=true;
    mapCard.querySelector('#map-objects').hidden=true;
  }
  if(!el) return;
  if(el.dataset.page) { changePage(el.dataset.page); return; }
  if(el.dataset.action) {
    const [name,inline]=el.dataset.action.split(':');
    actions[name]?.(el.dataset.id??inline);
  }
});

makeMap();
renderPage();
setInterval(()=>{if(state.playing&&!document.hidden) refresh();},420);
