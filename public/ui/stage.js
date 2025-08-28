// Uses global PIXI (loaded via CDN in index.html)
export class PixiStage {
  constructor(rootEl, opts = {}) {
    this.rootEl = rootEl
    this.size = { w: rootEl.clientWidth, h: rootEl.clientHeight }
    const { Application, Container } = PIXI
    
    // Create canvas element first
    const canvas = document.createElement('canvas')
    rootEl.appendChild(canvas)
    
    // Initialize PIXI Application
    this.app = new Application({
      width: this.size.w,
      height: this.size.h,
      antialias: true,
      backgroundAlpha: 1,
      backgroundColor: 0x0b0d12,
      view: canvas
    })

    this.gridLayer = new Container()
    this.highlightLayer = new Container()
    this.tokenLayer = new Container()
    this.app.stage.addChild(this.gridLayer, this.highlightLayer, this.tokenLayer)

    this.zoom = 1
    this.cellSize = 32
    this._setupInteractions()
  }

  _setupInteractions() {
    let isPanning = false
    let last = { x: 0, y: 0 }
    this.app.view.addEventListener('mousedown', (e) => { if (e.button === 2) { isPanning = true; last = { x: e.clientX, y: e.clientY } } })
    this.app.view.addEventListener('mousemove', (e) => {
      if (!isPanning) return
      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      last = { x: e.clientX, y: e.clientY }
      this.app.stage.x += dx
      this.app.stage.y += dy
    })
    this.app.view.addEventListener('mouseup', () => { isPanning = false })
    this.app.view.addEventListener('mouseleave', () => { isPanning = false })
    this.app.view.addEventListener('contextmenu', (e) => e.preventDefault())
    this.app.view.addEventListener('wheel', (e) => {
      const delta = Math.sign(e.deltaY)
      const next = Math.min(2.5, Math.max(0.5, this.zoom * (delta > 0 ? 0.9 : 1.1)))
      this.zoom = next
      this.app.stage.scale.set(this.zoom)
    }, { passive: true })
    window.addEventListener('resize', () => this._resize())
  }

  _resize() {
    const w = this.rootEl.clientWidth
    const h = this.rootEl.clientHeight
    this.app.renderer.resize(w, h)
  }

  drawGrid(board) {
    const { Graphics } = PIXI
    const g = new Graphics()
    g.clear()
    g.lineStyle({ width: 1, color: 0x1a1d25, alpha: 1 })
    const cs = this.cellSize
    for (let x = 0; x <= board.w; x++) {
      g.moveTo(x * cs, 0)
      g.lineTo(x * cs, board.h * cs)
    }
    for (let y = 0; y <= board.h; y++) {
      g.moveTo(0, y * cs)
      g.lineTo(board.w * cs, y * cs)
    }
    this.gridLayer.removeChildren()
    this.gridLayer.addChild(g)
  }

  drawTokens(G) {
    const { Graphics, Text } = PIXI
    this.tokenLayer.removeChildren()
    const cs = this.cellSize
    for (const [id, pos] of Object.entries(G.board.positions || {})) {
      const c = new Graphics()
      const color = (G.actors && G.actors[id] && G.actors[id].team === 'B') ? 0xd66a6a : 0x6aa6d6
      c.beginFill(color)
      c.drawCircle(0, 0, cs * 0.4)
      c.endFill()
      c.x = (pos.x + 0.5) * cs
      c.y = (pos.y + 0.5) * cs
      c.eventMode = 'static'
      c.cursor = 'pointer'
      c.name = `token:${id}`
      const label = new Text(id, { fill: 0x0b0d12, fontSize: 12 })
      label.anchor.set(0.5)
      label.y = -2
      c.addChild(label)
      this.tokenLayer.addChild(c)
    }
  }

  drawPathHighlight(path, color = 0x4b89ff) {
    const { Graphics } = PIXI
    this.highlightLayer.removeChildren()
    if (!path || path.length < 2) return
    const g = new Graphics()
    g.lineStyle({ width: 2, color, alpha: 0.9 })
    const cs = this.cellSize
    g.moveTo((path[0].x + 0.5) * cs, (path[0].y + 0.5) * cs)
    for (let i = 1; i < path.length; i++) {
      g.lineTo((path[i].x + 0.5) * cs, (path[i].y + 0.5) * cs)
    }
    this.highlightLayer.addChild(g)
  }

  drawTemplateCells(ids, board, color = 0x7ad67a) {
    const { Graphics } = PIXI
    this.highlightLayer.removeChildren()
    if (!ids || ids.size === 0) return
    const g = new Graphics()
    const cs = this.cellSize
    g.beginFill(color, 0.25)
    g.lineStyle({ width: 1, color, alpha: 0.8 })
    for (const id of ids) {
      const [xs, ys] = String(id).split(',')
      const x = Number(xs), y = Number(ys)
      g.drawRect(x * cs, y * cs, cs, cs)
    }
    g.endFill()
    this.highlightLayer.addChild(g)
  }

  worldToCell(pt) {
    const inv = 1 / this.cellSize
    const x = Math.floor((pt.x / this.zoom - this.app.stage.x / this.zoom) * inv)
    const y = Math.floor((pt.y / this.zoom - this.app.stage.y / this.zoom) * inv)
    return { x, y }
  }
}


