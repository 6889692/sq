/**
 * 书签管理器 - 优化版
 * 主要改进：
 * 1. 模块化组织代码
 * 2. 增强错误处理
 * 3. 优化性能
 * 4. 改进搜索功能
 * 5. 更好的代码注释
 */

// ========== 常量定义 ==========
const CONFIG = {
  GITHUB_REPO: "fjvi/bookmark",
  GITHUB_PATH: "data/bookmarks.json",
  GITHUB_BRANCH: "main",
  MESSAGES: {
    LOAD_FAILED: "⚠️ 无法从 GitHub 加载书签，您可以点击“导入书签”手动上传。",
    INVALID_JSON: "无效的 JSON 文件",
    UPLOAD_SUCCESS: "✅ 上传成功！",
    UPLOAD_FAILED: "❌ 上传失败",
    EXPORT_CANCELLED: "导出已取消。",
    PASSWORD_ERROR: "密码错误，导出已取消。",
    NETWORK_ERROR: "网络错误，请稍后再试！"
  }
};

// ========== DOM 元素缓存 ==========
const DOM = {
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
  importModal: document.getElementById("import-modal"),
  modalBookmarkFile: document.getElementById("modal-bookmark-file"),
  modalUploadBtn: document.getElementById("modal-upload-btn"),
  closeBtn: document.querySelector(".close")
};

// ========== 状态管理 ==========
let state = {
  rawJSON: "",
  allNodes: [],
  originalBookmarkTreeHTML: "",
  observer: null,
  bindEventsTimeout: null
};

// ========== 工具函数 ==========
const Utils = {
  /**
   * 防抖函数
   * @param {Function} func - 要执行的函数
   * @param {number} delay - 延迟时间(ms)
   * @returns {Function} 防抖后的函数
   */
  debounce(func, delay = 300) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => func.apply(this, args), delay);
    };
  },

  /**
   * 扁平化书签节点
   * @param {Array} nodes - 书签节点数组
   * @param {number} level - 当前层级
   * @returns {Array} 扁平化后的节点数组
   */
  flattenNodes(nodes, level = 2) {
    if (!nodes) return [];
    return nodes.reduce((results, node) => {
      results.push({
        title: node.title || "(未命名)",
        url: node.url,
        level,
        originalNode: node
      });
      if (node.children) {
        results.push(...this.flattenNodes(node.children, level + 1));
      }
      return results;
    }, []);
  },

  /**
   * 高亮搜索关键词
   * @param {string} text - 原始文本
   * @param {string} keyword - 搜索关键词
   * @returns {string} 高亮后的HTML
   */
  highlightText(text, keyword) {
    if (!keyword) return text;
    const regex = new RegExp(keyword, "gi");
    return text.replace(regex, `<mark>$&</mark>`);
  },

  /**
   * 安全获取favicon
   * @param {string} url - 网站URL
   * @returns {string} favicon URL
   */
  getFavicon(url) {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(domain)}`;
    } catch {
      return "icons/default-favicon.png";
    }
  }
};

// ========== 书签渲染模块 ==========
const BookmarkRenderer = {
  /**
   * 创建书签列表项
   * @param {Object} node - 书签节点
   * @param {number} level - 当前层级
   * @returns {HTMLLIElement} 列表项元素
   */
  createBookmarkItem(node, level = 2) {
    if (!node.title && !node.url) return null;

    const li = document.createElement("li");
    li.classList.add(`level-${level}`);

    if (node.children?.length > 0) {
      // 文件夹节点
      li.classList.add("folder");
      
      const a = document.createElement("a");
      a.href = "javascript:void(0);";
      a.classList.add("menu-item");
      a.textContent = node.title || "(未命名)";
      li.appendChild(a);

      const ul = document.createElement("ul");
      ul.classList.add("accordion-submenu");
      node.children.forEach(child => {
        const childEl = this.createBookmarkItem(child, level + 1);
        if (childEl) ul.appendChild(childEl);
      });
      li.appendChild(ul);
    } else if (node.url) {
      // 书签链接节点
      if (node.url.startsWith("data:text/html")) {
        // 特殊数据书签
        li.appendChild(this._createDataBookmark(node));
      } else {
        // 普通书签
        li.appendChild(this._createNormalBookmark(node));
      }
    }

    return li;
  },

  /**
   * 创建普通书签元素
   * @private
   */
  _createNormalBookmark(node) {
    const a = document.createElement("a");
    a.href = node.url;
    a.classList.add("bookmark-link");
    a.target = "_blank";
    a.textContent = node.title || "(无标题)";

    const icon = document.createElement("img");
    icon.src = Utils.getFavicon(node.url);
    icon.classList.add("favicon-icon");
    a.prepend(icon);

    return a;
  },

  /**
   * 创建数据书签元素
   * @private
   */
  _createDataBookmark(node) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("bookmark-data-item");

    const copyIcon = document.createElement("span");
    copyIcon.classList.add("copy-symbol");
    copyIcon.textContent = "📋";
    wrapper.appendChild(copyIcon);

    const text = document.createElement("span");
    text.classList.add("copyable");
    text.textContent = node.title || "(无标题)";
    text.title = "点击复制内容";

    text.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._handleDataBookmarkCopy(node, copyIcon, wrapper);
    });

    wrapper.appendChild(text);
    return wrapper;
  },

  /**
   * 处理数据书签复制
   * @private
   */
  _handleDataBookmarkCopy(node, copyIcon, wrapper) {
    try {
      const html = decodeURIComponent(node.url.split(",")[1]);
      const match = html.match(/<pre>([\s\S]*?)<\/pre>/i);
      if (match) {
        const content = match[1]
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&");

        navigator.clipboard.writeText(content).then(() => {
          copyIcon.textContent = "✅";
          wrapper.classList.add("copied");
          setTimeout(() => {
            copyIcon.textContent = "📋";
            wrapper.classList.remove("copied");
          }, 1000);
        });
      }
    } catch (error) {
      console.error("复制数据书签失败:", error);
    }
  },

  /**
   * 渲染书签树
   * @param {HTMLElement} container - 容器元素
   * @param {Array} data - 书签数据
   */
  renderBookmarkTree(container, data) {
    if (!container || !Array.isArray(data)) return;
    
    container.innerHTML = "";
    const children = data?.[0]?.children?.[0]?.children || [];
    
    children.forEach(child => {
      const el = this.createBookmarkItem(child, 2);
      if (el) container.appendChild(el);
    });

    state.allNodes = Utils.flattenNodes(children, 2);
    state.originalBookmarkTreeHTML = container.innerHTML;
    EventBinder.bindFolderClickEvents();
    this._setupObserver(container);
  },

  /**
   * 设置MutationObserver
   * @private
   */
  _setupObserver(container) {
    if (state.observer) {
      state.observer.disconnect();
    }

    state.observer = new MutationObserver(() => {
      EventBinder.bindFolderClickEvents("MutationObserver");
    });

    state.observer.observe(container, {
      childList: true,
      subtree: true
    });
  }
};

// ========== 事件处理模块 ==========
const EventBinder = {
  /**
   * 绑定文件夹点击事件
   * @param {string} [source] - 调用来源(调试用)
   */
  bindFolderClickEvents(source = "") {
    console.log(`bindFolderClickEvents called from: ${source}`);

    if (state.bindEventsTimeout) {
      clearTimeout(state.bindEventsTimeout);
    }

    state.bindEventsTimeout = setTimeout(() => {
      const folderLinks = document.querySelectorAll(".menu-item");
      console.log(`  folderLinks.length: ${folderLinks.length}`);

      folderLinks.forEach(a => {
        a.removeEventListener("click", this.handleFolderClick);
        a.addEventListener("click", this.handleFolderClick);
      });
    }, 100);
  },

  /**
   * 处理文件夹点击
   * @param {Event} e - 点击事件
   */
  handleFolderClick(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const li = e.currentTarget.parentElement;
    if (!li) return;

    const isOpen = li.classList.contains("open");
    const siblings = li.parentElement?.children || [];
    
    // 关闭其他同级文件夹
    Array.from(siblings).forEach(sib => {
      if (sib !== li) sib.classList.remove("open");
    });

    // 切换当前文件夹状态
    if (isOpen) {
      li.classList.remove("open");
    } else {
      li.classList.add("open");
      this._scrollToFolder(li);
      this._openParentFolders(li);
    }
  },

  /**
   * 滚动到文件夹位置
   * @private
   */
  _scrollToFolder(li) {
    const liTop = li.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: liTop,
      behavior: "smooth"
    });
  },

  /**
   * 打开父级文件夹
   * @private
   */
  _openParentFolders(li) {
    let parent = li.parentElement;
    while (parent?.classList.contains("accordion-submenu")) {
      const container = parent.parentElement;
      if (container) {
        container.classList.add("open");
        const ancestorSiblings = container.parentElement?.children || [];
        Array.from(ancestorSiblings).forEach(sib => {
          if (sib !== container) sib.classList.remove("open");
        });
      }
      parent = parent.parentElement?.parentElement;
    }
  }
};

// ========== 搜索模块 ==========
const SearchHandler = {
  /**
   * 初始化搜索功能
   */
  init() {
    DOM.searchIcon.addEventListener("click", this.toggleSearch.bind(this));
    DOM.searchBox.addEventListener("blur", this.handleSearchBlur.bind(this));
    DOM.searchBox.addEventListener(
      "input", 
      Utils.debounce(this.handleSearchInput.bind(this), 300)
    );
  },

  /**
   * 切换搜索框显示状态
   */
  toggleSearch() {
    DOM.searchIcon.style.display = "none";
    DOM.searchBox.style.display = "block";
    DOM.topBar.classList.add("searching");
    DOM.searchBox.focus();

    if (window.innerWidth <= 480) {
      DOM.titleText.style.display = "none";
    }
  },

  /**
   * 处理搜索框失去焦点
   */
  handleSearchBlur() {
    if (!DOM.searchBox.value) {
      this.resetSearch();
    }
  },

  /**
   * 重置搜索状态
   */
  resetSearch() {
    DOM.searchBox.style.display = "none";
    DOM.searchIcon.style.display = "block";
    DOM.topBar.classList.remove("searching");
    DOM.titleText.style.display = window.innerWidth <= 480 ? "inline" : "inline";
    DOM.bookmarkTree.innerHTML = state.originalBookmarkTreeHTML;
    EventBinder.bindFolderClickEvents("search reset");
  },

  /**
   * 处理搜索输入
   */
  handleSearchInput() {
    const keyword = DOM.searchBox.value.trim().toLowerCase();
    const resultsContainer = document.createElement("ul");
    resultsContainer.classList.add("search-results");
    DOM.bookmarkTree.innerHTML = "";

    if (keyword) {
      const results = state.allNodes.filter(node =>
        node.title.toLowerCase().includes(keyword) ||
        (node.url && node.url.toLowerCase().includes(keyword))
      );

      results.forEach(result => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = result.url || result.originalNode.url;
        a.classList.add("bookmark-link");
        a.target = "_blank";
        a.innerHTML = Utils.highlightText(result.title, keyword);

        const icon = document.createElement("img");
        icon.src = Utils.getFavicon(result.url || result.originalNode.url);
        icon.classList.add("favicon-icon");
        a.prepend(icon);

        li.appendChild(a);
        resultsContainer.appendChild(li);
      });

      DOM.bookmarkTree.appendChild(resultsContainer);
    } else {
      this.resetSearch();
    }
  }
};

// ========== 导入/导出模块 ==========
const ImportExportHandler = {
  /**
   * 初始化导入/导出功能
   */
  init() {
    DOM.importBtn.addEventListener("click", () => {
      DOM.importModal.style.display = "block";
    });

    DOM.modalBookmarkFile.addEventListener("change", this.handleFileImport.bind(this));
    DOM.modalUploadBtn.addEventListener("click", this.handleGitHubUpload.bind(this));
    DOM.exportBtn.addEventListener("click", this.handleExport.bind(this));

    window.addEventListener("click", (e) => {
      if (e.target === DOM.importModal) {
        DOM.importModal.style.display = "none";
      }
    });
  },

  /**
   * 处理文件导入
   */
  handleFileImport() {
    const file = DOM.modalBookmarkFile.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const json = e.target.result;
        state.rawJSON = json;
        const data = JSON.parse(json);
        BookmarkRenderer.renderBookmarkTree(DOM.bookmarkTree, data);
      } catch (e) {
        alert(CONFIG.MESSAGES.INVALID_JSON);
      }
    };
    reader.readAsText(file);
  },

  /**
   * 处理GitHub上传
   */
  async handleGitHubUpload() {
    const token = prompt("请输入 GitHub Token：");
    if (!token) return;

    try {
      // 检查现有文件获取sha
      let sha = null;
      const getURL = `https://api.github.com/repos/${CONFIG.GITHUB_REPO}/contents/${CONFIG.GITHUB_PATH}`;
      
      const res = await fetch(getURL, {
        headers: { Authorization: "token " + token }
      });
      
      if (res.ok) {
        const json = await res.json();
        sha = json.sha;
      }

      // 上传文件
      const content = btoa(unescape(encodeURIComponent(state.rawJSON)));
      const payload = {
        message: "更新书签 JSON",
        content,
        branch: CONFIG.GITHUB_BRANCH,
        ...(sha && { sha })
      };

      const uploadRes = await fetch(getURL, {
        method: "PUT",
        headers: {
          Authorization: "token " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (uploadRes.ok) {
        alert(CONFIG.MESSAGES.UPLOAD_SUCCESS);
        DOM.importModal.style.display = "none";
      } else {
        throw new Error(CONFIG.MESSAGES.UPLOAD_FAILED);
      }
    } catch (error) {
      console.error("上传失败:", error);
      alert(`${CONFIG.MESSAGES.UPLOAD_FAILED}: ${error.message}`);
    }
  },

  /**
   * 处理导出
   */
  async handleExport() {
    const password = prompt("请输入导出密码：");
    if (password === null) {
      alert(CONFIG.MESSAGES.EXPORT_CANCELLED);
      return;
    }

    try {
      const response = await fetch("https://api.692.cloudns.be/api/check-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

      const result = await response.json();

      if (result.success) {
        if (!state.rawJSON) return alert("请先导入书签");

        const blob = new Blob([state.rawJSON], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "bookmarks.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert(CONFIG.MESSAGES.PASSWORD_ERROR);
      }
    } catch (error) {
      console.error("导出失败:", error);
      alert(CONFIG.MESSAGES.NETWORK_ERROR);
    }
  }
};

// ========== 初始化 ==========
document.addEventListener("DOMContentLoaded", async () => {
  // 初始化各模块
  SearchHandler.init();
  ImportExportHandler.init();
  
  // 点击logo重置搜索
  DOM.topBarTitle.addEventListener("click", () => {
    DOM.searchBox.value = "";
    SearchHandler.resetSearch();
  });

  // 加载远程书签
  try {
    const res = await fetch("data/bookmarks.json");
    if (!res.ok) throw new Error("获取失败");

    const json = await res.json();
    state.rawJSON = JSON.stringify(json, null, 2);
    BookmarkRenderer.renderBookmarkTree(DOM.bookmarkTree, json);
  } catch (e) {
    alert(CONFIG.MESSAGES.LOAD_FAILED);
  }
});
