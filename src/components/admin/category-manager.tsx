"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminMessage } from "@/components/admin/admin-ui";
import { adminError, adminRequest } from "@/components/admin/client";
import { categorySchema } from "@/lib/validation/commerce";
import type { Category, Product } from "@/types/commerce";

type CategoryInput = z.infer<typeof categorySchema>;
const emptyCategory: CategoryInput = { id: "", name: "", description: "", rank: 0 };

export function CategoryManager({
  categories,
  products,
}: {
  categories: Category[];
  products: Product[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: emptyCategory,
  });
  const counts = new Map(
    categories.map((category) => [
      category.id,
      products.filter(
        (product) => product.category === category.id && product.status !== "archived",
      ).length,
    ]),
  );
  function choose(category: Category | null) {
    setEditing(category?.id ?? null);
    reset(category || emptyCategory);
    setError("");
    setMessage("");
  }
  async function submit(values: CategoryInput) {
    setError("");
    setMessage("");
    try {
      const result = await adminRequest<{ category: Category }>(
        "/api/admin/categories",
        editing ? "PATCH" : "POST",
        values,
      );
      setEditing(result.category.id);
      reset(result.category);
      setMessage(`${result.category.name} saved.`);
      router.refresh();
    } catch (failure) {
      setError(adminError(failure));
    }
  }
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_390px]">
      <section className="min-w-0 border border-olive/10 bg-ivory">
        <div className="flex items-center justify-between gap-4 border-b border-olive/10 p-5">
          <h2 className="mb-0 font-sans text-sm font-medium tracking-normal">Product categories</h2>
          <span className="text-[10px] text-olive/55">{categories.length} categories</span>
        </div>
        <div className="relative overflow-x-auto" role="region" aria-label="Product categories" tabIndex={0}>
          <table className="w-full min-w-[450px] border-collapse text-left text-xs">
            <thead className="border-b border-olive/10 bg-sand/15 text-[9px] tracking-wider text-olive/55 uppercase">
              <tr>
                <th className="px-5 py-3.5 font-medium">Category</th>
                <th className="px-4 py-3.5 text-right font-medium">Products</th>
                <th className="px-4 py-3.5 text-right font-medium">Order</th>
                <th className="px-5 py-3.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-olive/10">
              {[...categories]
                .sort((a, b) => a.rank - b.rank)
                .map((category) => (
                  <tr
                    key={category.id}
                    className={editing === category.id ? "bg-sage/10" : "hover:bg-sand/15"}
                  >
                    <td className="px-5 py-5">
                      <p className="mb-1 font-medium">{category.name}</p>
                      <p className="mb-0 max-w-xs text-[10px] leading-5 text-olive/55">
                        {category.description || category.id}
                      </p>
                    </td>
                    <td className="px-4 py-5 text-right tabular-nums">
                      {counts.get(category.id) || 0}
                    </td>
                    <td className="px-4 py-5 text-right tabular-nums text-olive/60">
                      {category.rank}
                    </td>
                    <td className="px-5 py-5 text-right">
                      <button
                        type="button"
                        onClick={() => choose(category)}
                        aria-label={`Edit ${category.name} category`}
                        className="text-[10px] underline underline-offset-4"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {categories.length === 0 && (
            <p className="mb-0 px-5 py-12 text-center text-xs text-olive/60">
              Create a category to start organizing your collection.
            </p>
          )}
        </div>
      </section>
      <section className="border border-olive/10 bg-ivory p-5 sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="mb-0 font-sans text-sm font-medium tracking-normal">
            {editing ? "Edit category" : "Create category"}
          </h2>
          {editing && (
            <button
              type="button"
              onClick={() => choose(null)}
              className="inline-flex items-center gap-1.5 text-[10px] underline underline-offset-4"
            >
              <Plus size={12} />
              New category
            </button>
          )}
        </div>
        <form
          onSubmit={handleSubmit(submit)}
          noValidate
          className="space-y-5"
          aria-label={editing ? "Edit category" : "Create category"}
        >
          <div>
            <label htmlFor="category-name" className="label">
              Category name
            </label>
            <input
              id="category-name"
              maxLength={60}
              className="field text-xs"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            {errors.name && (
              <p role="alert" className="mt-2 mb-0 text-xs text-[#8c4b32]">
                Enter a name between 2 and 60 characters.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="category-id" className="label">
              Category handle
            </label>
            <input
              id="category-id"
              readOnly={!!editing}
              maxLength={90}
              className="field text-xs"
              aria-invalid={!!errors.id}
              placeholder="face-oils"
              {...register("id")}
            />
            {errors.id && (
              <p role="alert" className="mt-2 mb-0 text-xs text-[#8c4b32]">
                Use lowercase words separated by hyphens.
              </p>
            )}
            {!editing && (
              <button
                type="button"
                onClick={() =>
                  setValue(
                    "id",
                    getValues("name")
                      .toLowerCase()
                      .normalize("NFKD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "")
                      .slice(0, 90),
                    { shouldDirty: true, shouldValidate: true },
                  )
                }
                className="mt-2 py-1 text-[10px] underline underline-offset-4"
              >
                Generate from category name
              </button>
            )}
            {editing && (
              <p className="mt-2 mb-0 text-[10px] leading-5 text-olive/55">
                The handle stays fixed so existing product links keep working.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="category-description" className="label">
              Description
            </label>
            <textarea
              id="category-description"
              rows={3}
              maxLength={300}
              className="field text-xs"
              {...register("description")}
            />
            {errors.description && (
              <p role="alert" className="mt-2 mb-0 text-xs text-[#8c4b32]">
                Keep the description within 300 characters.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="category-rank" className="label">
              Display order
            </label>
            <input
              id="category-rank"
              type="number"
              min={0}
              max={99}
              step={1}
              className="field text-xs"
              {...register("rank", { valueAsNumber: true })}
            />
            <p className="mt-2 mb-0 text-[10px] text-olive/55">Lower numbers appear first.</p>
            {errors.rank && (
              <p role="alert" className="mt-2 mb-0 text-xs text-[#8c4b32]">
                Use a whole number from 0 to 99.
              </p>
            )}
          </div>
          <AdminMessage message={error} error />
          <AdminMessage message={message} />
          <Button
            type="submit"
            disabled={isSubmitting || (!!editing && !isDirty)}
            className="w-full"
          >
            <Save size={14} />
            {isSubmitting ? "Saving…" : editing ? "Save category" : "Create category"}
          </Button>
        </form>
      </section>
    </div>
  );
}
