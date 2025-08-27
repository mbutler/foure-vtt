export const initialState = (seed = 42) => ({
  matchId: `local_${Date.now()}_${seed}`,
  rng: { seed, cursor: 0 },
  round: 1,
  turn: { order: ['A1','E1'], index: 0 },
  actions: { standard: 1, move: 1, minor: 1, free: 'unbounded', immediateUsedThisRound: false },
  actors: { A1: { team:'A', hp:{ current: 24, max: 30, temp: 0 }, surges:{ remaining: 7, value: 7 } }, E1: { team:'B', hp:{ current: 30, max: 30, temp: 0 }, surges:{ remaining: 0, value: 0 } } },
  board: { w: 20, h: 15, blockers: [], difficult: [], positions: { A1:{x:2,y:2}, E1:{x:8,y:4} } },
  effects: {}, queue: [], prompts:{ current: null }, log: [], _ts: 0
})

const cloneShallow = (v) => (Array.isArray(v) ? v.slice() : (v && typeof v === 'object') ? { ...v } : v)
const immSetAtPath = (obj, path, value) => {
  const keys = path.split('.')
  const stack = [obj]
  let cur = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    const next = cur[k]
    const cloned = cloneShallow(next || {})
    cur[k] = cloned
    stack.push(cloned)
    cur = cloned
  }
  cur[keys[keys.length - 1]] = value
  return obj
}

export const applyPatches = (G, patches = []) => {
  // Start from a shallow clone of root so top-level assignments are safe
  let newG = cloneShallow(G)
  for (const p of patches) {
    if (!p || !p.type) continue
    if (p.type === 'set') newG = immSetAtPath(newG, p.path, p.value)
    else if (p.type === 'inc') {
      const keys = p.path.split('.')
      let ref = newG
      for (let i = 0; i < keys.length - 1; i++) ref = ref[keys[i]] || {}
      const cur = Number(ref[keys[keys.length - 1]] || 0)
      newG = immSetAtPath(newG, p.path, cur + p.value)
    }
    else if (p.type === 'log') {
      const ts = (newG._ts || 0) + 1
      newG = immSetAtPath(newG, '_ts', ts)
      const nextLog = Array.isArray(newG.log) ? newG.log.slice() : []
      nextLog.push({ ts, ...p.value })
      newG = immSetAtPath(newG, 'log', nextLog)
    }
  }
  return newG
}

export const spendAction = (G, kind) => {
  const patches = []
  if (kind === 'move' && G.actions.move > 0) patches.push({ type: 'inc', path: 'actions.move', value: -1 })
  else if (kind === 'standard' && G.actions.standard > 0) patches.push({ type: 'inc', path: 'actions.standard', value: -1 })
  else if (kind === 'minor' && G.actions.minor > 0) patches.push({ type: 'inc', path: 'actions.minor', value: -1 })
  patches.push({ type:'log', value:{ type:'info', msg:`Spent ${kind}` } })
  return patches
}

export const advanceTurn = (G) => {
  const patches = []
  const cur = G.turn.order[G.turn.index]
  patches.push({ type:'log', value:{ type:'turn-end', msg:`${cur} ends turn` } })
  const nextIndex = (G.turn.index + 1) % Math.max(G.turn.order.length, 1)
  patches.push({ type:'set', path:'turn.index', value: nextIndex })
  if (nextIndex === 0) { patches.push({ type:'inc', path:'round', value: 1 }) }
  const nxt = G.turn.order[nextIndex]
  patches.push({ type:'set', path:'actions', value:{ standard:1, move:1, minor:1, free:'unbounded', immediateUsedThisRound:false } })
  patches.push({ type:'log', value:{ type:'turn-begin', msg:`${nxt} begins turn` } })
  return patches
}

export const secondWind = (G, actorId) => {
  const a = (G.actors && G.actors[actorId]) || {}
  const surges = a.surges || { remaining: 0, value: 0 }
  const hp = a.hp || { current: 0, max: 0, temp: 0 }
  if ((surges.remaining || 0) <= 0) return [{ type:'log', value:{ type:'info', msg:`${actorId} cannot Second Wind (no surges)` } }]
  const heal = surges.value || 0
  const newHp = Math.min((hp.current || 0) + heal, hp.max || 0)
  return [
    { type:'inc', path:`actors.${actorId}.surges.remaining`, value: -1 },
    { type:'set', path:`actors.${actorId}.hp.current`, value: newHp },
    { type:'set', path:`actors.${actorId}.flags`, value: { ...(a.flags||{}), defenseBonus: 2, usedSecondWind: true } },
    { type:'log', value:{ type:'second-wind', msg:`${actorId} uses Second Wind (+2 defenses, heal ${heal})` } }
  ]
}


