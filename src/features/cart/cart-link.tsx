"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { useCart } from "./store";

export function CartLink() {
  const { lines } = useCart();
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <Link href="/gio-hang" className="cart-icon" aria-label={`Giỏ hàng, ${count} món`}>
      <Icon name="bag" className="size-[22px]" />
      {count > 0 && <span className="cart-count" aria-hidden="true">{count}</span>}
    </Link>
  );
}
