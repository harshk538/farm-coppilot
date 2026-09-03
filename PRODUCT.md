# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are Indian farmers, using the farmer-facing web app (`copilot/`) when a crop is showing a problem and they need a fast answer plus a way to act on it — diagnosis, treatment dosage, weather-driven risk, product authenticity, ordering chemicals, or renting equipment.

Agri-shop vendors use a separate merchant portal (`vendor/`) to claim broadcast orders, manage stock, and dispatch equipment quotes. Equipment owners (tractor/machinery owners) have no login or UI of their own — vendors register and manage them under "Fleet & Owners." Per explicit confirmation, the vendor portal is treated as operating infrastructure that fulfills farmer-facing promises, not as a primary design audience in its own right — design decisions should optimize for the farmer experience first.

## Product Purpose

Farm Copilot gives a farmer a single place to go from "something's wrong with my crop" to a resolved outcome: an AI diagnosis of the problem, a specific treatment with dosage, a way to verify a product is genuine before buying it, a way to source it from a nearby real shop, and a way to rent equipment when the job needs machinery the farmer doesn't own. Success is a farmer reaching a confident, actionable answer with minimal steps.

## Positioning

The AI crop diagnosis is the core bet (confirmed): Google Gemini (`gemini-2.5-flash`, see `server/routes/advisory.js`) analyzes a photo or description of a crop issue and returns a diagnosis with severity and a confidence score. Everything else — treatment/dosage lookup, nearby-shop discovery, order broadcasting, product-authenticity verification, and equipment rental — exists as supporting infrastructure that makes the diagnosis actionable, not as an independent differentiator.

## Operating Context

- **Farmer flow:** describe or photograph a crop issue → Gemini diagnosis (severity + confidence) → treatment & dosage recommendation → nearby agri-shop discovery (Google Maps) → broadcast a chemical order to nearby vendors (first vendor to confirm claims it) → track to delivery/pickup.
- **Equipment flow:** farmer submits a rental request (tractor, harvester, etc.) → vendors assign an available machine owner from their own registered fleet and dispatch a quote → farmer accepts.
- **Vendor/merchant portal** (`vendor/`): no login, just a store switcher between hardcoded/fetched shops; claims broadcast orders, toggles product stock, manages the equipment-owner directory, dispatches equipment quotes, views sales analytics.
- **Backend** (`server/`): Express; farmer auth is JWT + bcrypt over email/password; data currently lives in flat JSON files under `server/data/` (no real database).
- **Deployment:** copilot's backend is deployed to Render (`farm-copilot-backend.onrender.com`); local dev falls back to same-origin requests.

## Capabilities and Constraints

- Diagnosis currently runs on Google Gemini only (confirmed in code). The server also has `@anthropic-ai/sdk` and `openai` as dependencies, but no diagnosis route currently calls them — do not assume multi-provider AI without re-checking the code.
- `i18next` / `react-i18next` are installed, but `LanguageSelector.jsx` is a static "EN" placeholder — language switching is not implemented yet.
- `VoiceCopilot.jsx` and `AuthenticityChecker.jsx` exist as empty stub files, not wired into any route — planned, not built.
- Google Maps (`@react-google-maps/api`) powers nearby-shop discovery in Treatment Finder.
- `vite-plugin-pwa` is installed on the farmer app; installable/offline behavior is present but not confirmed as actively configured.

## Brand Commitments

- Farmer app: "Farm Copilot," current mark is a 🌾 emoji — no dedicated wordmark or logo asset exists yet.
- Merchant portal: "AgriVendor Pro," tagline "Merchant Portal."
- No other binding brand constraints confirmed.

## Evidence on Hand

None. This is a hackathon/demo-stage project (confirmed by user), not a live product. Shop names, phone numbers, product names/prices, and batch codes visible in the code (e.g. `server/data/*.json`) are placeholder demo data, not real business facts — future work must not treat them as evidence to preserve, and should not invent new fabricated "real" data either.

## Product Principles

- The AI diagnosis is the center of gravity. Every other feature exists to make that diagnosis actionable, not to compete with it for attention or screen time.
- This stage favors demo credibility over production hardening — the job right now is to convincingly show the concept, not to survive real farmer/vendor load or every edge case.
- Keep the farmer path low-friction: minimize steps between "something's wrong" and an actionable, specific answer (product + dose + where to get it).
- The vendor portal is infrastructure in service of farmer-facing promises (order fulfillment, equipment quotes) — design it for operational clarity, not as a destination product.

## Accessibility & Inclusion

No standard confirmed yet. Note (inferred, not confirmed): the empty `VoiceCopilot.jsx` stub suggests voice input for lower-literacy or non-typing users was planned — treat this as a hypothesis for future work, not a settled requirement.
