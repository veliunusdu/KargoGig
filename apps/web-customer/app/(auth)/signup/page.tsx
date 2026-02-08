"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function SignupPage() {
  const supabase = createSupabaseBrowser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) return setMsg(error.message);

    // Depending on Supabase email confirmation settings, user may need to confirm email.
    setMsg("Account created. If email confirmation is enabled, check your inbox.");
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600 }}>Sign up</h2>

      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

      <button disabled={loading} type="submit">
        {loading ? "Creating..." : "Create account"}
      </button>

      <a href="/login">Back to login</a>

      {msg && <p>{msg}</p>}
    </form>
  );
}
