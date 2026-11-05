"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Search, Star } from "lucide-react";
import { ProductStatus } from "@/components/admin/admin-ui";
import { money } from "@/lib/utils";
import type { Category, Product } from "@/types/commerce";

export function ProductTable({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const filtered = products.filter(
    (product) =>
      (!status || product.status === status) &&
      `${product.name} ${product.slug} ${categoryNames.get(product.category) || product.category}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <section className="min-w-0 border border-olive/10 bg-ivory">
      <div className="flex flex-col justify-between gap-3 border-b border-olive/10 p-5 sm:flex-row">
        <div className="relative sm:w-80">
          <label htmlFor="admin-product-search" className="sr-only">
            Search products
          </label>
          <Search size={15} className="absolute left-3 top-3.5 text-olive/50" />
          <input
            id="admin-product-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products or categories"
            className="field py-3 pl-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-olive/55" aria-live="polite">
            {filtered.length} products
          </span>
          <label htmlFor="admin-product-status" className="sr-only">
            Publication status
          </label>
          <select
            id="admin-product-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="field w-auto py-3 text-xs"
          >
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>
      <div className="relative overflow-x-auto" role="region" aria-label="Products" tabIndex={0}>
        <table className="w-full min-w-[710px] border-collapse text-left text-xs">
          <thead className="border-b border-olive/10 bg-sand/15 text-[9px] tracking-wider text-olive/55 uppercase">
            <tr>
              <th className="px-5 py-3.5 font-medium">Product</th>
              <th className="px-4 py-3.5 font-medium">Category</th>
              <th className="px-4 py-3.5 font-medium">Status</th>
              <th className="px-4 py-3.5 text-right font-medium">Price</th>
              <th className="px-4 py-3.5 text-right font-medium">Available</th>
              <th className="px-5 py-3.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-olive/10">
            {filtered.map((product) => (
              <tr key={product.id} className="hover:bg-sand/15">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="relative h-14 w-11 shrink-0 overflow-hidden bg-sand/50">
                      {product.images[0] ? (
                        <Image
                          src={product.images[0].src}
                          alt=""
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center font-display text-xl text-olive/35">
                          V
                        </span>
                      )}
                    </div>
                    <div>
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="font-medium hover:underline"
                      >
                        {product.name}
                      </Link>
                      <p className="mt-1.5 mb-0 text-[9px] text-olive/55">
                        {product.size}
                        {product.featured && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[#8d704b]">
                            <Star size={9} />
                            Featured
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-olive/65">
                  {categoryNames.get(product.category) || product.category}
                </td>
                <td className="px-4 py-4">
                  <ProductStatus status={product.status} />
                </td>
                <td className="px-4 py-4 text-right tabular-nums">{money(product.price)}</td>
                <td className="px-4 py-4 text-right tabular-nums">
                  {product.stock - product.reserved}
                </td>
                <td className="sticky right-0 bg-ivory px-2 py-4 text-right sm:static sm:px-5">
                  <Link
                    href={`/admin/products/${product.id}`}
                    aria-label={`Edit ${product.name}`}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center text-[10px] underline underline-offset-4"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="mb-2 text-sm">No products match.</p>
            <p className="mb-0 text-xs text-olive/60">
              Change the search or status filter to see more.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
