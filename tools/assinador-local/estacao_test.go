package main

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

// plataformaFalsa faz o papel do painel: entrega tarefas no pulso e
// guarda o que a estação devolve.
type plataformaFalsa struct {
	mu        sync.Mutex
	chave     string
	tarefas   []Tarefa
	resultado map[string]map[string]string
	pulsos    int
	recebidos []Certificado
}

func (p *plataformaFalsa) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if r.Header.Get("Authorization") != "Bearer "+p.chave {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	switch {
	case r.URL.Path == "/api/estacao/pulso":
		var corpo struct {
			Certificados []Certificado `json:"certificados"`
		}
		_ = json.NewDecoder(r.Body).Decode(&corpo)
		p.recebidos = corpo.Certificados
		p.pulsos++
		_ = json.NewEncoder(w).Encode(map[string]any{"tarefas": p.tarefas})
		p.tarefas = nil
	case strings.HasPrefix(r.URL.Path, "/api/estacao/tarefas/"):
		var corpo map[string]string
		_ = json.NewDecoder(r.Body).Decode(&corpo)
		p.resultado[strings.TrimPrefix(r.URL.Path, "/api/estacao/tarefas/")] = corpo
		w.WriteHeader(http.StatusNoContent)
	default:
		w.WriteHeader(http.StatusNotFound)
	}
}

func estacaoDeTeste(t *testing.T, token *tokenFalso, confirmar func(string, string) bool) (*Estacao, *plataformaFalsa, string) {
	plataforma := &plataformaFalsa{chave: "chave-ficticia", resultado: map[string]map[string]string{}}
	servidor := httptest.NewServer(plataforma)
	t.Cleanup(servidor.Close)
	e := NovaEstacao(token, filepath.Join(t.TempDir(), "estacao.json"), confirmar)
	if err := e.Configurar(servidor.URL, ConfigEstacao{Plataforma: servidor.URL, Chave: "chave-ficticia", Nome: "Balcão 1"}); err != nil {
		t.Fatal(err)
	}
	return e, plataforma, servidor.URL
}

func TestEstacaoSoSeLigaAoProprioSite(t *testing.T) {
	e := NovaEstacao(novoToken(t), filepath.Join(t.TempDir(), "estacao.json"), nil)
	err := e.Configurar("https://cartorio.exemplo", ConfigEstacao{Plataforma: "https://golpe.exemplo", Chave: "x"})
	if err == nil {
		t.Fatal("ligou a estação a outro site")
	}
	if err := e.Configurar("https://cartorio.exemplo", ConfigEstacao{Plataforma: "https://cartorio.exemplo/admin", Chave: "x", Nome: "Balcão"}); err != nil {
		t.Fatal(err)
	}
	// A configuração sobrevive a reabrir o programa.
	deNovo := NovaEstacao(novoToken(t), e.arquivo, nil)
	if deNovo.Situacao()["ativa"] != true || deNovo.Situacao()["plataforma"] != "https://cartorio.exemplo" {
		t.Fatalf("configuração perdida: %v", deNovo.Situacao())
	}
	deNovo.Desligar()
	if NovaEstacao(novoToken(t), e.arquivo, nil).Situacao()["ativa"] != false {
		t.Fatal("desligar não desligou")
	}
}

func TestEstacaoLiberadaAssinaEDevolveSoAAssinatura(t *testing.T) {
	token := novoToken(t)
	perguntou := false
	e, plataforma, _ := estacaoDeTeste(t, token, func(string, string) bool { perguntou = true; return true })
	dados := []byte("atributos assinados de teste")
	plataforma.tarefas = []Tarefa{{
		ID: "t1", CertificadoID: impressao(token.der), Dados: base64.StdEncoding.EncodeToString(dados),
		Modo: "periodo", PedidoPor: "Escrevente Fictícia", Titulo: "Certidão de teste",
	}}
	e.Passo()
	if perguntou {
		t.Fatal("no modo liberado por período não pergunta")
	}
	if len(plataforma.recebidos) != 1 {
		t.Fatalf("a estação não contou o certificado: %v", plataforma.recebidos)
	}
	assinatura, err := base64.StdEncoding.DecodeString(plataforma.resultado["t1"]["assinatura"])
	if err != nil || len(assinatura) == 0 {
		t.Fatalf("sem assinatura: %v", plataforma.resultado["t1"])
	}
	certificado, _ := x509.ParseCertificate(token.der)
	resumo := sha256.Sum256(dados)
	if err := rsa.VerifyPKCS1v15(certificado.PublicKey.(*rsa.PublicKey), crypto.SHA256, resumo[:], assinatura); err != nil {
		t.Fatalf("assinatura não confere: %v", err)
	}
}

func TestEstacaoComConfirmacaoPerguntaERespeitaORecusar(t *testing.T) {
	token := novoToken(t)
	var pergunta string
	e, plataforma, _ := estacaoDeTeste(t, token, func(_ string, texto string) bool { pergunta = texto; return false })
	plataforma.tarefas = []Tarefa{{
		ID: "t2", CertificadoID: impressao(token.der), Dados: base64.StdEncoding.EncodeToString([]byte("x")),
		Modo: "cada", PedidoPor: "Escrevente Fictícia", Titulo: "Nota devolutiva",
	}}
	e.Passo()
	if !strings.Contains(pergunta, "Escrevente Fictícia") || !strings.Contains(pergunta, "Nota devolutiva") {
		t.Fatalf("a pergunta não diz quem pediu e o quê: %q", pergunta)
	}
	if token.pedido != 0 {
		t.Fatal("assinou sem a confirmação")
	}
	if plataforma.resultado["t2"]["erro"] != "recusada na estação" {
		t.Fatalf("resultado: %v", plataforma.resultado["t2"])
	}
}

func TestEstacaoPareadaPeloPainelDoComputador(t *testing.T) {
	token := novoToken(t)
	origens := CarregarOrigens(filepath.Join(t.TempDir(), "sites.json"))
	origens.Aprovar("https://cartorio.exemplo")
	estacao := NovaEstacao(token, filepath.Join(t.TempDir(), "estacao.json"), nil)
	// A pessoa diz sim ao cartório e não ao site que não conhece.
	s := NovoServidor(token, origens, func(_ string, texto string) bool {
		return !strings.Contains(texto, "golpe")
	}).ComEstacao(estacao)
	w := pedir(s, "POST", "/v1/estacao", "https://cartorio.exemplo", ConfigEstacao{
		Plataforma: "https://cartorio.exemplo", Chave: "chave-ficticia", Nome: "Balcão 1",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("pareamento: %d %s", w.Code, w.Body.String())
	}
	if estacao.Situacao()["ativa"] != true {
		t.Fatal("estação não ficou ativa")
	}
	// Outro site, não aprovado, não mexe na estação.
	if w := pedir(s, "POST", "/v1/estacao/desligar", "https://golpe.exemplo", nil); w.Code == http.StatusOK {
		t.Fatal("site não aprovado desligou a estação")
	}
}
