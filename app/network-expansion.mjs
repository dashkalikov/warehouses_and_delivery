export const additionalSites=[
  ['vld','Северные ворота','Владимирская область','vla','Комплектующие'],
  ['nn','Волжская сортировка','Нижегородская область','niz','Товары ритейла'],
  ['cheb','Чебоксарский терминал','Чувашская Республика','cu','Упаковка и расходники'],
  ['ch','РЦ Камский','Республика Татарстан','ta','Автокомпоненты'],
  ['prm','Прикамский терминал','Пермский край','per','Промышленная оснастка'],
  ['izh','РЦ Удмуртия','Удмуртская Республика','ud','Мелкоштучные грузы'],
  ['ufa','РЦ Агидель','Республика Башкортостан','ba','Товары ритейла'],
  ['chl','Южноуральский комплекс','Челябинская область','che','Промышленная оснастка'],
  ['vlg','Волгоградский кросс-док','Волгоградская область','vgg','Продукты и напитки'],
  ['sam','РЦ Самарский','Самарская область','sam','Компоненты сборки'],
  ['oms','РЦ Иртыш','Омская область','oms','Бытовая техника'],
  ['tym','Тюменский терминал','Тюменская область','tyu','Нефтесервисное оборудование'],
  ['irk','РЦ Ангара','Иркутская область','irk','Сборные грузы'],
  ['ulan','РЦ Селенга','Республика Бурятия','bu','Товары ритейла'],
  ['chita','Забайкальский терминал','Забайкальский край','zab','Транзитные грузы'],
  ['skov','Терминал Невер','Амурская область','amu','Сборные грузы'],
  ['blag','Благовещенский РЦ','Амурская область','amu','Охлаждённые продукты'],
  ['tv','РЦ Верхневолжье','Тверская область','tve','Сборные грузы'],
  ['nov','Новгородский кросс-док','Новгородская область','ngr','Товары ритейла'],
  ['vor','Донской терминал','Воронежская область','vor','Продукты и напитки'],
  ['tul','РЦ Окский','Тульская область','tul','Запчасти и инструмент'],
  ['yar','Ярославский терминал','Ярославская область','yar','Товары ритейла'],
  ['syz','Сызранская площадка','Самарская область','sam','Комплектующие'],
  ['pen','РЦ Сура','Пензенская область','pnz','Товары ритейла'],
  ['kur','Терминал Зауралье','Курганская область','kgn','Промышленная оснастка'],
  ['kem','РЦ Кузбасс','Кемеровская область','kem','Запчасти и инструмент'],
  ['ach','Ачинский терминал','Красноярский край','kya','Упаковка и расходники'],
  ['sar','РЦ Саратовский','Саратовская область','sar','Охлаждённые продукты'],
];

const demoTrips=[
  ['spb','msk',.64,'semi'],['msk','vor',-.32,'box'],['tul','msk',1.05,'cold'],
  ['ufa','prm',.47,'box'],['nn','msk',.57,'box'],['prm','ekb',.36,'semi'],
  ['msk','tv',.68,'van'],['nsk','kem',.39,'box'],['kem','krsk',.32,'semi'],
  ['krsk','irk',.29,'semi'],['irk','ulan',.51,'box'],['ulan','chita',.24,'box'],
  ['chita','skov',.61,'semi'],['skov','blag',.42,'box'],['blag','khv',.48,'cold'],
  ['tul','rnd',.40,'cold'],['vlg','sar',.67,'box'],['sar','sam',.23,'cold'],
  ['ekb','tym',-.18,'van'],['tym','oms',.31,'semi'],['chl','kur',.43,'flat'],
  ['cheb','kzn',1.03,'box'],['nov','spb',.78,'van'],['kzn','ch',.37,'box'],
  ['vor','rnd',-.21,'semi'],['kzn','ufa',.46,'semi'],
];
const vehicleTypes={
  semi:['КамАЗ 54901','Тягач с полуприцепом',20,30],
  box:['ГАЗон NEXT','Среднетоннажный фургон',8,20],
  cold:['КамАЗ 5325','Рефрижератор',12,26],
  van:['ГАЗель NN','Малотоннажный фургон',3.5,14],
  flat:['Урал NEXT','Бортовой грузовик',15,30],
};
const drivers=['Артур Фомин','Виктория Рябова','Никита Корнеев','Станислав Ершов','Зоя Павлова','Андрей Котов','Валерий Щукин','Эльвира Крылова',
  'Руслан Лазарев','Евгения Мельникова','Илья Гусев','Максим Пронин','Павел Титов','Таисия Беляева','Сергей Пахомов','Мария Сомова',
  'Александр Белов','Антон Гаврилов','Олег Краснов','Кирилл Ефимов','Дарья Игнатьева','Роман Лыткин'];
const driverSurnames=['Кирсанов','Новиков','Громов','Щеглов','Лукин','Быков','Сидоров','Доронин','Жуков','Тарасов'];
const driverName=(index)=>index<drivers.length?drivers[index]:
  ['Владимир','Иван','Борис','Глеб','Михаил','Семён','Алексей','Денис','Николай'][(index-22)%9]+' '+driverSurnames[Math.floor((index-22)/9)%10];

export function expansionFleet(sites) {
  const specs=[
    ...demoTrips.map(([home,destination,progress,kind])=>({home,destination,progress,kind,status:'active'})),
    ...additionalSites.flatMap(([home],index)=>[{home,status:'reserve',kind:index%6===1?'cold':'box'},{home,status:index%5===1?'service':'reserve',kind:index%3===1?'flat':'semi'}]),
    {home:'msk',status:'service',kind:'box'},
  ];
  return specs.map((entry,index)=>{
    const {kind,home,destination}=entry;
    const site=sites.find(place=>place.id===home);
    const [name,subtitle,capacity,consumption]=vehicleTypes[kind];
    const load=destination?Math.round(capacity*(.56+(index%5)*.055)*10)/10:0;
    const pallets=destination?Math.max(2,Math.min(kind==='van'?6:27,Math.ceil(load*1.53))):0;
    const risk=entry.status==='service'?12:index%7===0?7:0;
    return {...entry,id:'TR-'+(1001+index),name,subtitle,capacity,consumption,load,pallets,
      goods:destination?site.goods:'Свободен',condition:90-index%9-risk,driver:driverName(index),
      sensor:[66+(index%6)*2+risk,1.8+(index%7)*.27+risk*.28,18+(index%10)*2+risk*2],refrigerated:kind==='cold'};
  });
}

export function localFleet(sites,roads) {
  const exits=new Map(sites.map(site=>[site.id,[]]));
  for(const {a,b,km} of roads) {
    exits.get(a).push({id:b,km});
    exits.get(b).push({id:a,km});
  }
  const kinds=['van','box','semi','cold','box','van','flat','semi'];
  return sites.flatMap((site,i)=>{
    const choices=exits.get(site.id).sort((a,b)=>a.km-b.km);
    const parent=site.metro;
    const own=choices.find(link=>link.id===parent)??choices[0];
    const farther=choices.filter(link=>link.km>=28);
    return kinds.map((type,slot)=>{
      const seed=i*kinds.length+slot;
      const kind=slot===0&&!parent&&i%3===0?'box':type;
      const [name,subtitle,capacity,consumption]=vehicleTypes[kind];
      const target=slot===0?own:slot===1&&i%2===0?(farther[i%farther.length]??choices.at(-1)):null;
      const destination=target?.id, load=target?Math.round(capacity*(.52+i%6*.051)*10)/10:0;
      const status=target?'active':slot===7&&i%5===2?'service':'reserve';
      const health=status==='service'?15:seed%11;
      const cold=kind==='cold';
      return {id:'TR-'+(3001+seed),name,subtitle,kind,capacity,consumption,status,home:site.id,destination,load,
        pallets:target?Math.max(2,Math.min(kind==='van'?6:22,Math.ceil(load*1.48))):0,
        goods:target?(cold?'Охлаждённые продукты':site.goods):'Свободен',progress:.10+((i*17+slot*31)%75)/100,
        condition:96-health,driver:driverName(seed+73),sensor:[65+health,1.9+health*.26,17+health*2.55],refrigerated:cold};
    });
  });
}
