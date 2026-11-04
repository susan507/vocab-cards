import { withAppBuildGradle } from 'expo/config-plugins';

import type { ConfigContext, ExpoConfig } from 'expo/config';

// Android only installs an update whose versionCode is higher than the installed one.
export function versionCode(version: string): number {
  const [major, minor, patch] = version.split('.').map(Number);
  if (![major, minor, patch].every(n => Number.isInteger(n) && n >= 0 && n < 100)) {
    throw new Error(`version must be x.y.z with parts under 100, got "${version}"`);
  }
  return major * 10000 + minor * 100 + patch;
}

// Release APKs must always be signed with the same key, or installed copies can't be updated.
// The keystore and its passwords live outside the repo, in ~/.gradle/gradle.properties (see README).
// Without them assembleRelease produces an unsigned APK, and build:android fails.
const STORE_FILE = 'VOCAB_CARDS_STORE_FILE';

function withReleaseSigning(config: ExpoConfig): ExpoConfig {
  return withAppBuildGradle(config, mod => {
    let gradle = mod.modResults.contents;
    if (gradle.includes(STORE_FILE)) return mod;
    const releaseSigning =
      /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!releaseSigning.test(gradle) || !gradle.includes('signingConfigs {')) {
      throw new Error('withReleaseSigning: android/app/build.gradle template changed');
    }
    gradle = gradle.replace(
      releaseSigning,
      `$1signingConfig findProperty('${STORE_FILE}') ? signingConfigs.release : null`,
    );
    gradle = gradle.replace(
      'signingConfigs {',
      `signingConfigs {
        if (findProperty('${STORE_FILE}')) {
            release {
                storeFile file(findProperty('${STORE_FILE}'))
                storePassword findProperty('VOCAB_CARDS_STORE_PASSWORD')
                keyAlias findProperty('VOCAB_CARDS_KEY_ALIAS')
                keyPassword findProperty('VOCAB_CARDS_KEY_PASSWORD')
            }
        }`,
    );
    mod.modResults.contents = gradle;
    return mod;
  });
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const expo = config as ExpoConfig;
  return withReleaseSigning({
    ...expo,
    android: { ...expo.android, versionCode: versionCode(expo.version ?? '') },
  });
};
