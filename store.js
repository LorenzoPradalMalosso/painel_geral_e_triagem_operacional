const { DatabaseSync } = require('node:sqlite');
const { randomBytes, createHash, scryptSync, timingSafeEqual } = require('node:crypto');
const { categories, demoTickets } = require('./domain');

const digest = token => createHash('sha256').update(token).digest('hex');
const hashPassword = (password, salt) => scryptSync(password, salt, 64);
const profile = ({ id, name, email, role, sector }) => ({ id, name, email, role, sector });
const sessionDuration = 12 * 60 * 60 * 1000;

function openStore(file, demo) {
  const db = new DatabaseSync(file, { timeout: 3000 });
  db.exec('PRAGMA journal_mode = WAL');
  db.exec([
    'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE, role TEXT, sector TEXT, salt TEXT, password TEXT)',
    'CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id INTEGER, expires INTEGER)',
    'CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, version INTEGER, data TEXT)',
    'CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, data TEXT)'
  ].join(';'));
  const statements = {
    addUser: db.prepare('INSERT INTO users(name,email,role,sector,salt,password) VALUES (?,?,?,?,?,?)'),
    getUser: db.prepare('SELECT * FROM users WHERE email = ?'),
    users: db.prepare('SELECT id,name,email,role,sector FROM users ORDER BY name'),
    session: db.prepare('SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE hash = ? AND expires > ?'),
    start: db.prepare('INSERT INTO sessions VALUES (?,?,?)'),
    end: db.prepare('DELETE FROM sessions WHERE hash = ?'),
    purge: db.prepare('DELETE FROM sessions WHERE expires <= ?'),
    tickets: db.prepare('SELECT data FROM tickets ORDER BY id DESC'),
    ticket: db.prepare('SELECT data FROM tickets WHERE id = ?'),
    addTicket: db.prepare('INSERT INTO tickets VALUES (?,?,?)'),
    updateTicket: db.prepare('UPDATE tickets SET version = ?, data = ? WHERE id = ? AND version = ?'),
    categories: db.prepare('SELECT data FROM categories ORDER BY rowid'),
    saveCategory: db.prepare('INSERT INTO categories VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data = excluded.data')
  };
  function addUser(user, password) {
    const salt = randomBytes(16).toString('hex');
    statements.addUser.run(user.name, user.email, user.role, user.sector, salt, hashPassword(password, salt).toString('hex'));
    return profile(statements.getUser.get(user.email));
  }

  if (!statements.categories.all().length) {
    for (const category of categories) statements.saveCategory.run(category.id, JSON.stringify(category));
  }
  const demoProfiles = [
    { name: 'Gabriel Ribeiro', email: 'admin@demo.local', role: 'admin', sector: 'Administração' },
    { name: 'Marcos Silva', email: 'executor@demo.local', role: 'executor', sector: 'Manutenção' },
    { name: 'Julia Almeida', email: 'gestor@demo.local', role: 'gestor', sector: 'Administração' },
    { name: 'Ana Costa', email: 'solicitante@demo.local', role: 'solicitante', sector: 'Administração' }
  ];
  if (demo) {
    for (const user of demoProfiles) addUser(user, randomBytes(32).toString('hex'));
    for (const ticket of demoTickets()) statements.addTicket.run(ticket.id, ticket.version, JSON.stringify(ticket));
  }

  return {
    addUser,
    userExists: email => Boolean(statements.getUser.get(email)),
    users: () => statements.users.all(),
    authenticate(email, password) {
      const record = statements.getUser.get(email);
      const actual = hashPassword(password, record?.salt || 'invalid-login-padding');
      return record && timingSafeEqual(actual, Buffer.from(record.password, 'hex')) ? profile(record) : null;
    },
    demoUser: role => {
      const record = demoProfiles.find(item => item.role === role);
      return demo && record ? profile(statements.getUser.get(record.email)) : null;
    },
    startSession(user) {
      const token = randomBytes(32).toString('hex');
      statements.purge.run(Date.now());
      statements.start.run(digest(token), user.id, Date.now() + sessionDuration);
      return token;
    },
    session: token => {
      const record = token && statements.session.get(digest(token), Date.now());
      return record ? profile(record) : null;
    },
    endSession: token => { if (token) statements.end.run(digest(token)); },
    tickets: () => statements.tickets.all().map(row => JSON.parse(row.data)),
    ticket: id => JSON.parse(statements.ticket.get(id)?.data || 'null'),
    addTicket: ticket => statements.addTicket.run(ticket.id, ticket.version, JSON.stringify(ticket)),
    updateTicket: (ticket, expected) => statements.updateTicket.run(ticket.version, JSON.stringify(ticket), ticket.id, expected).changes === 1,
    categories: () => statements.categories.all().map(row => JSON.parse(row.data)),
    saveCategory: category => statements.saveCategory.run(category.id, JSON.stringify(category))
  };
}

module.exports = { openStore };
