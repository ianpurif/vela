"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminMessage } from "@/components/admin/admin-ui";
import { ProductMedia } from "@/components/admin/product-media";
import { adminError, adminRequest } from "@/components/admin/client";
import { productInputSchema } from "@/lib/validation/commerce";
import type { Category, Product } from "@/types/commerce";

const productFormSchema = productInputSchema
  .extend({
    price: z
      .string()
      .trim()
      .regex(/^\d{1,5}(?:\.\d{1,2})?$/, "Enter a dollar amount with up to two decimal places."),
    ingredients: z.string().trim().min(1, "Add at least one ingredient."),
    benefits: z.string().trim().min(1, "Add at least one cosmetic benefit."),
  })
  .transform((values) => {
    const [whole, fraction = ""] = values.price.split(".");
    return {
      ...values,
      price: Number(whole) * 100 + Number(fraction.padEnd(2, "0")),
      ingredients: values.ingredients
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      benefits: values.benefits
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    };
  })
  .pipe(productInputSchema);
type ProductFormInput = z.input<typeof productFormSchema>;
type ProductInput = z.infer<typeof productInputSchema>;

/** Derive the editable fields from the shared schema; privileged metadata is excluded. */
export function editableProduct(product: Product): ProductInput {
  return productInputSchema.parse(
    Object.fromEntries(
      Object.keys(productInputSchema.shape).map((key) => [key, product[key as keyof Product]]),
    ),
  );
}

type TextFieldName =
  | "name"
  | "slug"
  | "subtitle"
  | "description"
  | "price"
  | "size"
  | "ingredients"
  | "benefits"
  | "usage";
function Field({
  name,
  label,
  register,
  errors,
  multiline = false,
  hint,
  readOnly = false,
  placeholder,
}: {
  name: TextFieldName;
  label: string;
  register: UseFormRegister<ProductFormInput>;
  errors: FieldErrors<ProductFormInput>;
  multiline?: boolean;
  hint?: string;
  readOnly?: boolean;
  placeholder?: string;
}) {
  const error = errors[name];
  const common = {
    id: `product-${name}`,
    className: "field text-xs",
    readOnly,
    placeholder,
    "aria-invalid": !!error,
    "aria-describedby": error ? `product-${name}-error` : hint ? `product-${name}-hint` : undefined,
    ...register(name),
  };
  return (
    <div>
      <label htmlFor={`product-${name}`} className="label">
        {label}
      </label>
      {multiline ? (
        <textarea rows={name === "description" ? 5 : 4} {...common} />
      ) : (
        <input type="text" inputMode={name === "price" ? "decimal" : undefined} {...common} />
      )}
      {error && (
        <p
          id={`product-${name}-error`}
          role="alert"
          className="mt-2 mb-0 text-[11px] leading-5 text-[#8c4b32]"
        >
          {typeof error.message === "string"
            ? error.message
            : `Please check ${label.toLowerCase()}.`}
        </p>
      )}
      {hint && !error && (
        <p id={`product-${name}-hint`} className="mt-2 mb-0 text-[10px] leading-5 text-olive/55">
          {hint}
        </p>
      )}
    </div>
  );
}

export function ProductForm({
  product,
  categories,
}: {
  product?: Product;
  categories: Category[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const initial: ProductFormInput = product
    ? {
        ...editableProduct(product),
        price: (product.price / 100).toFixed(2),
        ingredients: product.ingredients.join("\n"),
        benefits: product.benefits.join("\n"),
      }
    : {
        slug: "",
        name: "",
        category: categories[0]?.id || "",
        subtitle: "",
        description: "",
        price: "",
        size: "",
        ingredients: "",
        benefits: "",
        usage: "",
        skinTypes: [],
        concerns: [],
        fragranceFree: false,
        status: "draft",
        featured: false,
        rank: 0,
      };
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProductFormInput, undefined, ProductInput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initial,
  });
  async function submit(values: ProductInput) {
    setError("");
    setSaved(false);
    try {
      const result = await adminRequest<{ product: Product }>(
        "/api/admin/products",
        product ? "PATCH" : "POST",
        product ? { id: product.id, product: values } : values,
      );
      if (!product) {
        router.replace(`/admin/products/${result.product.id}`);
        router.refresh();
        return;
      }
      reset({
        ...values,
        price: (values.price / 100).toFixed(2),
        ingredients: values.ingredients.join("\n"),
        benefits: values.benefits.join("\n"),
      });
      setSaved(true);
      router.refresh();
    } catch (failure) {
      setError(adminError(failure));
    }
  }
  return (
    <form
      onSubmit={handleSubmit(submit)}
      noValidate
      aria-label={product ? "Edit product" : "Create product"}
    >
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <section className="space-y-5 border border-olive/10 bg-ivory p-5 sm:p-7">
            <h2 className="mb-6 font-sans text-sm font-medium tracking-normal">
              The essential details
            </h2>
            <Field name="name" label="Product name" register={register} errors={errors} />
            <div>
              <Field
                name="slug"
                label="Product handle"
                register={register}
                errors={errors}
                readOnly={!!product}
                hint={
                  product
                    ? "This product’s web address is permanent."
                    : "Used in the web address. Lowercase words separated with hyphens."
                }
                placeholder="your-product-name"
              />
              {!product && (
                <button
                  type="button"
                  onClick={() =>
                    setValue(
                      "slug",
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
                  Generate from product name
                </button>
              )}
            </div>
            <Field
              name="subtitle"
              label="Short description"
              register={register}
              errors={errors}
              hint="One concise line for product cards."
            />
            <Field
              name="description"
              label="Product story"
              register={register}
              errors={errors}
              multiline
              hint="Describe the formula and experience accurately, using cosmetic language."
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                name="price"
                label="Price (USD)"
                register={register}
                errors={errors}
                placeholder="48.00"
              />
              <Field
                name="size"
                label="Size"
                register={register}
                errors={errors}
                placeholder="30 mL / 1.0 fl oz"
              />
            </div>
          </section>
          <section className="space-y-5 border border-olive/10 bg-ivory p-5 sm:p-7">
            <h2 className="mb-6 font-sans text-sm font-medium tracking-normal">Formula & ritual</h2>
            <Field
              name="ingredients"
              label="Ingredients"
              register={register}
              errors={errors}
              multiline
              hint="One ingredient per line, in formula order. Up to 60 ingredients."
            />
            <Field
              name="benefits"
              label="Cosmetic benefits"
              register={register}
              errors={errors}
              multiline
              hint="One benefit per line, up to eight. Avoid medical claims and unsupported certifications."
            />
            <Field name="usage" label="How to use" register={register} errors={errors} multiline />
            <label className="flex items-start gap-3 text-xs leading-6">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-olive"
                {...register("fragranceFree")}
              />
              <span>Formulated without added fragrance</span>
            </label>
          </section>
          <section className="space-y-6 border border-olive/10 bg-ivory p-5 sm:p-7">
            <h2 className="mb-0 font-sans text-sm font-medium tracking-normal">Routine matching</h2>
            <fieldset>
              <legend className="mb-3 text-xs font-semibold">Suited skin types</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {["dry", "oily", "combination", "balanced"].map((type) => (
                  <label key={type} className="flex items-center gap-2.5 text-xs capitalize">
                    <input
                      type="checkbox"
                      value={type}
                      className="h-4 w-4 accent-olive"
                      {...register("skinTypes")}
                    />
                    {type}
                  </label>
                ))}
              </div>
              {errors.skinTypes && (
                <p role="alert" className="mt-3 mb-0 text-[11px] text-[#8c4b32]">
                  Select at least one skin type.
                </p>
              )}
            </fieldset>
            <fieldset>
              <legend className="mb-3 text-xs font-semibold">Skin concerns</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { value: "dryness", label: "Dryness" },
                  { value: "dullness", label: "Dullness" },
                  { value: "texture", label: "Texture" },
                  { value: "comfort", label: "Comfort" },
                ].map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-2.5 text-xs">
                    <input
                      type="checkbox"
                      value={value}
                      className="h-4 w-4 accent-olive"
                      {...register("concerns")}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {errors.concerns && (
                <p role="alert" className="mt-3 mb-0 text-[11px] text-[#8c4b32]">
                  Select at least one skin concern.
                </p>
              )}
            </fieldset>
          </section>
        </div>
        <aside className="min-w-0 space-y-6">
          <section className="space-y-5 border border-olive/10 bg-ivory p-6">
            <h2 className="mb-6 font-sans text-sm font-medium tracking-normal">Publication</h2>
            <div>
              <label htmlFor="product-status" className="label">
                Status
              </label>
              <select id="product-status" className="field text-xs" {...register("status")}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
              <p className="mt-2 mb-0 text-[10px] leading-5 text-olive/55">
                Only published products appear in the store. Archived products remain in order
                records.
              </p>
            </div>
            <div>
              <label htmlFor="product-category" className="label">
                Category
              </label>
              <select
                id="product-category"
                className="field text-xs"
                aria-invalid={!!errors.category}
                {...register("category")}
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p role="alert" className="mt-2 mb-0 text-[11px] text-[#8c4b32]">
                  Select a category.
                </p>
              )}
              <Link
                href="/admin/categories"
                className="mt-2 inline-block py-1 text-[10px] underline underline-offset-4"
              >
                Manage categories
              </Link>
            </div>
            <div>
              <label htmlFor="product-rank" className="label">
                Display order
              </label>
              <input
                id="product-rank"
                type="number"
                min={0}
                max={999}
                step={1}
                className="field text-xs"
                {...register("rank", { valueAsNumber: true })}
              />
              <p className="mt-2 mb-0 text-[10px] text-olive/55">
                Lower numbers appear first within the edit.
              </p>
              {errors.rank && (
                <p role="alert" className="mt-2 mb-0 text-[11px] text-[#8c4b32]">
                  Use a whole number from 0 to 999.
                </p>
              )}
            </div>
            <label className="flex items-center gap-3 text-xs">
              <input type="checkbox" className="h-4 w-4 accent-olive" {...register("featured")} />
              Feature in the VELA edit
            </label>
          </section>
          <section className="border border-olive/10 bg-ivory p-6">
            <h2 className="mb-4 font-sans text-sm font-medium tracking-normal">Inventory</h2>
            {product ? (
              <>
                <dl className="mb-4 grid grid-cols-2 gap-y-3 text-xs">
                  <dt className="text-olive/60">On hand</dt>
                  <dd className="m-0 text-right tabular-nums">{product.stock}</dd>
                  <dt className="text-olive/60">Reserved</dt>
                  <dd className="m-0 text-right tabular-nums">{product.reserved}</dd>
                  <dt className="text-olive/60">Available</dt>
                  <dd className="m-0 text-right tabular-nums">
                    {product.stock - product.reserved}
                  </dd>
                </dl>
                <Link href="/admin/inventory" className="text-[10px] underline underline-offset-4">
                  Adjust inventory
                </Link>
              </>
            ) : (
              <p className="mb-0 text-xs leading-6 text-olive/65">
                New products start with zero stock. Add inventory after creating this product.
              </p>
            )}
          </section>
          {product && <ProductMedia product={product} />}
        </aside>
      </div>
      <div className="sticky bottom-0 z-20 mt-7 border-t border-olive/20 bg-[#f4f1eb]/95 px-1 py-5 backdrop-blur-sm">
        <AdminMessage message={error} error />
        <AdminMessage
          message={
            saved && !isDirty
              ? "Product saved. Published changes are available in the storefront."
              : ""
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-2 text-xs text-olive/65"
          >
            <ArrowLeft size={13} />
            Back to products
          </Link>
          <div className="flex items-center gap-4">
            {isDirty && (
              <span className="hidden text-[10px] text-olive/55 sm:inline">Unsaved changes</span>
            )}
            <Button type="submit" disabled={isSubmitting || (!!product && !isDirty)}>
              <Save size={14} />
              {isSubmitting ? "Saving…" : product ? "Save product" : "Create product"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
