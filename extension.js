// Code Feedback — capture {file, line range, snippet, note} across many files,
// track each as Open/Resolved, filter them live (text + #tags w/ autocomplete),
// then copy the open ones as one markdown list to paste into any AI agent.
//
// The sidebar is a WEBVIEW (not a TreeView) so it can host a real inline filter
// box, clickable tag chips, and autocomplete — none of which a TreeView allows.
// Plain CommonJS, vscode API only. No build step.

const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

// Note shape:
// { id, ws, wsLabel, file, uri, lang, lineStart, lineEnd, snippet, note,
//   status: "open"|"resolved", tags: string[] }
const STATUS_OPEN = "open";
const STATUS_RESOLVED = "resolved";
const VIEW_ID = "codeFeedbackView";

function currentWs() {
  const f =
    vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
  return f
    ? { key: f.uri.toString(), label: f.name }
    : { key: "__none__", label: "(no workspace)" };
}

// Pull #tags out of free text. Returns { note (text minus tags), tags[] }.
function parseNoteInput(raw) {
  const tags = [];
  const re = /#([\w-]+)/g;
  let m;
  while ((m = re.exec(raw)) !== null) tags.push(m[1].toLowerCase());
  const note = raw.replace(/#([\w-]+)/g, "").replace(/\s+/g, " ").trim();
  return { note, tags: Array.from(new Set(tags)) };
}

function noteToInput(n) {
  const tags = (n.tags || []).map((t) => "#" + t).join(" ");
  return [n.note, tags].filter(Boolean).join(" ");
}

const isOpen = (n) => (n.status || STATUS_OPEN) !== STATUS_RESOLVED;
const rangeLabel = (n) =>
  n.lineStart === n.lineEnd ? `${n.lineStart}` : `${n.lineStart}-${n.lineEnd}`;

function nonce() {
  let s = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 24; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

/** @param {vscode.ExtensionContext} ctx */
function activate(ctx) {
  // ---- Storage -----------------------------------------------------------
  const storageDir = ctx.globalStorageUri.fsPath;
  const storageFile = path.join(storageDir, "notes.json");

  const load = () => {
    let raw = [];
    try {
      raw = JSON.parse(fs.readFileSync(storageFile, "utf8"));
    } catch (_) {
      raw = [];
    }
    return raw.map((n) => ({ status: STATUS_OPEN, tags: [], ...n }));
  };

  /** @type {Array<any>} */
  let notes = load();

  const save = () => {
    try {
      fs.mkdirSync(storageDir, { recursive: true });
      fs.writeFileSync(storageFile, JSON.stringify(notes, null, 2), "utf8");
    } catch (e) {
      vscode.window.showErrorMessage("Code Feedback: failed to save — " + e.message);
    }
  };

  console.log(`[Code Feedback] notes stored at ${storageFile} (${notes.length} loaded)`);

  const projectNotes = () => {
    const { key } = currentWs();
    return notes.filter((n) => n.ws === key);
  };
  const byId = (id) => notes.find((n) => n.id === id);

  // ---- Editor decorations -----------------------------------------------
  const decoOpen = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: "rgba(255, 197, 61, 0.10)",
    borderWidth: "0 0 0 2px",
    borderStyle: "solid",
    borderColor: new vscode.ThemeColor("editorWarning.foreground"),
    overviewRulerColor: new vscode.ThemeColor("editorWarning.foreground"),
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    gutterIconPath: vscode.Uri.parse(
      "data:image/svg+xml;base64," +
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="3" fill="#f5c53d"/></svg>'
        ).toString("base64")
    ),
    gutterIconSize: "auto",
  });
  const decoResolved = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: "rgba(128, 128, 128, 0.05)",
    borderWidth: "0 0 0 2px",
    borderStyle: "solid",
    borderColor: new vscode.ThemeColor("disabledForeground"),
    overviewRulerColor: new vscode.ThemeColor("disabledForeground"),
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    gutterIconPath: vscode.Uri.parse(
      "data:image/svg+xml;base64," +
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M4 8l3 3 5-6" stroke="#8a8a8a" stroke-width="2" fill="none"/></svg>'
        ).toString("base64")
    ),
    gutterIconSize: "auto",
  });

  const decorate = (editor) => {
    if (!editor) return;
    const key = editor.document.uri.toString();
    const mine = notes.filter((n) => n.uri === key);
    const toRange = (n) => {
      const start = Math.max(0, n.lineStart - 1);
      const end = Math.max(start, n.lineEnd - 1);
      const hover = new vscode.MarkdownString(
        `📝 **Code Feedback** (${isOpen(n) ? "open" : "resolved"})\n\n${n.note || "(empty note)"}`
      );
      return { range: new vscode.Range(start, 0, end, 0), hoverMessage: hover };
    };
    editor.setDecorations(decoOpen, mine.filter(isOpen).map(toRange));
    editor.setDecorations(decoResolved, mine.filter((n) => !isOpen(n)).map(toRange));
  };
  const decorateAll = () =>
    vscode.window.visibleTextEditors.forEach((e) => decorate(e));

  // ---- Webview view ------------------------------------------------------
  let view = null; // vscode.WebviewView

  const postState = () => {
    if (!view) return;
    const mine = projectNotes();
    const tags = Array.from(new Set(mine.flatMap((n) => n.tags || []))).sort();
    const ed = vscode.window.activeTextEditor;
    const activeFile = ed ? vscode.workspace.asRelativePath(ed.document.uri) : null;
    view.webview.postMessage({
      type: "state",
      wsLabel: currentWs().label,
      activeFile,
      notes: mine.map((n) => ({
        id: n.id,
        file: n.file,
        range: rangeLabel(n),
        note: n.note,
        tags: n.tags || [],
        snippet: n.snippet,
        lang: n.lang,
        open: isOpen(n),
      })),
      tags,
    });
  };

  const refresh = () => {
    postState();
    decorateAll();
  };

  const provider = {
    resolveWebviewView(webviewView) {
      view = webviewView;
      webviewView.webview.options = { enableScripts: true };
      webviewView.webview.html = getHtml(webviewView.webview);
      webviewView.webview.onDidReceiveMessage((msg) => onMessage(msg));
      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) postState();
      });
      postState();
    },
  };

  const onMessage = async (msg) => {
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case "ready":
        postState();
        break;
      case "reveal":
        await openNote(byId(msg.id));
        break;
      case "resolve":
        setStatus(msg.id, STATUS_RESOLVED);
        break;
      case "reopen":
        setStatus(msg.id, STATUS_OPEN);
        break;
      case "edit":
        await editNote(msg.id);
        break;
      case "delete":
        deleteNote(msg.id);
        break;
      case "copyOpen":
        await copyAll();
        break;
    }
  };

  // ---- Actions -----------------------------------------------------------
  const setStatus = (id, status) => {
    const n = byId(id);
    if (!n) return;
    n.status = status;
    save();
    refresh();
  };

  const editNote = async (id) => {
    const n = byId(id);
    if (!n) return;
    const raw = await vscode.window.showInputBox({
      prompt: `Edit note for ${n.file}:${n.lineStart}  (use #tags)`,
      value: noteToInput(n),
    });
    if (raw === undefined) return;
    const parsed = parseNoteInput(raw);
    n.note = parsed.note;
    n.tags = parsed.tags;
    save();
    refresh();
  };

  const deleteNote = (id) => {
    if (!id) return;
    notes = notes.filter((n) => n.id !== id);
    save();
    refresh();
  };

  const openNote = async (n) => {
    if (!n || !n.uri) return;
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(n.uri));
    const editor = await vscode.window.showTextDocument(doc);
    const startLine = Math.max(0, n.lineStart - 1);
    const endLine = Math.max(startLine, n.lineEnd - 1);
    const endCol = doc.lineAt(endLine).text.length;
    const selection = new vscode.Selection(startLine, 0, endLine, endCol);
    editor.selection = selection;
    editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
    decorate(editor);
  };

  // ---- Add note (from editor) -------------------------------------------
  const addNote = async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("Code Feedback: no active editor.");
      return;
    }
    const sel = editor.selection;
    const start = sel.start.line;
    const end = sel.isEmpty ? sel.start.line : sel.end.line;
    const doc = editor.document;
    const snippet = doc
      .getText(new vscode.Range(start, 0, end, doc.lineAt(end).text.length))
      .replace(/\s+$/g, "");

    // Plain input box (reliable Enter-to-save). Tag autocomplete lives in the
    // filter box; here you just type #tags inline if you want them.
    const raw = await vscode.window.showInputBox({
      prompt: `Note for ${vscode.workspace.asRelativePath(doc.uri)}:${start + 1}-${end + 1}`,
      placeHolder: "Your feedback…  add #tags inline, e.g. broken auth #bug #api",
    });
    if (raw === undefined) return;
    const { note, tags } = parseNoteInput(raw);

    const ws = currentWs();
    notes.push({
      id: `${Date.now()}-${Math.floor(start)}-${notes.length}`,
      ws: ws.key,
      wsLabel: ws.label,
      file: vscode.workspace.asRelativePath(doc.uri),
      uri: doc.uri.toString(),
      lang: doc.languageId || "",
      lineStart: start + 1,
      lineEnd: end + 1,
      snippet,
      note,
      status: STATUS_OPEN,
      tags,
    });
    save();
    refresh();
    vscode.window.setStatusBarMessage("Code Feedback: note added", 2000);
  };

  // ---- Copy / preview / clear (title-bar commands) ----------------------
  const formatList = (list, opts) => {
    const markResolved = opts && opts.markResolved;
    const lines = ["## Feedback notes", ""];
    list.forEach((n, i) => {
      const tagStr = (n.tags || []).map((t) => "#" + t).join(" ");
      lines.push(`${i + 1}. \`${n.file}:${rangeLabel(n)}\`${tagStr ? `  ${tagStr}` : ""}`);
      const prefix = markResolved && !isOpen(n) ? "[resolved] " : "";
      if (n.note) lines.push(`   > ${prefix}${n.note}`);
      if (n.snippet) {
        lines.push("");
        lines.push("   ```" + n.lang);
        n.snippet.split("\n").forEach((s) => lines.push("   " + s));
        lines.push("   ```");
      }
      lines.push("");
    });
    return lines.join("\n").replace(/\n+$/g, "\n");
  };

  const copyAll = async () => {
    const list = projectNotes().filter(isOpen);
    if (!list.length) {
      vscode.window.showInformationMessage("Code Feedback: no open notes to copy.");
      return;
    }
    await vscode.env.clipboard.writeText(formatList(list));
    vscode.window.showInformationMessage(`Code Feedback: copied ${list.length} open note(s).`);
  };

  const copyAllIncludingResolved = async () => {
    const list = projectNotes();
    if (!list.length) {
      vscode.window.showInformationMessage("Code Feedback: nothing to copy.");
      return;
    }
    await vscode.env.clipboard.writeText(formatList(list, { markResolved: true }));
    vscode.window.showInformationMessage(`Code Feedback: copied ${list.length} note(s).`);
  };

  const previewAll = async () => {
    if (!notes.length) {
      vscode.window.showInformationMessage("Code Feedback: no notes anywhere yet.");
      return;
    }
    const groups = new Map();
    notes.forEach((n) => {
      if (!groups.has(n.wsLabel)) groups.set(n.wsLabel, []);
      groups.get(n.wsLabel).push(n);
    });
    const parts = [`# Code Feedback — all projects (${notes.length} note(s))`, ""];
    for (const [label, list] of groups) {
      const open = list.filter(isOpen).length;
      parts.push(`# ${label} — ${list.length} note(s), ${open} open`, "");
      parts.push(formatList(list, { markResolved: true }), "");
    }
    const doc = await vscode.workspace.openTextDocument({
      content: parts.join("\n"),
      language: "markdown",
    });
    await vscode.window.showTextDocument(doc, { preview: true });
  };

  const clearResolved = async () => {
    const { key } = currentWs();
    const count = notes.filter((n) => n.ws === key && !isOpen(n)).length;
    if (!count) {
      vscode.window.showInformationMessage("Code Feedback: no resolved notes here.");
      return;
    }
    const pick = await vscode.window.showWarningMessage(
      `Delete ${count} resolved note(s) in this project?`,
      { modal: true },
      "Delete"
    );
    if (pick !== "Delete") return;
    notes = notes.filter((n) => !(n.ws === key && !isOpen(n)));
    save();
    refresh();
  };

  const clearAll = async () => {
    const { key } = currentWs();
    const count = notes.filter((n) => n.ws === key).length;
    if (!count) return;
    const pick = await vscode.window.showWarningMessage(
      `Clear all ${count} note(s) in this project?`,
      { modal: true },
      "Clear"
    );
    if (pick !== "Clear") return;
    notes = notes.filter((n) => n.ws !== key);
    save();
    refresh();
  };

  const clearAllProjects = async () => {
    if (!notes.length) return;
    const pick = await vscode.window.showWarningMessage(
      `Clear all ${notes.length} note(s) across ALL projects? This cannot be undone.`,
      { modal: true },
      "Clear Everything"
    );
    if (pick !== "Clear Everything") return;
    notes = [];
    save();
    refresh();
  };

  // ---- Register ----------------------------------------------------------
  vscode.window.onDidChangeActiveTextEditor((e) => {
    decorate(e);
    postState(); // project may have changed
  }, null, ctx.subscriptions);
  vscode.window.onDidChangeVisibleTextEditors(() => decorateAll(), null, ctx.subscriptions);

  ctx.subscriptions.push(
    decoOpen,
    decoResolved,
    vscode.window.registerWebviewViewProvider(VIEW_ID, provider),
    vscode.commands.registerCommand("codeFeedback.addNote", addNote),
    vscode.commands.registerCommand("codeFeedback.copyAll", copyAll),
    vscode.commands.registerCommand("codeFeedback.copyAllIncludingResolved", copyAllIncludingResolved),
    vscode.commands.registerCommand("codeFeedback.previewAll", previewAll),
    vscode.commands.registerCommand("codeFeedback.clearResolved", clearResolved),
    vscode.commands.registerCommand("codeFeedback.clearAll", clearAll),
    vscode.commands.registerCommand("codeFeedback.clearAllProjects", clearAllProjects)
  );

  // Paint gutter marks for whatever is already open when the extension loads,
  // and whenever a document opens — so noted lines are visible by default,
  // without having to click a note first.
  decorateAll();
  vscode.workspace.onDidOpenTextDocument(() => decorateAll(), null, ctx.subscriptions);
}

// ---- Webview HTML --------------------------------------------------------
function getHtml(webview) {
  const n = nonce();
  const csp = [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    `script-src 'nonce-${n}'`,
  ].join("; ");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); }

  /* filter bar */
  .bar { position: sticky; top: 0; z-index: 2; background: var(--vscode-sideBar-background); padding: 6px 8px 4px; }
  #filter { width: 100%; padding: 3px 6px; background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent); border-radius: 2px; outline: none; }
  #filter:focus { border-color: var(--vscode-focusBorder); }
  #scope { margin-top: 5px; }
  #fileToggle { all: unset; cursor: pointer; font-size: 11px; padding: 1px 8px; border-radius: 8px;
    border: 1px solid var(--vscode-input-border, var(--vscode-badge-background)); opacity: .7; user-select: none; }
  #fileToggle:hover { opacity: 1; }
  #fileToggle.active { opacity: 1; background: var(--vscode-button-background); color: var(--vscode-button-foreground);
    border-color: var(--vscode-focusBorder); font-weight: 600; }
  #chips { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 5px; }
  .chip { cursor: pointer; padding: 0 7px; line-height: 16px; border-radius: 8px; font-size: 11px;
    background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); opacity: .6;
    border: 1px solid transparent; user-select: none; }
  .chip:hover { opacity: .9; }
  .chip.active { opacity: 1; background: var(--vscode-button-background); color: var(--vscode-button-foreground);
    border-color: var(--vscode-focusBorder); font-weight: 600; }

  /* group header — looks like a tree section */
  .ghead { display: flex; align-items: center; height: 22px; padding: 0 8px 0 4px; cursor: pointer; user-select: none;
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground)); }
  .ghead:hover { background: var(--vscode-list-hoverBackground); }
  .chevron { flex: none; width: 16px; height: 22px; display: inline-flex; align-items: center; justify-content: center; }
  .chevron svg { transition: transform .12s ease; opacity: .7; }
  .ghead.collapsed .chevron svg { transform: rotate(-90deg); }
  .gcount { opacity: .55; margin-left: 6px; font-weight: 400; }
  .gbody.collapsed { display: none; }

  /* note row — single line, native list item */
  .row { position: relative; display: flex; align-items: center; height: 22px; padding: 0 8px 0 18px;
    cursor: pointer; white-space: nowrap; overflow: hidden; }
  .row:hover { background: var(--vscode-list-hoverBackground); }
  .dot { flex: none; width: 6px; height: 6px; border-radius: 50%; margin-right: 7px; background: var(--vscode-editorWarning-foreground); }
  .row.resolved .dot { background: var(--vscode-disabledForeground); }
  .row.resolved .label { text-decoration: line-through; opacity: .6; }
  .label { flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; }
  .desc { flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; opacity: .55; font-size: .92em; margin-left: 8px; }
  .tag { color: var(--vscode-textLink-foreground); opacity: .8; margin-left: 5px; font-size: .9em; }

  /* hover actions, right-aligned, hidden until row hover (native inline-action feel) */
  .acts { position: absolute; right: 4px; top: 0; height: 22px; display: none; align-items: center; gap: 2px;
    background: var(--vscode-list-hoverBackground); padding-left: 6px; }
  .row:hover .acts { display: flex; }
  .acts button { all: unset; cursor: pointer; width: 20px; height: 20px; text-align: center; line-height: 20px;
    border-radius: 3px; opacity: .75; font-size: 13px; }
  .acts button:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }

  .empty { opacity: .55; padding: 12px 10px; font-size: 12px; }
  .count { font-size: 11px; opacity: .55; padding: 2px 10px 6px; }
</style>
</head>
<body>
  <div class="bar">
    <input id="filter" type="text" placeholder="Filter… text or #tag" list="tagDatalist" autocomplete="off" />
    <datalist id="tagDatalist"></datalist>
    <div id="scope"><button id="fileToggle" title="Show only notes for the file you're viewing">This file only</button></div>
    <div id="chips"></div>
  </div>
  <div class="count" id="count"></div>
  <div id="list"></div>

<script nonce="${n}">
  const vscode = acquireVsCodeApi();
  let data = { notes: [], tags: [], wsLabel: "", activeFile: null };
  let filterText = "";
  const activeTags = new Set();
  // collapse + scope state persisted across reloads
  const persisted = vscode.getState() || {};
  const collapsed = { open: !!persisted.open, resolved: persisted.resolved !== false };
  let fileOnly = !!persisted.fileOnly;
  const saveState = () => vscode.setState({ ...collapsed, fileOnly });

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;" }[c]));

  function matches(note) {
    if (fileOnly && data.activeFile && note.file !== data.activeFile) return false;
    for (const t of activeTags) if (!(note.tags||[]).includes(t)) return false;
    const toks = filterText.toLowerCase().split(/\\s+/).filter(Boolean);
    for (const tok of toks) {
      if (tok.startsWith("#") && tok.length > 1) {
        if (!(note.tags||[]).includes(tok.slice(1))) return false;
      } else {
        const hay = (note.file + " " + note.note + " " + note.snippet + " " + (note.tags||[]).join(" ")).toLowerCase();
        if (!hay.includes(tok)) return false;
      }
    }
    return true;
  }

  function renderChips() {
    const c = $("chips");
    c.innerHTML = "";
    if (!data.tags.length) { c.style.display = "none"; return; }
    c.style.display = "flex";
    data.tags.forEach((t) => {
      const el = document.createElement("span");
      el.className = "chip" + (activeTags.has(t) ? " active" : "");
      el.textContent = "#" + t;
      el.onclick = () => { activeTags.has(t) ? activeTags.delete(t) : activeTags.add(t); renderChips(); render(); };
      c.appendChild(el);
    });
    $("tagDatalist").innerHTML = data.tags.map((t) => '<option value="#' + esc(t) + '">').join("");
  }

  function rowHtml(note) {
    const tags = (note.tags||[]).map((t)=>'<span class="tag">#'+esc(t)+'</span>').join("");
    const acts = '<span class="acts">' +
      (note.open ? '<button data-act="resolve" title="Mark resolved">✓</button>'
                 : '<button data-act="reopen" title="Reopen">↺</button>') +
      '<button data-act="edit" title="Edit">✎</button>' +
      '<button data-act="delete" title="Delete">✕</button></span>';
    return '<div class="row ' + (note.open ? "" : "resolved") + '" data-id="' + esc(note.id) + '" title="' + esc(note.note) + '\\n' + esc(note.file) + ':' + esc(note.range) + '">' +
      '<span class="dot"></span>' +
      '<span class="label">' + esc(note.note || "(empty note)") + '</span>' +
      '<span class="desc">' + esc(note.file) + ':' + esc(note.range) + tags + '</span>' +
      acts + '</div>';
  }

  function groupHtml(key, title, list) {
    const isCol = collapsed[key];
    return '<div class="ghead' + (isCol ? " collapsed" : "") + '" data-group="' + key + '">' +
        '<span class="chevron"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6.5L8 9.5 11 6.5"/></svg></span>' + title +
        '<span class="gcount">' + list.length + '</span></div>' +
      '<div class="gbody' + (isCol ? " collapsed" : "") + '">' + list.map(rowHtml).join("") + '</div>';
  }

  function render() {
    $("fileToggle").className = fileOnly ? "active" : "";
    const filtered = data.notes.filter(matches);
    const open = filtered.filter((n) => n.open);
    const resolved = filtered.filter((n) => !n.open);
    const scope = fileOnly && data.activeFile ? " · " + data.activeFile.split("/").pop() : "";
    $("count").textContent = data.wsLabel + scope + " — " + open.length + " open" +
      (resolved.length ? ", " + resolved.length + " resolved" : "");

    if (!data.notes.length) {
      $("list").innerHTML = '<div class="empty">No notes yet. Select code and press ⌥⌘N.</div>';
      return;
    }
    if (!filtered.length) { $("list").innerHTML = '<div class="empty">No notes match.</div>'; return; }
    let html = groupHtml("open", "Open", open);
    if (resolved.length) html += groupHtml("resolved", "Resolved", resolved);
    $("list").innerHTML = html;
  }

  $("list").addEventListener("click", (e) => {
    const ghead = e.target.closest(".ghead");
    if (ghead) {
      const k = ghead.getAttribute("data-group");
      collapsed[k] = !collapsed[k];
      saveState();
      render();
      return;
    }
    const row = e.target.closest(".row");
    if (!row) return;
    const id = row.getAttribute("data-id");
    const btn = e.target.closest("button");
    if (btn) { e.stopPropagation(); vscode.postMessage({ type: btn.getAttribute("data-act"), id }); return; }
    vscode.postMessage({ type: "reveal", id });
  });

  $("filter").addEventListener("input", (e) => { filterText = e.target.value; render(); });
  $("fileToggle").addEventListener("click", () => { fileOnly = !fileOnly; saveState(); render(); });

  window.addEventListener("message", (e) => {
    const msg = e.data;
    if (msg.type === "state") {
      data = { notes: msg.notes, tags: msg.tags, wsLabel: msg.wsLabel, activeFile: msg.activeFile };
      for (const t of [...activeTags]) if (!data.tags.includes(t)) activeTags.delete(t);
      renderChips();
      render();
    }
  });

  vscode.postMessage({ type: "ready" });
</script>
</body>
</html>`;
}

function deactivate() {}

module.exports = { activate, deactivate };
