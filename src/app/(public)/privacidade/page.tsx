import Link from "next/link";
import { DATA_RIGHTS_DEADLINE_DAYS } from "@/core/request/channels.ts";
import { getTenant } from "@/lib/tenant.ts";

export const metadata = { title: "Política de Privacidade" };

// Fixed institutional text, shared by every tenant; only the office's own
// data (name, contacts, DPO) is interpolated. See design.md, "Estrutura
// fixa, dados variáveis por tenant".
export default async function PrivacyPolicyPage() {
  const tenant = await getTenant();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-10 md:py-16">
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent-ink">
        {tenant.name}
      </span>
      <h1 className="mt-2 font-serif text-2xl font-semibold text-brand-primary md:text-3xl">
        Política de Privacidade
      </h1>
      <p className="mt-3 max-w-[65ch] leading-relaxed text-brand-muted">
        Esta política explica quais dados pessoais a serventia coleta pelo site,
        para quê e por quanto tempo, além dos seus direitos como titular,
        conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).
      </p>

      <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-brand-text-soft">
        <section>
          <h2 className="font-serif text-lg font-semibold text-brand-primary">
            Quais dados coletamos e por quê
          </h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            <li>
              <strong className="text-brand-text">Pedido de serviço:</strong>{" "}
              nome, contato e os documentos enviados para instruir o ato
              solicitado, para dar andamento e resposta ao seu pedido.
            </li>
            <li>
              <strong className="text-brand-text">Agendamento:</strong> nome e
              contato, para reservar seu horário no balcão.
            </li>
            <li>
              <strong className="text-brand-text">Ouvidoria:</strong> nome,
              contato e o relato enviado, para apurar e responder sua
              manifestação.
            </li>
            <li>
              <strong className="text-brand-text">Canal LGPD:</strong> os dados
              necessários para identificar o titular e atender o pedido de
              acesso, correção ou exclusão.
            </li>
            <li>
              <strong className="text-brand-text">Chat de atendimento:</strong>{" "}
              nome, contato e o conteúdo da conversa, para o atendimento pelo
              balcão.
            </li>
          </ul>
          <p className="mt-3">
            A base legal é a execução de serviço público (art. 7º, III, da LGPD)
            ou o cumprimento de obrigação legal do registro público, conforme o
            canal.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-brand-primary">
            Por quanto tempo guardamos
          </h2>
          <p>
            Atos registrais (registros, averbações, certidões) têm guarda
            obrigatória por prazo indeterminado, por força de lei: a exclusão
            desses dados não é possível. Os demais dados, como manifestações de
            ouvidoria e conversas de atendimento, são mantidos pelo prazo
            necessário à finalidade e à guarda legal aplicável.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-brand-primary">
            Seus direitos como titular
          </h2>
          <p>
            Você pode pedir acesso, correção ou exclusão dos seus dados, e tirar
            outras dúvidas sobre o tratamento, pelo{" "}
            <Link
              href="/lgpd"
              className="font-semibold text-brand-primary-soft hover:underline"
            >
              canal LGPD
            </Link>
            . A serventia responde em até {DATA_RIGHTS_DEADLINE_DAYS} dias, como
            manda a Lei 13.709/2018. A correção alcança o seu cadastro, não o
            registro público, e a exclusão não se aplica a atos registrais.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-brand-primary">
            Encarregado de Dados (DPO)
          </h2>
          <p>
            Em atendimento ao art. 41, §3º da LGPD, o Encarregado pelo
            Tratamento de Dados desta serventia é:
          </p>
          <p className="mt-2 rounded-2xl border border-brand-border bg-brand-card px-4 py-3.5">
            <span className="block font-bold text-brand-primary">
              {tenant.dpo.name}
            </span>
            <span className="block text-brand-primary-soft">
              {tenant.dpo.email}
            </span>
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-brand-primary">
            Cookies
          </h2>
          <p>
            Este site usa apenas cookies essenciais ao seu funcionamento: um
            cookie de sessão para o acesso do cartório ao painel administrativo
            e um cookie técnico para manter sua conversa no chat de atendimento.
            Nenhum desses cookies é usado para rastreamento ou publicidade, e o
            site não usa cookies de terceiros.
          </p>
        </section>
      </div>
    </div>
  );
}
