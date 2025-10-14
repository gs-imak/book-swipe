# BookSwipe 📚

A Netflix-style book discovery app with Tinder-like swiping mechanics. Discover your next favorite book based on your current mood and preferences!

## Features

- **2-Minute Questionnaire**: Quick onboarding to understand your reading preferences
- **Smart Filtering**: Books filtered by genre, mood, length, and content preferences
- **Tinder-Style Swiping**: Swipe right to like, left to pass
- **Beautiful Book Cards**: Rich book information including cover, rating, pages, reading time
- **Reading List**: Track your liked books
- **Responsive Design**: Works perfectly on desktop and mobile

## How It Works

1. **Complete the Questionnaire**: Answer 5 quick questions about your reading preferences
2. **Start Swiping**: Get personalized book recommendations
3. **Like or Pass**: Swipe right (or click ❤️) to add to your reading list, left (or click ✗) to pass
4. **Build Your List**: See all your liked books at the end

## Tech Stack

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Framer Motion** for smooth animations
- **Radix UI** for accessible components
- **Shadcn/ui** for beautiful UI components

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run the development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser** and navigate to `http://localhost:3000`

## Book Data

The app comes with 10 sample books covering various genres and moods. In a production version, this would connect to a real book API like Google Books or Open Library.

## Customization

- Add more books to `lib/book-data.ts`
- Modify questionnaire questions in `components/questionnaire.tsx`
- Adjust filtering logic in `components/swipe-interface.tsx`
- Customize styling in the component files

## Future Enhancements

- Integration with real book APIs
- User accounts and saved reading lists
- Social features (share recommendations)
- More sophisticated recommendation algorithms
- Book availability at local libraries/stores
- Reading progress tracking

Enjoy discovering your next great read! 🎉


