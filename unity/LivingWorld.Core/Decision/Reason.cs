using System.Collections.Generic;
using System.Linq;

namespace LivingWorld.Core.Decision
{
    /// <summary>실행되는 행동. 계획의 걸음(PlanStep)과는 다른 타입이다.</summary>
    public enum Action { Rescue, Retreat, Hold, Attack }

    public static class ActionNames
    {
        public static string Wire(Action a)
        {
            switch (a)
            {
                case Action.Rescue: return "RESCUE";
                case Action.Retreat: return "RETREAT";
                case Action.Hold: return "HOLD";
                default: return "ATTACK";
            }
        }
    }

    /// <summary>판단 계층. 어느 층이 결정했는지 남긴다.</summary>
    public enum DecisionLayer { L0, L1, L2 }

    /// <summary>
    /// 수치 하나. 비교 임계값이 있으면 Op/Threshold를 채운다.
    ///
    /// Value를 문자열로 들고 있는 이유: 숫자 → 문자열 변환 규칙이 한 곳에만 있어야
    /// ReasonCode가 언어·로케일에 따라 달라지지 않는다.
    /// </summary>
    public sealed class Factor
    {
        public string Key;
        public string Value;
        public string Op;
        public string Threshold;

        public static Factor Of(string key, string value) =>
            new Factor { Key = key, Value = value };

        public static Factor Of(string key, double value) =>
            new Factor { Key = key, Value = JsMath.Str(value) };

        public static Factor Compare(string key, double value, string op, double threshold) =>
            new Factor
            {
                Key = key, Value = JsMath.Str(value), Op = op, Threshold = JsMath.Str(threshold),
            };

        public string Render() =>
            Op != null && Threshold != null
                ? $"{Key}={Value}{Op}threshold={Threshold}"
                : $"{Key}={Value}";
    }

    /// <summary>
    /// 규칙 6 — 모든 Decision은 ReasonCode를 가진다.
    /// 플레이어용 로그와 디버거는 같은 ReasonCode에서 렌더링한다.
    ///
    /// 목표 출력 형식:
    ///   RETREAT(fear=72&gt;threshold=60)
    ///   RESCUE(target=Mira,trust=81,self_risk=45)
    ///   HOLD(order=defend,loyalty=90 overrides fear=65)
    /// </summary>
    public sealed class ReasonCode
    {
        public Action Action;
        public DecisionLayer Layer;
        public IReadOnlyList<Factor> Factors = new List<Factor>();
        /// <summary>이 요인들이 다른 요인을 덮어썼을 때. <c>A overrides B</c>로 렌더링된다.</summary>
        public IReadOnlyList<Factor> Overrides;

        /// <summary>ReasonCode → 한 줄. 플레이어 로그와 디버거가 공유하는 유일한 렌더 경로.</summary>
        public string Format()
        {
            string main = string.Join(",", Factors.Select(f => f.Render()));
            if (Overrides == null || Overrides.Count == 0)
                return $"{ActionNames.Wire(Action)}({main})";
            string overridden = string.Join(",", Overrides.Select(f => f.Render()));
            return $"{ActionNames.Wire(Action)}({main} overrides {overridden})";
        }
    }
}
