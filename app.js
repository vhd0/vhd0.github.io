(() => {
  const OWNER = "vhd0";
  const REPO = "vhd0.github.io";
  const BRANCH = "main";

  // Các file/thư mục dùng để dựng trang — không hiển thị trong kho lưu trữ
  const EXCLUDE_NAMES = new Set([
    "index.html", "style.css", "app.js", "readme.md",
    ".nojekyll", ".gitignore", "license", "license.md",
    "cname", "favicon.ico", "404.html", ".git"
  ]);

  const IMG_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"];
  const MD_EXT = ["md", "markdown"];

  const mainEl = document.getElementById("main");
  const breadcrumbEl = document.getElementById("breadcrumb");
  const searchEl = document.getElementById("search");
  const itemTotalEl = document.getElementById("item-total");

  const viewer = document.getElementById("viewer");
  const viewerBack = document.getElementById("viewer-back");
  const viewerPath = document.getElementById("viewer-path");
  const viewerRaw = document.getElementById("viewer-raw");
  const viewerBody = document.getElementById("viewer-body");

  let root = null;
  let currentPath = "";
  let catalogCounter = 0;
  const catalogIds = new Map();

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

  function glyphFor(item) {
    if (item.type === "dir") return "▤";
    const ext = extOf(item.name);
    if (IMG_EXT.includes(ext)) return "◫";
    if (MD_EXT.includes(ext)) return "≡";
    if (["html", "htm"].includes(ext)) return "◆";
    if (["css"].includes(ext)) return "◇";
    if (["js", "mjs", "ts"].includes(ext)) return "ƒ";
    if (["json", "yml", "yaml"].includes(ext)) return "{ }";
    if (["pdf"].includes(ext)) return "▦";
    return "·";
  }

  function catalogId(path) {
    if (!catalogIds.has(path)) {
      catalogCounter += 1;
      catalogIds.set(path, String(catalogCounter).padStart(3, "0"));
    }
    return catalogIds.get(path);
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

  function sortEntries(children) {
    return Object.values(children).sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name, "vi");
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

  // ---------- rendering ----------
  function renderBreadcrumb(path) {
    breadcrumbEl.innerHTML = "";
    const rootBtn = document.createElement("button");
    rootBtn.className = "crumb crumb-root" + (path === "" ? " current" : "");
    rootBtn.textContent = "Gốc";
    rootBtn.dataset.path = "";
    rootBtn.addEventListener("click", () => navigate(""));
    breadcrumbEl.appendChild(rootBtn);

    if (!path) return;
    const parts = path.split("/");
    let acc = "";
    parts.forEach((part, idx) => {
      acc = acc ? acc + "/" + part : part;
      const sep = document.createElement("span");
      sep.className = "crumb-sep";
      sep.textContent = "/";
      breadcrumbEl.appendChild(sep);

      const btn = document.createElement("button");
      btn.className = "crumb" + (idx === parts.length - 1 ? " current" : "");
      btn.textContent = part;
      const p = acc;
      btn.addEventListener("click", () => navigate(p));
      breadcrumbEl.appendChild(btn);
    });
  }

  function renderGrid(node) {
    mainEl.innerHTML = "";
    const entries = sortEntries(node.children);

    if (entries.length === 0) {
      mainEl.innerHTML = `<p class="empty-note">Thư mục này trống.</p>`;
      return;
    }

    const grid = document.createElement("div");
    grid.className = "grid";

    entries.forEach(item => {
      const card = document.createElement("button");
      card.className = "card " + (item.type === "dir" ? "card-folder" : "card-file");

      const top = document.createElement("div");
      top.className = "card-top";
      const glyph = document.createElement("span");
      glyph.className = "card-glyph";
      glyph.textContent = glyphFor(item);
      const id = document.createElement("span");
      id.className = "card-id";
      id.textContent = "№ " + catalogId(item.path);
      top.appendChild(glyph);
      top.appendChild(id);

      const name = document.createElement("div");
      name.className = "card-name";
      name.textContent = item.name;

      const meta = document.createElement("div");
      meta.className = "card-meta";
      if (item.type === "dir") {
        const c = countAll(item);
        meta.innerHTML = `<span>thư mục</span><span>${c.files} tệp</span>`;
      } else {
        meta.innerHTML = `<span>${extOf(item.name) || "tệp"}</span><span>${humanSize(item.size)}</span>`;
      }

      card.appendChild(top);
      card.appendChild(name);
      card.appendChild(meta);

      card.addEventListener("click", () => {
        if (item.type === "dir") navigate(item.path);
        else openFile(item);
      });

      grid.appendChild(card);
    });

    mainEl.appendChild(grid);
  }

  function renderSearchResults(query) {
    mainEl.innerHTML = "";
    const q = query.toLowerCase();
    const matches = [];
    const walk = n => {
      Object.values(n.children).forEach(c => {
        if (c.name.toLowerCase().includes(q) || c.path.toLowerCase().includes(q)) matches.push(c);
        if (c.type === "dir") walk(c);
      });
    };
    walk(root);

    const label = document.createElement("p");
    label.className = "section-label";
    label.textContent = `Kết quả tìm kiếm — "${query}" (${matches.length})`;
    mainEl.appendChild(label);

    if (matches.length === 0) {
      mainEl.innerHTML += `<p class="empty-note">Không tìm thấy mục nào khớp.</p>`;
      return;
    }

    const grid = document.createElement("div");
    grid.className = "grid";
    matches.forEach(item => {
      const card = document.createElement("button");
      card.className = "card " + (item.type === "dir" ? "card-folder" : "card-file");
      card.innerHTML = `
        <div class="card-top">
          <span class="card-glyph">${glyphFor(item)}</span>
          <span class="card-id">№ ${catalogId(item.path)}</span>
        </div>
        <div class="card-name">${item.name}</div>
        <div class="card-meta"><span>${item.path}</span></div>
      `;
      card.addEventListener("click", () => {
        if (item.type === "dir") { searchEl.value = ""; navigate(item.path); }
        else openFile(item);
      });
      grid.appendChild(card);
    });
    mainEl.appendChild(grid);
  }

  function navigate(path) {
    currentPath = path;
    const node = findNode(path);
    renderBreadcrumb(path);
    if (node) renderGrid(node);
  }

  // ---------- file viewer ----------
  async function openFile(item) {
    const ext = extOf(item.name);
    const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${item.path}`;
    viewerPath.textContent = "/" + item.path;
    viewerRaw.href = rawUrl;
    viewerBody.innerHTML = `<p class="empty-note">đang tải…</p>`;
    viewer.hidden = false;
    document.body.style.overflow = "hidden";

    try {
      if (IMG_EXT.includes(ext) && ext !== "svg") {
        viewerBody.innerHTML = "";
        const img = document.createElement("img");
        img.className = "img-preview";
        img.src = rawUrl;
        viewerBody.appendChild(img);
        return;
      }
      const res = await fetch(rawUrl);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();

      if (ext === "svg") {
        viewerBody.innerHTML = `<div>${text}</div>`;
      } else if (MD_EXT.includes(ext)) {
        viewerBody.innerHTML = `<div class="md">${renderMarkdown(text)}</div>`;
      } else {
        const pre = document.createElement("pre");
        pre.className = "file-pre";
        pre.textContent = text.length > 200000
          ? text.slice(0, 200000) + "\n\n… (đã cắt bớt, mở bản gốc để xem đầy đủ)"
          : text;
        viewerBody.innerHTML = "";
        viewerBody.appendChild(pre);
      }
    } catch (err) {
      viewerBody.innerHTML = `<p class="err">Không thể tải file: ${err.message}</p>`;
    }
  }

  function closeViewer() {
    viewer.hidden = true;
    document.body.style.overflow = "";
  }
  viewerBack.addEventListener("click", closeViewer);
  viewer.addEventListener("click", e => { if (e.target === viewer) closeViewer(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !viewer.hidden) closeViewer(); });

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

  // ---------- search ----------
  let searchTimer;
  searchEl.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = searchEl.value.trim();
      if (q) renderSearchResults(q);
      else navigate(currentPath);
    }, 120);
  });

  // ---------- init ----------
  async function init() {
    try {
      const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      root = buildTree(data.tree || []);
      const totals = countAll(root);
      itemTotalEl.textContent = `${totals.files} tệp trong ${totals.dirs} thư mục`;
      navigate("");
    } catch (err) {
      mainEl.innerHTML = `<p class="err">Không tải được kho lưu trữ: ${err.message}. GitHub API có thể đang giới hạn tốc độ — thử tải lại trang sau ít phút.</p>`;
    }
  }

  init();
})();
