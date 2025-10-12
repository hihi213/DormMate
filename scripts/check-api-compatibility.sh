#!/usr/bin/env bash
# 목적: API 버전 간 호환성 체크
# 이유: 하위 호환성 유지를 통해 클라이언트 영향 최소화

set -euo pipefail

# 버전 비교 함수
check_compatibility() {
    local old_version=$1
    local new_version=$2
    
    echo "🔍 API 호환성 체크 중: $old_version → $new_version"
    
    # openapi-diff를 사용한 호환성 체크
    npx -y openapi-diff@latest \
        --fail-on-incompatible \
        "api/versions/$old_version.yml" \
        "api/versions/$new_version.yml" || {
        echo "❌ 호환성 위반 감지됨: $old_version → $new_version"
        echo "💡 해결 방법:"
        echo "   1. Breaking change가 의도된 것인지 확인"
        echo "   2. 의도된 경우 새 마이너 버전 생성 (v0.2.0)"
        echo "   3. 의도되지 않은 경우 기존 필드 유지"
        exit 1
    }
    
    echo "✅ 호환성 확인 완료: $old_version → $new_version"
}

# 현재 버전과 이전 버전들 비교
CURRENT_VERSION="v0.1.0"
PREVIOUS_VERSIONS=()

# 이전 버전이 있으면 호환성 체크
for version in "${PREVIOUS_VERSIONS[@]}"; do
    if [[ -f "api/versions/$version.yml" ]]; then
        check_compatibility "$version" "$CURRENT_VERSION"
    fi
done

echo "✅ 모든 API 호환성 체크가 완료되었습니다"
