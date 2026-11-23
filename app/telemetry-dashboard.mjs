import { icon, num, escapeText } from './ui.mjs';
import { summarize } from './telemetry-store.mjs';

export const periods=[['900','15 минут'],['3600','1 час'],['21600','6 часов'],['86400','24 часа']];
export const telemetryGroups={vehicle:'Автопарк',equipment:'Складская техника',warehouse:'Склады'};
const baseDate=Date.UTC(2026,10,23,9,42);
const hm=new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'});
const fullTime=new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'UTC'});
const timeFmt=(seconds,full=false)=>(full?fullTime:hm).format(baseDate+seconds*1000);
const labels={
  temperature:['Температура','°C','teal',89],
  vibration:['Вибрация','мм/с','blue',5],
  risk:['Индекс риска','%','amber',75],
  wear:['Расчётный износ','%','violet',65],
  rul:['Остаточный ресурс','ч','blue',60],
  fuel:['Уровень топлива','%','teal',15],
  battery:['Заряд батареи','%','teal',20],
  cold:['Температура в отсеке','°C','blue',5],
  humidity:['Относительная влажность','%','blue',65],
  fill:['Загрузка склада','%','amber',88],
  docks:['Занято доков','шт.','violet',null],
};
export const formatValue=(value,unit)=>num(value,1)+' '+unit;
const field=(key,threshold)=>({key,label:labels[key][0],unit:labels[key][1],color:labels[key][2],threshold:threshold??labels[key][3]});

export function fieldsFor(asset) {
  if(asset.code) return [field('temperature',asset.goods.includes('Охлажд')?6:22),field('humidity'),field('fill'),field('docks',asset.docks)];
  return [field('temperature'),field('vibration'),field('risk'),field(asset.refrigerated?'cold':asset.kind?'fuel':'battery'),field('wear'),field('rul')];
}

export function telemetryToolbar(group,groups,selected,window) {
  const options=Object.entries(telemetryGroups).map(([id,label])=>`<option value="${id}" ${id===group?'selected':''}>${label}</option>`).join('');
  const assets=groups[group].map(asset=>`<option value="${asset.id}" ${asset.id===selected?'selected':''}>${escapeText(asset.code??asset.id)} · ${escapeText(asset.name)}</option>`).join('');
  return `<section class="panel telemetry-controls">
    <label><span>Группа</span><select id="telemetry-group">${options}</select></label>
    <label><span>Актив</span><select id="telemetry-asset">${assets}</select></label>
    <label><span>Период</span><select id="telemetry-window">${periods.map(([value,label])=>`<option value="${value}" ${Number(value)===window?'selected':''}>${label}</option>`).join('')}</select></label>
    <button class="btn secondary telemetry-download" type="button" data-action="telemetry-export">${icon('download',17)} Экспорт CSV</button>
  </section><div id="telemetry-results"></div>`;
}

function pointsFor(samples,key) {
  const step=Math.max(1,Math.ceil(samples.length/145));
  if(step===1) return samples;
  const pairs=[];
  for(let i=0;i<samples.length;i+=step) {
    const batch=samples.slice(i,i+step);
    const lo=batch.reduce((low,item)=>item[key]<low[key]?item:low);
    const hi=batch.reduce((high,item)=>item[key]>high[key]?item:high);
    pairs.push(...(lo===hi?[lo]:lo.time<hi.time?[lo,hi]:[hi,lo]));
  }
  if(pairs[0]!==samples[0]) pairs.unshift(samples[0]);
  if(pairs.at(-1)!==samples.at(-1)) pairs.push(samples.at(-1));
  return pairs;
}

function chart(metric,samples,stat) {
  const {key,label,unit,color,threshold}=metric;
  const values=pointsFor(samples,key);
  const start=samples[0].time,end=samples.at(-1).time;
  const range=Math.max(1,stat.high-stat.low);
  const lower=Math.floor((stat.low-range*.15)*10)/10, upper=Math.ceil((stat.high+range*.17)*10)/10;
  const displayMin=Math.max(unit==='°C'? -30:0,lower);
  const displayMax=Math.max(displayMin+.4,upper);
  const x=(time)=>43+(time-start)/(end-start)*483;
  const y=(value)=>118-100*(value-displayMin)/(displayMax-displayMin);
  const coords=values.map(item=>[x(item.time),y(item[key])]);
  const path=coords.map(([xx,yy],i)=>(i?'L':'M')+xx.toFixed(2)+','+yy.toFixed(2)).join('');
  const rows=Array.from({length:5},(_,i)=>{
    const at=displayMin+(displayMax-displayMin)*i/4;
    return `<line x1="43" x2="526" y1="${y(at)}" y2="${y(at)}"/><text x="35" y="${y(at)+3}" text-anchor="end">${num(at,1)}</text>`;
  }).join('');
  const times=Array.from({length:5},(_,i)=>{
    const time=start+(end-start)*i/4;
    return `<line x1="${x(time)}" x2="${x(time)}" y1="18" y2="118"/><text x="${x(time)}" y="142" text-anchor="middle">${timeFmt(time)}</text>`;
  }).join('');
  const thresholdLine=Number.isFinite(threshold)&&threshold>=displayMin&&threshold<=displayMax
    ?`<line x1="43" x2="526" y1="${y(threshold)}" y2="${y(threshold)}" class="telemetry-threshold"/>`:'';
  const info=JSON.stringify(values.map((item,i)=>[coords[i][0],coords[i][1],timeFmt(item.time,true),formatValue(item[key],unit),item.observed]));
  return `<article class="panel telemetry-chart series-${color}"><header><h3>${label}</h3><span>${unit}</span></header>
    <div class="chart-canvas" data-points="${escapeText(info)}"><svg class="telemetry-svg" viewBox="0 0 552 153" role="img" aria-label="${label} за выбранный период" tabindex="0">
      <g class="telemetry-grid">${rows}${times}</g>${thresholdLine}
      <path d="${path}L526,118L43,118Z" class="series-fill"/><path d="${path}" class="series-stroke"/>
      <line class="chart-crosshair" x1="43" x2="43" y1="18" y2="118" visibility="hidden"/>
      <circle class="chart-point" r="4.5" visibility="hidden"/>
    </svg><div class="chart-tip" hidden role="status"></div></div>
    <footer><span><i></i> Последнее <b>${formatValue(stat.latest,unit)}</b></span><span>Среднее <b>${formatValue(stat.mean,unit)}</b></span><span>Пик <b>${formatValue(stat.high,unit)}</b></span></footer>
  </article>`;
}

export function telemetryContent(asset,samples) {
  const fields=fieldsFor(asset);
  const stats=fields.map(field=>summarize(samples,field.key));
  const watch=fields.flatMap((field,index)=>{
    if(field.threshold===null) return [];
    const below=field.key==='fuel'||field.key==='battery'||field.key==='rul';
    const count=samples.filter(row=>below?row[field.key]<field.threshold:row[field.key]>=field.threshold).length;
    return [{...field,stat:stats[index],count}];
  });
  const observed=samples.filter(row=>row.observed).length;
  return `<div class="telemetry-summary">${fields.slice(0,4).map(({label,unit,color},i)=>`<div class="panel sensor-stat series-${color}"><span>${label}</span>
    <strong>${num(stats[i].latest,1)} <small>${unit}</small></strong><small>Диапазон ${num(stats[i].low,1)}–${num(stats[i].high,1)}</small></div>`).join('')}</div>
  <div class="telemetry-layout">
    <div class="telemetry-charts">${fields.map((metric,i)=>chart(metric,samples,stats[i])).join('')}</div>
    <aside class="panel telemetry-insights"><div class="panel-head"><div><h2>Анализ периода</h2><p>${escapeText(asset.name)}</p></div>${icon('activity',20)}</div>
      <div class="insight-facts"><div><span>Точек в окне</span><b>${samples.length}</b></div><div><span>Собрано за сеанс</span><b>${observed}</b></div><div><span>Шаг датчиков</span><b>1 мин</b></div></div>
      <h3>Контрольные границы</h3><div class="threshold-table">${watch.map(item=>`<div class="${item.count?'has-breach':''}"><span><i></i><b>${item.label}</b><small>Граница ${formatValue(item.threshold,item.unit)}</small></span><strong>${item.count}</strong></div>`).join('')}</div>
      <p class="sensor-origin">${icon('clock',16)} Данные симуляции. История до начала сеанса смоделирована, новые точки собираются при работе приложения.</p>
    </aside>
  </div>`;
}

const cache=new WeakMap();
export function chartScrub(event) {
  const canvas=event.target.closest('.chart-canvas');
  if(!canvas) return;
  const svg=canvas.querySelector('svg');
  const tip=canvas.querySelector('.chart-tip');
  const cross=canvas.querySelector('.chart-crosshair');
  const point=canvas.querySelector('.chart-point');
  if(event.type==='pointerleave'||event.type==='focusout'||event.key==='Escape') {
    tip.hidden=true;
    cross.setAttribute('visibility','hidden');
    point.setAttribute('visibility','hidden');
    return;
  }
  if(!cache.has(canvas)) cache.set(canvas,{rows:JSON.parse(canvas.dataset.points),index:0});
  const chart=cache.get(canvas);
  if(event.type==='keydown') {
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    chart.index=event.key==='Home'?0:event.key==='End'?chart.rows.length-1:
      Math.max(0,Math.min(chart.rows.length-1,chart.index+(event.key==='ArrowLeft'?-1:1)));
  } else {
    const rect=svg.getBoundingClientRect();
    const x=(event.clientX-rect.left)/rect.width*552;
    chart.index=chart.rows.reduce((nearest,row,i)=>Math.abs(row[0]-x)<Math.abs(chart.rows[nearest][0]-x)?i:nearest,0);
  }
  const [x,y,time,value,observed]=chart.rows[chart.index];
  cross.setAttribute('x1',x); cross.setAttribute('x2',x);
  point.setAttribute('cx',x); point.setAttribute('cy',y);
  cross.setAttribute('visibility','visible');
  point.setAttribute('visibility','visible');
  tip.style.left=Math.max(16,Math.min(84,x/552*100))+'%';
  tip.textContent=`${time} · ${value} · ${observed?'Замер':'История'}`;
  tip.hidden=false;
}

export function telemetryCSV(asset,samples) {
  const fields=fieldsFor(asset);
  const header=['Время','Актив','Источник',...fields.map(item=>item.label+' ('+item.unit+')')];
  const rows=samples.map(row=>[new Date(baseDate+row.time*1000).toISOString(),asset.id,row.observed?'Замер симуляции':'Стартовая история',...fields.map(item=>row[item.key])]);
  return '\uFEFF'+[header,...rows].map(row=>row.map(value=>String(value).replaceAll('\t',' ')).join(';')).join('\r\n');
}
