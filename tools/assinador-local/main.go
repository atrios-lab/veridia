// Assinador Veridia: o programa que fica no computador do cartório e deixa
// a plataforma assinar com certificado A3 (token ou cartão). A plataforma
// prepara o documento; o assinador assina só o resumo, com a chave que
// nunca sai do token; o driver do token pede o PIN.
package main

import (
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"syscall"
	"time"
)

func pasta() string {
	base, err := os.UserConfigDir()
	if err != nil {
		base = os.TempDir()
	}
	return filepath.Join(base, "VeridiaAssinador")
}

func main() {
	dir := pasta()
	_ = os.MkdirAll(dir, 0o700)
	if arquivo, err := os.OpenFile(filepath.Join(dir, "assinador.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600); err == nil {
		log.SetOutput(arquivo)
	}

	// Copia para a pasta do usuário e liga ao iniciar o Windows. Quando
	// isso abre a cópia instalada, esta aqui termina.
	if instalar() {
		return
	}

	ouvinte, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", Porta))
	if err != nil {
		if errors.Is(err, syscall.EADDRINUSE) || emUso(err) {
			avisar("Assinador Veridia", "O Assinador Veridia já está ativo neste computador.")
			return
		}
		avisar("Assinador Veridia", "Não foi possível iniciar o Assinador Veridia: "+err.Error())
		log.Fatal(err)
	}
	if primeiraVez(dir) {
		avisar("Assinador Veridia",
			"O Assinador Veridia está ativo.\n\nEle abre sozinho quando o Windows inicia e encontra os certificados A3 (token ou cartão) instalados, inclusive os que você instalar depois.\n\nVolte ao painel e escolha \"Assinar com certificado A3\".")
	}
	servidor := NovoServidor(novoRepositorio(), CarregarOrigens(filepath.Join(dir, "sites.json")), confirmar)
	log.Printf("Assinador Veridia %s ouvindo em %s", Versao, ouvinte.Addr())
	servico := &http.Server{
		Handler:           servidor,
		ReadHeaderTimeout: 10 * time.Second,
	}
	log.Fatal(servico.Serve(ouvinte))
}

func primeiraVez(dir string) bool {
	marca := filepath.Join(dir, "iniciado")
	if _, err := os.Stat(marca); err == nil {
		return false
	}
	_ = os.WriteFile(marca, []byte(Versao), 0o600)
	return true
}
