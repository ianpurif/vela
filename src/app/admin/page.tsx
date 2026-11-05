import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  FolderTree,
  Package,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { getSession } from "@/server/auth";
import { getAdminCatalog } from "@/server/services/admin";
import { AdminPageHeading, ProductStatus } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };
export default async function AdminOverviewPage() {
  if (!(await getSession())?.admin) return null;
  const { products, categories } = await getAdminCatalog();
  const published = products.filter((product) => product.status === "published");
  const lowStock = published.filter((product) => product.stock - product.reserved <= 5);
  const metrics = [
    {
      label: "Published products",
      value: published.length,
      detail: `${products.length} total in catalog`,
      icon: Package,
    },
    {
      label: "Available stock",
      value: published.reduce(
        (sum, product) => sum + Math.max(0, product.stock - product.reserved),
        0,
      ),
      detail: "Units available to customers",
      icon: Boxes,
    },
    {
      label: "Low-stock alerts",
      value: lowStock.length,
      detail: "Published products with 5 or fewer",
      icon: TriangleAlert,
    },
    {
      label: "Categories",
      value: categories.length,
      detail: "Collections for product discovery",
      icon: FolderTree,
    },
  ];
  return (
    <>
      <AdminPageHeading
        eyebrow="The daily overview"
        title="A clear view of your store."
        description="Manage the essentials, keep stock in balance, and make every detail count."
        action={
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus size={15} />
              New product
            </Link>
          </Button>
        }
      />
      <div className="mb-8 grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-5">
        {metrics.map(({ label, value, detail, icon: Icon }) => (
          <div key={label} className="border border-olive/10 bg-ivory p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-2">
              <p className="mb-0 text-[10px] font-medium text-olive/70">{label}</p>
              <Icon size={16} strokeWidth={1.3} className="shrink-0 text-sage" />
            </div>
            <p className="mb-2 font-display text-5xl leading-none">{value}</p>
            <p className="mb-0 text-[9px] leading-5 text-olive/55">{detail}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <section className="min-w-0 border border-olive/10 bg-ivory">
          <div className="flex items-center justify-between gap-4 border-b border-olive/10 px-5 py-5">
            <h2 className="mb-0 font-sans text-sm font-medium tracking-normal">The product edit</h2>
            <Link
              href="/admin/products"
              className="inline-flex items-center gap-2 text-[10px] text-olive/65"
            >
              View all
              <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="relative overflow-x-auto" role="region" aria-label="Catalog overview" tabIndex={0}>
            <table className="w-full min-w-[520px] border-collapse text-left text-xs">
              <thead className="border-b border-olive/10 text-[9px] tracking-wider text-olive/50 uppercase">
                <tr>
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                  <th className="px-5 py-3 text-right font-medium">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-olive/10">
                {products.slice(0, 8).map((product) => (
                  <tr key={product.id} className="hover:bg-sand/15">
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="font-medium hover:underline"
                      >
                        {product.name}
                      </Link>
                      <p className="mt-1 mb-0 text-[9px] text-olive/55">{product.size}</p>
                    </td>
                    <td className="px-4 py-4">
                      <ProductStatus status={product.status} />
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums">{money(product.price)}</td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {product.stock - product.reserved}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {products.length === 0 && (
              <p className="mb-0 p-8 text-center text-xs text-olive/60">
                Your catalog is empty. Create your first product to begin.
              </p>
            )}
          </div>
        </section>
        <aside className="space-y-5">
          <section className="border border-olive/10 bg-ivory p-6">
            <div className="mb-4 flex items-center gap-2">
              <TriangleAlert size={16} strokeWidth={1.4} className="text-sage" />
              <h2 className="mb-0 font-sans text-sm font-medium tracking-normal">Stock to watch</h2>
            </div>
            {lowStock.length ? (
              <ul className="m-0 list-none divide-y divide-olive/10 p-0">
                {lowStock.slice(0, 5).map((product) => (
                  <li
                    key={product.id}
                    className="flex items-center justify-between gap-3 py-3 text-[11px]"
                  >
                    <span>{product.name}</span>
                    <span className="font-semibold tabular-nums text-[#8c4b32]">
                      {product.stock - product.reserved}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-0 text-xs leading-6 text-olive/65">
                All published essentials have more than five units available.
              </p>
            )}
            <Link
              href="/admin/inventory"
              className="mt-5 inline-flex items-center gap-2 text-[10px] underline underline-offset-4"
            >
              Manage inventory
              <ArrowRight size={12} />
            </Link>
          </section>
          <section className="bg-olive p-6 text-ivory">
            <p className="eyebrow mb-4 text-ivory/55">The customer perspective</p>
            <h2 className="mb-4 text-4xl">See it in the store.</h2>
            <p className="mb-5 text-xs leading-6 text-ivory/70">
              Published products and stock changes appear in the same collection your customers
              browse.
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 text-[10px] tracking-wider underline underline-offset-4 uppercase"
            >
              Open the collection
              <ArrowUpRight size={13} />
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
