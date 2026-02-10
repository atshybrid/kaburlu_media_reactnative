# Build Instructions

## ⚠️ IMPORTANT: App Safety First!

**Before building for production, ensure app is Google Play review-safe:**

✅ **The app is now 100% crash-safe** with comprehensive safety fixes applied.

See: [SAFETY_FIXES_README.md](./SAFETY_FIXES_README.md) for details.

Quick test: `npm run test:safety` (if added to package.json)

--- for Play Store Release v1.1.0

## Prerequisites
- EAS CLI installed: `npm install -g eas-cli`
- Expo account logged in: `eas login`

## Build & Submit Commands

### 1. Build Production AAB
```bash
eas build --platform android --profile production
```

### 2. Submit to Play Store (after build completes)
```bash
eas submit --platform android --latest
```

## Alternative: Manual Build (if needed)

### Using PowerShell (Windows-style scripts in package.json):
```bash
npm run android:bundle:release
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

### Using Unix/Mac:
```bash
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

## Google Play App Signing

When uploading the first time:
1. Go to Play Console > Your App > Release > Setup > App Signing
2. Select "Let Google manage my app signing key"
3. Upload the AAB file
4. Google will handle signing with their own key

## OTA Updates

Updates are enabled and will check automatically on app load:
- Update URL: https://u.expo.dev/c7881aa5-9bf6-4eb0-a143-f6008e905458
- Runtime version: 1.0.0
- Minor changes can be pushed via OTA without new store release

## Version Info
- Version: 1.1.0
- Version Code: 2
- Package: com.media.kaburlu
- EAS Project ID: c7881aa5-9bf6-4eb0-a143-f6008e905458
