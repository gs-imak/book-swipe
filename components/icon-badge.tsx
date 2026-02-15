"use client"

import { type LucideIcon } from "lucide-react"

const colorMap: Record<string, { bg: string; text: string }> = {
  amber: { bg: "bg-amber-50", text: "text-amber-600" },
  teal: { bg: "bg-teal-50", text: "text-teal-600" },
  rose: { bg: "bg-rose-50", text: "text-rose-600" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
  blue: { bg: "bg-blue-50", text: "text-blue-600" },
  violet: { bg: "bg-violet-50", text: "text-violet-600" },
  orange: { bg: "bg-orange-50", text: "text-orange-600" },
  yellow: { bg: "bg-yellow-50", text: "text-yellow-600" },
  pink: { bg: "bg-pink-50", text: "text-pink-600" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-600" },
  stone: { bg: "bg-stone-100", text: "text-stone-600" },
  slate: { bg: "bg-slate-100", text: "text-slate-600" },
}

const sizeStyles = {
  sm: { container: "w-7 h-7 rounded-md", icon: "w-3.5 h-3.5" },
  md: { container: "w-9 h-9 rounded-lg", icon: "w-4 h-4" },
}

interface IconBadgeProps {
  icon: LucideIcon
  color: string
  size?: "sm" | "md"
}

export function IconBadge({ icon: Icon, color, size = "md" }: IconBadgeProps) {
  const c = colorMap[color] || colorMap.stone
  const s = sizeStyles[size]

  return (
    <div className={`${s.container} ${c.bg} flex items-center justify-center flex-shrink-0`}>
      <Icon className={`${s.icon} ${c.text}`} />
    </div>
  )
}
