import { resolveAttack, resolveAttackMulti } from './attacks.js'
import { applyCondition } from './effects.js'
import { applyDamage } from './attacks.js'

/**
 * Power types in D&D 4e
 */
export const POWER_TYPES = {
  AT_WILL: 'at-will',
  ENCOUNTER: 'encounter',
  DAILY: 'daily',
  UTILITY: 'utility'
}

/**
 * Action types for powers
 */
export const ACTION_TYPES = {
  STANDARD: 'standard',
  MOVE: 'move',
  MINOR: 'minor',
  FREE: 'free',
  IMMEDIATE_INTERRUPT: 'immediate-interrupt',
  IMMEDIATE_REACTION: 'immediate-reaction',
  OPPORTUNITY: 'opportunity'
}

/**
 * Creates a basic power definition
 * @param {Object} powerDef - Power definition
 * @returns {Object} Normalized power definition
 */
export const createPower = (powerDef) => {
  return {
    id: powerDef.id,
    name: powerDef.name,
    type: powerDef.type || POWER_TYPES.AT_WILL,
    action: powerDef.action || ACTION_TYPES.STANDARD,
    level: powerDef.level || 1,
    source: powerDef.source || 'class',
    keywords: powerDef.keywords || [],
    target: powerDef.target || 'single',
    range: powerDef.range || 1,
    attack: powerDef.attack || {
      vs: 'AC',
      ability: 'STR',
      proficiency: 0,
      enhancement: 0
    },
    hit: powerDef.hit || {
      damage: { dice: [{ n: 1, d: 6 }], flat: 0, type: 'untyped' }
    },
    miss: powerDef.miss || null,
    effect: powerDef.effect || null,
    sustain: powerDef.sustain || null,
    ...powerDef
  }
}

/**
 * Validates if a power can be used by an actor
 * @param {Object} G - Current game state
 * @param {string} actorId - Actor ID
 * @param {Object} power - Power definition
 * @returns {Object} Validation result with success flag and reason
 */
export const canUsePower = (G, actorId, power) => {
  const actor = G.actors[actorId]
  if (!actor) return { success: false, reason: 'Actor not found' }
  
  // Check if it's the actor's turn
  const currentActorId = G.turn.order[G.turn.index]
  if (actorId !== currentActorId) return { success: false, reason: 'Not your turn' }
  
  // Check action availability
  const actions = G.actions
  if (!actions) return { success: false, reason: 'No actions available' }
  
  switch (power.action) {
    case ACTION_TYPES.STANDARD:
      if (actions.standard <= 0) return { success: false, reason: 'No standard action available' }
      break
    case ACTION_TYPES.MOVE:
      if (actions.move <= 0) return { success: false, reason: 'No move action available' }
      break
    case ACTION_TYPES.MINOR:
      if (actions.minor <= 0) return { success: false, reason: 'No minor action available' }
      break
    case ACTION_TYPES.IMMEDIATE_INTERRUPT:
    case ACTION_TYPES.IMMEDIATE_REACTION:
      if (actions.immediateUsedThisRound) return { success: false, reason: 'Immediate action already used this round' }
      break
    case ACTION_TYPES.OPPORTUNITY:
      // Check if OA already used this turn
      const usage = G.flags?.usage?.[actorId]
      if (usage?.opportunityUsedThisTurn) return { success: false, reason: 'Opportunity action already used this turn' }
      break
  }
  
  // Check encounter/daily usage
  if (power.type === POWER_TYPES.ENCOUNTER) {
    const used = G.flags?.usage?.[actorId]?.encounterPowers?.[power.id]
    if (used) return { success: false, reason: 'Encounter power already used' }
  }
  
  if (power.type === POWER_TYPES.DAILY) {
    const used = G.flags?.usage?.[actorId]?.dailyPowers?.[power.id]
    if (used) return { success: false, reason: 'Daily power already used' }
  }
  
  return { success: true }
}

/**
 * Executes a power against specified targets
 * @param {Object} G - Current game state
 * @param {string} actorId - Actor using the power
 * @param {Object} power - Power definition
 * @param {Array} targets - Array of target actor IDs
 * @param {Object} options - Additional options
 * @returns {Object} Object containing patches to apply
 */
export const executePower = (G, actorId, power, targets, options = {}) => {
  const patches = []
  
  // Validate power usage
  const validation = canUsePower(G, actorId, power)
  if (!validation.success) {
    patches.push({ type: 'log', value: { type: 'power-error', msg: `Cannot use ${power.name}: ${validation.reason}` } })
    return { patches }
  }
  
  // Spend action
  switch (power.action) {
    case ACTION_TYPES.STANDARD:
      patches.push({ type: 'inc', path: 'actions.standard', value: -1 })
      break
    case ACTION_TYPES.MOVE:
      patches.push({ type: 'inc', path: 'actions.move', value: -1 })
      break
    case ACTION_TYPES.MINOR:
      patches.push({ type: 'inc', path: 'actions.minor', value: -1 })
      break
    case ACTION_TYPES.IMMEDIATE_INTERRUPT:
    case ACTION_TYPES.IMMEDIATE_REACTION:
      patches.push({ type: 'set', path: 'actions.immediateUsedThisRound', value: true })
      break
    case ACTION_TYPES.OPPORTUNITY:
      patches.push({ type: 'merge', path: `flags.usage.${actorId}`, value: { opportunityUsedThisTurn: true } })
      break
  }
  
  // Mark encounter/daily power as used
  if (power.type === POWER_TYPES.ENCOUNTER) {
    patches.push({ type: 'merge', path: `flags.usage.${actorId}.encounterPowers`, value: { [power.id]: true } })
  }
  
  if (power.type === POWER_TYPES.DAILY) {
    patches.push({ type: 'merge', path: `flags.usage.${actorId}.dailyPowers`, value: { [power.id]: true } })
  }
  
  // Log power usage
  patches.push({ type: 'log', value: { type: 'power-use', msg: `${actorId} uses ${power.name}`, data: { actorId, powerId: power.id, targets } } })
  
  // Execute attack if power has one
  if (power.attack && targets.length > 0) {
    const attackSpec = {
      ...power.attack,
      kind: power.target === 'single' ? 'single' : 'area',
      origin: power.target === 'single' ? 'melee' : 'area',
      range: power.range
    }
    
    let attackResult
    if (power.target === 'single') {
      const attackCtx = {
        attackerId: actorId,
        defenderId: targets[0],
        powerId: power.id
      }
      attackResult = resolveAttack(G, attackCtx, attackSpec, options)
    } else {
      const attackCtx = {
        attackerId: actorId,
        defenderId: targets[0], // First target for compatibility
        powerId: power.id,
        staged: { targets } // All targets for multi-attack
      }
      attackResult = resolveAttackMulti(G, attackCtx, attackSpec, options)
    }
    
    patches.push(...attackResult.patches)
    
    // Apply hit effects
    if (power.hit) {
      // Apply damage
      if (power.hit.damage) {
        for (const targetId of targets) {
          const damageResult = applyDamage(G, targetId, power.hit.damage, power.hit.damage.type)
          patches.push(...damageResult.patches)
        }
      }
      
      // Apply conditions
      if (power.hit.conditions) {
        for (const condition of power.hit.conditions) {
          for (const targetId of targets) {
            const conditionResult = applyCondition(G, {
              conditionId: condition.id,
              source: actorId,
              target: targetId,
              duration: condition.duration || 'saveEnds',
              data: condition.data || {}
            })
            patches.push(...conditionResult.patches)
          }
        }
      }
    }
  }
  
  // Apply power effects
  if (power.effect) {
    // Handle various effect types
    if (power.effect.type === 'condition') {
      for (const targetId of targets) {
        const effectResult = applyCondition(G, {
          conditionId: power.effect.conditionId,
          source: actorId,
          target: targetId,
          duration: power.effect.duration || 'saveEnds',
          data: power.effect.data || {}
        })
        patches.push(...effectResult.patches)
      }
    }
  }
  
  return { patches }
}

/**
 * Creates some example powers for testing
 */
export const EXAMPLE_POWERS = {
  basicAttack: createPower({
    id: 'basic-attack',
    name: 'Basic Attack',
    type: POWER_TYPES.AT_WILL,
    action: ACTION_TYPES.STANDARD,
    target: 'single',
    range: 1,
    attack: { vs: 'AC', ability: 'STR', proficiency: 3 },
    hit: { damage: { dice: [{ n: 1, d: 8 }], flat: 0, type: 'untyped' } }
  }),
  
  magicMissile: createPower({
    id: 'magic-missile',
    name: 'Magic Missile',
    type: POWER_TYPES.AT_WILL,
    action: ACTION_TYPES.STANDARD,
    target: 'single',
    range: 10,
    attack: { vs: 'Ref', ability: 'INT', proficiency: 0 },
    hit: { damage: { dice: [{ n: 2, d: 4 }], flat: 0, type: 'force' } }
  }),
  
  thunderwave: createPower({
    id: 'thunderwave',
    name: 'Thunderwave',
    type: POWER_TYPES.ENCOUNTER,
    action: ACTION_TYPES.STANDARD,
    target: 'burst',
    range: 1,
    burst: 1,
    attack: { vs: 'Fort', ability: 'CON', proficiency: 0 },
    hit: { 
      damage: { dice: [{ n: 1, d: 6 }], flat: 0, type: 'thunder' },
      conditions: [{ id: 'pushed', duration: 'saveEnds', data: { squares: 2 } }]
    }
  })
}
