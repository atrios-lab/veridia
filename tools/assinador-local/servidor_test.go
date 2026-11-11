package main

import (
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"
)

// tokenFalso faz o papel do token: guarda a chave e assina o resumo.
type tokenFalso struct {
	chave  *rsa.PrivateKey
	der    []byte
	pedido int
}

func novoToken(t *testing.T) *tokenFalso {
	chave, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	modelo := &x509.Certificate{
		SerialNumber: big.NewInt(7),
		Subject:      pkix.Name{CommonName: "JOAO FICTICIO DE SOUZA:11144477735"},
		Issuer:       pkix.Name{CommonName: "AC Teste"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(24 * time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageContentCommitment,
	}
	der, err := x509.CreateCertificate(rand.Reader, modelo, modelo, &chave.PublicKey, chave)
	if err != nil {
		t.Fatal(err)
	}
	return &tokenFalso{chave: chave, der: der}
}

func (f *tokenFalso) Listar() ([]Certificado, error) {
	c, _ := resumir(f.der, [][]byte{f.der}, time.Now())
	return []Certificado{c}, nil
}

func (f *tokenFalso) Assinar(id string, resumo []byte) ([]byte, error) {
	f.pedido++
	if id != impressao(f.der) {
		return nil, ErrNaoEncontrado
	}
	return rsa.SignPKCS1v15(rand.Reader, f.chave, crypto.SHA256, resumo)
}

func pedir(s http.Handler, metodo, caminho, origem string, corpo any) *httptest.ResponseRecorder {
	var leitor *bytes.Reader
	if corpo != nil {
		dados, _ := json.Marshal(corpo)
		leitor = bytes.NewReader(dados)
	} else {
		leitor = bytes.NewReader(nil)
	}
	r := httptest.NewRequest(metodo, "http://127.0.0.1:47820"+caminho, leitor)
	if origem != "" {
		r.Header.Set("Origin", origem)
	}
	w := httptest.NewRecorder()
	s.ServeHTTP(w, r)
	return w
}

func TestSiteSoUsaOsCertificadosDepoisDeAprovado(t *testing.T) {
	token := novoToken(t)
	respostas := []bool{false, true, true}
	perguntas := 0
	s := NovoServidor(token, CarregarOrigens(filepath.Join(t.TempDir(), "sites.json")),
		func(string, string) bool { perguntas++; r := respostas[0]; respostas = respostas[1:]; return r })

	// O status responde a qualquer site https (o painel descobre o programa).
	if w := pedir(s, "GET", "/v1/status", "https://cartorio.exemplo", nil); w.Code != 200 ||
		w.Header().Get("Access-Control-Allow-Private-Network") != "true" {
		t.Fatalf("status: %d %v", w.Code, w.Header())
	}
	// Site http que não é localhost: barrado.
	if w := pedir(s, "GET", "/v1/status", "http://cartorio.exemplo", nil); w.Code != 403 {
		t.Fatalf("http aceito: %d", w.Code)
	}
	// A pessoa recusa: nada sai, e não pergunta de novo enquanto aberto.
	if w := pedir(s, "GET", "/v1/certificados", "https://golpe.exemplo", nil); w.Code != 403 {
		t.Fatalf("recusado listou: %d", w.Code)
	}
	if w := pedir(s, "GET", "/v1/certificados", "https://golpe.exemplo", nil); w.Code != 403 || perguntas != 1 {
		t.Fatalf("perguntou de novo: %d %d", w.Code, perguntas)
	}
	// Aprova o site do cartório: lista, e a aprovação fica guardada.
	w := pedir(s, "GET", "/v1/certificados", "https://cartorio.exemplo", nil)
	if w.Code != 200 {
		t.Fatalf("listar: %d %s", w.Code, w.Body)
	}
	var lista struct{ Certificados []Certificado }
	_ = json.Unmarshal(w.Body.Bytes(), &lista)
	if len(lista.Certificados) != 1 || lista.Certificados[0].Nome != "JOAO FICTICIO DE SOUZA:11144477735" {
		t.Fatalf("lista: %+v", lista)
	}

	// Assina: confirma uma vez e o lote segue sem perguntar.
	dados := []byte("atributos assinados fictícios")
	corpo := map[string]string{"id": lista.Certificados[0].ID, "dados": base64.StdEncoding.EncodeToString(dados)}
	for i := 0; i < 2; i++ {
		w = pedir(s, "POST", "/v1/assinar", "https://cartorio.exemplo", corpo)
		if w.Code != 200 {
			t.Fatalf("assinar: %d %s", w.Code, w.Body)
		}
	}
	if perguntas != 3 {
		t.Fatalf("perguntas: %d", perguntas)
	}
	var resposta struct{ Assinatura string }
	_ = json.Unmarshal(w.Body.Bytes(), &resposta)
	assinatura, _ := base64.StdEncoding.DecodeString(resposta.Assinatura)
	resumo := sha256.Sum256(dados)
	if err := rsa.VerifyPKCS1v15(&token.chave.PublicKey, crypto.SHA256, resumo[:], assinatura); err != nil {
		t.Fatalf("assinatura não confere: %v", err)
	}
	// Outro processo lendo o arquivo encontra o site aprovado.
	if !CarregarOrigens(s.origens.arquivo).Aprovada("https://cartorio.exemplo") {
		t.Fatal("aprovação não guardada")
	}
}

func TestPedidoEnderecadoAOutroHostEBarrado(t *testing.T) {
	s := NovoServidor(novoToken(t), CarregarOrigens(""), func(string, string) bool { return true })
	r := httptest.NewRequest("GET", "http://golpe.exemplo:47820/v1/status", nil)
	w := httptest.NewRecorder()
	s.ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatalf("rebinding aceito: %d", w.Code)
	}
}

func TestCertificadoVencidoOuDeACNaoAparece(t *testing.T) {
	token := novoToken(t)
	if _, ok := resumir(token.der, nil, time.Now().Add(48*time.Hour)); ok {
		t.Fatal("vencido apareceu")
	}
	if _, ok := resumir([]byte("lixo"), nil, time.Now()); ok {
		t.Fatal("ilegível apareceu")
	}
}
