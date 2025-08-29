import { test, expect } from "bun:test"
import { convertFoundryPower, findPowerById, findPowersByClass, findPowersByLevel, findPowersByType } from '../public/content/power-loader.js'

// Sample Foundry VTT power data for testing
const sampleFoundryPower = {
  "_id": "OgXLUlMC0yOkiPSZ",
  "name": "Melee Basic Attack",
  "type": "power",
  "system": {
    "description": {
      "value": "<p class=\"flavour\"><em>You resort to the simple attack you learned when you first picked up a melee weapon.</em></p>\n<p class=\"power-basics\"><strong>At-Will ✦ Weapon</strong></p>\n<p class=\"power-basics\"><strong>Standard Action</strong><strong> &bull; Melee</strong> weapon</p>\n<p class=\"power-basics\"><strong>Target:</strong> One creature</p>\n<p class=\"power-basics\"><strong>Attack:</strong> Strength vs. AC</p>\n<p><strong>Hit:</strong> 1[W] + Strength modifier damage.</p>\n<p>Level 21: 2[W] + Strength modifier damage.</p>",
      "chat": "",
      "unidentified": ""
    },
    "target": "One creature",
    "attack": {
      "shareAttackRoll": false,
      "isAttack": true,
      "isBasic": true,
      "ability": "str",
      "abilityBonus": 0,
      "def": "ac",
      "defBonus": 0,
      "formula": "@wepAttack + @powerMod + @lvhalf",
      "damageType": {},
      "effectType": {}
    },
    "hit": {
      "shareDamageRoll": false,
      "isDamage": true,
      "isHealing": false,
      "healSurge": "",
      "baseQuantity": "1",
      "baseDiceType": "weapon",
      "detail": "1[W] + Strength modifier damage.",
      "formula": "@powBase + @powerMod + @wepDamage",
      "critFormula": "@powMax + @powerMod + @wepDamage + @wepCritBonus",
      "healFormula": ""
    },
    "keyWords": ["Weapon"],
    "level": "",
    "powersource": "",
    "useType": "atwill",
    "actionType": "standard",
    "weaponType": "melee",
    "rangeType": "weapon",
    "area": null,
    "damageType": {
      "damage": false,
      "acid": false,
      "cold": false,
      "fire": false,
      "force": false,
      "lightning": false,
      "necrotic": false,
      "physical": true,
      "poison": false,
      "psychic": false,
      "radiant": false,
      "thunder": false
    }
  }
}

const sampleAreaPower = {
  "_id": "Z40GlhtEu68OLPTn",
  "name": "Wizard 03-Call the Night Winds",
  "type": "power",
  "system": {
    "description": {
      "value": "<p class=\"flavour\"><i>Howling night winds spiral around you, blotting out light, chilling your foes, and heeding your every command.</i></p><p class=\"power-basics\"><b>Encounter ✦ Arcane, Cold, Evocation, Implement, Zone</b></p><p class=\"power-basics\"><b>Standard Action</b><b> &#8226; </b><b>Close</b> blast 5</p><p class=\"power-basics\"><b>Target:</b> Each creature in the blast </p><p class=\"power-basics\"><b>Attack:</b> Intelligence vs. Fortitude </p><p><b>Hit:</b> 2d6 + Intelligence modifier cold damage. </p><p><b>Effect:</b> The blast creates a zone that lasts until the end of your next turn. The zone is heavily obscured to creatures other than you, and any creature but you that starts its turn in the zone is slowed until the end of its next turn. </p>",
      "chat": "",
      "unidentified": ""
    },
    "target": "Each creature in the blast",
    "attack": {
      "shareAttackRoll": false,
      "isAttack": true,
      "ability": "int",
      "abilityBonus": 0,
      "def": "fort",
      "defBonus": 0,
      "formula": "@wepAttack + @powerMod + @lvhalf",
      "damageType": {},
      "effectType": {}
    },
    "hit": {
      "shareDamageRoll": false,
      "isDamage": true,
      "isHealing": false,
      "healSurge": "",
      "baseQuantity": "2",
      "baseDiceType": "d6",
      "detail": "2d6 + Intelligence modifier cold damage.",
      "formula": "@powBase + @powerMod + @wepDamage",
      "critFormula": "@powMax + @powerMod + @wepDamage + @wepCritBonus",
      "healFormula": ""
    },
    "effect": {
      "detail": "The blast creates a zone that lasts until the end of your next turn. The zone is heavily obscured to creatures other than you, and any creature but you that starts its turn in the zone is slowed until the end of its next turn."
    },
    "keyWords": ["Arcane", "Cold", "Evocation", "Implement", "Zone"],
    "level": "3",
    "powersource": "arcane",
    "useType": "encounter",
    "actionType": "standard",
    "weaponType": "implement",
    "rangeType": "closeBlast",
    "area": 5,
    "damageType": {
      "damage": false,
      "acid": false,
      "cold": true,
      "fire": false,
      "force": false,
      "lightning": false,
      "necrotic": false,
      "physical": false,
      "poison": false,
      "psychic": false,
      "radiant": false,
      "thunder": false
    }
  }
}

test('Convert Foundry power - Basic Attack', () => {
  const power = convertFoundryPower(sampleFoundryPower)
  
  expect(power.id).toBe('OgXLUlMC0yOkiPSZ')
  expect(power.name).toBe('Melee Basic Attack')
  expect(power.type).toBe('at-will')
  expect(power.action).toBe('standard')
  expect(power.target).toBe('single')
  expect(power.range).toBe(1)
  expect(power.attack.vs).toBe('AC')
  expect(power.attack.ability).toBe('STR')
  expect(power.hit.damage.dice[0].n).toBe(1)
  expect(power.hit.damage.dice[0].d).toBe('weapon')
  expect(power.hit.damage.type).toBe('untyped')
})

test('Convert Foundry power - Area Attack', () => {
  const power = convertFoundryPower(sampleAreaPower)
  
  expect(power.id).toBe('Z40GlhtEu68OLPTn')
  expect(power.name).toBe('Wizard 03-Call the Night Winds')
  expect(power.type).toBe('encounter')
  expect(power.action).toBe('standard')
  expect(power.target).toBe('blast')
  expect(power.range).toBe(1)
  expect(power.area).toBe(5)
  expect(power.attack.vs).toBe('Fort')
  expect(power.attack.ability).toBe('INT')
  expect(power.hit.damage.dice[0].n).toBe(2)
  expect(power.hit.damage.dice[0].d).toBe(6)
  expect(power.hit.damage.type).toBe('cold')
  expect(power.level).toBe(3)
  expect(power.source).toBe('arcane')
})

test('Power search functions', () => {
  const powers = [
    convertFoundryPower(sampleFoundryPower),
    convertFoundryPower(sampleAreaPower)
  ]
  
  // Test findPowerById
  const foundPower = findPowerById('OgXLUlMC0yOkiPSZ', powers)
  expect(foundPower).toBeDefined()
  expect(foundPower.name).toBe('Melee Basic Attack')
  
  // Test findPowersByClass
  const arcanePowers = findPowersByClass('arcane', powers)
  expect(arcanePowers.length).toBe(1)
  expect(arcanePowers[0].name).toBe('Wizard 03-Call the Night Winds')
  
  // Test findPowersByLevel
  const level3Powers = findPowersByLevel(3, powers)
  expect(level3Powers.length).toBe(1)
  expect(level3Powers[0].name).toBe('Wizard 03-Call the Night Winds')
  
  // Test findPowersByType
  const encounterPowers = findPowersByType('encounter', powers)
  expect(encounterPowers.length).toBe(1)
  expect(encounterPowers[0].name).toBe('Wizard 03-Call the Night Winds')
})

test('Power conversion handles missing data gracefully', () => {
  const minimalPower = {
    "_id": "test",
    "name": "Test Power",
    "system": {
      "useType": "atwill",
      "actionType": "standard"
    }
  }
  
  const power = convertFoundryPower(minimalPower)
  
  expect(power.id).toBe('test')
  expect(power.name).toBe('Test Power')
  expect(power.type).toBe('at-will')
  expect(power.action).toBe('standard')
  expect(power.target).toBe('single')
  expect(power.range).toBe(1)
})

test('Power conversion handles different range types', () => {
  const rangedPower = {
    "_id": "ranged",
    "name": "Ranged Power",
    "system": {
      "useType": "atwill",
      "actionType": "standard",
      "rangeType": "ranged",
      "range": { "value": 20 },
      "attack": { "isAttack": true, "ability": "dex", "def": "ac" },
      "hit": { "isDamage": true, "baseQuantity": "1", "baseDiceType": "d6" }
    }
  }
  
  const power = convertFoundryPower(rangedPower)
  
  expect(power.target).toBe('single')
  expect(power.range).toBe(20)
  expect(power.attack.ability).toBe('DEX')
})

test('Power conversion handles area effects', () => {
  const burstPower = {
    "_id": "burst",
    "name": "Burst Power",
    "system": {
      "useType": "encounter",
      "actionType": "standard",
      "rangeType": "closeBurst",
      "area": 3,
      "attack": { "isAttack": true, "ability": "con", "def": "ref" },
      "hit": { "isDamage": true, "baseQuantity": "2", "baseDiceType": "d8" },
      "effect": { "detail": "Target is slowed and pushed 2 squares" }
    }
  }
  
  const power = convertFoundryPower(burstPower)
  
  expect(power.target).toBe('burst')
  expect(power.range).toBe(1)
  expect(power.area).toBe(3)
  expect(power.hit.damage.dice[0].n).toBe(2)
  expect(power.hit.damage.dice[0].d).toBe(8)
  expect(power.hit.conditions).toBeDefined()
  expect(power.hit.conditions.length).toBeGreaterThan(0)
})
