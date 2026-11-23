// Each hall declares its footprint, its roof, and the order of work zones on its floor.
const facilities = {
  msk: ['Сквозной распределительный центр', [[0,0,33,23,'gable','ADCFGEBK']], [[0,'south',8],[0,'north',4]], '#7892ad', 3.1],
  spb: ['Г-образный терминал', [[0,0,27,15,'flat','AGFBCD'],[0,15,11,10,'gable','KE']], [[0,'north',7],[1,'south',3]], '#437eaa', 2.85],
  kzn: ['П-образный комплекс с двором', [[0,0,25,10,'gable','ACDF'],[0,10,7,13,'flat','BK'],[18,10,7,13,'flat','EG']], [[0,'north',5],[1,'south',1],[2,'south',2]], '#977261', 2.65],
  ekb: ['Два корпуса для тяжёлых грузов', [[0,0,28,12,'gable','CDGK'],[3,16,22,9,'flat','ABEF']], [[0,'north',6],[1,'south',4]], '#6b83a7', 3.45],
  nsk: ['Длинный сортировочный зал', [[0,0,38,14,'saw','ABDCEGFK']], [[0,'south',8]], '#5d919b', 2.9],
  rnd: ['Терминал с холодильным крылом', [[0,0,20,14,'flat','ABFGKC'],[20,4,8,10,'flat','ED']], [[0,'south',4],[1,'east',2]], '#72956c', 2.5],
  krsk: ['Т-образный склад и сервис', [[0,0,26,12,'gable','ACDGEF'],[7,12,11,10,'gable','KB']], [[0,'north',4],[1,'south',2]], '#997b59', 3.08],
  khv: ['Региональный терминал с навесом', [[0,0,19,11,'saw','ADFCGE'],[3,14,12,6,'flat','BK']], [[0,'north',4],[1,'south',2]], '#597f93', 2.6],
  msk_khimki: ['Поперечная сортировка', [[0,0,15,27,'saw','BACGDEKF']], [[0,'east',6],[0,'west',2]], '#6e87a3', 2.7],
  msk_domodedovo: ['Два охлаждаемых корпуса', [[0,0,30,17,'flat','EACFDB'],[0,20,22,11,'flat','GK']], [[0,'north',8],[1,'south',6]], '#7a9aa6', 2.95],
  msk_kotelniki: ['Компактный городской склад', [[0,0,19,14,'flat','AGFBDCEK']], [[0,'south',5],[0,'east',1]], '#8d758d', 2.35],
  msk_mytishchi: ['Комплекс с боковым складом', [[0,0,24,19,'gable','DBFECG'],[24,8,10,11,'saw','AK']], [[0,'south',7],[1,'east',3]], '#75928a', 3.3],
  spb_shushary: ['Два зала с приёмным корпусом', [[0,0,29,12,'gable','ACDE'],[0,15,29,11,'saw','BFKG']], [[0,'north',6],[1,'south',6]], '#547ba4', 3.15],
  spb_parnas: ['Угловой перевалочный склад', [[0,0,20,13,'flat','BAFGDC'],[12,13,8,8,'flat','EK']], [[0,'north',4],[1,'south',2]], '#4b8f92', 2.5],
  kzn_stolbische: ['Авиационный кросс-док', [[0,0,24,14,'saw','AFGCDBEK']], [[0,'south',3],[0,'north',3]], '#7989b1', 2.65],
  ekb_koltsovo: ['Ангарный склад с сервисным блоком', [[0,0,24,17,'gable','DFABGC'],[24,0,9,12,'flat','KE']], [[0,'south',6],[1,'east',2]], '#688299', 3.2],
};

export function facilityLayout(asset) {
  const [type, footprint, loading, finish, height] = facilities[asset.id]??regionalLayout(asset);
  const halls = footprint.map(([x,z,w,d,roof,order]) => ({x,z,w,d,roof,order,height}));
  const zones = halls.flatMap(hall => {
    const wide = hall.w >= hall.d * 0.8;
    const cols = wide ? Math.ceil(hall.order.length / 2) : 2;
    const rows = Math.ceil(hall.order.length / cols);
    const aisleX = cols === 2 ? 1.5 : .72;
    const aisleZ = rows === 2 ? 1.85 : .68;
    const w = (hall.w - 1.7 - (cols - 1) * aisleX) / cols;
    const d = (hall.d - 1.7 - (rows - 1) * aisleZ) / rows;
    return Array.from(hall.order, (id,i) => ({
      id,x:hall.x+.85+(i%cols)*(w+aisleX),z:hall.z+.85+Math.floor(i/cols)*(d+aisleZ),w,d,
    }));
  });
  const docks = loading.flatMap(([index,side,count]) => {
    const hall = halls[index];
    const eastWest = side === 'east' || side === 'west';
    const length = eastWest ? hall.d : hall.w;
    const spacing = length / (count + 1);
    return Array.from({ length:count }, (_,i) => ({
      hall:index,side,offset:(i+1)*spacing,width:Math.min(1.38,spacing*.75),
    }));
  }).map((dock,index)=>({...dock,number:index+1}));
  const w = Math.max(...halls.map(h => h.x+h.w));
  const d = Math.max(...halls.map(h => h.z+h.d));
  const meters = Math.sqrt(asset.area / halls.reduce((area,h) => area+h.w*h.d, 0));
  return { type, halls, zones, docks, finish, w, d, meters, widthMeters:Math.round(w*meters), depthMeters:Math.round(d*meters) };
}

function regionalLayout(asset) {
  const i=asset.layout;
  const [type,footprint,loading,color,height]=Object.values(facilities)[i%16];
  const sx=.88+(i%31)*.012+Math.floor(i/31)*.0011, sz=1.05+(i%7)*.036;
  const halls=footprint.map(([x,z,w,d,roof,order])=>[x*sx,z*sz,w*sx,d*sz,roof,order]);
  const weights=loading.reduce((total,[,,count])=>total+count,0);
  let assigned=0, cumulative=0;
  const docks=loading.map(([hall,side,weight])=>{
    cumulative+=weight;
    const next=Math.round(asset.docks*cumulative/weights);
    const slots=next-assigned;
    assigned=next;
    return [hall,side,slots];
  });
  return [type,halls,docks,color,height+(i%5)*.09];
}

export function shellPose(progress, height) {
  const t=Math.max(0,Math.min(1,progress));
  const eased=t*t*(3-2*t);
  return { lift:height*eased, opacity:1-eased };
}

export function yardLoopProgress(seconds, length, speed) {
  return yardLoopState(seconds,length,speed).phase;
}

export function yardLoopState(seconds,length,speed) {
  const stage=length/2;
  const ramp=Math.min(2,stage/speed);
  const moving=stage/speed+ramp;
  const period=3+moving;
  const loops=Math.floor(seconds/(2*period));
  const clock=seconds-loops*(2*period);
  const half=clock>=period?stage:0;
  const time=Math.max(0,clock%period-3);
  const left=moving-time;
  const position=time<ramp?speed*time*time/(2*ramp)
    :left<ramp?stage-speed*left*left/(2*ramp)
    :speed*(time-ramp/2);
  return {phase:(half+position)/length,travelled:loops*length+half+position,dwell:Math.min(1,clock%period/3)};
}

export function mapDetail(worldUnitsPerPixel) {
  if (worldUnitsPerPixel > 1.8) return 'country';
  if (worldUnitsPerPixel > .11) return 'region';
  if (worldUnitsPerPixel > .014) return 'metro';
  return 'street';
}

export function projectMapPoint(longitude,latitude) {
  const radians=Math.PI/180;
  // Place the longitude seam west of Eurasia, so both sides of Chukotka stay adjacent.
  const east=longitude<-90?longitude+360:longitude;
  const lat=Math.max(-85,Math.min(85,latitude))*radians;
  return [east*10,-Math.log(Math.tan(Math.PI/4+lat/2))*10/radians];
}
