export const applyPatches = (G, patches = []) => {
  for (const p of patches) {
    switch (p.type) {
      case 'set': {
        setAtPath(G, p.path, p.value)
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
        const log = getAtPath(G, 'log') || []
        setAtPath(G, 'log', [...log, { ts: G._ts + 1, ...p.value }])
        setAtPath(G, '_ts', G._ts + 1)
        break
      }
    }
  }
}
  
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
  