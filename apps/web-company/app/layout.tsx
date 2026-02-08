import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KargoGig Company Dashboard",
  description: "Manage your fleet, drivers, and logistics operations",
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
