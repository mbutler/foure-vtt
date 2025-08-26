const allowedKinds = new Set(['single', 'burst', 'blast'])
const allowedOrigins = new Set(['self', 'melee', 'ranged', 'area', 'close'])

export const normalizeTemplateSpec = (spec = {}) => {
  const out = { ...spec }
  if (!allowedKinds.has(out.kind)) out.kind = 'single'
  if (!allowedOrigins.has(out.origin)) out.origin = 'melee'
  if (out.kind === 'burst') {
    const r = Number(out.radius)
    out.radius = Number.isFinite(r) ? r : 1
  }
  if (out.kind === 'blast') {
    const s = Number(out.size)
    out.size = Number.isFinite(s) ? s : 3
  }
  if (out.origin === 'ranged' || out.origin === 'area') {
    const R = Number(out.range)
    out.range = Number.isFinite(R) ? R : 5
    out.requiresLoEToOrigin = out.requiresLoEToOrigin !== false
  } else {
    out.requiresLoEToOrigin = false
  }
  return out
}

export const validateTemplateSpec = (spec = {}) => {
  const errors = []
  if (!allowedKinds.has(spec.kind)) errors.push('INVALID_KIND')
  if (!allowedOrigins.has(spec.origin)) errors.push('INVALID_ORIGIN')
  if (spec.kind === 'burst' && !Number.isFinite(spec.radius)) errors.push('RADIUS_REQUIRED')
  if (spec.kind === 'blast' && !Number.isFinite(spec.size)) errors.push('SIZE_REQUIRED')
  if ((spec.origin === 'ranged' || spec.origin === 'area') && !Number.isFinite(spec.range)) errors.push('RANGE_REQUIRED')
  return { ok: errors.length === 0, errors }
}

export const normalizeTargetingSpec = (spec = {}) => {
  const out = { who: 'any', minTargets: 1, maxTargets: 1, includeSelf: false, ...spec }
  out.minTargets = Math.max(0, out.minTargets)
  out.maxTargets = Math.max(out.minTargets, out.maxTargets)
  return out
}

export const validateTargetingSpec = (spec = {}) => {
  const errors = []
  if (!['any','enemies','allies','not-self','self','creatures'].includes(spec.who)) errors.push('INVALID_WHO')
  if (spec.maxTargets != null && spec.minTargets != null && spec.maxTargets < spec.minTargets) errors.push('BAD_COUNTS')
  return { ok: errors.length === 0, errors }
}

