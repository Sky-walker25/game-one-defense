import { WORLD, MAPS, TOWERS, ENEMIES, DIFFICULTIES, ABILITIES, VERSION, wavePlan, toPoint } from './data.js';

export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export function segmentDistance(p,a,b) {
  const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy;
  const t=d ? Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/d)) : 0;
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
export function makePath(points) {
  const nodes=points.map(toPoint); let length=0; const segments=[];
  for(let i=1;i<nodes.length;i++) { const len=distance(nodes[i-1],nodes[i]); segments.push({a:nodes[i-1],b:nodes[i],len,start:length}); length+=len; }
  return {nodes,segments,length};
}
export function pointAt(path,d) {
  for(const s of path.segments) if(d<=s.start+s.len) { const t=Math.max(0,(d-s.start)/s.len); return {x:s.a.x+(s.b.x-s.a.x)*t,y:s.a.y+(s.b.y-s.a.y)*t,angle:Math.atan2(s.b.y-s.a.y,s.b.x-s.a.x)}; }
  return {...path.nodes.at(-1),angle:0};
}
const statsCache=new WeakMap();
export function towerStats(t) {
  const cached=statsCache.get(t);
  if(cached&&cached.level===t.level&&cached.branch===t.branch&&cached.type===t.type)return cached.stats;
  const b=TOWERS[t.type]; const l=Math.min(t.level,3)-1;
  const s={...b,damage:b.damage*(1+l*.62),range:b.range+l*12,rate:b.rate/(1+l*.12),buff:b.buff?b.buff+l*.06:0};
  if(t.branch !== null && t.branch !== undefined) {
    const p=b.branches[t.branch];
    for(const key of ['damage','range','rate']) if(p[key]) s[key]*=p[key];
    for(const key of ['air','splash','burn','slow','vuln','chain','emp','execute','reveal','buff','income']) if(p[key]!==undefined)s[key]=p[key];
  }
  statsCache.set(t,{level:t.level,branch:t.branch,type:t.type,stats:s});return s;
}
export function upgradeCost(t) { return t.level>=4?0:Math.round(TOWERS[t.type].cost * [0,.85,1.3,2.2][t.level]); }

export class Game {
  constructor({mapId=0,difficulty='veteran',endless=false,onEvent=()=>{}}={}) {
    this.map=MAPS[mapId]||MAPS[0]; this.difficulty=DIFFICULTIES[difficulty]?difficulty:'veteran';
    this.rules=DIFFICULTIES[this.difficulty]; this.endless=Boolean(endless);
    this.paths=this.map.paths.map(makePath); this.airPaths=this.map.air.map(makePath);
    this.onEvent=onEvent; this.state='prep'; this.previousState='prep'; this.wave=0; this.time=0;
    this.gold=Math.round(this.map.gold*this.rules.gold); this.lives=this.rules.lives; this.maxLives=this.rules.lives;
    this.towers=[]; this.enemies=[]; this.shots=[]; this.effects=[]; this.queue=[];
    this.spawnTimer=0; this.spawnIndex=0; this.nextId=1; this.cooldowns={strike:0,freeze:0,overdrive:0};
    this.overdrive=0; this.kills=0; this.totalDamage=0; this.spent=0; this.earned=0; this.elapsed=0;
    this.totalLeaks=0; this.abilityUses=0; this.waveKills=0; this.waveStartLives=this.lives; this.waveStartKills=0;
  }
  emit(type,data={}) { this.onEvent({type,...data}); }
  snap(p) { return {x:Math.floor(p.x/WORLD.cell)*WORLD.cell+WORLD.cell/2,y:Math.floor(p.y/WORLD.cell)*WORLD.cell+WORLD.cell/2}; }
  canBuild(p) {
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;
    if(p.x<40||p.y<40||p.x>WORLD.w-40||p.y>WORLD.h-40)return false;
    if(distance(p,toPoint(this.map.reactor))<81)return false;
    if(this.towers.some(t=>distance(t,p)<50))return false;
    return !this.paths.some(path=>path.segments.some(s=>segmentDistance(p,s.a,s.b)<50));
  }
  build(type,p) {
    if(!TOWERS[type]||!['prep','running','paused'].includes(this.state))return {ok:false,reason:'Construction indisponible.'};
    p=this.snap(p); const cost=TOWERS[type].cost;
    if(this.gold<cost)return {ok:false,reason:'Crédits insuffisants.'};
    if(!this.canBuild(p))return {ok:false,reason:'Choisissez un emplacement libre à côté de la route.'};
    const t={id:this.nextId++,type,...p,level:1,branch:null,cooldown:.1,angle:-Math.PI/2,priority:'first',spent:cost,kills:0,damage:0,disabled:0,recoil:0};
    this.towers.push(t); this.gold-=cost; this.spent+=cost;
    this.emit('build',{tower:t}); return {ok:true,tower:t};
  }
  upgrade(id,branch=null) {
    const t=this.towers.find(t=>t.id===id); if(!t||t.level>=4||['won','lost'].includes(this.state))return false;
    if(t.level===3 && ![0,1].includes(branch))return false;
    const cost=upgradeCost(t); if(this.gold<cost)return false;
    this.gold-=cost; this.spent+=cost;t.spent+=cost;t.level++; if(t.level===4)t.branch=branch;
    this.emit('upgrade',{tower:t});return true;
  }
  sell(id) {
    if(['won','lost'].includes(this.state))return false;
    const index=this.towers.findIndex(t=>t.id===id); if(index<0)return false;
    const t=this.towers[index],refund=Math.floor(t.spent*.7);this.gold+=refund;this.towers.splice(index,1);this.emit('sell',{tower:t,refund});return true;
  }
  setPriority(id,priority) { const t=this.towers.find(t=>t.id===id); if(t&&['first','last','strong','weak','support'].includes(priority))t.priority=priority; }
  startWave() {
    if(this.state!=='prep')return false;
    this.wave++;this.queue=wavePlan(this.map.id,this.wave,this.endless);this.spawnTimer=1;this.spawnIndex=0;
    this.waveStartLives=this.lives;this.waveStartKills=this.kills;this.state='running';this.emit('waveStart',{wave:this.wave});return true;
  }
  pause() { if(this.state==='paused'){this.state=this.previousState;return;} if(['prep','running'].includes(this.state)){this.previousState=this.state;this.state='paused';} }
  spawn(type,options={}) {
    const b=ENEMIES[type];if(!b)return null;
    const flying=!!b.flying;
    const pathIndex=options.pathIndex ?? (b.boss ? 0 : this.spawnIndex++ % (flying?this.airPaths.length:this.paths.length));
    const path=(flying?this.airPaths:this.paths)[pathIndex] || this.paths[0];
    const scale=(1+Math.max(0,this.wave-1)*.16+this.map.id*.17)*this.rules.hp*(this.endless&&this.wave>this.map.waves?Math.pow(1.06,this.wave-this.map.waves):1);
    const hp=b.hp*scale, shield=(b.shield||0)*scale;
    const e={id:this.nextId++,type,pathIndex,flying,d:options.d||0,pathLength:path.length,hp,maxHp:hp,shield,maxShield:shield,
      speed:b.speed*this.rules.speed*(this.endless?1+Math.max(0,this.wave-this.map.waves)*.006:1),bounty:Math.round(b.bounty*this.rules.reward),size:b.size,
      armor:b.armor||0,slow:0,slowTime:0,burn:0,burnTime:0,burnSource:0,frozen:0,vuln:0,vulnTime:0,dead:false,flash:0,
      abilityTimer:b.boss?11:0,telegraph:0,healTimer:1,born:this.time,phase:false,...pointAt(path,options.d||0)};
    this.enemies.push(e);return e;
  }
  reveal(e) {
    return this.towers.some(t=>{const s=towerStats(t);return !t.disabled&&(s.type==='support'||s.reveal)&&distance(t,e)<=s.range;});
  }
  target(t,s) {
    let best=null,bestScore=-Infinity,bestMedic=false;
    for(const e of this.enemies){
      const range=s.range+e.size*.3,dx=t.x-e.x,dy=t.y-e.y;
      if(e.dead||(e.flying&&!s.air)||dx*dx+dy*dy>range*range||(e.phase&&!this.reveal(e)))continue;
      let score=e.d/e.pathLength;
      if(t.priority==='last')score=-score;
      if(t.priority==='strong')score=e.hp+e.shield;
      if(t.priority==='weak')score=-e.hp-e.shield;
      const medic=t.priority==='support'&&Boolean(ENEMIES[e.type].heal);
      if(!best||(medic&&!bestMedic)||(medic===bestMedic&&score>bestScore)){best=e;bestScore=score;bestMedic=medic;}
    }
    return best;
  }

  damage(e,amount,type='energy',tower=null) {
    if(e.dead||amount<=0)return;
    let value=amount*(1+(e.vulnTime>0?e.vuln:0));
    if(type==='kinetic')value*=1-e.armor;
    const before=e.hp+e.shield;
    if(e.shield>0) { const multiplier=type==='energy'?2:1;const shieldDmg=Math.min(e.shield,value*multiplier);e.shield-=shieldDmg;value-=shieldDmg/multiplier; }
    e.hp-=value;e.flash=.10;
    const dealt=Math.min(before,before-e.hp-e.shield);this.totalDamage+=dealt;if(tower)tower.damage+=dealt;
    if(e.hp<=0)this.kill(e,tower);
  }
  kill(e,tower=null) {
    if(e.dead)return;e.dead=true;this.kills++;this.gold+=e.bounty;this.earned+=e.bounty;if(tower)tower.kills++;
    this.effects.push({type:'burst',x:e.x,y:e.y,color:ENEMIES[e.type].color,size:e.size,life:.48,maxLife:.48,seed:e.id});
    this.emit('kill',{enemy:e});
    if(ENEMIES[e.type].split)for(let i=0;i<3;i++)this.spawn('larva',{pathIndex:e.pathIndex,d:Math.max(0,e.d-i*16)});
    if(ENEMIES[e.type].boss)this.emit('bossKilled',{enemy:e});
  }
  applyHit(e,s,t) {
    if(e.dead)return;
    if(s.emp)e.shield=0;
    this.damage(e,s.damage,s.type,t);
    if(e.dead)return;
    if(s.execute&&e.hp<e.maxHp*s.execute){this.damage(e,e.hp+e.shield+10,'pierce',t);return;}
    if(s.slow){e.slow=Math.max(e.slow,s.slow*(ENEMIES[e.type].boss?.5:1));e.slowTime=2.2;}
    if(s.burn){e.burn=Math.max(e.burn,s.burn);e.burnTime=3;e.burnSource=t.id;}
    if(s.vuln){e.vuln=Math.max(e.vuln,s.vuln);e.vulnTime=3;}
  }
  fire(t,s,e) {
    t.angle=Math.atan2(e.y-t.y,e.x-t.x);t.recoil=1;
    let bonus=0;
    for(const a of this.towers)if(a.type==='support'&&!a.disabled){const as=towerStats(a);if(distance(a,t)<=as.range)bonus=Math.max(bonus,as.buff);}
    s={...s,damage:s.damage*(1+bonus),burn:(s.burn||0)*(1+bonus)};
    const targets=[e];
    if(s.chain) {
      let from=e;const used=new Set([e.id]);
      while(targets.length<s.chain){const near=this.enemies.filter(n=>!n.dead&&!used.has(n.id)&&(!n.phase||this.reveal(n))&&distance(from,n)<130).sort((a,b)=>distance(from,a)-distance(from,b))[0];if(!near)break;targets.push(near);used.add(near.id);from=near;}
      let origin=t;targets.forEach((target,i)=>{this.effects.push({type:'arc',x:origin.x,y:origin.y,tx:target.x,ty:target.y,color:s.color,life:.18,maxLife:.18,seed:target.id});this.applyHit(target,{...s,damage:s.damage*Math.pow(.84,i)},t);origin=target;});
    } else if(t.type==='flame') {
      for(const n of this.enemies.slice())if(!n.dead&&(!n.flying||s.air)&&distance(n,e)<=s.splash)this.applyHit(n,s,t);
      this.effects.push({type:'flame',x:t.x,y:t.y,tx:e.x,ty:e.y,color:s.color,life:.23,maxLife:.23,seed:e.id});
    } else {
      this.shots.push({x:t.x,y:t.y,targetId:e.id,towerId:t.id,tx:e.x,ty:e.y,speed:t.type==='sniper'?1150:560,s,color:s.color,life:3});
    }
    this.emit('shoot',{tower:t});
  }
  ability(type,p) {
    if(!ABILITIES[type]||this.state!=='running'||this.cooldowns[type]>0)return false;
    if(type!=='overdrive'&&(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>WORLD.w||p.y<0||p.y>WORLD.h))return false;
    this.cooldowns[type]=ABILITIES[type].cooldown;this.abilityUses++;
    if(type==='overdrive'){this.overdrive=10;this.emit('ability',{ability:type});return true;}
    const radius=ABILITIES[type].radius;
    for(const e of this.enemies.slice())if(!e.dead&&distance(e,p)<=radius){if(type==='strike')this.damage(e,320+this.map.id*35,'pierce');else e.frozen=ENEMIES[e.type].boss?2:4;}
    this.effects.push({type: type==='strike'?'strike':'stase',...p,size:radius,color:ABILITIES[type].color,life:.9,maxLife:.9,seed:5});
    this.emit('ability',{ability:type});return true;
  }
  update(dt) {
    if(!Number.isFinite(dt)||dt<=0||this.state!=='running')return;
    dt=Math.min(dt,.1);this.time+=dt;this.elapsed+=dt;this.overdrive=Math.max(0,this.overdrive-dt);
    for(const k in this.cooldowns)this.cooldowns[k]=Math.max(0,this.cooldowns[k]-dt);
    this.spawnTimer-=dt;
    while(this.queue.length&&this.spawnTimer<=0) { const q=this.queue.shift();const e=this.spawn(q.type);this.spawnTimer+=q.gap;if(ENEMIES[q.type].boss)this.emit('bossArrived',{enemy:e}); }
    for(const e of this.enemies.slice()) {
      if(e.dead)continue;
      const b=ENEMIES[e.type];e.flash=Math.max(0,e.flash-dt);
      if(e.burnTime>0){e.burnTime-=dt;this.damage(e,e.burn*dt,'fire',this.towers.find(t=>t.id===e.burnSource));if(e.dead)continue;}
      e.slowTime=Math.max(0,e.slowTime-dt);if(!e.slowTime)e.slow=0;
      e.vulnTime=Math.max(0,e.vulnTime-dt);e.frozen=Math.max(0,e.frozen-dt);
      e.phase=Boolean(b.phase&&((this.time-e.born)%5)>3&&!this.reveal(e));
      if(e.frozen<=0) {
        e.d+=e.speed*(1-e.slow)*dt;
        const path=(e.flying?this.airPaths:this.paths)[e.pathIndex]||this.paths[0];Object.assign(e,pointAt(path,e.d));
        if(e.d>=path.length-46) {e.dead=true;this.lives=Math.max(0,this.lives-(b.leak||1));this.totalLeaks++;this.emit('leak',{enemy:e});if(!this.lives){this.state='lost';this.emit('end',{won:false});break;}continue;}
        if(b.heal){e.healTimer-=dt;if(e.healTimer<=0){e.healTimer+=1;for(const other of this.enemies)if(!other.dead&&other.id!==e.id&&distance(e,other)<110)other.hp=Math.min(other.maxHp,other.hp+b.heal*(1+this.wave*.08));this.effects.push({type:'heal',x:e.x,y:e.y,size:100,color:'#b7df9b',life:.6,maxLife:.6});}}
        if(b.boss) {
          e.abilityTimer-=dt;
          if(e.abilityTimer<=3&&e.telegraph===0){e.telegraph=3;this.emit('bossWarning',{enemy:e,ability:b.ability});}
          if(e.telegraph>0)e.telegraph=Math.max(.001,e.abilityTimer);
          if(e.abilityTimer<=0){
            if(b.ability==='spawn')for(let n=0;n<4;n++)this.spawn('crawler',{pathIndex:e.pathIndex,d:Math.max(0,e.d-20*n)});
            if(b.ability==='shield')e.shield=Math.min(e.maxShield,e.shield+e.maxShield*.5);
            if(b.ability==='jam')for(const t of this.towers)if(distance(t,e)<185)t.disabled=3;
            this.effects.push({type:'stase',x:e.x,y:e.y,size:185,color:b.color,life:.6,maxLife:.6});e.abilityTimer=14;e.telegraph=0;
          }
        }
      }
    }
    if(this.state==='lost'){this.enemies=this.enemies.filter(e=>!e.dead);this.shots=[];return;}
    if(this.state==='running') for(const t of this.towers) {
      t.recoil=Math.max(0,t.recoil-dt*6);t.disabled=Math.max(0,t.disabled-dt);if(t.disabled)continue;
      const s=towerStats(t);if(s.type==='support')continue;
      t.cooldown-=dt*(this.overdrive>0?1.6:1);
      if(t.cooldown<=0){const e=this.target(t,s);if(e){this.fire(t,s,e);t.cooldown+=s.rate;}else t.cooldown=0;}
    }
    for(const shot of this.shots) {
      shot.life-=dt;const e=this.enemies.find(e=>e.id===shot.targetId&&!e.dead);if(e){shot.tx=e.x;shot.ty=e.y;}
      const d=Math.hypot(shot.tx-shot.x,shot.ty-shot.y),move=shot.speed*dt;
      if(d<=move+3) {
        const t=this.towers.find(t=>t.id===shot.towerId)||{id:shot.towerId,damage:0,kills:0};
        if(shot.s.splash){for(const other of this.enemies.slice())if(!other.dead&&(!other.flying||shot.s.air)&&distance(other,{x:shot.tx,y:shot.ty})<=shot.s.splash)this.applyHit(other,shot.s,t);this.effects.push({type:'impact',x:shot.tx,y:shot.ty,size:shot.s.splash,color:shot.color,life:.3,maxLife:.3});}
        else if(e)this.applyHit(e,shot.s,t);shot.life=0;
      } else {shot.x+=(shot.tx-shot.x)/d*move;shot.y+=(shot.ty-shot.y)/d*move;}
    }
    this.shots=this.shots.filter(s=>s.life>0);this.enemies=this.enemies.filter(e=>!e.dead);
    for(const fx of this.effects)fx.life-=dt;this.effects=this.effects.filter(fx=>fx.life>0).slice(-220);
    if(this.state==='running'&&!this.queue.length&&!this.enemies.length) {
      const reward=35+this.wave*3+this.towers.reduce((sum,t)=>sum+(towerStats(t).income||0),0);
      this.gold+=reward;this.earned+=reward;this.shots=[];this.effects=[];
      this.state=this.wave>=this.map.waves&&!this.endless?'won':'prep';
      if(this.state==='won')this.emit('end',{won:true});else this.emit('waveEnd',{reward,kills:this.kills-this.waveStartKills,clean:this.lives===this.waveStartLives});
    }
  }
  medal() { return this.lives===this.maxLives?3:this.lives>=this.maxLives*.5?2:1; }
  checkpoint() {
    if(this.state!=='prep'&&!(this.state==='paused'&&this.previousState==='prep'))return null;
    return {version:VERSION,mapId:this.map.id,difficulty:this.difficulty,endless:this.endless,wave:this.wave,gold:this.gold,lives:this.lives,towers:this.towers.map(t=>({...t})),nextId:this.nextId,time:this.time,elapsed:this.elapsed,kills:this.kills,spent:this.spent,earned:this.earned,totalDamage:this.totalDamage,totalLeaks:this.totalLeaks,abilityUses:this.abilityUses,cooldowns:{...this.cooldowns}};
  }
  static restore(save,onEvent=()=>{}) {
    if(!save||save.version!==VERSION||!Number.isInteger(save.mapId)||!MAPS[save.mapId]||!DIFFICULTIES[save.difficulty])return null;
    if(!Number.isInteger(save.wave)||save.wave<0||save.wave>10000||!Number.isFinite(save.gold)||save.gold<0||!Number.isFinite(save.lives)||save.lives<=0||!Array.isArray(save.towers)||save.towers.length>200)return null;
    if(save.towers.some(t=>!TOWERS[t.type]||!Number.isInteger(t.level)||t.level<1||t.level>4||!Number.isFinite(t.x)||!Number.isFinite(t.y)||t.x<0||t.y<0||t.x>WORLD.w||t.y>WORLD.h||!Number.isFinite(t.spent)||t.spent<0||(t.level===4&&![0,1].includes(t.branch))))return null;
    if(save.towers.some(t=>!Number.isInteger(t.id)||t.id<1||!Number.isFinite(t.damage)||t.damage<0||!Number.isInteger(t.kills)||t.kills<0||(t.level<4&&t.branch!==null)))return null;
    if(new Set(save.towers.map(t=>t.id)).size!==save.towers.length)return null;
    const g=new Game({...save,onEvent});
    for(const k of ['wave','gold','lives','time','elapsed','kills','spent','earned','totalDamage','totalLeaks','abilityUses'])if(Number.isFinite(save[k]))g[k]=save[k];
    g.lives=Math.min(g.maxLives,g.lives);g.towers=save.towers.map(t=>({...t,disabled:0,cooldown:.1,recoil:0,priority:['first','last','strong','weak','support'].includes(t.priority)?t.priority:'first'}));
    g.nextId=Math.max(1,...g.towers.map(t=>t.id||0))+1;
    for(const key of Object.keys(ABILITIES))g.cooldowns[key]=Number.isFinite(save.cooldowns?.[key])?Math.min(ABILITIES[key].cooldown,Math.max(0,save.cooldowns[key])):0;
    return g;
  }
}
