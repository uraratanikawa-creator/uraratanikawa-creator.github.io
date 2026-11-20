(() => {
  const root = document.getElementById("intro-game-section");
  if (!root) return;
  const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
  const stage = $(".game-stage"), visual = $(".game-visual"), hero = $(".hero"),
        text = $(".game-text"), popup = $(".choice-popup"), list = $(".choice-list"),
        label = $(".day-label"), noise = $(".noise"), objs = $$(".obj"), fill = $(".gauge-bar i");

  /* ---------- 모래폭풍 노이즈 (#2b1d2f 바탕, #332132 질감) ---------- */
  const ctx = noise.getContext("2d"), img = ctx.createImageData(noise.width, noise.height);
  const base = [0x2b, 0x1d, 0x2f], tone = [0x33, 0x21, 0x32];
  let last = 0;
  (function loop(t) {
    if (t - last > 66) {
      last = t;
      for (let i = 0; i < img.data.length; i += 4) {
        const r = Math.random();
        for (let c = 0; c < 3; c++) img.data[i + c] = base[c] + (tone[c] - base[c]) * r * 1.8;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }
    requestAnimationFrame(loop);
  })(0);

  /* ---------- 이명 같은 환경음 ---------- */
let ac, gain;
function audio(level) {
  try {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(); gain = ac.createGain();
      o.frequency.value = 5800; gain.gain.value = 0;
      o.connect(gain).connect(ac.destination); o.start();
    }
    gain.gain.cancelScheduledValues(ac.currentTime);
    gain.gain.setTargetAtTime(level, ac.currentTime, 0.15);
  } catch (e) {}
}

// 게임 종료 시 이명 효과음을 정지
function stopAudio() {
  try {
    if (!ac || !gain) return;
    gain.gain.cancelScheduledValues(ac.currentTime);
    gain.gain.setTargetAtTime(0, ac.currentTime, 0.05);
  } catch (e) {}
}

  /* 주인공 이동 위치 (발 기준, 화면 %) — game.png 배치에 맞춤 */
  const POS = { curtain:[61,54], tv:[52,60], kitchen:[33,74], bed:[52,76], door:[47,84] };

  /* [선택지, 심정, 스트레스 가산, 연출, 다음 장면] */
  const S = {
    "1-m": { o: {
      curtain: { c: [["커튼을 열고 아침 햇살을 쬔다","오늘도 힘내자.",0], ["닫은 채로 준비한다","아직 조금 졸리네.",0]] },
      kitchen: { c: [["제대로 아침을 만든다","따뜻한 수프가 맛있다.",0], ["커피만 마시고 넘긴다","시간이 없으니 이걸로 됐어.",0]] },
      door:    { go: "1-w" } } },
    "1-w": { work: 1, q: "선배가 갑자기 자료 작성을 부탁했다.", next: "1-n",
      c: [["웃으며 받아들인다","의지가 된다는 건 기쁜 일이야.",0], ["내 작업이 끝난 뒤에 해도 되는지 묻는다","무리하지는 말자.",0]] },
    "1-n": { o: {
      tv:  { c: [["좋아하는 예능을 본다","많이 웃었다. 내일도 어떻게든 되겠지.",0], ["뉴스를 본다","세상엔 정말 여러 일이 있구나.",0]] },
      bed: { c: [["잔다","잘 자자.",0,"","2-m"]] } } },
    "2-m": { o: {
      tv:   { c: [["아침 운세나 날씨를 본다","오늘은 우산을 챙겨 가야겠다.",0], ["SNS 타임라인을 연다","동기는 벌써 큰 프로젝트를 맡았구나…",1]] },
      door: { go: "2-w" } } },
    "2-w": { work: 1, next: "2-n",
      q: "어제 낸 자료에 대해 상사가 모두 앞에서 질책한다. 「말 안 해도 눈치껏 알아서 해야지」「상식이 없네」. 동료들은 눈을 피하고, 아무도 도와주지 않는다.",
      c: [["「죄송합니다」 하고 고개를 숙이며 내 탓이라 믿는다","내가 무능해서야. 더 완벽하게 해야 해…",3],
          ["납득이 안 가서 지시가 모호했다고 설명하려 한다","(「변명하지 마」 하고 말이 끊겼다) 무슨 말을 해도 소용없어. 여기엔 내 편이 없어.",3]] },
    "2-n": { o: {
      kitchen: { c: [["저녁을 만든다","……왠지, 맛이 잘 느껴지지 않아.",1], ["아무것도 먹지 않고 물만 마신다","속이 쓰려서 목에 넘어가질 않아.",1]] },
      bed:     { c: [["잔다","잠이 잘 오지 않아…",1,"","3-m"]] } } },
    "3-m": { o: {
      curtain: { c: [["커튼을 연다","눈부셔……빛이 아파. 바깥 풍경을 보고 싶지 않아.",2,"flash"], ["닫은 채로 둔다","어두운 쪽이 그나마 숨을 쉴 수 있어.",1]] },
      kitchen: { refuse: 1, t: "몸이 납덩이처럼 무겁다. 주방까지 걸어갈 기력조차 나지 않아.",
                 c: [["뭔가 먹는다"], ["음료를 마신다"]] },
      door:    { c: [["직장에 간다","윽……숨이 안 쉬어져. 거기 가면 또 다들 비웃을 거야. 소리 지를 거야.",2,"shake"],
                     ["조금 쉬었다가 간다","……정신을 차려 보니 벌써 저녁이다.",1,"","3-e"]] } } },
    "3-e": { work: 1,
      q: "스마트폰이 계속 울린다. 『무단결근인가요?』『다들 민폐라고 생각해요』",
      c: [["사과 답장을 쓰려 한다","뭐라고 보내야 하지? 이상한 문장이라 생각하면 어쩌지. 이제 무리야……",3,"garble","4-m"],
          ["스마트폰 전원을 끈다","보고 싶지 않아. 누구의 목소리도 듣고 싶지 않아.",3,"","4-m"]] },
    "4-m": { o: {
      curtain: { t: "바깥이 아침인지 밤인지도, 이제 모르겠어." },
      tv:      { t: "사람 목소리가 무섭다. 누군가 내 욕을 하는 것만 같아.", fx: "noise" },
      kitchen: { t: "배고프다는 감각조차 사라졌다." },
      door:    { t: "저 문 너머는 나를 상처 입히는 세상이야. 한 걸음도 나갈 수 없어.", fx: "dark" },
      bed:     { c: [["이불 속으로 파고든다","……이제, 아무것도 선택할 수 없어. 여기만이 내가 상처받지 않을 수 있는 유일한 곳이야.",0,"end"]] } } }
  };
  const TIME = { m: "아침: 집", w: "낮: 직장", n: "밤: 집", e: "저녁: 집" };

  let key, scene, done = new Set(), stress = 0, busy = false;

  function say(msg) { text.textContent = msg; text.classList.add("show"); }
  function pulse(cls, ms) { stage.classList.add(cls); setTimeout(() => stage.classList.remove(cls), ms); }
  function applyStress() {
    visual.style.setProperty("--sat", Math.max(0.2, 1 - stress * 0.07));
    $(".vignette").style.setProperty("--vig", Math.min(stress * 3.5, 42) + "%");
    const t = Math.min(stress / 12, 1), a = [64,74,40], b = [74,37,71];
    fill.style.width = (12 + t * 80) + "%";
    fill.style.background = "rgb(" + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",") + ")";
    audio(stress >= 4 ? Math.min(0.004 * stress, 0.03) : 0);
  }

  function load(k) {
    key = k; scene = S[k]; done = new Set(); popup.classList.remove("show");
    const [day, t] = k.split("-");
    visual.dataset.time = t === "w" ? "m" : t === "e" ? "n" : t;
    label.textContent = day + "일째　" + TIME[t];
    visual.classList.toggle("work", !!scene.work);
    hero.style.left = "50%"; hero.style.top = "70%";
    objs.forEach(o => { o.className = "obj" + (scene.o && scene.o[o.dataset.obj] ? "" : " hidden"); });
    busy = false;
    if (scene.work) { say(scene.q); showChoices(scene, null); }
    else say(k === "1-m" ? "아침이다. 방 안의 물건을 눌러 행동을 고르자." : "방을 둘러본다.");
  }
  function transit(next) {
    busy = true; popup.classList.remove("show");
    stage.classList.add("fade");
    setTimeout(() => { load(next); stage.classList.remove("fade"); }, 650);
  }

  objs.forEach(btn => btn.addEventListener("click", () => {
    if (busy || !scene.o) return;
    const name = btn.dataset.obj, def = scene.o[name];
    if (!def || (done.has(name) && name !== "bed" && name !== "door")) return;
    busy = true; popup.classList.remove("show");
    hero.style.left = POS[name][0] + "%"; hero.style.top = POS[name][1] + "%";
    setTimeout(() => {
      busy = false;
      if (def.go) return transit(def.go);
      if (def.c) return showChoices(def, name);
      say(def.t); done.add(name); fx(def.fx); checkLast();
    }, 1000);
  }));

  function checkLast() {   /* 4일째: 침대 외에는 모두 반응 없음 → 침대만 남는다 */
    if (key !== "4-m") return;
    if (["curtain","tv","kitchen","door"].every(n => done.has(n))) {
      objs.forEach(o => o.classList.toggle("off", o.dataset.obj !== "bed"));
      objs.find(o => o.dataset.obj === "bed").classList.add("glow");
    }
  }

  function showChoices(def, name) {
    list.innerHTML = "";
    def.c.forEach(ch => {
      const b = document.createElement("button");
      b.className = "choice-btn"; b.type = "button"; b.textContent = ch[0];
      b.onclick = () => choose(ch, def, name);
      list.appendChild(b);
    });
    popup.classList.add("show");
  }
  function choose(ch, def, name) {
    if (def.refuse) {                 /* 선택 거부: 버튼이 떨리며 회색으로 */
      $$(".choice-btn").forEach(b => b.classList.add("refuse"));
      say(def.t); done.add(name);
      setTimeout(() => popup.classList.remove("show"), 1600);
      return;
    }
    popup.classList.remove("show");
    stress += ch[2] || 0; applyStress();
    say(ch[3] === "garble" ? "죄송▒▒니다…ㅈ░ㅅ…　" + ch[1] : ch[1]);
    fx(ch[3]);
    if (name) { done.add(name); objs.find(o => o.dataset.obj === name).classList.add("done"); }
    if (ch[3] === "end") return setTimeout(ending, 3500);
    const next = ch[4] || (scene.work && scene.next);
    if (next) { busy = true; setTimeout(() => transit(next), 3200); }
  }

  function fx(f) {
    if (f === "flash") pulse("flash", 1400);
    else if (f === "shake" || f === "garble") pulse("shake", 900);
    else if (f === "dark") pulse("dark", 1800);
    else if (f === "noise") { noise.style.transition = "opacity .4s"; noise.style.opacity = .55;
      setTimeout(() => { noise.style.opacity = 0; }, 1800); }
  }

  /* 종료: 노이즈가 짙어지며 끝난다 */
  /* 종료: 노이즈가 짙어지며 끝난다 */
function ending() {
  busy = true; popup.classList.remove("show");
  stopAudio(); // 엔딩 연출 시 이명 효과음 정지
  noise.style.transition = "opacity 4s ease"; noise.style.opacity = 1;
  setTimeout(() => root.classList.add("over"), 3000);
}
  $(".scroll-arrow").addEventListener("click", () => {
    const next = root.nextElementSibling;
    if (next) next.scrollIntoView({ behavior: "smooth" });
  });

  /* START: 노이즈가 걷히며 게임 화면이 서서히 나타난다 */
  $(".start-button").addEventListener("click", () => {
    stress = 0; applyStress();
    root.classList.add("started");
    load("1-m");
  });
})();
