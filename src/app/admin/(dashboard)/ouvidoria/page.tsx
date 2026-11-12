import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { manifestationLabel } from "@/core/request/channels.ts";
import { parseDetails, statusLabel } from "@/core/request/kinds.ts";
import { formatDate, toIsoDate } from "@/core/scheduling/calendar.ts";
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
import {
  identificationLabel,
  ManifestationStatusBadge,
} from "./_components/status-badge.tsx";

export const metadata = { title: "Ouvidoria" };

export default async function OmbudsmanQueuePage() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "channels.manage", session.user.permissions)
  )
    notFound();
  const tenant = await getTenant();

  // Files 30 days past the closing leave storage as the queue opens.
  await purgeExpiredRequestFiles(tenant.slug, today());
  const manifestations = await listRecordsByKind(tenant.slug, "ombudsman");

  return (
    <>
      <AdminPageHeader title="Ouvidoria" />
      <main className="flex flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table className="min-w-[760px] table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[150px] px-5 text-xs text-muted-foreground">
                  Protocolo
                </TableHead>
                <TableHead className="text-xs text-muted-foreground">
                  Manifestante
                </TableHead>
                <TableHead className="w-[28%] text-xs text-muted-foreground">
                  Tipo
                </TableHead>
                <TableHead className="w-[140px] text-xs text-muted-foreground">
                  Situação
                </TableHead>
                <TableHead className="w-[100px] text-xs text-muted-foreground">
                  Data
                </TableHead>
                <TableHead className="w-10 pr-5">
                  <span className="sr-only">Abrir</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {manifestations.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={6}
                    className="px-5 py-8 text-center text-sm whitespace-normal text-muted-foreground"
                  >
                    Nenhuma manifestação registrada ainda.
                  </TableCell>
                </TableRow>
              ) : (
                manifestations.map((record) => {
                  const details = parseDetails("ombudsman", record.details);
                  const identified = identificationLabel({
                    applicantName: record.applicantName,
                    contact: record.contact,
                    confidential: details.confidential,
                  });
                  return (
                    <TableRow key={record.id} className="relative">
                      <TableCell className="px-5 py-3">
                        {/* The whole row opens the manifestation: the link
                            stretches over it. */}
                        <Link
                          href={`/admin/ouvidoria/${encodeURIComponent(record.protocolNumber)}`}
                          className="font-semibold tabular-nums text-primary after:absolute after:inset-0 hover:underline"
                        >
                          {record.protocolNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="min-w-0 py-3">
                        <span className="block truncate font-medium text-foreground">
                          {record.applicantName ?? identified}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {record.applicantName
                            ? identified
                            : "sem contato informado"}
                        </span>
                      </TableCell>
                      <TableCell className="truncate py-3 text-muted-foreground">
                        {manifestationLabel(details.manifestationType)}
                      </TableCell>
                      <TableCell className="py-3">
                        <ManifestationStatusBadge
                          status={record.status}
                          label={statusLabel("ombudsman", record.status)}
                        />
                      </TableCell>
                      <TableCell className="py-3 tabular-nums text-muted-foreground">
                        {formatDate(
                          toIsoDate(record.createdAt, OFFICE_TIME_ZONE),
                        ).slice(0, 5)}
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
