"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowed-emails";

export async function login(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Incorrect email or password." };
  }

  if (!isAllowedEmail(email)) {
    // Valid Supabase account, but not on the allowlist: sign back out.
    await supabase.auth.signOut();
    return { error: "This account isn't authorized for GMB Digital." };
  }

  redirect("/");
}
