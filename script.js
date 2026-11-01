
const $ = id => document.getElementById(id);
const STORAGE_KEY = "THE_SYSTEM_V3";

function dateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function isRunDay() {
  const day = new Date().getDay();
  return [1, 3, 5].includes(day);
}

function createMissions() {
  return [
    {
      id: "running",
      name: "RUNNING",
      description: "5 kilometre running quest",
      target: 5,
      progress: 0,
      unit: "km",
      active: isRunDay(),
      done: false
    },
    {
      id: "pushups",
      name: "PUSH-UPS",
      description: "Strength quest",
      target: 10,
      progress: 0,
      unit: "reps",
      active: true,
      done: false
    },
    {
      id: "situps",
      name: "SIT-UPS",
      description: "Core quest",
      target: 10,
      progress: 0,
      unit: "reps",
      active: true,
      done: false
    },
    {
      id: "squats",
      name: "SQUATS",
      description: "Strength quest",
      target: 10,
      progress: 0,
      unit: "reps",
      active: true,
      done: false
    }
  ];
}

function newState() {
  return {
    accepted: false,
    xp: 0,
    streak: 0,
    totalCompleted: 0,
    history: [],
    lastDay: dateKey(),
    lastReminderDate: "",
    attributes: {
      strength: 0,
      agility: 0,
      vitality: 0,
      discipline: 0
    },
    day: {
      missions: createMissions(),
      recovery: null
    }
  };
}

let state;

try {
  state = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (!state || !state.day || !Array.isArray(state.day.missions)) {
    state = newState();
  }
} catch {
  state = newState();
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getLevel() {
  return Math.floor(state.xp / 100) + 1;
}

function awardXP(amount) {
  const oldLevel = getLevel();
  state.xp += amount;

  if (getLevel() > oldLevel) {
    Object.keys(state.attributes).forEach(key => {
      state.attributes[key] += 2;
    });
    toast("LEVEL UP!");
  }
}

function toast(message) {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2500);
}

function updateTimer() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);

  let seconds = Math.max(0, Math.floor((midnight-now)/1000));

  const h = String(Math.floor(seconds/3600)).padStart(2,"0");
  const m = String(Math.floor((seconds%3600)/60)).padStart(2,"0");
  const s = String(seconds%60).padStart(2,"0");

  if ($("timer")) $("timer").textContent = `${h}:${m}:${s}`;
}

function renderMissions() {
  const container = $("missions");
  if (!container) return;

  container.innerHTML = state.day.missions.map(m => {
    const percent = Math.min(100, m.progress / m.target * 100);

    return `
      <div class="mission">
        <div class="mission-header">
          <strong>${m.name}</strong>
          <span>${m.progress} / ${m.target} ${m.unit}</span>
        </div>

        <p class="muted">${m.description}</p>

        <div class="progress-track">
          <div class="progress-fill" style="width:${percent}%"></div>
        </div>

        ${m.done
          ? '<p class="success">QUEST COMPLETED ✓</p>'
          : m.active
            ? `<button class="primary full" data-progress="${m.id}">
                 + ADD PROGRESS
               </button>`
            : '<p class="muted">Rest day — quest inactive</p>'
        }
      </div>
    `;
  }).join("");

  container.querySelectorAll("[data-progress]").forEach(button => {
    button.onclick = () => addProgress(button.dataset.progress);
  });

  const active = state.day.missions.filter(m => m.active);
  const completed = active.filter(m => m.done).length;
  const percentage = active.length
    ? Math.round(completed / active.length * 100)
    : 0;

  if ($("progressText")) {
    $("progressText").textContent = percentage + "%";
  }

  if ($("questBar")) {
    $("questBar").style.width = percentage + "%";
  }
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
    .map(([name,value]) => `
      <div class="attribute">
        <strong>${name.toUpperCase()}</strong>
        <span>${value}</span>
      </div>
    `).join("");

  if ($("attributeHeading")) {
    $("attributeHeading").textContent = "PLAYER ATTRIBUTES";
  }
}

function renderHistory() {
  const container = $("historyList");
  if (!container) return;

  if (!state.history.length) {
    container.innerHTML = '<p class="muted">No previous quests yet.</p>';
    return;
  }

  container.innerHTML = state.history.map(item => `
    <div class="history-item">
      <strong>${item.date}</strong><br>
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
        <p class="muted">Take five minutes to plan tomorrow.</p>
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

function updateNotifications() {
  if (!$("notificationStatus")) return;

  $("notificationStatus").textContent =
    !("Notification" in window)
      ? "Notifications unavailable"
      : Notification.permission === "granted"
        ? "Notifications enabled"
        : "Notifications not enabled";
}

$("notifications").onclick = async () => {
  if (!("Notification" in window)) {
    toast("NOTIFICATIONS NOT SUPPORTED");
    return;
  }

  const permission = await Notification.requestPermission();
  updateNotifications();

  if (permission === "granted") {
    toast("NOTIFICATIONS ENABLED");
  }
};

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
    state.lastReminderDate !== dateKey()
  ) {
    state.lastReminderDate = dateKey();
    save();

    new Notification("SYSTEM REMINDER", {
      body: "Check your daily quests. Remember to rest when needed.",
      icon: "./icon-192.png"
    });
  }
}

function checkNewDay() {
  if (state.lastDay === dateKey()) return;

  const active = state.day.missions.filter(m => m.active);
  const completed = active.filter(m => m.done).length;
  const total = active.length;

  state.history.unshift({
    date: state.lastDay,
    completed,
    total,
    xp: state.xp
  });

  state.history = state.history.slice(0,30);

  if (total > 0 && completed === total) {
    state.streak++;
  } else {
    state.streak = 0;
  }

  state.day = {
    missions: createMissions(),
    recovery: completed < total ? {done:false} : null
  };

  state.lastDay = dateKey();
  state.lastReminderDate = "";

  save();
  render();
}

function render() {
  if (!state.accepted) return;

  const level = getLevel();
  const xp = state.xp % 100;

  if ($("level")) $("level").textContent = "LV. " + level;
  if ($("xpText")) $("xpText").textContent = xp + " / 100 XP";
  if ($("xpBar")) $("xpBar").style.width = xp + "%";

  if ($("dashLevel")) $("dashLevel").textContent = level;
  if ($("dashXP")) $("dashXP").textContent = state.xp;
  if ($("streak")) $("streak").textContent = state.streak;
  if ($("completed")) $("completed").textContent = state.totalCompleted;

  if ($("statusLevel")) $("statusLevel").textContent = level;
  if ($("statusXP")) $("statusXP").textContent = state.xp + " XP";

  if ($("freePoints")) $("freePoints").textContent = 0;

  renderMissions();
  renderAttributes();
  renderHistory();
  renderRecovery();
  updateNotifications();
}

// NAVIGATION

document.querySelectorAll(".nav-btn").forEach(button => {
  button.onclick = () => {
    document.querySelectorAll(".page").forEach(page => {
      page.classList.add("hidden");
    });

    const target = $(button.dataset.page);
    if (target) target.classList.remove("hidden");

    document.querySelectorAll(".nav-btn").forEach(nav => {
      nav.classList.remove("active");
    });

    button.classList.add("active");
  };
});

// PLAYER QUALIFICATION

$("accept").onclick = () => {
  state.accepted = true;
  save();

  $("welcome").classList.add("hidden");
  $("app").classList.remove("hidden");

  render();
  toast("WELCOME, PLAYER");
};

$("decline").onclick = () => {
  $("declineMessage").textContent =
    "The system will be waiting for your decision.";
};

// RESET

$("reset").onclick = () => {
  if (!confirm("Reset all player data?")) return;

  localStorage.removeItem(STORAGE_KEY);
  state = newState();
  save();
  location.reload();
};

// INITIALIZATION

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(console.error);
}

if (state.accepted) {
  $("welcome").classList.add("hidden");
  $("app").classList.remove("hidden");
  render();
} else {
  $("welcome").classList.remove("hidden");
  $("app").classList.add("hidden");
}

checkNewDay();
updateTimer();

setInterval(() => {
  updateTimer();
  checkNewDay();
  checkReminder();
}, 1000);

save();
