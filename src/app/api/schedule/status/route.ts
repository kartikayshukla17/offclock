import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/request";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma";
import {
  getLocalDateString,
  validateStatusUpdate,
  type ScheduleStatusValue,
} from "@/lib/schedule";

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

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

  const user = await prisma.user.findUnique({
    where: { firebaseUid: decoded.uid },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    date?: string;
    status?: string;
    statusUntil?: string;
    statusMessage?: string;
  };

  if (typeof body.status !== "string") {
    return NextResponse.json(
      { error: "status is required." },
      { status: 400 },
    );
  }

  if (
    body.date !== undefined &&
    (typeof body.date !== "string" || !DATE_RE.test(body.date))
  ) {
    return NextResponse.json(
      { error: "date must be in YYYY-MM-DD format." },
      { status: 400 },
    );
  }

  if (
    body.statusMessage !== undefined &&
    typeof body.statusMessage !== "string"
  ) {
    return NextResponse.json(
      { error: "statusMessage must be a string." },
      { status: 400 },
    );
  }

  const validationError = validateStatusUpdate({
    status: body.status,
    statusUntil: body.statusUntil,
    statusMessage: body.statusMessage,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const date = body.date ?? getLocalDateString();

  const existing = await prisma.daySchedule.findUnique({
    where: { userId_date: { userId: user.id, date: new Date(date) } },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Set today's hours first." },
      { status: 404 },
    );
  }

  const schedule = await prisma.daySchedule.update({
    where: { userId_date: { userId: user.id, date: new Date(date) } },
    data: {
      status: body.status as ScheduleStatusValue,
      statusUntil: body.statusUntil || null,
      statusMessage: body.statusMessage?.trim() || null,
    },
  });

  return NextResponse.json({ schedule });
}
