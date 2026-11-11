"use client";

import { startTransition, useActionState, useEffect } from "react";
import { toast } from "sonner";
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
      className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className="py-2 pr-3 text-left font-bold text-admin-primary">
                O que pode fazer
              </th>
              {roles.map((role) => (
                <th
                  key={role.id}
                  className="px-2 py-2 text-center font-bold text-admin-primary"
                >
                  {role.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.id} className="border-t border-admin-border">
                <td className="py-2 pr-3 text-admin-text">
                  {permission.label}
                </td>
                {roles.map((role) => (
                  <td key={role.id} className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      name={role.id}
                      value={permission.id}
                      defaultChecked={role.granted.includes(permission.id)}
                      aria-label={`${role.label}: ${permission.label}`}
                      className="checkbox-admin"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {state.status === "error" && (
        <p
          role="alert"
          className="mt-3 text-[12.5px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-admin-primary btn-md mt-4"
      >
        {pending ? "Salvando..." : "Salvar permissões"}
      </button>
    </form>
  );
}
