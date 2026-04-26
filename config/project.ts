export const projectConfig = {
  name: 'AI First Template',
  slug: 'aifirst-template',
  supportEmail: 'support@example.com',
  domains: {
    dev: 'http://localhost:3024',
    test: 'https://test.app.pest.gg',
    prod: 'https://app.pest.gg',
  },
  storageBuckets: {
    test: 'pest-gg-app-staging',
    prod: 'pest-gg-app-prod',
  },
} as const;
