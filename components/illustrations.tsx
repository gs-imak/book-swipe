"use client"

interface IllustrationProps {
  className?: string
  strokeColor?: string
  accentColor?: string
}

// ━━━ Cozy book stack with a plant growing out ━━━
export function BookStackIllustration({ className = "w-48 h-48", strokeColor = "#78716c", accentColor = "#d97706" }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Bottom book — wide, slightly tilted */}
      <path d="M42 148c-1.2-0.3-2-1.5-1.8-2.8l3-22c0.2-1.2 1.3-2.1 2.5-1.9l112 16c1.2 0.2 2.1 1.3 1.9 2.5l-3 22c-0.3 1.3-1.5 2.1-2.7 1.9L42 148z" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M46.5 127l108 15.5" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
      {/* Spine detail */}
      <path d="M51 126.5l2.5 18" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>

      {/* Middle book — straight, different width */}
      <path d="M55 126c-0.5-0.2-1.5-1-1.2-2.5l4-28c0.3-1.3 1.2-2 2.5-1.8l90 6c1.3 0.1 2.2 1.2 2.1 2.5l-4 28c-0.1 1.3-1.2 2.2-2.5 2.1L55 126z" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Book label/title area */}
      <rect x="78" y="105" width="35" height="6" rx="2" transform="rotate(-2 78 105)" stroke={strokeColor} strokeWidth="1" opacity="0.3" fill={accentColor} fillOpacity="0.15"/>
      <path d="M60 97l2.8 20" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>

      {/* Top book — slightly angled the other way */}
      <path d="M62 100c-1-0.5-1.7-1.8-1.2-3l6-24c0.4-1.2 1.6-1.8 2.8-1.5l78 18c1.2 0.3 1.9 1.5 1.5 2.7l-6 24c-0.4 1.2-1.6 2-2.9 1.6L62 100z" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M68 76l74 17" stroke={strokeColor} strokeWidth="1" strokeLinecap="round" opacity="0.3"/>
      <path d="M67.5 75l4 16" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>

      {/* Bookmark ribbon peeking out */}
      <path d="M110 73l-2 30" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M108 103l-3 5 3-1.5 3 1.5-3-5z" fill={accentColor} opacity="0.8"/>

      {/* Small plant/sprig growing from top book */}
      <path d="M95 72c0-8 2-16 4-22" stroke="#6b8f71" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M99 50c-6-3-10 1-8 6" stroke="#6b8f71" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M99 50c5-5 10-2 8 4" stroke="#6b8f71" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M97 58c-5-1-7 3-5 6" stroke="#6b8f71" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
      <path d="M97 58c4-3 8 0 6 4" stroke="#6b8f71" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
      <circle cx="99" cy="47" r="1.5" fill="#6b8f71" opacity="0.6"/>

      {/* Tiny stars/sparkles */}
      <path d="M130 60l1-3 1 3M132 59l-3 1 3 1" stroke={accentColor} strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
      <path d="M50 85l0.8-2.5 0.8 2.5M52.4 84l-2.5 0.8 2.5 0.8" stroke={accentColor} strokeWidth="0.8" strokeLinecap="round" opacity="0.4"/>
    </svg>
  )
}

// ━━━ Open book with pages fluttering & magic dust ━━━
export function OpenBookIllustration({ className = "w-56 h-44", strokeColor = "#78716c", accentColor = "#d97706" }: IllustrationProps) {
  return (
    <svg viewBox="0 0 240 180" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Book spine shadow */}
      <path d="M120 150V65" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>

      {/* Left page */}
      <path d="M120 68c-8-5-30-10-62-8-4 0.3-7 3-7 7v72c0 4 3.5 7 7.5 6.5C88 143 110 147 120 152" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Left page lines */}
      <path d="M62 82h42M62 92h38M62 102h40M62 112h35M62 122h30" stroke={strokeColor} strokeWidth="1" strokeLinecap="round" opacity="0.2"/>

      {/* Right page */}
      <path d="M120 68c8-5 30-10 62-8 4 0.3 7 3 7 7v72c0 4-3.5 7-7.5 6.5C152 143 130 147 120 152" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Right page lines */}
      <path d="M136 82h42M136 92h38M136 102h40M136 112h35M136 122h30" stroke={strokeColor} strokeWidth="1" strokeLinecap="round" opacity="0.2"/>

      {/* Fluttering page — lifting off right side */}
      <path d="M140 55c15-8 35-12 48-10 2 0.5 1.5 2-0.5 2.5-12 4-30 8-44 15" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      <path d="M150 58h25" stroke={strokeColor} strokeWidth="0.8" strokeLinecap="round" opacity="0.15"/>
      <path d="M152 63h20" stroke={strokeColor} strokeWidth="0.8" strokeLinecap="round" opacity="0.15"/>

      {/* Another fluttering page */}
      <path d="M135 48c10-12 28-18 42-16 2 0.3 1 2.5-1 2.8-10 3-26 10-38 18" stroke={strokeColor} strokeWidth="1.3" strokeLinecap="round" opacity="0.35"/>

      {/* Magic dust / sparkles rising */}
      <circle cx="108" cy="42" r="2" fill={accentColor} opacity="0.5"/>
      <circle cx="125" cy="30" r="1.5" fill={accentColor} opacity="0.7"/>
      <circle cx="140" cy="35" r="1" fill={accentColor} opacity="0.4"/>
      <circle cx="115" cy="22" r="2.5" fill={accentColor} opacity="0.3"/>
      <circle cx="132" cy="18" r="1.8" fill={accentColor} opacity="0.5"/>
      <circle cx="100" cy="30" r="1.2" fill={accentColor} opacity="0.35"/>
      <circle cx="145" cy="22" r="1" fill={accentColor} opacity="0.25"/>

      {/* Tiny stars */}
      <path d="M98 20l1-3 1 3M100 19l-3 1 3 1" stroke={accentColor} strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
      <path d="M148 12l0.7-2 0.7 2M150.1 11.3l-2 0.7 2 0.7" stroke={accentColor} strokeWidth="0.8" strokeLinecap="round" opacity="0.5"/>
      <path d="M120 10l0.5-1.5 0.5 1.5M121.5 9.5l-1.5 0.5 1.5 0.5" stroke={accentColor} strokeWidth="0.8" strokeLinecap="round" opacity="0.4"/>

      {/* Small coffee cup on the left side */}
      <path d="M30 140c0-3 2-5 5-5h12c3 0 5 2 5 5v8c0 4-3 7-7 7h-8c-4 0-7-3-7-7v-8z" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
      <path d="M52 142c3-1 5 0 5 3s-2 4-5 3" stroke={strokeColor} strokeWidth="1.3" strokeLinecap="round" opacity="0.3"/>
      {/* Steam */}
      <path d="M38 130c0-3 2-4 0-7" stroke={strokeColor} strokeWidth="1" strokeLinecap="round" opacity="0.2"/>
      <path d="M43 128c0-3 2-5 0-8" stroke={strokeColor} strokeWidth="1" strokeLinecap="round" opacity="0.2"/>
    </svg>
  )
}

// ━━━ Small reading glasses — decorative accent ━━━
export function ReadingGlassesIllustration({ className = "w-16 h-10", strokeColor = "#78716c" }: IllustrationProps) {
  return (
    <svg viewBox="0 0 64 32" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="18" cy="18" rx="13" ry="10" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round"/>
      <ellipse cx="46" cy="18" rx="13" ry="10" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M31 16c2-3 4-3 6 0" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M5 14c-2-2-3-4-3-6" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M59 14c2-2 3-4 3-6" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// ━━━ Compass / discover icon — for the discover divider ━━━
export function DiscoverIllustration({ className = "w-10 h-10", strokeColor = "#78716c", accentColor = "#d97706" }: IllustrationProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      <circle cx="20" cy="20" r="13" stroke={strokeColor} strokeWidth="1" strokeLinecap="round" opacity="0.25" strokeDasharray="2 3"/>
      {/* Compass needle */}
      <path d="M20 8l-2 10 2 2 2-2-2-10z" fill={accentColor} opacity="0.7"/>
      <path d="M20 32l2-10-2-2-2 2 2 10z" fill={strokeColor} opacity="0.4"/>
      <circle cx="20" cy="20" r="2" fill={strokeColor} opacity="0.5"/>
      {/* Cardinal marks */}
      <path d="M20 5v2" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
      <path d="M20 33v2" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
      <path d="M5 20h2" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
      <path d="M33 20h2" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
    </svg>
  )
}

// ━━━ Small decorative leaf sprig ━━━
export function LeafSprig({ className = "w-8 h-12", strokeColor = "#6b8f71" }: IllustrationProps) {
  return (
    <svg viewBox="0 0 32 48" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M16 44c0-12 1-24 0-36" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M16 14c-7-4-12 0-10 5 2 4 7 4 10 1" stroke={strokeColor} strokeWidth="1.3" strokeLinecap="round" fill="none"/>
      <path d="M16 24c7-4 12 0 10 5-2 4-7 4-10 1" stroke={strokeColor} strokeWidth="1.3" strokeLinecap="round" fill="none"/>
      <path d="M16 10c-4-5-2-8 2-7" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M16 10c4-5 2-8-2-7" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

// ━━━ Empty shelf — for the empty state ━━━
export function EmptyShelfIllustration({ className = "w-64 h-48", strokeColor = "#78716c", accentColor = "#d97706" }: IllustrationProps) {
  return (
    <svg viewBox="0 0 260 200" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Shelf bracket left */}
      <path d="M40 105c0-30 0-50 0-70" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
      <path d="M40 105h-8" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" opacity="0.4"/>

      {/* Shelf bracket right */}
      <path d="M220 105c0-30 0-50 0-70" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
      <path d="M220 105h8" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" opacity="0.4"/>

      {/* Shelf surface */}
      <path d="M30 107h200" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M32 112h196" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.2"/>

      {/* One lonely book leaning */}
      <path d="M120 105l-8-55c-0.3-2 1-3.5 2.8-3.8l12-2c1.8-0.3 3.5 1 3.8 2.8l8 55" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M115 52l11.5-1.8" stroke={strokeColor} strokeWidth="0.8" strokeLinecap="round" opacity="0.3"/>
      <path d="M116 58l10-1.5" stroke={strokeColor} strokeWidth="0.8" strokeLinecap="round" opacity="0.3"/>
      {/* Book spine line */}
      <path d="M114.5 50l7.5 52" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>

      {/* Bookmark */}
      <path d="M127 47l-1 20" stroke={accentColor} strokeWidth="2" strokeLinecap="round"/>
      <path d="M126 67l-2 4 2-1.5 2 1.5-2-4z" fill={accentColor} opacity="0.7"/>

      {/* Small plant in a pot */}
      <path d="M170 105v-15c0-2 2-4 4-4h10c2 0 4 2 4 4v15" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
      <path d="M168 105h24" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
      {/* Plant */}
      <path d="M180 86c0-8 1-14 0-20" stroke="#6b8f71" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M180 70c-5-3-8 0-7 4s5 3 7 1" stroke="#6b8f71" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
      <path d="M180 70c5-3 8 0 7 4s-5 3-7 1" stroke="#6b8f71" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
      <path d="M180 80c-4-1-6 2-4 4" stroke="#6b8f71" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M180 80c4-1 6 2 4 4" stroke="#6b8f71" strokeWidth="1.2" strokeLinecap="round" fill="none"/>

      {/* Dust motes / sparkles */}
      <circle cx="80" cy="75" r="1.5" fill={accentColor} opacity="0.3"/>
      <circle cx="200" cy="60" r="1" fill={accentColor} opacity="0.25"/>
      <circle cx="65" cy="90" r="1" fill={accentColor} opacity="0.2"/>

      {/* Tiny stars */}
      <path d="M90 55l0.8-2.5 0.8 2.5M92.4 54l-2.5 0.8 2.5 0.8" stroke={accentColor} strokeWidth="0.8" strokeLinecap="round" opacity="0.35"/>
      <path d="M155 50l0.6-2 0.6 2M156.8 49.2l-2 0.6 2 0.6" stroke={accentColor} strokeWidth="0.7" strokeLinecap="round" opacity="0.3"/>

      {/* Small text below suggesting emptiness — decorative squiggle */}
      <path d="M100 135c5-3 10 3 15 0s10 3 15 0s10 3 15 0" stroke={strokeColor} strokeWidth="1" strokeLinecap="round" opacity="0.15"/>
      <path d="M108 145c4-2 8 2 12 0s8 2 12 0" stroke={strokeColor} strokeWidth="0.8" strokeLinecap="round" opacity="0.1"/>
    </svg>
  )
}

// ━━━ Small decorative star cluster ━━━
export function StarCluster({ className = "w-6 h-6", color = "#d97706" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3l1 3 1-3M14 5l-3 1 3 1" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
      <path d="M5 10l0.7-2 0.7 2M7 9.3l-2 0.7 2 0.7" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      <path d="M18 14l0.5-1.5 0.5 1.5M19.5 13l-1.5 0.5 1.5 0.5" stroke={color} strokeWidth="0.8" strokeLinecap="round" opacity="0.4"/>
      <circle cx="10" cy="16" r="1" fill={color} opacity="0.3"/>
      <circle cx="16" cy="8" r="0.8" fill={color} opacity="0.25"/>
    </svg>
  )
}
