'use strict';

/* The only event with a reviewed companion translation. The official
 * English edition remains the event record; this is an editorial Spanish guide. */
const ID = 'step-power-transformers-2027';
const ROOT = '/events/' + ID + '/';
const ORIGIN = 'https://transformerpath.com';
const EN_FILE = 'events/' + ID + '/index.html';
const ES_FILE = 'events/' + ID + '/es/index.html';
const CHECKED = '2026-11-24';
const TITLE = 'STEP 2027: transformadores de potencia | TransformerPath';
const DESCRIPTION = 'Guía en español de STEP 2027 en Medellín: fechas, sede, inscripción oficial y preguntas sobre compras, ensayos y servicio para transformadores de potencia.';
const LANGUAGES = { en: ORIGIN + ROOT, es: ORIGIN + ROOT + 'es/', 'x-default': ORIGIN + ROOT };
const PLACES = [
  { name: 'Inicio', item: ORIGIN + '/' },
  { name: 'Eventos', item: ORIGIN + '/events.html' },
  { name: 'STEP 2027 en español', item: LANGUAGES.es }
];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function alternateTags() {
  return Object.keys(LANGUAGES).map(function (lang) {
    return '<link rel="alternate" hreflang="' + lang + '" href="' + LANGUAGES[lang] + '">';
  }).join('');
}

function switchLink(language) {
  return language === 'es'
    ? '<a href="' + ROOT + '" hreflang="en" lang="en">English event page</a>'
    : '<a href="' + ROOT + 'es/" hreflang="es" lang="es">Guía de STEP 2027 en español</a>';
}

function calendarText(ev) {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(ev.start || '') || !iso.test(ev.end || '')) return 'Consulta el calendario del organizador.';
  const asDate = function (isoDay) { return new Date(isoDay + 'T12:00:00Z'); };
  const formatter = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' });
  const start = asDate(ev.start), end = asDate(ev.end);
  if (!Number.isFinite(+start) || !Number.isFinite(+end)) return 'Consulta el calendario del organizador.';
  return '<time datetime="' + ev.start + '">' + esc(formatter.format(start)) + '</time> al ' +
    '<time datetime="' + ev.end + '">' + esc(formatter.format(end)) + '</time>';
}

function venueText(ev) {
  if (ev.venue === 'Hotel InterContinental Medellín') {
    return 'Hotel InterContinental Medellín – Movich, calle 16 # 28-51, Variante Las Palmas, Medellín, Colombia';
  }
  return [ev.venue, ev.city, ev.country].filter(Boolean).map(esc).join(', ') || 'Consulta la sede con el organizador.';
}

function handoffLink(language) {
  return '<p class="step-language">' + switchLink(language) + '</p>';
}

function renderGuide(opts) {
  const ev = opts.event;
  const officialSponsor = opts.sponsorLinked
    ? '<li><a href="/services/reinhausen-brasil/" hreflang="en">Reinhausen Brasil</a> (ficha en inglés).</li>'
    : '';
  return '<!doctype html>\n<html lang="es" data-theme="dark"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + esc(TITLE) + '</title>' +
    '<meta name="description" content="' + esc(DESCRIPTION) + '"><meta name="robots" content="index,follow">' +
    '<link rel="canonical" href="' + LANGUAGES.es + '">' + alternateTags() +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="' + esc(TITLE) + '"><meta property="og:description" content="' + esc(DESCRIPTION) + '">' +
    '<meta property="og:url" content="' + LANGUAGES.es + '"><meta property="og:locale" content="es_CO">' +
    '<meta property="og:image" content="' + ORIGIN + '/brand/og-image.png">' +
    '<link rel="stylesheet" href="/style.css"><link rel="icon" type="image/svg+xml" href="/brand/favicon.svg">' +
    '<style>.step-guide{max-width:760px;margin:auto;padding:24px 18px 60px}.step-guide p,.step-guide li{line-height:1.65;overflow-wrap:anywhere}.step-guide nav{display:flex;flex-wrap:wrap;gap:4px 14px}.step-guide nav a,.step-guide .official{display:inline-flex;align-items:center;min-height:44px}.step-guide li+li{margin-top:8px}.step-guide dl{display:grid;gap:5px 18px;grid-template-columns:max-content 1fr}.step-guide dd{margin:0}.step-guide a:not(.btn){text-decoration:underline;text-underline-offset:3px}.step-guide a:focus-visible{outline:2px solid var(--accent);outline-offset:4px}@media(max-width:420px){.step-guide dl{display:block}.step-guide dd{margin:0 0 10px}}</style>' +
    '</head><body><main id="main" class="step-guide"><nav data-tp-seo="breadcrumbs" aria-label="Ruta de navegación">' +
    '<a href="/"><span lang="en">TransformerPath</span></a><a href="/events.html" hreflang="en">Eventos</a>' +
    switchLink('es') + '</nav><h1>STEP 2027: seminario de transformadores de potencia en Medellín</h1>' +
    '<p>Guía independiente para equipos de ingeniería, mantenimiento y compras de América Latina. STEP es un seminario presencial dedicado a transformadores de potencia.</p>' +
    '<section class="card"><h2>Fechas, sede e inscripción</h2><dl>' +
    '<dt>Fechas</dt><dd>' + calendarText(ev) + '</dd>' +
    '<dt>Sede</dt><dd>' + venueText(ev) + '</dd>' +
    '<dt>Organiza</dt><dd>Power Transformer Engineering S.A.S. (PTE)</dd>' +
    '<dt>Entrada general</dt><dd>600 USD según el formulario del organizador (consultado el <time datetime="' + CHECKED +
    '">24 de noviembre de 2026</time>). Confirma el importe antes de pagar.</dd></dl>' +
    '<p>Las fechas anteriores eran del 28 al 30 de octubre de 2026. El organizador confirma que las inscripciones anteriores siguen siendo válidas.</p>' +
    '<p><a class="btn btn-amber official" href="https://www.step-latam.com/registro/">Ir a la inscripción oficial</a></p>' +
    '<p>La venta y la atención de la inscripción corresponden a PTE. TransformerPath no vende entradas.</p></section>' +
    '<section><h2>Cómo aprovechar el seminario</h2><p>Antes de viajar, revisa el programa vigente en el sitio oficial. Si vas a evaluar proveedores, lleva una ficha corta de la necesidad y prepara estas preguntas:</p>' +
    '<ul><li><strong>Compra o reposición:</strong> ¿el proveedor cubre la potencia (MVA), tensiones (kV) y el rango de regulación? Pide referencias del mismo tipo de unidad.</li>' +
    '<li><strong>Ensayos y aceptación:</strong> ¿qué ensayos se hacen en fábrica, quién los ejecuta y en qué instalación? Si necesitas acreditación, solicita su alcance para el método concreto.</li>' +
    '<li><strong>Servicio posventa:</strong> ¿dónde están el equipo de campo y los repuestos? Pregunta cómo se atienden las garantías y los cambiadores de tomas bajo carga (OLTC).</li></ul></section>' +
    '<section><h2>Patrocinio y directorios</h2><p>En la lista del organizador consultada el 24 de noviembre de 2026, MR Reinhausen figura como patrocinador oficial. Eso no confirma un puesto ni una lista de expositores.</p><ul>' +
    officialSponsor +
    '<li><a href="/markets/colombia/" hreflang="en">Mercado de transformadores en Colombia</a> (en inglés).</li>' +
    '<li><a href="/directory/region/latin-america/" hreflang="en">Fabricantes de transformadores en América Latina</a> (en inglés).</li></ul></section>' +
    '<section><h2>Fuentes oficiales</h2><ul>' +
    '<li><a href="https://www.step-latam.com/">Sitio de STEP y patrocinadores</a></li>' +
    '<li><a href="https://www.step-latam.com/comunicado-oficial/">Comunicado de reprogramación</a></li>' +
    '<li><a href="https://step-latam.com/terminos-y-condiciones/">Condiciones de compra y sede</a></li>' +
    '<li><a href="https://www.step-latam.com/registro/">Formulario y tarifa vigentes</a></li></ul></section>' +
    '</main><footer><div class="container"><nav class="tp-legal" aria-label="Información legal">' +
    '<a href="/privacy.html" hreflang="en">Privacidad</a> <a href="/terms.html" hreflang="en">Términos</a> ' +
    '<a href="/contact.html" hreflang="en">Contacto</a></nav>' +
    '<a href="https://x.com/transformerpath">TransformerPath en X</a></div></footer></body></html>\n';
}

module.exports = { ID, ROOT, EN_FILE, ES_FILE, CHECKED, TITLE, DESCRIPTION, LANGUAGES, PLACES, alternateTags, handoffLink, renderGuide };
