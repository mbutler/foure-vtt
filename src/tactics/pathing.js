import { neighbors8, toId, inBounds, actorAt } from './grid.js'

const defaultOpts = () => ({ allowAllyPassThrough: true, difficult: new Set(), blockers: new Set(), board: { w: 0, h: 0 } })

export const isBlocker = (cellId, blockers) => blockers.has(cellId)
export const isDifficult = (cellId, difficult) => difficult.has(cellId)

export const stepCost = (toCellId, difficult) => (isDifficult(toCellId, difficult) ? 2 : 1)

export const legalStep = (G, from, to, mode = 'walk') => {
  const id = toId(to)
  if (!inBounds(to, G.board)) return { ok: false, reason: 'out-of-bounds' }
  if (isBlocker(id, new Set(G.board.blockers || []))) return { ok: false, reason: 'blocker' }
  // Occupancy rules: cannot end on any occupied cell
  const occupant = actorAt(G, to)
  if (occupant) return { ok: false, reason: 'occupied' }
  if (mode === 'shift' && isDifficult(id, new Set(G.board.difficult || []))) return { ok: false, reason: 'difficult' }
  return { ok: true }
}

const areEnemies = (G, aId, bId) => {
  if (!aId || !bId) return false
  const a = (G.actors && G.actors[aId]) || {}
  const b = (G.actors && G.actors[bId]) || {}
  if (a.team && b.team) return a.team !== b.team
  return false
}

export const findPath = (G, start, goal, options = {}) => {
  const opts = { ...defaultOpts(), ...options, difficult: new Set(G.board.difficult || []), blockers: new Set(G.board.blockers || []), board: G.board }
  if (!inBounds(start, opts.board) || !inBounds(goal, opts.board)) return null
  const startId = toId(start)
  const goalId = toId(goal)
  if (isBlocker(goalId, opts.blockers)) return null

  // A* search
  const open = new Map([[startId, 0]])
  const cameFrom = new Map()
  const gScore = new Map([[startId, 0]])

  const heuristic = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

  const getLowestF = () => {
    let bestId = null
    let bestScore = Infinity
    for (const [id] of open) {
      const [xs, ys] = id.split(',')
      const p = { x: Number(xs), y: Number(ys) }
      const gs = gScore.get(id) ?? Infinity
      const h = heuristic(p, goal)
      const f = gs + h
      if (f < bestScore) { bestScore = f; bestId = id }
    }
    return bestId
  }

  while (open.size > 0) {
    const currentId = getLowestF()
    const [cx, cy] = currentId.split(',').map(Number)
    const current = { x: cx, y: cy }
    if (currentId === goalId) {
      // reconstruct
      const path = []
      let cur = currentId
      while (cur) {
        const [px, py] = cur.split(',').map(Number)
        path.push({ x: px, y: py })
        cur = cameFrom.get(cur)
      }
      path.reverse()
      // Recompute cost from path to ensure step costs account for difficult per entered cell
      let cost = 0
      for (let i = 1; i < path.length; i++) {
        cost += stepCost(toId(path[i]), opts.difficult)
      }
      return { path, cost }
    }
    open.delete(currentId)

    for (const n of neighbors8(current)) {
      if (!inBounds(n, opts.board)) continue
      const nid = toId(n)
      if (isBlocker(nid, opts.blockers)) continue

      // Occupancy handling: allies pass-through allowed if not goal; enemies impassable
      const occupant = actorAt(G, n)
      const isEnd = nid === goalId
      if (occupant) {
        if (opts.moverId && areEnemies(G, opts.moverId, occupant)) {
          // enemy blocks
          continue
        }
        // ally or unknown: allow pass-through unless end cell
        if (isEnd) continue
        if (!opts.allowAllyPassThrough) continue
      }

      const tentativeG = (gScore.get(currentId) ?? Infinity) + stepCost(nid, opts.difficult)
      const existingG = gScore.get(nid)
      if (existingG === undefined || tentativeG < existingG) {
        cameFrom.set(nid, currentId)
        gScore.set(nid, tentativeG)
        open.set(nid, tentativeG)
      }
    }
  }

  return null
}

export const reachable = (G, actorId, speed, options = {}) => {
  const opts = { ...defaultOpts(), ...options, difficult: new Set(G.board.difficult || []), blockers: new Set(G.board.blockers || []), board: G.board, moverId: actorId }
  const start = G.board.positions[actorId]
  if (!start) return new Set()
  const startId = toId(start)
  const visited = new Map([[startId, 0]])
  const frontier = [start]

  while (frontier.length > 0) {
    const current = frontier.shift()
    const cid = toId(current)
    const curCost = visited.get(cid) ?? 0
    for (const n of neighbors8(current)) {
      if (!inBounds(n, opts.board)) continue
      const nid = toId(n)
      if (isBlocker(nid, opts.blockers)) continue
      const step = stepCost(nid, opts.difficult)
      const newCost = curCost + step
      if (newCost > speed) continue
      // cannot enter enemy-occupied; allies allowed if not final dest (we include only endable later)
      const occupant = actorAt(G, n)
      if (occupant && areEnemies(G, actorId, occupant)) continue
      if (!visited.has(nid) || newCost < (visited.get(nid) ?? Infinity)) {
        visited.set(nid, newCost)
        frontier.push(n)
      }
    }
  }

  // Only include cells you can end in (not occupied)
  const result = new Set()
  for (const [id, cost] of visited.entries()) {
    if (id === startId) { result.add(id); continue }
    const [x, y] = id.split(',').map(Number)
    if (!actorAt(G, { x, y })) result.add(id)
  }
  return result
}
