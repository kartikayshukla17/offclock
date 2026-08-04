import { NextRequest } from "next/server";
import { verifyIdToken } from "@/lib/firebase/admin";

export async function getAuthUserFromRequest(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length);
  try {
    return await verifyIdToken(token);
  } catch {
    return null;
  }
}
