export const chebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
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
export const inBounds = ({ x, y }, { w, h }) => x >= 0 && y >= 0 && x < w && y < h
export const actorAt = (G, cell) => {
  const id = toId(cell)
  for (const [aid, pos] of Object.entries(G.board.positions || {})) {
    if (toId(pos) === id) return aid
  }
  return null
}
export const isBlocker = (id, blockers) => blockers.has(id)
export const isDifficult = (id, difficult) => difficult.has(id)
export const stepCost = (id, difficult) => isDifficult(id, difficult) ? 2 : 1

export const findPath = (G, start, goal) => {
  const difficult = new Set(G.board.difficult || [])
  const blockers = new Set(G.board.blockers || [])
  if (!inBounds(start, G.board) || !inBounds(goal, G.board)) return null
  const startId = toId(start)
  const goalId = toId(goal)
  if (isBlocker(goalId, blockers)) return null
  const open = new Map([[startId, 0]])
  const cameFrom = new Map()
  const gScore = new Map([[startId, 0]])
  const getLowestF = () => {
    let best = null, score = Infinity
    for (const [id] of open) {
      const [xs, ys] = id.split(',')
      const p = { x: Number(xs), y: Number(ys) }
      const g = gScore.get(id) ?? Infinity
      const f = g + chebyshev(p, goal)
      if (f < score) { score = f; best = id }
    }
    return best
  }
  while (open.size > 0) {
    const currentId = getLowestF()
    if (!currentId) break
    const [cx, cy] = currentId.split(',').map(Number)
    const current = { x: cx, y: cy }
    if (currentId === goalId) {
      const path = []
      let cur = currentId
      while (cur) {
        const [px, py] = cur.split(',').map(Number)
        path.push({ x: px, y: py })
        cur = cameFrom.get(cur)
      }
      path.reverse()
      let cost = 0
      for (let i = 1; i < path.length; i++) cost += stepCost(toId(path[i]), difficult)
      return { path, cost }
    }
    open.delete(currentId)
    for (const n of neighbors8(current)) {
      if (!inBounds(n, G.board)) continue
      const nid = toId(n)
      if (isBlocker(nid, blockers)) continue
      // Do not path through occupied cells (basic)
      if (actorAt(G, n) && nid !== goalId) continue
      const tentative = (gScore.get(currentId) ?? Infinity) + stepCost(nid, difficult)
      const existing = gScore.get(nid)
      if (existing === undefined || tentative < existing) {
        cameFrom.set(nid, currentId)
        gScore.set(nid, tentative)
        open.set(nid, tentative)
      }
    }
  }
  return null
}


