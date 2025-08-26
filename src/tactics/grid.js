export const chebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
export const neighbors4 = p => [
  { x: p.x + 1, y: p.y },
  { x: p.x - 1, y: p.y },
  { x: p.x, y: p.y + 1 },
  { x: p.x, y: p.y - 1 }
]

export const neighbors8 = p => [
  { x: p.x + 1, y: p.y },
  { x: p.x - 1, y: p.y },
  { x: p.x, y: p.y + 1 },
  { x: p.x, y: p.y - 1 },
  { x: p.x + 1, y: p.y + 1 },
  { x: p.x - 1, y: p.y + 1 },
  { x: p.x + 1, y: p.y - 1 },
  { x: p.x - 1, y: p.y - 1 }
]

export const toId = ({ x, y }) => `${x},${y}`
export const fromId = (id) => {
  const [xs, ys] = String(id).split(',')
  return { x: Number(xs), y: Number(ys) }
}

export const inBounds = ({ x, y }, { w, h }) => x >= 0 && y >= 0 && x < w && y < h

export const occupiedCells = (G) => new Set(Object.values(G.board.positions || {}).map(pos => toId(pos)))
export const isOccupied = (G, cell) => occupiedCells(G).has(toId(cell))
export const actorAt = (G, cell) => {
  const id = toId(cell)
  for (const [actorId, pos] of Object.entries(G.board.positions || {})) {
    if (toId(pos) === id) return actorId
  }
  return null
}

export const detectOAFromMovement = (G, moverId, path, options = {}) => {
  const threatRange = options.threatRange ?? 1
  const provokers = new Set()
  const cells = []
  if (!Array.isArray(path) || path.length < 2) return { provokers: [], cells: [] }
  const positions = G.board.positions || {}
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i]
    // Any other actor adjacent to the from-cell threatens an OA
    for (const [otherId, pos] of Object.entries(positions)) {
      if (otherId === moverId) continue
      const d = chebyshev(pos, from)
      if (d <= threatRange) {
        provokers.add(otherId)
        cells.push(toId(from))
      }
    }
  }
  return { provokers: Array.from(provokers), cells }
}
