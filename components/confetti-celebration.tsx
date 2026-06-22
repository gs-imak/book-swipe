"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

interface ConfettiPiece {
  id: number
  x: number
  y: number
  rotation: number
  color: string
  size: number
  velocity: { x: number; y: number }
  borderRadius: string
}

interface FireworkParticle {
  id: string
  x: number
  y: number
  angle: number
  color: string
}

interface ConfettiCelebrationProps {
  isActive: boolean
  duration?: number
  onComplete?: () => void
}

const COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FECA57", 
  "#FF9FF3", "#54A0FF", "#5F27CD", "#00D2D3", "#FF9F43"
]

export function ConfettiCelebration({ 
  isActive, 
  duration = 3000, 
  onComplete 
}: ConfettiCelebrationProps) {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([])
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (!isActive) return

    // Respect prefers-reduced-motion (WCAG 2.3.3): skip the particle storm
    // entirely, but still fire onComplete so any gating logic proceeds.
    if (prefersReducedMotion) {
      const t = setTimeout(() => onComplete?.(), duration)
      return () => clearTimeout(t)
    }

    // Create confetti pieces
    const pieces: ConfettiPiece[] = []
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2

    for (let i = 0; i < 50; i++) {
      pieces.push({
        id: i,
        x: centerX + (Math.random() - 0.5) * 200,
        y: centerY + (Math.random() - 0.5) * 200,
        rotation: Math.random() * 360,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: Math.random() * 8 + 4,
        velocity: {
          x: (Math.random() - 0.5) * 10,
          y: (Math.random() - 0.5) * 10 - 5
        },
        // Compute shape once at creation so it stays stable across re-renders
        borderRadius: Math.random() > 0.5 ? "50%" : "0%"
      })
    }

    setConfetti(pieces)

    // Clear confetti after duration
    const timer = setTimeout(() => {
      setConfetti([])
      onComplete?.()
    }, duration)

    return () => clearTimeout(timer)
  }, [isActive, duration, onComplete, prefersReducedMotion])

  if (!isActive || confetti.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {confetti.map((piece) => (
          <motion.div
            key={piece.id}
            className="absolute"
            initial={{
              x: piece.x,
              y: piece.y,
              rotate: piece.rotation,
              scale: 1,
              opacity: 1
            }}
            animate={{
              x: piece.x + piece.velocity.x * 10,
              y: piece.y + piece.velocity.y * 10 + 200,
              rotate: piece.rotation + 360,
              scale: 0.8,
              opacity: 0
            }}
            exit={{
              opacity: 0,
              scale: 0
            }}
            transition={{
              duration: duration / 1000,
              ease: "easeOut"
            }}
            style={{
              width: piece.size,
              height: piece.size,
              backgroundColor: piece.color,
              borderRadius: piece.borderRadius
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

// Fireworks celebration for special achievements
export function FireworksCelebration({ 
  isActive, 
  onComplete 
}: { 
  isActive: boolean; 
  onComplete?: () => void 
}) {
  const [fireworks, setFireworks] = useState<FireworkParticle[]>([])
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (!isActive) return

    if (prefersReducedMotion) {
      const t = setTimeout(() => onComplete?.(), 4000)
      return () => clearTimeout(t)
    }

    const width = window.innerWidth
    const height = window.innerHeight

    // Track every scheduled timeout so cleanup can clear them all and
    // avoid setState-after-unmount when the component unmounts mid-burst.
    const timeouts: ReturnType<typeof setTimeout>[] = []

    // Create multiple firework bursts
    for (let i = 0; i < 3; i++) {
      timeouts.push(setTimeout(() => {
        const x = Math.random() * width
        const y = Math.random() * (height / 2) + height / 4

        const particles: FireworkParticle[] = []
        for (let j = 0; j < 20; j++) {
          const angle = (j / 20) * Math.PI * 2
          particles.push({
            id: `${i}-${j}`,
            x,
            y,
            angle,
            color: COLORS[Math.floor(Math.random() * COLORS.length)]
          })
        }

        setFireworks(prev => [...prev, ...particles])
      }, i * 500))
    }

    // Clear after animation
    timeouts.push(setTimeout(() => {
      setFireworks([])
      onComplete?.()
    }, 4000))

    return () => timeouts.forEach(clearTimeout)
  }, [isActive, onComplete, prefersReducedMotion])

  if (!isActive || fireworks.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <AnimatePresence>
        {fireworks.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute w-2 h-2 rounded-full"
            initial={{
              x: particle.x,
              y: particle.y,
              scale: 0,
              opacity: 1
            }}
            animate={{
              x: particle.x + Math.cos(particle.angle) * 100,
              y: particle.y + Math.sin(particle.angle) * 100,
              scale: 1,
              opacity: 0
            }}
            exit={{
              opacity: 0
            }}
            transition={{
              duration: 1.5,
              ease: "easeOut"
            }}
            style={{
              backgroundColor: particle.color
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}




