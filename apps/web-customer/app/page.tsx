import { createSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  async function signOut() {
    'use server';
    const supabase = createSupabaseServer();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Welcome to KargoGig</h1>
      <p style={{ marginBottom: 16 }}>You're logged in as: <strong>{user.email}</strong></p>
      <form action={signOut}>
        <button type="submit" style={{ padding: "8px 16px", cursor: "pointer" }}>
          Sign out
        </button>
      </form>
    </div>
  );
}
