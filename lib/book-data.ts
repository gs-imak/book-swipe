export interface BookMetadata {
  subjects?: string[]
  readinglogCount?: number
  wantToReadCount?: number
  ratingsCount?: number
  source: 'sample' | 'google' | 'openlibrary'
}

export interface BookFormats {
  ebook: boolean
  audiobook: boolean
  paperback: boolean
}

export interface Book {
  id: string
  title: string
  author: string
  cover: string
  coverFallback?: string
  rating: number
  pages: number
  genre: string[]
  mood: string[]
  description: string
  publishedYear: number
  readingTime: string
  isbn?: string
  formats?: BookFormats
  metadata?: BookMetadata
}

export const sampleBooks: Book[] = [
  {
    id: "1",
    title: "The Seven Husbands of Evelyn Hugo",
    author: "Taylor Jenkins Reid",
    cover: "https://covers.openlibrary.org/b/id/12976759-L.jpg?default=false",
    rating: 4.3,
    pages: 400,
    genre: ["Contemporary Fiction", "Romance"],
    mood: ["Escapist", "Emotional", "Glamorous"],
    description: "A reclusive Hollywood icon reveals her secrets in this captivating novel about love, ambition, and the price of fame.",
    publishedYear: 2017,
    readingTime: "6-8 hours"
  },
  {
    id: "2",
    title: "Dune",
    author: "Frank Herbert",
    cover: "https://covers.openlibrary.org/b/id/8076962-L.jpg?default=false",
    rating: 4.2,
    pages: 688,
    genre: ["Science Fiction", "Adventure"],
    mood: ["Epic", "Thought-provoking", "Complex"],
    description: "Set in the distant future, this epic follows Paul Atreides on the desert planet Arrakis.",
    publishedYear: 1965,
    readingTime: "12-15 hours"
  },
  {
    id: "3",
    title: "The Thursday Murder Club",
    author: "Richard Osman",
    cover: "https://covers.openlibrary.org/b/id/10735398-L.jpg?default=false",
    rating: 4.1,
    pages: 368,
    genre: ["Mystery", "Cozy Mystery"],
    mood: ["Light-hearted", "Clever", "Feel-good"],
    description: "Four unlikely friends meet weekly to investigate cold cases, but soon find themselves pursuing a killer.",
    publishedYear: 2020,
    readingTime: "6-7 hours"
  },
  {
    id: "4",
    title: "The Midnight Library",
    author: "Matt Haig",
    cover: "https://covers.openlibrary.org/b/id/10736906-L.jpg?default=false",
    rating: 4.0,
    pages: 288,
    genre: ["Philosophy", "Contemporary Fiction"],
    mood: ["Reflective", "Uplifting", "Philosophical"],
    description: "Between life and death is a library containing infinite books of parallel lives.",
    publishedYear: 2020,
    readingTime: "4-5 hours"
  },
  {
    id: "5",
    title: "Klara and the Sun",
    author: "Kazuo Ishiguro",
    cover: "https://covers.openlibrary.org/b/id/11053169-L.jpg?default=false",
    rating: 3.9,
    pages: 304,
    genre: ["Science Fiction", "Literary Fiction"],
    mood: ["Contemplative", "Emotional", "Unique"],
    description: "An artificial friend observes the world with wonder and growing understanding.",
    publishedYear: 2021,
    readingTime: "5-6 hours"
  },
  {
    id: "6",
    title: "The Invisible Life of Addie LaRue",
    author: "V.E. Schwab",
    cover: "https://covers.openlibrary.org/b/id/10816120-L.jpg?default=false",
    rating: 4.2,
    pages: 448,
    genre: ["Fantasy", "Historical Fiction"],
    mood: ["Romantic", "Magical", "Melancholic"],
    description: "A young woman makes a bargain to live forever but is cursed to be forgotten by everyone she meets.",
    publishedYear: 2020,
    readingTime: "7-9 hours"
  },
  {
    id: "7",
    title: "Atomic Habits",
    author: "James Clear",
    cover: "https://covers.openlibrary.org/b/id/8533224-L.jpg?default=false",
    rating: 4.4,
    pages: 320,
    genre: ["Self-Help", "Psychology"],
    mood: ["Motivational", "Practical", "Inspiring"],
    description: "Tiny changes, remarkable results - learn how to build good habits and break bad ones.",
    publishedYear: 2018,
    readingTime: "5-6 hours"
  },
  {
    id: "8",
    title: "The Silent Patient",
    author: "Alex Michaelides",
    cover: "https://covers.openlibrary.org/b/id/8988671-L.jpg?default=false",
    rating: 4.1,
    pages: 336,
    genre: ["Thriller", "Mystery"],
    mood: ["Suspenseful", "Dark", "Gripping"],
    description: "A woman's act of violence against her husband and her refusal to speak sends shockwaves through London.",
    publishedYear: 2019,
    readingTime: "5-6 hours"
  },
  {
    id: "9",
    title: "Educated",
    author: "Tara Westover",
    cover: "https://covers.openlibrary.org/b/id/8231474-L.jpg?default=false",
    rating: 4.5,
    pages: 334,
    genre: ["Memoir", "Biography"],
    mood: ["Inspiring", "Powerful", "Eye-opening"],
    description: "A memoir about education, self-discovery, and the struggle to reconcile family loyalty with personal truth.",
    publishedYear: 2018,
    readingTime: "6-7 hours"
  },
  {
    id: "10",
    title: "The House in the Cerulean Sea",
    author: "TJ Klune",
    cover: "https://covers.openlibrary.org/b/id/10551045-L.jpg?default=false",
    rating: 4.3,
    pages: 398,
    genre: ["Fantasy", "LGBTQ+"],
    mood: ["Heartwarming", "Cozy", "Magical"],
    description: "A caseworker discovers a group of magical children on a mysterious island.",
    publishedYear: 2020,
    readingTime: "6-8 hours"
  },
  {
    id: "11",
    title: "Where the Crawdads Sing",
    author: "Delia Owens",
    cover: "https://covers.openlibrary.org/b/id/8506976-L.jpg?default=false",
    rating: 4.4,
    pages: 384,
    genre: ["Mystery", "Literary Fiction"],
    mood: ["Atmospheric", "Emotional", "Beautiful"],
    description: "A mysterious and atmospheric tale of a girl who grew up alone in the marshes of North Carolina.",
    publishedYear: 2018,
    readingTime: "6-8 hours"
  },
  {
    id: "12",
    title: "The Song of Achilles",
    author: "Madeline Miller",
    cover: "https://covers.openlibrary.org/b/id/7893392-L.jpg?default=false",
    rating: 4.5,
    pages: 416,
    genre: ["Historical Fiction", "LGBTQ+", "Mythology"],
    mood: ["Epic", "Romantic", "Tragic"],
    description: "A retelling of the Iliad that explores the relationship between Achilles and Patroclus.",
    publishedYear: 2011,
    readingTime: "7-9 hours"
  },
  {
    id: "13",
    title: "Project Hail Mary",
    author: "Andy Weir",
    cover: "https://covers.openlibrary.org/b/id/12363242-L.jpg?default=false",
    rating: 4.6,
    pages: 496,
    genre: ["Science Fiction", "Adventure"],
    mood: ["Humorous", "Thrilling", "Clever"],
    description: "A lone astronaut must save humanity in this brilliant sci-fi adventure with humor and heart.",
    publishedYear: 2021,
    readingTime: "8-10 hours"
  },
  {
    id: "14",
    title: "The Handmaid's Tale",
    author: "Margaret Atwood",
    cover: "https://covers.openlibrary.org/b/id/8072257-L.jpg?default=false",
    rating: 4.1,
    pages: 311,
    genre: ["Dystopian", "Science Fiction"],
    mood: ["Dark", "Thought-provoking", "Powerful"],
    description: "A chilling dystopian novel about a totalitarian society where women have lost all their rights.",
    publishedYear: 1985,
    readingTime: "5-7 hours"
  },
  {
    id: "15",
    title: "Circe",
    author: "Madeline Miller",
    cover: "https://covers.openlibrary.org/b/id/8532152-L.jpg?default=false",
    rating: 4.3,
    pages: 393,
    genre: ["Fantasy", "Mythology", "Historical Fiction"],
    mood: ["Magical", "Empowering", "Beautiful"],
    description: "The story of the Greek goddess Circe, from her time with the Titans to her encounter with Odysseus.",
    publishedYear: 2018,
    readingTime: "6-8 hours"
  },
  {
    id: "16",
    title: "The Alchemist",
    author: "Paulo Coelho",
    cover: "https://covers.openlibrary.org/b/id/240988-L.jpg?default=false",
    rating: 3.9,
    pages: 163,
    genre: ["Philosophy", "Adventure"],
    mood: ["Inspiring", "Spiritual", "Simple"],
    description: "A young shepherd's journey to find treasure teaches him about following his dreams.",
    publishedYear: 1988,
    readingTime: "2-3 hours"
  },
  {
    id: "17",
    title: "The Girl with the Dragon Tattoo",
    author: "Stieg Larsson",
    cover: "https://covers.openlibrary.org/b/id/6979861-L.jpg?default=false",
    rating: 4.2,
    pages: 672,
    genre: ["Thriller", "Mystery", "Crime"],
    mood: ["Dark", "Gripping", "Complex"],
    description: "A journalist and hacker team up to solve a decades-old disappearance in this Swedish crime thriller.",
    publishedYear: 2005,
    readingTime: "10-12 hours"
  },
  {
    id: "18",
    title: "Normal People",
    author: "Sally Rooney",
    cover: "https://covers.openlibrary.org/b/id/8966282-L.jpg?default=false",
    rating: 3.8,
    pages: 266,
    genre: ["Contemporary Fiction", "Romance"],
    mood: ["Emotional", "Complex", "Realistic"],
    description: "The complicated relationship between two Irish teenagers through their school and college years.",
    publishedYear: 2018,
    readingTime: "4-5 hours"
  },
  {
    id: "19",
    title: "The Martian",
    author: "Andy Weir",
    cover: "https://covers.openlibrary.org/b/id/8257206-L.jpg?default=false",
    rating: 4.4,
    pages: 369,
    genre: ["Science Fiction", "Adventure"],
    mood: ["Humorous", "Thrilling", "Smart"],
    description: "An astronaut stranded on Mars must use his ingenuity to survive until rescue arrives.",
    publishedYear: 2011,
    readingTime: "6-7 hours"
  },
  {
    id: "20",
    title: "Gone Girl",
    author: "Gillian Flynn",
    cover: "https://covers.openlibrary.org/b/id/7889671-L.jpg?default=false",
    rating: 4.0,
    pages: 432,
    genre: ["Thriller", "Mystery", "Psychological"],
    mood: ["Dark", "Twisty", "Suspenseful"],
    description: "A psychological thriller about a marriage gone terribly wrong when a wife disappears.",
    publishedYear: 2012,
    readingTime: "7-8 hours"
  },
  {
    id: "21",
    title: "The Kite Runner",
    author: "Khaled Hosseini",
    cover: "https://covers.openlibrary.org/b/id/372662-L.jpg?default=false",
    rating: 4.3,
    pages: 371,
    genre: ["Historical Fiction", "Drama"],
    mood: ["Emotional", "Powerful", "Heart-wrenching"],
    description: "A story of friendship, guilt, and redemption set against the backdrop of Afghanistan's tumultuous history.",
    publishedYear: 2003,
    readingTime: "6-7 hours"
  },
  {
    id: "22",
    title: "Becoming",
    author: "Michelle Obama",
    cover: "https://covers.openlibrary.org/b/id/8509076-L.jpg?default=false",
    rating: 4.5,
    pages: 448,
    genre: ["Memoir", "Biography"],
    mood: ["Inspiring", "Honest", "Empowering"],
    description: "The former First Lady's deeply personal memoir about her journey from the South Side of Chicago to the White House.",
    publishedYear: 2018,
    readingTime: "7-9 hours"
  },
  {
    id: "23",
    title: "The Name of the Wind",
    author: "Patrick Rothfuss",
    cover: "https://covers.openlibrary.org/b/id/501638-L.jpg?default=false",
    rating: 4.5,
    pages: 662,
    genre: ["Fantasy", "Adventure"],
    mood: ["Epic", "Magical", "Immersive"],
    description: "The first book in the Kingkiller Chronicle, following the legendary figure Kvothe telling his own story.",
    publishedYear: 2007,
    readingTime: "10-12 hours"
  },
  {
    id: "24",
    title: "The Subtle Art of Not Giving a F*ck",
    author: "Mark Manson",
    cover: "https://covers.openlibrary.org/b/id/8238833-L.jpg?default=false",
    rating: 3.9,
    pages: 224,
    genre: ["Self-Help", "Philosophy"],
    mood: ["Humorous", "Practical", "Honest"],
    description: "A counterintuitive approach to living a good life by caring less about unimportant things.",
    publishedYear: 2016,
    readingTime: "3-4 hours"
  },
  {
    id: "25",
    title: "The Time Traveler's Wife",
    author: "Audrey Niffenegger",
    cover: "https://covers.openlibrary.org/b/id/395164-L.jpg?default=false",
    rating: 3.9,
    pages: 546,
    genre: ["Romance", "Science Fiction"],
    mood: ["Romantic", "Emotional", "Unique"],
    description: "A love story between a man with a genetic disorder that causes him to time travel and his wife.",
    publishedYear: 2003,
    readingTime: "8-10 hours"
  }
]

export interface UserPreferences {
  favoriteGenres: string[]
  currentMood: string[]
  readingTime: string
  preferredLength: string
  contentPreferences: string[]
}
