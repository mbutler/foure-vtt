/**
 * Power Lookup Table
 * Maps power names from XML to actual pack file names
 */

export const powerLookup = {
  // Basic attacks
  'Melee Basic Attack': 'Melee_Basic_Attack',
  'Ranged Basic Attack': 'Ranged_Basic_Attack',
  'Opportunity Attack': 'Opportunity_Attack',
  'Bull Rush Attack': 'Bull_Rush_Attack',
  'Grab Attack': 'Grab_Attack',
  
  // Bard powers - actual file names from packs
  'Vicious Mockery': 'Bard_01_Vicious_Mockery_Q89rDBAacGWnE3yl',
  'Majestic Word': 'Bard_Majestic_Word_A6Cq1oigOmXUjr5H',
  'Arrow of Warning': 'Bard_01_Arrow_of_Warning_paUW0n2vlT8mRd1k',
  'Rhyme of the Blood-Seeking Blade': 'Bard_03_Rhyme_of_the_Blood_Seeking_Blade_GhIqYxZk2Ff8XsM0',
  'Invitation to Defeat': 'Ardent_05_Invitation_to_Defeat_u2DK8JstnRVb0Xqr',
  'Revitalizing Incantation': 'Bard_06_Revitalizing_Incantation_14465',
  'Forward-Thinking Cut': 'Bard_07_Forward_Thinking_Cut_11104',
  'Stall Tactics': 'Bluff_10_Stall_Tactics_IBoh2sep4UHAJEan',
  'Mantle of Unity': 'Bard_10_Mantle_of_Unity_5699',
  'Victorious Smite': 'Bard_11_Victorious_Smite_5029',
  'Battle Chant': 'Bard_12_Battle_Chant_5030',
  'Visions of Victory': 'Bard_12_Visions_of_Victory_5031',
  'Coordinated Effort': 'Bard_15_Coordinated_Effort_12974',
  
  // Ardent powers
  'Ardent Surge': 'Ardent_Ardent_Surge_tiTRAzheoj3x9rqO',
  'Ire Strike': 'Ardent_01_Ire_Strike_11062',
  'Earthquake Strike': 'Ardent_13_Earthquake_Strike_5003',
  
  // Theme powers
  'Summon Sidhe Ally': 'Sidhe_Lord_01_Summon_Sidhe_Ally_15885',
  'Sidhe Bargain': 'Sidhe_Lord_11_Sidhe_Bargain_15886',
  
  // Racial powers
  'Eldritch Strike': 'Half_Elf_01_Eldritch_Strike_7402',
  
  // Utility powers
  'Second Wind': 'Second_Wind',
  'Hidden Lore': 'Hidden_Lore_13912',
  
  // Skill powers
  'Stall Tactics': 'Bluff_10_Stall_Tactics_IBoh2sep4UHAJEan',
  'Mantle of Unity': 'Skill_Power_Mantle_of_Unity_5699'
}

/**
 * Normalize power name for lookup
 */
export function normalizePowerName(name) {
  return name
    .replace(/\(.*?\)/g, '') // Remove parentheses
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}

/**
 * Find power in lookup table
 */
export function findPowerInLookup(powerName) {
  const normalized = normalizePowerName(powerName)
  
  // Direct match
  if (powerLookup[normalized]) {
    return powerLookup[normalized]
  }
  
  // Try partial matches
  for (const [key, value] of Object.entries(powerLookup)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value
    }
  }
  
  return null
}
