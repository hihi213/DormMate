# ----- DB 접속 설정 -----
DB_HOST ?= localhost
DB_PORT ?= 5432
DB_USER ?= postgres
DB_NAME ?= postgres
# 비밀번호는 환경변수 PGPASSWORD로 넘기세요.

INSPECT  := tools/db/inspect.sql
OUT_DIR  := artifacts

.PHONY: all snapshot report
all: snapshot report

snapshot:
	mkdir -p $(OUT_DIR)
	pg_dump -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) \
	  --schema-only --no-owner --no-privileges > $(OUT_DIR)/schema.current.sql

report:
	mkdir -p $(OUT_DIR)
	psql "host=$(DB_HOST) port=$(DB_PORT) user=$(DB_USER) dbname=$(DB_NAME)" \
	  -f $(INSPECT) -o $(OUT_DIR)/inspect.txt
