const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function validateScheduleTimes(input: {
  workStart: string;
  workEnd: string;
  lunchStart?: string;
  lunchEnd?: string;
}): string | null {
  const { workStart, workEnd, lunchStart, lunchEnd } = input;

  if (!isValidTime(workStart) || !isValidTime(workEnd)) {
    return "Work start and end must be valid times (HH:mm).";
  }
  if (toMinutes(workEnd) <= toMinutes(workStart)) {
    return "Work end must be after work start.";
  }

  const hasLunchStart = lunchStart !== undefined && lunchStart !== "";
  const hasLunchEnd = lunchEnd !== undefined && lunchEnd !== "";

  if (hasLunchStart !== hasLunchEnd) {
    return "Lunch start and end must both be set, or both left blank.";
  }

  if (hasLunchStart && hasLunchEnd) {
    if (!isValidTime(lunchStart!) || !isValidTime(lunchEnd!)) {
      return "Lunch start and end must be valid times (HH:mm).";
    }
    const start = toMinutes(workStart);
    const end = toMinutes(workEnd);
    const lStart = toMinutes(lunchStart!);
    const lEnd = toMinutes(lunchEnd!);
    if (lStart < start || lEnd > end || lStart >= lEnd) {
      return "Lunch window must fall within work hours.";
    }
  }

  return null;
}
