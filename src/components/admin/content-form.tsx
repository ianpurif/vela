"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type UseFormRegister, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, Save } from "lucide-react";
import { contentInputSchema, type HomeContentInput } from "@/lib/validation/operations";
import { AdminMessage } from "@/components/admin/admin-ui";
import { adminError, adminRequest } from "@/components/admin/client";
import { operationDate } from "@/components/admin/operations-ui";
import { Button } from "@/components/ui/button";
import type { Category, SiteContent } from "@/types/commerce";

function editableContent(content: SiteContent): HomeContentInput {
  return contentInputSchema.parse(
    Object.fromEntries(
      Object.keys(contentInputSchema.shape).map((key) => [key, content[key as keyof SiteContent]]),
    ),
  );
}
function ContentField({
  name,
  label,
  maxLength,
  multiline = false,
  register,
  errors,
}: {
  name: Exclude<keyof HomeContentInput, "featuredCategory">;
  label: string;
  maxLength: number;
  multiline?: boolean;
  register: UseFormRegister<HomeContentInput>;
  errors: FieldErrors<HomeContentInput>;
}) {
  const error = errors[name];
  const props = {
    id: `content-${name}`,
    className: "field text-xs",
    maxLength,
    "aria-invalid": !!error,
    "aria-describedby": error ? `content-${name}-error` : undefined,
    ...register(name),
  };
  return (
    <div>
      <label htmlFor={`content-${name}`} className="label">
        {label}
      </label>
      {multiline ? <textarea rows={4} {...props} /> : <input type="text" {...props} />}
      {error && (
        <p
          id={`content-${name}-error`}
          role="alert"
          className="mt-2 mb-0 text-[11px] leading-5 text-[#8c4b32]"
        >
          {error.message}
        </p>
      )}
    </div>
  );
}
export function ContentForm({
  content,
  categories,
}: {
  content: SiteContent;
  categories: Category[];
}) {
  const router = useRouter();
  const [savedAt, setSavedAt] = useState(content.updatedAt);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<HomeContentInput>({
    resolver: zodResolver(contentInputSchema),
    defaultValues: editableContent(content),
  });
  async function save(values: HomeContentInput) {
    setError("");
    setMessage("");
    try {
      const result = await adminRequest<{ content: SiteContent }>(
        "/api/admin/content",
        "PATCH",
        values,
      );
      reset(editableContent(result.content));
      setSavedAt(result.content.updatedAt);
      setMessage("Homepage content saved.");
      router.refresh();
    } catch (failure) {
      setError(adminError(failure));
    }
  }
  const field = { register, errors };
  return (
    <form
      onSubmit={handleSubmit(save)}
      noValidate
      aria-label="Homepage content"
      className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]"
    >
      <fieldset disabled={isSubmitting} className="min-w-0 space-y-6">
        <legend className="sr-only">Homepage copy and featured collection</legend>
        <section className="space-y-5 border border-olive/10 bg-ivory p-5 sm:p-7">
          <h2 className="mb-0 font-sans text-sm font-medium tracking-normal">Announcement</h2>
          <ContentField name="announcement" label="Announcement" maxLength={180} {...field} />
        </section>
        <section className="space-y-5 border border-olive/10 bg-ivory p-5 sm:p-7">
          <div>
            <h2 className="mb-2 font-sans text-sm font-medium tracking-normal">
              The first impression
            </h2>
            <p className="mb-0 text-[11px] leading-6 text-olive/80">
              The opening text over the homepage image. Keep the two title lines short for smaller
              screens.
            </p>
          </div>
          <ContentField name="heroEyebrow" label="Hero eyebrow" maxLength={120} {...field} />
          <div className="grid gap-5 sm:grid-cols-2">
            <ContentField name="heroTitle" label="Hero title" maxLength={100} {...field} />
            <ContentField name="heroItalic" label="Hero italic line" maxLength={100} {...field} />
          </div>
          <ContentField
            name="heroDescription"
            label="Hero description"
            maxLength={500}
            multiline
            {...field}
          />
        </section>
        <section className="space-y-5 border border-olive/10 bg-ivory p-5 sm:p-7">
          <h2 className="mb-0 font-sans text-sm font-medium tracking-normal">The featured edit</h2>
          <div>
            <label htmlFor="content-featuredCategory" className="label">
              Featured collection
            </label>
            <select
              id="content-featuredCategory"
              className="field text-xs"
              aria-invalid={!!errors.featuredCategory}
              aria-describedby={
                errors.featuredCategory ? "featured-category-error" : "featured-category-hint"
              }
              {...register("featuredCategory")}
            >
              <option value="">All featured products</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.featuredCategory ? (
              <p
                id="featured-category-error"
                role="alert"
                className="mt-2 text-[11px] text-[#8c4b32]"
              >
                {errors.featuredCategory.message}
              </p>
            ) : (
              <p
                id="featured-category-hint"
                className="mt-2 mb-0 text-[10px] leading-6 text-olive/80"
              >
                Show products marked featured, or up to three published products from one
                collection.
              </p>
            )}
          </div>
        </section>
        <section className="space-y-5 border border-olive/10 bg-ivory p-5 sm:p-7">
          <div>
            <h2 className="mb-2 font-sans text-sm font-medium tracking-normal">Promotion</h2>
            <p className="mb-0 text-[11px] leading-6 text-olive/80">
              Editorial copy for the homepage promotion. Prices and checkout rules are managed
              separately.
            </p>
          </div>
          <ContentField name="promotionTitle" label="Promotion title" maxLength={160} {...field} />
          <ContentField
            name="promotionText"
            label="Promotion text"
            maxLength={600}
            multiline
            {...field}
          />
        </section>
      </fieldset>
      <aside className="space-y-5 xl:sticky xl:top-[100px]">
        <section className="space-y-5 border border-olive/10 bg-ivory p-6">
          <h2 className="mb-0 font-sans text-sm font-medium tracking-normal">
            Publish your changes
          </h2>
          <p className="mb-0 text-[11px] leading-6 text-olive/80">
            Saving updates the storefront homepage. Open the storefront to review the published
            result.
          </p>
          <AdminMessage message={error} error />
          <AdminMessage message={message} />
          <Button type="submit" disabled={isSubmitting || !isDirty} className="w-full">
            <Save size={14} />
            {isSubmitting ? "Saving content…" : "Save content"}
          </Button>
          <p className="mb-0 text-[10px] leading-6 text-olive/80">
            {savedAt
              ? `Last saved ${operationDate(savedAt)} UTC`
              : "Showing the initial homepage content."}
          </p>
          <Link
            href="/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-[10px] underline underline-offset-4"
          >
            View storefront
            <ArrowUpRight size={12} />
            <span className="sr-only"> in a new tab</span>
          </Link>
        </section>
      </aside>
    </form>
  );
}
