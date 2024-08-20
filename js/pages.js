const securityId = "aidevsuite_a1b2c3";

const defaultPages = new Set([
    '',
    'home',
    'local',
    'extern',
    'worker',
    'help',
]);

const specialFlowPages = new Set([
    'local',
    'extern',
]);

const flowPages = new Set([
    'local',
    'extern',
    'local',
    'help',
]);

let localPages = new Map();
let linkedPages = new Map();

const samples = ['data/Fetch.json', 'data/Simple Chat.json', 'data/Chat.json', 'data/Encoder.json', 'data/Word Counter.json', 'data/Image To DataURL.json'];

let isUser = false;

const pageLoadedEvent = new CustomEvent("pageloaded");

function loadLocalPages() {
    const localPagesJSON = localStorage.getItem('pages');
    if (localPagesJSON) {
        localPages = new Map(Object.entries(JSON.parse(localPagesJSON)));
        for (let page of localPages.values()) {
            page.id ??= generateUniqueId();
            page.securityId = securityId;
        }

        return localPages;
    }
    return localPages = new Map();
}

function saveLocalPages() {
    const localPagesObj = {};
    for (let entry of localPages.entries()) localPagesObj[entry[0]] = entry[1];
    localStorage.setItem('pages', JSON.stringify(localPagesObj));

    updatePagesSidebar();
}

function addLocalPage(name, link, code, options = null) {
    if (defaultPages.has(link)) return;

    options ??= {};
    if (link.trim() == '') {
        Flow.updateDefaultCode(code);
        return;
    }

    // Just to be extra sure check for collisions
    const ids = new Set();
    localPages.values().forEach(p => ids.add(p.id));
    let id;
    do {
        id = generateUniqueId();
    } while (ids.has(id));

    localPages.set(link, {
        securityId, id, name, link, code,
        prompt: options.prompt,
        autoRun: options.autoRun,
    });
    saveLocalPages();
}

function updateLocalPage(page) {
    if (defaultPages.has(page.link)) return;

    localPages.set(page.link, page);
    saveLocalPages();
}

function deleteLocalPage(page) {
    if (defaultPages.has(page.link)) return;

    localPages.delete(page.link);

    const scriptStorage = JSON.parse(localStorage.getItem('scriptStorage')) ?? {};
    if (page.id != null) delete scriptStorage[page.id];
    localStorage.setItem('scriptStorage', JSON.stringify(scriptStorage));

    saveLocalPages();
}

function moveLocalPage(page, newLink) {
    addLocalPage(page.name, newLink, page.code, page);
    deleteLocalPage(page);
    saveLocalPages();
}

async function fetchExternalPage(url) {
    const localIdentifier = '#local/';
    if (url.startsWith(localIdentifier)) {
        const page = localPages.get(url.split(localIdentifier)[1].split('?')[0]);
        return { code: page.code };
    }

    const data = await fetchJson(url);
    if (data.securityId !== securityId) {
        console.log("Error Source:", url, data);
        throw new Error('Security check failed.')
    }
    ;

    return data;
}

function loadLinkedPages() {
    const linkedPagesJSON = localStorage.getItem('linkedPages');
    if (linkedPagesJSON) {
        linkedPages = new Map(Object.entries(JSON.parse(linkedPagesJSON)));
    } else linkedPages = new Map();

    const chatInjected = localStorage.getItem("chat_injected");
    if (!chatInjected) {
        const chatLink = "data/Chat.json";
        fetchExternalPage(chatLink).then(p => {
            addLinkedPage(p.name, chatLink);
            localStorage.setItem('chat_injected', true);
        });
    }

    return linkedPages;
}

function saveLinkedPages() {
    const linkedPagesObj = {};
    for (let entry of linkedPages.entries()) linkedPagesObj[entry[0]] = entry[1];
    localStorage.setItem('linkedPages', JSON.stringify(linkedPagesObj));

    updatePagesSidebar();
}

function addLinkedPage(name, url, options = null) {
    options ??= {};
    linkedPages.set(url, {
        name, link: url,
        autoRun: options.autoRun,
    });
    saveLinkedPages();
}

function updateLinkedPage(page) {
    linkedPages.set(page.link, page);
    saveLinkedPages();
}

function deleteLinkedPage(link) {
    linkedPages.delete(link);
    saveLinkedPages();
}

function suggestNameForPageLink(link) {
    return escapeFileNameMinimal(link);
}

function getValidHashUrls() {
    return [...defaultPages, ...localPages.keys()];
}

function updatePagesSidebar() {
    const name = getPathFromHash();

    // Local pages
    const localPagesList = document.getElementById('localPagesList');
    localPagesList.innerHTML = '';
    localPages.values().forEach(p => {
        let link = '#local/' + p.link;
        const params = [];
        if (p.autoRun) params.push('mode=run');
        if (isUser) params.push('user=true');
        if (params.length != 0) link += '?' + params[0];
        for (let i = 1; i < params.length; i++) {
            link += params[i];
        }

        const element = fromHTML(`<a class="element sidebarElement hoverable">`);
        element.textContent = p.name;
        element.setAttribute('href', link);
        if (p.link == name) {
            element.setAttribute('title', "You are here. F5 to reload.");
            element.setAttribute('disabled', '');
        }

        localPagesList.appendChild(element)
    });
    if (localPages.size == 0) localPagesList.classList.add('hide');
    else localPagesList.classList.remove('hide');

    // Linked pages
    const linkedPagesList = document.getElementById('linkedPagesList');
    linkedPagesList.innerHTML = '';
    linkedPages.values().forEach(p => {
        let link = '#extern?url=' + escapeHashParameter(p.link);
        if (p.autoRun) link += '&mode=run';
        if (isUser) link += '&user=true';

        const element = fromHTML(`<a class="element sidebarElement hoverable">`);
        element.textContent = p.name;
        element.setAttribute('href', link);
        if (p.link == getHashQueryVariable('url')) {
            element.setAttribute('title', "You are here. F5 to reload.");
            element.setAttribute('disabled', '');
        }

        linkedPagesList.appendChild(element)
    });
    if (linkedPages.size == 0) linkedPagesList.classList.add('hide');
    else linkedPagesList.classList.remove('hide');
}

// Function to handle hash changes
function loadPage() {
    isUser = getHashQueryVariable('user') ?? false;
    ['homeButton', 'localButton', 'externButton', 'helpButton'].forEach(id => {
        const element = document.getElementById(id);
        let href = element.getAttribute('href');
        if (isUser) {
            if (!href.endsWith('?user=true')) href += '?user=true';
        } else {
            if (href.endsWith('?user=true')) href = href.replace('?user=true', '');
        }
        element.setAttribute('href', href);
    });
    ['workerButton'].forEach(id => {
        const element = document.getElementById(id);
        if (isUser) {
            element.classList.add('hide');
        } else {
            element.classList.remove('hide');
        }
    });

    const hash = getHash();
    loadLocalPages();
    loadLinkedPages();
    const topPath = getPathPartFromHash(0);

    const page = document.getElementById('pages');

    // Show the section corresponding to the hash
    let newPage;
    const link = getPathFromHash();
    let isFlow = false;
    if (hash == '' || hash == '#' || hash == '#home') {
        removeHash();
        newPage = getHomePage();
    } else if (hash.startsWith('#?')) {
        newPage = getHomePage();
    } else if (topPath == 'local' ||
        link == 'extern') {
        isFlow = true;
        newPage = getFlowPage();
    } else if (link == 'worker') {
        newPage = getWorkerPage();
    } else if (link == 'help') {
        if (settings.disabledAI) {
            newPage = getHelpPage();
        } else {
            isFlow = true;
            newPage = getFlowPage();
        }
    } else {
        openPage();
        return;
    }

    if (!Array.isArray(newPage)) newPage = [newPage];
    page.replaceChildren(...newPage);
    if (isFlow) Flow.adjustContentHeight();

    updatePagesSidebar();
    updateSidebar();

    console.log("Page loaded:", hash);
    window.dispatchEvent(pageLoadedEvent);

    if (!localStorage.getItem('has_init')) {
        Settings.open();
        localStorage.setItem('has_init', true);
    }
}

function openPage(page = null) {
    let href = page == null ? '#' : '#' + page;
    if (isUser) href += "?user=true";
    window.location.href = href;
}

function getHomePage() {
    const container = fromHTML(`<div>`);

    // Local pages title bar
    const titleBar = fromHTML(`<div class="listContainerHorizontal">`);
    const title = fromHTML(`<h1>Local Scripts`);
    titleBar.appendChild(title);
    const rightTitleList = fromHTML(`<div class="listHorizontal">`);
    const createButton = fromHTML(`<button class="complexButton largeElement">Start Creating`);
    createButton.addEventListener('click', e => openPage('local'));
    rightTitleList.appendChild(createButton);
    titleBar.appendChild(rightTitleList);
    container.appendChild(titleBar);

    // Local pages grid
    const grid = fromHTML(`<div class="listHorizontal">`);
    const pages = localPages.values();
    for (let page of pages) {
        const pageElement = fromHTML(`<a class="giantElement raised xl-font">`);
        let href = '#local/' + page.link;
        if (isUser) href += '?user=true';
        pageElement.setAttribute('href', href);
        pageElement.textContent = page.name ?? '[unnamed]';
        grid.appendChild(pageElement);
    }
    if (localPages.size == 0) container.appendChild(fromHTML(`<div>No scripts created yet.`));
    else container.appendChild(grid);
    container.appendChild(hb(4));

    // Linked pages title bar
    const linkedTitleBar = fromHTML(`<div class="listContainerHorizontal">`);
    const linkedTitle = fromHTML(`<h1>Linked Scripts`);
    linkedTitleBar.appendChild(linkedTitle);
    container.appendChild(linkedTitleBar);

    // Linked pages grid
    const linkedGrid = fromHTML(`<div class="listHorizontal">`);
    const linkedValues = linkedPages.values();
    for (let page of linkedValues) {
        const pageElement = fromHTML(`<a class="giantElement raised xl-font">`);
        let href = '#extern?url=' + page.link;
        if (isUser) href += '&user=true';
        pageElement.setAttribute('href', href);
        pageElement.textContent = page.name ?? '[unnamed]';
        linkedGrid.appendChild(pageElement);
    }
    if (linkedPages.size == 0) container.appendChild(fromHTML(`<div>No scripts linked yet.`));
    else container.appendChild(linkedGrid);
    container.appendChild(hb(4));

    // Samples pages title bar
    const samplesTitleBar = fromHTML(`<div class="listContainerHorizontal">`);
    const samplesTitle = fromHTML(`<h1>Sample Scripts`);
    samplesTitleBar.appendChild(samplesTitle);
    container.appendChild(samplesTitleBar);

    // Sample pages grid
    const samplesGrid = fromHTML(`<div class="listHorizontal">`);
    for (let link of samples) {
        fetchExternalPage(link).then(page => {
            const pageElement = fromHTML(`<a class="giantElement raised xl-font">`);
            let href = '#extern?url=' + link;
            if (isUser) href += '&user=true';
            pageElement.setAttribute('href', href);
            pageElement.textContent = page.name ?? '[unnamed]';
            samplesGrid.appendChild(pageElement);
        });
    }
    container.appendChild(samplesGrid);

    return container;
}

function getHelpPage() {
    return 'This is very helpful help.';
}

// Listen for hashchange events
window.addEventListener('hashchange', loadPage);
window.addEventListener('load', loadPage);