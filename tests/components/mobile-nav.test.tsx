import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MobileNav } from "@/components/mobile-nav"

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    nav: ({ children, ...props }: any) => <nav {...props}>{children}</nav>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

describe("MobileNav", () => {
  it("renders all three navigation items", () => {
    render(
      <MobileNav currentView="dashboard" onNavigate={() => {}} />
    )

    expect(screen.getByText("Library")).toBeInTheDocument()
    expect(screen.getByText("Discover")).toBeInTheDocument()
    expect(screen.getByText("Awards")).toBeInTheDocument()
  })

  it("calls onNavigate with correct view when clicked", () => {
    const onNavigate = vi.fn()
    render(
      <MobileNav currentView="dashboard" onNavigate={onNavigate} />
    )

    fireEvent.click(screen.getByText("Discover"))
    expect(onNavigate).toHaveBeenCalledWith("swipe")
  })

  // Modern Editorial (design handoff, chrome section): the floating amber
  // badge is gone — the count renders inline in the tab label.
  it("shows the liked books count inline in the Library label", () => {
    render(
      <MobileNav currentView="swipe" onNavigate={() => {}} likedCount={5} />
    )

    expect(screen.getByText("Library · 5")).toBeInTheDocument()
  })

  it("compacts the inline count above 999", () => {
    render(
      <MobileNav currentView="swipe" onNavigate={() => {}} likedCount={1500} />
    )

    expect(screen.getByText("Library · 1k")).toBeInTheDocument()
  })
})
