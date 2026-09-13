/* 생성물 — 수정하지 말 것. 원본은 src/, 재생성은 npm run prototype:build */
"use strict";
var LivingWorld = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/web/entry.ts
  var entry_exports = {};
  __export(entry_exports, {
    GATE_DESC: () => GATE_DESC,
    GATE_EN: () => GATE_EN,
    GOAL_KO: () => GOAL_KO,
    Game: () => Game,
    MEMORY_KO: () => MEMORY_KO,
    RULES_FOR_DISPLAY: () => RULES_FOR_DISPLAY,
    SUPPLY_KO: () => SUPPLY_KO,
    summon: () => summon
  });

  // src/core/ids.ts
  var PREFIX = {
    DefinitionId: "CHD_",
    InstanceId: "CHR_",
    MemoryId: "MEM_",
    EventId: "EVT_",
    GoalId: "GOL_"
  };
  function make(kind, raw) {
    const prefix = PREFIX[kind];
    const value = raw.startsWith(prefix) ? raw : prefix + raw;
    return value;
  }
  var definitionId = (raw) => make("DefinitionId", raw);
  var instanceId = (raw) => make("InstanceId", raw);
  var memoryId = (raw) => make("MemoryId", raw);
  var eventId = (raw) => make("EventId", raw);
  var goalId = (raw) => make("GoalId", raw);
  var IdSequence = class _IdSequence {
    constructor(counter = 0) {
      __publicField(this, "counter", counter);
    }
    next() {
      this.counter += 1;
      return this.counter;
    }
    peek() {
      return this.counter;
    }
    static restore(counter) {
      return new _IdSequence(counter);
    }
  };

  // src/core/events.ts
  var EventLog = class {
    constructor(ids, restored = []) {
      __publicField(this, "ids", ids);
      __publicField(this, "entries", []);
      this.entries.push(...restored);
    }
    append(draft) {
      const seq = this.entries.length + 1;
      const event = {
        ...draft,
        seq,
        eventId: eventId(`${String(this.ids.next()).padStart(6, "0")}`)
      };
      this.entries.push(event);
      return event;
    }
    all() {
      return this.entries;
    }
    ofKind(kind) {
      return this.entries.filter((e) => e.kind === kind);
    }
    get length() {
      return this.entries.length;
    }
  };

  // src/core/rng.ts
  var Rng = class _Rng {
    constructor(state) {
      __publicField(this, "state", state);
      this.state = state >>> 0;
    }
    /** 0 이상 1 미만 */
    next() {
      this.state = this.state + 1831565813 >>> 0;
      let t = this.state;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    /** min 이상 max 이하 정수 */
    intBetween(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    }
    pick(items) {
      if (items.length === 0) throw new Error("Rng.pick: \uBE48 \uBC30\uC5F4");
      return items[this.intBetween(0, items.length - 1)];
    }
    /** 직렬화용 현재 상태 */
    serialize() {
      return this.state >>> 0;
    }
    static restore(state) {
      return new _Rng(state);
    }
  };

  // src/core/world.ts
  var World = class _World {
    constructor(tick, instances, definitions, rng, ids, restoredEvents) {
      __publicField(this, "tick", tick);
      __publicField(this, "instances", instances);
      __publicField(this, "definitions", definitions);
      __publicField(this, "rng", rng);
      __publicField(this, "ids", ids);
      __publicField(this, "events");
      this.events = new EventLog(ids, restoredEvents);
    }
    static create(seed, definitions) {
      return new _World(
        0,
        /* @__PURE__ */ new Map(),
        new Map(definitions.map((d) => [d.definitionId, d])),
        new Rng(seed),
        new IdSequence(0),
        []
      );
    }
    static restore(args) {
      return new _World(
        args.tick,
        new Map(args.instances.map((i) => [i.instanceId, i])),
        new Map(args.definitions.map((d) => [d.definitionId, d])),
        Rng.restore(args.rngState),
        IdSequence.restore(args.idCounter),
        args.events
      );
    }
    findDefinition(id) {
      return this.definitions.get(id);
    }
    definition(id) {
      const found = this.definitions.get(id);
      if (!found) throw new Error(`\uC54C \uC218 \uC5C6\uB294 Definition: ${id}`);
      return found;
    }
    instance(id) {
      const found = this.instances.get(id);
      if (!found) throw new Error(`\uC54C \uC218 \uC5C6\uB294 Instance: ${id}`);
      return found;
    }
    find(id) {
      return this.instances.get(id);
    }
    allInstances() {
      return [...this.instances.values()];
    }
    living() {
      return this.allInstances().filter((i) => i.status === "alive");
    }
    /** 트랜잭션 전용. 직접 호출하지 않는다. */
    mutateAddInstance(instance) {
      if (this.instances.has(instance.instanceId)) {
        throw new Error(`\uC911\uBCF5 Instance: ${instance.instanceId}`);
      }
      this.instances.set(instance.instanceId, instance);
    }
    advanceTick() {
      this.tick += 1;
      return this.tick;
    }
  };

  // src/decision/reason.ts
  function renderFactor(f) {
    if (f.op !== void 0 && f.threshold !== void 0) {
      return `${f.key}=${f.value}${f.op}threshold=${f.threshold}`;
    }
    return `${f.key}=${f.value}`;
  }
  function formatReason(reason) {
    const main = reason.factors.map(renderFactor).join(",");
    const overridden = reason.overrides?.map(renderFactor).join(",");
    const body = overridden ? `${main} overrides ${overridden}` : main;
    return `${reason.action}(${body})`;
  }

  // src/data/definitions.ts
  var VANGUARD = {
    definitionId: definitionId("vanguard"),
    archetype: "\uC120\uBD09",
    namePool: ["\uB77C\uC628", "\uC138\uC778", "\uB3C4\uD558", "\uC720\uC9C4"],
    personalityRanges: {
      risk: { min: 40, max: 60 },
      loyalty: { min: 50, max: 90 },
      sociability: { min: 30, max: 70 },
      aggression: { min: 45, max: 75 },
      honesty: { min: 30, max: 80 }
    },
    baseHealth: 100
  };
  var SCOUT = {
    definitionId: definitionId("scout"),
    archetype: "\uC815\uCC30",
    namePool: ["\uBBF8\uB77C", "\uC138\uB77C", "\uB178\uC544", "\uC774\uB9B0"],
    personalityRanges: {
      risk: { min: 45, max: 75 },
      loyalty: { min: 40, max: 80 },
      sociability: { min: 40, max: 80 },
      aggression: { min: 30, max: 60 },
      honesty: { min: 40, max: 90 }
    },
    baseHealth: 80
  };
  var ALL_DEFINITIONS = [VANGUARD, SCOUT];

  // src/log/josa.ts
  function hasFinalConsonant(word) {
    const last = word.trimEnd().at(-1);
    if (!last) return false;
    const code = last.charCodeAt(0);
    if (code < 44032 || code > 55203) return false;
    return (code - 44032) % 28 !== 0;
  }
  function topic(word) {
    return word + (hasFinalConsonant(word) ? "\uC740" : "\uB294");
  }
  function object(word) {
    return word + (hasFinalConsonant(word) ? "\uC744" : "\uB97C");
  }

  // src/log/renderer.ts
  function narrateAction(actor, subject, decision) {
    const goalDriven = decision.reason.factors.some((f) => f.key === "goal");
    const memoryDriven = decision.reason.factors.some((f) => f.key === "memory");
    switch (decision.reason.action) {
      case "RESCUE":
        if (goalDriven) {
          const smoke = decision.plan?.steps.includes("SUPPRESS") === true;
          return `${topic(actor.identity.name)} \uB450\uB824\uC6C0\uC5D0\uB3C4 \uBAB8\uC774 \uBA3C\uC800 \uC6C0\uC9C1\uC600\uB2E4. ${smoke ? "\uAD50\uB780\uAE30\uB97C \uD130\uB728\uB9AC\uACE0 \uB4E4\uC5B4\uAC14\uB2E4." : "\uB2E4\uC2DC\uB294 \uADF8\uB7EC\uC9C0 \uC54A\uACA0\uB2E4\uACE0 \uC815\uD588\uAE30 \uB54C\uBB38\uC774\uB2E4."}`;
        }
        return `${topic(actor.identity.name)} ${object(subject.identity.name)} \uB04C\uC5B4\uB0B4\uB824 \uC801 \uC55E\uC73C\uB85C \uB4E4\uC5B4\uAC14\uB2E4.`;
      case "RETREAT":
        if (memoryDriven) {
          return `${topic(actor.identity.name)} \uB610 \uBB3C\uB7EC\uC130\uB2E4. \uC9C0\uB09C\uBC88\uC758 \uC0C1\uCC98\uAC00 \uBC1C\uC744 \uBA48\uCDB0 \uC138\uC6E0\uB2E4.`;
        }
        return `${topic(actor.identity.name)} ${object(subject.identity.name)} \uB450\uACE0 \uBB3C\uB7EC\uC130\uB2E4.`;
      case "HOLD":
        return `${topic(actor.identity.name)} \uC790\uB9AC\uB97C \uC9C0\uCF30\uB2E4. \uBA85\uB839\uC774 \uADF8\uB7AC\uB2E4.`;
      case "ATTACK":
        return `${topic(actor.identity.name)} \uC801\uC5D0\uAC8C \uB2EC\uB824\uB4E4\uC5C8\uB2E4.`;
    }
  }

  // src/core/transaction.ts
  function runTransaction(world, transaction, request) {
    const error = transaction.validate(world, request);
    if (error !== void 0) {
      return { ok: false, error: `${transaction.name}: ${error}` };
    }
    const before = world.events.length;
    const value = transaction.apply(world, request);
    const events = world.events.all().slice(before);
    return { ok: true, value, events };
  }

  // src/core/instance.ts
  function trustToward(self, target) {
    return self.relationships.find((r) => r.target === target)?.trust ?? 0;
  }

  // src/core/agentState.ts
  function buildAgentState(self, situation, order, options) {
    const healthRatio = self.needs.health / self.needs.maxHealth;
    const injuryMultiplier = 1 + (1 - healthRatio) * 0.6;
    const selfRisk = clamp(situation.enemyThreat * injuryMultiplier, 0, 100);
    return {
      self: self.instanceId,
      personality: self.personality,
      healthRatio,
      fear: self.emotion.fear,
      subject: situation.subject,
      trustInSubject: situation.subject ? trustToward(self, situation.subject) : 0,
      selfRisk,
      stamina: clamp(healthRatio * 100 - self.needs.fatigue, 0, 100),
      hasSuppressor: options?.hasSuppressor ?? true,
      memoryInfluences: summarizeMemory(self),
      // 복사한다. Instance의 배열을 그대로 들고 있으면 행동 이후의 변화가
      // '판단 시점 State'에 비쳐서 디버거가 거짓 근거를 보여준다.
      goals: [...self.goals],
      order,
      tick: situation.tick
    };
  }
  function summarizeMemory(self) {
    const strongest = /* @__PURE__ */ new Map();
    for (const entry of self.memory) {
      const current = strongest.get(entry.tag);
      if (!current || entry.importance > current.importance) {
        strongest.set(entry.tag, {
          tag: entry.tag,
          importance: entry.importance,
          memoryId: entry.memoryId
        });
      }
    }
    return [...strongest.values()].sort((a, b) => b.importance - a.importance);
  }
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  // src/decision/l0Rules.ts
  var HOLD_LOYALTY_THRESHOLD = 85;
  var HOLD_FEAR_CEILING = 80;
  function applyL0(state) {
    const retreatAt = state.order.retreatCondition.healthRatioBelow;
    if (retreatAt > 0 && state.healthRatio < retreatAt) {
      return {
        action: "RETREAT",
        layer: "L0",
        factors: [
          {
            key: "health_ratio",
            value: round2(state.healthRatio),
            op: "<",
            threshold: retreatAt
          },
          { key: "order", value: "retreat_condition" }
        ]
      };
    }
    if (state.order.goal === "defend" && state.personality.loyalty >= HOLD_LOYALTY_THRESHOLD && state.fear < HOLD_FEAR_CEILING) {
      return {
        action: "HOLD",
        layer: "L0",
        factors: [
          { key: "order", value: "defend" },
          { key: "loyalty", value: state.personality.loyalty }
        ],
        overrides: [{ key: "fear", value: state.fear }]
      };
    }
    return void 0;
  }
  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  // src/core/order.ts
  function riskAppetite(policy) {
    switch (policy) {
      case "cautious":
        return -15;
      case "balanced":
        return 0;
      case "aggressive":
        return 15;
    }
  }

  // src/decision/l1Utility.ts
  var WEIGHTS = {
    rescue: {
      trust: 0.9,
      calm: 0.6,
      // (100 - fear)
      selfRisk: -0.8,
      loyaltyAboveMid: 0.3,
      riskAboveMid: 0.2,
      /** 기억 태그별 가산. '기억이 판단을 바꾼다'의 L1 경로 */
      memory: {
        rescued_ally: 0.2,
        wounded_in_rescue: -0.25,
        witnessed_ally_death: 0.1,
        ally_died_unrescued: 0.5
      }
    },
    retreat: {
      fear: 0.9,
      selfRisk: 0.7,
      trust: -0.5,
      loyaltyAboveMid: -0.3,
      memory: {
        wounded_in_rescue: 0.3,
        ally_died_unrescued: -0.3,
        rescued_ally: 0,
        witnessed_ally_death: 0
      }
    },
    hold: {
      base: 40,
      loyaltyAboveMid: 0.2,
      fear: -0.2
    },
    attack: {
      aggression: 0.7,
      calm: 0.4,
      selfRisk: -0.6
    }
  };
  function scoreActions(state) {
    const appetite = riskAppetite(state.order.riskPolicy);
    const loyaltyAboveMid = state.personality.loyalty - 50;
    const riskAboveMid = state.personality.risk - 50;
    const calm = 100 - state.fear;
    const rescue = WEIGHTS.rescue.trust * state.trustInSubject + WEIGHTS.rescue.calm * calm + WEIGHTS.rescue.selfRisk * state.selfRisk + WEIGHTS.rescue.loyaltyAboveMid * loyaltyAboveMid + WEIGHTS.rescue.riskAboveMid * riskAboveMid + appetite + memoryBonus(state, WEIGHTS.rescue.memory);
    const retreat = WEIGHTS.retreat.fear * state.fear + WEIGHTS.retreat.selfRisk * state.selfRisk + WEIGHTS.retreat.trust * state.trustInSubject + WEIGHTS.retreat.loyaltyAboveMid * loyaltyAboveMid - appetite + memoryBonus(state, WEIGHTS.retreat.memory);
    const hold = WEIGHTS.hold.base + WEIGHTS.hold.loyaltyAboveMid * loyaltyAboveMid + WEIGHTS.hold.fear * state.fear;
    const attack = WEIGHTS.attack.aggression * state.personality.aggression + WEIGHTS.attack.calm * calm + WEIGHTS.attack.selfRisk * state.selfRisk + appetite;
    return [
      { action: "RESCUE", score: rescue },
      { action: "RETREAT", score: retreat },
      { action: "HOLD", score: hold },
      { action: "ATTACK", score: attack }
    ];
  }
  function applyL1(state) {
    const scores = scoreActions(state);
    const best = scores.reduce((a, b) => b.score > a.score ? b : a);
    return {
      reason: {
        action: best.action,
        layer: "L1",
        factors: factorsFor(best.action, state)
      },
      scores
    };
  }
  function factorsFor(action, state) {
    const subject = state.subject ? [{ key: "target", value: state.subject }] : [];
    const memory = dominantMemory(state, action);
    switch (action) {
      case "RESCUE":
        return [
          ...subject,
          { key: "trust", value: round(state.trustInSubject) },
          { key: "fear", value: round(state.fear) },
          { key: "self_risk", value: round(state.selfRisk) },
          ...memory
        ];
      case "RETREAT":
        return [
          { key: "fear", value: round(state.fear) },
          { key: "self_risk", value: round(state.selfRisk) },
          { key: "trust", value: round(state.trustInSubject) },
          ...memory
        ];
      case "HOLD":
        return [
          { key: "order", value: state.order.goal },
          { key: "loyalty", value: state.personality.loyalty },
          { key: "fear", value: round(state.fear) }
        ];
      case "ATTACK":
        return [
          { key: "aggression", value: state.personality.aggression },
          { key: "self_risk", value: round(state.selfRisk) }
        ];
    }
  }
  function dominantMemory(state, action) {
    const table = action === "RESCUE" ? WEIGHTS.rescue.memory : action === "RETREAT" ? WEIGHTS.retreat.memory : void 0;
    if (!table) return [];
    let best;
    for (const influence of state.memoryInfluences) {
      const weight = table[influence.tag] ?? 0;
      const effect = weight * influence.importance;
      if (effect !== 0 && (!best || Math.abs(effect) > Math.abs(best.effect))) {
        best = { tag: influence.tag, effect };
      }
    }
    return best ? [{ key: "memory", value: best.tag }] : [];
  }
  function memoryBonus(state, table) {
    let total = 0;
    for (const influence of state.memoryInfluences) {
      total += (table[influence.tag] ?? 0) * influence.importance;
    }
    return total;
  }
  function round(n) {
    return Math.round(n);
  }

  // src/decision/goapActions.ts
  var SUPPRESSION_THREAT_REDUCTION = 30;
  var SUPPRESS_STAMINA = 20;
  var RESCUE_STAMINA = 30;
  function tolerableThreat(agent) {
    return 40 + (agent.personality.risk - 50) * 0.6 + agent.healthRatio * 40 - agent.fear * 0.25;
  }
  var GOAP_ACTIONS = [
    {
      step: "SUPPRESS",
      applicable: (s, agent) => agent.hasSuppressor && !s.smokeUsed && s.stamina >= SUPPRESS_STAMINA && s.threat > 0,
      effect: (s) => ({
        ...s,
        threat: Math.max(0, s.threat - SUPPRESSION_THREAT_REDUCTION),
        smokeUsed: true,
        stamina: s.stamina - SUPPRESS_STAMINA
      }),
      // 연막은 소모품이므로 공짜가 아니다. 이 값이 1이면 모두가 항상 연막을 쓴다.
      cost: () => 2
    },
    {
      step: "RESCUE",
      applicable: (s, agent) => !s.allySafe && // 이미 전장을 떠났으면 구조할 수 없다. 이 전제조건이 없으면 플래너가
      // FALL_BACK -> RESCUE 같은 말이 안 되는 순서를 더 싸다고 골라버린다.
      !s.selfSafe && s.stamina >= RESCUE_STAMINA && s.threat <= tolerableThreat(agent),
      effect: (s) => ({ ...s, allySafe: true, stamina: s.stamina - RESCUE_STAMINA }),
      // 위협이 높을수록 비싸다 — 그래서 위협이 높으면 연막이 낫다는 계산이 나온다
      cost: (s) => 2 + s.threat / 25
    },
    {
      step: "FALL_BACK",
      applicable: (s) => !s.selfSafe,
      effect: (s) => ({ ...s, selfSafe: true }),
      cost: () => 1
    }
  ];
  function satisfiesRescueGoal(state) {
    return state.allySafe && state.selfSafe;
  }
  function initialPlanState(agent) {
    return {
      allySafe: false,
      selfSafe: false,
      threat: agent.selfRisk,
      smokeUsed: false,
      stamina: Math.round(agent.stamina)
    };
  }

  // src/decision/l2Goap.ts
  var MAX_PLAN_LENGTH = 4;
  function planningGoal(state) {
    return [...state.goals].filter((g) => g.kind === "never_abandon_ally").sort((a, b) => b.priority - a.priority)[0];
  }
  function applyL2(state) {
    const goal = planningGoal(state);
    if (!goal || !state.subject) return void 0;
    const plan = findPlan(state, goal);
    if (!plan) return void 0;
    return { reason: reasonFor(plan, state), plan };
  }
  function primaryAction(plan) {
    return plan.steps.includes("RESCUE") ? "RESCUE" : "RETREAT";
  }
  function effectiveThreat(threat, steps) {
    return steps.includes("SUPPRESS") ? Math.max(0, threat - SUPPRESSION_THREAT_REDUCTION) : threat;
  }
  function findPlan(agent, goal) {
    const start = { state: initialPlanState(agent), steps: [], cost: 0 };
    const frontier = [start];
    let best;
    while (frontier.length > 0) {
      frontier.sort((a, b) => a.cost - b.cost || a.steps.length - b.steps.length);
      const node = frontier.shift();
      if (satisfiesRescueGoal(node.state)) {
        best = node;
        break;
      }
      if (node.steps.length >= MAX_PLAN_LENGTH) continue;
      for (const action of GOAP_ACTIONS) {
        if (!action.applicable(node.state, agent)) continue;
        frontier.push({
          state: action.effect(node.state),
          steps: [...node.steps, action.step],
          cost: node.cost + action.cost(node.state)
        });
      }
    }
    if (!best) return void 0;
    return { steps: best.steps, cost: Math.round(best.cost * 10) / 10, goal };
  }
  function reasonFor(plan, state) {
    const factors = [
      { key: "goal", value: plan.goal.kind },
      { key: "plan", value: plan.steps.join("\u2192") },
      { key: "cost", value: plan.cost },
      ...plan.goal.sourceMemory ? [{ key: "source", value: plan.goal.sourceMemory }] : []
    ];
    return {
      action: primaryAction(plan),
      layer: "L2",
      factors,
      // 계획이 있다는 사실이 공포를 누른다. 무엇을 눌렀는지 남긴다 (규칙 6)
      overrides: [{ key: "fear", value: state.fear }]
    };
  }

  // src/decision/decide.ts
  function decide(state) {
    const l0 = applyL0(state);
    if (l0) return { reason: l0 };
    const l2 = applyL2(state);
    if (l2) return { reason: l2.reason, plan: l2.plan };
    const l1 = applyL1(state);
    return { reason: l1.reason, scores: l1.scores };
  }

  // src/decision/situation.ts
  function allyDown(subject, enemyThreat, tick) {
    return {
      kind: "ally_down_before_enemy",
      subject,
      enemyThreat,
      tick,
      description: "\uB3D9\uB8CC\uAC00 \uC704\uD5D8\uD55C \uC801 \uC55E\uC5D0\uC11C \uC4F0\uB7EC\uC84C\uB2E4."
    };
  }

  // src/sim/resolve.ts
  var OUTCOME = {
    /** 구조 성공 시 구조자가 입는 피해. 위협도에 비례 */
    rescueDamageRatio: 0.7,
    /** 구조 성공 시 구조된 쪽이 구조자에게 갖는 신뢰 상승 */
    rescuedTrustGain: 18,
    /**
     * 구조 성공 시 구조자가 구조 대상에게 갖는 신뢰 상승.
     * 구조된 쪽보다 작다 — 목숨을 구해준 쪽의 체감이 더 크다.
     */
    rescuerTrustGain: 8,
    /** 구조 성공 시 구조자가 체감하는 공포 상승 (피해의 절반) */
    rescueFearGainRatio: 0.5,
    /** 퇴각 시 공포 감쇠 */
    retreatFearDecay: 8,
    /** 내가 퇴각해서 동료가 죽었을 때 생기는 기억의 중요도 */
    abandonMemoryImportance: 90,
    /** 그 기억이 만드는 목표의 우선순위 */
    neverAbandonGoalPriority: 85,
    /** 구조 성공 기억의 중요도 */
    rescueMemoryImportance: 55,
    /** 부상 기억의 중요도 */
    woundMemoryImportance: 45,
    /** 동료의 죽음을 목격한 기억의 중요도. 내 탓(abandon 90)보다 약하다 */
    witnessMemoryImportance: 60,
    /** 조우 1회당 누적 피로. 10층을 오르는 동안 행동 여력이 줄어든다 */
    fatiguePerEncounter: 6,
    /** 같은 일이 반복될 때 기존 기억이 강화되는 정도 */
    memoryReinforcement: 3
  };
  var ResolveTransaction = {
    name: "ResolveAction",
    validate(world, request) {
      if (request.decisions.length === 0) return "\uD310\uB2E8\uC774 \uBE44\uC5B4 \uC788\uB2E4";
      const subject = world.find(request.situation.subject);
      if (!subject) return `\uC54C \uC218 \uC5C6\uB294 \uB300\uC0C1: ${request.situation.subject}`;
      if (subject.status !== "alive") return `\uC774\uBBF8 \uC8FD\uC740 \uB300\uC0C1: ${request.situation.subject}`;
      const seen = /* @__PURE__ */ new Set();
      for (const decision of request.decisions) {
        const actor = world.find(decision.actor);
        if (!actor) return `\uC54C \uC218 \uC5C6\uB294 Instance: ${decision.actor}`;
        if (actor.status !== "alive") return `\uC8FD\uC740 \uCE90\uB9AD\uD130\uB294 \uD589\uB3D9\uD560 \uC218 \uC5C6\uB2E4: ${decision.actor}`;
        if (actor.instanceId === subject.instanceId) return "\uC4F0\uB7EC\uC9C4 \uB2F9\uC0AC\uC790\uB294 \uD310\uB2E8\uD558\uC9C0 \uC54A\uB294\uB2E4";
        if (seen.has(decision.actor)) return `\uAC19\uC740 \uCE90\uB9AD\uD130\uC758 \uD310\uB2E8\uC774 \uB450 \uBC88 \uB4E4\uC5B4\uC654\uB2E4: ${decision.actor}`;
        seen.add(decision.actor);
      }
      return void 0;
    },
    apply(world, request) {
      const before = world.events.length;
      const subject = world.instance(request.situation.subject);
      const tick = request.situation.tick;
      const died = [];
      const damageByActor = /* @__PURE__ */ new Map();
      const rescued = request.decisions.some((d) => d.action === "RESCUE");
      for (const decision of request.decisions) {
        const actor = world.instance(decision.actor);
        actor.needs.fatigue = clamp(actor.needs.fatigue + OUTCOME.fatiguePerEncounter, 0, 100);
        if (decision.action === "RESCUE" || decision.action === "ATTACK") {
          const isRescue = decision.action === "RESCUE";
          const threat = effectiveThreat(request.situation.enemyThreat, decision.plan ?? []);
          const damage = Math.round(threat * OUTCOME.rescueDamageRatio);
          damageByActor.set(actor.instanceId, damage);
          actor.needs.health = clamp(actor.needs.health - damage, 0, actor.needs.maxHealth);
          actor.emotion.fear = clamp(
            actor.emotion.fear + Math.round(damage * OUTCOME.rescueFearGainRatio),
            0,
            100
          );
          if (isRescue) {
            raiseTrust(world, subject, actor.instanceId, OUTCOME.rescuedTrustGain, tick, "rescued_by");
            raiseTrust(world, actor, subject.instanceId, OUTCOME.rescuerTrustGain, tick, "rescued_them");
            addMemory(world, actor, {
              tag: "rescued_ally",
              importance: OUTCOME.rescueMemoryImportance,
              tick,
              subject: subject.instanceId,
              text: `${object(subject.identity.name)} \uC801 \uC55E\uC5D0\uC11C \uB04C\uC5B4\uB0C8\uB2E4.`
            });
          }
          if (damage > 0) {
            addMemory(world, actor, {
              tag: "wounded_in_rescue",
              importance: OUTCOME.woundMemoryImportance,
              tick,
              text: `\uADF8 \uB300\uAC00\uB85C \uAE4A\uC740 \uC0C1\uCC98\uB97C \uC785\uC5C8\uB2E4.`
            });
          }
          if (actor.needs.health <= 0) {
            killInstance(world, actor, "killed_by_enemy", [subject.instanceId], tick);
            died.push(actor.instanceId);
          }
        } else {
          damageByActor.set(actor.instanceId, 0);
          actor.emotion.fear = clamp(actor.emotion.fear - OUTCOME.retreatFearDecay, 0, 100);
        }
      }
      if (!rescued) {
        const witnesses = request.decisions.map((d) => d.actor);
        killInstance(world, subject, "abandoned", witnesses, tick);
        died.push(subject.instanceId);
        for (const decision of request.decisions) {
          const actor = world.instance(decision.actor);
          if (actor.status !== "alive") continue;
          const memory = addMemory(world, actor, {
            tag: "ally_died_unrescued",
            importance: OUTCOME.abandonMemoryImportance,
            tick,
            subject: subject.instanceId,
            text: decision.action === "ATTACK" ? `\uB098\uB294 \uC801\uC744 \uCAD3\uC558\uACE0, ${topic(subject.identity.name)} \uADF8 \uC0AC\uC774\uC5D0 \uC8FD\uC5C8\uB2E4.` : `\uB0B4\uAC00 \uBB3C\uB7EC\uC130\uACE0, ${topic(subject.identity.name)} \uAC70\uAE30\uC11C \uC8FD\uC5C8\uB2E4.`
          });
          addGoalFromMemory(actor, memory.memoryId, tick);
        }
      }
      for (const victimId of died) {
        const victim = world.instance(victimId);
        const abandoned = !rescued && victimId === subject.instanceId;
        const observers = request.decisions.map((d) => world.instance(d.actor)).filter((actor) => actor.status === "alive" && actor.instanceId !== victimId);
        if (rescued && subject.status === "alive" && subject.instanceId !== victimId) {
          observers.push(subject);
        }
        for (const observer of observers) {
          if (abandoned) continue;
          addMemory(world, observer, {
            tag: "witnessed_ally_death",
            importance: OUTCOME.witnessMemoryImportance,
            tick,
            subject: victimId,
            text: `${topic(victim.identity.name)} \uB208\uC55E\uC5D0\uC11C \uC8FD\uC5C8\uB2E4.`
          });
        }
      }
      world.events.append({
        kind: "MissionOutcome",
        tick,
        participants: [...request.decisions.map((d) => d.actor), subject.instanceId],
        outcome: died.length === 0 ? "success" : "partial",
        summary: request.decisions.map((d) => `${world.instance(d.actor).identity.name}:${d.action}`).join(" ")
      });
      return {
        died,
        damageByActor,
        rescued,
        events: world.events.all().slice(before)
      };
    }
  };
  function raiseTrust(world, holder, target, delta, tick, cause) {
    let relationship = holder.relationships.find((r) => r.target === target);
    if (!relationship) {
      relationship = { target, trust: 50 };
      holder.relationships.push(relationship);
    }
    const trustBefore = relationship.trust;
    relationship.trust = clamp(trustBefore + delta, 0, 100);
    world.events.append({
      kind: "RelationshipChange",
      tick,
      from: holder.instanceId,
      to: target,
      trustBefore,
      trustAfter: relationship.trust,
      cause
    });
  }
  function addMemory(world, owner, args) {
    const existingIndex = owner.memory.findIndex(
      (m) => m.tag === args.tag && m.subject === args.subject
    );
    if (existingIndex >= 0) {
      const existing = owner.memory[existingIndex];
      const reinforced = {
        ...existing,
        importance: clamp(existing.importance + OUTCOME.memoryReinforcement, 0, 100),
        atTick: args.tick
      };
      owner.memory[existingIndex] = reinforced;
      return reinforced;
    }
    const entry = {
      memoryId: memoryId(String(world.ids.next()).padStart(4, "0")),
      kind: args.subject ? "Social" : "Episodic",
      tag: args.tag,
      importance: args.importance,
      atTick: args.tick,
      subject: args.subject,
      text: args.text
    };
    owner.memory.push(entry);
    world.events.append({
      kind: "MajorMemory",
      tick: args.tick,
      owner: owner.instanceId,
      memoryId: entry.memoryId,
      tag: entry.tag,
      importance: entry.importance
    });
    return entry;
  }
  function addGoalFromMemory(owner, source, tick) {
    const already = owner.goals.some((g) => g.kind === "never_abandon_ally");
    if (already) return;
    owner.goals.push({
      goalId: goalId(`${owner.instanceId}_never_abandon`),
      kind: "never_abandon_ally",
      priority: OUTCOME.neverAbandonGoalPriority,
      sourceMemory: source,
      createdAtTick: tick
    });
  }
  function killInstance(world, victim, cause, witnesses, tick) {
    victim.status = "dead";
    victim.needs.health = 0;
    victim.legacy.diedAtTick = tick;
    world.events.append({
      kind: "Death",
      tick,
      subject: victim.instanceId,
      cause,
      witnesses
    });
    world.events.append({
      kind: "LegacyCreation",
      tick,
      from: victim.instanceId,
      relics: victim.legacy.relics,
      inheritedMemories: victim.memory.filter((m) => m.importance >= 70).map((m) => m.memoryId)
    });
  }

  // src/core/instanceFactory.ts
  function createInstance(input) {
    const { definition, tick, rng, ids, initial } = input;
    const rolled = {
      risk: rollRange(rng, definition.personalityRanges.risk),
      loyalty: rollRange(rng, definition.personalityRanges.loyalty),
      sociability: rollRange(rng, definition.personalityRanges.sociability),
      aggression: rollRange(rng, definition.personalityRanges.aggression),
      honesty: rollRange(rng, definition.personalityRanges.honesty)
    };
    const personality = { ...rolled, ...initial?.personality };
    const name = pickUnusedName(rng, definition.namePool, input.usedNames ?? []);
    const relationships = (initial?.trust ?? []).map((t) => ({
      target: t.target,
      trust: t.trust
    }));
    return {
      instanceId: instanceId(String(ids.next()).padStart(4, "0")),
      status: "alive",
      identity: {
        name,
        definitionId: definition.definitionId,
        bornAtTick: tick
      },
      personality,
      needs: {
        health: definition.baseHealth,
        maxHealth: definition.baseHealth,
        fatigue: 0
      },
      emotion: { fear: initial?.fear ?? 0 },
      memory: [...initial?.memory ?? []],
      relationships,
      goals: [],
      legacy: { relics: [], inheritedMemories: [], reputation: 0 }
    };
  }
  function rollRange(rng, range) {
    return rng.intBetween(range.min, range.max);
  }
  function pickUnusedName(rng, pool, used) {
    const free = pool.filter((n) => !used.includes(n));
    if (free.length > 0) return rng.pick(free);
    const base = rng.pick(pool);
    for (let ordinal = 2; ; ordinal += 1) {
      const candidate = `${base} ${ordinal}`;
      if (!used.includes(candidate)) return candidate;
    }
  }

  // src/transactions/summon.ts
  var SummonTransaction = {
    name: "Summon",
    validate(world, request) {
      const definition = world.findDefinition(request.definitionId);
      if (!definition) return `\uC54C \uC218 \uC5C6\uB294 Definition: ${request.definitionId}`;
      if (definition.namePool.length === 0) return `\uC774\uB984 \uD480\uC774 \uBE44\uC5B4 \uC788\uC74C: ${request.definitionId}`;
      return void 0;
    },
    apply(world, request) {
      const definition = world.definition(request.definitionId);
      const instance = createInstance({
        definition,
        tick: world.tick,
        rng: world.rng,
        ids: world.ids,
        initial: request.initial,
        // 죽은 캐릭터도 포함한다 (규칙 7: 죽어도 History에 남는다)
        usedNames: world.allInstances().map((i) => i.identity.name)
      });
      world.mutateAddInstance(instance);
      return instance;
    }
  };

  // src/scenario/coreGameplay.ts
  function summon(world, definitionId2, initial) {
    const result = runTransaction(world, SummonTransaction, { definitionId: definitionId2, initial });
    if (!result.ok) throw new Error(result.error);
    return result.value;
  }

  // src/mission/tower.ts
  var TOWER = {
    floors: 10,
    /** 1층 25 → 10층 70. 후반 층은 계획 없이 감당할 수 없다 */
    threatAt: (floor) => 20 + floor * 5,
    /** 층 사이에 숨을 돌린다 — 공포가 조금 가라앉는다 */
    restFearDecay: 4,
    /**
     * 층 사이 체력 회복 (최대 체력 비율).
     *
     * 회복이 전혀 없으면 체력이 단조 감소만 하므로 누적 피해가 총 체력을 넘는 층에서
     * 등반이 반드시 멈춘다 — 실제로 200회 전부 8층 이상을 못 갔다. 10층이 존재하지만
     * 아무도 볼 수 없는 상태였다.
     *
     * 그래서 회복은 체력으로 주고 한계는 **피로**로 준다. 피로는 회복되지 않고
     * stamina를 깎으므로, 후반 층에서는 연막도 구조도 계획에 넣을 여력이 사라진다.
     * 즉 정상에 가려면 누군가를 버려야 한다 — 회복을 넣어도 상실의 무게는 남는다.
     */
    restHealRatio: 0.12,
    /** 등반을 계속하려면 최소 인원 */
    minPartyToContinue: 2
  };
  var FormPartyTransaction = {
    name: "FormParty",
    validate(world, request) {
      if (request.members.length < TOWER.minPartyToContinue) {
        return `\uD30C\uD2F0\uB294 \uCD5C\uC18C ${TOWER.minPartyToContinue}\uBA85\uC774\uB2E4`;
      }
      for (const id of request.members) {
        const member = world.find(id);
        if (!member) return `\uC54C \uC218 \uC5C6\uB294 Instance: ${id}`;
        if (member.status !== "alive") return `\uC8FD\uC740 \uCE90\uB9AD\uD130\uB294 \uD3B8\uC131\uD560 \uC218 \uC5C6\uB2E4: ${id}`;
      }
      return void 0;
    },
    apply(world, request) {
      for (const id of request.members) {
        const member = world.instance(id);
        for (const other of request.members) {
          if (other === id) continue;
          if (member.relationships.some((r) => r.target === other)) continue;
          member.relationships.push({ target: other, trust: request.baseTrust });
          world.events.append({
            kind: "RelationshipChange",
            tick: world.tick,
            from: id,
            to: other,
            trustBefore: 0,
            trustAfter: request.baseTrust,
            cause: "party_formed"
          });
        }
      }
    }
  };
  var floorKey = (floor) => `tower_floor_${floor}`;
  var ReachFloorTransaction = {
    name: "ReachFloor",
    validate(world, request) {
      if (request.floor < 1 || request.floor > TOWER.floors) {
        return `\uD0D1\uC5D0 \uC5C6\uB294 \uCE35: ${request.floor}`;
      }
      if (!world.find(request.by)) return `\uC54C \uC218 \uC5C6\uB294 Instance: ${request.by}`;
      return void 0;
    },
    apply(world, request) {
      const known = world.events.ofKind("WorldDiscovery").some((e) => e.what === floorKey(request.floor));
      if (known) return false;
      world.events.append({
        kind: "WorldDiscovery",
        tick: world.tick,
        discoveredBy: request.by,
        what: floorKey(request.floor)
      });
      return true;
    }
  };

  // src/mission/gates.ts
  var GATES = {
    aligned: {
      key: "aligned",
      ko: "\uC815\uB82C\uBB38",
      threat: 0,
      extraPressure: 0,
      fatigue: 0,
      supply: false,
      recoversEcho: false
    },
    warped: {
      key: "warped",
      ko: "\uB4A4\uD2C0\uB9B0\uBB38",
      // 안전을 사면 탑이 조여온다 — 이 교환이 위상압의 존재 이유다
      threat: -15,
      extraPressure: 8,
      fatigue: 10,
      supply: false,
      recoversEcho: true
    },
    deep: {
      key: "deep",
      ko: "\uC2EC\uCE35\uBB38",
      threat: 15,
      extraPressure: 0,
      fatigue: 0,
      supply: true,
      recoversEcho: false
    }
  };
  var GATE_KEYS = ["aligned", "warped", "deep"];
  var GATE_RULES = {
    /** 좌표마다 기본으로 오르는 위상압 */
    pressurePerDepth: 5,
    /** 위상압이 위협에 반영되는 비율 */
    threatFromPressure: 0.4,
    /** 잔상을 회수하면 전원의 공포가 내려간다 */
    echoRelief: 5,
    /** 잔상을 회수하지 않고 지나가면 전원의 공포가 오른다 */
    echoFear: 8,
    /** 보급 상한 */
    supplyCap: 4,
    /** 안정제 회복량 (최대 체력 비율) */
    healRatio: 0.3,
    /** 억제제: 공포 감소와 그 대가인 피로 */
    calmFear: 40,
    calmFatigue: 15
  };
  var DEFAULT_SUPPLIES = {
    suppressor: 2,
    stabilizer: 2,
    sedative: 1
  };
  var GateSession = class {
    constructor(input) {
      __publicField(this, "world");
      __publicField(this, "party");
      __publicField(this, "order");
      __publicField(this, "supplies");
      __publicField(this, "echoes");
      __publicField(this, "floors", []);
      __publicField(this, "deaths", []);
      __publicField(this, "gatesTaken", []);
      __publicField(this, "newEchoes", []);
      __publicField(this, "consumedEchoes", []);
      __publicField(this, "pressure", 0);
      __publicField(this, "deepestDepth", 0);
      __publicField(this, "abortReason");
      __publicField(this, "finished", false);
      __publicField(this, "pendingSuppressor");
      this.world = input.world;
      this.party = input.party;
      this.order = input.order;
      this.supplies = { ...input.startingSupplies ?? DEFAULT_SUPPLIES };
      this.echoes = [...input.echoes ?? []];
    }
    /**
     * 등반 중 명령 변경. Master가 할 수 있는 일이 문 선택뿐이면 게임이 얕다 —
     * 퇴각선을 언제 올리고 내리는지가 두 번째 레버다.
     *
     * 자동 진행(`runGateTower`)은 이걸 호출하지 않으므로 측정 결과는 영향받지 않는다.
     */
    setOrder(order) {
      this.order = order;
    }
    /**
     * 교란기를 미리 지급한다 (사람이 플레이할 때). 즉시 재고에서 빠지고,
     * 다음 `advance()` 한 번에만 유효하다.
     *
     * 자동 진행은 `Allocation`으로 같은 일을 한다 — 이쪽은 "누르면 카드에 표시가 붙는다"가
     * 필요한 화면용 경로다.
     */
    giveSuppressor(target) {
      if (this.pendingSuppressor) this.clearSuppressor();
      if (this.supplies.suppressor <= 0) return false;
      const c = this.world.find(target);
      if (!c || c.status !== "alive") return false;
      this.supplies.suppressor -= 1;
      this.pendingSuppressor = target;
      return true;
    }
    /** 지급 취소 — 재고를 돌려준다 */
    clearSuppressor() {
      if (!this.pendingSuppressor) return;
      this.supplies.suppressor += 1;
      this.pendingSuppressor = void 0;
    }
    suppressorHolder() {
      return this.pendingSuppressor;
    }
    /**
     * 안정제·억제제를 지금 쓴다.
     *
     * 자동 진행은 이 둘을 `advance()` 안에서 쓴다. 사람이 플레이할 때는 누른 즉시
     * 체력 막대가 오르는 것이 필요하므로 적용 시점이 문 통과 **이전**이 된다 —
     * 같은 수치, 같은 함수를 쓰지만 순서가 한 칸 앞이다.
     */
    useStabilizer(target) {
      const before = this.supplies.stabilizer;
      applyStabilizer(this.supplies, { stabilizerTo: target }, this.world);
      return this.supplies.stabilizer < before;
    }
    useSedative(target) {
      const before = this.supplies.sedative;
      applySedative(this.supplies, { sedativeTo: target }, this.world);
      return this.supplies.sedative < before;
    }
    /**
     * 다음 좌표에서 Master가 보는 것. 등반이 끝났으면 undefined.
     *
     * 부작용은 "끝났다"는 판정을 기록하는 것뿐이고 멱등이다 — 화면이 매 프레임 불러도 된다.
     * 세계는 건드리지 않는다 (tick도 올리지 않는다).
     */
    peek() {
      if (this.finished) return void 0;
      const depth = this.deepestDepth + 1;
      if (depth > TOWER.floors) {
        this.finished = true;
        return void 0;
      }
      const living = this.living();
      if (living.length === 0) {
        return this.stop("party_wiped");
      }
      if (living.length < TOWER.minPartyToContinue) {
        return this.stop("too_few_to_continue");
      }
      const line = this.order.retreatCondition.healthRatioBelow;
      if (line > 0 && living.every((c) => c.needs.health / c.needs.maxHealth < line)) {
        return this.stop("party_spent");
      }
      return {
        depth,
        baseThreat: TOWER.threatAt(depth) + (this.pressure + GATE_RULES.pressurePerDepth) * GATE_RULES.threatFromPressure,
        pressure: this.pressure,
        supplies: this.supplies,
        living,
        echo: this.echoes.find((e) => e.depth === depth),
        known: this.world.events.ofKind("WorldDiscovery").some((e) => e.what === floorKey(depth))
      };
    }
    /** 고른 문으로 한 좌표 진행한다. `peek()`이 undefined를 주면 호출해선 안 된다. */
    advance(gateKey, allocation = {}) {
      const ctx = this.peek();
      if (!ctx) throw new Error("\uB4F1\uBC18\uC774 \uC774\uBBF8 \uB05D\uB0AC\uB2E4");
      const { world, order } = this;
      const gate = GATES[gateKey];
      world.advanceTick();
      this.deepestDepth = ctx.depth;
      this.gatesTaken.push(gateKey);
      this.pressure += GATE_RULES.pressurePerDepth + gate.extraPressure;
      const threat = Math.max(5, Math.round(
        TOWER.threatAt(ctx.depth) + this.pressure * GATE_RULES.threatFromPressure + gate.threat
      ));
      if (gate.fatigue > 0) {
        for (const c of ctx.living) {
          c.needs.fatigue = Math.min(100, c.needs.fatigue + gate.fatigue);
        }
      }
      const suppressorHolder = this.takePendingSuppressor(ctx.living) ?? spendSuppressor(this.supplies, allocation, ctx.living);
      applyStabilizer(this.supplies, allocation, world);
      applySedative(this.supplies, allocation, world);
      const arrival = runTransaction(world, ReachFloorTransaction, {
        floor: ctx.depth,
        by: ctx.living[0].instanceId
      });
      if (!arrival.ok) throw new Error(arrival.error);
      const echoNote = this.settleEcho(ctx, gate);
      const fallen = pickFallen(world, ctx.living);
      const others = ctx.living.filter((c) => c.instanceId !== fallen.instanceId);
      const situation = allyDown(fallen.instanceId, threat, world.tick);
      const decisions = [];
      const byActor = /* @__PURE__ */ new Map();
      for (const actor of others) {
        const hasSuppressor = suppressorHolder === actor.instanceId;
        const decision = decide(buildAgentState(actor, situation, order, { hasSuppressor }));
        byActor.set(actor.instanceId, decision);
        decisions.push({
          actor: actor.instanceId,
          action: decision.reason.action,
          plan: decision.plan?.steps
        });
      }
      const resolved = runTransaction(world, ResolveTransaction, { situation, decisions });
      if (!resolved.ok) throw new Error(resolved.error);
      for (const id of resolved.value.died) {
        const victim = world.instance(id);
        const taken = this.echoes.some((e) => e.depth === ctx.depth) || this.newEchoes.some((e) => e.depth === ctx.depth);
        if (!taken) {
          this.newEchoes.push({
            depth: ctx.depth,
            name: victim.identity.name,
            grants: world.rng.next() < 0.5 ? "suppressor" : "stabilizer"
          });
        }
      }
      this.deaths.push(...resolved.value.died);
      let supplyGained;
      if (gate.supply) {
        supplyGained = world.rng.next() < 0.5 ? "suppressor" : "stabilizer";
        this.supplies[supplyGained] = Math.min(
          GATE_RULES.supplyCap,
          this.supplies[supplyGained] + 1
        );
      }
      const log = {
        depth: ctx.depth,
        gate: gateKey,
        threat,
        pressure: this.pressure,
        fallen,
        decisions: others.map((actor) => ({
          actor,
          decision: byActor.get(actor.instanceId),
          damage: resolved.value.damageByActor.get(actor.instanceId) ?? 0,
          heldSuppressor: suppressorHolder === actor.instanceId
        })),
        rescued: resolved.value.rescued,
        died: resolved.value.died,
        firstVisit: arrival.value,
        echoNote,
        supplyGained
      };
      this.floors.push(log);
      rest(world, this.party);
      return log;
    }
    result() {
      return {
        deepestDepth: this.deepestDepth,
        cleared: this.deepestDepth === TOWER.floors && this.abortReason === void 0,
        floors: this.floors,
        deaths: this.deaths,
        survivors: this.party.filter((id) => this.world.instance(id).status === "alive"),
        abortReason: this.abortReason,
        gatesTaken: this.gatesTaken,
        finalPressure: this.pressure,
        newEchoes: this.newEchoes,
        consumedEchoes: this.consumedEchoes
      };
    }
    /** 현재 보급 — 화면 표시용. 복사해서 준다 */
    currentSupplies() {
      return { ...this.supplies };
    }
    living() {
      return this.party.map((id) => this.world.instance(id)).filter((c) => c.status === "alive");
    }
    /** 미리 지급된 교란기를 이번 좌표에 쓴다. 이미 재고에서 빠져 있으므로 다시 빼지 않는다 */
    takePendingSuppressor(living) {
      const target = this.pendingSuppressor;
      this.pendingSuppressor = void 0;
      if (!target) return void 0;
      return living.some((c) => c.instanceId === target) ? target : void 0;
    }
    stop(reason) {
      this.abortReason = reason;
      this.finished = true;
      return void 0;
    }
    settleEcho(ctx, gate) {
      const echo = ctx.echo;
      if (!echo) return void 0;
      if (!gate.recoversEcho) {
        for (const c of ctx.living) {
          c.emotion.fear = Math.min(100, c.emotion.fear + GATE_RULES.echoFear);
        }
        return `${echo.name}\uC758 \uC774\uB984\uC774 \uBCBD\uBA74\uC5D0 \uB5A0 \uC788\uB2E4`;
      }
      this.supplies[echo.grants] = Math.min(
        GATE_RULES.supplyCap,
        this.supplies[echo.grants] + 1
      );
      for (const c of ctx.living) {
        c.emotion.fear = Math.max(0, c.emotion.fear - GATE_RULES.echoRelief);
      }
      this.echoes.splice(this.echoes.indexOf(echo), 1);
      this.consumedEchoes.push(echo);
      return `${echo.name}\uC758 \uC794\uC0C1\uC744 \uD68C\uC218\uD588\uB2E4`;
    }
  };
  function pickFallen(world, living) {
    const weights = living.map((c) => 1 + (1 - c.needs.health / c.needs.maxHealth) * 2.2);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = world.rng.next() * total;
    for (let i = 0; i < living.length; i += 1) {
      roll -= weights[i];
      if (roll <= 0) return living[i];
    }
    return living[living.length - 1];
  }
  function spendSuppressor(supplies, allocation, living) {
    const target = allocation.suppressorTo;
    if (!target || supplies.suppressor <= 0) return void 0;
    if (!living.some((c) => c.instanceId === target)) return void 0;
    supplies.suppressor -= 1;
    return target;
  }
  function applyStabilizer(supplies, allocation, world) {
    const target = allocation.stabilizerTo;
    if (!target || supplies.stabilizer <= 0) return;
    const c = world.find(target);
    if (!c || c.status !== "alive") return;
    supplies.stabilizer -= 1;
    c.needs.health = Math.min(
      c.needs.maxHealth,
      c.needs.health + Math.round(c.needs.maxHealth * GATE_RULES.healRatio)
    );
  }
  function applySedative(supplies, allocation, world) {
    const target = allocation.sedativeTo;
    if (!target || supplies.sedative <= 0) return;
    const c = world.find(target);
    if (!c || c.status !== "alive") return;
    supplies.sedative -= 1;
    c.emotion.fear = Math.max(0, c.emotion.fear - GATE_RULES.calmFear);
    c.needs.fatigue = Math.min(100, c.needs.fatigue + GATE_RULES.calmFatigue);
  }
  function rest(world, party) {
    for (const id of party) {
      const member = world.instance(id);
      if (member.status !== "alive") continue;
      member.needs.health = Math.min(
        member.needs.maxHealth,
        member.needs.health + Math.round(member.needs.maxHealth * TOWER.restHealRatio)
      );
      member.emotion.fear = Math.max(0, member.emotion.fear - TOWER.restFearDecay);
    }
  }

  // src/mission/campaign.ts
  var CAMP = {
    /** 파티 정원 */
    partySize: 4,
    /**
     * 캠프에서 회복되는 피로 비율. 1이면 완전 회복.
     *
     * 이 값이 0이면 L2가 영구히 실행되지 않는다 — 측정으로 확인된 사실이다.
     * 동시에 1로 두면 피로가 등반 내부의 압박으로만 작동하고 캠페인 전체의 압박은 사라진다.
     * 이 값이 **"지친 베테랑을 쉬게 할 것인가, 새 사람을 넣을 것인가"의 저울**이다.
     */
    fatigueRecovered: 1,
    /** 캠프에서 회복되는 체력 비율 (최대 체력 기준) */
    healthRecovered: 1,
    /** 캠프에서 가라앉는 공포 */
    fearRecovered: 20
  };
  function campRest(roster, camp = CAMP) {
    for (const member of roster) {
      if (member.status !== "alive") continue;
      member.needs.fatigue = Math.max(
        0,
        Math.round(member.needs.fatigue * (1 - camp.fatigueRecovered))
      );
      member.needs.health = Math.min(
        member.needs.maxHealth,
        member.needs.health + Math.round(member.needs.maxHealth * camp.healthRecovered)
      );
      member.emotion.fear = Math.max(0, member.emotion.fear - camp.fearRecovered);
    }
  }
  function refillRoster(world, roster, camp = CAMP) {
    while (roster.length < camp.partySize) {
      const definition = roster.length % 2 === 0 ? VANGUARD : SCOUT;
      roster.push(summon(world, definition.definitionId));
    }
  }

  // src/persistence/serialize.ts
  function serialize(snapshot) {
    return JSON.stringify(snapshot, sortedReplacer, 2);
  }
  function sortedReplacer(_key, value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
    const record = value;
    const sorted = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = record[key];
    }
    return sorted;
  }

  // src/persistence/snapshot.ts
  var SNAPSHOT_VERSION = 1;
  function takeSnapshot(world) {
    return {
      version: SNAPSHOT_VERSION,
      tick: world.tick,
      rngState: world.rng.serialize(),
      idCounter: world.ids.peek(),
      instances: world.allInstances(),
      events: world.events.all()
    };
  }
  function assertSnapshotVersion(snapshot) {
    if (snapshot.version !== SNAPSHOT_VERSION) {
      throw new Error(
        `Snapshot \uBC84\uC804 \uBD88\uC77C\uCE58: \uD30C\uC77C=${snapshot.version}, \uCF54\uB4DC=${SNAPSHOT_VERSION}`
      );
    }
  }

  // src/web/api.ts
  var MEMORY_KO = {
    ally_died_unrescued: "\uAD6C\uD558\uC9C0 \uBABB\uD55C \uC8FD\uC74C",
    rescued_ally: "\uAD6C\uD574\uB0B8 \uAE30\uC5B5",
    wounded_in_rescue: "\uAD6C\uC870\uC758 \uC0C1\uCC98",
    witnessed_ally_death: "\uBAA9\uACA9\uD55C \uC8FD\uC74C"
  };
  var GOAL_KO = {
    never_abandon_ally: "\uB2E4\uC2DC\uB294 \uBC84\uB9AC\uC9C0 \uC54A\uB294\uB2E4",
    survive: "\uC0B4\uC544\uB0A8\uB294\uB2E4"
  };
  var GATE_EN = {
    aligned: "ALIGNED",
    warped: "WARPED",
    deep: "DEEP"
  };
  var GATE_DESC = {
    aligned: "\uC704\uC0C1\uC774 \uB9DE\uBB3C\uB824 \uC788\uB2E4. \uC608\uCE21\uD55C \uADF8\uB300\uB85C\uB2E4.",
    warped: "\uC88C\uD45C\uAC00 \uC5B4\uAE0B\uB09C\uB2E4. \uC704\uD5D8\uC740 \uB0AE\uACE0 \uC794\uC0C1\uC774 \uB0A8\uC544 \uC788\uB2E4.",
    deep: "\uB354 \uAE4A\uC740 \uC88C\uD45C\uB85C \uACE7\uC7A5 \uC774\uC5B4\uC9C4\uB2E4. \uBCF4\uAE09\uC774 \uC788\uB2E4."
  };
  var SUPPLY_KO = {
    suppressor: "\uAD50\uB780\uAE30",
    stabilizer: "\uC548\uC815\uC81C",
    sedative: "\uC5B5\uC81C\uC81C"
  };
  var ABORT_KO = {
    party_wiped: "\uC804\uBA78\uD588\uB2E4",
    too_few_to_continue: "\uB0A8\uC740 \uC778\uC6D0\uC73C\uB85C\uB294 \uB2E4\uC74C \uBB38\uC744 \uC5F4 \uC218 \uC5C6\uB2E4",
    party_spent: "\uC804\uC6D0\uC774 \uD1F4\uAC01\uC120 \uC544\uB798\uB2E4 \u2014 \uD22C\uC601\uC744 \uB2EB\uB294\uB2E4"
  };
  var Game = class {
    constructor(options = {}) {
      __publicField(this, "world");
      __publicField(this, "camp");
      __publicField(this, "roster", []);
      __publicField(this, "echoes", []);
      __publicField(this, "seen", /* @__PURE__ */ new Set());
      __publicField(this, "joinedAt", /* @__PURE__ */ new Map());
      __publicField(this, "runs", []);
      __publicField(this, "session");
      __publicField(this, "attempt", 1);
      __publicField(this, "returning", 0);
      __publicField(this, "history", []);
      __publicField(this, "final");
      __publicField(this, "risk", "balanced");
      __publicField(this, "line", 0.25);
      this.camp = { ...CAMP, ...options.camp };
      const save = options.save;
      if (save) {
        assertSnapshotVersion(save.snapshot);
        this.world = World.restore({
          tick: save.snapshot.tick,
          instances: save.snapshot.instances,
          definitions: ALL_DEFINITIONS,
          rngState: save.snapshot.rngState,
          idCounter: save.snapshot.idCounter,
          events: save.snapshot.events
        });
        this.echoes = save.echoes;
        this.seen = new Set(save.seen);
        this.runs = [...save.runs];
        for (const [id, n] of Object.entries(save.joinedAt)) this.joinedAt.set(id, n);
        this.roster = save.roster.map((id) => this.world.find(id)).filter((c) => c !== void 0 && c.status === "alive");
        this.attempt = this.runs.length + 1;
      } else {
        this.world = World.create(options.seed ?? 77001, ALL_DEFINITIONS);
      }
      this.session = this.openAttempt();
    }
    /* ── 명령 ── */
    setRisk(policy) {
      this.risk = policy;
      this.session.setOrder(this.order());
    }
    setRetreatLine(ratio) {
      this.line = ratio;
      this.session.setOrder(this.order());
    }
    currentRisk() {
      return this.risk;
    }
    currentLine() {
      return this.line;
    }
    order() {
      return {
        goal: "advance",
        riskPolicy: this.risk,
        retreatCondition: { healthRatioBelow: this.line }
      };
    }
    /* ── 보급 ── */
    giveSuppressor(id) {
      if (this.session.suppressorHolder() === id) this.session.clearSuppressor();
      else this.session.giveSuppressor(id);
    }
    useStabilizer(id) {
      this.session.useStabilizer(id);
    }
    useSedative(id) {
      this.session.useSedative(id);
    }
    /* ── 진행 ── */
    /** 다음 좌표의 문 세 개. 등반이 끝났으면 빈 배열 */
    gates() {
      const ctx = this.session.peek();
      if (!ctx) {
        this.closeIfNeeded();
        return [];
      }
      const known = this.seen.has(ctx.depth) || ctx.known;
      return GATE_KEYS.map((key) => {
        const gate = GATES[key];
        const threat = Math.max(5, Math.round(ctx.baseThreat + gate.threat));
        return {
          key,
          ko: gate.ko,
          en: GATE_EN[key],
          desc: GATE_DESC[key],
          threatShown: known ? String(threat) : `${Math.max(5, threat - 8)}~${threat + 8}`,
          threatSign: gate.threat > 0 ? "up" : gate.threat < 0 ? "down" : "flat",
          pressureGain: GATE_RULES.pressurePerDepth + gate.extraPressure,
          fatigue: gate.fatigue,
          supply: gate.supply,
          recoversEcho: gate.recoversEcho,
          echoName: ctx.echo?.name
        };
      });
    }
    /** 다음 좌표 번호. 등반이 끝났으면 undefined */
    nextDepth() {
      return this.session.peek()?.depth;
    }
    /** 문을 고른다. 판단·피해·죽음·기억은 전부 엔진이 하고, 결과만 돌아온다 */
    enter(gate) {
      const ctx = this.session.peek();
      if (!ctx) {
        this.closeIfNeeded();
        return void 0;
      }
      this.seen.add(ctx.depth);
      const log = this.session.advance(gate);
      const died = new Set(log.died.map(String));
      const view = {
        depth: log.depth,
        threat: log.threat,
        gate: log.gate,
        gateKo: GATES[log.gate].ko,
        fallenName: log.fallen.identity.name,
        firstVisit: log.firstVisit,
        echoNote: log.echoNote,
        supplyGained: log.supplyGained ? `${SUPPLY_KO[log.supplyGained]} +1` : void 0,
        rescued: log.rescued,
        rows: log.decisions.map((d) => ({
          id: String(d.actor.instanceId),
          name: d.actor.identity.name,
          action: d.decision.reason.action,
          layer: d.decision.reason.layer,
          code: formatReason(d.decision.reason),
          plan: d.decision.plan?.steps,
          sentence: narrateAction(d.actor, log.fallen, d.decision),
          damage: d.damage,
          died: died.has(String(d.actor.instanceId))
        })),
        diedNames: log.died.map((id) => this.world.instance(id).identity.name)
      };
      this.history = [view, ...this.history];
      this.closeIfNeeded();
      return view;
    }
    /** 등반이 끝났다면 결과. 진행 중이면 undefined */
    finalView() {
      this.closeIfNeeded();
      return this.final;
    }
    /** 캠프를 거쳐 다음 등반을 시작한다 */
    nextAttempt() {
      if (!this.final) return;
      this.attempt += 1;
      this.session = this.openAttempt();
      this.history = [];
      this.final = void 0;
    }
    /* ── 화면이 읽는 것 ── */
    hud() {
      return {
        attempt: this.attempt,
        returning: this.returning,
        depth: this.history[0]?.depth ?? 0,
        totalDepths: TOWER.floors,
        pressure: this.session.result().finalPressure,
        supplies: this.session.currentSupplies(),
        livingCount: this.roster.filter((c) => c.status === "alive").length
      };
    }
    units() {
      const holder = this.session.suppressorHolder();
      return this.roster.map((c) => this.unitView(c, holder));
    }
    log() {
      return this.history;
    }
    ledger() {
      return {
        coords: Array.from({ length: TOWER.floors }, (_, i) => {
          const depth = i + 1;
          return {
            depth,
            seen: this.seen.has(depth),
            echoName: this.echoes.find((e) => e.depth === depth)?.name
          };
        }),
        runs: this.runs
      };
    }
    /* ── 저장 ── */
    save() {
      return {
        snapshot: takeSnapshot(this.world),
        echoes: this.echoes,
        seen: [...this.seen],
        roster: this.roster.map((c) => String(c.instanceId)),
        joinedAt: Object.fromEntries(this.joinedAt),
        runs: this.runs
      };
    }
    /** 세이브 원문. Unity가 읽는 것과 같은 형식의 snapshot을 품는다 */
    saveText() {
      const data = this.save();
      return JSON.stringify({
        ...data,
        snapshot: JSON.parse(serialize(data.snapshot))
      });
    }
    /* ── 내부 ── */
    /** 몇 번째 등반인가. 합류 회차에서 계산한다 — 새로고침해도 늘어나지 않는다 */
    attemptsSurvived(c) {
      return this.attempt - (this.joinedAt.get(String(c.instanceId)) ?? this.attempt) + 1;
    }
    unitView(c, holder) {
      const definition = this.world.definition(c.identity.definitionId);
      return {
        id: String(c.instanceId),
        name: c.identity.name,
        role: definition.archetype,
        loyalty: c.personality.loyalty,
        health: c.needs.health,
        maxHealth: c.needs.maxHealth,
        healthRatio: c.needs.health / c.needs.maxHealth,
        fear: c.emotion.fear,
        fatigue: c.needs.fatigue,
        alive: c.status === "alive",
        attempts: this.attemptsSurvived(c),
        holdingSuppressor: holder === c.instanceId,
        goals: c.goals.map((g) => GOAL_KO[g.kind] ?? g.kind),
        memories: c.memory.map((m) => ({
          ko: MEMORY_KO[m.tag] ?? m.tag,
          importance: m.importance
        }))
      };
    }
    /** 캠프 → 자리 보충 → 편성 → 새 등반 */
    openAttempt() {
      this.roster = this.roster.filter((c) => c.status === "alive");
      this.returning = this.roster.length;
      campRest(this.roster, this.camp);
      refillRoster(this.world, this.roster, this.camp);
      for (const c of this.roster) {
        const key = String(c.instanceId);
        if (!this.joinedAt.has(key)) this.joinedAt.set(key, this.attempt);
      }
      const formed = runTransaction(this.world, FormPartyTransaction, {
        members: this.roster.map((c) => c.instanceId),
        baseTrust: 50
      });
      if (!formed.ok) throw new Error(formed.error);
      return new GateSession({
        world: this.world,
        party: this.roster.map((c) => c.instanceId),
        order: this.order(),
        echoes: this.echoes
      });
    }
    /** 등반이 끝났으면 결과를 만들고 잔상·기록을 갱신한다 */
    closeIfNeeded() {
      if (this.final) return;
      if (this.session.peek()) return;
      const result = this.session.result();
      this.echoes = [
        ...this.echoes.filter((e) => !result.consumedEchoes.includes(e)),
        ...result.newEchoes
      ];
      const survivors = result.survivors.map((id) => this.world.instance(id));
      const deaths = result.deaths.map((id) => this.world.instance(id).identity.name);
      this.final = {
        cleared: result.cleared,
        reason: result.abortReason ? ABORT_KO[result.abortReason] : void 0,
        deepestDepth: result.deepestDepth,
        survivors: survivors.map((c) => c.identity.name),
        deaths,
        camp: survivors.map((c) => ({
          name: c.identity.name,
          attempts: this.attemptsSurvived(c),
          hasGoal: c.goals.length > 0,
          memories: c.memory.map((m) => MEMORY_KO[m.tag] ?? m.tag)
        }))
      };
      this.runs = [
        { attempt: this.attempt, depth: result.deepestDepth, cleared: result.cleared, deaths },
        ...this.runs
      ].slice(0, 8);
    }
  };
  var RULES_FOR_DISPLAY = {
    totalDepths: TOWER.floors,
    pressurePerDepth: GATE_RULES.pressurePerDepth,
    echoFear: GATE_RULES.echoFear,
    calmFear: GATE_RULES.calmFear,
    calmFatigue: GATE_RULES.calmFatigue,
    healRatio: GATE_RULES.healRatio,
    supplyCap: GATE_RULES.supplyCap,
    partySize: CAMP.partySize,
    fearRecovered: CAMP.fearRecovered,
    definitions: [VANGUARD, SCOUT].map((d) => ({ ko: d.archetype, health: d.baseHealth }))
  };
  return __toCommonJS(entry_exports);
})();
