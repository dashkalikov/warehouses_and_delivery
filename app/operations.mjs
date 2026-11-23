const roles=[
  ['Начальник смены','F','supervise'],['Диспетчер доков','A','dock'],['Специалист входного контроля','B','receive'],
  ['Кладовщик','D','store'],['Оператор погрузчика','D','drive'],['Комплектовщик заказов','F','pick'],
  ['Оператор холодильной зоны','E','cold'],['Экспедитор','G','dispatch'],['Механик','K','repair'],['Инвентаризатор','C','count'],
];
const firstNames=['Иван','Алексей','Дмитрий','Елена','Максим','Мария','Ольга','Павел','Евгения','Роман','Илья','Софья','Артём','Дарья','Никита','Валерия','Сергей','Анна'];
const female=new Set(['Елена','Мария','Ольга','Евгения','Софья','Дарья','Валерия','Анна']);
const surnames=['Волков','Сафонов','Зайцев','Петров','Лебедев','Белов','Кузнецов','Орлов','Морозов','Крылов','Степанов','Козлов','Ершов','Мельников','Котов','Фомин','Захаров','Павлов','Ильин','Титов','Гусев','Рогов','Яковлев','Быков','Шубин','Краснов','Лапшин','Громов','Доронин'];
const rosterCache=new WeakMap();

export function warehouseStaff(site) {
  if(rosterCache.has(site)) return rosterCache.get(site);
  const index=Number(site.code.slice(3));
  const loaders=site.loaders??[];
  const existing=site.staff-loaders.length;
  const roster=Array.from({length:site.staff},(_,i)=>{
    const first=firstNames[(i+index*5)%firstNames.length];
    const last=surnames[(i+index*7)%surnames.length]+(female.has(first)?'а':'');
    const details={id:site.code+'-'+String(i+1).padStart(2,'0'),name:first+' '+last};
    const loader=loaders[i-existing];
    if(loader) return {...details,...loader};
    const [role,zone,task]=roles[i<roles.length?i:3+(i%5)];
    return {...details,role,zone,task:i>=roles.length&&task==='drive'?'staging':task};
  });
  rosterCache.set(site,roster);
  return roster;
}

export function driverProfile(vehicle) {
  const number=Number(vehicle.id.replace(/\D/g,''));
  return {name:vehicle.driver,id:'DR-'+number,category:vehicle.kind==='semi'?'CE':vehicle.kind==='van'?'B':'C',experience:3+number%19};
}

export const tripHours=(trip,clock)=>trip.elapsed+(clock-trip.at)/3600;
export const unloadHours=.55;
export const tripPhase=(trip,clock)=>{
  const hours=tripHours(trip,clock);
  if(hours<0) return 'loading';
  if(hours<trip.route.hours) return 'active';
  return hours<trip.route.hours+unloadHours?'unloading':'done';
};
export const siteActivities={
  parked:['На стоянке','reserve'],loading:['Загрузка','watch'],unloading:['Разгрузка','watch'],
  repair:['Ремонт','service'],onroute:['В пути','active'],transit:['Проезд через узел','reserve'],delivered:['Доставлено','done'],
};

export function siteVehicles(siteId,vehicles,trips,clock) {
  const byAsset=new Map(trips.map(trip=>[trip.vehicle.id,trip]));
  const rows=[];
  for(const vehicle of vehicles) {
    const trip=byAsset.get(vehicle.id);
    if(!trip) {
      if(vehicle.home===siteId) rows.push({vehicle,activity:vehicle.status==='service'?'repair':'parked',eta:0,onSite:true});
      continue;
    }
    const {nodes,legs,hours}=trip.route;
    const index=nodes.indexOf(siteId);
    if(index<0) continue;
    const elapsed=tripHours(trip,clock);
    const phase=tripPhase(trip,clock);
    const shipment={vehicle,trip,activity:'onroute',onSite:false};
    if(index===0) {
      const activity=phase==='loading'?'loading':phase==='active'?'onroute':'delivered';
      rows.push({...shipment,direction:'outgoing',activity,eta:Math.max(0,-elapsed),onSite:phase==='loading'});
    } else if(index===nodes.length-1) {
      const onSite=elapsed>=hours;
      rows.push({...shipment,direction:'incoming',eta:Math.max(0,hours-elapsed),onSite,
        activity:phase==='unloading'?'unloading':phase==='done'?'parked':'onroute'});
    } else {
      const crossing=legs.slice(0,index).reduce((sum,leg)=>sum+leg.hours,0);
      rows.push({...shipment,direction:'transit',activity:'transit',eta:Math.max(0,crossing-elapsed),passed:elapsed>=crossing});
    }
  }
  return rows.sort((a,b)=>Number(b.onSite)-Number(a.onSite)||a.eta-b.eta||a.vehicle.id.localeCompare(b.vehicle.id,'ru'));
}
