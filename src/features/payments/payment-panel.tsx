"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { expiryMessage } from "./vietqr";

export function PaymentPanel({ qr, fields, expiresAt, serverNow, live }: {
  qr: string; fields: { label: string; value: string; copy?: string }[]; expiresAt: number; serverNow: number; live: boolean;
}) {
  const router = useRouter();
  const initial = Math.max(0, expiresAt - serverNow);
  const [remaining, setRemaining] = useState(initial);
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    const started = performance.now();
    const update = () => {
      const time = Math.max(0, initial - (performance.now() - started));
      setRemaining(time);
      if (time === 0) {
        window.clearInterval(timer);
        router.refresh();
      }
    };
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [initial, router]);

  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => router.refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [live, router]);

  if (remaining <= 0) return <p className="shop-notice" role="status">{expiryMessage}</p>;
  const seconds = Math.ceil(remaining / 1000);
  const countdown = Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  return <section className="shop-panel shop-stack">
    <h2>Chuyển khoản VietQR</h2>
    <p>Thời gian còn lại <strong role="timer">{countdown}</strong></p>
    <Image src={qr} alt="Mã VietQR thanh toán đơn hàng" width={260} height={260} unoptimized />
    <dl className="shop-stack">
      {fields.map(({ label, value, copy }) => <div key={label} className="shop-summary-line">
        <div><dt>{label}</dt><dd><strong>{value}</strong></dd></div>
        {copy && <button type="button" className="button" aria-label={"Sao chép " + label.toLowerCase()} onClick={async () => {
          try {
            await navigator.clipboard.writeText(copy);
            setFeedback("Đã sao chép " + label.toLowerCase() + ".");
          } catch {
            setFeedback("Chưa thể sao chép. Bạn có thể chọn và sao chép nội dung.");
          }
        }}>Sao chép</button>}
      </div>)}
    </dl>
    <p role="status">{feedback}</p>
  </section>;
}
