/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'adapters/**/*.ts',
    'core/**/*.ts',
    '!**/__tests__/**',
    '!**/index.ts'
  ]
};
