#!/bin/sh
# 자료에서 data/index.js 를 다시 만든다.
#   WORK 폴더에 AI_CAMPUS 저장소(aic/), linux-day1.zip 압축 해제본(ld1/), MCU PDF(MCU_Day1~4.pdf)를 둔다.
#   sh tools/build.sh /path/to/work
set -e
WORK=${1:?usage: build.sh WORK_DIR}
T=$(cd "$(dirname "$0")" && pwd)
cp "$T"/extract.py "$T"/pdfcode.py "$T"/pdfsel.py "$T"/supplement.py "$T"/gen.py "$T"/check.py "$WORK"/
cd "$WORK"
[ -d aic ] || git clone --depth 1 https://github.com/imguru-mooc/AI_CAMPUS.git aic
[ -d ld1 ] || unzip -q aic/Linux-day1/linux-day1.zip -d ld1
mkdir -p pdf
for d in 1 2 3 4; do python3 pdfcode.py "MCU_Day$d.pdf" "pdf/b$d.json"; done
python3 extract.py sn.json
python3 check.py | tail -1          # 강의 코드 블록이 빠짐없이 들어갔는지 확인
python3 pdfsel.py > /dev/null
sed -i "s|^ROOT=.*|ROOT='$(dirname "$T")'|" gen.py
python3 gen.py
