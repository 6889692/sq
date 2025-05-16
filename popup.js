document.addEventListener("DOMContentLoaded", () => {
  // 顶部栏功能
  const topBarTitle = document.querySelector(".top-bar-title");
  const searchIcon = document.querySelector(".search-icon");
  const searchBox = document.querySelector(".search-box");

  // 函数：检查屏幕宽度并决定是否隐藏标题
  function toggleTitleVisibility() {
    if (window.innerWidth <= 480) {
      topBarTitle.style.display = searchBox.style.display === "block" ? "none" : "flex";
    } else {
      topBarTitle.style.display = "flex";
    }
  }

  // 初始加载时检查
  toggleTitleVisibility();

  // 窗口大小改变时检查
  window.addEventListener("resize", toggleTitleVisibility);

  // 点击标题打开完整页面
  topBarTitle.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
  });

  // 搜索图标切换搜索框
  searchIcon.addEventListener("click", () => {
    searchIcon.style.display = "none";
    searchBox.style.display = "block";
    searchBox.focus();
    toggleTitleVisibility(); // 检查并可能隐藏标题
  });

  // 搜索框失去焦点时恢复搜索图标
  searchBox.addEventListener("blur", () => {
    if (!searchBox.value) {
      searchBox.style.display = "none";
      searchIcon.style.display = "block";
      toggleTitleVisibility(); // 检查并可能显示标题
    }
  });

  // 搜索功能
  searchBox.addEventListener("input", (e) => {
    const keyword = e.target.value.trim();
    if (keyword) {
      chrome.bookmarks.search(keyword, (results) => {
        renderSearchResults(results);
      });
    } else {
      renderFullBookmarks();
    }
  });

  // 底部栏功能
  const exportBtn = document.getElementById("export-btn");
  const moreBtn = document.getElementById("more-btn");
  const importBtn = document.getElementById("import-btn"); // 新增导入按钮
  const importFile = document.getElementById("import-file"); // 新增隐藏的文件输入框

  exportBtn.addEventListener("click", () => {
    chrome.bookmarks.getTree((tree) => {
      exportBookmarks(tree);
    });
  });

  moreBtn.addEventListener("click", () => {
    alert("这里预留更多功能入口");
  });

  //  导入按钮点击事件
  importBtn.addEventListener("click", () => {
    importFile.click(); // 触发文件选择
  });

  //  文件选择变化事件
  importFile.addEventListener("change", handleImport);

  // 初始加载书签
  renderFullBookmarks();
});

function renderFullBookmarks() {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
      const treeRoot = document.getElementById("bookmarkTree");
      if (!treeRoot) {
        reject(new Error("Bookmark tree root element not found."));
        return;
      }
      treeRoot.innerHTML = ""; //  先清空内容，避免重复渲染

      try {
        const bookmarkRootChildren = bookmarkTreeNodes[0].children || [];
        const ul = document.createElement("ul");
        ul.className = "accordion-menu";

        bookmarkRootChildren.forEach((folderNode) => {
          if (folderNode.children) {
            const subTree = createBookmarkList(folderNode.children, 2);
            if (subTree) {
              ul.appendChild(subTree);
            }
          }
        });

        treeRoot.appendChild(ul);
        resolve();
      } catch (error) {
        console.error("Error in renderFullBookmarks:", error);
        reject(error);
      }
    });
  });
}

function renderSearchResults(results) {
  return new Promise((resolve, reject) => {
    const treeRoot = document.getElementById("bookmarkTree");
    if (!treeRoot) {
      reject(new Error("Bookmark tree root element not found."));
      return;
    }
    treeRoot.innerHTML = "";

    const ul = document.createElement("ul");
    ul.className = "accordion-menu";

    try {
      results.forEach((bookmark) => {
        if (!bookmark.url) return;

        const li = document.createElement("li");
        li.classList.add("level-2");

        const a = document.createElement("a");
        a.href = bookmark.url;
        a.textContent = bookmark.title;
        a.target = "_blank";
        a.classList.add("bookmark-link");

        const favicon = document.createElement("img");
        favicon.src = `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(bookmark.url)}`;
        favicon.className = "favicon-icon";
        a.prepend(favicon);

        a.addEventListener("click", (e) => {
          e.preventDefault();
          chrome.tabs?.create
            ? chrome.tabs.create({ url: bookmark.url })
            : window.open(bookmark.url, "_blank");
        });

        li.appendChild(a);
        ul.appendChild(li);
      });

      treeRoot.appendChild(ul);
      resolve();
    } catch (error) {
      console.error("Error in renderSearchResults:", error);
      reject(error);
    }
  });
}

function createBookmarkList(bookmarkNodes, level = 2) {
  if (!bookmarkNodes) return null; //  增加判空处理

  const ul = document.createElement("ul");
  ul.className = level === 2 ? "accordion-menu" : "accordion-submenu";

  try {
    bookmarkNodes.forEach((node) => {
      if (!node.title) return;

      const li = document.createElement("li");
      const a = document.createElement("a");
      a.textContent = node.title;
      li.classList.add(`level-${level}`);

      if (node.url) {
        a.href = node.url;
        a.target = "_blank";
        a.classList.add("bookmark-link");

        const favicon = document.createElement("img");
        favicon.src = `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(node.url)}`;
        favicon.className = "favicon-icon";
        a.prepend(favicon);

        a.addEventListener("click", (e) => {
          e.preventDefault();
          chrome.tabs?.create
            ? chrome.tabs.create({ url: node.url })
            : window.open(node.url, "_blank");
        });
      } else {
        a.classList.add("menu-item");
        a.addEventListener("click", (e) => {
          e.stopPropagation();
          const isOpen = li.classList.contains("open");

          const siblings = li.parentElement.children;
          Array.from(siblings).forEach((sib) => {
            if (sib !== li) sib.classList.remove("open");
          });

          if (isOpen) {
            li.classList.remove("open");
          } else {
            li.classList.add("open");

            const offset = 0;
            const liTop = li.getBoundingClientRect().top + window.scrollY;
            window.scrollTo({
              top: liTop - offset,
              behavior: "smooth"
            });

            let parent = li.parentElement;
            while (parent && parent.classList.contains("accordion-submenu")) {
              parent.parentElement.classList.add("open");

              const ancestorSiblings = parent.parentElement.parentElement?.children;
              if (ancestorSiblings) {
                Array.from(ancestorSiblings).forEach((sib) => {
                  if (sib !== parent.parentElement) sib.classList.remove("open");
                });
              }

              parent = parent.parentElement.parentElement;
            }
        }
      });
    }

      li.appendChild(a);

      if (node.children) {
        const childUl = createBookmarkList(node.children, level + 1);
        if (childUl) {
          li.appendChild(childUl);
        }
      }

      ul.appendChild(li);
    });
  } catch (error) {
    console.error("Error in createBookmarkList:", error);
    return null; //  返回 null，通知上层处理
  }

  return ul;
}

function exportBookmarks(tree) {
  return new Promise((resolve, reject) => {
    try {
      const json = JSON.stringify(tree, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bookmarks.json";
      a.click();
      URL.revokeObjectURL(url); //  释放 URL 对象
      resolve();
    } catch (error) {
      console.error("Error exporting bookmarks:", error);
      reject(error);
    }
  });
}

function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const json = e.target.result;
      const bookmarks = JSON.parse(json);
      renderImportedBookmarks(bookmarks);
    } catch (error) {
      console.error("Error parsing imported file:", error);
      alert("导入的文件格式不正确。");
    }
  };

  reader.readAsText(file);
}

function renderImportedBookmarks(bookmarks) {
  const treeRoot = document.getElementById("bookmarkTree");
  if (!treeRoot) return;
  treeRoot.innerHTML = "";

  const ul = document.createElement("ul");
  ul.className = "accordion-menu";

  //  假设 bookmarks 是 bookmarkTreeNodes (包含根节点)
  if (bookmarks && bookmarks.length > 0 && bookmarks[0].children) {
    createBookmarkList(bookmarks[0].children, 2, ul);
  } else if (bookmarks && bookmarks.length > 0) {
    //  处理根节点就是书签的情况
    createBookmarkList(bookmarks, 2, ul);
  }
  else {
    alert("导入的文件不包含有效的书签数据。");
    return;
  }

  treeRoot.appendChild(ul);
}