const sectors = ['Manutenção', 'Zeladoria', 'Vigilância', 'Administração'];
const priorities = ['Normal', 'Alta', 'Máxima'];
const transitions = {
  Aberto: ['Em triagem', 'Atribuído', 'Em atendimento', 'Aguardando informações', 'Cancelado'],
  'Em triagem': ['Atribuído', 'Em atendimento', 'Aguardando informações', 'Cancelado'],
  Atribuído: ['Em atendimento', 'Aguardando informações', 'Cancelado'],
  'Em atendimento': ['Aguardando informações', 'Resolvido', 'Cancelado'],
  'Aguardando informações': ['Em triagem', 'Atribuído', 'Em atendimento', 'Cancelado'],
  Resolvido: [], Cancelado: []
};
const roles = { solicitante: 'Solicitante', executor: 'Executor', gestor: 'Gestor', admin: 'Administrador' };
const cookieName = 'eam_session';
const sessionLength = 12 * 60 * 60 * 1000;

function fail(status, message, detail = {}) { throw Object.assign(new Error(message), { status, detail }); }
function response(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}
function field(value, label, max, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(422, label + ' inválido.');
  return value.trim();
}
function option(value, choices, label) {
  if (!choices.includes(value)) fail(422, 'Selecione ' + label + ' válido.');
  return value;
}
function profile(user) { return user && { id: user.id, name: user.name, email: user.email, role: user.role, sector: user.sector }; }
function closed(ticket) { return ['Resolvido', 'Cancelado'].includes(ticket.status); }
function manages(user) { return ['admin', 'gestor'].includes(user.role); }
function canSee(user, ticket) {
  return manages(user) || (user.role === 'executor' && ticket.sector === user.sector) || ticket.requester === user.id;
}
function canEdit(user, ticket) {
  return !closed(ticket) && (manages(user) || (user.role === 'executor' && ticket.sector === user.sector));
}
function normalize(text) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').replace(/[^\p{L}\d]+/gu, ' ').trim();
}
function duplicateCandidates(tickets, draft) {
  const location = normalize(draft.local), title = normalize(draft.title);
  return tickets.filter(ticket => {
    const other = normalize(ticket.title);
    return !closed(ticket) && normalize(ticket.local) === location &&
      (ticket.categoryId === draft.categoryId || (ticket.sector === draft.sector && (other.includes(title) || title.includes(other))));
  });
}
async function readBody(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail(415, 'Envie os dados em JSON.');
  const text = await request.text();
  if (text.length > 32768) fail(413, 'Os dados excedem o limite permitido.');
  try {
    const value = JSON.parse(text);
    if (!value || Array.isArray(value) || typeof value !== 'object') fail(400, 'Dados inválidos.');
    return value;
  } catch (error) { if (error.status) throw error; fail(400, 'Dados inválidos.'); }
}
async function hash(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const result = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 310000, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(result)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function register(db, body, first = false) {
  const email = field(body.email, 'E-mail', 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(422, 'Informe um e-mail válido.');
  const name = field(body.name, 'Nome', 100, 2);
  if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) fail(422, 'A senha deve ter entre 12 e 128 caracteres.');
  const role = first ? 'admin' : option(body.role, Object.keys(roles), 'perfil');
  const sector = option(body.sector, sectors, 'setor');
  const salt = [...crypto.getRandomValues(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const password = await passwordHash(body.password, salt);
  if (first) {
    const result = await db.batch([
      db.prepare('INSERT INTO users (name,email,role,sector,salt,password) SELECT ?,?,?,?,?,? WHERE (SELECT complete FROM setup_state WHERE id=1)=0').bind(name, email, role, sector, salt, password),
      db.prepare('UPDATE setup_state SET complete=1 WHERE id=1 AND complete=0')
    ]);
    if (!result[0].meta.changes) fail(403, 'A configuração inicial já foi concluída.');
  } else {
    await db.prepare('INSERT INTO users (name,email,role,sector,salt,password) VALUES (?,?,?,?,?,?)').bind(name, email, role, sector, salt, password).run();
  }
  return profile(await db.prepare('SELECT id,name,email,role,sector FROM users WHERE email=?').bind(email).first());
}
async function userFor(request, db) {
  const match = request.headers.get('cookie')?.match(/(?:^|;\s*)eam_session=([a-f0-9]{64})(?:;|$)/);
  if (!match) return null;
  const tokenHash = await hash(match[1]);
  const record = await db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires>?').bind(tokenHash, Date.now()).first();
  return record ? { ...record, profile: profile(record), tokenHash } : null;
}
function cookie(token, secure) {
  return cookieName + '=' + (token || '') + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + (token ? 43200 : 0) + (secure ? '; Secure' : '');
}
async function allTickets(db) {
  const { results } = await db.prepare('SELECT data FROM tickets ORDER BY created_at DESC').all();
  return results.map(row => JSON.parse(row.data));
}
async function createTicket(db, user, body) {
  const category = JSON.parse((await db.prepare('SELECT data FROM categories WHERE id=?').bind(body.categoryId).first())?.data || 'null');
  if (!category) fail(422, 'Selecione uma categoria válida.');
  const draft = { title: field(body.title, 'Assunto', 140, 3), local: field(body.local, 'Local', 160, 2), description: field(body.description ?? '', 'Detalhes', 2000, 0), categoryId: category.id };
  const tickets = await allTickets(db);
  const duplicates = duplicateCandidates(tickets, { ...draft, sector: category.sector });
  const confirmation = await hash(duplicates.map(ticket => ticket.id).sort().join(','));
  if (duplicates.length && body.confirmation !== confirmation) {
    fail(409, 'Já existem chamados ativos semelhantes neste local.', { confirmation, count: duplicates.length, protocols: duplicates.filter(ticket => canSee(user, ticket)).map(ticket => ticket.id) });
  }
  const at = new Date().toISOString();
  const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(at)));
  const prefix = 'CH-' + year + '-';
  const sequence = await db.prepare('INSERT INTO ticket_sequences (year,last_number) VALUES (?,1) ON CONFLICT(year) DO UPDATE SET last_number=last_number+1 RETURNING last_number').bind(year).first();
  const risk = body.risk === true || category.priority === 'Máxima';
  const ticket = { ...draft, id: prefix + String(sequence.last_number).padStart(3, '0'), category: category.name, sector: category.sector, origin: user.sector,
    requester: user.id, priority: risk ? 'Máxima' : category.priority, risk, status: 'Aberto', owner: category.sector,
    createdAt: at, startedAt: null, resolvedAt: null, resolution: '', version: 1,
    history: [{ at, author: user.name, authorId: user.id, action: 'Abertura', to: 'Aberto', reason: 'Encaminhamento automático para ' + category.sector }] };
  await db.prepare('INSERT INTO tickets (id,version,created_at,data) VALUES (?,?,?,?)').bind(ticket.id, ticket.version, at, JSON.stringify(ticket)).run();
  return ticket;
}
async function updateTicket(db, user, id, body) {
  const record = await db.prepare('SELECT version,data FROM tickets WHERE id=?').bind(id).first();
  const current = record && JSON.parse(record.data);
  if (!current || !canSee(user, current)) fail(404, 'Chamado não encontrado.');
  if (!canEdit(user, current)) fail(403, 'Este perfil não pode editar o chamado neste estado.');
  if (body.version !== record.version) fail(409, 'O chamado foi alterado. Abra a versão atual.');
  const status = option(body.status, [current.status, ...transitions[current.status]], 'status');
  if (status === 'Cancelado' && !manages(user)) fail(403, 'Somente a gestão pode cancelar chamados.');
  const sector = manages(user) ? option(body.sector, sectors, 'setor') : current.sector;
  const owner = field(body.owner, 'Responsável', 100, 2);
  const priority = manages(user) && !current.risk ? option(body.priority, priorities, 'prioridade') : current.priority;
  const reason = field(body.reason, 'Justificativa', 1200, 3);
  const resolution = status === 'Resolvido' ? field(body.resolution, 'Descrição da solução', 2000, 3) : '';
  if (status === current.status && sector === current.sector && owner === current.owner && priority === current.priority) fail(422, 'Altere um campo antes de salvar.');
  const at = new Date().toISOString();
  const event = { at, author: user.name, authorId: user.id, action: status === 'Resolvido' ? 'Resolução' : 'Atualização', from: current.status, to: status,
    reason, resolution, oldOwner: current.owner, owner, oldSector: current.sector, sector, oldPriority: current.priority, priority };
  const ticket = { ...current, status, sector, owner, priority, risk: priority === 'Máxima', resolution,
    startedAt: current.startedAt || (status === 'Em atendimento' ? at : null), resolvedAt: status === 'Resolvido' ? at : null,
    version: record.version + 1, history: [...current.history, event] };
  const updated = await db.prepare('UPDATE tickets SET version=?,data=? WHERE id=? AND version=?').bind(ticket.version, JSON.stringify(ticket), id, record.version).run();
  if (!updated.meta.changes) fail(409, 'O chamado foi alterado. Abra a versão atual.');
  return ticket;
}

export async function onRequest({ request, env, params }) {
  const db = env.DB;
  const route = '/api/' + (Array.isArray(params.path) ? params.path.join('/') : params.path || '');
  const method = request.method;
  try {
    if (request.headers.get('origin') && new URL(request.headers.get('origin')).host !== new URL(request.url).host) fail(403, 'Origem não autorizada.');
    const account = await userFor(request, db);
    const user = account?.profile;
    if (method === 'GET' && route === '/api/session') {
      const setup = await db.prepare('SELECT complete FROM setup_state WHERE id=1').first();
      const result = await db.prepare('SELECT COUNT(*) AS total FROM users').first();
      return response({ user: user || null, setup: !setup.complete && !result.total, demo: false, sectors, roles });
    }
    if (method === 'POST' && route === '/api/setup') {
      const first = await register(db, await readBody(request), true);
      const token = [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('');
      await db.prepare('INSERT INTO sessions (token_hash,user_id,expires) VALUES (?,?,?)').bind(await hash(token), first.id, Date.now() + sessionLength).run();
      return response({ user: first }, 200, { 'Set-Cookie': cookie(token, new URL(request.url).protocol === 'https:') });
    }
    if (method === 'POST' && route === '/api/login') {
      const body = await readBody(request), email = field(body.email, 'E-mail', 160).toLowerCase();
      if (typeof body.password !== 'string' || body.password.length > 128) fail(401, 'Credenciais inválidas.');
      const record = await db.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
      const calculated = await passwordHash(body.password, record?.salt || 'invalid-login-padding');
      if (!record || calculated !== record.password) fail(401, 'Credenciais inválidas.');
      const token = [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('');
      await db.prepare('DELETE FROM sessions WHERE expires<=?').bind(Date.now()).run();
      await db.prepare('INSERT INTO sessions (token_hash,user_id,expires) VALUES (?,?,?)').bind(await hash(token), record.id, Date.now() + sessionLength).run();
      return response({ user: profile(record) }, 200, { 'Set-Cookie': cookie(token, new URL(request.url).protocol === 'https:') });
    }
    if (method === 'POST' && route === '/api/logout') {
      if (account) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(account.tokenHash).run();
      return response({}, 200, { 'Set-Cookie': cookie('', new URL(request.url).protocol === 'https:') });
    }
    if (method === 'GET' && route === '/api/monitor') {
      const tickets = (await allTickets(db)).filter(ticket => !closed(ticket));
      return response({ sectors: sectors.map(name => {
        const list = tickets.filter(ticket => ticket.sector === name);
        return { name, active: list.length, risks: list.filter(ticket => ticket.risk).length,
          waiting: list.filter(ticket => ['Aberto','Em triagem','Atribuído'].includes(ticket.status)).length,
          attending: list.filter(ticket => ticket.status === 'Em atendimento').length,
          pending: list.filter(ticket => ticket.status === 'Aguardando informações').length };
      }) });
    }
    if (!user) fail(401, 'Entre para acessar o ambiente interno.');
    if (method === 'GET' && route === '/api/workspace') {
      const tickets = (await allTickets(db)).filter(ticket => canSee(user, ticket)).map(ticket => ({ ...ticket, editable: canEdit(user, ticket) }));
      const { results } = await db.prepare('SELECT data FROM categories ORDER BY rowid').all();
      return response({ tickets, categories: results.map(row => JSON.parse(row.data)), transitions });
    }
    if (method === 'POST' && route === '/api/tickets') return response(await createTicket(db, user, await readBody(request)), 201);
    const ticketRoute = route.match(/^\/api\/tickets\/(CH-\d{4}-\d+)$/);
    if (method === 'PATCH' && ticketRoute) return response(await updateTicket(db, user, ticketRoute[1], await readBody(request)));
    if (route === '/api/users') {
      if (user.role !== 'admin') fail(403, 'Apenas administradores podem gerir acessos.');
      if (method === 'GET') {
        const { results } = await db.prepare('SELECT id,name,email,role,sector FROM users ORDER BY name').all();
        return response(results);
      }
      if (method === 'POST') return response(await register(db, await readBody(request)), 201);
    }
    if (method === 'POST' && route === '/api/categories') {
      if (user.role !== 'admin') fail(403, 'Apenas administradores podem configurar categorias.');
      const body = await readBody(request);
      const category = { id: body.id || crypto.randomUUID(), name: field(body.name, 'Categoria', 80, 2),
        sector: option(body.sector, sectors, 'setor'), priority: body.id === 'risco' ? 'Máxima' : option(body.priority, priorities, 'prioridade') };
      await db.prepare('INSERT INTO categories (id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind(category.id, JSON.stringify(category)).run();
      return response(category);
    }
    fail(404, 'Rota não encontrada.');
  } catch (error) {
    if (!error.status) console.error(error);
    return response({ message: error.status ? error.message : 'Não foi possível concluir a operação.', ...error.detail }, error.status || 500);
  }
}
