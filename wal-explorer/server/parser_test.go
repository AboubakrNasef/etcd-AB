package main

import (
	"testing"

	"go.etcd.io/etcd/api/v3/etcdserverpb"
)

func TestReadableRequest(t *testing.T) {
	request := &etcdserverpb.InternalRaftRequest{
		Put: &etcdserverpb.PutRequest{Key: []byte("lesson"), Value: []byte("hello")},
	}

	got, err := readableRequest(request)
	if err != nil {
		t.Fatal(err)
	}
	if got["operation"] != "put" {
		t.Fatalf("operation = %v, want put", got["operation"])
	}
	if got["key"] != "lesson" || got["value"] != "hello" {
		t.Fatalf("decoded request = %#v", got)
	}
}
