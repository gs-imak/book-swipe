"use client"

import { useEffect } from "react"
import { captureError } from "@/lib/monitoring"
import { t } from "@/lib/i18n"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    captureError(error, { digest: error.digest })
  }, [error])

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
            > {t("common.something_went_wrong")} </h2>
            <p style={{ color: "#78716c", marginBottom: "32px", lineHeight: 1.6 }}> {t("global_error.a_critical_error_occurred_please_reload")} </p>
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
            > {t("global_error.reload")} </button>
          </div>
        </div>
      </body>
    </html>
  )
}
