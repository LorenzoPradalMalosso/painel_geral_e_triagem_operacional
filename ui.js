export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const icon = name => '<span class="icon" aria-hidden="true">' + name + '</span>';
export const isClosed = ticket => ['Resolvido', 'Cancelado'].includes(ticket.status);
export const priorities = ['Normal', 'Alta', 'Máxima'];

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
const clockFormat = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
const inputDate = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' });
export const dateTime = value => value ? dateFormat.format(new Date(value)) : '—';
export const clock = () => clockFormat.format(new Date());
const normalize = value => String(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function options(select, values, empty) {
  select.replaceChildren();
  if (empty !== undefined) select.add(new Option(empty, ''));
  for (const item of values) {
    const [value, label] = typeof item === 'string' ? [item, item] : item;
    select.add(new Option(label, value));
  }
}

export function badge(value) {
  const tones = {
    'Máxima': ['critical', 'warning'], Alta: ['high', 'keyboard_arrow_up'], Resolvido: ['good', 'check_circle'],
    'Em triagem': ['high', ''], 'Em atendimento': ['info', ''], Aberto: ['info', ''], Atribuído: ['info', '']
  };
  const [tone, symbol] = tones[value] || ['', ''];
  return '<span class="badge ' + tone + '">' + (symbol ? icon(symbol) : '') + escape(value) + '</span>';
}

export function filteredTickets(tickets, filter, scope) {
  const query = normalize(filter.query.trim().replace(/^#/, ''));
  return tickets.filter(ticket => {
    const date = inputDate.format(new Date(ticket.createdAt));
    return (scope !== 'open' || !isClosed(ticket)) && (scope !== 'closed' || isClosed(ticket)) &&
      (!filter.sector || ticket.sector === filter.sector) &&
      (!filter.priority || ticket.priority === filter.priority) &&
      (!filter.status || ticket.status === filter.status) &&
      (!filter.from || date >= filter.from) && (!filter.to || date <= filter.to) &&
      (!query || normalize([ticket.id, ticket.title, ticket.local, ticket.category, ticket.owner].join(' ')).includes(query));
  }).sort((a, b) => Number(b.risk && !isClosed(b)) - Number(a.risk && !isClosed(a)) || b.createdAt.localeCompare(a.createdAt));
}

export function ticketRows(tickets) {
  if (!tickets.length) return '<tr><td class="empty" colspan="5">Nenhum chamado corresponde a esta seleção.</td></tr>';
  return tickets.map(ticket =>
    '<tr class="' + (ticket.risk && !isClosed(ticket) ? 'critical' : '') + '">' +
    '<td class="occurrence"><strong class="row-title">' + escape(ticket.title) + '</strong>' +
    '<span class="row-meta"><b>#' + escape(ticket.id) + '</b> · ' + escape(ticket.local) + '</span></td>' +
    '<td>' + escape(ticket.sector) + '</td><td>' + badge(ticket.priority) + '</td><td>' + badge(ticket.status) + '</td>' +
    '<td class="action-cell"><button type="button" class="icon-button row-open" data-ticket="' + escape(ticket.id) +
    '" aria-label="Abrir ' + escape(ticket.id) + '" title="Abrir chamado">' + icon('arrow_forward') + '</button></td></tr>'
  ).join('');
}

function meanDuration(tickets, until) {
  const durations = tickets.filter(item => item[until]).map(item => new Date(item[until]) - new Date(item.createdAt));
  if (!durations.length) return '—';
  const minutes = Math.round(durations.reduce((total, duration) => total + duration, 0) / durations.length / 60000);
  return minutes >= 60 ? Math.floor(minutes / 60) + 'h ' + String(minutes % 60).padStart(2, '0') + 'm' : minutes + ' min';
}

export function metrics(tickets, active) {
  const risks = active.filter(ticket => ticket.risk).length;
  const resolved = tickets.filter(ticket => ticket.status === 'Resolvido').length;
  const metrics = [
    ['Chamados ativos', active.length, 'inbox', tickets.length + ' registrados · ' + resolved + ' resolvidos'],
    ['Risco máximo', risks, 'warning', risks ? 'Exigem atenção imediata' : 'Nenhum risco ativo'],
    ['Tempo médio de atendimento', meanDuration(tickets, 'startedAt'), 'timer', 'Da abertura ao início'],
    ['Tempo médio de resolução', meanDuration(tickets, 'resolvedAt'), 'task_alt', 'Da abertura à resolução']
  ];
  return metrics.map(([label, value, symbol, note], index) =>
    '<article class="metric' + (index === 1 && risks ? ' risk' : '') + '"><div class="metric-head"><span>' + label + '</span>' +
    icon(symbol) + '</div><strong>' + value + '</strong><p>' + note + '</p></article>').join('');
}

export function signal(active) {
  const risks = active.filter(ticket => ticket.risk);
  if (!risks.length) {
    return '<span class="signal-label">' + icon('check_circle') + ' TRIAGEM DE RISCO</span><strong>Nenhum risco ativo</strong>';
  }
  const first = risks[0];
  return '<span class="signal-label">' + icon('warning') + ' ' + risks.length + (risks.length === 1 ? ' RISCO ATIVO' : ' RISCOS ATIVOS') + '</span>' +
    '<strong>' + escape(first.title) + '</strong><button type="button" data-ticket="' + escape(first.id) + '">Ver ocorrência ' + icon('arrow_outward') + '</button>';
}

export function sectorBars(sectors, active) {
  return sectors.map(sector => {
    const count = active.filter(ticket => ticket.sector === sector).length;
    const pct = active.length ? Math.round(count * 100 / active.length) : 0;
    return '<button type="button" class="sector-bar" data-sector="' + escape(sector) + '"><span class="sector-label">' + escape(sector) +
      '<b>' + count + '</b></span><span class="bar" aria-hidden="true"><span style="width:' + pct + '%"></span></span></button>';
  }).join('');
}

function counts(values) {
  return '<dl class="sector-metrics">' + values.map(([label, count]) => '<div><dt>' + label + '</dt><dd>' + count + '</dd></div>').join('') + '</dl>';
}

export function sectorCards(sectors, tickets) {
  return sectors.map(sector => {
    const all = tickets.filter(ticket => ticket.sector === sector);
    const active = all.filter(ticket => !isClosed(ticket));
    return '<article class="panel sector-card"><div class="panel-heading"><div><h2>' + escape(sector) + '</h2><p>' + all.length +
      ' chamados registrados</p></div>' + icon('corporate_fare') + '</div>' + counts([
      ['Ativos', active.length], ['Em atendimento', active.filter(ticket => ticket.status === 'Em atendimento').length],
      ['Riscos', active.filter(ticket => ticket.risk).length]
    ]) + '<button type="button" class="button secondary small sector-action" data-sector="' + escape(sector) + '">Ver chamados ' + icon('arrow_forward') + '</button></article>';
  }).join('');
}

export function monitorCards(sectors, selected) {
  return sectors.filter(sector => !selected || sector.name === selected).map(sector =>
    '<article class="monitor-card' + (sector.risks ? ' risk' : '') + '"><h2>' + escape(sector.name) +
    (sector.risks ? '<span class="badge critical">' + icon('warning') + ' ' + sector.risks + ' em risco</span>' : '') + '</h2>' + counts([
      ['Ativos', sector.active], ['Na fila', sector.waiting], ['Em atendimento', sector.attending], ['Aguardam informação', sector.pending]
    ]) + '</article>').join('');
}

export function eventsFor(tickets) {
  return tickets.flatMap(ticket => ticket.history.map(event => ({ ...event, ticket })))
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function timeline(events, links = false) {
  if (!events.length) return '<li class="muted">Nenhum registro de atividade.</li>';
  return events.map(event => {
    const changes = [];
    if (event.from && event.from !== event.to) changes.push(event.from + ' → ' + event.to);
    if (event.oldSector && event.oldSector !== event.sector) changes.push(event.oldSector + ' → ' + event.sector);
    if (event.oldOwner && event.oldOwner !== event.owner) changes.push(event.oldOwner + ' → ' + event.owner);
    if (event.oldPriority && event.oldPriority !== event.priority) changes.push(event.oldPriority + ' → ' + event.priority);
    const heading = links
      ? '<button type="button" class="timeline-control" data-ticket="' + escape(event.ticket.id) + '">' +
        escape(event.action) + ' · ' + escape(event.ticket.title) + '</button>'
      : '<strong>' + escape(event.action) + '</strong>';
    return '<li>' + heading + '<br><small>' + dateTime(event.at) + (event.author ? ' · ' + escape(event.author) : '') + '</small>' +
      (changes.length ? '<p>' + escape(changes.join(' · ')) + '</p>' : '') +
      (event.reason ? '<p>' + escape(event.reason) + '</p>' : '') + '</li>';
  }).join('');
}

export function ticketDetails(ticket) {
  const items = [
    ['Status', badge(ticket.status)], ['Prioridade', badge(ticket.priority)],
    ['Setor responsável', escape(ticket.sector)], ['Responsável', escape(ticket.owner)],
    ['Local', escape(ticket.local)], ['Categoria', escape(ticket.category)], ['Abertura', dateTime(ticket.createdAt)],
    [ticket.resolvedAt ? 'Resolução' : 'Início do atendimento', dateTime(ticket.resolvedAt || ticket.startedAt)]
  ];
  return '<dl class="ticket-details">' + items.map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>').join('') + '</dl>' +
    (ticket.description ? '<p class="detail-note">' + escape(ticket.description) + '</p>' : '') +
    (ticket.resolution ? '<p class="detail-note"><strong>Solução</strong> · ' + escape(ticket.resolution) + '</p>' : '');
}

export function download(text, name, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportTickets(tickets) {
  const rows = [['Protocolo', 'Assunto', 'Local', 'Categoria', 'Setor', 'Prioridade', 'Status', 'Responsável', 'Abertura'],
    ...tickets.map(t => [t.id, t.title, t.local, t.category, t.sector, t.priority, t.status, t.owner, dateTime(t.createdAt)])];
  const cell = raw => {
    const text = String(raw ?? '');
    const value = /^\s*[=+\-@]|\t|\r/.test(text) ? "'" + text : text;
    return '"' + value.replaceAll('"', '""') + '"';
  };
  download('\ufeff' + rows.map(row => row.map(cell).join(';')).join('\r\n'), 'chamados-integra-eam.csv', 'text/csv;charset=utf-8');
}
