import { toId, inBounds, chebyshev } from './grid.js'

export const cellsForSingle = (anchor) => new Set([toId(anchor)])

export const cellsForBurst = (center, radius, board) => {
  const cells = new Set()
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const cell = { x: center.x + dx, y: center.y + dy }
      if (Math.max(Math.abs(dx), Math.abs(dy)) <= radius) {
        if (!board || inBounds(cell, board)) cells.add(toId(cell))
      }
    }
  }
  return cells
}

export const cellsForTemplate = (spec, attackerCell, board, opts = {}) => {
  if (spec.kind === 'single') {
    return cellsForSingle(attackerCell)
  }
  if (spec.kind === 'burst') {
    const center = spec.origin === 'area' && spec.center ? spec.center : attackerCell
    const r = spec.radius ?? 1
    return cellsForBurst(center, r, board)
  }
  if (spec.kind === 'blast') {
    const size = spec.size ?? 3
    const facing = opts.facing || { x: 1, y: 0 }
    return cellsForBlast(attackerCell, facing, size, board, false)
  }
  return new Set()
}

// C4: Facing & rotation helpers
export const facingFromVector = (dx, dy) => {
  // Quantize to nearest of 8 directions based on signs and dominant axis
  const sx = Math.sign(dx)
  const sy = Math.sign(dy)
  if (sx === 0 && sy === 0) return { x: 1, y: 0 }
  // If both non-zero, diagonal
  if (sx !== 0 && sy !== 0) return { x: sx, y: sy }
  // Otherwise cardinal
  return { x: sx, y: sy }
}

const orthoLeft = (v) => ({ x: -v.y, y: v.x })

export const cellsForBlast = (originCell, facing, size, board, includeOrigin = false) => {
  const cells = new Set()
  const forward = facingFromVector(facing.x, facing.y)
  const lateral = orthoLeft(forward)
  const half = Math.floor((size - 1) / 2)
  if (includeOrigin) cells.add(toId(originCell))
  for (let i = 1; i <= size; i++) {
    for (let j = -half; j <= half; j++) {
      // For even sizes, widen to size cells by biasing right
      const offset = (size % 2 === 0 && j === half) ? half : j
      const cell = {
        x: originCell.x + i * forward.x + offset * lateral.x,
        y: originCell.y + i * forward.y + offset * lateral.y
      }
      if (!board || inBounds(cell, board)) cells.add(toId(cell))
    }
    // Even sizes need one extra lateral on the negative side to reach width N
    if (size % 2 === 0) {
      const extraOffset = -half - 1
      const cell = {
        x: originCell.x + i * forward.x + extraOffset * lateral.x,
        y: originCell.y + i * forward.y + extraOffset * lateral.y
      }
      if (!board || inBounds(cell, board)) cells.add(toId(cell))
    }
  }
  return cells
}

export const areaBurstCentersWithin = (attackerCell, range, board) => {
  const centers = new Set()
  for (let x = 0; x < board.w; x++) {
    for (let y = 0; y < board.h; y++) {
      const cell = { x, y }
      if (chebyshev(attackerCell, cell) <= range) centers.add(toId(cell))
    }
  }
  return centers
}
