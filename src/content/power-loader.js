/**
 * Power Loader - Load and search power data from packs
 */

import { findPowerInLookup } from './power-lookup.js'

// Cache for loaded power data
const powerCache = new Map()
const powerNameIndex = new Map()

/**
 * Load power data from the powers pack
 */
export async function loadPowerData() {
  if (powerCache.size > 0) {
    return Array.from(powerCache.values())
  }
  
  try {
    console.log('Loading power data from packs...')
    
    // For now, we'll load a few sample powers to test
    // In a full implementation, this would scan the entire packs/powers/_source directory
    const samplePowers = [
      'Bard_01_Vicious_Mockery_Q89rDBAacGWnE3yl.json',
      'Bard_01_Majestic_Word_2339.json',
      'Ardent_01_Ardent_Surge_10273.json'
    ]
    
    const powerData = []
    
    for (const filename of samplePowers) {
      try {
        const response = await fetch(`/packs/powers/_source/${filename}`)
        if (response.ok) {
          const power = await response.json()
          powerData.push(power)
          powerCache.set(power._id, power)
          
          // Index by name for quick lookup
          const normalizedName = normalizePowerName(power.name)
          powerNameIndex.set(normalizedName, power)
        }
      } catch (error) {
        console.warn(`Could not load power file ${filename}:`, error)
      }
    }
    
    console.log(`Loaded ${powerData.length} powers`)
    return powerData
  } catch (error) {
    console.error('Error loading power data:', error)
    return []
  }
}

/**
 * Find a power by name (fuzzy search)
 */
export async function findPowerByName(powerName) {
  // Try lookup table first
  const lookupResult = findPowerInLookup(powerName)
  if (lookupResult) {
    console.log(`Found power in lookup table: ${powerName} -> ${lookupResult}`)
    // Try to load the specific power file
    try {
      const response = await fetch(`/packs/powers/_source/${lookupResult}.json`)
      if (response.ok) {
        const power = await response.json()
        powerCache.set(power._id, power)
        return power
      }
    } catch (error) {
      console.warn(`Could not load power file for ${lookupResult}:`, error)
    }
  }
  
  // Normalize the power name for searching
  const normalizedName = normalizePowerName(powerName)
  
  // Check cache first
  if (powerNameIndex.has(normalizedName)) {
    return powerNameIndex.get(normalizedName)
  }
  
  // Load power data if not already loaded
  if (powerCache.size === 0) {
    await loadPowerData()
  }
  
  // Try exact match first
  for (const power of powerCache.values()) {
    if (normalizePowerName(power.name) === normalizedName) {
      return power
    }
  }
  
  // Try partial match
  for (const power of powerCache.values()) {
    const powerNameNormalized = normalizePowerName(power.name)
    if (powerNameNormalized.includes(normalizedName) || normalizedName.includes(powerNameNormalized)) {
      return power
    }
  }
  
  // Try fuzzy match with common patterns
  const searchPatterns = [
    powerName.replace(/\(.*?\)/g, '').trim(), // Remove parentheses
    powerName.replace(/\s+/g, ' ').trim(), // Normalize whitespace
    powerName.toLowerCase().replace(/[^a-z0-9]/g, '') // Alphanumeric only
  ]
  
  for (const pattern of searchPatterns) {
    for (const power of powerCache.values()) {
      const powerNameNormalized = normalizePowerName(power.name)
      if (powerNameNormalized.includes(pattern) || pattern.includes(powerNameNormalized)) {
        return power
      }
    }
  }
  
  console.log(`Power not found: ${powerName}`)
  return null
}

/**
 * Normalize power name for comparison
 */
function normalizePowerName(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric
    .replace(/\s+/g, '') // Remove spaces
}

/**
 * Find powers by class
 */
export async function findPowersByClass(className) {
  try {
    console.log(`Searching for powers by class: ${className}`)
    
    if (powerCache.size === 0) {
      await loadPowerData()
    }
    
    const classPowers = []
    const classPattern = new RegExp(className, 'i')
    
    for (const power of powerCache.values()) {
      if (classPattern.test(power.name)) {
        classPowers.push(power)
      }
    }
    
    return classPowers
  } catch (error) {
    console.error(`Error searching for powers by class ${className}:`, error)
    return []
  }
}

/**
 * Find powers by level range
 */
export async function findPowersByLevel(minLevel, maxLevel) {
  try {
    console.log(`Searching for powers by level: ${minLevel}-${maxLevel}`)
    
    if (powerCache.size === 0) {
      await loadPowerData()
    }
    
    const levelPowers = []
    
    for (const power of powerCache.values()) {
      const level = parseInt(power.system?.level) || 0
      if (level >= minLevel && level <= maxLevel) {
        levelPowers.push(power)
      }
    }
    
    return levelPowers
  } catch (error) {
    console.error(`Error searching for powers by level ${minLevel}-${maxLevel}:`, error)
    return []
  }
}

/**
 * Find powers by usage type
 */
export async function findPowersByUsage(usage) {
  try {
    console.log(`Searching for powers by usage: ${usage}`)
    
    if (powerCache.size === 0) {
      await loadPowerData()
    }
    
    const usagePowers = []
    
    for (const power of powerCache.values()) {
      const powerUsage = power.system?.description?.value?.toLowerCase() || ''
      if (powerUsage.includes(usage.toLowerCase())) {
        usagePowers.push(power)
      }
    }
    
    return usagePowers
  } catch (error) {
    console.error(`Error searching for powers by usage ${usage}:`, error)
    return []
  }
}

/**
 * Get power by ID
 */
export async function getPowerById(powerId) {
  try {
    console.log(`Getting power by ID: ${powerId}`)
    
    if (powerCache.size === 0) {
      await loadPowerData()
    }
    
    return powerCache.get(powerId) || null
  } catch (error) {
    console.error(`Error getting power by ID ${powerId}:`, error)
    return null
  }
}

/**
 * Clear power cache
 */
export function clearPowerCache() {
  powerCache.clear()
  powerNameIndex.clear()
}

/**
 * Get available power sources
 */
export function getPowerSources() {
  return [
    'arcane',
    'divine', 
    'martial',
    'primal',
    'psionic',
    'shadow'
  ]
}
