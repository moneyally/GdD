"""docx_to_md.py 출력을 docs/ 챕터별 파일로 분해한다.

사용법: python3 tools/split_chapters.py
원본 docx를 갱신한 뒤 이 스크립트를 다시 돌리면 docs/가 재생성된다.
"""
import re, os, subprocess, sys
md = subprocess.run([sys.executable,os.path.join(os.path.dirname(os.path.abspath(__file__)),"docx_to_md.py")],capture_output=True,text=True,check=True).stdout

REPO=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(REPO,"docs")
os.makedirs(OUT,exist_ok=True)

FILES = {
 "A":"01-A-product-definition.md","B":"02-B-game-loop.md","C":"03-C-character-agent.md",
 "D":"04-D-combat-growth-skill.md","E":"05-E-gacha-ownership-synthesis.md",
 "F":"06-F-guild-social-economy.md","G":"07-G-world-faction-quest.md",
 "H":"08-H-backend-data-security.md","I":"09-I-asset-catalog-production.md",
 "J":"10-J-mobile-tech-spec.md","K":"11-K-ui-localization-accessibility.md",
 "L":"12-L-qa-analytics-liveops.md","M":"13-M-staffing-governance.md",
 "N":"14-N-phases-acceptance-gates.md","O":"15-O-appendix-data-id-risk.md",
}

lines = md.split("\n")
# front matter = everything before first H1
h1_idx = [i for i,l in enumerate(lines) if l.startswith("# ")]
front = "\n".join(lines[:h1_idx[0]]).strip()

chunks=[]
for j,i in enumerate(h1_idx):
    end = h1_idx[j+1] if j+1 < len(h1_idx) else len(lines)
    chunks.append((lines[i][2:].strip(), "\n".join(lines[i:end]).strip()))

written=[]
toc=[]
for title, body in chunks:
    m = re.match(r"^([A-P])\.\s", title)
    if m:
        fn = FILES[m.group(1)]
    elif title.startswith("88."):
        fn = "16-final-design-thesis.md"
    elif title.startswith("문서 구조"):
        toc.append(body)   # 원본 목차는 00-front-matter.md 에 보존
        continue
    else:
        fn = "99-" + re.sub(r"\W+","-",title.lower()).strip("-") + ".md"
    open(os.path.join(OUT,fn),"w").write(body+"\n")
    written.append((fn,title))

fm = "# Living World — 문서 정보\n\n" + front + "\n"
if toc:
    fm += "\n" + "\n\n".join(toc).replace("# 문서 구조", "## 원본 문서 구조 (DOCX 목차 그대로)") + "\n\n> 주의: 위 목차는 A–P 16챕터를 선언하지만 본문은 A–O 15챕터다. `OPEN-QUESTIONS.md` 5번 참조.\n"
open(os.path.join(OUT,"00-front-matter.md"),"w").write(fm)
for fn,t in written: print(fn,"<-",t)
