import type { ReactNode } from "react";
import { AdminMenu } from "./admin-menu";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <AdminMenu />
      {children}
    </div>
  );
}
