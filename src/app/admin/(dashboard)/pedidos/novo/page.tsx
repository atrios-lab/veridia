import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { ManualEntryForm } from "./manual-entry-form.tsx";

export const metadata = { title: "Lançar pedido manual" };

export default async function ManualEntryPage() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "requests.manage")) notFound();
  const tenant = await getTenant();

  return (
    <>
      <AdminPageHeader title="Lançar pedido manual" />
      <main className="max-w-[760px] px-[30px] py-7">
        <ManualEntryForm tenant={tenant} />
      </main>
    </>
  );
}
