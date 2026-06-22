const REPO_OWNER = 'vitaarchitecture';
const REPO_NAME = 'vita-client-portal';
const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents`;

let adminMode = false;

function getToken() {
  return localStorage.getItem('gh_token');
}

function setToken(token) {
  localStorage.setItem('gh_token', token);
}

function clearToken() {
  localStorage.removeItem('gh_token');
}

function toggleAdmin() {
  if (adminMode) {
    adminMode = false;
    document.body.classList.remove('admin-mode');
    renderAll();
    return;
  }

  let token = getToken();
  if (!token) {
    showTokenModal();
    return;
  }

  adminMode = true;
  document.body.classList.add('admin-mode');
  renderAll();
}

function showTokenModal() {
  const modal = document.getElementById('token-modal');
  modal.classList.add('visible');
  document.getElementById('token-input').value = '';
  document.getElementById('token-input').focus();
}

function hideTokenModal() {
  document.getElementById('token-modal').classList.remove('visible');
}

function submitToken() {
  const token = document.getElementById('token-input').value.trim();
  if (!token) return;
  setToken(token);
  hideTokenModal();
  adminMode = true;
  document.body.classList.add('admin-mode');
  renderAll();
}

function renderAll() {
  renderOverview();
  renderDrawings();
  renderInvoices();
  renderDeliverables();
  renderActions();
}

// --- GitHub API ---
async function getFileSHA(path) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/${path}`, {
    headers: { 'Authorization': `token ${token}` }
  });
  if (!res.ok) throw new Error(`Failed to get SHA for ${path}`);
  const data = await res.json();
  return data.sha;
}

async function saveFile(path, content, message) {
  const token = getToken();
  const sha = await getFileSHA(path);
  const res = await fetch(`${API_BASE}/${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: message,
      content: btoa(unescape(encodeURIComponent(content))),
      sha: sha
    })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Save failed');
  }
  return true;
}

function arrayToCSV(headers, rows) {
  const lines = [headers.join(',')];
  rows.forEach(row => {
    lines.push(headers.map(h => (row[h] || '')).join(','));
  });
  return lines.join('\n') + '\n';
}

// --- Editable table rendering ---
function editableInput(value, className) {
  if (!adminMode) return value || '—';
  return `<input type="text" class="edit-input ${className || ''}" value="${(value || '').replace(/"/g, '&quot;')}">`;
}

function editableSelect(value, options, className) {
  if (!adminMode) return badge(value);
  return `<select class="edit-select ${className || ''}">
    ${options.map(o => `<option value="${o}" ${o === value ? 'selected' : ''}>${o.replace('_', ' ')}</option>`).join('')}
  </select>`;
}

function editableDateInput(value) {
  if (!adminMode) return value;
  return `<input type="text" class="edit-input edit-date" value="${(value || '').replace(/"/g, '&quot;')}" placeholder="DD/MM/YYYY">`;
}

// --- Save handlers ---
async function saveInvoices() {
  const btn = document.querySelector('#invoices .save-btn');
  btn.textContent = 'Saving...';
  btn.disabled = true;

  try {
    const rows = [];
    document.querySelectorAll('#invoices .edit-row').forEach(tr => {
      const inputs = tr.querySelectorAll('.edit-input, .edit-select');
      rows.push({
        invoice_number: inputs[0].value,
        description: inputs[1].value,
        amount: inputs[2].value,
        date_issued: inputs[3].value,
        due_date: inputs[4].value,
        status: inputs[5].value
      });
    });

    const headers = ['invoice_number', 'description', 'amount', 'date_issued', 'due_date', 'status'];
    const csv = arrayToCSV(headers, rows);
    await saveFile('data/invoices.csv', csv, 'Update invoices');
    invoices = rows;
    btn.textContent = 'Saved ✓';
    setTimeout(() => { btn.textContent = 'Save Changes'; btn.disabled = false; }, 2000);
    renderOverview();
  } catch (e) {
    alert('Save failed: ' + e.message);
    btn.textContent = 'Save Changes';
    btn.disabled = false;
  }
}

async function saveDeliverables() {
  const btn = document.querySelector('#deliverables .save-btn');
  btn.textContent = 'Saving...';
  btn.disabled = true;

  try {
    const rows = [];
    document.querySelectorAll('#deliverables .edit-row').forEach(tr => {
      const inputs = tr.querySelectorAll('.edit-input, .edit-select');
      rows.push({
        deliverable: inputs[0].value,
        stage: inputs[1].value,
        responsible: inputs[2].value,
        due_date: inputs[3].value,
        status: inputs[4].value,
        notes: inputs[5].value
      });
    });

    const headers = ['deliverable', 'stage', 'responsible', 'due_date', 'status', 'notes'];
    const csv = arrayToCSV(headers, rows);
    await saveFile('data/deliverables.csv', csv, 'Update deliverables');
    deliverables = rows;
    btn.textContent = 'Saved ✓';
    setTimeout(() => { btn.textContent = 'Save Changes'; btn.disabled = false; }, 2000);
    renderOverview();
  } catch (e) {
    alert('Save failed: ' + e.message);
    btn.textContent = 'Save Changes';
    btn.disabled = false;
  }
}

async function saveActions() {
  const btn = document.querySelector('#actions .save-btn');
  btn.textContent = 'Saving...';
  btn.disabled = true;

  try {
    const rows = [];
    document.querySelectorAll('#actions .edit-row').forEach(tr => {
      const inputs = tr.querySelectorAll('.edit-input, .edit-select');
      rows.push({
        action: inputs[0].value,
        assigned_to: inputs[1].value,
        role: inputs[2].value,
        due_date: inputs[3].value,
        status: inputs[4].value,
        notes: inputs[5].value
      });
    });

    const headers = ['action', 'assigned_to', 'role', 'due_date', 'status', 'notes'];
    const csv = arrayToCSV(headers, rows);
    await saveFile('data/actions.csv', csv, 'Update actions');
    actions = rows;
    btn.textContent = 'Saved ✓';
    setTimeout(() => { btn.textContent = 'Save Changes'; btn.disabled = false; }, 2000);
    renderOverview();
  } catch (e) {
    alert('Save failed: ' + e.message);
    btn.textContent = 'Save Changes';
    btn.disabled = false;
  }
}

function addInvoiceRow() {
  const tbody = document.querySelector('#invoices .edit-tbody');
  const tr = document.createElement('tr');
  tr.className = 'edit-row';
  tr.innerHTML = `
    <td><input type="text" class="edit-input" value="" placeholder="VA-XXX"></td>
    <td><input type="text" class="edit-input" value="" placeholder="Description"></td>
    <td><input type="text" class="edit-input" value="" placeholder="0.00"></td>
    <td><input type="text" class="edit-input edit-date" value="" placeholder="DD/MM/YYYY"></td>
    <td><input type="text" class="edit-input edit-date" value="" placeholder="DD/MM/YYYY"></td>
    <td><select class="edit-select">
      <option value="outstanding" selected>outstanding</option>
      <option value="overdue">overdue</option>
      <option value="paid">paid</option>
    </select></td>
    <td><button class="delete-row-btn" onclick="this.closest('tr').remove()">✕</button></td>
  `;
  tbody.appendChild(tr);
}

function addDeliverableRow() {
  const tbody = document.querySelector('#deliverables .edit-tbody');
  const tr = document.createElement('tr');
  tr.className = 'edit-row';
  tr.innerHTML = `
    <td><input type="text" class="edit-input" value="" placeholder="Deliverable"></td>
    <td><input type="text" class="edit-input" value="" placeholder="Stage X"></td>
    <td><input type="text" class="edit-input" value="" placeholder="Responsible"></td>
    <td><input type="text" class="edit-input edit-date" value="" placeholder="DD/MM/YYYY"></td>
    <td><select class="edit-select">
      <option value="upcoming" selected>upcoming</option>
      <option value="in_progress">in progress</option>
      <option value="complete">complete</option>
    </select></td>
    <td><input type="text" class="edit-input" value="" placeholder="Notes"></td>
    <td><button class="delete-row-btn" onclick="this.closest('tr').remove()">✕</button></td>
  `;
  tbody.appendChild(tr);
}

function addActionRow() {
  const tbody = document.querySelector('#actions .edit-tbody');
  const tr = document.createElement('tr');
  tr.className = 'edit-row';
  tr.innerHTML = `
    <td><input type="text" class="edit-input" value="" placeholder="Action"></td>
    <td><input type="text" class="edit-input" value="" placeholder="Assigned to"></td>
    <td><input type="text" class="edit-input" value="" placeholder="Role"></td>
    <td><input type="text" class="edit-input edit-date" value="" placeholder="DD/MM/YYYY"></td>
    <td><select class="edit-select">
      <option value="outstanding" selected>outstanding</option>
      <option value="in_progress">in progress</option>
      <option value="upcoming">upcoming</option>
      <option value="complete">complete</option>
    </select></td>
    <td><input type="text" class="edit-input" value="" placeholder="Notes"></td>
    <td><button class="delete-row-btn" onclick="this.closest('tr').remove()">✕</button></td>
  `;
  tbody.appendChild(tr);
}
