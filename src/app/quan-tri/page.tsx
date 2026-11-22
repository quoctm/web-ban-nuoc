import { redirect } from "next/navigation";
import { requireAdmin } from "@/features/account/server";

export default async function Page() {
  await requireAdmin();
  redirect("/quan-tri/don-hang");
}
