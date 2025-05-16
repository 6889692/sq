const fileInput = document.getElementById("bookmark-file");
const importBtn = document.getElementById("import-btn");
const bookmarkTree = document.getElementById("bookmarkTree");
const searchBox = document.querySelector(".search-box");
const searchIcon = document.querySelector(".search-icon");
const uploadBtn = document.getElementById("upload");
const exportBtn = document.getElementById("export-btn");

let rawJSON = "";

// ✅ 页面加载时自动尝试加载远程书签
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
  } catch (e) {
    alert("⚠️ 无法从 GitHub 加载书签，您可以点击“导入书签”手动上传。");
  }
});

// ✅ 导入本地 JSON 文件
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
    } catch (e) {
      alert("无效 JSON");
    }
  };
  reader.readAsText(file);
});

// 📂 渲染书签树（支持折叠）
function createBookmarkList(node, level) {
  const li = document.createElement("li");
  li.classList.add(`level-${level}`);

  if (node.children && node.children.length > 0) {
    li.classList.add("folder");

    const a = document.createElement("a");
    a.href = "javascript:void(0);";
    a.classList.add("menu-item");
    a.textContent = node.title || "(未命名)";
    setupFolderClick(li, a);
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
    icon.src = "https://www.google.com/s2/favicons?sz=32&domain_url=" + encodeURIComponent(node.url);
    icon.classList.add("favicon-icon");
    a.prepend(icon);
    li.appendChild(a);
  }

  return li;
}

// ✅ 折叠 + 滚动行为
function setupFolderClick(li, a) {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
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
  });
}

// 🔍 搜索
searchIcon.addEventListener("click", () => {
  searchIcon.style.display = "none";
  searchBox.style.display = "block";
  searchBox.focus();
});
searchBox.addEventListener("blur", () => {
  if (!searchBox.value) {
    searchBox.style.display = "none";
    searchIcon.style.display = "block";
  }
});
searchBox.addEventListener("input", () => {
  const keyword = searchBox.value.trim().toLowerCase();
  const links = bookmarkTree.querySelectorAll("a.bookmark-link, a.menu-item");
  links.forEach(link => {
    const match = link.textContent.toLowerCase().includes(keyword);
    link.parentElement.style.display = match ? "" : "none";
  });
});

// 🚀 上传书签到 GitHub
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

// 💾 导出为 JSON 文件
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
