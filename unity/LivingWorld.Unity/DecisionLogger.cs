using LivingWorld.Core;
using LivingWorld.Core.Data;
using LivingWorld.Core.Decision;
using UnityEngine;

namespace LivingWorld.UnityBridge
{
    /// <summary>
    /// 판단 근거를 콘솔에 흘린다. UI를 만들기 전에 "왜 저렇게 행동했나"를 볼 수 있게 하는
    /// 최소 표현 층이다.
    ///
    /// 규칙 6의 요점을 그대로 지킨다: 플레이어용 문장과 디버그 근거가 **같은 ReasonCode**에서
    /// 나온다. 설명이 두 개 존재할 수 없다.
    ///
    /// 같은 GameObject에 TowerDirector와 함께 붙인다.
    /// </summary>
    [RequireComponent(typeof(TowerDirector))]
    public sealed class DecisionLogger : MonoBehaviour
    {
        [Tooltip("끄면 근거 줄은 숨기고 사람이 읽는 문장만 남는다")]
        public bool showReasonCodes = true;

        private TowerDirector _director;
        private readonly System.Collections.Generic.Dictionary<string, string> _names =
            new System.Collections.Generic.Dictionary<string, string>();

        private void Awake()
        {
            _director = GetComponent<TowerDirector>();
            _director.OnPartyReady += views =>
            {
                foreach (var v in views) _names[v.InstanceId.Value] = v.DisplayName;
                Debug.Log($"[탑] 파티 편성: {string.Join(", ", System.Linq.Enumerable.Select(views, v => v.DisplayName))}");
            };
            _director.OnFloorEntered += (floor, threat, fallen, firstVisit) =>
                Debug.Log($"[탑] {floor}층 · 위협 {threat}{(firstVisit ? " · 최초 도달" : "")} — " +
                          $"{Josa.Subject(Name(fallen))} 쓰러졌다");
            _director.OnDecisionMade += (actor, subject, decision) => LogDecision(actor, subject, decision);
            _director.OnFloorResolved += (floor, rescued, died) =>
                Debug.Log(rescued
                    ? $"[탑] {floor}층 · 구조 성공"
                    : $"[탑] {floor}층 · 아무도 오지 않았다 ({died.Count}명 소실)");
            _director.OnRunFinished += (deepest, cleared, abortReason) =>
                Debug.Log(cleared
                    ? $"[탑] 정상 도달 — {deepest}층"
                    : $"[탑] 등반 종료 — {deepest}층에서 중단 ({abortReason ?? "종료"})");
        }

        private void LogDecision(InstanceId actor, InstanceId subject, DecisionResult decision)
        {
            string who = Name(actor);
            string sentence = Narrate(who, Name(subject), decision);

            Debug.Log(showReasonCodes
                ? $"    {who}  {sentence}\n        {decision.Reason.Format()}"
                : $"    {who}  {sentence}");
        }

        /// <summary>
        /// 규칙 기반 문장. LLM을 붙이면 이 문장이 캐릭터 시점으로 풍부해지지만,
        /// LLM을 끄면 이 문장이 그대로 쓰이고 게임은 동일하게 돌아간다 (규칙 5).
        /// </summary>
        private static string Narrate(string actor, string subject, DecisionResult decision)
        {
            switch (decision.Reason.Action)
            {
                case Action.Rescue:
                    if (decision.Reason.Layer == DecisionLayer.L2)
                    {
                        bool smoke = decision.Plan != null
                                     && decision.Plan.Steps.Contains(PlanStep.Suppress);
                        return smoke
                            ? "두려움에도 몸이 먼저 움직였다. 연막을 치고 들어갔다."
                            : "두려움에도 몸이 먼저 움직였다. 곧장 들어갔다.";
                    }
                    return $"{Josa.Object(subject)} 끌어내려 들어갔다.";
                case Action.Retreat:
                    return $"{Josa.Object(subject)} 두고 물러섰다.";
                case Action.Hold:
                    return "자리를 지켰다. 움직이지 않았다.";
                default:
                    return "적을 쫓았다. 쓰러진 동료에게는 가지 않았다.";
            }
        }

        private string Name(InstanceId id) =>
            _names.TryGetValue(id.Value, out var name) ? name : id.Value;
    }
}
