# Security Policy

## Supported Versions

This repository is a starter template. Security fixes should be applied to the
latest `main` branch and then copied into products generated from the template.

## Reporting A Vulnerability

Please open a private security advisory on GitHub or contact the repository
owner directly. Do not create a public issue for secrets, auth bypasses,
credential leaks, or remote execution concerns.

## Secret Handling

- Never commit `.env.local`, `.env.*.local`, `symphony/.env.local`, or
  `symphony/profiles/*.env.local`.
- Rotate any key that was accidentally committed, even if the commit is later
  removed.
- Use separate credentials for dev, test, and prod.
- Treat the Symphony runner as trusted automation with repository write access.
  Run it only against repositories and Linear projects you control.
