const commandByCode = {
  KeyW:'forward', KeyA:'left', KeyS:'back', KeyD:'right',
  KeyQ:'turn-left', ArrowLeft:'turn-left', KeyE:'turn-right', ArrowRight:'turn-right',
  ArrowUp:'tilt-up', ArrowDown:'tilt-down',
};

export function cameraCommand(code,key) {
  return commandByCode[code] ?? commandByCode[key?.length===1?'Key'+key.toUpperCase():key];
}

export function travelVector(yaw,right,forward) {
  const magnitude=Math.max(1,Math.hypot(right,forward));
  const x=(right*Math.cos(yaw)-forward*Math.sin(yaw))/magnitude;
  const z=(-right*Math.sin(yaw)-forward*Math.cos(yaw))/magnitude;
  return [x||0,z||0];
}

export function cameraBasis(yaw,pitch) {
  const sx=Math.sin(yaw),cz=Math.cos(yaw),rise=Math.sin(pitch),run=Math.cos(pitch);
  return {direction:[sx*run,rise,cz*run],up:[-sx*rise,run,-cz*rise]};
}

export function planFrameHalf(width,depth,aspect) {
  // The footprint's diagonal fits at every angle without changing the zoom.
  return .56*Math.hypot(width,depth)/Math.min(1,aspect);
}

export function approach(current,target,delta,response=16) {
  return target+(current-target)*Math.exp(-response*delta);
}

export function shortArc(current,target) {
  const radians=target-current;
  return Math.atan2(Math.sin(radians),Math.cos(radians));
}

export function navigationAxes(active) {
  return {
    right:Number(active.has('right'))-Number(active.has('left')),
    forward:Number(active.has('forward'))-Number(active.has('back')),
    turn:Number(active.has('turn-left'))-Number(active.has('turn-right')),
    tilt:Number(active.has('tilt-up'))-Number(active.has('tilt-down')),
  };
}

export function bindCameraKeys(scope,{signal,enabled,tap,wake}) {
  const keys=new Map();
  const active=()=>new Set(keys.values());
  const clear=()=>keys.clear();
  scope.addEventListener('keydown',event=>{
    if(!enabled() || event.altKey || event.ctrlKey || event.metaKey
      || event.target.closest('input,select,textarea,[contenteditable]')) return;
    const command=cameraCommand(event.code,event.key);
    if(!command) return;
    event.preventDefault();
    const key=event.code||event.key;
    if(keys.has(key)) return;
    const alreadyHeld=active().has(command);
    keys.set(key,command);
    if(!alreadyHeld) tap(navigationAxes(new Set([command])));
    wake();
  },{signal});
  window.addEventListener('keyup',event=>keys.delete(event.code||event.key),{signal});
  window.addEventListener('blur',clear,{signal});
  scope.addEventListener('focusout',event=>{
    if(!scope.contains(event.relatedTarget)) clear();
  },{signal});
  return {active,clear};
}
