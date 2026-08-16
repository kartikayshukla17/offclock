import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/request";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma";
import { normalizeSlug, validateSlug } from "@/lib/slug";
import { validateScheduleTimes } from "@/lib/schedule";

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

  const user = await prisma.user.findUnique({
    where: { firebaseUid: decoded.uid },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(request: NextRequest) {
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

  const body = (await request.json()) as {
    displayName?: string;
    slug?: string;
    defaultWorkStart?: string;
    defaultWorkEnd?: string;
  };

  const data: {
    displayName?: string;
    slug?: string;
    defaultWorkStart?: string;
    defaultWorkEnd?: string;
  } = {};

  if (typeof body.displayName === "string") {
    const name = body.displayName.trim();
    if (name.length < 1 || name.length > 60) {
      return NextResponse.json(
        { error: "Display name must be 1–60 characters." },
        { status: 400 },
      );
    }
    data.displayName = name;
  }

  if (typeof body.slug === "string") {
    const slug = normalizeSlug(body.slug);
    const slugError = validateSlug(slug);
    if (slugError) {
      return NextResponse.json({ error: slugError }, { status: 400 });
    }

    const taken = await prisma.user.findFirst({
      where: { slug, NOT: { firebaseUid: decoded.uid } },
    });
    if (taken) {
      return NextResponse.json({ error: "That slug is taken." }, { status: 409 });
    }
    data.slug = slug;
  }

  if (body.defaultWorkStart !== undefined || body.defaultWorkEnd !== undefined) {
    if (
      typeof body.defaultWorkStart !== "string" ||
      typeof body.defaultWorkEnd !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "defaultWorkStart and defaultWorkEnd must both be provided together.",
        },
        { status: 400 },
      );
    }
    const templateError = validateScheduleTimes({
      workStart: body.defaultWorkStart,
      workEnd: body.defaultWorkEnd,
    });
    if (templateError) {
      return NextResponse.json({ error: templateError }, { status: 400 });
    }
    data.defaultWorkStart = body.defaultWorkStart;
    data.defaultWorkEnd = body.defaultWorkEnd;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { firebaseUid: decoded.uid },
    data,
  });

  return NextResponse.json({ user });
}
