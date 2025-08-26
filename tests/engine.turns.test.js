import { describe, it, expect } from 'bun:test'
import { FourEGame } from '../src/engine/game.js'

describe('turn skeleton', () => {
  it('initializes', () => {
    const G = FourEGame.setup()
    expect(G.round).toBe(1)
    expect(Array.isArray(G.initiative)).toBe(true)
  })
})
