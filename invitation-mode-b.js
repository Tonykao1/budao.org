(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BudaoInvitationModeB = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const PILL_FIELDS = [
    ['distance', '距离'],
    ['duration', '预计'],
    ['difficulty', '难度'],
    ['surface', '路面'],
    ['elevation', '爬升'],
    ['suitableFor', '适合'],
    ['equipmentMinimum', '装备'],
    ['weather', '天气']
  ];
  const PRIMARY_FACT_KEYS = new Set(['distance', 'duration', 'difficulty', 'suitableFor']);

  function text(value) {
    return typeof value === 'string' || typeof value === 'number'
      ? String(value).trim()
      : '';
  }

  function safeHttpsUrl(value) {
    const candidate = text(value);
    if (!candidate) return '';

    try {
      const parsed = new URL(candidate);
      return parsed.protocol === 'https:' ? parsed.href : '';
    } catch (error) {
      return '';
    }
  }

  function pillsFrom(source) {
    return PILL_FIELDS.reduce(function (pills, field) {
      const value = text(source && source[field[0]]);
      if (value) pills.push({ key: field[0], label: field[1], value });
      return pills;
    }, []);
  }

  function participationFrom(value) {
    const type = text(value && value.type);
    const artifact = safeHttpsUrl(value && value.artifact);
    const hasQr = type === 'legacy_qr' && Boolean(artifact);

    return {
      type: hasQr ? 'legacy_qr' : 'none',
      artifact: hasQr ? artifact : '',
      availability: hasQr ? 'qr' : 'none'
    };
  }

  function visualFrom(value) {
    return {
      mode: text(value && value.mode) || 'original',
      source: safeHttpsUrl(value && value.source)
    };
  }

  function makeViewModel(source) {
    const pills = Array.isArray(source.pills)
      ? source.pills.reduce(function (items, pill) {
        const key = text(pill && pill.key);
        const label = text(pill && pill.label);
        const value = text(pill && pill.value);
        if (key && label && value) items.push({ key, label, value });
        return items;
      }, [])
      : pillsFrom(source);

    return {
      key: text(source.key),
      title: text(source.title) || '步道同行',
      location: text(source.location),
      date: text(source.date),
      time: text(source.time),
      timezone: text(source.timezone),
      description: text(source.description),
      meetingPlace: text(source.meetingPlace),
      pills,
      visual: visualFrom(source.visual),
      participation: participationFrom(source.participation)
    };
  }

  function snapshotToModeBViewModel(snapshot) {
    const invitation = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const facts = invitation.facts && typeof invitation.facts === 'object'
      ? invitation.facts
      : {};

    return makeViewModel({
      key: invitation.id,
      title: facts.title,
      location: facts.location,
      date: facts.date,
      time: facts.time,
      timezone: facts.timezone,
      description: facts.description,
      meetingPlace: facts.meetingPlace,
      distance: facts.distance,
      duration: facts.duration,
      difficulty: facts.difficulty,
      surface: facts.surface,
      elevation: facts.elevation,
      suitableFor: facts.suitableFor,
      equipmentMinimum: facts.equipmentMinimum,
      visual: invitation.visual,
      participation: invitation.participation
    });
  }

  function routeToModeBViewModel(route) {
    const value = route && typeof route === 'object' ? route : {};
    const locationParts = [value.country, value.city, value.region]
      .map(text)
      .filter(Boolean);
    const image = value.image || value.imageUrl || '';
    const qr = value.qrCode || value.registrationQrCode || value.registrationQr ||
      value.activityQrCode || value.qrImage || value.qr || '';

    return makeViewModel({
      key: value.id || value.routeId || value.slot || value.title || value.date,
      title: value.title,
      location: locationParts.join(' · ') || value.location,
      date: value.date,
      time: value.time,
      timezone: value.timezone,
      description: value.description,
      meetingPlace: value.meetingPlace || value.meetingPoint || value.gatheringPlace ||
        value.meetingLocation || value.assemblyPoint,
      distance: value.distance,
      duration: value.duration,
      difficulty: value.difficulty,
      surface: value.surface,
      elevation: value.elevation,
      suitableFor: value.suitableFor,
      equipmentMinimum: value.equipmentMinimum,
      weather: value.weather,
      visual: { mode: value.imageSourceMode || 'original', source: image },
      participation: qr
        ? { type: 'legacy_qr', artifact: qr }
        : { type: 'none', artifact: '' }
    });
  }

  function appendText(documentRef, parent, tag, className, value) {
    const element = documentRef.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    parent.appendChild(element);
    return element;
  }

  function appendDefinition(documentRef, list, label, value, className) {
    const item = documentRef.createElement('div');
    if (className) item.className = className;
    appendText(documentRef, item, 'dt', '', label);
    appendText(documentRef, item, 'dd', '', value);
    list.appendChild(item);
    return item;
  }

  function appendFactList(documentRef, parent, className, label, facts) {
    if (!facts.length) return null;
    const list = documentRef.createElement('dl');
    list.className = className;
    list.setAttribute('aria-label', label);
    facts.forEach(function (fact) {
      appendDefinition(documentRef, list, fact.label, fact.value, 'mode-b-fact');
    });
    parent.appendChild(list);
    return list;
  }

  function renderModeB(container, input) {
    if (!container || !container.ownerDocument) throw new Error('mode_b_container_required');
    const documentRef = container.ownerDocument;
    const viewModel = makeViewModel(input || {});
    const card = documentRef.createElement('article');
    card.className = 'mode-b-card';
    card.setAttribute('data-mode-b-key', viewModel.key);
    card.setAttribute('aria-label', viewModel.title + ' 同行邀请');

    const heading = documentRef.createElement('header');
    heading.className = 'mode-b-heading';
    appendText(documentRef, heading, 'p', 'mode-b-invitation-label', 'INVITATION');
    const hairline = documentRef.createElement('span');
    hairline.className = 'mode-b-hairline';
    hairline.setAttribute('aria-hidden', 'true');
    heading.appendChild(hairline);
    card.appendChild(heading);

    const destination = documentRef.createElement('figure');
    destination.className = 'mode-b-destination mode-b-stamp';
    destination.setAttribute('aria-label', viewModel.title + ' 目的地');
    if (viewModel.visual.source) {
      const image = documentRef.createElement('img');
      image.src = viewModel.visual.source;
      image.alt = viewModel.title + ' 目的地影像';
      image.addEventListener('error', function () {
        destination.classList.add('is-empty');
        image.remove();
        appendText(documentRef, destination, 'span', 'mode-b-stamp-empty', '此程影像静候');
      });
      destination.appendChild(image);
    } else {
      destination.classList.add('is-empty');
      appendText(documentRef, destination, 'span', 'mode-b-stamp-empty', '此程影像静候');
    }
    const postmark = documentRef.createElement('span');
    postmark.className = 'mode-b-postmark';
    postmark.setAttribute('aria-hidden', 'true');
    appendText(documentRef, postmark, 'strong', '', 'BUDAO');
    appendText(documentRef, postmark, 'small', '', viewModel.date || 'POST');
    destination.appendChild(postmark);
    card.appendChild(destination);

    const intent = documentRef.createElement('section');
    intent.className = 'mode-b-intent';
    appendText(documentRef, intent, 'h1', 'mode-b-title', viewModel.title);
    appendText(documentRef, intent, 'p', 'mode-b-preface', '这是一段被安静预备的路，也是一份邀请。');

    const occasion = documentRef.createElement('dl');
    occasion.className = 'mode-b-occasion';
    occasion.setAttribute('aria-label', '同行时间与地点');
    if (viewModel.date) appendDefinition(documentRef, occasion, '日期', viewModel.date, 'mode-b-occasion-date');
    if (viewModel.time) appendDefinition(documentRef, occasion, '时间', viewModel.time + ' 集合', 'mode-b-occasion-time');
    if (viewModel.location) appendDefinition(documentRef, occasion, '地点', viewModel.location, 'mode-b-occasion-location');
    if (occasion.children.length) intent.appendChild(occasion);
    card.appendChild(intent);

    if (viewModel.meetingPlace) {
      const meeting = documentRef.createElement('section');
      meeting.className = 'mode-b-meeting';
      meeting.setAttribute('aria-label', '集合地点');
      const meetingCopy = documentRef.createElement('div');
      appendText(documentRef, meetingCopy, 'span', 'mode-b-meeting-label', 'MEETING POINT');
      appendText(documentRef, meetingCopy, 'strong', 'mode-b-meeting-value', viewModel.meetingPlace);
      meeting.appendChild(meetingCopy);
      appendText(documentRef, meeting, 'p', 'mode-b-meeting-note', '请预留到达\n与彼此等候的时间');
      card.appendChild(meeting);
    }

    const letter = documentRef.createElement('section');
    letter.className = 'mode-b-letter';
    letter.setAttribute('aria-label', '同行邀请');
    if (viewModel.description) appendText(documentRef, letter, 'p', 'mode-b-description', viewModel.description);
    appendText(documentRef, letter, 'p', 'mode-b-call', '唯有祂感动你，让我们一路同行，共步主道。');
    card.appendChild(letter);

    const facts = documentRef.createElement('section');
    facts.className = 'mode-b-facts';
    facts.setAttribute('aria-label', '路线信息');
    const primaryFacts = viewModel.pills.filter(function (fact) { return PRIMARY_FACT_KEYS.has(fact.key); });
    const secondaryFacts = viewModel.pills.filter(function (fact) { return !PRIMARY_FACT_KEYS.has(fact.key); });
    appendFactList(documentRef, facts, 'mode-b-primary-facts', '主要路线信息', primaryFacts);
    appendFactList(documentRef, facts, 'mode-b-secondary-details', '其他路线细节', secondaryFacts);
    if (primaryFacts.length || secondaryFacts.length) card.appendChild(facts);

    const participation = documentRef.createElement('section');
    participation.className = 'mode-b-participation';
    participation.setAttribute('aria-label', '报名信息');
    const seal = documentRef.createElement('div');
    seal.className = 'mode-b-qr';
    if (viewModel.participation.availability === 'qr') {
      const qr = documentRef.createElement('img');
      qr.src = viewModel.participation.artifact;
      qr.alt = '活动报名二维码';
      qr.addEventListener('error', function () {
        seal.classList.add('is-empty');
        qr.remove();
        appendText(documentRef, seal, 'span', '', '报名码\n暂未放出');
      });
      seal.appendChild(qr);
      appendText(documentRef, participation, 'p', 'mode-b-participation-kicker', 'SCAN TO JOIN');
      appendText(documentRef, participation, 'p', 'mode-b-participation-copy', '扫码进群，即可报名');
    } else {
      seal.classList.add('is-empty');
      appendText(documentRef, seal, 'span', '', '报名码\n暂未放出');
      appendText(documentRef, participation, 'p', 'mode-b-participation-copy', '这段同行尚未放出报名码。');
    }
    participation.insertBefore(seal, participation.firstChild);
    card.appendChild(participation);

    const footer = documentRef.createElement('footer');
    footer.className = 'mode-b-footer';
    const mark = documentRef.createElement('img');
    mark.src = '/budao-logo-mark.png?v=20260719';
    mark.alt = '步道';
    footer.appendChild(mark);
    appendText(documentRef, footer, 'p', 'mode-b-motto', '余生行走，不偏左右');
    appendText(documentRef, footer, 'strong', 'mode-b-site', 'budao.org');
    card.appendChild(footer);

    container.replaceChildren(card);
    return card;
  }

  return {
    snapshotToModeBViewModel,
    routeToModeBViewModel,
    renderModeB,
    safeHttpsUrl
  };
}));
