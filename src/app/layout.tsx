import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: { default: "VELA — A better ritual for everyday skin", template: "%s | VELA" },
  description:
    "Thoughtfully made skincare. Discover a quieter kind of beauty with VELA's considered daily essentials.",
  openGraph: {
    type: "website",
    siteName: "VELA",
    images: [{ url: "/images/hero-ritual.webp", width: 1672, height: 941 }],
  },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="fixed -top-20 left-4 z-[100] bg-olive px-5 py-3 text-ivory focus:top-4"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
