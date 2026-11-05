"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { adminError, adminRequest } from "@/components/admin/client";
import { AdminMessage } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import type { ContactMessage, ContactStatus } from "@/types/support";

export function SupportStatus({ message }: { message: ContactMessage }) {
  const router = useRouter();
  const [status, setStatus] = useState<ContactStatus>(message.status);
  const [savedStatus, setSavedStatus] = useState(message.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await adminRequest<{ message: ContactMessage }>(
        "/api/admin/support",
        "PATCH",
        { id: message.id, status },
      );
      setStatus(result.message.status);
      setSavedStatus(result.message.status);
      setNotice("Message status saved.");
      router.refresh();
    } catch (failure) {
      setError(adminError(failure));
    } finally {
      setSaving(false);
    }
  }
  return (
    <form
      onSubmit={save}
      aria-label="Update support message"
      className="space-y-5 border border-olive/15 bg-ivory p-6"
    >
      <h2 className="mb-0 font-sans text-sm font-semibold tracking-normal">Review status</h2>
      <p className="mb-0 text-xs leading-6 text-olive/80">
        Organize the inbox as you review each note. Status changes are audited and do not send an
        email.
      </p>
      <div>
        <label htmlFor="support-status" className="label">
          Message status
        </label>
        <select
          id="support-status"
          className="field text-xs"
          disabled={saving}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as ContactStatus);
            setNotice("");
          }}
        >
          <option value="new">New</option>
          <option value="reviewing">Reviewing</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <AdminMessage message={error} error />
      <AdminMessage message={notice} />
      <Button type="submit" disabled={saving || status === savedStatus} className="w-full">
        <Save size={14} />
        {saving ? "Saving status…" : "Save status"}
      </Button>
    </form>
  );
}
