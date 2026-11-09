import type { Tenant } from "../tenant/schema.ts";
import type { GuideSettings } from "./schema.ts";

/** The RN's ITCD law, as read in the Assembleia's text (Lei 9.993/2015). */
export const ITCD_RN_LAW =
  "Lei Estadual nº 5.887, de 15 de fevereiro de 1989, art. 7º, com a redação da Lei nº 9.993, de 29 de outubro de 2015";

/**
 * Where an office's guias start before it saves its own settings: its town
 * and state from the registration, the RN's ITCD law and table, the
 * municipal laudêmio of the Código Civil de 1916 (2,5%), and whatever its
 * own papers already said (`guideDefaults`). An ITIV without a law or a
 * rate is left blank on purpose: the screen asks for it rather than guess.
 */
export function defaultGuideSettings(tenant: Tenant): GuideSettings {
  const town = `${tenant.location.city}/${tenant.location.state}`;
  const own = tenant.guideDefaults ?? {};
  return {
    municipal: {
      authority: `Prefeitura Municipal de ${town}`,
      cnpj: own.prefeituraCnpj ?? "",
      addressee: "Secretaria Municipal de Tributação / Finanças",
      itivLaw: own.itivLaw ?? "",
      itivRateBasisPoints: own.itivRateBasisPoints ?? 0,
      laudemioLaw: "Código Civil de 1916, art. 686",
      laudemioRateBasisPoints: 250,
    },
    state: {
      addressee:
        "Coordenadoria de Arrecadação, Controle e Estatística (CACE) da Secretaria de Estado da Tributação do Rio Grande do Norte (SET/RN)",
      addresseeName: "",
      itcdLaw: ITCD_RN_LAW,
      itcdRateBasisPoints: 300,
    },
    signers: own.signers?.length
      ? own.signers
      : [
          {
            name: tenant.holderName ?? tenant.owner.name,
            title: tenant.holderTitle ?? "Titular",
            note: "",
          },
        ],
  };
}
