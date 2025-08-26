// Deterministic PRNG for boardgame.io state
// Returns { nextFloat, cursor } from (seed, cursor)

export const prng = (seed, cursor) => {
  let t = (seed + cursor) >>> 0
  const nextFloat = () => {
    t += 0x6d2b79f5
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
  
  return { nextFloat, cursor: cursor + 1 }
}

// Roll dice and return result with patches
export const roll = (G, spec) => {
  const { nextFloat } = prng(G.rng.seed, G.rng.cursor)
  
  let result, parts
  let drawsUsed = 0
  
  if (spec === 'd20') {
    result = Math.floor(nextFloat() * 20) + 1
    parts = [result]
    drawsUsed = 1
  } else if (spec === 'd6') {
    result = Math.floor(nextFloat() * 6) + 1
    parts = [result]
    drawsUsed = 1
  } else if (spec && spec.kind === 'sum') {
    parts = spec.terms.map(term => {
      if (typeof term === 'number') return term
      if (term === 'd20') { drawsUsed += 1; return Math.floor(nextFloat() * 20) + 1 }
      if (term === 'd6') { drawsUsed += 1; return Math.floor(nextFloat() * 6) + 1 }
      return 0
    })
    result = parts.reduce((sum, part) => sum + part, 0)
  } else {
    result = 1
    parts = [1]
    drawsUsed = 0
  }
  
  const patches = [
    { type: 'set', path: 'rng.cursor', value: G.rng.cursor + drawsUsed },
    { type: 'log', value: { 
      type: 'roll', 
      msg: `Rolled ${typeof spec === 'string' ? spec : spec && spec.kind ? spec.kind : 'unknown'}`,
      data: { spec, result, parts },
      rng: { seed: G.rng.seed, idx: G.rng.cursor }
    }}
  ]
  
  return { result, parts, patches }
}

// Legacy function for backward compatibility
export const makeRng = (seed) => {
  let cursor = 0
  return () => {
    const { nextFloat, cursor: newCursor } = prng(seed, cursor)
    cursor = newCursor
    return nextFloat()
  }
}

export const rollD = (rng, sides) => Math.floor(rng() * sides) + 1
  