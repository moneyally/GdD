/**
 * 한국어 조사 선택. 이름 끝 글자의 종성 유무로 결정한다.
 *
 * 로그가 "도하은"처럼 나오면 플레이어가 읽는 문장의 품질이 떨어진다.
 * 이름이 데이터(namePool)에서 오므로 문장 템플릿에 조사를 박아둘 수 없다.
 */

/** 종성이 있는가 */
function hasFinalConsonant(word: string): boolean {
  const last = word.trimEnd().at(-1);
  if (!last) return false;
  const code = last.charCodeAt(0);
  // 한글 음절 영역이 아니면 종성 없음으로 취급
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

/** 은/는 */
export function topic(word: string): string {
  return word + (hasFinalConsonant(word) ? '은' : '는');
}

/** 을/를 */
export function object(word: string): string {
  return word + (hasFinalConsonant(word) ? '을' : '를');
}

/** 이/가 */
export function subject(word: string): string {
  return word + (hasFinalConsonant(word) ? '이' : '가');
}
