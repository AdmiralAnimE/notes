const formats = [
  'bold',
  'font',
  'italic',
  'size',
  'strike',
  'header',
  'indent',
  'list',
  'direction',
  'align'
];
const UI_LANG = browser.i18n.getUILanguage();
const RTL_LANGS = ['ar', 'fa', 'he'];
const LANG_DIR = RTL_LANGS.includes(UI_LANG) ? 'rtl' : 'ltr';
const TEXT_ALIGN_DIR = LANG_DIR === 'rtl' ? 'right' : 'left';

// Additional keyboard shortcuts for non-default toolbar buttons
const bindings = {
  strike: {           // ⌘/Ctrl+Shift+X
    key: 'X',
    shiftKey: true,
    shortKey: true,
    handler: function(range) {
      if (this.quill.getFormat(range).strike === true)
        this.quill.formatText(range, 'strike', false);
      else
        this.quill.formatText(range, 'strike', true);
    }
  }, ordered: {       // ⌘/Ctrl+Shift+1
    key: '1',
    shiftKey: true,
    shortKey: true,
    handler: function(range) {
      if (this.quill.getFormat(range).list === 'ordered')
        this.quill.formatLine(range, {'list': false}, true);
      else
        this.quill.formatLine(range, {'list': 'ordered'}, true);
    }
  }, bullet: {        // ⌘/Ctrl+Shift+2
    key: '2',
    shiftKey: true,
    shortKey: true,
    handler: function(range) {
      if (this.quill.getFormat(range).list === 'bullet')
        this.quill.formatLine(range, {'list': false}, true);
      else
        this.quill.formatLine(range, {'list': 'bullet'}, true);
    }
  }
};

const fontSizeStyle = Quill.import('attributors/style/size');
fontSizeStyle.whitelist = ['12px', '14px', '16px', '18px', '20px'];
Quill.register(fontSizeStyle, true);

// add text direction icon to toolbar if RTL
const qlDirection = document.getElementById('ql-direction');
if (LANG_DIR === 'rtl') {
  qlDirection.innerHTML = '<button class="ql-direction" value="rtl"></button>';
}

const quill = new Quill('#editor', {
  theme: 'snow',
  placeholder: browser.i18n.getMessage('emptyPlaceHolder'),
  modules: {
    keyboard: {
      bindings: bindings
    },
    toolbar: '#toolbar'
  },
  formats: formats // enabled formats, see https://github.com/quilljs/quill/issues/1108
});

let userOSKey;

if (navigator.appVersion.indexOf('Mac') !== -1)
  userOSKey = '⌘';
else
  userOSKey = 'Ctrl';

const size = document.getElementsByClassName('ql-size')[0],
      bold = document.getElementsByClassName('ql-bold')[0],
      italic = document.getElementsByClassName('ql-italic')[0],
      strike = document.getElementsByClassName('ql-strike')[0],
      ordered = document.getElementsByClassName('ql-list')[0],
      bullet = document.getElementsByClassName('ql-list')[1];

// Setting button titles in place of tooltips
size.title = browser.i18n.getMessage('fontSizeTitle');
bold.title = browser.i18n.getMessage('boldTitle') + ' (' + userOSKey + '+B)';
italic.title = browser.i18n.getMessage('italicTitle') + ' (' + userOSKey + '+I)';
strike.title = browser.i18n.getMessage('strikethroughTitle') + ' (' + userOSKey + '+Shift+' + bindings.strike.key + ')';
ordered.title = browser.i18n.getMessage('numberedListTitle') + ' (' + userOSKey + '+Shift+' + bindings.ordered.key + ')';
bullet.title = browser.i18n.getMessage('bulletedListTitle') + ' (' + userOSKey + '+Shift+' + bindings.bullet.key + ')';
qlDirection.title = browser.i18n.getMessage('textDirectionTitle');

function handleLocalContent(data) {
  if (!data.hasOwnProperty('notes')) {
    quill.setContents({
      ops: [
        { attributes: { size: 'large', bold: true }, insert: browser.i18n.getMessage('welcomeTitle2') },
        { insert: '\n\n', attributes: { direction: LANG_DIR, align: TEXT_ALIGN_DIR }},
        {
          attributes: { size: 'large' },
          insert:
            browser.i18n.getMessage('welcomeText2')
        },
        { insert: '\n\n', attributes: { direction: LANG_DIR, align: TEXT_ALIGN_DIR }}
      ]
    });
  } else {
    if (JSON.stringify(quill.getContents()) !== JSON.stringify(data.notes)) {
      quill.setContents(data.notes);
    }
  }
}

function loadContent() {
  browser.storage.local.get(['notes'], data => {
    // If we have a bearer, we try to save the content.
    handleLocalContent(data);
  });
}

loadContent();

let ignoreNextLoadEvent = false;
quill.on('text-change', () => {
  const content = quill.getContents();
  browser.storage.local.set({ notes: content }).then(() => {
    // Notify other sidebars
    if (!ignoreNextLoadEvent) {
      chrome.runtime.sendMessage('notes@mozilla.com', {
        action: 'text-change'
      });
    }
    ignoreNextLoadEvent = false;
  });
});

const enableSync = document.getElementById('enable-sync');
const noteDiv = document.getElementById('sync-note');
const syncNoteBody = document.getElementById('sync-note-dialog');
const closeButton = document.getElementById('close-button');
enableSync.textContent = browser.i18n.getMessage('syncNotes');
syncNoteBody.textContent = browser.i18n.getMessage('syncNotReady2');

closeButton.addEventListener('click', () => {
  noteDiv.classList.toggle('visible');
});

enableSync.onclick = () => {
  browser.runtime.sendMessage({ action: 'authenticate' });
};

chrome.runtime.onMessage.addListener(eventData => {
  switch (eventData.action) {
    case 'text-change':
      ignoreNextLoadEvent = true;
      loadContent();
      break;
  }
});

// disable drop of links and images into notes
const qlEditor = document.querySelectorAll('.ql-editor');
qlEditor[0].addEventListener('drop', (e) => {
  e.preventDefault();
  return false;
});

chrome.runtime.onMessage.addListener(eventData => {
  switch (eventData.action) {
    case 'authenticated':
      if (eventData.err) {
        enableSync.textContent = 'Login Failed...';
      } else if (eventData.bearer) {
        enableSync.textContent = 'Synced';
        enableSync.disabled = true;
      }

      break;
  }
});
