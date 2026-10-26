# API 목록: 시험 빈칸에 들어갈 수 있는 표준 API (사용 예 + 한글 설명).
# tools/refs.py 가 줄마다 강의 코드에서 같은 API 를 쓰는 줄을 찾아 그 줄로 바꾸고, 강의 자료에 없는 줄만 '보충' 으로 남긴다.
SUPP = [
 ('linux', '보충 · open 플래그와 파일 모드', 'c', '''int fd = open(path, O_RDONLY);                         // 읽기 전용으로 열기
int fd = open(path, O_WRONLY);                         // 쓰기 전용으로 열기
int fd = open(path, O_RDWR);                           // 읽기 · 쓰기 둘 다
int fd = open(path, O_WRONLY | O_CREAT | O_TRUNC, 0644); // 없으면 만들고, 있으면 내용을 비우고 새로 쓰기
int fd = open(path, O_WRONLY | O_APPEND);              // 항상 파일 끝에 이어 쓰기 (append)
int fd = open(path, O_WRONLY | O_CREAT | O_APPEND, 0644); // 없으면 만들고 끝에 이어 쓰기
int fd = open(path, O_WRONLY | O_CREAT | O_EXCL, 0644);  // 이미 있으면 실패 (새 파일만)
int fd = open(path, O_RDONLY | O_NONBLOCK);            // 기다리지 않는(논블로킹) 읽기
int fd = open(path, O_WRONLY | O_SYNC);                // 쓸 때마다 디스크까지 기록
off_t pos = lseek(fd, 0, SEEK_END);                    // 파일 끝으로 이동 (크기 알아내기)
lseek(fd, 0, SEEK_SET);                                // 파일 처음으로 되감기
lseek(fd, 10, SEEK_CUR);                               // 현재 위치에서 10바이트 앞으로
FILE *fp = fopen(path, "r");                           // 읽기
FILE *fp = fopen(path, "w");                           // 새로 쓰기 (기존 내용 삭제)
FILE *fp = fopen(path, "a");                           // 끝에 이어 쓰기'''),
 ('linux', '보충 · errno 이름과 오류 처리', 'c', '''if (fd == -1) perror("open");                          // 시스템 콜은 실패하면 -1 을 돌려주고 errno 를 설정
if (p == NULL) perror("fopen");                        // 라이브러리 함수는 실패하면 NULL
if (errno == ENOENT)  printf("No such file or directory\\n");   // 파일이나 디렉터리가 없음
if (errno == ENOTDIR) printf("Not a directory\\n");             // 경로 중간이 디렉터리가 아님
if (errno == EISDIR)  printf("Is a directory\\n");              // 디렉터리를 파일처럼 열었음
if (errno == EACCES)  printf("Permission denied\\n");           // 권한이 없음
if (errno == EEXIST)  printf("File exists\\n");                 // 이미 있음 (O_EXCL, mkdir)
if (errno == EBADF)   printf("Bad file descriptor\\n");         // 잘못된(닫힌) fd
if (errno == EINTR)   printf("Interrupted system call\\n");     // 시그널 때문에 중단됨 → 다시 시도
if (errno == EAGAIN)  printf("Resource temporarily unavailable\\n"); // 논블로킹에서 지금은 데이터 없음
if (errno == EBUSY)   printf("Device or resource busy\\n");     // 다른 프로세스가 쓰는 중
if (errno == ENOMEM)  printf("Cannot allocate memory\\n");      // 메모리 부족
if (errno == EINVAL)  printf("Invalid argument\\n");            // 잘못된 인자
if (errno == ECHILD)  printf("No child processes\\n");          // 기다릴 자식이 없음
printf("%s\\n", strerror(errno));                      // errno 를 문장으로'''),
 ('linux', '보충 · stat 계열과 파일 종류 매크로', 'c', '''stat(path, &st);                                       // 링크를 따라가서 대상 파일의 정보
lstat(path, &st);                                      // 링크를 따라가지 않고 링크 자체의 정보
fstat(fd, &st);                                        // 열린 fd 의 정보
S_ISREG(st.st_mode)                                    // 일반 파일인가
S_ISDIR(st.st_mode)                                    // 디렉터리인가
S_ISLNK(st.st_mode)                                    // 심볼릭 링크인가 (lstat 으로 읽어야 함)
S_ISCHR(st.st_mode)                                    // 문자 장치인가
ssize_t n = readlink(path, buf, sizeof(buf) - 1);      // 링크가 가리키는 경로 읽기 (끝에 \\0 을 붙여야 함)
symlink(target, linkpath);                             // 심볼릭 링크 만들기
link(oldpath, newpath);                                // 하드 링크 만들기
unlink(path);                                          // 파일(이름) 지우기
st.st_size                                             // 파일 크기(바이트)
st.st_ino                                              // inode 번호
st.st_nlink                                            // 하드 링크 수'''),
 ('linux', '보충 · 프로세스 · wait 매크로', 'c', '''pid_t pid = fork();                                    // 자식이면 0, 부모면 자식 PID, 실패면 -1
pid_t w = wait(&status);                               // 끝난 자식 하나를 회수 (아무 자식이나)
pid_t w = waitpid(pid, &status, 0);                    // 특정 자식이 끝날 때까지 기다림
pid_t w = waitpid(-1, &status, WNOHANG);               // 끝난 자식이 없으면 기다리지 않고 0
if (WIFEXITED(status))   code = WEXITSTATUS(status);   // 정상 종료인가 / 종료 코드(0~255) 꺼내기
if (WIFSIGNALED(status)) sig = WTERMSIG(status);       // 시그널로 죽었는가 / 그 시그널 번호
execvp(argv[0], argv);                                 // 프로그램 바꿔 실행 (PATH 검색, 인자 배열)
execlp("ls", "ls", "-l", NULL);                        // 프로그램 바꿔 실행 (인자 나열)
_exit(127);                                            // exec 실패 시 자식 종료 (stdio 버퍼를 비우지 않음)
exit(0);                                               // 정상 종료 (stdio 버퍼 비움)
pid_t me = getpid();                                   // 내 PID
pid_t parent = getppid();                              // 부모 PID'''),
 ('linux', '보충 · pthread 함수', 'c', '''pthread_create(&t, NULL, worker, arg);                 // 쓰레드 만들기
pthread_join(t, &ret);                                 // 쓰레드가 끝날 때까지 기다리고 반환값 회수
pthread_detach(t);                                     // 기다리지 않을 쓰레드로 (끝나면 자동 정리)
pthread_exit(NULL);                                    // 지금 쓰레드만 끝내기
pthread_self();                                        // 내 쓰레드 ID
pthread_mutex_lock(&m);                                // 잠금 잡기 (이미 잡혀 있으면 기다림)
pthread_mutex_unlock(&m);                              // 잠금 풀기
pthread_mutex_trylock(&m);                             // 기다리지 않고 잡아 보기 (실패하면 EBUSY)
pthread_cond_wait(&cv, &m);                            // mutex 를 풀고 잠들었다가, 깨면 다시 잡는다
pthread_cond_timedwait(&cv, &m, &deadline);            // 위와 같지만 절대 시각까지만 기다림
pthread_cond_signal(&cv);                              // 기다리는 쓰레드 하나 깨우기
pthread_cond_broadcast(&cv);                           // 기다리는 쓰레드 모두 깨우기
static pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;  // mutex 정적 초기화
static pthread_cond_t cv = PTHREAD_COND_INITIALIZER;   // 조건 변수 정적 초기화
sem_init(&s, 0, 2);                                    // 세마포어 초기값 2 (0 = 같은 프로세스의 쓰레드끼리)
sem_wait(&s);                                          // 값이 0 이면 기다렸다가 1 줄이기 (P)
sem_post(&s);                                          // 값 1 늘리기 (V)'''),
 ('linux', '보충 · 시그널', 'c', '''signal(SIGINT, handler);                               // Ctrl+C 를 받으면 handler 실행
signal(SIGINT, SIG_IGN);                               // 시그널 무시
signal(SIGINT, SIG_DFL);                               // 기본 동작으로 되돌리기
sigaction(SIGINT, &sa, NULL);                          // 시그널 핸들러 등록 (권장 방식)
sigemptyset(&sa.sa_mask);                              // 핸들러 실행 중 막을 시그널 없음
kill(pid, SIGTERM);                                    // 프로세스에 종료 요청 시그널 보내기
kill(pid, SIGKILL);                                    // 강제 종료 (막을 수 없음)
alarm(3);                                              // 3초 뒤 SIGALRM
pause();                                               // 시그널이 올 때까지 잠듦'''),
 ('mcu', '보충 · Arduino / ESP32 기본 함수', 'cpp', '''pinMode(pin, OUTPUT);                                  // 핀을 출력으로
pinMode(pin, INPUT);                                   // 핀을 입력으로 (풀업 없음)
pinMode(pin, INPUT_PULLUP);                            // 내부 풀업 입력 (안 누르면 HIGH, 누르면 LOW)
pinMode(pin, INPUT_PULLDOWN);                          // 내부 풀다운 입력 (ESP32)
digitalWrite(pin, HIGH);                               // 핀을 HIGH(켜기)
digitalWrite(pin, LOW);                                // 핀을 LOW(끄기)
int v = digitalRead(pin);                              // 디지털 값 읽기 (HIGH / LOW)
int a = analogRead(pin);                               // 아날로그 값 읽기 (ESP32 0~4095, 12비트)
int mv = analogReadMilliVolts(pin);                    // 아날로그 전압을 mV 로
Serial.begin(115200);                                  // 시리얼 통신 속도(보드레이트) — 시리얼 모니터와 같게
Serial.println("text");                                // 한 줄 출력
Serial.printf("%d\\n", v);                              // 서식 출력
delay(1000);                                           // ms 단위로 멈춤
delayMicroseconds(10);                                 // µs 단위로 멈춤
unsigned long t = millis();                            // 부팅 후 ms
unsigned long u = micros();                            // 부팅 후 µs
ledcAttach(pin, 5000, 8);                              // PWM 연결: 핀, 주파수(Hz), 분해능(비트) 8비트 → 0~255
ledcWrite(pin, duty);                                  // PWM 듀티 쓰기 (밝기)
ledcWriteTone(pin, 262);                               // 주파수(Hz)로 부저 소리 내기, 0 이면 끄기
ledcDetach(pin);                                       // PWM 해제
tone(pin, 262, 200);                                   // 주파수 소리 (Arduino 공통)
noTone(pin);                                           // 소리 끄기
attachInterrupt(digitalPinToInterrupt(pin), isr, FALLING); // 인터럽트 등록 (FALLING · RISING · CHANGE)
detachInterrupt(digitalPinToInterrupt(pin));           // 인터럽트 해제
int n = sizeof(arr) / sizeof(arr[0]);                  // 배열 원소 개수 = 전체 크기 / 원소 하나 크기
long y = map(x, 0, 4095, 0, 255);                      // 값 범위 바꾸기
int c = constrain(x, 0, 255);                          // 범위 안으로 자르기'''),
 ('eio', '보충 · libgpiod v2 함수와 상수', 'c', '''struct gpiod_chip *chip = gpiod_chip_open("/dev/gpiochip0");          // 칩 열기 (40핀 헤더 GPIO = gpiochip0)
struct gpiod_line_settings *s = gpiod_line_settings_new();             // 라인 설정 객체
gpiod_line_settings_set_direction(s, GPIOD_LINE_DIRECTION_OUTPUT);     // 출력 방향
gpiod_line_settings_set_direction(s, GPIOD_LINE_DIRECTION_INPUT);      // 입력 방향
gpiod_line_settings_set_output_value(s, GPIOD_LINE_VALUE_INACTIVE);    // 처음 값 = 꺼짐(논리 0)
gpiod_line_settings_set_output_value(s, GPIOD_LINE_VALUE_ACTIVE);      // 처음 값 = 켜짐(논리 1)
gpiod_line_settings_set_bias(s, GPIOD_LINE_BIAS_PULL_UP);              // 내부 pull-up
gpiod_line_settings_set_bias(s, GPIOD_LINE_BIAS_PULL_DOWN);            // 내부 pull-down
gpiod_line_settings_set_bias(s, GPIOD_LINE_BIAS_DISABLED);             // bias 끄기
gpiod_line_settings_set_edge_detection(s, GPIOD_LINE_EDGE_FALLING);    // 누르는 순간(1→0) 엣지
gpiod_line_settings_set_edge_detection(s, GPIOD_LINE_EDGE_RISING);     // 떼는 순간(0→1) 엣지
gpiod_line_settings_set_edge_detection(s, GPIOD_LINE_EDGE_BOTH);       // 양쪽 엣지
gpiod_line_settings_set_debounce_period_us(s, 10000);                  // 커널 디바운스 10 ms
gpiod_line_settings_set_active_low(s, true);                           // 논리 1 = 0V 로 뒤집기
struct gpiod_line_config *lc = gpiod_line_config_new();                // 라인 묶음 설정
gpiod_line_config_add_line_settings(lc, offsets, n, s);                // 라인 번호들에 설정 붙이기
struct gpiod_request_config *rc = gpiod_request_config_new();          // 요청 설정
gpiod_request_config_set_consumer(rc, "name");                         // 사용자 이름 (gpioinfo 에 보임)
struct gpiod_line_request *req = gpiod_chip_request_lines(chip, rc, lc); // 커널에 라인 요청
gpiod_line_request_set_value(req, offset, GPIOD_LINE_VALUE_ACTIVE);    // 라인 하나에 값 쓰기 (켜기)
gpiod_line_request_set_value(req, offset, GPIOD_LINE_VALUE_INACTIVE);  // 라인 하나에 값 쓰기 (끄기)
gpiod_line_request_set_values(req, values);                            // 여러 라인 한 번에 쓰기
int v = gpiod_line_request_get_value(req, offset);                     // 라인 값 하나 읽기
int fd = gpiod_line_request_get_fd(req);                               // poll 용 파일 디스크립터
struct gpiod_edge_event_buffer *buf = gpiod_edge_event_buffer_new(8);  // 엣지 이벤트 버퍼
int k = gpiod_line_request_read_edge_events(req, buf, 8);              // 엣지 이벤트 읽기 (개수 반환)
struct gpiod_edge_event *ev = gpiod_edge_event_buffer_get_event(buf, i); // i 번째 이벤트
uint64_t ts = gpiod_edge_event_get_timestamp_ns(ev);                   // 커널 타임스탬프(ns)
int type = gpiod_edge_event_get_event_type(ev);                        // GPIOD_EDGE_EVENT_FALLING_EDGE / RISING_EDGE
unsigned int off = gpiod_edge_event_get_line_offset(ev);               // 어느 라인의 이벤트인가
gpiod_line_request_release(req);                                       // 요청한 라인 반납
gpiod_chip_close(chip);                                                // 칩 닫기
int r = poll(&pfd, 1, timeout_ms);                                     // 이벤트가 올 때까지 기다림 (0 = 시간 초과)'''),
]
