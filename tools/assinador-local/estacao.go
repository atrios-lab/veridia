package main

// Estação de assinatura: o computador onde o token A3 fica plugado assina
// para as outras pessoas do cartório que o Tabelião autorizou. O programa
// liga para a plataforma (nada entra no computador: nenhuma porta aberta),
// conta quais certificados estão plugados, recebe os pedidos de assinatura
// e devolve só a assinatura. A chave nunca sai do token; o PIN é pedido
// pelo driver do token, aqui, neste computador.

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

// IntervaloDaEstacao é a pausa entre duas conversas com a plataforma.
const IntervaloDaEstacao = 3 * time.Second

// ConfigEstacao é o que o pareamento guarda: o endereço do painel do
// cartório, a chave que a plataforma deu a esta estação e o nome dela.
type ConfigEstacao struct {
	Plataforma string `json:"plataforma"`
	Chave      string `json:"chave"`
	Nome       string `json:"nome"`
}

// Tarefa é um pedido de assinatura vindo da plataforma.
type Tarefa struct {
	ID            string `json:"id"`
	CertificadoID string `json:"certificadoId"`
	Dados         string `json:"dados"`
	// Modo "cada": pergunta aqui antes de assinar; "periodo": o Tabelião
	// liberou o uso por um tempo, assina sem perguntar.
	Modo      string `json:"modo"`
	PedidoPor string `json:"pedidoPor"`
	Titulo    string `json:"titulo"`
}

// Estacao conversa com a plataforma enquanto estiver configurada.
type Estacao struct {
	repo      Repositorio
	confirmar func(titulo, texto string) bool
	arquivo   string
	cliente   *http.Client

	mu     sync.Mutex
	config *ConfigEstacao
	ultima time.Time
	erro   string
}

func NovaEstacao(repo Repositorio, arquivo string, confirmar func(string, string) bool) *Estacao {
	e := &Estacao{
		repo:      repo,
		confirmar: confirmar,
		arquivo:   arquivo,
		cliente:   &http.Client{Timeout: 30 * time.Second},
	}
	if dados, err := os.ReadFile(arquivo); err == nil {
		var c ConfigEstacao
		if json.Unmarshal(dados, &c) == nil && c.Plataforma != "" && c.Chave != "" {
			e.config = &c
		}
	}
	return e
}

// Configurar pareia esta estação com o painel que pediu (o site já aprovado
// pela pessoa neste computador). Só o próprio site pode se indicar.
func (e *Estacao) Configurar(origem string, c ConfigEstacao) error {
	if c.Chave == "" || len(c.Chave) > 200 {
		return errors.New("chave da estação inválida")
	}
	alvo, err := url.Parse(c.Plataforma)
	if err != nil || alvo.Scheme+"://"+alvo.Host != strings.TrimRight(origem, "/") {
		return errors.New("a estação só pode ser ligada ao próprio site que pediu")
	}
	c.Plataforma = strings.TrimRight(origem, "/")
	if len(c.Nome) > 120 {
		c.Nome = c.Nome[:120]
	}
	dados, _ := json.Marshal(c)
	if err := os.WriteFile(e.arquivo, dados, 0o600); err != nil {
		return err
	}
	e.mu.Lock()
	e.config = &c
	e.erro = ""
	e.mu.Unlock()
	return nil
}

// Desligar faz deste computador um computador comum de novo.
func (e *Estacao) Desligar() {
	_ = os.Remove(e.arquivo)
	e.mu.Lock()
	e.config = nil
	e.mu.Unlock()
}

// Situacao é o que o painel mostra no computador da estação.
func (e *Estacao) Situacao() map[string]any {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.config == nil {
		return map[string]any{"ativa": false}
	}
	return map[string]any{
		"ativa":      true,
		"plataforma": e.config.Plataforma,
		"nome":       e.config.Nome,
		"ultima":     e.ultima,
		"erro":       e.erro,
	}
}

// Rodar conversa com a plataforma para sempre, de IntervaloDaEstacao em
// IntervaloDaEstacao, enquanto houver configuração.
func (e *Estacao) Rodar() {
	for {
		e.Passo()
		time.Sleep(IntervaloDaEstacao)
	}
}

// Passo é uma conversa: conta os certificados, recebe os pedidos e assina.
func (e *Estacao) Passo() {
	e.mu.Lock()
	config := e.config
	e.mu.Unlock()
	if config == nil {
		return
	}
	lista, err := e.repo.Listar()
	if err != nil {
		log.Printf("estação: listar: %v", err)
		lista = []Certificado{}
	}
	var resposta struct {
		Tarefas []Tarefa `json:"tarefas"`
	}
	if err := e.enviar(config, "/api/estacao/pulso", map[string]any{
		"versao":       Versao,
		"certificados": lista,
	}, &resposta); err != nil {
		e.anotar(err.Error())
		return
	}
	e.anotar("")
	for _, tarefa := range resposta.Tarefas {
		e.cumprir(config, tarefa)
	}
}

func (e *Estacao) anotar(erro string) {
	e.mu.Lock()
	e.erro = erro
	if erro == "" {
		e.ultima = time.Now()
	}
	e.mu.Unlock()
}

// cumprir assina um pedido (perguntando antes, no modo "cada") e devolve
// a assinatura, ou o motivo de não assinar.
func (e *Estacao) cumprir(config *ConfigEstacao, tarefa Tarefa) {
	resultado := map[string]string{}
	dados, err := base64.StdEncoding.DecodeString(tarefa.Dados)
	switch {
	case err != nil || len(dados) == 0 || len(dados) > 16<<10:
		resultado["erro"] = "dados inválidos"
	case tarefa.Modo != "periodo" && !e.confirmar("Assinador Veridia: estação de assinatura",
		fmt.Sprintf("%s pediu para assinar \"%s\" com o certificado deste computador.\n\nAssinar agora?",
			limitar(tarefa.PedidoPor, 80), limitar(tarefa.Titulo, 160))):
		resultado["erro"] = "recusada na estação"
	default:
		resumo := sha256.Sum256(dados)
		assinatura, err := e.repo.Assinar(tarefa.CertificadoID, resumo[:])
		switch {
		case errors.Is(err, ErrCancelado):
			resultado["erro"] = "assinatura cancelada no token"
		case errors.Is(err, ErrNaoEncontrado):
			resultado["erro"] = "o token não está conectado na estação"
		case err != nil:
			log.Printf("estação: assinar: %v", err)
			resultado["erro"] = "o token não assinou"
		default:
			resultado["assinatura"] = base64.StdEncoding.EncodeToString(assinatura)
		}
	}
	if err := e.enviar(config, "/api/estacao/tarefas/"+url.PathEscape(tarefa.ID), resultado, nil); err != nil {
		log.Printf("estação: devolver %s: %v", tarefa.ID, err)
	}
}

func limitar(texto string, max int) string {
	if len([]rune(texto)) <= max {
		return texto
	}
	return string([]rune(texto)[:max]) + "…"
}

func (e *Estacao) enviar(config *ConfigEstacao, caminho string, corpo any, destino any) error {
	dados, _ := json.Marshal(corpo)
	pedido, err := http.NewRequest(http.MethodPost, config.Plataforma+caminho, bytes.NewReader(dados))
	if err != nil {
		return err
	}
	pedido.Header.Set("Content-Type", "application/json")
	pedido.Header.Set("Authorization", "Bearer "+config.Chave)
	resposta, err := e.cliente.Do(pedido)
	if err != nil {
		return fmt.Errorf("sem conexão com a plataforma")
	}
	defer resposta.Body.Close()
	if resposta.StatusCode == http.StatusUnauthorized || resposta.StatusCode == http.StatusForbidden {
		return fmt.Errorf("a plataforma não reconhece mais esta estação: ligue de novo pelo painel")
	}
	if resposta.StatusCode >= 300 {
		return fmt.Errorf("a plataforma respondeu %d", resposta.StatusCode)
	}
	if destino == nil {
		return nil
	}
	return json.NewDecoder(io.LimitReader(resposta.Body, 4<<20)).Decode(destino)
}
