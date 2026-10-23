# Habitica Streak

## Long-term goal: native iOS/Android release

This is a Vue 3 + Vite + Pinia + SCSS web app. The end goal is to ship it as a real iOS/Android app (after original art and other improvements), most likely by wrapping the built web app with Capacitor. Build everything so that path stays open and no UI work has to be redone.

- Keep it a web app. Don't add dependencies or patterns that tie it to a desktop browser or break a Capacitor WebView.
- Mobile first: respect safe areas (`env(safe-area-inset-*)`, `viewport-fit=cover`), especially the pinned phone header and popups.
- Touch friendly: tap targets of at least ~44px, and nothing important behind hover.
- Keep persistence behind the store layer rather than calling `localStorage` directly from components, so it can be swapped for native storage or a backend.
- Bundle assets (fonts, art) locally so the app works offline. Watch animation/blur/SVG cost on mid-range Android.
