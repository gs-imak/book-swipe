import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { useTheme } from "@/lib/use-theme"
import { setTheme } from "@/lib/theme"

// Two independent components reading the theme — before the store existed each
// held its own useState copy, so toggling in one left the other stale.
function ProbeA() {
  return <span data-testid="a">{useTheme()}</span>
}
function ProbeB() {
  return <span data-testid="b">{useTheme()}</span>
}

describe("useTheme", () => {
  beforeEach(() => {
    window.localStorage.clear()
    setTheme("light")
  })

  it("defaults to light", () => {
    render(<ProbeA />)
    expect(screen.getByTestId("a").textContent).toBe("light")
  })

  it("keeps every subscriber in sync when the theme changes", () => {
    render(<><ProbeA /><ProbeB /></>)
    expect(screen.getByTestId("a").textContent).toBe("light")

    act(() => { setTheme("dark") })

    expect(screen.getByTestId("a").textContent).toBe("dark")
    expect(screen.getByTestId("b").textContent).toBe("dark")
  })

  it("unsubscribes on unmount without throwing", () => {
    const { unmount } = render(<ProbeA />)
    unmount()
    expect(() => setTheme("dark")).not.toThrow()
  })
})
