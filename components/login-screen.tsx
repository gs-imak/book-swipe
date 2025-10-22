"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BookOpen, Heart, Sparkles, ArrowRight, Mail, Lock, User } from "lucide-react"
import { motion } from "framer-motion"
import Image from "next/image"

interface LoginScreenProps {
  onLogin: () => void
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    // Simulate login delay
    setTimeout(() => {
      onLogin()
    }, 1500)
  }

  const handleDemoLogin = () => {
    setEmail("demo@bookswipe.com")
    setPassword("password123")
    setTimeout(() => {
      handleLogin()
    }, 500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <motion.div 
          animate={{ 
            rotate: [0, 360],
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            duration: 20, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-xl"
        />
        <motion.div 
          animate={{ 
            rotate: [360, 0],
            scale: [1.1, 1, 1.1]
          }}
          transition={{ 
            duration: 25, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-xl"
        />
        <motion.div 
          animate={{ 
            y: [-20, 20, -20],
            x: [-10, 10, -10]
          }}
          transition={{ 
            duration: 15, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="absolute top-1/2 left-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-2xl"
        />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          
          {/* Left side - Branding */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="text-white space-y-6 sm:space-y-8 text-center lg:text-left order-1 lg:order-1"
          >
            <div className="space-y-3 sm:space-y-4">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
                className="flex items-center justify-center lg:justify-start gap-2 sm:gap-3"
              >
                <Image 
                    src="/logo/bookswipe_logo.png" 
                    alt="BookSwipe Logo" 
                    width={70}
                    height={30}
                    className="w-auto h-12 sm:h-14 md:h-16"
                    priority
                />
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                  BookSwipe
                </h1>
              </motion.div>
              
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight"
              >
                Discover Your Next
                <span className="block bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                  Favorite Book
                </span>
              </motion.h2>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="text-base sm:text-lg md:text-xl text-purple-100 leading-relaxed max-w-2xl mx-auto lg:mx-0"
              >
                Personalized recommendations tailored to your mood. Like Netflix, but for books.
              </motion.p>
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6"
            >
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-pink-300" />
                <span className="text-sm sm:text-base text-purple-200">Smart Matching</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-300" />
                <span className="text-sm sm:text-base text-purple-200">Mood-Based</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-300" />
                <span className="text-sm sm:text-base text-purple-200">Curated</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right side - Login Form */}
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="w-full max-w-md mx-auto order-2 lg:order-2"
          >
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 border border-white/20 shadow-2xl">
              <div className="text-center mb-6 sm:mb-8">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2">Welcome Back</h3>
                <p className="text-sm sm:text-base text-purple-200">Sign in to continue your journey</p>
              </div>

              <div className="space-y-5 sm:space-y-6">
                <div className="space-y-2">
                  <label className="text-sm sm:text-base font-medium text-purple-200">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-300" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-3.5 text-base bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent backdrop-blur-sm tap-target"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm sm:text-base font-medium text-purple-200">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-300" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-3.5 text-base bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent backdrop-blur-sm tap-target"
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleLogin}
                  disabled={loading || !email || !password}
                  className="w-full py-3.5 sm:py-4 text-base sm:text-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed tap-target touch-manipulation"
                >
                  {loading ? (
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing In...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 justify-center">
                      Sign In
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  )}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/20" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-transparent text-purple-200">or</span>
                  </div>
                </div>

                <Button 
                  onClick={handleDemoLogin}
                  variant="outline"
                  className="w-full py-3.5 sm:py-4 text-base border-white/20 text-white hover:bg-white/10 rounded-xl transition-all duration-300 tap-target touch-manipulation"
                >
                  <User className="w-5 h-5 mr-2" />
                  Try Demo Account
                </Button>

                <div className="text-center">
                  <p className="text-sm text-purple-300">
                    Don't have an account?{" "}
                    <button className="text-pink-300 hover:text-pink-200 font-medium transition-colors">
                      Sign up for free
                    </button>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-purple-300">
                Join thousands of book lovers discovering their next favorite read
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Floating book icons */}
      <motion.div 
        animate={{ 
          y: [-10, 10, -10],
          rotate: [0, 5, 0, -5, 0]
        }}
        transition={{ 
          duration: 6, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        className="absolute top-20 left-20 opacity-20"
      >
        <BookOpen className="w-8 h-8 text-white" />
      </motion.div>
      <motion.div 
        animate={{ 
          y: [10, -10, 10],
          rotate: [0, -5, 0, 5, 0]
        }}
        transition={{ 
          duration: 8, 
          repeat: Infinity, 
          ease: "easeInOut",
          delay: 1 
        }}
        className="absolute bottom-20 right-20 opacity-20"
      >
        <Heart className="w-6 h-6 text-pink-300" />
      </motion.div>
      <motion.div 
        animate={{ 
          y: [-5, 15, -5],
          rotate: [0, 10, 0, -10, 0]
        }}
        transition={{ 
          duration: 7, 
          repeat: Infinity, 
          ease: "easeInOut",
          delay: 2 
        }}
        className="absolute top-40 right-40 opacity-20"
      >
        <Sparkles className="w-7 h-7 text-yellow-300" />
      </motion.div>
    </div>
  )
}
