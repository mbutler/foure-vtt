export const chebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
export const neighbors4 = p => [
  { x: p.x + 1, y: p.y },
  { x: p.x - 1, y: p.y },
  { x: p.x, y: p.y + 1 },
  { x: p.x, y: p.y - 1 }
]
