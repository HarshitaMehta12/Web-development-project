// Simple Study Planner + Pomodoro (no APIs). Uses localStorage.
(() => {
  // ====== Helpers ======
  const $ = (s) => document.querySelector(s);
  const qs = (s) => document.querySelectorAll(s);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);

  // ====== Elements ======
  const taskForm = $('#taskForm');
  const titleInput = $('#title');
  const notesInput = $('#notes');
  const durationInput = $('#duration');
  const taskList = $('#taskList');
  const filter = $('#filter');
  const search = $('#search');
  const clearAllBtn = $('#clearAll');

  const timerDisplay = $('#timerDisplay');
  const workInput = $('#workInput');
  const breakInput = $('#breakInput');
  const startBtn = $('#startBtn');
  const pauseBtn = $('#pauseBtn');
  const resetBtn = $('#resetBtn');
  const autoSwitch = $('#autoSwitch');
  const soundToggle = $('#sound');
  const sessionInfo = $('#sessionInfo');

  const totalTasksEl = $('#totalTasks');
  const completedTasksEl = $('#completedTasks');
  const pomodorosDoneEl = $('#pomodorosDone');

  const toggleThemeBtn = $('#toggleTheme');

  // ====== State ======
  let state = {
    tasks: JSON.parse(localStorage.getItem('tasks') || '[]'),
    stats: JSON.parse(localStorage.getItem('stats') || '{"pomodoros":0}'),
    themeDark: localStorage.getItem('themeDark') === '1',
    timer: {
      running: false,
      mode: 'work', // work | break
      remaining: 25*60,
      intervalId: null
    }
  };

  // apply theme
  if(state.themeDark) document.documentElement.classList.add('dark');

  // ====== Persistence ======
  function save() {
    localStorage.setItem('tasks', JSON.stringify(state.tasks));
    localStorage.setItem('stats', JSON.stringify(state.stats));
  }

  // ====== Tasks UI ======
  function renderTasks() {
    const q = search.value.trim().toLowerCase();
    const f = filter.value;
    taskList.innerHTML = '';
    const tasksToShow = state.tasks.filter(t => {
      if(f === 'pending' && t.done) return false;
      if(f === 'done' && !t.done) return false;
      if(q && !(t.title.toLowerCase().includes(q) || (t.notes||'').toLowerCase().includes(q))) return false;
      return true;
    });
    if(tasksToShow.length === 0){
      taskList.innerHTML = '<div class="muted">No tasks yet — add something!</div>';
      updateStats();
      return;
    }
    tasksToShow.forEach(t => {
      const el = document.createElement('div');
      el.className = 'task';
      el.innerHTML = `
        <div style="display:flex;align-items:center;">
          <input type="checkbox" ${t.done ? 'checked' : ''} data-id="${t.id}" class="chk" aria-label="Mark task completed"/>
          <div class="info">
            <h3 ${t.done ? 'style="text-decoration:line-through;color:var(--muted)"' : ''}>${escapeHtml(t.title)}</h3>
            ${t.notes ? `<p>${escapeHtml(t.notes)}</p>` : ''}
            <div class="meta">${t.duration} min · Added ${new Date(t.created).toLocaleString()}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn small edit" data-id="${t.id}">Edit</button>
          <button class="btn ghost small del" data-id="${t.id}">Delete</button>
        </div>
      `;
      taskList.appendChild(el);
    });

    // attach handlers
    qs('.chk').forEach(cb => cb.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      toggleDone(id);
    }));
    qs('.del').forEach(b => b.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      deleteTask(id);
    }));
    qs('.edit').forEach(b => b.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      editTask(id);
    }));
    updateStats();
  }

  function escapeHtml(s = '') {
    return s.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
  }

  function addTask(title, notes, duration){
    state.tasks.unshift({
      id: uid(),
      title, notes, duration: Number(duration), done:false, created: Date.now()
    });
    save();
    renderTasks();
  }

  function deleteTask(id){
    state.tasks = state.tasks.filter(t => t.id !== id);
    save();
    renderTasks();
  }

  function editTask(id){
    const t = state.tasks.find(x => x.id === id);
    if(!t) return;
    titleInput.value = t.title;
    notesInput.value = t.notes || '';
    durationInput.value = t.duration;
    // remove existing duplicate if we intend to update after submit
    deleteTask(id);
  }

  function toggleDone(id){
    const t = state.tasks.find(x => x.id === id);
    if(!t) return;
    t.done = !t.done;
    save();
    renderTasks();
  }

  function clearAll(){
    if(!confirm('Clear all tasks?')) return;
    state.tasks = [];
    save();
    renderTasks();
  }

  // ====== Stats ======
  function updateStats(){
    totalTasksEl.textContent = state.tasks.length;
    completedTasksEl.textContent = state.tasks.filter(t=>t.done).length;
    pomodorosDoneEl.textContent = state.stats.pomodoros || 0;
  }

  // ====== Forms & Controls ======
  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const notes = notesInput.value.trim();
    const duration = durationInput.value || 25;
    if(!title) return;
    addTask(title, notes, duration);
    titleInput.value = '';
    notesInput.value = '';
    durationInput.value = 25;
  });

  clearAllBtn.addEventListener('click', clearAll);
  filter.addEventListener('change', renderTasks);
  search.addEventListener('input', renderTasks);

  // Theme
  toggleThemeBtn.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    state.themeDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('themeDark', state.themeDark ? '1' : '0');
  });

  // ====== Pomodoro Timer ======
  function formatTime(sec){
    const m = Math.floor(sec/60).toString().padStart(2,'0');
    const s = (sec%60).toString().padStart(2,'0');
    return `${m}:${s}`;
  }

  function setTimerForMode(mode){
    state.timer.mode = mode;
    const length = mode === 'work' ? Number(workInput.value || 25) : Number(breakInput.value || 5);
    state.timer.remaining = Math.max(1, length) * 60;
    timerDisplay.textContent = formatTime(state.timer.remaining);
    sessionInfo.textContent = `Session: ${mode === 'work' ? 'Work' : 'Break'}`;
  }

  // initialize
  setTimerForMode('work');

  function tick(){
    if(state.timer.remaining <= 0){
      // finished
      clearInterval(state.timer.intervalId);
      state.timer.running = false;
      state.timer.intervalId = null;
      // count pomodoro if work finished
      if(state.timer.mode === 'work'){
        state.stats.pomodoros = (state.stats.pomodoros || 0) + 1;
        save();
        updateStats();
        if(soundToggle.checked) beep();
      }
      if(autoSwitch.checked){
        const next = state.timer.mode === 'work' ? 'break' : 'work';
        setTimerForMode(next);
        startTimer();
      } else {
        // leave at 0:00 and notify user
        if(soundToggle.checked) beep();
      }
      return;
    }
    state.timer.remaining -= 1;
    timerDisplay.textContent = formatTime(state.timer.remaining);
  }

  function startTimer(){
    if(state.timer.running) return;
    state.timer.running = true;
    state.timer.intervalId = setInterval(tick, 1000);
  }
  function pauseTimer(){
    if(!state.timer.running) return;
    clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
    state.timer.running = false;
  }
  function resetTimer(){
    pauseTimer();
    setTimerForMode('work');
  }

  startBtn.addEventListener('click', () => {
    // if display shows 00:00, reset for current mode first
    if(state.timer.remaining <= 0) setTimerForMode(state.timer.mode);
    startTimer();
  });
  pauseBtn.addEventListener('click', pauseTimer);
  resetBtn.addEventListener('click', resetTimer);

  workInput.addEventListener('change', () => {
    if(state.timer.mode === 'work' && !state.timer.running) setTimerForMode('work');
  });
  breakInput.addEventListener('change', () => {
    if(state.timer.mode === 'break' && !state.timer.running) setTimerForMode('break');
  });

  function beep(){
    // simple beep using WebAudio (no network)
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.01);
      o.start();
      setTimeout(()=> {
        g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.4);
        setTimeout(()=>{ o.stop(); ctx.close(); }, 500);
      }, 300);
    } catch(e){
      // ignore
      console.warn('beep failed', e);
    }
  }

  // ====== Init render ======
  renderTasks();
  updateStats();

  // expose short debug on window (optional)
  window.__planner = { state, render: renderTasks, addTask };

})();
