export const applyPatches = (G, patches = []) => {
    for (const p of patches) {
      // extremely small MVP applier — extend as you add patch kinds
      if (p.type === 'set') {
        const { path, value } = p
        setAtPath(G, path, value)
      }
      if (p.type === 'merge') {
        const { path, value } = p
        const target = getAtPath(G, path) ?? {}
        setAtPath(G, path, { ...target, ...value })
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
  