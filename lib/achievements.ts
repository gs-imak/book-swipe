import { Achievement } from "./storage"

export const ACHIEVEMENTS: Achievement[] = [
  // Discovery Achievements
  {
    id: "first_like",
    name: "First Discovery",
    description: "Like your first book",
    icon: "heart",
    type: "bronze",
    category: "discovery",
    maxProgress: 1
  },
  {
    id: "book_lover",
    name: "Book Lover",
    description: "Like 10 books",
    icon: "book-open",
    type: "silver",
    category: "discovery",
    maxProgress: 10
  },
  {
    id: "collector",
    name: "The Collector",
    description: "Like 50 books",
    icon: "library",
    type: "gold",
    category: "discovery",
    maxProgress: 50
  },
  {
    id: "library_master",
    name: "Library Master",
    description: "Like 100 books",
    icon: "crown",
    type: "platinum",
    category: "discovery",
    maxProgress: 100
  },

  // Reading Achievements
  {
    id: "first_review",
    name: "Critic's Corner",
    description: "Write your first review",
    icon: "star",
    type: "bronze",
    category: "reading",
    maxProgress: 1
  },
  {
    id: "reviewer",
    name: "Thoughtful Reviewer",
    description: "Write 10 reviews",
    icon: "message-square",
    type: "silver",
    category: "reading",
    maxProgress: 10
  },
  {
    id: "book_critic",
    name: "Book Critic",
    description: "Write 25 reviews",
    icon: "award",
    type: "gold",
    category: "reading",
    maxProgress: 25
  },
  {
    id: "reading_expert",
    name: "Reading Expert",
    description: "Complete 50 books",
    icon: "graduation-cap",
    type: "platinum",
    category: "reading",
    maxProgress: 50
  },

  // Consistency Achievements
  {
    id: "daily_reader",
    name: "Daily Reader",
    description: "Read 3 days in a row",
    icon: "flame",
    type: "bronze",
    category: "consistency",
    maxProgress: 3
  },
  {
    id: "week_warrior",
    name: "Week Warrior",
    description: "Read 7 days in a row",
    icon: "zap",
    type: "silver",
    category: "consistency",
    maxProgress: 7
  },
  {
    id: "streak_master",
    name: "Streak Master",
    description: "Read 30 days in a row",
    icon: "trophy",
    type: "gold",
    category: "consistency",
    maxProgress: 30
  },
  {
    id: "unstoppable",
    name: "Unstoppable",
    description: "Read 100 days in a row",
    icon: "gem",
    type: "platinum",
    category: "consistency",
    maxProgress: 100
  },

  // Social Achievements
  {
    id: "note_taker",
    name: "Note Taker",
    description: "Add your first note or highlight",
    icon: "sticky-note",
    type: "bronze",
    category: "social",
    maxProgress: 1
  },
  {
    id: "scholar",
    name: "Scholar",
    description: "Add 25 notes and highlights",
    icon: "book-marked",
    type: "silver",
    category: "social",
    maxProgress: 25
  },
  {
    id: "annotator",
    name: "Master Annotator",
    description: "Add 100 notes and highlights",
    icon: "pen-tool",
    type: "gold",
    category: "social",
    maxProgress: 100
  },
  {
    id: "quote_collector",
    name: "Quote Collector",
    description: "Save 50 favorite quotes",
    icon: "quote",
    type: "gold",
    category: "social",
    maxProgress: 50
  },

  // Milestone Achievements
  {
    id: "page_turner",
    name: "Page Turner",
    description: "Read 1,000 pages",
    icon: "book-open",
    type: "bronze",
    category: "milestone",
    maxProgress: 1000
  },
  {
    id: "bookworm",
    name: "Bookworm",
    description: "Read 10,000 pages",
    icon: "glasses",
    type: "silver",
    category: "milestone",
    maxProgress: 10000
  },
  {
    id: "literary_giant",
    name: "Literary Giant",
    description: "Read 50,000 pages",
    icon: "medal",
    type: "gold",
    category: "milestone",
    maxProgress: 50000
  },
  {
    id: "reading_legend",
    name: "Reading Legend",
    description: "Read 100,000 pages",
    icon: "crown",
    type: "platinum",
    category: "milestone",
    maxProgress: 100000
  },

  // Special Achievements
  {
    id: "genre_explorer",
    name: "Genre Explorer", 
    description: "Like books from 5 different genres",
    icon: "compass",
    type: "silver",
    category: "discovery",
    maxProgress: 5
  },
  {
    id: "mood_master",
    name: "Mood Master",
    description: "Experience 10 different reading moods",
    icon: "palette",
    type: "gold",
    category: "reading",
    maxProgress: 10
  },
  {
    id: "five_star_fan",
    name: "Five Star Fan",
    description: "Give 5-star ratings to 10 books",
    icon: "sparkles",
    type: "gold",
    category: "reading",
    maxProgress: 10
  },
  {
    id: "speed_reader",
    name: "Speed Reader",
    description: "Read 10 hours in one week",
    icon: "rocket",
    type: "silver",
    category: "milestone",
    maxProgress: 600 // 10 hours in minutes
  }
]

// Points system
export const POINTS_CONFIG = {
  LIKE_BOOK: 10,
  WRITE_REVIEW: 25,
  ADD_NOTE: 5,
  ADD_HIGHLIGHT: 5,
  ADD_QUOTE: 10,
  COMPLETE_BOOK: 50,
  DAILY_READING: 15,
  REACH_READING_GOAL: 100,
  UNLOCK_ACHIEVEMENT: 50,
  FAVORITE_BOOK: 15,
  LONG_REVIEW: 35, // Reviews with 100+ characters
  FIRST_TIME_BONUS: 20 // First time doing any activity
}

export function getAchievementsByCategory(achievements: Achievement[]) {
  return {
    discovery: achievements.filter(a => a.category === 'discovery'),
    reading: achievements.filter(a => a.category === 'reading'),
    consistency: achievements.filter(a => a.category === 'consistency'),
    social: achievements.filter(a => a.category === 'social'),
    milestone: achievements.filter(a => a.category === 'milestone')
  }
}

export function getUnlockedAchievements(achievements: Achievement[]) {
  return achievements.filter(a => a.unlockedAt)
}

export function getLockedAchievements(achievements: Achievement[]) {
  return achievements.filter(a => !a.unlockedAt)
}

export function getAchievementProgress(achievement: Achievement, currentValue: number): number {
  if (!achievement.maxProgress) return 0
  return Math.min((currentValue / achievement.maxProgress) * 100, 100)
}




