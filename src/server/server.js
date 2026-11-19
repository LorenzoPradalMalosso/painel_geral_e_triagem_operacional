const http = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { openStore } = require('./store');
const { sectors, priorities, transitions, roles, isClosed, manages, canSee, canEdit, duplicateCandidates } = require('../shared/domain');

const demo = process.argv.includes('--demo');
const host = demo ? '127.0.0.1' : process.env.EAM_HOST || '127.0.0.1';
const port = Number(process.env.EAM_PORT || 4173);
const secure = process.env.EAM_SECURE_COOKIE === '1';
if (!demo && !['127.0.0.1', '::1', 'localhost'].includes(host) && !secure) {
  throw new Error('Configure HTTPS e EAM_SECURE_COOKIE=1 antes de expor o servidor na rede.');
}
const store = openStore(demo ? ':memory:' : process.env.EAM_DATABASE || path.join(__dirname, '..', '..', 'data', 'eam.sqlite'), demo);
const assets = {
  '/': ['index.html', 'text/html'],
  '/index.html': ['index.html', 'text/html'],
  '/monitor': ['index.html', 'text/html'],
  '/app.js': ['app.js', 'text/javascript'],
  '/ui.js': ['ui.js', 'text/javascript'],
  '/styles.css': ['styles.css', 'text/css']
};
const attempts = new Map();
const localAddress = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);

function fail(status, message, extra) {
  throw Object.assign(new Error(message), { status, extra });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') fail(415, 'Envie os dados em JSON.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32_768) fail(413, 'Os dados enviados excedem o limite.');
    chunks.push(chunk);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString()); }
  catch { fail(400, 'Dados inválidos.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Dados inválidos.');
  return body;
}

function field(value, label, max, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    fail(422, label + ' deve ter de ' + min + ' a ' + max + ' caracteres.');
  }
  return value.trim();
}

function option(value, values, label) {
  if (!values.includes(value)) fail(422, 'Selecione ' + label + ' válido.');
  return value;
}

function register(body, first) {
  const email = field(body.email, 'E-mail', 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(422, 'Informe um e-mail válido.');
  const name = field(body.name, 'Nome', 100, 2);
  if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) {
    fail(422, 'A senha deve ter de 12 a 128 caracteres.');
  }
  const role = first ? 'admin' : option(body.role, Object.keys(roles), 'um perfil');
  const sector = option(body.sector, sectors, 'um setor');
  if (store.userExists(email)) fail(409, 'Este e-mail já está cadastrado.');
  return store.addUser({ email, name, sector, role }, body.password);
}

function setSession(res, token) {
  res.setHeader('Set-Cookie', 'eam_session=' + token + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' +
    (token ? 43200 : 0) + (secure ? '; Secure' : ''));
}

function nextProtocol(tickets, now) {
  const year = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(now));
  const prefix = 'CH-' + year + '-';
  const last = tickets.reduce((max, ticket) => ticket.id.startsWith(prefix) ? Math.max(max, Number(ticket.id.slice(prefix.length))) : max, 0);
  return prefix + String(last + 1).padStart(3, '0');
}

function createTicket(user, body) {
  const category = store.categories().find(item => item.id === body.categoryId);
  if (!category) fail(422, 'Selecione uma categoria válida.');
  const draft = {
    title: field(body.title, 'Assunto', 140, 3),
    local: field(body.local, 'Local', 160, 2),
    description: field(body.description ?? '', 'Detalhes', 2000, 0),
    categoryId: category.id
  };
  const tickets = store.tickets();
  const matches = duplicateCandidates(tickets, { ...draft, sector: category.sector });
  const confirmation = matches.length ? createHash('sha256').update(matches.map(ticket => ticket.id).sort().join(',')).digest('hex') : '';
  if (confirmation && body.confirmation !== confirmation) {
    // Protocols are returned only for tickets the caller can open.
    fail(409, 'Já existem chamados ativos semelhantes neste local.', {
      count: matches.length, protocols: matches.filter(ticket => canSee(user, ticket)).map(ticket => ticket.id),
      confirmation
    });
  }
  const at = new Date().toISOString();
  const risk = body.risk === true || category.priority === 'Máxima';
  const ticket = {
    ...draft, id: nextProtocol(tickets, at), category: category.name, sector: category.sector, origin: user.sector,
    requester: user.id, priority: risk ? 'Máxima' : category.priority, risk, status: 'Aberto', owner: category.sector,
    createdAt: at, startedAt: null, resolvedAt: null, resolution: '', version: 1,
    history: [{ at, author: user.name, authorId: user.id, action: 'Abertura', to: 'Aberto',
      reason: 'Encaminhamento automático para ' + category.sector + (matches.length ? '. Possível duplicidade confirmada pelo solicitante.' : '') }]
  };
  store.addTicket(ticket);
  return ticket;
}

function updateTicket(user, id, body) {
  const current = store.ticket(id);
  if (!current || !canSee(user, current)) fail(404, 'Chamado não encontrado.');
  if (!canEdit(user, current)) fail(403, 'Este perfil não pode editar o chamado neste estado.');
  if (body.version !== current.version) fail(409, 'O chamado foi alterado. Feche o formulário e abra a versão atual.');
  const status = option(body.status, [current.status, ...transitions[current.status]], 'um status');
  if (status === 'Cancelado' && !manages(user)) fail(403, 'Somente a gestão pode cancelar chamados.');
  const sector = manages(user) ? option(body.sector, sectors, 'um setor') : current.sector;
  const owner = field(body.owner, 'Responsável', 100, 2);
  const priority = manages(user) && !current.risk ? option(body.priority, priorities, 'uma prioridade') : current.priority;
  const reason = field(body.reason, 'Justificativa', 1200, 3);
  if (status === current.status && sector === current.sector && owner === current.owner && priority === current.priority) {
    fail(422, 'Altere o status, o responsável, o setor ou a prioridade antes de salvar.');
  }
  const resolution = status === 'Resolvido' ? field(body.resolution, 'Descrição da solução', 2000, 3) : '';
  const at = new Date().toISOString();
  const event = {
    at, author: user.name, authorId: user.id, action: status === 'Resolvido' ? 'Resolução' : 'Atualização',
    from: current.status, to: status, reason, resolution,
    oldOwner: current.owner, owner, oldSector: current.sector, sector, oldPriority: current.priority, priority
  };
  const ticket = {
    ...current, status, sector, owner, priority, risk: priority === 'Máxima', resolution,
    startedAt: current.startedAt || (status === 'Em atendimento' ? at : null),
    resolvedAt: status === 'Resolvido' ? at : null, version: current.version + 1,
    history: [...current.history, event]
  };
  if (!store.updateTicket(ticket, current.version)) fail(409, 'O chamado foi alterado. Abra a versão atual.');
  return ticket;
}

function publicPanel() {
  const tickets = store.tickets().filter(ticket => !isClosed(ticket));
  return {
    sectors: sectors.map(name => {
      const active = tickets.filter(ticket => ticket.sector === name);
      return {
        name, active: active.length, risks: active.filter(ticket => ticket.risk).length,
        waiting: active.filter(ticket => ['Aberto', 'Em triagem', 'Atribuído'].includes(ticket.status)).length,
        attending: active.filter(ticket => ticket.status === 'Em atendimento').length,
        pending: active.filter(ticket => ticket.status === 'Aguardando informações').length
      };
    })
  };
}

async function api(req, res, url) {
  const route = req.method + ' ' + url.pathname;
  const token = req.headers.cookie?.match(/(?:^|;\s*)eam_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  const user = store.session(token);
  if (route === 'GET /api/monitor') return json(res, 200, publicPanel());
  if (route === 'GET /api/session') {
    return json(res, 200, { user, demo, setup: !store.users().length && localAddress(req.socket.remoteAddress), sectors, roles });
  }
  if (route === 'POST /api/login' || route === 'POST /api/demo' || route === 'POST /api/setup') {
    const input = await readBody(req);
    let account;
    if (route.endsWith('/setup')) {
      if (store.users().length || !localAddress(req.socket.remoteAddress)) fail(403, 'A configuração inicial foi concluída ou não está disponível neste endereço.');
      account = register(input, true);
    } else if (route.endsWith('/demo')) {
      account = store.demoUser(input.role);
    } else {
      const key = req.socket.remoteAddress;
      const now = Date.now();
      for (const [address, limit] of attempts) if (limit.until <= now) attempts.delete(address);
      const limit = attempts.get(key) || { count: 0, until: now + 60000 };
      if (limit.count >= 15) fail(429, 'Muitas tentativas. Aguarde um minuto.');
      limit.count++;
      attempts.set(key, limit);
      account = store.authenticate(field(input.email, 'E-mail', 160).toLowerCase(), typeof input.password === 'string' && input.password.length <= 128 ? input.password : '');
    }
    if (!account) fail(401, 'Credenciais inválidas ou demonstração indisponível.');
    store.endSession(token);
    setSession(res, store.startSession(account));
    return json(res, 200, { user: account });
  }
  if (route === 'POST /api/logout') {
    store.endSession(token);
    setSession(res, '');
    return json(res, 200, {});
  }
  if (!user) fail(401, 'Entre para acessar o ambiente interno.');
  if (route === 'GET /api/workspace') {
    const tickets = store.tickets().filter(ticket => canSee(user, ticket)).map(ticket => {
      const editable = canEdit(user, ticket);
      const history = !manages(user) && user.role === 'solicitante'
        ? ticket.history.map(({ at, action, from, to }) => ({ at, action, from, to }))
        : ticket.history;
      return { ...ticket, history, editable };
    });
    return json(res, 200, { tickets, categories: store.categories(), transitions });
  }
  if (route === 'POST /api/tickets') return json(res, 201, createTicket(user, await readBody(req)));
  const ticketRoute = url.pathname.match(/^\/api\/tickets\/(CH-\d{4}-\d+)$/);
  if (req.method === 'PATCH' && ticketRoute) {
    return json(res, 200, updateTicket(user, ticketRoute[1], await readBody(req)));
  }
  if (url.pathname === '/api/users') {
    if (user.role !== 'admin') fail(403, 'Apenas administradores podem gerir acessos.');
    if (req.method === 'GET') return json(res, 200, store.users());
    if (req.method === 'POST') return json(res, 201, register(await readBody(req), false));
  }
  if (route === 'POST /api/categories') {
    if (user.role !== 'admin') fail(403, 'Apenas administradores podem configurar o encaminhamento.');
    const body = await readBody(req);
    const existing = body.id && store.categories().find(item => item.id === body.id);
    if (body.id && !existing) fail(404, 'Categoria não encontrada.');
    const category = {
      id: existing?.id || randomUUID(), name: field(body.name, 'Categoria', 80, 2),
      sector: option(body.sector, sectors, 'um setor'),
      priority: existing?.id === 'risco' ? 'Máxima' : option(body.priority, priorities, 'uma prioridade')
    };
    store.saveCategory(category);
    return json(res, 200, category);
  }
  fail(404, 'Rota não encontrada.');
}

http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try {
    const origin = req.headers.origin;
    if (!['GET', 'HEAD'].includes(req.method) && (req.headers['sec-fetch-site'] === 'cross-site' || (origin && new URL(origin).host !== req.headers.host))) {
      fail(403, 'Origem não autorizada.');
    }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname === '/favicon.ico' && ['GET', 'HEAD'].includes(req.method)) return res.writeHead(204).end();
    const asset = Object.hasOwn(assets, url.pathname) && assets[url.pathname];
    if (!asset || !['GET', 'HEAD'].includes(req.method)) fail(404, 'Página não encontrada.');
    const data = await readFile(path.join(__dirname, '..', 'client', asset[0]));
    res.writeHead(200, { 'Content-Type': asset[1] + '; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (error) {
    if (!error.status) console.error(error);
    if (!res.headersSent) json(res, error.status || 500, { message: error.status ? error.message : 'Não foi possível concluir a operação.', ...error.extra });
  }
}).listen(port, host, () => console.log('INTEGRA EAM: http://' + host + ':' + port + (demo ? ' (demonstração)' : '')));
