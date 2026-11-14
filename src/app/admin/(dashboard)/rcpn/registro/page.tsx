import { redirect } from "next/navigation";

/** The registros are reached from the search: this path only leads there. */
export default function RegistrosPage() {
  redirect("/admin/rcpn");
}
