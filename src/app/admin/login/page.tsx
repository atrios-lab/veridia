import { redirect } from "next/navigation";
import { getSession } from "@/lib/session.ts";
import { signIn } from "../actions.ts";

export const metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; next?: string }>;
}) {
  if (await getSession()) redirect("/admin");
  const { erro, next } = await searchParams;

  return (
    <main>
      <h1>Entrar</h1>
      {erro === "limite" && (
        <p role="alert">Muitas tentativas. Tente novamente em instantes.</p>
      )}
      {erro === "1" && <p role="alert">E-mail ou senha inválidos.</p>}
      <form action={signIn}>
        <input type="hidden" name="next" value={next ?? "/admin"} />
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required />
        <label htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" required />
        <button type="submit">Entrar</button>
      </form>
    </main>
  );
}
