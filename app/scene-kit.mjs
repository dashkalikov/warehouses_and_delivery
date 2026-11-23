import * as T from './vendor/three.mjs';

const unitBox = new T.BoxGeometry(1, 1, 1);
const matrix = new T.Matrix4();
const position = new T.Vector3();
const scale = new T.Vector3();
const rotation = new T.Quaternion();
const horizontal = new T.Vector3(1,0,0);
const euler = new T.Euler();

function surfaceGrain(surface) {
  const size=96;
  const data=new Uint8Array(size*size*4);
  const strength=surface==='asphalt'?52:25;
  let seed=12583;
  for(let i=0;i<data.length;i+=4) {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const value=248-strength+(seed>>>24)*strength/255;
    data[i]=data[i+1]=data[i+2]=value;
    data[i+3]=255;
  }
  const texture=new T.DataTexture(data,size,size);
  texture.colorSpace=T.SRGBColorSpace;
  texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.repeat.setScalar(surface==='asphalt'?12:8);
  texture.magFilter=T.LinearFilter;
  texture.minFilter=T.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.needsUpdate=true;
  return texture;
}

export function studioEnvironment() {
  const canvas=document.createElement('canvas');
  canvas.width=256; canvas.height=128;
  const ctx=canvas.getContext('2d');
  const sky=ctx.createLinearGradient(0,0,0,128);
  sky.addColorStop(0,'#e9f3ff');
  sky.addColorStop(.48,'#7990aa');
  sky.addColorStop(.53,'#92a1b0');
  sky.addColorStop(1,'#344656');
  ctx.fillStyle=sky;
  ctx.fillRect(0,0,256,128);
  for(const [x,y,r,color] of [[51,28,44,'#fff1d7'],[177,33,40,'#f1f7ff']]) {
    const glow=ctx.createRadialGradient(x,y,4,x,y,r);
    glow.addColorStop(0,color);
    glow.addColorStop(1,'#ffffff00');
    ctx.fillStyle=glow;
    ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  const texture=new T.CanvasTexture(canvas);
  texture.colorSpace=T.SRGBColorSpace;
  texture.mapping=T.EquirectangularReflectionMapping;
  return texture;
}

export class SceneParts {
  constructor() {
    this.group = new T.Group();
    this.materials = new Map();
    this.batches = new Map();
  }

  material(color, surface = 'matte') {
    const key = color + surface;
    if (!this.materials.has(key)) {
      const finish = {
        matte: [.84, .02], paint: [.38, .11], steel: [.37, .62],
        glass: [.21, .24], 'cab-glass':[.17,.02], rubber: [.93, 0], light: [.34, .12],
        asphalt:[.95,.01], concrete:[.82,0], aluminum:[.26,.72],
      }[surface];
      const textured=surface==='asphalt'||surface==='concrete';
      const cabGlass=surface==='cab-glass';
      const physical=surface==='paint'||surface==='glass'||cabGlass;
      const Material=physical?T.MeshPhysicalMaterial:T.MeshStandardMaterial;
      this.materials.set(key, new Material({
        color, roughness:finish[0], metalness:finish[1],
        ...(physical?{clearcoat:surface==='glass'?.76:.41,clearcoatRoughness:surface==='glass'?.12:.29}:{}),
        ...(cabGlass?{transparent:true,opacity:.27,depthWrite:false,side:T.DoubleSide}:{}),
        ...(textured?{map:surfaceGrain(surface)}:{}),
        ...(surface === 'light' ? {emissive:color,emissiveIntensity:.2} : {}),
      }));
    }
    return this.materials.get(key);
  }

  box(x,y,z,w,h,d,color,surface='matte',tilt=0) {
    const material = this.material(color,surface);
    if (!this.batches.has(material)) this.batches.set(material,[]);
    this.batches.get(material).push([x+w/2,y+h/2,z+d/2,w,h,d,tilt]);
  }

  object(geometry,x,y,z,color,surface='matte',angles=[]) {
    const mesh = new T.Mesh(geometry,this.material(color,surface));
    mesh.position.set(x,y,z);
    mesh.rotation.set(...[0,1,2].map(i=>angles[i]??0));
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    this.group.add(mesh);
    return mesh;
  }

  cylinder(x,y,z,r,height,color,surface='matte',axis='z',segments=28) {
    const angles=axis==='z'?[Math.PI/2]:axis==='x'?[0,0,Math.PI/2]:[];
    return this.object(new T.CylinderGeometry(r,r,height,segments),x,y,z,color,surface,angles);
  }

  // Bevels catch light on sheet-metal edges and break the silhouette of the box.
  profile(points,x,y,z,depth,color,surface='paint',bevel=.045,openings=[]) {
    const path = new T.Shape();
    points.forEach(([px,py],i)=>i ? path.lineTo(px,py) : path.moveTo(px,py));
    path.closePath();
    for(const opening of openings) {
      const hole=new T.Path();
      opening.forEach(([px,py],i)=>i?hole.lineTo(px,py):hole.moveTo(px,py));
      hole.closePath();
      path.holes.push(hole);
    }
    const geometry = new T.ExtrudeGeometry(path,{
      steps:1,depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,curveSegments:3,
    });
    return this.object(geometry,x,y,z,color,surface);
  }

  label(text,x,y,z,w,h,{ angle=-Math.PI/2, heading=0, font=58, color='#ffffff', background=null }={}) {
    const canvas=document.createElement('canvas');
    canvas.width=512; canvas.height=128;
    const ctx=canvas.getContext('2d');
    if (background) { ctx.fillStyle=background; ctx.fillRect(0,0,512,128); }
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font=`700 ${font}px Segoe UI, sans-serif`;
    ctx.fillStyle=color;
    ctx.fillText(text,256,65,480);
    const texture=new T.CanvasTexture(canvas);
    texture.colorSpace=T.SRGBColorSpace;
    const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({
      map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,side:T.DoubleSide,
    }));
    mesh.rotation.set(angle,heading,0);
    mesh.position.set(x,y,z);
    this.group.add(mesh);
    return mesh;
  }

  finish() {
    for (const [material, boxes] of this.batches) {
      const mesh=new T.InstancedMesh(unitBox,material,boxes.length);
      boxes.forEach(([x,y,z,w,h,d,tilt],i)=>{
        position.set(x,y,z); scale.set(w,h,d);
        if(Array.isArray(tilt)) rotation.setFromEuler(euler.set(...tilt));
        else rotation.setFromAxisAngle(horizontal,tilt);
        matrix.compose(position,rotation,scale); mesh.setMatrixAt(i,matrix);
      });
      mesh.castShadow=true;
      mesh.receiveShadow=true;
      this.group.add(mesh);
    }
    this.batches.clear();
    return this.group;
  }
}

export function disposeScene(scene) {
  const resources=new Set();
  scene.traverse(object=>{
    if(object.isInstancedMesh) object.dispose();
    if(object.geometry && object.geometry!==unitBox) resources.add(object.geometry);
    for (const material of [object.material].flat().filter(Boolean)) {
      if(material.map) resources.add(material.map);
      resources.add(material);
    }
  });
  for (const item of resources) item.dispose();
}
