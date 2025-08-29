/**
 * Power Display Component
 * Renders power information in a compact, readable format
 */

export class PowerDisplay {
  constructor(container) {
    this.container = container
    this.init()
  }

  init() {
    this.render()
  }

  render() {
    // Add CSS for power display
    const style = document.createElement('style')
    style.textContent = `
      .power-display {
        background: #1a1a1a;
        border: 1px solid #333333;
        border-radius: 6px;
        padding: 15px;
        margin-bottom: 15px;
      }
      
      .power-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid #444444;
      }
      
      .power-name {
        font-size: 16px;
        font-weight: 600;
        color: #ffffff;
      }
      
      .power-usage {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .power-usage.at-will {
        background: #4ade80;
        color: #000000;
      }
      
      .power-usage.encounter {
        background: #f87171;
        color: #000000;
      }
      
      .power-usage.daily {
        background: #9ca3af;
        color: #000000;
      }
      
      .power-usage.utility {
        background: #60a5fa;
        color: #000000;
      }
      
      .power-details {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 10px;
        margin-bottom: 10px;
      }
      
      .power-detail {
        background: #333333;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
      }
      
      .power-detail-label {
        color: #999999;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 2px;
      }
      
      .power-detail-value {
        color: #ffffff;
        font-weight: 500;
      }
      
      .power-description {
        background: #222222;
        padding: 12px;
        border-radius: 4px;
        font-size: 13px;
        line-height: 1.4;
        color: #cccccc;
        border-left: 3px solid #444444;
      }
      
      .power-description p {
        margin: 0 0 8px 0;
      }
      
      .power-description p:last-child {
        margin-bottom: 0;
      }
      
      .power-keywords {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 10px;
      }
      
      .power-keyword {
        background: #444444;
        color: #cccccc;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 500;
      }
      
      .power-not-found {
        color: #f87171;
        font-style: italic;
        font-size: 13px;
        padding: 8px;
        background: rgba(248, 113, 113, 0.1);
        border-radius: 4px;
        border: 1px solid rgba(248, 113, 113, 0.3);
      }
    `
    document.head.appendChild(style)
  }

  displayPower(power) {
    const powerElement = document.createElement('div')
    powerElement.className = 'power-display'
    
    if (power.packData) {
      // Power found in packs - show full details
      powerElement.innerHTML = this.renderPowerDetails(power)
    } else {
      // Power not found - show basic info
      powerElement.innerHTML = this.renderBasicPower(power)
    }
    
    this.container.appendChild(powerElement)
  }

  renderPowerDetails(power) {
    const packData = power.packData
    const system = packData.system || {}
    
    return `
      <div class="power-header">
        <div class="power-name">${power.name}</div>
        <div class="power-usage ${power.usage}">${power.usage}</div>
      </div>
      
      <div class="power-details">
        ${system.level ? `<div class="power-detail">
          <div class="power-detail-label">Level</div>
          <div class="power-detail-value">${system.level}</div>
        </div>` : ''}
        
        ${system.powersource ? `<div class="power-detail">
          <div class="power-detail-label">Source</div>
          <div class="power-detail-value">${system.powersource}</div>
        </div>` : ''}
        
        ${system.activation?.type ? `<div class="power-detail">
          <div class="power-detail-label">Action</div>
          <div class="power-detail-value">${system.activation.type}</div>
        </div>` : ''}
        
        ${system.target ? `<div class="power-detail">
          <div class="power-detail-label">Target</div>
          <div class="power-detail-value">${system.target}</div>
        </div>` : ''}
        
        ${system.range?.value ? `<div class="power-detail">
          <div class="power-detail-label">Range</div>
          <div class="power-detail-value">${system.range.value}${system.range.units || ''}</div>
        </div>` : ''}
      </div>
      
      ${system.description?.value ? `<div class="power-description">
        ${this.formatDescription(system.description.value)}
      </div>` : ''}
      
      ${system.keyWords && system.keyWords.length > 0 ? `<div class="power-keywords">
        ${system.keyWords.map(keyword => `<span class="power-keyword">${keyword}</span>`).join('')}
      </div>` : ''}
    `
  }

  renderBasicPower(power) {
    return `
      <div class="power-header">
        <div class="power-name">${power.name}</div>
        <div class="power-usage ${power.usage}">${power.usage}</div>
      </div>
      
      <div class="power-not-found">
        Power definition not found in packs. This is a basic power entry.
      </div>
    `
  }

  formatDescription(description) {
    // Convert HTML to plain text and format for display
    const div = document.createElement('div')
    div.innerHTML = description
    
    // Extract text content and format
    let text = div.textContent || div.innerText || ''
    
    // Clean up extra whitespace
    text = text.replace(/\s+/g, ' ').trim()
    
    // Split into paragraphs
    const paragraphs = text.split(/(?<=\.)\s+(?=[A-Z])/).filter(p => p.trim())
    
    return paragraphs.map(p => `<p>${p.trim()}</p>`).join('')
  }

  clear() {
    this.container.innerHTML = ''
  }
}
