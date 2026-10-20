/* Buyer note on US and EU grid-equipment rules.
 * Every statement is tied to an official text read on CHECKED.
 * Where a detail was not in those texts, the note says so.
 */
'use strict';
const pdf = require('./dga-pdf');

const CHECKED = '20 October 2026';
const PRODUCT = 'buyer_guide_us_eu';
const FILENAME = 'transformerpath-us-eu-grid-equipment-guide.pdf';
const PRICE_LABEL = '$19';
const CONTACT = 'hello@transformerpath.com';

const SOURCES = [
  {
    id: 'eo14421',
    title: 'Executive Order 14421 of 26 August 2026, Declaring a National Emergency To Secure the United States Bulk-Power System, 91 FR 55995, 31 August 2026, FR Doc. 2026-17843',
    url: 'https://www.federalregister.gov/documents/2026/08/31/2026-17843/declaring-a-national-emergency-to-secure-the-united-states-bulk-power-system'
  },
  {
    id: 'eo14421-pdf',
    title: 'The same order, Federal Register PDF',
    url: 'https://www.govinfo.gov/content/pkg/FR-2026-08-31/pdf/2026-17843.pdf'
  },
  {
    id: 'doe-faq',
    title: 'US Department of Energy, Bulk-Power System Executive Order and Request for Information, Frequently Asked Questions, updated 6 October 2026',
    url: 'https://www.energy.gov/sites/default/files/2026-10/Bulk%20Power%20System%20EO%20and%20DOE%20RFI%20FAQs.pdf'
  },
  {
    id: 'rfi',
    title: 'Department of Energy request for information, Securing the United States Bulk-Power System, 9 September 2026, FR Doc. 2026-18370, docket DOE-HQ-2026-1123, RIN 1901-AB79',
    url: 'https://www.federalregister.gov/documents/2026/09/09/2026-18370/securing-the-united-states-bulk-power-system'
  },
  {
    id: 'cfr-126-1',
    title: '22 CFR 126.1, the provision named in EO 14421 section 5(e). The country list on this page was not retrieved on the check date.',
    url: 'https://www.ecfr.gov/current/title-22/chapter-I/subchapter-M/part-126/section-126.1'
  },
  {
    id: 'prohibition-2020',
    title: 'Department of Energy, Prohibition Order Securing Critical Defense Facilities, 6 January 2021, FR Doc. 2020-28773. Revoked in 2021.',
    url: 'https://www.federalregister.gov/documents/2021/01/06/2020-28773/prohibition-order-securing-critical-defense-facilities'
  },
  {
    id: 'revocation-2021',
    title: 'Revocation of that prohibition order, effective 20 April 2021, Federal Register 22 April 2021, FR Doc. 2021-08483',
    url: 'https://www.federalregister.gov/documents/2021/04/22/2021-08483/revocation-of-prohibition-order-securing-critical-defense-facilities'
  },
  {
    id: 'com-2026-501',
    title: 'European Commission, COM(2026) 501 final, Brussels, 3 June 2026, CELEX 52026DC0501',
    url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A52026DC0501'
  },
  {
    id: 'investeu-minutes',
    title: 'Minutes of the eleventh meeting of the InvestEU Advisory Board, 3 June 2026',
    url: 'https://webgate.ec.europa.eu/circabc-ewpp/d/d/workspace/SpacesStore/ae385fb1-1097-4486-96dc-5158014c145b/download'
  },
  {
    id: 'join-2025-977',
    title: 'JOIN(2025) 977 final, Brussels, 3 December 2025, CELEX 52025JC0977',
    url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A52025JC0977'
  },
  {
    id: 'csa-proposal',
    title: 'Proposal for a Regulation, COM(2026) 11, CELEX 52026PC0011. A proposal, not a regulation in force.',
    url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A52026PC0011'
  },
  {
    id: 'nzia-guidance',
    title: 'Commission guidance on Article 28 of Regulation (EU) 2024/1735, OJ C/2026/123, 7 January 2026',
    url: 'https://eur-lex.europa.eu/eli/C/2026/123/oj/eng'
  }
];

const PARAGRAPHS = [
  'TransformerPath buyer note',
  'US and EU rules on foreign and high-risk grid equipment, for transformer buyers',
  'Checked ' + CHECKED + '. Product ' + PRODUCT + '. ' + PRICE_LABEL + ' file.',
  'This is not legal advice. It is a reading of public official texts. It does not say whether any transformer, supplier, contract, or project is allowed. Texts change. Read the cited document, and ask counsel before you rely on this note. Questions: ' + CONTACT + '.',
  '1. How to use this note',
  'Two bodies of text are in front of buyers now. The United States has a presidential order on foreign-produced bulk-power system electric equipment, including substation transformers and instrument transformers. The European Commission has published texts on EU funding and inverters from high-risk suppliers. Those EU texts do not name power transformers, and they do not state an application date of 1 November 2026.',
  'Where a point was not in an official text read for this note, the note says it was not confirmed. Trade press is not used as a source.',
  '2. United States: what the order covers',
  'Executive Order 14421 is dated 26 August 2026. It was published in the Federal Register on 31 August 2026 at 91 FR 55995, document 2026-17843. It declares a national emergency with respect to the foreign supply of bulk-power system electric equipment. The authorities it names include the International Emergency Economic Powers Act and the National Emergencies Act.',
  'It is not a ban on every foreign transformer. A transaction is prohibited only when the conditions in section 2(a) are met, including a determination by the Secretary of Energy.',
  'The transaction is any acquisition, importation, transfer, or installation. It must be by a person, or with respect to property, subject to the jurisdiction of the United States. It must involve property in which any foreign country or a national thereof has any interest, including through an interest in a contract for the equipment. It must have been initiated after the date of the order, 26 August 2026.',
  'The Secretary makes the determination in coordination with the Director of the Office of Management and Budget and in consultation with the Secretary of War, the Secretary of Commerce, the Secretary of Homeland Security, the Director of National Intelligence, and, as appropriate, the heads of other agencies. Two findings are both required.',
  'First, the transaction involves bulk-power system electric equipment, or any critical component, software, firmware, digital service, maintenance service, or remote-access capability associated with that equipment, designed, developed, manufactured, or supplied by persons owned by, controlled by, or subject to the jurisdiction or direction of a Covered Foreign Entity.',
  'Second, the transaction poses an undue risk of sabotage, subversion, unauthorized access, malicious remote action, or supply disruption affecting the design, integrity, manufacturing, production, distribution, installation, operation, or maintenance of the bulk-power system in the United States; or an undue risk of catastrophic effects on the security or resilience of United States critical infrastructure or the economy; or an unacceptable risk to the national security of the United States or the security and safety of United States persons.',
  'The Department of Energy FAQ, updated 6 October 2026, says the same thing in shorter form: the order is a targeted, risk-based framework, not a blanket prohibition on all foreign-produced equipment. The FAQ also says it does not create legal requirements and does not decide any specific transaction, equipment, country, person, or vendor. If a later rule conflicts with the FAQ, the order and that rule control.',
  '3. United States: which transformers are named',
  'Section 5(a) defines the bulk-power system as facilities and control systems necessary for operating an interconnected electric energy transmission network, or any portion of it, and electric energy from generation facilities needed to maintain electric system reliability. For the order, this includes transmission lines rated at 69,000 volts (69 kV) or more. It does not include facilities used in the local distribution of electric energy.',
  'Section 5(b) defines bulk-power system electric equipment as items used in bulk-power system substations, control rooms, or power generating stations. The list includes substation transformers and instrument transformers. It also includes coupling capacity voltage transformers, reactors, capacitors, substation voltage regulators, shunt capacitor equipment, automatic circuit reclosers, protective relaying, metering equipment, high voltage circuit breakers, utility-scale and other grid-connected inverters, battery energy storage systems, uninterruptible power supply systems supporting critical infrastructure, large generators, small generators, backup generators, generation turbines, and listed industrial control systems.',
  'The same section says agencies may also consider associated software and firmware, remote access capabilities, lifecycle maintenance and update mechanisms, and other supply chain dependencies that could present an unacceptable risk. Items not in the list, or with broader application beyond the bulk-power system unrelated to the national security concerns in the order, are outside the scope.',
  'A distribution transformer used only on the local distribution system is not in that equipment list, and local distribution facilities are outside section 5(a). The order does not say that every transformer owned by a utility is covered. It does name substation transformers and instrument transformers used in the places in section 5(b).',
  'The DOE FAQ, item 5, says equipment is not automatically in or out solely because it is behind the meter, at a data center, at another critical infrastructure facility, or at the same point of interconnection as a load. Voltage, function, connectivity, and whether the equipment is used in or associated with the bulk-power system still matter, and the other conditions of the order still have to be met.',
  '4. United States: foreign-produced, and who is a Covered Foreign Entity',
  'Section 5(c): foreign-produced means an article that is not manufactured, produced, or assembled in the United States.',
  'The DOE FAQ, item 11, says the order does not itself set a numerical domestic-content threshold, a substantial-transformation test, a specific treatment for final assembly in the United States, Harmonized Tariff Schedule codes, or a categorical rule for equipment that contains foreign cells, semiconductors, power electronics, software, or other components. The request for information asks what facts should be used for final assembly, contract manufacturing, white-labeling, refurbishment, repair, and foreign components, and what records manufacturers, importers, distributors, and purchasers can reasonably provide. Those questions are not yet rules.',
  'Section 5(e): a Covered Foreign Entity is a country, or any person owned by, controlled by, or subject to the jurisdiction or direction of a government of a foreign country, that is subject to a United States arms embargo or sanctions regime under the International Traffic in Arms Regulations, 22 CFR 126.1, or that the Secretary, in consultation with the Secretary of War, the Director of National Intelligence, and the Assistant to the President for National Security Affairs, has determined is engaged in conduct detrimental to the national security or foreign policy of the United States.',
  'The order does not paste a country list. The DOE FAQ, item 10, says the reference to 22 CFR 126.1 does not remove the need to look at ownership, control, jurisdiction, direction, and the facts of the transaction. The same FAQ says it does not designate any additional country, person, equipment, or vendor. Rules under the order may later name countries or persons for the purposes of the order only. On ' + CHECKED + ' the current text of 22 CFR 126.1 was not retrieved: the eCFR site did not return the section to an automated request. This note does not invent that list. Open the section itself before you treat any country as listed.',
  '5. United States: dates, existing units, and what is not decided yet',
  'Section 2(a) applies to a transaction initiated after 26 August 2026, and only together with the other conditions. The DOE FAQ, item 8, says the order does not pick a single moment, such as contract signature, manufacture, shipment, delivery, transfer of title, or installation, as the moment every transaction is initiated. DOE said it was considering that question in the request for information and in rules still to be written. Keep the dates. Do not guess which one the rule will use.',
  'Section 2(b) covers equipment acquired or installed before the date of the order. The Secretary, after the consultations the section names, may impose conditions on continued use, operation, maintenance, servicing, or updating, including requirements to identify, isolate, monitor, secure, disconnect, replace, or remove the equipment. Before directing isolation, disconnection, replacement, or removal, the Secretary shall consider effects on reliability and safety, the availability of secure replacements, and continuity of essential service, and may establish phased compliance. The FAQ, item 9, says covered equipment acquired or installed before 26 August 2026 is not automatically prohibited or subject to removal until the Secretary has made the required determinations and completed the specified consultations.',
  'Section 2(c) allows mitigation measures, including as a precondition to approval of a transaction or a class of transactions. Section 2(e) allows criteria for pre-qualified equipment and vendors and a published list. Prequalification does not limit the Secretary\'s authority to prohibit a later transaction. The FAQ, item 14, says the order sets no deadline for that process and that stakeholders should not file pre-qualification applications now. The invitation was to answer the request for information.',
  'Section 2(d): the prohibitions apply except as statutes, or regulations, orders, directives, or licenses issued under the order, provide, and they apply notwithstanding any contract entered into or any license or permit granted before the date of the order.',
  'Section 2(f) prohibits evasion, attempts, and conspiracies to violate a prohibition or requirement under the order.',
  'Section 3(b): within 120 days of the date of the order, the Secretary shall publish rules or regulations implementing the delegated authorities, as needed, after the consultations the section names. Counting 120 days from 26 August 2026 lands on 24 December 2026. The order prints the 120-day period, not that calendar date. As of ' + CHECKED + ', the document in the Federal Register is a request for information, not a final rule.',
  'Section 4: within 180 days of the date of the order, the Secretary shall recommend revisions to the Federal Acquisition Regulation so that national security risks are considered in Federal procurement of energy infrastructure, and so that acquisition of United States-manufactured energy infrastructure is prioritized. The FAR Council then has 90 days to consider proposing amendments for public comment. No such FAR amendment was in the documents read for this note.',
  'Section 7(c): the order is not intended to, and does not, create a private right or benefit enforceable against the United States.',
  'The Secretary of Commerce is one of the officers who must be consulted before a section 2(a) determination. The request for information is issued by the Department of Energy, Office of Cybersecurity, Energy Security, and Emergency Response. No Bureau of Industry and Security rule implementing this order was in the Federal Register documents read on ' + CHECKED + '.',
  '6. The 2020 prohibition order is revoked',
  'A different document, the Prohibition Order Securing Critical Defense Facilities, was published in the Federal Register on 6 January 2021, document 2020-28773, with an effective date of 16 January 2021. It applied to a Responsible Utility that owns or operates defense critical electric infrastructure actively serving a Critical Defense Facility. It prohibited acquiring, importing, transferring, or installing listed equipment that had been manufactured or supplied by persons owned by, controlled by, or subject to the jurisdiction or direction of the People\'s Republic of China, for use by that utility as a component of its defense critical electric infrastructure serving the facility, from the interconnection at 69 kV or higher up to and including the next upstream transmission substation.',
  'Attachment 1 of that order listed power transformers with a low-side voltage rating of 69 kV or higher, and generator step-up transformers with a high-side voltage rating of 69 kV or higher, in each case with associated control and protection systems, plus other equipment at 69 kV or higher.',
  'The Department of Energy revoked that prohibition order effective 20 April 2021. The revocation was published on 22 April 2021, document 2021-08483. The revocation notice says the December 2020 order was also suspended with Executive Order 13920. Do not use the 2020 prohibition order as the current rule. Executive Order 14421 is a new order. It does not say that it reinstates the 2020 prohibition order.',
  '7. The Department of Energy request for information',
  'The request for information was published on 9 September 2026, document 2026-18370, docket DOE-HQ-2026-1123, RIN 1901-AB79. Written responses were requested on or before 9 October 2026. The notice says the request is for information and planning only. It does not constitute a proposed rule, order, directive, license, or determination concerning any country, person, transaction, equipment, or vendor.',
  'Question A-5(c) asks what records manufacturers, importers, distributors, and purchasers can reasonably provide to substantiate country of manufacture, production, or assembly. Question A-4 asks what documentation is ordinarily available to distinguish mixed-use items. Question B-1 asks what supplier disclosures and corporate records are used to identify foreign ownership, control, jurisdiction, direction, or influence. Those are questions. They are not a form a buyer must file today.',
  'The published mailbox for the request is BulkPowerEO@doe.gov. The FAQ, item 19, repeats the submission routes and the 9 October 2026 date.',
  '8. European Union: what the official texts say',
  'COM(2026) 501 final, Brussels, 3 June 2026, CELEX 52026DC0501, says the Commission has most recently restricted the use of EU funds for projects involving inverters from high-risk suppliers. In the same passage it treats solar and wind power generation infrastructure as a priority cybersecurity concern. The risks it names are manipulation or prevention of electricity production, unauthorized access to operational data, infiltration of key supply chain actors, and the possibility to trigger remote blackouts. It says the proposal for a Cybersecurity Act provides the framework to ban the use of inverters from high-risk suppliers in the EU, if necessary. The communication does not name power transformers. It does not state a date of 1 November 2026.',
  'The minutes of the eleventh meeting of the InvestEU Advisory Board, 3 June 2026, say the Commission\'s interim guidance restricts the use of EU funds for clean energy projects involving inverters from high-risk suppliers. The minutes say the guidance applies to all EU-funded projects implemented through direct or indirect management for solar, wind and energy storage, and that those projects are required to comply with the latest cybersecurity guidelines. The minutes do not attach the guidance. They do not define high-risk supplier. They do not name a power transformer, a distribution transformer, or an instrument transformer. They do not state 1 November 2026 as an application date. A later line proposes the next Advisory Board meeting, tentatively in November 2026. That is a meeting, not an equipment rule. The minutes also say the Commission pointed to ongoing discussions with industry and financial institutions about how a clean-energy investment strategy sits with the interim guidance.',
  'JOIN(2025) 977 final, Brussels, 3 December 2025, CELEX 52025JC0977, uses solar inverters as the example under the heading of disruptions to EU critical infrastructure. The risks it names are increasing reliance on a single supplier, manipulating electricity production parameters, preventing electricity production, access to operational data, and infiltrating supply chain actors. It says a coordinated assessment under the NIS2 Directive is to be concluded in 2026, and it points to the Cyber Resilience Act, non-price criteria under the Net-Zero Industry Act, and preventing access by high-risk entities to Union-supported actions, including actions supported by public financial institutions and instruments. This is a policy communication. It is not, by itself, a regulation that bans a transformer.',
  'The proposal COM(2026) 11, CELEX 52026PC0011, is a proposal for a regulation. It is not a regulation in force. Its explanatory text describes a framework to identify third countries posing cybersecurity concerns and high-risk suppliers, and it says the Union should not fund projects involving high-risk suppliers. The proposal text that was read lists electricity supply systems among supply chains where cybersecurity risks may be observed. Designations, prohibitions, and transition periods in that proposal would depend on the act being adopted and on later steps the proposal itself describes. Do not treat the proposal as a current ban.',
  '9. European Union: the 1 November 2026 date was not in an official text',
  'This note was asked to cover EU high-risk grid equipment measures applying from 1 November 2026. On ' + CHECKED + ', EUR-Lex and Commission pages that were opened did not contain a regulation, decision, or published guidance that sets 1 November 2026 as the application date for grid equipment, for inverters, or for transformers. COM(2026) 501 and the InvestEU minutes confirm that an interim funding restriction for inverters from high-risk suppliers exists. They do not print that date, a grandfathering window, a phase-out date, or a list of countries. This note does not copy those details from trade press. If a funder cites 1 November 2026, ask the funder for the guidance text.',
  'The interim guidance document itself was not found on EUR-Lex. The minutes and COM(2026) 501 describe it. They are not a substitute for the guidance.',
  '10. A separate EU origin note: NZIA Article 28 guidance',
  'This is not the high-risk-supplier funding guidance. Commission guidance on Article 28 of Regulation (EU) 2024/1735, published as OJ C/2026/123 on 7 January 2026, is about schemes that incentivise the purchase of net-zero technology final products. The guidance says it is not legally binding, that it does not alter rights and obligations in the Net-Zero Industry Act, and that it does not cover the public procurement and auctioning provisions of that Act.',
  'It says the country of origin, for the resilience contribution, shall be determined in accordance with Regulation (EU) No 952/2013. It says economic operators, including manufacturers and sellers, should provide customs declarations as the main documentation. It says other reliable evidence can be used, and it lists invoices, product ID numbers, serial numbers or codes, nameplates, certificates of origin, bills of lading and other transport documents, bills of material, suppliers\' declarations, delivery notes, contracts with suppliers, factory inspection certificates, and manufacturing execution systems. It says customs documentation should be provided where available and may be supplemented by those other documents. It says that if a bidder fails to produce a relevant document demonstrating origin or place of assembly, Member States should automatically consider that those final products or main specific components originate in, or are assembled in, a country on which the EU has a high dependency.',
  'The annex that was read lists PV inverters under HS heading 8504. The guidance that was read does not name power transformers. Heading 8504 is a customs heading used for more than one kind of electrical equipment. The row in this guidance is PV inverters. Do not read that row as a rule for a power transformer unless a later official text says so. If an authority scores a transformer under an Article 28 scheme, ask that authority which product it is scoring, and use the documents the guidance lists for that product.',
  '11. Documents a buyer may be asked for',
  'United States. EO 14421 and the DOE FAQ do not require a declared-origin certificate in a set form, a domestic-content percentage, a DOE attestation, or a pre-qualification approval. No attestation process has been adopted. The FAQ, item 13, says compliance with a NERC Critical Infrastructure Protection standard, an ISO or IEC standard, or another cybersecurity or supply-chain standard does not by itself exempt equipment or a vendor. The FAQ, item 20, says NERC compliance is not an automatic exemption, and that the order does not replace NERC obligations where those obligations apply.',
  'Keep these in the purchase file anyway. DOE has asked, in the request for information, what records purchasers can reasonably provide, and a later rule or determination may ask for them. Where the transformer was manufactured, produced, or assembled, using the words of section 5(c). The supplier\'s name, and any written statement the supplier will give on ownership, control, or jurisdiction. Whether the unit is a substation transformer, an instrument transformer, or another item named in section 5(b). The facility voltage, and whether the facility is transmission at 69 kV or above or is local distribution. The dates of contract, manufacture, shipment, title transfer, and installation, because initiated is not defined as one of those dates. Software, firmware, remote access, and maintenance arrangements tied to the unit. Any test or cybersecurity certificate you already hold, kept as evidence, not as an exemption.',
  'European Union. For the inverter funding guidance, the published texts that were read do not set out a buyer document list. If the project uses EU funds and includes inverters on a solar, wind, or energy storage project, ask the funder for the interim guidance and for the cybersecurity guidelines it says projects must meet. For an NZIA Article 28 incentive scheme, the non-binding guidance lists the documents in section 10 of this note. That list is for the net-zero product the scheme covers. It was not confirmed as a list for power transformers.',
  '12. Checklist before award',
  'Name the equipment in the words of the official text: substation transformer, instrument transformer, power transformer, distribution transformer, generator step-up transformer, or inverter. Do not use one label for all of them.',
  'Name the system. For the United States, say whether it is the bulk-power system, including transmission at 69 kV or more, or local distribution. For the European Union, say whether the project is an EU-funded solar, wind, or energy storage project under direct or indirect management.',
  'For a US transaction that may have been initiated after 26 August 2026, do not treat a foreign transformer as banned, and do not treat it as cleared. A prohibition needs the Secretary\'s determinations in section 2(a).',
  'Record manufacture, production, or assembly. The US definition of foreign-produced is an article not manufactured, produced, or assembled in the United States. The order does not say how to treat a unit assembled in the United States from foreign parts.',
  'Ask the supplier for a written statement of origin and of who owns or controls the supplier. Neither the order nor the DOE FAQ prescribes the form.',
  'Split inverters from power transformers in the bid and in the funding file. The EU texts read for this note speak about inverters.',
  'If EU funds are in the project, ask the funding body whether the interim guidance applies to this contract, and ask for a copy. The guidance text was not on EUR-Lex on the check date.',
  'Do not cite the 2020 DOE prohibition order as current law. It was revoked effective 20 April 2021.',
  'Do not cite the proposed Cybersecurity Act as a ban now in force.',
  'Read the Federal Register and EUR-Lex again before award. Rules under EO 14421 were directed within 120 days of 26 August 2026, as needed.',
  'This note is not legal advice. If the file you were sent does not match the texts above, write to ' + CONTACT + '.',
  '13. Sources',
  'Each source below was opened on ' + CHECKED + ' except 22 CFR 126.1, which the order cites and which did not return its text to the request made that day. Claims in this note are limited to what those texts say.'
];

function wrap(text, width) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  words.forEach(function (word) {
    if (!word) return;
    const next = cur ? cur + ' ' + word : word;
    if (next.length > width && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  });
  if (cur) lines.push(cur);
  return lines;
}

function wrapUrl(url, width) {
  const value = String(url);
  if (value.length <= width) return [value];
  const parts = [];
  let rest = value;
  while (rest.length > width) {
    let cut = rest.lastIndexOf('/', width);
    if (cut < 12) cut = width - 1;
    parts.push(rest.slice(0, cut + 1));
    rest = rest.slice(cut + 1);
  }
  if (rest) parts.push(rest);
  return parts;
}

function lines() {
  const out = [];
  PARAGRAPHS.forEach(function (paragraph) {
    wrap(paragraph, 88).forEach(function (line) { out.push(line); });
    out.push('');
  });
  SOURCES.forEach(function (source, index) {
    wrap((index + 1) + '. ' + source.title, 88).forEach(function (line) { out.push(line); });
    wrapUrl(source.url, 88).forEach(function (line) { out.push(line); });
    out.push('Checked ' + CHECKED + '.');
    out.push('');
  });
  out.push('End of note. Not legal advice. ' + CONTACT);
  return out;
}

function buildPdf() {
  return pdf.buildPdf(lines());
}

module.exports = {
  CHECKED: CHECKED,
  PRODUCT: PRODUCT,
  FILENAME: FILENAME,
  PRICE_LABEL: PRICE_LABEL,
  CONTACT: CONTACT,
  SOURCES: SOURCES,
  PARAGRAPHS: PARAGRAPHS,
  lines: lines,
  buildPdf: buildPdf
};
