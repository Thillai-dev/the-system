
"use strict";

const STORAGE_KEY = "theSystemPlayer_v2";

const $ = id => document.getElementById(id);

function getToday() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}

function makeId() {
  return window.crypto?.randomUUID?.() ||
    "mission-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

const DEFAULT_MISSIONS = [
  { name: "Study", target: 25, unit: "minutes", step: 5, xp: 25 },
  { name: "Walking", target: 10, unit: "minutes", step: 1, xp: 20 },
  { name: "Stretching", target: 5, unit: "minutes", step: 1, xp: 15 },
  { name: "Reading", target: 10, unit: "minutes", step: 1, xp: 20 },
  { name: "Take a water break", target: 3, unit: "breaks", step: 1, xp: 15 }
];

const ATTRIBUTE_NAMES = [
  "Strength", "Intelligence", "Agility", "Vitality"
];

function makeMission(data) {
  return {
    id: makeId(),
    name: data.name,
    target: data.target,
    unit: data.unit,
    step: data.step || 1,
    xp: data.xp || 15,
    progress: 0,
    done: false
  };
}

function makeNewDay(custom = [], recovery = false) {
  return {
    date: getToday(),
    missions: [...DEFAULT_MISSIONS, ...custom].map(makeMission),
    recovery: recovery
      ? { name: "Plan tomorrow", done: false, xp: 5 }
      : null
  };
}

function createInitialState() {
  return {
    accepted: false,
    xp: 0,
    streak: 0,
    totalCompleted: 0,
    freePoints: 0,
    lastLevel: 1,

    attributes: {
      Strength: 1,
      Intelligence: 1,
      Agility: 1,
      Vitality: 1
    },

    customMissions: [],
    day: makeNewDay(),
    history: [],
    lastReminderDate: ""
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (
      saved &&
      saved.day &&
      Array.isArray(saved.day.missions) &&
      saved.attributes &&
      saved.history
    ) {
      return {
        ...createInitialState(),
        ...saved,
        attributes: {
          ...createInitialState().attributes,
          ...saved.attributes
        }
      };
    }
  } catch (error) {
    console.warn("Could not load player data:", error);
  }

  return createInitialState();
}

let state = loadState();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    toast("Unable to save data on this device.");
  }
}

function getLevel() {
  return Math.floor(state.xp / 100) + 1;
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

// TOAST MESSAGES

let toastTimeout;

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    el.classList.remove("show");
  }, 2500);
}

// NOTIFICATIONS

let serviceWorkerRegistration = null;

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("./sw.js")
    .then(registration => {
      serviceWorkerRegistration = registration;
      console.log("System service worker registered.");
    })
    .catch(error => {
      console.warn("Service worker error:", error);
    });
}

function sendNotification(title, message) {
  if (
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) return;

  if (serviceWorkerRegistration) {
    serviceWorkerRegistration.showNotification(title, {
      body: message,
      icon: "./icon.svg",
      badge: "./icon.svg",
      tag: title
    });
  } else if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then(reg => reg.showNotification(title, {
        body: message,
        icon: "./icon.svg",
        badge: "./icon.svg",
        tag: title
      }))
      .catch(() => {});
  }
}

$("notifications").onclick = async () => {
  if (!("Notification" in window)) {
    toast("Notifications are not supported by this browser.");
    return;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      $("notificationStatus").textContent =
        "Notifications enabled.";

      sendNotification(
        "SYSTEM ACTIVATED",
        "You are now receiving system notifications."
      );

      toast("NOTIFICATIONS ENABLED");
    } else {
      $("notificationStatus").textContent =
        "Permission was not granted. Check browser settings.";
    }
  } catch (error) {
    toast("Could not enable notifications.");
  }
};

function updateNotificationStatus() {
  if (!("Notification" in window)) {
    $("notificationStatus").textContent =
      "This browser does not support notifications.";
  } else if (Notification.permission === "granted") {
    $("notificationStatus").textContent =
      "Notifications enabled.";
  } else {
    $("notificationStatus").textContent =
      "Notifications are not enabled.";
  }
}

// PLAYER QUALIFICATION

function enterSystem() {
  state.accepted = true;
  save();

  $("welcome").classList.add("hidden");
  $("app").classList.remove("hidden");

  render();
  toast("PLAYER REGISTRATION COMPLETE");

  sendNotification(
    "SYSTEM ACTIVATED",
    "Welcome, Player."
  );
}

$("accept").onclick = enterSystem;

$("decline").onclick = () => {
  $("declineMessage").textContent =
    "THE INVITATION REMAINS OPEN. YOUR DESTINY AWAITS.";
};

if (state.accepted) {
  $("welcome").classList.add("hidden");
  $("app").classList.remove("hidden");
} else {
  $("welcome").classList.remove("hidden");
  $("app").classList.add("hidden");
}

// DAILY COUNTDOWN

function updateTimer() {
  const now = new Date();
  const midnight = new Date(now);

  midnight.setHours(24, 0, 0, 0);

  let seconds = Math.max(
    0,
    Math.floor((midnight - now) / 1000)
  );

  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;

  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  $("timer").textContent = [
    hours,
    minutes,
    seconds
  ].map(number => String(number).padStart(2, "0")).join(":");
}

// DAILY QUEST RESET

function checkNewDay() {
  if (state.day.date === getToday()) return;

  const oldDay = state.day;
  const completed = oldDay.missions.filter(m => m.done).length;
  const total = oldDay.missions.length;
  const allDone = total > 0 && completed === total;

  state.history.unshift({
    date: oldDay.date,
    completed,
    total,
    xp: oldDay.missions
      .filter(m => m.done)
      .reduce((sum, m) => sum + m.xp, 0)
  });

  state.history = state.history.slice(0, 60);

  state.streak = allDone ? state.streak + 1 : 0;

  state.day = makeNewDay(
    state.customMissions,
    !allDone
  );

  state.lastReminderDate = "";

  save();

  if (!allDone) {
    sendNotification(
      "SYSTEM ALERT",
      "Your new daily quests are ready. A recovery mission is available."
    );
  } else {
    sendNotification(
      "DAILY QUEST",
      "Your new daily quests are ready."
    );
  }

  render();
}

// XP AND LEVELS

function awardXP(amount) {
  const previousLevel = getLevel();

  state.xp += amount;

  const newLevel = getLevel();

  if (newLevel > previousLevel) {
    const gainedLevels = newLevel - previousLevel;

    state.freePoints += gainedLevels * 2;

    toast("LEVEL UP! ATTRIBUTE POINTS EARNED.");

    sendNotification(
      "LEVEL UP",
      "Congratulations! You reached level " + newLevel + "."
    );
  } else {
    toast("QUEST COMPLETE! +" + amount + " XP");
  }
}

// MISSION PROGRESS

function updateMission(id) {
  const mission = state.day.missions.find(m => m.id === id);

  if (!mission || mission.done) return;

  mission.progress = Math.min(
    mission.target,
    mission.progress + mission.step
  );

  if (mission.progress >= mission.target) {
    mission.done = true;
    state.totalCompleted++;
    awardXP(mission.xp);

    sendNotification(
      "QUEST COMPLETE",
      mission.name + " completed successfully."
    );
  }

  save();
  render();
}

function completeRecovery() {
  if (!state.day.recovery || state.day.recovery.done) return;

  state.day.recovery.done = true;
  state.totalCompleted++;

  awardXP(state.day.recovery.xp);

  save();
  render();

  toast("RECOVERY MISSION COMPLETE");
}

// CUSTOM MISSIONS

$("addMission").onclick = () => {
  const name = prompt("Enter your mission name:");

  if (!name || !name.trim()) return;

  const target = Number(
    prompt("Enter the target number:", "10")
  );

  if (
    !Number.isInteger(target) ||
    target < 1 ||
    target > 1000
  ) {
    toast("Enter a target between 1 and 1000.");
    return;
  }

  const unit = prompt(
    "Enter the unit (minutes, pages, tasks, etc.):",
    "tasks"
  );

  if (!unit || !unit.trim()) return;

  const missionData = {
    name: name.trim(),
    target,
    unit: unit.trim(),
    step: 1,
    xp: 15
  };

  state.customMissions.push(missionData);
  state.day.missions.push(makeMission(missionData));

  save();
  render();

  toast("CUSTOM MISSION ADDED");
};

// PLAYER ATTRIBUTES

function allocateAttribute(name) {
  if (state.freePoints <= 0) {
    toast("NO ATTRIBUTE POINTS AVAILABLE");
    return;
  }

  state.attributes[name]++;
  state.freePoints--;

  save();
  render();

  toast(name.toUpperCase() + " INCREASED");
}

// RENDER MISSIONS

function renderMissions() {
  const container = $("missions");

  container.innerHTML = state.day.missions.map(m => `
    <div class="mission ${m.done ? "done" : ""}">
      <div class="mission-title">
        <span>${escapeHTML(m.name)}</span>
        <span class="reward">+${m.xp} XP</span>
      </div>

      <div class="mission-controls">
        <span class="counter">
          ${m.progress} / ${m.target} ${escapeHTML(m.unit)}
        </span>

        <div>
          <button class="secondary"
            data-add="${m.id}"
            ${m.done ? "disabled" : ""}>
            +${m.step}
          </button>

          <button class="primary"
            data-complete="${m.id}"
            ${m.done ? "disabled" : ""}>
            ${m.done ? "DONE ✓" : "COMPLETE"}
          </button>
        </div>
      </div>
    </div>
  `).join("");

  container.querySelectorAll("[data-add]").forEach(button => {
    button.onclick = () => updateMission(button.dataset.add);
  });

  container.querySelectorAll("[data-complete]").forEach(button => {
    button.onclick = () => {
      const mission = state.day.missions.find(
        m => m.id === button.dataset.complete
      );

      if (!mission || mission.done) return;

      if (mission.progress < mission.target) {
        toast("REACH THE TARGET BEFORE COMPLETING.");
        return;
      }

      updateMission(mission.id);
    };
  });

  const total = state.day.missions.length;
  const done = state.day.missions.filter(m => m.done).length;
  const percentage = total
    ? Math.round(done / total * 100)
    : 0;

  $("progressText").textContent = percentage + "%";
  $("questBar").style.width = percentage + "%";
}

// PLAYER STATUS

function renderAttributes() {
  $("freePoints").textContent = state.freePoints;

  $("attributes").innerHTML = ATTRIBUTE_NAMES.map(name => `
    <div class="attribute">
      <span>${name.toUpperCase()}</span>
      <strong>${state.attributes[name]}</strong>
      <button class="secondary"
        data-stat="${name}"
        ${state.freePoints <= 0 ? "disabled" : ""}>
        +
      </button>
    </div>
  `).join("");

  $("attributes").querySelectorAll("[data-stat]").forEach(button => {
    button.onclick = () => allocateAttribute(button.dataset.stat);
  });

  $("attributeHeading").textContent =
    "PLAYER ATTRIBUTES";
}

// QUEST HISTORY

function renderHistory() {
  const container = $("historyList");

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

// RECOVERY MISSION

function renderRecovery() {
  const panel = $("recoveryPanel");
  const task = $("recoveryTask");

  if (state.day.recovery && !state.day.recovery.done) {
    panel.classList.remove("hidden");

    task.innerHTML = `
      <div class="mission">
        <strong>PLAN TOMORROW</strong>
        <p class="muted">
          Take five minutes to plan your next day.
          This is optional.
        </p>
        <button class="primary full" id="recoveryComplete">
          MARK COMPLETE
        </button>
      </div>
    `;

    $("recoveryComplete").onclick = completeRecovery;
  } else {
    panel.classList.add("hidden");
  }
}

// MAIN RENDER

function render() {
  if (!state.accepted) return;

  const currentLevel = getLevel();
  const xpInLevel = state.xp % 100;

  $("level").textContent = "LV. " + currentLevel;
  $("xpText").textContent = xpInLevel + " / 100 XP";
  $("xpBar").style.width = xpInLevel + "%";

  $("dashLevel").textContent = currentLevel;
  $("dashXP").textContent = state.xp;
  $("streak").textContent = state.streak;
  $("completed").textContent = state.totalCompleted;

  $("statusLevel").textContent = currentLevel;
  $("statusXP").textContent = state.xp + " XP";

  renderMissions();
  renderAttributes();
  renderHistory();
  renderRecovery();
  updateNotificationStatus();
}

// NAVIGATION

document.querySelectorAll(".nav-btn").forEach(button => {
  button.onclick = () => {
    const page = button.dataset.page;

    document.querySelectorAll(".page").forEach(section => {
      section.classList.add("hidden");
    });

    $(page).classList.remove("hidden");

    document.querySelectorAll(".nav-btn").forEach(nav => {
      nav.classList.remove("active");
    });

    button.classList.add("active");
  };
});

// REMINDERS WHILE THE APP IS OPEN

function checkReminder() {
  if (
    !state.accepted ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) return;

  const incomplete = state.day.missions.some(m => !m.done);

  if (!incomplete) return;

  const currentHour = new Date().getHours();

  if (
    currentHour >= 18 &&
    state.lastReminderDate !== getToday()
  ) {
    state.lastReminderDate = getToday();
    save();

    sendNotification(
      "SYSTEM REMINDER",
      "You still have daily quests remaining. Take care of yourself."
    );
  }
}

// RESET PLAYER DATA

$("reset").onclick = () => {
  const confirmed = confirm(
    "Reset all player data on this device?"
  );

  if (!confirmed) return;

  localStorage.removeItem(STORAGE_KEY);

  state = createInitialState();
  save();

  $("welcome").classList.remove("hidden");
  $("app").classList.add("hidden");

  toast("PLAYER DATA RESET");
};

// INITIALIZATION

checkNewDay();
updateTimer();

if (state.accepted) {
  $("welcome").classList.add("hidden");
  $("app").classList.remove("hidden");
  render();
}

setInterval(() => {
  updateTimer();
  checkNewDay();
  checkReminder();
}, 1000);

save();
