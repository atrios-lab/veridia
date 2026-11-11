package main

import (
	"crypto/rsa"
	"crypto/sha1"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"sort"
	"strings"
	"time"
)

// Certificado é o que a plataforma recebe de cada certificado instalado:
// só a parte pública. A chave fica no token ou no cartão.
type Certificado struct {
	// ID é a impressão digital SHA-1, a mesma que o Windows mostra.
	ID          string    `json:"id"`
	Nome        string    `json:"nome"`
	Emissor     string    `json:"emissor"`
	Validade    time.Time `json:"validade"`
	Certificado string    `json:"certificado"`
	Cadeia      []string  `json:"cadeia"`
}

// Repositorio é onde os certificados moram: no Windows, o repositório
// "Pessoal" do usuário, que o driver do token preenche sozinho.
type Repositorio interface {
	Listar() ([]Certificado, error)
	// Assinar assina o resumo SHA-256 com RSA PKCS#1 v1.5. O driver do
	// token pede o PIN.
	Assinar(id string, resumoSHA256 []byte) ([]byte, error)
}

// ErrCancelado é quando a pessoa fecha a janela do PIN.
var ErrCancelado = errors.New("assinatura cancelada no token")

// ErrNaoEncontrado é um certificado que saiu (token retirado).
var ErrNaoEncontrado = errors.New("certificado não encontrado: o token está conectado?")

func impressao(der []byte) string {
	soma := sha1.Sum(der)
	return strings.ToUpper(hex.EncodeToString(soma[:]))
}

// resumir decide se um certificado serve para assinar e monta o que vai
// para a plataforma. Serve: chave RSA, uso de assinatura e dentro da
// validade.
func resumir(der []byte, cadeia [][]byte, agora time.Time) (Certificado, bool) {
	cert, err := x509.ParseCertificate(der)
	if err != nil {
		return Certificado{}, false
	}
	if _, ok := cert.PublicKey.(*rsa.PublicKey); !ok {
		return Certificado{}, false
	}
	if cert.IsCA {
		return Certificado{}, false
	}
	if cert.KeyUsage != 0 &&
		cert.KeyUsage&(x509.KeyUsageDigitalSignature|x509.KeyUsageContentCommitment) == 0 {
		return Certificado{}, false
	}
	if agora.Before(cert.NotBefore) || agora.After(cert.NotAfter) {
		return Certificado{}, false
	}
	resumo := Certificado{
		ID:          impressao(der),
		Nome:        cert.Subject.CommonName,
		Emissor:     cert.Issuer.CommonName,
		Validade:    cert.NotAfter,
		Certificado: base64.StdEncoding.EncodeToString(der),
	}
	for _, c := range cadeia {
		resumo.Cadeia = append(resumo.Cadeia, base64.StdEncoding.EncodeToString(c))
	}
	return resumo, true
}

func ordenar(lista []Certificado) {
	sort.Slice(lista, func(i, j int) bool {
		if lista[i].Nome != lista[j].Nome {
			return lista[i].Nome < lista[j].Nome
		}
		return lista[i].Validade.After(lista[j].Validade)
	})
}
