import { Server } from 'boardgame.io/server'
import path from 'path'
import { fileURLToPath } from 'url'
import { FourEGame } from '../engine/game.js'
import serve from 'koa-static'
import { initFirebaseAdmin, publishMatchState } from './firebase.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8000)

const server = Server({ 
  games: [FourEGame],
  // Allow all origins during development to avoid 403s when joining
  origins: ['*']
})

// simple health at /
server.app.use(async (ctx, next) => {
  if (ctx.path === '/health') { ctx.body = '4e VTT server is running'; return }
  await next()
})

// serve debug page
server.app.use(async (ctx, next) => {
  if (ctx.path === '/debug.html') {
    const fs = await import('fs/promises')
    const content = await fs.readFile(path.join(__dirname, '../../public/debug.html'), 'utf8')
    ctx.type = 'text/html'
    ctx.body = content
    return
  }
  await next()
})

// serve static app (public)
server.app.use(serve(path.join(__dirname, '../../public')))

// serve source modules under /src/* by stripping the prefix and reading from disk
server.app.use(async (ctx, next) => {
  if (ctx.path.startsWith('/src/')) {
    const fs = await import('fs/promises')
    const rel = ctx.path.slice('/src/'.length)
    const target = path.join(__dirname, '../../src', rel)
    try {
      const content = await fs.readFile(target)
      const ext = path.extname(target)
      // simple content-type mapping
      if (ext === '.js') ctx.type = 'application/javascript'
      else if (ext === '.css') ctx.type = 'text/css'
      else if (ext === '.json') ctx.type = 'application/json'
      ctx.body = content
      return
    } catch (e) {
      // fallthrough to next
    }
  }
  await next()
})

// default to index.html
server.app.use(async (ctx, next) => {
  if (ctx.path === '/') {
    const fs = await import('fs/promises')
    const content = await fs.readFile(path.join(__dirname, '../../public/index.html'), 'utf8')
    ctx.type = 'text/html'
    ctx.body = content
    return
  }
  await next()
})

server.run(PORT)
console.log(`4e VTT server on http://localhost:${PORT}`)
console.log(`Games API available at http://localhost:${PORT}/games`)

// Initialize Firebase Admin when server starts
try { initFirebaseAdmin() } catch {}
