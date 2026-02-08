"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@kargogig/ui-auth/client";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
      } else {
        setUser(user);
        setLoading(false);
      }
    });
  }, [supabase, router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
        Company Dashboard
      </h1>
      <p style={{ marginBottom: 16 }}>
        Logged in as: <strong>{user?.email}</strong>
      </p>
      <button onClick={signOut} style={{ padding: "8px 16px", cursor: "pointer" }}>
        Sign out
      </button>
    </div>
  );
}
