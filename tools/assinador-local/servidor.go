package main

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// Versao do Assinador Veridia, mostrada no painel.
const Versao = "1.0.0"

// Porta fixa: o painel procura o assinador nela.
const Porta = 47820

// JanelaDeAssinatura é quanto tempo, depois de a pessoa confirmar, um site
// aprovado assina sem perguntar de novo (um lote de documentos).
const JanelaDeAssinatura = 2 * time.Minute

// Servidor responde só no próprio computador (127.0.0.1) e só a sites
// que a pessoa aprovou na primeira vez.
type Servidor struct {
	repo      Repositorio
	origens   *Origens
	confirmar func(titulo, texto string) bool
	agora     func() time.Time

	mu        sync.Mutex
	perguntas sync.Mutex
	liberado  map[string]time.Time
}

func NovoServidor(repo Repositorio, origens *Origens, confirmar func(string, string) bool) *Servidor {
	return &Servidor{
		repo:      repo,
		origens:   origens,
		confirmar: confirmar,
		agora:     time.Now,
		liberado:  map[string]time.Time{},
	}
}

// origemValida aceita sites https e, para testes, http://localhost.
func origemValida(origem string) bool {
	u, err := url.Parse(origem)
	if err != nil || u.Host == "" || u.Path != "" {
		return false
	}
	host := u.Hostname()
	if u.Scheme == "https" {
		return true
	}
	return u.Scheme == "http" && (host == "localhost" || strings.HasSuffix(host, ".localhost"))
}

// hostLocal barra o "DNS rebinding": o pedido tem de vir endereçado ao
// próprio computador.
func hostLocal(host string) bool {
	h, _, err := net.SplitHostPort(host)
	if err != nil {
		h = host
	}
	return h == "127.0.0.1" || h == "localhost"
}

func responder(w http.ResponseWriter, status int, corpo any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(corpo)
}

func erro(w http.ResponseWriter, status int, mensagem string) {
	responder(w, status, map[string]string{"erro": mensagem})
}

func (s *Servidor) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !hostLocal(r.Host) {
		erro(w, http.StatusForbidden, "endereço não permitido")
		return
	}
	origem := r.Header.Get("Origin")
	if origem != "" {
		if !origemValida(origem) {
			erro(w, http.StatusForbidden, "site não permitido")
			return
		}
		h := w.Header()
		h.Set("Access-Control-Allow-Origin", origem)
		h.Set("Vary", "Origin")
		h.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		h.Set("Access-Control-Allow-Headers", "Content-Type")
		// Chrome e Edge pedem isto para um site falar com o computador.
		h.Set("Access-Control-Allow-Private-Network", "true")
		h.Set("Access-Control-Max-Age", "600")
	}
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	switch {
	case r.URL.Path == "/v1/status" && r.Method == http.MethodGet:
		responder(w, http.StatusOK, map[string]string{
			"aplicativo": "Assinador Veridia",
			"versao":     Versao,
		})
	case r.URL.Path == "/v1/certificados" && r.Method == http.MethodGet:
		if !s.aprovada(origem) {
			erro(w, http.StatusForbidden, "este site não foi autorizado no Assinador Veridia")
			return
		}
		lista, err := s.repo.Listar()
		if err != nil {
			log.Printf("listar: %v", err)
			erro(w, http.StatusInternalServerError, err.Error())
			return
		}
		responder(w, http.StatusOK, map[string]any{"certificados": lista})
	case r.URL.Path == "/v1/assinar" && r.Method == http.MethodPost:
		s.assinar(w, r, origem)
	default:
		erro(w, http.StatusNotFound, "não encontrado")
	}
}

// aprovada pergunta à pessoa, uma vez por site, se ele pode usar os
// certificados deste computador. A resposta fica guardada.
func (s *Servidor) aprovada(origem string) bool {
	if origem == "" {
		return false
	}
	if s.origens.Aprovada(origem) {
		return true
	}
	// Uma pergunta de cada vez, mesmo com vários pedidos chegando.
	s.perguntas.Lock()
	defer s.perguntas.Unlock()
	if s.origens.Aprovada(origem) {
		return true
	}
	if s.origens.Recusada(origem) {
		return false
	}
	ok := s.confirmar("Assinador Veridia",
		fmt.Sprintf("O site %s quer usar os certificados digitais deste computador para assinar documentos.\n\nPermitir? Responda Não se você não reconhece este site.", origem))
	if ok {
		s.origens.Aprovar(origem)
	} else {
		s.origens.Recusar(origem)
	}
	return ok
}

type pedidoAssinatura struct {
	ID    string `json:"id"`
	Dados string `json:"dados"`
}

func (s *Servidor) assinar(w http.ResponseWriter, r *http.Request, origem string) {
	if !s.aprovada(origem) {
		erro(w, http.StatusForbidden, "este site não foi autorizado no Assinador Veridia")
		return
	}
	var pedido pedidoAssinatura
	if err := json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(&pedido); err != nil {
		erro(w, http.StatusBadRequest, "pedido inválido")
		return
	}
	dados, err := base64.StdEncoding.DecodeString(pedido.Dados)
	if err != nil || len(dados) == 0 || len(dados) > 16<<10 {
		erro(w, http.StatusBadRequest, "dados inválidos")
		return
	}
	if !s.confirmarLote(origem) {
		erro(w, http.StatusForbidden, ErrCancelado.Error())
		return
	}
	resumo := sha256.Sum256(dados)
	assinatura, err := s.repo.Assinar(pedido.ID, resumo[:])
	switch {
	case errors.Is(err, ErrCancelado):
		erro(w, http.StatusConflict, err.Error())
		return
	case errors.Is(err, ErrNaoEncontrado):
		erro(w, http.StatusNotFound, err.Error())
		return
	case err != nil:
		log.Printf("assinar: %v", err)
		erro(w, http.StatusInternalServerError, err.Error())
		return
	}
	responder(w, http.StatusOK, map[string]string{
		"assinatura": base64.StdEncoding.EncodeToString(assinatura),
	})
}

// confirmarLote pergunta antes de assinar; um lote seguido (dentro de
// JanelaDeAssinatura) não pergunta a cada documento.
func (s *Servidor) confirmarLote(origem string) bool {
	s.mu.Lock()
	ate, ok := s.liberado[origem]
	s.mu.Unlock()
	if ok && s.agora().Before(ate) {
		s.renovar(origem)
		return true
	}
	s.perguntas.Lock()
	defer s.perguntas.Unlock()
	if !s.confirmar("Assinador Veridia",
		fmt.Sprintf("Assinar documentos para %s com o seu certificado digital?", origem)) {
		return false
	}
	s.renovar(origem)
	return true
}

func (s *Servidor) renovar(origem string) {
	s.mu.Lock()
	s.liberado[origem] = s.agora().Add(JanelaDeAssinatura)
	s.mu.Unlock()
}
