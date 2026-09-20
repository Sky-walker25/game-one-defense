export const VERSION = 1;
export const WORLD = { w: 1120, h: 672, cell: 56 };
export const DIFFICULTIES = {
  recruit: { name: 'Recrue', hp: .78, speed: .92, gold: 1.15, reward: 1.08, lives: 25, desc: 'Le temps d’apprendre et d’expérimenter.' },
  veteran: { name: 'Vétéran', hp: 1, speed: 1, gold: 1, reward: 1, lives: 20, desc: 'L’équilibre tactique de la campagne.' },
  elite: { name: 'Élite', hp: 1.75, speed: 1.15, gold: .9, reward: .85, lives: 15, desc: 'Chaque crédit et chaque position comptent.' }
};
export const TOWERS = {
  cannon: { name: 'Sentinelle', role: 'Canon polyvalent', cost: 90, damage: 23, range: 154, rate: .78, color: '#e2c58d', icon: 'cannon', air: true, type: 'kinetic', desc: 'Un canon fiable. Efficace contre les petites unités et les drones.', branches: [
    { name: 'Bastion', desc: 'Obus explosifs : dégâts de zone sur 52 m.', damage: 1.3, splash: 52, rate: 1.12 },
    { name: 'Vulcain', desc: 'Cadence doublée, idéale contre les essaims.', damage: .8, rate: .42 }
  ]},
  sniper: { name: 'Longue-vue', role: 'Précision · antiblindage', cost: 150, damage: 90, range: 245, rate: 2.2, color: '#b3cead', icon: 'crosshair', air: true, type: 'pierce', desc: 'Grande portée. Ignore le blindage, mais tire lentement.', branches: [
    { name: 'Exécuteur', desc: 'Dégâts ×1,8. Achève les cibles à moins de 15 % de vie.', damage: 1.8, execute: .15, rate: 1.12 },
    { name: 'Éclaireur', desc: 'Portée +30 %, cadence +45 %, révèle les spectres.', range: 1.3, rate: .69, reveal: true }
  ]},
  flame: { name: 'Fournaise', role: 'Zone · brûlure', cost: 130, damage: 16, range: 121, rate: .35, color: '#eea26f', icon: 'flame', air: false, type: 'fire', splash: 43, burn: 8, desc: 'Embrase les groupes au sol. La brûlure continue après le passage.', branches: [
    { name: 'Napalm', desc: 'Brûlure triplée et zone agrandie.', damage: 1.1, burn: 28, splash: 62 },
    { name: 'Plasma', desc: 'Dégâts ×2 et portée +20 %. Touche aussi les volants.', damage: 2, range: 1.2, air: true, burn: 10 }
  ]},
  frost: { name: 'Cryogène', role: 'Contrôle · ralentissement', cost: 140, damage: 12, range: 147, rate: 1, color: '#8fdcdd', icon: 'snow', air: true, type: 'energy', splash: 38, slow: .45, desc: 'Ralentit les ennemis de 45 %. Les boss résistent en partie au gel.', branches: [
    { name: 'Zéro absolu', desc: 'Ralentissement de 70 % et zone de 64 m.', slow: .70, splash: 64, damage: 1.2 },
    { name: 'Fragilité', desc: 'Les cibles subissent 35 % de dégâts supplémentaires.', slow: .40, vuln: .35, damage: 2 }
  ]},
  tesla: { name: 'Orage', role: 'Énergie · arcs en chaîne', cost: 165, damage: 31, range: 149, rate: 1.15, color: '#b5a3ef', icon: 'bolt', air: true, type: 'energy', chain: 3, desc: 'Un arc relie trois cibles proches. Excellent contre les boucliers.', branches: [
    { name: 'Tempête', desc: 'Les arcs frappent jusqu’à 6 cibles.', chain: 6, damage: 1.35 },
    { name: 'Surcharge', desc: 'Dégâts ×2,2 et boucliers neutralisés.', chain: 2, damage: 2.2, emp: true }
  ]},
  support: { name: 'Relais', role: 'Soutien · amplification', cost: 120, damage: 0, range: 159, rate: 1, color: '#c8ee8b', icon: 'radar', air: true, type: 'support', buff: .22, desc: 'Les tours proches infligent 22 % de dégâts en plus. Les auras ne se cumulent pas.', branches: [
    { name: 'Commandement', desc: 'Bonus de dégâts porté à 45 % et portée +25 %.', buff: .45, range: 1.25 },
    { name: 'Logistique', desc: 'Bonus de 28 % et 35 crédits à chaque vague terminée.', buff: .28, income: 35 }
  ]}
};
export const TOWER_IDS = Object.keys(TOWERS);
export const ENEMIES = {
  crawler: { name: 'Éclaireur', hp: 62, speed: 50, bounty: 8, size: 11, color: '#db9979', shape: 'bug', desc: 'Unité légère. Arrive en groupes.' },
  runner: { name: 'Traqueur', hp: 46, speed: 92, bounty: 8, size: 9, color: '#e6c078', shape: 'runner', desc: 'Très rapide, mais fragile. Ralentissez-le.' },
  tank: { name: 'Cuirassé', hp: 230, speed: 31, bounty: 18, size: 17, color: '#c39787', shape: 'tank', armor: .5, desc: 'Blindage : 50 % de résistance aux obus. Utilisez la précision ou l’énergie.' },
  flyer: { name: 'Drone', hp: 90, speed: 67, bounty: 11, size: 13, color: '#dac898', shape: 'flyer', flying: true, desc: 'Suit un corridor aérien direct. Insensible au lance-flammes de base.' },
  shield: { name: 'Égide', hp: 135, shield: 125, speed: 40, bounty: 17, size: 15, color: '#89c7d6', shape: 'shield', desc: 'Protégé par un bouclier. Les armes à énergie l’endommagent deux fois plus vite.' },
  medic: { name: 'Tisseur', hp: 140, speed: 37, bounty: 20, size: 13, color: '#acd09a', shape: 'medic', heal: 10, desc: 'Soigne les alliés proches chaque seconde. À éliminer en priorité.' },
  splitter: { name: 'Colonie', hp: 155, speed: 41, bounty: 15, size: 16, color: '#cfad72', shape: 'splitter', split: true, desc: 'Libère trois larves à sa destruction. Prévoyez des dégâts de zone.' },
  larva: { name: 'Larve', hp: 23, speed: 78, bounty: 2, size: 7, color: '#d5bc86', shape: 'bug', desc: 'Petite et rapide. Issue d’une colonie.' },
  ghost: { name: 'Spectre', hp: 115, speed: 62, bounty: 15, size: 12, color: '#b8aedc', shape: 'ghost', phase: true, desc: 'S’efface deux secondes sur cinq. Les relais proches le révèlent.' },
  brute: { name: 'Bélier', hp: 430, speed: 26, bounty: 27, size: 20, color: '#c28270', shape: 'brute', armor: .25, leak: 3, desc: 'Très résistant. Retire trois points au réacteur s’il passe.' },
  boss1: { name: 'Le Colosse', hp: 2500, speed: 19, bounty: 180, size: 31, color: '#d3916c', shape: 'boss', boss: true, armor: .30, leak: 15, ability: 'spawn', desc: 'Annonce puis libère des éclaireurs. Gardez une défense de zone.' },
  boss2: { name: 'La Matriarche', hp: 3700, shield: 600, speed: 21, bounty: 230, size: 30, color: '#ceaa73', shape: 'boss', boss: true, leak: 15, ability: 'shield', desc: 'Annonce une recharge de bouclier. Les arcs électriques percent sa garde.' },
  boss3: { name: 'Némésis', hp: 5300, speed: 20, bounty: 300, size: 34, color: '#b8addd', shape: 'boss', boss: true, armor: .2, leak: 20, ability: 'jam', desc: 'Annonce une impulsion qui suspend les tours proches pendant trois secondes.' }
};
export const BIOMES = {
  forest: { name: 'Les Marches vertes', base: '#344940', light: '#526a4c', dark: '#20372f', road: '#8c9380', edge: '#535f51', accent: '#c8ee8b', tree: '#244738' },
  desert: { name: 'Les Terres de cendre', base: '#73634b', light: '#9b865f', dark: '#524b3e', road: '#bba77c', edge: '#7d725a', accent: '#efc085', tree: '#71634d' },
  ice: { name: 'La Couronne de givre', base: '#516e74', light: '#87a4a4', dark: '#354f58', road: '#a4bcb6', edge: '#657f84', accent: '#b7e5e1', tree: '#3c6469' }
};
export const MAPS = [
  { id: 0, name: 'Lisière', subtitle: 'Le premier rempart', biome: 'forest', waves: 15, gold: 430, unlock: 0, seed: 71, desc: 'Un ancien axe de ravitaillement traverse la forêt. Sécurisez les virages et protégez le réacteur.', tip: 'Les virages permettent à une tour de tirer plus longtemps.', paths: [[[-1,3],[4,3],[4,8],[10,8],[10,3],[15,3],[15,6],[19,6]]], air: [[[-1,3],[19,6]]], reactor: [18.3,6], boss: null },
  { id: 1, name: 'Le Passage', subtitle: 'Tenir les deux fronts', biome: 'forest', waves: 18, gold: 560, unlock: 1, seed: 156, desc: 'Deux routes convergent vers le bastion. Le Colosse ouvre la marche des forces lourdes.', tip: 'Une batterie centrale peut couvrir les deux voies.', paths: [[[-1,2],[5,2],[5,5],[12,5],[12,8],[19,8]],[[-1,9],[8,9],[8,5],[12,5],[12,8],[19,8]]], air: [[[-1,2],[19,8]],[[-1,9],[19,8]]], reactor:[18.3,8], boss: 'boss1' },
  { id: 2, name: 'Dunes rouges', subtitle: 'Sous le sable, l’essaim', biome: 'desert', waves: 20, gold: 600, unlock: 2, seed: 97, desc: 'L’ennemi se multiplie entre les ruines d’une raffinerie. Les longues lignes droites favorisent la précision.', tip: 'Une Fournaise au bon endroit peut contenir une colonie entière.', paths: [[[-1,8],[4,8],[4,3],[10,3],[10,8],[16,8],[16,4],[19,4]]], air: [[[-1,8],[19,4]]], reactor:[18.3,4], boss: null },
  { id: 3, name: 'Le Creuset', subtitle: 'Briser la Matriarche', biome: 'desert', waves: 22, gold: 680, unlock: 3, seed: 302, desc: 'Trois colonnes hostiles encerclent le site. La Matriarche protège son essaim derrière un champ d’énergie.', tip: 'Les arcs d’Orage infligent des dégâts doublés aux boucliers.', paths: [[[-1,2],[5,2],[5,5],[11,5],[11,8],[19,8]],[[-1,9],[7,9],[7,5],[11,5],[11,8],[19,8]],[[10,-1],[10,2],[15,2],[15,8],[19,8]]], air: [[[-1,2],[19,8]],[[10,-1],[19,8]]], reactor:[18.3,8], boss:'boss2' },
  { id: 4, name: 'Silence blanc', subtitle: 'L’offensive invisible', biome: 'ice', waves: 23, gold: 720, unlock: 4, seed: 442, desc: 'Les spectres avancent dans le brouillard polaire. Établissez un réseau de relais pour maintenir le contact.', tip: 'Un Relais révèle les spectres dans son rayon d’action.', paths: [[[-1,3],[5,3],[5,8],[11,8],[11,3],[16,3],[16,7],[19,7]],[[-1,9],[3,9],[3,6],[8,6],[8,3],[16,3],[16,7],[19,7]]], air:[[[-1,3],[19,7]],[[-1,9],[19,7]]], reactor:[18.3,7], boss:null },
  { id: 5, name: 'Dernière lumière', subtitle: 'Le cœur de la résistance', biome: 'ice', waves: 25, gold: 820, unlock: 5, seed: 718, desc: 'Némésis approche. Toutes les forces ennemies convergent. Le dernier réacteur doit tenir.', tip: 'Espacez vos batteries pour résister à l’impulsion de Némésis.', paths:[[[-1,2],[4,2],[4,5],[10,5],[10,8],[19,8]],[[-1,10],[6,10],[6,5],[10,5],[10,8],[19,8]],[[12,-1],[12,2],[16,2],[16,8],[19,8]]], air:[[[-1,2],[19,8]],[[-1,10],[19,8]],[[12,-1],[19,8]]], reactor:[18.3,8], boss:'boss3' }
];
export const ABILITIES = {
  strike: { name: 'Frappe orbitale', short: 'Frappe', key: 'Q', cooldown: 55, radius: 112, color: '#f0ac7d', desc: '320 dégâts dans une zone ciblée. Ignore le blindage.' },
  freeze: { name: 'Stase', short: 'Stase', key: 'W', cooldown: 42, radius: 170, color: '#94e0dd', desc: 'Immobilise les ennemis de la zone pendant 4 secondes (2 s pour les boss).' },
  overdrive: { name: 'Surcadence', short: 'Surcadence', key: 'E', cooldown: 65, radius: 0, color: '#c8ee8b', desc: 'Toutes les tours tirent 60 % plus vite pendant 10 secondes.' }
};
export const toPoint = ([x,y]) => ({ x: x * WORLD.cell + WORLD.cell / 2, y: y * WORLD.cell + WORLD.cell / 2 });
export function seeded(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
export function wavePlan(mapId, wave, endless = false) {
  const map = MAPS[mapId];
  const list = [];
  const add = (type, count, interval = .8) => { for (let i=0;i<count;i++) list.push({ type, gap: interval }); };
  const tier = Math.min(9, wave + mapId * 2);
  const n = Math.round(6 + wave * 1.10 + mapId * 1.5);
  const patterns = [
    () => { add('crawler', n, .66); if(tier>5)add('runner',Math.ceil(n*.35),.42); },
    () => { add('runner',Math.ceil(n*.7),.55); add('crawler',Math.ceil(n*.45),.8); },
    () => { add('crawler',Math.ceil(n*.5),.7); add('tank',Math.ceil(n*.23),1.6); },
    () => { add('flyer',Math.ceil(n*.55),.95); add('runner',Math.ceil(n*.4),.6); },
    () => { add('shield',Math.ceil(n*.28),1.2); add('crawler',Math.ceil(n*.6),.55); if(tier>7)add('medic',2,1.6); },
    () => { add('splitter',Math.ceil(n*.3),1.2); add('runner',Math.ceil(n*.45),.55); },
    () => { add('tank',Math.ceil(n*.22),1.4); add('medic',Math.ceil(n*.1),1.5); add('crawler',Math.ceil(n*.6),.55); },
    () => { add(mapId>=3?'ghost':'flyer',Math.ceil(n*.45),.7); add('shield',Math.ceil(n*.28),1.3); },
    () => { add('brute',Math.max(1,Math.ceil(n*.13)),1.8); add('runner',Math.ceil(n*.55),.45); add('splitter',Math.ceil(n*.15),1.1); }
  ];
  if(wave===1) add('crawler',6+mapId*2,1.25);
  else if(wave===2) {add('crawler',5+mapId,1); add('runner',4+mapId,.8);}
  else patterns[(wave-3)%Math.min(tier,patterns.length)]();
  if(wave % 5 === 0 && wave < map.waves) add(wave>=10?'brute':'tank',1+Math.floor(mapId/2),1.8);
  if((wave===map.waves && map.boss) || (endless && wave>map.waves && (wave-map.waves)%10===0)) { list.splice(Math.floor(list.length/3),0,{type:map.boss||'boss1',gap:3}); }
  if(wave===map.waves && !map.boss) add('brute',2+mapId,1.5);
  return list;
}
export function waveSummary(mapId,wave,endless=false) {
  const counts={}; for(const e of wavePlan(mapId,wave,endless)) counts[e.type]=(counts[e.type]||0)+1;
  return Object.entries(counts).map(([type,count])=>({type,count,...ENEMIES[type]}));
}
