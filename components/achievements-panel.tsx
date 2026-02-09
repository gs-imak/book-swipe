"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Trophy, Star, Target, TrendingUp, Lock, X } from "lucide-react"
import { Progress } from "./ui/progress"
import { getUserStats, getUserAchievements, getPointsForNextLevel, type Achievement, type UserStats } from "@/lib/storage"
import { ACHIEVEMENTS, getAchievementsByCategory } from "@/lib/achievements"

interface AchievementsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function AchievementsPanel({ isOpen, onClose }: AchievementsPanelProps) {
  const [stats, setStats] = useState(getUserStats())
  const [achievements, setAchievements] = useState(getUserAchievements())
  const [activeTab, setActiveTab] = useState<'overview' | 'achievements' | 'stats'>('overview')

  useEffect(() => {
    if (isOpen) {
      setStats(getUserStats())
      setAchievements(getUserAchievements())
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const categorizedAchievements = getAchievementsByCategory(achievements.length > 0 ? achievements : ACHIEVEMENTS)
  const unlockedCount = achievements.filter(a => a.unlockedAt).length
  const totalAchievements = ACHIEVEMENTS.length
  const completionPercentage = (unlockedCount / totalAchievements) * 100

  const currentLevel = stats.level
  const pointsForNext = getPointsForNextLevel(currentLevel)
  const currentPoints = stats.totalPoints
  const pointsToNext = pointsForNext - currentPoints
  const levelProgress = ((currentPoints % pointsForNext) / pointsForNext) * 100

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'achievements' as const, label: 'Achievements' },
    { id: 'stats' as const, label: 'Statistics' },
  ]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start md:items-center justify-center p-3 sm:p-4 pb-24 pt-4"
        onClick={onClose}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="achievements-title"
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="bg-[#FDFBF7] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[calc(100vh-120px)] sm:max-h-[85vh] overflow-hidden flex flex-col border border-stone-200/60"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 flex-shrink-0">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2
                    id="achievements-title"
                    className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight"
                    style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                  >
                    Reading Journey
                  </h2>
                  <p className="text-sm text-stone-500">
                    Level {currentLevel} &middot; {unlockedCount}/{totalAchievements} unlocked
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-lg hover:bg-stone-100 transition-colors tap-target touch-manipulation"
              >
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            {/* Level Progress */}
            <div className="bg-white rounded-xl p-4 border border-stone-200/60 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-stone-700">Level {currentLevel}</span>
                <span className="text-xs text-stone-400">{currentPoints} / {pointsForNext} XP</span>
              </div>
              <div className="w-full bg-stone-100 rounded-full h-2">
                <motion.div
                  className="bg-amber-500 rounded-full h-2"
                  style={{ width: `${levelProgress}%` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${levelProgress}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <p className="text-xs text-stone-400 mt-1.5">
                {pointsToNext > 0 ? `${pointsToNext} XP to level ${currentLevel + 1}` : "Max level reached!"}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-5 sm:px-6 flex-shrink-0">
            <div className="flex gap-1 bg-stone-100 rounded-lg p-1" role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all tap-target touch-manipulation ${
                    activeTab === tab.id
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            {activeTab === 'overview' && (
              <OverviewTab
                stats={stats}
                achievements={achievements}
                completionPercentage={completionPercentage}
              />
            )}

            {activeTab === 'achievements' && (
              <AchievementsTab categorizedAchievements={categorizedAchievements} />
            )}

            {activeTab === 'stats' && (
              <StatsTab stats={stats} />
            )}

            <div className="h-4 sm:h-0" />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

interface OverviewTabProps {
  stats: UserStats
  achievements: Achievement[]
  completionPercentage: number
}

function OverviewTab({ stats, achievements, completionPercentage }: OverviewTabProps) {
  const recentAchievements = achievements
    .filter((a: Achievement) => a.unlockedAt)
    .sort((a: Achievement, b: Achievement) => new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime())
    .slice(0, 3)

  return (
    <div className="space-y-5">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-3.5 border border-stone-200/60 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Star className="w-4 h-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-stone-900">{stats.totalPoints}</p>
              <p className="text-xs text-stone-500">Points</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-stone-200/60 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-stone-900">{stats.currentStreak}</p>
              <p className="text-xs text-stone-500">Day streak</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-stone-200/60 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-4 h-4 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-stone-900">{achievements.filter((a: Achievement) => a.unlockedAt).length}</p>
              <p className="text-xs text-stone-500">Unlocked</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-stone-200/60 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
              <Target className="w-4 h-4 text-rose-600" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-stone-900">{stats.totalBooksRead}</p>
              <p className="text-xs text-stone-500">Books read</p>
            </div>
          </div>
        </div>
      </div>

      {/* Achievement Progress */}
      <div className="bg-white rounded-xl p-4 border border-stone-200/60 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-stone-900">Achievement Progress</h3>
          <span className="text-sm font-medium text-amber-600">
            {Math.round(completionPercentage)}%
          </span>
        </div>
        <Progress value={completionPercentage} className="h-2" />
        <p className="text-xs text-stone-400 mt-2">
          {achievements.filter((a: Achievement) => a.unlockedAt).length} of {ACHIEVEMENTS.length} achievements unlocked
        </p>
      </div>

      {/* Recent Achievements */}
      {recentAchievements.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-stone-900 mb-3">Recently Unlocked</h3>
          <div className="space-y-2">
            {recentAchievements.map((achievement: Achievement) => (
              <div key={achievement.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-stone-200/60 shadow-sm">
                <span className="text-xl">{achievement.icon}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-stone-900">{achievement.name}</h4>
                  <p className="text-xs text-stone-500 truncate">{achievement.description}</p>
                </div>
                <span className="text-[11px] text-stone-400 flex-shrink-0">
                  {achievement.unlockedAt ? new Date(achievement.unlockedAt).toLocaleDateString() : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface AchievementsTabProps {
  categorizedAchievements: Record<string, Achievement[]>
}

function AchievementsTab({ categorizedAchievements }: AchievementsTabProps) {
  const categories = [
    { key: 'discovery', name: 'Discovery', icon: '🔍' },
    { key: 'reading', name: 'Reading', icon: '📚' },
    { key: 'consistency', name: 'Consistency', icon: '🔥' },
    { key: 'social', name: 'Social', icon: '💬' },
    { key: 'milestone', name: 'Milestones', icon: '🏆' },
  ]

  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <div key={category.key}>
          <h3 className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-2">
            <span>{category.icon}</span>
            {category.name}
          </h3>
          <div className="space-y-2">
            {categorizedAchievements[category.key]?.map((achievement: Achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const isUnlocked = !!achievement.unlockedAt
  const progress = achievement.progress || 0
  const maxProgress = achievement.maxProgress || 1
  const progressPercentage = (progress / maxProgress) * 100

  return (
    <div className={`p-3.5 rounded-xl border transition-all ${
      isUnlocked
        ? 'bg-white border-amber-200/60'
        : 'bg-stone-50/50 border-stone-100'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`text-xl w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isUnlocked ? 'bg-amber-50' : 'bg-stone-100'
        }`}>
          {isUnlocked ? achievement.icon : <Lock className="w-4 h-4 text-stone-400" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <h4 className={`font-medium text-sm ${isUnlocked ? 'text-stone-900' : 'text-stone-400'}`}>
              {achievement.name}
            </h4>
            {isUnlocked && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 whitespace-nowrap flex-shrink-0">
                Done
              </span>
            )}
          </div>
          <p className={`text-xs leading-relaxed ${isUnlocked ? 'text-stone-500' : 'text-stone-400'}`}>
            {achievement.description}
          </p>

          {achievement.maxProgress && !isUnlocked && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-stone-400">Progress</span>
                <span className="text-[11px] text-stone-400">{progress}/{maxProgress}</span>
              </div>
              <div className="w-full bg-stone-100 rounded-full h-1.5">
                <div
                  className="bg-amber-400 rounded-full h-1.5 transition-all"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}

          {isUnlocked && (
            <div className="mt-2 flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                achievement.type === 'bronze' ? 'bg-amber-100 text-amber-700' :
                achievement.type === 'silver' ? 'bg-stone-100 text-stone-600' :
                achievement.type === 'gold' ? 'bg-yellow-100 text-yellow-700' :
                'bg-violet-50 text-violet-700'
              }`}>
                {achievement.type.charAt(0).toUpperCase() + achievement.type.slice(1)}
              </span>
              <span className="text-[11px] text-stone-400">
                {new Date(achievement.unlockedAt!).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatsTab({ stats }: { stats: UserStats }) {
  const statItems = [
    { label: 'Books Liked', value: stats.totalBooksLiked, icon: '❤️' },
    { label: 'Books Completed', value: stats.totalBooksRead, icon: '✅' },
    { label: 'Pages Read', value: stats.totalPagesRead.toLocaleString(), icon: '📄' },
    { label: 'Reading Time', value: `${Math.round(stats.totalReadingTime / 60)}h`, icon: '⏱️' },
    { label: 'Reviews Written', value: stats.totalReviews, icon: '✍️' },
    { label: 'Notes & Highlights', value: stats.totalNotes, icon: '📝' },
    { label: 'Current Streak', value: `${stats.currentStreak} days`, icon: '🔥' },
    { label: 'Longest Streak', value: `${stats.longestStreak} days`, icon: '⚡' },
    { label: 'Average Rating', value: stats.averageRating.toFixed(1), icon: '⭐' },
    { label: 'Favorites', value: stats.favoritesCount, icon: '💖' },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {statItems.map((item, index) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.04 }}
          className="bg-white rounded-xl p-3.5 border border-stone-200/60 shadow-sm flex items-center gap-3"
        >
          <span className="text-lg">{item.icon}</span>
          <div>
            <p className="text-base font-bold text-stone-900">{item.value}</p>
            <p className="text-xs text-stone-500">{item.label}</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
