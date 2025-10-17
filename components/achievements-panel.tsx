"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Trophy, Star, Target, TrendingUp, Award, Lock, Calendar, Zap, Home, BarChart3, X } from "lucide-react"
import { Button } from "./ui/button"
import { Progress } from "./ui/progress"
import { getUserStats, getUserAchievements, calculateLevel, getPointsForNextLevel } from "@/lib/storage"
import { ACHIEVEMENTS, getAchievementsByCategory, getAchievementProgress } from "@/lib/achievements"

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 md:backdrop-blur-sm z-50 flex items-start md:items-center justify-center p-4 pb-24 pt-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-4xl w-full max-h-[calc(100vh-120px)] sm:max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 sm:p-6 text-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-2xl font-bold truncate">Reading Journey</h2>
                <p className="text-xs sm:text-base text-white/90">Level {currentLevel} • {unlockedCount}/{totalAchievements}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20 flex-shrink-0 tap-target touch-manipulation"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Level Progress */}
          <div className="mt-4 sm:mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm sm:text-base font-medium">Level {currentLevel}</span>
              <span className="text-xs sm:text-sm text-white/80">{currentPoints} / {pointsForNext} XP</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2 sm:h-3">
              <motion.div
                className="bg-white rounded-full h-2 sm:h-3"
                style={{ width: `${levelProgress}%` }}
                initial={{ width: 0 }}
                animate={{ width: `${levelProgress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
            <p className="text-xs sm:text-sm text-white/80 mt-1">
              {pointsToNext > 0 ? `${pointsToNext} XP to level ${currentLevel + 1}` : "Max level!"}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b flex-shrink-0">
          <div className="flex justify-around sm:justify-start">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors tap-target touch-manipulation ${
                activeTab === 'overview'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Home className="w-5 h-5 sm:w-4 sm:h-4" />
              <span className="sm:inline">Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('achievements')}
              className={`flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors tap-target touch-manipulation ${
                activeTab === 'achievements'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Trophy className="w-5 h-5 sm:w-4 sm:h-4" />
              <span className="sm:inline">Achievements</span>
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors tap-target touch-manipulation ${
                activeTab === 'stats'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChart3 className="w-5 h-5 sm:w-4 sm:h-4" />
              <span className="sm:inline">Statistics</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
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
          
          {/* Bottom padding for mobile safe area */}
          <div className="h-4 sm:h-0" />
        </div>
      </motion.div>
    </motion.div>
  )
}

function OverviewTab({ stats, achievements, completionPercentage }: any) {
  const recentAchievements = achievements
    .filter((a: any) => a.unlockedAt)
    .sort((a: any, b: any) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime())
    .slice(0, 3)

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 sm:p-4 rounded-xl">
          <div className="flex items-center gap-2 sm:gap-3">
            <Star className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-blue-900">{stats.totalPoints}</p>
              <p className="text-xs sm:text-sm text-blue-600 truncate">Points</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 sm:p-4 rounded-xl">
          <div className="flex items-center gap-2 sm:gap-3">
            <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-green-900">{stats.currentStreak}</p>
              <p className="text-xs sm:text-sm text-green-600 truncate">Streak</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 sm:p-4 rounded-xl">
          <div className="flex items-center gap-2 sm:gap-3">
            <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-purple-900">{achievements.filter((a: any) => a.unlockedAt).length}</p>
              <p className="text-xs sm:text-sm text-purple-600 truncate">Unlocked</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-3 sm:p-4 rounded-xl">
          <div className="flex items-center gap-2 sm:gap-3">
            <Target className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-orange-900">{stats.totalBooksRead}</p>
              <p className="text-xs sm:text-sm text-orange-600 truncate">Books</p>
            </div>
          </div>
        </div>
      </div>

      {/* Achievement Progress */}
      <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">Achievement Progress</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Progress value={completionPercentage} className="h-3" />
          </div>
          <span className="text-sm font-medium text-gray-600">
            {Math.round(completionPercentage)}%
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          {achievements.filter((a: any) => a.unlockedAt).length} of {ACHIEVEMENTS.length} achievements unlocked
        </p>
      </div>

      {/* Recent Achievements */}
      {recentAchievements.length > 0 && (
        <div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">Recent Achievements</h3>
          <div className="space-y-3">
            {recentAchievements.map((achievement: any) => (
              <div key={achievement.id} className="flex items-center gap-4 p-4 bg-yellow-50 rounded-xl border-l-4 border-yellow-400">
                <span className="text-2xl">{achievement.icon}</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{achievement.name}</h4>
                  <p className="text-sm text-gray-600">{achievement.description}</p>
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(achievement.unlockedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AchievementsTab({ categorizedAchievements }: any) {
  const categories = [
    { key: 'discovery', name: 'Discovery', icon: '🔍' },
    { key: 'reading', name: 'Reading', icon: '📚' },
    { key: 'consistency', name: 'Consistency', icon: '🔥' },
    { key: 'social', name: 'Social', icon: '💬' },
    { key: 'milestone', name: 'Milestones', icon: '🏆' },
  ]

  return (
    <div className="space-y-6 sm:space-y-8">
      {categories.map((category) => (
        <div key={category.key}>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
            <span>{category.icon}</span>
            {category.name}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categorizedAchievements[category.key]?.map((achievement: any) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function AchievementCard({ achievement }: { achievement: any }) {
  const isUnlocked = !!achievement.unlockedAt
  const progress = achievement.progress || 0
  const maxProgress = achievement.maxProgress || 1
  const progressPercentage = (progress / maxProgress) * 100

  return (
    <div className={`
      p-4 rounded-xl border-2 transition-all
      ${isUnlocked 
        ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200' 
        : 'bg-gray-50 border-gray-200'
      }
    `}>
      <div className="flex items-start gap-3">
        <div className={`
          text-2xl p-2 rounded-lg
          ${isUnlocked ? 'bg-yellow-100' : 'bg-gray-200'}
        `}>
          {isUnlocked ? achievement.icon : <Lock className="w-6 h-6 text-gray-400" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className={`font-semibold flex-1 ${isUnlocked ? 'text-gray-900' : 'text-gray-500'}`}>
              {achievement.name}
            </h4>
            {isUnlocked && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200 whitespace-nowrap flex-shrink-0">
                ✓ Completed
              </span>
            )}
          </div>
          <p className={`text-sm ${isUnlocked ? 'text-gray-600' : 'text-gray-400'}`}>
            {achievement.description}
          </p>
          
          {achievement.maxProgress && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Progress</span>
                <span className="text-xs text-gray-500">{progress}/{maxProgress}</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          )}
          
          {isUnlocked && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className={`
                px-2 py-1 rounded-full text-xs font-medium
                ${achievement.type === 'bronze' ? 'bg-amber-100 text-amber-800' :
                  achievement.type === 'silver' ? 'bg-gray-100 text-gray-800' :
                  achievement.type === 'gold' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-purple-100 text-purple-800'}
              `}>
                {achievement.type.toUpperCase()}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(achievement.unlockedAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatsTab({ stats }: { stats: any }) {
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {statItems.map((item, index) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{item.icon}</span>
            <div>
              <p className="text-2xl font-bold text-gray-900">{item.value}</p>
              <p className="text-sm text-gray-600">{item.label}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

