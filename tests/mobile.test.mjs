import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera, BoardGesture } from '../src/camera.js';
import { WORLD, MAPS, toPoint, TOWERS } from '../src/data.js';
import { Game, towerStats } from '../src/engine.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≠ ${b}`);

test('portrait projection puts every reactor below the main entrance and preserves positions',()=>{
  const c=new Camera();c.resize(390,580,true);
  for(const m of MAPS){const core=c.screen(toPoint(m.reactor)),entry=c.screen(toPoint(m.paths[0][0]));assert.ok(core.y>entry.y);}
  for(const portrait of [true,false])for(const size of [[390,580],[320,355],[1280,768]]){
    c.resize(...size,portrait);c.zoomAt(1.9);c.pan(80,-60);
    for(const p of [{x:0,y:0},{x:WORLD.w,y:WORLD.h},{x:364,y:308}]){const q=c.world(c.screen(p));close(p.x,q.x);close(p.y,q.y);}
  }
});
test('zoom is anchored under the finger, bounded, and reset on orientation change',()=>{
  const c=new Camera();c.resize(390,650,true);c.zoomAt(1.8);
  const anchor={x:160,y:290},p=c.world(anchor);c.zoomAt(2.1,anchor);const q=c.world(anchor);close(p.x,q.x);close(p.y,q.y);
  c.pan(9999,-9999);assert.ok(c.offsetX<=0);assert.ok(c.offsetY<=0);assert.ok(c.offsetX+c.viewWidth*c.scale>=c.width-1);
  c.zoomAt(99);assert.equal(c.zoom,2.5);c.resize(1000,600,false);assert.equal(c.zoom,1);c.zoomAt(-5);assert.equal(c.zoom,1);
});
test('a tap previews a position without spending; drag, pinch and cancellation never tap',()=>{
  const c=new Camera();c.resize(390,650,true);const g=new Game();let pending=null,taps=0;
  const input=new BoardGesture(c,p=>{pending=g.snap(p);taps++;});
  const p=c.screen(toPoint([2,5]));input.down(1,p);input.up(1,p);assert.equal(taps,1);assert.equal(g.gold,g.map.gold);assert.equal(g.towers.length,0);
  assert.ok(g.build('cannon',pending).ok);assert.equal(g.gold,g.map.gold-TOWERS.cannon.cost);
  input.down(1,p);input.move(1,{x:p.x+30,y:p.y});input.up(1,p);assert.equal(taps,1);
  input.down(1,p);input.down(2,{x:p.x+80,y:p.y});input.move(2,{x:p.x+110,y:p.y});input.up(2,p);input.up(1,p);assert.equal(taps,1);
  input.down(1,p);input.up(1,p,true);assert.equal(taps,1);
  input.down(1,p);input.cancel();input.up(1,p);assert.equal(taps,1);
});
test('an existing checkpoint retains build positions across portrait and landscape',()=>{
  const g=new Game();const t=g.build('cannon',toPoint([2,5])).tower;
  const saved=g.checkpoint(),restored=Game.restore(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(restored.towers.map(t=>[t.x,t.y,t.type]),[[t.x,t.y,t.type]]);
  const c=new Camera();c.resize(360,500,true);const p=c.world(c.screen(restored.towers[0]));close(p.x,t.x);close(p.y,t.y);
});
test('cached tower statistics invalidate on upgrades and specialization',()=>{
  const t={type:'sniper',level:1,branch:null},base=towerStats(t);assert.equal(towerStats(t),base);
  t.level=2;const upgraded=towerStats(t);assert.ok(upgraded.damage>base.damage);
  t.level=4;t.branch=1;assert.equal(towerStats(t).reveal,true);t.branch=0;assert.equal(towerStats(t).execute,.15);
});
test('single-pass targeting matches original stable ordering for all priorities',()=>{
  const g=new Game();const t={type:'sniper',level:1,branch:null,x:250,y:250};
  for(let i=0;i<40;i++){const e=g.spawn(i%7===0?'medic':'crawler');Object.assign(e,{x:250+(i%5)*10,y:250+(i%3)*10,d:(i%6)*100,hp:40+(i%4)*30,shield:(i%2)*50,pathLength:1000+(i%3)*200});}
  const orders={first:(a,b)=>b.d/b.pathLength-a.d/a.pathLength,last:(a,b)=>a.d/a.pathLength-b.d/b.pathLength,strong:(a,b)=>b.hp+b.shield-a.hp-a.shield,weak:(a,b)=>a.hp+a.shield-b.hp-b.shield,support:(a,b)=>Number(b.type==='medic')-Number(a.type==='medic')||b.d/b.pathLength-a.d/a.pathLength};
  for(const [priority,order] of Object.entries(orders)){t.priority=priority;assert.equal(g.target(t,towerStats(t)).id,[...g.enemies].sort(order)[0].id);}
});
