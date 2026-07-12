"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  ClipboardList,
  Wallet,
  LogOut,
  Menu,
  X,
  FlaskConical,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

export function Sidebar({ userName }: { userName: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = useMemo(
    () => [
      { href: "/app", label: t("sidebar.dashboard"), icon: LayoutDashboard },
      { href: "/app/clientes", label: t("nav.clientes"), icon: Users },
      { href: "/app/pacientes", label: t("cadastros.pacientes.titulo"), icon: UserCircle },
      { href: "/app/trabalhos", label: t("cadastros.trabalhos.titulo"), icon: ClipboardList },
      { href: "/app/financeiro", label: t("nav.financeiro"), icon: Wallet },
    ],
    [t]
  );

  async function logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      window.location.href = "/login";
    }
  }

  const content = (
  <>
      <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-5">
        <FlaskConical className="h-7 w-7 text-sky-400" />
        <div>
          <p className="font-bold text-white">Lab Prótese</p>
          <p className="text-xs text-slate-400">{t("sidebar.gestaoLab")}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {nav.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/app" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-800 p-4">
        <p className="truncate text-sm font-medium text-white">{userName}</p>
        <button
          onClick={logout}
          className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          {t("user.logout")}
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        className="fixed left-4 top-4 z-40 rounded-lg bg-slate-900 p-2 text-white lg:hidden"
        onClick={() => setOpen(!open)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-slate-900 transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {content}
      </aside>
    </>
  );
}
