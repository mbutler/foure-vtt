import { Server } from 'boardgame.io/server'
import serve from 'koa-static'
import path from 'path'
import { fileURLToPath } from 'url'
import { FourEGame } from '../engine/game.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8000)

const server = Server({ games: [FourEGame] })

// serve /public at /
server.app.use(serve(path.join(__dirname, '../../public')))

// simple health at /
server.app.use(async (ctx, next) => {
  if (ctx.path === '/' || ctx.path === '/health') {
    ctx.body = '4e VTT server is running'
    return
  }
  await next()
})

server.run(PORT)
console.log(`4e VTT server on http://localhost:${PORT}`)
