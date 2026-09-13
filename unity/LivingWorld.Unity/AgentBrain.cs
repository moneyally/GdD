using System.Collections;
using LivingWorld.Core;
using LivingWorld.Core.Decision;
using UnityEngine;

namespace LivingWorld.UnityBridge
{
    /// <summary>
    /// 캐릭터 하나의 표현. 이름과 달리 **판단하지 않는다** —
    /// 판단은 Core가 하고, 이 컴포넌트는 그 결과를 몸으로 옮긴다.
    ///
    /// 이 클래스가 지키는 선 (CORE CONTRACT 규칙 1):
    /// - <c>Decider</c>를 호출하지 않는다
    /// - <c>CharacterInstance</c>를 수정하지 않는다
    /// - 받는 것은 <see cref="DecisionResult"/>와 <see cref="ActorView"/>뿐이다
    ///
    /// 이 선을 넘는 순간 "왜 저렇게 행동했나"의 답이 두 곳에 생기고, 렌더러를 갈아끼울 수
    /// 없게 된다. 실제로 그 선을 넘는 코드는 리뷰에서 잡아야 한다.
    /// </summary>
    [DisallowMultipleComponent]
    public sealed class AgentBrain : MonoBehaviour
    {
        [Header("애니메이터 파라미터 이름 (Mixamo + Animator 기준)")]
        public string speedParameter = "Speed";
        public string downedParameter = "Downed";

        [Header("이동")]
        public float moveSpeed = 2.6f;
        public float arriveDistance = 1.1f;
        public float turnSpeed = 540f;

        private Animator _animator;
        private Vector3 _home;
        private Coroutine _current;

        public InstanceId Id { get; private set; }
        public string DisplayName { get; private set; }

        private void Awake()
        {
            _animator = GetComponentInChildren<Animator>();
            _home = transform.position;
        }

        public void Bind(TowerDirector director, InstanceId id, string displayName)
        {
            Id = id;
            DisplayName = displayName;
            _home = transform.position;

            // 자기 자신의 표시 상태만 갱신한다
            director.OnActorChanged += view =>
            {
                if (view.InstanceId == Id) Apply(view);
            };
        }

        /// <summary>판단 결과를 몸으로 옮긴다. 무엇을 할지는 이미 정해져 있다.</summary>
        public void Perform(DecisionResult decision, Vector3 towardSubject)
        {
            if (_current != null) StopCoroutine(_current);

            switch (decision.Reason.Action)
            {
                case Action.Rescue:
                    _current = StartCoroutine(MoveTo(towardSubject));
                    break;
                case Action.Attack:
                    _current = StartCoroutine(MoveTo(towardSubject + (towardSubject - _home).normalized * 1.5f));
                    break;
                case Action.Retreat:
                    _current = StartCoroutine(MoveTo(_home - (towardSubject - _home).normalized * 2.5f));
                    break;
                case Action.Hold:
                    _current = StartCoroutine(MoveTo(_home));
                    break;
            }
        }

        /// <summary>이번 층에서 쓰러진 당사자일 때.</summary>
        public void Collapse() => SetDowned(true);

        /// <summary>죽었을 때. 규칙 7에 따라 오브젝트를 파괴하지 않는다 — 사라지는 것과 죽는 것은 다르다.</summary>
        public void Fall()
        {
            SetDowned(true);
            if (_current != null) StopCoroutine(_current);
            SetSpeed(0f);
        }

        private void Apply(ActorView view)
        {
            if (view.Status == LifeStatus.Dead) Fall();
        }

        private IEnumerator MoveTo(Vector3 target)
        {
            target.y = transform.position.y;

            while ((transform.position - target).sqrMagnitude > arriveDistance * arriveDistance)
            {
                Vector3 direction = (target - transform.position).normalized;
                if (direction.sqrMagnitude > 0.001f)
                {
                    Quaternion look = Quaternion.LookRotation(direction, Vector3.up);
                    transform.rotation = Quaternion.RotateTowards(
                        transform.rotation, look, turnSpeed * Time.deltaTime);
                }

                transform.position += direction * moveSpeed * Time.deltaTime;
                SetSpeed(moveSpeed);
                yield return null;
            }

            SetSpeed(0f);
            _current = null;
        }

        private void SetSpeed(float speed)
        {
            if (_animator == null || string.IsNullOrEmpty(speedParameter)) return;
            _animator.SetFloat(speedParameter, speed);
        }

        private void SetDowned(bool downed)
        {
            if (_animator == null || string.IsNullOrEmpty(downedParameter)) return;
            _animator.SetBool(downedParameter, downed);
        }
    }
}
