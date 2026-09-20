import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../src/data.js';
import { simulate } from '../scripts/balance.mjs';

for(const map of MAPS) {
  test(`Campagne complète : ${map.name} est gagnable en Vétéran avec l’économie réelle`,()=>{
    const result=simulate(map.id,'veteran','combined');
    assert.equal(result.state,'won');
    assert.equal(result.wave,map.waves);
    assert.ok(result.lives>0);
    assert.ok(result.g.gold>=0);
    assert.ok(result.g.towers.every(t=>Number.isFinite(t.damage)&&t.level>=1&&t.level<=4));
    assert.equal(result.g.enemies.length,0);
  });
}
test('Le boss final Élite reste gagnable avec une défense spécialisée',()=>{
  const result=simulate(5,'elite','precision');assert.equal(result.state,'won');assert.ok(result.lives>0);
});
test('Le mode survie dépasse la limite de campagne sans déclarer une victoire',()=>{
  const result=simulate(0,'veteran','combined',{endless:true,endWave:25});assert.equal(result.wave,25);assert.equal(result.state,'prep');assert.ok(result.g.startWave());assert.equal(result.g.wave,26);
});
