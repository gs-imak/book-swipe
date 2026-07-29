import { describe, it, expect } from "vitest"
import { renderToString } from "react-dom/server"
import { render, screen } from "@testing-library/react"
import { useClientValue } from "@/lib/use-client-value"

function Probe({ read, fallback }: { read: () => string; fallback: string }) {
  const value = useClientValue(read, fallback)
  return <span data-testid="v">{value}</span>
}

describe("useClientValue", () => {
  it("renders the server value when server-rendered", () => {
    const html = renderToString(<Probe read={() => "client"} fallback="server" />)
    expect(html).toContain("server")
    expect(html).not.toContain("client")
  })

  it("renders the client value in the browser", () => {
    render(<Probe read={() => "client"} fallback="server" />)
    expect(screen.getByTestId("v").textContent).toBe("client")
  })

  it("reads storage-backed values without throwing", () => {
    window.localStorage.setItem("probe_key", "stored")
    render(<Probe read={() => localStorage.getItem("probe_key") ?? "none"} fallback="none" />)
    expect(screen.getByTestId("v").textContent).toBe("stored")
    window.localStorage.removeItem("probe_key")
  })
})
