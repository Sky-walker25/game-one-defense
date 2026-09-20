import { performance } from 'node:perf_hooks';
import { Game, pointAt, towerStats, upgradeCost, distance } from '../src/engine.js';
import { MAPS, TOWERS, WORLD } from '../src/data.js';

export function placeBest(g,type) {
  const b=TOWERS[type],samples=[];
  for(const path of g.paths)for(let d=70;d<path.length-70;d+=40)samples.push({...pointAt(path,d),weight:1/g.paths.length*(.7+.7*d/path.length)});
  if(b.air)for(const path of g.airPaths)for(let d=70;d<path.length-70;d+=40)samples.push({...pointAt(path,d),weight:.5/g.airPaths.length});
  const candidates=[];
  for(let y=84;y<WORLD.h-40;y+=56)for(let x=84;x<WORLD.w-40;x+=56){const p={x,y};if(!g.canBuild(p))continue;let score=0;
    if(type==='support')score=g.towers.reduce((n,t)=>n+(t.type!=='support'&&distance(t,p)<b.range?towerStats(t).damage/towerStats(t).rate:0),0);
    else{score=samples.reduce((n,s)=>n+(distance(p,s)<b.range?s.weight:0),0);for(const t of g.towers)if(distance(t,p)<100&&t.type===type)score*=.70;if(type==='frost')for(const t of g.towers)if(distance(t,p)<160&&t.type!=='support')score+=1;}
    candidates.push({p,score});
  }
  candidates.sort((a,b)=>b.score-a.score);return candidates[0]?g.build(type,candidates[0].p):{ok:false};
}
export function autoDefend(g,strategy='combined') {
  const orders={combined:['cannon','sniper','tesla','frost','flame','support','sniper','tesla','cannon','sniper'],precision:['sniper','cannon','sniper','frost','support','sniper','tesla','sniper'],artillery:['cannon','cannon','frost','tesla','support','cannon','flame','cannon']};
  const order=orders[strategy];let limit=0;
  while(limit++<50){
    const desired=Math.min(22,3+Math.floor(g.wave*.7));
    if(g.towers.length<desired){const type=order[g.towers.length%order.length];if(g.gold<TOWERS[type].cost)break;if(!placeBest(g,type).ok)break;continue;}
    const choices=g.towers.filter(t=>t.level<4).sort((a,b)=>a.level-b.level||(b.damage+b.kills*30)-(a.damage+a.kills*30));
    const t=choices.find(t=>upgradeCost(t)<=g.gold);if(!t)break;g.upgrade(t.id,t.level===3?(t.type==='cannon'?0:t.type==='frost'?1:t.type==='sniper'?0:0):null);
  }
}
export function simulate(mapId,difficulty='veteran',strategy='combined',{powers=true,endless=false,endWave=null}={}) {
  const g=new Game({mapId,difficulty,endless});let steps=0,peak=0,leaks=[];
  while(!['won','lost'].includes(g.state)&&steps<300000){
    if(g.state==='prep'){if(endWave&&g.wave>=endWave)break;autoDefend(g,strategy);g.startWave();}
    if(powers&&g.enemies.length){const advanced=g.enemies.reduce((a,b)=>a.d/a.pathLength>b.d/b.pathLength?a:b);if(advanced.d/advanced.pathLength>.6){if(!g.cooldowns.strike)g.ability('strike',advanced);if(!g.cooldowns.freeze)g.ability('freeze',advanced);}if(!g.cooldowns.overdrive&&(g.enemies.length>12||g.enemies.some(e=>e.type.startsWith('boss'))))g.ability('overdrive');}
    const life=g.lives;g.update(1/30);if(g.lives<life)leaks.push(g.wave);peak=Math.max(peak,g.enemies.length);steps++;
  }
  return {map:MAPS[mapId].name,difficulty,strategy,state:g.state,wave:g.wave,lives:g.lives,kills:g.kills,towers:g.towers.length,gold:g.gold,seconds:Math.round(g.elapsed),peak,leaks:[...new Set(leaks)],g};
}
if(process.argv[1]===new URL(import.meta.url).pathname){const start=performance.now();const results=[];for(const difficulty of ['recruit','veteran','elite'])for(const map of MAPS){const {g,...result}=simulate(map.id,difficulty);results.push(result);}for(const strategy of ['precision','artillery']){const {g,...result}=simulate(1,'veteran',strategy);results.push(result);}console.table(results.map(({leaks,...r})=>({...r,leaks:leaks.join(',')})));console.log(`Simulation time: ${((performance.now()-start)/1000).toFixed(2)} s`);}
