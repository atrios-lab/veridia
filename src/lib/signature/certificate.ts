import "server-only";
import { createHash } from "node:crypto";
import forge from "node-forge";

/**
 * An A1 certificate opened with its password: the holder's key and the
 * certificates the file carries (the holder's and, usually, its chain).
 * Opened only for the instant of a signature or of the upload check, never
 * kept: the password is typed every time (product decision of 10/11/2026).
 */
export interface OpenedCertificate {
  privateKey: forge.pki.rsa.PrivateKey;
  /** The holder's certificate, DER. */
  holderDer: Buffer;
  /** The holder's and every other certificate in the file, DER. */
  chainDer: Buffer[];
  info: CertificateInfo;
}

export interface CertificateInfo {
  holderName: string;
  /** CPF (11) or CNPJ (14) digits, from the ICP-Brasil subject; "" if none. */
  holderDocument: string;
  kind: "cpf" | "cnpj" | "outro";
  issuerName: string;
  serialHex: string;
  notBefore: Date;
  notAfter: Date;
  /** SHA-256 of the holder's certificate, hex: the certificate's identity. */
  fingerprint: string;
}

export class CertificatePasswordError extends Error {}
export class CertificateFileError extends Error {}

function derOf(cert: forge.pki.Certificate): Buffer {
  return Buffer.from(
    forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(),
    "binary",
  );
}

function isCa(cert: forge.pki.Certificate): boolean {
  const constraints = cert.getExtension("basicConstraints") as
    | { cA?: boolean }
    | undefined;
  return Boolean(constraints?.cA);
}

/**
 * ICP-Brasil writes the holder in the subject's CN as "NAME:DIGITS": eleven
 * digits for an e-CPF, fourteen for an e-CNPJ.
 */
export function holderOf(commonName: string): {
  name: string;
  document: string;
  kind: CertificateInfo["kind"];
} {
  const match = /^(.*?):(\d{11}|\d{14})$/.exec(commonName.trim());
  if (!match) return { name: commonName.trim(), document: "", kind: "outro" };
  return {
    name: match[1].trim(),
    document: match[2],
    kind: match[2].length === 11 ? "cpf" : "cnpj",
  };
}

/** Opens the .pfx/.p12; a wrong password and a broken file read apart. */
export function openCertificate(
  pfx: Buffer,
  password: string,
): OpenedCertificate {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const asn1 = forge.asn1.fromDer(pfx.toString("binary"));
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
    } catch {
      throw new CertificatePasswordError("Senha do certificado incorreta.");
    }
  } catch (error) {
    if (error instanceof CertificatePasswordError) throw error;
    throw new CertificateFileError(
      "O arquivo não é um certificado A1 válido (.pfx ou .p12).",
    );
  }

  const certs = (
    p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ??
    []
  )
    .map((bag) => bag.cert)
    .filter((cert): cert is forge.pki.Certificate => Boolean(cert));
  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] ?? []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[
      forge.pki.oids.keyBag
    ] ?? []),
  ];
  const privateKey = keyBags.find((bag) => bag.key)?.key as
    | forge.pki.rsa.PrivateKey
    | undefined;
  if (!privateKey || !("n" in privateKey)) {
    throw new CertificateFileError(
      "O certificado não traz uma chave RSA para assinar.",
    );
  }

  // The holder's certificate is the one whose public key matches the key.
  const holder =
    certs.find((cert) => {
      const pub = cert.publicKey as forge.pki.rsa.PublicKey;
      return (
        "n" in pub && pub.n.equals(privateKey.n) && pub.e.equals(privateKey.e)
      );
    }) ?? certs.find((cert) => !isCa(cert));
  if (!holder) {
    throw new CertificateFileError(
      "O arquivo não traz o certificado do titular.",
    );
  }

  const holderDer = derOf(holder);
  const cn = String(holder.subject.getField("CN")?.value ?? "");
  const who = holderOf(cn);
  return {
    privateKey,
    holderDer,
    chainDer: [holderDer, ...certs.filter((c) => c !== holder).map(derOf)],
    info: {
      holderName: who.name,
      holderDocument: who.document,
      kind: who.kind,
      issuerName: String(holder.issuer.getField("CN")?.value ?? ""),
      serialHex: holder.serialNumber.toLowerCase(),
      notBefore: holder.validity.notBefore,
      notAfter: holder.validity.notAfter,
      fingerprint: createHash("sha256").update(holderDer).digest("hex"),
    },
  };
}
