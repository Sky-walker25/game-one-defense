import { WORLD } from './data.js';

// Simulation coordinates never change: existing saves survive screen rotation.
export class Camera {
  constructor(){this.width=1;this.height=1;this.portrait=false;this.zoom=1;this.panX=0;this.panY=0;}
  resize(width,height,portrait=this.portrait){
    const changed=this.portrait!==portrait;
    this.width=Math.max(1,width);this.height=Math.max(1,height);this.portrait=portrait;
    this.viewWidth=portrait?WORLD.h:WORLD.w;this.viewHeight=portrait?WORLD.w:WORLD.h;
    this.fit=Math.min(this.width/this.viewWidth,this.height/this.viewHeight);
    if(changed)this.reset();else this.clamp();
  }
  project(p){return this.portrait?{x:WORLD.h-p.y,y:p.x}:p;}
  unproject(p){return this.portrait?{x:p.y,y:WORLD.h-p.x}:p;}
  get angle(){return this.portrait?Math.PI/2:0;}
  get scale(){return this.fit*this.zoom;}
  get offsetX(){return(this.width-this.viewWidth*this.scale)/2+this.panX;}
  get offsetY(){return(this.height-this.viewHeight*this.scale)/2+this.panY;}
  screen(p){const v=this.project(p);return{x:v.x*this.scale+this.offsetX,y:v.y*this.scale+this.offsetY};}
  world(p){return this.unproject({x:(p.x-this.offsetX)/this.scale,y:(p.y-this.offsetY)/this.scale});}
  contains(p){return p.x>=0&&p.x<=WORLD.w&&p.y>=0&&p.y<=WORLD.h;}
  clamp(){
    const mx=Math.max(0,(this.viewWidth*this.scale-this.width)/2),my=Math.max(0,(this.viewHeight*this.scale-this.height)/2);
    this.panX=Math.max(-mx,Math.min(mx,this.panX));this.panY=Math.max(-my,Math.min(my,this.panY));
  }
  reset(){this.zoom=1;this.panX=this.panY=0;}
  pan(dx,dy){this.panX+=dx;this.panY+=dy;this.clamp();}
  zoomAt(zoom,anchor={x:this.width/2,y:this.height/2}){
    const p=this.world(anchor);this.zoom=Math.max(1,Math.min(2.5,zoom));
    const after=this.screen(p);this.panX+=anchor.x-after.x;this.panY+=anchor.y-after.y;this.clamp();
  }
}

// Gesture state is independent of the DOM so drags and cancelled touches can be tested.
export class BoardGesture {
  constructor(camera,onTap){this.camera=camera;this.onTap=onTap;this.points=new Map();this.blocked=false;this.start=null;}
  down(id,p){this.points.set(id,p);if(this.points.size===1){this.start=p;this.blocked=false;}else this.blocked=true;}
  move(id,p){
    if(!this.points.has(id))return;
    const old=this.points.get(id);
    if(this.points.size===2){
      const other=[...this.points.entries()].find(([key])=>key!==id)[1];
      const before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(p.x-other.x,p.y-other.y);
      if(before>8)this.camera.zoomAt(this.camera.zoom*after/before,{x:(old.x+other.x)/2,y:(old.y+other.y)/2});
      this.camera.pan((p.x-old.x)/2,(p.y-old.y)/2);
    }else if(this.points.size===1){
      if(Math.hypot(p.x-this.start.x,p.y-this.start.y)>8)this.blocked=true;
      if(this.blocked)this.camera.pan(p.x-old.x,p.y-old.y);
    }
    this.points.set(id,p);
  }
  up(id,p,cancel=false){
    if(!this.points.has(id))return;
    const tap=!cancel&&!this.blocked&&this.points.size===1&&Math.hypot(p.x-this.start.x,p.y-this.start.y)<=8;
    this.points.delete(id);
    if(tap)this.onTap(this.camera.world(p));
    if(cancel)this.blocked=true;
  }
  cancel(){this.points.clear();this.blocked=true;}
}
