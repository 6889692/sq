/**
 * @typedef {object} BookmarkNode
 * @property {string} [title]
 * @property {string} [url]
 * @property {BookmarkNode[]} [children]
 */

/**
 * @typedef {object} FlatBookmarkNode
 * @property {string} title
 * @property {string} [url]
 * @property {number} level
 * @property {BookmarkNode} originalNode
 */

// --- DOM 元素引用 ---
const elements = {
  fileInput: document.getElementById("bookmark-file"),
  importBtn: document.getElementById("import-btn"),
  bookmarkTree: document.getElementById("bookmarkTree"),
  searchBox: document.querySelector(".search-box"),
  searchIcon: document.querySelector(".search-icon"),
  uploadBtn: document.getElementById("upload"),
  exportBtn: document.getElementById("export-btn"),
  topBar: document.querySelector(".top-bar"),
  titleText: document.querySelector(".top-bar-title span"),
  topBarTitle: document.querySelector(".top-bar-title"),
};

// --- 全局状态 ---
let rawJSON = "";
/** @type {FlatBookmarkNode[]} */
let allNodes = [];
let originalBookmarkTreeHTML = "";
let observer = null;
let bindEventsTimeout = null;

// --- 实用工具函数 ---

/**
 * 创建一个 DOM 元素。
 * @param {string} tag
 * @param {object} [options]
 * @param {string[]} [options.classes]
 * @param {object<string, string>} [options.attributes]
 * @returns {HTMLElement}
 */
const createElement = (tag, options = {}) => {
  const { classes = [], attributes = {} } = options;
  const element = document.createElement(tag);
  classes.forEach((cls) => element.classList.add(cls));
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
};

/**
 * 防抖函数。
 * @param {Function} func
 * @param {number} delay
 * @returns {Function}
 */
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
};

/**
 * 显示消息。
 * @param {string} message
 */
const showMessage = (message) => {
  alert(message);
};

/**
 * 处理错误。
 * @param {Error|string} error
 */
const handleError = (error) => {
  console.error(error);
  showMessage("发生错误：" + (error.message || error));
};

// --- 数据处理函数 ---

/**
 * 扁平化书签节点。
 * @param {BookmarkNode[]} nodes
 * @param {number} level
 * @returns {FlatBookmarkNode[]}
 */
const flattenNodes = (nodes, level) => {
  if (!nodes) return [];

  return nodes.reduce((acc, node) => {
    /** @type {FlatBookmarkNode} */
    const flatNode = {
      title: node.title || "(未命名)",
      url: node.url,
      level,
      originalNode: node,
    };
    return acc.concat(flatNode, flattenNodes(node.children, level + 1));
  }, []);
};

/**
 * 创建书签列表项。
 * @param {BookmarkNode} node
 * @param {number} level
 * @returns {HTMLLIElement}
 */
const createBookmarkListItem = (node, level) => {
  const li = createElement("li", { classes: [`level-${level}`] });

  if (node.children && node.children.length > 0) {
    li.classList.add("folder");
    const a = createElement("a", {
      classes: ["menu-item"],
      attributes: { href: "javascript:void(0);" },
    });
    a.textContent = node.title || "(未命名)";
    li.appendChild(a);

    const ul = createElement("ul", { classes: ["accordion-submenu"] });
    node.children.forEach((child) => {
      const childEl = createBookmarkListItem(child, level + 1);
      if (childEl) ul.appendChild(childEl);
    });
    li.appendChild(ul);
  } else if (node.url) {
    const a = createElement("a", {
      classes: ["bookmark-link"],
      attributes: { href: node.url, target: "_blank" },
    });
    a.textContent = node.title || "(无标题)";

    const icon = createElement("img", {
      classes: ["favicon-icon"],
      attributes: {
        src: getFaviconUrl(node.url), // 获取 favicon URL
        alt: "",
      },
    });

    a.prepend(icon);
    li.appendChild(a);
  }

  return li;
};

const FAVICON_CACHE_PREFIX = "favicon_";
const BACKUP_FAVICON_URL = "https://api.faviconkit.com/";  // 替换为你的备用 favicon 服务

/**
 * 获取 favicon URL，优先从本地缓存获取，否则从网络获取。
 * @param {string} url - 链接 URL
 * @returns {string} favicon URL
 */
function getFaviconUrl(url) {
  if (!url) return "";

  const domain = new URL(url).hostname;
  const cachedUrl = localStorage.getItem(FAVICON_CACHE_PREFIX + domain);

  if (cachedUrl) {
    return cachedUrl;
  }

  const faviconUrl = `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(url)}`;

  // 尝试加载 favicon，如果失败则使用备用地址
  const img = new Image();
  img.onload = () => {
    localStorage.setItem(FAVICON_CACHE_PREFIX + domain, faviconUrl);
  };
  img.onerror = () => {
    if (BACKUP_FAVICON_URL) {
      img.src = BACKUP_FAVICON_URL + domain; // 尝试备用地址
    }
  };
  img.src = faviconUrl;

  return faviconUrl;
};

/**
 * 渲染书签树。
 * @param {BookmarkNode[]} bookmarks
 * @param {HTMLElement} target
 */
const renderBookmarkTree = (bookmarks, target) => {
  if (!target) return;

  const fragment = document.createDocumentFragment();
  bookmarks.forEach((bookmark) => {
    const el = createBookmarkListItem(bookmark, 2);
    if (el) fragment.appendChild(el);
  });
  target.innerHTML = "";
  target.appendChild(fragment);
};

// --- 事件处理函数 ---

/**
 * 处理文件夹点击。
 * @param {MouseEvent} e
 */
const handleFolderClick = (e) => {
  const target = /** @type {HTMLElement} */ (e.target); // 类型断言
  if (!target.classList.contains("menu-item")) return;

  e.preventDefault();
  e.stopPropagation();

  const li = target.parentElement;
  if (!li) return;

  const isOpen = li.classList.contains("open");
  const siblings = Array.from(li.parentElement?.children || []);
  siblings.forEach((sib) => sib.classList.remove("open"));

  if (isOpen) {
    li.classList.remove("open");
  } else {
    li.classList.add("open");
    li.scrollIntoView({ behavior: "smooth", block: "start" });

    let parent = li.parentElement;
    while (parent && parent.classList.contains("accordion-submenu")) {
      const container = parent.parentElement;
      if (container) {
        container.classList.add("open");
        Array.from(container.parentElement?.children || []).forEach((sib) =>
          sib.classList.remove("open")
        );
      }
      parent = parent.parentElement?.parentElement;
    }
  }
};

/**
 * 处理搜索图标点击。
 */
const handleSearchIconClick = () => {
  elements.searchIcon.style.display = "none";
  elements.searchBox.style.display = "block";
  elements.topBar.classList.add("searching");
  elements.searchBox.focus();
  elements.titleText.style.display = window.innerWidth <= 480 ? "none" : "";
};

/**
 * 处理搜索框失去焦点。
 */
const handleSearchBoxBlur = () => {
  if (!elements.searchBox.value) {
    elements.searchBox.style.display = "none";
    elements.searchIcon.style.display = "block";
    elements.topBar.classList.remove("searching");
    elements.titleText.style.display = window.innerWidth <= 480 ? "inline" : "";
  }
};

/**
 * 处理搜索输入。
 */
const handleSearchBoxInput = () => {
  const keyword = elements.searchBox.value.trim().toLowerCase();
  const resultsContainer = createElement("ul", { classes: ["search-results"] });
  elements.bookmarkTree.innerHTML = "";

  if (keyword) {
    const regex = new RegExp(keyword, "gi");
    const results = allNodes.filter(
      (node) =>
        node.title.toLowerCase().includes(keyword) ||
        (node.url && node.url.toLowerCase().includes(keyword))
    );

    results.forEach((result) => {
      const li = createElement("li");
      const a = createElement("a", {
        classes: ["bookmark-link"],
        attributes: { href: result.url || result.originalNode.url, target: "_blank" },
      });
      a.innerHTML = result.title.replace(regex, `<mark>$&</mark>`);
      const icon = createElement("img", {
        classes: ["favicon-icon"],
        attributes: {
          src:
            "https://www.google.com/s2/favicons?sz=32&domain_url=" +
            encodeURIComponent(result.url || result.originalNode.url),
          alt: "",
        },
      });
      a.prepend(icon);
      li.appendChild(a);
      resultsContainer.appendChild(li);
    });

    elements.bookmarkTree.appendChild(resultsContainer);
  } else {
    elements.bookmarkTree.innerHTML = originalBookmarkTreeHTML;
  }
};

/**
 * 处理标题点击。
 */
const handleTitleClick = () => {
  elements.searchBox.value = "";
  elements.searchBox.style.display = "none";
  elements.searchIcon.style.display = "block";
  elements.topBar.classList.remove("searching");
  elements.titleText.style.display = window.innerWidth <= 480 ? "inline" : "";
  elements.bookmarkTree.innerHTML = originalBookmarkTreeHTML;
};

/**
 * 绑定文件夹点击事件 (防抖)。
 * @param {string} calledFrom
 */
const bindFolderClickEvents = (calledFrom) => {
  console.log(`bindFolderClickEvents called from: ${calledFrom}`);

  if (bindEventsTimeout) {
    clearTimeout(bindEventsTimeout);
  }

  bindEventsTimeout = setTimeout(() => {
    const folderLinks = document.querySelectorAll(".menu-item");
    console.log(`  folderLinks.length: ${folderLinks.length}`);

    folderLinks.forEach((a) => {
      if (!a.parentElement) return;

      a.removeEventListener("click", handleFolderClick);
      a.addEventListener("click", handleFolderClick);

      console.log(`  Event listener added to: ${a.textContent}`);
    });

    console.log("bindFolderClickEvents finished");
  }, 100);
};

/**
 * 初始化 MutationObserver。
 */
const initMutationObserver = () => {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver((mutations) => {
    let shouldBindEvents = mutations.some((mutation) => mutation.type === "childList");
    if (shouldBindEvents) {
      bindFolderClickEvents("MutationObserver");
    }
  });

  observer.observe(elements.bookmarkTree, { childList: true, subtree: true });
};

/**
 * 初始化应用。
 */
const initApp = async () => {
  elements.searchIcon.addEventListener("click", handleSearchIconClick);
  elements.searchBox.addEventListener("blur", handleSearchBoxBlur);
  elements.searchBox.addEventListener("input", handleSearchBoxInput);
  elements.topBarTitle.addEventListener("click", handleTitleClick);
  elements.importBtn.addEventListener("click", () => elements.fileInput.click());
  elements.fileInput.addEventListener("change", handleFileInputChange);
  elements.uploadBtn.addEventListener("click", handleUploadClick);
  elements.exportBtn.addEventListener("click", handleExportClick);

  try {
    await loadRemoteBookmarks();
  } catch (error) {
    handleError(error);
    showMessage("⚠️ 无法从 GitHub 加载书签，您可以点击“导入书签”手动上传。");
  }

  initMutationObserver();
};

/**
 * 加载远程书签。
 */
const loadRemoteBookmarks = async () => {
  const url = "data/bookmarks.json";
  const res = await fetch(url);
  if (!res.ok) throw new Error("获取失败");

  const json = await res.json();
  rawJSON = JSON.stringify(json, null, 2);

  const children = json?.[0]?.children?.[0]?.children || [];
  renderBookmarkTree(children, elements.bookmarkTree);

  allNodes = flattenNodes(children, 2);
  originalBookmarkTreeHTML = elements.bookmarkTree.innerHTML;
  bindFolderClickEvents("DOMContentLoaded");
};

/**
 * 处理文件输入变化。
 * @param {Event} e
 */
const handleFileInputChange = (e) => {
  const file = elements.fileInput.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const json = event.target.result;
      const data = JSON.parse(json);
      rawJSON = json;

      const children = data?.[0]?.children?.[0]?.children || [];
      renderBookmarkTree(children, elements.bookmarkTree);

      allNodes = flattenNodes(children, 2);
      originalBookmarkTreeHTML = elements.bookmarkTree.innerHTML;
      bindFolderClickEvents("fileInput change");
    } catch (parseError) {
      handleError(parseError);
      showMessage("无效 JSON");
    }
  };
  reader.readAsText(file);
};

/**
 * 处理上传按钮点击。
 */
const handleUploadClick = async () => {
  const token = prompt("请输入 GitHub Token：");
  if (!token) return showMessage("❌ 未提供 Token，上传已取消");

  const repo = "fjvi/bookmark";
  const path = "data/bookmarks.json";
  const branch = "main";
  const getURL = `https://api.github.com/repos/${repo}/contents/${path}`;
  let sha = null;

  try {
    const res = await fetch(getURL, {
      headers: { Authorization: `token ${token}` },
    });
    if (res.ok) {
      const json = await res.json();
      sha = json.sha;
    }
  } catch (error) {
    handleError(error);
  }

  const content = btoa(unescape(encodeURIComponent(rawJSON)));
  const payload = {
    message: "更新书签 JSON",
    content,
    branch,
    ...(sha && { sha }),
  };

  try {
    const res = await fetch(getURL, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      showMessage("✅ 上传成功！");
    } else {
      showMessage("❌ 上传失败");
    }
  } catch (uploadError) {
    handleError(uploadError);
    showMessage("❌ 上传失败");
  }
};

/**
 * 处理导出按钮点击。
 */
const handleExportClick = () => {
  if (!rawJSON) return showMessage("请先导入书签");

  const blob = new Blob([rawJSON], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = createElement("a", { attributes: { href: url, download: "bookmarks.json" } });
  a.click();
  URL.revokeObjectURL(url);
};

// --- 初始化 ---

window.addEventListener("DOMContentLoaded", initApp);
