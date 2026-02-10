# Automatic Version Management System

## ✅ Setup Complete!

Your project now has automatic version management configured.

## Quick Start

### Build with Auto Version Bump

```bash
# Android AAB (auto increments version)
npm run build:android

# iOS (auto increments version)
npm run build:ios

# Both platforms (auto increments version)
npm run build:all
```

### Manual Version Control

```bash
# For bug fixes (1.1.1 → 1.1.2)
npm run version:patch

# For new features (1.1.1 → 1.2.0)
npm run version:minor

# For breaking changes (1.1.1 → 2.0.0)
npm run version:major
```

## What Gets Updated

Every version bump automatically updates:
- ✅ `app.json` → expo.version
- ✅ `app.json` → expo.android.versionCode (incremented)
- ✅ `app.json` → expo.ios.buildNumber (incremented)
- ✅ `package.json` → version
- ✅ `CHANGELOG.md` → new entry created

## Current Setup

- **Version:** 1.1.1
- **Android versionCode:** 3
- **iOS buildNumber:** 3

## Next Release

When you're ready to release:

```bash
# Option 1: Quick build (recommended)
npm run build:android
# This will: bump version to 1.1.2, increment versionCode to 4, and build

# Option 2: Manual control
npm run version:patch  # Bump to 1.1.2
# Edit CHANGELOG.md to document changes
git add . && git commit -m "chore: bump version to 1.1.2"
eas build --platform android --profile production
```

## Files

- 📝 `scripts/bump-version.mjs` - Version management script
- 📖 `VERSION_MANAGEMENT.md` - Complete documentation
- 📄 `CHANGELOG.md` - Will be created on first version bump

## Configuration

- ✅ EAS build configured for app-bundle (AAB) for Play Store
- ✅ Auto-increment disabled in eas.json (script handles it)
- ✅ iOS buildNumber added to app.json
- ✅ Version sync between app.json and package.json
- ✅ npm scripts configured for easy use

---

**Read full documentation:** [VERSION_MANAGEMENT.md](VERSION_MANAGEMENT.md)
