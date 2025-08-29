/**
 * Browser-compatible version of the powers module
 * Contains constants and functions needed by the powers panel
 */

export const POWER_TYPES = {
  AT_WILL: 'at-will',
  ENCOUNTER: 'encounter',
  DAILY: 'daily',
  UTILITY: 'utility'
}

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
 * Example powers for demonstration
 */
export const EXAMPLE_POWERS = {
  basicAttack: {
    id: 'basic-attack',
    name: 'Basic Attack',
    type: POWER_TYPES.AT_WILL,
    action: ACTION_TYPES.STANDARD,
    target: 'single',
    range: 1,
    attack: {
      vs: 'AC',
      ability: 'STR',
      proficiency: 0,
      enhancement: 0
    },
    hit: {
      damage: {
        dice: [{ n: 1, d: 'weapon' }],
        flat: 0,
        type: 'untyped'
      }
    }
  },
  
  magicMissile: {
    id: 'magic-missile',
    name: 'Magic Missile',
    type: POWER_TYPES.AT_WILL,
    action: ACTION_TYPES.STANDARD,
    target: 'single',
    range: 20,
    attack: {
      vs: 'Ref',
      ability: 'INT',
      proficiency: 0,
      enhancement: 0
    },
    hit: {
      damage: {
        dice: [{ n: 2, d: 4 }],
        flat: 0,
        type: 'force'
      }
    }
  },
  
  thunderwave: {
    id: 'thunderwave',
    name: 'Thunderwave',
    type: POWER_TYPES.ENCOUNTER,
    action: ACTION_TYPES.STANDARD,
    target: 'burst',
    range: 1,
    area: 3,
    attack: {
      vs: 'Fort',
      ability: 'CON',
      proficiency: 0,
      enhancement: 0
    },
    hit: {
      damage: {
        dice: [{ n: 1, d: 6 }],
        flat: 0,
        type: 'thunder'
      },
      conditions: [
        { id: 'pushed', duration: 'saveEnds', data: { squares: 2 } }
      ]
    }
  }
}

/**
 * Check if a power can be used by an actor
 * @param {Object} gameState - Current game state
 * @param {string} actorId - Actor ID
 * @param {Object} power - Power to check
 * @returns {Object} Validation result
 */
export function canUsePower(gameState, actorId, power) {
  // Check if it's the actor's turn
  const currentActorId = gameState.turn?.order?.[gameState.turn.index]
  if (currentActorId !== actorId) {
    return { success: false, reason: 'Not your turn' }
  }
  
  // Check if actor has the required action
  const actions = gameState.actions
  if (!actions) {
    return { success: false, reason: 'No actions available' }
  }
  
  // Check action availability
  switch (power.action) {
    case ACTION_TYPES.STANDARD:
      if (actions.standard <= 0) {
        return { success: false, reason: 'No standard action available' }
      }
      break
    case ACTION_TYPES.MOVE:
      if (actions.move <= 0) {
        return { success: false, reason: 'No move action available' }
      }
      break
    case ACTION_TYPES.MINOR:
      if (actions.minor <= 0) {
        return { success: false, reason: 'No minor action available' }
      }
      break
    case ACTION_TYPES.FREE:
      // Free actions are always available
      break
    case ACTION_TYPES.IMMEDIATE_INTERRUPT:
    case ACTION_TYPES.IMMEDIATE_REACTION:
      if (actions.immediateUsedThisRound) {
        return { success: false, reason: 'Immediate action already used this round' }
      }
      break
    case ACTION_TYPES.OPPORTUNITY:
      if (actions.opportunityUsedThisTurn) {
        return { success: false, reason: 'Opportunity action already used this turn' }
      }
      break
  }
  
  // Check power usage limits
  const usage = gameState.flags?.usage?.[actorId] || {}
  
  switch (power.type) {
    case POWER_TYPES.ENCOUNTER:
      if (usage[power.id]) {
        return { success: false, reason: 'Encounter power already used' }
      }
      break
    case POWER_TYPES.DAILY:
      if (usage[power.id]) {
        return { success: false, reason: 'Daily power already used' }
      }
      break
  }
  
  return { success: true }
}
