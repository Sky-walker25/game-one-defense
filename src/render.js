import { WORLD, MAPS, BIOMES, TOWERS, ENEMIES, ABILITIES, seeded, toPoint } from './data.js';
import { makePath, pointAt, segmentDistance, distance, towerStats } from './engine.js';
import { Camera } from './camera.js';
const TAU=Math.PI*2;
function circle(c,x,y,r,color,stroke,width=1){c.beginPath();c.arc(x,y,r,0,TAU);if(color){c.fillStyle=color;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function polygon(c,points,fill,stroke,width=1){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.lineWidth=width;c.strokeStyle=stroke;c.stroke();}}
function roundRect(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}}
function line(c,a,b,color,width=1){c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function hex(c,x,y,r,fill,stroke){polygon(c,Array.from({length:6},(_,i)=>[x+Math.cos(i*TAU/6+Math.PI/6)*r,y+Math.sin(i*TAU/6+Math.PI/6)*r]),fill,stroke);}
const terrainCache=new Map();

export function terrain(map,portrait=false) {
  const key=`${map.id}:${portrait}`;
  if(terrainCache.has(key))return terrainCache.get(key);
  const view=p=>portrait?{x:WORLD.h-p.y,y:p.x}:p;
  const w=portrait?WORLD.h:WORLD.w,h=portrait?WORLD.w:WORLD.h;
  const at=(x,y)=>view({x,y});
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');
  const b=BIOMES[map.biome],rng=seeded(map.seed),paths=map.paths.map(makePath),reactor=toPoint(map.reactor);
  c.fillStyle=b.base;c.fillRect(0,0,w,h);
  const clear=(x,y,margin=75)=>paths.every(p=>p.segments.every(s=>segmentDistance({x,y},s.a,s.b)>margin))&&distance({x,y},reactor)>90;
  for(let i=0;i<180;i++){const x=rng()*WORLD.w,y=rng()*WORLD.h,r=10+rng()*100;c.globalAlpha=.05+rng()*.09;const v=at(x,y);circle(c,v.x,v.y,r,rng()>.5?b.light:b.dark);}c.globalAlpha=1;
  for(let x=0;x<w;x+=WORLD.cell)for(let y=0;y<h;y+=WORLD.cell){line(c,[x,y],[x+WORLD.cell,y],'#cce6bd08');line(c,[x,y],[x,y+WORLD.cell],'#cce6bd08');}
  for(let i=0;i<2300;i++){const x=rng()*WORLD.w,y=rng()*WORLD.h;c.fillStyle=rng()>.45?'#d3ddb91a':'#0b21101c';const v=at(x,y);c.fillRect(v.x,v.y,1+rng()*3,1+rng()*2);}
  // Subtle carved terrain shelves and deposits, placed clear of the travel routes.
  for(let i=0;i<22;i++) {
    const x=rng()*WORLD.w,y=rng()*WORLD.h;if(!clear(x,y,110))continue;
    const r=20+rng()*35,v=at(x,y);c.save();c.translate(v.x,v.y);c.rotate(rng()*TAU);
    polygon(c,[[-r,-r*.3],[-r*.3,-r*.7],[r*.7,-r*.6],[r,r*.3],[r*.2,r*.65],[-r*.7,r*.45]],b.dark);
    polygon(c,[[-r,-r*.4],[-r*.3,-r*.8],[r*.7,-r*.7],[r,r*.1],[r*.2,r*.45],[-r*.7,r*.25]],b.light+'77',b.light+'99');
    line(c,[-r*.6,-r*.1],[r*.2,-r*.4],b.light,1);c.restore();
  }
  // Roads share geometry with the simulation, so visible paths are exact.
  for(const path of paths) {
    const stroke=(width,color)=>{c.beginPath();path.nodes.forEach((point,i)=>{const p=view(point);i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);});c.lineWidth=width;c.strokeStyle=color;c.lineJoin='round';c.lineCap='round';c.stroke();};
    stroke(78,'#13201b3d');stroke(64,b.edge);stroke(51,b.road);stroke(40,map.biome==='ice'?'#afc4bb35':'#d8d5ae16');
    c.setLineDash([4,12]);stroke(1,'#eff3ce55');c.setLineDash([]);
    for(let d=18;d<path.length;d+=42){const p=pointAt(path,d),v=view(p);c.save();c.translate(v.x,v.y);c.rotate(p.angle+(portrait?Math.PI/2:0));line(c,[-6,-24],[6,-24],'#e0e3bf55',2);line(c,[-6,24],[6,24],'#e0e3bf55',2);c.restore();}
  }
  // Biome-specific roadside vegetation and stones.
  const trees=[];
  for(let i=0;i<(map.biome==='forest'?145:70);i++){const x=rng()*WORLD.w,y=rng()*WORLD.h;if(clear(x,y,65))trees.push({...at(x,y),size:12+rng()*20,variant:rng()});}
  trees.sort((a,b)=>a.y-b.y);
  for(const t of trees) {
    c.save();c.translate(t.x,t.y);
    if(map.biome==='desert') {
      c.fillStyle='#26292344';c.beginPath();c.ellipse(7,8,t.size,7,0,0,TAU);c.fill();
      polygon(c,[[-t.size*.6,3],[-t.size*.35,-t.size*.45],[t.size*.25,-t.size*.65],[t.size*.65,0],[t.size*.35,t.size*.25]],'#94836a','#ad9b7766');
      polygon(c,[[-t.size*.35,-t.size*.45],[t.size*.25,-t.size*.65],[0,2],[-t.size*.6,3]],'#b29b71');
      if(t.variant>.7){line(c,[0,7],[2,17],'#c6ad7855',1);line(c,[5,8],[7,17],'#c6ad7855',1);}
    } else {
      const r=t.size;c.fillStyle='#0d241c55';c.beginPath();c.ellipse(7,9,r,9,-.3,0,TAU);c.fill();
      line(c,[0,5],[0,-r*.5],'#655f45',5);
      polygon(c,[[-r*.6,2],[0,-r*1.35],[r*.7,2],[0,8]],map.biome==='ice'?'#3c6468':'#204633');
      polygon(c,[[-r*.52,-r*.25],[0,-r*1.55],[r*.52,-r*.25],[0,1]],map.biome==='ice'?'#658889':'#315b3d');
      polygon(c,[[-r*.32,-r*.8],[0,-r*1.6],[r*.32,-r*.8],[0,-r*.55]],map.biome==='ice'?'#c1d2c2':'#52714b');
      line(c,[0,-r*1.55],[-r*.45,-r*.3],map.biome==='ice'?'#d6e2d0':'#6d865e',1.1);
    }c.restore();
  }
  // Small utility structures make the battlefield feel like a defended outpost.
  for(const pos of [[2,1],[17,10],[13,10],[1,6]]) {
    const p=toPoint(pos);if(!clear(p.x,p.y,85))continue;const v=view(p);c.save();c.translate(v.x,v.y);
    roundRect(c,-19,-9,41,27,3,'#18272255');roundRect(c,-23,-17,38,26,3,'#737c67','#b4b698');roundRect(c,-19,-13,30,18,1,'#596652');
    for(let i=0;i<4;i++)line(c,[-15+i*7,-11],[-15+i*7,3],'#8a967855',2);circle(c,9,-12,2,'#d5d19c');c.restore();
  }
  // Edge vignette, preserving the board's center contrast.
  const vignette=c.createRadialGradient(w/2,h/2,190,w/2,h/2,680);vignette.addColorStop(0,'#091c1000');vignette.addColorStop(1,'#091b195f');c.fillStyle=vignette;c.fillRect(0,0,w,h);
  c.font='10px ui-monospace, monospace';c.fillStyle='#e1e6ce55';c.textAlign='center';for(let x=1;x<(portrait?12:20);x++)c.fillText(String(x).padStart(2,'0'),x*56+28,18);
  for(let y=1;y<(portrait?20:12);y++)c.fillText(String.fromCharCode(64+y),16,y*56+31);
  // Bound decoded terrain memory even after browsing all six missions.
  if(terrainCache.size>=3)terrainCache.delete(terrainCache.keys().next().value);
  terrainCache.set(key,canvas);return canvas;
}

export function drawTower(c,t,time=0,small=false,camera=null) {
  const s=towerStats(t),col=s.color,p=camera?camera.project(t):t;c.save();c.translate(p.x,p.y);
  c.fillStyle='#09131166';c.beginPath();c.ellipse(6,14,27,16,0,0,TAU);c.fill();
  hex(c,0,5,25,'#263630','#93a28b88');hex(c,0,0,24,'#7a8872','#b0b49a');
  hex(c,0,-1,19,'#384f42','#223a31');circle(c,0,-3,14,'#213b32','#adc19b55',1);
  if(t.level>1){for(let i=0;i<t.level-1;i++){const x=(i-(t.level-2)/2)*8;roundRect(c,x-2,15,4,3,1,col);}}
  if(t.type==='support') {
    hex(c,0,-5,12,'#a6b49a','#d1dbb9');circle(c,0,-7,6,col);line(c,[0,-5],[0,-29],'#b4c5a8',3);circle(c,0,-29,4,'#d3f9a1');
    if(!small){c.globalAlpha=.2+(Math.sin(time*2)+1)*.15;circle(c,0,-29,10,null,col);c.globalAlpha=1;}
  } else if(t.type==='tesla') {
    polygon(c,[[-9,0],[-7,-24],[7,-24],[9,0]],'#a5afa1','#d2d5bb');
    for(let y=-4;y>=-23;y-=6)roundRect(c,-10,y,20,3,1,col);
    circle(c,0,-27,7,'#ede2fd',col,2);
    if(!small&&Math.sin(time*4+t.id)>0.6){line(c,[-7,-28],[-14,-34],col,1.5);line(c,[-14,-34],[-10,-40],col,1.5);}
  } else {
    c.translate(0,-5);c.rotate((t.angle||0)+(camera?.angle||0));const recoil=(t.recoil||0)*3;
    roundRect(c,-10-recoil,-10,23,20,5,'#99a88c','#d4d3b5');roundRect(c,-5,-7,12,14,3,'#4d6552');
    if(t.type==='sniper') {roundRect(c,5-recoil,-4,32,8,1,'#9ea996','#d4d9be');roundRect(c,25-recoil,-5,7,10,1,'#384e43');circle(c,-4,0,4,col);}
    else if(t.type==='flame'){roundRect(c,4-recoil,-7,21,6,2,'#b5b49a');roundRect(c,4-recoil,2,21,6,2,'#b5b49a');roundRect(c,-11,-7,8,14,3,col);}
    else if(t.type==='frost'){polygon(c,[[4,-8],[24,-5],[28,0],[24,5],[4,8]],'#9bbeb5','#d4ece0');circle(c,21,0,4,col);circle(c,-4,0,5,col);}
    else {roundRect(c,5-recoil,-5,25,10,2,'#b8b99f','#e3dec0');roundRect(c,23-recoil,-6,8,12,1,'#4c5e4c');circle(c,-5,0,3,col);}
    if(t.recoil>.55){c.globalAlpha=t.recoil-.2;polygon(c,[[30,0],[45,-6],[40,0],[45,6]],'#fff1ba');c.globalAlpha=1;}
  }
  if(t.disabled>0){circle(c,0,-5,28,'#9181bd55','#d3bbff');line(c,[-14,-18],[14,10],'#decaff',3);}
  if(t.branch!==null&&t.branch!==undefined){circle(c,17,12,5,col,'#26372e',2);c.fillStyle='#1c3024';c.font='bold 7px sans-serif';c.textAlign='center';c.fillText(t.branch?'II':'I',17,14);}
  c.restore();
}

function drawEnemy(c,e,time,camera) {
  const b=ENEMIES[e.type],r=e.size,{x,y}=camera.project(e);c.save();c.translate(x,y);
  c.globalAlpha=e.phase?.34:1;
  c.fillStyle='#0c1b1b55';c.beginPath();c.ellipse(5,e.flying?17:6,r*1.1,r*.6,0,0,TAU);c.fill();
  if(e.flying)c.translate(0,-7-Math.sin(time*5+e.id)*3);
  c.rotate(e.angle+camera.angle);const col=e.flash>0?'#fff1db':b.color;
  if(b.shape==='flyer') {
    polygon(c,[[r,0],[-r*.3,-r],[-r*.6,-r*.55],[-r*.1,0],[-r*.6,r*.55],[-r*.3,r]],'#d8ccaa','#fff0c488',1);
    polygon(c,[[r*.8,0],[-r*.7,-r*.25],[-r*.7,r*.25]],'#696b5e');circle(c,-r*.7,0,3,'#d99d79');
  } else if(['tank','brute','boss'].includes(b.shape)) {
    const w=r*1.6,h=r*1.5;roundRect(c,-w*.55,-h*.63,w,h*.35,3,'#343c36');roundRect(c,-w*.55,h*.3,w,h*.35,3,'#343c36');
    for(let i=-r*.65;i<r*.8;i+=5){line(c,[i,-h*.62],[i,-h*.35],'#929082',1);line(c,[i,h*.35],[i,h*.62],'#929082',1);}
    polygon(c,[[-r,-r*.5],[r*.4,-r*.65],[r,0],[r*.4,r*.65],[-r,r*.5]],col,'#eed2b799',1.2);
    polygon(c,[[-r*.55,-r*.4],[r*.4,-r*.4],[r*.55,0],[r*.4,r*.4],[-r*.55,r*.4]],'#6c6555');
    line(c,[0,0],[r,0],'#e8b89a',r*.22);circle(c,-r*.2,0,r*.23,b.boss?'#f2ad78':'#c9b393');
    if(b.boss){circle(c,-r*.2,0,r*.13,'#fff1b7');line(c,[-r*.7,-r*.5],[r*.5,-r*.5],'#efdabb',2);}
  } else if(b.shape==='shield') {
    hex(c,0,0,r,col,'#e5e0b9');polygon(c,[[-r*.6,-r*.5],[r*.6,0],[-r*.6,r*.5]],'#456478');circle(c,-r*.1,0,3,'#bae9e9');
  } else if(b.shape==='medic') {
    hex(c,0,0,r,col,'#e3e8c1');roundRect(c,-r*.65,-r*.65,r*.9,r*1.3,3,'#405447');line(c,[-3,0],[7,0],'#e3ffc7',3);line(c,[2,-5],[2,5],'#e3ffc7',3);
  } else if(b.shape==='ghost') {
    polygon(c,[[r,0],[0,-r*.8],[-r*.8,-r*.5],[-r*.45,0],[-r*.8,r*.5],[0,r*.8]],col,'#e2d6f4');polygon(c,[[r*.5,0],[-r*.25,-r*.3],[-r*.25,r*.3]],'#5b5578');
  } else {
    const wiggle=Math.sin(time*13+e.id)*3;
    for(const dir of [-1,1])for(let i=-1;i<=1;i++){line(c,[i*r*.4,dir*r*.3],[i*r*.6-wiggle,dir*r*.9],'#3c3d30',3);line(c,[i*r*.6-wiggle,dir*r*.9],[i*r*.7+4,dir*r*1.13],'#c4b596',2);}
    c.fillStyle=col;c.beginPath();c.ellipse(-r*.2,0,r*.83,r*.6,0,0,TAU);c.fill();circle(c,r*.58,0,r*.35,'#6b654a','#e5cbb0');
    line(c,[-r*.5,0],[r*.18,0],'#f0d3a988',1.5);
    if(b.split)for(const k of [-1,0,1])circle(c,-r*.35,k*r*.25,3,'#f2ce83');
  }
  c.restore();
  if(e.shield>0){c.save();c.globalAlpha=.3+e.shield/e.maxShield*.25;circle(c,x,y,e.size+6,null,'#9ce0e9',2);c.restore();}
  if(e.frozen>0)hex(c,x,y,e.size+5,'#c8f7f233','#bfeeed');
  if(e.burnTime>0){circle(c,x+Math.sin(time*12+e.id)*5,y-9,3+Math.sin(time*8)*2,'#f1b27a');}
  if(e.telegraph>0){c.save();c.setLineDash([6,5]);circle(c,x,y,ENEMIES[e.type].ability==='jam'?185:65,'#f1a57512','#ffc391',2);c.restore();}
  if(e.hp<e.maxHp||b.boss){const w=Math.max(22,e.size*2.2),barY=y-e.size-13;roundRect(c,x-w/2,barY,w,4,2,'#10201c');roundRect(c,x-w/2,barY,w*Math.max(0,e.hp/e.maxHp),4,2,b.boss?'#f1bc8a':'#dbe4b5');}
}

export class Renderer {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.camera=new Camera();this.map=null;this.game=null;this.buildSlots=[];this.slotsKey="";this.hover=null;this.selected=null;this.buildType=null;this.ability=null;this.motion=true;this.particles=true;this.t=0;this.fps=60;this.lastFps=0;this.frames=0;this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);}
  setGame(game){this.game=game;this.map=game.map;this.camera.reset();this.slotsKey='';this.resize();}
  resize(){
    const r=this.canvas.getBoundingClientRect();if(r.width<1||r.height<1)return;
    const portrait=window.matchMedia?.('(max-width:760px) and (orientation:portrait)').matches??r.height>r.width;
    const dpr=Math.min(window.devicePixelRatio||1,portrait?1.75:2);
    this.camera.resize(r.width,r.height,portrait);
    const w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    this.dpr=dpr;if(this.map)this.bg=terrain(this.map,portrait);
  }
  local(event){const r=this.canvas.getBoundingClientRect();return{x:event.clientX-r.left,y:event.clientY-r.top};}
  point(event){return this.camera.world(this.local(event));}
  draw(dt){if(!this.game||!this.bg)return;const c=this.ctx,g=this.game,time=this.motion?this.t+=Math.min(dt,.1):0;this.frames++;this.lastFps+=dt;if(this.lastFps>1){this.fps=this.frames/this.lastFps;this.lastFps=0;this.frames=0;}
    const camera=this.camera,view=p=>camera.project(p),w=camera.viewWidth,h=camera.viewHeight;
    c.setTransform(1,0,0,1,0,0);c.fillStyle=BIOMES[g.map.biome].dark;c.fillRect(0,0,this.canvas.width,this.canvas.height);
    const dpr=this.dpr||1;c.setTransform(camera.scale*dpr,0,0,camera.scale*dpr,camera.offsetX*dpr,camera.offsetY*dpr);c.drawImage(this.bg,0,0);
    if(this.showAir){c.save();c.setLineDash([6,9]);for(const path of g.airPaths){c.beginPath();path.nodes.forEach((point,i)=>{const p=view(point);i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);});c.strokeStyle='#c2e5df44';c.lineWidth=1.5;c.stroke();}c.restore();}
    // Pulsing invasion gates and directional ticks.
    for(const path of g.paths){const p=pointAt(path,60),v=view(p);c.save();c.translate(v.x,v.y);c.rotate(p.angle+camera.angle);roundRect(c,-13,-28,7,56,2,'#354238','#bb9f7a');for(const y of [-19,19])circle(c,-10,y,3,'#efaa80');for(let i=0;i<3;i++){const x=8+i*11+((time*12)%11);c.globalAlpha=.5-i*.12;line(c,[x-4,-6],[x,0],'#f3c597',2);line(c,[x,0],[x-4,6],'#f3c597',2);}c.restore();}
    this.drawReactor(c,g,time);
    const selected=g.towers.find(t=>t.id===this.selected);
    if(selected)this.range(c,selected,towerStats(selected).range,TOWERS[selected.type].color);
    if(this.buildType){
      const key=`${g.map.id}:${g.towers.map(t=>t.id).join(',')}`;
      if(key!==this.slotsKey){this.slotsKey=key;this.buildSlots=[];for(let row=1;row<11;row++)for(let col=1;col<19;col++){const p=toPoint([col,row]);if(g.canBuild(p))this.buildSlots.push(p);}}
      for(const point of this.buildSlots){const p=view(point);circle(c,p.x,p.y,9,'#dbeeb812','#daecaa55');line(c,[p.x-3,p.y],[p.x+3,p.y],'#deedb999');line(c,[p.x,p.y-3],[p.x,p.y+3],'#deedb999');}
    }
    if(this.ability&&this.ability!=='overdrive'&&this.hover){const a=ABILITIES[this.ability];this.range(c,this.hover,a.radius,a.color);const p=view(this.hover);line(c,[p.x-10,p.y],[p.x+10,p.y],a.color,2);line(c,[p.x,p.y-10],[p.x,p.y+10],a.color,2);}
    const objects=[...g.towers,...g.enemies].sort((a,b)=>camera.portrait?a.x-b.x:a.y-b.y);
    for(const obj of objects){if(obj.level)drawTower(c,obj,time,false,camera);else drawEnemy(c,obj,time,camera);}
    if(this.buildType&&this.hover){const p=g.snap(this.hover),valid=g.canBuild(p)&&g.gold>=TOWERS[this.buildType].cost;this.range(c,p,TOWERS[this.buildType].range,valid?'#d6f5a3':'#efa18a');c.save();c.globalAlpha=.65;drawTower(c,{...p,type:this.buildType,level:1,branch:null,angle:-Math.PI/2},time,false,camera);c.restore();}
    for(const s of g.shots){c.save();const angle=Math.atan2(s.ty-s.y,s.tx-s.x);const p=view(s);c.translate(p.x,p.y);c.rotate(angle+camera.angle);line(c,[-10,0],[2,0],s.color,3);circle(c,2,0,2,'#fff4d9');c.restore();}
    if(this.particles)for(const fx of g.effects)this.effect(c,fx,time);
    if(g.overdrive>0){c.strokeStyle='#def8ad66';c.lineWidth=5;c.strokeRect(2,2,w-4,h-4);}
    if(g.state==='paused'){c.fillStyle='#0c17194a';c.fillRect(0,0,w,h);}
  }
  range(c,point,r,color){const p=this.camera.project(point);c.save();circle(c,p.x,p.y,r,color+'0d',color+'77',1.4);c.setLineDash([4,7]);circle(c,p.x,p.y,r-4,null,color+'44');c.restore();}
  drawReactor(c,g,time){const p=this.camera.project(toPoint(g.map.reactor));c.save();c.translate(p.x,p.y);hex(c,0,7,48,'#18332d','#9fab95');hex(c,0,0,42,'#879a83','#d1d7b6');hex(c,0,-3,32,'#2c4841','#648d7e');
    for(let i=0;i<6;i++){const a=i*TAU/6;circle(c,Math.cos(a)*36,Math.sin(a)*36-2,3,'#c2e4ac');}
    polygon(c,[[-15,-3],[-15,-31],[0,-43],[15,-31],[15,-3],[0,8]],'#639f99','#b7e9d2',2);polygon(c,[[-15,-31],[0,-20],[15,-31],[0,-43]],'#c4e6cb');polygon(c,[[0,-20],[15,-31],[15,-3],[0,8]],'#7ccdc0');
    c.globalAlpha=.16+(Math.sin(time*2)+1)*.07;circle(c,0,-20,26,'#c9ffc2');c.globalAlpha=1;
    roundRect(c,-37,43,74,5,2,'#183128');roundRect(c,-37,43,74*g.lives/g.maxLives,5,2,g.lives/g.maxLives>.4?'#c8ee8b':'#eba685');c.font='bold 9px ui-monospace, monospace';c.textAlign='center';c.fillStyle='#e6edd1';c.fillText('RÉACTEUR',0,62);c.restore();}
  effect(c,source,time){const v=this.camera.project(source),target=this.camera.project({x:source.tx,y:source.ty});const fx={...source,x:v.x,y:v.y,tx:target.x,ty:target.y};const a=fx.life/fx.maxLife,p=1-a;c.save();c.globalAlpha=a;
    if(fx.type==='arc'){c.beginPath();c.moveTo(fx.x,fx.y);const dx=fx.tx-fx.x,dy=fx.ty-fx.y;for(let i=1;i<7;i++){const k=i/6,offset=i===6?0:Math.sin(fx.seed+i*9+time*30)*9;c.lineTo(fx.x+dx*k+offset,fx.y+dy*k+offset);}c.strokeStyle=fx.color;c.lineWidth=2.5;c.stroke();c.strokeStyle='#fff';c.lineWidth=.8;c.stroke();}
    else if(fx.type==='flame'){const gradient=c.createLinearGradient(fx.x,fx.y,fx.tx,fx.ty);gradient.addColorStop(0,'#fff3c3');gradient.addColorStop(1,'#ee966d22');line(c,[fx.x,fx.y],[fx.tx,fx.ty],gradient,14*a+3);circle(c,fx.tx,fx.ty,18*p,'#f5b37a');}
    else if(fx.type==='burst'){for(let i=0;i<7;i++){const angle=i*TAU/7+(fx.seed||0);circle(c,fx.x+Math.cos(angle)*p*fx.size*2,fx.y+Math.sin(angle)*p*fx.size*2,3*a,fx.color);}}
    else if(fx.type==='strike'){circle(c,fx.x,fx.y,fx.size*p,'#ffd7a31c',fx.color,4*a);circle(c,fx.x,fx.y,fx.size*.7*a,'#fff1c833');line(c,[fx.x,fx.y-350],[fx.x,fx.y],fx.color,10*a);}
    else {circle(c,fx.x,fx.y,fx.size*(.4+p*.6),fx.color+'13',fx.color,2*a);}c.restore();}
}

export function drawMini(canvas,map){const c=canvas.getContext('2d');canvas.width=336;canvas.height=202;c.drawImage(terrain(map),0,0,336,202);c.save();c.scale(336/WORLD.w,202/WORLD.h);const p=toPoint(map.reactor);circle(c,p.x,p.y,22,'#c8ee8b','#edffbc',4);for(const path of map.paths){const a=toPoint(path[0]);circle(c,Math.max(15,a.x),Math.max(15,a.y),12,'#efaa80');}c.restore();}
export function drawTowerIcon(canvas,type){canvas.width=96;canvas.height=84;const c=canvas.getContext('2d');c.scale(1.35,1.35);drawTower(c,{x:35,y:37,type,level:1,branch:null,angle:-Math.PI/4},0,true);}
