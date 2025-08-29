/**
 * Game Log Component
 * Displays game events in an elegant, hierarchical format
 */
export class GameLog {
  constructor(container) {
    this.container = container
    this.entries = []
    this.maxEntries = 100
    
    this.init()
  }
  
  init() {
    this.container.innerHTML = `
      <div class="log-header">
        <h3>Game Log</h3>
        <button class="log-clear" id="log-clear">Clear</button>
      </div>
      <div class="log-entries" id="log-entries"></div>
    `
    
    this.logEntries = this.container.querySelector('#log-entries')
    this.setupEventListeners()
  }
  
  setupEventListeners() {
    const clearBtn = this.container.querySelector('#log-clear')
    clearBtn.addEventListener('click', () => {
      this.clear()
    })
  }
  
  addEntry(entry) {
    const timestamp = new Date()
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp,
      ...entry
    }
    
    this.entries.unshift(logEntry)
    
    // Keep only the last maxEntries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries)
    }
    
    this.render()
  }
  
  addTurnEntry(actorName, round, turn) {
    this.addEntry({
      type: 'turn',
      level: 'info',
      title: `Turn ${turn}`,
      subtitle: `Round ${round}`,
      content: `${actorName}'s turn`,
      actor: actorName
    })
  }
  
  addPowerEntry(actorName, powerName, powerType, targets, result) {
    const typeColors = {
      'at-will': 'var(--power-at-will)',
      'encounter': 'var(--power-encounter)', 
      'daily': 'var(--power-daily)',
      'utility': 'var(--power-utility)'
    }
    
    this.addEntry({
      type: 'power',
      level: result.success ? 'success' : 'error',
      title: powerName,
      subtitle: powerType,
      content: `${actorName} uses ${powerName} on ${targets.join(', ')}`,
      details: result.details,
      powerType,
      actor: actorName,
      targets,
      result
    })
  }
  
  addAttackEntry(actorName, targetName, attackRoll, damage, hit) {
    this.addEntry({
      type: 'attack',
      level: hit ? 'success' : 'error',
      title: 'Attack',
      subtitle: hit ? 'Hit' : 'Miss',
      content: `${actorName} attacks ${targetName}`,
      details: `Roll: ${attackRoll}${damage ? ` | Damage: ${damage}` : ''}`,
      actor: actorName,
      target: targetName,
      attackRoll,
      damage,
      hit
    })
  }
  
  addMovementEntry(actorName, from, to, distance) {
    this.addEntry({
      type: 'movement',
      level: 'info',
      title: 'Movement',
      subtitle: `${distance} squares`,
      content: `${actorName} moves from ${from} to ${to}`,
      actor: actorName,
      from,
      to,
      distance
    })
  }
  
  addStatusEntry(actorName, status, effect) {
    this.addEntry({
      type: 'status',
      level: 'warning',
      title: status,
      subtitle: effect,
      content: `${actorName} is affected by ${status}`,
      actor: actorName,
      status,
      effect
    })
  }
  
  addSystemEntry(message, level = 'info') {
    this.addEntry({
      type: 'system',
      level,
      title: 'System',
      content: message
    })
  }
  
  render() {
    this.logEntries.innerHTML = this.entries.map(entry => this.renderEntry(entry)).join('')
  }
  
  renderEntry(entry) {
    const time = entry.timestamp.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
    
    const levelClass = entry.level || 'info'
    const typeClass = entry.type || 'system'
    
    return `
      <div class="log-entry ${levelClass} ${typeClass}" data-entry-id="${entry.id}">
        <div class="log-entry-header">
          <div class="log-entry-time">${time}</div>
          <div class="log-entry-type">${this.getTypeIcon(entry.type)}</div>
        </div>
        <div class="log-entry-content">
          <div class="log-entry-title">${entry.title}</div>
          ${entry.subtitle ? `<div class="log-entry-subtitle">${entry.subtitle}</div>` : ''}
          <div class="log-entry-text">${entry.content}</div>
          ${entry.details ? `<div class="log-entry-details">${entry.details}</div>` : ''}
        </div>
      </div>
    `
  }
  
  getTypeIcon(type) {
    const icons = {
      'turn': '⏱️',
      'power': '⚡',
      'attack': '⚔️',
      'movement': '👣',
      'status': '💫',
      'system': '⚙️'
    }
    return icons[type] || '📝'
  }
  
  clear() {
    this.entries = []
    this.render()
  }
  
  // Export log for saving/loading
  export() {
    return this.entries
  }
  
  import(entries) {
    this.entries = entries || []
    this.render()
  }
}
