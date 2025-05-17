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
    icon.src = FaviconLoader.getFaviconUrl(node.url); // 直接设置 src
    icon.classList.add("favicon-icon");
    a.prepend(icon);
    li.appendChild(a);
  }

  return li;
}
