export let INVALID_MOVE

try {
  const mod = await import('boardgame.io/core')
  INVALID_MOVE = mod.INVALID_MOVE
} catch (_e) {
  const mod = await import('https://esm.sh/boardgame.io@0.50.2/core')
  INVALID_MOVE = mod.INVALID_MOVE
}



