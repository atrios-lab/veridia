import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { getSession } from "@/lib/session.ts";
import { listAllTutorials } from "@/lib/tutorials.ts";
import { blobUploadEnabled } from "@/lib/uploads.ts";
import { ADMIN_NAV } from "../../../_components/nav.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import {
  type AdminTutorialItem,
  TutorialAdminList,
} from "./_components/tutorial-admin-list.tsx";

export const metadata = { title: "Gerenciar vídeos" };

const ROUTES = ADMIN_NAV.filter((item) => !item.external).map((item) => ({
  href: item.href,
  label: item.label,
}));

/**
 * The platform's screen inside an office's panel: the Átrios account signs
 * in through some serventia's host, like anyone, and what it does here is
 * the same for every serventia. The permission is the gate, not the role
 * by name and not the sidebar (which does not even list this route): a
 * registrador who types the URL gets the same 404 as a route that does not
 * exist, so the screen's existence is not something the panel advertises.
 */
export default async function ManageTutorialsPage() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "tutorials.manage")) {
    notFound();
  }

  const rows = await listAllTutorials();
  const items: AdminTutorialItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    durationSeconds: row.durationSeconds,
    route: row.route,
    trail: row.trail,
    hasCaptions: row.captionsPath !== null,
    videoUrl: row.videoPath,
    captionsUrl: row.captionsPath,
    published: row.publishedAt !== null,
  }));

  return (
    <>
      <AdminPageHeader
        title="Gerenciar vídeos"
        back={{ href: "/admin/ajuda", label: "Treinamento" }}
        description="Os vídeos que ensinam a usar o painel, na ordem em que a trilha os apresenta."
      />
      <main className="flex flex-col gap-4.5 px-[30px] py-7">
        <p
          role="note"
          className="rounded-[12px] border border-admin-warning-soft-border bg-admin-warning-soft-bg px-4 py-3 text-[13px] text-admin-warning-text"
        >
          <strong>Conteúdo da plataforma.</strong> O que você publica aqui
          aparece no Treinamento de todas as serventias, não só na que você está
          usando agora.
        </p>
        <TutorialAdminList
          items={items}
          routes={ROUTES}
          directUpload={blobUploadEnabled()}
        />
      </main>
    </>
  );
}
