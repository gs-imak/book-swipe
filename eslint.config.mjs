// Flat ESLint config (ESLint 9 / Next 16). Replaces .eslintrc.json + `next lint`,
// both removed in Next 16. Mirrors the previous setup (next/core-web-vitals).
//
// eslint-config-next@16 enables the new React-Compiler-era react-hooks rules as
// ERRORS. They flag long-standing patterns that work fine at runtime (e.g.
// setState inside an effect, ref access). Rewriting ~70 call sites is a separate
// refactor, out of scope for the framework upgrade — so they're downgraded to
// warnings here (same treatment the project already gave no-unescaped-entities)
// and left visible for incremental cleanup.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals"

const nextConfigs = Array.isArray(nextCoreWebVitals) ? nextCoreWebVitals : [nextCoreWebVitals]

const config = [
  { ignores: [".next/**", "node_modules/**", "out/**", "next-env.d.ts"] },
  ...nextConfigs,
  {
    rules: {
      "react/no-unescaped-entities": "warn",
      "@next/next/no-img-element": "warn",
      // New in eslint-config-next@16 (React Compiler era) — warn, don't fail CI.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
]

export default config
