# Version Management Guide

## Overview

This project uses automatic version management to handle version numbers across `app.json` and `package.json`. Version numbers are automatically incremented when building for Android or iOS.

## Version Format

We follow **Semantic Versioning (SemVer)**: `MAJOR.MINOR.PATCH`

- **MAJOR** (1.x.x): Breaking changes or major feature releases
- **MINOR** (x.1.x): New features, backward-compatible
- **PATCH** (x.x.1): Bug fixes, small improvements

**Current Version:** `1.1.1`

## Automatic Version Management

### What Gets Updated

When you bump the version, the script automatically updates:

1. ✅ **app.json**
   - `expo.version` → Semantic version (e.g., "1.1.2")
   - `expo.android.versionCode` → Auto-incremented (e.g., 3 → 4)
   - `expo.ios.buildNumber` → Auto-incremented (e.g., "3" → "4")

2. ✅ **package.json**
   - `version` → Matches app.json version

3. ✅ **CHANGELOG.md**
   - New entry created for the version with date

## Usage

### Manual Version Bump

Use these commands to manually bump the version:

```bash
# Patch version (1.1.1 → 1.1.2) - For bug fixes
npm run version:patch

# Minor version (1.1.1 → 1.2.0) - For new features
npm run version:minor

# Major version (1.1.1 → 2.0.0) - For breaking changes
npm run version:major
```

### Automatic Bump with Build

The easiest way - version bumps automatically when you build:

```bash
# Android AAB (auto version bump + build)
npm run build:android

# iOS (auto version bump + build)
npm run build:ios

# Both platforms (auto version bump + build)
npm run build:all
```

These commands will:
1. ✅ Bump patch version automatically
2. ✅ Update all version files
3. ✅ Build with EAS

## Build Commands

### Production Builds

```bash
# Android AAB with auto version bump
npm run build:android

# iOS with auto version bump  
npm run build:ios

# Both platforms with auto version bump
npm run build:all
```

### Manual EAS Build (without auto version bump)

If you already bumped version manually:

```bash
# Android only
eas build --platform android --profile production

# iOS only
eas build --platform ios --profile production

# Both
eas build --platform all --profile production
```

## Workflow Examples

### Example 1: Bug Fix Release

```bash
# 1. Make your bug fixes
git add .
git commit -m "fix: resolve photo upload issue"

# 2. Build (auto-bumps patch version 1.1.1 → 1.1.2)
npm run build:android

# 3. Edit CHANGELOG.md to document the fix

# 4. Commit version changes
git add .
git commit -m "chore: bump version to 1.1.2"
git push
```

### Example 2: New Feature Release

```bash
# 1. Develop new feature
git add .
git commit -m "feat: add dark mode support"

# 2. Manually bump minor version (1.1.1 → 1.2.0)
npm run version:minor

# 3. Edit CHANGELOG.md to document features

# 4. Commit version bump
git add .
git commit -m "chore: bump version to 1.2.0"

# 5. Build without auto-bump (version already updated)
eas build --platform android --profile production

# 6. Push changes
git push
```

### Example 3: Quick Patch Release

```bash
# One command does everything:
npm run build:android

# Then just edit CHANGELOG.md and commit
```

## Files Modified by Version Bump

### app.json
```json
{
  "expo": {
    "version": "1.1.2",           // ← Version string
    "android": {
      "versionCode": 4            // ← Build number (incremented)
    },
    "ios": {
      "buildNumber": "4"          // ← Build number (incremented)
    }
  }
}
```

### package.json
```json
{
  "version": "1.1.2"              // ← Synced with app.json
}
```

### CHANGELOG.md
```markdown
## [1.1.2] - 2026-02-11

### Added
- 

### Changed
- 

### Fixed
- 
```

## Version History Tracking

Always update `CHANGELOG.md` after version bump to document:

- ✅ What features were added
- ✅ What bugs were fixed  
- ✅ What changed from previous version

## Best Practices

### ✅ DO

- **Use `npm run build:android`** for quick patch releases
- **Update CHANGELOG.md** after every version bump
- **Commit version changes** separately from feature commits
- **Use semantic versioning** correctly (patch for fixes, minor for features, major for breaking)

### ❌ DON'T

- **Don't manually edit version numbers** in app.json or package.json
- **Don't skip CHANGELOG updates**
- **Don't bump major version** without team discussion
- **Don't forget to commit** version changes before building

## Troubleshooting

### Version Mismatch

If app.json and package.json versions don't match:

```bash
# Run version bump to sync them
npm run version:patch
```

### Wrong Version Number

If you bumped the wrong increment type:

```bash
# Just run the correct bump
npm run version:minor  # This will override the previous bump
```

### Build Number Issues

Android `versionCode` and iOS `buildNumber` must always increase. The script handles this automatically - never decrease these numbers manually.

## CI/CD Integration

For automated builds in CI/CD:

```bash
# In your CI/CD pipeline
npm run version:patch
git add app.json package.json CHANGELOG.md
git commit -m "chore: bump version [skip ci]"
git push
eas build --platform android --profile production --non-interactive
```

## Script Location

The version management script is located at:
```
scripts/bump-version.mjs
```

## Summary

| Command | Action | Use When |
|---------|--------|----------|
| `npm run version:patch` | 1.1.1 → 1.1.2 | Bug fixes, small changes |
| `npm run version:minor` | 1.1.1 → 1.2.0 | New features |
| `npm run version:major` | 1.1.1 → 2.0.0 | Breaking changes |
| `npm run build:android` | Auto patch + build | Quick Android release |
| `npm run build:ios` | Auto patch + build | Quick iOS release |
| `npm run build:all` | Auto patch + build both | Quick dual release |

---

**Current Version:** 1.1.1  
**Android versionCode:** 3  
**iOS buildNumber:** 3
