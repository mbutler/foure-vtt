/**
 * Item Loader - Search and load items from packs
 */

import { loadPackData } from './catalog.js'

// Cache for loaded items
const itemCache = new Map()

/**
 * Find items by name (fuzzy search)
 */
export async function findItemsByName(itemName) {
  if (!itemName) return null
  
  const normalizedName = itemName.toLowerCase().trim()
  
  // Check cache first
  if (itemCache.has(normalizedName)) {
    return itemCache.get(normalizedName)
  }
  
  try {
    // Load all item packs
    const itemPacks = [
      'items',
      'consumables',
      'treasures'
    ]
    
    for (const packName of itemPacks) {
      const items = await loadPackData(packName)
      
      for (const item of items) {
        const itemData = item.data || item
        const name = itemData.name || itemData.system?.name || ''
        
        if (name.toLowerCase().includes(normalizedName) || 
            normalizedName.includes(name.toLowerCase())) {
          
          const result = {
            id: item.id || item._id,
            name: name,
            type: itemData.type || itemData.system?.type,
            rarity: itemData.rarity || itemData.system?.rarity,
            level: itemData.level || itemData.system?.level,
            price: itemData.price || itemData.system?.price,
            weight: itemData.weight || itemData.system?.weight,
            description: itemData.description || itemData.system?.description,
            properties: itemData.properties || itemData.system?.properties,
            powers: itemData.powers || itemData.system?.powers,
            ...itemData
          }
          
          // Cache the result
          itemCache.set(normalizedName, result)
          return result
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('Error finding item:', error)
    return null
  }
}

/**
 * Find items by type
 */
export async function findItemsByType(itemType) {
  if (!itemType) return []
  
  const normalizedType = itemType.toLowerCase().trim()
  const results = []
  
  try {
    const itemPacks = ['items', 'consumables', 'treasures']
    
    for (const packName of itemPacks) {
      const items = await loadPackData(packName)
      
      for (const item of items) {
        const itemData = item.data || item
        const type = itemData.type || itemData.system?.type || ''
        
        if (type.toLowerCase().includes(normalizedType)) {
          const name = itemData.name || itemData.system?.name || ''
          
          results.push({
            id: item.id || item._id,
            name: name,
            type: type,
            rarity: itemData.rarity || itemData.system?.rarity,
            level: itemData.level || itemData.system?.level,
            price: itemData.price || itemData.system?.price,
            weight: itemData.weight || itemData.system?.weight,
            description: itemData.description || itemData.system?.description,
            properties: itemData.properties || itemData.system?.properties,
            powers: itemData.powers || itemData.system?.powers,
            ...itemData
          })
        }
      }
    }
    
    return results
  } catch (error) {
    console.error('Error finding items by type:', error)
    return []
  }
}

/**
 * Find items by rarity
 */
export async function findItemsByRarity(rarity) {
  if (!rarity) return []
  
  const normalizedRarity = rarity.toLowerCase().trim()
  const results = []
  
  try {
    const itemPacks = ['items', 'consumables', 'treasures']
    
    for (const packName of itemPacks) {
      const items = await loadPackData(packName)
      
      for (const item of items) {
        const itemData = item.data || item
        const itemRarity = itemData.rarity || itemData.system?.rarity || ''
        
        if (itemRarity.toLowerCase().includes(normalizedRarity)) {
          const name = itemData.name || itemData.system?.name || ''
          const type = itemData.type || itemData.system?.type || ''
          
          results.push({
            id: item.id || item._id,
            name: name,
            type: type,
            rarity: itemRarity,
            level: itemData.level || itemData.system?.level,
            price: itemData.price || itemData.system?.price,
            weight: itemData.weight || itemData.system?.weight,
            description: itemData.description || itemData.system?.description,
            properties: itemData.properties || itemData.system?.properties,
            powers: itemData.powers || itemData.system?.powers,
            ...itemData
          })
        }
      }
    }
    
    return results
  } catch (error) {
    console.error('Error finding items by rarity:', error)
    return []
  }
}

/**
 * Find items by level range
 */
export async function findItemsByLevel(minLevel = 1, maxLevel = 30) {
  const results = []
  
  try {
    const itemPacks = ['items', 'consumables', 'treasures']
    
    for (const packName of itemPacks) {
      const items = await loadPackData(packName)
      
      for (const item of items) {
        const itemData = item.data || item
        const level = itemData.level || itemData.system?.level || 1
        
        if (level >= minLevel && level <= maxLevel) {
          const name = itemData.name || itemData.system?.name || ''
          const type = itemData.type || itemData.system?.type || ''
          const rarity = itemData.rarity || itemData.system?.rarity || ''
          
          results.push({
            id: item.id || item._id,
            name: name,
            type: type,
            rarity: rarity,
            level: level,
            price: itemData.price || itemData.system?.price,
            weight: itemData.weight || itemData.system?.weight,
            description: itemData.description || itemData.system?.description,
            properties: itemData.properties || itemData.system?.properties,
            powers: itemData.powers || itemData.system?.powers,
            ...itemData
          })
        }
      }
    }
    
    return results
  } catch (error) {
    console.error('Error finding items by level:', error)
    return []
  }
}

/**
 * Get item by ID
 */
export async function getItemById(itemId) {
  if (!itemId) return null
  
  try {
    const itemPacks = ['items', 'consumables', 'treasures']
    
    for (const packName of itemPacks) {
      const items = await loadPackData(packName)
      
      for (const item of items) {
        const id = item.id || item._id
        if (id === itemId) {
          const itemData = item.data || item
          const name = itemData.name || itemData.system?.name || ''
          const type = itemData.type || itemData.system?.type || ''
          const rarity = itemData.rarity || itemData.system?.rarity || ''
          const level = itemData.level || itemData.system?.level || 1
          
          return {
            id: id,
            name: name,
            type: type,
            rarity: rarity,
            level: level,
            price: itemData.price || itemData.system?.price,
            weight: itemData.weight || itemData.system?.weight,
            description: itemData.description || itemData.system?.description,
            properties: itemData.properties || itemData.system?.properties,
            powers: itemData.powers || itemData.system?.powers,
            ...itemData
          }
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('Error getting item by ID:', error)
    return null
  }
}

/**
 * Clear item cache
 */
export function clearItemCache() {
  itemCache.clear()
}
