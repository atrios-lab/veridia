import { generateKeyPairSync } from "node:crypto";
import forge from "node-forge";

/**
 * A made-up certification chain for the tests alone ("AC Teste Veridia"),
 * shaped like ICP-Brasil's: the holder's CN reads "NAME:DIGITS". Nothing
 * here is a real person or a real authority.
 */

function keyPair() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  return {
    privateKey: forge.pki.privateKeyFromPem(
      privateKey.export({ type: "pkcs1", format: "pem" }).toString(),
    ),
    publicKey: forge.pki.publicKeyFromPem(
      publicKey.export({ type: "spki", format: "pem" }).toString(),
    ),
  };
}

function certificate(options: {
  subjectCn: string;
  issuer?: { cert: forge.pki.Certificate; key: forge.pki.rsa.PrivateKey };
  keys: ReturnType<typeof keyPair>;
  ca: boolean;
  serial: string;
}): forge.pki.Certificate {
  const cert = forge.pki.createCertificate();
  cert.publicKey = options.keys.publicKey;
  cert.serialNumber = options.serial;
  cert.validity.notBefore = new Date("2026-01-01T00:00:00Z");
  cert.validity.notAfter = new Date("2036-01-01T00:00:00Z");
  const subject = [
    { name: "countryName", value: "BR" },
    { name: "organizationName", value: "ICP-Teste" },
    { name: "commonName", value: options.subjectCn },
  ];
  cert.setSubject(subject);
  cert.setIssuer(
    options.issuer ? options.issuer.cert.subject.attributes : subject,
  );
  cert.setExtensions([
    { name: "basicConstraints", cA: options.ca },
    {
      name: "keyUsage",
      keyCertSign: options.ca,
      cRLSign: options.ca,
      digitalSignature: !options.ca,
      nonRepudiation: !options.ca,
    },
  ]);
  cert.sign(
    options.issuer?.key ?? options.keys.privateKey,
    forge.md.sha256.create(),
  );
  return cert;
}

export interface TestPki {
  caPem: string;
  issue(commonName: string, password: string, serial: string): Buffer;
}

export function createTestPki(): TestPki {
  const caKeys = keyPair();
  const ca = certificate({
    subjectCn: "AC Teste Veridia",
    keys: caKeys,
    ca: true,
    serial: "01",
  });
  return {
    caPem: forge.pki.certificateToPem(ca),
    issue(commonName, password, serial) {
      const keys = keyPair();
      const holder = certificate({
        subjectCn: commonName,
        issuer: { cert: ca, key: caKeys.privateKey },
        keys,
        ca: false,
        serial,
      });
      const p12 = forge.pkcs12.toPkcs12Asn1(
        keys.privateKey,
        [holder, ca],
        password,
        { algorithm: "3des" },
      );
      return Buffer.from(forge.asn1.toDer(p12).getBytes(), "binary");
    },
  };
}
