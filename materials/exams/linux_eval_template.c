/* linux_eval_template.c — 2차 평가(C형) · Linux & Shell 실습 (정규 평가)
 *
 * 환경 : VirtualBox · Ubuntu Server 22.04 (운영체제 수업 VM) · PuTTY 접속
 * 빌드 : gcc -Wall -g -pthread -o linux_eval linux_eval_template.c
 * 실행 : ./linux_eval
 *
 * 규칙
 *  - 빈칸 ______ 8곳과 TODO 3곳만 채운다.
 *  - 각 단계 끝의 printf("[N단계] 결과 ...") / printf("[N단계] 기대값 ...") 는 고치지 않는다.
 *  - 두 줄이 같으면 그 단계는 완료. 빌드가 안 되는 단계가 있으면 main() 에서 그 단계만
 *    주석 처리하고 나머지 단계를 진행해도 된다.
 *
 *  단계  주제                                   Day   형태
 *   1    경로 오류와 errno (ENOTDIR)             1    빈칸 2
 *   2    O_APPEND 로 이어 쓰기                   4    빈칸 2
 *   3    심볼릭 링크와 lstat · readlink          4    빈칸 1
 *   4    자식 3개 만들고 종료 코드 모두 회수        1    빈칸 1 + TODO 1
 *   5    /proc/self/status 에서 문자열 · 숫자 읽기  1    TODO 2 (함수)
 *   6    조건 변수로 결과 기다리기                 5    빈칸 2 + TODO 3
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <pthread.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/wait.h>

/* ───────────── 1단계: 경로 오류와 errno ─────────────
 * 일반 파일(/etc/hostname) 아래에 또 경로를 붙여 열면 "디렉터리가 아니다" 오류가 난다. */
static void step1(void)
{
    int fd = open("/etc/hostname/abc", O_RDONLY);
    int failed  = (fd == ______);                       /* ① 시스템 콜이 실패했을 때 돌려주는 값 */
    int notdir  = (errno == ______);               /* ② "디렉터리가 아니다" 를 뜻하는 errno 이름 */

    printf("[1단계] 결과 : failed=%d, ENOTDIR=%d, msg=%s\n", failed, notdir, strerror(errno));
    printf("[1단계] 기대값: failed=1, ENOTDIR=1, msg=Not a directory\n\n");
}

/* ───────────── 2단계: O_APPEND 로 이어 쓰기 ─────────────
 * "AB" 를 새로 쓰고, 다시 열어 끝에 "CD" 를 이어 쓴다. 읽어 보면 "ABCD". */
static void step2(void)
{
    int fd = open("c_log.txt", O_WRONLY | O_CREAT | O_TRUNC, 0644);
    write(fd, "AB", 2);
    close(fd);

    fd = open("c_log.txt", O_WRONLY | ______);     /* ① 항상 파일 끝에 쓰게 하는 플래그 */
    write(fd, "CD", 2);
    close(fd);

    char buf[16] = {0};
    fd = open("c_log.txt", ______);               /* ② 읽기 전용으로 열기 */
    ssize_t r = read(fd, buf, sizeof buf - 1);
    close(fd);

    printf("[2단계] 결과 : 크기=%zd, 내용=%s\n", r, buf);
    printf("[2단계] 기대값: 크기=4, 내용=ABCD\n\n");
}

/* ───────────── 3단계: 심볼릭 링크 ─────────────
 * c_link → c_log.txt 심볼릭 링크를 만들고, 링크 자체의 정보와 가리키는 경로를 읽는다. */
static void step3(void)
{
    unlink("c_link");
    symlink("c_log.txt", "c_link");

    struct stat st;
    ______("c_link", &st);                          /* ① 링크를 따라가지 않고 "링크 자체" 의 정보를 읽는 함수 */
    char target[64] = {0};
    readlink("c_link", target, sizeof target - 1);

    printf("[3단계] 결과 : 심볼릭 링크=%d, 가리키는 곳=%s\n", S_ISLNK(st.st_mode) ? 1 : 0, target);
    printf("[3단계] 기대값: 심볼릭 링크=1, 가리키는 곳=c_log.txt\n\n");
}

/* ───────────── 4단계: 자식 3개의 종료 코드 모두 회수 ─────────────
 * i = 0, 1, 2 번째 자식은 각각 exit(i + 1) 로 끝난다. 부모는 셋을 모두 기다려 종료 코드를 더한다. */
static int exit_code(int status)
{
    return ______(status);                    /* ① 종료 상태에서 종료 코드(0~255)를 꺼내는 매크로 */
}

static void step4(void)
{
    fflush(stdout);                                  /* fork 전에 stdio 버퍼 비우기 */
    for (int i = 0; i < 3; i++) {
        pid_t pid = fork();
        if (pid == 0) exit(i + 1);
    }

    int sum = 0, reaped = 0;
    /* TODO 1: 3번 반복하며 wait(&status) 로 끝난 자식 하나를 회수하고,
     *         정상 종료(WIFEXITED)이면 exit_code(status) 를 sum 에 더하고 reaped 를 1 늘린다 */


    printf("[4단계] 결과 : 회수 %d개, 종료 코드 합=%d\n", reaped, sum);
    printf("[4단계] 기대값: 회수 3개, 종료 코드 합=6 (1 + 2 + 3)\n\n");
}

/* ───────────── 5단계: /proc/self/status 에서 값 읽기 ─────────────
 * key 로 시작하는 줄을 찾아, key 뒤의 첫 단어를 out 에 복사한다. 찾으면 1, 못 찾으면 0.
 *   예) "Name:\tlinux_eval"  → status_word("Name:", out) → out = "linux_eval"
 *       "PPid:\t1234"        → status_word("PPid:", out) → out = "1234"                */
static int status_word(const char *key, char *out)
{
    int found = 0;
    /* TODO 2:
     *   ① fopen("/proc/self/status", "r") 로 연다 (실패하면 0 반환)
     *   ② fgets 로 한 줄씩 읽으며 strncmp(line, key, strlen(key)) == 0 인 줄을 찾는다
     *   ③ sscanf(line + strlen(key), "%63s", out) 로 첫 단어를 꺼내고 found = 1
     *   ④ fclose 후 found 를 반환한다                                              */

    return found;
}

static void step5(void)
{
    char name[64] = "", ppid[64] = "";
    status_word("Name:", name);
    status_word("PPid:", ppid);
    printf("[5단계] 결과 : Name=%s, PPid 가 셸의 PID 와 같음=%d\n", name, atoi(ppid) == getppid());
    printf("[5단계] 기대값: Name=linux_eval, PPid 가 셸의 PID 와 같음=1 (빌드 명령대로 만들었을 때)\n\n");
}

/* ───────────── 6단계: 조건 변수로 결과 기다리기 ─────────────
 * 작업 쓰레드가 1 ~ 100 의 합을 구해 g_result 에 넣고 g_ready = 1 로 알린다.
 * main 쓰레드는 바쁜 대기 없이 조건 변수로 잠들어 있다가 결과를 받는다. */
static pthread_mutex_t g_lock = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t  g_cond = PTHREAD_COND_INITIALIZER;
static int  g_ready = 0;
static long g_result = 0;

static void *calc_worker(void *arg)
{
    (void)arg;
    long sum = 0;
    for (int i = 1; i <= 100; i++) sum += i;
    usleep(300 * 1000);                              /* 오래 걸리는 계산인 척 0.3초 */
    /* TODO 3: g_lock 을 잡고 → g_result = sum, g_ready = 1 → pthread_cond_signal(&g_cond) → 잠금을 푼다 */

    return NULL;
}

static void step6(void)
{
    pthread_t t;
    ______(&t, NULL, calc_worker, NULL);  /* ① 쓰레드 만들기 */

    pthread_mutex_lock(&g_lock);
    int waits = 0;
    while (!g_ready) {                               /* 깨어난 뒤 조건을 다시 확인하려고 while */
        ______(&g_cond, &g_lock);      /* ② mutex 를 풀고 잠들었다가, 깨면 다시 잡는 함수 */
        waits++;
    }
    long result = g_result;
    pthread_mutex_unlock(&g_lock);
    pthread_join(t, NULL);

    printf("[6단계] 결과 : result=%ld, 기다림>0=%d\n", result, waits > 0);
    printf("[6단계] 기대값: result=5050, 기다림>0=1\n\n");
}

int main(void)
{
    step1();
    step2();
    step3();
    step4();
    step5();
    step6();
    return 0;
}
