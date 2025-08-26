import { INVALID_MOVE } from 'boardgame.io/core'
import * as Rules from '../rules/index.js'
import { applyPatches } from './patches.js'

export const FourEGame = {
  name: '4e',
  setup: () => Rules.initialState(42),
  turn: {
    order: {
      first: (G, ctx) => Rules.firstPlayer(G, ctx),
      next: (G, ctx) => Rules.nextPlayer(G, ctx)
    },
    onBegin: (G, ctx) => {
      if (G.turn && G.turn.order && G.turn.order.length > 0) {
        const actorId = G.turn.order[ctx.playOrderPos]
        const patches = Rules.onTurnBegin(G, actorId)
        applyPatches(G, patches)
      }
    },
    onEnd: (G, ctx) => {
      if (G.turn && G.turn.order && G.turn.order.length > 0) {
        const actorId = G.turn.order[ctx.playOrderPos]
        const patches = Rules.onTurnEnd(G, actorId)
        applyPatches(G, patches)
      }
    }
  },
  moves: {
    setInitiative: (G, ctx, order) => {
      const patches = [
        { type: 'set', path: 'turn.order', value: order },
        { type: 'set', path: 'turn.index', value: 0 },
        { type: 'log', value: { type: 'info', msg: `Initiative set: ${order.join(', ')}` }}
      ]
      Rules.applyPatches(G, patches)
    },
    
    endTurn: (G, ctx) => {
      if (!Rules.canEndTurn(G, ctx)) return INVALID_MOVE
      const patches = Rules.advanceTurn(G)
      Rules.applyPatches(G, patches)
      ctx.events.endTurn()
    },
    
    spendAction: (G, ctx, kind) => {
      const patches = Rules.spendAction(G, kind)
      Rules.applyPatches(G, patches)
    },
    
    applyManualPatch: (G, ctx, patch) => {
      Rules.applyPatches(G, [patch])
    }
  }
}
