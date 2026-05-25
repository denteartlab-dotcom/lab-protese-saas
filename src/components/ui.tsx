"use client";

import { criarHandlersSelecionarAoFocar } from "@/lib/input-selecao";
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, Children, InputHTMLAttributes, cloneElement, forwardRef, isValidElement } from "react";

export { propsInputComSelecaoAoFocar } from "@/lib/input-selecao";
export { CampoDataBr } from "@/components/campo-data-br";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
}) {
  const variants = {
    primary: "bg-primary-600 text-white hover:bg-primary-700 shadow-sm",
    secondary: "bg-slate-200 text-slate-800 hover:bg-slate-300",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
    outline: "border border-slate-300 bg-white hover:bg-slate-50 text-slate-700",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    label?: React.ReactNode;
    error?: string;
    selectOnFocus?: boolean;
  }
>(function Input(
  { className, label, error, id, selectOnFocus, onFocus, onClick, type, ...props },
  ref
) {
  const inputId = id || (typeof label === "string" ? label.toLowerCase().replace(/\s/g, "-") : undefined);
  const deveSelecionar = selectOnFocus ?? type === "number";
  const handlersSelecao = deveSelecionar
    ? criarHandlersSelecionarAoFocar(onFocus, onClick)
    : { onFocus, onClick };

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        type={type}
        className={cn(
          "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20",
          error && "border-red-500",
          className
        )}
        {...props}
        {...handlersSelecao}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { label?: React.ReactNode }
>(function Select({ className, label, id, children, ...props }, ref) {
  const selectId = id || (typeof label === "string" ? label.toLowerCase().replace(/\s/g, "-") : undefined);
  const isPlaceholder =
    props.value === "" || props.value === "todos" || props.value === undefined;
  const options = Children.map(children, (child) => {
    if (!isValidElement<React.OptionHTMLAttributes<HTMLOptionElement>>(child) || child.type !== "option") {
      return child;
    }

    return cloneElement(child, {
      style: {
        color: child.props.value === "" ? "#94a3b8" : "#334155",
        ...child.props.style,
      },
    });
  });
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={cn(
          "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20",
          isPlaceholder ? "text-slate-400" : "text-slate-700",
          className
        )}
        {...props}
      >
        {options}
      </select>
    </div>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: React.ReactNode }
>(function Textarea({ className, label, id, ...props }, ref) {
  const areaId = id || (typeof label === "string" ? label.toLowerCase().replace(/\s/g, "-") : undefined);
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={areaId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={areaId}
        className={cn(
          "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 min-h-[80px]",
          className
        )}
        {...props}
      />
    </div>
  );
});

export function Card({
  children,
  className,
  title,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          {title && <h3 className="font-semibold text-slate-800">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  className,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-5 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          {trend && <p className="mt-1 text-xs text-slate-500">{trend}</p>}
        </div>
        <div className="rounded-lg bg-primary-50 p-2.5 text-primary-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function Table({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            {headers.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left font-medium text-slate-600"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  layerClassName = "z-50",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** z-index da camada (ex.: z-[60] sobre outro modal). */
  layerClassName?: string;
}) {
  if (!open) return null;
  const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-6xl" };
  return (
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center p-4",
        layerClassName
      )}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={cn(
          "relative w-full rounded-xl bg-white shadow-xl",
          sizes[size]
        )}
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
