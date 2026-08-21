(() => {
  const OWNER = "vhd0";
  const REPO = "vhd0.github.io";
  const BRANCH = "main";

  // File/thư mục dùng để dựng trang — không hiển thị trong danh sách
  const EXCLUDE_NAMES = new Set([
    "index.html", "style.css", "app.js", "readme.md",
    ".nojekyll", ".gitignore", "license", "license.md",
    "cname", "favicon.ico", "404.html", ".git"
  ]);

  const IMG_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"];
  const MD_EXT = ["md", "markdown"];

  // Chỉ những đuôi file này mới được thử đọc như văn bản.
  // Mọi đuôi khác (apk, zip, exe, mp3, mp4, pdf, ...) coi là nhị phân — không giải mã.
  const TEXT_EXT = [
    "txt", "md", "markdown", "json", "jsonc", "js", "mjs", "cjs", "ts", "tsx", "jsx",
    "html", "htm", "css", "scss", "sass", "less", "xml", "svg", "yml", "yaml", "toml",
    "ini", "cfg", "conf", "env", "csv", "tsv", "log", "sql",
    "py", "java", "kt", "c", "h", "cpp", "hpp", "cs", "go", "rb", "php", "rs",
    "sh", "bash", "zsh", "bat", "ps1", "gitignore", "dockerfile", "makefile",
    "swift", "lua", "pl", "vue", "graphql", "gql", "proto", "r"
  ];

  function classify(name) {
    const ext = extOf(name);
    if (IMG_EXT.includes(ext)) return "image";
    if (TEXT_EXT.includes(ext)) return "text";
    return "binary";
  }

  function extLabel(ext) {
    return ext ? ext.toUpperCase() : "FILE";
  }

  function typeLabel(item) {
    if (item.type === "dir") return "Thư mục";
    const ext = extOf(item.name);
    return ext ? ext.toUpperCase() : "FILE";
  }

  const mainEl = document.getElementById("main");
  const pathEl = document.getElementById("path");
  const searchEl = document.getElementById("search");
  const countEl = document.getElementById("count");

  let root = null;
  let currentPath = "";   // thư mục đang xem
  let searchQuery = "";
  let sortKey = "name";   // name | size | type
  let sortDir = 1;        // 1 = tăng dần, -1 = giảm dần
  const commitDateCache = new Map(); // path -> chuỗi ngày đã format (hoặc null nếu lỗi)

  function extOf(name) {
    const i = name.lastIndexOf(".");
    return i === -1 ? "" : name.slice(i + 1).toLowerCase();
  }

  function humanSize(bytes) {
    if (bytes == null) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function iconFor(item) {
    if (item.type === "dir") return "📁";
    const ext = extOf(item.name);
    const kind = classify(item.name);
    if (kind === "image") return "🖼";
    if (MD_EXT.includes(ext)) return "📝";
    if (kind === "text") {
      if (["html", "htm"].includes(ext)) return "🌐";
      if (["json", "yml", "yaml"].includes(ext)) return "🔧";
      return "📄";
    }
    if (["zip", "rar", "7z"].includes(ext)) return "🗜";
    if (ext === "apk") return "📱";
    if (["mp3", "wav", "flac", "m4a"].includes(ext)) return "🎵";
    if (["mp4", "mov", "mkv", "avi"].includes(ext)) return "🎬";
    if (ext === "pdf") return "📕";
    return "📦";
  }

  // ---------- build filtered nested tree ----------
  function buildTree(items) {
    const rootNode = { name: "", path: "", type: "dir", children: {} };
    for (const it of items) {
      if (it.type !== "blob" && it.type !== "tree") continue;
      const parts = it.path.split("/");
      const leafName = parts[parts.length - 1];
      if (EXCLUDE_NAMES.has(leafName.toLowerCase())) continue;

      let cur = rootNode;
      let acc = "";
      parts.forEach((part, idx) => {
        acc = acc ? acc + "/" + part : part;
        const isLeaf = idx === parts.length - 1;
        if (!cur.children[part]) {
          cur.children[part] = {
            name: part,
            path: acc,
            type: isLeaf ? (it.type === "tree" ? "dir" : "file") : "dir",
            size: isLeaf ? it.size : undefined,
            children: {}
          };
        }
        cur = cur.children[part];
      });
    }
    pruneEmptyDirs(rootNode);
    return rootNode;
  }

  function pruneEmptyDirs(node) {
    for (const key of Object.keys(node.children)) {
      const child = node.children[key];
      if (child.type === "dir") {
        pruneEmptyDirs(child);
        if (Object.keys(child.children).length === 0) delete node.children[key];
      }
    }
  }

  function findNode(path) {
    if (!path) return root;
    const parts = path.split("/");
    let cur = root;
    for (const p of parts) {
      if (!cur || !cur.children[p]) return null;
      cur = cur.children[p];
    }
    return cur;
  }

  function parentOf(path) {
    if (!path) return "";
    const parts = path.split("/");
    parts.pop();
    return parts.join("/");
  }

  function sortEntries(children) {
    return Object.values(children).sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1; // thư mục luôn ở trên
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name, "vi");
      } else if (sortKey === "size") {
        cmp = (a.size || 0) - (b.size || 0);
      } else if (sortKey === "type") {
        cmp = typeLabel(a).localeCompare(typeLabel(b), "vi") || a.name.localeCompare(b.name, "vi");
      }
      return cmp * sortDir;
    });
  }

  function countAll(node) {
    let files = 0, dirs = 0;
    const walk = n => {
      Object.values(n.children).forEach(c => {
        if (c.type === "dir") { dirs++; walk(c); }
        else files++;
      });
    };
    walk(node);
    return { files, dirs };
  }

  // ---------- row + header builder ----------
  function makeRow({ icon, cls, name, type, size, onClick }) {
    const row = document.createElement("button");
    row.className = "row " + cls;
    row.innerHTML = `
      <span class="row-icon">${icon}</span>
      <span class="row-name"></span>
      <span class="row-type"></span>
      <span class="row-size"></span>
    `;
    row.querySelector(".row-name").textContent = name;
    row.querySelector(".row-type").textContent = type || "";
    row.querySelector(".row-size").textContent = size || "";
    row.addEventListener("click", onClick);
    return row;
  }

  function sortArrow(key) {
    if (sortKey !== key) return "";
    return sortDir === 1 ? " ▲" : " ▼";
  }

  function makeListHeader(onSort) {
    const header = document.createElement("div");
    header.className = "list-header";
    header.innerHTML = `
      <span class="col-icon"></span>
      <button class="col-btn col-name" data-key="name">Tên${sortArrow("name")}</button>
      <button class="col-btn col-type" data-key="type">Loại${sortArrow("type")}</button>
      <button class="col-btn col-size" data-key="size">Kích thước${sortArrow("size")}</button>
    `;
    header.querySelectorAll(".col-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.key;
        if (sortKey === key) sortDir *= -1;
        else { sortKey = key; sortDir = 1; }
        onSort();
      });
    });
    return header;
  }

  // ---------- views ----------
  function renderPath() {
    pathEl.textContent = "/" + currentPath;
  }

  function showFolder(path) {
    currentPath = path;
    searchQuery = "";
    searchEl.value = "";
    renderPath();

    const node = findNode(path);
    mainEl.innerHTML = "";

    mainEl.appendChild(makeListHeader(() => showFolder(currentPath)));

    const list = document.createElement("div");
    list.className = "list";

    if (path) {
      list.appendChild(makeRow({
        icon: "⬅",
        cls: "up",
        name: "..",
        onClick: () => showFolder(parentOf(path))
      }));
    }

    const entries = node ? sortEntries(node.children) : [];
    if (entries.length === 0 && !path) {
      list.appendChild(rowless("Kho lưu trữ đang trống."));
    } else if (entries.length === 0) {
      list.appendChild(rowless("Thư mục này trống."));
    }

    entries.forEach(item => {
      if (item.type === "dir") {
        const c = countAll(item);
        list.appendChild(makeRow({
          icon: "📁",
          cls: "dir",
          name: item.name + "/",
          type: "Thư mục",
          size: c.files + " tệp",
          onClick: () => showFolder(item.path)
        }));
      } else {
        list.appendChild(makeRow({
          icon: iconFor(item),
          cls: "file",
          name: item.name,
          type: typeLabel(item),
          size: humanSize(item.size),
          onClick: () => showFile(item)
        }));
      }
    });

    mainEl.appendChild(list);
    countEl.textContent = countLabel();
  }

  function rowless(text) {
    const p = document.createElement("p");
    p.className = "empty-note";
    p.textContent = text;
    return p;
  }

  function countLabel() {
    if (!root) return "";
    const t = countAll(root);
    return `${t.files} tệp · ${t.dirs} thư mục`;
  }

  function showSearch(query) {
    searchQuery = query;
    pathEl.textContent = `tìm kiếm: "${query}"`;
    const q = query.toLowerCase();
    const matches = [];
    const walk = n => {
      Object.values(n.children).forEach(c => {
        if (c.name.toLowerCase().includes(q)) matches.push(c);
        if (c.type === "dir") walk(c);
      });
    };
    walk(root);

    mainEl.innerHTML = "";
    mainEl.appendChild(makeListHeader(() => showSearch(searchQuery)));

    const list = document.createElement("div");
    list.className = "list";
    list.appendChild(makeRow({
      icon: "⬅",
      cls: "up",
      name: "..",
      onClick: () => showFolder(currentPath)
    }));

    matches.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      let cmp = 0;
      if (sortKey === "name") cmp = a.path.localeCompare(b.path, "vi");
      else if (sortKey === "size") cmp = (a.size || 0) - (b.size || 0);
      else if (sortKey === "type") cmp = typeLabel(a).localeCompare(typeLabel(b), "vi");
      return cmp * sortDir;
    });

    if (matches.length === 0) {
      list.appendChild(rowless(`Không tìm thấy mục nào khớp với "${query}".`));
    } else {
      matches.forEach(item => {
        list.appendChild(makeRow({
          icon: item.type === "dir" ? "📁" : iconFor(item),
          cls: item.type === "dir" ? "dir" : "file",
          name: item.path,
          type: typeLabel(item),
          size: item.type === "dir" ? "" : humanSize(item.size),
          onClick: () => item.type === "dir" ? showFolder(item.path) : showFile(item)
        }));
      });
    }
    mainEl.appendChild(list);
    countEl.textContent = `${matches.length} kết quả`;
  }

  // ---------- file content ----------
  function encodePath(path) {
    return path.split("/").map(encodeURIComponent).join("/");
  }

  function b64ToUtf8(b64) {
    const binary = atob(b64.replace(/\n/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  function mimeFor(ext) {
    const map = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", ico: "image/x-icon" };
    return map[ext] || "application/octet-stream";
  }

  function renderMarkdown(md) {
    let html = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre>${code.trim()}</pre>`);
    html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/^- (.*)$/gm, "<li>$1</li>");
    html = html.split("\n\n").map(block => {
      if (/^<h\d|^<pre|^<li/.test(block.trim())) return block;
      return block.trim() ? `<p>${block.trim()}</p>` : "";
    }).join("\n");
    return html;
  }

  function copyToClipboard(btn, text) {
    const original = btn.textContent;
    const done = ok => {
      btn.textContent = ok ? "✓ đã sao chép" : "✕ lỗi sao chép";
      btn.disabled = true;
      setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => done(true)).catch(() => done(false));
    } else {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        done(true);
      } catch (e) { done(false); }
    }
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("vi-VN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return iso; }
  }

  async function loadLastModified(path, targetEl) {
    if (commitDateCache.has(path)) {
      targetEl.textContent = commitDateCache.get(path) || "không rõ";
      return;
    }
    try {
      const url = `https://api.github.com/repos/${OWNER}/${REPO}/commits?path=${encodePath(path)}&sha=${BRANCH}&per_page=1`;
      const res = await fetch(url, { headers: { Accept: "application/vnd.github.v3+json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (Array.isArray(data) && data[0] && data[0].commit && data[0].commit.committer) {
        const label = formatDate(data[0].commit.committer.date);
        commitDateCache.set(path, label);
        targetEl.textContent = label;
      } else {
        commitDateCache.set(path, null);
        targetEl.textContent = "không rõ";
      }
    } catch (e) {
      commitDateCache.set(path, null);
      targetEl.textContent = "không tải được";
    }
  }

  function fileViewShell(item, urls) {
    mainEl.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "file-view";

    const head = document.createElement("div");
    head.className = "file-head";
    head.innerHTML = `
      <a id="back-link" href="javascript:void(0)">⬅ quay lại</a>
      <span class="file-head-name"></span>
    `;
    head.querySelector(".file-head-name").textContent = item.name;
    head.querySelector("#back-link").addEventListener("click", () => {
      if (searchQuery) showSearch(searchQuery); else showFolder(currentPath);
    });

    const info = document.createElement("div");
    info.className = "file-info";
    const dateSpan = document.createElement("span");
    dateSpan.className = "file-info-date";
    dateSpan.textContent = "đang tải…";
    info.innerHTML = `<span>Kích thước: <strong>${humanSize(item.size)}</strong></span><span class="dot">·</span><span>Loại: <strong>${typeLabel(item)}</strong></span><span class="dot">·</span><span>Cập nhật lần cuối: </span>`;
    info.appendChild(dateSpan);
    loadLastModified(item.path, dateSpan);

    const actions = document.createElement("div");
    actions.className = "file-actions";

    const linkBtn = document.createElement("a");
    linkBtn.className = "action-btn";
    linkBtn.textContent = "🔗 DIRECT";
    linkBtn.href = urls.pages;
    linkBtn.target = "_blank";
    linkBtn.rel = "noopener";
    linkBtn.title = urls.pages;

    const copyBtn = document.createElement("button");
    copyBtn.className = "action-btn";
    copyBtn.textContent = "📋 COPY";
    copyBtn.disabled = true; // bật lại khi có nội dung text để copy

    const rawBtn = document.createElement("a");
    rawBtn.className = "action-btn";
    rawBtn.textContent = "⬇ RAW";
    rawBtn.href = urls.raw;
    rawBtn.target = "_blank";
    rawBtn.rel = "noopener";
    rawBtn.title = urls.raw;

    const cdnBtn = document.createElement("a");
    cdnBtn.className = "action-btn";
    cdnBtn.textContent = "☁ CDN";
    cdnBtn.href = urls.cdn;
    cdnBtn.target = "_blank";
    cdnBtn.rel = "noopener";
    cdnBtn.title = urls.cdn;

    actions.append(linkBtn, copyBtn, rawBtn, cdnBtn);

    const body = document.createElement("div");
    body.className = "file-body";
    body.innerHTML = `<p class="status-note">đang tải nội dung…</p>`;

    wrap.appendChild(head);
    wrap.appendChild(info);
    wrap.appendChild(actions);
    wrap.appendChild(body);
    mainEl.appendChild(wrap);
    pathEl.textContent = "/" + item.path;
    return { body, copyBtn };
  }

  function showError(body, item, message) {
    body.innerHTML = `
      <div class="err-note">
        Không thể tải nội dung file này.<br>${message}
        <div><button id="retry-btn">↻ thử lại</button></div>
      </div>
    `;
    document.getElementById("retry-btn").addEventListener("click", () => showFile(item));
  }

  function showBinaryInfo(body, item, ext) {
    body.innerHTML = "";
    const card = document.createElement("div");
    card.className = "binary-card";
    card.innerHTML = `
      <div class="binary-badge">${extLabel(ext)}</div>
      <p class="binary-title">Đây là file nhị phân, không thể xem trước dạng văn bản.</p>
      <p class="binary-sub">Dung lượng: ${humanSize(item.size)} — dùng các nút RAW hoặc CDN phía trên để tải/mở file.</p>
    `;
    body.appendChild(card);
  }

  async function showFile(item) {
    const ext = extOf(item.name);
    const kind = classify(item.name);
    const encPath = encodePath(item.path);
    const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${encPath}`;
    const contentsUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encPath}?ref=${BRANCH}`;
    const pagesUrl = `https://${OWNER}.github.io/${encPath}`;
    const cdnUrl = `https://cdn.jsdelivr.net/gh/${OWNER}/${REPO}@${BRANCH}/${encPath}`;
    const { body, copyBtn } = fileViewShell(item, { pages: pagesUrl, raw: rawUrl, cdn: cdnUrl });

    // File nhị phân: không tải/giải mã nội dung, chỉ hiển thị thông tin + link tải
    if (kind === "binary") {
      showBinaryInfo(body, item, ext);
      return;
    }

    // 1) GitHub Contents API (ổn định, trả base64)
    try {
      const res = await fetch(contentsUrl, { headers: { Accept: "application/vnd.github.v3+json" } });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.content === "string" && data.encoding === "base64") {
          if (kind === "image") {
            body.innerHTML = "";
            const img = document.createElement("img");
            img.className = "img-preview";
            img.src = `data:${mimeFor(ext)};base64,${data.content.replace(/\n/g, "")}`;
            body.appendChild(img);
            return;
          }
          const text = data.content.replace(/\n/g, "").length === 0 ? "" : b64ToUtf8(data.content);
          renderInto(body, item, ext, text, copyBtn);
          return;
        }
      } else if (res.status === 404) {
        showError(body, item, "GitHub báo không tìm thấy file (404). Kiểm tra file đã được đẩy lên nhánh " + BRANCH + " chưa.");
        return;
      }
    } catch (e) { /* thử fallback */ }

    // 2) fallback: raw.githubusercontent
    try {
      if (kind === "image") {
        body.innerHTML = "";
        const img = document.createElement("img");
        img.className = "img-preview";
        img.onerror = () => showError(body, item, "Không kết nối được tới raw.githubusercontent.com.");
        img.src = rawUrl;
        body.appendChild(img);
        return;
      }
      const res = await fetch(rawUrl);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      renderInto(body, item, ext, text, copyBtn);
    } catch (err) {
      showError(body, item, "Chi tiết: " + err.message + ". Có thể do giới hạn tốc độ GitHub API — thử lại sau ít phút.");
    }
  }

  function renderInto(body, item, ext, text, copyBtn) {
    if (text.trim() === "") {
      body.innerHTML = `<p class="status-note">(file này hiện đang trống — chưa có nội dung)</p>`;
      return;
    }
    if (copyBtn) {
      copyBtn.disabled = false;
      copyBtn.addEventListener("click", () => copyToClipboard(copyBtn, text));
    }
    if (ext === "svg") {
      body.innerHTML = `<div>${text}</div>`;
    } else if (MD_EXT.includes(ext)) {
      body.innerHTML = `<div class="md">${renderMarkdown(text)}</div>`;
    } else {
      const pre = document.createElement("pre");
      pre.className = "file-pre";
      pre.textContent = text.length > 200000
        ? text.slice(0, 200000) + "\n\n… (đã cắt bớt, mở bản gốc để xem đầy đủ)"
        : text;
      body.innerHTML = "";
      body.appendChild(pre);
    }
  }

  // ---------- search ----------
  let searchTimer;
  searchEl.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = searchEl.value.trim();
      if (q) showSearch(q); else showFolder(currentPath);
    }, 150);
  });

  // ---------- init ----------
  async function init() {
    mainEl.innerHTML = `<p class="status-note">đang mở kho lưu trữ…</p>`;
    try {
      const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      root = buildTree(data.tree || []);
      showFolder("");
    } catch (err) {
      mainEl.innerHTML = `
        <div class="err-note">
          Không tải được kho lưu trữ: ${err.message}.<br>
          GitHub API công khai giới hạn 60 lượt/giờ mỗi IP — nếu vừa tải lại nhiều lần, đợi vài phút rồi thử lại.
          <div><button id="retry-init">↻ thử lại</button></div>
        </div>
      `;
      document.getElementById("retry-init").addEventListener("click", init);
    }
  }

  init();
})();
