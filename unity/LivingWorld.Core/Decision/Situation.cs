namespace LivingWorld.Core.Decision
{
    public enum SituationKind { AllyDownBeforeEnemy }

    /// <summary>
    /// 판단 입력이 되는 상황. MVP는 상황 1종만 다룬다:
    /// "동료가 위험한 적 앞에서 쓰러졌다".
    /// </summary>
    public sealed class Situation
    {
        public SituationKind Kind;
        /// <summary>쓰러진 동료</summary>
        public InstanceId Subject;
        /// <summary>적의 위협도 0..100</summary>
        public int EnemyThreat;
        public int Tick;
        public string Description;

        public static Situation AllyDown(InstanceId subject, int enemyThreat, int tick) =>
            new Situation
            {
                Kind = SituationKind.AllyDownBeforeEnemy,
                Subject = subject,
                EnemyThreat = enemyThreat,
                Tick = tick,
                Description = "동료가 위험한 적 앞에서 쓰러졌다.",
            };
    }
}
