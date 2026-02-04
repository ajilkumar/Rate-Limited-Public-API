export const preset = 'ts-jest';
export const testEnvironment = 'node';
export const roots = ['<rootDir>/tests'];
export const transformIgnorePatterns = [
  'node_modules/(?!(\\@faker-js/faker)/)',
];
export const testMatch = ['**/tests/integration/**/*.test.ts']
export const transform = {
  '^.+\\.ts$': 'ts-jest',
};
export const collectCoverageFrom = [
  'src/**/*.ts',
  '!src/**/*.d.ts',
  '!src/server.ts', // Entry point
  '!src/types/**',
];
export const coverageDirectory = 'coverage';
export const coverageReporters = ['text', 'lcov', 'html'];
export const coverageThreshold = {
  global: {
    branches: 70,
    functions: 75,
    lines: 80,
    statements: 80,
  },
};
export const moduleNameMapper = {
  '^@/(.*)$': '<rootDir>/src/$1',
  '^@config/(.*)$': '<rootDir>/src/config/$1',
  '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
  '^@routes/(.*)$': '<rootDir>/src/routes/$1',
  '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
  '^@services/(.*)$': '<rootDir>/src/services/$1',
  '^@models/(.*)$': '<rootDir>/src/models/$1',
  '^@utils/(.*)$': '<rootDir>/src/utils/$1',
};
// export const setupFilesAfterEnv = ['<rootDir>/tests/setup.ts'];
export const setupFilesAfterEnv = ['<rootDir>/tests/setup.ts']
export const testTimeout = 30000;
export const verbose = true;