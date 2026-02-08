# KargoGig Admin Panel

Admin paneli - platform yönetimi, kullanıcı yönetimi, moderasyon araçları.

## Tech Stack

- Next.js 15.1.6
- React 19
- TypeScript
- Supabase Auth + RLS (@kargogig/ui-auth)
- Shared types (@kargogig/contracts)

## Development

```bash
# Install dependencies (from root)
npm install

# Run dev server
npm run dev --workspace=apps/admin

# or from this directory
npm run dev
```

Server runs on: http://localhost:3003

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the required values:

```bash
cp .env.example .env.local
```

## Features

- Admin authentication (protected by Supabase RLS)
- User management (customers, drivers, companies)
- Ride monitoring & intervention
- Payment oversight
- Analytics & reports
- Announcement management

## Admin Access

Admin users must have `role = 'admin'` in the `profiles` table. Use Supabase SQL Editor:

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-admin@email.com';
```

## Project Structure

```
src/
├── app/              # Next.js App Router pages
│   ├── (auth)/       # Admin login
│   ├── (dashboard)/  # Admin dashboard pages
│   └── auth/         # Auth callback
├── components/       # React components
└── lib/              # Utilities, API clients
```

## Security

- All admin endpoints protected by `@UseGuards(AdminGuard)` in backend
- Frontend checks `role === 'admin'` via Supabase session
- RLS policies in Supabase enforce admin-only data access

## Related Packages

- `@kargogig/contracts` - Shared types
- `@kargogig/ui-auth` - Supabase auth helpers
- `@kargogig/api-client` - Backend API client
