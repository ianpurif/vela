import type { Metadata } from "next";
import { RoutineQuiz } from "@/components/routine/routine-quiz";
import { getCatalogRepository } from "@/server/repositories/catalog";

export const metadata: Metadata = {
  title: "Find your ritual",
  description:
    "Five thoughtful questions. Discover a considered skincare routine from VELA’s current collection, with a reason for every step.",
};
export const dynamic = "force-dynamic";
export default async function RoutinePage() {
  const products = await getCatalogRepository().list();
  return (
    <main id="main">
      <RoutineQuiz products={products} />
    </main>
  );
}
