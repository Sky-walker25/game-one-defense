import { MAPS, BIOMES, TOWERS, TOWER_IDS, ENEMIES, ABILITIES, DIFFICULTIES, WORLD, waveSummary, toPoint } from './data.js';
import { Game, towerStats, upgradeCost, distance } from './engine.js';
import { Renderer, drawMini, drawTowerIcon } from './render.js';
import { readProfile, writeProfile, readSave, writeSave, recordResult } from './storage.js';
import { Sound } from './audio.js';
import { BoardGesture } from './camera.js';

const $=id=>document.getElementById(id);
const profile=readProfile();
if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)profile.settings.motion=false;
const sound=new Sound();sound.configure(profile.settings);
const renderer=new Renderer($('battlefield'));
let game=null,currentMap=0,selectedType=null,selectedId=null,selectedAbility=null,speed=1;
let checkpoint=readSave(),savedGame=Game.restore(checkpoint),modalPaused=false,modalCleanup=null;
let lastTime=0,accumulator=0,uiElapsed=0,selectionKey='',previewKey='',announceTimer=0,resultRecorded=false;
let keyPoint=toPoint([7,6]),storageWarning=false;
const mobileMedia=window.matchMedia('(max-width:760px)');
let pendingPoint=null,sheetKind=null,sheetPaused=false,sheetMove=null,drawElapsed=0,lastDrawTime=0;
const mobile=()=>mobileMedia.matches;
const putText=(id,value)=>{const el=$(id),text=String(value);if(el.textContent!==text)el.textContent=text;};
const putHTML=(id,value)=>{const el=$(id);if(el.innerHTML!==value)el.innerHTML=value;};
const format=n=>Math.round(n).toLocaleString('fr-FR');
const escapeHTML=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function toast(message,error=false){const el=document.createElement('div');el.className='toast'+(error?' error':'');el.textContent=message;$('toasts').append(el);setTimeout(()=>el.remove(),4500);}
function persist(){if(!writeProfile(profile))saveFailed();updateProfile();}
function saveFailed(){if(!storageWarning){storageWarning=true;toast('Le navigateur bloque la sauvegarde. Gardez cet onglet ouvert pour conserver cette partie.',true);}}
function saveCheckpoint(){const s=game?.checkpoint();if(s){checkpoint=s;savedGame=Game.restore(s);if(!writeSave(s))saveFailed();$('save-status').textContent=`Vague ${game.wave+1} · point de reprise enregistré`;} }
function updateProfile(){const total=Object.values(profile.medals).reduce((a,b)=>a+b,0);$('profile-medals').innerHTML=`${total} / 18 <span>médailles</span>`;$('sound-toggle').style.opacity=profile.settings.sound?'1':'.4';$('sound-toggle').setAttribute('aria-label',profile.settings.sound?'Couper le son':'Activer le son');}
const unlocked=id=>id===0||Boolean(profile.medals[id-1]);
const allWon=()=>MAPS.every(m=>profile.medals[m.id]);

function renderCampaign(){
  updateProfile();$('campaign-progress').textContent=`${String(MAPS.filter(m=>unlocked(m.id)).length).padStart(2,'0')} / 06 secteurs accessibles`;
  $('mission-grid').innerHTML=MAPS.map(m=>`<button class="mission-card ${m.id===currentMap?'selected ':''}${!unlocked(m.id)?'locked':''}" data-map="${m.id}" ${!unlocked(m.id)?'disabled':''} aria-label="Opération ${m.id+1} : ${m.name}${!unlocked(m.id)?', terminez la mission précédente':''}" aria-pressed="${m.id===currentMap}"><canvas aria-hidden="true" data-minimap="${m.id}"></canvas>${!unlocked(m.id)?'<span class="lock" aria-hidden="true">⌑</span>':''}${profile.medals[m.id]?`<span class="medals" aria-label="${profile.medals[m.id]} médailles">${'◆'.repeat(profile.medals[m.id])}${'◇'.repeat(3-profile.medals[m.id])}</span>`:''}${m.id===currentMap?'<span class="selected-marker">SÉLECTIONNÉ</span>':''}<div class="mission-card-body"><small>SECTEUR ${String(m.id+1).padStart(2,'0')}</small><h3>${m.name}</h3></div></button>`).join('');
  document.querySelectorAll('[data-minimap]').forEach(c=>drawMini(c,MAPS[Number(c.dataset.minimap)]));
  const m=MAPS[currentMap];$('operation-number').textContent=`OPÉRATION ${String(m.id+1).padStart(2,'0')}`;$('mission-title').textContent=m.name;$('mission-subtitle').textContent=m.subtitle;$('mission-description').textContent=m.desc;
  $('mission-specs').innerHTML=`<span><b>≋</b>${m.waves} vagues</span><span><b>⌁</b>${m.paths.length} voie${m.paths.length>1?'s':''}</span><span><b>◈</b>${m.gold} crédits</span>${m.boss?'<span><b>◆</b>Boss</span>':''}`;
  const option=$('mode').querySelector('[value="endless"]');option.disabled=!allWon();option.textContent=allWon()?'Survie infinie':'Survie · terminer la campagne';
  $('resume').hidden=!savedGame;if(savedGame){$('resume').textContent=`Reprendre · vague ${savedGame.wave+1}`;$('resume').title=`${savedGame.map.name} — ${DIFFICULTIES[savedGame.difficulty].name}`;}
  if(profile.medals[m.id])$('save-note').textContent=`Record : ${profile.medals[m.id]} / 3 médailles${profile.bestWaves[m.id]?` · Survie : ${profile.bestWaves[m.id]} vagues`:''}`;
  else $('save-note').textContent='Progression sauvegardée sur cet appareil.';
}
function startMission(restore=false){
  closeSheet();closeModal();sound.init();sound.startMusic();
  game=restore&&checkpoint?Game.restore(checkpoint,onGameEvent):new Game({mapId:currentMap,difficulty:$('difficulty').value,endless:$('mode').value==='endless'&&allWon(),onEvent:onGameEvent});
  if(!game){toast('Le point de reprise est invalide. Une nouvelle défense est prête.',true);game=new Game({mapId:currentMap,onEvent:onGameEvent});}
  document.body.classList.add('in-battle');pendingPoint=null;currentMap=game.map.id;resultRecorded=false;speed=1;accumulator=0;selectedType=null;selectedId=null;selectedAbility=null;selectionKey='';previewKey='';
  $('campaign-screen').hidden=true;$('game-screen').hidden=false;$('battle-title').textContent=game.map.name;
  $('battle-operation').textContent=`OPÉRATION ${String(game.map.id+1).padStart(2,'0')} / ${BIOMES[game.map.biome].name.toUpperCase()}`;
  $('tactical-tip').textContent=game.map.tip;renderer.setGame(game);renderer.motion=profile.settings.motion;renderer.particles=profile.settings.particles;
  renderer.buildType=null;renderer.selected=null;renderer.ability=null;renderer.hover=null;$('speed').textContent='×1';
  renderArsenal();renderAbilities();updateUI();saveCheckpoint();window.scrollTo({top:0,behavior:'instant'});
  if(!profile.tutorial){showHelp(true);}else announce(`Opération ${game.map.id+1} · ${game.map.name}`,'Préparez vos défenses avant de lancer la vague.');
}
function goCampaign(){
  if(!game||$('game-screen').hidden)return;
  if(game.state==='prep'||(game.state==='paused'&&game.previousState==='prep'))saveCheckpoint();
  closeSheet();document.body.classList.remove('in-battle');sound.stopMusic();game=null;renderer.game=null;$('game-screen').hidden=true;$('campaign-screen').hidden=false;renderCampaign();window.scrollTo({top:0,behavior:'instant'});
}
function requestCampaign(){if(!game||$('game-screen').hidden)return;if(['running','paused'].includes(game.state)&&(game.previousState==='running'||game.state==='running'))confirmModal('Quitter la mission ?','Votre défense est enregistrée au début de cette vague. Vous pourrez reprendre à ce point depuis la campagne.','Revenir à la campagne',goCampaign);else goCampaign();}
function renderArsenal(){
  $('tower-grid').innerHTML=TOWER_IDS.map((id,i)=>`<button class="tower-card" data-tower="${id}" aria-label="Construire ${TOWERS[id].name}, ${TOWERS[id].cost} crédits" aria-pressed="false"><kbd>${i+1}</kbd><canvas data-tower-icon="${id}" aria-hidden="true"></canvas><strong>${TOWERS[id].name}</strong><span class="tower-role">${TOWERS[id].role.split(' · ')[0]}</span><span class="cost">◈ ${TOWERS[id].cost}</span></button>`).join('');
  $('tower-grid').querySelectorAll('canvas').forEach(c=>drawTowerIcon(c,c.dataset.towerIcon));
}
function renderAbilities(){const glyph={strike:'⌖',freeze:'❄',overdrive:'ϟ'};$('abilities').innerHTML=Object.entries(ABILITIES).map(([id,a])=>`<button class="ability-btn" data-ability="${id}" style="--ability-color:${a.color}" aria-label="${a.name} : ${a.desc}" title="${a.name} — ${a.desc} (${a.key})"><span class="ability-glyph" aria-hidden="true">${glyph[id]}</span><span class="ability-text">${a.short}<small data-cooldown="${id}">Prêt</small><span class="ability-description">${a.desc}</span></span><kbd>${a.key}</kbd></button>`).join('');}
function selectTowerType(type){closeSheet();pendingPoint=null;renderer.hover=null;if(!game||['won','lost'].includes(game.state))return;if(game.gold<TOWERS[type].cost){toast(`Il manque ${TOWERS[type].cost-game.gold} crédits pour ${TOWERS[type].name}.`,true);return;}selectedType=selectedType===type?null:type;selectedId=null;selectedAbility=null;renderer.buildType=selectedType;renderer.selected=null;renderer.ability=null;selectionKey='';sound.play('click');updateUI();if(mobile())$('battlefield').focus({preventScroll:true});}
function selectTower(t){pendingPoint=null;renderer.hover=null;selectedId=t.id;selectedType=null;selectedAbility=null;renderer.selected=t.id;renderer.buildType=null;renderer.ability=null;selectionKey='';sound.play('click');updateUI();if(mobile())openSheet('selection');}
function deselect(){pendingPoint=null;renderer.hover=null;selectedType=null;selectedId=null;selectedAbility=null;renderer.buildType=null;renderer.selected=null;renderer.ability=null;selectionKey='';if(game)updateUI();}
function selectAbility(id){closeSheet();pendingPoint=null;renderer.hover=null;if(!game||game.state!=='running'){toast('Les pouvoirs sont disponibles pendant les vagues.');return;}if(game.cooldowns[id]>0){toast(`${ABILITIES[id].name} : encore ${Math.ceil(game.cooldowns[id])} s.`);return;}if(id==='overdrive'){game.ability(id);updateUI();return;}selectedAbility=selectedAbility===id?null:id;selectedType=null;selectedId=null;renderer.ability=selectedAbility;renderer.buildType=null;renderer.selected=null;selectionKey='';updateUI();}
function actOnBoard(p){
  if(!game||['won','lost'].includes(game.state)||!renderer.camera.contains(p))return;
  if(mobile()&&(selectedAbility||selectedType)){
    pendingPoint=selectedType?game.snap(p):p;renderer.hover=pendingPoint;updateUI();return;
  }
  if(selectedAbility){if(game.ability(selectedAbility,p)){selectedAbility=null;renderer.ability=null;}updateUI();return;}
  if(!selectedType){
    const radius=mobile()?Math.max(28,22/renderer.camera.scale):28;
    const t=game.towers.reduce((best,t)=>distance(t,p)<radius&&(!best||distance(t,p)<distance(best,p))?t:best,null);
    if(t){selectTower(t);return;}
  }
  if(selectedType){const result=game.build(selectedType,p);if(result.ok){selectedId=result.tower.id;selectedType=null;renderer.buildType=null;renderer.selected=selectedId;selectionKey='';saveCheckpoint();}else toast(result.reason,true);updateUI();return;}
  deselect();
}
function confirmPlacement(){
  if(!game||!pendingPoint)return;
  if(selectedType){const result=game.build(selectedType,pendingPoint);if(!result.ok){toast(result.reason,true);updateUI();return;}toast(`${TOWERS[selectedType].name} déployée.`);saveCheckpoint();}
  else if(selectedAbility){if(!game.ability(selectedAbility,pendingPoint)){toast('Ce pouvoir est indisponible. Reprenez le combat pour l’utiliser.');return;}}
  deselect();
}
function launchWave(){if(!game)return;if(game.state==='prep'){saveCheckpoint();deselect();game.startWave();updateUI();}else if(game.state==='running'||game.state==='paused'){game.pause();updateUI();}}
function cycleSpeed(){speed=speed===3?1:speed+1;$('speed').textContent=`×${speed}`;sound.play('click');}
function onGameEvent(e){
  if(e.type==='build')sound.play('build');if(e.type==='upgrade')sound.play('upgrade');
  if(e.type==='shoot')sound.play(e.tower.type==='tesla'?'tesla':'shoot');
  if(e.type==='leak')sound.play('leak');if(e.type==='ability')sound.play('ability');
  if(e.type==='waveStart'){sound.play('wave');announce(`Vague ${e.wave}`,game.endless?'Survie — tenez aussi longtemps que possible.':'Les unités ennemies sont en approche.');}
  if(e.type==='waveEnd'){saveCheckpoint();announce(e.clean?'Vague maîtrisée':'Vague repoussée',`+${e.reward} crédits de ravitaillement · ${e.kills} unités neutralisées`);sound.play('build');selectionKey='';previewKey='';}
  if(e.type==='bossArrived')announce(ENEMIES[e.enemy.type].name,'Unité majeure détectée. Préparez vos pouvoirs.',6500);
  if(e.type==='bossWarning')announce('Capacité imminente',{spawn:'Le Colosse appelle des renforts.',shield:'La Matriarche recharge son bouclier.',jam:'Némésis va neutraliser les tours dans le cercle.'}[e.ability],3200);
  if(e.type==='bossKilled')announce('Menace majeure éliminée',`${ENEMIES[e.enemy.type].name} a été neutralisé.`);
  if(e.type==='end'){sound.play(e.won?'win':'lose');sound.stopMusic();if(!resultRecorded){recordResult(profile,game);resultRecorded=true;persist();checkpoint=null;savedGame=null;writeSave(null);}setTimeout(()=>{if(game&&['won','lost'].includes(game.state))showResult();},500);}
}
function announce(title,sub,duration=3600){clearTimeout(announceTimer);$('board-announcement').innerHTML=`<strong>${escapeHTML(title)}</strong><span>${escapeHTML(sub)}</span>`;$('board-announcement').hidden=false;announceTimer=setTimeout(()=>$('board-announcement').hidden=true,duration);}
function renderSelection(){
  const t=game.towers.find(t=>t.id===selectedId),type=t?.type||selectedType;const key=`${selectedId}|${selectedType}|${t?.level}|${t?.branch}|${t?.priority}`;
  if(selectionKey===key)return;selectionKey=key;
  if(!type){$('selection-panel').innerHTML='<div class="selection-empty"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="10"/><path d="M18 2v9m0 14v9M2 18h9m14 0h9"/><circle cx="18" cy="18" r="2"/></svg><p>Sélectionnez une tour pour consulter sa portée et ses améliorations.</p></div>';return;}
  const b=TOWERS[type],s=t?towerStats(t):b,cost=t?upgradeCost(t):0;
  let html=`<div class="selected-title"><h3>${t?.branch!==null&&t?.branch!==undefined?b.branches[t.branch].name:b.name}</h3><span>${t?`NIVEAU ${t.level} / 4`:'CONSTRUCTION'}</span></div><div class="selected-role">${b.role}</div><p class="selected-desc">${t?.branch!==null&&t?.branch!==undefined?b.branches[t.branch].desc:b.desc}</p><div class="stat-row"><div><span>${type==='support'?'BONUS':'DÉGÂTS'}</span><strong>${type==='support'?`${Math.round(s.buff*100)} %`:format(s.damage)}</strong></div><div><span>PORTÉE</span><strong>${format(s.range)} m</strong></div><div><span>${type==='support'?'EFFET':'CADENCE'}</span><strong>${type==='support'?'Aura':`${(1/s.rate).toFixed(1)}/s`}</strong></div></div>`;
  if(t){
    if(t.level<3)html+=`<button class="upgrade-btn" data-upgrade="normal" data-cost="${cost}"><span>Améliorer au niveau ${t.level+1}<small>Dégâts, portée et cadence renforcés</small></span><span>◈ ${cost}</span></button>`;
    else if(t.level===3)html+=b.branches.map((p,i)=>`<button class="upgrade-btn" data-upgrade="${i}" data-cost="${cost}"><span>${p.name}<small>${p.desc}</small></span><span>◈ ${cost}</span></button>`).join('');
    else html+='<div class="build-instruction">◆ Spécialisation maximale</div>';
    if(type!=='support')html+=`<label class="priority-control">CIBLAGE<select id="priority" aria-label="Priorité de ciblage"><option value="first">Premier</option><option value="last">Dernier</option><option value="strong">Plus résistant</option><option value="weak">Plus fragile</option><option value="support">Soigneurs</option></select></label><div class="stat-row"><div><span>ÉLIMINATIONS</span><strong id="tower-kills">${t.kills}</strong></div><div><span>DÉGÂTS INFLIGÉS</span><strong id="tower-damage">${format(t.damage)}</strong></div></div>`;
    html+=`<button class="sell-btn" id="sell-tower">Revendre · +${Math.floor(t.spent*7/10)} crédits</button>`;
  }else html+=`<p class="build-instruction">Choisissez un emplacement sur le terrain.</p><button id="cancel-build" class="sell-btn">Annuler <kbd>ÉCHAP</kbd></button>`;
  $('selection-panel').innerHTML=html;if(t&&$('priority'))$('priority').value=t.priority;
}
function updateUI(){if(!game)return;
  const inputHint=mobile()?'Champ de bataille. Touchez Construire, choisissez une tour puis une position et confirmez. Pincez pour zoomer, glissez pour déplacer.':'Champ de bataille. Sélectionnez une tour de 1 à 6, utilisez les flèches pour choisir un emplacement puis Entrée pour construire. Échap pour annuler.';
  if($('battlefield').getAttribute('aria-label')!==inputHint)$('battlefield').setAttribute('aria-label',inputHint);
  putText('gold-value',format(game.gold));putHTML('lives-value',`${game.lives} <small>/ ${game.maxLives}</small>`);putHTML('wave-value',`${game.wave} <small>/ ${game.endless?'∞':game.map.waves}</small>`);
  $('board-status').textContent={prep:'PHASE DE PRÉPARATION',running:`VAGUE ${String(game.wave).padStart(2,'0')} · ${DIFFICULTIES[game.difficulty].name.toUpperCase()}`,paused:'PAUSE TACTIQUE',won:'SECTEUR SÉCURISÉ',lost:'RÉACTEUR PERDU'}[game.state];
  $('next-wave').disabled=game.state!=='prep';$('next-wave').querySelector('span').textContent=game.state==='prep'?`Lancer la vague ${game.wave+1}`:game.state==='running'?'Vague en cours':game.state==='paused'?'Combat en pause':game.state==='won'?'Mission accomplie':'Mission terminée';
  $('pause').disabled=!['running','paused'].includes(game.state);$('pause').textContent=game.state==='paused'?'▶':'Ⅱ';$('pause').setAttribute('aria-label',game.state==='paused'?'Reprendre le combat':'Mettre en pause');$('pause-overlay').hidden=game.state!=='paused'||$('modal').open||$('tactical-sheet').open;
  $('board-hint').textContent=selectedAbility?`${ABILITIES[selectedAbility].name} : choisissez une zone · Échap pour annuler`:selectedType?`${TOWERS[selectedType].name} · ${TOWERS[selectedType].cost} crédits — choisissez un emplacement`:selectedId?'Améliorez la tour ou changez sa priorité de ciblage dans l’arsenal.':game.state==='prep'?(game.towers.length?'Votre défense est prête ? Lancez la prochaine vague.':'Sélectionnez une tour, puis un emplacement libre.'):'Protégez le réacteur. Vous pouvez construire pendant la vague.';
  $('board-hint').hidden=['won','lost','paused'].includes(game.state);
  document.querySelectorAll('[data-tower]').forEach(el=>{const selected=el.dataset.tower===selectedType;el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',selected);el.classList.toggle('unaffordable',game.gold<TOWERS[el.dataset.tower].cost);});
  document.querySelectorAll('[data-ability]').forEach(el=>{const id=el.dataset.ability,cd=game.cooldowns[id];const active=game.state==='running'||sheetPaused;el.disabled=!active||cd>0;el.classList.toggle('selected',selectedAbility===id);el.style.setProperty('--cooldown',`${(1-cd/ABILITIES[id].cooldown)*100}%`);el.querySelector('small').textContent=cd>0?`${Math.ceil(cd)} s`:active?'Prêt':'En combat';});
  renderSelection();$('selection-panel').querySelectorAll('[data-cost]').forEach(el=>el.disabled=game.gold<Number(el.dataset.cost));
  const t=game.towers.find(t=>t.id===selectedId);if(t&&$('tower-kills')){$('tower-kills').textContent=t.kills;$('tower-damage').textContent=format(t.damage);}
  const next=game.state==='prep'?game.wave+1:Math.max(1,game.wave),key=`${game.map.id}|${next}|${game.state==='prep'}`;
  if(key!==previewKey){previewKey=key;const entries=waveSummary(game.map.id,next,game.endless);$('intel-title').textContent=game.state==='prep'?`PROCHAINE VAGUE · ${next}`:`RENSEIGNEMENTS · VAGUE ${next}`;renderer.showAir=entries.some(e=>e.flying);$('enemy-count').textContent=`${entries.reduce((a,e)=>a+e.count,0)} unités détectées`;$('enemy-preview').innerHTML=entries.map(e=>`<button class="enemy-chip" data-enemy="${e.type}" title="${e.desc}"><i style="background:${e.color}" aria-hidden="true"></i>${e.name}<b>×${e.count}</b></button>`).join('');}
  $('battlefield').dataset.state=game.state;$('battlefield').dataset.wave=game.wave;$('battlefield').dataset.towers=game.towers.length;$('battlefield').dataset.enemies=game.enemies.length;updateMobileUI();
}

function openModal(content,wide=false){
  closeSheet();
  const already=$('modal').open;if(!already&&game&&game.state==='running'){game.pause();modalPaused=true;}
  $('modal-content').innerHTML=content;$('modal').classList.toggle('wide',wide);if(!already)$('modal').showModal();if(game)updateUI();
}
function closeModal(){if(!$('modal').open)return;$('modal').close();}
$('modal').addEventListener('close',()=>{if($('modal').open)return;if(modalCleanup){modalCleanup();modalCleanup=null;}if(modalPaused&&game?.state==='paused')game.pause();modalPaused=false;if(game)updateUI();});
const modalHeader=(title)=>`<div class="modal-header"><h2 id="modal-title">${title}</h2><button class="modal-close" data-close aria-label="Fermer">×</button></div>`;
function confirmModal(title,body,label,callback){openModal(`${modalHeader(title)}<p class="modal-lead">${body}</p><div class="modal-actions"><button class="secondary-btn" data-close>Annuler</button><button class="primary-btn" id="confirm-action">${label}</button></div>`);$('confirm-action').onclick=()=>{closeModal();modalPaused=false;callback();};}
function showSettings(){openModal(`${modalHeader('Réglages')}<p class="modal-lead">Votre confort de jeu, sur cet appareil.</p>${[['sound','Effets sonores','Tirs, impacts et alertes tactiques.'],['music','Ambiance musicale','Une composition synthétique discrète.'],['particles','Effets de combat','Particules, arcs électriques et explosions.'],['motion','Animations ambiantes','Pulsations et mouvements du décor.'],['battery','Économie de batterie','Affichage limité à 30 images/s. La simulation reste identique.']].map(([key,title,desc])=>`<label class="settings-row"><span><strong>${title}</strong><small>${desc}</small></span><input type="checkbox" data-setting="${key}" ${profile.settings[key]?'checked':''}></label>`).join('')}<label class="settings-row"><span><strong>Volume général</strong></span><input aria-label="Volume général" type="range" id="volume" min="0" max="100" value="${profile.settings.volume*100}"></label><div class="modal-actions"><button class="primary-btn" data-close>Revenir au jeu</button></div>`);
  document.querySelectorAll('[data-setting]').forEach(el=>el.onchange=()=>{profile.settings[el.dataset.setting]=el.checked;applySettings();});$('volume').oninput=e=>{profile.settings.volume=Number(e.target.value)/100;applySettings();};
}
function applySettings(){sound.init();sound.configure(profile.settings);if(game&&profile.settings.music)sound.startMusic();renderer.motion=profile.settings.motion;renderer.particles=profile.settings.particles;persist();}
function showHelp(first=false){openModal(`${modalHeader(first?'Bienvenue, commandant.':'Guide du commandant')}<p class="modal-lead">Empêchez les unités ennemies d’atteindre le réacteur. Chaque ennemi qui passe endommage votre dernière ligne de défense.</p><div class="help-steps"><div class="help-step"><span>01 / CONSTRUIRE</span><h3>Choisissez une position</h3><p>${mobile()?'Touchez Construire, choisissez une tour puis un emplacement. Vérifiez la portée et confirmez. Pincez pour zoomer, glissez pour déplacer le terrain.':'Sélectionnez une tour dans l’arsenal, puis cliquez sur un emplacement libre. La zone affichée indique sa portée. Les virages sont vos alliés.'}</p></div><div class="help-step"><span>02 / ANTICIPER</span><h3>Lisez la prochaine vague</h3><p>${mobile()?'Touchez Voir les menaces au-dessus des commandes.':'Consultez les unités annoncées sous le terrain.'} Gardez des armes capables de toucher les drones et de percer le blindage.</p></div><div class="help-step"><span>03 / AMÉLIORER</span><h3>Composez votre défense</h3><p>Sélectionnez vos tours pour les améliorer. Au niveau 3, choisissez une spécialisation. Un Relais renforce les tours voisines.</p></div><div class="help-step"><span>04 / INTERVENIR</span><h3>Gardez vos pouvoirs prêts</h3><p>${mobile()?'Ouvrez Pouvoirs, placez Frappe ou Stase sur le terrain, puis confirmez.':'Frappe et Stase se placent sur le terrain.'} Surcadence accélère toutes vos tours. La pause vous laisse réfléchir ; les pouvoirs se rechargent en combat.</p></div></div><div class="shortcut-list"><span><kbd>1–6</kbd> Tours</span><span><kbd>Q W E</kbd> Pouvoirs</span><span><kbd>ESPACE</kbd> Vague / pause</span><span><kbd>X</kbd> Vitesse</span><span><kbd>U</kbd> Améliorer</span><span><kbd>↑ ↓ ← →</kbd><kbd>ENTRÉE</kbd> Construire au clavier</span><span><kbd>ÉCHAP</kbd> Annuler</span></div><p class="modal-lead" style="margin:20px 0 0;font-size:12px">Médailles : 3 si le réacteur reste intact, 2 avec au moins la moitié de sa vie, 1 pour toute victoire. Terminez les six missions pour débloquer la survie. Le point de reprise conserve le début de la vague en cours.</p><div class="modal-actions"><button class="primary-btn" id="help-done">${first?'Prendre le commandement':'Compris'}</button></div>`,true);$('help-done').onclick=()=>{profile.tutorial=true;persist();closeModal();};}
function showCodex(tab='towers'){
  let content='';
  if(tab==='towers')content=TOWER_IDS.map(id=>{const t=TOWERS[id];return `<article class="codex-card"><canvas data-codex-tower="${id}" aria-hidden="true"></canvas><div><h3>${t.name}</h3><small>${t.role} · ${t.cost} crédits</small><p>${t.desc}</p><p style="margin-top:7px">Spécialisations : ${t.branches.map(b=>b.name).join(' / ')}.</p></div></article>`;}).join('');
  else content=Object.entries(ENEMIES).map(([id,e])=>`<article class="codex-card"><span class="codex-enemy-icon" style="color:${e.color}" aria-hidden="true">${e.boss?'⬢':e.flying?'⌁':'◇'}</span><div><h3>${e.name}</h3><small>${e.boss?'MENACE MAJEURE':e.flying?'UNITÉ AÉRIENNE':'UNITÉ TERRESTRE'} · ${e.hp} PV de base</small><p>${e.desc}</p></div></article>`).join('');
  openModal(`${modalHeader('Encyclopédie')}<div class="codex-tabs"><button data-codex-tab="towers" class="${tab==='towers'?'active':''}">Les défenses</button><button data-codex-tab="enemies" class="${tab==='enemies'?'active':''}">Les menaces</button></div><div class="codex-grid">${content}</div>`,true);
  document.querySelectorAll('[data-codex-tower]').forEach(c=>drawTowerIcon(c,c.dataset.codexTower));
}
function showResult(){if(!game)return;const won=game.state==='won',medal=won?game.medal():0,minutes=Math.max(1,Math.round(game.elapsed/60));
  const title=game.endless?'La résistance s’achève':won?(game.map.id===5?'Le bastion a tenu.':'Secteur sécurisé.'):'Le réacteur est tombé.';
  const lead=game.endless?`Vous avez tenu ${Math.max(0,game.wave-1)} vagues. Votre record est conservé.`:won?(game.map.id===5?'La campagne est terminée. La survie infinie est maintenant accessible sur tous les terrains.':`La défense de ${game.map.name} est un succès. La prochaine opération est désormais accessible.`):'Repositionnez vos tours, adaptez votre ciblage et revenez défendre le bastion.';
  openModal(`<div class="result-center"><span class="eyebrow">${won?'MISSION ACCOMPLIE':'RAPPORT DE MISSION'}</span><h2 id="modal-title">${title}</h2><div class="result-medals" aria-label="${medal} médailles sur trois">${'◆'.repeat(medal)}${'◇'.repeat(3-medal)}</div><p>${lead}</p><div class="result-stats"><div class="result-stat"><strong>${format(game.kills)}</strong><span>unités neutralisées</span></div><div class="result-stat"><strong>${game.lives}/${game.maxLives}</strong><span>intégrité du réacteur</span></div><div class="result-stat"><strong>${minutes} min</strong><span>temps de combat</span></div></div></div><div class="modal-actions"><button id="result-campaign" class="secondary-btn">Campagne</button><button id="result-retry" class="secondary-btn">Rejouer</button>${won&&game.map.id<5?'<button id="result-next" class="primary-btn">Opération suivante ↗</button>':''}</div>`);
  $('result-campaign').onclick=()=>{closeModal();goCampaign();};$('result-retry').onclick=()=>{const difficulty=game.difficulty,endless=game.endless;closeModal();$('difficulty').value=difficulty;$('mode').value=endless?'endless':'campaign';startMission();};if($('result-next'))$('result-next').onclick=()=>{currentMap=game.map.id+1;$('difficulty').value=game.difficulty;$('mode').value='campaign';closeModal();startMission();};
}

// A single set of controls moves into a native dialog: no duplicate IDs or stale state.
function openSheet(kind){
  if(!game)return;closeSheet();sheetKind=kind;
  const panels={build:['Arsenal','Choisissez une tour. Le placement sera confirmé sur le terrain.',$('tower-grid')],selection:['Votre défense','Améliorez la tour ou adaptez son ciblage.',$('selection-panel')],powers:['Pouvoirs','Une intervention bien placée peut retourner une vague.',$('abilities')],intel:['Reconnaissance',game.map.tip,document.querySelector('.intel')]};
  const [title,caption,node]=panels[kind];
  if(game.state==='running'){game.pause();sheetPaused=true;}
  const marker=document.createComment('sheet home');node.before(marker);sheetMove={node,marker};$('sheet-body').append(node);
  putText('sheet-title',title);putText('sheet-caption',caption);putText('sheet-eyebrow',sheetPaused?'COMBAT EN PAUSE · PRENEZ VOTRE TEMPS':`${format(game.gold)} CRÉDITS DISPONIBLES`);
  $('tactical-sheet').showModal();$('tactical-sheet').scrollTop=0;updateUI();
}
function closeSheet(){
  if(!sheetKind)return;
  if(sheetMove){sheetMove.marker.replaceWith(sheetMove.node);sheetMove=null;}
  sheetKind=null;if($('tactical-sheet').open)$('tactical-sheet').close();
  if(sheetPaused&&game?.state==='paused'&&!document.hidden)game.pause();sheetPaused=false;
  if(game)updateUI();
}
function updateMobileUI(){
  if(!mobile())return;
  if(sheetKind&&!sheetPaused)putText('sheet-eyebrow',`${format(game.gold)} CRÉDITS DISPONIBLES`);
  const placing=Boolean(selectedType||selectedAbility),ended=['won','lost'].includes(game.state);
  $('mobile-dock').classList.toggle('placing',placing);$('placement-bar').hidden=!placing;$('mobile-actions').hidden=placing;
  $('mobile-build').disabled=ended;$('mobile-powers').disabled=game.state!=='running'&&!(sheetPaused&&game.state==='paused');
  const waveLabel=game.state==='prep'?`Vague ${game.wave+1} ▶`:game.state==='running'?'Pause Ⅱ':game.state==='paused'?'Reprendre ▶':'Résultat ↗';
  putText('mobile-wave',waveLabel);$('mobile-wave').setAttribute('aria-label',game.state==='prep'?`Lancer la vague ${game.wave+1}`:game.state==='running'?'Mettre en pause':game.state==='paused'?'Reprendre le combat':'Voir le résultat');
  putText('mobile-wave-summary',`${game.state==='prep'?'À venir':'Vague '+game.wave} · ${$('enemy-count').textContent}`);
  $('zoom-out').disabled=renderer.camera.zoom<=1.01;$('zoom-in').disabled=renderer.camera.zoom>=2.49;
  if(placing){
    const valid=selectedType?pendingPoint&&game.canBuild(pendingPoint)&&game.gold>=TOWERS[selectedType].cost:pendingPoint&&game.state==='running'&&game.cooldowns[selectedAbility]<=0;
    putText('placement-title',selectedType?TOWERS[selectedType].name:ABILITIES[selectedAbility].name);
    putText('placement-detail',!pendingPoint?'Touchez le terrain pour choisir la position.':valid?'La zone indique la portée. Confirmez ci-dessous.':selectedType?'Emplacement bloqué ou crédits insuffisants.':'Reprenez le combat pour utiliser ce pouvoir.');
    putText('placement-confirm',selectedType?`Construire · ${TOWERS[selectedType].cost} crédits`:'Déclencher le pouvoir');$('placement-confirm').disabled=!valid;
    putText('board-hint','Pincez pour zoomer · glissez pour déplacer');
  }else putText('board-hint',selectedId?'Touchez une tour pour l’améliorer.':game.state==='prep'?'Construisez près des virages.':'Touchez une tour pour l’améliorer.');
}
function showBattleMenu(){
  openModal(`${modalHeader(game.map.name)}<p class="modal-lead">${DIFFICULTIES[game.difficulty].name} · Vague ${game.wave} / ${game.endless?'∞':game.map.waves}</p><div class="battle-menu-grid"><button data-menu="guide">Guide tactile</button><button data-menu="settings">Réglages</button><button data-menu="codex">Encyclopédie</button><button data-menu="view">Recentrer la vue</button><button data-menu="restart">Recommencer</button><button data-menu="campaign">Campagne</button></div><div class="modal-actions"><button class="primary-btn" data-close>Revenir au terrain</button></div>`);
  document.querySelectorAll('[data-menu]').forEach(el=>el.onclick=()=>{const action=el.dataset.menu;if(action==='settings')showSettings();if(action==='guide')showHelp();if(action==='codex')showCodex();if(action==='view'){renderer.camera.reset();closeModal();}if(action==='restart')$('restart').click();if(action==='campaign'){closeModal();requestCampaign();}});
}
$('mobile-build').onclick=()=>{deselect();openSheet('build');};$('mobile-powers').onclick=()=>{deselect();openSheet('powers');};$('mobile-intel').onclick=()=>openSheet('intel');
$('mobile-wave').onclick=()=>{if(['won','lost'].includes(game.state))showResult();else launchWave();};$('battle-menu').onclick=showBattleMenu;
$('placement-confirm').onclick=confirmPlacement;$('placement-cancel').onclick=deselect;$('sheet-close').onclick=closeSheet;
$('tactical-sheet').addEventListener('cancel',e=>{e.preventDefault();closeSheet();});$('tactical-sheet').addEventListener('close',()=>{if(!$('tactical-sheet').open)closeSheet();});
$('tactical-sheet').addEventListener('click',e=>{if(e.target===$('tactical-sheet')){const r=e.target.getBoundingClientRect();if(e.clientY<r.top||e.clientX<r.left||e.clientX>r.right)closeSheet();}});
$('zoom-in').onclick=()=>{renderer.camera.zoomAt(renderer.camera.zoom+.3);updateUI();};$('zoom-out').onclick=()=>{renderer.camera.zoomAt(renderer.camera.zoom-.3);updateUI();};$('zoom-reset').onclick=()=>{renderer.camera.reset();updateUI();};
mobileMedia.addEventListener('change',()=>{closeSheet();deselect();gesture.cancel();requestAnimationFrame(()=>renderer.resize());});

$('mission-grid').onclick=e=>{const el=e.target.closest('[data-map]');if(!el)return;currentMap=Number(el.dataset.map);sound.init();sound.play('click');renderCampaign();};
$('deploy').onclick=()=>{if(savedGame)confirmModal('Déployer une nouvelle défense ?',`Le point de reprise de ${savedGame.map.name}, vague ${savedGame.wave+1}, sera remplacé. Vos médailles et secteurs débloqués sont conservés.`,'Déployer',()=>startMission());else startMission();};
$('resume').onclick=()=>startMission(true);$('back-campaign').onclick=requestCampaign;$('brand-home').onclick=requestCampaign;$('campaign-nav').onclick=requestCampaign;
$('tower-grid').onclick=e=>{const el=e.target.closest('[data-tower]');if(el)selectTowerType(el.dataset.tower);};
$('abilities').onclick=e=>{const el=e.target.closest('[data-ability]');if(el)selectAbility(el.dataset.ability);};
$('selection-panel').onclick=e=>{if(!game)return;const btn=e.target.closest('[data-upgrade]');if(btn){if(game.upgrade(selectedId,btn.dataset.upgrade==='normal'?null:Number(btn.dataset.upgrade))){selectionKey='';saveCheckpoint();updateUI();}else toast('Amélioration indisponible.',true);}if(e.target.closest('#sell-tower')){const sell=()=>{game.sell(selectedId);closeSheet();sound.play('click');deselect();saveCheckpoint();};if(mobile())confirmModal('Revendre cette tour ?','Vous récupérez 70 % des crédits investis.','Revendre',sell);else sell();}if(e.target.closest('#cancel-build'))deselect();};
$('selection-panel').onchange=e=>{if(e.target.id==='priority'){game.setPriority(selectedId,e.target.value);saveCheckpoint();}};
const gesture=new BoardGesture(renderer.camera,p=>{sound.init();actOnBoard(p);});
$('battlefield').addEventListener('pointerdown',e=>{if(e.button!==0)return;$('battlefield').setPointerCapture(e.pointerId);gesture.down(e.pointerId,renderer.local(e));});
$('battlefield').addEventListener('pointermove',e=>{gesture.move(e.pointerId,renderer.local(e));if(!mobile()&&!gesture.points.size)renderer.hover=renderer.point(e);});
$('battlefield').addEventListener('pointerup',e=>{if(e.button===0)gesture.up(e.pointerId,renderer.local(e));});
$('battlefield').addEventListener('pointercancel',e=>gesture.up(e.pointerId,renderer.local(e),true));
$('battlefield').addEventListener('lostpointercapture',e=>{if(gesture.points.has(e.pointerId))gesture.up(e.pointerId,renderer.local(e),true);});
$('battlefield').addEventListener('pointerleave',()=>{if(!pendingPoint)renderer.hover=null;});
$('battlefield').addEventListener('contextmenu',e=>{e.preventDefault();deselect();});
$('next-wave').onclick=launchWave;$('pause').onclick=()=>{game?.pause();updateUI();};$('resume-battle').onclick=()=>{game?.pause();updateUI();};$('speed').onclick=cycleSpeed;
$('restart').onclick=()=>{if(game)confirmModal('Recommencer la mission ?','Votre défense actuelle sera remplacée par une nouvelle partie sur ce terrain. Les médailles déjà acquises sont conservées.','Recommencer',()=>{$('difficulty').value=game.difficulty;$('mode').value=game.endless?'endless':'campaign';startMission();});};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game-screen').requestFullscreen();}catch{toast('Le plein écran n’est pas disponible dans ce navigateur.');}};
$('settings-open').onclick=showSettings;$('sound-toggle').onclick=()=>{profile.settings.sound=!profile.settings.sound;applySettings();};$('codex-open').onclick=()=>showCodex();$('help-open').onclick=()=>showHelp();
$('enemy-preview').onclick=e=>{const el=e.target.closest('[data-enemy]');if(el){const enemy=ENEMIES[el.dataset.enemy];openModal(`${modalHeader(enemy.name)}<p class="modal-lead">${enemy.desc}</p><div class="modal-actions"><button class="primary-btn" data-close>Compris</button></div>`);}};
$('modal-content').onclick=e=>{if(e.target.closest('[data-close]'))closeModal();const tab=e.target.closest('[data-codex-tab]');if(tab)showCodex(tab.dataset.codexTab);};
$('modal').addEventListener('click',e=>{if(e.target===$('modal')){const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
document.addEventListener('keydown',e=>{
  if($('modal').open||$('tactical-sheet').open)return;if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  if(e.key==='?'){e.preventDefault();showHelp();return;}if(!game||$('game-screen').hidden)return;
  const k=e.key.toLowerCase();
  if(e.repeat&&!['arrowup','arrowdown','arrowleft','arrowright'].includes(k))return;
  if(k==='escape'){e.preventDefault();if(selectedType||selectedId||selectedAbility)deselect();else if(game.state==='running'||game.state==='paused'){game.pause();updateUI();}return;}
  if(k===' '){e.preventDefault();launchWave();return;}if(k==='x'){cycleSpeed();return;}
  if(/^[1-6]$/.test(k)){selectTowerType(TOWER_IDS[Number(k)-1]);return;}
  if(['q','w','e'].includes(k)){selectAbility({q:'strike',w:'freeze',e:'overdrive'}[k]);return;}
  if(k==='u'&&selectedId){const t=game.towers.find(t=>t.id===selectedId);if(t&&t.level<3&&game.upgrade(t.id)){selectionKey='';saveCheckpoint();updateUI();}return;}
  if(['arrowup','arrowdown','arrowleft','arrowright'].includes(k)){e.preventDefault();const v=renderer.camera.project(keyPoint);v.x+=k==='arrowleft'?-56:k==='arrowright'?56:0;v.y+=k==='arrowup'?-56:k==='arrowdown'?56:0;keyPoint=renderer.camera.unproject(v);keyPoint={x:Math.max(84,Math.min(WORLD.w-84,keyPoint.x)),y:Math.max(84,Math.min(WORLD.h-84,keyPoint.y))};renderer.hover=keyPoint;$('battlefield').focus({preventScroll:true});return;}
  if(k==='enter'&&document.activeElement===$('battlefield')){e.preventDefault();actOnBoard(keyPoint);}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){gesture.cancel();sheetPaused=false;modalPaused=false;}if(document.hidden&&game?.state==='running'){game.pause();updateUI();}if(document.hidden)sound.stopMusic();else if(game&&profile.settings.music)sound.startMusic();accumulator=0;lastTime=0;});
window.addEventListener('pagehide',()=>{saveCheckpoint();});
function frame(timestamp){
  const dt=lastTime?Math.min((timestamp-lastTime)/1000,.2):0;lastTime=timestamp;
  if(game&&!$('game-screen').hidden&&!document.hidden){
    if(game.state==='running'){accumulator+=dt*speed;let steps=0;while(accumulator>=1/60&&steps<36){game.update(1/60);accumulator-=1/60;steps++;if(game.state!=='running'){accumulator=0;break;}}}else accumulator=0;
    drawElapsed+=dt;
    const limit=profile.settings.battery||game.state!=='running'?1/30:1/60;
    if(drawElapsed>=limit-.001){renderer.draw(lastDrawTime?(timestamp-lastDrawTime)/1000:0);lastDrawTime=timestamp;drawElapsed%=limit;}
    uiElapsed+=dt;if(uiElapsed>=.15){updateUI();uiElapsed=0;}
  }
  requestAnimationFrame(frame);
}
renderCampaign();requestAnimationFrame(frame);
