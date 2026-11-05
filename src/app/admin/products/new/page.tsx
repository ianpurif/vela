import type { Metadata } from "next";
import { getSession } from "@/server/auth";
import { getAdminCatalog } from "@/server/services/admin";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { ProductForm } from "@/components/admin/product-form";

export const metadata: Metadata = { title: "New product" };
export default async function NewProductPage() {
  if (!(await getSession())?.admin) return null;
  const { categories } = await getAdminCatalog();
  return (
    <>
      <AdminPageHeading
        eyebrow="Catalog / New essential"
        title="Make room for something good."
        description="Add the product story, formula, price and matching preferences. New products begin as drafts."
      />
      <ProductForm categories={categories} />
    </>
  );
}
