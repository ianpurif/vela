import type { Metadata } from "next";
import { getSession } from "@/server/auth";
import { getAdminContent } from "@/server/services/operations";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { ContentForm } from "@/components/admin/content-form";

export const metadata: Metadata = { title: "Homepage content" };
export default async function AdminContentPage() {
  if (!(await getSession())?.admin) return null;
  const { content, categories } = await getAdminContent();
  return (
    <>
      <AdminPageHeading
        eyebrow="The storefront edit"
        title="Words that feel like VELA."
        description="Shape the announcement, opening story, featured collection, and promotion your customers see on the homepage."
      />
      <ContentForm content={content} categories={categories} />
    </>
  );
}
