// ===== Dados padrão da Ficha da Vida =====
const ATTRS = {
  fisico:   { nome: 'Físico',   icon: '⚔️', cor: '#ef4444' },
  mental:   { nome: 'Mental',   icon: '📘', cor: '#3b82f6' },
  criativo: { nome: 'Criativo', icon: '🎨', cor: '#a855f7' },
  prog:     { nome: 'Programação', icon: '💻', cor: '#22c55e' }
};
const STREAK_ATTRS = ['fisico', 'mental', 'criativo'];

// freq: 'daily' | 'weekly' (target = vezes por semana)
// mandatory: conta para a sequência / baú diário
const DEFAULT_MISSIONS = [
  { id: 'academia', nome: 'Academia (nem que seja 15 min de cardio)', attr: 'fisico', freq: 'weekly', target: 4, mandatory: true, minimo: 'Movimento leve 10 min (caminhada/alongamento)', minutos: 15 },
  { id: 'jiu', nome: 'Treino de Jiu-Jitsu', attr: 'fisico', freq: 'weekly', target: 2, mandatory: false, minimo: 'Revisar 1 técnica em vídeo', minutos: 60 },
  { id: 'ingles', nome: 'Aula de inglês (20 min)', attr: 'mental', freq: 'daily', mandatory: true, minimo: '5 min de inglês', minutos: 20 },
  { id: 'leitura', nome: 'Ler 5 páginas', attr: 'mental', freq: 'daily', mandatory: true, minimo: 'Ler 1 página', minutos: 10 },
  { id: 'anbima', nome: 'Estudar para o certificado ANBIMA', attr: 'mental', freq: 'daily', mandatory: true, minimo: '5 min de revisão', minutos: 20 },
  { id: 'concurso', nome: 'Concursos de banco (BB, Caixa, BASA, BNB) 20 min', attr: 'mental', freq: 'daily', mandatory: false, minimo: '5 questões', minutos: 20 },
  { id: 'desenho', nome: 'Desenho / pixel art (7 conceitos)', attr: 'criativo', freq: 'daily', mandatory: false, minimo: 'Rascunho de 5 min', minutos: 20 },
  { id: 'modelagem', nome: 'Modelagem 3D pixelizada (estilo Ultrakill)', attr: 'criativo', freq: 'daily', mandatory: false, minimo: 'Ver 1 tutorial curto', minutos: 30 },
  { id: 'narrativa', nome: 'Narrativa e game design (1 h)', attr: 'criativo', freq: 'weekly', target: 1, mandatory: true, minimo: 'Anotar 1 ideia', minutos: 60 },
  { id: 'programacao', nome: 'Programação (Java, Python, JS, C#)', attr: 'prog', freq: 'daily', mandatory: false, minimo: 'Resolver 1 exercício', minutos: 30 }
];

const BONUS_POOL = [
  { t: 'Faça 10 flexões', attr: 'fisico' },
  { t: 'Caminhada de 20 minutos', attr: 'fisico' },
  { t: '30 agachamentos', attr: 'fisico' },
  { t: 'Prancha de 1 minuto', attr: 'fisico' },
  { t: 'Leia 10 páginas extras', attr: 'mental' },
  { t: 'Assista 1 vídeo em inglês sem legenda', attr: 'mental' },
  { t: 'Resolva 10 questões de concurso', attr: 'mental' },
  { t: 'Aprenda 10 palavras novas em inglês', attr: 'mental' },
  { t: 'Desenhe por 15 minutos', attr: 'criativo' },
  { t: 'Faça uma pixel art 16x16', attr: 'criativo' },
  { t: 'Escreva 1 parágrafo da sua história', attr: 'criativo' },
  { t: 'Esboce 1 personagem', attr: 'criativo' },
  { t: 'Resolva 1 desafio de lógica (código)', attr: 'prog' },
  { t: 'Automatize uma tarefa pequena com Python', attr: 'prog' },
  { t: 'Leia sobre 1 conceito de cibersegurança', attr: 'prog' }
];

const DEFAULT_LISTS = {
  jogos: ['1 partida de Ultrakill', '30 min de Minecraft', '1 hora de jogo livre', '1 partida de Roblox com amigos', 'Jogo indie da biblioteca'],
  desenhos: ['Cubo em perspectiva', 'Uma maçã com sombra', 'Espada em pixel art 16x16', 'Slime em pixel art', 'Estudo de mão', 'Rosto de frente', 'Árvore simples', 'Baú de tesouro em pixel art', 'Personagem chibi'],
  lazer: ['1 episódio de anime', '1 capítulo de mangá', 'Um filme', 'Lanche especial']
};

// tipo: 'tempo' | 'real' | 'protetor' | 'bau' | 'folga'
const DEFAULT_SHOP = [
  { id: 's1', nome: '1 hora de jogo livre', preco: 20, tipo: 'tempo', reais: 0 },
  { id: 's2', nome: '1 episódio ou filme', preco: 15, tipo: 'tempo', reais: 0 },
  { id: 's3', nome: 'Dormir até mais tarde no fim de semana', preco: 30, tipo: 'tempo', reais: 0 },
  { id: 's4', nome: '🧊 Bloqueio de ofensiva', preco: 50, tipo: 'protetor', reais: 0 },
  { id: 's5', nome: '🏖️ Dia de folga (protege todas as sequências hoje)', preco: 80, tipo: 'folga', reais: 0 },
  { id: 's6', nome: '🎁 Baú extra', preco: 25, tipo: 'bau', reais: 0 },
  { id: 's7', nome: 'Lanche ou delivery', preco: 40, tipo: 'real', reais: 30 },
  { id: 's8', nome: 'Um mangá novo', preco: 60, tipo: 'real', reais: 35 },
  { id: 's9', nome: 'Jogo barato ou skin', preco: 120, tipo: 'real', reais: 50 },
  { id: 's10', nome: 'Item maior (periférico, curso...)', preco: 500, tipo: 'real', reais: 200 }
];

// Testes de nível: índice = nível atual (1 -> 2 é o índice 0)
const DEFAULT_TESTS = {
  fisico: [
    { req: '4 semanas de academia', teste: '30 flexões + 30 agachamentos + 30 abdominais + 1 h de bike' },
    { req: '8 semanas de academia', teste: '40 flexões + 50 agachamentos + 40 abdominais + correr 3 km sem parar' },
    { req: 'Voltar ao Jiu-Jitsu (4 treinos)', teste: '50 flexões + 70 agachamentos + 50 abdominais + 5 barras' },
    { req: '3 meses de Jiu-Jitsu', teste: 'Correr 5 km + 10 barras + aula inteira sem pausa' }
  ],
  mental: [
    { req: '4 semanas de inglês e leitura', teste: 'Terminar 1 livro/mangá + simulado de concurso com 50%+' },
    { req: 'Concluir os módulos da ANBIMA', teste: 'Simulado da ANBIMA com 70%+' },
    { req: 'Certificado ANBIMA conquistado', teste: 'Simulado BB/Caixa com 60%+ e entender 1 vídeo em inglês sem legenda' },
    { req: '3 meses de estudo constante', teste: 'Simulado completo com 70%+ e escrever um texto curto em inglês' }
  ],
  criativo: [
    { req: 'Estudar os 7 conceitos de desenho', teste: '1 objeto em perspectiva + 1 pixel art 16x16' },
    { req: '4 semanas de prática', teste: 'Pixel art 32x32 com sombra + 1 personagem simples' },
    { req: 'Começar modelagem 3D', teste: 'Modelo 3D low-poly pixelizado (estilo Ultrakill)' },
    { req: '1 h semanal de narrativa', teste: 'Mini-GDD de 1 página + personagem 3D ou pixel art animado' }
  ],
  prog: [
    { req: 'Base em Python', teste: 'Um script que automatize algo do seu dia' },
    { req: 'JavaScript', teste: 'Uma página web interativa publicada' },
    { req: 'Java ou C#', teste: 'Um projeto com banco de dados' },
    { req: 'Especialização (Ciber ou RPA)', teste: 'Um projeto entregue para alguém de verdade' }
  ]
};

const DEFAULT_MARCOS = [
  { id: 'anbima_cert', nome: 'Certificado ANBIMA conquistado', attr: 'mental' },
  { id: 'jiu_volta', nome: 'Voltei ao Jiu-Jitsu', attr: 'fisico' },
  { id: 'pixel1', nome: 'Primeira pixel art', attr: 'criativo' },
  { id: 'modelo1', nome: 'Primeiro modelo 3D', attr: 'criativo' },
  { id: 'p_python', nome: 'Python: projeto pequeno pronto', attr: 'prog', grupo: 'Base' },
  { id: 'p_js', nome: 'JavaScript: projeto pequeno pronto', attr: 'prog', grupo: 'Base' },
  { id: 'p_java', nome: 'Java: projeto pequeno pronto', attr: 'prog', grupo: 'Base' },
  { id: 'p_cs', nome: 'C#: projeto pequeno pronto', attr: 'prog', grupo: 'Base' },
  { id: 'p_cyber', nome: '🛡️ Trilha de Cibersegurança concluída', attr: 'prog', grupo: 'Especialização' },
  { id: 'p_rpa', nome: '🤖 Primeira automação RPA funcionando', attr: 'prog', grupo: 'Especialização' },
  { id: 'p_venda', nome: '💰 Mercenário: primeiro projeto vendido', attr: 'prog', grupo: 'Final' }
];

const BOSSES = [
  { nome: 'Dragão da Procrastinação', emoji: '🐉', frame: 'dragao' },
  { nome: 'Lich do Sono Atrasado', emoji: '💀', frame: 'lich' },
  { nome: 'Hidra das Distrações', emoji: '🐍', frame: 'hidra' },
  { nome: 'Golem da Preguiça', emoji: '🗿', frame: 'golem' },
  { nome: 'Sombra da Dúvida', emoji: '👤', frame: 'sombra' },
  { nome: 'Rainha do Gelo da Rotina', emoji: '❄️', frame: 'gelo' },
  { nome: 'Titã da Tempestade', emoji: '⛈️', frame: 'tempestade' },
  { nome: 'Fênix do Recomeço', emoji: '🔥', frame: 'fenix' }
];

const FRAMES = {
  none: 'Sem moldura', bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro',
  dragao: 'Chamas do Dragão', lich: 'Ossos do Lich', hidra: 'Escamas da Hidra', golem: 'Pedra do Golem',
  sombra: 'Névoa Sombria', gelo: 'Cristal de Gelo', tempestade: 'Raios da Tempestade', fenix: 'Asas da Fênix'
};

const TIER_NAMES = ['Bronze', 'Prata', 'Ouro', 'Lendário'];

// avatares em pixel art (grade de caracteres -> cores)
const AVATARS = {
  cavaleiro: { pal: { a: '#94a3b8', b: '#475569', c: '#fde68a', d: '#1e293b', e: '#ef4444' }, g: [
    '...eee....', '..aaaaa...', '.aaaaaaa..', '.abddbda..', '.aaaaaaa..', '..aaaaa...', '.bbaaabb..', 'bbbaaabbb.', 'b.bbbbb.b.', '..bb.bb...'] },
  mago: { pal: { a: '#7c3aed', b: '#fde68a', c: '#fcd34d', d: '#1e293b', e: '#e5e7eb' }, g: [
    '....a.....', '...aaa....', '..aacaa...', '.aaaaaaa..', '..bbbbb...', '..bdbdb...', '..beeeb...', '..aeeea...', '.aaaaaaa..', '.aa...aa..'] },
  ninja: { pal: { a: '#111827', b: '#f5d0a9', c: '#ef4444', d: '#374151' }, g: [
    '..aaaaa...', '.aaaaaaac.', '.abbbbba.c', '.aabaaba..', '.aaaaaaa..', '..aaaaa...', '.daaaaad..', 'dd.aaa.dd.', '...a.a....', '..aa.aa...'] },
  slime: { pal: { a: '#22c55e', b: '#86efac', c: '#14532d', d: '#ffffff' }, g: [
    '..........', '....aa....', '...abba...', '..aabbaa..', '.aaaaaaaa.', '.adcaadca.', 'aaaaaaaaaa', 'aaaacaaaaa', 'aaaaaaaaaa', '.aaaaaaaa.'] },
  robo: { pal: { a: '#60a5fa', b: '#1e3a8a', c: '#facc15', d: '#e5e7eb' }, g: [
    '....c.....', '....b.....', '.aaaaaaa..', '.adbdadb..', '.aaaaaaa..', '.abbbbba..', '..aaaaa...', '.daaaaad..', '.d.a.a.d..', '...b.b....'] },
  gato: { pal: { a: '#f97316', b: '#fed7aa', c: '#111827', d: '#fb7185' }, g: [
    '.a.....a..', '.aa...aa..', '.aaaaaaa..', '.acaaaca..', '.aaadaaa..', '..abbba...', '..aaaaa...', '.aaaaaaa..', '.aa.a.aa..', '.......aa.'] }
};

const GUIDE_QUESTIONS = {
  livro: ['Qual personagem ou ideia mais marcou?', 'Você recomendaria? Pra quem?', 'Uma frase ou cena que ficou na cabeça?'],
  teste: ['Qual parte foi mais difícil?', 'O que mudou desde o nível anterior?'],
  curso: ['O que você aprendeu de mais útil?', 'Como vai usar isso?'],
  obra: ['O que você faria diferente?', 'Qual técnica nova usou?'],
  projeto: ['Qual problema resolveu?', 'O que aprendeu de novo?'],
  treino: ['O que tornou esse treino marcante?', 'Como o corpo respondeu?'],
  filme: ['O que mais te marcou no filme?', 'Você assistiria de novo? Por quê?', 'Que ideia dele você levaria para as suas histórias?']
};
const CHRON_TYPES = {
  livro: '📖 Livro/Mangá', teste: '⚔️ Teste de nível', curso: '🎓 Curso/Certificado',
  obra: '🎨 Obra criativa', projeto: '💻 Projeto', treino: '🥋 Treino marcante', filme: '🎬 Filme/Série'
};
const MOODS = { suado: '😤 Suado', tranquilo: '😌 Tranquilo', impressionado: '🤯 Impressionado', arrastado: '😴 Arrastado' };

// ===== v1.2: Roleta =====
// dur: 'curto' | 'medio' | 'longo'
const DEFAULT_ROLETA = [
  { id: 'filmes', nome: 'Filmes', icon: '🎬', itens: [
    { t: 'Um filme de ficção científica', dur: 'longo' }, { t: 'Uma animação', dur: 'medio' }, { t: 'Um filme de ação', dur: 'longo' },
    { t: 'Um curta-metragem', dur: 'curto' }, { t: 'Um clássico que nunca viu', dur: 'longo' }, { t: 'Um filme de terror', dur: 'longo' }] },
  { id: 'desenhos', nome: 'Desenhos', icon: '🎨', itens: [
    { t: 'Espada', dur: 'curto' }, { t: 'Slime', dur: 'curto' }, { t: 'Baú de tesouro', dur: 'curto' }, { t: 'Personagem chibi', dur: 'medio' },
    { t: 'Rosto de frente', dur: 'medio' }, { t: 'Mão em pose', dur: 'medio' }, { t: 'Árvore', dur: 'curto' }, { t: 'Castelo', dur: 'longo' },
    { t: 'Monstro inventado', dur: 'medio' }, { t: 'Cenário de floresta', dur: 'longo' }] },
  { id: 'estilos', nome: 'Estilos (como desenhar)', icon: '🖌️', itens: [
    { t: 'Pixel art 16x16', dur: 'curto' }, { t: 'Pixel art 32x32', dur: 'medio' }, { t: 'Só 3 cores', dur: 'curto' }, { t: 'Em 10 minutos', dur: 'curto' },
    { t: 'Estilo Ultrakill (low-poly sujo)', dur: 'medio' }, { t: 'Só linhas, sem sombra', dur: 'curto' }, { t: 'Com sombra e luz', dur: 'medio' }, { t: 'Mão não dominante', dur: 'curto' }] },
  { id: 'jogos', nome: 'Jogos', icon: '🎮', itens: [
    { t: '1 partida de Ultrakill', dur: 'curto' }, { t: '30 min de Minecraft', dur: 'medio' }, { t: 'Roblox com amigos', dur: 'medio' }, { t: 'Jogo indie da biblioteca', dur: 'longo' }] },
  { id: 'livros', nome: 'Leituras', icon: '📚', itens: [
    { t: '1 capítulo de mangá', dur: 'curto' }, { t: 'Um conto curto', dur: 'curto' }, { t: 'Continuar o livro atual', dur: 'medio' }] }
];
const DUR = { curto: '⚡ Curto', medio: '⏳ Médio', longo: '🕰️ Longo' };
const MOOD_SCALE = { 5: '😄', 4: '🙂', 3: '😐', 2: '😔', 1: '😞' };

// ===== v1.3 =====
const MAX_FREEZES = 7;
const VIDEO_CAT = { id: 'videos', nome: 'Vídeos para mostrar', icon: '🎥', itens: [] };
const REF_TYPES = { manga: '📚 Mangá/HQ', serie: '📺 Série/Episódio', filme: '🎬 Filme', video: '🎥 Vídeo', arte: '🎨 Arte', livro: '📖 Livro', outro: '📌 Outro' };
