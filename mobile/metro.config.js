// Expo's default config already handles npm-workspace monorepos (watches the
// repo root and resolves hoisted node_modules), so nothing custom is needed
// for `@tapntally/shared` to resolve. Kept explicit for future tweaks.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
