# backend/Dockerfile - Spring Boot 애플리케이션용 Dockerfile
# 멀티스테이지 빌드로 최적화된 이미지 생성

# 빌드 스테이지
FROM gradle:8.9.0-jdk21 AS builder

# 작업 디렉토리 설정
WORKDIR /app

# 의존성 다운로드를 위한 build.gradle과 settings.gradle 복사
COPY build.gradle settings.gradle ./

# Gradle wrapper 복사
COPY gradlew ./
COPY gradle/ gradle/

# 의존성 다운로드 (캐시 최적화)
RUN ./gradlew dependencies --no-daemon

# 소스 코드 복사
COPY src/ src/

# 애플리케이션 빌드
RUN ./gradlew build -x test -x generateGitProperties --no-daemon

# 실행 스테이지
FROM eclipse-temurin:21-jre-jammy

# 작업 디렉토리 설정
WORKDIR /app

# 빌드된 JAR 파일 복사
COPY --from=builder /app/build/libs/*.jar app.jar

# 포트 노출
EXPOSE 8080

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/healthz || exit 1

# 애플리케이션 실행
ENTRYPOINT ["java", "-jar", "app.jar"]
