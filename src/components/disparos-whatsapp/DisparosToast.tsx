"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, XCircle } from "lucide-react";

export type ToastDisparo = {
  id: string;
  tipo: "sucesso" | "erro" | "info";
  mensagem: string;
};

export function DisparosToast({
  toasts,
  onRemover,
}: {
  toasts: ToastDisparo[];
  onRemover: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[10060] flex w-full max-w-sm flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-4 py-3 shadow-lg ${
              toast.tipo === "sucesso"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : toast.tipo === "info"
                  ? "border-blue-200 bg-blue-50 text-blue-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
            onAnimationComplete={() => {
              window.setTimeout(() => onRemover(toast.id), 4000);
            }}
          >
            {toast.tipo === "sucesso" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : toast.tipo === "info" ? (
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <p className="text-sm">{toast.mensagem}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
