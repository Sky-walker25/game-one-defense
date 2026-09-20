import { VERSION, MAPS } from './data.js';
export const SAVE_KEY='bastion-save-v1';
export const PROFILE_KEY='bastion-profile-v1';
const defaultProfile=()=>({version:VERSION,medals:{},bestWaves:{},wins:0,kills:0,tutorial:false,settings:{sound:true,music:true,volume:.55,particles:true,motion:true}});
export function readProfile(storage) {
  try {
    storage??=globalThis.localStorage;
    const p=JSON.parse(storage.getItem(PROFILE_KEY)); if(!p||p.version!==VERSION)return defaultProfile();
    const result=defaultProfile();
    for(const map of MAPS){const n=p.medals?.[map.id];if(Number.isInteger(n)&&n>=1&&n<=3)result.medals[map.id]=n;}
    for(const [k,v] of Object.entries(p.bestWaves||{}))if(Number.isInteger(v)&&v>=0&&v<=10000)result.bestWaves[k]=v;
    for(const k of ['wins','kills'])if(Number.isFinite(p[k])&&p[k]>=0)result[k]=p[k];
    result.tutorial=!!p.tutorial;
    for(const k of ['sound','music','particles','motion'])if(typeof p.settings?.[k]==='boolean')result.settings[k]=p.settings[k];
    if(Number.isFinite(p.settings?.volume))result.settings.volume=Math.max(0,Math.min(1,p.settings.volume));return result;
  }catch{return defaultProfile();}
}
export function writeProfile(profile,storage){try{storage??=globalThis.localStorage;storage.setItem(PROFILE_KEY,JSON.stringify(profile));return true;}catch{return false;}}
export function readSave(storage){try{storage??=globalThis.localStorage;return JSON.parse(storage.getItem(SAVE_KEY));}catch{return null;}}
export function writeSave(save,storage){try{storage??=globalThis.localStorage;if(save)storage.setItem(SAVE_KEY,JSON.stringify(save));else storage.removeItem(SAVE_KEY);return true;}catch{return false;}}
export function recordResult(profile,game) {
  profile.kills+=game.kills;
  if(game.endless)profile.bestWaves[game.map.id]=Math.max(profile.bestWaves[game.map.id]||0,game.wave-(game.state==='lost'?1:0));
  else if(game.state==='won'){profile.medals[game.map.id]=Math.max(profile.medals[game.map.id]||0,game.medal());profile.wins++;}
}
