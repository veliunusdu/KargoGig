import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KargoGig Admin Panel",
  description: "Platform administration and moderation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
