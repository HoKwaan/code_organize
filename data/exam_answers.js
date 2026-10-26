// 평가 양식 3개의 정답 — 손으로 정리한 데이터 (tools/build.sh 가 만들지 않는다).
//   window.EXAM_ANSWERS[양식 id] = [문제, ...]  (양식에 나오는 순서)
//   문제: { find: 그 문제 줄(TODO 는 첫 줄)에 들어 있는 글자, answer: 빈칸 정답(코드 그대로),
//           alt: 같이 맞는 다른 답, code: TODO 정답 코드(TODO 설명 아래에 넣는다), why: 설명 }
//   assets/app.js 가 문제마다 정답을 보여주고, 빈칸 · TODO 를 채운 전체 코드도 만든다.
//   tools/check_answers.js 로 모든 문제에 정답이 하나씩 맞는지 확인한다.
window.EXAM_ANSWERS = {
  'mcu-eval': [
    { find: 'sizeof(SOS) / ______', answer: 'sizeof(SOS[0])', alt: ['sizeof(int)'],
      why: '배열 원소 개수 = 배열 전체 바이트 수 / 원소 하나의 바이트 수. 강의 코드도 sizeof(arr) / sizeof(arr[0]) 꼴을 쓴다. 36 / 4 = 9.' },
    { find: 'pinMode(PIN_LED, ______)', answer: 'OUTPUT',
      why: 'LED 를 켜고 끄려면 핀을 출력 모드로 둔다.' },
    { find: 'pinMode(PIN_BTN, ______)', answer: 'INPUT_PULLUP',
      why: '버튼이 GND 쪽에 달려 있으므로 내부 풀업을 켠다. 안 누르면 HIGH, 누르면 LOW.' },
    { find: 'digitalRead(PIN_BTN) == ______', answer: 'LOW',
      why: 'INPUT_PULLUP 버튼은 눌렸을 때 GND 와 이어져 LOW 가 읽힌다.' },
    { find: 'ledcAttach(PIN_LED, 5000, ______)', answer: '8',
      why: '분해능 8비트 → 듀티 범위 0 ~ 2⁸−1 = 0 ~ 255.' },
    { find: 'int duty = 255 - ______', answer: 'd',
      why: 'd 가 0, 15, …, 255 로 늘어나므로 255 − d 는 255 → 0 으로 줄어든다. 18번 × 3회 = 54번, 마지막 듀티 0.' },
    { find: 'TODO 1', why: '눌리는 순간(HIGH → LOW 바뀜)에만 세야 누르고 있는 동안 여러 번 세지 않는다.',
      code: `if (last == HIGH && now == LOW) {
  count++;
  digitalWrite(PIN_LED, HIGH);
  delay(100);
  digitalWrite(PIN_LED, LOW);
  Serial.printf("누름 #%d\\n", count);
  if (count == 3) {
    unlocked = 1;
    digitalWrite(PIN_LED2, HIGH);
    Serial.println("잠금 해제!");
  }
}` },
    { find: 'TODO 2', why: '85 → 170 → 255 → 340(255 초과라 0) → 85. 밝기 합 = 85 + 170 + 255 + 0 + 85 = 595.',
      code: `bright += 85;
if (bright > 255) bright = 0;
ledcWrite(PIN_LED2, bright);
sum += bright;
Serial.printf("누름 #%d → 밝기 %d\\n", count, bright);` },
    { find: 'TODO 3', why: 'ledcWriteTone(핀, 주파수) 로 소리를 내고, 주파수 0 으로 끈다. 짧은 삐 3번 + 아래의 긴 삐 1번 = 4번.',
      code: `for (int n = 3; n >= 1; n--) {
  Serial.printf("카운트 %d\\n", n);
  digitalWrite(PIN_LED2, HIGH);
  ledcWriteTone(PIN_BUZ, 523);
  delay(200);
  ledcWriteTone(PIN_BUZ, 0);
  digitalWrite(PIN_LED2, LOW);
  delay(800);
  beeps++;
}` },
    { find: '______(PIN_BUZ, 262)', answer: 'ledcWriteTone',
      why: 'ESP32 core 3.x 에서 핀에 주파수(Hz)로 소리를 내는 함수. 바로 아래 줄의 ledcWriteTone(PIN_BUZ, 0) 이 소리를 끈다.' },
    { find: 'Serial.begin(______)', answer: '115200',
      why: '양식 머리말의 "시리얼 모니터 115200 baud" 와 같아야 글자가 깨지지 않는다.' },
  ],

  'linux-eval': [
    { find: 'fd == ______', answer: '-1',
      why: 'open 같은 시스템 콜은 실패하면 -1 을 돌려주고 errno 에 원인을 넣는다.' },
    { find: 'errno == ______', answer: 'ENOTDIR',
      why: '경로 중간(/etc/hostname)이 디렉터리가 아니면 ENOTDIR, strerror 는 "Not a directory".' },
    { find: 'O_WRONLY | ______', answer: 'O_APPEND',
      why: 'O_APPEND 로 열면 write 할 때마다 파일 끝으로 가서 쓴다. AB 뒤에 CD 가 붙어 ABCD.' },
    { find: 'open("c_log.txt", ______)', answer: 'O_RDONLY',
      why: '읽기 전용 플래그.' },
    { find: '______("c_link", &st)', answer: 'lstat',
      why: 'stat 은 링크를 따라가 c_log.txt 의 정보를 읽는다. 링크 자체를 보려면 lstat → S_ISLNK 가 참.' },
    { find: 'return ______(status)', answer: 'WEXITSTATUS',
      why: 'wait 이 준 status 에서 exit() 에 넘긴 종료 코드(0~255)를 꺼내는 매크로. WIFEXITED 로 정상 종료인지 먼저 본다.' },
    { find: 'TODO 1', why: '자식이 3개이므로 wait 을 3번 부른다. 종료 코드 1 + 2 + 3 = 6.',
      code: `for (int i = 0; i < 3; i++) {
    int status;
    if (wait(&status) > 0 && WIFEXITED(status)) {
        sum += exit_code(status);
        reaped++;
    }
}` },
    { find: 'TODO 2', why: 'strncmp 로 줄 앞부분이 key 와 같은지 보고, key 뒤의 첫 단어를 sscanf %63s 로 꺼낸다(탭 · 공백은 건너뜀).',
      code: `FILE *fp = fopen("/proc/self/status", "r");
if (!fp) return 0;
char line[256];
while (fgets(line, sizeof line, fp)) {
    if (strncmp(line, key, strlen(key)) == 0) {
        sscanf(line + strlen(key), "%63s", out);
        found = 1;
        break;
    }
}
fclose(fp);` },
    { find: 'TODO 3', why: '공유 변수를 바꾸는 동안 mutex 로 보호하고, 바꾼 뒤 signal 로 기다리는 쓰레드를 깨운다.',
      code: `pthread_mutex_lock(&g_lock);
g_result = sum;
g_ready = 1;
pthread_cond_signal(&g_cond);
pthread_mutex_unlock(&g_lock);` },
    { find: '______(&t, NULL, calc_worker, NULL)', answer: 'pthread_create',
      why: 'pthread_create(&쓰레드, 속성, 함수, 인자).' },
    { find: '______(&g_cond, &g_lock)', answer: 'pthread_cond_wait',
      why: 'mutex 를 풀고 잠들었다가, signal 을 받고 깨어나면 mutex 를 다시 잡은 채로 돌아온다.' },
  ],

  'eio-eval': [
    { find: 'gpiod_chip_open(______)', answer: 'CHIP_PATH', alt: ['"/dev/gpiochip0"'],
      why: '파일 위에 #define CHIP_PATH "/dev/gpiochip0" 이 있다. Raspberry Pi 4 의 40핀 헤더 GPIO 는 gpiochip0.' },
    { find: 'set_output_value(s, ______)', answer: 'GPIOD_LINE_VALUE_INACTIVE',
      why: 'libgpiod v2 의 논리값 0(꺼짐) 상수. 1(켜짐)은 GPIOD_LINE_VALUE_ACTIVE.' },
    { find: '______(chip, rc, lc)', answer: 'gpiod_chip_request_lines',
      why: 'chip 에 request_config · line_config 를 주고 라인을 요청한다. 같은 파일의 request_one() 에도 같은 호출이 있다.' },
    { find: '① 빨강 켜기', answer: 'GPIOD_LINE_VALUE_ACTIVE',
      why: '논리값 1 = 켜기.' },
    { find: '② 빨강 끄기', answer: 'GPIOD_LINE_VALUE_INACTIVE',
      why: '논리값 0 = 끄기.' },
    { find: 'set_direction(s, ______)', answer: 'GPIOD_LINE_DIRECTION_INPUT',
      why: '입력 방향 상수. 출력은 GPIOD_LINE_DIRECTION_OUTPUT.' },
    { find: 'set_bias(s, ______)', answer: 'GPIOD_LINE_BIAS_PULL_UP',
      why: '버튼이 GND 쪽이므로 내부 pull-up 으로 평소 1, 누르면 0.' },
    { find: '______(btn, BTN) == 0', answer: 'gpiod_line_request_get_value',
      why: '요청한 라인 하나의 값을 읽는다. 바로 위 idle 줄에도 같은 함수가 있다.' },
    { find: 'TODO 1', why: '값에 따라 켜고 끄기는 매번, 개수 세기는 1 → 0 으로 바뀌는 순간에만 한다.',
      code: `set_line(out, LED, v == 0);
set_line(out, BUZ, v == 0);
if (last == 1 && v == 0) {
    presses++;
    printf("  경보 #%d\\n", presses);
}
last = v;` },
    { find: 'TODO 2', why: '타임스탬프 단위는 ns 이므로 400 ms = 400000000 ns. 더블클릭으로 쓴 누름은 last_ts = 0 으로 짝을 끊는다.',
      code: `if (last_ts != 0 && ts - last_ts < 400000000LL) {
    doubles++;
    printf("  더블클릭 #%d (간격 %lld ms)\\n", doubles, (ts - last_ts) / 1000000);
    set_line(out, LED2, 1);
    sleep_ms(300);
    set_line(out, LED2, 0);
    last_ts = 0;
} else {
    singles++;
    last_ts = ts;
}` },
    { find: 'TODO 3', why: '누름 4번 → 이웃한 차이 3개. ns 를 1000000 으로 나누면 ms.',
      code: `for (int i = 1; i < n; i++) {
    long ms = (long)((ts[i] - ts[i - 1]) / 1000000);
    printf("  간격 %d: %ld ms\\n", i, ms);
    total_ms += ms;
    gaps++;
}` },
  ],
};
