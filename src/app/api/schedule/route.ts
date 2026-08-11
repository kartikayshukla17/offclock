import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/request";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma";
import { getLocalDateString, validateScheduleTimes } from "@/lib/schedule";

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

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

  const dateParam = request.nextUrl.searchParams.get("date");
  if (dateParam !== null && !DATE_RE.test(dateParam)) {
    return NextResponse.json(
      { error: "date must be in YYYY-MM-DD format." },
      { status: 400 },
    );
  }
  const date = dateParam ?? getLocalDateString();

  const schedule = await prisma.daySchedule.findUnique({
    where: { userId_date: { userId: user.id, date: new Date(date) } },
  });

  return NextResponse.json({ schedule });
}

export async function PUT(request: NextRequest) {
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
    workStart?: string;
    workEnd?: string;
    lunchStart?: string;
    lunchEnd?: string;
    topPriority1?: string;
    topPriority2?: string;
    topPriority3?: string;
  };

  if (typeof body.workStart !== "string" || typeof body.workEnd !== "string") {
    return NextResponse.json(
      { error: "workStart and workEnd are required." },
      { status: 400 },
    );
  }

  if (body.date !== undefined && (typeof body.date !== "string" || !DATE_RE.test(body.date))) {
    return NextResponse.json(
      { error: "date must be in YYYY-MM-DD format." },
      { status: 400 },
    );
  }

  const validationError = validateScheduleTimes({
    workStart: body.workStart,
    workEnd: body.workEnd,
    lunchStart: body.lunchStart,
    lunchEnd: body.lunchEnd,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const date = body.date ?? getLocalDateString();

  const schedule = await prisma.daySchedule.upsert({
    where: { userId_date: { userId: user.id, date: new Date(date) } },
    create: {
      userId: user.id,
      date: new Date(date),
      workStart: body.workStart,
      workEnd: body.workEnd,
      lunchStart: body.lunchStart || null,
      lunchEnd: body.lunchEnd || null,
      topPriority1: body.topPriority1 || null,
      topPriority2: body.topPriority2 || null,
      topPriority3: body.topPriority3 || null,
    },
    update: {
      workStart: body.workStart,
      workEnd: body.workEnd,
      lunchStart: body.lunchStart || null,
      lunchEnd: body.lunchEnd || null,
      topPriority1: body.topPriority1 || null,
      topPriority2: body.topPriority2 || null,
      topPriority3: body.topPriority3 || null,
    },
  });

  return NextResponse.json({ schedule });
}
