// Mulberry32 — tiny, good enough for deterministic tests
export const makeRng = (seed) => {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

export const rollD = (rng, sides) => Math.floor(rng() * sides) + 1
  