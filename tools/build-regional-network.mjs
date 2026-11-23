import { readFileSync, writeFileSync } from 'node:fs';
import { coreCities as cities, warehouses } from '../app/data.mjs';
import { geometry, roadEndpoints } from '../app/assets/road-corridors.mjs';
import { roadKilometres } from '../app/domain.mjs';

const asset=name=>new URL(`../app/assets/${name}`,import.meta.url);
const {places,roads}=JSON.parse(readFileSync(asset('cartography.json'),'utf8'));
// City names are resolved against the bundled Natural Earth gazetteer.
const regions=[
  ['kal','Калининград','Калининградская область'],
  ['mur','Мурманск','Мурманская область'],['arh','Архангельск','Архангельская область'],
  ['pet','Петрозаводск','Республика Карелия'],['psk','Псков','Псковская область'],
  ['vologda','Вологда','Вологодская область'],['cherep','Череповец','Вологодская область'],
  ['syk','Сыктывкар','Республика Коми'],['pechora','Печора','Республика Коми'],
  ['smol','Смоленск','Смоленская область'],['bry','Брянск','Брянская область'],
  ['kaluga','Калуга','Калужская область'],['orel','Орёл','Орловская область'],
  ['kursk','Курск','Курская область'],['bel','Белгород','Белгородская область'],
  ['lip','Липецк','Липецкая область'],['tamb','Тамбов','Тамбовская область'],
  ['ryaz','Рязань','Рязанская область'],['ivn','Иваново','Ивановская область'],
  ['kost','Кострома','Костромская область'],['kirov','Киров','Кировская область'],
  ['saransk','Саранск','Республика Мордовия'],['yola','Йошкар-Ола','Республика Марий Эл'],
  ['uly','Ульяновск','Ульяновская область'],['tlt','Тольятти','Самарская область'],
  ['krasnodar','Краснодар','Краснодарский край'],['novor','Новороссийск','Краснодарский край'],
  ['sochi','Сочи','Краснодарский край'],['armavir','Армавир','Краснодарский край'],
  ['maikop','Майкоп','Республика Адыгея'],['stav','Ставрополь','Ставропольский край'],
  ['pyat','Пятигорск','Ставропольский край'],['astr','Астрахань','Астраханская область'],
  ['elista','Элиста','Республика Калмыкия'],['nal','Нальчик','Кабардино-Балкарская Республика'],
  ['vladik','Владикавказ','Республика Северная Осетия — Алания'],
  ['grozny','Грозный','Чеченская Республика'],['makh','Махачкала','Республика Дагестан'],
  ['oren','Оренбург','Оренбургская область'],['orsk','Орск','Оренбургская область'],
  ['magn','Магнитогорск','Челябинская область'],['ntagil','Нижний Тагил','Свердловская область'],
  ['hmao','Ханты-Мансийск','Ханты-Мансийский автономный округ'],
  ['sur','Сургут','Ханты-Мансийский автономный округ'],['nv','Нижневартовск','Ханты-Мансийский автономный округ'],
  ['noya','Ноябрьск','Ямало-Ненецкий автономный округ'],['nuren','Новый Уренгой','Ямало-Ненецкий автономный округ'],
  ['tom','Томск','Томская область'],['bar','Барнаул','Алтайский край'],['biysk','Бийск','Алтайский край'],
  ['galt','Горно-Алтайск','Республика Алтай'],['novok','Новокузнецк','Кемеровская область'],
  ['abak','Абакан','Республика Хакасия'],['kyz','Кызыл','Республика Тыва'],
  ['nrl','Норильск','Красноярский край'],['bratsk','Братск','Иркутская область'],
  ['sever','Северобайкальск','Республика Бурятия'],['yak','Якутск','Республика Саха (Якутия)'],
  ['nery','Нерюнгри','Республика Саха (Якутия)'],['mirny','Мирный','Республика Саха (Якутия)'],
  ['lensk','Ленск','Республика Саха (Якутия)'],['oly','Олёкминск','Республика Саха (Якутия)'],
  ['tiksi','Тикси','Республика Саха (Якутия)'],['mag','Магадан','Магаданская область'],
  ['ana','Анадырь','Чукотский автономный округ'],['bilibino','Билибино','Чукотский автономный округ'],
  ['pevek','Певек','Чукотский автономный округ'],['pka','Петропавловск-Камчатский','Камчатский край'],
  ['ustkam','Усть-Камчатск','Камчатский край'],['sakhalin','Южно-Сахалинск','Сахалинская область'],
  ['okha','Оха','Сахалинская область'],['bir','Биробиджан','Еврейская автономная область'],
  ['koms','Комсомольск-на-Амуре','Хабаровский край'],['vvo','Владивосток','Приморский край'],
  ['uss','Уссурийск','Приморский край'],['nah','Находка','Приморский край',120],
];

const nodes=[];
const nodeIds=new Map();
function junction(point) {
  const precision=point[0]>=113?200:630;
  const key=point.map(value=>Math.round(value*precision)).join(',');
  if(!nodeIds.has(key)) {
    nodeIds.set(key,nodes.length);
    nodes.push({point,edges:new Map()});
  }
  return nodeIds.get(key);
}

const legacy=new Map(warehouses.filter(site=>Object.hasOwn(roadEndpoints,site.id)).map(site=>[
  site.id,{...site,point:roadEndpoints[site.id],node:junction(roadEndpoints[site.id]),population:places.find(p=>p[0]===cities[site.id][0])?.[3]??110000},
]));
for(const [tier,ref,path] of [...roads,...Object.values(geometry).map(shape=>[1,'',shape])]) {
  for(let i=1;i<path.length;i++) {
    const from=junction(path[i-1]), to=junction(path[i]);
    if(from===to) continue;
    const km=roadKilometres(nodes[from].point,nodes[to].point);
    const entry={km,minutes:km*60/(tier===1?70:46),ref};
    if(nodes[from].edges.get(to)?.minutes<=entry.minutes) continue;
    nodes[from].edges.set(to,entry);
    nodes[to].edges.set(from,entry);
  }
}

function push(queue,entry) {
  let i=queue.length;
  while(i>0) {
    const parent=(i-1)>>1;
    if(queue[parent][0]<=entry[0]) break;
    queue[i]=queue[parent];
    i=parent;
  }
  queue[i]=entry;
}

function pop(queue) {
  const first=queue[0], last=queue.pop();
  if(!queue.length) return first;
  let i=0;
  while(i*2+1<queue.length) {
    let child=i*2+1;
    if(queue[child+1]?.[0]<queue[child][0]) child++;
    if(last[0]<=queue[child][0]) break;
    queue[i]=queue[child];
    i=child;
  }
  queue[i]=last;
  return first;
}

function travel(start,targets,budget=Infinity) {
  const distance=new Map([[start,0]]), previous=new Map();
  const queue=[[0,start]], visited=[];
  while(queue.length) {
    const [minutes,at]=pop(queue);
    if(minutes!==distance.get(at)) continue;
    visited.push(at);
    if(at!==start&&targets?.has(at)) return {at,previous,minutes};
    for(const [to,edge] of nodes[at].edges) {
      const next=minutes+edge.minutes;
      if(next>budget||next>=(distance.get(to)??Infinity)) continue;
      distance.set(to,next);
      previous.set(to,at);
      push(queue,[next,to]);
    }
  }
  return {visited,distance,previous};
}

function nearest(point) {
  let result=-1,best=14;
  for(const [i,entry] of nodes.entries()) {
    if(!entry.edges.size||Math.abs(entry.point[1]-point[1])>.14) continue;
    const km=roadKilometres(point,entry.point);
    if(km<best) {best=km;result=i;}
  }
  return result;
}

const all=new Map(legacy), newSites=[], links=[];
const municipal=new Map([...legacy.values()].filter(site=>!site.metro).map(site=>[site.node,site]));
const goods=['Сборные грузы','Товары ритейла','Комплектующие','Продукты и напитки','Упаковка','Запчасти и инструмент','Охлаждённые продукты','Бытовая техника'];
function add(site) {
  site.point=nodes[site.node].point;
  site.goods=goods[(newSites.length*5)%goods.length];
  newSites.push(site);
  all.set(site.id,site);
}

function connect(source,target,previous,fromEnd,local) {
  const ids=[fromEnd];
  while(ids.at(-1)!==source.node) ids.push(previous.get(ids.at(-1)));
  const points=ids.reverse().map(i=>nodes[i].point);
  const shape=[points[0]];
  // Short source segments still have samples for animation and route traces.
  for(const point of points.slice(1)) {
    const from=shape.at(-1), count=points.length>3?1:3;
    for(let part=1;part<count;part++) shape.push(from.map((coord,i)=>+(coord+(point[i]-coord)*part/count).toFixed(5)));
    shape.push(point);
  }
  const refs=ids.slice(1).map((n,i)=>nodes[ids[i]].edges.get(n).ref).filter(Boolean);
  const ref=refs.find(value=>value!=='');
  links.push({a:source.id,b:target.id,shape,local,name:ref||(local?'Подъезд к терминалу':'Межгородской дорожный коридор')});
}

for(const [id,city,region,west=-180] of regions) {
  const match=places.find(row=>row[0]===city&&row[1]>=west);
  const coords=cities[id]?.slice(1)??match?.slice(1,3);
  const node=coords?nearest(coords):-1;
  if(node===-1||municipal.has(node)) {
    console.log('Missing local road geometry',id,city);
    continue;
  }
  const site={id,name:`РЦ ${city}`,city,region,node,population:match?.[3]??20000};
  add(site);
  const route=travel(node,municipal);
  if(route.at!==undefined) connect(site,municipal.get(route.at),route.previous,route.at,false);
  else console.log('Local road component',id,city);
  municipal.set(node,site);
}

const directions=['Восток','Северо-Восток','Север','Северо-Запад','Запад','Юго-Запад','Юг','Юго-Восток'];
const shortLon=delta=>((delta+540)%360)-180;
function offset([lon,lat],[x,y]) {
  return [shortLon(x-lon)*111.32*Math.cos(lat*Math.PI/180),(y-lat)*111.32];
}
const isSeparated=(point,known,minimum)=>!known.some(p=>roadKilometres(p,point)<minimum);

for(const site of municipal.values()) {
  const size=site.population, name=site.city??cities[site.id][0];
  const count=site.id==='msk'?8:site.id==='spb'?6:size>=700000?4:size>=275000?3:size>=80000?2:1;
  const nearby=travel(site.node,null,site.id==='msk'?67:49);
  const neighbors=[...all.values()].filter(other=>roadKilometres(site.point,other.point)<60).map(other=>other.point);
  const candidates=nearby.visited.map(node=>{
    const {point}=nodes[node];
    const [x,y]=offset(site.point,point);
    return {node,point,radius:Math.hypot(x,y),angle:Math.atan2(y,x)};
  });
  for(let index=0;index<count;index++) {
    const direction=(index*3+site.id.charCodeAt(0))%8;
    const goal=index%2===0?(size>=500000?8:5):(size>=500000?22:13);
    const target=direction*Math.PI/4;
    let best, score=Infinity;
    for(const candidate of candidates) {
      if(candidate.radius<2.4||candidate.radius>36) continue;
      const value=Math.abs(candidate.radius-goal)+8*(1-Math.cos(candidate.angle-target));
      if(value>=score||!isSeparated(candidate.point,neighbors,size>=700000?4:2.8)) continue;
      best=candidate;
      score=value;
    }
    if(!best) continue;
    const heading=directions[Math.round((best.angle+2*Math.PI)/(Math.PI/4))%8];
    const suffix=best.radius>13?'Пригород':'Город';
    const suburb=places.find(p=>p[0]!==name&&roadKilometres(best.point,p.slice(1,3))<2.7);
    const hub={id:site.id+'-l'+(index+1),name:`${suffix==='Пригород'?'Логопарк':'Терминал'} ${heading}`,
      city:suburb?.[0]??`${name} · ${heading.toLowerCase()}`,region:site.region,node:best.node,metro:site.id};
    add(hub);
    neighbors.push(best.point);
    // The access path was found from the city's junction towards the warehouse.
    connect(site,hub,nearby.previous,best.node,true);
  }
}

function catchment(site) {
  const local=Boolean(site.metro);
  const minutes=local?24:site.population>300000?38:34;
  const limit=local?20:site.population>300000?37:31;
  const reach=travel(site.node,null,minutes);
  const cloud=[];
  for(const at of reach.visited) {
    const from=nodes[at].point;
    cloud.push(offset(site.point,from));
    for(const [to,edge] of nodes[at].edges) {
      const fraction=(minutes-reach.distance.get(at))/edge.minutes;
      if(fraction>0&&fraction<1) {
        const end=nodes[to].point;
        cloud.push(offset(site.point,[from[0]+shortLon(end[0]-from[0])*fraction,from[1]+(end[1]-from[1])*fraction]));
      }
    }
  }
  const segments=24;
  const raw=Array.from({length:segments},(_,i)=>{
    const angle=i*Math.PI*2/segments;
    const radius=cloud.reduce((farthest,xy)=>{
      const heading=Math.atan2(xy[1],xy[0]);
      return Math.max(farthest,Math.min(limit,Math.hypot(...xy))*Math.max(0,Math.cos(angle-heading))**6);
    },0);
    return Math.min(limit,radius+(local?2.4:3.4));
  });
  const ring=raw.map((radius,i)=>{
    const smoothed=(raw[(i+segments-1)%segments]+3*radius+raw[(i+1)%segments])/5;
    const angle=i*Math.PI*2/segments, [lon,lat]=site.point;
    const xx=lon+smoothed*Math.cos(angle)/(111.32*Math.cos(lat*Math.PI/180));
    return [+shortLon(xx).toFixed(5),+(lat+smoothed*Math.sin(angle)/111.32).toFixed(5)];
  });
  return {minutes,ring:[...ring,ring[0]]};
}

function hull(point,points) {
  const lon=point[0];
  const sorted=points.map(([x,y])=>[lon+shortLon(x-lon),y]).sort(([x,y],[a,b])=>x-a||y-b);
  const half=list=>{
    const out=[];
    for(const c of list) {
      while(out.length>=2) {
        const [a,b]=out.slice(-2);
        if((b[0]-a[0])*(c[1]-a[1])>(b[1]-a[1])*(c[0]-a[0])) break;
        out.pop();
      }
      out.push(c);
    }
    return out.slice(0,-1);
  };
  const ring=[...half(sorted),...half(sorted.toReversed())].map(([x,y])=>[+shortLon(x).toFixed(5),y]);
  return [...ring,ring[0]];
}

const siteCoverage=Object.fromEntries([...all.values()].map(site=>[site.id,catchment(site)]));
const districts=Object.fromEntries([...municipal.values()].map(site=>{
  const members=[...all.values()].filter(other=>other.id===site.id||other.metro===site.id);
  return [site.id,{city:site.city??cities[site.id][0],ring:hull(site.point,members.flatMap(member=>siteCoverage[member.id].ring))}];
}));

const placesOut=newSites.map(({id,name,city,region,point,metro,goods})=>({id,name,city,region,point,metro,goods}));
writeFileSync(asset('regional-network.mjs'),`// Generated by tools/build-regional-network.mjs from the bundled road and place data.\nexport const regionalSites = ${JSON.stringify(placesOut)};\nexport const regionalLinks = ${JSON.stringify(links)};\n`);
writeFileSync(asset('coverage.json'),JSON.stringify({sites:siteCoverage,districts}));
console.log(`${all.size} warehouses, ${links.length} new corridors, ${Object.keys(districts).length} delivery districts`);
