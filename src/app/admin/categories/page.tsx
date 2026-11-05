import type { Metadata } from "next";
import { getSession } from "@/server/auth";
import { getAdminCatalog } from "@/server/services/admin";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { CategoryManager } from "@/components/admin/category-manager";

export const metadata: Metadata = { title: "Categories" };
export default async function CategoriesPage() {
  if (!(await getSession())?.admin) return null;
  const catalog = await getAdminCatalog();
  return (
    <>
      <AdminPageHeading
        eyebrow="Catalog organization"
        title="A considered collection."
        description="Give every essential a place. Category names and display order appear in the storefront filters."
      />
      <CategoryManager {...catalog} />
    </>
  );
}
