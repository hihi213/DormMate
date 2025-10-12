package com.dormmate.backend.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;



//해당 클래스가 Spring 프레임워크에 의해 관리되는 컴포넌트임을 명시
@Component
public class JwtTokenProvider{
    private final java.security.Key secretKey; //한번만 초기화되도록 강제 (final)
    public JwtTokenProvider(@Value("${JWT_SECRET}")) String secreteString){ // 설정파일의 값을 자바코드 String변수, secreteString로 가져온다.
        byte[ ] keyBytes= java.util.Base64.getDecoder().decode(secreteString); //decode메서드에 디코딩할 문자열 전달
        // (인코딩해서 string으로 application.yml에 저장했기 때문에 다시 바이너리로 변환해야함)
        this.secretKey= new javax.crypto.spec.SecretKeySpec(keyBytes, HmacSHA256);
    }

}