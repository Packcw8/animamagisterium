# iOS / TestFlight Setup

## Current Native Identity

- App name: Anima Magisterium
- Bundle identifier: `com.packcw8.animamagisterium`
- Expo scheme: `animamagisterium`
- iOS build number: `1`

## Before Apple Approval Completes

1. Keep building and testing the web app.
2. Keep `.env.local` local only.
3. Confirm the app icon and splash still look correct from `assets/icon.png` and `assets/splash-icon.png`.
4. Avoid committing Apple certificates, provisioning profiles, or private keys.

## After Apple Developer Approval

1. Install or use EAS:

```bash
npx eas-cli@latest login
```

2. Configure the Expo project if needed:

```bash
npx eas-cli@latest build:configure
```

3. Add the public Supabase variables to EAS for native builds. Use the same values as `.env.local` / Vercel:

```bash
eas env:create preview --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_PROJECT.supabase.co" --visibility plaintext --force
eas env:create preview --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "YOUR_PUBLISHABLE_KEY" --visibility sensitive --force
eas env:create development --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_PROJECT.supabase.co" --visibility plaintext --force
eas env:create development --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "YOUR_PUBLISHABLE_KEY" --visibility sensitive --force
eas env:create production --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_PROJECT.supabase.co" --visibility plaintext --force
eas env:create production --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "YOUR_PUBLISHABLE_KEY" --visibility sensitive --force
```

Do not add `OPENAI_API_KEY` as an Expo public variable. It must stay server-side only.

4. Create an internal iOS build:

```bash
npx eas-cli@latest build --platform ios --profile preview
```

5. Create the App Store / TestFlight build:

```bash
npx eas-cli@latest build --platform ios --profile production
```

6. Upload to App Store Connect:

```bash
npx eas-cli@latest submit --platform ios --profile production
```

## App Store Connect Fields To Prepare

- App name: Anima Magisterium
- Bundle ID: `com.packcw8.animamagisterium`
- Category: Games, Adventure or Role Playing
- Privacy details:
  - Account login
  - Location while app is open for journey progress
  - User photos for avatar generation
  - Purchases only if added later
- Age rating: likely fantasy violence, no gambling unless mechanics change

## Native Feature Notes

- Browser/PWA walking works only while the app is open.
- A native iOS build can later add HealthKit/CoreMotion pedometer support for treadmill/offline step progress.
- Background location and pedometer support will need additional native packages and App Store privacy review.
