package com.dormmate.backend;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BackendApplication {

	public static void main(String[] args) {
		// Fix default JVM timezone to UTC for consistent logs/schedules
		TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
		SpringApplication.run(BackendApplication.class, args);
	}

}

/*
반드시 루트 패키지에 있어야 합니다. 만약 이 파일이 하위 패키지로 이동하면, 
그 패키지 바깥에 있는 다른 컴포넌트들을 스캔하지 못해 애플리케이션이 정상적으로 동작하지 않습니다.
 */