const getAtPath = (obj, path) =>
  path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj)

const setAtPath = (obj, path, value) => {
  const keys = path.split('.')
  let ref = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    ref[k] = ref[k] ?? {}
    ref = ref[k]
  }
  ref[keys[keys.length - 1]] = value
}

export const applyPatches = (G, patches = []) => {
  console.log('Applying patches:', JSON.stringify(patches, null, 2))
  for (const p of patches) {
    // Skip undefined or null patches
    if (!p || typeof p !== 'object') {
      console.warn('Skipping invalid patch:', p)
      continue
    }
    
    switch (p.type) {
      case 'set': {
        if (p.value === undefined) {
          // Remove the property if value is undefined
          const keys = p.path.split('.')
          let ref = G
          for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i]
            ref[k] = ref[k] ?? {}
            ref = ref[k]
          }
          delete ref[keys[keys.length - 1]]
        } else {
          setAtPath(G, p.path, p.value)
        }
        break
      }
      case 'inc': {
        const current = getAtPath(G, p.path) || 0
        setAtPath(G, p.path, current + p.value)
        break
      }
      case 'merge': {
        const target = getAtPath(G, p.path) ?? {}
        setAtPath(G, p.path, { ...target, ...p.value })
        break
      }
      case 'add': {
        const array = getAtPath(G, p.path) || []
        setAtPath(G, p.path, [...array, p.value])
        break
      }
      case 'remove': {
        const arr = getAtPath(G, p.path) || []
        setAtPath(G, p.path, arr.filter(item => item !== p.value))
        break
      }
      case 'log': {
        const existingLog = getAtPath(G, 'log')
        const log = Array.isArray(existingLog) ? existingLog : []
        const logEntry = Object.assign({ ts: (G._ts || 0) + 1 }, p.value)
        log.push(logEntry)
        setAtPath(G, 'log', log)
        setAtPath(G, '_ts', (G._ts || 0) + 1)
        break
      }
    }
  }
}
  
