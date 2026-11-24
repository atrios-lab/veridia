"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { LOOKUP_PURPOSES } from "@/core/rcpn/public-lookup.ts";
import { formatCpf } from "@/core/request/form.ts";
import { Icon } from "../_components/icon.tsx";
import { type LookupState, lookupRegistroAction } from "./actions.ts";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-brand-border bg-brand-surface px-3.5 py-3 text-sm text-brand-text outline-none placeholder:text-brand-faint focus:border-brand-accent";
const labelClass = "block text-sm font-semibold text-brand-primary";

function FieldError({ state, name }: { state: LookupState; name: string }) {
  const message =
    state.status === "error" ? state.fieldErrors[name] : undefined;
  return message ? (
    <p role="alert" className="mt-1 text-sm font-semibold text-brand-alert">
      {message}
    </p>
  ) : null;
}

const REQUEST_LINKS = {
  certidao: "/solicitar?atribuicao=RCPN&ato=rcpn-certidao",
  inteiroTeor: "/solicitar?atribuicao=RCPN&ato=rcpn-certidao-inteiro-teor",
  busca: "/solicitar?atribuicao=RCPN&ato=rcpn-busca",
};

export function LookupForm() {
  const [cpf, setCpf] = useState("");
  const [state, action, pending] = useActionState(lookupRegistroAction, {
    status: "idle",
  } as LookupState);

  return (
    <div className="flex flex-col gap-5">
      <form
        action={action}
        className="flex flex-col gap-5 rounded-2xl border border-brand-border bg-brand-surface p-5"
      >
        <fieldset className="flex flex-col gap-4">
          <legend className="font-serif text-lg font-semibold text-brand-primary">
            De quem é o registro
          </legend>
          <div>
            <label htmlFor="name" className={labelClass}>
              Nome completo da pessoa registrada
            </label>
            <input
              id="name"
              name="name"
              required
              autoComplete="off"
              placeholder="Como está no documento, sem abreviar"
              className={inputClass}
            />
            <FieldError state={state} name="name" />
          </div>
          <div>
            <label htmlFor="mother" className={labelClass}>
              Nome completo da mãe
            </label>
            <input
              id="mother"
              name="mother"
              required
              autoComplete="off"
              className={inputClass}
            />
            <FieldError state={state} name="mother" />
          </div>
          <div>
            <label htmlFor="birthDate" className={labelClass}>
              Data de nascimento (se souber)
            </label>
            <input
              id="birthDate"
              name="birthDate"
              type="date"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-brand-muted">
              Sem a data, a consulta confere o nome completo e o nome da mãe.
            </p>
            <FieldError state={state} name="birthDate" />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4 border-t border-brand-border pt-4">
          <legend className="pt-4 font-serif text-lg font-semibold text-brand-primary">
            Quem está consultando
          </legend>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="askerName" className={labelClass}>
                Seu nome completo
              </label>
              <input
                id="askerName"
                name="askerName"
                required
                autoComplete="name"
                className={inputClass}
              />
              <FieldError state={state} name="askerName" />
            </div>
            <div>
              <label htmlFor="askerCpf" className={labelClass}>
                Seu CPF
              </label>
              <input
                id="askerCpf"
                name="askerCpf"
                required
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                className={inputClass}
              />
              <FieldError state={state} name="askerCpf" />
            </div>
            <div>
              <label htmlFor="askerOab" className={labelClass}>
                OAB (se for advogado)
              </label>
              <input
                id="askerOab"
                name="askerOab"
                placeholder="Ex.: RN 00000"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="purpose" className={labelClass}>
                Para que precisa
              </label>
              <select
                id="purpose"
                name="purpose"
                required
                defaultValue=""
                className={inputClass}
              >
                <option value="" disabled>
                  Escolha a finalidade
                </option>
                {LOOKUP_PURPOSES.map((purpose) => (
                  <option key={purpose} value={purpose}>
                    {purpose}
                  </option>
                ))}
              </select>
              <FieldError state={state} name="purpose" />
            </div>
          </div>
          <label className="flex items-start gap-2.5 text-sm text-brand-text">
            <input
              type="checkbox"
              name="declaration"
              className="mt-1 size-4 shrink-0"
            />
            <span>
              Declaro que uso esta informação só para a finalidade escolhida e
              sei que a consulta fica registrada, com meu nome e CPF, na
              serventia (Lei nº 13.709/2018, LGPD).
            </span>
          </label>
          <FieldError state={state} name="declaration" />
        </fieldset>

        {state.status === "error" && (
          <p role="alert" className="text-sm font-semibold text-brand-alert">
            {state.message}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary btn-lg self-start"
        >
          <Icon name="search" className="h-4 w-4" />
          {pending ? "Consultando..." : "Consultar"}
        </button>
      </form>

      {state.status === "answered" && (
        <section
          aria-live="polite"
          className="rounded-2xl border border-brand-border bg-brand-card p-5"
        >
          {state.answer.found ? (
            <>
              <h2 className="font-serif text-xl font-semibold text-brand-primary">
                Consta registro nesta serventia
              </h2>
              <ul className="mt-3 flex flex-col gap-3">
                {state.answer.items.map((item, index) => (
                  <li
                    key={`${item.kind}-${index}`}
                    className="rounded-xl border border-brand-border bg-brand-surface p-4 text-sm"
                  >
                    <p className="font-semibold text-brand-primary">
                      Registro de {item.kindLabel.toLowerCase()}
                    </p>
                    {item.professions.map((p) => (
                      <p key={p.whose} className="mt-1 text-brand-text">
                        Profissão {p.whose}: <strong>{p.value}</strong>
                      </p>
                    ))}
                    {item.professionMissing && (
                      <p className="mt-1 text-brand-muted">
                        A profissão não está nos dados digitais deste registro.
                        O livro pode trazer: peça a busca ou a certidão de
                        inteiro teor.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              {state.dateGiven && !state.answer.dateChecked && (
                <p className="mt-3 text-sm text-brand-muted">
                  A data de nascimento não está nos dados digitais deste
                  registro: a consulta conferiu o nome completo e o nome da mãe.
                </p>
              )}
              <p className="mt-3 text-sm text-brand-muted">
                Esta consulta não vale como certidão. A certidão sai com todas
                as anotações e averbações do registro.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={REQUEST_LINKS.certidao}
                  className="btn btn-primary btn-md"
                >
                  Pedir a certidão
                </Link>
                <Link
                  href={REQUEST_LINKS.inteiroTeor}
                  className="btn btn-secondary"
                >
                  Pedir a certidão de inteiro teor
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2 className="font-serif text-xl font-semibold text-brand-primary">
                Não localizamos com esses dados no índice digital
              </h2>
              <p className="mt-2 text-sm text-brand-text">
                Isso não quer dizer que o registro não exista: o índice digital
                pode não ter todos os registros, principalmente os mais antigos,
                e o nome precisa estar completo e igual ao do registro. Peça a
                busca: a serventia procura nos livros e responde pelo protocolo.
              </p>
              <div className="mt-4">
                <Link
                  href={REQUEST_LINKS.busca}
                  className="btn btn-primary btn-md"
                >
                  Pedir a busca na serventia
                </Link>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
