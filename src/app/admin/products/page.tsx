import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getSession } from "@/server/auth";
import { getAdminCatalog } from "@/server/services/admin";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { ProductTable } from "@/components/admin/product-table";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Products" };
export default async function AdminProductsPage() {
  if (!(await getSession())?.admin) return null;
  const catalog = await getAdminCatalog();
  return (
    <>
      <AdminPageHeading
        eyebrow="Catalog"
        title="Your everyday essentials."
        description="Create, refine, publish and archive the products in your VELA collection."
        action={
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus size={15} />
              New product
            </Link>
          </Button>
        }
      />
      <ProductTable {...catalog} />
    </>
  );
}
