import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, makePath, pointAt, towerStats, upgradeCost, distance } from '../src/engine.js';
import { MAPS, TOWERS, ENEMIES, ABILITIES, wavePlan, WORLD, toPoint } from '../src/data.js';
import { readProfile, writeProfile, readSave, writeSave, recordResult } from '../src/storage.js';
const emptySlot=g=>{for(let y=84;y<WORLD.h-40;y+=56)for(let x=84;x<WORLD.w-40;x+=56)if(g.canBuild({x,y}))return{x,y};throw Error('No build slot');};
const tick=(g,seconds)=>{for(let n=0;n<Math.round(seconds*60);n++)g.update(1/60);};

test('Le contenu couvre les six missions, dix archétypes, trois boss et douze spécialisations',()=>{
  assert.equal(MAPS.length,6);assert.equal(Object.values(ENEMIES).filter(e=>!e.boss).length,10);assert.equal(Object.values(ENEMIES).filter(e=>e.boss).length,3);
  assert.equal(Object.keys(TOWERS).length,6);assert.equal(Object.values(TOWERS).flatMap(t=>t.branches).length,12);
  for(const m of MAPS){assert.ok(m.waves>=15&&m.waves<=25);for(let w=1;w<=m.waves;w++){const plan=wavePlan(m.id,w);assert.ok(plan.length);assert.ok(plan.every(e=>ENEMIES[e.type]&&e.gap>0));}if(m.boss)assert.ok(wavePlan(m.id,m.waves).some(e=>e.type===m.boss));}
});
test('Les routes rejoignent le réacteur et offrent des emplacements constructibles',()=>{
  for(const m of MAPS){const g=new Game({mapId:m.id});assert.ok(emptySlot(g));for(const p of [...g.paths,...g.airPaths]){assert.ok(distance(pointAt(p,p.length),toPoint(m.reactor))<60);for(const n of p.nodes)assert.ok(Number.isFinite(n.x)&&Number.isFinite(n.y));}}
});
test('La construction protège les routes, les ressources et les emplacements occupés',()=>{
  const g=new Game(),before=g.gold;assert.equal(g.build('cannon',toPoint([4,3])).ok,false);assert.equal(g.gold,before);
  const p=emptySlot(g),result=g.build('cannon',p);assert.equal(result.ok,true);assert.equal(g.gold,before-TOWERS.cannon.cost);
  assert.equal(g.build('cannon',p).ok,false);assert.equal(g.build('unknown',p).ok,false);g.gold=0;assert.equal(g.build('cannon',emptySlot(g)).ok,false);assert.equal(g.gold,0);
});
test('Les améliorations et la revente respectent le coût et le choix de spécialisation',()=>{
  const g=new Game();g.gold=2000;const t=g.build('cannon',emptySlot(g)).tower;const total=t.spent+upgradeCost(t);assert.ok(g.upgrade(t.id));assert.equal(t.spent,total);assert.ok(g.upgrade(t.id));
  const before=g.gold;assert.equal(g.upgrade(t.id),false);assert.equal(g.gold,before);assert.ok(g.upgrade(t.id,1));assert.equal(t.level,4);assert.ok(towerStats(t).rate<TOWERS.cannon.rate/2);assert.equal(g.upgrade(t.id,0),false);
  const refund=Math.floor(t.spent*.7),gold=g.gold;assert.ok(g.sell(t.id));assert.equal(g.gold,gold+refund);assert.equal(g.towers.length,0);assert.equal(g.sell(t.id),false);
});
test('Le blindage réduit les obus et la précision le traverse',()=>{
  const g=new Game(),e=g.spawn('tank');let hp=e.hp;g.damage(e,40,'kinetic');assert.equal(hp-e.hp,20);hp=e.hp;g.damage(e,40,'pierce');assert.equal(hp-e.hp,40);
});
test('Les boucliers absorbent l’énergie au double sans multiplier les dégâts de débordement',()=>{
  const g=new Game(),e=g.spawn('shield');const hp=e.hp;e.shield=50;g.damage(e,40,'energy');assert.equal(e.shield,0);assert.equal(e.hp,hp-15);
});
test('Une cible morte ne distribue pas deux fois sa prime',()=>{
  const g=new Game(),e=g.spawn('crawler'),gold=g.gold;g.damage(e,1000);g.damage(e,1000);g.kill(e);assert.equal(g.gold,gold+e.bounty);assert.equal(g.kills,1);
});
test('Une colonie crée exactement trois larves sur son propre trajet',()=>{
  const g=new Game({mapId:3}),e=g.spawn('splitter',{pathIndex:1,d:220});g.damage(e,10000);const children=g.enemies.filter(x=>x.type==='larva');assert.equal(children.length,3);assert.ok(children.every(x=>x.pathIndex===1&&x.d<=220));
});
test('Les armes terrestres ignorent les volants, les spécialisations autorisées les ciblent',()=>{
  const g=new Game();const t={id:100,type:'flame',x:100,y:100,level:1,branch:null,priority:'first'};const e=g.spawn('flyer');Object.assign(e,{x:105,y:100});assert.equal(g.target(t,towerStats(t)),null);t.level=4;t.branch=1;assert.equal(g.target(t,towerStats(t)).id,e.id);
});
test('Les priorités de ciblage distinguent l’avance, la résistance et les soigneurs',()=>{
  const g=new Game();const t={id:100,type:'sniper',x:200,y:200,level:1,branch:null,priority:'first'};const a=g.spawn('crawler'),b=g.spawn('medic');Object.assign(a,{x:200,y:210,d:300});Object.assign(b,{x:200,y:220,d:100});assert.equal(g.target(t,towerStats(t)).id,a.id);t.priority='support';assert.equal(g.target(t,towerStats(t)).id,b.id);t.priority='strong';assert.equal(g.target(t,towerStats(t)).id,b.id);
});
test('Un relais révèle les spectres et son bonus ne se cumule pas',()=>{
  const g=new Game();const e=g.spawn('ghost');Object.assign(e,{x:300,y:300,phase:true});g.towers=[{id:1,type:'support',x:350,y:300,level:1,branch:null,disabled:0}];assert.ok(g.reveal(e));g.towers[0].disabled=2;assert.equal(g.reveal(e),false);
  const run=n=>{const x=new Game();const target=x.spawn('brute');Object.assign(target,{x:320,y:300});const t={id:1,type:'flame',x:300,y:300,level:1,branch:null,damage:0,kills:0};x.towers=[t,...Array.from({length:n},(_,i)=>({id:2+i,type:'support',x:280,y:310+i*2,level:1,branch:null,disabled:0}))];const before=target.hp;x.fire(t,towerStats(t),target);return before-target.hp;};assert.equal(run(1),run(2));assert.ok(run(1)>run(0));
});
test('Les pouvoirs exigent une vague active, une position valide et respectent leur recharge',()=>{
  const g=new Game();assert.equal(g.ability('strike',{x:200,y:200}),false);g.startWave();assert.equal(g.ability('strike',{x:NaN,y:200}),false);assert.equal(g.cooldowns.strike,0);
  const e=g.spawn('tank');Object.assign(e,{x:200,y:200});assert.ok(g.ability('strike',{x:200,y:200}));assert.equal(g.cooldowns.strike,ABILITIES.strike.cooldown);assert.equal(g.ability('strike',{x:200,y:200}),false);
  const boss=g.spawn('boss1');Object.assign(boss,{x:200,y:200});assert.ok(g.ability('freeze',{x:200,y:200}));assert.equal(boss.frozen,2);g.pause();const time=g.time,cd=g.cooldowns.freeze;tick(g,5);assert.equal(g.time,time);assert.equal(g.cooldowns.freeze,cd);
});
test('Les boss annoncent leurs capacités et les soigneurs restaurent leurs alliés',()=>{
  const events=[],g=new Game({onEvent:e=>events.push(e)});g.startWave();const boss=g.spawn('boss1',{d:150});boss.abilityTimer=3.05;tick(g,.2);assert.ok(events.some(e=>e.type==='bossWarning'));tick(g,3);assert.ok(g.enemies.filter(e=>e.type==='crawler').length>=4);
  const h=new Game();h.state='running';const medic=h.spawn('medic',{d:200}),target=h.spawn('tank',{d:210});target.hp=30;tick(h,1.1);assert.ok(target.hp>30);assert.ok(medic.hp>0);
});
test('Pause et reprise n’altèrent ni la simulation ni les ressources',()=>{
  const g=new Game();g.startWave();tick(g,2);g.pause();const snapshot=JSON.stringify({time:g.time,gold:g.gold,enemies:g.enemies,cooldowns:g.cooldowns});tick(g,100);assert.equal(snapshot,JSON.stringify({time:g.time,gold:g.gold,enemies:g.enemies,cooldowns:g.cooldowns}));g.pause();assert.equal(g.state,'running');tick(g,1);assert.ok(g.time>2.5);
});
test('Le checkpoint restaure les achats, spécialisations, priorités et recharges',()=>{
  const g=new Game({mapId:3,difficulty:'elite'});g.gold=2000;const t=g.build('sniper',emptySlot(g)).tower;g.upgrade(t.id);g.upgrade(t.id);g.upgrade(t.id,1);g.setPriority(t.id,'support');g.wave=8;g.cooldowns.strike=12;
  const restored=Game.restore(JSON.parse(JSON.stringify(g.checkpoint())));assert.ok(restored);assert.equal(restored.wave,8);assert.equal(restored.gold,g.gold);assert.deepEqual(restored.towers,g.towers);assert.equal(restored.cooldowns.strike,12);assert.equal(restored.difficulty,'elite');
  g.startWave();assert.equal(g.checkpoint(),null);g.pause();assert.equal(g.checkpoint(),null);
});
test('Les sauvegardes corrompues échouent sans casser le menu',()=>{
  assert.equal(Game.restore(null),null);assert.equal(Game.restore({version:99}),null);const g=new Game();const s=g.checkpoint();s.towers=[{type:'unknown'}];assert.equal(Game.restore(s),null);s.towers=[];s.gold=NaN;assert.equal(Game.restore(s),null);
  const broken={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};assert.equal(readProfile(broken).wins,0);assert.equal(readSave(broken),null);assert.equal(writeProfile({},broken),false);
});
test('Les médailles et records restent monotones et persistent',()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};const p=readProfile(storage),g=new Game();g.state='won';g.kills=20;recordResult(p,g);assert.equal(p.medals[0],3);g.lives=1;recordResult(p,g);assert.equal(p.medals[0],3);writeProfile(p,storage);assert.equal(readProfile(storage).medals[0],3);writeSave({version:1},storage);assert.equal(readSave(storage).version,1);writeSave(null,storage);assert.equal(readSave(storage),null);
});
test('Sans défense, une partie se termine en défaite sans boucle bloquée',()=>{
  const g=new Game();for(let i=0;i<200000&&g.state!=='lost';i++){if(g.state==='prep')g.startWave();g.update(1/60);}assert.equal(g.state,'lost');assert.equal(g.lives,0);assert.ok(g.wave<=4);
});
test('La dernière vague mène à la victoire et ne peut pas être relancée',()=>{
  const g=new Game();g.wave=g.map.waves;g.state='running';g.update(1/60);assert.equal(g.state,'won');assert.equal(g.startWave(),false);assert.equal(g.medal(),3);
});
test('Les mêmes pas de simulation donnent le même résultat indépendamment des groupes d’images',()=>{
  function run(group){const g=new Game();g.build('cannon',toPoint([3,4]));g.startWave();for(let frame=0;frame<600/group;frame++)for(let sub=0;sub<group;sub++)g.update(1/60);return {time:g.time,gold:g.gold,kills:g.kills,lives:g.lives,enemies:g.enemies.map(e=>[e.id,e.hp,e.d])};}assert.deepEqual(run(1),run(3));
});
