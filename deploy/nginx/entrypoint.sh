#!/bin/sh
set -euo pipefail

TEMPLATE_DIR="/etc/nginx/templates"
CONF_DIR="/etc/nginx/conf.d"
HTTP_TEMPLATE="$TEMPLATE_DIR/default-http.conf"
TLS_TEMPLATE="$TEMPLATE_DIR/default-tls.conf"
TARGET_CONF="$CONF_DIR/default.conf"

SERVER_NAME="${SERVER_NAME:-_}"
ENABLE_TLS="${ENABLE_TLS:-false}"
TLS_DOMAIN="${TLS_DOMAIN:-}"
TLS_SELF_SIGNED="${TLS_SELF_SIGNED:-true}"
SSL_CERT_PATH=""
SSL_KEY_PATH=""

apk add --no-cache gettext openssl >/dev/null

if [ "$ENABLE_TLS" = "true" ]; then
  if [ -z "$TLS_DOMAIN" ]; then
    echo "[proxy] ENABLE_TLS=true 이지만 TLS_DOMAIN 값이 없습니다." >&2
    exit 1
  fi
  CERT_DIR="/etc/letsencrypt/live/$TLS_DOMAIN"
  SSL_CERT_PATH="$CERT_DIR/fullchain.pem"
  SSL_KEY_PATH="$CERT_DIR/privkey.pem"
  if [ ! -f "$SSL_CERT_PATH" ] || [ ! -f "$SSL_KEY_PATH" ]; then
    if [ "$TLS_SELF_SIGNED" = "true" ]; then
      echo "[proxy] 인증서를 찾을 수 없어 자체 서명 인증서를 생성합니다. (도메인: $TLS_DOMAIN)"
      mkdir -p "$CERT_DIR"
      openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
        -keyout "$SSL_KEY_PATH" \
        -out "$SSL_CERT_PATH" \
        -subj "/CN=$TLS_DOMAIN"
    else
      cat >&2 <<EOF
[proxy] $TLS_DOMAIN 인증서를 찾을 수 없습니다.
먼저 ./auto deploy tls issue --env prod --domain $TLS_DOMAIN --email <EMAIL> 명령으로 Let's Encrypt 인증서를 발급하세요.
EOF
      exit 1
    fi
  fi
  export SERVER_NAME TLS_DOMAIN SSL_CERT_PATH SSL_KEY_PATH
  envsubst '${SERVER_NAME} ${TLS_DOMAIN} ${SSL_CERT_PATH} ${SSL_KEY_PATH}' < "$TLS_TEMPLATE" > "$TARGET_CONF"
else
  export SERVER_NAME
  envsubst '${SERVER_NAME}' < "$HTTP_TEMPLATE" > "$TARGET_CONF"
fi

exec nginx -g 'daemon off;'
