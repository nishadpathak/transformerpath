'use strict';

/* Localized editorial layer over the existing region census. Canonical company
 * records, notices and English URLs stay in their respective data pipelines. */
const ORIGIN = 'https://transformerpath.com';
const ROOT = '/directory/region/latin-america/';
const REVIEWED = '2026-11-25';
const PATHS = { en: ROOT, es: ROOT + 'es/', 'pt-BR': ROOT + 'pt-br/' };
const FILES = Object.fromEntries(Object.entries(PATHS).map(([lang, url]) => [lang, url.slice(1) + 'index.html']));
const NAMES = { en: 'English', es: 'Español', 'pt-BR': 'Português (Brasil)' };
const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const MARKETS = [
  { slug: 'argentina', name: ['Argentina', 'Argentina', 'Argentina'], buyer: 'CAMMESA', official: 'https://cammesawebqas.cammesa.com/7-fases-amba/' },
  { slug: 'brazil', name: ['Brazil', 'Brasil', 'Brasil'], buyer: 'Compras.gov.br', official: 'https://www.gov.br/compras/pt-br' },
  { slug: 'chile', name: ['Chile', 'Chile', 'Chile'], buyer: 'Mercado Público', official: 'https://www.mercadopublico.cl/Home' },
  { slug: 'colombia', name: ['Colombia', 'Colombia', 'Colômbia'], buyer: 'SECOP II', official: 'https://www.colombiacompra.gov.co/secop/secop-ii/busqueda-publica' },
  { slug: 'mexico', name: ['Mexico', 'México', 'México'], buyer: 'CFE', official: 'https://msc.cfe.mx/' },
  { slug: 'peru', name: ['Peru', 'Perú', 'Peru'], buyer: 'SEACE', official: 'https://www.gob.pe/7505' }
];

const SOURCES = [
  { country: 'brazil', date: '2026-11-23', dateLabel: ['23 Nov 2026', '23 nov. 2026', '23 nov. 2026'], source: 'TCP', url: 'https://www.tcp.com.br/tcp-conclui-instalacao-de-segundo-transformador-de-energia-eletrica/',
    title: ['Paranaguá terminal commissions a second 25 MVA transformer', 'La terminal de Paranaguá pone en servicio su segundo transformador de 25 MVA', 'Terminal de Paranaguá coloca em operação o segundo transformador de 25 MVA'],
    summary: ['TCP reports 50 MVA of installed capacity after the project. It did not disclose the transformer manufacturer.', 'TCP informa de 50 MVA de capacidad instalada tras el proyecto. No identifica al fabricante.', 'O TCP informa 50 MVA de capacidade instalada após a obra. O fabricante do transformador não foi divulgado.'] },
  { country: 'argentina', date: '2026-11-20', dateLabel: ['20 Nov 2026', '20 nov. 2026', '20 nov. 2026'], source: 'CAMMESA', url: MARKETS[0].official,
    title: ['Plomer: bid opening scheduled for seven single-phase units', 'Plomer: apertura de ofertas prevista para siete unidades monofásicas', 'Plomer: abertura de propostas prevista para sete unidades monofásicas'],
    summary: ['The published schedule is a bid milestone, not an award or confirmation that bids were received.', 'El cronograma indica un hito de la licitación. No confirma recepción de ofertas ni adjudicación.', 'O cronograma indica uma etapa da licitação. Não confirma recebimento de propostas nem adjudicação.'] },
  { country: 'mexico', date: '2026-11-17', dateLabel: ['17 Nov 2026', '17 nov. 2026', '17 nov. 2026'], source: 'DOF / CFE', url: 'https://sidof.segob.gob.mx/notas/docFuente/5804060',
    title: ['Villa Reyes: notice for repair of a 375 MVA transformer', 'Villa Reyes: convocatoria para reparar un transformador de 375 MVA', 'Villa Reyes: edital para reparo de um transformador de 375 MVA'],
    summary: ['This is a repair, installation and commissioning notice, not a purchase or award. Consult the buyer for amendments and the current deadline.', 'La convocatoria cubre reparación, instalación y puesta en servicio, no compra o adjudicación. Consulte al comprador para verificar adendas y plazo vigente.', 'O edital prevê reparo, instalação e comissionamento, não compra nem adjudicação. Consulte a compradora para conferir aditivos e o prazo vigente.'] }
];

const PROFILES = [
  { path: '/services/reinhausen-brasil/', name: 'Reinhausen Brasil', role: ['Tap-changer service · Brazil', 'Servicio de cambiadores de tomas · Brasil', 'Serviços para comutadores de derivação · Brasil'] },
  { path: '/machinery/soto-filhos-transformer-winding/', name: 'Soto Filhos', role: ['Winding machinery · Brazil', 'Máquinas de bobinado · Brasil', 'Máquinas de bobinagem · Brasil'] },
  { path: '/laboratories/cidet-sabaneta/', name: 'CIDET Sabaneta', role: ['Insulating-oil testing · Colombia', 'Ensayos de aceite aislante · Colombia', 'Ensaios de óleo isolante · Colômbia'] },
  { path: '/accessories/ci-importex-colombia/', name: 'C.I. Importex', role: ['Component distributor · Colombia', 'Distribuidor de componentes · Colombia', 'Distribuidor de componentes · Colômbia'] },
  { path: '/services/iesersa-guatemala/', name: 'IESERSA', role: ['Transformer service · Guatemala', 'Servicio de transformadores · Guatemala', 'Serviços para transformadores · Guatemala'] },
  { path: '/logistics/rl-heavy-lift-panama/', name: 'R&L Heavy Lift', role: ['Heavy transport · Panama', 'Transporte pesado · Panamá', 'Transporte pesado · Panamá'] },
  { path: '/laboratories/secamb-peru/', name: 'SECAMB', role: ['Insulating-oil testing · Peru', 'Ensayos de aceite aislante · Perú', 'Ensaios de óleo isolante · Peru'] }
];

const UI = {
  en: {
    h1: 'Latin America Transformer Hub',
    title: 'Latin America Transformer Industry Hub | TransformerPath',
    description: 'Follow transformer news, procurement notices, country markets and supplier profiles in Latin America. Explore the manufacturer census and STEP Medellín.',
    intro: 'Start with industry developments, check the buyer’s notice, then use country directories to find equipment makers, component suppliers and service firms.',
    language: 'Hub language', jump: 'Explore this hub', markets: 'Markets and official procurement', news: 'Selected regional intelligence', directory: 'Regional supplier profiles', maker: 'Manufacturer census', step: 'STEP Medellín visitor guide',
    newsAll: 'Read Daily Intel (English)', tenders: 'Transformer tenders (English)', market: 'Market brief', notices: 'Tender board', original: 'Official source',
    portals: 'Tender boards may also include pipeline or awarded projects. Check the original buyer notice, amendments, submission deadline and time zone before bidding.',
    sourcesNote: 'These are selected dated stories, not a live tender-status check. A notice is not an award.',
    directoryNote: 'Listings are starting points. Check the role, facility, test scope and original evidence before qualifying a supplier.',
    eventNote: 'The Spanish guide has the organizer links and practical questions for sourcing and technical discussions.',
    countryPage: 'Country page', fallback: 'Filter in the directory', officialSite: 'Site', power: 'Power', distribution: 'Distribution', dry: 'Dry/Cast', eventLink: 'Read the Spanish visitor guide', count: (n, places) => n + ' published manufacturer listings across ' + places + ' census markets.',
    filter: 'Filter the full directory by region (English)', sourceLocale: 'Source language may differ from this page.'
  },
  es: {
    h1: 'Transformadores en América Latina',
    title: 'Transformadores en América Latina | TransformerPath',
    description: 'Consulte noticias del sector, licitaciones, mercados y proveedores de transformadores en América Latina. Incluye directorios por país y la guía STEP Medellín.',
    intro: 'Consulte las novedades del sector, compruebe la convocatoria original y use los directorios por país para encontrar fabricantes, proveedores de componentes y empresas de servicio.',
    language: 'Idioma del portal', jump: 'Explore el portal', markets: 'Mercados y portales oficiales de contratación', news: 'Noticias y avisos destacados', directory: 'Perfiles de proveedores de la región', maker: 'Censo de fabricantes', step: 'Guía para visitantes de STEP Medellín',
    newsAll: 'Leer Daily Intel (inglés)', tenders: 'Licitaciones de transformadores (inglés)', market: 'Panorama del mercado', notices: 'Tablero de licitaciones', original: 'Fuente oficial',
    portals: 'El tablero puede incluir proyectos previstos o adjudicados. Consulte la convocatoria original, sus adendas, el plazo de entrega de ofertas y la zona horaria antes de participar.',
    sourcesNote: 'Selección de noticias con fecha; no es una comprobación en tiempo real. Una convocatoria no supone una adjudicación.',
    directoryNote: 'Los perfiles son un punto de partida. Antes de calificar a un proveedor, compruebe su actividad, instalaciones, alcance de los ensayos y fuentes originales.',
    eventNote: 'La guía en español reúne enlaces del organizador y preguntas prácticas para conversaciones técnicas y de compras.',
    countryPage: 'Directorio del país (inglés)', fallback: 'Filtrar en el directorio (inglés)', officialSite: 'Sitio', power: 'Potencia', distribution: 'Distribución', dry: 'Seco/resina', eventLink: 'Consultar la guía en español', count: (n, places) => n + ' registros de fabricantes publicados en ' + places + ' mercados del censo.',
    filter: 'Filtrar el directorio completo por región (inglés)', sourceLocale: 'El idioma de cada fuente puede ser distinto al de esta página.'
  },
  'pt-BR': {
    h1: 'Transformadores na América Latina',
    title: 'Transformadores na América Latina | TransformerPath',
    description: 'Acompanhe notícias, licitações, mercados e fornecedores de transformadores na América Latina, com destaque para o Brasil e acesso ao guia da STEP Medellín.',
    intro: 'Acompanhe o setor a partir do Brasil, consulte o edital original e use os diretórios por país para encontrar fabricantes, fornecedores de componentes e prestadores de serviços.',
    language: 'Idioma do portal', jump: 'Explore o portal', markets: 'Mercados e portais oficiais de compras', news: 'Notícias e avisos em destaque', directory: 'Perfis de fornecedores da região', maker: 'Diretório de fabricantes', step: 'Guia de visita à STEP Medellín',
    newsAll: 'Ler Daily Intel (inglês)', tenders: 'Licitações de transformadores (inglês)', market: 'Panorama do mercado', notices: 'Painel de licitações', original: 'Fonte oficial',
    portals: 'O painel pode incluir projetos previstos ou adjudicados. Antes de participar, confira o edital original, os aditivos, o prazo de envio de propostas e o fuso horário.',
    sourcesNote: 'Notícias selecionadas com data, sem verificação em tempo real. Um edital não confirma adjudicação.',
    directoryNote: 'Os perfis são um ponto de partida. Antes de qualificar um fornecedor, confirme o papel da empresa, a unidade, o escopo dos ensaios e as fontes originais.',
    eventNote: 'O guia em espanhol reúne links do organizador e perguntas práticas para conversas técnicas e de compras.',
    countryPage: 'Diretório do país (inglês)', fallback: 'Filtrar no diretório (inglês)', officialSite: 'Site', power: 'Potência', distribution: 'Distribuição', dry: 'Seco/resina', eventLink: 'Ler o guia em espanhol', count: (n, places) => n + ' registros de fabricantes publicados em ' + places + ' mercados do diretório.',
    filter: 'Filtrar o diretório completo por região (inglês)', sourceLocale: 'O idioma de cada fonte pode ser diferente do idioma desta página.'
  }
};

const CSS = '.latam-nav{display:flex;gap:8px 14px;flex-wrap:wrap;margin:12px 0 20px}' +
  '.latam-nav a,.latam-nav [aria-current]{display:inline-flex;align-items:center;min-height:44px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;color:var(--ink)}' +
  '.latam-nav [aria-current]{font-weight:800;background:var(--card,var(--surface,var(--bg)))}' +
  '.latam-nav a:focus-visible,.latam-hub a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}' +
  '.latam-hub h2{margin:26px 0 9px;overflow-wrap:anywhere}.latam-hub h3{margin:0 0 5px;font-size:1rem;line-height:1.35;color:var(--ink)}' +
  '.latam-hub p{font-size:.94rem;line-height:1.55;color:var(--muted);margin:0 0 8px}' +
  '.latam-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0;padding:0;list-style:none}' +
  '.latam-cards li{min-width:0;overflow-wrap:anywhere;border:1px solid var(--border);border-radius:8px;padding:12px}' +
  '.latam-cards a,.latam-step a,.latam-links a{display:inline-flex;align-items:center;min-height:44px;max-width:100%;color:var(--accent)}' +
  '.latam-ctas{display:flex;gap:0 16px;flex-wrap:wrap}.latam-ctas a{display:inline-flex;min-height:44px;align-items:center}' +
  '.latam-country-list{padding-left:1.3rem}.latam-country-list a{min-height:44px;align-items:center;display:inline-flex}' +
  '@media(max-width:720px){.latam-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
  '@media(max-width:420px){.latam-cards{grid-template-columns:minmax(0,1fr)}}';

function alternates() {
  return Object.entries({ ...PATHS, 'x-default': ROOT }).map(([lang, url]) =>
    '<link rel="alternate" hreflang="' + lang + '" href="' + ORIGIN + url + '">').join('');
}

function languageNav(lang, copy) {
  return '<nav class="latam-nav" aria-label="' + copy.language + '">' + Object.keys(PATHS).map((locale) => locale === lang
    ? '<span lang="' + locale + '" aria-current="page">' + NAMES[locale] + '</span>'
    : '<a href="' + PATHS[locale] + '" lang="' + locale + '" hreflang="' + locale + '">' + NAMES[locale] + '</a>').join('') + '</nav>';
}

const link = (url, label, attr = '') => '<a href="' + esc(url) + '"' + attr + '>' + esc(label) + '</a>';

function render(lang, stepLink) {
  const copy = UI[lang];
  const idx = Object.keys(UI).indexOf(lang);
  const markets = lang === 'pt-BR' ? [MARKETS[1], ...MARKETS.filter((entry) => entry.slug !== 'brazil')] : MARKETS;
  const jump = [['markets', copy.markets], ['regional-intel', copy.news], ['supplier-profiles', copy.directory], ['manufacturer-census', copy.maker]];
  return '<div class="latam-hub">' + languageNav(lang, copy) +
    '<p class="lead">' + copy.intro + '</p><nav class="latam-nav" aria-label="' + copy.jump + '">' + jump.map(([id, title]) => link('#' + id, title)).join('') + '</nav>' +
    '<section aria-labelledby="markets"><h2 id="markets">' + copy.markets + '</h2><p>' + copy.portals + '</p>' +
    '<ul class="latam-cards">' + markets.map((m) => '<li><h3>' + esc(m.name[idx]) + '</h3>' +
      '<div class="latam-ctas">' + link('/markets/' + m.slug + '/', copy.market, ' hreflang="en"') +
      link('/tenders/country/' + m.slug + '/', copy.notices, ' hreflang="en"') + link(m.official, m.buyer) + '</div></li>').join('') +
    '</ul><div class="latam-ctas">' + link('/tenders.html', copy.tenders, ' hreflang="en"') + '</div></section>' +
    '<section aria-labelledby="regional-intel"><h2 id="regional-intel">' + copy.news + '</h2><p>' + copy.sourcesNote + '</p>' +
    '<ul class="latam-cards">' + SOURCES.map((entry) => '<li><p><time datetime="' + entry.date + '">' + entry.dateLabel[idx] + '</time> · ' +
      esc(MARKETS.find((m) => m.slug === entry.country).name[idx]) + '</p><h3>' + esc(entry.title[idx]) + '</h3><p>' +
      esc(entry.summary[idx]) + '</p>' + link(entry.url, copy.original + ': ' + entry.source) + '</li>').join('') +
    '</ul><div class="latam-ctas">' + link('/intel.html', copy.newsAll, ' hreflang="en"') + '</div></section>' +
    '<section aria-labelledby="supplier-profiles"><h2 id="supplier-profiles">' + copy.directory + '</h2><p>' + copy.directoryNote + '</p><ul class="latam-cards">' +
    PROFILES.map((entry) => '<li><h3>' + link(entry.path, entry.name) + '</h3><p>' + esc(entry.role[idx]) + '</p></li>').join('') + '</ul></section>' +
    (stepLink ? '<section class="latam-step" aria-labelledby="step-guide"><h2 id="step-guide">' + copy.step + '</h2><p>' + copy.eventNote + '</p>' + stepLink + '</section>' : '') +
    '<p>' + copy.sourceLocale + '</p></div>';
}

module.exports = { ROOT, FILES, PATHS, UI, REVIEWED, CSS, alternates, render };
