# Cardfetcher — Figma Plugin

Paste a Magic: The Gathering decklist, hit import, watch cards appear on your Figma canvas. Partner plugin to [cardfetcher.app](https://cardfetcher.app).

## What it does

- Parses decklists (Moxfield format supported — hashtags, foil markers, set codes all handled)
- Fetches card data and high-res images from Scryfall
- Spawns rectangles on your canvas, laid out in a grid, filled with card art
- Handles double-faced cards — includes the back side as a separate rectangle (toggleable)
- Respects exact printings when you include set code + collector number, e.g. `1 Sol Ring (SLD) 1664`

## Install locally (dev mode)

1. Open Figma desktop app (plugin dev only works in desktop)
2. Menu → Plugins → Development → Import plugin from manifest…
3. Pick `figma-plugin/manifest.json` from the Cardfetcher repo (or `manifest.json` if you’re already inside `figma-plugin`)
4. The plugin appears under Plugins → Development → Cardfetcher
5. Run it on any Figma or FigJam file

## Files

- `manifest.json` — plugin config + network permissions for Scryfall domains
- `code.js` — sandbox-side code, creates rectangles on canvas
- `ui.html` — plugin UI, handles decklist parsing and Scryfall fetching

## Recommended workflow

1. Build and refine your decklist on [cardfetcher.app](https://cardfetcher.app) — swap printings, apply old border mode, etc.
2. Copy the refined list (set codes and collector numbers are included)
3. Paste into this plugin, hit Import

## Publishing to Figma Community

When ready:
1. Menu → Plugins → Development → Cardfetcher → Publish new release
2. Fill in cover image, tagline, description
3. Submit for review (takes a few days)

## Notes

- Image sizes match standard card proportions: 488 × 680 px
- Grid layout: 5 columns, 24px gap
- Cards are placed inside a wrapper frame so you can move/organize easily
- Rate-limited to 100ms between Scryfall requests per their guidelines
