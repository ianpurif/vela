import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function AdminPageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 border-b border-olive/15 pb-7 sm:flex-row sm:items-end">
      <div>
        <p className="eyebrow mb-3 text-olive/80">{eyebrow}</p>
        <h1 className="mb-3 font-sans text-[28px] font-medium leading-tight tracking-[-.04em] sm:text-[34px]">
          {title}
        </h1>
        <p className="mb-0 max-w-xl text-xs leading-6 text-olive/80">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function ProductStatus({ status }: { status: "draft" | "published" | "archived" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-medium capitalize",
        status === "published"
          ? "bg-sage/15 text-olive"
          : status === "draft"
            ? "bg-champagne/25 text-[#775a32]"
            : "bg-olive/5 text-olive/80",
      )}
    >
      <span
        className={cn(
          "h-1 w-1 rounded-full",
          status === "published" ? "bg-sage" : status === "draft" ? "bg-[#a78451]" : "bg-olive/35",
        )}
      />
      {status}
    </span>
  );
}

export function AdminMessage({ message, error = false }: { message: string; error?: boolean }) {
  if (!message) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={cn(
        "border-l-2 p-4 text-xs leading-6",
        error
          ? "border-[#8c4b32] bg-[#8c4b32]/5 text-[#74412e]"
          : "border-sage bg-sage/10 text-olive",
      )}
    >
      {message}
    </p>
  );
}
