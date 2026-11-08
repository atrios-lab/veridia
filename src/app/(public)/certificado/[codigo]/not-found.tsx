/** A code that does not exist and one that is malformed look the same. */
export default function CertificateNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:py-14">
      <div className="rounded-[16px] border border-brand-border bg-brand-card p-6 md:p-9">
        <h1 className="font-serif text-[24px] font-semibold text-brand-primary">
          Certificado não encontrado
        </h1>
        <p className="mt-2 text-[15px] text-brand-muted">
          Confira o código de validação impresso no certificado, no formato
          XXXX-XXXX-XXXX.
        </p>
      </div>
    </div>
  );
}
