"use client";

import { useActionState, useState } from "react";
import type { GuideSettings } from "@/core/guides/schema.ts";
import { AdminIcon } from "../../../../_components/icon.tsx";
import { Button } from "../../../../_ui/button.tsx";
import { Input } from "../../../../_ui/input.tsx";
import { Label } from "../../../../_ui/label.tsx";
import { type GuideSettingsState, saveGuideSettings } from "../actions.ts";

const LABEL = "mb-1.5 block text-sm font-medium text-foreground";

const percent = (bp: number) => (bp ? String(bp / 100).replace(".", ",") : "");
const basisPoints = (text: string) => {
  const n = Math.round(Number(text.replace(",", ".")) * 100);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

function Text({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <Label className="block leading-normal font-normal">
      <span className={LABEL}>{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && (
        <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      )}
    </Label>
  );
}

/**
 * The office's own laws, rates, addressees and signers for the guias. The
 * defaults come from its registration and its own papers; nothing here is
 * claimed verified: the office checks its municipal law and corrects it.
 */
export function GuideSettingsForm({ initial }: { initial: GuideSettings }) {
  const [state, formAction, pending] = useActionState<
    GuideSettingsState,
    FormData
  >(saveGuideSettings, { status: "idle" });
  const [s, setS] = useState(initial);
  const [itivRate, setItivRate] = useState(
    percent(initial.municipal.itivRateBasisPoints),
  );
  const [laudemioRate, setLaudemioRate] = useState(
    percent(initial.municipal.laudemioRateBasisPoints),
  );
  const m = (patch: Partial<GuideSettings["municipal"]>) =>
    setS({ ...s, municipal: { ...s.municipal, ...patch } });
  const st = (patch: Partial<GuideSettings["state"]>) =>
    setS({ ...s, state: { ...s.state, ...patch } });
  const payload: GuideSettings = {
    ...s,
    municipal: {
      ...s.municipal,
      itivRateBasisPoints: basisPoints(itivRate),
      laudemioRateBasisPoints: basisPoints(laudemioRate),
    },
  };

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="settings" value={JSON.stringify(payload)} />

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Prefeitura</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Text
            label="Prefeitura"
            value={s.municipal.authority}
            onChange={(authority) => m({ authority })}
          />
          <Text
            label="CNPJ da prefeitura"
            value={s.municipal.cnpj}
            onChange={(cnpj) => m({ cnpj })}
          />
          <Text
            label="Destinatário"
            value={s.municipal.addressee}
            onChange={(addressee) => m({ addressee })}
          />
          <div />
          <Text
            label="Lei do ITIV/ITBI (com o artigo)"
            value={s.municipal.itivLaw}
            onChange={(itivLaw) => m({ itivLaw })}
            hint="Ex.: Lei Complementar Municipal nº 44, de 30 de dezembro de 2021, art. 91. Confira no Código Tributário do município."
          />
          <Text
            label="Alíquota do ITIV/ITBI (%)"
            value={itivRate}
            onChange={setItivRate}
          />
          <Text
            label="Lei do laudêmio municipal"
            value={s.municipal.laudemioLaw}
            onChange={(laudemioLaw) => m({ laudemioLaw })}
            hint="Padrão: Código Civil de 1916, art. 686 (2,5% sobre o preço), se o título de aforamento não fixou outra taxa."
          />
          <Text
            label="Alíquota do laudêmio (%)"
            value={laudemioRate}
            onChange={setLaudemioRate}
          />
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">
          Estado (ITCD)
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Text
            label="Destinatário"
            value={s.state.addressee}
            onChange={(addressee) => st({ addressee })}
          />
          <Text
            label="Nome do(a) coordenador(a) (opcional)"
            value={s.state.addresseeName}
            onChange={(addresseeName) => st({ addresseeName })}
          />
          <div className="md:col-span-2">
            <Text
              label="Lei do ITCD"
              value={s.state.itcdLaw}
              onChange={(itcdLaw) => st({ itcdLaw })}
              hint="As alíquotas por faixa (3% a 6%) vêm do art. 7º da Lei 5.887/1989, na redação da Lei 9.993/2015."
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Quem assina</h2>
        <div className="mt-3 flex flex-col gap-3">
          {s.signers.map((signer, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: signers have no id; the index is their identity here.
              key={index}
              className="grid grid-cols-1 gap-3 border-b pb-3 md:grid-cols-[1fr_1fr_1fr_auto]"
            >
              {(["name", "title", "note"] as const).map((key) => (
                <Text
                  key={key}
                  label={
                    {
                      name: "Nome",
                      title: "Cargo",
                      note: "Portaria/Matrícula",
                    }[key]
                  }
                  value={signer[key]}
                  onChange={(value) =>
                    setS({
                      ...s,
                      signers: s.signers.map((one, i) =>
                        i === index ? { ...one, [key]: value } : one,
                      ),
                    })
                  }
                />
              ))}
              <button
                type="button"
                onClick={() =>
                  setS({
                    ...s,
                    signers: s.signers.filter((_, i) => i !== index),
                  })
                }
                disabled={s.signers.length <= 1}
                className="self-end pb-2 text-xs font-semibold text-destructive hover:underline disabled:opacity-40"
              >
                Remover
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setS({
                ...s,
                signers: [...s.signers, { name: "", title: "", note: "" }],
              })
            }
            className="self-start"
          >
            + Quem assina
          </Button>
        </div>
      </section>

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-lg bg-destructive-soft px-3.5 py-2.5 text-sm font-semibold text-destructive"
        >
          {state.message} {Object.values(state.fieldErrors)[0] ?? ""}
        </p>
      )}
      <div className="flex items-center gap-3.5">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
        {state.status === "saved" && (
          <output className="flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-xs font-semibold text-success-text">
            <AdminIcon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
            Salvo. Vale para as próximas guias.
          </output>
        )}
      </div>
    </form>
  );
}
