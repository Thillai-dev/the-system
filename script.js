
const $ = id => document.getElementById(id);

const STORAGE_KEY = "theSystem_v2";

const today = () => new Date().toLocaleDateString("en-CA");

function initialState() {
  return {
    accepted: false,
    xp: 0,
    streak: 0,
    totalCompleted: 0,
    history: [],
    lastDay: today(),
    lastReminderDate: "",
    runDay: new Date().getDay() === 1 ||
            new Date().getDay() === 3 ||
            new Date().getDay() === 5,
    day: {
      date: today(),
      recovery: null,
      missions: []
    },
    attributes: {
      strength: 0,
      agility: 0,
      vitality: 0,
      discipline: 0
    }
  };
}

function makeMissions() {
  const runDay = new Date().getDay() === 1 ||
                 new Date().getDay() === 3 ||
                 new Date().getDay() === 5;

  return [
    {
      id: "running",
      name: "RUNNING",
      description: runDay
        ? "Running goal: 5 km"
        : "Recovery day: running is optional",
      target: 5,
      progress: 0,
      unit: "km",
      done: false,
      active: runDay
    },
    {
      id: "pushups",
      name: "PUSH-UPS",
      description: "Build strength gradually",
      target: 10,
      progress: 0,
      unit: "reps",
      done: false,
      active: true
    },
    {
      id: "situps",
      name: "SIT-UPS",
      description: "Controlled repetitions",
      target: 10,
      progress: 0,
      unit: "reps",
      done: false,
      active: true
    },
    {
      id: "squats",
      name: "SQUATS",
      description: "Controlled bodyweight squats",
      target: 10,
      progress: 0,
      unit: "reps",
      done: false,
      active: true
    }
  ];
}

function createInitialState() {
  const s = initialState();
  s.day.missions = makeMissions();
  return s;
}

let state;

try {
  state = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (!state || !state.day || !state.day.missions) {
    state = createInitialState();
  }
} catch {
  state = createInitialState();
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function toast(message) {
  const element = $("toast");
  if (!element) return;

  element.textContent = message;
  element.classList.remove("hidden");

  setTimeout(() => element.classList.add("hidden"), 2500);
}

function getLevel() {
  return Math.floor(state.xp / 100) + 1;
}

function awardXP(amount) {
  const oldLevel = getLevel();

  state.xp += amount;

  const newLevel = getLevel();

  if (newLevel > oldLevel) {
    Object.keys(state.attributes).forEach(key => {
      state.attributes[key] += 2;
    });

    toast("LEVEL UP! YOU ARE NOW LEVEL " + newLevel);
  }

  save();
}

function updateTimer() {
  const now = new Date();
  const midnight = new Date(now);

  midnight.setHours(24, 0, 0, 0);

  const seconds = Math.max(
    0,
    Math.floor((midnight - now) / 1000)
  );

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const timer = $("countdown");

  if (timer) {
    timer.textContent =
      String(hours).padStart(2, "0") + ":" +
      String(minutes).padStart(2, "0") + ":" +
      String(remainingSeconds).padStart(2, "0");
  }
}

function checkNewDay() {
  if (state.lastDay === today()) return;

  const completed = state.day.missions.filter(
    m => m.done
  ).length;

  const total = state.day.missions.length;

  state.history.unshift({
    date: state.lastDay,
    completed,
    total,
    xp: state.xp
  });

  state.history = state.history.slice(0, 30);

  if (completed === total) {
    state.streak++;
  } else {
    state.streak = 0;
  }

  state.lastDay = today();

  const previousMissed = completed < total;

  state.day = {
    date: today(),
    missions: makeMissions(),
    recovery: previousMissed
      ? { done: false }
      : null
  };

  save();
  render();
}

function renderMissions() {
  const container = $("missionList");
  if (!container) return;

  container.innerHTML = state.day.missions.map(m => {
    const percentage = Math.min(
      100,
      (m.progress / m.target) * 100
    );

    return `
      <div class="mission">
        <div class="mission-header">
          <strong>${escapeHTML(m.name)}</strong>
          <span>${m.progress} / ${m.target} ${m.unit}</span>
        </div>

        <p class="muted">
          ${escapeHTML(m.description)}
        </p>

        <div class="progress-track">
          <div class="progress-fill"
               style="width:${percentage}%"></div>
        </div>

        ${
          m.done
          ? '<p class="success">QUEST COMPLETED ✓</p>'
          : m.active
            ? `
              <button class="primary full"
                data-add="${m.id}">
                + ADD PROGRESS
              </button>
            `
            : '<p class="muted">Recovery day</p>'
        }
      </div>
    `;
  }).join("");

  container.querySelectorAll("[data-add]").forEach(button => {
    button.onclick = () => addProgress(button.dataset.add);
  });
}

function addProgress(id) {
  const mission = state.day.missions.find(m => m.id === id);

  if (!mission || mission.done || !mission.active) return;

  const amount = id === "running" ? 0.5 : 1;

  mission.progress = Math.min(
    mission.target,
    mission.progress + amount
  );

  if (mission.progress >= mission.target) {
    mission.done = true;
    state.totalCompleted++;

    awardXP(25);
    toast("QUEST COMPLETED! +25 XP");
  }

  save();
  render();
}

function renderAttributes() {
  const container = $("attributes");
  if (!container) return;

  container.innerHTML = Object.entries(state.attributes)
    .map(([name, value]) => `
      <div class="attribute">
        <strong>${escapeHTML(name.toUpperCase())}</strong>
        <span>${value}</span>
      </div>
    `).join("");

  const heading = $("attributeHeading");
  if (heading) heading.textContent = "PLAYER ATTRIBUTES";
}

function renderHistory() {
  const container = $("historyList");
  if (!container) return;

  if (!state.history.length) {
    container.innerHTML =
      '<p class="muted">No previous quests yet.</p>';
    return;
  }

  container.innerHTML = state.history.map(item => `
    <div class="history-item">
      <strong>${escapeHTML(item.date)}</strong><br>
      Completed: ${item.completed} / ${item.total}<br>
      XP earned: ${item.xp}
    </div>
  `).join("");
}

function renderRecovery() {
  const panel = $("recoveryPanel");
  const task = $("recoveryTask");

  if (!panel || !task) return;

  if (state.day.recovery && !state.day.recovery.done) {
    panel.classList.remove("hidden");

    task.innerHTML = `
      <div class="mission">
        <strong>RECOVERY QUEST</strong>
        <p class="muted">
          Take five minutes to plan tomorrow.
          No extra exercise required.
        </p>
        <button class="primary full" id="recoveryComplete">
          MARK COMPLETE
        </button>
      </div>
    `;

    $("recoveryComplete").onclick = () => {
      state.day.recovery.done = true;
      save();
      render();
      toast("RECOVERY QUEST COMPLETED");
    };
  } else {
    panel.classList.add("hidden");
  }
}

function updateNotificationStatus() {
  const element = $("notificationStatus");
  if (!element) return;

  element.textContent =
    !("Notification" in window)
      ? "Notifications unavailable"
      : Notification.permission === "granted"
        ? "Notifications enabled"
        : "Notifications not enabled";
}

function sendNotification(title, message) {
  if (
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    new Notification(title, {
      body: message,
      icon: "./icon-192.png"
    });
  }
}

function checkReminder() {
  if (
    !state.accepted ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) return;

  const incomplete = state.day.missions.some(
    m => m.active && !m.done
  );

  if (
    incomplete &&
    new Date().getHours() >= 18 &&
    state.lastReminderDate !== today()
  ) {
    state.lastReminderDate = today();
    save();

    sendNotification(
      "SYSTEM REMINDER",
      "Check your daily quests. Remember to rest when needed."
    );
  }
}

const notificationButton = $("enableNotifications");

if (notificationButton) {
  notificationButton.onclick = async () => {
    if (!("Notification" in window)) {
      toast("NOTIFICATIONS NOT SUPPORTED");
      return;
    }

    const permission = await Notification.requestPermission();

    updateNotificationStatus();

    if (permission === "granted") {
      toast("NOTIFICATIONS ENABLED");
    }
  };
}

function render() {
  if (!state.accepted) return;

  const level = getLevel();
  const xpInLevel = state.xp % 100;

  if ($("level")) $("level").textContent = "LV. " + level;
  if ($("xpText")) $("xpText").textContent = xpInLevel + " / 100 XP";
  if ($("xpBar")) $("xpBar").style.width = xpInLevel + "%";

  if ($("dashLevel")) $("dashLevel").textContent = level;
  if ($("dashXP")) $("dashXP").textContent = state.xp;
  if ($("streak")) $("streak").textContent = state.streak;
  if ($("completed")) $("completed").textContent = state.totalCompleted;

  if ($("statusLevel")) $("statusLevel").textContent = level;
  if ($("statusXP")) $("statusXP").textContent = state.xp + " XP";

  renderMissions();
  renderAttributes();
  renderHistory();
  renderRecovery();
  updateNotificationStatus();
}

document.querySelectorAll(".nav-btn").forEach(button => {
  button.onclick = () => {
    const page = button.dataset.page;

    document.querySelectorAll(".page").forEach(section => {
      section.classList.add("hidden");
    });

    if ($(page)) $(page).classList.remove("hidden");

    document.querySelectorAll(".nav-btn").forEach(nav => {
      nav.classList.remove("active");
    });

    button.classList.add("active");
  };
});

const acceptButton = $("accept");

if (acceptButton) {
  acceptButton.onclick = () => {
    state.accepted = true;
    save();

    $("welcome").classList.add("hidden");
    $("app").classList.remove("hidden");

    render();
    toast("WELCOME, PLAYER");
  };
}

const resetButton = $("reset");

if (resetButton) {
  resetButton.onclick = () => {
    if (!confirm("Reset all player data?")) return;

    localStorage.removeItem(STORAGE_KEY);
    state = createInitialState();
    save();

    location.reload();
  };
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .catch(error => console.error("SW error:", error));
  });
}

if (state.accepted) {
  $("welcome")?.classList.add("hidden");
  $("app")?.classList.remove("hidden");
  render();
} else {
  $("welcome")?.classList.remove("hidden");
  $("app")?.classList.add("hidden");
}

checkNewDay();
updateTimer();

setInterval(() => {
  updateTimer();
  checkNewDay();
  checkReminder();
}, 1000);

save();
