# Packs Directory Integration

## Overview

The `/packs` directory contains a comprehensive collection of D&D 4e game data in Foundry VTT format. This document explains how our powers system integrates with this data and how to use it effectively.

## Directory Structure

The `/packs` directory is organized into subdirectories, each containing different types of 4e entities:

```
packs/
├── powers_core/          # Basic attacks and core powers
│   └── _source/         # JSON files for each power
├── powers/              # Class powers and advanced powers
│   └── _source/         # JSON files for each power
├── classes/             # Character class definitions
│   └── _source/         # JSON files for each class
├── monsters-mm3/        # Monster Manual 3 creatures
│   └── _source/         # JSON files for each monster
├── items/               # Equipment and magic items
│   └── _source/         # JSON files for each item
├── feats/               # Character feats
│   └── _source/         # JSON files for each feat
└── ...                  # Other entity types
```

## Foundry VTT Power Format

Each power in the packs directory follows a specific JSON structure designed for Foundry VTT. Here's an example:

```json
{
  "_id": "OgXLUlMC0yOkiPSZ",
  "name": "Melee Basic Attack",
  "type": "power",
  "system": {
    "description": {
      "value": "<p class=\"flavour\"><em>You resort to the simple attack...</em></p>"
    },
    "target": "One creature",
    "attack": {
      "isAttack": true,
      "ability": "str",
      "def": "ac",
      "formula": "@wepAttack + @powerMod + @lvhalf"
    },
    "hit": {
      "isDamage": true,
      "baseQuantity": "1",
      "baseDiceType": "weapon",
      "detail": "1[W] + Strength modifier damage."
    },
    "keyWords": ["Weapon"],
    "useType": "atwill",
    "actionType": "standard",
    "weaponType": "melee",
    "rangeType": "weapon",
    "area": null,
    "damageType": {
      "physical": true
    }
  }
}
```

### Key Fields Explained

#### Basic Information
- `_id`: Unique identifier for the power
- `name`: Display name of the power
- `type`: Always "power" for power entities

#### System Fields
- `useType`: Power frequency ("atwill", "encounter", "daily", "utility")
- `actionType`: Action cost ("standard", "move", "minor", "free", "interrupt", "reaction", "opportunity")
- `level`: Character level requirement
- `powersource`: Power source ("arcane", "divine", "martial", "primal", etc.)
- `keyWords`: Array of power keywords for categorization

#### Combat Information
- `target`: Target description ("One creature", "Each creature in the burst", etc.)
- `rangeType`: Range type ("melee", "ranged", "closeBlast", "closeBurst", "area", "personal")
- `area`: Area size for burst/blast powers
- `weaponType`: Weapon type ("melee", "ranged", "implement", "none")

#### Attack Information
- `attack.isAttack`: Boolean indicating if this is an attack power
- `attack.ability`: Ability used for attack ("str", "dex", "con", "int", "wis", "cha")
- `attack.def`: Defense targeted ("ac", "fort", "ref", "will")
- `attack.formula`: Attack roll formula

#### Damage Information
- `hit.isDamage`: Boolean indicating if this deals damage
- `hit.baseQuantity`: Number of dice
- `hit.baseDiceType`: Dice type ("weapon", "d6", "d8", etc.)
- `hit.detail`: Damage description
- `damageType`: Object indicating damage types

#### Effects
- `effect.detail`: Effect description
- `sustain`: Sustain action information
- `trigger`: Trigger conditions
- `requirements`: Power requirements

## Power Loader Integration

Our `src/content/power-loader.js` module provides functions to convert Foundry VTT power data to our internal format:

### Converting Individual Powers

```javascript
import { convertFoundryPower } from '../src/content/power-loader.js'

const foundryPower = {
  "_id": "test",
  "name": "Test Power",
  "system": {
    "useType": "atwill",
    "actionType": "standard",
    "attack": { "isAttack": true, "ability": "str", "def": "ac" },
    "hit": { "isDamage": true, "baseQuantity": "1", "baseDiceType": "weapon" }
  }
}

const convertedPower = convertFoundryPower(foundryPower)
```

### Loading Powers from Directory

```javascript
import { loadPowersFromDirectory } from '../src/content/power-loader.js'

// Load all powers from a specific directory
const powers = await loadPowersFromDirectory('packs/powers_core/_source')
```

### Searching Powers

```javascript
import { findPowersByClass, findPowersByLevel, findPowersByType } from '../src/content/power-loader.js'

// Find powers by class
const wizardPowers = findPowersByClass('arcane', allPowers)

// Find powers by level
const level3Powers = findPowersByLevel(3, allPowers)

// Find powers by type
const encounterPowers = findPowersByType('encounter', allPowers)
```

## Conversion Process

The power loader performs the following conversions:

### Action Types
- `standard` → `ACTION_TYPES.STANDARD`
- `move` → `ACTION_TYPES.MOVE`
- `minor` → `ACTION_TYPES.MINOR`
- `free` → `ACTION_TYPES.FREE`
- `interrupt` → `ACTION_TYPES.IMMEDIATE_INTERRUPT`
- `reaction` → `ACTION_TYPES.IMMEDIATE_REACTION`
- `opportunity` → `ACTION_TYPES.OPPORTUNITY`

### Power Types
- `atwill` → `POWER_TYPES.AT_WILL`
- `encounter` → `POWER_TYPES.ENCOUNTER`
- `daily` → `POWER_TYPES.DAILY`
- `utility` → `POWER_TYPES.UTILITY`

### Range Types
- `melee` → Single target, range 1
- `ranged` → Single target, range from `range.value`
- `closeBlast` → Blast target, range 1, area from `area`
- `closeBurst` → Burst target, range 1, area from `area`
- `area` → Burst target, range from `range.value`, area from `area`
- `personal` → Self target, range 0

### Damage Types
- `physical` → `untyped`
- `acid`, `cold`, `fire`, `force`, `lightning`, `necrotic`, `poison`, `psychic`, `radiant`, `thunder` → Respective damage types

## Usage Examples

### Loading Core Powers

```javascript
import { loadCorePowers } from '../src/content/power-loader.js'

const corePowers = await loadCorePowers()
// Returns: [Melee Basic Attack, Ranged Basic Attack, Second Wind, etc.]
```

### Loading Class Powers

```javascript
import { loadClassPowers } from '../src/content/power-loader.js'

const classPowers = await loadClassPowers()
// Returns: [Wizard powers, Fighter powers, etc.]
```

### Creating Character Power Lists

```javascript
import { findPowersByClass, findPowersByLevel } from '../src/content/power-loader.js'

function getCharacterPowers(characterClass, characterLevel, allPowers) {
  const classPowers = findPowersByClass(characterClass, allPowers)
  const availablePowers = classPowers.filter(power => power.level <= characterLevel)
  
  return {
    atWill: availablePowers.filter(p => p.type === 'at-will'),
    encounter: availablePowers.filter(p => p.type === 'encounter'),
    daily: availablePowers.filter(p => p.type === 'daily'),
    utility: availablePowers.filter(p => p.type === 'utility')
  }
}
```

### Integrating with the UI

```javascript
import { PowersPanel } from './ui/powers-panel.js'

// The powers panel automatically loads and displays powers
const powersPanel = new PowersPanel(container, gameState, onPowerUse)
powersPanel.update(gameState) // Updates with current actor's powers
```

## Advanced Features

### Condition Parsing

The power loader automatically parses conditions from effect text:

```javascript
// Effect text: "Target is slowed and pushed 2 squares"
// Automatically converted to:
{
  conditions: [
    { id: 'slowed', duration: 'saveEnds' },
    { id: 'pushed', duration: 'saveEnds', data: { squares: 2 } }
  ]
}
```

### Damage Formula Parsing

Weapon damage and ability modifiers are properly handled:

```javascript
// Foundry format: baseQuantity: "1", baseDiceType: "weapon"
// Converted to: { dice: [{ n: 1, d: 'weapon' }], flat: 0, type: 'untyped' }
```

### Area Effect Support

Burst and blast powers are fully supported:

```javascript
// Foundry format: rangeType: "closeBlast", area: 5
// Converted to: { target: 'blast', range: 1, area: 5 }
```

## Future Enhancements

### File System Integration

Currently, the power loader provides the conversion logic but doesn't read from the filesystem. Future versions could:

1. **Direct File Reading**: Read JSON files directly from the packs directory
2. **Caching**: Cache converted powers for performance
3. **Lazy Loading**: Load powers on demand
4. **Hot Reloading**: Watch for file changes and reload automatically

### Extended Support

Future versions could support:

1. **Monster Powers**: Convert monster powers from `packs/monsters-*/_source/`
2. **Item Powers**: Convert magic item powers from `packs/items/_source/`
3. **Feat Powers**: Convert feat-granted powers from `packs/feats/_source/`
4. **Class Features**: Convert class features from `packs/classes/_source/`

### Advanced Parsing

Enhanced parsing could include:

1. **Complex Effects**: Parse more complex effect descriptions
2. **Sustain Actions**: Better support for sustained powers
3. **Trigger Conditions**: Parse trigger requirements
4. **Requirements**: Parse power prerequisites

## Testing

The power loader includes comprehensive tests in `tests/power-loader.test.js`:

```bash
bun test tests/power-loader.test.js
```

Tests cover:
- Basic power conversion
- Area effect conversion
- Search functionality
- Error handling
- Different range types
- Condition parsing

## Conclusion

The packs directory integration provides a solid foundation for loading and using real 4e power data. The power loader successfully converts Foundry VTT format to our internal format while preserving all the important game mechanics. This allows the VTT to use authentic 4e powers while maintaining the flexibility of our custom power system.
