"use client";

import { startTransition, useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "../../../_ui/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../_ui/table.tsx";
import { type RolesState, saveRoles } from "./actions.ts";

const IDLE: RolesState = { status: "idle" };

export function RolesForm({
  roles,
  permissions,
}: {
  roles: { id: string; label: string; granted: readonly string[] }[];
  permissions: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(saveRoles, IDLE);
  useEffect(() => {
    if (state.status === "saved") toast.success("Permissões salvas.");
  }, [state]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="rounded-xl border bg-card px-5 py-4"
    >
      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pr-3 pl-0 text-xs text-muted-foreground">
              O que pode fazer
            </TableHead>
            {roles.map((role) => (
              <TableHead
                key={role.id}
                className="text-center text-xs text-muted-foreground"
              >
                {role.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {permissions.map((permission) => (
            <TableRow key={permission.id}>
              <TableCell className="pr-3 pl-0 whitespace-normal text-foreground">
                {permission.label}
              </TableCell>
              {roles.map((role) => (
                <TableCell key={role.id} className="text-center">
                  <input
                    type="checkbox"
                    name={role.id}
                    value={permission.id}
                    defaultChecked={role.granted.includes(permission.id)}
                    aria-label={`${role.label}: ${permission.label}`}
                    className="checkbox-admin"
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {state.status === "error" && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="mt-4">
        {pending ? "Salvando..." : "Salvar permissões"}
      </Button>
    </form>
  );
}
