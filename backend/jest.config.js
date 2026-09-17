module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!main.ts', '!**/migrations/**'],
  coverageDirectory: '../coverage',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json', diagnostics: false }] },
};
