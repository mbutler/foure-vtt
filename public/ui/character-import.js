/**
 * Character Import UI Component
 * Handles .dnd4e file uploads and displays parsed character data
 */

// Simple character parser for .dnd4e XML files
class SimpleCharacterParser {
    constructor() {
        this.powerCache = new Map();
    }

    async parseCharacterFile(xmlContent) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
            
            if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
                throw new Error('Invalid XML format');
            }

            const character = {
                name: this.getTextContent(xmlDoc, 'Details name'),
                level: parseInt(this.getTextContent(xmlDoc, 'Details Level')) || 1,
                powers: await this.parsePowers(xmlDoc)
            };

            return character;
        } catch (error) {
            console.error('Error parsing character file:', error);
            throw error;
        }
    }

    getTextContent(xmlDoc, path) {
        const element = xmlDoc.querySelector(path);
        return element ? element.textContent.trim() : '';
    }

    async parsePowers(xmlDoc) {
        const powers = [];
        const powerElements = xmlDoc.querySelectorAll('Power');
        
        for (const powerElement of powerElements) {
            const powerName = this.getTextContent(powerElement, 'name');
            if (!powerName) continue;

            const usage = this.extractPowerUsage(powerElement);
            
            powers.push({
                name: powerName,
                usage: usage,
                data: null // Will be populated by power search
            });
        }
        
        return powers;
    }

    extractPowerUsage(powerElement) {
        // Look for Power Usage in specific tags
        const usageElements = powerElement.querySelectorAll('specific[name="Power Usage"]');
        for (const usageEl of usageElements) {
            const usage = usageEl.textContent.trim();
            if (usage.includes('At-Will')) return 'At-Will';
            if (usage.includes('Encounter')) return 'Encounter';
            if (usage.includes('Daily')) return 'Daily';
            if (usage.includes('Utility')) return 'Utility';
        }
        
        // Fallback: check power name for usage hints
        const powerName = this.getTextContent(powerElement, 'name');
        if (powerName.includes('Utility')) return 'Utility';
        
        return 'At-Will'; // Default
    }
}

class CharacterImport {
    constructor(container, onCharacterLoaded) {
        this.container = container;
        this.onCharacterLoaded = onCharacterLoaded;
        this.characterData = null;
        this.powerCache = new Map();
        this.allPowerFiles = [];
        this.parser = new SimpleCharacterParser();
        
        this.init();
    }

    init() {
        this.render();
        this.loadAllPowerFiles();
    }

    async loadAllPowerFiles() {
        if (this.allPowerFiles.length > 0) return this.allPowerFiles;
        
        try {
            const response = await fetch('/api/powers/index');
            if (response.ok) {
                const powerIndex = await response.json();
                this.allPowerFiles.push(...powerIndex);
                console.log(`Loaded ${powerIndex.length} power files from server`);
                return powerIndex;
            }
        } catch (error) {
            console.error('Failed to load power index:', error);
        }
        return [];
    }

    // Foundry-style power search using regex patterns
    async searchAllPowerFiles(powerName) {
        // Strategy 1: Try lookup table first (fast path)
        if (this.powerLookup && this.powerLookup[powerName]) {
            const fileName = this.powerLookup[powerName];
            try {
                const response = await fetch(`/packs/powers/_source/${fileName}.json`);
                if (response.ok) {
                    const powerData = await response.json();
                    return powerData;
                }
            } catch (error) {
                console.warn(`Could not load power file for ${fileName}:`, error);
            }
        }
        
        // Strategy 2: Foundry-style regex pattern matching
        try {
            const allFiles = await this.loadAllPowerFiles();
            
            // Create regex pattern like Foundry does
            const pattern = new RegExp(powerName.replaceAll(/[\(\)\[\]\+]/g, "\\$&"), "i");
            
            // Find all matches
            const matches = allFiles.filter(powerFile => {
                const filePowerName = powerFile.name || '';
                return filePowerName.match(pattern);
            });
            
            if (matches.length > 0) {
                // Sort by length (shorter names first, like Foundry)
                matches.sort((a, b) => (a.name || '').length - (b.name || '').length);
                
                // Take the first match
                const bestMatch = matches[0];
                try {
                    const response = await fetch(`/packs/powers/_source/${bestMatch.fileName}`);
                    if (response.ok) {
                        const powerData = await response.json();
                        return powerData;
                    }
                } catch (error) {
                    console.warn(`Could not load power file for ${bestMatch.fileName}:`, error);
                }
            }
        } catch (error) {
            console.warn('Failed to search all power files:', error);
        }
        
        return null;
    }

    normalizePowerName(name) {
        return name.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    async handleFileUpload(file) {
        try {
            const content = await file.text();
            this.characterData = await this.parser.parseCharacterFile(content);
            
            // Search for power definitions for each power
            for (const power of this.characterData.powers) {
                try {
                    power.data = await this.searchAllPowerFiles(power.name);
                } catch (error) {
                    console.warn(`Failed to find power data for ${power.name}:`, error);
                }
            }
            
            this.onCharacterLoaded(this.characterData);
            this.render();
        } catch (error) {
            console.error('Error parsing character file:', error);
            this.showError('Failed to parse character file');
        }
    }

    showError(message) {
        // Simple error display
        const errorDiv = document.createElement('div');
        errorDiv.className = 'import-error';
        errorDiv.textContent = message;
        this.container.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 3000);
    }

    render() {
        this.container.innerHTML = `
            <div class="character-import">
                <details class="import-details">
                    <summary class="import-summary">
                        <span class="import-icon">📁</span>
                        <span class="import-text">Import Character</span>
                    </summary>
                    <div class="import-content">
                        <input type="file" id="character-file" accept=".dnd4e" style="display: none;">
                        <button class="import-button" onclick="document.getElementById('character-file').click()">
                            Choose .dnd4e file
                        </button>
                        ${this.characterData ? `
                            <div class="import-success">
                                <div class="imported-character">
                                    <strong>${this.characterData.name}</strong> (Level ${this.characterData.level})
                                </div>
                                <div class="imported-powers">
                                    ${this.characterData.powers.length} powers loaded
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </details>
            </div>
        `;

        // Add file input listener
        const fileInput = document.getElementById('character-file');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.handleFileUpload(file);
                }
            });
        }
    }
}

// Export for use in main app
window.CharacterImport = CharacterImport;
