import { CartView } from "@/features/cart/cart-view";

export const metadata = { title: "Giỏ hàng" };

export default function CartPage() {
  return <div className="shell shop-page"><h1>Giỏ hàng</h1><CartView /></div>;
}
