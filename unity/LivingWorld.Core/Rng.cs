using System;
using System.Collections.Generic;

namespace LivingWorld.Core
{
    /// <summary>
    /// 시드 난수 (mulberry32). <c>System.Random</c>은 쓰지 않는다 —
    /// 구현이 런타임 버전에 따라 달라서 재현이 보장되지 않고, JS 쪽과도 어긋난다.
    ///
    /// 이 구현은 TS <c>src/core/rng.ts</c>와 **비트 단위로 같은 값**을 낸다.
    /// golden/rng.json 이 그걸 검증한다.
    ///
    /// 32비트 정수 상태 하나뿐이라 직렬화가 간단하고, Snapshot에 넣어 복원할 수 있다.
    /// </summary>
    public sealed class Rng
    {
        private uint _state;

        public Rng(uint seed) => _state = seed;
        public Rng(int seed) => _state = unchecked((uint)seed);

        /// <summary>0 이상 1 미만.</summary>
        public double Next()
        {
            unchecked
            {
                _state += 0x6d2b79f5u;
                uint t = _state;
                t = (t ^ (t >> 15)) * (t | 1u);
                t ^= t + (t ^ (t >> 7)) * (t | 61u);
                return (t ^ (t >> 14)) / 4294967296.0;
            }
        }

        /// <summary>min 이상 max 이하 정수.</summary>
        public int IntBetween(int min, int max) =>
            min + (int)Math.Floor(Next() * (max - min + 1));

        public T Pick<T>(IReadOnlyList<T> items)
        {
            if (items == null || items.Count == 0) throw new InvalidOperationException("Rng.Pick: 빈 목록");
            return items[IntBetween(0, items.Count - 1)];
        }

        /// <summary>직렬화용 현재 상태.</summary>
        public uint Serialize() => _state;

        public static Rng Restore(uint state) => new Rng(state);
    }
}
