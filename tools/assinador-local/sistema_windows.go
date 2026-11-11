//go:build windows

package main

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

var (
	crypt32  = windows.NewLazySystemDLL("crypt32.dll")
	ncrypt   = windows.NewLazySystemDLL("ncrypt.dll")
	advapi32 = windows.NewLazySystemDLL("advapi32.dll")

	procCertGetCertificateContextProperty = crypt32.NewProc("CertGetCertificateContextProperty")
	procNCryptSignHash                    = ncrypt.NewProc("NCryptSignHash")
	procNCryptFreeObject                  = ncrypt.NewProc("NCryptFreeObject")
	procCryptCreateHash                   = advapi32.NewProc("CryptCreateHash")
	procCryptSetHashParam                 = advapi32.NewProc("CryptSetHashParam")
	procCryptSignHashW                    = advapi32.NewProc("CryptSignHashW")
	procCryptDestroyHash                  = advapi32.NewProc("CryptDestroyHash")
)

const (
	certKeyProvInfoPropID = 2
	bcryptPadPKCS1        = 0x2
	calgSHA256            = 0x0000800c
	hpHashVal             = 0x0002

	// Códigos de quem fechou a janela do PIN ou errou o PIN.
	scardCancelado = 0x8010006E
	erroCancelado  = 0x800704C7
	scardPinErrado = 0x8010006B
	scardBloqueado = 0x8010006C
	nteSemCartao   = 0x8010000C
	scardSemCartao = 0x8010001F
	scardRemovido  = 0x80100069
)

type repositorioWindows struct{}

func novoRepositorio() Repositorio { return repositorioWindows{} }

// abrirPessoal abre o repositório "Pessoal" do usuário, onde o Windows
// coloca os certificados dos tokens e cartões conectados.
func abrirPessoal() (windows.Handle, error) {
	nome, _ := windows.UTF16PtrFromString("MY")
	return windows.CertOpenStore(
		windows.CERT_STORE_PROV_SYSTEM, 0, 0,
		windows.CERT_SYSTEM_STORE_CURRENT_USER|windows.CERT_STORE_OPEN_EXISTING_FLAG|windows.CERT_STORE_READONLY_FLAG,
		uintptr(unsafe.Pointer(nome)))
}

func copiar(ctx *windows.CertContext) []byte {
	return append([]byte(nil), unsafe.Slice(ctx.EncodedCert, ctx.Length)...)
}

func temChave(ctx *windows.CertContext) bool {
	var tamanho uint32
	r, _, _ := procCertGetCertificateContextProperty.Call(
		uintptr(unsafe.Pointer(ctx)), certKeyProvInfoPropID, 0, uintptr(unsafe.Pointer(&tamanho)))
	return r != 0
}

// cadeia monta a cadeia que o Windows conhece para o certificado (AC
// intermediária e raiz ICP-Brasil), para ir junto na assinatura.
func cadeia(ctx *windows.CertContext) [][]byte {
	para := windows.CertChainPara{Size: uint32(unsafe.Sizeof(windows.CertChainPara{}))}
	var corrente *windows.CertChainContext
	if err := windows.CertGetCertificateChain(0, ctx, nil, 0, &para, 0, 0, &corrente); err != nil || corrente == nil {
		return [][]byte{copiar(ctx)}
	}
	defer windows.CertFreeCertificateChain(corrente)
	if corrente.ChainCount == 0 {
		return [][]byte{copiar(ctx)}
	}
	simples := unsafe.Slice(corrente.Chains, corrente.ChainCount)[0]
	var lista [][]byte
	for _, elemento := range unsafe.Slice(simples.Elements, simples.NumElements) {
		lista = append(lista, copiar(elemento.CertContext))
	}
	return lista
}

func (repositorioWindows) Listar() ([]Certificado, error) {
	loja, err := abrirPessoal()
	if err != nil {
		return nil, fmt.Errorf("repositório de certificados: %w", err)
	}
	defer windows.CertCloseStore(loja, 0)
	agora := time.Now()
	lista := []Certificado{}
	var ctx *windows.CertContext
	for {
		ctx, err = windows.CertEnumCertificatesInStore(loja, ctx)
		if err != nil || ctx == nil {
			break
		}
		if !temChave(ctx) {
			continue
		}
		if resumo, ok := resumir(copiar(ctx), cadeia(ctx), agora); ok {
			lista = append(lista, resumo)
		}
	}
	ordenar(lista)
	return lista, nil
}

func (repositorioWindows) Assinar(id string, resumo []byte) ([]byte, error) {
	loja, err := abrirPessoal()
	if err != nil {
		return nil, fmt.Errorf("repositório de certificados: %w", err)
	}
	defer windows.CertCloseStore(loja, 0)
	var ctx *windows.CertContext
	for {
		ctx, err = windows.CertEnumCertificatesInStore(loja, ctx)
		if err != nil || ctx == nil {
			return nil, ErrNaoEncontrado
		}
		if impressao(copiar(ctx)) == strings.ToUpper(id) {
			break
		}
	}
	// O certificado achado é duplicado para continuar valendo depois que a
	// enumeração andar.
	ctx = windows.CertDuplicateCertificateContext(ctx)
	defer windows.CertFreeCertificateContext(ctx)

	var chave windows.Handle
	var tipo uint32
	var liberar bool
	if err := windows.CryptAcquireCertificatePrivateKey(ctx,
		windows.CRYPT_ACQUIRE_CACHE_FLAG|windows.CRYPT_ACQUIRE_PREFER_NCRYPT_KEY_FLAG,
		nil, &chave, &tipo, &liberar); err != nil {
		return nil, traduzir(err)
	}
	if tipo == windows.CERT_NCRYPT_KEY_SPEC {
		if liberar {
			defer procNCryptFreeObject.Call(uintptr(chave))
		}
		return assinarCNG(chave, resumo)
	}
	if liberar {
		defer windows.CryptReleaseContext(chave, 0)
	}
	return assinarCAPI(chave, tipo, resumo)
}

type preenchimentoPKCS1 struct {
	algoritmo *uint16
}

func assinarCNG(chave windows.Handle, resumo []byte) ([]byte, error) {
	algoritmo, _ := windows.UTF16PtrFromString("SHA256")
	info := preenchimentoPKCS1{algoritmo: algoritmo}
	var tamanho uint32
	r, _, _ := procNCryptSignHash.Call(uintptr(chave), uintptr(unsafe.Pointer(&info)),
		uintptr(unsafe.Pointer(&resumo[0])), uintptr(len(resumo)), 0, 0,
		uintptr(unsafe.Pointer(&tamanho)), bcryptPadPKCS1)
	if r != 0 {
		return nil, traduzir(syscall.Errno(r))
	}
	assinatura := make([]byte, tamanho)
	r, _, _ = procNCryptSignHash.Call(uintptr(chave), uintptr(unsafe.Pointer(&info)),
		uintptr(unsafe.Pointer(&resumo[0])), uintptr(len(resumo)),
		uintptr(unsafe.Pointer(&assinatura[0])), uintptr(tamanho),
		uintptr(unsafe.Pointer(&tamanho)), bcryptPadPKCS1)
	if r != 0 {
		return nil, traduzir(syscall.Errno(r))
	}
	return assinatura[:tamanho], nil
}

// assinarCAPI é para drivers antigos, que só falam a CryptoAPI.
func assinarCAPI(provedor windows.Handle, tipo uint32, resumo []byte) ([]byte, error) {
	var hash uintptr
	if r, _, err := procCryptCreateHash.Call(uintptr(provedor), calgSHA256, 0, 0, uintptr(unsafe.Pointer(&hash))); r == 0 {
		return nil, fmt.Errorf("o driver deste token não assina com SHA-256 (atualize o driver): %w", traduzir(err))
	}
	defer procCryptDestroyHash.Call(hash)
	if r, _, err := procCryptSetHashParam.Call(hash, hpHashVal, uintptr(unsafe.Pointer(&resumo[0])), 0); r == 0 {
		return nil, traduzir(err)
	}
	var tamanho uint32
	if r, _, err := procCryptSignHashW.Call(hash, uintptr(tipo), 0, 0, 0, uintptr(unsafe.Pointer(&tamanho))); r == 0 {
		return nil, traduzir(err)
	}
	assinatura := make([]byte, tamanho)
	if r, _, err := procCryptSignHashW.Call(hash, uintptr(tipo), 0, 0,
		uintptr(unsafe.Pointer(&assinatura[0])), uintptr(unsafe.Pointer(&tamanho))); r == 0 {
		return nil, traduzir(err)
	}
	assinatura = assinatura[:tamanho]
	// A CryptoAPI devolve os bytes ao contrário (little-endian).
	for i, j := 0, len(assinatura)-1; i < j; i, j = i+1, j-1 {
		assinatura[i], assinatura[j] = assinatura[j], assinatura[i]
	}
	return assinatura, nil
}

func traduzir(err error) error {
	var codigo syscall.Errno
	if !errors.As(err, &codigo) {
		return err
	}
	switch uint32(codigo) {
	case scardCancelado, erroCancelado, uint32(windows.ERROR_CANCELLED):
		return ErrCancelado
	case scardPinErrado:
		return errors.New("PIN incorreto")
	case scardBloqueado:
		return errors.New("o token está bloqueado por PIN errado")
	case nteSemCartao, scardSemCartao, scardRemovido:
		return errors.New("o token ou cartão não está conectado")
	}
	return fmt.Errorf("%w (0x%08X)", err, uint32(codigo))
}

const (
	mbYesNo        = 0x00000004
	mbOK           = 0x00000000
	mbIconQuestion = 0x00000020
	mbIconInfo     = 0x00000040
	mbTopmost      = 0x00040000
	mbSetForegnd   = 0x00010000
	idYes          = 6
)

func confirmar(titulo, texto string) bool {
	t, _ := windows.UTF16PtrFromString(titulo)
	m, _ := windows.UTF16PtrFromString(texto)
	r, _ := windows.MessageBox(0, m, t, mbYesNo|mbIconQuestion|mbTopmost|mbSetForegnd)
	return r == idYes
}

func avisar(titulo, texto string) {
	t, _ := windows.UTF16PtrFromString(titulo)
	m, _ := windows.UTF16PtrFromString(texto)
	_, _ = windows.MessageBox(0, m, t, mbOK|mbIconInfo|mbTopmost|mbSetForegnd)
}

func emUso(err error) bool {
	var codigo syscall.Errno
	return errors.As(err, &codigo) && codigo == windows.WSAEADDRINUSE
}

// instalar copia o programa para %LOCALAPPDATA%\VeridiaAssinador e o liga
// ao iniciar do Windows (só para este usuário, sem pedir administrador).
// Devolve true quando abriu a cópia instalada e esta deve terminar.
func instalar() bool {
	atual, err := os.Executable()
	if err != nil {
		return false
	}
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		return false
	}
	destino := filepath.Join(base, "VeridiaAssinador", "AssinadorVeridia.exe")
	if !strings.EqualFold(filepath.Clean(atual), filepath.Clean(destino)) {
		if err := copiarArquivo(atual, destino); err != nil {
			return false
		}
		registrarInicio(destino)
		if exec.Command(destino).Start() == nil {
			return true
		}
		return false
	}
	registrarInicio(destino)
	return false
}

func registrarInicio(destino string) {
	chave, _, err := registry.CreateKey(registry.CURRENT_USER,
		`Software\Microsoft\Windows\CurrentVersion\Run`, registry.SET_VALUE)
	if err != nil {
		return
	}
	defer chave.Close()
	_ = chave.SetStringValue("AssinadorVeridia", `"`+destino+`"`)
}

func copiarArquivo(origem, destino string) error {
	if err := os.MkdirAll(filepath.Dir(destino), 0o700); err != nil {
		return err
	}
	de, err := os.Open(origem)
	if err != nil {
		return err
	}
	defer de.Close()
	temporario := destino + ".novo"
	para, err := os.Create(temporario)
	if err != nil {
		return err
	}
	if _, err := io.Copy(para, de); err != nil {
		para.Close()
		return err
	}
	if err := para.Close(); err != nil {
		return err
	}
	// Uma versão antiga em uso não pode ser substituída: fica a antiga.
	return os.Rename(temporario, destino)
}
