/**
 * 프로토타입이 **진짜 엔진을 돌리는지** 지킨다.
 *
 * 이전 버전의 HTML은 판단 로직을 손으로 복사해 갖고 있었다. 그러면 `npm run gates:stats`로
 * 측정한 게임과 사람이 눌러보는 게임이 서로 다른 게임이 된다 — 한쪽만 고쳐도 아무도
 * 눈치채지 못한다. 그 상태로 돌아가는 것을 여기서 막는다.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const workDir = mkdtempSync(join(tmpdir(), 'living-world-proto-'));
afterAll(() => rmSync(workDir, { recursive: true, force: true }));

const html = readFileSync('prototype/holo-gates.html', 'utf8');

describe('웹 프로토타입', () => {
  it('engine.js가 현재 src/와 일치한다 (`npm run prototype:build` 갱신 확인)', () => {
    const rebuilt = join(workDir, 'engine.js');
    execFileSync(join('node_modules', '.bin', 'esbuild'), [
      'src/web/entry.ts',
      '--bundle',
      '--format=iife',
      '--global-name=LivingWorld',
      '--target=es2020',
      `--outfile=${rebuilt}`,
      '--banner:js=/* 생성물 — 수정하지 말 것. 원본은 src/, 재생성은 npm run prototype:build */',
    ], { encoding: 'utf8' });

    expect(readFileSync(rebuilt, 'utf8')).toBe(readFileSync('prototype/engine.js', 'utf8'));
  }, 60_000);

  it('HTML에 판단 규칙이 복제돼 있지 않다', () => {
    // 예전 복제본의 흔적들. 하나라도 돌아오면 규칙이 두 곳에 있는 것이다
    const forbidden = [
      'Math.imul',        // 자체 난수
      'tolerable',        // L2 감당 상한
      'never_abandon_ally', // 목표 판정
      'W.rescue',         // L1 가중치
      'function decide',  // 판단 진입점
    ];
    for (const needle of forbidden) {
      expect(html, `프로토타입이 '${needle}'를 다시 갖고 있다`).not.toContain(needle);
    }
  });

  it('HTML이 엔진 번들을 불러온다', () => {
    expect(html).toContain('<script src="engine.js"></script>');
    expect(html).toContain('window.LivingWorld');
  });
});
