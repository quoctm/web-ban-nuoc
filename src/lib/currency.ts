const vnd = new Intl.NumberFormat("vi-VN");

export function formatVnd(amount: number) {
  return `${vnd.format(amount)}₫`;
}
