/**
 * Catalog System - Load and manage pack data
 */

// Cache for loaded pack data
const packCache = new Map()

/**
 * Load pack data from the packs directory
 */
export async function loadPackData(packName) {
  // Check cache first
  if (packCache.has(packName)) {
    return packCache.get(packName)
  }
  
  try {
    // For now, return empty array - we'll implement actual loading later
    // This prevents 404 errors while we set up the system
    console.log(`Loading pack: ${packName}`)
    
    const packData = []
    packCache.set(packName, packData)
    return packData
  } catch (error) {
    console.error(`Error loading pack ${packName}:`, error)
    return []
  }
}

/**
 * Clear pack cache
 */
export function clearPackCache() {
  packCache.clear()
}

/**
 * Get available pack names
 */
export function getAvailablePacks() {
  return [
    'powers',
    'items',
    'consumables',
    'treasures',
    'rituals',
    'feats',
    'classes',
    'races',
    'themes',
    'backgrounds',
    'paragon-paths',
    'epic-destinies',
    'monsters-mm3',
    'monsters-legacy'
  ]
}
