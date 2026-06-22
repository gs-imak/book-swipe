"use client"

import { Component, type ReactNode } from "react"
import { captureError } from "@/lib/monitoring"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[BookSwipe] Uncaught error:', error, errorInfo.componentStack)
    captureError(error, { componentStack: errorInfo.componentStack })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-stone-900 mb-2 font-serif">Something went wrong</h2>
            <p className="text-stone-500 mb-6 leading-relaxed">
              An unexpected error occurred. Try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="h-11 px-6 bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-xl transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
