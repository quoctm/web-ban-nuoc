import Link from "next/link";

export default function ProductNotFound() {
  return (
    <section className="shell detail-page">
      <h1>Không tìm thấy món</h1>
      <Link href="/san-pham" className="text-link">Về thực đơn</Link>
    </section>
  );
}
