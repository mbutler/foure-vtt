/**
 * Ritual Loader - Search and load rituals from packs
 */

import { loadPackData } from './catalog.js'

// Cache for loaded rituals
const ritualCache = new Map()

/**
 * Find rituals by name (fuzzy search)
 */
export async function findRitualsByName(ritualName) {
  if (!ritualName) return null
  
  const normalizedName = ritualName.toLowerCase().trim()
  
  // Check cache first
  if (ritualCache.has(normalizedName)) {
    return ritualCache.get(normalizedName)
  }
  
  try {
    // Load rituals pack
    const rituals = await loadPackData('rituals')
    
    for (const ritual of rituals) {
      const ritualData = ritual.data || ritual
      const name = ritualData.name || ritualData.system?.name || ''
      
      if (name.toLowerCase().includes(normalizedName) || 
          normalizedName.includes(name.toLowerCase())) {
        
        const result = {
          id: ritual.id || ritual._id,
          name: name,
          level: ritualData.level || ritualData.system?.level,
          category: ritualData.category || ritualData.system?.category,
          time: ritualData.time || ritualData.system?.time,
          duration: ritualData.duration || ritualData.system?.duration,
          componentCost: ritualData.componentCost || ritualData.system?.componentCost,
          marketPrice: ritualData.marketPrice || ritualData.system?.marketPrice,
          keySkill: ritualData.keySkill || ritualData.system?.keySkill,
          description: ritualData.description || ritualData.system?.description,
          ...ritualData
        }
        
        // Cache the result
        ritualCache.set(normalizedName, result)
        return result
      }
    }
    
    return null
  } catch (error) {
    console.error('Error finding ritual:', error)
    return null
  }
}

/**
 * Find rituals by category
 */
export async function findRitualsByCategory(category) {
  if (!category) return []
  
  const normalizedCategory = category.toLowerCase().trim()
  const results = []
  
  try {
    const rituals = await loadPackData('rituals')
    
    for (const ritual of rituals) {
      const ritualData = ritual.data || ritual
      const ritualCategory = ritualData.category || ritualData.system?.category || ''
      
      if (ritualCategory.toLowerCase().includes(normalizedCategory)) {
        const name = ritualData.name || ritualData.system?.name || ''
        const level = ritualData.level || ritualData.system?.level || 1
        
        results.push({
          id: ritual.id || ritual._id,
          name: name,
          level: level,
          category: ritualCategory,
          time: ritualData.time || ritualData.system?.time,
          duration: ritualData.duration || ritualData.system?.duration,
          componentCost: ritualData.componentCost || ritualData.system?.componentCost,
          marketPrice: ritualData.marketPrice || ritualData.system?.marketPrice,
          keySkill: ritualData.keySkill || ritualData.system?.keySkill,
          description: ritualData.description || ritualData.system?.description,
          ...ritualData
        })
      }
    }
    
    return results
  } catch (error) {
    console.error('Error finding rituals by category:', error)
    return []
  }
}

/**
 * Find rituals by level range
 */
export async function findRitualsByLevel(minLevel = 1, maxLevel = 30) {
  const results = []
  
  try {
    const rituals = await loadPackData('rituals')
    
    for (const ritual of rituals) {
      const ritualData = ritual.data || ritual
      const level = ritualData.level || ritualData.system?.level || 1
      
      if (level >= minLevel && level <= maxLevel) {
        const name = ritualData.name || ritualData.system?.name || ''
        const category = ritualData.category || ritualData.system?.category || ''
        
        results.push({
          id: ritual.id || ritual._id,
          name: name,
          level: level,
          category: category,
          time: ritualData.time || ritualData.system?.time,
          duration: ritualData.duration || ritualData.system?.duration,
          componentCost: ritualData.componentCost || ritualData.system?.componentCost,
          marketPrice: ritualData.marketPrice || ritualData.system?.marketPrice,
          keySkill: ritualData.keySkill || ritualData.system?.keySkill,
          description: ritualData.description || ritualData.system?.description,
          ...ritualData
        })
      }
    }
    
    return results
  } catch (error) {
    console.error('Error finding rituals by level:', error)
    return []
  }
}

/**
 * Find rituals by key skill
 */
export async function findRitualsByKeySkill(skill) {
  if (!skill) return []
  
  const normalizedSkill = skill.toLowerCase().trim()
  const results = []
  
  try {
    const rituals = await loadPackData('rituals')
    
    for (const ritual of rituals) {
      const ritualData = ritual.data || ritual
      const keySkill = ritualData.keySkill || ritualData.system?.keySkill || ''
      
      if (keySkill.toLowerCase().includes(normalizedSkill)) {
        const name = ritualData.name || ritualData.system?.name || ''
        const level = ritualData.level || ritualData.system?.level || 1
        const category = ritualData.category || ritualData.system?.category || ''
        
        results.push({
          id: ritual.id || ritual._id,
          name: name,
          level: level,
          category: category,
          keySkill: keySkill,
          time: ritualData.time || ritualData.system?.time,
          duration: ritualData.duration || ritualData.system?.duration,
          componentCost: ritualData.componentCost || ritualData.system?.componentCost,
          marketPrice: ritualData.marketPrice || ritualData.system?.marketPrice,
          description: ritualData.description || ritualData.system?.description,
          ...ritualData
        })
      }
    }
    
    return results
  } catch (error) {
    console.error('Error finding rituals by key skill:', error)
    return []
  }
}

/**
 * Get ritual by ID
 */
export async function getRitualById(ritualId) {
  if (!ritualId) return null
  
  try {
    const rituals = await loadPackData('rituals')
    
    for (const ritual of rituals) {
      const id = ritual.id || ritual._id
      if (id === ritualId) {
        const ritualData = ritual.data || ritual
        const name = ritualData.name || ritualData.system?.name || ''
        const level = ritualData.level || ritualData.system?.level || 1
        const category = ritualData.category || ritualData.system?.category || ''
        const keySkill = ritualData.keySkill || ritualData.system?.keySkill || ''
        
        return {
          id: id,
          name: name,
          level: level,
          category: category,
          keySkill: keySkill,
          time: ritualData.time || ritualData.system?.time,
          duration: ritualData.duration || ritualData.system?.duration,
          componentCost: ritualData.componentCost || ritualData.system?.componentCost,
          marketPrice: ritualData.marketPrice || ritualData.system?.marketPrice,
          description: ritualData.description || ritualData.system?.description,
          ...ritualData
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('Error getting ritual by ID:', error)
    return null
  }
}

/**
 * Get all ritual categories
 */
export async function getRitualCategories() {
  const categories = new Set()
  
  try {
    const rituals = await loadPackData('rituals')
    
    for (const ritual of rituals) {
      const ritualData = ritual.data || ritual
      const category = ritualData.category || ritualData.system?.category || ''
      
      if (category) {
        categories.add(category)
      }
    }
    
    return Array.from(categories).sort()
  } catch (error) {
    console.error('Error getting ritual categories:', error)
    return []
  }
}

/**
 * Clear ritual cache
 */
export function clearRitualCache() {
  ritualCache.clear()
}
