/**
 * Character Parser for .dnd4e XML files
 * Extracts character data and integrates with pack system
 */

import { findPowersByClass, findPowersByName } from '../content/power-loader.js'
import { findItemsByName } from '../content/item-loader.js'
import { findRitualsByName } from '../content/ritual-loader.js'

export class CharacterParser {
  constructor() {
    this.packCache = new Map()
  }

  /**
   * Parse a .dnd4e XML file and extract character data
   */
  async parseCharacterFile(xmlContent) {
    try {
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml')
      
      if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('Invalid XML format')
      }

      const character = {
        details: this.parseDetails(xmlDoc),
        stats: this.parseStats(xmlDoc),
        abilities: this.parseAbilities(xmlDoc),
        skills: this.parseSkills(xmlDoc),
        powers: await this.parsePowers(xmlDoc),
        items: await this.parseItems(xmlDoc),
        rituals: await this.parseRituals(xmlDoc),
        feats: this.parseFeats(xmlDoc),
        classes: this.parseClasses(xmlDoc),
        race: this.parseRace(xmlDoc),
        theme: this.parseTheme(xmlDoc),
        background: this.parseBackground(xmlDoc),
        paragonPath: this.parseParagonPath(xmlDoc),
        epicDestiny: this.parseEpicDestiny(xmlDoc),
        languages: this.parseLanguages(xmlDoc),
        proficiencies: this.parseProficiencies(xmlDoc),
        conditions: this.parseConditions(xmlDoc),
        companions: this.parseCompanions(xmlDoc)
      }

      return character
    } catch (error) {
      console.error('Error parsing character file:', error)
      throw error
    }
  }

  /**
   * Parse character details
   */
  parseDetails(xmlDoc) {
    const details = xmlDoc.querySelector('Details')
    if (!details) return {}

    return {
      name: this.getTextContent(details, 'name'),
      level: parseInt(this.getTextContent(details, 'Level')) || 1,
      player: this.getTextContent(details, 'Player'),
      height: this.getTextContent(details, 'Height'),
      weight: this.getTextContent(details, 'Weight'),
      gender: this.getTextContent(details, 'Gender'),
      age: parseInt(this.getTextContent(details, 'Age')) || 0,
      alignment: this.getTextContent(details, 'Alignment'),
      company: this.getTextContent(details, 'Company'),
      portrait: this.getTextContent(details, 'Portrait'),
      experience: parseInt(this.getTextContent(details, 'Experience')) || 0,
      carriedMoney: this.getTextContent(details, 'CarriedMoney'),
      storedMoney: this.getTextContent(details, 'StoredMoney'),
      traits: this.getTextContent(details, 'Traits'),
      appearance: this.getTextContent(details, 'Appearance'),
      companions: this.getTextContent(details, 'Companions'),
      notes: this.getTextContent(details, 'Notes')
    }
  }

  /**
   * Parse ability scores
   */
  parseAbilities(xmlDoc) {
    const abilities = xmlDoc.querySelector('AbilityScores')
    if (!abilities) return {}

    return {
      strength: parseInt(abilities.querySelector('Strength')?.getAttribute('score')) || 10,
      constitution: parseInt(abilities.querySelector('Constitution')?.getAttribute('score')) || 10,
      dexterity: parseInt(abilities.querySelector('Dexterity')?.getAttribute('score')) || 10,
      intelligence: parseInt(abilities.querySelector('Intelligence')?.getAttribute('score')) || 10,
      wisdom: parseInt(abilities.querySelector('Wisdom')?.getAttribute('score')) || 10,
      charisma: parseInt(abilities.querySelector('Charisma')?.getAttribute('score')) || 10
    }
  }

  /**
   * Parse computed stats
   */
  parseStats(xmlDoc) {
    const statBlock = xmlDoc.querySelector('StatBlock')
    if (!statBlock) return {}

    const stats = {}
    const statElements = statBlock.querySelectorAll('Stat')

    statElements.forEach(stat => {
      const value = parseInt(stat.getAttribute('value')) || 0
      const aliases = stat.querySelectorAll('alias')
      
      aliases.forEach(alias => {
        const name = alias.getAttribute('name')
        if (name) {
          stats[name] = value
        }
      })
    })

    return {
      ac: stats['AC'] || 10,
      fortitude: stats['Fortitude'] || 10,
      reflex: stats['Reflex'] || 10,
      will: stats['Will'] || 10,
      initiative: stats['Initiative'] || 0,
      speed: stats['Speed'] || 6,
      hp: stats['Hit Points'] || 0,
      maxHP: stats['Hit Points'] || 0,
      healingSurges: stats['Healing Surges'] || 0,
      maxSurges: stats['Healing Surges'] || 0,
      level: stats['Level'] || 1,
      actionPoints: stats['Action Point'] || 1,
      powerPoints: stats['Power Points'] || 0,
      passivePerception: stats['Passive Perception'] || 10,
      passiveInsight: stats['Passive Insight'] || 10
    }
  }

  /**
   * Parse skills
   */
  parseSkills(xmlDoc) {
    const skills = {}
    const statBlock = xmlDoc.querySelector('StatBlock')
    if (!statBlock) return skills

    const skillNames = [
      'Acrobatics', 'Arcana', 'Athletics', 'Bluff', 'Diplomacy', 'Dungeoneering',
      'Endurance', 'Heal', 'History', 'Insight', 'Intimidate', 'Nature',
      'Perception', 'Religion', 'Stealth', 'Streetwise', 'Thievery'
    ]

    skillNames.forEach(skillName => {
      const skillValue = this.findStatValue(statBlock, skillName)
      if (skillValue !== null) {
        skills[skillName.toLowerCase()] = {
          total: skillValue,
          trained: this.findStatValue(statBlock, `${skillName} Trained`) > 0,
          misc: this.findStatValue(statBlock, `${skillName} Misc`) || 0
        }
      }
    })

    return skills
  }

  /**
   * Parse powers and find corresponding data from packs
   */
  async parsePowers(xmlDoc) {
    const powers = []
    const rulesElements = xmlDoc.querySelectorAll('RulesElementTally > RulesElement[type="Power"]')

    for (const element of rulesElements) {
      const powerName = element.getAttribute('name')
      const internalId = element.getAttribute('internal-id')
      const url = element.getAttribute('url')
      
      if (powerName) {
        // Try to find power in packs
        const packPower = await this.findPowerInPacks(powerName)
        
        const power = {
          name: powerName,
          internalId,
          url,
          ...packPower,
          // Extract power usage from character file
          usage: this.extractPowerUsage(element, xmlDoc)
        }
        
        powers.push(power)
      }
    }

    return this.groupPowersByType(powers)
  }

  /**
   * Parse items and find corresponding data from packs
   */
  async parseItems(xmlDoc) {
    const items = []
    const lootTally = xmlDoc.querySelector('LootTally')
    
    if (!lootTally) return items

    const lootElements = lootTally.querySelectorAll('loot')
    
    for (const loot of lootElements) {
      const count = parseInt(loot.getAttribute('count')) || 0
      const equipped = parseInt(loot.getAttribute('equip-count')) || 0
      const name = loot.getAttribute('name') || ''
      
      const rulesElements = loot.querySelectorAll('RulesElement')
      
      for (const element of rulesElements) {
        const itemName = element.getAttribute('name')
        const itemType = element.getAttribute('type')
        const internalId = element.getAttribute('internal-id')
        const url = element.getAttribute('url')
        
        if (itemName) {
          // Try to find item in packs
          const packItem = await this.findItemInPacks(itemName)
          
          const item = {
            name: itemName,
            type: itemType,
            internalId,
            url,
            count,
            equipped: equipped > 0,
            ...packItem
          }
          
          items.push(item)
        }
      }
    }

    return items
  }

  /**
   * Parse rituals and find corresponding data from packs
   */
  async parseRituals(xmlDoc) {
    const rituals = []
    const rulesElements = xmlDoc.querySelectorAll('RulesElementTally > RulesElement[type="Ritual"]')

    for (const element of rulesElements) {
      const ritualName = element.getAttribute('name')
      const internalId = element.getAttribute('internal-id')
      const url = element.getAttribute('url')
      
      if (ritualName) {
        // Try to find ritual in packs
        const packRitual = await this.findRitualInPacks(ritualName)
        
        const ritual = {
          name: ritualName,
          internalId,
          url,
          ...packRitual
        }
        
        rituals.push(ritual)
      }
    }

    return rituals
  }

  /**
   * Parse feats
   */
  parseFeats(xmlDoc) {
    const feats = []
    const rulesElements = xmlDoc.querySelectorAll('RulesElementTally > RulesElement[type="Feat"]')

    rulesElements.forEach(element => {
      const featName = element.getAttribute('name')
      const internalId = element.getAttribute('internal-id')
      const url = element.getAttribute('url')
      
      if (featName) {
        feats.push({
          name: featName,
          internalId,
          url,
          description: this.getSpecificText(element, 'Short Description')
        })
      }
    })

    return feats
  }

  /**
   * Parse classes
   */
  parseClasses(xmlDoc) {
    const classes = []
    const rulesElements = xmlDoc.querySelectorAll('RulesElementTally > RulesElement[type="Class"], RulesElementTally > RulesElement[type="Hybrid Class"]')

    rulesElements.forEach(element => {
      const className = element.getAttribute('name')
      const internalId = element.getAttribute('internal-id')
      const url = element.getAttribute('url')
      
      if (className) {
        classes.push({
          name: className,
          internalId,
          url,
          description: this.getSpecificText(element, 'Short Description')
        })
      }
    })

    return classes
  }

  /**
   * Parse race
   */
  parseRace(xmlDoc) {
    const raceElement = xmlDoc.querySelector('RulesElementTally > RulesElement[type="Race"]')
    if (!raceElement) return null

    return {
      name: raceElement.getAttribute('name'),
      internalId: raceElement.getAttribute('internal-id'),
      url: raceElement.getAttribute('url'),
      description: this.getSpecificText(raceElement, 'Short Description')
    }
  }

  /**
   * Parse theme
   */
  parseTheme(xmlDoc) {
    const themeElement = xmlDoc.querySelector('RulesElementTally > RulesElement[type="Theme"]')
    if (!themeElement) return null

    return {
      name: themeElement.getAttribute('name'),
      internalId: themeElement.getAttribute('internal-id'),
      url: themeElement.getAttribute('url'),
      description: this.getSpecificText(themeElement, 'Short Description')
    }
  }

  /**
   * Parse background
   */
  parseBackground(xmlDoc) {
    const backgroundElement = xmlDoc.querySelector('RulesElementTally > RulesElement[type="Background"]')
    if (!backgroundElement) return null

    return {
      name: backgroundElement.getAttribute('name'),
      internalId: backgroundElement.getAttribute('internal-id'),
      url: backgroundElement.getAttribute('url'),
      description: this.getSpecificText(backgroundElement, 'Short Description')
    }
  }

  /**
   * Parse paragon path
   */
  parseParagonPath(xmlDoc) {
    const paragonElement = xmlDoc.querySelector('RulesElementTally > RulesElement[type="Paragon Path"]')
    if (!paragonElement) return null

    return {
      name: paragonElement.getAttribute('name'),
      internalId: paragonElement.getAttribute('internal-id'),
      url: paragonElement.getAttribute('url'),
      description: this.getSpecificText(paragonElement, 'Short Description')
    }
  }

  /**
   * Parse epic destiny
   */
  parseEpicDestiny(xmlDoc) {
    const epicElement = xmlDoc.querySelector('RulesElementTally > RulesElement[type="Epic Destiny"]')
    if (!epicElement) return null

    return {
      name: epicElement.getAttribute('name'),
      internalId: epicElement.getAttribute('internal-id'),
      url: epicElement.getAttribute('url'),
      description: this.getSpecificText(epicElement, 'Short Description')
    }
  }

  /**
   * Parse languages
   */
  parseLanguages(xmlDoc) {
    const languages = []
    const rulesElements = xmlDoc.querySelectorAll('RulesElementTally > RulesElement[type="Language"]')

    rulesElements.forEach(element => {
      const languageName = element.getAttribute('name')
      if (languageName) {
        languages.push(languageName)
      }
    })

    return languages
  }

  /**
   * Parse proficiencies
   */
  parseProficiencies(xmlDoc) {
    const proficiencies = {
      weapons: [],
      armor: [],
      implements: []
    }

    const rulesElements = xmlDoc.querySelectorAll('RulesElementTally > RulesElement[type="Proficiency"]')

    rulesElements.forEach(element => {
      const profName = element.getAttribute('name')
      if (profName) {
        if (profName.includes('Weapon')) {
          proficiencies.weapons.push(profName)
        } else if (profName.includes('Armor')) {
          proficiencies.armor.push(profName)
        } else if (profName.includes('Implement')) {
          proficiencies.implements.push(profName)
        }
      }
    })

    return proficiencies
  }

  /**
   * Parse conditions and effects
   */
  parseConditions(xmlDoc) {
    const conditions = []
    const statBlock = xmlDoc.querySelector('StatBlock')
    
    if (!statBlock) return conditions

    // Look for condition-related stats
    const conditionStats = [
      'Bloodied', 'Dying', 'Stunned', 'Dazed', 'Weakened', 'Slowed',
      'Immobilized', 'Restrained', 'Blinded', 'Deafened', 'Poisoned'
    ]

    conditionStats.forEach(condition => {
      const value = this.findStatValue(statBlock, condition)
      if (value !== null && value > 0) {
        conditions.push({
          name: condition,
          value,
          active: true
        })
      }
    })

    return conditions
  }

  /**
   * Parse companions (familiars, mounts, etc.)
   */
  parseCompanions(xmlDoc) {
    const companions = []
    const rulesElements = xmlDoc.querySelectorAll('RulesElementTally > RulesElement[type="Familiar"], RulesElementTally > RulesElement[type="Companion"]')

    rulesElements.forEach(element => {
      const companionName = element.getAttribute('name')
      const internalId = element.getAttribute('internal-id')
      
      if (companionName) {
        companions.push({
          name: companionName,
          internalId,
          type: element.getAttribute('type')
        })
      }
    })

    return companions
  }

  /**
   * Find power in packs
   */
  async findPowerInPacks(powerName) {
    try {
      // Try to find by name first
      const power = await findPowersByName(powerName)
      if (power) return power

      // Try to find by class if we have class information
      // This would need to be enhanced based on the character's classes
      return null
    } catch (error) {
      console.warn(`Could not find power "${powerName}" in packs:`, error)
      return null
    }
  }

  /**
   * Find item in packs
   */
  async findItemInPacks(itemName) {
    try {
      const item = await findItemsByName(itemName)
      return item
    } catch (error) {
      console.warn(`Could not find item "${itemName}" in packs:`, error)
      return null
    }
  }

  /**
   * Find ritual in packs
   */
  async findRitualInPacks(ritualName) {
    try {
      const ritual = await findRitualsByName(ritualName)
      return ritual
    } catch (error) {
      console.warn(`Could not find ritual "${ritualName}" in packs:`, error)
      return null
    }
  }

  /**
   * Group powers by type (at-will, encounter, daily, utility)
   */
  groupPowersByType(powers) {
    const grouped = {
      'at-will': [],
      'encounter': [],
      'daily': [],
      'utility': []
    }

    powers.forEach(power => {
      const type = power.powerType || power.usage || 'at-will'
      const normalizedType = type.toLowerCase().replace(/\s+/g, '-')
      
      if (grouped[normalizedType]) {
        grouped[normalizedType].push(power)
      } else {
        grouped['at-will'].push(power)
      }
    })

    return grouped
  }

  /**
   * Extract power usage from character file
   */
  extractPowerUsage(powerElement, xmlDoc) {
    const powerName = powerElement.getAttribute('name')
    
    // First check for basic attacks and special cases
    if (powerName.includes('Basic Attack')) return 'at-will'
    if (powerName.includes('Second Wind')) return 'encounter'
    if (powerName.includes('Opportunity Attack')) return 'at-will'
    if (powerName.includes('Bull Rush Attack')) return 'at-will'
    if (powerName.includes('Grab Attack')) return 'at-will'
    
    // Look for the power in the detailed Power sections
    const powerElements = xmlDoc.querySelectorAll('Power')
    for (const powerElement of powerElements) {
      if (powerElement.getAttribute('name') === powerName) {
        const usageElement = powerElement.querySelector('specific[name="Power Usage"]')
        if (usageElement) {
          const usage = usageElement.textContent.trim()
          if (usage.includes('At-Will')) return 'at-will'
          if (usage.includes('Encounter')) return 'encounter'
          if (usage.includes('Daily')) return 'daily'
          if (usage.includes('Utility')) return 'utility'
        }
      }
    }
    
    // Default to at-will if we can't determine
    return 'at-will'
  }

  /**
   * Helper method to get text content
   */
  getTextContent(parent, tagName) {
    const element = parent.querySelector(tagName)
    return element ? element.textContent.trim() : ''
  }

  /**
   * Helper method to get specific text
   */
  getSpecificText(element, specificName) {
    const specific = element.querySelector(`specific[name="${specificName}"]`)
    return specific ? specific.textContent.trim() : ''
  }

  /**
   * Helper method to find stat value
   */
  findStatValue(statBlock, statName) {
    const stat = statBlock.querySelector(`Stat > alias[name="${statName}"]`)
    if (stat) {
      const statElement = stat.closest('Stat')
      return parseInt(statElement.getAttribute('value')) || 0
    }
    return null
  }

  /**
   * Create a compact character summary for UI display
   */
  createCharacterSummary(character) {
    return {
      name: character.details.name,
      level: character.details.level,
      race: character.race?.name,
      classes: character.classes.map(c => c.name).join(' / '),
      theme: character.theme?.name,
      background: character.background?.name,
      paragonPath: character.paragonPath?.name,
      epicDestiny: character.epicDestiny?.name,
      
      // Core stats
      hp: character.stats.hp,
      maxHP: character.stats.maxHP,
      healingSurges: character.stats.healingSurges,
      maxSurges: character.stats.maxSurges,
      ac: character.stats.ac,
      fortitude: character.stats.fortitude,
      reflex: character.stats.reflex,
      will: character.stats.will,
      initiative: character.stats.initiative,
      speed: character.stats.speed,
      
      // Abilities
      abilities: character.abilities,
      
      // Skills (top 5)
      topSkills: Object.entries(character.skills)
        .sort(([,a], [,b]) => b.total - a.total)
        .slice(0, 5)
        .map(([name, skill]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          total: skill.total,
          trained: skill.trained
        })),
      
      // Powers summary
      powers: {
        'at-will': character.powers['at-will']?.length || 0,
        'encounter': character.powers['encounter']?.length || 0,
        'daily': character.powers['daily']?.length || 0,
        'utility': character.powers['utility']?.length || 0
      },
      
      // Equipment summary
      equippedItems: character.items.filter(item => item.equipped),
      totalItems: character.items.length,
      
      // Other
      languages: character.languages,
      feats: character.feats.length,
      rituals: character.rituals.length,
      companions: character.companions.length
    }
  }
}

// Export singleton instance
export const characterParser = new CharacterParser()
