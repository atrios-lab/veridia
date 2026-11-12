"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { guessPaperKind, sameItem } from "@/core/paper-orders/catalog.ts";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { Button } from "../../../_ui/button.tsx";
import { cn } from "../../../_ui/cn.ts";
import { Input } from "../../../_ui/input.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../_ui/native-select.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../_ui/table.tsx";
import { Textarea } from "../../../_ui/textarea.tsx";
import {
  type OrderFormState,
  readSupplierModel,
  removeOrder,
  removeSupplier,
  saveOfficeData,
  saveOrder,
  saveSupplier,
  setOrderStatus,
} from "./actions.ts";

const LABEL = "mb-1.5 block text-sm font-medium text-foreground";
const TH = "px-3 text-xs font-medium text-muted-foreground";
const HINT = "mt-1 block text-xs text-muted-foreground";
const CARD = "flex flex-col gap-4 rounded-xl border bg-card px-5 py-5";
const IDLE: OrderFormState = { status: "idle" };

function Feedback({ state }: { state: OrderFormState }) {
  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
  }, [state]);
  if (state.status !== "error") return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive-soft px-3.5 py-2.5 text-sm font-medium text-destructive"
    >
      {state.message}
    </p>
  );
}

function Submit({
  pending,
  label,
  busy,
}: {
  pending: boolean;
  label: string;
  busy: string;
}) {
  return (
    <Button type="submit" size="lg" disabled={pending} className="self-start">
      {pending ? busy : label}
    </Button>
  );
}

/** "27,63" -> 2763; empty -> null. */
function cents(text: string): number | null {
  const t = text.replace(/[R$\s.]/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

const money = (c: number) =>
  (c / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/* ----------------------------------------------------------------- orders */

export interface SupplierChoice {
  id: string;
  name: string;
  items: {
    id: string;
    name: string;
    unit: string;
    minimum: number;
    unitPriceCents: number | null;
    note: string;
    /** Stock now, when the item restocks a papel de segurança kind. */
    stock: number | null;
  }[];
  freightOptions: string[];
  paymentOptions: string[];
}

interface ExtraLine {
  key: number;
  name: string;
  unit: string;
  quantity: string;
  price: string;
  note: string;
  save: boolean;
}

export function OrderForm({
  suppliers,
  signers,
  today,
  initial,
}: {
  suppliers: SupplierChoice[];
  signers: { name: string; title: string }[];
  today: string;
  initial?: {
    id?: string;
    supplierId?: string;
    /** Quantities by item id, and lines typed only in the order. */
    quantities?: Record<string, string>;
    extras?: {
      name: string;
      unit: string;
      quantity: number;
      unitPriceCents: number | null;
      note: string;
    }[];
    freight?: string;
    payment?: string;
    notes?: string;
    orderDate?: string;
    signer?: number;
  };
}) {
  const [state, action, pending] = useActionState(saveOrder, IDLE);
  const [supplierId, setSupplierId] = useState(
    initial?.supplierId ?? suppliers[0]?.id ?? "",
  );
  const supplier = suppliers.find((s) => s.id === supplierId);
  const [quantities, setQuantities] = useState<Record<string, string>>(
    initial?.quantities ?? {},
  );
  const [extras, setExtras] = useState<ExtraLine[]>(
    (initial?.extras ?? []).map((e, i) => ({
      key: i,
      name: e.name,
      unit: e.unit,
      quantity: String(e.quantity),
      price: e.unitPriceCents === null ? "" : money(e.unitPriceCents),
      note: e.note,
      save: false,
    })),
  );
  const [freight, setFreight] = useState(
    initial?.freight ?? supplier?.freightOptions[0] ?? "",
  );
  const [payment, setPayment] = useState(
    initial?.payment ?? supplier?.paymentOptions[0] ?? "",
  );

  const lines = useMemo(() => {
    const fromItems = (supplier?.items ?? [])
      .filter((item) => Number(quantities[item.id]) > 0)
      .map((item) => ({
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        minimum: item.minimum,
        quantity: Math.round(Number(quantities[item.id])),
        unitPriceCents: item.unitPriceCents,
        note: item.note,
      }));
    const typed = extras
      .filter((e) => e.name.trim() && Number(e.quantity) > 0)
      .map((e) => ({
        itemId: null,
        name: e.name.trim(),
        unit: e.unit.trim() || "Unidades",
        minimum: 0,
        quantity: Math.round(Number(e.quantity)),
        unitPriceCents: cents(e.price),
        note: e.note.trim(),
        save: e.save,
      }));
    return [...fromItems, ...typed];
  }, [supplier, quantities, extras]);
  const total = lines.some((l) => l.unitPriceCents !== null)
    ? lines.reduce((sum, l) => sum + (l.unitPriceCents ?? 0) * l.quantity, 0)
    : null;
  const below = lines.filter((l) => l.minimum > 0 && l.quantity < l.minimum);

  if (suppliers.length === 0) {
    return (
      <p className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-foreground">
        Cadastre primeiro a empresa: o pedido sai no padrão dela.
      </p>
    );
  }

  return (
    <form action={action} className={CARD}>
      <Feedback state={state} />
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="linhas" value={JSON.stringify(lines)} />
      <input type="hidden" name="frete" value={freight} />
      <input type="hidden" name="pagamento" value={payment} />

      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div>
          <label htmlFor="ord-supplier" className={LABEL}>
            Empresa
          </label>
          <NativeSelect
            id="ord-supplier"
            name="empresa"
            value={supplierId}
            disabled={Boolean(initial?.id)}
            onChange={(e) => {
              const next = suppliers.find((s) => s.id === e.target.value);
              setSupplierId(e.target.value);
              setQuantities({});
              setFreight(next?.freightOptions[0] ?? "");
              setPayment(next?.paymentOptions[0] ?? "");
            }}
            className="w-full"
          >
            {suppliers.map((s) => (
              <NativeSelectOption key={s.id} value={s.id}>
                {s.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {initial?.id && (
            <input type="hidden" name="empresa" value={supplierId} />
          )}
        </div>
        <div>
          <label htmlFor="ord-date" className={LABEL}>
            Data do pedido
          </label>
          <Input
            id="ord-date"
            name="data"
            type="date"
            required
            defaultValue={initial?.orderDate ?? today}
          />
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border">
        <Table className="min-w-[620px]">
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className={TH}>Item</TableHead>
              <TableHead className={TH}>Estoque</TableHead>
              <TableHead className={TH}>Mínimo</TableHead>
              <TableHead className={TH}>Valor unit.</TableHead>
              <TableHead className={cn(TH, "w-[150px]")}>Quantidade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(supplier?.items ?? []).map((item) => {
              const q = Number(quantities[item.id] ?? 0);
              const low = q > 0 && item.minimum > 0 && q < item.minimum;
              return (
                <TableRow key={item.id}>
                  <TableCell className="px-3 py-2 whitespace-normal">
                    <span className="font-semibold text-foreground">
                      {item.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {item.unit}
                      {item.note ? ` · ${item.note}` : ""}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-muted-foreground tabular-nums">
                    {item.stock === null
                      ? "-"
                      : `${item.stock.toLocaleString("pt-BR")} folhas`}
                  </TableCell>
                  <TableCell className="px-3 py-2 tabular-nums">
                    {item.minimum ? item.minimum.toLocaleString("pt-BR") : "-"}
                  </TableCell>
                  <TableCell className="px-3 py-2 tabular-nums">
                    {item.unitPriceCents === null
                      ? "-"
                      : `R$ ${money(item.unitPriceCents)}`}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Input
                      aria-label={`Quantidade de ${item.name}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={quantities[item.id] ?? ""}
                      placeholder={item.minimum ? `mín. ${item.minimum}` : "0"}
                      onChange={(e) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      className={cn("h-8", low && "border-destructive")}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      <fieldset className="flex flex-col gap-2">
        <legend className={LABEL}>Item que não está na lista</legend>
        {extras.map((e) => (
          <div
            key={e.key}
            className="grid gap-2 rounded-lg border p-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]"
          >
            <Input
              aria-label="Nome do item"
              placeholder="Ex.: Selo de autenticidade"
              value={e.name}
              onChange={(ev) =>
                setExtras((prev) =>
                  prev.map((x) =>
                    x.key === e.key ? { ...x, name: ev.target.value } : x,
                  ),
                )
              }
              className="h-8"
            />
            <Input
              aria-label="Unidade"
              placeholder="Folhas, rolos..."
              value={e.unit}
              onChange={(ev) =>
                setExtras((prev) =>
                  prev.map((x) =>
                    x.key === e.key ? { ...x, unit: ev.target.value } : x,
                  ),
                )
              }
              className="h-8"
            />
            <Input
              aria-label="Quantidade do item novo"
              type="number"
              min={1}
              placeholder="Quantidade"
              value={e.quantity}
              onChange={(ev) =>
                setExtras((prev) =>
                  prev.map((x) =>
                    x.key === e.key ? { ...x, quantity: ev.target.value } : x,
                  ),
                )
              }
              className="h-8"
            />
            <Input
              aria-label="Valor unitário (opcional)"
              placeholder="R$ (opcional)"
              value={e.price}
              onChange={(ev) =>
                setExtras((prev) =>
                  prev.map((x) =>
                    x.key === e.key ? { ...x, price: ev.target.value } : x,
                  ),
                )
              }
              className="h-8"
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() =>
                setExtras((prev) => prev.filter((x) => x.key !== e.key))
              }
            >
              Remover
            </Button>
            <label className="flex items-center gap-2 text-xs text-foreground md:col-span-5">
              <input
                type="checkbox"
                className="checkbox-admin"
                checked={e.save}
                onChange={(ev) =>
                  setExtras((prev) =>
                    prev.map((x) =>
                      x.key === e.key ? { ...x, save: ev.target.checked } : x,
                    ),
                  )
                }
              />
              Salvar este item na lista da empresa, para os próximos pedidos
            </label>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() =>
            setExtras((prev) => [
              ...prev,
              {
                key: Date.now(),
                name: "",
                unit: "Unidades",
                quantity: "",
                price: "",
                note: "",
                save: true,
              },
            ])
          }
        >
          + Adicionar item novo
        </Button>
      </fieldset>

      {(supplier?.freightOptions.length ?? 0) > 0 && (
        <fieldset>
          <legend className={LABEL}>Frete</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            {supplier?.freightOptions.map((f) => (
              <label key={f} className="flex items-center gap-2">
                <input
                  type="radio"
                  className="accent-primary"
                  name="frete-opcao"
                  checked={freight === f}
                  onChange={() => setFreight(f)}
                />
                {f}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {(supplier?.paymentOptions.length ?? 0) > 0 && (
        <fieldset>
          <legend className={LABEL}>Pagamento</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            {supplier?.paymentOptions.map((f) => (
              <label key={f} className="flex items-center gap-2">
                <input
                  type="radio"
                  className="accent-primary"
                  name="pagamento-opcao"
                  checked={payment === f}
                  onChange={() => setPayment(f)}
                />
                {f}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="ord-signer" className={LABEL}>
            Quem assina
          </label>
          <NativeSelect
            id="ord-signer"
            name="assina"
            defaultValue={initial?.signer ?? 0}
            className="w-full"
          >
            {signers.length === 0 && (
              <NativeSelectOption value="0">
                O Tabelião/Registrador
              </NativeSelectOption>
            )}
            {signers.map((s, i) => (
              <NativeSelectOption key={`${s.name}-${i}`} value={i}>
                {s.name}
                {s.title ? `, ${s.title}` : ""}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div>
          <label htmlFor="ord-notes" className={LABEL}>
            Observações (vão no pedido)
          </label>
          <Input
            id="ord-notes"
            name="observacoes"
            maxLength={5000}
            defaultValue={initial?.notes}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 px-4 py-3 text-sm">
        <span>
          <strong>{lines.length}</strong> item(ns) no pedido
          {total !== null ? (
            <>
              {" "}
              · total <strong>R$ {money(total)}</strong>
            </>
          ) : null}
        </span>
        {below.length > 0 && (
          <span className="font-semibold text-destructive">
            Abaixo do mínimo:{" "}
            {below
              .map(
                (l) => `${l.name} (mín. ${l.minimum.toLocaleString("pt-BR")})`,
              )
              .join(", ")}
          </span>
        )}
      </div>

      <Submit
        pending={pending}
        label={initial?.id ? "Salvar alterações" : "Gerar pedido"}
        busy="Salvando..."
      />
    </form>
  );
}

export function RemoveOrderButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(removeOrder, IDLE);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question="Excluir este pedido?"
      consequence="Ele sai da lista, mas continua guardado, com a justificativa. O número não é reaproveitado."
      confirmLabel="Excluir"
      pendingLabel="Excluindo..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}

export function OrderStatusForm({
  id,
  status,
  sentOn,
  receivedOn,
  today,
}: {
  id: string;
  status: string;
  sentOn: string;
  receivedOn: string;
  today: string;
}) {
  const [state, action, pending] = useActionState(setOrderStatus, IDLE);
  return (
    <form action={action} className={CARD}>
      <Feedback state={state} />
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="st-status" className={LABEL}>
            Situação
          </label>
          <NativeSelect
            id="st-status"
            name="situacao"
            defaultValue={status}
            className="w-full"
          >
            <NativeSelectOption value="rascunho">
              Gerado, não enviado
            </NativeSelectOption>
            <NativeSelectOption value="enviado">
              Enviado à empresa
            </NativeSelectOption>
            <NativeSelectOption value="recebido">Recebido</NativeSelectOption>
          </NativeSelect>
        </div>
        <div>
          <label htmlFor="st-sent" className={LABEL}>
            Enviado em
          </label>
          <Input
            id="st-sent"
            name="enviado"
            type="date"
            max={today}
            defaultValue={sentOn}
          />
        </div>
        <div>
          <label htmlFor="st-received" className={LABEL}>
            Recebido em
          </label>
          <Input
            id="st-received"
            name="recebido"
            type="date"
            max={today}
            defaultValue={receivedOn}
          />
        </div>
      </div>
      <Submit pending={pending} label="Salvar situação" busy="Salvando..." />
    </form>
  );
}

/* -------------------------------------------------------------- suppliers */

export interface SupplierFormValues {
  name: string;
  cnpj: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  title: string;
  intro: string;
  delivery: string;
  deliveryAddress: string;
  conditions: string;
  signatureNote: string;
  freightOptions: string[];
  paymentOptions: string[];
  items: {
    id?: string;
    name: string;
    unit: string;
    minimum: number;
    unitPriceCents: number | null;
    note: string;
    paperKind: string | null;
  }[];
}

interface ItemRow {
  key: number;
  id?: string;
  name: string;
  unit: string;
  minimum: string;
  price: string;
  note: string;
  paperKind: string;
}

const toRows = (items: SupplierFormValues["items"]): ItemRow[] =>
  items.map((i, n) => ({
    key: n,
    id: i.id,
    name: i.name,
    unit: i.unit,
    minimum: i.minimum ? String(i.minimum) : "",
    price: i.unitPriceCents === null ? "" : money(i.unitPriceCents),
    note: i.note,
    paperKind: i.paperKind ?? "",
  }));

export function SupplierForm({
  id,
  initial,
  kinds,
  modelName,
}: {
  id?: string;
  initial: SupplierFormValues;
  kinds: { value: string; label: string }[];
  modelName?: string | null;
}) {
  const [state, action, pending] = useActionState(saveSupplier, IDLE);
  const [values, setValues] = useState(initial);
  const [rows, setRows] = useState<ItemRow[]>(toRows(initial.items));
  const [reading, startReading] = useTransition();
  const [fileName, setFileName] = useState("");
  const [readNote, setReadNote] = useState("");
  const set =
    (key: keyof SupplierFormValues) => (e: { target: { value: string } }) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

  const items = rows
    .filter((r) => r.name.trim())
    .map((r) => ({
      ...(r.id ? { id: r.id } : {}),
      name: r.name.trim(),
      unit: r.unit.trim() || "Unidades",
      minimum: Math.max(0, Math.round(Number(r.minimum) || 0)),
      unitPriceCents: cents(r.price),
      note: r.note.trim(),
      paperKind: r.paperKind || null,
    }));

  const readModel = (form: HTMLFormElement | null) => {
    if (!form) return;
    const data = new FormData();
    const file = (form.elements.namedItem("modelo") as HTMLInputElement | null)
      ?.files?.[0];
    if (!file) {
      setReadNote("Escolha primeiro o arquivo do modelo (.docx).");
      return;
    }
    data.set("modelo", file);
    startReading(async () => {
      const result = await readSupplierModel(data);
      if (!result.ok) {
        setReadNote(result.message);
        return;
      }
      const r = result.reading;
      setValues((v) => ({
        ...v,
        name: v.name || r.supplierName,
        title: r.title
          ? r.title.charAt(0) + r.title.slice(1).toLowerCase()
          : v.title,
        intro: r.intro || v.intro,
        delivery: r.delivery || v.delivery,
        deliveryAddress: r.deliveryAddress || v.deliveryAddress,
        conditions: r.conditions.join("\n\n") || v.conditions,
        freightOptions: r.freightOptions.length
          ? r.freightOptions
          : v.freightOptions,
        paymentOptions: r.paymentOptions.length
          ? r.paymentOptions
          : v.paymentOptions,
      }));
      if (r.items.length) {
        // Merged with the list there is: an item already registered keeps
        // its link to the stock and its price; a new one gets its link
        // guessed from the name. Items not on the form stay, to delete.
        setRows((prev) => {
          const read = r.items.map((i, n) => {
            const old = prev.find((x) => sameItem(x.name, i.name));
            return {
              key: Date.now() + n,
              id: old?.id,
              name: i.name,
              unit: i.unit,
              minimum: i.minimum ? String(i.minimum) : (old?.minimum ?? ""),
              price:
                i.unitPriceCents !== null
                  ? money(i.unitPriceCents)
                  : (old?.price ?? ""),
              note: i.note || old?.note || "",
              paperKind: old?.paperKind || guessPaperKind(i.name) || "",
            };
          });
          const rest = prev.filter(
            (x) => !r.items.some((i) => sameItem(x.name, i.name)),
          );
          return [...read, ...rest];
        });
      }
      setReadNote(
        `Modelo lido: ${r.items.length} item(ns) e as condições foram preenchidos abaixo. Confira e clique em Salvar.`,
      );
    });
  };

  return (
    <form action={action} className={CARD}>
      <Feedback state={state} />
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="itens" value={JSON.stringify(items)} />
      <input type="hidden" name="modeloNome" value={fileName} />

      <section className="flex flex-col gap-2 rounded-lg bg-muted/50 px-4 py-3.5">
        <p className="text-sm font-semibold text-foreground">
          Modelo de formulário da empresa (opcional)
        </p>
        <p className="text-xs text-foreground">
          Envie o formulário de pedido da empresa em Word (.docx). O sistema lê
          o modelo, preenche os itens e as condições aqui embaixo e, em cada
          pedido, devolve o mesmo formulário já preenchido com os dados novos.
          {modelName ? ` Modelo atual: ${modelName}.` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            name="modelo"
            type="file"
            aria-label="Arquivo do modelo (.docx)"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            className="max-w-[420px]"
          />
          <Button
            type="button"
            variant="outline"
            disabled={reading}
            onClick={(e) => readModel(e.currentTarget.form)}
          >
            {reading ? "Lendo..." : "Ler o modelo"}
          </Button>
        </div>
        {readNote && (
          <output className="text-xs font-medium text-foreground">
            {readNote}
          </output>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="sp-name" className={LABEL}>
            Nome da empresa
          </label>
          <Input
            id="sp-name"
            name="nome"
            required
            value={values.name}
            onChange={set("name")}
          />
        </div>
        <div>
          <label htmlFor="sp-cnpj" className={LABEL}>
            CNPJ
          </label>
          <Input
            id="sp-cnpj"
            name="cnpj"
            value={values.cnpj}
            onChange={set("cnpj")}
          />
        </div>
        <div>
          <label htmlFor="sp-phone" className={LABEL}>
            Telefone
          </label>
          <Input
            id="sp-phone"
            name="fone"
            value={values.phone}
            onChange={set("phone")}
          />
        </div>
        <div>
          <label htmlFor="sp-email" className={LABEL}>
            E-mail
          </label>
          <Input
            id="sp-email"
            name="email"
            value={values.email}
            onChange={set("email")}
          />
        </div>
        <div>
          <label htmlFor="sp-site" className={LABEL}>
            Site
          </label>
          <Input
            id="sp-site"
            name="site"
            value={values.website}
            onChange={set("website")}
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="sp-address" className={LABEL}>
            Endereço
          </label>
          <Input
            id="sp-address"
            name="endereco"
            value={values.address}
            onChange={set("address")}
          />
        </div>
        <div>
          <label htmlFor="sp-title" className={LABEL}>
            Título do pedido
          </label>
          <Input
            id="sp-title"
            name="titulo"
            value={values.title}
            onChange={set("title")}
            placeholder="Formulário de pedido"
          />
        </div>
        <div>
          <label htmlFor="sp-sign" className={LABEL}>
            Nota sob a assinatura
          </label>
          <Input
            id="sp-sign"
            name="assinatura"
            value={values.signatureNote}
            onChange={set("signatureNote")}
            placeholder="(Somente) titular ou substituto"
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="sp-intro" className={LABEL}>
            Texto de abertura
          </label>
          <Textarea
            id="sp-intro"
            name="abertura"
            rows={2}
            value={values.intro}
            onChange={set("intro")}
            placeholder="Ex.: Autorizamos a empresa a efetuar o faturamento dos itens abaixo."
          />
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <p className={LABEL}>Itens que a empresa vende</p>
        {rows.map((r) => (
          <div
            key={r.key}
            className="grid gap-2 rounded-lg border p-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]"
          >
            <Input
              aria-label="Nome do item, como no formulário"
              placeholder="Nome (como no formulário)"
              value={r.name}
              onChange={(e) =>
                setRows((p) =>
                  p.map((x) =>
                    x.key === r.key ? { ...x, name: e.target.value } : x,
                  ),
                )
              }
              className="h-8"
            />
            <Input
              aria-label="Unidade"
              placeholder="Folhas"
              value={r.unit}
              onChange={(e) =>
                setRows((p) =>
                  p.map((x) =>
                    x.key === r.key ? { ...x, unit: e.target.value } : x,
                  ),
                )
              }
              className="h-8"
            />
            <Input
              aria-label="Pedido mínimo"
              type="number"
              min={0}
              placeholder="Mínimo"
              value={r.minimum}
              onChange={(e) =>
                setRows((p) =>
                  p.map((x) =>
                    x.key === r.key ? { ...x, minimum: e.target.value } : x,
                  ),
                )
              }
              className="h-8"
            />
            <Input
              aria-label="Valor unitário"
              placeholder="R$ (opcional)"
              value={r.price}
              onChange={(e) =>
                setRows((p) =>
                  p.map((x) =>
                    x.key === r.key ? { ...x, price: e.target.value } : x,
                  ),
                )
              }
              className="h-8"
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setRows((p) => p.filter((x) => x.key !== r.key))}
            >
              Excluir
            </Button>
            <Input
              aria-label="Observação do item"
              placeholder="Observação (ex.: 750 etiquetas cada)"
              value={r.note}
              onChange={(e) =>
                setRows((p) =>
                  p.map((x) =>
                    x.key === r.key ? { ...x, note: e.target.value } : x,
                  ),
                )
              }
              className="h-8 md:col-span-3"
            />
            <NativeSelect
              aria-label="Repõe qual papel do estoque"
              value={r.paperKind}
              onChange={(e) =>
                setRows((p) =>
                  p.map((x) =>
                    x.key === r.key ? { ...x, paperKind: e.target.value } : x,
                  ),
                )
              }
              size="sm"
              className="w-full md:col-span-2"
            >
              <NativeSelectOption value="">
                Não repõe papel do estoque
              </NativeSelectOption>
              {kinds.map((k) => (
                <NativeSelectOption key={k.value} value={k.value}>
                  Repõe: {k.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() =>
            setRows((p) => [
              ...p,
              {
                key: Date.now(),
                name: "",
                unit: "Folhas",
                minimum: "",
                price: "",
                note: "",
                paperKind: "",
              },
            ])
          }
        >
          + Adicionar item
        </Button>
        <span className={HINT}>
          "Repõe" liga o item ao estoque do papel de segurança: quando faltarem
          poucas folhas, o aviso leva direto a este item.
        </span>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="sp-freight" className={LABEL}>
            Opções de frete (uma por linha)
          </label>
          <Textarea
            id="sp-freight"
            name="fretes"
            rows={2}
            value={values.freightOptions.join("\n")}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                freightOptions: e.target.value.split("\n"),
              }))
            }
          />
        </div>
        <div>
          <label htmlFor="sp-payment" className={LABEL}>
            Opções de pagamento (uma por linha)
          </label>
          <Textarea
            id="sp-payment"
            name="pagamentos"
            rows={2}
            value={values.paymentOptions.join("\n")}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                paymentOptions: e.target.value.split("\n"),
              }))
            }
          />
        </div>
        <div>
          <label htmlFor="sp-delivery" className={LABEL}>
            Prazo de entrega
          </label>
          <Textarea
            id="sp-delivery"
            name="prazo"
            rows={2}
            value={values.delivery}
            onChange={set("delivery")}
          />
        </div>
        <div>
          <label htmlFor="sp-where" className={LABEL}>
            Local de entrega
          </label>
          <Textarea
            id="sp-where"
            name="entrega"
            rows={2}
            value={values.deliveryAddress}
            onChange={set("deliveryAddress")}
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="sp-conditions" className={LABEL}>
            Observações da empresa (cobrança, depósito, contatos)
          </label>
          <Textarea
            id="sp-conditions"
            name="condicoes"
            rows={3}
            value={values.conditions}
            onChange={set("conditions")}
          />
        </div>
      </div>
      <Submit pending={pending} label="Salvar empresa" busy="Salvando..." />
    </form>
  );
}

export function RemoveSupplierButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(removeSupplier, IDLE);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir empresa"
      question="Excluir esta empresa?"
      consequence="Ela sai da lista e não aparece em pedidos novos. Os pedidos já feitos continuam guardados."
      confirmLabel="Excluir"
      pendingLabel="Excluindo..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}

/* ------------------------------------------------------------ office data */

export function OfficeDataForm({
  initial,
}: {
  initial: {
    office: string;
    cns: string;
    holderName: string;
    holderCpf: string;
    billingCnpj: string;
    billingCpf: string;
    address: string;
    cep: string;
    city: string;
    phone: string;
    email: string;
  };
}) {
  const [state, action, pending] = useActionState(saveOfficeData, IDLE);
  const fields: [string, string, string, string?][] = [
    ["cartorio", "Nome do cartório", initial.office],
    ["cns", "CNS", initial.cns],
    ["responsavel", "Responsável (titular ou substituto)", initial.holderName],
    ["cpf", "CPF do responsável", initial.holderCpf],
    ["cnpj", "CNPJ de faturamento", initial.billingCnpj],
    [
      "cpfFaturamento",
      "CPF de faturamento (se for por CPF)",
      initial.billingCpf,
    ],
    ["endereco", "Endereço", initial.address],
    ["cep", "CEP", initial.cep],
    ["municipio", "Município/UF", initial.city],
    ["fone", "Telefone", initial.phone],
    ["email", "E-mail do cartório", initial.email],
  ];
  return (
    <form action={action} className={CARD}>
      <Feedback state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map(([name, label, value]) => (
          <div key={name}>
            <label htmlFor={`od-${name}`} className={LABEL}>
              {label}
            </label>
            <Input id={`od-${name}`} name={name} defaultValue={value} />
          </div>
        ))}
      </div>
      <Submit pending={pending} label="Salvar dados" busy="Salvando..." />
    </form>
  );
}
