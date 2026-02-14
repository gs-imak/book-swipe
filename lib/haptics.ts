/** Lightweight haptic feedback via the Vibration API. No-ops silently on unsupported devices. */

export function hapticLight() {
  try { navigator?.vibrate?.(8) } catch { /* unsupported */ }
}

export function hapticMedium() {
  try { navigator?.vibrate?.(15) } catch { /* unsupported */ }
}

export function hapticHeavy() {
  try { navigator?.vibrate?.(30) } catch { /* unsupported */ }
}

export function hapticSuccess() {
  try { navigator?.vibrate?.([10, 30, 10]) } catch { /* unsupported */ }
}
