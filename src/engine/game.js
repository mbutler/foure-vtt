import { INVALID_MOVE } from 'boardgame.io/core'
import * as Rules from '../rules/index.js'
import { applyPatches } from './patches.js'

export const FourEGame = {
  name: '4e',
  setup: () => Rules.initialState(),
  turn: {
    order: {
      first: (G, ctx) => Rules.firstPlayer(G, ctx),
      next: (G, ctx) => Rules.nextPlayer(G, ctx)
    },
    onBegin: (G, ctx) => {
      const patches = Rules.onTurnBegin(G, ctx)
      applyPatches(G, patches)
    },
    onEnd: (G, ctx) => {
      const patches = Rules.onTurnEnd(G, ctx)
      applyPatches(G, patches)
    }
  },
  moves: {
    endTurn: (G, ctx) => {
      if (!Rules.canEndTurn(G, ctx)) return INVALID_MOVE
      ctx.events.endTurn()
    }
  }
}
