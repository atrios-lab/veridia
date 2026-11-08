import { certificateCheckUrl } from "@/core/courses/certificate.ts";
import { courseOrder, itemLabels } from "@/core/tutorials/course.ts";
import {
  renderCertificatePdf,
  SigningUnavailableError,
  signingCertificateFromEnv,
} from "@/lib/certificate-pdf.ts";
import { certificateForUser } from "@/lib/certificates.ts";
import { getCourse, getPublishedCourseBySlug } from "@/lib/courses.ts";
import { getSession } from "@/lib/session.ts";
import { listPublishedTutorials } from "@/lib/tutorials.ts";

const INSTRUCTOR = "Joelison Alves Marinho";

/**
 * The person's own certificate for the course, as a signed PDF, generated
 * now from the snapshot stored at issue. Only ever the session's own: the
 * row is looked up by the session's user id, so there is no id in the URL
 * to swap for someone else's.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ curso: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return new Response("Não encontrado.", { status: 404 });
  const { curso } = await params;
  const course = await getPublishedCourseBySlug(curso);
  const certificate = course
    ? await certificateForUser(session.user.id, course.id)
    : undefined;
  if (!certificate || !course) {
    return new Response("Não encontrado.", { status: 404 });
  }

  // The back page: the course's published videos as the course page lists
  // them, read now rather than kept with the certificate, and the
  // assessment's pass mark.
  const [all, settings] = await Promise.all([
    listPublishedTutorials(),
    getCourse(course.id),
  ]);
  const videos = courseOrder(all.filter((t) => t.courseId === course.id));
  const labels = itemLabels(videos);
  const syllabus = videos.map((video) => ({
    label: labels.get(video.id) ?? "",
    title: video.title,
    description: video.description,
  }));

  try {
    const pdf = await renderCertificatePdf(
      {
        fullName: certificate.fullName,
        cpf: certificate.cpf,
        roleTitle: certificate.roleTitle,
        tenantName: certificate.tenantName,
        courseTitle: certificate.courseTitle,
        workloadHours: certificate.workloadHours,
        score: certificate.score,
        issuedAt: certificate.issuedAt,
        code: certificate.code,
        validationUrl: certificateCheckUrl(
          certificate.code,
          process.env.CERTIFICATE_CHECK_BASE_URL || undefined,
        ),
        instructorName: INSTRUCTOR,
        syllabus,
        passingScore: settings?.passingScore,
      },
      signingCertificateFromEnv(),
      { production: process.env.VERCEL_ENV === "production" },
    );
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="certificado-${certificate.code}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    console.error(
      error instanceof SigningUnavailableError
        ? "certificado.sem-assinatura"
        : "certificado.pdf",
      error,
    );
    return new Response(
      "Não foi possível gerar o certificado agora. Tente de novo mais tarde.",
      { status: 503 },
    );
  }
}
