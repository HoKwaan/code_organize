/* mcu_eval_template.ino — 2차 평가(C형) · MCU 동작 원리 실습 (정규 평가)
 *
 * 환경 : Arduino IDE 2.x · esp32 by Espressif 3.x (ESP32 Dev Module) · 시리얼 모니터 115200 baud
 * 배선 : (Day 1 그림 1 과 같은 자리 — 부품 4개 사용)
 *        GPIO25 → 220Ω → LED 빨강(+, 긴 다리) → GND
 *        GPIO27 → 220Ω → LED 초록(+, 긴 다리) → GND
 *        GPIO4  → 버튼 → GND                (대각선 두 다리, 내부 풀업 사용)
 *        GPIO23 → Passive Buzzer(+) → GND   (뒷면에 기판이 보이는 부저)
 * 사용법: 맨 위 STEP 값을 1 → 6 으로 바꿔 가며 업로드(Ctrl+U)하고 시리얼 모니터(Ctrl+Shift+M)를 본다.
 *        각 단계 끝의 [N단계] 결과 와 [N단계] 기대값 이 같고 부품이 설명대로 동작하면 완료.
 *        결과가 안 보이면 보드의 EN 버튼을 한 번 누른다.
 *
 * 규칙 : 빈칸 ______ 8곳과 TODO 3곳만 채운다. [N단계] 결과 / 기대값 출력 코드는 고치지 않는다.
 *        STEP 으로 고른 단계만 컴파일되므로, 못 채운 단계가 있어도 다른 단계는 진행할 수 있다.
 *        (단, setup() 의 빈칸 ③ 은 모든 단계에 필요하므로 1단계에서 먼저 채운다)
 *
 *  단계  주제                                    Day 1   형태
 *   1    출력 — SOS 모스 신호 (길이 표)              3교시   빈칸 3
 *   2    입력 — 누르고 있던 시간 비율(%) 재기        5교시   빈칸 2
 *   3    3번 누르면 잠금 해제                       5교시   TODO 1
 *   4    PWM — 서서히 어두워지기(fade out)          7교시   빈칸 2
 *   5    버튼으로 초록 밝기 올리기 (넘치면 0)        7교시   TODO 2
 *   6    카운트다운 — 부저 + LED                    7교시   빈칸 1 + TODO 3
 */
#define STEP 1                      // ← 1 ~ 6 으로 바꿔 가며 업로드

const int PIN_LED  = 25;            // LED 빨강
const int PIN_LED2 = 27;            // LED 초록
const int PIN_BTN  = 4;             // 버튼
const int PIN_BUZ  = 23;            // Passive Buzzer

#if STEP == 1
/* ───────────── 1단계: SOS 모스 신호 ─────────────
 * 켜져 있을 시간(ms)을 표로 만들고, 표를 따라 빨강 LED 를 켠다. 짧게(200) 3 · 길게(600) 3 · 짧게(200) 3. */
const int SOS[] = { 200, 200, 200, 600, 600, 600, 200, 200, 200 };
const int N_SIG = sizeof(SOS) / ______;                // ① 원소 개수 = 전체 크기 / 원소 하나 크기

void run_step() {
  pinMode(PIN_LED, ______);                                     // ② 빨강 LED 핀을 출력으로
  int on_total = 0;
  for (int i = 0; i < N_SIG; i++) {
    digitalWrite(PIN_LED, HIGH); delay(SOS[i]);
    digitalWrite(PIN_LED, LOW);  delay(200);
    on_total += SOS[i];
    Serial.printf("신호 %d: %d ms\n", i + 1, SOS[i]);
  }
  Serial.printf("[1단계] 결과 : 신호 %d개, 켜진 시간 합 %d ms\n", N_SIG, on_total);
  Serial.println("[1단계] 기대값: 신호 9개, 켜진 시간 합 3000 ms (· · · — — — · · ·)");
}

#elif STEP == 2
/* ───────────── 2단계: 누르고 있던 시간 비율 ─────────────
 * 5초 동안 10 ms 마다 버튼을 읽어(500번), 눌린 표본의 비율(%)을 구한다. 누르는 동안 빨강 LED ON. */
void run_step() {
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_BTN, ______);                              // ① 내부 풀업 입력 모드
  Serial.println("5초 동안 버튼을 '절반쯤' 누르고 있으세요 (예: 처음 2.5초 누르고 떼기)");
  delay(1000);
  int pressed = 0;
  for (int i = 0; i < 500; i++) {
    int on = digitalRead(PIN_BTN) == ______;                       // ② 눌렸을 때 읽히는 값
    if (on) pressed++;
    digitalWrite(PIN_LED, on);
    delay(10);
  }
  digitalWrite(PIN_LED, LOW);
  int pct = pressed * 100 / 500;
  Serial.printf("[2단계] 결과 : 누름 비율 %d%% → %s\n", pct, (pct >= 30 && pct <= 70) ? "범위 안" : "범위 밖");
  Serial.println("[2단계] 기대값: 누름 비율 30~70% → 범위 안 (안 누르면 0%, 계속 누르면 100%)");
}

#elif STEP == 3
/* ───────────── 3단계: 3번 누르면 잠금 해제 ─────────────
 * 누를 때마다 빨강을 0.1초 깜빡이고, 3번째 누름에서 초록을 켠다(잠금 해제). */
void run_step() {
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_LED2, OUTPUT);
  pinMode(PIN_BTN, INPUT_PULLUP);
  Serial.println("버튼을 3번 누르세요");

  int last = HIGH, count = 0, unlocked = 0;
  while (!unlocked) {
    int now = digitalRead(PIN_BTN);
    // TODO 1: 눌리는 순간(last==HIGH && now==LOW)에만
    //   ① count 를 1 늘리고 빨강 LED 를 100 ms 켰다 끈다
    //   ② "누름 #count" 를 출력한다
    //   ③ count 가 3 이 되면 unlocked = 1, 초록 LED 를 켜고 "잠금 해제!" 를 출력한다

    last = now;
    delay(30);                                     // 간단한 디바운스
  }
  Serial.printf("[3단계] 결과 : count=%d, unlocked=%d\n", count, unlocked);
  Serial.println("[3단계] 기대값: count=3, unlocked=1 (초록 LED 가 켜진 채로 끝남)");
}

#elif STEP == 4
/* ───────────── 4단계: 서서히 어두워지기 ─────────────
 * 듀티를 255 → 0 으로 15씩 줄이며 빨강 LED 를 서서히 끈다. 이것을 3번 반복한다. */
void run_step() {
  ledcAttach(PIN_LED, 5000, ______);                                 // ① 분해능(비트 수) — 듀티 범위가 0~255 가 되도록
  int writes = 0, last_duty = -1;
  for (int rep = 0; rep < 3; rep++) {
    for (int d = 0; d <= 255; d += 15) {
      int duty = 255 - ______;                                       // ② 0 부터 늘어나는 변수 — 빼서 어두워지게
      ledcWrite(PIN_LED, duty);
      last_duty = duty;
      writes++;
      delay(40);
    }
  }
  Serial.printf("[4단계] 결과 : 쓰기 %d번, 마지막 듀티=%d\n", writes, last_duty);
  Serial.println("[4단계] 기대값: 쓰기 54번, 마지막 듀티=0 (밝음 → 꺼짐 을 3번 반복)");
}

#elif STEP == 5
/* ───────────── 5단계: 버튼으로 초록 밝기 올리기 ─────────────
 * 처음 밝기 0. 누를 때마다 85 씩 올리고, 255 를 넘으면 0 으로 돌아간다. 5번 누르면 끝낸다. */
void run_step() {
  pinMode(PIN_BTN, INPUT_PULLUP);
  ledcAttach(PIN_LED2, 5000, 8);
  int bright = 0, last = HIGH, count = 0, sum = 0;
  ledcWrite(PIN_LED2, bright);
  Serial.println("버튼을 5번 누르세요 (누를 때마다 초록이 밝아짐)");

  while (count < 5) {
    int now = digitalRead(PIN_BTN);
    if (last == HIGH && now == LOW) {
      count++;
      // TODO 2:
      //   ① bright 에 85 를 더하고, 255 보다 크면 0 으로 만든다
      //   ② ledcWrite 로 초록 LED 에 bright 를 출력한다
      //   ③ sum 에 bright 를 더하고 "누름 #count → 밝기 bright" 를 출력한다

    }
    last = now;
    delay(30);
  }
  ledcWrite(PIN_LED2, 0);
  Serial.printf("[5단계] 결과 : 마지막 밝기=%d, 밝기 합=%d\n", bright, sum);
  Serial.println("[5단계] 기대값: 마지막 밝기=85, 밝기 합=595 (85 → 170 → 255 → 0 → 85)");
}

#elif STEP == 6
/* ───────────── 6단계: 카운트다운 ─────────────
 * 버튼을 누르면 3 → 2 → 1 을 셀 때마다 초록 LED + 짧은 삐(523 Hz, 0.2초), 0 에서 빨강 LED + 긴 삐(262 Hz, 1초). */
void run_step() {
  pinMode(PIN_BTN, INPUT_PULLUP);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_LED2, OUTPUT);
  ledcAttach(PIN_BUZ, 1000, 10);
  Serial.println("버튼을 누르면 카운트다운이 시작됩니다");
  while (digitalRead(PIN_BTN) == HIGH) delay(10);   // 누를 때까지 기다리기

  int beeps = 0;
  // TODO 3: n = 3, 2, 1 에 대해 차례로
  //   ① "카운트 n" 을 출력하고, 초록 LED 를 켠 채 523 Hz 를 200 ms 울린 뒤 소리와 LED 를 끈다
  //   ② 800 ms 쉬고, beeps 를 1 늘린다

  Serial.println("카운트 0 — 출발!");
  digitalWrite(PIN_LED, HIGH);
  ______(PIN_BUZ, 262);                   // ① 주파수로 부저 소리를 내는 함수
  delay(1000);
  ledcWriteTone(PIN_BUZ, 0);
  digitalWrite(PIN_LED, LOW);
  beeps++;

  Serial.printf("[6단계] 결과 : 삐 %d번\n", beeps);
  Serial.println("[6단계] 기대값: 삐 4번 (짧은 삐 3번 + 긴 삐 1번, 끝나면 소리와 LED 모두 꺼짐)");
}
#endif

void setup() {
  Serial.begin(______);                         // ③ 시리얼 모니터와 같은 통신 속도 (1단계에서 채운다)
  delay(500);
  Serial.printf("\n=== 2차 평가(C형) MCU · STEP %d ===\n", STEP);
  run_step();
}

void loop() {
}
