"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { FilePicker } from "../../_components/file-picker.tsx";
import { Button } from "../../_ui/button.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import {
  type RiState,
  saveSignatureImageAction,
  saveSignerAction,
  setLegacyOwnerAction,
} from "../actions.ts";
import { useRiToast } from "./client.tsx";

const IDLE: RiState = { status: "idle" };

export function SignerForm({
  signers,
  index,
}: {
  signers: { name: string; title: string }[];
  index: number;
}) {
  const [state, action, pending] = useActionState(saveSignerAction, IDLE);
  useRiToast(state);
  const router = useRouter();
  // The page shows the new person (and their images) at once, no reload.
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-64 flex-1 flex-col gap-1.5 text-sm font-medium">
        <label htmlFor="ri-signer">Quem assina os documentos do RI</label>
        <NativeSelect
          id="ri-signer"
          name="signer"
          defaultValue={String(index)}
          className="w-full"
        >
          {signers.map((s, i) => (
            <option key={`${s.name}-${i}`} value={i}>
              {s.name}, {s.title}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}

/** Whose the images saved before each person had their own are. */
export function LegacyOwnerForm({ signers }: { signers: string[] }) {
  const [state, action, pending] = useActionState(setLegacyOwnerAction, IDLE);
  useRiToast(state);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-64 flex-1 flex-col gap-1.5 text-sm font-medium">
        <label htmlFor="ri-legacy-owner">De quem é esta assinatura</label>
        <NativeSelect
          id="ri-legacy-owner"
          name="assinante"
          defaultValue=""
          className="w-full"
          required
        >
          <option value="" disabled>
            Escolha a pessoa
          </option>
          {signers.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}

export function SignatureImageForm({
  preview,
  kind = "assinatura",
  canCopySignature = false,
  staffId,
  signerName,
}: {
  preview: string | null;
  kind?: "assinatura" | "rubrica";
  /** Rubrica: offer "usar a mesma assinatura". */
  canCopySignature?: boolean;
  /** The person of the Equipe the image is of. */
  staffId?: string;
  /** A person of "Quem assina" outside the Equipe, by the name. */
  signerName?: string;
}) {
  const [state, action, pending] = useActionState(
    saveSignatureImageAction,
    IDLE,
  );
  useRiToast(state);
  return (
    <div className="flex flex-col gap-3">
      {preview && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-background p-3">
          {/* biome-ignore lint/performance/noImgElement: a data URL of the office's own image */}
          <img
            src={preview}
            alt={`Imagem da ${kind} cadastrada`}
            className="h-16 w-auto"
          />
          <form action={action}>
            <input type="hidden" name="op" value="remove" />
            <input type="hidden" name="tipo" value={kind} />
            {staffId && <input type="hidden" name="pessoa" value={staffId} />}
            {!staffId && signerName && (
              <input type="hidden" name="assinante" value={signerName} />
            )}
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={pending}
            >
              Retirar a imagem
            </Button>
          </form>
        </div>
      )}
      {kind === "rubrica" && canCopySignature && (
        <form action={action}>
          <input type="hidden" name="tipo" value="rubrica" />
          {staffId && <input type="hidden" name="pessoa" value={staffId} />}
          {!staffId && signerName && (
            <input type="hidden" name="assinante" value={signerName} />
          )}
          <input type="hidden" name="op" value="copy" />
          <Button type="submit" variant="outline" disabled={pending}>
            Usar a mesma assinatura como rubrica
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">
            Quando a assinatura já é a rubrica, não precisa enviar outra imagem.
          </p>
        </form>
      )}
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="tipo" value={kind} />
        {staffId && <input type="hidden" name="pessoa" value={staffId} />}
        {!staffId && signerName && (
          <input type="hidden" name="assinante" value={signerName} />
        )}
        <FilePicker
          name="imagem"
          accept="image/jpeg,image/png,image/webp"
          label={
            preview ? "Trocar a imagem" : `Foto ou digitalização da ${kind}`
          }
          hint={
            kind === "rubrica"
              ? "Rubrique numa folha branca, fotografe de perto e envie. Ela vai no canto superior direito de cada folha da imagem para a ONR."
              : "Assine numa folha branca, fotografe de perto e envie. O papel e a sombra saem; fica só a tinta, em preto."
          }
        />
        {state.status === "error" && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {state.message}
          </p>
        )}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar a imagem"}
          </Button>
        </div>
      </form>
    </div>
  );
}
