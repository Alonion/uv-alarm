# UV Alarm implementation plan

Status: implementation and repository verification complete. The debug APK was built successfully on 20 July 2026. Firebase, PostgreSQL, Vercel, and release-signing credentials remain operator setup because no private credentials were supplied.

## 1. Inspect and design

- Confirm the repository state and available Node.js, pnpm, Java, and Android SDK tooling.
- Download and inspect the real IMS radiation XML; preserve sanitized fixtures for deterministic parser tests.
- Define the monorepo boundaries, shared contracts, API data flow, notification lifecycle, and privacy constraints.

## 2. Shared package

- Add supported Israeli IMS forecast locations, Zod schemas, UV category/safety logic, Haversine matching, timezone-safe forecast calculations, notification payloads, and deterministic event keys.
- Add unit tests for validation, category boundaries, location matching, time calculations, and event-key generation.

## 3. Serverless API

- Implement pinned IMS fetching, defensive XML parsing, response validation, caching/stale handling, and clearly labelled Open-Meteo fallback data.
- Implement Vercel routes for forecasts, health, device registration/preferences/removal, test notifications, and authenticated scheduled checks.
- Add Drizzle PostgreSQL tables/migrations, request validation, rate limiting, Firebase Admin integration, invalid-token handling, and notification-event deduplication.
- Add fixture-based parser tests and API integration tests with database/Firebase mocks.

## 4. Mobile application

- Build the React/TypeScript/Vite mobile UI: onboarding, current UV, hourly forecast, alarm controls, settings, themes, loading/error states, and responsive layouts.
- Persist native settings with Capacitor Preferences; use one-shot foreground geolocation only for nearest-city selection.
- Add local notifications, high-importance `uv-alerts` channel, permission handling after explicit user action, FCM registration refresh, notification click handling, and local schedule fallback.
- Preserve forecast content while refreshing and ensure source/stale/fallback states are honest.

## 5. Android and delivery

- Generate the Capacitor Android project for `com.uvalarm.app`, configure required permissions, notification metadata/channel support, theme-aware splash resources, adaptive icon placeholders, app links, and conditional Google Services setup.
- Add environment examples, Vercel Cron config, GitHub Actions debug and optional signed-release workflows, privacy policy, and the requested beginner-friendly README sections.

## 6. Verification

- Install dependencies and run formatting checks, ESLint, TypeScript checks, unit/integration tests, and the mobile production build.
- Sync Capacitor and run the Android Gradle debug build, fixing errors without removing working features.
- Verify the exact APK path and document any external Firebase/database/signing setup still required.

### Verification result

- [x] Dependencies installed and workspace lockfile generated.
- [x] Formatting, ESLint, TypeScript, unit/integration tests, and production builds pass.
- [x] Capacitor Android sync succeeds.
- [x] Android `assembleDebug` succeeds with Java 21, SDK Platform 36, and Build Tools 35.
- [x] Debug APK exists at `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
- [x] Rendered UI inspected at 360 px and 430 px with no horizontal overflow.
- [ ] Add the operator's real Firebase, PostgreSQL, Vercel, and signing credentials before production deployment.
