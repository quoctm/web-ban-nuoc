import type { Order } from "./model";

// Recognize whole area names only. Free-form street text may occupy the last segment.
const cities = new Set([
  "ha noi", "ha phong", "hue", "da nang", "ho chi minh", "hcm", "sai gon",
  "can tho", "thu duc", "da lat", "vung tau", "nha trang", "bien hoa",
]);
const districts = new Set([
  "ba dinh", "bac tu liem", "cau giay", "dong da", "ha dong", "hai ba trung",
  "hoan kiem", "hoang mai", "long bien", "nam tu liem", "tay ho", "thanh xuan",
  "binh tan", "binh thanh", "go vap", "phu nhuan", "tan binh", "tan phu",
  "cam le", "hai chau", "lien chieu", "ngu hanh son", "son tra", "thanh khe",
  "binh chanh", "can gio", "cu chi", "hoc mon", "nha be",
]);

function areaName(value: string) {
  return value.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ");
}

function isCity(value: string) {
  return cities.has(value.replace(/^(?:thanh pho |tp\.\s*|tp )/, ""));
}

function isDistrict(value: string) {
  const name = value.replace(/^(?:quan |huyen |q\.\s*)/, "");
  return districts.has(name) || (name !== value && /^(?:[1-9]|1[0-2])$/.test(name));
}

function maskDeliveryAddress(address: string) {
  const parts = address.split(/[,;\r\n]/).map((part) => part.trim()).filter(Boolean);
  if (areaName(parts.at(-1) ?? "") === "viet nam") parts.pop();
  const last = parts.at(-1);
  const lastName = areaName(last ?? "");
  if (!last || (!isCity(lastName) && !isDistrict(lastName))) return "Đã ẩn địa chỉ giao hàng";

  const previous = parts.at(-2);
  return previous && isCity(lastName) && isDistrict(areaName(previous))
    ? previous + ", " + last : last;
}

export function maskOrderContact(order: Pick<Order, "customerName" | "phone" | "address" | "fulfillment">) {
  const names = order.customerName.trim().split(/\s+/);
  const first = names[0];
  const initial = Array.from(names.at(-1) ?? "")[0];
  const surname = names.length > 1 && /^\p{L}[\p{L}\p{M}]*$/u.test(first) ? first + " " : "";
  return {
    customerName: initial ? surname + initial.toUpperCase() + "." : "Đã ẩn họ tên",
    phone: /^0[0-9]{9}$/.test(order.phone)
      ? order.phone.slice(0, 3) + "****" + order.phone.slice(-3) : "Đã ẩn số điện thoại",
    address: order.fulfillment === "pickup" ? order.address : maskDeliveryAddress(order.address),
  };
}
