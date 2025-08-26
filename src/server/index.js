import { Server } from 'boardgame.io/server'
import path from 'path'
import { fileURLToPath } from 'url'
import { FourEGame } from '../engine/game.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8000)

const server = Server({ 
  games: [FourEGame],
  origins: ['http://localhost:3000', 'http://localhost:8000', 'http://localhost:8001', 'http://127.0.0.1:8000', 'http://127.0.0.1:8001']
})

// simple health at /
server.app.use(async (ctx, next) => {
  if (ctx.path === '/' || ctx.path === '/health') {
    ctx.body = '4e VTT server is running'
    return
  }
  await next()
})

// Custom middleware to handle move endpoints
server.app.use(async (ctx, next) => {
  // Handle move endpoints like /games/4e/{matchID}/moves/{moveName}
  const moveMatch = ctx.path.match(/^\/games\/4e\/([^\/]+)\/moves\/(.+)$/)
  if (moveMatch && ctx.method === 'POST') {
    const [, matchID, moveName] = moveMatch
    
    // Parse JSON body for move endpoints only
    let body = {}
    if (ctx.request.headers['content-type'] === 'application/json' && ctx.request.headers['content-length'] && parseInt(ctx.request.headers['content-length']) > 0) {
      try {
        body = await new Promise((resolve, reject) => {
          let data = ''
          ctx.req.on('data', chunk => data += chunk)
          ctx.req.on('end', () => {
            try {
              resolve(data ? JSON.parse(data) : {})
            } catch (e) {
              reject(e)
            }
          })
          ctx.req.on('error', reject)
        })
      } catch (error) {
        ctx.status = 400
        ctx.body = { error: 'Invalid JSON' }
        return
      }
    }
    
    try {
      // For now, just return success - we'll implement proper move handling later
      ctx.body = { 
        success: true, 
        message: `Move ${moveName} would be executed with args: ${JSON.stringify(body)}`,
        matchID,
        moveName,
        args: body
      }
      return
    } catch (error) {
      ctx.status = 500
      ctx.body = { error: error.message }
      return
    }
  }
  
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

server.run(PORT)
console.log(`4e VTT server on http://localhost:${PORT}`)
console.log(`Games API available at http://localhost:${PORT}/games`)
