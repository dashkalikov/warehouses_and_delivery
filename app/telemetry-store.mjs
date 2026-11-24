import { predictMaintenance, telemetry } from './domain.mjs';

export const sampleStep=60;
const day=24*3600;
const round=(value)=>Math.round(value*10)/10;
const limit=(value,min,max)=>Math.min(max,Math.max(min,value));

export function sensorReading(asset,time) {
  if(asset.code) {
    const n=Number(asset.code.slice(3));
    const fill=limit(asset.fill+4*Math.sin(time/440+n)+2*Math.cos(time/149+n/2),0,100);
    const docks=limit((fill-13)+6*Math.sin(time/190+n),0,100);
    const storage=asset.goods.includes('Охлажд')?4:18.4;
    return {temperature:round(storage+.9*Math.sin(time/520+n)+.23*Math.cos(time/103)),humidity:round(53+9*Math.sin(time/820+n)),
      fill:round(fill),docks:Math.round(asset.docks*docks/100)};
  }
  const reading=telemetry(asset,time);
  const {risk,rul}=predictMaintenance(reading);
  return {...reading,wear:round(reading.wear),risk,rul,
    ...(asset.kind?{fuel:round(limit(84+(asset.sensor[2]%10)-Math.max(0,time+1200)/3600*3,10,98))}:{battery:round(limit(asset.battery-Math.max(0,time)/3600*1.7,5,100))}),
    ...(asset.refrigerated?{cold:round(3.4+.44*Math.sin(time/130)+.22*Math.cos(time/243))}:{}),
  };
}

export class SensorHistory {
  constructor(assets,read=sensorReading) {
    this.assets=new Map(assets.map(asset=>[asset.id,asset]));
    this.read=read;
    // Built-in readings are deterministic. Keep the observed interval and reconstruct
    // its values on demand. External readers still need their actual samples saved.
    this.records=read===sensorReading?null:new Map(assets.map(asset=>[asset.id,new Map()]));
    this.first=null;
    this.last=null;
  }

  capture(clock) {
    const minute=Math.floor(clock/sampleStep)*sampleStep;
    if(this.last!==null&&minute<=this.last) return false;
    const start=this.last===null?minute:Math.max(this.last+sampleStep,minute-day);
    this.first=Math.max(this.first??minute,minute-day);
    if(this.records) for(const [id,asset] of this.assets) {
      const records=this.records.get(id);
      for(let time=start;time<=minute;time+=sampleStep) records.set(time,this.read(asset,time));
      for(const key of records.keys()) {
        if(key>=minute-day) break;
        records.delete(key);
      }
    }
    this.last=minute;
    return true;
  }

  samples(id,clock,window) {
    const asset=this.assets.get(id);
    if(!asset) return [];
    const last=Math.floor(clock/sampleStep)*sampleStep;
    const records=this.records?.get(id);
    const result=[];
    for(let time=last-window;time<=last;time+=sampleStep) {
      const observed=records?records.has(time):this.first!==null&&time>=this.first&&time<=this.last&&time%sampleStep===0;
      result.push({time,observed,...(records&&observed?records.get(time):this.read(asset,time))});
    }
    return result;
  }
}

export function summarize(samples,key) {
  const values=samples.map(sample=>sample[key]).filter(Number.isFinite);
  if(!values.length) return null;
  return {latest:values.at(-1),low:Math.min(...values),high:Math.max(...values),mean:values.reduce((sum,x)=>sum+x,0)/values.length,
    change:values.at(-1)-values[0]};
}
