# DESIGN.md - Token & Cost Optimization Showcase

## Brand & Audience
- **Product:** Live cost, token, and latency teardown for B2B high-volume AI chat pipelines (`gemini-4-hydrogen`).
- **Audience:** B2B founders, CTOs, and product buyers evaluating API spend at scale (e.g., 100k chat turns/month).
- **Language:** English UI (`en`), starting the input benchmark artifact from raw Russian customer chat (`RU -> EN -> JSON -> Minified -> pxpipe PNG -> Cached + Tuned`).

## Palette Invariants (Shared Across All 3 Variants)
- **Canvas:** Pure White `#FFFFFF` or Light Editorial Paper `#FAFAFA` / `#F7F7F5`
- **Primary Ink:** Graphite Black `#111113` / `#18181B`
- **Secondary Ink:** Neutral Graphite `#52525B` (strict WCAG AA >= 4.5:1 on light canvas)
- **Subtle Surface:** Tinted Light Neutral `#F2F2F0` / `#EFEFED` (borderless, zero drop shadows)
- **Savings Signal:** Forest / Emerald Ink `#0F766E` or `#15803D` (text/bar role only, never glow/gradient)
- **Cost / Waste Signal:** Terracotta / Crimson Ink `#B91C1C` (before baseline marker)

## Hard Visual Floor
- 100% flat elevation (`box-shadow: none`, zero borders on cards/podlozhki, zero dividers).
- Minimum font size `14px` everywhere (`16px-18px` body & interactive controls, large editorial display numerals).
- Non-scrolling viewport-locked `100dvh` slide architecture (`overflow: hidden`) with progressive disclosure on demand (`Inspect` / `Details` drawer or inline reveal).
- Zero emojis, zero em-dashes, pure text buttons or bare borderless SVG icon buttons.
