const fileInput = document.getElementById("bookmark-file");
const importBtn = document.getElementById("import-btn");
const bookmarkTree = document.getElementById("bookmarkTree");
const searchBox = document.querySelector(".search-box");
const searchIcon = document.querySelector(".search-icon");
const uploadBtn = document.getElementById("upload");
const exportBtn = document.getElementById("export-btn");
const topBar = document.querySelector(".top-bar");
const titleText = document.querySelector(".top-bar-title span");
const topBarTitle = document.querySelector(".top-bar-title");

let rawJSON = "";
let allNodes = [];
let originalBookmarkTreeHTML = "";
let observer = null;
let bindEventsTimeout = null; // 用于防抖
const LOAD_BOOKMARKS_TIMEOUT = 10000; // 延迟弹窗显示的毫秒数
let loadBookmarksTimeoutId = null; // 用于存储 setTimeout 的 ID
// 预处理书签数据，扁平化节点以便搜索
function flattenNodes(nodes, level) {
  const results = [];
  if (!nodes) return results;

  nodes.forEach(node => {
    const flatNode = {
      title: node.title || "(未命名)",
      url: node.url,
      level,
      originalNode: node
    };
    results.push(flatNode);
    if (node.children) {
      results.push(...flattenNodes(node.children, level + 1));
    }
  });

  return results;
}

const FaviconLoader = {
    FAVICON_CACHE_PREFIX: "favicon_",
    BACKUP_FAVICON_URLS: [
        "https://api.faviconkit.com/",
        // "https://icon.horse/icon/", // 可以根据需要启用
    ],
    DEFAULT_FAVICON: "",
    BACKUP_ATTEMPT_DELAY: 500, // 毫秒，尝试备用地址的延迟
    BACKUP_ATTEMPT_TIMEOUT: 2000, // 毫秒，备用地址尝试的超时时间

    getFaviconUrl(url) {
        if (!url) return FaviconLoader.DEFAULT_FAVICON;
        try {
            const domain = new URL(url).hostname;
            const cachedUrl = localStorage.getItem(FaviconLoader.FAVICON_CACHE_PREFIX + domain);
            if (cachedUrl) {
                return cachedUrl;
            }
            const googleFaviconUrl = `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(url)}`;
            return googleFaviconUrl;
        } catch (error) {
            console.error("Error getting favicon URL:", error);
            return FaviconLoader.DEFAULT_FAVICON;
        }
    },

    loadFavicon(icon, url) {
        let attempt = 0;

        const attemptLoad = (currentUrl) => {
            const img = new Image();
            let timeoutId;

            img.onload = () => {
                clearTimeout(timeoutId);
                if (attempt === 0 && currentUrl.startsWith('https://www.google.com/')) {
                    try {
                        localStorage.setItem(FaviconLoader.FAVICON_CACHE_PREFIX + new URL(url).hostname, currentUrl);
                    } catch (e) {
                        console.warn("Error saving favicon to localStorage:", e);
                    }
                }
                icon.src = currentUrl;
            };

            img.onerror = () => {
                clearTimeout(timeoutId);
                if (attempt < FaviconLoader.BACKUP_FAVICON_URLS.length) {
                    attempt++;
                    setTimeout(() => {
                        attemptLoad(FaviconLoader.BACKUP_FAVICON_URLS[attempt - 1] + new URL(url).hostname);
                    }, FaviconLoader.BACKUP_ATTEMPT_DELAY);
                } else if (FaviconLoader.DEFAULT_FAVICON) {
                    icon.src = FaviconLoader.DEFAULT_FAVICON;
                }
            };

            timeoutId = setTimeout(() => {
                img.onerror = null; // 清除 onerror，避免重复触发
                if (attempt < FaviconLoader.BACKUP_FAVICON_URLS.length) {
                    attempt++;
                    setTimeout(() => {
                        attemptLoad(FaviconLoader.BACKUP_FAVICON_URLS[attempt - 1] + new URL(url).hostname);
                    }, FaviconLoader.BACKUP_ATTEMPT_DELAY);
                } else if (FaviconLoader.DEFAULT_FAVICON) {
                    icon.src = FaviconLoader.DEFAULT_FAVICON;
                }
            }, FaviconLoader.BACKUP_ATTEMPT_TIMEOUT);

            img.src = currentUrl;
        };

        attemptLoad(FaviconLoader.getFaviconUrl(url));
    }
};

function createBookmarkList(node, level) {
    const li = document.createElement("li");
    li.classList.add(`level-${level}`);

    if (node.children && node.children.length > 0) {
        li.classList.add("folder");
        const a = document.createElement("a");
        a.href = "javascript:void(0);";
        a.classList.add("menu-item");
        a.textContent = node.title || "(未命名)";
        li.appendChild(a);
        const ul = document.createElement("ul");
        ul.classList.add("accordion-submenu");
        node.children.forEach(child => {
            const childEl = createBookmarkList(child, level + 1);
            if (childEl) ul.appendChild(childEl);
        });
        li.appendChild(ul);
    } else if (node.url) {
        const a = document.createElement("a");
        a.href = node.url;
        a.classList.add("bookmark-link");
        a.target = "_blank";
        a.textContent = node.title || "(无标题)";
        const icon = document.createElement("img");
        icon.classList.add("favicon-icon");
        a.prepend(icon);
        li.appendChild(a);
        FaviconLoader.loadFavicon(icon, node.url); // 使用新的加载逻辑
    }
    return li;
};

// 📂 渲染书签树
function createBookmarkList(node, level) {
  const li = document.createElement("li");
  li.classList.add(`level-${level}`);

  if (node.children && node.children.length > 0) {
    li.classList.add("folder");

    const a = document.createElement("a");
    a.href = "javascript:void(0);";
    a.classList.add("menu-item");
    a.textContent = node.title || "(未命名)";
    li.appendChild(a);

    const ul = document.createElement("ul");
    ul.classList.add("accordion-submenu");
    node.children.forEach(child => {
      const childEl = createBookmarkList(child, level + 1);
      if (childEl) ul.appendChild(childEl);
    });
    li.appendChild(ul);
  } else if (node.url) {
    const a = document.createElement("a");
    a.href = node.url;
    a.classList.add("bookmark-link");
    a.target = "_blank";
    a.textContent = node.title || "(无标题)";
    const icon = document.createElement("img");
    icon.src = FaviconLoader.getFaviconUrl(node.url); // 使用 getFaviconUrl
    icon.classList.add("favicon-icon");
    a.prepend(icon);
    li.appendChild(a);
  }

  return li;
}

// ✅ 折叠 + 滚动行为
function setupFolderClick(e) {
  e.preventDefault();
  e.stopPropagation();
  const li = this.parentElement;
  if (!li) return; // 增加安全检查
  const isOpen = li.classList.contains("open");
  const siblings = li.parentElement?.children || [];
  Array.from(siblings).forEach((sib) => {
    if (sib !== li) sib.classList.remove("open");
  });
  if (isOpen) {
    li.classList.remove("open");
  } else {
    li.classList.add("open");
    const liTop = li.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: liTop,
      behavior: "smooth"
    });
    let parent = li.parentElement;
    while (parent && parent.classList.contains("accordion-submenu")) {
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
}

// 🔍 搜索
searchIcon.addEventListener("click", () => {
  searchIcon.style.display = "none";
  searchBox.style.display = "block";
  topBar.classList.add("searching");
  searchBox.focus();

  if (window.innerWidth <= 480) {
    titleText.style.display = "none";
  }
});

searchBox.addEventListener("blur", () => {
  if (!searchBox.value) {
    searchBox.style.display = "none";
    searchIcon.style.display = "block";
    topBar.classList.remove("searching");

    if (window.innerWidth <= 480) {
      titleText.style.display = "inline";
    }
  }
});

searchBox.addEventListener("input", () => {
  const keyword = searchBox.value.trim().toLowerCase();
  const resultsContainer = document.createElement("ul");
  resultsContainer.classList.add("search-results");
  bookmarkTree.innerHTML = "";

  if (keyword) {
    const regex = new RegExp(keyword, "gi");
    const results = allNodes.filter(node =>
      node.title.toLowerCase().includes(keyword) ||
      (node.url && node.url.toLowerCase().includes(keyword))
    );

    results.forEach(result => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = result.url || result.originalNode.url;
      a.classList.add("bookmark-link");
      a.target = "_blank";

      const highlightedTitle = result.title.replace(regex, `<mark>$&</mark>`);
      a.innerHTML = highlightedTitle;

      const icon = document.createElement("img");
      icon.src = FaviconLoader.getFaviconUrl(result.url || result.originalNode.url); // 使用 getFaviconUrl
      icon.classList.add("favicon-icon");
      a.prepend(icon);

      li.appendChild(a);
      resultsContainer.appendChild(li);
    });

    bookmarkTree.appendChild(resultsContainer);
  } else {
    bookmarkTree.innerHTML = originalBookmarkTreeHTML;
    bindFolderClickEvents("searchBox input");
  }
});

// 点击 logo 清除搜索状态
topBarTitle.addEventListener("click", () => {
  searchBox.value = "";
  searchBox.style.display = "none";
  searchIcon.style.display = "block";
  topBar.classList.remove("searching");
  titleText.style.display = window.innerWidth <= 480 ? "inline" : "inline";
  bookmarkTree.innerHTML = originalBookmarkTreeHTML;
  bindFolderClickEvents("topBarTitle click");
});

// 页面加载时自动尝试加载远程书签
window.addEventListener("DOMContentLoaded", async () => {
  const url = "data/bookmarks.json";
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("获取失败");

    const json = await res.json();
    rawJSON = JSON.stringify(json, null, 2);

    const children = json?.[0]?.children?.[0]?.children || [];
    bookmarkTree.innerHTML = "";
    children.forEach(child => {
      const el = createBookmarkList(child, 2);
      if (el) bookmarkTree.appendChild(el);
    });

    allNodes = flattenNodes(children, 2);
    originalBookmarkTreeHTML = bookmarkTree.innerHTML;
    bindFolderClickEvents("DOMContentLoaded");
    observeBookmarkTree();
    if (loadBookmarksTimeoutId) {
      clearTimeout(loadBookmarksTimeoutId); // 取消弹窗
    }
  } catch (e) {
    loadBookmarksTimeoutId = setTimeout(() => {
      alert("⚠️ 无法从 GitHub 加载书签，您可以点击“导入书签”手动上传。");
    }, LOAD_BOOKMARKS_TIMEOUT);
  }
});

// 导入本地 JSON 文件
importBtn.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const json = e.target.result;
    rawJSON = json;
    try {
      const data = JSON.parse(json);
      const children = data?.[0]?.children?.[0]?.children || [];
      bookmarkTree.innerHTML = "";
      children.forEach(child => {
        const el = createBookmarkList(child, 2);
        if (el) bookmarkTree.appendChild(el);
      });

      allNodes = flattenNodes(children, 2);
      originalBookmarkTreeHTML = bookmarkTree.innerHTML;
      bindFolderClickEvents("fileInput change");
    } catch (e) {
      alert("无效 JSON");
    }
  };
  reader.readAsText(file);
});

// 上传书签到 GitHub
uploadBtn.addEventListener("click", async () => {
  const token = prompt("请输入 GitHub Token：");
  if (!token) return alert("❌ 未提供 Token，上传已取消");

  const repo = "fjvi/bookmark";
  const path = "data/bookmarks.json";
  const branch = "main";
  const getURL = `https://api.github.com/repos/${repo}/contents/${path}`;
  let sha = null;

  try {
    const res = await fetch(getURL, {
      headers: { Authorization: "token " + token }
    });
    if (res.ok) {
      const json = await res.json();
      sha = json.sha;
    }
  } catch (e) {}

  const content = btoa(unescape(encodeURIComponent(rawJSON)));
  const payload = {
    message: "更新书签 JSON",
    content,
    branch,
    ...(sha && { sha })
  };

  const res = await fetch(getURL, {
    method: "PUT",
    headers: {
      Authorization: "token " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    alert("✅ 上传成功！");
  } else {
    alert("❌ 上传失败");
  }
});

// 导出为 JSON 文件
exportBtn.addEventListener("click", () => {
  if (!rawJSON) return alert("请先导入书签");

  const blob = new Blob([rawJSON], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bookmarks.json";
  a.click();
  URL.revokeObjectURL(url);
});

// 绑定文件夹点击事件
function bindFolderClickEvents(calledFrom) {
  console.log(`bindFolderClickEvents called from: ${calledFrom}`);

  // 防抖处理
  if (bindEventsTimeout) {
    clearTimeout(bindEventsTimeout);
  }
  bindEventsTimeout = setTimeout(() => {
    const folderLinks = document.querySelectorAll(".menu-item");
    console.log(`  folderLinks.length: ${folderLinks.length}`);

    folderLinks.forEach(a => {
      if (!a.parentElement) return; // 增加安全检查

      a.removeEventListener("click", setupFolderClick);
      a.addEventListener("click", setupFolderClick);

      console.log(`  Event listener added to: ${a.textContent}`);
    });
    console.log(`bindFolderClickEvents finished`);
  }, 100); // 100ms 防抖
}

// 创建并配置 MutationObserver
function observeBookmarkTree() {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver(function(mutations) {
    let shouldBindEvents = false;
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList') {
        shouldBindEvents = true;
      }
    });
    if (shouldBindEvents) {
      bindFolderClickEvents("MutationObserver");
    }
  });

  observer.observe(bookmarkTree, {
    childList: true,
    subtree: true
  });
}
