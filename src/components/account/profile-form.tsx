"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addressCountries } from "@/components/account/countries";
import { profileSchema } from "@/lib/validation/commerce";
import type { UserProfile } from "@/types/commerce";

type ProfileValues = z.infer<typeof profileSchema>;
type AddressKey = "name" | "line1" | "line2" | "city" | "state" | "postalCode";
const addressFields: {
  key: AddressKey;
  label: string;
  autoComplete: string;
  maxLength: number;
  wide?: boolean;
}[] = [
  { key: "name", label: "Recipient name", autoComplete: "name", maxLength: 100, wide: true },
  {
    key: "line1",
    label: "Street address",
    autoComplete: "address-line1",
    maxLength: 150,
    wide: true,
  },
  {
    key: "line2",
    label: "Apartment, suite, etc. (optional)",
    autoComplete: "address-line2",
    maxLength: 150,
    wide: true,
  },
  { key: "city", label: "City", autoComplete: "address-level2", maxLength: 80 },
  {
    key: "state",
    label: "State / province (optional)",
    autoComplete: "address-level1",
    maxLength: 80,
  },
  { key: "postalCode", label: "ZIP / postal code", autoComplete: "postal-code", maxLength: 20 },
];

function AddressFields({
  index,
  register,
  errors,
  savedCountry,
}: {
  index: number;
  register: UseFormRegister<ProfileValues>;
  errors: FieldErrors<ProfileValues>;
  savedCountry: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {addressFields.map((field) => {
        const error = errors.addresses?.[index]?.[field.key];
        const id = `address-${index}-${field.key}`;
        return (
          <div key={field.key} className={field.wide ? "sm:col-span-2" : undefined}>
            <label htmlFor={id} className="label">
              {field.label}
            </label>
            <input
              id={id}
              autoComplete={`section-address${index} shipping ${field.autoComplete}`}
              maxLength={field.maxLength}
              className="field text-xs"
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : undefined}
              {...register(`addresses.${index}.${field.key}`)}
            />
            {error && (
              <p id={`${id}-error`} role="alert" className="mt-2 mb-0 text-xs text-[#8c4b32]">
                Please check your {field.label.replace(" (optional)", "").toLowerCase()}.
              </p>
            )}
          </div>
        );
      })}
      <div>
        <label htmlFor={`address-${index}-country`} className="label">
          Country
        </label>
        <select
          id={`address-${index}-country`}
          autoComplete={`section-address${index} shipping country`}
          className="field text-xs"
          aria-invalid={!!errors.addresses?.[index]?.country}
          {...register(`addresses.${index}.country`)}
        >
          {!addressCountries.some(([code]) => code === savedCountry) && (
            <option value={savedCountry}>
              {new Intl.DisplayNames(["en"], { type: "region" }).of(savedCountry) || savedCountry}
            </option>
          )}
          {addressCountries.map(([code, country]) => (
            <option key={code} value={code}>
              {country}
            </option>
          ))}
        </select>
        {errors.addresses?.[index]?.country && (
          <p role="alert" className="mt-2 mb-0 text-xs text-[#8c4b32]">
            Please select your country.
          </p>
        )}
      </div>
    </div>
  );
}

export function ProfileForm({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: profile.name, addresses: profile.addresses },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "addresses",
    keyName: "formKey",
  });
  async function submit(values: ProfileValues) {
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(
          typeof body.error === "string"
            ? body.error
            : "Your details couldn’t be saved. Please try again.",
        );
        return;
      }
      const validated = profileSchema.safeParse({
        name: body.profile?.name,
        addresses: body.profile?.addresses,
      });
      if (!validated.success) {
        setError("We couldn’t confirm your saved details. Please reload your account.");
        return;
      }
      reset(validated.data);
      setSaved(true);
      router.refresh();
    } catch {
      setError("We couldn’t connect to save your details. Please try again.");
    }
  }
  return (
    <form
      onSubmit={handleSubmit(submit)}
      noValidate
      className="space-y-9"
      aria-label="Profile and addresses"
    >
      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="mb-0 text-4xl">Your details.</h2>
          <span className="eyebrow text-olive/80">01</span>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="profile-name" className="label">
              Your name
            </label>
            <input
              id="profile-name"
              autoComplete="name"
              maxLength={100}
              className="field"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "profile-name-error" : undefined}
              {...register("name")}
            />
            {errors.name && (
              <p id="profile-name-error" role="alert" className="mt-2 mb-0 text-xs text-[#8c4b32]">
                {errors.name.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="profile-email" className="label">
              Email address
            </label>
            <input
              id="profile-email"
              type="email"
              value={profile.email}
              readOnly
              className="field bg-olive/[.025] text-olive/80"
            />
            <p className="mt-2 mb-0 text-[10px] text-olive/80">Your sign-in email</p>
          </div>
        </div>
      </section>
      <section className="border-t border-olive/15 pt-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="mb-0 text-4xl">A place for your ritual.</h2>
          <span className="eyebrow text-olive/80">02</span>
        </div>
        <p className="mb-6 text-xs leading-6 text-olive/80">
          Keep up to five delivery addresses in your account. Availability of delivery is confirmed
          at checkout.
        </p>
        {fields.length === 0 && (
          <div className="mb-6 flex items-center gap-4 border border-dashed border-olive/25 p-6">
            <MapPin size={20} strokeWidth={1.2} className="text-sage" />
            <p className="mb-0 text-xs text-olive/80">No addresses saved yet.</p>
          </div>
        )}
        <div className="space-y-6">
          {fields.map((field, index) => (
            <fieldset key={field.formKey} className="border border-olive/20 p-5 sm:p-6">
              <legend className="px-2 text-[10px] tracking-[.12em] uppercase">
                Address {index + 1}
              </legend>
              <input type="hidden" {...register(`addresses.${index}.id`)} />
              <AddressFields
                index={index}
                register={register}
                errors={errors}
                savedCountry={field.country}
              />
              <button
                type="button"
                onClick={() => {
                  remove(index);
                  setSaved(false);
                }}
                className="mt-5 inline-flex items-center gap-2 py-2 text-[10px] text-olive/80 underline underline-offset-4"
              >
                <Trash2 size={12} />
                Remove address {index + 1}
              </button>
            </fieldset>
          ))}
        </div>
        {fields.length < 5 && (
          <Button
            type="button"
            variant="outline"
            className="mt-6"
            onClick={() => {
              append({
                id: crypto.randomUUID(),
                name: profile.name,
                line1: "",
                line2: "",
                city: "",
                state: "",
                postalCode: "",
                country: "US",
              });
              setSaved(false);
            }}
          >
            <Plus size={15} />
            Add an address
          </Button>
        )}
      </section>
      {error && (
        <p
          role="alert"
          className="border-l-2 border-[#8c4b32] bg-[#8c4b32]/5 p-4 text-xs leading-6 text-[#74412e]"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-5 border-t border-olive/15 pt-7">
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save my details"}
        </Button>
        {saved && !isDirty && (
          <p role="status" className="mb-0 inline-flex items-center gap-2 text-xs text-olive/75">
            <Check size={14} className="text-sage" />
            Your details are saved.
          </p>
        )}
        {isDirty && <p className="mb-0 text-[10px] text-olive/80">You have unsaved changes.</p>}
      </div>
    </form>
  );
}
