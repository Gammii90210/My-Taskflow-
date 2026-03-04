/* ────────────────────────────────────────
   STATE
──────────────────────────────────────── */
let tasks         = [];          // master task array
let currentFilter = 'all';       // 'all' | 'active' | 'completed'
const STORAGE_KEY = 'taskflow_v1';

/* ────────────────────────────────────────
   LOCAL STORAGE  —  Persist data across sessions
   localStorage stores key-value pairs as strings.
   We JSON.stringify to save, JSON.parse to restore.
──────────────────────────────────────── */
function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    tasks = saved ? JSON.parse(saved) : [];
  } catch (err) {
    // If data is corrupted, start fresh
    tasks = [];
  }
}

/* ────────────────────────────────────────
   UTILITIES
──────────────────────────────────────── */

// Unique ID: combines timestamp + random suffix
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Sanitize user text before injecting into innerHTML
function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Format ISO date string for display
function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', {
    month : 'short',
    day   : 'numeric',
    hour  : '2-digit',
    minute: '2-digit'
  });
}

/* ────────────────────────────────────────
   CREATE  —  Add a new task
   Called by the "Add Task" button and Enter key.
──────────────────────────────────────── */
function addTask() {
  const titleInput    = document.getElementById('task-input');
  const descInput     = document.getElementById('desc-input');
  const priorityInput = document.getElementById('priority-select');

  const title = titleInput.value.trim();

  // Validate: title must not be empty
  if (!title) {
    showToast('Please enter a task title.', 'error');
    titleInput.focus();
    return;
  }

  // Build the task object
  const newTask = {
    id        : generateId(),
    title     : title,
    desc      : descInput.value.trim(),
    priority  : priorityInput.value,     // 'high' | 'medium' | 'low'
    completed : false,
    createdAt : new Date().toISOString(),
    editedAt  : null
  };

  tasks.unshift(newTask);   // Add to top of list
  saveTasks();
  renderTasks();
  updateStats();

  // Reset form
  titleInput.value    = '';
  descInput.value     = '';
  priorityInput.value = 'medium';
  titleInput.focus();

  showToast('Task added.', 'success');
}

/* ────────────────────────────────────────
   COMPLETE  —  Toggle done / not done
   Clicking the checkbox calls this function.
──────────────────────────────────────── */
function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  task.completed = !task.completed;
  saveTasks();
  renderTasks();
  updateStats();

  showToast(
    task.completed ? 'Marked as complete.' : 'Marked as active.',
    'info'
  );
}

/* ────────────────────────────────────────
   DELETE  —  Remove a task
   Plays a slide-out animation before removing from DOM.
──────────────────────────────────────── */
function deleteTask(id) {
  const card = document.querySelector(`[data-id="${id}"]`);

  if (card) {
    card.classList.add('removing');            // trigger CSS animation
    setTimeout(() => {
      tasks = tasks.filter(t => t.id !== id); // remove from array
      saveTasks();
      renderTasks();
      updateStats();
    }, 220);                                   // match animation duration
  }

  showToast('Task deleted.', 'error');
}

/* ────────────────────────────────────────
   EDIT  —  Enter inline edit mode
   Replaces the task body with input fields.
──────────────────────────────────────── */
function startEdit(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const card = document.querySelector(`[data-id="${id}"]`);
  const body = card.querySelector('.task-body');

  // Replace read view with edit fields
  body.innerHTML = `
    <input
      class="edit-title-input"
      id="edit-title-${id}"
      value="${escapeHtml(task.title)}"
      maxlength="120"
      placeholder="Task title"
    />
    <textarea
      class="edit-desc-input"
      id="edit-desc-${id}"
      rows="2"
      placeholder="Description (optional)"
    >${escapeHtml(task.desc || '')}</textarea>
    <div class="edit-row">
      <button class="btn-save"   onclick="saveEdit('${id}')">Save</button>
      <button class="btn-cancel" onclick="renderTasks()">Cancel</button>
    </div>`;

  // Focus + select the title field
  const titleField = document.getElementById(`edit-title-${id}`);
  titleField.focus();
  titleField.select();

  // Keyboard support
  titleField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  saveEdit(id);
    if (e.key === 'Escape') renderTasks();
  });
}

/* ────────────────────────────────────────
   SAVE EDIT  —  Commit the edited values
──────────────────────────────────────── */
function saveEdit(id) {
  const newTitle = document.getElementById(`edit-title-${id}`).value.trim();
  const newDesc  = document.getElementById(`edit-desc-${id}`).value.trim();

  if (!newTitle) {
    showToast('Title cannot be empty.', 'error');
    return;
  }

  const task    = tasks.find(t => t.id === id);
  task.title    = newTitle;
  task.desc     = newDesc;
  task.editedAt = new Date().toISOString();  // record edit timestamp

  saveTasks();
  renderTasks();
  updateStats();
  showToast('Task updated.', 'success');
}

/* ────────────────────────────────────────
   FILTER  —  Show All / Active / Completed
──────────────────────────────────────── */
function setFilter(filter, btn) {
  currentFilter = filter;

  // Update active tab styling
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  renderTasks();
}

/* ────────────────────────────────────────
   CLEAR COMPLETED  —  Bulk remove done tasks
──────────────────────────────────────── */
function clearCompleted() {
  const completedCount = tasks.filter(t => t.completed).length;
  if (!completedCount) return;

  tasks = tasks.filter(t => !t.completed);
  saveTasks();
  renderTasks();
  updateStats();

  showToast(
    `${completedCount} completed task${completedCount > 1 ? 's' : ''} removed.`,
    'info'
  );
}

/* ────────────────────────────────────────
   RENDER  —  Draw the filtered task list
   Runs every time state changes.
──────────────────────────────────────── */
function renderTasks() {
  const list       = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');
  const searchText = document.getElementById('search-input').value.toLowerCase().trim();

  // 1. Apply filter
  let visible = tasks.filter(task => {
    if (currentFilter === 'active'    &&  task.completed) return false;
    if (currentFilter === 'completed' && !task.completed) return false;
    return true;
  });

  // 2. Apply search (title + description)
  if (searchText) {
    visible = visible.filter(task =>
      task.title.toLowerCase().includes(searchText) ||
      (task.desc || '').toLowerCase().includes(searchText)
    );
  }

  // 3. Clear existing DOM
  list.innerHTML = '';

  // 4. Show empty state or render cards
  if (visible.length === 0) {
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';

    visible.forEach(task => {
      const li = document.createElement('li');
      li.className = `task-card priority-${task.priority}${task.completed ? ' completed' : ''}`;
      li.setAttribute('data-id', task.id);

      const createdStr = formatDate(task.createdAt);

      li.innerHTML = `
        <div
          class="task-checkbox${task.completed ? ' checked' : ''}"
          onclick="toggleTask('${task.id}')"
          title="${task.completed ? 'Mark as active' : 'Mark as complete'}"
          role="checkbox"
          aria-checked="${task.completed}"
          tabindex="0"
        ></div>

        <div class="task-body">
          <div class="task-top">
            <span class="task-title">${escapeHtml(task.title)}</span>
            <span class="priority-tag ${task.priority}">${task.priority}</span>
          </div>
          ${task.desc
            ? `<p class="task-desc">${escapeHtml(task.desc)}</p>`
            : ''}
          <div class="task-meta-row">
            <span class="task-date">${createdStr}</span>
            ${task.editedAt
              ? `<span class="task-edited">· edited</span>`
              : ''}
          </div>
        </div>

        <div class="task-actions">
          <button class="action-btn edit" onclick="startEdit('${task.id}')" title="Edit task">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="action-btn delete" onclick="deleteTask('${task.id}')" title="Delete task">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>`;

      list.appendChild(li);
    });
  }

  // 5. Update bottom bar
  const activeCount    = tasks.filter(t => !t.completed).length;
  const completedCount = tasks.filter(t =>  t.completed).length;

  document.getElementById('task-count').textContent =
    `${activeCount} item${activeCount !== 1 ? 's' : ''} remaining`;

  const clearBtn = document.getElementById('clear-btn');
  clearBtn.classList.toggle('visible', completedCount > 0);
}

/* ────────────────────────────────────────
   STATS  —  Update header numbers + progress bar
──────────────────────────────────────── */
function updateStats() {
  const total          = tasks.length;
  const completedCount = tasks.filter(t =>  t.completed).length;
  const activeCount    = total - completedCount;
  const percent        = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  document.getElementById('stat-total').textContent  = total;
  document.getElementById('stat-active').textContent = activeCount;
  document.getElementById('stat-done').textContent   = completedCount;

  document.getElementById('progress-bar').style.width = percent + '%';
  document.getElementById('progress-text').textContent =
    `${completedCount} of ${total} task${total !== 1 ? 's' : ''} done`;
}

/* ────────────────────────────────────────
   TOAST  —  Brief notification popup
──────────────────────────────────────── */
let toastTimeout;

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className   = `toast show ${type}`;

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.className = 'toast';
  }, 2600);
}

/* ────────────────────────────────────────
   EVENT LISTENERS
──────────────────────────────────────── */

// Submit task on Enter key in the title field
document.getElementById('task-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTask();
});

// Keyboard accessibility: spacebar toggles checkbox
document.addEventListener('keydown', (e) => {
  if (e.key === ' ' && e.target.classList.contains('task-checkbox')) {
    e.preventDefault();
    const card = e.target.closest('.task-card');
    if (card) toggleTask(card.dataset.id);
  }
});

/* ────────────────────────────────────────
   INITIALISE  —  Run on page load
──────────────────────────────────────── */
loadTasks();
renderTasks();
updateStats();
