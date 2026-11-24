import { projectMapPoint as project } from './spatial.mjs';

export const mapLayers=['russia.geojson','regions.geojson','cartography.json','coverage.json'];

export function boundsFor(positions,padding=10) {
  let left=Infinity, top=Infinity, right=-Infinity, bottom=-Infinity;
  for(const [x,y] of positions) {
    left=Math.min(left,x);
    top=Math.min(top,y);
    right=Math.max(right,x);
    bottom=Math.max(bottom,y);
  }
  return {x:left-padding,y:top-padding,w:right-left+2*padding,h:bottom-top+2*padding};
}

function svgPath(points,closed,precision=3) {
  return points.length?'M'+points.map(([x,y])=>`${x.toFixed(precision)},${y.toFixed(precision)}`).join('L')+(closed?'Z':''):'';
}

export function mapLine(points,closed=false) {
  return svgPath(points.map(point=>project(...point)),closed);
}

function geography({type,coordinates}) {
  if(type==='Polygon') return coordinates.map(ring=>mapLine(ring,true)).join('');
  if(type==='MultiPolygon') return coordinates.flatMap(poly=>poly.map(ring=>mapLine(ring,true))).join('');
  if(type==='MultiLineString') return coordinates.map(shape=>mapLine(shape)).join('');
  return type==='LineString'?mapLine(coordinates):'';
}

export function transitPath(linePoints) {
  const points=linePoints.map(point=>project(...point));
  return {box:boundsFor(points,0),d:svgPath(points,false,5)};
}

export function prepareMapLayer(name,db) {
  if(name==='russia.geojson') {
    const {geometry}=db;
    return {path:geography(geometry),bounds:boundsFor(geometry.coordinates.flat(2).map(point=>project(...point)),45)};
  }
  if(name==='regions.geojson') return {path:db.features.map(feature=>geography(feature.geometry)).join('')};
  if(name==='coverage.json') {
    const prepare=areas=>Object.fromEntries(Object.entries(areas).map(([id,{ring,...area}])=>[id,{...area,path:mapLine(ring,true)}]));
    return {sites:prepare(db.sites),districts:prepare(db.districts)};
  }
  const major=[], local=[];
  for(const [level,,shape] of db.roads) {
    if(level===1) major.push(transitPath(shape));
    if(level===2) local.push(transitPath(shape));
  }
  return {major,local,rail:db.rail.map(transitPath),places:db.places,airports:db.airports};
}

export async function loadMapLayer(name) {
  const response=await fetch(new URL('./assets/'+name,import.meta.url));
  if(!response.ok) throw Error(name);
  return prepareMapLayer(name,await response.json());
}
