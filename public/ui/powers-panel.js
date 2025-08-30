import { EXAMPLE_POWERS, canUsePower } from '../content/powers.js'
import { convertFoundryPower, findPowersByClass } from '../content/power-loader.js'

/**
 * Powers Panel UI Component
 * Displays available powers with elegant typography and color coding
 */
export class PowersPanel {
  constructor(container, gameState, onPowerUse) {
    this.container = container
    this.gameState = gameState
    this.onPowerUse = onPowerUse
    this.currentActorId = null
    this.actorPowers = new Map()
    this.selectedPowerId = null
    
    this.init()
  }
  
  init() {
    // The container structure is now handled by the main HTML
    this.powersList = this.container.querySelector('#powers-list')
    this.powerDetails = this.container.querySelector('#power-details')
    this.powerName = this.container.querySelector('#power-name')
    this.powerType = this.container.querySelector('#power-type')
    this.powerAction = this.container.querySelector('#power-action')
    this.powerTarget = this.container.querySelector('#power-target')
    this.powerDescription = this.container.querySelector('#power-description')
    this.powerUsage = this.container.querySelector('#power-usage')
    
    this.setupEventListeners()
  }
  
  setupEventListeners() {
    this.powersList.addEventListener('click', (e) => {
      const powerItem = e.target.closest('.power-item')
      if (powerItem) {
        const powerId = powerItem.dataset.powerId
        this.selectPower(powerId)
      }
    })

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.selectedPowerId) {
        this.usePower(this.selectedPowerId)
      }
    })
  }
  
  update(gameState) {
    this.gameState = gameState
    this.currentActorId = gameState.turn?.order?.[gameState.turn.index]
    
    if (this.currentActorId) {
      this.loadActorPowers(this.currentActorId)
      this.render()
    } else {
      this.powersList.innerHTML = '<div class="no-powers">No active actor</div>'
      this.hidePowerDetails()
    }
  }
  
  loadActorPowers(actorId) {
    // For now, give all actors the same basic powers
    // In a full implementation, this would load from character sheets
    const basePowers = [
      EXAMPLE_POWERS.basicAttack,
      EXAMPLE_POWERS.magicMissile,
      EXAMPLE_POWERS.thunderwave
    ]
    
    // Add some converted Foundry powers for demonstration
    const foundryPowers = this.getSampleFoundryPowers()
    
    this.actorPowers.set(actorId, [...basePowers, ...foundryPowers])
  }
  
  getSampleFoundryPowers() {
    // Sample Foundry power data for demonstration
    const foundryPowerData = {
      "_id": "OgXLUlMC0yOkiPSZ",
      "name": "Melee Basic Attack",
      "type": "power",
      "system": {
        "target": "One creature",
        "attack": {
          "isAttack": true,
          "ability": "str",
          "def": "ac"
        },
        "action": "standard",
        "powerType": "at-will",
        "description": "Make a melee basic attack against one creature.",
        "range": "melee weapon",
        "damage": {
          "formula": "1d8+4"
        }
      }
    }
    
    return [convertFoundryPower(foundryPowerData)]
  }
  
  render() {
    if (!this.currentActorId) return
    
    const powers = this.actorPowers.get(this.currentActorId) || []
    const currentActor = this.gameState.actors?.get(this.currentActorId)
    
    if (!powers.length) {
      this.powersList.innerHTML = '<div class="no-powers">No powers available</div>'
      return
    }
    
    // Group powers by type for better organization
    const powerGroups = this.groupPowersByType(powers)
    
    this.powersList.innerHTML = Object.entries(powerGroups)
      .map(([type, typePowers]) => this.renderPowerGroup(type, typePowers))
      .join('')
  }
  
  groupPowersByType(powers) {
    const groups = {
      'at-will': [],
      'encounter': [],
      'daily': [],
      'utility': []
    }
    
    powers.forEach(power => {
      const type = power.powerType || power.system?.powerType || 'at-will'
      const normalizedType = type.toLowerCase().replace(/\s+/g, '-')
      
      if (groups[normalizedType]) {
        groups[normalizedType].push(power)
      } else {
        groups['at-will'].push(power)
      }
    })
    
    return groups
  }
  
  renderPowerGroup(type, powers) {
    if (!powers.length) return ''
    
    const typeLabels = {
      'at-will': 'At-Will',
      'encounter': 'Encounter',
      'daily': 'Daily',
      'utility': 'Utility'
    }
    
    return `
      <div class="power-group">
        <div class="power-group-header">
          <span class="power-group-label">${typeLabels[type] || type}</span>
          <span class="power-group-count">${powers.length}</span>
        </div>
        ${powers.map(power => this.renderPowerItem(power)).join('')}
      </div>
    `
  }
  
  renderPowerItem(power) {
    const powerId = power.id || power._id
    const isSelected = this.selectedPowerId === powerId
    const canUse = canUsePower(power, this.gameState, this.currentActorId)
    
    const type = power.powerType || power.system?.powerType || 'at-will'
    const action = power.action || power.system?.action || 'standard'
    const target = power.target || power.system?.target || 'One creature'
    const range = power.range || power.system?.range || 'Melee'
    
    return `
      <div class="power-item ${isSelected ? 'selected' : ''} ${!canUse ? 'disabled' : ''}" 
           data-power-id="${powerId}">
        <div class="power-header">
          <div class="power-name">${power.name}</div>
          <div class="power-type ${type.toLowerCase().replace(/\s+/g, '-')}">${type}</div>
        </div>
        <div class="power-details">
          <span class="power-action">${action}</span>
          <span class="power-target">${target}</span>
          <span class="power-range">${range}</span>
        </div>
      </div>
    `
  }
  
  selectPower(powerId) {
    this.selectedPowerId = powerId
    this.showPowerDetails(powerId)
    this.render() // Re-render to update selection state
  }
  
  showPowerDetails(powerId) {
    const powers = this.actorPowers.get(this.currentActorId) || []
    const power = powers.find(p => (p.id || p._id) === powerId)
    
    if (!power) {
      this.hidePowerDetails()
      return
    }
    
    this.selectedPowerId = powerId
    
    // For now, just log the power details since the details panel was removed
    console.log('Power selected:', power)
    
    // TODO: Implement power details display in the new sidebar structure
    // This could be a tooltip, modal, or inline expansion
  }
  
  hidePowerDetails() {
    this.selectedPowerId = null
  }
  
  usePower(powerId) {
    if (this.onPowerUse) {
      this.onPowerUse(powerId)
    }
  }
}

// Add CSS styles
const style = document.createElement('style')
style.textContent = `
  .powers-panel {
    padding: 12px;
    background: #2d3748;
    border-radius: 4px;
    margin-bottom: 16px;
  }
  
  .powers-panel h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    color: #e6e6e6;
  }
  
  .powers-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .power-button {
    padding: 8px 12px;
    background: #4a5568;
    border: 1px solid #718096;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .power-button:hover:not(.disabled) {
    background: #718096;
    border-color: #a0aec0;
  }
  
  .power-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .power-button.used {
    background: #2d3748;
    border-color: #4a5568;
    opacity: 0.7;
  }
  
  .power-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }
  
  .power-name {
    font-weight: 500;
    color: #e6e6e6;
  }
  
  .power-type-badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 2px;
    text-transform: uppercase;
    font-weight: bold;
  }
  
  .power-type-badge.at-will {
    background: #38a169;
    color: white;
  }
  
  .power-type-badge.encounter {
    background: #d69e2e;
    color: white;
  }
  
  .power-type-badge.daily {
    background: #e53e3e;
    color: white;
  }
  
  .power-action-badge {
    font-size: 11px;
    color: #a0aec0;
  }
  
  .power-error {
    font-size: 11px;
    color: #fc8181;
    margin-top: 4px;
  }
  
  .power-details {
    margin-top: 16px;
    padding: 12px;
    background: #1a1d25;
    border-radius: 4px;
    border: 1px solid #4a5568;
  }
  
  .power-details h4 {
    margin: 0 0 8px 0;
    color: #e6e6e6;
  }
  
  .power-info {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 12px;
    color: #a0aec0;
  }
  
  .power-description {
    font-size: 12px;
    color: #e6e6e6;
    white-space: pre-line;
    margin-bottom: 12px;
    line-height: 1.4;
  }
  
  .power-usage {
    padding: 6px 8px;
    border-radius: 3px;
    font-size: 12px;
    font-weight: 500;
  }
  
  .power-usage.ready {
    background: #38a169;
    color: white;
  }
  
  .power-usage.error {
    background: #e53e3e;
    color: white;
  }
  
  .power-usage.used {
    background: #4a5568;
    color: #a0aec0;
  }
  
  .no-powers {
    color: #718096;
    font-style: italic;
    text-align: center;
    padding: 20px;
  }
`
document.head.appendChild(style)
