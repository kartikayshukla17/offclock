import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/request";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma";
import { normalizeSlug, validateSlug } from "@/lib/slug";

export async function GET(request: NextRequest) {
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Server auth is not configured." },
      { status: 503 },
    );
  }

  const decoded = await getAuthUserFromRequest(request);
  if (!decoded?.uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawSlug = request.nextUrl.searchParams.get("slug");
  if (!rawSlug) {
    return NextResponse.json({ error: "slug is required." }, { status: 400 });
  }

  const slug = normalizeSlug(rawSlug);
  const slugError = validateSlug(slug);
  if (slugError) {
    return NextResponse.json({ error: slugError }, { status: 400 });
  }

  const taken = await prisma.user.findFirst({
    where: { slug, NOT: { firebaseUid: decoded.uid } },
  });

  return NextResponse.json({ available: !taken });
}
