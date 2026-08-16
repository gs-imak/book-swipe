import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { ToastProvider, useToast } from "@/components/toast-provider"

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

type ShowToast = (message: string, type?: "success" | "error" | "info") => void

// Renders the provider and hands back its showToast so tests can drive it
// directly (wrapped in act) without clicking through a consumer component.
function renderProvider() {
  const api = {} as { showToast: ShowToast }
  function Capture() {
    api.showToast = useToast().showToast
    return null
  }
  render(
    <ToastProvider>
      <Capture />
    </ToastProvider>
  )
  return api
}

describe("ToastProvider", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("dedupes identical messages into a single visible toast", () => {
    vi.useFakeTimers()
    const api = renderProvider()
    const message = "Too many requests. Please wait a moment and try again."

    act(() => {
      api.showToast(message, "error")
      api.showToast(message, "error")
      api.showToast(message, "error")
    })

    expect(screen.getAllByText(message)).toHaveLength(1)
  })

  it("refreshes the deduped toast's auto-dismiss timer", () => {
    vi.useFakeTimers()
    const api = renderProvider()

    act(() => {
      api.showToast("Saved")
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    act(() => {
      api.showToast("Saved")
    })

    // 4500ms after the first call the original 3000ms timer would have
    // expired; the refreshed one (restarted at 2000ms) has not.
    act(() => {
      vi.advanceTimersByTime(2500)
    })
    expect(screen.getByText("Saved")).toBeInTheDocument()

    // 3100ms after the refresh the toast is gone.
    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(screen.queryByText("Saved")).not.toBeInTheDocument()
  })

  it("still stacks toasts with different messages", () => {
    vi.useFakeTimers()
    const api = renderProvider()

    act(() => {
      api.showToast("Book saved")
      api.showToast("Book removed")
    })

    expect(screen.getByText("Book saved")).toBeInTheDocument()
    expect(screen.getByText("Book removed")).toBeInTheDocument()
  })

  it("treats the same message with a different type as a separate toast", () => {
    vi.useFakeTimers()
    const api = renderProvider()

    act(() => {
      api.showToast("Sync finished", "success")
      api.showToast("Sync finished", "error")
    })

    expect(screen.getAllByText("Sync finished")).toHaveLength(2)
  })
})
