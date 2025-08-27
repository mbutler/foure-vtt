export const toId = ({ x, y }) => `${x},${y}`
export const inBounds = ({ x, y }, board) => x >= 0 && y >= 0 && x < board.w && y < board.h

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

export const facingFromVector = (dx, dy) => {
  const sx = Math.sign(dx)
  const sy = Math.sign(dy)
  if (sx === 0 && sy === 0) return { x: 1, y: 0 }
  if (sx !== 0 && sy !== 0) return { x: sx, y: sy }
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
      const cell = {
        x: originCell.x + i * forward.x + j * lateral.x,
        y: originCell.y + i * forward.y + j * lateral.y
      }
      if (!board || inBounds(cell, board)) cells.add(toId(cell))
    }
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

export const FACINGS8 = [
  { x: 1, y: 0 },  // E
  { x: 1, y: 1 },  // SE
  { x: 0, y: 1 },  // S
  { x: -1, y: 1 }, // SW
  { x: -1, y: 0 }, // W
  { x: -1, y: -1 },// NW
  { x: 0, y: -1 }, // N
  { x: 1, y: -1 }, // NE
]

