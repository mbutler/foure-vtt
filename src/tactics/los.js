import { toId } from './grid.js'

// Sample-based supercover line: returns set of cell ids the segment passes through
const supercoverCells = (x0, y0, x1, y1) => {
  const cells = new Set()
  const dx = x1 - x0
  const dy = y1 - y0
  const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 4 + 1
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = x0 + dx * t
    const y = y0 + dy * t
    const cx = Math.floor(x)
    const cy = Math.floor(y)
    cells.add(`${cx},${cy}`)
  }
  return cells
}

const cornersOf = (cell) => [
  { x: cell.x + 0, y: cell.y + 0 },
  { x: cell.x + 1, y: cell.y + 0 },
  { x: cell.x + 0, y: cell.y + 1 },
  { x: cell.x + 1, y: cell.y + 1 }
]

export const hasLoE = (G, fromCell, toCell) => {
  if (fromCell.x === toCell.x && fromCell.y === toCell.y) return true
  const blockers = new Set(G.board.blockers || [])
  const fromId = toId(fromCell)
  const toIdStr = toId(toCell)
  for (const a of cornersOf(fromCell)) {
    for (const b of cornersOf(toCell)) {
      const cells = supercoverCells(a.x, a.y, b.x, b.y)
      let blocked = false
      for (const cid of cells) {
        if (cid === fromId || cid === toIdStr) continue
        if (blockers.has(cid)) { blocked = true; break }
      }
      if (!blocked) return true
    }
  }
  return false
}

export const hasLoEToCenter = hasLoE
