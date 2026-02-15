"use client"

import { type LucideIcon, Heart, BookOpen, Library, Crown, Compass, Star, MessageSquare, Award, GraduationCap, Palette, Sparkles, Flame, Zap, Trophy, Gem, StickyNote, BookMarked, PenTool, Quote, Glasses, Medal, Rocket, Lock } from "lucide-react"

const iconMap: Record<string, LucideIcon> = {
  heart: Heart,
  "book-open": BookOpen,
  library: Library,
  crown: Crown,
  compass: Compass,
  star: Star,
  "message-square": MessageSquare,
  award: Award,
  "graduation-cap": GraduationCap,
  palette: Palette,
  sparkles: Sparkles,
  flame: Flame,
  zap: Zap,
  trophy: Trophy,
  gem: Gem,
  "sticky-note": StickyNote,
  "book-marked": BookMarked,
  "pen-tool": PenTool,
  quote: Quote,
  glasses: Glasses,
  medal: Medal,
  rocket: Rocket,
}

const tierStyles = {
  bronze: {
    gradient: "from-amber-600 to-orange-700",
    ring: "ring-amber-400/30",
    shadow: "shadow-amber-500/25",
  },
  silver: {
    gradient: "from-slate-300 to-slate-500",
    ring: "ring-slate-300/30",
    shadow: "shadow-slate-400/20",
  },
  gold: {
    gradient: "from-yellow-400 to-amber-500",
    ring: "ring-yellow-300/40",
    shadow: "shadow-amber-400/30",
  },
  platinum: {
    gradient: "from-violet-400 to-purple-600",
    ring: "ring-violet-300/40",
    shadow: "shadow-purple-500/30",
  },
}

const sizeStyles = {
  sm: { container: "w-8 h-8", icon: "w-3.5 h-3.5", ring: "ring-2" },
  md: { container: "w-9 h-9", icon: "w-4 h-4", ring: "ring-2" },
  lg: { container: "w-11 h-11", icon: "w-5 h-5", ring: "ring-[3px]" },
}

interface AchievementBadgeProps {
  iconKey: string
  tier: "bronze" | "silver" | "gold" | "platinum"
  unlocked: boolean
  size?: "sm" | "md" | "lg"
}

export function AchievementBadge({ iconKey, tier, unlocked, size = "md" }: AchievementBadgeProps) {
  const s = sizeStyles[size]
  const t = tierStyles[tier]

  if (!unlocked) {
    return (
      <div className={`${s.container} rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0`}>
        <Lock className={`${s.icon} text-stone-400`} />
      </div>
    )
  }

  const Icon = iconMap[iconKey] || Star

  return (
    <div
      className={`${s.container} rounded-lg bg-gradient-to-br ${t.gradient} ${s.ring} ${t.ring} flex items-center justify-center flex-shrink-0 shadow-md ${t.shadow}`}
    >
      <Icon className={`${s.icon} text-white`} />
    </div>
  )
}
