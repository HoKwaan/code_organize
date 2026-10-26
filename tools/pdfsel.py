"""PDF 슬라이드의 코드 블록 중 강의 페이지 · src 에 없는 줄이 있는 블록만 고른다 → pdf/new.json
  MCU: pdf/b{d}.json (MCU_DayN.pdf) · Linux: pdf/L{d}.json · Embedded_IO: pdf/E{d}.json (pdfcode.py 결과)"""
import json, os, re
sn = json.load(open('sn.json'))
def norm(l): return re.sub(r'\s+', '', re.sub(r'//.*|/\*.*?\*/', '', l))
have = {}
for x in sn:
    for k in ('code', 'answer', 'blank', 'output'):
        for l in x.get(k, '').split('\n'):
            n = norm(l)
            if n: have.setdefault(x['subject'], set()).add(n)
codey = re.compile(r'[;{}]|#include|#define|\w+\(.*\)|\$\(|^\s*[A-Z][A-Za-z]*=\S'   # C · 셸 · Makefile · systemd
                   r'|^\s*\$ |^\s*(sudo|gcc|make|esptool|arduino-cli|gpio(get|set|info|mon|detect)|i2c(detect|get|set)|pinctrl|dtc|dtoverlay|insmod|rmmod|dmesg|taskset|chrt|strace|valgrind)\b')
cmd = re.compile(r'^\s*(\$ |sudo |esptool |\./)|^\s*(echo|cat|cd|ls|ps|grep|gcc|nmcli|systemctl|journalctl|apt)\s')
PDFS = [('mcu', d, f'pdf/b{d}.json', f'MCU_Day{d}.pdf') for d in range(1, 5)] + \
       [('linux', d, f'pdf/L{d}.json', 'slide.pdf' if d == 1 else f'Linux_Day{d}_slides.pdf') for d in range(1, 6)] + \
       [('eio', d, f'pdf/E{d}.json', f'EmbeddedIO_Day{d}_slides.pdf') for d in range(1, 6)]
out = []
stats = {}
for subj, d, path, name in PDFS:
    if not os.path.exists(path):
        continue
    st = stats.setdefault(name, [0, 0])
    for b in json.load(open(path)):
        lines = [l for l in b['lines'] if l.strip()]
        code_lines = [l for l in lines if codey.search(l) or cmd.match(l)]
        new = [l for l in code_lines if norm(l) and norm(l) not in have.get(subj, ())]
        st[0] += 1
        if not new or (len(code_lines) < 2 and not any(cmd.match(l) for l in new)):
            continue
        st[1] += 1
        out.append(dict(subject=subj, day=d, page=b['page'], title=b['title'], pdf=name,
                        code='\n'.join(b['lines']).strip('\n'), new=new))
json.dump(out, open('pdf/new.json', 'w'), ensure_ascii=False, indent=1)
print(stats)
for o in out: print('== %s p%d %s' % (o['pdf'], o['page'], o['title'][:50])); print('\n'.join('   + ' + l for l in o['new']))
