package com.dormmate.backend.modules.auth;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import com.dormmate.backend.modules.admin.application.InitialAdminService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"jwt.secret=test-only-resident-lifecycle-secret-32-bytes!", "jwt.expiration=600000"})
@ActiveProfiles("prod")
@AutoConfigureMockMvc
class ResidentLifecycleIntegrationTest {
    static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16.4");
    static { DB.start(); }
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", DB::getJdbcUrl); r.add("spring.datasource.username", DB::getUsername);
        r.add("spring.datasource.password", DB::getPassword);
        r.add("spring.flyway.locations", () -> "classpath:db/production");
    }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired InitialAdminService initial;
    @Autowired PasswordEncoder encoder;
    String admin;
    @BeforeEach void setup() throws Exception {
        initial.createOnce("lifecycle-admin","Administrator123!","Admin","admin@example.test");
        admin = token(login("lifecycle-admin","Administrator123!"));
    }

    @Test void completeResidentLifecyclePreservesHistoryAndRevokesCredentials() throws Exception {
        String loginId="201-1";
        var slot = slot(loginId); String id=slot.get("id").toString(); String user=slot.get("current_user_id").toString();
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(
                Map.of("loginId",loginId,"password","0000","deviceId","resident-test"))))
                .andExpect(status().isForbidden());
        mvc.perform(post("/admin/resident-slots/"+id+"/check-in").header("Authorization","Bearer "+admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"First Resident\",\"reason\":\"입사 확인\"}"))
                .andExpect(status().isNoContent());
        var pending=login(loginId,"0000"); String pendingToken=token(pending);
        assertThat(pending.path("user").path("mustChangePassword").asBoolean()).isTrue();
        mvc.perform(get("/fridge/slots").header("Authorization","Bearer "+pendingToken))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"));
        mvc.perform(get("/profile/me").header("Authorization","Bearer "+pendingToken)).andExpect(status().isForbidden());
        mvc.perform(post("/auth/password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"0000\",\"newPassword\":\"ResidentPass123!\"}"))
                .andExpect(status().isUnauthorized());
        change(pendingToken,"wrong","ResidentPass123!",403);
        change(pendingToken,"0000","0000",422);
        change(pendingToken,"0000","ResidentPass123!",204);
        mvc.perform(get("/fridge/slots").header("Authorization","Bearer "+pendingToken)).andExpect(status().isUnauthorized());
        rejectRefresh(pending);
        var normal=login(loginId,"ResidentPass123!");
        assertThat(normal.path("user").path("mustChangePassword").asBoolean()).isFalse();
        mvc.perform(get("/fridge/slots").header("Authorization","Bearer "+token(normal))).andExpect(status().isOk());
        mvc.perform(post("/admin/resident-slots/"+id+"/reset-password").header("Authorization","Bearer "+token(normal))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("userId",user,"reason","attempt"))))
                .andExpect(status().isForbidden());
        action(id,user,"reset-password",204);
        mvc.perform(get("/fridge/slots").header("Authorization","Bearer "+token(normal))).andExpect(status().isUnauthorized());
        rejectRefresh(normal);
        var reset=login(loginId,"0000");
        assertThat(reset.path("user").path("mustChangePassword").asBoolean()).isTrue();
        action(id,user,"check-out",204);
        mvc.perform(get("/fridge/slots").header("Authorization","Bearer "+token(reset))).andExpect(status().isUnauthorized());
        rejectRefresh(reset);
        var next=slot(loginId); assertThat(next.get("current_user_id").toString()).isNotEqualTo(user);
        assertThat(jdbc.queryForObject("SELECT full_name FROM dorm_user WHERE id=?",String.class,UUID.fromString(user))).isEqualTo("First Resident");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM room_assignment WHERE dorm_user_id=? AND released_at IS NOT NULL",Integer.class,UUID.fromString(user))).isEqualTo(1);
        action(id,user,"reset-password",409); // stale admin page must not reset next occupant
        mvc.perform(post("/admin/resident-slots/"+id+"/check-in").header("Authorization","Bearer "+admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Next Resident\",\"reason\":\"다음 입사\"}"))
                .andExpect(status().isNoContent());
        var second=login(loginId,"0000");
        assertThat(second.path("user").path("userId").asText()).isEqualTo(next.get("current_user_id").toString());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM room_assignment WHERE dorm_user_id=?",Integer.class,next.get("current_user_id"))).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM penalty_history WHERE user_id=?",Integer.class,next.get("current_user_id"))).isZero();
    }

    @Test void concurrentAdmissionsCannotOverwriteOccupant() throws Exception {
        String id=slot("202-1").get("id").toString(); var gate=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var a=pool.submit(()->{gate.await();return admission(id,"Resident A");});
            var b=pool.submit(()->{gate.await();return admission(id,"Resident B");});
            gate.countDown(); assertThat(new int[]{a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS)}).containsExactlyInAnyOrder(204,409);
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM room_assignment WHERE dorm_user_id=? AND released_at IS NULL",Integer.class,slot("202-1").get("current_user_id"))).isEqualTo(1);
    }
    private int admission(String slot,String name) throws Exception {
        return mvc.perform(post("/admin/resident-slots/"+slot+"/check-in").header("Authorization","Bearer "+admin)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("name",name,"reason","입사"))))
                .andReturn().getResponse().getStatus();
    }
    private Map<String,Object> slot(String login) { return jdbc.queryForMap("SELECT s.* FROM resident_account_slot s JOIN dorm_user u ON u.id=s.current_user_id WHERE u.login_id=?",login); }
    private JsonNode login(String id,String password) throws Exception {
        var result=mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("loginId",id,"password",password,"deviceId","resident-test"))))
                .andExpect(status().isOk()).andReturn();
        return json.readTree(result.getResponse().getContentAsString());
    }
    private String token(JsonNode login) { return login.path("tokens").path("accessToken").asText(); }
    private void change(String token,String old,String replacement,int status) throws Exception {
        mvc.perform(post("/auth/password").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("currentPassword",old,"newPassword",replacement))))
                .andExpect(status().is(status));
    }
    private void action(String slot,String user,String action,int status) throws Exception {
        mvc.perform(post("/admin/resident-slots/"+slot+"/"+action).header("Authorization","Bearer "+admin)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("userId",user,"reason","운영자 확인"))))
                .andExpect(status().is(status));
    }
    private void rejectRefresh(JsonNode login) throws Exception {
        mvc.perform(post("/auth/refresh").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(
                Map.of("refreshToken",login.path("tokens").path("refreshToken").asText(),"deviceId","resident-test"))))
                .andExpect(status().isUnauthorized());
    }
}
