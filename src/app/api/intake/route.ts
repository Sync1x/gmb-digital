import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type IntakeBody = {
  title?: string;
  body?: string;
  sender?: string;
  stations?: string[];
  /** WordPress category names, e.g. ["Local News"]. Optional. */
  categories?: string[];
  source_ref?: string;
};

/**
 * Intake endpoint for Make.com. Make pulls newsletter emails from Zoho,
 * splits/titles them, and POSTs one draft per story here. Protected by
 * a shared secret header rather than user auth, since Make isn't a
 * logged-in user.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-intake-secret");

  if (!secret || secret !== process.env.INTAKE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: IntakeBody;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, body, sender, stations, categories, source_ref } = payload;

  if (!body || typeof body !== "string" || !body.trim()) {
    return NextResponse.json(
      { error: "`body` is required" },
      { status: 400 }
    );
  }

  if (!sender || typeof sender !== "string" || !sender.trim()) {
    return NextResponse.json(
      { error: "`sender` is required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("drafts")
    .insert({
      title: title?.trim() || null,
      body,
      source_type: "newsletter",
      source_sender: sender.trim(),
      source_ref: source_ref ?? null,
      stations: Array.isArray(stations) ? stations : [],
      categories: Array.isArray(categories)
        ? categories.filter((c): c is string => typeof c === "string" && c.trim() !== "")
        : [],
      status: "new",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to insert draft", error);
    return NextResponse.json(
      { error: "Failed to save draft" },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
