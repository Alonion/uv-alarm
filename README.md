# UV Alarm

## 1. What UV Alarm does

UV Alarm is a mobile-first Android application that displays UV forecast data for supported Israeli locations and alerts the user when the forecast reaches a chosen UV threshold from 1 through 11. Official Israel Meteorological Service (IMS) radiation XML is fetched and parsed only by the backend. Open-Meteo is used only as a clearly labelled temporary fallback.

The Android client uses React, TypeScript, Vite, Capacitor Preferences, one-shot foreground Geolocation, Local Notifications, Push Notifications, and Firebase Cloud Messaging. The Vercel-ready API uses TypeScript, Firebase Admin, Neon Postgres, Drizzle ORM, Zod validation, and an authenticated scheduled UV check.

## 2. Project structure

```text
apps/mobile/      React/Vite client and Capacitor Android project
apps/api/         Vercel serverless routes, IMS parser, database, and Firebase Admin
packages/shared/  Shared cities, schemas, UV logic, time calculations, and payload types
.github/workflows Android debug and optional signed-release builds
```

`PLAN.md` records the implementation plan. `PRIVACY.md` describes the data actually stored and processed.

## 3. Requirements

- Node.js 22 or newer
- Corepack and pnpm 10.14.0
- Java 21
- Android SDK Platform 36 and Build Tools 36.0.0
- Android Studio for IDE/device workflows
- A Firebase project with Android app ID `com.uvalarm.app`
- A PostgreSQL database, preferably Neon
- A Vercel account for the production API and cron

Check the local tools with `node --version`, `pnpm --version`, `java -version`, and `sdkmanager --list`.

## 4. Installing dependencies

From the repository root:

```powershell
corepack prepare pnpm@10.14.0 --activate
pnpm install --frozen-lockfile
```

Run the complete JavaScript/TypeScript quality gate with `pnpm check`.

## 5. Running locally

Copy `apps/api/.env.example` to `apps/api/.env.local` and provide development values. Copy `apps/mobile/.env.example` to `apps/mobile/.env.local` and point `VITE_API_BASE_URL` at the API. Start the API with `pnpm --filter @uv-alarm/api dev`, then start the web client with `pnpm --filter @uv-alarm/mobile dev`.

The web preview demonstrates the UI, but native GPS, FCM, Android notification settings, and local notifications require the Android app. There is no fake production database fallback: device endpoints require PostgreSQL. Automated tests mock Firebase and do not send real notifications.

## 6. Creating the Firebase project

In the Firebase console, create or select a project, enable Cloud Messaging, and keep note of the Firebase project ID. Do not copy Firebase Admin credentials into the mobile app or any `VITE_` variable.

## 7. Registering the Android app

Add an Android app to the Firebase project with package name `com.uvalarm.app`. The optional display name may be `UV Alarm`. Add SHA fingerprints later if other Firebase products require them; basic FCM token delivery does not require Google Sign-In configuration.

## 8. Downloading google-services.json

Download the Firebase-generated `google-services.json` and place it exactly at:

```text
apps/mobile/android/app/google-services.json
```

The real file is ignored by Git. `google-services.json.example` is an instruction placeholder, not fabricated credentials. Re-run `pnpm android:sync` after adding the real file.

## 9. Configuring Firebase Admin

Create a Firebase service account for the backend and set these server-only variables in `apps/api/.env.local` and Vercel:

```dotenv
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Escaped `\n` sequences are converted to real newlines by the server. Never expose these values through Vite or commit the service-account JSON.

## 10. Configuring PostgreSQL

Create a Neon Postgres database and set its HTTPS-compatible connection string:

```dotenv
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

The database stores only random installation/device registration data and notification deduplication records. It does not store user coordinates.

## 11. Running database migrations

With `DATABASE_URL` available to the API process, run:

```powershell
pnpm --filter @uv-alarm/api db:migrate
```

The initial SQL migration is also available at `apps/api/drizzle/0000_initial.sql` for review or manual execution.

## 12. Deploying the API to Vercel

Import `apps/api` as the Vercel project root, or deploy it with the Vercel CLI. Configure all API environment variables listed below. `apps/api/vercel.json` schedules `/api/cron/check-uv` every 30 minutes; available cron cadence depends on the Vercel plan.

Because the API imports `packages/shared`, configure the Vercel project under **Settings → Build and Deployment → Root Directory** as follows:

- Root Directory: `apps/api`
- Include source files outside of the Root Directory in the Build Step: enabled
- Install Command: leave at the automatically detected default (`pnpm install`)

The repository and API package both declare `pnpm@10.14.0`. If a build log says `npm install` or reports that `workspace:*` is unsupported, confirm that Vercel is connected to the complete monorepo rather than an upload containing only `apps/api`, enable the outside-source setting, and redeploy without the old build cache.

Set a long random `CRON_SECRET`. Vercel cron requests must send `Authorization: Bearer <CRON_SECRET>`. After deployment, verify `GET /api/health` and `GET /api/forecast?cityId=lod`.

API environment variables:

- `DATABASE_URL`: Neon/Postgres connection string
- `CRON_SECRET`: secret protecting the scheduled endpoint
- `FIREBASE_PROJECT_ID`: Firebase project ID
- `FIREBASE_CLIENT_EMAIL`: Firebase Admin service-account email
- `FIREBASE_PRIVATE_KEY`: Firebase Admin private key, with escaped newlines supported
- `OPEN_METEO_FALLBACK_ENABLED`: `true` to permit temporary fallback data
- `UV_NOTIFICATION_LEAD_MINUTES`: notification look-ahead, default `30`, maximum `180`

## 13. Setting VITE_API_BASE_URL

Set the mobile build-time variable to the HTTPS origin of the deployed API, with no `/api` suffix:

```dotenv
VITE_API_BASE_URL=https://your-uv-alarm-api.vercel.app
```

This is the only mobile environment variable. Vite variables are public client configuration, so never place database or Firebase Admin secrets in them.

## 14. Opening the Android project

Build and sync first, then open Android Studio:

```powershell
pnpm android:sync
pnpm --filter @uv-alarm/mobile android:open
```

If Android Studio does not detect the SDK, create `apps/mobile/android/local.properties` containing `sdk.dir=C:\\Users\\YOUR_NAME\\AppData\\Local\\Android\\Sdk` or set `ANDROID_HOME`.

## 15. Building a debug APK

With Java 21 and Android SDK 36 installed:

```powershell
pnpm android:sync
Set-Location apps/mobile/android
.\gradlew.bat assembleDebug
```

The expected artifact is `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`. A debug build can compile without `google-services.json`, but remote FCM registration will not work until the real file is present.

## 16. Creating a signing key

Create and protect a release key outside the repository:

```powershell
keytool -genkeypair -v -keystore C:\secure\uv-alarm-release.jks -alias uv-alarm -keyalg RSA -keysize 4096 -validity 10000
```

Back up the keystore and passwords securely. Losing the production signing key can prevent future updates. Keystores and passwords are ignored and must never be committed.

## 17. Building a signed release APK

Set signing values only in the current shell, sync the web bundle, and assemble the release:

```powershell
$env:ANDROID_KEYSTORE_PATH='C:\secure\uv-alarm-release.jks'
$env:ANDROID_KEYSTORE_PASSWORD='your-store-password'
$env:ANDROID_KEY_ALIAS='uv-alarm'
$env:ANDROID_KEY_PASSWORD='your-key-password'
pnpm android:sync
Set-Location apps/mobile/android
.\gradlew.bat assembleRelease
```

The signed APK is written to `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`. The optional release workflow requires GitHub Secrets `GOOGLE_SERVICES_JSON_BASE64`, `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`, plus repository variable `VITE_API_BASE_URL`.

## 18. Installing the APK on a phone

Enable USB debugging on the Android phone, connect it, and confirm `adb devices` lists it. Install or replace the debug APK with:

```powershell
adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Alternatively, transfer the APK to the phone and approve installation from that source. Do not distribute a debug build as a production release.

## 19. Testing push notifications

Complete Firebase, database, API, and mobile URL setup. Install a build containing the real `google-services.json`, open the app, and press **Enable notifications**. Confirm Android permission is granted and Settings shows `Remote UV alerts registered`. Press **Test remote notification**. Also call the protected cron endpoint with the bearer secret in a controlled environment and check its concise sent/skipped/failed summary.

Normal automated tests mock Firebase and never send a real push. A deterministic key of city, threshold, local forecast date, and forecast hour plus a database uniqueness constraint prevents duplicate events.

## 20. Troubleshooting notification permission

Permission is intentionally requested only after the user presses **Enable notifications**. If the app reports that notifications are blocked, use **Open Android settings**, enable notifications for UV Alarm, and verify the `UV Alerts` channel is enabled. On Android 13 and later, `POST_NOTIFICATIONS` must be granted. Reinstalling may reset the permission state during development.

If local permission works but remote registration fails, verify the real Firebase file, `VITE_API_BASE_URL`, Firebase Admin variables, database migration, network access, and `/api/health` response.

## 21. Troubleshooting battery restrictions

Android may delay local alarms or background work under Doze and vendor battery-saving modes. UV Alarm uses server-triggered FCM as the primary closed-app mechanism and local scheduling only as a secondary reminder after a forecast download. Users may allow unrestricted battery use for greater reliability, but the app must continue to respect Android notification-channel sound and vibration choices.

## 22. Privacy and stored information

The app requests foreground location only when **Use my location** is pressed, calculates the nearest supported city on the device, stores only that city ID, and discards coordinates. It never requests background location. The backend stores the random installation ID, FCM token, selected city, threshold, enabled state, platform, timestamps, and notification event keys. It does not collect names, contacts, precise coordinates, or advertising IDs.

Users can remove the backend registration in Settings and reset local app data. Review and publish `PRIVACY.md`, adding an operator contact before public distribution.

### Short test checklist

- Complete onboarding without enabling notifications and load a forecast.
- Change city and threshold; restart and confirm both persist.
- Press **Use my location**; deny once, retry, then confirm only the nearest city and approximate distance appear.
- Refresh during a loaded forecast and confirm the old cards remain visible.
- Verify fallback data says official data is temporarily unavailable and is never labelled official IMS.
- Test system, light, and dark themes at 360 px and 430 px widths.
- Enable notifications from the button, test local/remote delivery, tap a push, and confirm the forecast screen opens.
- Disable alerts and remove the device registration; verify backend settings update.
- Run `pnpm check`, `pnpm android:sync`, and the Gradle debug build before release.
