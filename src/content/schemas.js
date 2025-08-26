import { z } from 'zod'

export const Power = z.object({
  id: z.string(),
  name: z.string(),
  usage: z.enum(['at-will', 'encounter', 'daily']),
  action: z.enum(['standard', 'move', 'minor', 'free', 'immediate']).optional(),
  keywords: z.array(z.string()).default([]),
  attack: z
    .object({
      kind: z.enum(['melee-weapon', 'ranged', 'close', 'area']).optional(),
      vs: z.enum(['AC', 'Fort', 'Ref', 'Will']).optional(),
      reach: z.number().int().optional(),
      range: z.number().int().optional()
    })
    .optional(),
  targeting: z
    .object({
      template: z.enum(['single', 'blast', 'burst']).optional(),
      radius: z.number().int().optional()
    })
    .optional(),
  hit: z.any().optional(),
  miss: z.any().optional(),
  effect: z.any().optional()
})

export const Condition = z.object({
  id: z.string(),
  name: z.string(),
  flags: z.record(z.any()).default({}),
  duration: z
    .object({
      type: z.enum(['saveEnds', 'endOfSourceNext', 'startOfSourceNext', 'encounter']).optional()
    })
    .optional()
})
