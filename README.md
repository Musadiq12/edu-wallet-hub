# Edu Wallet Hub

Edu Wallet Hub is an educational resource platform for browsing and purchasing digital study materials. It includes a React and TypeScript application, a TanStack Start/Vite build setup, and Supabase integration.

## Features

- Browse educational resources and product details.
- Search and discover study materials.
- Account authentication and password recovery.
- Checkout and payment-confirmation workflows.
- Administrative tools for managing resources and orders.
- Free resource links and customer contact flows.

Feature availability depends on the application's configured backend and environment.

## Requirements

- Node.js compatible with the versions declared by the project tooling.
- Bun 1.2.15 (the repository includes `bun.lock` and a lockfile synchronization workflow).

## Setup

Install the project's dependencies:

```sh
bun install --frozen-lockfile
```

Create a local environment file using the project's documented environment-variable names. Never commit real credentials or production secrets.

Start the development server:

```sh
bun run dev
```

## Validation

```sh
bun run lint
bun run build
```

To preview the production build where supported:

```sh
bun run preview
```

## Deployment

Review the workflows in `.github/workflows/` and configure the required repository secrets and hosting environment before deploying. Do not assume a deployment is configured until the workflow and live site have been verified.

## Licensing

Preserve the repository's license and all third-party license and attribution notices when redistributing this project.
