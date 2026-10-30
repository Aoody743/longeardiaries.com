import { contentCopy as copy } from './content-copy.js';

export const destinations = [
  ['species', 'Species Diaries', 'book', 'sage'],
  ['events', 'Events', 'calendar', 'peach'],
  ['volunteer', 'Volunteer', 'heart', 'lilac'],
  ['team', 'Our Team', 'people', 'butter'],
  ['about', 'About Us', 'leaf', 'sage'],
  ['partner', 'Partner', 'globe', 'lilac'],
  ['contact', 'Contact', 'mail', 'peach'],
];

export function createPublicPages(ctx) {
  const { state, published, escape: e, image, icon, md, field, tag, filter, query } = ctx;
  const badge = (text) => `<span class="chapter-badge">${text}</span>`;
  const demo = (record) => record.example ? '<span class="demo-label">Demo</span>' : '';
  const heading = (name, label) => `<header class="book-heading">${badge(label)}<h1>${e(copy[name].title)}</h1><p>${e(copy[name].intro)}</p><span class="heading-flourish" aria-hidden="true">${icon('leaf')}</span></header>`;
  const sendButton = (text) => `<p class="form-error" role="alert"></p><button class="btn btn-primary" type="submit">${text} ${icon('arrow')}</button>`;

  function home() {
    return `<section class="home-universe" aria-label="LongEar Diaries interactive world">
      <header class="home-header">
        <div class="home-brand">
          <a class="home-logo" href="#home" aria-label="LongEar Diaries home">${image('assets/logo-reference.jpg', '', '', true)}</a>
          <h1 class="home-title">LongEar Diaries</h1>
        </div>
        <nav class="home-navigation" aria-label="Explore LongEar Diaries">
          ${destinations.map(([id, name, symbol, color]) => `<a class="home-nav-link tone-${color}" href="#${id}">${icon(symbol)}<span>${name}</span></a>`).join('')}
        </nav>
      </header>
      <div class="home-world">
        <div class="world-stage solar-globe" id="worldStage">
          <div class="planet-canvas"><div class="world-loading" role="status"><span></span><span class="visually-hidden">Loading Earth</span></div></div>
          <div class="planet-markers"></div>
          <div class="world-controls home-world-controls" hidden>
            <button class="icon-button world-spin" data-world="spin" aria-label="Pause globe rotation" aria-pressed="false">${icon('pause')}</button>
            <button class="icon-button" data-world="out" aria-label="Zoom out">−</button>
            <button class="icon-button" data-world="in" aria-label="Zoom in">+</button>
            <button class="icon-button" data-world="reset" aria-label="Reset globe view">${icon('rotate')}</button>
          </div>
        </div>
      </div>
      <p class="home-message">Every species deserves a chance to survive</p>
    </section>`;
  }

  function speciesCard(s, i) {
    return `<article class="species-card specimen-card" data-biome="${e(s.biome)}" data-search="${e((s.name + ' ' + s.scientific + ' ' + s.habitat).toLowerCase())}" style="--card-tilt:${[-1.2, 1.1, -.7, .8, -1][i % 5]}deg">
      <a class="species-cover" href="#species/${e(s.slug)}">${image(s.image, s.name + ' in its habitat')}<span class="specimen-number">${String(i + 1).padStart(2, '0')}</span><span class="cover-link">${icon('arrow')}</span></a>
      <div class="species-card-body"><span class="habitat-label">${icon('pin')}${e(s.location || s.habitat)}</span><h2><a href="#species/${e(s.slug)}">${e(s.name)}</a></h2><p class="scientific">${e(s.scientific)}</p><div class="card-foot"><span>${s.diary.length} ${s.diary.length === 1 ? 'entry' : 'entries'}</span><a href="#species/${e(s.slug)}">Open diary ${icon('arrow')}</a></div></div>
    </article>`;
  }

  function species() {
    const biomes = ['All', ...new Set(published('species').map(s => s.biome))];
    return `<section class="page-shell collection-page">
      ${heading('diaries', 'Field journals')}
      <div class="collection-bar"><div class="filter-list" role="group" aria-label="Filter by habitat">${biomes.map(b => `<button class="filter ${filter === b ? 'active' : ''}" data-filter="${e(b)}" aria-pressed="${filter === b}">${b === 'All' ? 'All habitats' : e(b)}</button>`).join('')}</div><label class="search-box">${icon('search')}<input id="speciesSearch" aria-label="Search species" type="search" placeholder="Search the journals" value="${e(query)}"></label></div>
      <div class="collection-count" id="collectionCount"></div>
      <div class="species-grid" id="speciesGrid">${published('species').map(speciesCard).join('')}</div>
      <div class="empty-state paper-note" id="speciesEmpty" hidden><h2>No matching journals</h2><button class="text-button" data-action="clear-filters">Show all species ${icon('arrow')}</button></div>
    </section>`;
  }

  function speciesDetail(slug) {
    const s = published('species').find(x => x.slug === slug);
    if (!s) return notFound();
    return `<section class="page-shell diary-page"><a class="breadcrumb" href="#species">${icon('arrow')} Species Diaries</a>
      <div class="diary-intro"><div class="diary-portrait">${image(s.image, s.name, '', true)}<span class="portrait-coordinates">${e(s.location || s.habitat)}</span></div><div class="diary-title">${badge(e(s.biome))}<h1>${e(s.name)}</h1><p class="scientific">${e(s.scientific)}</p><p>${e(s.summary || '')}</p><div class="fact-grid"><div><small>Habitat</small><strong>${e(s.habitat)}</strong></div><div><small>Family</small><strong>${e(s.family)}</strong></div><div><small>Size</small><strong>${e(s.size)}</strong></div><div><small>Field entries</small><strong>${s.diary.length}</strong></div></div><button class="btn btn-primary" data-action="read-entries">Read the journal ${icon('book')}</button></div></div>
      <div class="diary-notebook" id="fieldEntries"><aside>${badge('Species Diaries')}<h2>Field notes</h2><a class="text-link" href="#contact">Share an observation ${icon('arrow')}</a></aside><div class="timeline">${s.diary.map((entry, index) => `<article class="diary-entry paper-note"><div class="entry-date"><span>${String(index + 1).padStart(2, '0')}</span><small>${e(entry.date)}</small>${entry.example ? tag('Demo field note', 'sample') : ''}</div><h3>${e(entry.title)}</h3><div class="prose">${md(entry.body)}</div></article>`).join('') || '<p>No entries published yet.</p>'}</div></div>
    </section>`;
  }

  function events() {
    const list = published('events');
    return `<section class="page-shell expedition-page">
      <div class="expedition-title">${badge('Expeditions & Webinars')}<h1>${e(copy.events.title)}</h1><p>${e(copy.events.intro)}</p><span class="sketch-sun" aria-hidden="true">${icon('sun')}</span></div>
      <div class="expedition-list">${list.map((event, i) => {
        const past = new Date(event.date + ' 23:59:59').getTime() < Date.now();
        return `<article class="expedition-card expedition-${i % 2}"><div class="expedition-art">${image(event.image, event.title, '', i === 0)}<span class="ticket-date">${icon('calendar')}${e(event.date)}</span></div><div class="expedition-copy"><div class="ticket-meta">${badge(e(event.kind))}${demo(event)}</div><h2>${e(event.title)}</h2><div class="prose">${md(event.body)}</div><p class="event-place">${icon('pin')}${e(event.location)}</p>${past ? '<span class="past-event">Past event</span>' : `<button class="btn btn-primary" data-rsvp="${e(event.id)}">${e(event.button || 'Register')} ${icon('arrow')}</button>`}</div></article>`;
      }).join('') || '<p class="paper-note">No events are currently listed.</p>'}</div>
    </section>`;
  }

  function storyForm() {
    return `<section class="share-story-section" id="shareStory"><div class="share-heading">${icon('pen')}<h2>Share Your Story</h2><p>${e(copy.volunteer.shareIntro)}</p></div><form class="contact-form story-form" id="storySubmit"><div class="form-grid">${field('name', 'Your Name / Title', 'text', '', true)}${field('email', 'Email Address', 'email', '', true)}</div><div class="form-grid">${field('subject', 'Story Title', 'text', '', true)}${field('location', 'Location / Expedition', 'text', '', true)}</div>${field('photoUrl', 'Photo URL (optional)', 'url', '')}<label>Your Field Story<textarea name="message" rows="5" required placeholder="Share your experience..."></textarea></label>${sendButton('Submit Story')}<small class="form-caption">Stories are reviewed before publication.</small></form></section>`;
  }

  function volunteer() {
    const stories = published('stories');
    return `<section class="page-shell volunteer-page ${stories.length ? '' : 'no-stories'}">${stories.length ? `${heading('volunteer', 'Global Community Wall')}<div class="community-wall">${stories.map((story, i) => `<article class="community-story" style="--card-tilt:${[-2, 1.7, -.8][i % 3]}deg"><div class="story-print">${image(story.image, story.title)}<span class="paper-tape" aria-hidden="true"></span></div><div class="story-written"><span class="story-location">${icon('pin')}${e(story.location)}</span><h2>${e(story.title)}</h2><div class="prose">${md(story.body)}</div><div class="story-signature"><span>${e(story.author || '')}</span>${demo(story)}</div></div></article>`).join('')}</div>` : ''}${storyForm()}</section>`;
  }

  function team() {
    const people = (state.team || []).filter(p => p.public !== false && !p.archived).slice().sort((a, b) => (+a.order || 0) - (+b.order || 0));
    return `<section class="page-shell team-page"><div class="team-page-title">${badge('Founders & Researchers')}<h1>${e(copy.team.title)}</h1><p>${e(copy.team.intro)}</p></div><div class="explorer-roster">${people.map((person, i) => `<article class="explorer-card"><div class="explorer-portrait tone-${['sage', 'peach', 'lilac'][i % 3]}">${person.image ? image(person.image, person.name) : portrait(i)}<span class="explorer-pin" aria-hidden="true">${icon(['leaf', 'globe', 'book'][i % 3])}</span></div><div class="explorer-info"><h2>${e(person.name)}</h2><p class="explorer-role">${e(person.title)}</p><p>${e(person.bio)}</p>${demo(person)}</div></article>`).join('')}</div></section>`;
  }

  function portrait(index) {
    const hair = ['#69503c', '#a27148', '#353b32'][index % 3];
    const shirt = ['#b99251', '#758b69', '#9c8aa2'][index % 3];
    return `<svg class="drawn-portrait" viewBox="0 0 180 180" aria-hidden="true"><path d="M24 180q3-65 66-65t66 65" fill="${shirt}" stroke="#66533f" stroke-width="2"/><path d="M57 91q-20-65 32-69 56-1 37 76l-21 22-40-8Z" fill="${hair}"/><path d="M78 108v25q12 11 25 0v-25" fill="#e9bc91" stroke="#66533f" stroke-width="2"/><ellipse cx="91" cy="79" rx="33" ry="43" fill="#f1cfab" stroke="#66533f" stroke-width="2"/><path d="M56 69q-8-46 34-47 44-1 40 47-17-5-29-26-12 23-45 26" fill="${hair}"/><path d="M75 78v5m31-5v5m-21 19q7 4 13-1" fill="none" stroke="#564735" stroke-width="3" stroke-linecap="round"/><path d="m62 141 20 16 9-20 9 20 23-17M90 139v39" fill="none" stroke="#534b39" stroke-width="2"/>${index % 3 === 2 ? '<path d="M64 76h22v15H65ZM95 76h22v15H95ZM86 81h9" fill="none" stroke="#625b43" stroke-width="2"/>' : ''}</svg>`;
  }

  function about() {
    return `<section class="page-shell about-page"><header class="about-title">${badge('Our Mission & Origins')}<h1>${e(copy.about.title)}</h1></header><div class="open-journal"><div class="journal-leaf journal-left"><span class="journal-corner" aria-hidden="true">${icon('leaf')}</span><p class="opening-paragraph">${e(copy.about.paragraphs[0])}</p><span class="journal-folio" aria-hidden="true">01</span></div><div class="journal-leaf journal-right"><p>${e(copy.about.paragraphs[1])}</p><span class="journal-folio" aria-hidden="true">02</span></div></div><div class="research-principles">${copy.about.principles.map((p, i) => `<article>${icon(i ? 'book' : 'leaf')}<div><h2>${e(p.title)}</h2><p>${e(p.body)}</p></div></article>`).join('')}</div><div class="comic-shelf"><figure>${image('assets/storybook/new-friend-1.png', "LongEar's New Friend 1 comic cover")}<figcaption>LongEar’s New Friend 1</figcaption></figure><figure>${image('assets/storybook/new-friend-2.png', "LongEar's New Friend 2 comic cover")}<figcaption>LongEar’s New Friend 2</figcaption></figure></div></section>`;
  }

  function partner() {
    return `<section class="page-shell partners-page">${heading('partner', 'Allied Organizations')}<div class="partner-garden">${published('partners').map((partner, i) => `<article class="partner-tile">${icon(['leaf', 'search', 'spark', 'globe'][i % 4])}<h2>${e(partner.title)}</h2><p>${e(partner.body)}</p>${demo(partner)}</article>`).join('')}</div><section class="partnership-desk"><div>${icon('people')}<h2>Become a Partner</h2></div><form class="contact-form" id="partnerForm">${field('name', 'Organization Name', 'text', '', true)}${field('email', 'Contact Email', 'email', '', true)}<label>Partnership Proposal / Message<textarea name="message" rows="5" required placeholder="Describe how we can collaborate..."></textarea></label>${sendButton('Submit Partnership Inquiry')}</form></section></section>`;
  }

  function contact() {
    return `<section class="page-shell contact-post-page"><div class="postcard"><div class="postcard-heading">${badge('Get in Touch')}<h1>${e(copy.contact.title)}</h1><p>${e(copy.contact.intro)}</p><span class="postage-stamp" aria-hidden="true">${icon('mail')}<span>LongEar<br>Diaries</span></span></div><form class="contact-form" id="contactForm"><div class="form-grid">${field('name', 'Your Name', 'text', '', true)}${field('email', 'Email Address', 'email', '', true)}</div>${field('subject', 'Subject', 'text', '', true)}<label>Message<textarea name="message" rows="5" required placeholder="Your message here..."></textarea></label>${sendButton('Dispatch Message')}</form></div></section>`;
  }

  function notFound() { return '<section class="page-shell empty-state"><h1>Page not found</h1><a class="btn btn-primary" href="#home">Back to Earth</a></section>'; }
  return { home, species, speciesDetail, events, volunteer, team, about, partner, contact, notFound };
}
