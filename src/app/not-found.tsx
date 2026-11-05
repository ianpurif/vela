import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return <main id="main" className="wrap py-32 text-center"><p className="eyebrow">404 · A little off the path</p><h1 className="section-title my-6">Let’s find your way back.</h1><p className="mb-8">This page has moved or is no longer available.</p><Button asChild><Link href="/">Back to VELA</Link></Button></main>;
}
