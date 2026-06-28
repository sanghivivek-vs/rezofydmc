/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: {
    '^@common/(.*)$': '<rootDir>/common/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
  },
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!**/index.ts'],
  coverageDirectory: '../coverage',
};
