# KargoGig Frontend

Next.js frontend for KargoGig logistics platform with Supabase authentication.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   - Copy `.env.local.example` to `.env.local`
   - Add your Supabase credentials from your Supabase project dashboard

3. **Configure Supabase Auth Settings:**
   
   In your Supabase Dashboard > Authentication > URL Configuration:
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:** Add these URLs:
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3000/reset-password` (optional)

4. **Run the development server:**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Day 1 Features ✅

- ✅ `/login` - Email and password authentication
- ✅ `/signup` - User registration
- ✅ `/forgot-password` - Password reset email flow
- ✅ `/reset-password` - Set new password after reset
- ✅ `/auth/callback` - OAuth callback handler for reset flows
- ✅ Middleware for session management and smart redirects
- ✅ Protected homepage with sign out functionality

## Project Structure

```
app/
  (auth)/              # Auth pages group
    login/
    signup/
    forgot-password/
    reset-password/
    layout.tsx
  auth/
    callback/          # OAuth callback route
  page.tsx             # Protected homepage
  layout.tsx           # Root layout
lib/
  supabase/
    client.ts          # Browser client
    server.ts          # Server client
middleware.ts          # Session refresh & redirects
```

## Testing Checklist

- [ ] **Signup:** Create a new user → Check Supabase Auth dashboard
- [ ] **Login:** Sign in with credentials → Should redirect to homepage
- [ ] **Session persistence:** Refresh page → Should stay logged in
- [ ] **Forgot password:** Request reset → Check email inbox
- [ ] **Reset password:** Click email link → Should land on reset page
- [ ] **Set new password:** Update password → Login with new password works
- [ ] **Sign out:** Click sign out → Redirects to login

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Auth:** Supabase Auth
- **Language:** TypeScript
- **Styling:** Inline styles (Day 1 - can be upgraded to Tailwind)

## Next Steps

- Add Tailwind CSS for better styling
- Add form validation with Zod
- Add loading states and error handling
- Add email verification flow
- Add OAuth providers (Google, GitHub, etc.)
