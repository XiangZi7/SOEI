// Adapted from Folia MonetFloatingDecor.tsx (AGPL-3.0).
interface FloatingParticle {
  id: number
  x: number
  y: number
  size: number
  rotation: number
  duration: number
  delay: number
  opacity: number
  iconName: string | null
  reverse: boolean
}

const PARTICLE_COUNT = 10

/** Generates a stable set of floating particles seeded by the available icon list. */
export const buildMonetParticles = (
  availableIcons: string[]
): FloatingParticle[] =>
  Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const useIcon = availableIcons.length > 0 && (i * 37 + 11) % 100 > 20
    return {
      id: i,
      x: ((i * 127 + 43) % 80) + 10,
      y: ((i * 211 + 17) % 80) + 5,
      size: 46 + ((i * 53) % 40),
      rotation: (i * 97) % 360,
      duration: 20 + ((i * 71) % 20),
      delay: ((i * 41) % 80) / 10,
      opacity: 0.06 + ((i * 31) % 12) / 100,
      iconName: useIcon ? availableIcons[i % availableIcons.length] : null,
      reverse: i % 2 === 0,
    }
  })
