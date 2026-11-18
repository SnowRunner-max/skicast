# Skicast

## Design

Skicast follows Apple's design principles. For any UI work, whether that's building, restyling, animating or reviewing, load the `apple-design` skill first and follow it. It's installed at user level in `~/.claude/skills/apple-design`.

- Keep the existing look. Colour, type and radius tokens live in `src/apple.css` (Cottonwood tokens). Use those tokens and don't invent new values. If a new token is needed, add it there with a comment saying why.
- The layout is phone-first. Design for a phone in one hand, often outdoors and wearing gloves: large touch targets, high contrast and glanceable numbers.
- Motion should be physical and interruptible. Use springs that start from the current value and carry the user's velocity, and respect `prefers-reduced-motion`.
- Show restraint: one screen, no decoration that doesn't carry information. Green, amber and red mean wind band only.
