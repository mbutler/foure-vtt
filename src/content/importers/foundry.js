import { Power } from '../schemas.js'

export const importFoundryPowers = rawList => {
  const out = []
  for (const raw of rawList) {
    // sketchy mapper — you’ll expand this as you meet real data
    const mapped = {
      id: raw._id || raw.id || raw.name,
      name: raw.name,
      usage: mapUsage(raw.system?.usage || raw.data?.usage),
      action: mapAction(raw.system?.actionType || raw.data?.actionType),
      keywords: normalizeKeywords(raw.system?.keywords || raw.data?.keywords),
      attack: mapAttack(raw.system, raw.data),
      targeting: mapTargeting(raw.system, raw.data),
      hit: raw.system?.hit || null,
      miss: raw.system?.miss || null,
      effect: raw.system?.effect || null
    }
    const parsed = Power.safeParse(mapped)
    if (parsed.success) out.push(parsed.data)
    else console.warn('import warning:', parsed.error.format(), mapped)
  }
  return out
}

const mapUsage = u => {
  const s = String(u || '').toLowerCase()
  if (s.includes('encounter')) return 'encounter'
  if (s.includes('daily')) return 'daily'
  return 'at-will'
}

const mapAction = a => {
  const s = String(a || '').toLowerCase()
  if (s.includes('minor')) return 'minor'
  if (s.includes('move')) return 'move'
  if (s.includes('free')) return 'free'
  if (s.includes('immediate')) return 'immediate'
  return 'standard'
}

const normalizeKeywords = k =>
  Array.isArray(k) ? k.map(x => String(x).toLowerCase()) : []
  
const mapAttack = (sys, data) => {
  const src = sys || data || {}
  const vs = src.defense || src.attackVs
  return vs
    ? { vs: vs === 'Reflex' ? 'Ref' : vs }
    : undefined
}

const mapTargeting = (sys, data) => {
  const src = sys || data || {}
  const t = src.template || src.targeting
  if (!t) return undefined
  const s = String(t).toLowerCase()
  if (s.includes('blast')) return { template: 'blast' }
  if (s.includes('burst')) return { template: 'burst' }
  return { template: 'single' }
}
