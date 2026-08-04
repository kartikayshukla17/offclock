import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — OffClock",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
