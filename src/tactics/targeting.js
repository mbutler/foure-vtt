import { toId, chebyshev } from './grid.js'
import { cellsForBurst, cellsForTemplate, areaBurstCentersWithin } from './templates.js'
import { hasLoE } from './los.js'

const defaultTargeting = () => ({ who: 'any', minTargets: 1, maxTargets: 1, includeSelf: false })

const isEnemy = (G, aId, bId) => {
  const a = (G.actors && G.actors[aId]) || {}
  const b = (G.actors && G.actors[bId]) || {}
  return a.team && b.team ? a.team !== b.team : aId !== bId
}

const passesFilter = (G, attackerId, targetId, who, includeSelf) => {
  if (who === 'any' || who === 'creatures') return includeSelf ? true : targetId !== attackerId
  if (who === 'self') return targetId === attackerId
  if (who === 'not-self') return targetId !== attackerId
  if (who === 'enemies') return isEnemy(G, attackerId, targetId)
  if (who === 'allies') return !isEnemy(G, attackerId, targetId) && targetId !== attackerId
  return true
}

export const validateTargeting = (G, attackerId, spec, choices = {}) => {
  const errors = []
  const warnings = []
  const attackerCell = G.board.positions[attackerId]
  if (!attackerCell) return { ok: false, errors: ['NO_ATTACKER_POSITION'], warnings }
  if (spec.kind === 'burst' && spec.origin === 'area') {
    if (!choices.center) errors.push('CENTER_REQUIRED')
    else if (spec.range != null && chebyshev(attackerCell, choices.center) > spec.range) errors.push('OUT_OF_RANGE')
    else if (spec.requiresLoEToOrigin && !hasLoE(G, attackerCell, choices.center)) errors.push('NO_LOE_TO_ORIGIN')
  }
  return { ok: errors.length === 0, errors, warnings }
}

export const previewTargeting = (G, attackerId, spec, choices = {}) => {
  const targeting = { ...defaultTargeting(), ...(spec.targeting || {}) }
  const attackerCell = G.board.positions[attackerId]
  const result = { templateCells: new Set(), targets: [], errors: [], warnings: [] }
  if (!attackerCell) { result.errors.push('NO_ATTACKER_POSITION'); return result }

  // Compute template cells
  if (spec.kind === 'burst') {
    if (spec.origin === 'area') {
      if (!choices.center) { result.errors.push('CENTER_REQUIRED'); return result }
      if (spec.range != null && chebyshev(attackerCell, choices.center) > spec.range) result.errors.push('OUT_OF_RANGE')
      if (spec.requiresLoEToOrigin && !hasLoE(G, attackerCell, choices.center)) result.errors.push('NO_LOE_TO_ORIGIN')
      result.templateCells = cellsForBurst(choices.center, spec.radius ?? 1, G.board)
    } else {
      result.templateCells = cellsForBurst(attackerCell, spec.radius ?? 1, G.board)
    }
  } else if (spec.kind === 'blast') {
    if (!choices.facing) { result.errors.push('FACING_REQUIRED'); return result }
    result.templateCells = cellsForTemplate({ kind:'blast', size: spec.size ?? 3 }, attackerCell, G.board, { facing: choices.facing })
  } else if (spec.kind === 'single') {
    // Build a Chebyshev ring of candidate cells based on origin
    const range = spec.origin === 'melee' ? (spec.reach ?? 1) : (spec.range ?? 5)
    const cells = new Set()
    for (let x = 0; x < G.board.w; x++) {
      for (let y = 0; y < G.board.h; y++) {
        const cell = { x, y }
        if (chebyshev(attackerCell, cell) <= range) cells.add(toId(cell))
      }
    }
    result.templateCells = cells
  } else {
    // For now, default empty
    result.templateCells = new Set()
  }

  if (result.errors.length > 0) return result

  // Candidate actors in template
  const candidates = []
  for (const [actorId, pos] of Object.entries(G.board.positions || {})) {
    const id = toId(pos)
    if (result.templateCells.has(id)) candidates.push(actorId)
  }

  // LoE per origin
  const originCell = (spec.origin === 'area' && choices.center) ? choices.center : attackerCell
  const requiresLoE = spec.origin === 'ranged' || spec.origin === 'area' || spec.origin === 'melee' || spec.origin === 'close' || spec.requiresLoEToOrigin
  const filteredByLoE = candidates.filter(tId => {
    if (!requiresLoE) return true
    const targetCell = G.board.positions[tId]
    return hasLoE(G, originCell, targetCell)
  })

  // Apply who filter
  const filtered = filteredByLoE.filter(tId => passesFilter(G, attackerId, tId, targeting.who, targeting.includeSelf))

  if (filtered.length === 0) {
    result.errors.push('NO_CANDIDATES')
  } else {
    // Enforce count constraints
    result.targets = filtered.slice(0, targeting.maxTargets)
    if (result.targets.length < targeting.minTargets) result.errors.push('NO_CANDIDATES')
  }

  return result
}

export const discoverTargets = previewTargeting

