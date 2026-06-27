(function () {
  const STAGE_DURATIONS = [20000, 15000, 15000, 15000];
  const MAX_WAIT_MS = 10000;

  let manualTimer = null;
  let holdIndex = null;
  let holdUntil = 0;

  function waitForStages() {
    return new Promise(resolve => {
      const started = Date.now();

      function check() {
        const stages = Array.from(document.querySelectorAll("[data-tv-stage]"));
        const dots = Array.from(document.querySelectorAll("[data-tv-stage-dot]"));

        if ((stages.length && dots.length) || Date.now() - started > MAX_WAIT_MS) {
          resolve({ stages, dots });
          return;
        }

        window.setTimeout(check, 150);
      }

      check();
    });
  }

  function currentIndex(stages) {
    return Math.max(0, stages.findIndex(stage => stage.classList.contains("is-active")));
  }

  function applyStage(index) {
    const stages = Array.from(document.querySelectorAll("[data-tv-stage]"));
    const dots = Array.from(document.querySelectorAll("[data-tv-stage-dot]"));

    if (!stages.length || !dots.length) return;

    const nextIndex = Math.max(0, Math.min(index, stages.length - 1));

    stages.forEach((stage, stageIndex) => {
      stage.classList.toggle("is-active", stageIndex === nextIndex);

      if (stageIndex === nextIndex) {
        stage.querySelectorAll(".tv-autoscroll-area").forEach(area => {
          area.scrollTop = 0;
        });
      }
    });

    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === nextIndex);
      dot.setAttribute("aria-current", dotIndex === nextIndex ? "page" : "false");
    });
  }

  function activateStage(index) {
    window.clearTimeout(manualTimer);
    applyStage(index);

    holdIndex = index;
    holdUntil = Date.now() + (STAGE_DURATIONS[index] || 15000);

    manualTimer = window.setTimeout(() => {
      const stages = Array.from(document.querySelectorAll("[data-tv-stage]"));
      const nextIndex = (index + 1) % Math.max(stages.length, 1);

      activateStage(nextIndex);
    }, STAGE_DURATIONS[index] || 15000);
  }

  function decorateDot(dot, index) {
    dot.setAttribute("role", "button");
    dot.setAttribute("tabindex", "0");
    dot.setAttribute("aria-label", `Show ${dot.textContent.trim()} stage`);

    dot.addEventListener("click", () => activateStage(index));
    dot.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;

      event.preventDefault();
      activateStage(index);
    });
  }

  async function initStageControls() {
    const { stages, dots } = await waitForStages();

    if (!stages.length || !dots.length) return;

    dots.forEach(decorateDot);

    window.setInterval(() => {
      if (holdIndex === null || Date.now() >= holdUntil) return;

      const liveStages = Array.from(document.querySelectorAll("[data-tv-stage]"));
      if (currentIndex(liveStages) !== holdIndex) {
        applyStage(holdIndex);
      }
    }, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStageControls);
  } else {
    initStageControls();
  }
}());
