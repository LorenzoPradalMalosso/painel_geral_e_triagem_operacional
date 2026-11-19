const sectors = ['Manutenção', 'Zeladoria', 'Vigilância', 'Administração'];
const priorities = ['Normal', 'Alta', 'Máxima'];
const transitions = {
  Aberto: ['Em triagem', 'Atribuído', 'Em atendimento', 'Aguardando informações', 'Cancelado'],
  'Em triagem': ['Atribuído', 'Em atendimento', 'Aguardando informações', 'Cancelado'],
  Atribuído: ['Em atendimento', 'Aguardando informações', 'Cancelado'],
  'Em atendimento': ['Aguardando informações', 'Resolvido', 'Cancelado'],
  'Aguardando informações': ['Em triagem', 'Atribuído', 'Em atendimento', 'Cancelado'],
  Resolvido: [],
  Cancelado: []
};
const roles = {
  solicitante: 'Solicitante', executor: 'Executor', gestor: 'Gestor', admin: 'Administrador'
};
const categories = [
  ['eletrica', 'Manutenção elétrica', 'Manutenção', 'Normal'],
  ['predial', 'Manutenção predial', 'Manutenção', 'Normal'],
  ['limpeza', 'Limpeza e conservação', 'Zeladoria', 'Normal'],
  ['acesso', 'Acesso e segurança', 'Vigilância', 'Alta'],
  ['administrativa', 'Solicitação administrativa', 'Administração', 'Normal'],
  ['risco', 'Risco de acidente', 'Manutenção', 'Máxima'],
  ['outro', 'Outros serviços', 'Administração', 'Normal']
].map(([id, name, sector, priority]) => ({ id, name, sector, priority }));
const isClosed = ticket => ['Resolvido', 'Cancelado'].includes(ticket.status);
const manages = user => ['gestor', 'admin'].includes(user.role);
function canSee(user, ticket) {
  return manages(user) || (user.role === 'executor' && user.sector === ticket.sector) || ticket.requester === user.id;
}
function canEdit(user, ticket) {
  return !isClosed(ticket) && (manages(user) || (user.role === 'executor' && user.sector === ticket.sector));
}

function normalized(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\d]+/gu, ' ').trim();
}

function duplicateCandidates(tickets, draft) {
  const location = normalized(draft.local);
  const title = normalized(draft.title);
  if (!location || !title) return [];
  return tickets.filter(ticket => {
    const other = normalized(ticket.title);
    return !isClosed(ticket) && normalized(ticket.local) === location &&
      (ticket.categoryId === draft.categoryId || (ticket.sector === draft.sector && other && (other.includes(title) || title.includes(other))));
  });
}

function demoTickets() {
  const before = minutes => new Date(Date.now() - minutes * 60000).toISOString();
  const samples = [
    ['Vazamento de fluido térmico', 'Oficina Mecânica · Bloco C', 'risco', 'Máxima', 'Em triagem', null, 25],
    ['Catraca eletrônica travada', 'Portaria principal', 'acesso', 'Alta', 'Atribuído', 'Rafael Rocha', 65],
    ['Óleo no corredor de cargas', 'Galpão Logístico · Portão 03', 'limpeza', 'Alta', 'Em atendimento', 'Maria Antônia', 110],
    ['Disjuntor do quadro secundário', 'Laboratório de Automação · Sala 102', 'eletrica', 'Normal', 'Resolvido', 'Rodrigo Silva', 400],
    ['Instalação de ponto de rede', 'Secretaria Acadêmica · Mesa 04', 'administrativa', 'Normal', 'Em atendimento', 'Lucas Peixoto', 180]
  ];
  return samples.map(([title, local, categoryId, priority, status, owner, minutes], i) => {
    const category = categories.find(item => item.id === categoryId);
    const createdAt = before(minutes);
    const startedAt = ['Em atendimento', 'Resolvido'].includes(status) ? before(minutes - [0, 0, 28, 16, 22][i]) : null;
    const resolvedAt = status === 'Resolvido' ? before(minutes - 132) : null;
    const resolution = resolvedAt ? 'Disjuntor substituído e teste de carga validado.' : '';
    const history = [{ at: createdAt, author: 'Ana Costa', action: 'Abertura', to: 'Aberto', reason: 'Encaminhamento automático para ' + category.sector }];
    if (startedAt) history.push({ at: startedAt, author: owner, action: 'Início do atendimento', from: 'Atribuído', to: 'Em atendimento', reason: 'Atendimento iniciado.' });
    if (resolvedAt) history.push({ at: resolvedAt, author: owner, action: 'Resolução', from: 'Em atendimento', to: 'Resolvido', reason: 'Serviço concluído.', resolution });
    if (!startedAt) history.push({ at: before(minutes - 5), author: 'Gabriel Ribeiro', action: status === 'Em triagem' ? 'Triagem' : 'Atribuição', from: 'Aberto', to: status, reason: 'Ocorrência recebida pela equipe.' });
    return { id: 'CH-2026-' + String(92 - i).padStart(3, '0'), title, local, categoryId, category: category.name, sector: category.sector, origin: 'Administração', requester: 4, priority, risk: priority === 'Máxima', status, owner: owner || category.sector, createdAt, startedAt, resolvedAt, resolution, history, version: 1 };
  });
}
module.exports = { sectors, priorities, transitions, roles, categories, isClosed, manages, canSee, canEdit, duplicateCandidates, demoTickets };
