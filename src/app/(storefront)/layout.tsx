import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getCatalogRepository } from "@/server/repositories/catalog";
export const dynamic = "force-dynamic";
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const repo = getCatalogRepository();
  const [products, content] = await Promise.all([repo.list(), repo.content()]);
  return (
    <>
      <Header products={products} announcement={content.announcement} />
      {children}
      <Footer />
    </>
  );
}
