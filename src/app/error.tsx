"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="wrap py-32 text-center">
      <p className="eyebrow">A brief pause</p>
      <h1 className="section-title my-6">Something needs a moment.</h1>
      <p className="mb-8">We couldn’t load this page. Please try again.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
