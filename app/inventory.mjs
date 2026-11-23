export const productGroups={
  parts:'Комплектующие',tools:'Инструменты и оснастка',home:'Бытовая техника',
  retail:'Товары ритейла',pack:'Упаковка',cold:'Охлаждённые продукты',
  food:'Продукты и напитки',custom:'Грузы под заказ',
};

const storage={
  parts:['Сухой стеллаж · +5…+30 °C','C'],
  tools:['Палетный стеллаж · сухое хранение','D'],
  home:['Палетный стеллаж · вертикальное хранение','D'],
  retail:['Сухой склад · вдали от нагрева','F'],
  pack:['Сухой склад · защищать от влаги','G'],
  cold:['Холодильная камера · +2…+6 °C','E'],
  food:['Сухой склад · +5…+25 °C','A'],
};

const products=[
  ['CMP-6205','parts','Подшипник 6205-2RS','Шариковый радиальный подшипник с уплотнениями для электродвигателей, роликов и приводов.',.129,'52 × 52 × 15 мм',5400,'Подшипник, шт.',[['Внутренний диаметр','25 мм'],['Корпус','Сталь, уплотнения с двух сторон']]],
  ['CMP-HF26','parts','Гидравлический фильтр HF-260','Сменный фильтроэлемент для защиты гидросистемы погрузчиков от загрязнений.',.68,'90 × 90 × 260 мм',820,'Фильтр, шт.',[['Тонкость фильтрации','10 мкм'],['Рабочая среда','Гидравлическое масло']]],
  ['CMP-M80','parts','Электродвигатель АИР 80 B2','Трёхфазный асинхронный двигатель для привода конвейера и промышленного оборудования.',13.7,'304 × 157 × 193 мм',54,'Двигатель, шт.',[['Мощность','2,2 кВт'],['Исполнение','IP55 · 380 В']]],
  ['TLS-S108','tools','Сервисный набор S108','Торцевые головки, удлинители, трещотки и биты для ремонта транспортной техники.',7.3,'440 × 345 × 90 мм',80,'Набор',[['Комплект','108 предметов'],['Материал','Хромованадиевая сталь']]],
  ['TLS-CYL','tools','Гидроцилиндр 63/40-400','Линейный исполнительный узел для подъёмных и зажимных механизмов.',17.4,'660 × 113 × 113 мм',44,'Цилиндр, шт.',[['Ход штока','400 мм'],['Диаметр поршня','63 мм']]],
  ['TLS-CAL','tools','Штангенциркуль DC-150','Цифровой измерительный инструмент для входного контроля размеров деталей.',.31,'245 × 88 × 24 мм',650,'Прибор, шт.',[['Диапазон','0–150 мм'],['Шаг индикации','0,01 мм']]],
  ['HME-K17','home','Электрочайник K17','Бытовой электрочайник с автоотключением и съёмным фильтром.',1.31,'228 × 179 × 247 мм',100,'Чайник, шт.',[['Объём','1,7 л'],['Мощность','2 000 Вт']]],
  ['HME-M20','home','Микроволновая печь M20','Настольная печь с механическим управлением для разогрева продуктов.',12.1,'453 × 344 × 260 мм',35,'Печь, шт.',[['Объём камеры','20 л'],['Мощность СВЧ','700 Вт']]],
  ['HME-V18','home','Пылесос V18','Напольный пылесос с контейнером для сухой уборки.',4.8,'398 × 285 × 264 мм',36,'Пылесос, шт.',[['Контейнер','1,8 л'],['Фильтр','Моющийся']]],
  ['RTL-P04','retail','Бумажные полотенца P04','Потребительская упаковка двухслойных бумажных полотенец для кухни и складских помещений.',.64,'230 × 218 × 221 мм',48,'Упаковка из 4 рулонов',[['Материал','Целлюлоза'],['Слоёв','2']]],
  ['RTL-GL12','retail','Рабочие перчатки GL12','Трикотажные перчатки с покрытием для комплектовки, приёмки и лёгких монтажных работ.',.78,'290 × 180 × 110 мм',96,'Пачка из 12 пар',[['Размер','L / 9'],['Покрытие','Полиуретан']]],
  ['RTL-C05','retail','Моющее средство C05','Концентрат для влажной уборки твёрдых поверхностей и полов.',5.3,'193 × 140 × 289 мм',132,'Канистра 5 л',[['Форма','Жидкий концентрат'],['Тара','ПНД']]],
  ['PKG-C64','pack','Гофрокороб C64','Складные коробки для комплектации и перевозки товаров на стандартных палетах.',5.4,'805 × 595 × 115 мм',40,'Пачка из 20 коробок',[['Размер собранного короба','600 × 400 × 300 мм'],['Материал','Гофрокартон Т-24']]],
  ['PKG-S23','pack','Стретч-плёнка S23','Плёнка для ручной обмотки грузовых палет перед отправкой.',2.05,'500 × 115 × 115 мм',120,'Рулон',[['Ширина','500 мм'],['Толщина','23 мкм']]],
  ['PKG-L58','pack','Этикетки L58','Самоклеящиеся этикетки для складской маркировки и печати штрихкодов.',.42,'110 × 95 × 95 мм',144,'Рулон 1 000 этикеток',[['Формат','58 × 40 мм'],['Печать','Прямая термопечать']]],
  ['CLD-M10','cold','Молоко пастеризованное M10','Молоко в герметичной потребительской упаковке. Товар перевозится в холодильной цепи.',1.04,'72 × 72 × 235 мм',620,'Упаковка 1 л',[['Жирность','3,2%'],['Упаковка','Асептический картон']]],
  ['CLD-Y12','cold','Йогурт натуральный Y12','Групповая упаковка кисломолочного продукта для холодной выкладки.',1.62,'284 × 215 × 82 мм',360,'Лоток 12 × 125 г',[['Вкус','Натуральный'],['Упаковка','Запаянные стаканчики']]],
  ['CLD-CH1','cold','Сыр полутвёрдый CH1','Фасованный сыр в вакуумной упаковке. На складе размещается в охлаждаемой зоне.',1.05,'190 × 115 × 52 мм',450,'Блок 1 кг',[['Тип','Полутвёрдый'],['Упаковка','Вакуум']]],
  ['FOD-W06','food','Вода питьевая W06','Групповая упаковка негазированной питьевой воды для поставки в торговые залы.',9.22,'290 × 197 × 320 мм',64,'Упаковка 6 × 1,5 л',[['Газирование','Без газа'],['Тара','ПЭТ']]],
  ['FOD-R10','food','Рис длиннозёрный R10','Сухая бакалея в прочном заводском мешке для складской отгрузки.',10.1,'560 × 340 × 77 мм',52,'Мешок 10 кг',[['Сорт','Длиннозёрный'],['Назначение','Розничные и оптовые поставки']]],
  ['FOD-T06','food','Томатная пассата T06','Протёртые томаты в стеклянных бутылках для поставок в продуктовые магазины и предприятия питания.',4.12,'255 × 170 × 190 мм',128,'Короб 6 × 500 г',[['Форма','Пюре'],['Тара','Стеклянные бутылки']]],
].map(([sku,group,name,description,unitKg,size,unitsPerPallet,unit,characteristics])=>{
  const [requirements,zone]=storage[group];
  return {sku,group,name,description,unitKg,size,unitsPerPallet,unit,characteristics,requirements,zone};
});

const classifier=[
  [/охлажд|молочн|холодов/iu,['cold']], [/продукт|напитк/iu,['food']],
  [/комплектующ|автокомпонент|компонент|запчаст/iu,['parts']],
  [/оснастк|инструмент|нефтесервис|оборудован/iu,['tools']],
  [/техник/iu,['home']], [/ритейл|розниц|товары/iu,['retail']],
  [/упаков|расходник/iu,['pack']], [/сборн|транзит|посылк|почтов|региональн|мелкоштуч|объёмн/iu,['retail','pack','parts']],
];
const knownGroups=label=>classifier.find(([pattern])=>pattern.test(label))?.[1]??[];
const kilograms=value=>Math.round(value*100)/100;
const palletMass=product=>product.unitKg*product.unitsPerPallet+21;
const stock=new WeakMap();
const manifests=new WeakMap();

export function stockFor(site) {
  if(stock.has(site)) return stock.get(site);
  const number=Number(site.code.slice(3));
  const supporting=['pack','parts','retail','home','tools','food','cold'];
  const groups=[...new Set([...knownGroups(site.goods),...supporting.slice(number%4),...supporting])].slice(0,4+(number%3));
  const chosen=products.filter(product=>groups.includes(product.group));
  const rows=chosen.map((product,index)=>{
    const pallets=Math.max(1,Math.round(site.area/3900)+3+(number*5+index*9)%11);
    const units=Math.round(product.unitsPerPallet*pallets*(site.fill/100+.10+(index%5)*.018));
    return {
      product,units,pallets,kg:kilograms(units*product.unitKg+pallets*19),
      zone:product.zone, location:`${product.zone}-${String(index%8+1).padStart(2,'0')}-${String(number%5+1).padStart(2,'0')}`,
      lot:`${site.code}/${String(index+1).padStart(3,'0')}`,
    };
  });
  stock.set(site,rows);
  return rows;
}

function customLine(vehicle,trip,kg,pallets) {
  const units=Math.max(1,pallets);
  return {units,kg,pallets,product:{
    sku:`GRC-${vehicle.id}`,group:'custom',name:trip.goods,
    description:'Партия по транспортному заданию. Одна учётная единица соответствует грузовому месту.',
    unit:'Грузовое место',unitKg:null,size:null,requirements:trip.cold?'Холодовая цепь по заданию':'Условия по транспортному заданию',
    characteristics:[['Комплектация','По спецификации отправителя']],
  },lot:vehicle.id+' / 01'};
}

export function manifestFor(vehicle,trip) {
  if(!trip||trip.load<=0) return [];
  if(manifests.has(trip)) return manifests.get(trip);
  const gross=kilograms(trip.load*1000);
  const pallets=trip.pallets;
  const groups=trip.cold?['cold']:knownGroups(trip.goods);
  const candidates=products.filter(product=>groups.includes(product.group));
  const maxLines=Math.min(Math.max(1,pallets),4);
  const pack=profiles=>profiles.map((product,i)=>{
    const places=Math.round(pallets*(i+1)/profiles.length)-Math.round(pallets*i/profiles.length);
    return {product,places,capacity:places*palletMass(product)};
  });
  let lines=pack(candidates.slice(0,maxLines));
  let capacity=lines.reduce((sum,line)=>sum+line.capacity,0);
  if(gross>capacity) {
    const byMass=candidates.toSorted((a,b)=>palletMass(b)-palletMass(a));
    for(let count=Math.min(maxLines,byMass.length);count>0;count--) {
      lines=pack(byMass.slice(0,count));
      capacity=lines.reduce((sum,line)=>sum+line.capacity,0);
      if(capacity>=gross) break;
    }
  }
  const manifest=[];
  let usedCapacity=0,usedKg=0;
  for(const [index,{product,places,capacity:lineCapacity}] of lines.entries()) {
    if(capacity<gross) break;
    usedCapacity+=lineCapacity;
    const share=index===lines.length-1?gross:kilograms(gross*usedCapacity/capacity);
    const kg=kilograms(share-usedKg);
    if(kg<product.unitKg) break;
    const packing=Math.min(kg*.14,places*21);
    const units=Math.max(1,Math.min(places*product.unitsPerPallet||1,Math.floor((kg-packing)/product.unitKg)));
    manifest.push({product,units,pallets:places,kg,lot:`${vehicle.id} / ${String(index+1).padStart(2,'0')}`});
    usedKg=share;
  }
  const rows=manifest.length===lines.length&&lines.length?manifest:[customLine(vehicle,trip,gross,pallets)];
  manifests.set(trip,rows);
  return rows;
}

export function inventorySummary(rows) {
  const groups=new Map();
  let units=0,kg=0,pallets=0;
  for(const row of rows) {
    const id=row.product.group;
    const bucket=groups.get(id)??{id,units:0,skus:0};
    bucket.units+=row.units;
    bucket.skus++;
    groups.set(id,bucket);
    units+=row.units;
    kg+=row.kg;
    pallets+=row.pallets;
  }
  return {units,kg:kilograms(kg),pallets,skus:new Set(rows.map(row=>row.product.sku)).size,groups:[...groups.values()].sort((a,b)=>b.units-a.units)};
}
