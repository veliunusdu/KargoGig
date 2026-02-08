# KargoGig Web Company Dashboard

Şirket dashboard'u - filo yönetimi, sürücü takibi, gelir raporları.

## Tech Stack

- Next.js 15.1.6
- React 19
- TypeScript
- Supabase Auth (@kargogig/ui-auth)
- Shared types (@kargogig/contracts)

## Development

```bash
# Install dependencies (from root)
npm install

# Run dev server
npm run dev --workspace=apps/web-company

# or from this directory
npm run dev
```

Server runs on: http://localhost:3002

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the required values:

```bash
cp .env.example .env.local
```

## Features

- Company authentication
- Driver management (add, edit, monitor drivers)
- Vehicle fleet management
- Real-time ride tracking
- Revenue & analytics dashboard
- Payout requests
- Document verification

## Project Structure

```
src/
├── app/              # Next.js App Router pages
│   ├── (auth)/       # Company login/signup
│   ├── (dashboard)/  # Company dashboard pages
│   │   ├── drivers/  # Driver management
│   │   ├── vehicles/ # Vehicle management
│   │   ├── rides/    # Ride history
│   │   └── analytics/# Reports & stats
│   └── auth/         # Auth callback
├── components/       # React components
└── lib/              # Utilities
```

## Company Onboarding

1. Company signs up via `/signup`
2. Admin approves company in admin panel
3. Company status changes to `active`
4. Company can now add drivers and vehicles

## Related Packages

- `@kargogig/contracts` - Shared types
- `@kargogig/ui-auth` - Supabase auth helpers
- `@kargogig/api-client` - Backend API client
- `@kargogig/ui` - Shared UI components
