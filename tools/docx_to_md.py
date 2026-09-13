"""source/*.docx -> 마크다운 변환기. 표/불릿/코드블록 구조를 유지한다.

사용법: python3 tools/docx_to_md.py [--outline]
"""
import zipfile, re, html, sys
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
import xml.etree.ElementTree as ET

import os
REPO=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC=os.path.join(REPO,"source","Living_World_Mobile_Production_GDD_v3.3.docx")
z=zipfile.ZipFile(SRC)
root=ET.fromstring(z.read("word/document.xml"))
body=root.find(W+'body')

def ptext(p):
    out=[]
    for n in p.iter():
        t=n.tag
        if t==W+'t': out.append(n.text or '')
        elif t==W+'tab': out.append('\t')
        elif t==W+'br': out.append('\n')
    return ''.join(out).strip()

def pstyle(p):
    ps=p.find(W+'pPr')
    if ps is None: return None
    s=ps.find(W+'pStyle')
    return s.get(W+'val') if s is not None else None

def cell_text(tc):
    return ' '.join(ptext(p) for p in tc.findall(W+'p')).strip()

def table_md(tbl):
    rows=[]
    for tr in tbl.findall(W+'tr'):
        rows.append([cell_text(tc).replace('|','\\|') for tc in tr.findall(W+'tc')])
    if not rows: return []
    n=max(len(r) for r in rows)
    rows=[r+['']*(n-len(r)) for r in rows]
    out=['| '+' | '.join(rows[0])+' |', '|'+'|'.join(['---']*n)+'|']
    for r in rows[1:]:
        out.append('| '+' | '.join(r)+' |')
    return out

blocks=[]   # (kind, payload)
for el in body:
    if el.tag==W+'p':
        st=pstyle(el); tx=ptext(el)
        if not tx: continue
        blocks.append((st or 'Normal', tx))
    elif el.tag==W+'tbl':
        blocks.append(('Table', table_md(el)))

# merge consecutive CodeText
merged=[]
for k,v in blocks:
    if k=='CodeText' and merged and merged[-1][0]=='CodeText':
        merged[-1][1].append(v)
    elif k=='CodeText':
        merged.append(['CodeText',[v]])
    else:
        merged.append([k,v])

if sys.argv[1:] and sys.argv[1]=='--outline':
    for k,v in merged:
        if k in ('Heading1','Heading2'): print(k, '|', v)
    raise SystemExit

def render(bs):
    out=[]
    for k,v in bs:
        if k=='Heading1': out.append('# '+v)
        elif k=='Heading2': out.append('## '+v)
        elif k=='ListBullet': out.append('- '+v)
        elif k=='CodeText': out.append('```\n'+'\n'.join(v)+'\n```')
        elif k=='Table': out.append('\n'.join(v))
        elif k=='Small': out.append('*'+v+'*')
        else: out.append(v)
    # blank line between blocks, but keep consecutive bullets tight
    res=[]
    for i,b in enumerate(out):
        res.append(b)
        nxt=out[i+1] if i+1<len(out) else None
        if nxt is None: continue
        if b.startswith('- ') and nxt.startswith('- '): continue
        res.append('')
    return '\n'.join(res)+'\n'

print(render(merged), end='')
