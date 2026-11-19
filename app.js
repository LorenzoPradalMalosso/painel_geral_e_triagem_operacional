import {
  $, $$, escape, icon, badge, isClosed, priorities, options, clock, filteredTickets, ticketRows,
  metrics, signal, sectorBars, sectorCards, monitorCards, eventsFor, timeline, ticketDetails, exportTickets, download
} from './ui.js';

const pages = {
  triagem: ['Visão geral', ''],
  chamados: ['Chamados', 'Pesquise, filtre e acompanhe os chamados liberados para seu perfil.'],
  setores: ['Setores', 'Acompanhe a distribuição e o atendimento das equipes.'],
  auditoria: ['Atividade', 'Consulte as ações registradas nos chamados que você pode acompanhar.'],
  configuracoes: ['Configurações', 'Gerencie as contas da equipe e as regras de encaminhamento.']
};
const state = { user: null, tickets: [], scope: 'all', page: 1, view: 'triagem', seen: '', snapshot: '', generation: 0 };
const rowsPerPage = 7;
const publicMode = location.pathname === '/monitor' || location.hash === '#monitor';
const filters = $('#filters');
const newForm = $('#new-form');
const ticketForm = $('#ticket-form');
const loginForm = $('#login-form');
let selectedTicket;
let confirmation = '';
let categoryId;
let toastTimer;

async function api(path, method = 'GET', data) {
  const response = await fetch('/api/' + path, {
    method, cache: 'no-store', signal: AbortSignal.timeout(8000),
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.message), { ...result, status: response.status });
  return result;
}

const fields = form => Object.fromEntries(new FormData(form));
const tabButtons = () => $$('[data-scope]');
const field = (form, name) => form.elements.namedItem(name);
const supervisor = () => ['admin', 'gestor'].includes(state.user?.role);

function errorMessage(error) {
  return error.status ? error.message : 'Não foi possível conectar ao servidor. Tente novamente.';
}

function formError(form, message = '') {
  const box = $('.form-error', form);
  box.textContent = message;
  box.hidden = !message;
}

function bindForm(form, submit) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('button[type=submit], button:not([type])', form);
    if (button.disabled) return;
    const data = fields(form);
    button.disabled = true;
    formError(form);
    try { await submit(data); }
    catch (error) { formError(form, errorMessage(error)); }
    finally { button.disabled = false; }
  });
}

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4200);
}

function showAccess() {
  state.generation++;
  state.user = null;
  state.tickets = [];
  state.snapshot = '';
  state.seen = '';
  for (const dialog of $$('dialog[open]')) dialog.close();
  for (const selector of ['#ticket-rows', '#ticket-summary', '#ticket-history', '#audit-view', '#notification-list', '#user-list', '#category-list', '#hero-signal']) $(selector).replaceChildren();
  for (const form of [newForm, ticketForm, $('#user-form'), $('#category-form')]) form.reset();
  selectedTicket = null;
  $('#workspace').hidden = true;
  $('#access').hidden = false;
  $('#boot').hidden = true;
  $('#demo-form').hidden = !state.demo;
  loginForm.hidden = state.demo;
  $('#setup-name').hidden = !state.setup;
  $('#setup-sector').hidden = !state.setup;
  field(loginForm, 'name').required = state.setup;
  field(loginForm, 'password').minLength = state.setup ? 12 : 0;
  field(loginForm, 'password').autocomplete = state.setup ? 'new-password' : 'current-password';
  $('#access-title').textContent = state.setup ? 'Configure seu ambiente' : state.demo ? 'Experimente o INTEGRA EAM' : 'Acesse seu ambiente';
  $('#access-description').textContent = state.setup
    ? 'Crie a primeira conta de administrador. Use uma senha com pelo menos 12 caracteres.'
    : state.demo ? 'Escolha um perfil para explorar chamados com dados fictícios.' : 'Entre com a conta da sua equipe.';
  $('#login-submit').textContent = state.setup ? 'Criar conta e entrar' : 'Entrar';
}

async function enter(user) {
  state.generation++;
  state.user = user;
  state.setup = false;
  state.scope = 'all';
  state.page = 1;
  state.statusFilter = '';
  filters.reset();
  $('#boot').hidden = true;
  $('#access').hidden = true;
  $('#workspace').hidden = false;
  $('#demo-label').hidden = !state.demo;
  $('#settings-link').hidden = user.role !== 'admin';
  $('#user-name').textContent = user.name;
  $('#user-role').textContent = state.roles[user.role];
  $('#avatar').textContent = user.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  route(false);
  await refresh();
}

function setupOptions(session) {
  Object.assign(state, session);
  const allRoles = Object.entries(state.roles);
  options(field($('#demo-form'), 'role'), [['admin', 'Administrador'], ...allRoles.filter(([key]) => key !== 'admin')]);
  options(field(loginForm, 'sector'), state.sectors);
  options(field(filters, 'sector'), state.sectors, 'Todos os setores');
  options(field(filters, 'priority'), priorities, 'Todas');
  options(field(ticketForm, 'sector'), state.sectors);
  options(field(ticketForm, 'priority'), priorities);
  options(field($('#user-form'), 'role'), allRoles);
  options(field($('#user-form'), 'sector'), state.sectors);
  options(field($('#category-form'), 'sector'), state.sectors);
  options(field($('#category-form'), 'priority'), priorities);
}

function route(focus = true) {
  const hash = location.hash.slice(1);
  state.view = Object.hasOwn(pages, hash) && (hash !== 'configuracoes' || state.user.role === 'admin') ? hash : 'triagem';
  const overview = state.view === 'triagem';
  const queue = overview || state.view === 'chamados';
  const [name, description] = pages[state.view];
  $('#crumb').textContent = name;
  $('#page-title').textContent = name;
  $('#page-description').textContent = description;
  $('#overview').hidden = !overview;
  $('#page-intro').hidden = overview;
  $('#overview-aside').hidden = !overview;
  $('#queue-layout').hidden = !queue;
  $('#queue-layout').classList.toggle('solo', !overview);
  $('#sector-view').hidden = state.view !== 'setores';
  $('#audit-view').hidden = state.view !== 'auditoria';
  $('#admin-view').hidden = state.view !== 'configuracoes';
  for (const link of $$('[data-page]')) {
    if (link.dataset.page === state.view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  render();
  if (state.view === 'configuracoes') refreshUsers();
  if (focus) $('#main-content').focus();
}

function connection(problem) {
  const element = $('#connection');
  element.classList.toggle('offline', Boolean(problem));
  element.lastChild.textContent = problem ? 'Sem comunicação' : 'Atualização automática';
  $('#workspace-error-text').textContent = problem || '';
  $('#workspace-error').hidden = !problem;
}

async function refresh() {
  if (!state.user) return;
  const generation = state.generation;
  const request = state.latestRequest = (state.latestRequest || 0) + 1;
  try {
    const data = await api('workspace');
    if (generation !== state.generation || request !== state.latestRequest) return;
    const snapshot = JSON.stringify(data);
    if (snapshot !== state.snapshot) {
      state.snapshot = snapshot;
      Object.assign(state, data);
      options(field(filters, 'status'), Object.keys(state.transitions), 'Todos');
      field(filters, 'status').value = state.statusFilter || '';
      render();
    }
    connection();
  } catch (error) {
    if (generation !== state.generation || request !== state.latestRequest) return;
    if (error.status === 401) showAccess();
    else connection(errorMessage(error));
  }
}

function render() {
  const { tickets, sectors, view } = state;
  const active = tickets.filter(ticket => !isClosed(ticket));
  $('#nav-count').textContent = active.length;
  const events = eventsFor(tickets);
  $('#notify-dot').hidden = !(events[0]?.at > state.seen);
  if (view === 'triagem') {
    $('#hero-signal').innerHTML = signal(active);
    $('#metrics').innerHTML = metrics(tickets, active);
    $('#sector-bars').innerHTML = sectorBars(sectors, active);
  }
  if (view === 'triagem' || view === 'chamados') renderQueue();
  if (view === 'setores') $('#sector-view').innerHTML = sectorCards(sectors, tickets);
  if (view === 'auditoria') $('#audit-view').innerHTML = '<ol class="timeline">' + timeline(events, true) + '</ol>';
  if (view === 'configuracoes') renderAdmin();
}

function renderQueue() {
  const filter = fields(filters);
  const all = filteredTickets(state.tickets, filter, state.scope);
  const total = Math.max(1, Math.ceil(all.length / rowsPerPage));
  const active = state.tickets.filter(ticket => !isClosed(ticket)).length;
  state.page = Math.max(1, Math.min(state.page, total));
  const start = (state.page - 1) * rowsPerPage;
  const invalid = filter.from && filter.to && filter.to < filter.from;
  const count = $$('.filter-pop select, .filter-pop input', filters).filter(item => item.value).length;
  $('#filter-count').textContent = count;
  $('#filter-count').hidden = !count;
  for (const button of tabButtons()) button.setAttribute('aria-pressed', String(button.dataset.scope === state.scope));
  $('#count-all').textContent = state.tickets.length;
  $('#count-open').textContent = active;
  $('#count-closed').textContent = state.tickets.length - active;
  const focusedTicket = document.activeElement?.dataset.ticket;
  $('#ticket-rows').innerHTML = ticketRows(all.slice(start, start + rowsPerPage));
  if (focusedTicket && $$('.row-open').some(button => button.dataset.ticket === focusedTicket)) {
    $$('.row-open').find(button => button.dataset.ticket === focusedTicket).focus({ preventScroll: true });
  }
  $('#result-count').textContent = invalid ? 'A data final deve ser igual ou posterior à inicial.'
    : all.length ? (start + 1) + '–' + Math.min(start + rowsPerPage, all.length) + ' de ' + all.length + ' chamados' : '0 chamados';
  $('#page-number').textContent = state.page + ' / ' + total;
  $('[data-action=prev]').disabled = state.page === 1;
  $('[data-action=next]').disabled = state.page >= total;
  $('[data-action=export]').disabled = !all.length;
}

function openNew() {
  if (!state.categories?.length) {
    toast('Aguarde o carregamento das categorias.');
    return;
  }
  newForm.reset();
  options(field(newForm, 'categoryId'), state.categories.map(item => [item.id, item.name]), 'Selecione');
  formError(newForm);
  clearConfirmation();
  updateRouteHint();
  $('#new-dialog').showModal();
}

function updateRouteHint() {
  const category = state.categories?.find(item => item.id === field(newForm, 'categoryId').value);
  const risk = field(newForm, 'risk').checked || category?.priority === 'Máxima';
  $('#route-hint').textContent = category ? 'Destino: ' + category.sector + ' · Prioridade ' + (risk ? 'Máxima' : category.priority) : 'O setor é definido pela categoria.';
  $('#risk-warning').hidden = !risk;
}

function clearConfirmation() {
  confirmation = '';
  field(newForm, 'duplicate').checked = false;
  $('#duplicate-warning').hidden = true;
}

function openTicket(id) {
  const ticket = state.tickets.find(item => item.id === id);
  if (!ticket) { toast('Chamado não disponível.'); return; }
  selectedTicket = ticket;
  $('#ticket-code').textContent = '#' + ticket.id;
  $('#ticket-title').textContent = ticket.title;
  $('#ticket-summary').innerHTML = ticketDetails(ticket);
  $('#ticket-history').innerHTML = timeline([...ticket.history].reverse());
  ticketForm.reset();
  ticketForm.hidden = !ticket.editable;
  if (ticket.editable) {
    const transitions = state.transitions[ticket.status].filter(status => supervisor() || status !== 'Cancelado');
    options(field(ticketForm, 'status'), [ticket.status, ...transitions]);
    field(ticketForm, 'sector').value = ticket.sector;
    field(ticketForm, 'sector').disabled = !supervisor();
    field(ticketForm, 'priority').value = ticket.priority;
    field(ticketForm, 'priority').disabled = !supervisor() || ticket.risk;
    field(ticketForm, 'owner').value = ticket.owner;
    updateResolution();
    formError(ticketForm);
  }
  $('#notifications-dialog').close();
  $('#ticket-dialog').showModal();
  $('#ticket-dialog').scrollTop = 0;
}

function updateResolution() {
  const resolving = field(ticketForm, 'status').value === 'Resolvido';
  $('#resolution-field').hidden = !resolving;
  field(ticketForm, 'resolution').required = resolving;
}

function openNotifications() {
  const events = eventsFor(state.tickets);
  if (events[0]) state.seen = events[0].at;
  $('#notify-dot').hidden = true;
  $('#notification-list').innerHTML = timeline(events.slice(0, 12), true);
  $('#notifications-dialog').showModal();
}

function renderAdmin() {
  $('#category-list').innerHTML = (state.categories || []).map(item =>
    '<div class="settings-item"><div><strong>' + escape(item.name) + '</strong><small>' + escape(item.sector) + ' · ' + badge(item.priority) +
    '</small></div><button class="button secondary small" type="button" data-category="' + escape(item.id) +
    '" aria-label="Editar ' + escape(item.name) + '">Editar</button></div>'
  ).join('');
  try { $('#legacy-panel').hidden = !localStorage.getItem('integra-eam-chamados-v1'); }
  catch { $('#legacy-panel').hidden = true; }
}

async function refreshUsers() {
  const generation = state.generation;
  try {
    const users = await api('users');
    if (generation !== state.generation) return;
    $('#user-list').innerHTML = users.map(user =>
      '<div class="settings-item"><div><strong>' + escape(user.name) + '</strong><small>' + escape(user.email) +
      '</small></div><small>' + escape(state.roles[user.role]) + ' · ' + escape(user.sector) + '</small></div>'
    ).join('');
  } catch (error) {
    if (generation === state.generation) $('#user-list').textContent = errorMessage(error);
  }
}

function openSettings(type, id) {
  const userMode = type === 'user';
  const userForm = $('#user-form');
  const categoryForm = $('#category-form');
  const category = id && state.categories.find(item => item.id === id);
  categoryId = category?.id;
  userForm.hidden = !userMode;
  categoryForm.hidden = userMode;
  const form = userMode ? userForm : categoryForm;
  form.reset();
  formError(form);
  $('#settings-title').textContent = userMode ? 'Nova conta' : category ? 'Editar categoria' : 'Nova categoria';
  if (category) {
    for (const name of ['name', 'sector', 'priority']) field(form, name).value = category[name];
  }
  field(categoryForm, 'priority').disabled = categoryId === 'risco';
  $('#settings-dialog').showModal();
}

function applySector(sector) {
  filters.reset();
  state.statusFilter = '';
  state.scope = 'all';
  state.page = 1;
  field(filters, 'sector').value = sector;
  if (state.view !== 'chamados') location.hash = 'chamados';
  else renderQueue();
}

function bindWorkspace() {
  filters.addEventListener('submit', event => event.preventDefault());
  filters.addEventListener('input', () => {
    state.page = 1;
    state.statusFilter = field(filters, 'status').value;
    renderQueue();
  });
  newForm.addEventListener('input', event => {
    if (event.target.name !== 'duplicate') clearConfirmation();
    updateRouteHint();
  });
  field(ticketForm, 'status').addEventListener('change', updateResolution);
  window.addEventListener('hashchange', () => {
    if (location.hash === '#monitor') location.replace('/monitor');
    else if (state.user) route();
  });

  bindForm(loginForm, async data => {
    const result = await api(state.setup ? 'setup' : 'login', 'POST', data);
    loginForm.reset();
    await enter(result.user);
  });
  bindForm($('#demo-form'), async data => enter((await api('demo', 'POST', data)).user));
  bindForm(newForm, async data => {
    data.risk = field(newForm, 'risk').checked;
    if (field(newForm, 'duplicate').checked) data.confirmation = confirmation;
    try {
      const ticket = await api('tickets', 'POST', data);
      $('#new-dialog').close();
      newForm.reset();
      await refresh();
      toast('Chamado #' + ticket.id + ' registrado para ' + ticket.sector + '.');
      openTicket(ticket.id);
    } catch (error) {
      if (!error.confirmation) throw error;
      confirmation = error.confirmation;
      $('#duplicate-message').textContent = error.message + (error.protocols.length ? ' ' + error.protocols.map(id => '#' + id).join(', ') + '.' : '');
      field(newForm, 'duplicate').checked = false;
      $('#duplicate-warning').hidden = false;
      field(newForm, 'duplicate').focus();
    }
  });
  bindForm(ticketForm, async data => {
    const id = selectedTicket.id;
    data.version = selectedTicket.version;
    data.sector = field(ticketForm, 'sector').value;
    data.priority = field(ticketForm, 'priority').value;
    await api('tickets/' + id, 'PATCH', data);
    $('#ticket-dialog').close();
    await refresh();
    toast('Alteração registrada no histórico de #' + id + '.');
    if (state.tickets.some(ticket => ticket.id === id)) openTicket(id);
  });
  bindForm($('#user-form'), async data => {
    await api('users', 'POST', data);
    $('#settings-dialog').close();
    await refreshUsers();
    toast('Conta cadastrada.');
  });
  bindForm($('#category-form'), async data => {
    await api('categories', 'POST', { ...data, id: categoryId });
    $('#settings-dialog').close();
    await refresh();
    toast('Regra de encaminhamento salva.');
  });

  const actions = {
    new: openNew, notifications: openNotifications, retry: refresh,
    close: button => button.closest('dialog').close(),
    prev: () => { state.page--; renderQueue(); },
    next: () => { state.page++; renderQueue(); },
    clear: () => {
      filters.reset();
      state.statusFilter = '';
      state.page = 1;
      $('.filter-details').open = false;
      $('summary', filters).focus();
      renderQueue();
    },
    export: () => exportTickets(filteredTickets(state.tickets, fields(filters), state.scope)),
    assume: () => {
      field(ticketForm, 'owner').value = state.user.name;
      field(ticketForm, 'reason').focus();
    },
    logout: async () => {
      try { await api('logout', 'POST', {}); showAccess(); }
      catch (error) { toast(errorMessage(error)); }
    },
    'add-user': () => openSettings('user'),
    'add-category': () => openSettings('category'),
    legacy: () => {
      try {
        const old = localStorage.getItem('integra-eam-chamados-v1');
        if (old) download(old, 'chamados-prototipo.json', 'application/json');
      } catch { toast('Os registros locais não estão disponíveis.'); }
    }
  };
  document.addEventListener('click', event => {
    if (!event.target.closest('.filter-details')) $('.filter-details').open = false;
    const button = event.target.closest('button');
    if (!button) return;
    const { action, scope, sector, ticket, category } = button.dataset;
    if (action && actions[action]) actions[action](button);
    if (ticket) openTicket(ticket);
    if (sector) applySector(sector);
    if (category) openSettings('category', category);
    if (scope) { state.scope = scope; state.page = 1; renderQueue(); }
  });
}

async function startMonitor() {
  $('#boot').hidden = true;
  $('#public-monitor').hidden = false;
  $('.skip').href = '#public-monitor';
  const select = $('#monitor-sector');
  let sectors = [];
  const renderMonitor = () => {
    $('#monitor-grid').innerHTML = monitorCards(sectors, select.value);
    $('#monitor-clock').textContent = clock();
  };
  select.addEventListener('change', renderMonitor);
  async function refreshMonitor() {
    try {
      const data = await api('monitor');
      if (!sectors.length) {
        const names = data.sectors.map(item => item.name);
        options(select, names, 'Todos os setores');
        const requested = new URLSearchParams(location.search).get('setor');
        if (names.includes(requested)) select.value = requested;
      }
      sectors = data.sectors;
      renderMonitor();
      $('#monitor-error').hidden = true;
      $('#monitor-updated').textContent = 'Última atualização às ' + clock();
    } catch (error) {
      $('#monitor-error').textContent = errorMessage(error);
      $('#monitor-error').hidden = false;
    }
  }
  $('#monitor-clock').textContent = clock();
  await refreshMonitor();
  setInterval(refreshMonitor, 5000);
}

async function startWorkspace() {
  bindWorkspace();
  try {
    const session = await api('session');
    setupOptions(session);
    if (session.user) await enter(session.user);
    else showAccess();
    setInterval(refresh, 5000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  } catch (error) {
    $('#boot').textContent = errorMessage(error);
    const retry = document.createElement('a');
    retry.href = location.href;
    retry.textContent = ' Recarregar';
    $('#boot').append(retry);
  }
}

if (publicMode) startMonitor();
else startWorkspace();
