import { yardLoopState } from './spatial.mjs';

export const workLabels={
  supervise:'Контроль смены', dock:'Сверка накладных', receive:'Сканирование поставки',
  store:'Маркировка палет', drive:'Работа на погрузчике', pick:'Комплектация заказа',
  cold:'Контроль температуры', dispatch:'Проверка груза к отправке',
  repair:'Проверка привода', count:'Инвентаризация', staging:'Приём палет от погрузчика',
  climb:'Подъём к верхней полке', cart:'Перевозка коробок на тележке', pallet:'Перемещение палеты рохлей',
  stack:'Укладка коробок на палету', seal:'Упаковка коробок',
};

const handlingJobs=[['C','climb'],['A','cart'],['G','cart'],['D','pallet'],['G','stack'],['F','seal'],['B','stack'],['E','cart']];

export function handlingCrew(site) {
  const count=6+Number(site.area>=9000)+Number(site.docks>=9);
  return handlingJobs.slice(0,count).map(([zone,task])=>({role:'Грузчик',zone,task}));
}

const mobile=task=>task==='cart'||task==='pallet';
const floor=.047;

export function planShift(layout,roster) {
  const stations=new Map();
  const m=layout.meters;
  for (const zone of layout.zones) {
    const members=roster.filter(person=>person.zone===zone.id && person.task!=='drive');
    const aisle=members.find(person=>mobile(person.task));
    const climber=members.find(person=>person.task==='climb');
    const edge=zone.z+zone.d;
    const stationary=members.filter(person=>person!==aisle&&person!==climber);
    const setback=aisle?4.80/m:climber?2.7/m:.13;
    stationary.forEach((person,index)=>{
      const x=zone.x+zone.w*(index+1)/(stationary.length+1);
      stations.set(person.id,{x,z:edge-setback});
    });
    if(climber) stations.set(climber.id,{x:zone.x+.72/m,z:edge-1.1/m,clearance:4.05/m});
    if(aisle) {
      const radius=.62/m, from=zone.x+2.05/m, to=zone.x+zone.w-2.05/m;
      const track={from,to,center:edge-2.18/m,radius,meters:m,speed:aisle.task==='pallet'?.78:1.02};
      stations.set(aisle.id,{x:from,z:track.center-radius,track,clearance:6.22/m});
    }
  }
  return roster.map((person,index)=>({...person,index,...stations.get(person.id)}));
}

export function handlingMotion(track,seconds) {
  const {from,to,center,radius,meters,speed}=track;
  const straight=to-from, turn=Math.PI*radius;
  const length=2*(straight+turn);
  const {phase,travelled}=yardLoopState(seconds,length*meters,speed);
  const distance=phase*length;
  const result=(x,z,yaw)=>({x,y:floor,z,yaw,travelled});
  if(distance<straight) return result(from+distance,center-radius,0);
  if(distance>=straight+turn && distance<2*straight+turn) return result(to-distance+straight+turn,center+radius,Math.PI);
  const right=distance<straight+turn;
  const angle=(right?-Math.PI/2:Math.PI/2)+(distance-(right?straight:2*straight+turn))/radius;
  return result((right?to:from)+radius*Math.cos(angle),center+radius*Math.sin(angle),Math.atan2(-Math.cos(angle),-Math.sin(angle)));
}

export const stair={run:.26,rise:.235,count:5};
const cycles={supervise:18,dock:15,receive:11,store:14,pick:13,cold:17,dispatch:16,repair:20,count:12,staging:15,stack:10,seal:9};
const ease=(value)=>{
  const t=Math.max(0,Math.min(1,value));
  return t*t*(3-2*t);
};
const gesture=(phase,from,to,ramp)=>ease((phase-from)/ramp)*ease((to-phase)/ramp);

export function stairMotion(seconds) {
  const time=((seconds%13)+13)%13;
  const ascent=Math.min(.82*(stair.count+1),time-.8,12.3-time);
  const move=Math.max(0,ascent)/.82;
  const step=Math.min(stair.count,Math.floor(move));
  const progress=ease(move-step);
  const feet=[0,1].map(side=>{
    const isMoving=side===step%2;
    const index=isMoving?Math.max(0,step-1)+(Math.min(stair.count,step+1)-Math.max(0,step-1))*progress:step;
    const lift=isMoving ? Math.sin(progress*Math.PI)*.15 : 0;
    return [index*stair.run,index*stair.rise+lift];
  });
  return {feet,top:move>=stair.count+1-.00001};
}

export function workMotion(task,seconds,index) {
  const cycle=cycles[task];
  const phase=((seconds+index*3.41)%cycle+cycle)%cycle/cycle;
  return {
    reach:gesture(phase,.08,.64,.18),
    turn:gesture(phase,.35,.87,.20),
    retrieve:gesture(phase,.25,.79,.13),
    bend:task==='repair'?gesture(phase,0,.84,.24):task==='stack'?gesture(phase,0,.52,.16):gesture(phase,.13,.88,.25)*.22,
    inspect:gesture(phase,.52,.96,.13),
  };
}
