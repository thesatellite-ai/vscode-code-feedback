// Code Feedback — capture {file, line range, snippet, note} across many files,
// track each as Open/Resolved, filter them live (text + #tags w/ autocomplete),
// then copy the open ones as one markdown list to paste into any AI agent.
//
// The sidebar is a WEBVIEW (not a TreeView) so it can host a real inline filter
// box, clickable tag chips, and autocomplete — none of which a TreeView allows.
// Compiled by tsc to out/extension.js; the only runtime imports are host-provided
// (vscode) or Node built-ins (fs/path), so the shipped extension has no deps.

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

// ---- Closed-set constants ------------------------------------------------

const STATUS_OPEN = "open";
const STATUS_RESOLVED = "resolved";
/** Lifecycle of a note. The only two states a note can be in. */
type Status = typeof STATUS_OPEN | typeof STATUS_RESOLVED;

const VIEW_ID = "codeFeedbackView";

/**
 * Webview ⇄ extension message protocol — the closed set of message `type`
 * values. Single source of truth: referenced by `onMessage()` AND injected
 * verbatim into the webview by `getHtml()` (as `MSG`), so the two sides can
 * never silently drift. A bare literal on one side would desync the UI from
 * its handler with no compile-time signal.
 */
const MSG = {
  READY: "ready", // webview → ext: webview booted; (re)send the render state
  STATE: "state", // ext → webview: full render payload (notes, tags, activeFile)
  REVEAL: "reveal", // webview → ext: open the note's file and select its lines
  RESOLVE: "resolve", // webview → ext: mark a note resolved
  REOPEN: "reopen", // webview → ext: mark a note open again
  EDIT: "edit", // webview → ext: edit a note's text + tags
  DELETE: "delete", // webview → ext: delete a note
  RESOLVE_BY_IDS: "resolveByIds", // webview → ext: bulk-resolve by pasted refs (payload.text)
  OPEN_RESOLVE: "openResolve", // ext → webview: reveal + focus the "resolve by ID" box
} as const;
/** Every valid inbound/outbound message `type`. */
type MsgType = (typeof MSG)[keyof typeof MSG];

/**
 * Command IDs. MUST mirror `contributes.commands` in package.json — VS Code
 * binds menus/keybindings to those strings, so this object only single-sources
 * the JS-side registrations (it cannot enforce the package.json side; keep both
 * in sync when adding a command).
 */
const CMD = {
  ADD_NOTE: "codeFeedback.addNote",
  COPY_ALL: "codeFeedback.copyAll",
  COPY_ALL_RESOLVED: "codeFeedback.copyAllIncludingResolved",
  PREVIEW_ALL: "codeFeedback.previewAll",
  RESOLVE_BY_IDS: "codeFeedback.resolveByIds",
  // Two ids share one toggle handler so the title-bar icon can reflect on/off
  // state via opposite `when` clauses (VS Code can't swap a button's icon otherwise).
  TOGGLE_FILE_ONLY: "codeFeedback.toggleFileOnly", // shown when OFF
  TOGGLE_FILE_ONLY_ACTIVE: "codeFeedback.toggleFileOnlyActive", // shown when ON
  CLEAR_RESOLVED: "codeFeedback.clearResolved",
  CLEAR_ALL: "codeFeedback.clearAll",
  CLEAR_ALL_PROJECTS: "codeFeedback.clearAllProjects",
} as const;

// ---- Data model ----------------------------------------------------------

/** A single piece of feedback anchored to a line range in one file. */
interface Note {
  /** Unique id `${epochMs}-${line}-${index}` (not a UUID; unique enough for one local store). */
  id: string;
  /** Short human-pasteable code (e.g. `a3f9`), unique across the store. Shown in the
   *  copied markdown as `[ref]` so an AI agent can report back which notes it finished;
   *  the "Resolve by IDs" action matches against this. */
  ref: string;
  /** Workspace key (folder uri string) the note belongs to; `"__none__"` when no folder is open. */
  ws: string;
  /** Human label for the workspace (folder name) — used by Preview-All grouping. */
  wsLabel: string;
  /** Workspace-relative path, for display. */
  file: string;
  /** Absolute document uri string, for reveal — survives across projects where `file` would collide. */
  uri: string;
  /** Document languageId, used as the code-fence language when copied. */
  lang: string;
  /** 1-based inclusive start line. */
  lineStart: number;
  /** 1-based inclusive end line. */
  lineEnd: number;
  /** Code captured AT ADD-TIME; it does NOT track later edits, so line numbers can drift. */
  snippet: string;
  /** Free-text feedback with `#tags` stripped out. */
  note: string;
  /** Lifecycle state. */
  status: Status;
  /** Lowercased, deduped tags parsed from `#word` tokens. */
  tags: string[];
}

/** The slim per-note projection sent to the webview (no `ws`/`uri`/internal fields). */
interface WebviewNote {
  id: string;
  ref: string;
  file: string;
  range: string;
  note: string;
  tags: string[];
  snippet: string;
  lang: string;
  open: boolean;
}

/** The full render payload pushed to the webview on every change. */
interface StatePayload {
  type: typeof MSG.STATE;
  wsLabel: string;
  activeFile: string | null;
  /** Whether the "this file only" scope is active — owned by the extension so a
   *  title-bar command can toggle it; the webview only renders by it. */
  fileOnly: boolean;
  notes: WebviewNote[];
  tags: string[];
}

// ---- Pure helpers --------------------------------------------------------

/** Active workspace identity. `key` is the stable filter id; `label` is for display. */
function currentWs(): { key: string; label: string } {
  const f = vscode.workspace.workspaceFolders?.[0];
  return f ? { key: f.uri.toString(), label: f.name } : { key: "__none__", label: "(no workspace)" };
}

/** Pull `#tags` out of free text. Returns the note text (tags removed) and the deduped, lowercased tags. */
function parseNoteInput(raw: string): { note: string; tags: string[] } {
  const tags: string[] = [];
  const re = /#([\w-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) tags.push(m[1].toLowerCase());
  const note = raw.replace(/#([\w-]+)/g, "").replace(/\s+/g, " ").trim();
  return { note, tags: Array.from(new Set(tags)) };
}

/** Rebuild the editable string (note + `#tags`) for the edit prompt. */
function noteToInput(n: Note): string {
  const tags = n.tags.map((t) => "#" + t).join(" ");
  return [n.note, tags].filter(Boolean).join(" ");
}

const isOpen = (n: Note): boolean => (n.status || STATUS_OPEN) !== STATUS_RESOLVED;

const rangeLabel = (n: { lineStart: number; lineEnd: number }): string =>
  n.lineStart === n.lineEnd ? `${n.lineStart}` : `${n.lineStart}-${n.lineEnd}`;

/** CSP nonce for the single inline webview script. */
function nonce(): string {
  let s = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 24; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

// Short ref alphabet: lowercase + digits, minus look-alikes (0/o, 1/l/i) so a
// human can read a ref off the markdown and retype it without ambiguity.
const REF_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const REF_LEN = 4;

/** Generate a short ref not already in `existing`. Falls back to a longer code on saturation. */
function makeRef(existing: Set<string>): string {
  for (let attempt = 0; attempt < 2000; attempt++) {
    let s = "";
    for (let i = 0; i < REF_LEN; i++) s += REF_ALPHABET.charAt(Math.floor(Math.random() * REF_ALPHABET.length));
    if (!existing.has(s)) return s;
  }
  // Astronomically unlikely with a 4-char space; extend rather than loop forever.
  let s = "";
  for (let i = 0; i < REF_LEN + 2; i++) s += REF_ALPHABET.charAt(Math.floor(Math.random() * REF_ALPHABET.length));
  return s;
}

/**
 * Validate one raw JSON value from the store into a Note, or null if unusable.
 *
 * Why it exists: notes.json is a trust boundary — a hand-edited or older file
 * may have missing/wrong-typed fields. We coerce with defaults and drop entries
 * that lack the irreplaceable anchors (`id`, `uri`) rather than crash or let an
 * `any` leak into the rest of the extension. Also migrates pre-status/tags notes.
 */
function toNote(raw: unknown): Note | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.uri !== "string") return null;
  const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
  const num = (v: unknown, d = 0): number => (typeof v === "number" ? v : d);
  return {
    id: r.id,
    ref: str(r.ref),
    ws: str(r.ws),
    wsLabel: str(r.wsLabel),
    file: str(r.file),
    uri: r.uri,
    lang: str(r.lang),
    lineStart: num(r.lineStart, 1),
    lineEnd: num(r.lineEnd, 1),
    snippet: str(r.snippet),
    note: str(r.note),
    status: r.status === STATUS_RESOLVED ? STATUS_RESOLVED : STATUS_OPEN,
    tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === "string") : [],
  };
}

// ---- Activation ----------------------------------------------------------

export function activate(ctx: vscode.ExtensionContext): void {
  // ---- Storage: one JSON array at <globalStorage>/notes.json -------------
  // Chosen over globalState Memento, which was unreliable across F5 dev-host
  // restarts. The path is logged on activation for inspection.
  const storageDir = ctx.globalStorageUri.fsPath;
  const storageFile = path.join(storageDir, "notes.json");

  const load = (): Note[] => {
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(storageFile, "utf8"));
    } catch {
      return [];
    }
    if (!Array.isArray(raw)) return [];
    return raw.map(toNote).filter((n): n is Note => n !== null);
  };

  let notes: Note[] = load();

  // Migrate notes that predate `ref`: assign each a unique short code once.
  const ensureRefs = (): boolean => {
    const refs = new Set(notes.map((n) => n.ref).filter(Boolean));
    let changed = false;
    for (const n of notes) {
      if (!n.ref) {
        n.ref = makeRef(refs);
        refs.add(n.ref);
        changed = true;
      }
    }
    return changed;
  };
  if (ensureRefs()) {
    // persist the backfilled refs so they're stable across sessions
    try {
      fs.mkdirSync(storageDir, { recursive: true });
      fs.writeFileSync(storageFile, JSON.stringify(notes, null, 2), "utf8");
    } catch {
      /* non-fatal: refs will be regenerated next load if the write failed */
    }
  }

  const save = (): void => {
    try {
      fs.mkdirSync(storageDir, { recursive: true });
      fs.writeFileSync(storageFile, JSON.stringify(notes, null, 2), "utf8");
    } catch (e) {
      vscode.window.showErrorMessage("Code Feedback: failed to save — " + (e as Error).message);
    }
  };

  console.log(`[Code Feedback] notes stored at ${storageFile} (${notes.length} loaded)`);

  // "This file only" scope. Owned here (not in the webview) so the title-bar
  // toggle command can drive it; persisted in globalState; mirrored to a context
  // key so the toolbar shows the on/off icon.
  const FILE_ONLY_KEY = "codeFeedback.fileOnly";
  let fileOnly = ctx.globalState.get<boolean>(FILE_ONLY_KEY, false);
  const setFileOnly = (v: boolean): void => {
    fileOnly = v;
    void ctx.globalState.update(FILE_ONLY_KEY, v);
    void vscode.commands.executeCommand("setContext", FILE_ONLY_KEY, v);
    postState();
  };

  const projectNotes = (): Note[] => {
    const { key } = currentWs();
    return notes.filter((n) => n.ws === key);
  };
  const byId = (id: string | undefined): Note | undefined =>
    id ? notes.find((n) => n.id === id) : undefined;

  // ---- Editor decorations -----------------------------------------------
  const gutterIcon = (svg: string): vscode.Uri =>
    vscode.Uri.parse("data:image/svg+xml;base64," + Buffer.from(svg).toString("base64"));

  const decoOpen = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: "rgba(255, 197, 61, 0.10)",
    borderWidth: "0 0 0 2px",
    borderStyle: "solid",
    borderColor: new vscode.ThemeColor("editorWarning.foreground"),
    overviewRulerColor: new vscode.ThemeColor("editorWarning.foreground"),
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    gutterIconPath: gutterIcon(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="3" fill="#f5c53d"/></svg>'
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
    gutterIconPath: gutterIcon(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M4 8l3 3 5-6" stroke="#8a8a8a" stroke-width="2" fill="none"/></svg>'
    ),
    gutterIconSize: "auto",
  });

  // Paint amber (open) / grey (resolved) markers for every note whose uri
  // matches this editor's document. Runs for all notes in the file regardless
  // of the sidebar's filter, so the markers always reflect reality.
  const decorate = (editor: vscode.TextEditor | undefined): void => {
    if (!editor) return;
    const key = editor.document.uri.toString();
    const mine = notes.filter((n) => n.uri === key);
    const toRange = (n: Note): vscode.DecorationOptions => {
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
  const decorateAll = (): void => vscode.window.visibleTextEditors.forEach(decorate);

  // ---- Webview view ------------------------------------------------------
  let view: vscode.WebviewView | null = null;

  const postState = (): void => {
    if (!view) return;
    const mine = projectNotes();
    const tags = Array.from(new Set(mine.flatMap((n) => n.tags))).sort();
    const ed = vscode.window.activeTextEditor;
    const activeFile = ed ? vscode.workspace.asRelativePath(ed.document.uri) : null;
    const payload: StatePayload = {
      type: MSG.STATE,
      wsLabel: currentWs().label,
      activeFile,
      fileOnly,
      notes: mine.map(
        (n): WebviewNote => ({
          id: n.id,
          ref: n.ref,
          file: n.file,
          range: rangeLabel(n),
          note: n.note,
          tags: n.tags,
          snippet: n.snippet,
          lang: n.lang,
          open: isOpen(n),
        })
      ),
      tags,
    };
    view.webview.postMessage(payload);
  };

  // The single update path. Every mutation (add / edit / delete / status / clear)
  // MUST end with refresh() so the three views of `notes` — the sidebar webview,
  // the editor decorations, and the JSON store — never disagree. Re-post state
  // AND repaint; updating one without the other is the bug class this prevents.
  const refresh = (): void => {
    postState();
    decorateAll();
  };

  const provider: vscode.WebviewViewProvider = {
    resolveWebviewView(webviewView) {
      view = webviewView;
      webviewView.webview.options = { enableScripts: true };
      webviewView.webview.html = getHtml();
      webviewView.webview.onDidReceiveMessage((raw: unknown) => onMessage(raw));
      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) postState();
      });
      postState();
    },
  };

  // Single inbound handler for every webview action. The raw value crosses a
  // trust boundary (untyped postMessage), so validate before dispatching.
  const onMessage = async (raw: unknown): Promise<void> => {
    if (!raw || typeof raw !== "object") return;
    const msg = raw as { type?: unknown; id?: unknown; text?: unknown };
    if (typeof msg.type !== "string") return;
    const id = typeof msg.id === "string" ? msg.id : undefined;
    const text = typeof msg.text === "string" ? msg.text : "";
    switch (msg.type as MsgType) {
      case MSG.READY:
        postState();
        break;
      case MSG.REVEAL:
        await openNote(byId(id));
        break;
      case MSG.RESOLVE:
        setStatus(id, STATUS_RESOLVED);
        break;
      case MSG.REOPEN:
        setStatus(id, STATUS_OPEN);
        break;
      case MSG.EDIT:
        await editNote(id);
        break;
      case MSG.DELETE:
        deleteNote(id);
        break;
      case MSG.RESOLVE_BY_IDS:
        resolveByIds(text);
        break;
    }
  };

  // ---- Actions -----------------------------------------------------------
  const setStatus = (id: string | undefined, status: Status): void => {
    const n = byId(id);
    if (!n) return;
    n.status = status;
    save();
    refresh();
  };

  // Bulk-resolve every note whose `ref` appears in the pasted text. Refs are
  // unique across the whole store, so matching is global (not per-project) —
  // you can resolve notes the agent finished regardless of which project is open.
  // Any token that isn't a known ref is reported back so typos are visible.
  const resolveByIds = (text: string): void => {
    const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (!tokens.length) return;
    const wanted = new Set(tokens);
    const byRef = new Map(notes.map((n) => [n.ref.toLowerCase(), n]));
    let resolved = 0;
    let alreadyClosed = 0;
    const unknown: string[] = [];
    for (const ref of wanted) {
      const n = byRef.get(ref);
      if (!n) {
        unknown.push(ref);
      } else if (isOpen(n)) {
        n.status = STATUS_RESOLVED;
        resolved++;
      } else {
        alreadyClosed++;
      }
    }
    if (resolved) {
      save();
      refresh();
    }
    const parts = [`resolved ${resolved}`];
    if (alreadyClosed) parts.push(`${alreadyClosed} already resolved`);
    if (unknown.length) parts.push(`unknown: ${unknown.join(", ")}`);
    vscode.window.showInformationMessage(`Code Feedback: ${parts.join(" · ")}.`);
  };

  const editNote = async (id: string | undefined): Promise<void> => {
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

  const deleteNote = (id: string | undefined): void => {
    if (!id) return;
    notes = notes.filter((n) => n.id !== id);
    save();
    refresh();
  };

  const openNote = async (n: Note | undefined): Promise<void> => {
    if (!n) return;
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

  // ---- Add note (from editor selection) ---------------------------------
  const addNote = async (): Promise<void> => {
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
      ref: makeRef(new Set(notes.map((n) => n.ref))),
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
  const formatList = (list: Note[], opts?: { markResolved?: boolean }): string => {
    const markResolved = opts?.markResolved ?? false;
    const lines = ["## Feedback notes", ""];
    list.forEach((n, i) => {
      const tagStr = n.tags.map((t) => "#" + t).join(" ");
      // `[ref]` leads each entry so an agent can echo back the IDs it completed,
      // and you paste them into "Resolve by IDs" to close them in bulk.
      lines.push(`${i + 1}. \`[${n.ref}]\` \`${n.file}:${rangeLabel(n)}\`${tagStr ? `  ${tagStr}` : ""}`);
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

  const copyAll = async (): Promise<void> => {
    const list = projectNotes().filter(isOpen);
    if (!list.length) {
      vscode.window.showInformationMessage("Code Feedback: no open notes to copy.");
      return;
    }
    await vscode.env.clipboard.writeText(formatList(list));
    vscode.window.showInformationMessage(`Code Feedback: copied ${list.length} open note(s).`);
  };

  const copyAllIncludingResolved = async (): Promise<void> => {
    const list = projectNotes();
    if (!list.length) {
      vscode.window.showInformationMessage("Code Feedback: nothing to copy.");
      return;
    }
    await vscode.env.clipboard.writeText(formatList(list, { markResolved: true }));
    vscode.window.showInformationMessage(`Code Feedback: copied ${list.length} note(s).`);
  };

  const previewAll = async (): Promise<void> => {
    if (!notes.length) {
      vscode.window.showInformationMessage("Code Feedback: no notes anywhere yet.");
      return;
    }
    const groups = new Map<string, Note[]>();
    notes.forEach((n) => {
      const g = groups.get(n.wsLabel) ?? [];
      g.push(n);
      groups.set(n.wsLabel, g);
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

  /** Confirm-then-delete the subset of `notes` matched by `pred`, with a modal. */
  const clearWithConfirm = async (
    pred: (n: Note) => boolean,
    message: string,
    confirmLabel: string
  ): Promise<void> => {
    const count = notes.filter(pred).length;
    if (!count) return;
    const pick = await vscode.window.showWarningMessage(
      message.replace("{count}", String(count)),
      { modal: true },
      confirmLabel
    );
    if (pick !== confirmLabel) return;
    notes = notes.filter((n) => !pred(n));
    save();
    refresh();
  };

  const clearResolved = (): Promise<void> => {
    const { key } = currentWs();
    return clearWithConfirm(
      (n) => n.ws === key && !isOpen(n),
      "Delete {count} resolved note(s) in this project?",
      "Delete"
    );
  };
  const clearAll = (): Promise<void> => {
    const { key } = currentWs();
    return clearWithConfirm((n) => n.ws === key, "Clear all {count} note(s) in this project?", "Clear");
  };
  const clearAllProjects = (): Promise<void> =>
    clearWithConfirm(
      () => true,
      "Clear all {count} note(s) across ALL projects? This cannot be undone.",
      "Clear Everything"
    );

  // Focus the sidebar and reveal the "resolve by ID" box (title-bar command +
  // palette entry — the same box also has an inline toggle in the panel).
  const openResolveByIds = async (): Promise<void> => {
    await vscode.commands.executeCommand(`${VIEW_ID}.focus`);
    view?.webview.postMessage({ type: MSG.OPEN_RESOLVE });
  };

  // ---- Register ----------------------------------------------------------
  vscode.window.onDidChangeActiveTextEditor(
    (e) => {
      decorate(e);
      postState(); // active file (and possibly project) changed
    },
    null,
    ctx.subscriptions
  );
  vscode.window.onDidChangeVisibleTextEditors(() => decorateAll(), null, ctx.subscriptions);

  ctx.subscriptions.push(
    decoOpen,
    decoResolved,
    vscode.window.registerWebviewViewProvider(VIEW_ID, provider),
    vscode.commands.registerCommand(CMD.ADD_NOTE, addNote),
    vscode.commands.registerCommand(CMD.COPY_ALL, copyAll),
    vscode.commands.registerCommand(CMD.COPY_ALL_RESOLVED, copyAllIncludingResolved),
    vscode.commands.registerCommand(CMD.PREVIEW_ALL, previewAll),
    vscode.commands.registerCommand(CMD.RESOLVE_BY_IDS, openResolveByIds),
    vscode.commands.registerCommand(CMD.TOGGLE_FILE_ONLY, () => setFileOnly(!fileOnly)),
    vscode.commands.registerCommand(CMD.TOGGLE_FILE_ONLY_ACTIVE, () => setFileOnly(!fileOnly)),
    vscode.commands.registerCommand(CMD.CLEAR_RESOLVED, clearResolved),
    vscode.commands.registerCommand(CMD.CLEAR_ALL, clearAll),
    vscode.commands.registerCommand(CMD.CLEAR_ALL_PROJECTS, clearAllProjects)
  );

  // Initialize the toolbar toggle icon to match persisted state.
  void vscode.commands.executeCommand("setContext", FILE_ONLY_KEY, fileOnly);

  // Paint gutter marks for whatever is already open when the extension loads,
  // and whenever a document opens — so noted lines are visible by default,
  // without having to click a note first.
  decorateAll();
  vscode.workspace.onDidOpenTextDocument(() => decorateAll(), null, ctx.subscriptions);
}

export function deactivate(): void {
  // No teardown needed — disposables are registered on ctx.subscriptions.
}

// ---- Webview HTML --------------------------------------------------------
/**
 * Build the self-contained sidebar document. The webview is sandboxed and
 * cannot import extension code, so the HTML/CSS/JS is inlined here and the only
 * shared state is `MSG` (injected as JSON) — that keeps the message protocol
 * single-sourced across the sandbox boundary.
 *
 * Security invariant: a strict CSP (no inline/eval except this one nonce'd
 * script) plus the `esc()` helper on every interpolated note/file string — note
 * text is arbitrary user input and must never reach the DOM unescaped.
 */
function getHtml(): string {
  const n = nonce();
  const csp = ["default-src 'none'", "style-src 'unsafe-inline'", `script-src 'nonce-${n}'`].join("; ");
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
  #chips { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 6px; }

  /* resolve-by-ID panel */
  #resolvePanel { margin-top: 6px; }
  #resolveInput { width: 100%; resize: vertical; min-height: 52px; padding: 4px 6px;
    font-family: var(--vscode-editor-font-family, monospace); font-size: 12px;
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent); border-radius: 2px; outline: none; }
  #resolveInput:focus { border-color: var(--vscode-focusBorder); }
  .resolveBtns { display: flex; gap: 6px; margin-top: 5px; }
  .resolveBtns button { all: unset; cursor: pointer; font-size: 11px; padding: 2px 10px; border-radius: 3px; }
  #resolveApply { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  #resolveApply:hover { background: var(--vscode-button-hoverBackground); }
  #resolveCancel { color: var(--vscode-descriptionForeground); }
  #resolveCancel:hover { color: var(--vscode-foreground); }
  .ref { font-family: var(--vscode-editor-font-family, monospace); font-size: .82em; opacity: .55; margin-right: 6px; }
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
    <div id="chips"></div>
    <div id="resolvePanel" hidden>
      <textarea id="resolveInput" placeholder="Paste note IDs — one per line (or any separator). e.g. a3f9"></textarea>
      <div class="resolveBtns">
        <button id="resolveApply">Resolve</button>
        <button id="resolveCancel">Cancel</button>
      </div>
    </div>
  </div>
  <div class="count" id="count"></div>
  <div id="list"></div>

<script nonce="${n}">
  const vscode = acquireVsCodeApi();
  // Protocol constants injected from the extension (same object as MSG there),
  // so button data-act values and posted message types stay in lockstep with
  // onMessage() — no hand-duplicated "reveal"/"resolve"/… literals here.
  const MSG = ${JSON.stringify(MSG)};
  let data = { notes: [], tags: [], wsLabel: "", activeFile: null, fileOnly: false };
  let filterText = "";
  const activeTags = new Set();
  // collapse + scope state persisted across reloads
  const persisted = vscode.getState() || {};
  const collapsed = { open: !!persisted.open, resolved: persisted.resolved !== false };
  const saveState = () => vscode.setState({ ...collapsed });

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;" }[c]));

  function matches(note) {
    if (data.fileOnly && data.activeFile && note.file !== data.activeFile) return false;
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
      (note.open ? '<button data-act="' + MSG.RESOLVE + '" title="Mark resolved">✓</button>'
                 : '<button data-act="' + MSG.REOPEN + '" title="Reopen">↺</button>') +
      '<button data-act="' + MSG.EDIT + '" title="Edit">✎</button>' +
      '<button data-act="' + MSG.DELETE + '" title="Delete">✕</button></span>';
    return '<div class="row ' + (note.open ? "" : "resolved") + '" data-id="' + esc(note.id) + '" title="[' + esc(note.ref) + '] ' + esc(note.note) + '\\n' + esc(note.file) + ':' + esc(note.range) + '">' +
      '<span class="dot"></span>' +
      '<span class="ref">' + esc(note.ref) + '</span>' +
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
    const filtered = data.notes.filter(matches);
    const open = filtered.filter((n) => n.open);
    const resolved = filtered.filter((n) => !n.open);
    const scope = data.fileOnly && data.activeFile ? " · " + data.activeFile.split("/").pop() : "";
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
    vscode.postMessage({ type: MSG.REVEAL, id });
  });

  $("filter").addEventListener("input", (e) => { filterText = e.target.value; render(); });

  // Resolve-by-ID panel — opened from the title-bar ✓✓ command (MSG.OPEN_RESOLVE).
  function showResolve(show) {
    $("resolvePanel").hidden = !show;
    if (show) $("resolveInput").focus();
  }
  $("resolveCancel").addEventListener("click", () => { $("resolveInput").value = ""; showResolve(false); });
  $("resolveApply").addEventListener("click", () => {
    const text = $("resolveInput").value;
    if (text.trim()) vscode.postMessage({ type: MSG.RESOLVE_BY_IDS, text });
    $("resolveInput").value = "";
    showResolve(false);
  });

  window.addEventListener("message", (e) => {
    const msg = e.data;
    if (msg.type === MSG.STATE) {
      data = { notes: msg.notes, tags: msg.tags, wsLabel: msg.wsLabel, activeFile: msg.activeFile, fileOnly: msg.fileOnly };
      for (const t of [...activeTags]) if (!data.tags.includes(t)) activeTags.delete(t);
      renderChips();
      render();
    } else if (msg.type === MSG.OPEN_RESOLVE) {
      showResolve(true);
    }
  });

  vscode.postMessage({ type: MSG.READY });
</script>
</body>
</html>`;
}
