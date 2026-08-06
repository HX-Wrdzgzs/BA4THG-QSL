"use strict";

const cardCatalog = [
  {
    id: "nanjing-second-bridge",
    title: "南京二桥航拍",
    category: "city",
    categoryLabel: "南京与航拍",
    format: "横版 A 面",
    thumbnail: "./图片/thumbs/nanjing-second-bridge.160e3b6c23bb.webp",
    image: "./图片/A面 南京二桥航拍.png",
    description: "以南京二桥航拍画面为主体的横版 QSL 卡面。",
  },
  {
    id: "nanjing-fourth-bridge-portrait",
    title: "南京四桥航拍 · 竖版",
    category: "city",
    categoryLabel: "南京与航拍",
    format: "竖版 A 面",
    thumbnail: "./图片/thumbs/nanjing-fourth-bridge-portrait.2451bc55f803.webp",
    image: "./图片/A面 南京四桥航拍 竖拍.png",
    description: "面向竖版构图制作的南京四桥航拍主题 QSL 卡面。",
  },
  {
    id: "nanjing-fourth-bridge-angle",
    title: "南京四桥航拍 · 斜拍",
    category: "city",
    categoryLabel: "南京与航拍",
    format: "横版 A 面",
    thumbnail: "./图片/thumbs/nanjing-fourth-bridge-angle.443a72433171.webp",
    image: "./图片/A面 南京四桥航拍 斜拍.png",
    description: "采用斜向航拍视角的南京四桥主题 QSL 卡面。",
  },
  {
    id: "mizuki-01",
    title: "晓山瑞希 · 第一款",
    category: "character",
    categoryLabel: "角色主题",
    format: "横版 A 面",
    thumbnail: "./图片/thumbs/mizuki-01.7b9cff704693.webp",
    image: "./图片/A面 mzk 1 2版.png",
    description: "晓山瑞希主题的第一款 QSL 卡面设计。",
  },
  {
    id: "mizuki-02",
    title: "晓山瑞希 · 第二款",
    category: "character",
    categoryLabel: "角色主题",
    format: "横版 A 面",
    thumbnail: "./图片/thumbs/mizuki-02.89fc8774eab8.webp",
    image: "./图片/A面 mzk 2 2版.png",
    description: "晓山瑞希主题的第二款 QSL 卡面设计。",
  },
  {
    id: "ena-01",
    title: "东云绘名 · 第一款",
    category: "character",
    categoryLabel: "角色主题",
    format: "横版 A 面",
    thumbnail: "./图片/thumbs/ena-01.077e4dcadedd.webp",
    image: "./图片/A面 ena 1 2版.png",
    description: "东云绘名主题的第一款 QSL 卡面设计。",
  },
  {
    id: "ena-02",
    title: "东云绘名 · 第二款",
    category: "character",
    categoryLabel: "角色主题",
    format: "横版 A 面",
    thumbnail: "./图片/thumbs/ena-02.c9dd5ab0bda5.webp",
    image: "./图片/A面 ena 2 2版.png",
    description: "东云绘名主题的第二款 QSL 卡面设计。",
  },
  {
    id: "kanade-01",
    title: "宵崎奏",
    category: "character",
    categoryLabel: "角色主题",
    format: "横版 A 面",
    thumbnail: "./图片/thumbs/kanade-01.66ad0aedb135.webp",
    image: "./图片/A面 knd 1 2版.png",
    description: "宵崎奏主题的 QSL 卡面设计。",
  },
  {
    id: "maimai-prism-plus",
    title: "maimai PRiSM PLUS",
    category: "rhythm",
    categoryLabel: "音游与特别款",
    format: "横版 A 面",
    thumbnail: "./图片/thumbs/maimai-prism-plus.e810fe8904c4.webp",
    image: "./图片/A面 maimai prism plus.png",
    description: "以 maimai PRiSM PLUS 为主题制作的 QSL 卡面。",
  },
  {
    id: "rll-quotes",
    title: "RLL 经典语录",
    category: "rhythm",
    categoryLabel: "音游与特别款",
    format: "横版 A 面",
    thumbnail: "./图片/thumbs/rll-quotes.bd5ce1849721.webp",
    image: "./图片/A面 RLL经典语录.png",
    description: "以 RLL 经典语录为主题的特别款 QSL 卡面。",
  },
  {
    id: "back-landscape",
    title: "QSL 横版 B 面",
    category: "back",
    categoryLabel: "B 面",
    format: "横版 B 面",
    thumbnail: "./图片/thumbs/back-landscape.5ced0fafa89e.webp",
    image: "./图片/QSL横版B面.png",
    description: "用于横版 QSL 卡片的通用背面信息版式。",
  },
  {
    id: "back-portrait",
    title: "QSL 竖版 B 面",
    category: "back",
    categoryLabel: "B 面",
    format: "竖版 B 面",
    thumbnail: "./图片/thumbs/back-portrait.e9221812affe.webp",
    image: "./图片/QSL竖版B面.png",
    description: "用于竖版 QSL 卡片的通用背面信息版式。",
  },
];

const grid = document.querySelector("[data-card-grid]");
const emptyState = document.querySelector("[data-empty-state]");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const dialog = document.querySelector("[data-card-dialog]");
const dialogImage = document.querySelector("[data-dialog-image]");
const dialogKicker = document.querySelector("[data-dialog-kicker]");
const dialogTitle = document.querySelector("[data-dialog-title]");
const dialogDescription = document.querySelector("[data-dialog-description]");
const dialogFormat = document.querySelector("[data-dialog-format]");
const dialogCategory = document.querySelector("[data-dialog-category]");
const dialogClose = document.querySelector("[data-dialog-close]");
const dialogPrev = document.querySelector("[data-dialog-prev]");
const dialogNext = document.querySelector("[data-dialog-next]");
const themeToggle = document.querySelector(".theme-toggle");
const themeLabel = document.querySelector("[data-theme-label]");
const themeMeta = document.querySelector('meta[name="theme-color"]');

let activeFilter = "all";
let visibleCards = [...cardCatalog];
let activeDialogIndex = 0;
let lastFocusedElement = null;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealObserver = reduceMotion
  ? null
  : new IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -36px" },
    );

function observeReveals(scope = document) {
  const elements = scope.querySelectorAll(".reveal:not(.is-visible)");

  for (const element of elements) {
    if (reduceMotion) {
      element.classList.add("is-visible");
    } else {
      revealObserver.observe(element);
    }
  }
}

function createCardElement(card, index) {
  const article = document.createElement("article");
  article.className = "card-item reveal";
  article.style.transitionDelay = `${Math.min(index, 5) * 45}ms`;

  const button = document.createElement("button");
  button.className = "card-button";
  button.type = "button";
  button.dataset.cardId = card.id;
  button.setAttribute("aria-label", `查看${card.title}大图`);

  const imageWrap = document.createElement("span");
  imageWrap.className = "card-image-wrap";

  const image = document.createElement("img");
  image.className = "card-image";
  image.src = card.thumbnail;
  image.alt = `${card.title} QSL 卡面`;
  image.loading = "lazy";
  image.decoding = "async";
  image.fetchPriority = "low";
  image.addEventListener("error", () => {
    imageWrap.classList.add("is-error");
    image.alt = `${card.title}图片加载失败`;
  });

  const viewLabel = document.createElement("span");
  viewLabel.className = "card-view-label";
  viewLabel.textContent = "查看卡面";

  const caption = document.createElement("span");
  caption.className = "card-caption";

  const title = document.createElement("strong");
  title.textContent = card.title;

  const meta = document.createElement("span");
  meta.textContent = `${card.categoryLabel} / ${card.format}`;

  imageWrap.append(image, viewLabel);
  caption.append(title, meta);
  button.append(imageWrap, caption);
  article.append(button);

  button.addEventListener("click", () => openDialog(card.id, button));

  return article;
}

function renderCards() {
  visibleCards = activeFilter === "all"
    ? [...cardCatalog]
    : cardCatalog.filter((card) => card.category === activeFilter);

  const fragment = document.createDocumentFragment();
  visibleCards.forEach((card, index) => fragment.append(createCardElement(card, index)));

  grid.replaceChildren(fragment);
  emptyState.hidden = visibleCards.length > 0;
  observeReveals(grid);
}

function setFilter(filter) {
  activeFilter = filter;

  for (const button of filterButtons) {
    const isActive = button.dataset.filter === filter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }

  renderCards();
}

function fillDialog(card) {
  dialogImage.fetchPriority = "high";
  dialogImage.src = card.image;
  dialogImage.alt = `${card.title} QSL 卡面大图`;
  dialogKicker.textContent = `BA4THG / ${card.format.toUpperCase()}`;
  dialogTitle.textContent = card.title;
  dialogDescription.textContent = card.description;
  dialogFormat.textContent = card.format;
  dialogCategory.textContent = card.categoryLabel;
}

function openDialog(cardId, trigger) {
  const index = visibleCards.findIndex((card) => card.id === cardId);
  if (index < 0) return;

  activeDialogIndex = index;
  lastFocusedElement = trigger;
  fillDialog(visibleCards[activeDialogIndex]);

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }

  dialogClose.focus();
}

function closeDialog() {
  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }

  if (lastFocusedElement instanceof HTMLElement) {
    lastFocusedElement.focus();
  }
}

function stepDialog(direction) {
  if (!visibleCards.length) return;
  activeDialogIndex = (activeDialogIndex + direction + visibleCards.length) % visibleCards.length;
  fillDialog(visibleCards[activeDialogIndex]);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeLabel.textContent = theme === "dark" ? "亮色" : "暗色";
  themeMeta.setAttribute("content", theme === "dark" ? "#0d0d0e" : "#f4f4f2");
}

function initializeTheme() {
  const savedTheme = localStorage.getItem("ba4thg-qsl-theme");
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  applyTheme(savedTheme === "dark" || savedTheme === "light" ? savedTheme : systemTheme);
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => setFilter(button.dataset.filter));
});

dialogClose.addEventListener("click", closeDialog);
dialogPrev.addEventListener("click", () => stepDialog(-1));
dialogNext.addEventListener("click", () => stepDialog(1));

dialog.addEventListener("click", (event) => {
  if (event.target === dialog) closeDialog();
});

dialog.addEventListener("close", () => {
  dialogImage.removeAttribute("src");
});

document.addEventListener("keydown", (event) => {
  if (!dialog.hasAttribute("open")) return;
  if (event.key === "ArrowLeft") stepDialog(-1);
  if (event.key === "ArrowRight") stepDialog(1);
});

themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  localStorage.setItem("ba4thg-qsl-theme", nextTheme);
});

document.querySelector("[data-front-count]").textContent = String(
  cardCatalog.filter((card) => card.category !== "back").length,
);
document.querySelector("[data-back-count]").textContent = String(
  cardCatalog.filter((card) => card.category === "back").length,
);

initializeTheme();
renderCards();
observeReveals();
