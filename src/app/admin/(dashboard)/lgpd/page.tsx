import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { dataRightOption } from "@/core/request/channels.ts";
import { parseDetails } from "@/core/request/kinds.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import {
  listRecordsByKind,
  purgeExpiredRequestFiles,
} from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, OFFICE_TIME_ZONE, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../_ui/table.tsx";
import { DeadlineBadge } from "./_components/deadline-badge.tsx";

export const metadata = { title: "Requerimentos LGPD" };

export default async function DataRightsQueuePage() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "channels.manage", session.user.permissions)
  )
    notFound();
  const tenant = await getTenant();

  const now = today();
  // Files 30 days past the closing leave storage as the queue opens.
  await purgeExpiredRequestFiles(tenant.slug, now);
  const requests = await listRecordsByKind(tenant.slug, "data-rights");

  return (
    <>
      <AdminPageHeader title="Requerimentos LGPD" />
      <main className="flex flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table className="min-w-[760px] table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[150px] px-5 text-xs text-muted-foreground">
                  Protocolo
                </TableHead>
                <TableHead className="text-xs text-muted-foreground">
                  Titular
                </TableHead>
                <TableHead className="w-[34%] text-xs text-muted-foreground">
                  Direito
                </TableHead>
                <TableHead className="w-[190px] text-xs text-muted-foreground">
                  Prazo
                </TableHead>
                <TableHead className="w-10 pr-5">
                  <span className="sr-only">Abrir</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={5}
                    className="px-5 py-8 text-center text-sm whitespace-normal text-muted-foreground"
                  >
                    Nenhum requerimento registrado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => {
                  const requestedOn = toIsoDate(
                    request.createdAt,
                    OFFICE_TIME_ZONE,
                  );
                  const { right } = parseDetails(
                    "data-rights",
                    request.details,
                  );
                  return (
                    <TableRow key={request.id} className="relative">
                      <TableCell className="px-5 py-3">
                        {/* The whole row opens the request: the link
                            stretches over it. */}
                        <Link
                          href={`/admin/lgpd/${encodeURIComponent(request.protocolNumber)}`}
                          className="font-semibold tabular-nums text-primary after:absolute after:inset-0 hover:underline"
                        >
                          {request.protocolNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="min-w-0 py-3">
                        <span className="block truncate font-medium text-foreground">
                          {request.applicantName ?? "Não informado"}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {request.contact ?? ""}
                        </span>
                      </TableCell>
                      <TableCell className="truncate py-3 text-muted-foreground">
                        {dataRightOption(right).summary}
                      </TableCell>
                      <TableCell className="py-3">
                        <DeadlineBadge
                          status={request.status}
                          requestedOn={requestedOn}
                          today={now}
                        />
                      </TableCell>
                      <TableCell className="py-3 pr-5 text-right text-muted-foreground">
                        <ChevronRight
                          aria-hidden="true"
                          className="ml-auto size-4"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </>
  );
}
