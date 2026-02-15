"use client"

import { 
  getUserStats, 
  updateUserStats, 
  getUserAchievements, 
  saveUserAchievements, 
  unlockAchievement,
  addPoints,
  getBookReviews,
  getBookNotes,
  getLikedBooks
} from "./storage"
import { ACHIEVEMENTS, POINTS_CONFIG } from "./achievements"
import type { Achievement } from "./storage"

export interface GamificationEvent {
  type: 'achievement_unlocked' | 'level_up' | 'points_earned'
  title: string
  description: string
  points?: number
  level?: number
  achievement?: Achievement
}

// Initialize achievements for new users
export function initializeAchievements(): void {
  const existingAchievements = getUserAchievements()
  
  if (existingAchievements.length === 0) {
    // First time user - initialize all achievements as locked
    const initialAchievements = ACHIEVEMENTS.map(achievement => ({
      ...achievement,
      progress: 0
    }))
    saveUserAchievements(initialAchievements)
  }
}

// Check and update streak
export function updateReadingStreak(): number {
  const stats = getUserStats()
  const today = new Date().toDateString()
  const lastActivity = stats.lastActivityDate ? new Date(stats.lastActivityDate).toDateString() : ''
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString()

  let newStreak = stats.currentStreak

  if (lastActivity === today) {
    // Already counted today
    return newStreak
  } else if (lastActivity === yesterday) {
    // Continuing streak
    newStreak = stats.currentStreak + 1
  } else {
    // Streak broken or first day
    newStreak = 1
  }

  const longestStreak = Math.max(newStreak, stats.longestStreak)

  updateUserStats({
    currentStreak: newStreak,
    longestStreak,
    lastActivityDate: new Date().toISOString()
  })

  return newStreak
}

// Award points and check for achievements
export function awardPoints(activity: string, amount?: number, silent: boolean = true): GamificationEvent[] {
  const events: GamificationEvent[] = []
  const pointsToAward = amount || getPointsForActivity(activity)
  
  // Award points
  const leveledUp = addPoints(pointsToAward, activity)
  
  // Only show points notification if not silent (for special occasions)
  if (!silent) {
    events.push({
      type: 'points_earned',
      title: `+${pointsToAward} points!`,
      description: getActivityDescription(activity),
      points: pointsToAward
    })
  }

  // Check for level up (always show these)
  if (leveledUp) {
    const stats = getUserStats()
    events.push({
      type: 'level_up',
      title: `Level ${stats.level}!`,
      description: 'You\'ve reached a new reading level!',
      level: stats.level
    })
  }

  return events
}

// Check all achievements based on current stats
export function checkAchievements(): GamificationEvent[] {
  const events: GamificationEvent[] = []
  const stats = getUserStats()
  let achievements = getUserAchievements()
  const likedBooks = getLikedBooks()
  const reviews = getBookReviews()
  const notes = getBookNotes()

  // Calculate current values for achievements
  const currentValues = {
    booksLiked: likedBooks.length,
    reviewsWritten: reviews.length,
    notesAdded: notes.length,
    quotesAdded: notes.filter(n => n.type === 'quote').length,
    fiveStarReviews: reviews.filter(r => r.rating === 5).length,
    genresExplored: new Set(likedBooks.flatMap(book => book.genre)).size,
    moodsExperienced: new Set(reviews.map(r => r.mood).filter(Boolean)).size,
    readingStreak: stats.currentStreak,
    pagesRead: stats.totalPagesRead,
    booksCompleted: stats.totalBooksRead,
    weeklyReadingTime: calculateWeeklyReadingTime()
  }

  // Check each achievement
  for (const achievement of achievements) {
    if (achievement.unlockedAt) continue // Already unlocked

    const currentValue = getCurrentValueForAchievement(achievement.id, currentValues)
    const shouldUnlock = achievement.maxProgress ? currentValue >= achievement.maxProgress : false

    if (shouldUnlock) {
      const unlocked = unlockAchievement(achievement.id)
      if (unlocked) {
        achievements = getUserAchievements()
        // Award bonus points for unlocking achievement (silently)
        addPoints(POINTS_CONFIG.UNLOCK_ACHIEVEMENT, 'unlock_achievement')
        
        events.push({
          type: 'achievement_unlocked',
          title: `${achievement.icon} ${achievement.name}`,
          description: achievement.description,
          achievement: achievements.find(a => a.id === achievement.id) || achievement
        })
      }
    } else if (achievement.maxProgress) {
      // Update progress
      const updatedAchievements = achievements.map(a => 
        a.id === achievement.id ? { ...a, progress: currentValue } : a
      )
      saveUserAchievements(updatedAchievements)
      achievements = updatedAchievements
    }
  }

  return events
}

// Get points for different activities
function getPointsForActivity(activity: string): number {
  switch (activity) {
    case 'like_book': return POINTS_CONFIG.LIKE_BOOK
    case 'write_review': return POINTS_CONFIG.WRITE_REVIEW
    case 'add_note': return POINTS_CONFIG.ADD_NOTE
    case 'add_highlight': return POINTS_CONFIG.ADD_HIGHLIGHT
    case 'add_quote': return POINTS_CONFIG.ADD_QUOTE
    case 'complete_book': return POINTS_CONFIG.COMPLETE_BOOK
    case 'daily_reading': return POINTS_CONFIG.DAILY_READING
    case 'favorite_book': return POINTS_CONFIG.FAVORITE_BOOK
    case 'long_review': return POINTS_CONFIG.LONG_REVIEW
    default: return 0
  }
}

// Get activity description for points notification
function getActivityDescription(activity: string): string {
  switch (activity) {
    case 'like_book': return 'Discovered a new book'
    case 'write_review': return 'Shared your thoughts'
    case 'add_note': return 'Added a note'
    case 'add_highlight': return 'Highlighted important text'
    case 'add_quote': return 'Saved a favorite quote'
    case 'complete_book': return 'Finished reading'
    case 'daily_reading': return 'Daily reading streak'
    case 'favorite_book': return 'Added to favorites'
    case 'long_review': return 'Detailed review'
    default: return 'Reading activity'
  }
}

// Calculate weekly reading time (last 7 days)
function calculateWeeklyReadingTime(): number {
  const stats = getUserStats()
  // For now, return a portion of total reading time
  // In a real app, you'd track daily reading sessions
  return Math.min(stats.totalReadingTime, 600) // Cap at 10 hours
}

// Get current value for specific achievement
function getCurrentValueForAchievement(achievementId: string, values: Record<string, number>): number {
  switch (achievementId) {
    case 'first_like':
    case 'book_lover':
    case 'collector':
    case 'library_master':
      return values.booksLiked
    
    case 'first_review':
    case 'reviewer':
    case 'book_critic':
      return values.reviewsWritten
    
    case 'reading_expert':
      return values.booksCompleted
    
    case 'daily_reader':
    case 'week_warrior':
    case 'streak_master':
    case 'unstoppable':
      return values.readingStreak
    
    case 'note_taker':
    case 'scholar':
    case 'annotator':
      return values.notesAdded
    
    case 'quote_collector':
      return values.quotesAdded
    
    case 'page_turner':
    case 'bookworm':
    case 'literary_giant':
    case 'reading_legend':
      return values.pagesRead
    
    case 'genre_explorer':
      return values.genresExplored
    
    case 'mood_master':
      return values.moodsExperienced
    
    case 'five_star_fan':
      return values.fiveStarReviews
    
    case 'speed_reader':
      return values.weeklyReadingTime
    
    default:
      return 0
  }
}

// Main function to handle any user activity
export function handleUserActivity(activity: string, data?: Record<string, unknown>): GamificationEvent[] {
  const events: GamificationEvent[] = []
  
  // Initialize achievements if needed
  initializeAchievements()
  
  // Update stats based on activity
  updateStatsForActivity(activity, data)
  
  // Award points
  const pointEvents = awardPoints(activity)
  events.push(...pointEvents)
  
  // Check achievements
  const achievementEvents = checkAchievements()
  events.push(...achievementEvents)
  
  return events
}

// Update user stats based on activity
function updateStatsForActivity(activity: string, data?: Record<string, unknown>): void {
  const stats = getUserStats()
  
  switch (activity) {
    case 'like_book':
      updateUserStats({ totalBooksLiked: stats.totalBooksLiked + 1 })
      break
    
    case 'write_review':
      updateUserStats({
        totalReviews: stats.totalReviews + 1,
        averageRating: calculateNewAverageRating()
      })

      if (data?.favorite) {
        updateUserStats({ favoritesCount: stats.favoritesCount + 1 })
      }
      break
    
    case 'add_note':
    case 'add_highlight':
    case 'add_quote':
      updateUserStats({ totalNotes: stats.totalNotes + 1 })
      break
    
    case 'complete_book':
      updateUserStats({
        totalBooksRead: stats.totalBooksRead + 1,
        totalPagesRead: stats.totalPagesRead + (Number(data?.pages) || 0),
        totalReadingTime: stats.totalReadingTime + (Number(data?.readingTime) || 0)
      })
      break
    
    case 'daily_reading':
      updateReadingStreak()
      break
  }
}

// Calculate average rating from all saved reviews
function calculateNewAverageRating(): number {
  const reviews = getBookReviews()
  if (reviews.length === 0) return 0
  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0)
  return totalRating / reviews.length
}

