"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", backgroundColor: "#FDFBF7" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: "400px" }}>
            <h2
              style={{
                fontSize: "24px",
                fontWeight: 700,
                color: "#1c1917",
                marginBottom: "12px",
                fontFamily: "Georgia, 'Times New Roman', serif",
              }}
            >
              Something went wrong
            </h2>
            <p style={{ color: "#78716c", marginBottom: "32px", lineHeight: 1.6 }}>
              A critical error occurred. Please reload the page to continue.
            </p>
            <button
              onClick={reset}
              style={{
                height: "48px",
                padding: "0 32px",
                backgroundColor: "#1c1917",
                color: "#fff",
                border: "none",
                borderRadius: "12px",
                fontSize: "16px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
