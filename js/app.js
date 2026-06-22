let config = {};
let invoices = [];
let deliverables = [];
let actions = [];
let consultants = [];
let cdp = [];

async function loadData() {
  config = await fetch('data/config.json').then(r => r.json());
  invoices = await loadCSV('data/invoices.csv');
  deliverables = await loadCSV('data/deliverables.csv');
  actions = await loadCSV('data/actions.csv');
  consultants = await loadCSV('data/consultants.csv');
  cdp = await loadCSV('data/cdp.csv');

  document.getElementById('project-name').textContent = config.project.name;
  document.getElementById('project-detail').textContent =
    `${config.project.client} — ${config.project.address}`;

  renderOverview();
  renderConsultants();
  renderDrawings();
  renderInvoices();
  renderDeliverables();
  renderActions();
}

async function loadCSV(path) {
  const text = await fetch(path).then(r => r.text());
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = (vals[i] || '').trim());
    return obj;
  });
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.includes('/') ? dateStr.split('/') : null;
  if (parts && parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return new Date(dateStr + 'T00:00:00');
}

function daysUntil(dateStr) {
  const target = parseDate(dateStr);
  if (!target || isNaN(target)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  const d = parseDate(dateStr);
  if (!d || isNaN(d)) return '—';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function dueDateHTML(dateStr) {
  const days = daysUntil(dateStr);
  if (days < 0) return `<span class="due-date overdue">${formatDate(dateStr)} (${Math.abs(days)}d overdue)</span>`;
  if (days <= 7) return `<span class="due-date soon">${formatDate(dateStr)} (${days}d)</span>`;
  return `<span class="due-date">${formatDate(dateStr)}</span>`;
}

function badge(status) {
  return `<span class="badge badge-${status}">${status.replace('_', ' ')}</span>`;
}

// --- Overview ---
function renderOverview() {
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const outstandingInvoices = invoices.filter(i => i.status === 'outstanding' || i.status === 'overdue');
  const totalOwed = outstandingInvoices.reduce((s, i) => s + parseFloat(i.amount), 0);
  const overdueActions = actions.filter(a => a.status === 'outstanding' && daysUntil(a.due_date) < 0);
  const upcomingActions = actions.filter(a => a.status === 'outstanding' && daysUntil(a.due_date) >= 0 && daysUntil(a.due_date) <= 7);

  document.getElementById('overview').innerHTML = `
    <div class="stats">
      <div class="stat-card ${overdueInvoices.length ? 'danger' : ''}">
        <div class="value">${overdueInvoices.length}</div>
        <div class="label">Overdue Invoices</div>
      </div>
      <div class="stat-card ${totalOwed > 0 ? 'warning' : ''}">
        <div class="value">£${totalOwed.toLocaleString('en-GB', {minimumFractionDigits: 2})}</div>
        <div class="label">Total Outstanding</div>
      </div>
      <div class="stat-card ${overdueActions.length ? 'danger' : ''}">
        <div class="value">${overdueActions.length}</div>
        <div class="label">Overdue Actions</div>
      </div>
      <div class="stat-card">
        <div class="value">${upcomingActions.length}</div>
        <div class="label">Actions Due This Week</div>
      </div>
    </div>
    <div class="chart-panel">
      <h3 class="section-subtitle">Programme</h3>
      <div id="overview-gantt"></div>
    </div>
    <div class="overview-grid">
      <div class="panel">
        <h3>Upcoming Deadlines</h3>
        <ul>
          ${actions.filter(a => a.status !== 'complete')
            .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
            .slice(0, 5)
            .map(a => `<li><span>${a.action}</span>${dueDateHTML(a.due_date)}</li>`).join('')}
        </ul>
      </div>
      <div class="panel">
        <h3>Deliverables Progress</h3>
        <ul>
          ${deliverables.map(d => `<li><span>${d.deliverable}</span>${badge(d.status)}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
  renderGanttChart('overview-gantt', invoices);
}

// --- Consultants ---
function yesNoBadge(val) {
  if (val === 'yes') return '<span class="badge badge-complete">Yes</span>';
  return '<span class="badge badge-overdue">No</span>';
}

function renderConsultants() {
  if (adminMode) {
    document.getElementById('consultants').innerHTML = `
      <h2 class="section-title">Project Consultants</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Company</th><th>Contact Name</th><th>Email</th><th>Phone</th><th>Required</th><th>Appointed</th><th></th></tr></thead>
          <tbody class="edit-tbody" id="consultants-tbody">
            ${consultants.map(c => `<tr class="edit-row">
              <td>${editableInput(c.company)}</td>
              <td>${editableInput(c.contact_name)}</td>
              <td>${editableInput(c.email)}</td>
              <td>${editableInput(c.phone)}</td>
              <td>${editableSelect(c.required, ['yes', 'no'])}</td>
              <td>${editableSelect(c.appointed, ['yes', 'no'])}</td>
              <td><button class="delete-row-btn" onclick="this.closest('tr').remove()">✕</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="admin-toolbar">
        <button class="add-row-btn" onclick="addConsultantRow()">+ Add Consultant</button>
        <button class="save-btn" onclick="saveConsultants()">Save Changes</button>
      </div>
      <h2 class="section-title">Contractor Design Portion (CDP)</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Company</th><th>Contact Name</th><th>Email</th><th>Phone</th><th>Package</th><th>Required</th><th>Appointed</th><th></th></tr></thead>
          <tbody class="edit-tbody" id="cdp-tbody">
            ${cdp.map(c => `<tr class="edit-row">
              <td>${editableInput(c.company)}</td>
              <td>${editableInput(c.contact_name)}</td>
              <td>${editableInput(c.email)}</td>
              <td>${editableInput(c.phone)}</td>
              <td>${editableInput(c.package)}</td>
              <td>${editableSelect(c.required, ['yes', 'no'])}</td>
              <td>${editableSelect(c.appointed, ['yes', 'no'])}</td>
              <td><button class="delete-row-btn" onclick="this.closest('tr').remove()">✕</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="admin-toolbar">
        <button class="add-row-btn" onclick="addCDPRow()">+ Add CDP Entry</button>
        <button class="save-btn" onclick="saveCDP()">Save Changes</button>
      </div>
    `;
    return;
  }

  document.getElementById('consultants').innerHTML = `
    <h2 class="section-title">Project Consultants</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Company</th><th>Contact Name</th><th>Email</th><th>Phone</th><th>Required</th><th>Appointed</th></tr></thead>
        <tbody>
          ${consultants.map(c => `<tr>
            <td style="font-weight:600">${c.company}</td>
            <td>${c.contact_name}</td>
            <td><a href="mailto:${c.email}" style="color:var(--accent-light)">${c.email}</a></td>
            <td>${c.phone}</td>
            <td>${yesNoBadge(c.required)}</td>
            <td>${yesNoBadge(c.appointed)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <h2 class="section-title">Contractor Design Portion (CDP)</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Company</th><th>Contact Name</th><th>Email</th><th>Phone</th><th>Package</th><th>Required</th><th>Appointed</th></tr></thead>
        <tbody>
          ${cdp.map(c => `<tr>
            <td style="font-weight:600">${c.company || '—'}</td>
            <td>${c.contact_name || '—'}</td>
            <td>${c.email ? `<a href="mailto:${c.email}" style="color:var(--accent-light)">${c.email}</a>` : '—'}</td>
            <td>${c.phone || '—'}</td>
            <td>${c.package || '—'}</td>
            <td>${yesNoBadge(c.required)}</td>
            <td>${yesNoBadge(c.appointed)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// --- Drawings ---
function renderDrawings() {
  const vita = config.drawings.vita;
  const consultants = config.drawings.consultants;

  document.getElementById('drawings').innerHTML = `
    <h2 class="section-title">Vita Architecture Drawings</h2>
    <div class="card-grid">
      <div class="card">
        <h3>${vita.label}</h3>
        <p class="desc">${vita.description}</p>
        <a class="btn" href="${vita.url}" target="_blank">Open in OneDrive ↗</a>
      </div>
    </div>
    <h2 class="section-title">Consultant Drawings</h2>
    <div class="card-grid">
      ${consultants.map(c => `
        <div class="card">
          <h3>${c.label}</h3>
          <p class="firm">${c.firm}</p>
          <p class="desc">${c.description}</p>
          <a class="btn" href="${c.url}" target="_blank">Open in OneDrive ↗</a>
        </div>
      `).join('')}
    </div>
  `;
}

// --- Invoices ---
function renderInvoices() {
  if (adminMode) {
    document.getElementById('invoices').innerHTML = `
      <h2 class="section-title">All Invoices</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Invoice</th><th>Description</th><th>Amount</th><th>Issued</th><th>Due</th><th>Status</th><th>Stage Start</th><th>Stage End</th><th>% Done</th><th></th></tr></thead>
          <tbody class="edit-tbody">
            ${invoices.map(i => `<tr class="edit-row">
              <td>${editableInput(i.invoice_number)}</td>
              <td>${editableInput(i.description)}</td>
              <td>${editableInput(i.amount)}</td>
              <td>${editableDateInput(i.date_issued)}</td>
              <td>${editableDateInput(i.due_date)}</td>
              <td>${editableSelect(i.status, ['outstanding', 'overdue', 'paid', 'upcoming'])}</td>
              <td>${editableDateInput(i.stage_start)}</td>
              <td>${editableDateInput(i.stage_end)}</td>
              <td>${editableInput(i.percent_complete)}</td>
              <td><button class="delete-row-btn" onclick="this.closest('tr').remove()">✕</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="admin-toolbar">
        <button class="add-row-btn" onclick="addInvoiceRow()">+ Add Invoice</button>
        <button class="save-btn" onclick="saveInvoices()">Save Changes</button>
      </div>
    `;
    return;
  }

  const outstanding = invoices.filter(i => i.status === 'outstanding' || i.status === 'overdue');
  const paid = invoices.filter(i => i.status === 'paid');

  document.getElementById('invoices').innerHTML = `
    <h2 class="section-title">Outstanding Invoices</h2>
    ${outstanding.length === 0 ? '<p>All invoices are paid — thank you!</p>' : `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Invoice</th><th>Description</th><th>Amount</th><th>Issued</th><th>Due</th><th>Status</th></tr></thead>
        <tbody>
          ${outstanding.map(i => {
            const days = daysUntil(i.due_date);
            const overdueTxt = days < 0 ? `<br><span class="overdue-days">${Math.abs(days)} days overdue</span>` : '';
            return `<tr>
              <td>${i.invoice_number}</td>
              <td>${i.description}</td>
              <td>£${parseFloat(i.amount).toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
              <td>${formatDate(i.date_issued)}</td>
              <td>${formatDate(i.due_date)}${overdueTxt}</td>
              <td>${badge(i.status)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`}
    <h2 class="section-title">Payment History</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Invoice</th><th>Description</th><th>Amount</th><th>Issued</th><th>Due</th><th>Status</th></tr></thead>
        <tbody>
          ${paid.map(i => `<tr>
            <td>${i.invoice_number}</td>
            <td>${i.description}</td>
            <td>£${parseFloat(i.amount).toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
            <td>${formatDate(i.date_issued)}</td>
            <td>${formatDate(i.due_date)}</td>
            <td>${badge(i.status)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="chart-panel">
      <h3 class="section-subtitle">Programme</h3>
      <div id="invoices-gantt"></div>
    </div>
  `;
  renderGanttChart('invoices-gantt', invoices);
}

// --- Deliverables ---
function renderDeliverables() {
  if (adminMode) {
    document.getElementById('deliverables').innerHTML = `
      <h2 class="section-title">Architectural Deliverables</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Deliverable</th><th>Stage</th><th>Responsible</th><th>Due</th><th>Status</th><th>% Complete</th><th>Notes</th><th></th></tr></thead>
          <tbody class="edit-tbody">
            ${deliverables.map(d => `<tr class="edit-row">
              <td>${editableInput(d.deliverable)}</td>
              <td>${editableInput(d.stage)}</td>
              <td>${editableInput(d.responsible)}</td>
              <td>${editableDateInput(d.due_date)}</td>
              <td>${editableSelect(d.status, ['upcoming', 'in_progress', 'complete'])}</td>
              <td>${editableInput(d.percent_complete)}</td>
              <td>${editableInput(d.notes)}</td>
              <td><button class="delete-row-btn" onclick="this.closest('tr').remove()">✕</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="admin-toolbar">
        <button class="add-row-btn" onclick="addDeliverableRow()">+ Add Deliverable</button>
        <button class="save-btn" onclick="saveDeliverables()">Save Changes</button>
      </div>
    `;
    return;
  }

  document.getElementById('deliverables').innerHTML = `
    <h2 class="section-title">Architectural Deliverables</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Deliverable</th><th>Stage</th><th>Responsible</th><th>Due</th><th>% Complete</th><th>Status</th><th>Notes</th></tr></thead>
        <tbody>
          ${deliverables.map(d => `<tr>
            <td>${d.deliverable}</td>
            <td>${d.stage}</td>
            <td>${d.responsible}</td>
            <td>${d.status === 'complete' ? formatDate(d.due_date) : dueDateHTML(d.due_date)}</td>
            <td><div class="progress-bar"><div class="progress-fill" style="width:${d.percent_complete || 0}%"></div><span>${d.percent_complete || 0}%</span></div></td>
            <td>${badge(d.status)}</td>
            <td style="font-size:0.8rem;color:var(--text-muted)">${d.notes || '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// --- Actions ---
function renderActions() {
  if (adminMode) {
    document.getElementById('actions').innerHTML = `
      <h2 class="section-title">All Actions</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Action</th><th>Assigned To</th><th>Role</th><th>Due</th><th>Status</th><th>Notes</th><th></th></tr></thead>
          <tbody class="edit-tbody">
            ${actions.map(a => `<tr class="edit-row">
              <td>${editableInput(a.action)}</td>
              <td>${editableInput(a.assigned_to)}</td>
              <td>${editableInput(a.role)}</td>
              <td>${editableDateInput(a.due_date)}</td>
              <td>${editableSelect(a.status, ['outstanding', 'in_progress', 'upcoming', 'complete'])}</td>
              <td>${editableInput(a.notes)}</td>
              <td><button class="delete-row-btn" onclick="this.closest('tr').remove()">✕</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="admin-toolbar">
        <button class="add-row-btn" onclick="addActionRow()">+ Add Action</button>
        <button class="save-btn" onclick="saveActions()">Save Changes</button>
      </div>
    `;
    return;
  }

  const clientActions = actions.filter(a => a.role === 'Client');
  const otherActions = actions.filter(a => a.role !== 'Client');

  document.getElementById('actions').innerHTML = `
    <h2 class="section-title">Client Actions</h2>
    ${renderActionsTable(clientActions)}
    <h2 class="section-title">Team & Consultant Actions</h2>
    ${renderActionsTable(otherActions)}
  `;
}

function renderActionsTable(items) {
  if (items.length === 0) return '<p>No outstanding actions.</p>';
  return `<div class="table-wrap">
    <table>
      <thead><tr><th>Action</th><th>Assigned To</th><th>Role</th><th>Due</th><th>Status</th><th>Notes</th></tr></thead>
      <tbody>
        ${items.sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).map(a => `<tr>
          <td>${a.action}</td>
          <td>${a.assigned_to}</td>
          <td>${a.role}</td>
          <td>${a.status === 'complete' ? formatDate(a.due_date) : dueDateHTML(a.due_date)}</td>
          <td>${badge(a.status)}</td>
          <td style="font-size:0.8rem;color:var(--text-muted)">${a.notes || '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

// --- Navigation ---
function switchTab(tabId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('nav button').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  loadData();
});
