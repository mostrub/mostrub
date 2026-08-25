.PHONY: web test build demo

web:
	cd web && npm ci && npm run build

test:
	go test ./...

build: web
	go build -o tailboard ./cmd/tailboard

demo: build
	./tailboard demo --listen :4747 --data /tmp/tailboard-demo.db
