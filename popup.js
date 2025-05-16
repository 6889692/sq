document.addEventListener("DOMContentLoaded", () => {
  // 初始化书签数据
  let bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || {
    "title": "书签栏",
    "children": []
  };

  // DOM元素
  const topBarTitle = document.querySelector(".top-bar-title");
  const searchIcon = document.querySelector(".search-icon");
  const searchBox = document.querySelector(".search-box");
  const importBtn = document.getElementById("import-btn");
  const importFile = document.getElementById("import-file");
  const exportBtn = document.getElementById("export-btn");
  const addFolderBtn = document.getElementById("add-folder-btn");
  const addBookmarkBtn = document.getElementById("add-bookmark-btn");
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modal-title");
  const itemName = document.getElementById("item-name");
  const itemUrl = document.getElementById("item-url");
  const modalCancel = document.getElementById("modal-cancel");
  const modalConfirm = document.getElementById("modal-confirm");
  const closeBtn = document.querySelector(".close");

  // 当前选中的文件夹（用于添加新项目）
  let currentSelectedFolder = null;
  
  // 初始化渲染
  renderFullBookmarks(bookmarks.children);

  // 顶部栏功能
  function toggleTitleVisibility() {
    if (window.innerWidth <= 480) {
      topBarTitle.style.display = searchBox.style.display === "block" ? "none" : "flex";
    } else {
      topBarTitle.style.display = "flex";
    }
  }

  toggleTitleVisibility();
  window.addEventListener("resize", toggleTitleVisibility);

  // 搜索功能
  searchIcon.addEventListener("click", () => {
    searchIcon.style.display = "none";
    searchBox.style.display = "block";
    searchBox.focus();
    toggleTitleVisibility();
  });

  searchBox.addEventListener("blur", () => {
    if (!searchBox.value) {
      searchBox.style.display = "none";
      searchIcon.style.display = "block";
      toggleTitleVisibility();
      renderFullBookmarks(bookmarks.children);
    }
  });

  searchBox.addEventListener("input", (e) => {
    const keyword = e.target.value.trim().toLowerCase();
    if (keyword) {
      const results = searchBookmarks(bookmarks, keyword);
      renderSearchResults(results);
    } else {
      renderFullBookmarks(bookmarks.children);
    }
  });

  // 导入功能
  importBtn.addEventListener("click", () => {
    importFile.click();
  });

  importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedBookmarks = JSON.parse(event.target.result);
        if (importedBookmarks && Array.isArray(importedBookmarks.children)) {
          bookmarks = importedBookmarks;
          localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
          renderFullBookmarks(bookmarks.children);
          alert("书签导入成功！");
        } else {
          alert("无效的书签文件格式");
        }
      } catch (error) {
        alert("解析书签文件时出错: " + error.message);
      }
    };
    reader.readAsText(file);
  });

  // 导出功能
  exportBtn.addEventListener("click", () => {
    exportBookmarks(bookmarks);
  });

  // 添加文件夹
  addFolderBtn.addEventListener("click", () => {
    currentSelectedFolder = bookmarks;
    modalTitle.textContent = "添加新文件夹";
    itemUrl.style.display = "none";
    itemName.value = "";
    modal.style.display = "block";
  });

  // 添加书签
  addBookmarkBtn.addEventListener("click", () => {
    currentSelectedFolder = bookmarks;
    modalTitle.textContent = "添加新书签";
    itemUrl.style.display = "block";
    itemName.value = "";
    itemUrl.value = "https://";
    modal.style.display = "block";
  });

  // 模态框功能
  modalConfirm.addEventListener("click", () => {
    const name = itemName.value.trim();
    const url = itemUrl.value.trim();
    
    if (!name) {
      alert("名称不能为空");
      return;
    }
    
    if (modalTitle.textContent === "添加新书签" && !url) {
      alert("URL不能为空");
      return;
    }
    
    if (currentSelectedFolder) {
      if (modalTitle.textContent === "添加新文件夹") {
        // 添加文件夹
        if (!currentSelectedFolder.children) {
          currentSelectedFolder.children = [];
        }
        currentSelectedFolder.children.push({
          title: name,
          children: []
        });
      } else {
        // 添加书签
        if (!currentSelectedFolder.children) {
          currentSelectedFolder.children = [];
        }
        currentSelectedFolder.children.push({
          title: name,
          url: url
        });
      }
      
      // 保存到本地存储
      localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
      renderFullBookmarks(bookmarks.children);
      modal.style.display = "none";
    }
  });

  modalCancel.addEventListener("click", () => {
    modal.style.display = "none";
  });

  closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });

  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });

  // 书签项点击事件委托
  document.getElementById("bookmarkTree").addEventListener("click", (e) => {
    const menuItem = e.target.closest('.menu-item');
    if (menuItem && !menuItem.classList.contains('bookmark-link')) {
      const li = menuItem.parentElement;
      const isOpen = li.classList.contains("open");
      
      // 如果是文件夹，切换展开状态
      if (li.querySelector('.accordion-submenu')) {
        e.stopPropagation();
        const siblings = li.parentElement.children;
        Array.from(siblings).forEach((sib) => {
          if (sib !== li) sib.classList.remove("open");
        });

        if (isOpen) {
          li.classList.remove("open");
        } else {
          li.classList.add("open");
          currentSelectedFolder = findFolderByTitle(bookmarks, menuItem.textContent);
        }
      }
    }
    
    // 书签链接点击
    const bookmarkLink = e.target.closest('.bookmark-link');
    if (bookmarkLink && bookmarkLink.href) {
      e.preventDefault();
      window.open(bookmarkLink.href, "_blank");
    }
  });

  // 书签项右键菜单（用于编辑/删除）
  document.getElementById("bookmarkTree").addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const menuItem = e.target.closest('li');
    if (menuItem) {
      // 实现右键菜单逻辑（可以添加编辑/删除功能）
      console.log("右键点击:", menuItem);
    }
  });

  // 辅助函数：在书签树中查找文件夹
  function findFolderByTitle(node, title) {
    if (node.title === title && node.children) {
      return node;
    }
    
    if (node.children) {
      for (const child of node.children) {
        const found = findFolderByTitle(child, title);
        if (found) return found;
      }
    }
    
    return null;
  }

  // 辅助函数：搜索书签
  function searchBookmarks(node, keyword) {
    let results = [];
    
    if (node.title && node.title.toLowerCase().includes(keyword)) {
      results.push(node);
    }
    
    if (node.children) {
      for (const child of node.children) {
        results = results.concat(searchBookmarks(child, keyword));
      }
    }
    
    return results;
  }
});

// 渲染完整书签树
function renderFullBookmarks(bookmarkNodes) {
  const treeRoot = document.getElementById("bookmarkTree");
  if (!treeRoot) return;

  treeRoot.innerHTML = "";
  
  if (!bookmarkNodes || bookmarkNodes.length === 0) {
    treeRoot.innerHTML = "<li>暂无书签，请添加</li>";
    return;
  }

  const ul = document.createElement("ul");
  ul.className = "accordion-menu";

  bookmarkNodes.forEach((node) => {
    if (!node.title) return;

    const li = document.createElement("li");
    const a = document.createElement("a");
    a.textContent = node.title;
    li.classList.add("level-2");

    if (node.url) {
      // 书签项
      a.href = node.url;
      a.target = "_blank";
      a.classList.add("bookmark-link");

      const favicon = document.createElement("img");
      favicon.src = `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(node.url)}`;
      favicon.className = "favicon-icon";
      a.prepend(favicon);
    } else {
      // 文件夹
      a.classList.add("menu-item");
      
      if (node.children && node.children.length > 0) {
        const childUl = createBookmarkList(node.children, 3);
        li.appendChild(childUl);
      }
    }

    li.appendChild(a);
    ul.appendChild(li);
  });

  treeRoot.appendChild(ul);
}

// 渲染搜索结果
function renderSearchResults(results) {
  const treeRoot = document.getElementById("bookmarkTree");
  if (!treeRoot) return;

  treeRoot.innerHTML = "";

  if (results.length === 0) {
    treeRoot.innerHTML = "<li>没有找到匹配的书签</li>";
    return;
  }

  const ul = document.createElement("ul");
  ul.className = "accordion-menu";

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

    li.appendChild(a);
    ul.appendChild(li);
  });

  treeRoot.appendChild(ul);
}

// 创建书签列表（递归）
function createBookmarkList(bookmarkNodes, level = 2) {
  if (!bookmarkNodes) return null;

  const ul = document.createElement("ul");
  ul.className = level === 2 ? "accordion-menu" : "accordion-submenu";

  bookmarkNodes.forEach((node) => {
    if (!node.title) return;

    const li = document.createElement("li");
    const a = document.createElement("a");
    a.textContent = node.title;
    li.classList.add(`level-${level}`);

    if (node.url) {
      // 书签项
      a.href = node.url;
      a.target = "_blank";
      a.classList.add("bookmark-link");

      const favicon = document.createElement("img");
      favicon.src = `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(node.url)}`;
      favicon.className = "favicon-icon";
      a.prepend(favicon);
    } else {
      // 文件夹
      a.classList.add("menu-item");
      
      if (node.children && node.children.length > 0) {
        const childUl = createBookmarkList(node.children, level + 1);
        li.appendChild(childUl);
      }
    }

    li.appendChild(a);
    ul.appendChild(li);
  });

  return ul;
}

// 导出书签
function exportBookmarks(tree) {
  const json = JSON.stringify(tree, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bookmarks.json";
  a.click();
  URL.revokeObjectURL(url);
}
// 在import-export-bar部分添加HTML导入按钮
// 获取DOM元素
const importHtmlBtn = document.getElementById("import-html-btn");
const importJsonBtn = document.getElementById("import-json-btn");
const importFile = document.getElementById("import-file");

// HTML导入按钮点击事件
importHtmlBtn.addEventListener("click", () => {
  importFile.accept = ".html";
  importFile.click();
});

// JSON导入按钮点击事件
importJsonBtn.addEventListener("click", () => {
  importFile.accept = ".json";
  importFile.click();
});

// 修改文件导入处理逻辑
importFile.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      if (file.name.endsWith('.html')) {
        // 处理HTML书签文件
        const htmlContent = event.target.result;
        const importedBookmarks = parseChromeBookmarksHTML(htmlContent);
        
        if (importedBookmarks && Array.isArray(importedBookmarks.children)) {
          bookmarks = importedBookmarks;
          localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
          renderFullBookmarks(bookmarks.children);
          alert("HTML书签导入成功！");
        } else {
          alert("无效的书签HTML文件格式");
        }
      } else {
        // 处理JSON书签文件（原有逻辑）
        const importedBookmarks = JSON.parse(event.target.result);
        if (importedBookmarks && Array.isArray(importedBookmarks.children)) {
          bookmarks = importedBookmarks;
          localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
          renderFullBookmarks(bookmarks.children);
          alert("JSON书签导入成功！");
        } else {
          alert("无效的书签文件格式");
        }
      }
    } catch (error) {
      alert("解析书签文件时出错: " + error.message);
    }
  };
  
  if (file.name.endsWith('.html')) {
    reader.readAsText(file);
  } else {
    reader.readAsText(file);
  }
});

// Chrome书签HTML解析器
function parseChromeBookmarksHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  
  // 创建根书签对象
  const root = {
    title: "书签栏",
    children: []
  };
  
  // 解析DL列表
  function parseDL(dlElement, parent) {
    if (!dlElement) return;
    
    let currentFolder = null;
    let currentNode = null;
    
    // 遍历DL的子节点
    Array.from(dlElement.children).forEach(child => {
      if (child.tagName === 'DT') {
        const firstChild = child.firstElementChild;
        
        if (firstChild && firstChild.tagName === 'H3') {
          // 文件夹
          currentFolder = {
            title: firstChild.textContent,
            children: []
          };
          parent.children.push(currentFolder);
          currentNode = currentFolder;
        } 
        else if (firstChild && firstChild.tagName === 'A') {
          // 书签
          const bookmark = {
            title: firstChild.textContent,
            url: firstChild.getAttribute('href')
          };
          (currentFolder || parent).children.push(bookmark);
          currentNode = bookmark;
        }
      } 
      else if (child.tagName === 'DL' && currentNode) {
        // 子文件夹内容
        parseDL(child, currentNode);
      }
    });
  }
  
  // 查找所有顶级DL元素
  const dlElements = doc.querySelectorAll('body > dl, body > * > dl');
  dlElements.forEach(dl => {
    parseDL(dl, root);
  });
  
  return root;
}
