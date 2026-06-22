"use client"

import { motion } from "framer-motion"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SittingReadingDoodle } from "./illustrations"

/** Empty-library state shown when the user has no liked books yet. */
export function DashboardEmpty({ onStartDiscovery }: { onStartDiscovery: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-12 sm:py-20 px-4"
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 150 }}
        className="w-48 h-36 sm:w-56 sm:h-44 mx-auto mb-4 opacity-80"
      >
        <SittingReadingDoodle />
      </motion.div>
      <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 mb-3 font-serif">
        Your shelf is waiting
      </h2>
      <p className="text-stone-500 dark:text-stone-400 mb-8 max-w-md mx-auto text-base sm:text-lg leading-relaxed">
        Start swiping to discover books you&apos;ll love. We&apos;ll learn your taste and suggest better matches over time.
      </p>
      <Button
        onClick={onStartDiscovery}
        className="h-12 px-8 text-base bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-stone-200 text-white dark:text-stone-900 font-medium rounded-xl transition-all shadow-sm hover:shadow-md tap-target touch-manipulation"
      >
        <Sparkles className="w-5 h-5 mr-2" />
        Start Discovering
      </Button>
    </motion.div>
  )
}
