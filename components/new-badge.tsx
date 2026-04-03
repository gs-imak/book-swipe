"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { isFeatureSeen, markFeatureSeen } from "@/lib/storage"

interface NewBadgeProps {
  featureId: string
  className?: string
}

export function NewBadge({ featureId, className = "" }: NewBadgeProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(!isFeatureSeen(featureId))
  }, [featureId])

  const dismiss = useCallback(() => {
    markFeatureSeen(featureId)
    setVisible(false)
  }, [featureId])

  if (!visible) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.span
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          onClick={(e) => {
            e.stopPropagation()
            dismiss()
          }}
          className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-wide uppercase rounded-full bg-amber-400 text-amber-950 shadow-sm cursor-pointer select-none ${className}`}
          role="status"
          aria-label={`New feature: ${featureId.replace(/_/g, " ")}`}
        >
          <motion.span
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            New
          </motion.span>
        </motion.span>
      )}
    </AnimatePresence>
  )
}

interface NewDotProps {
  featureIds: string[]
  className?: string
}

export function NewDot({ featureIds, className = "" }: NewDotProps) {
  const [hasNew, setHasNew] = useState(false)

  useEffect(() => {
    const anyNew = featureIds.some(id => !isFeatureSeen(id))
    setHasNew(anyNew)
  }, [featureIds])

  if (!hasNew) return null

  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 shadow-sm ${className}`}
      aria-hidden="true"
    >
      <motion.span
        className="absolute inset-0 rounded-full bg-amber-400"
        animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
      />
    </motion.span>
  )
}
