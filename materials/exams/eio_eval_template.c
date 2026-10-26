/* eio_eval_template.c — 2차 평가(C형) · Embedded I/O 제어 실습 (정규 평가)
 *
 * 환경 : Raspberry Pi 4 · Raspberry Pi OS Lite 64-bit (Trixie) · libgpiod 2.x · PuTTY 접속
 * 배선 : (Day 2 배선과 같은 자리 — 부품 4개 사용)
 *        GPIO17 (물리 11) → 220Ω → LED 빨강(+, 긴 다리) → GND
 *        GPIO22 (물리 15) → 220Ω → LED 초록(+, 긴 다리) → GND
 *        GPIO13 (물리 33) → 액티브 부저(+) → GND       (뒷면이 막힌 부저)
 *        GPIO5  (물리 29) → 버튼 → GND                (외부 저항 없음, 내부 pull-up 사용)
 * 빌드 : gcc -Wall -O2 -o eio_eval eio_eval_template.c -lgpiod
 * 실행 : ./eio_eval        — 1~6단계가 순서대로 진행된다. 화면 안내에 따라 버튼을 누른다.
 *
 * 규칙
 *  - 빈칸 ______ 8곳과 TODO 3곳만 채운다. [N단계] 결과 / 기대값 printf 는 고치지 않는다.
 *  - 결과와 기대값이 같고, LED · 부저가 설명대로 동작하면 그 단계는 완료.
 *  - "Device or resource busy" 가 나오면 다른 프로그램(gpioset 등)이 라인을 쥐고 있는 것 → 그 프로그램을 끝낸다.
 *
 *  단계  주제                                            Day   형태
 *   1    출력 라인 3개 요청 (chip → settings → … → request)     2   빈칸 3
 *   2    횟수 깜빡임 — 1번 · 2번 · 3번 + 삐                 2   빈칸 2
 *   3    입력 요청 · bias · 첫 누름 기다리기               2   빈칸 3
 *   4    폴링 — 누르는 동안 경보(빨강 + 부저)              2   TODO 1
 *   5    엣지 이벤트 — 더블클릭 감지                       2   TODO 2
 *   6    커널 타임스탬프로 누름 간격 재기                   2   TODO 3
 */
#include <gpiod.h>
#include <poll.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <errno.h>

#define CHIP_PATH "/dev/gpiochip0"
#define LED  17          /* 빨강 */
#define LED2 22          /* 초록 */
#define BUZ  13          /* 액티브 부저 — 1 이면 스스로 소리를 낸다 */
#define BTN  5

static const unsigned int OUTS[3] = { LED, LED2, BUZ };

/* ── 제공 도우미 (고치지 않는다) ── */
static void sleep_ms(long ms)
{
    struct timespec ts = { ms / 1000, (ms % 1000) * 1000000L };
    nanosleep(&ts, NULL);
}

static long long now_ms(void)
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (long long)ts.tv_sec * 1000 + ts.tv_nsec / 1000000;
}

static void set_line(struct gpiod_line_request *req, unsigned int line, int on)
{
    gpiod_line_request_set_value(req, line,
        on ? GPIOD_LINE_VALUE_ACTIVE : GPIOD_LINE_VALUE_INACTIVE);
}

static void beep(struct gpiod_line_request *out, int ms)
{
    set_line(out, BUZ, 1); sleep_ms(ms); set_line(out, BUZ, 0);
}

/* settings 하나로 라인 1개를 요청한다. 실패하면 NULL */
static struct gpiod_line_request *request_one(unsigned int offset, const char *consumer,
                                              struct gpiod_line_settings *s)
{
    struct gpiod_chip *chip = gpiod_chip_open(CHIP_PATH);
    if (!chip) { perror("gpiod_chip_open"); return NULL; }
    struct gpiod_line_config *lc = gpiod_line_config_new();
    gpiod_line_config_add_line_settings(lc, &offset, 1, s);
    struct gpiod_request_config *rc = gpiod_request_config_new();
    gpiod_request_config_set_consumer(rc, consumer);
    struct gpiod_line_request *req = gpiod_chip_request_lines(chip, rc, lc);
    if (!req) fprintf(stderr, "%s: 라인 요청 실패: %s\n", consumer, strerror(errno));
    gpiod_request_config_free(rc);
    gpiod_line_config_free(lc);
    gpiod_chip_close(chip);                     /* 요청은 칩을 닫아도 유지된다 */
    return req;
}

/* ───────────── 1단계: 출력 라인 3개 요청 ─────────────
 * libgpiod v2 의 객체 흐름: chip → settings → line_config → request_config → request */
static struct gpiod_line_request *step1_request_outputs(void)
{
    struct gpiod_chip *chip = gpiod_chip_open(______);    /* ① 40핀 헤더 GPIO 를 가진 칩의 장치 파일 경로 */
    if (!chip) { perror("gpiod_chip_open"); return NULL; }

    struct gpiod_line_settings *s = gpiod_line_settings_new();
    gpiod_line_settings_set_direction(s, GPIOD_LINE_DIRECTION_OUTPUT);
    gpiod_line_settings_set_output_value(s, ______);   /* ② 처음 값 = 꺼짐(논리값 0) 상수 */

    struct gpiod_line_config *lc = gpiod_line_config_new();
    gpiod_line_config_add_line_settings(lc, OUTS, 3, s);

    struct gpiod_request_config *rc = gpiod_request_config_new();
    gpiod_request_config_set_consumer(rc, "evalC_out");

    struct gpiod_line_request *req = ______(chip, rc, lc);   /* ③ 커널에 라인을 요청하는 함수 */

    gpiod_request_config_free(rc);
    gpiod_line_config_free(lc);
    gpiod_line_settings_free(s);
    gpiod_chip_close(chip);

    printf("[1단계] 결과 : 요청 %s\n", req ? "성공" : "실패");
    printf("[1단계] 기대값: 요청 성공\n\n");
    return req;
}

/* ───────────── 2단계: 횟수 깜빡임 ─────────────
 * n = 1, 2, 3 에 대해 빨강을 n 번 깜빡인 뒤 부저를 짧게 한 번 울린다. */
static void step2_count(struct gpiod_line_request *out)
{
    int blinks = 0, beeps = 0;
    for (int n = 1; n <= 3; n++) {
        for (int k = 0; k < n; k++) {
            gpiod_line_request_set_value(out, LED, ______);     /* ① 빨강 켜기 (논리값 1) */
            sleep_ms(200);
            gpiod_line_request_set_value(out, LED, ______);   /* ② 빨강 끄기 (논리값 0) */
            sleep_ms(200);
            blinks++;
        }
        beep(out, 100);
        beeps++;
        printf("  %d번 깜빡 + 삐\n", n);
        sleep_ms(600);
    }
    printf("[2단계] 결과 : 깜빡임 %d회, 삐 %d회\n", blinks, beeps);
    printf("[2단계] 기대값: 깜빡임 6회, 삐 3회 (1 · 2 · 3 번씩 깜빡인 뒤 매번 삐)\n\n");
}

/* ───────────── 3단계: 입력 라인 요청 · 첫 누름 기다리기 ─────────────
 * 버튼은 GND 쪽에 달려 있다 → 평소 1 을 만들어 주는 bias 가 필요하다. */
static struct gpiod_line_request *request_button(enum gpiod_line_edge edge, const char *consumer)
{
    struct gpiod_line_settings *s = gpiod_line_settings_new();
    gpiod_line_settings_set_direction(s, ______);   /* ① 입력 방향 상수 */
    gpiod_line_settings_set_bias(s, ______);           /* ② 내부 pull-up 상수 */
    gpiod_line_settings_set_edge_detection(s, edge);
    if (edge != GPIOD_LINE_EDGE_NONE)
        gpiod_line_settings_set_debounce_period_us(s, 10000);             /* 커널 디바운스 10 ms */
    struct gpiod_line_request *req = request_one(BTN, consumer, s);
    gpiod_line_settings_free(s);
    return req;
}

static void step3_first(struct gpiod_line_request *out)
{
    struct gpiod_line_request *btn = request_button(GPIOD_LINE_EDGE_NONE, "evalC_btn");
    if (!btn) return;

    int idle = gpiod_line_request_get_value(btn, BTN);
    printf("  5초 안에 버튼을 한 번 누르세요\n");
    int detected = 0;
    long long t0 = now_ms();
    while (!detected && now_ms() - t0 < 5000) {
        if (______(btn, BTN) == 0) detected = 1;   /* ③ 라인 값 하나 읽기 */
        sleep_ms(10);
    }
    if (detected) { set_line(out, LED2, 1); sleep_ms(500); set_line(out, LED2, 0); }
    sleep_ms(500);
    gpiod_line_request_release(btn);

    printf("[3단계] 결과 : 시작 값=%d, 누름 감지=%d\n", idle, detected);
    printf("[3단계] 기대값: 시작 값=1, 누름 감지=1 (감지되면 초록 0.5초)\n\n");
}

/* ───────────── 4단계: 폴링 — 누르는 동안 경보 ─────────────
 * 10초 동안 20 ms 마다 버튼을 읽어, 누르는 동안 빨강 LED 와 부저를 켠다. 눌린 횟수를 센다. */
static void step4_alarm(struct gpiod_line_request *out)
{
    struct gpiod_line_request *btn = request_button(GPIOD_LINE_EDGE_NONE, "evalC_poll");
    if (!btn) return;

    printf("  10초 동안 버튼을 3번 누르세요 (누르는 동안 빨강 + 부저)\n");
    int last = 1, presses = 0;
    long long t0 = now_ms();
    while (now_ms() - t0 < 10000) {
        int v = gpiod_line_request_get_value(btn, BTN);   /* 1 = 안 누름, 0 = 누름 */
        /* TODO 1:
         *   ① v 가 0 이면 빨강 LED 와 부저를 켜고, 1 이면 둘 다 끈다 (set_line 사용)
         *   ② last 가 1 이고 v 가 0 인 순간(눌리는 순간)에만 presses 를 1 늘리고 "  경보 #presses" 출력
         *   ③ last 를 v 로 갱신한다                                                  */

        sleep_ms(20);                                      /* 20 ms 간격 = 간단한 디바운스 */
    }
    set_line(out, LED, 0);
    set_line(out, BUZ, 0);
    gpiod_line_request_release(btn);

    printf("[4단계] 결과 : 눌림 %d회\n", presses);
    printf("[4단계] 기대값: 눌림 3회 (3번 눌렀을 때 · 손을 떼면 소리와 빨강이 꺼짐)\n\n");
}

/* ───────────── 5단계: 더블클릭 감지 ─────────────
 * falling 엣지 두 개의 간격이 400 ms 미만이면 '더블클릭' 이다 → 초록 LED 0.3초.
 * 더블클릭 2번이면 끝낸다 (30초 제한). */
static void step5_double(struct gpiod_line_request *out)
{
    struct gpiod_line_request *btn = request_button(GPIOD_LINE_EDGE_FALLING, "evalC_edge");
    if (!btn) return;

    struct gpiod_edge_event_buffer *buf = gpiod_edge_event_buffer_new(8);
    struct pollfd pfd = { .fd = gpiod_line_request_get_fd(btn), .events = POLLIN };
    int doubles = 0, singles = 0;
    long long last_ts = 0;                                 /* 짝을 기다리는 첫 누름의 시각(ns), 없으면 0 */

    printf("  버튼을 빠르게 두 번(더블클릭) 누르기를 2번 하세요\n");
    long long t0 = now_ms();
    while (doubles < 2 && now_ms() - t0 < 30000) {
        if (poll(&pfd, 1, 1000) <= 0) continue;
        int k = gpiod_line_request_read_edge_events(btn, buf, 8);
        for (int i = 0; i < k && doubles < 2; i++) {
            struct gpiod_edge_event *ev = gpiod_edge_event_buffer_get_event(buf, i);
            long long ts = (long long)gpiod_edge_event_get_timestamp_ns(ev);   /* 커널 타임스탬프(ns) */
            /* TODO 2:
             *   ① last_ts 가 0 이 아니고 (ts − last_ts) 가 400 ms(400000000 ns) 미만이면:
             *      doubles++, "  더블클릭 #doubles (간격 n ms)" 출력, 초록 0.3초 켜기, last_ts = 0
             *   ② 아니면: singles++, last_ts = ts (다음 누름을 기다린다)                  */

        }
    }
    gpiod_edge_event_buffer_free(buf);
    gpiod_line_request_release(btn);

    printf("[5단계] 결과 : 더블클릭 %d회\n", doubles);
    printf("[5단계] 기대값: 더블클릭 2회 (천천히 한 번씩 누르면 세지 않음)\n\n");
}

/* ───────────── 6단계: 누름 간격 재기 ─────────────
 * 버튼을 4번 누르면 커널 타임스탬프 4개가 생긴다. 이웃한 두 시각의 차이(간격) 3개와 평균을 구한다. */
static void step6_interval(struct gpiod_line_request *out)
{
    struct gpiod_line_request *btn = request_button(GPIOD_LINE_EDGE_FALLING, "evalC_gap");
    if (!btn) return;

    struct gpiod_edge_event_buffer *buf = gpiod_edge_event_buffer_new(8);
    struct pollfd pfd = { .fd = gpiod_line_request_get_fd(btn), .events = POLLIN };
    long long ts[4];
    int n = 0;

    printf("  일정한 박자로 버튼을 4번 누르세요 (30초 제한)\n");
    while (n < 4) {
        if (poll(&pfd, 1, 30000) <= 0) { printf("  시간 초과\n"); break; }
        int k = gpiod_line_request_read_edge_events(btn, buf, 8);
        for (int i = 0; i < k && n < 4; i++) {
            struct gpiod_edge_event *ev = gpiod_edge_event_buffer_get_event(buf, i);
            ts[n++] = (long long)gpiod_edge_event_get_timestamp_ns(ev);
            set_line(out, LED, 1); sleep_ms(80); set_line(out, LED, 0);
        }
    }

    int gaps = 0;
    long total_ms = 0;
    /* TODO 3: i = 1 ~ n-1 에 대해
     *   ① 간격 ms = (ts[i] − ts[i-1]) / 1000000 을 구해 "  간격 i: ms ms" 를 출력한다
     *   ② total_ms 에 더하고 gaps 를 1 늘린다                                        */

    long avg = gaps ? total_ms / gaps : 0;
    if (gaps == 3) beep(out, 300);                         /* 다 재면 삐 */
    gpiod_edge_event_buffer_free(buf);
    gpiod_line_request_release(btn);

    printf("[6단계] 결과 : 간격 %d개, 평균 측정=%s\n", gaps, avg > 0 ? "성공" : "실패");
    printf("[6단계] 기대값: 간격 3개, 평균 측정=성공 (평균 ms 는 사람마다 다름, 끝나면 '삐')\n\n");
}

int main(void)
{
    struct gpiod_line_request *out = step1_request_outputs();
    if (!out) return EXIT_FAILURE;

    step2_count(out);
    step3_first(out);
    step4_alarm(out);
    step5_double(out);
    step6_interval(out);

    enum gpiod_line_value off[3] = { GPIOD_LINE_VALUE_INACTIVE, GPIOD_LINE_VALUE_INACTIVE,
                                     GPIOD_LINE_VALUE_INACTIVE };
    gpiod_line_request_set_values(out, off);
    gpiod_line_request_release(out);            /* 요청한 라인은 반드시 반납 */
    printf("라인 반납 완료\n");
    return EXIT_SUCCESS;
}
