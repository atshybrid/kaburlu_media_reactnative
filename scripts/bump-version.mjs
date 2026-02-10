#!/usr/bin/env node

/**
 * bump-version.mjs
 * Auto-increment version numbers for app.json and package.json
 * Usage: node scripts/bump-version.mjs [patch|minor|major]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Get increment type from command line args (default: patch)
const incrementType = process.argv[2] || 'patch';

if (!['patch', 'minor', 'major'].includes(incrementType)) {
  console.error('❌ Invalid increment type. Use: patch, minor, or major');
  process.exit(1);
}

/**
 * Increment version string based on type
 * @param {string} version - Current version (e.g., "1.2.3")
 * @param {string} type - Increment type (patch, minor, major)
 * @returns {string} - New version
 */
function incrementVersion(version, type) {
  const parts = version.split('.').map(Number);
  
  switch (type) {
    case 'major':
      parts[0] += 1;
      parts[1] = 0;
      parts[2] = 0;
      break;
    case 'minor':
      parts[1] += 1;
      parts[2] = 0;
      break;
    case 'patch':
    default:
      parts[2] += 1;
      break;
  }
  
  return parts.join('.');
}

/**
 * Update app.json with new version
 */
function updateAppJson(newVersion) {
  const appJsonPath = path.join(rootDir, 'app.json');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  
  const oldVersion = appJson.expo.version;
  const oldVersionCode = appJson.expo.android.versionCode;
  
  // Update version
  appJson.expo.version = newVersion;
  
  // Increment Android versionCode
  appJson.expo.android.versionCode = oldVersionCode + 1;
  
  // Increment iOS buildNumber (if exists)
  if (!appJson.expo.ios.buildNumber) {
    appJson.expo.ios.buildNumber = '1';
  } else {
    const currentBuildNumber = parseInt(appJson.expo.ios.buildNumber, 10);
    appJson.expo.ios.buildNumber = String(currentBuildNumber + 1);
  }
  
  // Write back to file
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');
  
  console.log('✅ app.json updated:');
  console.log(`   Version: ${oldVersion} → ${newVersion}`);
  console.log(`   Android versionCode: ${oldVersionCode} → ${appJson.expo.android.versionCode}`);
  console.log(`   iOS buildNumber: ${appJson.expo.ios.buildNumber}`);
  
  return { oldVersion, newVersion, versionCode: appJson.expo.android.versionCode };
}

/**
 * Update package.json with new version
 */
function updatePackageJson(newVersion) {
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  const oldVersion = packageJson.version;
  packageJson.version = newVersion;
  
  // Write back to file (preserve formatting)
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
  
  console.log('✅ package.json updated:');
  console.log(`   Version: ${oldVersion} → ${newVersion}`);
  
  return { oldVersion, newVersion };
}

/**
 * Create or update changelog
 */
function updateChangelog(newVersion) {
  const changelogPath = path.join(rootDir, 'CHANGELOG.md');
  const today = new Date().toISOString().split('T')[0];
  
  let changelog = '';
  if (fs.existsSync(changelogPath)) {
    changelog = fs.readFileSync(changelogPath, 'utf8');
  } else {
    changelog = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
  }
  
  const newEntry = `## [${newVersion}] - ${today}\n\n### Added\n- \n\n### Changed\n- \n\n### Fixed\n- \n\n`;
  
  // Insert after header
  const lines = changelog.split('\n');
  const headerEnd = lines.findIndex(line => line.startsWith('## '));
  
  if (headerEnd === -1) {
    changelog += '\n' + newEntry;
  } else {
    lines.splice(headerEnd, 0, newEntry);
    changelog = lines.join('\n');
  }
  
  fs.writeFileSync(changelogPath, changelog, 'utf8');
  
  console.log('✅ CHANGELOG.md updated');
  console.log(`   📝 Edit CHANGELOG.md to document your changes for v${newVersion}`);
}

/**
 * Main execution
 */
function main() {
  console.log('\n🚀 Bumping version...\n');
  console.log(`   Increment type: ${incrementType.toUpperCase()}\n`);
  
  try {
    // Read current version from app.json
    const appJsonPath = path.join(rootDir, 'app.json');
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    const currentVersion = appJson.expo.version;
    
    // Calculate new version
    const newVersion = incrementVersion(currentVersion, incrementType);
    
    console.log(`📦 Current version: ${currentVersion}`);
    console.log(`📦 New version: ${newVersion}\n`);
    
    // Update both files
    updateAppJson(newVersion);
    updatePackageJson(newVersion);
    updateChangelog(newVersion);
    
    console.log('\n✅ Version bump complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. Review and edit CHANGELOG.md');
    console.log('   2. Commit changes: git add . && git commit -m "chore: bump version to ' + newVersion + '"');
    console.log('   3. Build: npm run build:android or npm run build:ios');
    console.log('   4. Or use EAS: eas build --platform android --profile production\n');
    
  } catch (error) {
    console.error('❌ Error bumping version:', error.message);
    process.exit(1);
  }
}

main();
