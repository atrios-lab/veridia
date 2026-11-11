import { notFound } from "next/navigation";
import { BlobUploadProvider } from "@/app/(public)/_lib/attachments.tsx";
import { can } from "@/core/auth/roles.ts";
import {
  checklistFileHref,
  defaultChecklist,
  resolveService,
} from "@/core/scheduling/services.ts";
import { getAgendaConfig } from "@/lib/appointments.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { blobUploadEnabled } from "@/lib/uploads.ts";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { ChecklistEditor } from "./checklist-editor.tsx";

export const metadata = { title: "O que levar" };

/**
 * The list of one service as the office wants it: the catalogue's items
 * edited, added to or removed, and its own sheet attached. What is saved here
 * is what the site, the e-mail and the receipt give the citizen.
 */
export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ servico: string }>;
}) {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "channels.manage", session.user.permissions)
  )
    notFound();
  const tenant = await getTenant();
  const serviceId = decodeURIComponent((await params).servico);

  const config = await getAgendaConfig(tenant.slug);
  const service = resolveService(config, serviceId);
  if (!service) notFound();
  const custom = config.checklists[serviceId];

  return (
    <>
      <AdminPageHeader
        title={`O que levar · ${service.label}`}
        back={{
          href: "/admin/agenda/configuracao",
          label: "Configuração das agendas",
        }}
      />
      <main className="px-[30px] py-7">
        <BlobUploadProvider
          enabled={blobUploadEnabled()}
          tenantSlug={tenant.slug}
        >
          <ChecklistEditor
            serviceId={serviceId}
            group={service.group}
            items={service.checklist}
            defaults={defaultChecklist(config, serviceId)}
            edited={Boolean(custom?.items)}
            file={
              custom?.file
                ? {
                    href: checklistFileHref(serviceId),
                    sizeBytes: custom.file.sizeBytes,
                    mimeType: custom.file.mimeType,
                  }
                : undefined
            }
          />
        </BlobUploadProvider>
      </main>
    </>
  );
}
