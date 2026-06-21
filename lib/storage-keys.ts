/**
 * Single source of truth for every localStorage key the app uses.
 *
 * Previously these constants were redefined ad-hoc across ~15 files
 * (lib/storage.ts, lib/book-cache.ts, lib/notifications.ts, components/…),
 * which made it easy to typo a key, collide two features on one key, or lose
 * track of what the app actually persists. Import from here instead of
 * inlining a string literal.
 *
 * All keys are namespaced with the `bookswipe_` prefix.
 */
export const STORAGE_KEYS = {
  // Core library + reading data
  ACTIVITY_LOG: "bookswipe_activity_log",
  LIKED_BOOKS: "bookswipe_liked_books",
  READING_PROGRESS: "bookswipe_reading_progress",
  READING_GOALS: "bookswipe_reading_goals",
  BOOK_REVIEWS: "bookswipe_book_reviews",
  BOOK_NOTES: "bookswipe_book_notes",
  READING_POSITIONS: "bookswipe_reading_positions",

  // Gamification
  USER_ACHIEVEMENTS: "bookswipe_achievements",
  USER_STATS: "bookswipe_user_stats",

  // Shelves / collections / tags
  SHELVES: "bookswipe_shelves",
  SHELF_ASSIGNMENTS: "bookswipe_shelf_assignments",
  COLLECTIONS: "bookswipe_collections",
  TAG_DEFINITIONS: "bookswipe_tag_definitions",
  BOOK_TAGS: "bookswipe_book_tags",

  // Discovery / signals
  DAILY_PICK: "bookswipe_daily_pick",
  PASSED_BOOKS: "bookswipe_passed_books",
  PASSED_FEATURES: "bookswipe_passed_features",
  HIDDEN_BOOKS: "bookswipe_hidden_books",
  BOOK_VIEW_COUNT: "bookswipe_book_views",
  DISMISSED_SUGGESTIONS: "bookswipe_dismissed_suggestions",

  // Onboarding / preferences / meta
  ONBOARDED: "bookswipe_onboarded",
  USER_PREFERENCES: "bookswipe_user_preferences",
  LAST_EXPORT: "bookswipe_last_export",
  BACKUP_DISMISSED: "bookswipe_backup_dismissed",
  GUIDE_SEEN: "bookswipe_guide_seen",

  // Feature discovery / What's New
  FEATURE_VERSION: "bookswipe_feature_version",
  SEEN_FEATURES: "bookswipe_seen_features",

  // Book cache
  BOOK_CACHE: "bookswipe_book_cache",
  CACHE_METADATA: "bookswipe_cache_metadata",

  // Migrations / schema
  COVER_MIGRATION: "bookswipe_cover_migration_v10",
  SCHEMA_VERSION: "bookswipe_schema_version",

  // Theme
  THEME: "bookswipe_theme",
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

/**
 * Current localStorage schema version. Bump this when the SHAPE of any
 * persisted value changes in a backward-incompatible way, and add a migration
 * step in `runStorageMigrations` (see lib/storage.ts) so returning users are
 * upgraded instead of silently breaking or losing data.
 */
export const STORAGE_SCHEMA_VERSION = 1
