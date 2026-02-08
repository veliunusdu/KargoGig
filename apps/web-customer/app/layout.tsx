import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KargoGig",
  description: "Logistics platform for drivers, customers, and shippers",
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
