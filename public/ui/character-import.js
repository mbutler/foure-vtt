/**
 * Character Import UI Component
 * Handles .dnd4e file uploads and displays parsed character data
 */

import { characterParser } from '../../src/content/character-parser.js'

export class CharacterImport {
  constructor(container) {
    this.container = container
    this.character = null
    this.init()
  }

  init() {
    this.render()
    this.setupEventListeners()
  }

  render() {
    this.container.innerHTML = `
      <div class="character-import">
        <div class="import-header">
          <h3>Character Import</h3>
          <div class="import-controls">
            <input type="file" id="character-file" accept=".dnd4e" style="display: none;">
            <button id="upload-character" class="upload-btn">
              <span class="upload-icon">📁</span>
              Upload .dnd4e
            </button>
            <button id="clear-character" class="clear-btn" style="display: none;">
              Clear
            </button>
          </div>
        </div>
        
        <div id="character-preview" class="character-preview" style="display: none;">
          <!-- Character data will be populated here -->
        </div>
        
        <div id="import-status" class="import-status" style="display: none;">
          <!-- Import status messages -->
        </div>
      </div>
    `
  }

  setupEventListeners() {
    const uploadBtn = this.container.querySelector('#upload-character')
    const fileInput = this.container.querySelector('#character-file')
    const clearBtn = this.container.querySelector('#clear-character')

    uploadBtn.addEventListener('click', () => {
      fileInput.click()
    })

    fileInput.addEventListener('change', (event) => {
      this.handleFileUpload(event.target.files[0])
    })

    clearBtn.addEventListener('click', () => {
      this.clearCharacter()
    })
  }

  async handleFileUpload(file) {
    if (!file) return

    this.showStatus('Parsing character file...', 'info')

    try {
      const xmlContent = await this.readFileAsText(file)
      this.character = await characterParser.parseCharacterFile(xmlContent)
      
      this.showCharacterPreview()
      this.showStatus('Character imported successfully!', 'success')
      
      // Dispatch custom event for other components
      this.container.dispatchEvent(new CustomEvent('characterImported', {
        detail: { character: this.character }
      }))
      
    } catch (error) {
      console.error('Error importing character:', error)
      this.showStatus(`Import failed: ${error.message}`, 'error')
    }
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = (e) => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  showCharacterPreview() {
    if (!this.character) return

    const preview = this.container.querySelector('#character-preview')
    const clearBtn = this.container.querySelector('#clear-character')
    
    const summary = characterParser.createCharacterSummary(this.character)
    
    preview.innerHTML = `
      <div class="character-summary">
        <div class="character-header">
          <div class="character-name">${summary.name}</div>
          <div class="character-level">Level ${summary.level}</div>
        </div>
        
        <div class="character-basics">
          <div class="basic-info">
            <span class="race">${summary.race || 'Unknown Race'}</span>
            <span class="classes">${summary.classes || 'Unknown Class'}</span>
            ${summary.theme ? `<span class="theme">${summary.theme}</span>` : ''}
            ${summary.background ? `<span class="background">${summary.background}</span>` : ''}
          </div>
          ${summary.paragonPath ? `<div class="paragon-path">${summary.paragonPath}</div>` : ''}
          ${summary.epicDestiny ? `<div class="epic-destiny">${summary.epicDestiny}</div>` : ''}
        </div>
        
        <div class="character-stats">
          <div class="stat-grid">
            <div class="stat-item">
              <div class="stat-label">HP</div>
              <div class="stat-value">${summary.hp}/${summary.maxHP}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Surges</div>
              <div class="stat-value">${summary.healingSurges}/${summary.maxSurges}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">AC</div>
              <div class="stat-value">${summary.ac}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Fort</div>
              <div class="stat-value">${summary.fortitude}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Ref</div>
              <div class="stat-value">${summary.reflex}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Will</div>
              <div class="stat-value">${summary.will}</div>
            </div>
          </div>
        </div>
        
        <div class="character-details">
          <div class="detail-section">
            <div class="section-header">Abilities</div>
            <div class="ability-scores">
              <span class="ability">Str ${summary.abilities.strength}</span>
              <span class="ability">Con ${summary.abilities.constitution}</span>
              <span class="ability">Dex ${summary.abilities.dexterity}</span>
              <span class="ability">Int ${summary.abilities.intelligence}</span>
              <span class="ability">Wis ${summary.abilities.wisdom}</span>
              <span class="ability">Cha ${summary.abilities.charisma}</span>
            </div>
          </div>
          
          <div class="detail-section">
            <div class="section-header">Top Skills</div>
            <div class="skill-list">
              ${summary.topSkills.map(skill => 
                `<span class="skill ${skill.trained ? 'trained' : ''}">${skill.name} ${skill.total}</span>`
              ).join('')}
            </div>
          </div>
          
          <div class="detail-section">
            <div class="section-header">Powers</div>
            <div class="power-summary">
              <span class="power-type at-will">At-Will: ${summary.powers['at-will']}</span>
              <span class="power-type encounter">Encounter: ${summary.powers['encounter']}</span>
              <span class="power-type daily">Daily: ${summary.powers['daily']}</span>
              <span class="power-type utility">Utility: ${summary.powers['utility']}</span>
            </div>
          </div>
          
          <div class="detail-section">
            <div class="section-header">Equipment</div>
            <div class="equipment-summary">
              <span class="equipped">${summary.equippedItems.length} equipped</span>
              <span class="total">${summary.totalItems} total items</span>
            </div>
          </div>
          
          <div class="detail-section">
            <div class="section-header">Other</div>
            <div class="other-info">
              <span class="languages">${summary.languages.length} languages</span>
              <span class="feats">${summary.feats} feats</span>
              <span class="rituals">${summary.rituals} rituals</span>
              ${summary.companions > 0 ? `<span class="companions">${summary.companions} companions</span>` : ''}
            </div>
          </div>
        </div>
      </div>
    `
    
    preview.style.display = 'block'
    clearBtn.style.display = 'inline-flex'
  }

  clearCharacter() {
    this.character = null
    this.container.querySelector('#character-preview').style.display = 'none'
    this.container.querySelector('#clear-character').style.display = 'none'
    this.container.querySelector('#import-status').style.display = 'none'
    
    // Dispatch custom event
    this.container.dispatchEvent(new CustomEvent('characterCleared'))
  }

  showStatus(message, type = 'info') {
    const statusEl = this.container.querySelector('#import-status')
    statusEl.innerHTML = `<div class="status-message ${type}">${message}</div>`
    statusEl.style.display = 'block'
    
    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        statusEl.style.display = 'none'
      }, 3000)
    }
  }

  getCharacter() {
    return this.character
  }

  getCharacterSummary() {
    return this.character ? characterParser.createCharacterSummary(this.character) : null
  }
}

// Add CSS styles for the character import component
const style = document.createElement('style')
style.textContent = `
  .character-import {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    padding: var(--space-md);
  }

  .import-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-md);
  }

  .import-header h3 {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-accent);
  }

  .import-controls {
    display: flex;
    gap: var(--space-xs);
  }

  .upload-btn, .clear-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-medium);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .upload-btn:hover, .clear-btn:hover {
    background: var(--bg-hover);
    border-color: var(--border-strong);
  }

  .upload-icon {
    font-size: 12px;
  }

  .character-preview {
    margin-top: var(--space-md);
  }

  .character-summary {
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    padding: var(--space-md);
  }

  .character-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-sm);
  }

  .character-name {
    font-weight: 600;
    color: var(--text-accent);
    font-size: var(--font-size-lg);
  }

  .character-level {
    background: var(--bg-tertiary);
    padding: 2px var(--space-xs);
    border-radius: 3px;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }

  .character-basics {
    margin-bottom: var(--space-sm);
  }

  .basic-info {
    display: flex;
    gap: var(--space-xs);
    flex-wrap: wrap;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }

  .race, .classes, .theme, .background {
    background: var(--bg-tertiary);
    padding: 1px var(--space-xs);
    border-radius: 3px;
  }

  .paragon-path, .epic-destiny {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    font-style: italic;
    margin-top: 2px;
  }

  .character-stats {
    margin-bottom: var(--space-md);
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-xs);
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-xs);
    background: var(--bg-tertiary);
    border-radius: 4px;
  }

  .stat-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .stat-value {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-accent);
  }

  .character-details {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .detail-section {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    padding: var(--space-sm);
  }

  .section-header {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--text-accent);
    margin-bottom: var(--space-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .ability-scores {
    display: flex;
    gap: var(--space-xs);
    flex-wrap: wrap;
  }

  .ability {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    background: var(--bg-primary);
    padding: 1px var(--space-xs);
    border-radius: 3px;
  }

  .skill-list {
    display: flex;
    gap: var(--space-xs);
    flex-wrap: wrap;
  }

  .skill {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    background: var(--bg-primary);
    padding: 1px var(--space-xs);
    border-radius: 3px;
  }

  .skill.trained {
    color: var(--text-accent);
    font-weight: 500;
  }

  .power-summary {
    display: flex;
    gap: var(--space-xs);
    flex-wrap: wrap;
  }

  .power-type {
    font-size: var(--font-size-xs);
    padding: 1px var(--space-xs);
    border-radius: 3px;
    font-weight: 500;
  }

  .power-type.at-will {
    background: var(--power-at-will);
    color: #000;
  }

  .power-type.encounter {
    background: var(--power-encounter);
    color: #000;
  }

  .power-type.daily {
    background: var(--power-daily);
    color: #000;
  }

  .power-type.utility {
    background: var(--power-utility);
    color: #000;
  }

  .equipment-summary, .other-info {
    display: flex;
    gap: var(--space-xs);
    flex-wrap: wrap;
  }

  .equipped, .total, .languages, .feats, .rituals, .companions {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    background: var(--bg-primary);
    padding: 1px var(--space-xs);
    border-radius: 3px;
  }

  .import-status {
    margin-top: var(--space-sm);
  }

  .status-message {
    padding: var(--space-sm);
    border-radius: 4px;
    font-size: var(--font-size-xs);
  }

  .status-message.info {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }

  .status-message.success {
    background: rgba(16, 185, 129, 0.1);
    color: var(--status-success);
    border: 1px solid var(--status-success);
  }

  .status-message.error {
    background: rgba(239, 68, 68, 0.1);
    color: var(--status-error);
    border: 1px solid var(--status-error);
  }
`
document.head.appendChild(style)
