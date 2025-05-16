document.addEventListener("DOMContentLoaded", () => {
    // 顶部栏元素
    const topBarTitle = document.querySelector(".top-bar-title");
    const searchIcon = document.querySelector(".search-icon");
    const searchBox = document.querySelector(".search-box");

    // 添加书签表单元素
    const addBookmarkForm = document.getElementById("add-bookmark-form");
    const newTitleInput = document.getElementById("new-title");
    const newUrlInput = document.getElementById("new-url");
    const addBtn = document.getElementById("add-btn");

    // 底部栏元素
    const exportBtn = document.getElementById("export-btn");
    const importBtn = document.getElementById("import-btn");

    // 书签树容器
    const bookmarkTree = document.getElementById("bookmarkTree");

    let bookmarks = loadBookmarks(); // 从 localStorage 加载书签

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

    // 搜索图标切换搜索框
    searchIcon.addEventListener("click", () => {
        searchIcon.style.display = "none";
        searchBox.style.display = "block";
        searchBox.focus();
        toggleTitleVisibility();
    });

    // 搜索框失去焦点时恢复搜索图标
    searchBox.addEventListener("blur", () => {
        if (!searchBox.value) {
            searchBox.style.display = "none";
            searchIcon.style.display = "block";
            toggleTitleVisibility();
        }
    });

    // 搜索功能
    searchBox.addEventListener("input", (e) => {
        const keyword = e.target.value.trim().toLowerCase();
        const results = searchBookmarks(bookmarks, keyword);
        renderBookmarks(results);
    });

    // 添加书签
    addBtn.addEventListener("click", () => {
        const title = newTitleInput.value.trim();
        const url = newUrlInput.value.trim();
        if (title && url) {
            addBookmark(bookmarks, title, url);
            saveBookmarks(bookmarks);
            renderBookmarks(bookmarks);
            newTitleInput.value = "";
            newUrlInput.value = "";
        }
    });

    // 导出书签
    exportBtn.addEventListener("click", () => {
        exportBookmarks(bookmarks);
    });

    // 导入书签
    importBtn.addEventListener("click", () => {
        importBookmarks();
    });

    // 初始渲染书签
    renderBookmarks(bookmarks);

    //  ---  数据操作函数  ---

    // 加载书签
    function loadBookmarks() {
        const storedBookmarks = localStorage.getItem("webBookmarks");
        return storedBookmarks ? JSON.parse(storedBookmarks) : [];
    }

    // 保存书签
    function saveBookmarks() {
        localStorage.setItem("webBookmarks", JSON.stringify(bookmarks));
    }

    // 添加书签
    function addBookmark(bookmarks, title, url, parentId = null) {
        const newBookmark = {
            id: generateId(),
            title: title,
            url: url,
            parentId: parentId,
        };
        bookmarks.push(newBookmark);
    }

    // 添加文件夹
    function addFolder(bookmarks, title, parentId = null) {
        const newFolder = {
            id: generateId(),
            title: title,
            children: [],
            parentId: parentId,
        };
        bookmarks.push(newFolder);
    }

    // 删除书签或文件夹
    function deleteBookmark(bookmarks, id) {
        const index = bookmarks.findIndex((b) => b.id === id);
        if (index !== -1) {
            bookmarks.splice(index, 1);
        }
    }

    // 搜索书签
    function searchBookmarks(bookmarks, keyword) {
        let results = [];

        function _search(items) {
            items.forEach((item) => {
                if (item.title.toLowerCase().includes(keyword)) {
                    results.push(item);
                }
                if (item.children) {
                    _search(item.children);
                }
            });
        }

        _search(bookmarks);
        return results;
    }

    //  ---  UI 渲染函数  ---

    function renderBookmarks(bookmarks, parentElement = bookmarkTree, level = 2, parentId = null) {
        parentElement.innerHTML = "";

        const ul = document.createElement("ul");
        ul.className = level === 2 ? "accordion-menu" : "accordion-submenu";

        bookmarks.forEach((item) => {
            if (item.parentId === parentId) {
                const li = document.createElement("li");
                li.classList.add(`level-${level}`);

                const a = document.createElement("a");
                a.textContent = item.title;

                if (item.url) {
                    a.href = item.url;
                    a.target = "_blank";
                    a.classList.add("bookmark-link");

                    const favicon = document.createElement("img");
                    favicon.src = `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(item.url)}`;
                    favicon.className = "favicon-icon";
                    a.prepend(favicon);
                } else {
                    a.classList.add("menu-item");
                    a.addEventListener("click", (e) => {
                        e.stopPropagation();
                        li.classList.toggle("open");
                    });
                }

                li.appendChild(a);
                ul.appendChild(li);

                if (item.children) {
                    renderBookmarks(item.children, li, level + 1, item.id);
                }
            }
        });

        parentElement.appendChild(ul);
    }

    //  ---  导出 / 导入  ---

    function exportBookmarks(bookmarks) {
        const json = JSON.stringify(bookmarks, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "web-bookmarks.json";
        a.click();
        URL.revokeObjectURL(url);
    }

    function importBookmarks() {
