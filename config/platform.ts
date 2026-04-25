export type AppEnvironment = 'dev' | 'test' | 'prod';

export const platformConfig = {
  environments: {
    dev: {
      branchPattern: 'feature/*',
      defaultUrl: 'http://localhost:3024',
    },
    test: {
      branch: 'staging',
      defaultUrl: 'https://test.example.com',
    },
    prod: {
      branch: 'main',
      defaultUrl: 'https://example.com',
    },
  },
} as const;

export function branchToEnvironment(branchName: string): AppEnvironment {
  if (branchName === platformConfig.environments.test.branch) {
    return 'test';
  }

  if (branchName === platformConfig.environments.prod.branch) {
    return 'prod';
  }

  return 'dev';
}
