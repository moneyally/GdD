/**
 * 시드 기반 난수. Math.random은 코드베이스 어디에서도 쓰지 않는다.
 *
 * 이유: 통과 기준의 "저장 → 재시작 → 복원 → 동일 State, 동일 Event Log".
 * 소환은 난수를 쓰지만(규칙 8: 중복은 다른 성격의 새 개체) 그 난수는 재현 가능해야 하고,
 * 시드 상태는 Snapshot에 저장되어 함께 복원된다.
 *
 * mulberry32 — 32비트 정수 상태 하나로 끝나므로 직렬화가 간단하다.
 */
export class Rng {
  constructor(private state: number) {
    this.state = state >>> 0;
  }

  /** 0 이상 1 미만 */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** min 이상 max 이하 정수 */
  intBetween(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: 빈 배열');
    return items[this.intBetween(0, items.length - 1)]!;
  }

  /** 직렬화용 현재 상태 */
  serialize(): number {
    return this.state >>> 0;
  }

  static restore(state: number): Rng {
    return new Rng(state);
  }
}
