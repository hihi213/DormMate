좋아, 우리 기준으로 **헬스 체크는 “공개 liveness” + “내부 readiness”** 두 가지로 씁니다. 빠르게 쓰는 법만 딱 정리해줄게.

---

## 1) 내가 직접 확인할 때 (개발·운영 콘솔)

### 프로세스 살아있나? → 공개 liveness

```bash
# 로컬(HTTP)
curl -s http://localhost:8080/health | jq

# 운영(HTTPS 도메인)
curl -s https://api.example.com/health
```

* 기대 응답: `200 OK`와 `{"status":"UP","now":"..."}`
* 의미: **프로세스가 응답**만 하면 UP (DB 등 의존성은 체크 안 함)

### 의존성(예: DB)까지 준비됐나? → 내부 readiness

```bash
# 내부망/관리자만 접근 가능 (예: 8081 바인딩)
curl -s http://127.0.0.1:8081/actuator/health | jq
curl -s http://127.0.0.1:8081/actuator/info   | jq  # 버전/커밋 확인
```

* 기대 응답: `status":"UP"` / 세부 디테일은 프로필에 따라 숨김일 수 있음

---

## 2) 로드밸런서(ELB/NGINX/Cloudflare 등) 설정

* **체크 경로**: `GET /health`
* **성공 기준**: `HTTP 200` (본문은 무시해도 됨)
* **주기/임계치 (권장)**: interval 10s, timeout 2s, unhealthy threshold 3

> 버전/커밋은 외부에 노출하지 말고, **내부 모니터링 서버**에서 `/actuator/info` 만 확인하세요.

---

## 3) Kubernetes에서 쓰기

```yaml
livenessProbe:
  httpGet: { path: /health, port: 8080 }
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 2
  failureThreshold: 3

readinessProbe:
  httpGet: { path: /actuator/health, port: 8081 } # 내부 포트 바인딩 가정
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 2
  failureThreshold: 3
```

---

## 4) Docker Compose에서도

```yaml
services:
  app:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 10s
      timeout: 2s
      retries: 3
```

---

## 5) CI/CD 스모크 스크립트 예시

```bash
#!/usr/bin/env bash
set -euo pipefail
base="${BASE_URL:-https://api.example.com}"

# 1) 프로세스 응답 확인
curl -fsS "$base/health" >/dev/null

# 2) (옵션) 내부망에서만: 버전/커밋/의존성 준비 확인
# curl -fsS http://127.0.0.1:8081/actuator/health >/dev/null
# curl -fsS http://127.0.0.1:8081/actuator/info   | jq -r '.git.commit.id'
echo "Smoke OK"
```

---

## 6) 기대 응답 예시

**/health (공개)**

```json
{ "status": "UP", "now": "2025-08-29T12:34:56Z" }
```

**/actuator/health (내부)**

```json
{ "status": "UP" }
```

**/actuator/info (내부)**

```json
{ "build": { "version": "0.1.0" }, "git": { "commit": { "id": "abc1234" } } }
```

---

## 7) 자주 겪는 상황 & 대처

* `/health`는 200인데 앱이 “느리다” → **의존성 문제(readiness)** 가능. `/actuator/health`를 내부에서 확인.
* `/actuator/*`가 403/접근불가 → **의도된 보호**. 내부망(IP allow) 또는 ADMIN 역할로만 접근하세요.
* HTTPS 인증서 문제로 curl 실패 → `curl -v https://...` 로 인증서 상태 확인(운영에선 `-k` 사용 지양).

---

### 결론

* **외부엔 `/health`만**: “살아있음” 판정.
* **내부엔 `/actuator/health|info`**: “준비됨/버전” 판정.
* LB/K8s/CI에 각각 위 엔드포인트를 **그 목적대로** 꽂아 쓰면 끝!
