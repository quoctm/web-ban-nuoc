import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Mát Nhà · Thực đơn nước uống", template: "%s · Mát Nhà" },
  description: "Xem thực đơn trà sữa, cà phê, nước ép và nước đóng chai của Mát Nhà.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
