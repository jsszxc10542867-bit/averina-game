// 지역별 시뮬레이션 정밀도 (통합 명세 31·39절)
// active  = 플레이어가 있는 지역. 5분마다 NPC가 판단한다.
// nearby  = 이웃 지역. 30분마다.
// distant = 먼 지역. 3시간마다 추상적으로 (일정대로 움직이고 욕구는 뭉뚱그려 채운다).
// NPC마다 자기 시각(simT)을 따로 갖고 있어서, 지역을 옮겨 다녀도 같은 시간을 두 번 계산하지 않는다.
const Regions = (() => {
  const STEP = { active: 5, nearby: 30, distant: 180 };

  function create() {
    const r = {};
    Object.keys(REGION_DATA).forEach((id) => {
      r[id] = { level: 'distant', simT: Time.START, threat: id === 'forest' ? 30 : 5, alert: 0 };
    });
    return r;
  }

  function updateLevels(S) {
    const { W } = S;
    const here = Places.regionOf(W.player.loc);
    Object.keys(W.regions).forEach((id) => {
      W.regions[id].level = id === here ? 'active' : REGION_DATA[here].adj.includes(id) ? 'nearby' : 'distant';
    });
  }

  // 시각 t까지, 계산할 때가 된 지역의 NPC와 짐승을 움직인다
  function simulate(S, t) {
    const { W } = S;
    Object.entries(W.regions).forEach(([id, r]) => {
      if (t - r.simT < STEP[r.level]) return;
      r.simT = t;
      Object.values(W.npcs).forEach((n) => {
        if (Places.regionOf(n.location.loc) === id) Behavior.update(S, n, t, r.level);
      });
      Object.values(W.creatures).forEach((c) => {
        if (Places.regionOf(c.loc) === id) Creatures.update(S, c, t, r.level);
      });
    });
  }

  // 하루에 한 번: 위협은 조금씩 가라앉는다
  function daily(S) {
    Object.values(S.W.regions).forEach((r) => {
      r.threat = Math.max(0, r.threat - 4);
      r.alert = Math.max(0, r.alert - 10);
    });
  }

  function raiseThreat(S, region, n) {
    const r = S.W.regions[region];
    if (r) r.threat = Math.min(100, r.threat + n);
  }

  return { STEP, create, updateLevels, simulate, daily, raiseThreat };
})();

if (typeof module !== 'undefined') module.exports = { Regions };
