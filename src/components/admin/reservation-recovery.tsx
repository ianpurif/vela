"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminMessage } from "@/components/admin/admin-ui";
import { adminError, adminRequest } from "@/components/admin/client";

type RecoveryResult = {
  inspected: number;
  released: number;
  awaitingWebhook: number;
  errors: number;
};
export function ReservationRecovery() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RecoveryResult | null>(null);
  async function recover() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await adminRequest<RecoveryResult>("/api/admin/reservations", "POST", {}));
      router.refresh();
    } catch (failure) {
      setError(adminError(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="border border-olive/10 bg-ivory p-6">
      <h2 className="mb-3 font-sans text-sm font-medium tracking-normal">Checkout recovery</h2>
      <p className="mb-5 text-[11px] leading-6 text-olive/65">
        Check overdue reservations against Stripe before releasing stock. Pending confirmations
        remain protected.
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={recover}
        className="w-full px-3 text-[9px]"
      >
        <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
        {busy ? "Checking reservations…" : "Reconcile expired checkouts"}
      </Button>
      <div className="mt-4">
        <AdminMessage message={error} error />
        {result && (
          <AdminMessage
            error={result.errors > 0}
            message={`${result.inspected} checked · ${result.released} expired reservations released · ${result.awaitingWebhook} awaiting confirmation · ${result.errors} need review.`}
          />
        )}
      </div>
    </section>
  );
}
