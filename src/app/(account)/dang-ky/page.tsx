import { AccountForm } from "@/features/account/form";
import { accountTitles } from "@/features/account/model";

export const metadata = { title: accountTitles.register };

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <AccountForm operation="register" query={searchParams} />;
}
