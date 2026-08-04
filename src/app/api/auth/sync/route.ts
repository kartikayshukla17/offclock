import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/request";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Server auth is not configured." },
      { status: 503 },
    );
  }

  const decoded = await getAuthUserFromRequest(request);
  if (!decoded?.uid || !decoded.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.upsert({
    where: { firebaseUid: decoded.uid },
    create: {
      firebaseUid: decoded.uid,
      email: decoded.email,
      displayName: decoded.name ?? null,
    },
    update: {
      email: decoded.email,
      ...(decoded.name ? { displayName: decoded.name } : {}),
    },
  });

  return NextResponse.json({ user });
}
