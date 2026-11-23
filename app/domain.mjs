const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const reversedShapes=new WeakMap();

function reverseShape(shape) {
  if(!shape) return undefined;
  if(!reversedShapes.has(shape)) reversedShapes.set(shape,shape.toReversed());
  return reversedShapes.get(shape);
}

export function predictMaintenance({ temperature, vibration, wear }) {
  const risk = Math.round(clamp(
    Math.max(0, temperature - 55) * 0.95 + Math.max(0, vibration - 1) * 5.1 + wear * 0.37,
    0, 99,
  ));
  return {
    risk,
    level: risk >= 75 ? 'critical' : risk >= 45 ? 'watch' : 'normal',
    rul: Math.max(4, Math.round((100 - risk) * 3.8)),
  };
}

export function planRoutes(edges, start, end, vehicle, load, criterion = 'balanced', options = {}) {
  if (!vehicle || !start || !end || start === end || !Number.isFinite(load) || load <= 0
    || load > vehicle.capacity || (vehicle.status !== 'reserve' && !options.allowActive)
    || vehicle.status === 'service' || (options.cold && !vehicle.refrigerated)) return [];
  const graph = new Map();
  const closed = new Set(options.closed);
  for (const edge of edges) {
    if (edge.limit < load || closed.has(edge.a + ':' + edge.b) || closed.has(edge.b + ':' + edge.a)) continue;
    const hours = edge.km / edge.speed + edge.delay * (options.traffic ?? 1);
    const fuel = edge.km * vehicle.consumption / 100 * (0.87 + 0.23 * load / vehicle.capacity);
    const cost = fuel * 74 + edge.toll;
    const risk = hours * (100 - vehicle.condition) / 100 + (edge.risk ?? 0);
    const score = criterion === 'distance' ? edge.km : criterion === 'fast' ? hours : criterion === 'cost' ? cost
      : criterion === 'safe' ? risk + hours * 0.025 : hours + cost / 4300 + risk * 1.35;
    for (const [from, to] of [[edge.a, edge.b], [edge.b, edge.a]]) {
      if (!graph.has(from)) graph.set(from, []);
      const shape=from===edge.a?edge.shape:reverseShape(edge.shape);
      graph.get(from).push({ from, to, hours, fuel, cost, risk, score, km: edge.km, name: edge.name, shape });
    }
  }
  const reachable=new Set([start]);
  for(const node of reachable) {
    if(reachable.has(end)) break;
    for(const leg of graph.get(node)??[]) reachable.add(leg.to);
  }
  if(!reachable.has(end)) return [];
  const maxRoutes=options.maxRoutes??3;
  const settled=maxRoutes===1?new Set():null;
  const queue = [{ nodes: [start], legs: [], hours: 0, km: 0, fuel: 0, cost: 0, risk: 0, score: 0 }];
  const results = [];
  while (queue.length && results.length < maxRoutes) {
    queue.sort((a, b) => b.score - a.score);
    const route = queue.pop();
    const node = route.nodes.at(-1);
    if(settled?.has(node)) continue;
    settled?.add(node);
    if (node === end) {
      results.push(route);
      continue;
    }
    for (const leg of graph.get(node) ?? []) {
      if (route.nodes.includes(leg.to)) continue;
      const next = { nodes: [...route.nodes, leg.to], legs: [...route.legs, leg] };
      for (const key of ['hours', 'km', 'fuel', 'cost', 'risk', 'score']) next[key] = route[key] + leg[key];
      queue.push(next);
    }
  }
  return results;
}

export function tripPosition(route, elapsed) {
  const time = clamp(elapsed, 0, route.hours);
  let left = time;
  for (const [index, leg] of route.legs.entries()) {
    if (left <= leg.hours || index===route.legs.length-1) {
      return { from:route.nodes[index], to:route.nodes[index+1], fraction:clamp(left/leg.hours,0,1), progress:time/route.hours };
    }
    left -= leg.hours;
  }
}

const radians=Math.PI/180;
const measures=new WeakMap();

export function roadKilometres([lon,lat],[nextLon,nextLat]) {
  const dx=(nextLon-lon)*Math.cos((lat+nextLat)*radians/2);
  return 111.195*Math.hypot(dx,nextLat-lat);
}

function roadSample(shape, fraction) {
  if(fraction<=0) return {point:shape[0],next:1};
  if(fraction>=1) return {point:shape.at(-1),next:shape.length-1};
  if(!measures.has(shape)) {
    let km=0;
    measures.set(shape,shape.map((p,i)=>i?(km+=roadKilometres(shape[i-1],p)):0));
  }
  const distances=measures.get(shape);
  const distance=fraction*distances.at(-1);
  let lo=0,hi=distances.length-1;
  while(hi-lo>1) {
    const middle=(hi+lo)>>1;
    if(distances[middle]<distance) lo=middle;
    else hi=middle;
  }
  const length=distances[hi]-distances[lo];
  const ratio=length?(distance-distances[lo])/length:0;
  const [x,y]=shape[lo], [nextX,nextY]=shape[hi];
  return {point:[x+(nextX-x)*ratio,y+(nextY-y)*ratio],next:hi};
}

export const roadPosition=(shape,fraction)=>roadSample(shape,fraction).point;

export function tripDistance(route, elapsed, draw=true) {
  let hours=clamp(elapsed,0,route.hours);
  let driven=0;
  const past=[], ahead=[];
  for(const leg of route.legs) {
    const fraction=clamp(hours/leg.hours,0,1);
    driven+=leg.km*fraction;
    hours-=leg.hours;
    if(!draw) continue;
    if(fraction===1) past.push(leg.shape);
    else if(fraction===0) ahead.push(leg.shape);
    else {
      const {point,next}=roadSample(leg.shape,fraction);
      past.push([...leg.shape.slice(0,next),point]);
      ahead.push([point,...leg.shape.slice(next)]);
    }
  }
  return {driven,remaining:Math.max(0,route.km-driven),past,ahead};
}

export function telemetry(asset, clock) {
  const seed = [...asset.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const phase = clock / 60 * 1.8 + seed;
  const wave = Math.sin(phase) + Math.cos(phase * 0.47) * 0.55;
  const [temp, vib, wear] = asset.sensor;
  return {
    temperature: Math.round((temp + wave * 2.1) * 10) / 10,
    vibration: Math.round((vib + wave * 0.17) * 10) / 10,
    wear: clamp(wear + clock / 60000,0,100),
  };
}
