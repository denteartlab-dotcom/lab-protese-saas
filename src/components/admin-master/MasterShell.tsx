"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export function MasterShell({
  masterName,
  children,
}: {
  masterName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function sair() {
    await fetch("/api/admin-master/auth/logout", { method: "POST" });
    router.replace("/admin-master/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8]">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#4a90d9] text-white">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Lab Prótese</p>
              <p className="text-[11px] text-slate-500">Painel Master</p>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/admin-master"
              className={cn(
                "rounded-md px-3 py-2 text-xs font-medium transition",
                pathname === "/admin-master"
                  ? "bg-[#4a90d9] text-white"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              Dashboard
            </Link>
            <Link
              href="/admin-master/suporte"
              className={cn(
                "rounded-md px-3 py-2 text-xs font-medium transition",
                pathname.startsWith("/admin-master/suporte")
                  ? "bg-[#4a90d9] text-white"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              Suporte
            </Link>
            <span className="hidden text-xs text-slate-500 sm:inline">{masterName}</span>
            <button
              type="button"
              onClick={sair}
              className="flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-5 md:px-6 md:py-6">{children}</main>
    </div>
  );
}
