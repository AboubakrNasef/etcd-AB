package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const maxUploadSize = 128 << 20

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", healthHandler)
	mux.HandleFunc("/api/decode", decodeHandler)
	mux.Handle("/", http.FileServer(http.Dir("../web/dist")))

	server := &http.Server{Addr: ":8787", Handler: withCORS(mux)}
	fmt.Println("WAL Explorer: http://127.0.0.1:8787")
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func decodeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		http.Error(w, "expected a multipart field named file: "+err.Error(), http.StatusBadRequest)
		return
	}
	uploaded, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "missing multipart field named file", http.StatusBadRequest)
		return
	}
	defer uploaded.Close()

	temp, err := os.CreateTemp("", "wal-explorer-*.wal")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	tempPath := temp.Name()
	defer os.Remove(tempPath)
	if _, err := io.Copy(temp, uploaded); err != nil {
		temp.Close()
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := temp.Close(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	options := decodeOptions{
		StartIndex: queryUint64(r, "startIndex"),
		EndIndex:   queryUint64(r, "endIndex"),
		EntryType:  strings.TrimSpace(r.URL.Query().Get("entryType")),
	}
	result, err := decodeWALFile(tempPath, options)
	if err != nil {
		http.Error(w, "could not decode WAL: "+err.Error(), http.StatusBadRequest)
		return
	}
	result.FileName = header.Filename
	writeJSON(w, http.StatusOK, result)
}

func queryUint64(r *http.Request, name string) uint64 {
	value, _ := strconv.ParseUint(r.URL.Query().Get(name), 10, 64)
	return value
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

var _ = filepath.Separator
