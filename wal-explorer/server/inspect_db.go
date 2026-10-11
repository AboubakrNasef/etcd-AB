package main

import (
	"encoding/binary"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"time"

	bolt "go.etcd.io/bbolt"
	"go.etcd.io/etcd/api/v3/mvccpb"
	"google.golang.org/protobuf/proto"
)

func inspectDBHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		http.Error(w, "expected a multipart field named file: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer r.MultipartForm.RemoveAll()
	uploaded, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "missing multipart field named file", http.StatusBadRequest)
		return
	}
	defer uploaded.Close()

	temp, err := os.CreateTemp("", "wal-explorer-*.db")
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

	result, err := inspectDBFile(tempPath)
	if err != nil {
		http.Error(w, "could not inspect database: "+err.Error(), http.StatusBadRequest)
		return
	}
	result.FileName = header.Filename
	writeJSON(w, http.StatusOK, result)
}

func inspectDBFile(path string) (decodeResult, error) {
	db, err := bolt.Open(path, 0o600, &bolt.Options{ReadOnly: true, Timeout: 2 * time.Second})
	if err != nil {
		return decodeResult{}, fmt.Errorf("open bbolt database: %w", err)
	}
	defer db.Close()

	result := decodeResult{Records: make([]decodedRecord, 0)}
	err = db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte("key"))
		if bucket == nil {
			return fmt.Errorf("database has no etcd key bucket")
		}
		cursor := bucket.Cursor()
		number := 0
		for key, value := cursor.Last(); key != nil; key, value = cursor.Prev() {
			// Cursor buffers are reused, so decode before advancing.
			record, err := decodeDBKey(key, value, number+1)
			if err != nil {
				return fmt.Errorf("record %d: %w", number+1, err)
			}
			result.Records = append(result.Records, record)
			number++
		}
		return nil
	})
	return result, err
}

func decodeDBKey(key, value []byte, number int) (decodedRecord, error) {
	if (len(key) != 17 && len(key) != 18) || key[8] != '_' {
		return decodedRecord{}, fmt.Errorf("invalid etcd revision key %x", key)
	}
	if len(key) == 18 && key[17] != 't' {
		return decodedRecord{}, fmt.Errorf("invalid etcd tombstone key %x", key)
	}
	main, sub := binary.BigEndian.Uint64(key[:8]), binary.BigEndian.Uint64(key[9:17])
	if main > math.MaxInt64 || sub > math.MaxInt64 {
		return decodedRecord{}, fmt.Errorf("revision out of range in key %x", key)
	}
	var kv mvccpb.KeyValue
	if err := proto.Unmarshal(value, &kv); err != nil {
		return decodedRecord{}, fmt.Errorf("decode key bucket value: %w", err)
	}
	return decodedRecord{
		Number:      number,
		RecordType:  "keyValue",
		Revision:    int64(main),
		SubRevision: int64(sub),
		Tombstone:   len(key) == 18 && key[17] == 't',
		Data: map[string]any{
			"key":            readableBytes(kv.Key),
			"value":          readableBytes(kv.Value),
			"createRevision": kv.CreateRevision,
			"modRevision":    kv.ModRevision,
			"version":        kv.Version,
			"lease":          kv.Lease,
		},
	}, nil
}
