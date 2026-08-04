import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — OffClock",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
