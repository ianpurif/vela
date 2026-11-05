import type { Metadata } from "next";
import { getSession } from "@/server/auth";
import { getAdminCatalog, getInventoryHistory } from "@/server/services/admin";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { InventoryManager } from "@/components/admin/inventory-manager";

export const metadata: Metadata = { title: "Inventory" };
export default async function InventoryPage() {
  if (!(await getSession())?.admin) return null;
  const [{ products }, history] = await Promise.all([getAdminCatalog(), getInventoryHistory()]);
  return (
    <>
      <AdminPageHeading
        eyebrow="Stock & availability"
        title="Every essential, accounted for."
        description="Available stock is on-hand stock less active reservations. Every adjustment keeps a reason in its history."
      />
      <InventoryManager products={products} history={history} />
    </>
  );
}
