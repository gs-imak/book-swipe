# 3D Showcase is a layer in front of the Detail Modal, not a replacement

Discovery-surface book taps (swipe deck, Daily Pick, Discover hub, search,
free-books browser) open a full-screen WebGL Showcase with primary actions
(Read / Save / More details); the existing 963-line Detail Modal stays
unchanged behind it, and library/dashboard taps skip the Showcase entirely.
Chosen over embedding 3D in the modal or rebuilding the detail view: we get
the cinematic preview without regressing management features, and three.js
stays out of the main bundle via dynamic import.
