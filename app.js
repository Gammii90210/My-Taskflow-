let tasks         = [];
let currentFilter = 'all';
const STORAGE_KEY = 'taskflow_v1';


// Storage

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    tasks = saved ? JSON.parse(saved) : [];
  } catch {
    tasks = [];
  }
}


// Utilities

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    month : 'short',
    day   : 'numeric',
    hour  : '2-digit',
    minute: '2-digit'
  });
}


// Create

function addTask() {
  const titleInput    = document.getElementById('task-input');
  const descInput     = document.getElementById('desc-input');
  const priorityInput = document.getElementById('priority-select');
  const title         = titleInput.value.trim();

  if (!title) {
    showToast('Please enter a task title.', 'error');
    titleInput.focus();
    return;
  }

  tasks.unshift({
    id        : generateId(),
    title,
    desc      : descInput.value.trim(),
    priority  : priorityInput.value,
    completed : false,
    createdAt : new Date().toISOString(),
    editedAt  : null
  });

  saveTasks();
  renderTasks();
  updateStats();

  titleInput.value    = '';
  descInput.value     = '';
  priorityInput.value = 'medium';
  titleInput.focus();

  showToast('Task added.', 'success');
}


// Toggle complete

function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  task.completed = !task.completed;
  saveTasks();
  renderTasks();
  updateStats();

  showToast(task.completed ? 'Marked as complete.' : 'Marked as active.', 'info');
}


// Delete

function deleteTask(id) {
  const card = document.querySelector(`[data-id="${id}"]`);

  if (card) {
    card.classList.add('removing');
    setTimeout(() => {
      tasks = tasks.filter(t => t.id !== id);
      saveTasks();
      renderTasks();
      updateStats();
    }, 220);
  }

  showToast('Task deleted.', 'error');
}


// Edit

function startEdit(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const body = document.querySelector(`[data-id="${id}"]`).querySelector('.task-body');

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

  const titleField = document.getElementById(`edit-title-${id}`);
  titleField.focus();
  titleField.select();

  titleField.addEventListener('keydown', e => {
    if (e.key === 'Enter')  saveEdit(id);
    if (e.key === 'Escape') renderTasks();
  });
}

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
  task.editedAt = new Date().toISOString();

  saveTasks();
  renderTasks();
  updateStats();
  showToast('Task updated.', 'success');
}


// Filter

function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderTasks();
}


// Clear completed

function clearCompleted() {
  const count = tasks.filter(t => t.completed).length;
  if (!count) return;

  tasks = tasks.filter(t => !t.completed);
  saveTasks();
  renderTasks();
  updateStats();

  showToast(`${count} completed task${count > 1 ? 's' : ''} removed.`, 'info');
}


// Render

function renderTasks() {
  const list       = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');
  const query      = document.getElementById('search-input').value.toLowerCase().trim();

  let visible = tasks.filter(task => {
    if (currentFilter === 'active'    &&  task.completed) return false;
    if (currentFilter === 'completed' && !task.completed) return false;
    return true;
  });

  if (query) {
    visible = visible.filter(task =>
      task.title.toLowerCase().includes(query) ||
      (task.desc || '').toLowerCase().includes(query)
    );
  }

  list.innerHTML = '';

  if (visible.length === 0) {
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';

    visible.forEach(task => {
      const li = document.createElement('li');
      li.className = `task-card priority-${task.priority}${task.completed ? ' completed' : ''}`;
      li.setAttribute('data-id', task.id);

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
          ${task.desc ? `<p class="task-desc">${escapeHtml(task.desc)}</p>` : ''}
          <div class="task-meta-row">
            <span class="task-date">${formatDate(task.createdAt)}</span>
            ${task.editedAt ? `<span class="task-edited">· edited</span>` : ''}
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

  const activeCount    = tasks.filter(t => !t.completed).length;
  const completedCount = tasks.filter(t =>  t.completed).length;

  document.getElementById('task-count').textContent =
    `${activeCount} item${activeCount !== 1 ? 's' : ''} remaining`;

  document.getElementById('clear-btn').classList.toggle('visible', completedCount > 0);
}


// Stats

function updateStats() {
  const total     = tasks.length;
  const done      = tasks.filter(t => t.completed).length;
  const active    = total - done;
  const percent   = total > 0 ? Math.round((done / total) * 100) : 0;

  document.getElementById('stat-total').textContent  = total;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-done').textContent   = done;

  document.getElementById('progress-bar').style.width  = percent + '%';
  document.getElementById('progress-text').textContent =
    `${done} of ${total} task${total !== 1 ? 's' : ''} done`;
}


// Toast

let toastTimeout;

function showToast(message, type = 'info') {
  const toast     = document.getElementById('toast');
  toast.textContent = message;
  toast.className   = `toast show ${type}`;

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.className = 'toast'; }, 2600);
}


// Event listeners

document.getElementById('task-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});

document.addEventListener('keydown', e => {
  if (e.key === ' ' && e.target.classList.contains('task-checkbox')) {
    e.preventDefault();
    const card = e.target.closest('.task-card');
    if (card) toggleTask(card.dataset.id);
  }
});


// Init

loadTasks();
renderTasks();
updateStats();
