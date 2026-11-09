// The cohort forms' fields, in the panel's own look (see Usuários).

const FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const ERROR_FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-error-border bg-admin-error-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-error-text";
const LABEL_CLASS = "mb-1.5 block text-xs font-bold text-admin-primary";

export function fieldClass(error?: string): string {
  return error ? ERROR_FIELD_CLASS : FIELD_CLASS;
}

export function Field({
  name,
  label,
  error,
  hint,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={LABEL_CLASS} htmlFor={name}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-semibold text-admin-error-text">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-[11.5px] text-admin-muted">{hint}</p>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg bg-admin-error-bg px-3.5 py-2.5 text-sm font-semibold text-admin-error-text"
    >
      {message}
    </p>
  );
}
