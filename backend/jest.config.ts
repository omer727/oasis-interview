import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFiles: ['./jest.setup.ts'],
  moduleNameMapper: {
    '@identityhub/shared': '<rootDir>/../shared/src/types.ts',
  },
};

export default config;
