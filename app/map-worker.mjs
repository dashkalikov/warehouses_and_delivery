import { loadMapLayer, mapLayers } from './map-geometry.mjs';

for(const name of mapLayers) {
  loadMapLayer(name).then(data=>self.postMessage({name,data}),()=>self.postMessage({name}));
}
