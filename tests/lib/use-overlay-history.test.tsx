import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, act } from "@testing-library/react"
import { useOverlayHistory } from "@/lib/use-overlay-history"

// Overlays nest — Showcase -> ratings breakdown, Showcase -> details — and one
// Back press must close exactly one of them. Both failures below shipped: a
// press that collapsed the whole stack at once, and an entry pushed without a
// URL that made Next's router fall back to a full document navigation.

function Overlay({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  useOverlayHistory(id, open, onClose)
  return null
}

function popstate() {
  act(() => {
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }))
  })
}

describe("useOverlayHistory", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/")
  })

  it("pushes one entry per open overlay", () => {
    const spy = vi.spyOn(window.history, "pushState")
    render(<Overlay id="a" open onClose={() => {}} />)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toEqual({ overlay: "a" })
    spy.mockRestore()
  })

  it("passes the current URL explicitly", () => {
    // Omitting the third argument leaves Next's patched router without a
    // record of the entry; landing back on it reloads the whole document,
    // which looks like every overlay closing at once.
    const spy = vi.spyOn(window.history, "pushState")
    render(<Overlay id="a" open onClose={() => {}} />)
    expect(spy.mock.calls[0][2]).toBe(window.location.href)
    spy.mockRestore()
  })

  it("closes only the innermost overlay on one Back press", () => {
    const closeOuter = vi.fn()
    const closeInner = vi.fn()
    const view = render(
      <>
        <Overlay id="outer" open onClose={closeOuter} />
        <Overlay id="inner" open onClose={closeInner} />
      </>,
    )
    popstate()
    expect(closeInner).toHaveBeenCalledTimes(1)
    expect(closeOuter).not.toHaveBeenCalled()

    // With the inner one gone, the next press belongs to the outer one.
    view.rerender(
      <>
        <Overlay id="outer" open onClose={closeOuter} />
        <Overlay id="inner" open={false} onClose={closeInner} />
      </>,
    )
    popstate()
    expect(closeOuter).toHaveBeenCalledTimes(1)
  })

  it("consumes its own entry when closed by something other than Back", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {})
    const view = render(<Overlay id="a" open onClose={() => {}} />)
    view.rerender(<Overlay id="a" open={false} onClose={() => {}} />)
    expect(back).toHaveBeenCalledTimes(1)
    back.mockRestore()
  })

  it("does not leave a stray entry when it unmounts while open", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {})
    const view = render(<Overlay id="a" open onClose={() => {}} />)
    view.unmount()
    expect(back).toHaveBeenCalledTimes(1)
    back.mockRestore()
  })
})
