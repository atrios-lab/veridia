//go:build !windows

package main

import (
	"errors"
	"fmt"
	"strings"
)

// Fora do Windows o assinador só serve para testes: sem repositório de
// certificados nem janelas.
type semRepositorio struct{}

func novoRepositorio() Repositorio { return semRepositorio{} }

func (semRepositorio) Listar() ([]Certificado, error) {
	return nil, errors.New("o Assinador Veridia funciona no Windows")
}

func (semRepositorio) Assinar(string, []byte) ([]byte, error) {
	return nil, errors.New("o Assinador Veridia funciona no Windows")
}

func confirmar(titulo, texto string) bool { return false }

func avisar(titulo, texto string) { fmt.Println(titulo + ": " + texto) }

func instalar() bool { return false }

func emUso(err error) bool { return strings.Contains(err.Error(), "address already in use") }
