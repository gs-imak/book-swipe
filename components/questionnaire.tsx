"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { UserPreferences } from "@/lib/book-data"
import { motion, AnimatePresence } from "framer-motion"

interface QuestionnaireProps {
  onComplete: (preferences: UserPreferences) => void
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
    title: "How much time do you have for reading sessions?",
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

export function Questionnaire({ onComplete }: QuestionnaireProps) {
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
      // Complete questionnaire
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <Progress value={progress} className="h-2.5 sm:h-2" />
          <p className="text-sm sm:text-base text-muted-foreground mt-3 sm:mt-2 font-medium">
            Question {currentQuestion + 1} of {questions.length}
          </p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl sm:rounded-3xl shadow-xl p-5 sm:p-8"
          >
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-2 leading-tight">{question.title}</h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">{question.subtitle}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-6 sm:mb-8">
              {question.options.map((option) => {
                const isSelected = (answers[question.id] || []).includes(option)
                return (
                  <Button
                    key={option}
                    variant={isSelected ? "default" : "outline"}
                    className="p-4 sm:p-4 h-auto text-left justify-start text-sm sm:text-base min-h-[52px] tap-target touch-manipulation font-medium"
                    onClick={() => handleAnswer(question.id, option, question.type === "multiple")}
                  >
                    {option}
                  </Button>
                )
              })}
            </div>

            <div className="flex gap-3 sm:gap-4">
              <Button
                variant="outline"
                onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                disabled={currentQuestion === 0}
                className="flex-1 sm:flex-none py-3 text-base tap-target touch-manipulation"
              >
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                className="flex-1 sm:flex-auto px-6 sm:px-8 py-3 text-base tap-target touch-manipulation"
              >
                {currentQuestion === questions.length - 1 ? "Start Discovering!" : "Next"}
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}


