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
      applyPatches(G, patches)
    },
    moveToken: (G, ctx, params) => {
      console.log('moveToken called with params:', params)
      console.log('G.board:', G.board)
      console.log('G.board.positions:', G.board?.positions)
      
      if (!G.board || !G.board.positions) {
        console.error('Missing board or board.positions in state')
        return INVALID_MOVE
      }
      
      const { actorId, toX, toY, mode = 'walk' } = params
      const toCell = { x: toX, y: toY }
      const pv = Rules.previewMove(G, actorId, toCell, mode)
      if (!pv || !pv.ok) return INVALID_MOVE
      const patches = [
        ...Rules.buildMovePreviewLog(actorId, pv, mode),
        ...Rules.commitMove(G, actorId, pv)
      ]
      applyPatches(G, patches)
    },
    useSecondWind: (G, ctx, actorId) => {
      const patches = Rules.secondWind(G, actorId)
      applyPatches(G, patches)
    },
    bootstrapDemo: (G, ctx) => {
      console.log('bootstrapDemo called - starting...')
      
      // Use patches to modify the existing state
      const patches = [
        { type: 'set', path: 'turn.order', value: ['A1','E1'] },
        { type: 'set', path: 'turn.index', value: 0 },
        { type: 'set', path: 'actions', value: { 
          standard: 1, 
          move: 1, 
          minor: 1, 
          free: 'unbounded', 
          immediateUsedThisRound: false 
        }},
        { type: 'set', path: 'actors.A1', value: { team:'A', hp:{ current:24, max:30, temp:0 }, surges:{ remaining:7, value:7 } }},
        { type: 'set', path: 'actors.E1', value: { team:'B', hp:{ current:30, max:30, temp:0 }, surges:{ remaining:0, value:0 } }},
        { type: 'set', path: 'board.positions.A1', value: { x:2, y:2 }},
        { type: 'set', path: 'board.positions.E1', value: { x:8, y:4 }},
        { type: 'log', value: { type: 'info', msg: 'Demo actors bootstrapped' }}
      ]
      
      applyPatches(G, patches)
      console.log('bootstrapDemo completed successfully')
    },
    
    endTurn: (G, ctx) => {
      if (!Rules.canEndTurn(G, ctx)) return INVALID_MOVE
      const patches = Rules.advanceTurn(G)
      applyPatches(G, patches)
      ctx.events.endTurn()
    },
    
    spendAction: (G, ctx, kind) => {
      const patches = Rules.spendAction(G, kind)
      applyPatches(G, patches)
    },
    
    applyManualPatch: (G, ctx, patch) => {
      if (!patch || typeof patch !== 'object') {
        console.warn('Invalid patch received:', patch)
        return
      }
      
      // Apply the patch directly to the state
      if (patch.type === 'set') {
        const keys = patch.path.split('.')
        let ref = G
        for (let i = 0; i < keys.length - 1; i++) {
          const k = keys[i]
          ref[k] = ref[k] ?? {}
          ref = ref[k]
        }
        ref[keys[keys.length - 1]] = patch.value
      }
    }
  }
}
