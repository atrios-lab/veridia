/** What /verificar answers once an address spent its lookups. */
export function TooManyLookups() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:px-10">
      <h1 className="font-serif text-2xl font-semibold text-brand-primary">
        Muitas consultas seguidas
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-brand-muted">
        Por segurança, a verificação aceita um número limitado de consultas por
        vez. Espere alguns minutos e tente de novo.
      </p>
    </div>
  );
}
