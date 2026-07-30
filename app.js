(() => {
  const OWNER = "vhd0";
  const REPO = "vhd0.github.io";
  const BRANCH = "main";

  const treeEl = document.getElementById("tree");
  const viewBody = document.getElementById("view-body");
  const viewPath = document.getElementById("view-path");
  const rawBtn = document.getElementById("raw-btn");
  const statusText = document.getElementById("status-text");
  const fileCount = document.getElementById("file-count");
  const filterInput = document.getElementById("filter");

  const IMG_EXT = ["png","jpg","jpeg","gif","webp","svg","ico"];
  const MD_EXT = ["md","markdown"];

  let flatFiles = [];
  let rootNode = null;

  function setStatus(t){ statusText.textContent = t; }

  function extOf(name){
    const i = name.lastIndexOf(".");
    return i === -1 ? "" : name.slice(i + 1).toLowerCase();
  }

  function humanSize(bytes){
    if (bytes == null) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function glyphFor(item){
    if (item.type === "dir") return "▸";
    const ext = extOf(item.name);
    if (IMG_EXT.includes(ext)) return "◫";
    if (MD_EXT.includes(ext)) return "≡";
    if (["html","htm"].includes(ext)) return "◆";
    if (["css"].includes(ext)) return "◇";
    if (["js","mjs"].includes(ext)) return "ƒ";
    if (["json","yml","yaml"].includes(ext)) return "{}";
    return "·";
  }

  // ---------- build nested tree from flat GitHub tree ----------
  function buildTree(items){
    const root = { name: "", path: "", type: "dir", children: {} };
    for (const it of items){
      if (it.type !== "blob" && it.type !== "tree") continue;
      const parts = it.path.split("/");
      let cur = root;
      let acc = "";
      parts.forEach((part, idx) => {
        acc = acc ? acc + "/" + part : part;
        const isLeaf = idx === parts.length - 1;
        if (!cur.children[part]){
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
    return root;
  }

  function sortEntries(children){
    return Object.values(children).sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  function renderTree(node, container, depth){
    const entries = sortEntries(node.children);
    entries.forEach(item => {
      const row = document.createElement("div");
      row.className = "tnode";

      const rowInner = document.createElement("div");
      rowInner.className = "tnode-row" + (item.type === "dir" ? " dir" : "");
      rowInner.dataset.path = item.path;

      const glyph = document.createElement("span");
      glyph.className = "glyph";
      glyph.textContent = glyphFor(item);
      rowInner.appendChild(glyph);

      const name = document.createElement("span");
      name.className = "name";
      name.textContent = item.name;
      rowInner.appendChild(name);

      if (item.type === "file" && item.size != null){
        const size = document.createElement("span");
        size.className = "size";
        size.textContent = humanSize(item.size);
        rowInner.appendChild(size);
      }

      row.appendChild(rowInner);

      if (item.type === "dir"){
        const childWrap = document.createElement("div");
        childWrap.className = "tchildren" + (depth > 0 ? " collapsed" : "");
        renderTree(item, childWrap, depth + 1);
        row.appendChild(childWrap);

        rowInner.addEventListener("click", () => {
          childWrap.classList.toggle("collapsed");
          glyph.textContent = childWrap.classList.contains("collapsed") ? "▸" : "▾";
        });
      } else {
        rowInner.addEventListener("click", () => openFile(item, rowInner));
      }

      container.appendChild(row);
    });
  }

  function clearActive(){
    document.querySelectorAll(".tnode-row.active").forEach(el => el.classList.remove("active"));
  }

  async function openFile(item, rowEl){
    clearActive();
    rowEl.classList.add("active");
    viewPath.textContent = "/" + item.path;
    setStatus("đang tải " + item.name);
    viewBody.innerHTML = `<div class="loading"><span class="cursor-blink">_</span> đang tải nội dung</div>`;

    const ext = extOf(item.name);
    const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${item.path}`;

    rawBtn.hidden = false;
    rawBtn.onclick = () => window.open(rawUrl, "_blank");

    try {
      if (IMG_EXT.includes(ext) && ext !== "svg"){
        viewBody.innerHTML = "";
        const img = document.createElement("img");
        img.className = "img-preview";
        img.src = rawUrl;
        viewBody.appendChild(img);
        setStatus("sẵn sàng");
        return;
      }

      const res = await fetch(rawUrl);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();

      if (ext === "svg"){
        viewBody.innerHTML = `<div>${text}</div>`;
      } else if (MD_EXT.includes(ext)){
        viewBody.innerHTML = `<div class="md">${renderMarkdown(text)}</div>`;
      } else {
        viewBody.innerHTML = "";
        const pre = document.createElement("pre");
        pre.className = "file-pre";
        pre.textContent = text.length > 200000 ? text.slice(0, 200000) + "\n\n… (đã cắt bớt, xem raw để xem đầy đủ)" : text;
        viewBody.appendChild(pre);
      }
      setStatus("sẵn sàng");
    } catch (err) {
      viewBody.innerHTML = `<p class="err">Không thể tải file: ${err.message}</p>`;
      setStatus("lỗi");
    }
  }

  // very small markdown renderer (headings, bold, italic, code, links, lists)
  function renderMarkdown(md){
    let html = md
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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

  // ---------- filter ----------
  filterInput.addEventListener("input", () => {
    const q = filterInput.value.trim().toLowerCase();
    const rows = treeEl.querySelectorAll(".tnode-row");
    if (!q){
      rows.forEach(r => { r.parentElement.style.display = ""; });
      treeEl.querySelectorAll(".tchildren").forEach(c => {});
      return;
    }
    rows.forEach(r => {
      const match = r.dataset.path && r.dataset.path.toLowerCase().includes(q);
      r.parentElement.style.display = match ? "" : "none";
    });
    // expand all so matches are visible
    treeEl.querySelectorAll(".tchildren").forEach(c => c.classList.remove("collapsed"));
  });

  // ---------- init ----------
  async function init(){
    try {
      setStatus("đang kết nối GitHub API");
      const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      flatFiles = data.tree || [];

      const fileTotal = flatFiles.filter(f => f.type === "blob").length;
      fileCount.textContent = fileTotal + " file";

      rootNode = buildTree(flatFiles);
      treeEl.innerHTML = "";
      renderTree(rootNode, treeEl, 0);
      setStatus("sẵn sàng — " + fileTotal + " file đã tải");
    } catch (err) {
      treeEl.innerHTML = `<p class="err" style="padding:1rem;">Không tải được cây thư mục: ${err.message}. GitHub API có thể đang giới hạn tốc độ (rate limit) — thử tải lại trang sau ít phút.</p>`;
      setStatus("lỗi tải dữ liệu");
    }
  }

  init();
})();
