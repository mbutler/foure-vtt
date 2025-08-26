import { makeRng } from '../engine/rng.js'

export const initialState = () => {
  const rng = makeRng(42) // replace with per-match seed later
  return {
    rngSeed: 42,
    round: 1,
    initiative: [],
    actors: {},
    effects: [],
    log: [],
    _rng: rng
  }
}

export const firstPlayer = (G, _ctx) =>
  G.initiative.length ? 0 : 0

export const nextPlayer = (G, ctx) => {
  const { playOrderPos, playOrder } = ctx
  const next = (playOrderPos + 1) % playOrder.length
  return next
}

export const onTurnBegin = (_G, _ctx) => {
  // placeholder: apply start-of-turn effects later
  return []
}

export const onTurnEnd = (_G, _ctx) => {
  // placeholder: run saving throws later
  return []
}

export const canEndTurn = (_G, _ctx) => true
