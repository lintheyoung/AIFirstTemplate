export const projectConfig = {
  name: 'AI First Template',
  slug: 'aifirst-template',
  supportEmail: 'support@example.com',
  domains: {
    dev: 'http://localhost:3024',
    test: 'https://test.example.com',
    prod: 'https://example.com',
  },
  storageBuckets: {
    test: 'aifirst-template-staging',
    prod: 'aifirst-template-prod',
  },
} as const;
