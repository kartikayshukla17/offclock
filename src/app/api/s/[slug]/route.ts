import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocalDateString } from "@/lib/schedule";

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const user = await prisma.user.findUnique({
    where: { slug },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  if (!schedule) {
    return NextResponse.json({
      displayName: user.displayName,
      hasSchedule: false,
    });
  }

  return NextResponse.json({
    displayName: user.displayName,
    hasSchedule: true,
    workStart: schedule.workStart,
    workEnd: schedule.workEnd,
    lunchStart: schedule.lunchStart,
    lunchEnd: schedule.lunchEnd,
    status: schedule.status,
    statusUntil: schedule.statusUntil,
    statusMessage: schedule.statusMessage,
  });
}
