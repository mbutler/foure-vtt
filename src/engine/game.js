import { INVALID_MOVE } from 'boardgame.io/core'
import * as Rules from '../rules/index.js'

export const FourEGame = {
  name: '4e',
  setup: () => Rules.initialState(42),
  turn: {
    order: {
      first: (G, ctx) => Rules.firstPlayer(G, ctx),
      next: (G, ctx) => Rules.nextPlayer(G, ctx)
    },
    // Avoid duplicating turn-begin/end logic; handled by Rules.advanceTurn
    onBegin: (_G, _ctx) => {},
    onEnd: (_G, _ctx) => {}
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
