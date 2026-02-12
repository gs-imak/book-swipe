"use client"

import { useState } from "react"
import { UserPreferences } from "@/lib/book-data"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, ChevronRight, Sparkles } from "lucide-react"

interface QuestionnaireProps {
  onComplete: (preferences: UserPreferences) => void
  onBack?: () => void
}

const questions = [
  {
    id: "genres",
    title: "What genres do you typically enjoy?",
    subtitle: "Select all that apply",
    type: "multiple",
    options: [
      "Fantasy", "Science Fiction", "Mystery", "Romance", "Thriller",
      "Contemporary Fiction", "Historical Fiction", "Biography", "Self-Help",
      "Philosophy", "Horror", "Comedy", "LGBTQ+"
    ]
  },
  {
    id: "mood",
    title: "What's your current reading mood?",
    subtitle: "Choose up to 3 that resonate with you right now",
    type: "multiple",
    options: [
      "Escapist", "Thought-provoking", "Light-hearted", "Emotional",
      "Inspiring", "Suspenseful", "Romantic", "Dark", "Cozy",
      "Epic", "Philosophical", "Motivational"
    ]
  },
  {
    id: "readingTime",
    title: "How much time do you have for reading?",
    subtitle: "Think about your typical reading sessions",
    type: "single",
    options: [
      "15-30 minutes", "30-60 minutes", "1-2 hours", "2+ hours"
    ]
  },
  {
    id: "length",
    title: "What book length do you prefer right now?",
    subtitle: "Consider your current schedule and attention span",
    type: "single",
    options: [
      "Short (under 250 pages)", "Medium (250-400 pages)",
      "Long (400-600 pages)", "Epic (600+ pages)", "No preference"
    ]
  },
  {
    id: "content",
    title: "Any content preferences?",
    subtitle: "Help us avoid books that might not match your current needs",
    type: "multiple",
    options: [
      "Avoid heavy/dark themes", "Prefer diverse characters",
      "Want strong female protagonists", "Looking for escapism",
      "Prefer recent publications", "Open to classics", "No specific preferences"
    ]
  }
]

export function Questionnaire({ onComplete, onBack }: QuestionnaireProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})

  const handleAnswer = (questionId: string, answer: string, isMultiple: boolean) => {
    setAnswers(prev => {
      if (isMultiple) {
        const currentAnswers = prev[questionId] || []
        const newAnswers = currentAnswers.includes(answer)
          ? currentAnswers.filter(a => a !== answer)
          : [...currentAnswers, answer]
        return { ...prev, [questionId]: newAnswers }
      } else {
        return { ...prev, [questionId]: [answer] }
      }
    })
  }

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1)
    } else {
      const preferences: UserPreferences = {
        favoriteGenres: answers.genres || [],
        currentMood: answers.mood || [],
        readingTime: answers.readingTime?.[0] || "30-60 minutes",
        preferredLength: answers.length?.[0] || "No preference",
        contentPreferences: answers.content || []
      }
      onComplete(preferences)
    }
  }

  const canProceed = () => {
    const question = questions[currentQuestion]
    const questionAnswers = answers[question.id] || []
    return questionAnswers.length > 0
  }

  const progress = ((currentQuestion + 1) / questions.length) * 100
  const question = questions[currentQuestion]
  const isLastQuestion = currentQuestion === questions.length - 1

  return (
    <div className="min-h-screen flex flex-col p-4 sm:p-6 bg-background">
      {/* Header */}
      <div className="w-full max-w-2xl mx-auto mb-6 flex items-center justify-between">
        {onBack ? (
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-stone-100 transition-colors tap-target touch-manipulation"
          >
            <ArrowLeft className="w-5 h-5 text-stone-600" />
          </button>
        ) : (
          <div />
        )}
        <span className="text-sm text-stone-400 font-medium">
          {currentQuestion + 1} / {questions.length}
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-2xl mx-auto">
          {/* Progress bar */}
          <div className="mb-8">
            <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-amber-500"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10, transition: { duration: 0.1 } }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="bg-white rounded-2xl shadow-sm border border-stone-200/60 p-5 sm:p-8"
            >
              <h2 className="text-xl sm:text-2xl font-bold text-stone-900 mb-1.5 leading-tight font-serif">
                {question.title}
              </h2>
              <p className="text-sm sm:text-base text-stone-500 mb-6 sm:mb-8">
                {question.subtitle}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-6 sm:mb-8">
                {question.options.map((option, index) => {
                  const isSelected = (answers[question.id] || []).includes(option)
                  return (
                    <motion.button
                      key={option}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28, delay: index * 0.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleAnswer(question.id, option, question.type === "multiple")}
                      className={`w-full px-4 py-3.5 text-left text-sm sm:text-base font-medium rounded-xl transition-all duration-150 tap-target touch-manipulation ${
                        isSelected
                          ? "bg-stone-900 text-white shadow-sm"
                          : "bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 hover:border-stone-300"
                      }`}
                    >
                      {option}
                    </motion.button>
                  )
                })}
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                  disabled={currentQuestion === 0}
                  className="flex-1 sm:flex-none h-11 px-5 text-sm font-medium rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors tap-target touch-manipulation disabled:opacity-40 disabled:pointer-events-none"
                >
                  Back
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="flex-1 sm:flex-auto h-11 px-6 sm:px-8 text-sm font-medium rounded-xl bg-stone-900 hover:bg-stone-800 text-white transition-colors shadow-sm tap-target touch-manipulation disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
                >
                  {isLastQuestion ? (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Start Discovering
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
