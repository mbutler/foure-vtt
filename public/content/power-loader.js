/**
 * Power Loader for 4e Compendium JSON files
 * Converts Foundry VTT 4e Compendium power format to our internal format
 */

import { POWER_TYPES, ACTION_TYPES } from './powers.js'

/**
 * Maps Foundry action types to our action types
 */
const ACTION_TYPE_MAP = {
  'standard': ACTION_TYPES.STANDARD,
  'move': ACTION_TYPES.MOVE,
  'minor': ACTION_TYPES.MINOR,
  'free': ACTION_TYPES.FREE,
  'interrupt': ACTION_TYPES.IMMEDIATE_INTERRUPT,
  'reaction': ACTION_TYPES.IMMEDIATE_REACTION,
  'opportunity': ACTION_TYPES.OPPORTUNITY
}

/**
 * Maps Foundry use types to our power types
 */
const USE_TYPE_MAP = {
  'atwill': POWER_TYPES.AT_WILL,
  'encounter': POWER_TYPES.ENCOUNTER,
  'daily': POWER_TYPES.DAILY,
  'utility': POWER_TYPES.UTILITY
}

/**
 * Maps Foundry ability abbreviations to full names
 */
const ABILITY_MAP = {
  'str': 'STR',
  'dex': 'DEX',
  'con': 'CON',
  'int': 'INT',
  'wis': 'WIS',
  'cha': 'CHA'
}

/**
 * Maps Foundry defense abbreviations to full names
 */
const DEFENSE_MAP = {
  'ac': 'AC',
  'fort': 'Fort',
  'ref': 'Ref',
  'will': 'Will'
}

/**
 * Parses damage formula from Foundry format
 * @param {string} formula - Foundry damage formula
 * @param {string} baseQuantity - Base quantity
 * @param {string} baseDiceType - Base dice type
 * @returns {Object} Parsed damage specification
 */
function parseDamageFormula(formula, baseQuantity, baseDiceType) {
  // Default damage structure
  const damage = {
    dice: [],
    flat: 0,
    type: 'untyped'
  }

  // Handle weapon damage [W]
  if (baseDiceType === 'weapon') {
    damage.dice.push({ n: parseInt(baseQuantity) || 1, d: 'weapon' })
  } else if (baseDiceType && baseDiceType.startsWith('d')) {
    // Handle specific dice like d6, d8, etc.
    const diceSize = parseInt(baseDiceType.substring(1))
    if (!isNaN(diceSize)) {
      damage.dice.push({ n: parseInt(baseQuantity) || 1, d: diceSize })
    }
  }

  // Parse formula for additional modifiers
  if (formula) {
    // Extract ability modifiers from formula
    const abilityMatch = formula.match(/@powerMod/g)
    if (abilityMatch) {
      // This indicates ability modifier is included
      // We'll handle this in the attack specification
    }
  }

  return damage
}

/**
 * Parses range and area information
 * @param {Object} system - Power system data
 * @returns {Object} Range and target information
 */
function parseRangeAndTarget(system) {
  const result = {
    target: 'single',
    range: 1
  }

  // Parse range type
  if (system.rangeType) {
    switch (system.rangeType) {
      case 'personal':
        result.target = 'self'
        result.range = 0
        break
      case 'melee':
        result.target = 'single'
        result.range = 1
        break
      case 'ranged':
        result.target = 'single'
        result.range = system.range?.value || 10
        break
      case 'closeBlast':
        result.target = 'blast'
        result.range = 1
        result.area = system.area || 1
        break
      case 'closeBurst':
        result.target = 'burst'
        result.range = 1
        result.area = system.area || 1
        break
      case 'area':
        result.target = 'burst'
        result.range = system.range?.value || 10
        result.area = system.area || 1
        break
      default:
        // Try to parse from target description
        if (system.target) {
          const targetText = system.target.toLowerCase()
          if (targetText.includes('burst')) {
            result.target = 'burst'
            result.area = system.area || 1
          } else if (targetText.includes('blast')) {
            result.target = 'blast'
            result.area = system.area || 1
          } else if (targetText.includes('each creature')) {
            result.target = 'burst'
            result.area = system.area || 1
          }
        }
    }
  }

  return result
}

/**
 * Parses attack information
 * @param {Object} system - Power system data
 * @returns {Object} Attack specification
 */
function parseAttack(system) {
  if (!system.attack?.isAttack) {
    return null
  }

  const attack = {
    vs: DEFENSE_MAP[system.attack.def] || 'AC',
    ability: ABILITY_MAP[system.attack.ability] || 'STR',
    proficiency: system.attack.abilityBonus || 0,
    enhancement: 0
  }

  return attack
}

/**
 * Parses hit effects
 * @param {Object} system - Power system data
 * @returns {Object} Hit effects
 */
function parseHitEffects(system) {
  const hit = {}

  // Parse damage
  if (system.hit?.isDamage) {
    hit.damage = parseDamageFormula(
      system.hit.formula,
      system.hit.baseQuantity,
      system.hit.baseDiceType
    )

    // Parse damage type
    if (system.damageType) {
      for (const [type, enabled] of Object.entries(system.damageType)) {
        if (enabled && type !== 'damage' && type !== 'physical') {
          hit.damage.type = type
          break
        }
      }
    }
  }

  // Parse healing
  if (system.hit?.isHealing) {
    hit.healing = {
      formula: system.hit.healFormula || '@details.surgeValue',
      surge: system.hit.healSurge || ''
    }
  }

  // Parse conditions from effect text
  if (system.effect?.detail) {
    const effectText = system.effect.detail.toLowerCase()
    const conditions = []

    // Look for common condition keywords
    if (effectText.includes('slowed')) {
      conditions.push({ id: 'slowed', duration: 'saveEnds' })
    }
    if (effectText.includes('immobilized')) {
      conditions.push({ id: 'immobilized', duration: 'saveEnds' })
    }
    if (effectText.includes('dazed')) {
      conditions.push({ id: 'dazed', duration: 'saveEnds' })
    }
    if (effectText.includes('stunned')) {
      conditions.push({ id: 'stunned', duration: 'saveEnds' })
    }
    if (effectText.includes('weakened')) {
      conditions.push({ id: 'weakened', duration: 'saveEnds' })
    }
    if (effectText.includes('pushed')) {
      const pushMatch = effectText.match(/pushed (\d+)/)
      if (pushMatch) {
        conditions.push({ 
          id: 'pushed', 
          duration: 'saveEnds', 
          data: { squares: parseInt(pushMatch[1]) }
        })
      }
    }

    if (conditions.length > 0) {
      hit.conditions = conditions
    }
  }

  return hit
}

/**
 * Converts a Foundry VTT 4e power to our internal format
 * @param {Object} foundryPower - Power data from Foundry VTT
 * @returns {Object} Converted power in our format
 */
export function convertFoundryPower(foundryPower) {
  const system = foundryPower.system

  // Basic power information
  const powerData = {
    id: foundryPower._id,
    name: foundryPower.name,
    type: USE_TYPE_MAP[system.useType] || POWER_TYPES.AT_WILL,
    action: ACTION_TYPE_MAP[system.actionType] || ACTION_TYPES.STANDARD,
    level: parseInt(system.level) || 1,
    source: system.powersource || 'class',
    keywords: system.keyWords || [],
    requirements: system.requirements || '',
    trigger: system.trigger || '',
    special: system.special || ''
  }

  // Parse range and target
  const rangeInfo = parseRangeAndTarget(system)
  Object.assign(powerData, rangeInfo)

  // Parse attack information
  const attack = parseAttack(system)
  if (attack) {
    powerData.attack = attack
  }

  // Parse hit effects
  const hit = parseHitEffects(system)
  if (Object.keys(hit).length > 0) {
    powerData.hit = hit
  }

  // Parse miss effects
  if (system.miss?.detail) {
    powerData.miss = {
      detail: system.miss.detail
    }
  }

  // Parse sustain information
  if (system.sustain?.actionType && system.sustain.actionType !== 'none') {
    powerData.sustain = {
      action: ACTION_TYPE_MAP[system.sustain.actionType] || ACTION_TYPES.MINOR,
      detail: system.sustain.detail || ''
    }
  }

  // Parse consume information (for powers that cost resources)
  if (system.consume?.type && system.consume.amount) {
    powerData.consume = {
      type: system.consume.type,
      target: system.consume.target,
      amount: system.consume.amount
    }
  }

  // Create the power (simplified version for client-side)
  return {
    ...powerData,
    // Add any additional properties that createPower would add
    id: powerData.id,
    name: powerData.name,
    type: powerData.type,
    action: powerData.action,
    target: powerData.target,
    range: powerData.range,
    area: powerData.area,
    attack: powerData.attack,
    hit: powerData.hit,
    miss: powerData.miss,
    sustain: powerData.sustain,
    consume: powerData.consume,
    level: powerData.level,
    source: powerData.source,
    keywords: powerData.keywords,
    requirements: powerData.requirements,
    trigger: powerData.trigger,
    special: powerData.special
  }
}

/**
 * Loads all powers from a specific directory
 * @param {string} directory - Directory path relative to packs
 * @returns {Array} Array of converted powers
 */
export async function loadPowersFromDirectory(directory) {
  try {
    // In a real implementation, this would read from the filesystem
    // For now, we'll return an empty array and provide a structure
    console.log(`Loading powers from ${directory}`)
    return []
  } catch (error) {
    console.error(`Error loading powers from ${directory}:`, error)
    return []
  }
}

/**
 * Loads core powers (basic attacks, etc.)
 * @returns {Array} Array of core powers
 */
export async function loadCorePowers() {
  return loadPowersFromDirectory('packs/powers_core/_source')
}

/**
 * Loads class powers
 * @returns {Array} Array of class powers
 */
export async function loadClassPowers() {
  return loadPowersFromDirectory('packs/powers/_source')
}

/**
 * Loads all available powers
 * @returns {Object} Object with power categories
 */
export async function loadAllPowers() {
  const [corePowers, classPowers] = await Promise.all([
    loadCorePowers(),
    loadClassPowers()
  ])

  return {
    core: corePowers,
    class: classPowers,
    all: [...corePowers, ...classPowers]
  }
}

/**
 * Finds a power by ID
 * @param {string} powerId - Power ID to find
 * @param {Array} powers - Array of powers to search
 * @returns {Object|null} Found power or null
 */
export function findPowerById(powerId, powers) {
  return powers.find(power => power.id === powerId) || null
}

/**
 * Finds powers by class
 * @param {string} className - Class name to filter by
 * @param {Array} powers - Array of powers to search
 * @returns {Array} Array of powers for the class
 */
export function findPowersByClass(className, powers) {
  return powers.filter(power => 
    power.source.toLowerCase() === className.toLowerCase() ||
    power.name.toLowerCase().includes(className.toLowerCase())
  )
}

/**
 * Finds powers by level
 * @param {number} level - Level to filter by
 * @param {Array} powers - Array of powers to search
 * @returns {Array} Array of powers for the level
 */
export function findPowersByLevel(level, powers) {
  return powers.filter(power => power.level === level)
}

/**
 * Finds powers by type
 * @param {string} type - Power type to filter by
 * @param {Array} powers - Array of powers to search
 * @returns {Array} Array of powers of the specified type
 */
export function findPowersByType(type, powers) {
  return powers.filter(power => power.type === type)
}
