package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"unicode/utf8"

	"go.etcd.io/etcd/api/v3/etcdserverpb"
	"go.etcd.io/etcd/client/pkg/v3/fileutil"
	"go.etcd.io/etcd/server/v3/storage/wal"
	"go.etcd.io/etcd/server/v3/storage/wal/walpb"
	"go.etcd.io/raft/v3/raftpb"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

type decodeOptions struct {
	StartIndex uint64
	EndIndex   uint64
	EntryType  string
}

type decodedRecord struct {
	Number     int            `json:"number"`
	RecordType string         `json:"recordType"`
	Term       uint64         `json:"term,omitempty"`
	Index      uint64         `json:"index,omitempty"`
	EntryType  string         `json:"entryType,omitempty"`
	Data       map[string]any `json:"data,omitempty"`
	Raw        string         `json:"raw,omitempty"`
	Error      string         `json:"error,omitempty"`
	included   bool
}

type decodeResult struct {
	FileName string          `json:"fileName"`
	Records  []decodedRecord `json:"records"`
	Errors   []string        `json:"errors,omitempty"`
}

func decodeWALFile(path string, options decodeOptions) (decodeResult, error) {
	file, err := os.Open(path)
	if err != nil {
		return decodeResult{}, err
	}
	defer file.Close()

	decoder := wal.NewDecoderAdvanced(true, fileutil.NewFileReader(file))
	result := decodeResult{FileName: file.Name(), Records: make([]decodedRecord, 0)}
	number := 0

	for {
		record := &walpb.Record{}
		err := decoder.Decode(record)
		if err == io.EOF {
			break
		}
		if err != nil {
			result.Errors = append(result.Errors, err.Error())
			break
		}
		number++

		decoded, decodeErr := decodeRecord(number, record, options)
		if decodeErr != nil {
			decoded.Error = decodeErr.Error()
			result.Errors = append(result.Errors, fmt.Sprintf("record %d: %v", number, decodeErr))
		}
		if decoded.included {
			result.Records = append(result.Records, decoded)
		}
	}

	return result, nil
}

func decodeRecord(number int, record *walpb.Record, options decodeOptions) (decodedRecord, error) {
	decoded := decodedRecord{Number: number, included: true}
	switch record.GetType() {
	case wal.MetadataType:
		decoded.RecordType = "metadata"
		var metadata etcdserverpb.Metadata
		if err := proto.Unmarshal(record.GetData(), &metadata); err != nil {
			return decoded, err
		}
		decoded.Data = protoMap(&metadata)
	case wal.EntryType:
		decoded.RecordType = "entry"
		var entry raftpb.Entry
		if err := proto.Unmarshal(record.GetData(), &entry); err != nil {
			return decoded, err
		}
		decoded.Term = entry.GetTerm()
		decoded.Index = entry.GetIndex()
		decoded.EntryType = entry.GetType().String()
		if options.EntryType != "" && options.EntryType != "all" && !strings.EqualFold(options.EntryType, decoded.EntryType) {
			decoded.included = false
			return decoded, nil
		}
		if options.StartIndex > 0 && decoded.Index < options.StartIndex {
			decoded.included = false
			return decoded, nil
		}
		if options.EndIndex > 0 && decoded.Index >= options.EndIndex {
			decoded.included = false
			return decoded, nil
		}
		if entry.GetType() == raftpb.EntryNormal {
			var request etcdserverpb.InternalRaftRequest
			if err := proto.Unmarshal(entry.GetData(), &request); err == nil {
				decoded.Data, _ = readableRequest(&request)
			} else {
				decoded.Raw = base64.StdEncoding.EncodeToString(entry.GetData())
			}
		} else {
			var change raftpb.ConfChange
			if err := proto.Unmarshal(entry.GetData(), &change); err == nil {
				decoded.Data = protoMap(&change)
			} else {
				decoded.Raw = base64.StdEncoding.EncodeToString(entry.GetData())
			}
		}
	case wal.StateType:
		decoded.RecordType = "hardState"
		var state raftpb.HardState
		if err := proto.Unmarshal(record.GetData(), &state); err != nil {
			return decoded, err
		}
		decoded.Data = protoMap(&state)
	case wal.SnapshotType:
		decoded.RecordType = "snapshot"
		var snapshot walpb.Snapshot
		if err := proto.Unmarshal(record.GetData(), &snapshot); err != nil {
			return decoded, err
		}
		decoded.Data = protoMap(&snapshot)
	case wal.CrcType:
		decoded.RecordType = "crc"
		decoded.Data = map[string]any{"crc": record.GetCrc()}
	default:
		decoded.RecordType = fmt.Sprintf("unknown(%d)", record.GetType())
		decoded.Raw = base64.StdEncoding.EncodeToString(record.GetData())
	}
	return decoded, nil
}

func protoMap(message proto.Message) map[string]any {
	data, err := protojson.MarshalOptions{UseProtoNames: true}.Marshal(message)
	if err != nil {
		return map[string]any{"error": err.Error()}
	}
	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		return map[string]any{"raw": string(data)}
	}
	normalizeStrings(result)
	return result
}

func readableRequest(request *etcdserverpb.InternalRaftRequest) (map[string]any, error) {
	result := protoMap(request)
	switch {
	case request.GetPut() != nil:
		result["operation"] = "put"
		result["key"] = readableBytes(request.GetPut().GetKey())
		result["value"] = readableBytes(request.GetPut().GetValue())
	case request.GetRange() != nil:
		result["operation"] = "range"
		result["key"] = readableBytes(request.GetRange().GetKey())
	case request.GetDeleteRange() != nil:
		result["operation"] = "deleteRange"
		result["key"] = readableBytes(request.GetDeleteRange().GetKey())
	case request.GetTxn() != nil:
		result["operation"] = "txn"
	default:
		result["operation"] = "other"
	}
	return result, nil
}

func readableBytes(value []byte) string {
	if utf8.Valid(value) {
		return string(value)
	}
	return "base64:" + base64.StdEncoding.EncodeToString(value)
}

func normalizeStrings(value map[string]any) {
	for key, item := range value {
		switch typed := item.(type) {
		case map[string]any:
			normalizeStrings(typed)
		case []any:
			for _, child := range typed {
				if childMap, ok := child.(map[string]any); ok {
					normalizeStrings(childMap)
				}
			}
		case string:
			if key == "key" || key == "value" || strings.HasSuffix(key, "_key") || strings.HasSuffix(key, "_value") {
				if decoded, err := base64.StdEncoding.DecodeString(typed); err == nil && utf8.Valid(decoded) {
					value[key+"Text"] = string(decoded)
				}
			}
		}
	}
}
