import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { getSession } from "@/server/auth";
import { getAdminCatalog } from "@/server/services/admin";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { ProductForm } from "@/components/admin/product-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Edit product" };
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())?.admin) return null;
  const [{ id }, { products, categories }] = await Promise.all([params, getAdminCatalog()]);
  const product = products.find((candidate) => candidate.id === id);
  if (!product) notFound();
  return (
    <>
      <AdminPageHeading
        eyebrow="Catalog / Product details"
        title={product.name}
        description="Refine the details customers see. Save changes to update this essential."
        action={
          product.status === "published" ? (
            <Button asChild variant="outline">
              <Link href={`/products/${product.slug}`}>
                View in store
                <ArrowUpRight size={14} />
              </Link>
            </Button>
          ) : undefined
        }
      />
      <ProductForm product={product} categories={categories} />
    </>
  );
}
