package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// Origens guarda os sites que a pessoa aprovou ou recusou, num arquivo
// da pasta do usuário. Recusas valem só enquanto o programa está aberto.
type Origens struct {
	mu       sync.Mutex
	arquivo  string
	aprovada map[string]bool
	recusada map[string]bool
}

func CarregarOrigens(arquivo string) *Origens {
	o := &Origens{arquivo: arquivo, aprovada: map[string]bool{}, recusada: map[string]bool{}}
	if dados, err := os.ReadFile(arquivo); err == nil {
		var lista []string
		if json.Unmarshal(dados, &lista) == nil {
			for _, origem := range lista {
				o.aprovada[origem] = true
			}
		}
	}
	return o
}

func (o *Origens) Aprovada(origem string) bool {
	o.mu.Lock()
	defer o.mu.Unlock()
	return o.aprovada[origem]
}

func (o *Origens) Recusada(origem string) bool {
	o.mu.Lock()
	defer o.mu.Unlock()
	return o.recusada[origem]
}

func (o *Origens) Recusar(origem string) {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.recusada[origem] = true
}

func (o *Origens) Aprovar(origem string) {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.aprovada[origem] = true
	delete(o.recusada, origem)
	lista := make([]string, 0, len(o.aprovada))
	for origem := range o.aprovada {
		lista = append(lista, origem)
	}
	if o.arquivo == "" {
		return
	}
	_ = os.MkdirAll(filepath.Dir(o.arquivo), 0o700)
	if dados, err := json.MarshalIndent(lista, "", "  "); err == nil {
		_ = os.WriteFile(o.arquivo, dados, 0o600)
	}
}
