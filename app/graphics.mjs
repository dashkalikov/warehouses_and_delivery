export const graphicsOptions={auto:'Авто',economy:'Экономия',high:'Высокое качество'};

export const graphicsProfiles={
  economy:{pixelScale:.82,maxPixelRatio:1,antialias:false,shadowSize:512,shadowInterval:210,animationFps:24,interactionFps:30},
  balanced:{pixelScale:1,maxPixelRatio:1.35,antialias:true,shadowSize:1024,shadowInterval:125,animationFps:30,interactionFps:60},
  high:{pixelScale:1,maxPixelRatio:1.75,antialias:true,shadowSize:2048,shadowInterval:72,animationFps:60,interactionFps:60},
};

export function chooseGraphics(mode,{hardwareConcurrency,deviceMemory}={}) {
  if(mode==='high') return graphicsProfiles.high;
  if(mode==='economy'||hardwareConcurrency<=4||deviceMemory<=4) return graphicsProfiles.economy;
  return graphicsProfiles.balanced;
}
