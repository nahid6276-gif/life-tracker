// ==========================================
// Life & Work Tracker - 24-Hour State Engine
// ==========================================

let categories = [];
let activeContextId = 'shop';
let activeTask = null;
let timerInterval = null;
let todayLogs = [];
let pendingNewTask = null;
let firebaseDb = null;
let isFirebaseConnected = false;
let currentUntrackedGap = null;

// Helpers
function getTodayDateStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatMinutesToReadable(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h} ঘণ্টা ${m} মি`;
  return `${m} মিনিট`;
}

function formatTimestampToTime(ts) {
  const d = new Date(ts);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

// ------------------------------------------
// Initialization
// ------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  // 1. Load Categories
  categories = loadCategories();

  // 2. Set current date in header
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  try {
    document.getElementById('currentDateDisplay').textContent = new Date().toLocaleDateString('bn-BD', options);
    document.getElementById('analyticsDateBadge').textContent = getTodayDateStr();
  } catch(e) {
    document.getElementById('currentDateDisplay').textContent = getTodayDateStr();
  }

  // 3. Init Firebase if config exists
  initFirebaseSync();

  // 4. If not connected to Firebase, load local state
  if (!isFirebaseConnected) {
    loadLocalState();
  }

  // 5. Render UI
  renderContextTabs();
  renderSubtasks();
  renderRecentLogs();
  renderAnalytics();
  renderCategoryManager();
  renderDayTimeline();
  checkUntrackedGap();

  // 6. Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('Service Worker Registered'))
      .catch(err => console.log('SW Registration failed:', err));
  }

  // Periodic gap check every 2 minutes
  setInterval(() => {
    checkUntrackedGap();
    renderDayTimeline();
  }, 120000);
});

// ------------------------------------------
// Firebase Realtime Synchronization
// ------------------------------------------
function parseFirebaseConfigInput(raw) {
  if (!raw) return null;
  raw = raw.trim();
  raw = raw.replace(/<\/?script[^>]*>/gi, '');
  raw = raw.replace(/^(const|let|var)\s+\w+\s*=\s*/i, '');
  raw = raw.replace(/;\s*$/, '');

  let config = null;
  try {
    config = JSON.parse(raw);
  } catch (e) {
    try {
      config = new Function(`return (${raw});`)();
    } catch (err) {
      const apiKeyMatch = raw.match(/apiKey\s*:\s*["']([^"']+)["']/);
      const projectIdMatch = raw.match(/projectId\s*:\s*["']([^"']+)["']/);
      const databaseUrlMatch = raw.match(/databaseURL\s*:\s*["']([^"']+)["']/);
      const authDomainMatch = raw.match(/authDomain\s*:\s*["']([^"']+)["']/);
      const appIdMatch = raw.match(/appId\s*:\s*["']([^"']+)["']/);

      if (apiKeyMatch && projectIdMatch) {
        config = {
          apiKey: apiKeyMatch[1],
          projectId: projectIdMatch[1],
          authDomain: authDomainMatch ? authDomainMatch[1] : undefined,
          appId: appIdMatch ? appIdMatch[1] : undefined,
          databaseURL: databaseUrlMatch ? databaseUrlMatch[1] : undefined
        };
      }
    }
  }

  if (!config || typeof config !== 'object' || !config.apiKey || !config.projectId) {
    throw new Error('অকার্যকর কনফিগ! apiKey এবং projectId পাওয়া যায়নি।');
  }

  if (!config.databaseURL) {
    config.databaseURL = `https://${config.projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`;
  }

  return config;
}

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBbQLsSefqWB_MPijIewJKFOE9qxP_KuSA",
  authDomain: "life-tracker-25bb9.firebaseapp.com",
  databaseURL: "https://life-tracker-25bb9-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "life-tracker-25bb9",
  storageBucket: "life-tracker-25bb9.firebasestorage.app",
  messagingSenderId: "295550010420",
  appId: "1:295550010420:web:d314c5fc0d2d54c1f57661",
  measurementId: "G-FLHYE7TG3D"
};

function initFirebaseSync() {
  let savedConfig = localStorage.getItem('life_tracker_firebase_config');
  let config = null;

  if (savedConfig) {
    try {
      config = JSON.parse(savedConfig);
    } catch (e) {
      config = DEFAULT_FIREBASE_CONFIG;
    }
  } else {
    config = DEFAULT_FIREBASE_CONFIG;
    localStorage.setItem('life_tracker_firebase_config', JSON.stringify(config, null, 2));
  }

  try {
    if (!config.databaseURL || config.databaseURL.includes('life-tracker-25bb9-default-rtdb.firebaseio.com')) {
      config.databaseURL = `https://${config.projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`;
      localStorage.setItem('life_tracker_firebase_config', JSON.stringify(config, null, 2));
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    firebaseDb = firebase.database();
    
    const inputEl = document.getElementById('firebaseConfigInput');
    if (inputEl) {
      inputEl.value = JSON.stringify(config, null, 2);
    }

    // Monitor live connection status
    const connectedRef = firebaseDb.ref('.info/connected');
    connectedRef.on('value', snap => {
      if (snap.val() === true) {
        isFirebaseConnected = true;
        updateSyncBadge(true);
        updateSettingsStatusMsg('✅ ফায়ারবেস ক্লাউডের সাথে সফলভাবে যুক্ত আছে!', 'text-emerald-400');
      } else {
        updateSyncBadge(false, 'সার্ভার ডিসকানেক্টেড');
        updateSettingsStatusMsg('⚠️ ক্লাউড সার্ভারের সাথে সংযোগ বিচ্ছিন্ন হচ্ছে... (ইন্টারনেট চেক করুন)', 'text-amber-400');
      }
    });

    // Sync Active Task Live
    firebaseDb.ref('tracker_state/active_task').on('value', snapshot => {
      const remoteActive = snapshot.val();
      if (remoteActive) {
        activeTask = remoteActive;
        startLocalTimer();
      } else {
        stopLocalTimer();
        activeTask = null;
      }
      updateActiveBanner();
      renderSubtasks();
      renderDayTimeline();
      checkUntrackedGap();
    }, err => handleFirebaseError(err));

    // Sync Today Logs Live
    const todayPath = `tracker_state/logs/${getTodayDateStr()}`;
    firebaseDb.ref(todayPath).on('value', snapshot => {
      const logsObj = snapshot.val();
      if (logsObj) {
        todayLogs = Object.values(logsObj).sort((a, b) => b.startTimestamp - a.startTimestamp);
      } else {
        todayLogs = [];
      }
      localStorage.setItem(`logs_${getTodayDateStr()}`, JSON.stringify(todayLogs));
      renderRecentLogs();
      renderAnalytics();
      renderDayTimeline();
      checkUntrackedGap();
    }, err => handleFirebaseError(err));

    // Sync Categories Live
    firebaseDb.ref('tracker_state/categories').on('value', snapshot => {
      const remoteCategories = snapshot.val();
      if (remoteCategories) {
        let catArray = Array.isArray(remoteCategories) ? remoteCategories : Object.values(remoteCategories);
        catArray = catArray.map(c => {
          if (c.subcategories && !Array.isArray(c.subcategories)) {
            c.subcategories = Object.values(c.subcategories);
          } else if (!c.subcategories) {
            c.subcategories = [];
          }
          return c;
        });

        // Smart merge locally added custom subtasks so they are never lost
        let needsDbSync = false;
        if (categories && categories.length > 0) {
          categories.forEach(lCat => {
            const rCat = catArray.find(r => r.id === lCat.id);
            if (rCat && lCat.subcategories) {
              lCat.subcategories.forEach(lSub => {
                if (!rCat.subcategories.some(rSub => rSub.id === lSub.id || rSub.name === lSub.name)) {
                  rCat.subcategories.push(lSub);
                  needsDbSync = true;
                }
              });
            }
          });
        }

        // Also merge DEFAULT_CATEGORIES into remote categories
        DEFAULT_CATEGORIES.forEach(defCat => {
          const rCat = catArray.find(r => r.id === defCat.id);
          if (rCat && defCat.subcategories) {
            defCat.subcategories.forEach(defSub => {
              const existingSub = rCat.subcategories.find(rSub => rSub.id === defSub.id || rSub.name === defSub.name);
              if (!existingSub) {
                if (defSub.id === 'mutation_app') {
                  const oldMut = rCat.subcategories.find(s => s.id === 'mutation_app' || s.name === 'মিউটেশন আবেদন');
                  if (oldMut) {
                    oldMut.name = defSub.name;
                    needsDbSync = true;
                    return;
                  }
                }
                rCat.subcategories.push(defSub);
                needsDbSync = true;
              } else if (defSub.id === 'mutation_app' && existingSub.name !== defSub.name) {
                existingSub.name = defSub.name;
                needsDbSync = true;
              }
            });
          }
        });

        categories = catArray;
        saveCategories(categories);
        if (needsDbSync && firebaseDb) {
          firebaseDb.ref('tracker_state/categories').set(categories);
        }
        renderContextTabs();
        renderSubtasks();
        renderCategoryManager();
      } else {
        if (categories && categories.length > 0) {
          firebaseDb.ref('tracker_state/categories').set(categories);
        }
      }
    }, err => handleFirebaseError(err));

  } catch (err) {
    console.error('Firebase connection error:', err);
    updateSyncBadge(false, 'কনফিগ ত্রুটি');
    updateSettingsStatusMsg('❌ ফায়ারবেস ত্রুটি: ' + err.message, 'text-rose-400');
  }
}

function handleFirebaseError(err) {
  console.error('Firebase DB Error:', err);
  if (err && err.message && err.message.toLowerCase().includes('permission_denied')) {
    updateSyncBadge(false, 'পারমিশন সমস্যা');
    updateSettingsStatusMsg('❌ পারমিশন সমস্যা! Firebase Console-এ Realtime Database > Rules-এ গিয়ে ".read": true এবং ".write": true করে Publish দিন।', 'text-rose-400');
  }
}

function updateSettingsStatusMsg(msg, colorClass) {
  const el = document.getElementById('firebaseStatusFeedback');
  if (el) {
    el.textContent = msg;
    el.className = `p-2 mt-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-medium ${colorClass}`;
    el.classList.remove('hidden');
  }
}

function updateSyncBadge(connected, customText) {
  const dot = document.getElementById('syncIndicatorDot');
  const text = document.getElementById('syncStatusText');
  if (!dot || !text) return;
  if (connected) {
    dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
    text.textContent = 'রিয়েল-টাইম সিঙ্ক';
    text.className = 'text-emerald-400 font-semibold';
  } else {
    dot.className = 'w-2 h-2 rounded-full bg-amber-400';
    text.textContent = customText || 'লোকাল মোড';
    text.className = 'text-slate-300';
  }
}

function saveFirebaseConfig() {
  const raw = document.getElementById('firebaseConfigInput').value.trim();
  if (!raw) {
    alert('অনুগ্রহ করে ফায়ারবেস কনফিগ কোড পেস্ট করুন।');
    return;
  }
  try {
    const config = parseFirebaseConfigInput(raw);
    localStorage.setItem('life_tracker_firebase_config', JSON.stringify(config, null, 2));
    alert('কনফিগ সফলভাবে সেভ হয়েছে! অ্যাপ রিলোড হচ্ছে...');
    window.location.reload();
  } catch (e) {
    alert('কনফিগ ত্রুটি: ' + e.message + '\nঅনুগ্রহ করে ফায়ারবেসের কোডটি ঠিকমতো কপি করে পেস্ট করুন।');
  }
}

function disconnectFirebase() {
  if (confirm('আপনি কি ক্লাউড সিঙ্ক রিসেট করে লোকাল মোডে ফিরতে চান?')) {
    localStorage.removeItem('life_tracker_firebase_config');
    window.location.reload();
  }
}

// ------------------------------------------
// Local Storage State
// ------------------------------------------
function loadLocalState() {
  const savedActive = localStorage.getItem('active_task');
  if (savedActive) {
    try {
      activeTask = JSON.parse(savedActive);
      startLocalTimer();
    } catch(e) {}
  }
  const savedLogs = localStorage.getItem(`logs_${getTodayDateStr()}`);
  if (savedLogs) {
    try {
      todayLogs = JSON.parse(savedLogs);
    } catch(e) {}
  }
}

function persistActiveTask() {
  if (activeTask) {
    localStorage.setItem('active_task', JSON.stringify(activeTask));
  } else {
    localStorage.removeItem('active_task');
  }
  if (firebaseDb) {
    firebaseDb.ref('tracker_state/active_task').set(activeTask);
  }
}

function persistLogs() {
  localStorage.setItem(`logs_${getTodayDateStr()}`, JSON.stringify(todayLogs));
  if (firebaseDb) {
    const todayPath = `tracker_state/logs/${getTodayDateStr()}`;
    firebaseDb.ref(todayPath).set(todayLogs);
  }
}

function persistCategories() {
  saveCategories(categories);
  if (firebaseDb) {
    firebaseDb.ref('tracker_state/categories').set(categories);
  }
}

// ------------------------------------------
// Timer Engine
// ------------------------------------------
function startLocalTimer() {
  stopLocalTimer();
  tickTimer();
  timerInterval = setInterval(tickTimer, 1000);
}

function stopLocalTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function tickTimer() {
  if (!activeTask) return;
  const elapsedSecs = Math.floor((Date.now() - activeTask.startTimestamp) / 1000);
  const display = document.getElementById('activeTimerDisplay');
  if (display) {
    display.textContent = formatDuration(elapsedSecs);
  }
  // Update browser document title
  document.title = `(${formatDuration(elapsedSecs)}) ${activeTask.taskName} - লাইফ ট্র্যাকার`;
}

// ------------------------------------------
// Task Selection & One-Tap Switching
// ------------------------------------------
function handleTaskClick(categoryId, subtaskId) {
  const cat = categories.find(c => c.id === categoryId);
  if (!cat) return;
  const sub = cat.subcategories.find(s => s.id === subtaskId);
  if (!sub) return;

  // 1. If clicking the exact running task -> open finish modal
  if (activeTask && activeTask.categoryId === categoryId && activeTask.subtaskId === subtaskId) {
    promptStopActiveTask();
    return;
  }

  // 2. If another task is already running -> One-Tap Auto Switch!
  if (activeTask) {
    pendingNewTask = {
      categoryId,
      subtaskId,
      taskName: sub.name,
      icon: sub.icon || '📌',
      type: sub.type || 'routine',
      startTimestamp: Date.now()
    };
    promptStopActiveTask();
    return;
  }

  // 3. No task is running -> start immediately!
  startTaskNow(categoryId, subtaskId, sub.name, sub.icon, sub.type);
}

function startTaskNow(categoryId, subtaskId, taskName, icon, type) {
  activeTask = {
    categoryId,
    subtaskId,
    taskName,
    icon: icon || '📌',
    type: type || 'routine',
    startTimestamp: Date.now()
  };

  persistActiveTask();
  startLocalTimer();
  updateActiveBanner();
  renderSubtasks();
  renderDayTimeline();
  checkUntrackedGap();

  if ('vibrate' in navigator) navigator.vibrate(50);
}

function promptStopActiveTask() {
  if (!activeTask) return;
  const elapsedMinutes = Math.max(1, Math.round((Date.now() - activeTask.startTimestamp) / 60000));
  
  document.getElementById('modalFinishedTaskTitle').textContent = `${activeTask.icon} ${activeTask.taskName}`;
  document.getElementById('modalFinishedDuration').textContent = `সময়: ${formatMinutesToReadable(elapsedMinutes)}`;
  document.getElementById('modalIncomeInput').value = '';
  document.getElementById('modalNoteInput').value = '';

  document.getElementById('taskCompleteModal').classList.remove('hidden');
}

function saveFinishedTask(withDetails) {
  if (!activeTask) {
    document.getElementById('taskCompleteModal').classList.add('hidden');
    return;
  }

  const endTimestamp = Date.now();
  const elapsedMinutes = Math.max(1, Math.round((endTimestamp - activeTask.startTimestamp) / 60000));
  
  let income = 0;
  let note = '';

  if (withDetails) {
    const rawIncome = document.getElementById('modalIncomeInput').value;
    income = rawIncome ? parseFloat(rawIncome) || 0 : 0;
    note = document.getElementById('modalNoteInput').value.trim();
  }

  const newLog = {
    id: 'log_' + Date.now(),
    categoryId: activeTask.categoryId,
    subtaskId: activeTask.subtaskId,
    taskName: activeTask.taskName,
    icon: activeTask.icon,
    type: activeTask.type,
    startTimestamp: activeTask.startTimestamp,
    endTimestamp: endTimestamp,
    durationMinutes: elapsedMinutes,
    income: income,
    note: note
  };

  todayLogs.unshift(newLog);
  todayLogs.sort((a, b) => b.startTimestamp - a.startTimestamp);
  persistLogs();

  // Clear active task
  activeTask = null;
  persistActiveTask();
  stopLocalTimer();
  updateActiveBanner();
  renderSubtasks();
  renderRecentLogs();
  renderAnalytics();
  renderDayTimeline();
  checkUntrackedGap();

  document.getElementById('taskCompleteModal').classList.add('hidden');
  document.title = 'Life & Work Tracker (24 Hours)';

  // If there was a pending switch
  if (pendingNewTask) {
    const next = pendingNewTask;
    pendingNewTask = null;
    startTaskNow(next.categoryId, next.subtaskId, next.taskName, next.icon, next.type);
  }
}

// ------------------------------------------
// ✂️ TIME SPLIT ENGINE (সময় ভাগ করা)
// ------------------------------------------
function promptSplitActiveTask() {
  if (!activeTask) return;
  const totalMins = Math.max(2, Math.round((Date.now() - activeTask.startTimestamp) / 60000));
  
  document.getElementById('splitTotalDurationLabel').textContent = formatMinutesToReadable(totalMins);
  document.getElementById('splitPart1Name').textContent = `১ম কাজ: ${activeTask.icon} ${activeTask.taskName}`;
  
  // Default Part 1 to 20 mins or half
  const defaultPart1 = totalMins > 20 ? 20 : Math.max(1, Math.floor(totalMins / 2));
  document.getElementById('splitPart1Minutes').value = defaultPart1;
  document.getElementById('splitPart1Minutes').max = totalMins - 1;

  // Populate Part 2 category select
  const catSelect = document.getElementById('splitPart2CategorySelect');
  catSelect.innerHTML = categories.map(c => `
    <option value="${c.id}">${c.icon} ${c.name}</option>
  `).join('');
  
  if (activeTask.categoryId === 'namaz') {
    catSelect.value = 'food';
  } else {
    catSelect.value = categories[0].id;
  }

  updateSplitSubtaskOptions();
  recalculateSplitRemainder();
  document.getElementById('splitTaskModal').classList.remove('hidden');
}

function updateSplitSubtaskOptions() {
  const catId = document.getElementById('splitPart2CategorySelect').value;
  const cat = categories.find(c => c.id === catId);
  const subSelect = document.getElementById('splitPart2SubtaskSelect');
  if (cat && cat.subcategories) {
    subSelect.innerHTML = cat.subcategories.map(s => `
      <option value="${s.id}">${s.icon || '📌'} ${s.name}</option>
    `).join('');
  }
}

function recalculateSplitRemainder() {
  if (!activeTask) return;
  const totalMins = Math.max(2, Math.round((Date.now() - activeTask.startTimestamp) / 60000));
  let part1 = parseInt(document.getElementById('splitPart1Minutes').value) || 1;
  if (part1 >= totalMins) {
    part1 = totalMins - 1;
    document.getElementById('splitPart1Minutes').value = part1;
  }
  const part2 = totalMins - part1;
  document.getElementById('splitPart2MinutesLabel').textContent = `${part2} মিনিট`;
}

function closeSplitModal() {
  document.getElementById('splitTaskModal').classList.add('hidden');
}

function confirmSplitTask() {
  if (!activeTask) return;
  const totalMins = Math.max(2, Math.round((Date.now() - activeTask.startTimestamp) / 60000));
  let part1Mins = parseInt(document.getElementById('splitPart1Minutes').value) || 1;
  if (part1Mins >= totalMins) part1Mins = totalMins - 1;
  const part2Mins = totalMins - part1Mins;

  const part2CatId = document.getElementById('splitPart2CategorySelect').value;
  const part2SubId = document.getElementById('splitPart2SubtaskSelect').value;
  const part2Cat = categories.find(c => c.id === part2CatId);
  const part2Sub = part2Cat ? part2Cat.subcategories.find(s => s.id === part2SubId) : null;

  const part1Start = activeTask.startTimestamp;
  const part1End = part1Start + (part1Mins * 60000);
  const part2Start = part1End;
  const part2End = part1Start + (totalMins * 60000);

  // Log 1: Original Task Part
  const log1 = {
    id: 'log_' + Date.now() + '_1',
    categoryId: activeTask.categoryId,
    subtaskId: activeTask.subtaskId,
    taskName: activeTask.taskName,
    icon: activeTask.icon,
    type: activeTask.type,
    startTimestamp: part1Start,
    endTimestamp: part1End,
    durationMinutes: part1Mins,
    income: 0,
    note: 'স্প্লিট করা কাজ'
  };

  // Log 2: Split Remainder Task
  const log2 = {
    id: 'log_' + Date.now() + '_2',
    categoryId: part2CatId,
    subtaskId: part2SubId,
    taskName: part2Sub ? part2Sub.name : 'অন্যান্য কাজ',
    icon: part2Sub ? part2Sub.icon : '📌',
    type: part2Sub ? part2Sub.type : 'routine',
    startTimestamp: part2Start,
    endTimestamp: part2End,
    durationMinutes: part2Mins,
    income: 0,
    note: 'স্প্লিট করা কাজ'
  };

  todayLogs.unshift(log2);
  todayLogs.unshift(log1);
  todayLogs.sort((a, b) => b.startTimestamp - a.startTimestamp);
  persistLogs();

  // Reset active task
  activeTask = null;
  persistActiveTask();
  stopLocalTimer();
  updateActiveBanner();
  renderSubtasks();
  renderRecentLogs();
  renderAnalytics();
  renderDayTimeline();
  checkUntrackedGap();
  closeSplitModal();
  document.title = 'Life & Work Tracker (24 Hours)';
}

// ------------------------------------------
// ✏️ EDIT & DELETE PAST LOGS (লগ এডিটর)
// ------------------------------------------
function openEditLogModal(logId) {
  const log = todayLogs.find(l => l.id === logId);
  if (!log) return;

  document.getElementById('editLogId').value = log.id;
  document.getElementById('editLogTaskName').value = log.taskName;
  
  const startD = new Date(log.startTimestamp);
  const endD = new Date(log.endTimestamp);
  
  const startHH = String(startD.getHours()).padStart(2, '0');
  const startMM = String(startD.getMinutes()).padStart(2, '0');
  const endHH = String(endD.getHours()).padStart(2, '0');
  const endMM = String(endD.getMinutes()).padStart(2, '0');

  document.getElementById('editLogStartTime').value = `${startHH}:${startMM}`;
  document.getElementById('editLogEndTime').value = `${endHH}:${endMM}`;
  document.getElementById('editLogIncome').value = log.income || '';
  document.getElementById('editLogNote').value = log.note || '';

  document.getElementById('editLogModal').classList.remove('hidden');
}

function closeEditLogModal() {
  document.getElementById('editLogModal').classList.add('hidden');
}

function confirmSaveEditedLog() {
  const logId = document.getElementById('editLogId').value;
  const log = todayLogs.find(l => l.id === logId);
  if (!log) return;

  const newTaskName = document.getElementById('editLogTaskName').value.trim();
  const startTimeVal = document.getElementById('editLogStartTime').value;
  const endTimeVal = document.getElementById('editLogEndTime').value;
  const newIncome = parseFloat(document.getElementById('editLogIncome').value) || 0;
  const newNote = document.getElementById('editLogNote').value.trim();

  if (!newTaskName) {
    alert('কাজের নাম দিন');
    return;
  }

  if (startTimeVal && endTimeVal) {
    const [sH, sM] = startTimeVal.split(':').map(Number);
    const [eH, eM] = endTimeVal.split(':').map(Number);
    
    const startD = new Date(log.startTimestamp);
    startD.setHours(sH, sM, 0, 0);

    const endD = new Date(log.endTimestamp);
    endD.setHours(eH, eM, 0, 0);

    let diffMins = Math.round((endD.getTime() - startD.getTime()) / 60000);
    if (diffMins < 1) diffMins = 1;

    log.taskName = newTaskName;
    log.startTimestamp = startD.getTime();
    log.endTimestamp = endD.getTime();
    log.durationMinutes = diffMins;
    log.income = newIncome;
    log.note = newNote;
  }

  todayLogs.sort((a, b) => b.startTimestamp - a.startTimestamp);
  persistLogs();
  renderRecentLogs();
  renderAnalytics();
  renderDayTimeline();
  checkUntrackedGap();
  closeEditLogModal();
}

function confirmDeleteLog() {
  const logId = document.getElementById('editLogId').value;
  if (!confirm('আপনি কি এই কাজের রেকর্ডটি মুছে ফেলতে চান?')) return;

  todayLogs = todayLogs.filter(l => l.id !== logId);
  persistLogs();
  renderRecentLogs();
  renderAnalytics();
  renderDayTimeline();
  checkUntrackedGap();
  closeEditLogModal();
}

// ------------------------------------------
// ➕ MANUAL PAST LOG (পেছনের মিসিং কাজ এন্ট্রি)
// ------------------------------------------
function openManualLogModal(defaultStartTs, defaultEndTs) {
  const catSelect = document.getElementById('manualLogCatSelect');
  catSelect.innerHTML = categories.map(c => `
    <option value="${c.id}">${c.icon} ${c.name}</option>
  `).join('');

  catSelect.value = activeContextId || categories[0].id;
  updateManualSubtaskOptions();

  const now = new Date();
  let startD = new Date(now.getTime() - 30 * 60000);
  let endD = now;

  if (defaultStartTs && defaultEndTs) {
    startD = new Date(defaultStartTs);
    endD = new Date(defaultEndTs);
  }

  const sH = String(startD.getHours()).padStart(2, '0');
  const sM = String(startD.getMinutes()).padStart(2, '0');
  const eH = String(endD.getHours()).padStart(2, '0');
  const eM = String(endD.getMinutes()).padStart(2, '0');

  document.getElementById('manualLogStartTime').value = `${sH}:${sM}`;
  document.getElementById('manualLogEndTime').value = `${eH}:${eM}`;
  document.getElementById('manualLogIncome').value = '';
  document.getElementById('manualLogNote').value = '';

  document.getElementById('manualLogModal').classList.remove('hidden');
}

function closeManualLogModal() {
  document.getElementById('manualLogModal').classList.add('hidden');
}

function updateManualSubtaskOptions() {
  const catId = document.getElementById('manualLogCatSelect').value;
  const cat = categories.find(c => c.id === catId);
  const subSelect = document.getElementById('manualLogSubtaskSelect');
  if (cat && cat.subcategories) {
    subSelect.innerHTML = cat.subcategories.map(s => `
      <option value="${s.id}">${s.icon || '📌'} ${s.name}</option>
    `).join('');
  }
}

function confirmSaveManualLog() {
  const catId = document.getElementById('manualLogCatSelect').value;
  const subId = document.getElementById('manualLogSubtaskSelect').value;
  const cat = categories.find(c => c.id === catId);
  const sub = cat ? cat.subcategories.find(s => s.id === subId) : null;

  const startTimeVal = document.getElementById('manualLogStartTime').value;
  const endTimeVal = document.getElementById('manualLogEndTime').value;
  const income = parseFloat(document.getElementById('manualLogIncome').value) || 0;
  const note = document.getElementById('manualLogNote').value.trim();

  if (!startTimeVal || !endTimeVal) {
    alert('শুরু ও শেষের সময় দিন');
    return;
  }

  const [sH, sM] = startTimeVal.split(':').map(Number);
  const [eH, eM] = endTimeVal.split(':').map(Number);

  const startD = new Date();
  startD.setHours(sH, sM, 0, 0);

  const endD = new Date();
  endD.setHours(eH, eM, 0, 0);

  let diffMins = Math.round((endD.getTime() - startD.getTime()) / 60000);
  if (diffMins < 1) {
    alert('শেষের সময় অবশ্যই শুরুর সময়ের চেয়ে বেশি হতে হবে।');
    return;
  }

  const newLog = {
    id: 'log_' + Date.now(),
    categoryId: catId,
    subtaskId: subId,
    taskName: sub ? sub.name : 'কাস্টম কাজ',
    icon: sub ? sub.icon : '📌',
    type: sub ? sub.type : 'routine',
    startTimestamp: startD.getTime(),
    endTimestamp: endD.getTime(),
    durationMinutes: diffMins,
    income: income,
    note: note
  };

  todayLogs.unshift(newLog);
  todayLogs.sort((a, b) => b.startTimestamp - a.startTimestamp);
  persistLogs();
  renderRecentLogs();
  renderAnalytics();
  renderDayTimeline();
  dismissGapAlert();
  closeManualLogModal();
}

// ------------------------------------------
// 🕒 24-HOUR TIMELINE & UNTRACKED GAP ENGINE
// ------------------------------------------
function renderDayTimeline() {
  const bar = document.getElementById('dayTimelineBar');
  const summary = document.getElementById('dayTimelineSummary');
  if (!bar) return;

  const now = new Date();
  const currentMinutesToday = now.getHours() * 60 + now.getMinutes();
  const totalDayMinutes = 1440; // 24 * 60

  let trackedMinutes = todayLogs.reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
  if (activeTask) {
    const activeElapsedMins = Math.max(1, Math.round((Date.now() - activeTask.startTimestamp) / 60000));
    trackedMinutes += activeElapsedMins;
  }

  const remainingMins = Math.max(0, 1440 - trackedMinutes);
  if (summary) {
    summary.textContent = `ট্র্যাকড: ${formatMinutesToReadable(trackedMinutes)} | ফাঁকা: ${formatMinutesToReadable(remainingMins)}`;
  }

  if (todayLogs.length === 0 && !activeTask) {
    bar.innerHTML = '<div class="w-full h-full bg-slate-900 flex items-center justify-center text-[9px] text-slate-500">দিন শুরু...</div>';
    return;
  }

  const sortedLogs = [...todayLogs].sort((a, b) => a.startTimestamp - b.startTimestamp);

  let segmentsHtml = '';
  let lastEndMinute = 0;

  sortedLogs.forEach(log => {
    const startD = new Date(log.startTimestamp);
    const endD = new Date(log.endTimestamp);
    const startMin = Math.max(0, Math.min(1440, startD.getHours() * 60 + startD.getMinutes()));
    const endMin = Math.max(startMin, Math.min(1440, endD.getHours() * 60 + endD.getMinutes()));

    if (startMin > lastEndMinute) {
      const gapMins = startMin - lastEndMinute;
      const gapPct = (gapMins / totalDayMinutes) * 100;
      if (gapPct > 0.4) {
        segmentsHtml += `<div style="width: ${gapPct}%" class="h-full bg-slate-900" title="ফাঁকা: ${gapMins} মি"></div>`;
      }
    }

    const logMins = Math.max(1, endMin - startMin);
    const logPct = (logMins / totalDayMinutes) * 100;
    const cat = categories.find(c => c.id === log.categoryId);
    const col = cat ? cat.color : '#3b82f6';
    segmentsHtml += `<div style="width: ${logPct}%; background-color: ${col};" class="h-full hover:opacity-80 transition" title="${log.taskName} (${logMins} মি)"></div>`;
    lastEndMinute = endMin;
  });

  if (activeTask) {
    const startD = new Date(activeTask.startTimestamp);
    const startMin = Math.max(0, Math.min(1440, startD.getHours() * 60 + startD.getMinutes()));
    const endMin = Math.max(startMin, Math.min(1440, currentMinutesToday));
    if (startMin > lastEndMinute) {
      const gapMins = startMin - lastEndMinute;
      const gapPct = (gapMins / totalDayMinutes) * 100;
      if (gapPct > 0.4) {
        segmentsHtml += `<div style="width: ${gapPct}%" class="h-full bg-slate-900" title="ফাঁকা: ${gapMins} মি"></div>`;
      }
    }
    const activeMins = Math.max(1, endMin - startMin);
    const activePct = (activeMins / totalDayMinutes) * 100;
    segmentsHtml += `<div style="width: ${activePct}%;" class="h-full bg-emerald-400 animate-pulse" title="চলমান: ${activeTask.taskName}"></div>`;
    lastEndMinute = endMin;
  }

  if (lastEndMinute < 1440) {
    const remainingDayPct = ((1440 - lastEndMinute) / totalDayMinutes) * 100;
    segmentsHtml += `<div style="width: ${remainingDayPct}%" class="h-full bg-slate-950/80"></div>`;
  }

  bar.innerHTML = segmentsHtml;
}

function checkUntrackedGap() {
  const card = document.getElementById('gapAlertCard');
  if (!card) return;

  if (activeTask) {
    card.classList.add('hidden');
    currentUntrackedGap = null;
    return;
  }

  let gapStartTs = null;
  const nowTs = Date.now();

  if (todayLogs.length > 0) {
    const latestLog = todayLogs.reduce((latest, l) => l.endTimestamp > latest.endTimestamp ? l : latest, todayLogs[0]);
    gapStartTs = latestLog.endTimestamp;
  } else {
    const startOfDay = new Date();
    startOfDay.setHours(6, 0, 0, 0);
    if (nowTs > startOfDay.getTime()) {
      gapStartTs = startOfDay.getTime();
    }
  }

  if (!gapStartTs) {
    card.classList.add('hidden');
    return;
  }

  const gapMinutes = Math.floor((nowTs - gapStartTs) / 60000);

  if (gapMinutes >= 15 && gapMinutes <= 720) {
    currentUntrackedGap = { startTs: gapStartTs, endTs: nowTs, minutes: gapMinutes };
    document.getElementById('gapAlertTitle').textContent = `ফাঁকা সময়: ${formatTimestampToTime(gapStartTs)} - ${formatTimestampToTime(nowTs)} (${formatMinutesToReadable(gapMinutes)})`;
    
    const chipsContainer = document.getElementById('gapQuickChips');
    chipsContainer.innerHTML = `
      <button onclick="quickFillGap('food', 'lunch', 'খাবার-দাবার', '🍛')" class="px-2.5 py-1 bg-slate-900 border border-slate-700 hover:border-orange-500 text-slate-200 rounded-lg text-xs flex items-center space-x-1">
        <span>🍛</span><span>খাবার</span>
      </button>
      <button onclick="quickFillGap('parenting', 'playing_child', 'বাচ্চার সাথে সময়', '👶')" class="px-2.5 py-1 bg-slate-900 border border-slate-700 hover:border-pink-500 text-slate-200 rounded-lg text-xs flex items-center space-x-1">
        <span>👶</span><span>বাচ্চা</span>
      </button>
      <button onclick="quickFillGap('sleep', 'power_nap', 'ঘুম ও বিশ্রাম', '😴')" class="px-2.5 py-1 bg-slate-900 border border-slate-700 hover:border-indigo-500 text-slate-200 rounded-lg text-xs flex items-center space-x-1">
        <span>😴</span><span>ঘুম/বিশ্রাম</span>
      </button>
      <button onclick="quickFillGap('screen', 'fb_social', 'মোবাইল স্ক্রলিং', '📱')" class="px-2.5 py-1 bg-slate-900 border border-slate-700 hover:border-purple-500 text-slate-200 rounded-lg text-xs flex items-center space-x-1">
        <span>📱</span><span>মোবাইল</span>
      </button>
      <button onclick="openManualLogModal(${gapStartTs}, ${nowTs})" class="px-2 py-1 bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700/50 rounded-lg text-xs">
        + কাস্টম
      </button>
    `;
    card.classList.remove('hidden');
  } else {
    card.classList.add('hidden');
    currentUntrackedGap = null;
  }
}

function dismissGapAlert() {
  const card = document.getElementById('gapAlertCard');
  if (card) card.classList.add('hidden');
}

function quickFillGap(categoryId, subtaskId, taskName, icon) {
  if (!currentUntrackedGap) return;
  const newLog = {
    id: 'log_' + Date.now(),
    categoryId: categoryId,
    subtaskId: subtaskId,
    taskName: taskName,
    icon: icon,
    type: 'routine',
    startTimestamp: currentUntrackedGap.startTs,
    endTimestamp: currentUntrackedGap.endTs,
    durationMinutes: currentUntrackedGap.minutes,
    income: 0,
    note: 'ফাঁকা সময় পূরণ'
  };

  todayLogs.unshift(newLog);
  todayLogs.sort((a, b) => b.startTimestamp - a.startTimestamp);
  persistLogs();
  dismissGapAlert();
  renderRecentLogs();
  renderAnalytics();
  renderDayTimeline();
}

// ------------------------------------------
// UI Rendering Engines
// ------------------------------------------
function updateActiveBanner() {
  const banner = document.getElementById('activeTaskBanner');
  if (!banner) return;

  if (!activeTask) {
    banner.classList.add('hidden');
    return;
  }

  banner.classList.remove('hidden');
  document.getElementById('activeTaskName').textContent = activeTask.taskName;
  const cat = categories.find(c => c.id === activeTask.categoryId);
  document.getElementById('activeContextBadge').textContent = cat ? cat.name : 'চলমান';
}

function renderContextTabs() {
  const container = document.getElementById('contextTabsContainer');
  if (!container) return;

  container.innerHTML = categories.map(cat => {
    const isActive = cat.id === activeContextId;
    return `
      <button onclick="selectContext('${cat.id}')" class="py-2.5 px-1 rounded-xl text-xs font-semibold flex flex-col items-center justify-center space-y-1 transition text-center ${
        isActive 
          ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400/40' 
          : 'bg-slate-950/70 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
      }">
        <span class="text-base leading-none">${cat.icon}</span>
        <span class="text-[11px] leading-tight truncate w-full">${cat.name}</span>
      </button>
    `;
  }).join('');
}

function selectContext(catId) {
  activeContextId = catId;
  renderContextTabs();
  renderSubtasks();
}

function renderSubtasks() {
  const currentCat = categories.find(c => c.id === activeContextId);
  if (!currentCat) return;

  document.getElementById('activeContextTitle').textContent = `${currentCat.name}-এর কাজসমূহ`;

  const grid = document.getElementById('subtasksGrid');
  if (!grid) return;

  const cardsHtml = currentCat.subcategories.map(sub => {
    const isRunning = activeTask && activeTask.categoryId === currentCat.id && activeTask.subtaskId === sub.id;
    
    let typeBadge = '';
    if (sub.type === 'deep_work') {
      typeBadge = '<span class="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">ডিপ</span>';
    } else if (sub.type === 'communication') {
      typeBadge = '<span class="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-medium">কাস্টমার</span>';
    } else if (sub.type === 'rest') {
      typeBadge = '<span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">বিশ্রাম</span>';
    } else if (sub.type === 'prayer') {
      typeBadge = '<span class="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 font-medium">ওয়াক্ত</span>';
    } else if (sub.type === 'parenting') {
      typeBadge = '<span class="text-[9px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 font-medium">সন্তান</span>';
    } else if (sub.type === 'screentime') {
      typeBadge = '<span class="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">স্ক্রিন</span>';
    }

    return `
      <div onclick="handleTaskClick('${currentCat.id}', '${sub.id}')" class="task-card cursor-pointer p-3 rounded-xl border transition flex flex-col justify-between min-h-[95px] ${
        isRunning 
          ? 'bg-blue-950/80 border-emerald-400 ring-2 ring-emerald-400/40 shadow-lg shadow-emerald-950/40' 
          : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
      }">
        <div class="flex items-start justify-between">
          <span class="text-2xl">${sub.icon || '📌'}</span>
          ${isRunning ? '<span class="w-2.5 h-2.5 rounded-full bg-emerald-400 pulse-indicator"></span>' : typeBadge}
        </div>
        <div>
          <h4 class="text-xs font-semibold text-slate-100 line-clamp-2 leading-snug mt-2">${sub.name}</h4>
          ${isRunning ? '<p class="text-[10px] text-emerald-400 font-mono font-bold mt-1">● চলমান...</p>' : ''}
        </div>
      </div>
    `;
  }).join('');

  grid.innerHTML = cardsHtml;
}

function renderRecentLogs() {
  const container = document.getElementById('recentLogsContainer');
  if (!container) return;

  if (todayLogs.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-500 italic p-3 text-center bg-slate-900/50 rounded-xl border border-slate-800/40">আজকে এখনো কোনো কাজ সম্পন্ন হয়নি।</p>';
    return;
  }

  const recents = todayLogs.slice(0, 4);
  container.innerHTML = recents.map(log => `
    <div class="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs hover:border-slate-700 transition">
      <div class="flex items-center space-x-2.5 min-w-0">
        <span class="text-base">${log.icon || '📌'}</span>
        <div class="truncate">
          <p class="font-semibold text-slate-200 truncate">${log.taskName}</p>
          <p class="text-[10px] text-slate-400 font-mono">
            ${formatTimestampToTime(log.startTimestamp)} - ${formatTimestampToTime(log.endTimestamp)} • 
            <span class="text-emerald-400 font-semibold">${formatMinutesToReadable(log.durationMinutes)}</span>
          </p>
        </div>
      </div>
      <div class="flex items-center space-x-2 flex-shrink-0">
        ${log.income > 0 ? `<span class="text-emerald-400 font-bold font-mono text-xs">৳${log.income}</span>` : ''}
        <button onclick="openEditLogModal('${log.id}')" title="এডিট করুন" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition">
          ✏️
        </button>
      </div>
    </div>
  `).join('');
}

function renderAnalytics() {
  const totalMins = todayLogs.reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
  const totalInc = todayLogs.reduce((acc, l) => acc + (l.income || 0), 0);
  const deepWorkMins = todayLogs.filter(l => l.type === 'deep_work').reduce((acc, l) => acc + (l.durationMinutes || 0), 0);

  const timeEl = document.getElementById('totalTrackedTime');
  const incEl = document.getElementById('totalIncome');
  const deepEl = document.getElementById('deepWorkRatio');
  const incCountEl = document.getElementById('incomeEntriesCount');

  if (timeEl) timeEl.textContent = formatMinutesToReadable(totalMins);
  if (incEl) incEl.textContent = `৳ ${totalInc.toLocaleString()}`;
  if (deepEl) {
    const pct = totalMins > 0 ? Math.round((deepWorkMins / totalMins) * 100) : 0;
    deepEl.textContent = `ডিপ ওয়ার্ক: ${pct}% (${formatMinutesToReadable(deepWorkMins)})`;
  }
  if (incCountEl) {
    const incEntries = todayLogs.filter(l => l.income > 0).length;
    incCountEl.textContent = `${incEntries} টি ইনকাম এন্ট্রি`;
  }

  // Category breakdown
  const breakdownList = document.getElementById('categoryBreakdownList');
  if (breakdownList) {
    const catMap = {};
    todayLogs.forEach(l => {
      catMap[l.categoryId] = (catMap[l.categoryId] || 0) + l.durationMinutes;
    });

    if (Object.keys(catMap).length === 0) {
      breakdownList.innerHTML = '<p class="text-xs text-slate-500 italic">কোনো রেকর্ড নেই</p>';
    } else {
      breakdownList.innerHTML = Object.entries(catMap).map(([cId, mins]) => {
        const cat = categories.find(c => c.id === cId);
        const name = cat ? cat.name : cId;
        const icon = cat ? cat.icon : '📌';
        const col = cat ? cat.color : '#3b82f6';
        const pct = totalMins > 0 ? Math.round((mins / totalMins) * 100) : 0;

        return `
          <div>
            <div class="flex justify-between text-xs mb-1">
              <span class="text-slate-300 font-medium">${icon} ${name}</span>
              <span class="text-slate-400 font-mono">${formatMinutesToReadable(mins)} (${pct}%)</span>
            </div>
            <div class="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500" style="width: ${pct}%; background-color: ${col}"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Full Timeline List
  const fullList = document.getElementById('fullTimelineList');
  if (fullList) {
    if (todayLogs.length === 0) {
      fullList.innerHTML = '<p class="text-xs text-slate-500 italic py-2 text-center">আজকে এখনো কোনো কাজের রেকর্ড নেই।</p>';
    } else {
      fullList.innerHTML = todayLogs.map(log => `
        <div class="py-2.5 flex items-center justify-between text-xs">
          <div class="flex items-center space-x-2.5 min-w-0">
            <span class="text-lg">${log.icon || '📌'}</span>
            <div class="truncate">
              <p class="font-semibold text-white truncate">${log.taskName}</p>
              <p class="text-[10px] text-slate-400 font-mono">
                ${formatTimestampToTime(log.startTimestamp)} - ${formatTimestampToTime(log.endTimestamp)} • 
                <span class="text-emerald-400 font-semibold">${formatMinutesToReadable(log.durationMinutes)}</span>
                ${log.note ? ` • <span class="italic text-slate-400 font-sans">"${log.note}"</span>` : ''}
              </p>
            </div>
          </div>
          <div class="flex items-center space-x-2 flex-shrink-0">
            ${log.income > 0 ? `<span class="text-emerald-400 font-mono font-bold">৳${log.income}</span>` : ''}
            <button onclick="openEditLogModal('${log.id}')" title="এডিট করুন" class="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition">
              ✏️
            </button>
          </div>
        </div>
      `).join('');
    }
  }
}

// ------------------------------------------
// Category Manager (Settings View)
// ------------------------------------------
function renderCategoryManager() {
  const container = document.getElementById('categoryManagerList');
  if (!container) return;

  container.innerHTML = categories.map(cat => `
    <div class="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
      <div class="flex items-center justify-between font-semibold text-slate-200">
        <span class="flex items-center space-x-1.5">
          <span>${cat.icon}</span>
          <span>${cat.name}</span>
        </span>
        <span class="text-[10px] text-slate-500 font-mono">${cat.subcategories.length} টি কাজ</span>
      </div>
      <div class="flex flex-wrap gap-1.5">
        ${cat.subcategories.map(sub => `
          <span class="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 flex items-center space-x-1">
            <span>${sub.icon || '📌'}</span>
            <span>${sub.name}</span>
            <button onclick="deleteSubtask('${cat.id}', '${sub.id}')" class="text-slate-500 hover:text-rose-400 ml-1 text-xs">&times;</button>
          </span>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function openAddSubtaskModal() {
  document.getElementById('newSubtaskName').value = '';
  document.getElementById('newSubtaskIcon').value = '📌';
  document.getElementById('addSubtaskModal').classList.remove('hidden');
}

function closeAddSubtaskModal() {
  document.getElementById('addSubtaskModal').classList.add('hidden');
}

function confirmAddSubtask() {
  const name = document.getElementById('newSubtaskName').value.trim();
  const icon = document.getElementById('newSubtaskIcon').value.trim() || '📌';
  const type = document.getElementById('newSubtaskType').value;

  if (!name) {
    alert('কাজের নাম লিখুন');
    return;
  }

  const cat = categories.find(c => c.id === activeContextId);
  if (!cat) return;

  const newSubId = 'sub_' + Date.now();
  cat.subcategories.push({
    id: newSubId,
    name: name,
    icon: icon,
    type: type
  });

  persistCategories();
  renderSubtasks();
  renderCategoryManager();
  closeAddSubtaskModal();
}

function deleteSubtask(catId, subId) {
  const cat = categories.find(c => c.id === catId);
  if (!cat) return;
  if (confirm('এই কাজের ধরনটি মুছে ফেলতে চান?')) {
    cat.subcategories = cat.subcategories.filter(s => s.id !== subId);
    persistCategories();
    renderSubtasks();
    renderCategoryManager();
  }
}

function resetCategoriesToDefault() {
  if (confirm('ক্যাটাগরিগুলোকে আগের ডিফল্ট অবস্থায় ফিরিয়ে নিতে চান?')) {
    localStorage.removeItem('life_tracker_categories');
    categories = loadCategories();
    persistCategories();
    renderContextTabs();
    renderSubtasks();
    renderCategoryManager();
  }
}

// ------------------------------------------
// Tab Navigation
// ------------------------------------------
function switchTab(tabId) {
  const views = ['trackerView', 'analyticsView', 'settingsView'];
  const tabs = ['navTabTracker', 'navTabAnalytics', 'navTabSettings'];

  views.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.add('hidden');
  });

  tabs.forEach(t => {
    const el = document.getElementById(t);
    if (el) {
      el.classList.remove('text-blue-400', 'font-semibold');
      el.classList.add('text-slate-400');
    }
  });

  if (tabId === 'tracker') {
    document.getElementById('trackerView').classList.remove('hidden');
    document.getElementById('navTabTracker').classList.add('text-blue-400', 'font-semibold');
    document.getElementById('navTabTracker').classList.remove('text-slate-400');
    renderRecentLogs();
    renderDayTimeline();
    checkUntrackedGap();
  } else if (tabId === 'analytics') {
    document.getElementById('analyticsView').classList.remove('hidden');
    document.getElementById('navTabAnalytics').classList.add('text-blue-400', 'font-semibold');
    document.getElementById('navTabAnalytics').classList.remove('text-slate-400');
    renderAnalytics();
  } else if (tabId === 'settings') {
    document.getElementById('settingsView').classList.remove('hidden');
    document.getElementById('navTabSettings').classList.add('text-blue-400', 'font-semibold');
    document.getElementById('navTabSettings').classList.remove('text-slate-400');
    renderCategoryManager();
  }
}

// CSV Export
function exportTodayLogsCSV() {
  if (todayLogs.length === 0) {
    alert('আজকের কোনো লগ নেই!');
    return;
  }

  let csv = 'Task Name,Category,Start Time,End Time,Duration (Mins),Income (BDT),Note\n';
  todayLogs.forEach(l => {
    const sTime = formatTimestampToTime(l.startTimestamp);
    const eTime = formatTimestampToTime(l.endTimestamp);
    csv += `"${l.taskName}","${l.categoryId}","${sTime}","${eTime}",${l.durationMinutes},${l.income || 0},"${l.note || ''}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Life_Tracker_Logs_${getTodayDateStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
