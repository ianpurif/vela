"use client";

import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight } from "lucide-react";
import { contactFieldsSchema, type ContactFields } from "@/lib/validation/support";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ContactForm({ className }: { className?: string }) {
  const id = useId();
  const attempt = useRef<{ requestKey: string; payload: string } | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFields>({
    resolver: zodResolver(contactFieldsSchema),
    defaultValues: { name: "", email: "", subject: "", message: "" },
  });
  async function save(values: ContactFields) {
    setError("");
    setSaved(false);
    const payload = JSON.stringify(values);
    if (!attempt.current || attempt.current.payload !== payload) {
      attempt.current = { requestKey: crypto.randomUUID(), payload };
    }
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, requestKey: attempt.current.requestKey }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.saved !== true) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "We couldn’t confirm that your message was saved. Please retry.",
        );
      }
      setSaved(true);
      reset();
      attempt.current = null;
    } catch (failure) {
      setError(
        failure instanceof Error && failure.message !== "Failed to fetch"
          ? failure.message
          : "We couldn’t confirm that your message was saved. Retry to safely check the same message.",
      );
    }
  }
  const fields = [
    { name: "name", label: "Your name", max: 100, autoComplete: "name", type: "text" },
    { name: "email", label: "Email address", max: 254, autoComplete: "email", type: "email" },
    { name: "subject", label: "Subject", max: 160, autoComplete: "off", type: "text" },
  ] as const;
  return (
    <form
      aria-label="Contact VELA"
      noValidate
      onSubmit={(event) => void handleSubmit(save)(event)}
      className={cn("space-y-6", className)}
    >
      <fieldset disabled={isSubmitting} className="min-w-0 space-y-6">
        <legend className="sr-only">Leave a message for the VELA team</legend>
        <div className="grid gap-6 sm:grid-cols-2">
          {fields.map((field) => (
            <div
              key={field.name}
              className={field.name === "subject" ? "sm:col-span-2" : undefined}
            >
              <label htmlFor={`${id}-${field.name}`} className="label">
                {field.label}
              </label>
              <input
                id={`${id}-${field.name}`}
                type={field.type}
                autoComplete={field.autoComplete}
                maxLength={field.max}
                className="field"
                aria-invalid={!!errors[field.name]}
                aria-describedby={errors[field.name] ? `${id}-${field.name}-error` : undefined}
                {...register(field.name)}
              />
              {errors[field.name] && (
                <p
                  id={`${id}-${field.name}-error`}
                  role="alert"
                  className="mt-2 text-xs text-[#8c4b32]"
                >
                  {errors[field.name]?.message}
                </p>
              )}
            </div>
          ))}
        </div>
        <div>
          <label htmlFor={`${id}-message`} className="label">
            Message
          </label>
          <textarea
            id={`${id}-message`}
            rows={7}
            maxLength={5000}
            className="field resize-y"
            aria-invalid={!!errors.message}
            aria-describedby={errors.message ? `${id}-message-error` : undefined}
            {...register("message")}
          />
          {errors.message && (
            <p id={`${id}-message-error`} role="alert" className="mt-2 text-xs text-[#8c4b32]">
              {errors.message.message}
            </p>
          )}
        </div>
        <p className="mb-0 text-xs leading-6 text-olive/80">
          Your message is saved for review. This form does not send an email or guarantee a reply.
        </p>
        <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
          {isSubmitting ? "Saving message…" : "Save message"}
          <ArrowUpRight size={15} />
        </Button>
      </fieldset>
      {error && (
        <p
          role="alert"
          className="border-l-2 border-[#8c4b32] bg-[#8c4b32]/5 p-4 text-xs leading-6 text-[#74412e]"
        >
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="border-l-2 border-sage bg-sage/10 p-4 text-xs leading-6">
          Your message has been saved for the VELA team to review.
        </p>
      )}
    </form>
  );
}
