"use client";

import RoleLayout from "@/components/RoleLayout";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayout role="staff">{children}</RoleLayout>;
}
