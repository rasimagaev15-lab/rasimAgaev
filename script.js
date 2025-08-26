// Конфигурация формы. Укажите сюда endpoint (например, Cloudflare Worker → Telegram)
const FORM_ENDPOINT = ""; // пример: "https://your-worker.workers.dev"

document.addEventListener("DOMContentLoaded", () => {
  initYear();
  initFilters();
  initViewSwitch();
  initLightbox();
  initSmoothScroll();
  initForm();
  // Глобальная загрузка для pages с гридом
  if (document.getElementById("workGrid")) {
    loadPortfolio({ targetId: "workGrid", limit: 0 });
  }
  if (document.getElementById("homeGrid")) {
    loadPortfolio({ targetId: "homeGrid", limit: 10, mixCategories: true });
    // Главная страница: всегда мозаика
    const hg = document.getElementById("homeGrid");
    if (hg) hg.classList.add("masonry");
  }
  // Детальная страница работы
  if (document.getElementById("workDetail")) {
    loadWorkDetail();
  }
  initHeroSlideshow();
  initAboutSlideshow();
});

function initYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

function initFilters() {
  const buttons = Array.from(document.querySelectorAll(".filter"));
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const filter = btn.dataset.filter;
      const cardsNow = Array.from(document.querySelectorAll(".card"));
      cardsNow.forEach((card) => {
        const show = filter === "all" || card.dataset.category === filter;
        card.style.display = show ? "block" : "none";
      });
    });
  });
}

function initViewSwitch() {
  const grid = document.getElementById("workGrid");
  if (!grid) return;
  const buttons = Array.from(document.querySelectorAll(".view"));
  const stored = localStorage.getItem("portfolioView");
  const prefer = stored || "masonry"; // по умолчанию мозаика
  if (prefer === "masonry") {
    toMasonry(grid, true);
  } else {
    fromMasonry(grid);
  }
  buttons.forEach((b) => b.classList.toggle("is-active", (b.dataset.view || "grid") === prefer));
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const view = btn.dataset.view;
      if (view === "masonry") {
        toMasonry(grid);
      } else {
        fromMasonry(grid);
      }
      localStorage.setItem("portfolioView", view || "grid");
    });
  });
}

function toMasonry(grid, initial=false) {
  // Убираем CSS Grid колонки, переключаемся на column layout
  grid.classList.add("masonry");
  if (!initial) {
    // Пересобрать DOM не требуется, но можно форснуть reflow
    void grid.offsetHeight;
  }
}

function fromMasonry(grid) {
  grid.classList.remove("masonry");
}

function initLightbox() {
  // Лайтбокс в гриде отключён, т.к. переход на страницу работы
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (!href) return;
      const id = href.slice(1);
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth" });
    });
  });
}

function initForm() {
  const form = document.getElementById("contactForm");
  if (!form) return;
  const status = document.getElementById("formStatus");
  const err = (name) => document.querySelector(`.error[data-for="${name}"]`);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Очистка ошибок
    ["name", "phone", "agree"].forEach((k) => err(k) && (err(k).textContent = ""));
    status.textContent = "";

    const formData = new FormData(form);
    // Honeypot против спама (скрытое поле)
    const trap = String(formData.get("website") || "").trim();
    if (trap) {
      // Тихо подтверждаем и выходим
      form.reset();
      status.textContent = "Спасибо!";
      return;
    }
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const agree = form.querySelector("#agree");

    let hasError = false;
    if (!name) { err("name").textContent = "Введите имя"; hasError = true; }
    if (!/^\+?\d[\d\s().-]{7,}$/.test(phone)) { err("phone").textContent = "Введите корректный телефон"; hasError = true; }
    if (!(agree && agree.checked)) { err("agree").textContent = "Необходимо согласие"; hasError = true; }
    if (hasError) return;

    // Отправка
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      if (FORM_ENDPOINT) {
        const resp = await fetch(FORM_ENDPOINT + `?t=${Date.now()}`, {
          method: "POST",
          headers: { "Accept": "application/json" },
          cache: "no-store",
          mode: "cors",
          body: formData,
        });
        if (!resp.ok) throw new Error("Ошибка сервера");
        form.reset();
        status.textContent = "Спасибо! Заявка отправлена.";
      } else {
        // Демонстрационный режим без сервера
        const payload = Object.fromEntries(formData.entries());
        console.log("Demo submit:", payload);
        localStorage.setItem("lastContactRequest", JSON.stringify({ ...payload, ts: Date.now() }));
        form.reset();
        status.textContent = "Готово! Мы свяжемся с вами (демо режим).";
      }
    } catch (e) {
      status.textContent = "Упс! Не удалось отправить. Попробуйте позже.";
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

// ===== Dynamic portfolio loader (from single JSON) =====
async function loadPortfolio(options = {}) {
  const targetId = options.targetId || "workGrid";
  const grid = document.getElementById(targetId);
  if (!grid) return;

  // Грузим единый JSON
  let items = [];
  try {
    const resp = await fetch('data/works.json', { cache: 'no-store' });
    items = await resp.json();
  } catch (e) {
    console.warn('Не удалось загрузить data/works.json', e);
  }

  const cards = items.map((it) => ({
    category: it.category || 'other',
    dir: '',
    meta: it,
  }));

  // Если нужен перемешанный набор по категориям
  if (options.mixCategories && options.limit && options.limit > 0) {
    // Группируем по категориям
    const byCat = new Map();
    for (const c of cards) {
      if (!byCat.has(c.category)) byCat.set(c.category, []);
      byCat.get(c.category).push(c);
    }
    // Равномерная выборка по кругам до лимита
    const picked = [];
    const catKeys = Array.from(byCat.keys());
    let idx = 0;
    while (picked.length < options.limit) {
      const key = catKeys[idx % catKeys.length];
      const arr = byCat.get(key);
      if (arr && arr.length) {
        picked.push(arr.shift());
      }
      // Если все массивы пустые, прекращаем
      if (byCat.size === 0 || catKeys.every(k => (byCat.get(k) || []).length === 0)) break;
      idx++;
    }
    renderCards(grid, picked);
    return;
  }

  // Обрезаем до лимита если надо
  if (options.limit && options.limit > 0) {
    renderCards(grid, cards.slice(0, options.limit));
  } else {
    renderCards(grid, cards);
  }
}

function renderCards(grid, cards) {
  const fragment = document.createDocumentFragment();
  for (const card of cards) {
    const figure = document.createElement("figure");
    figure.className = "card";
    figure.dataset.category = card.category;

    const img = document.createElement("img");
    img.loading = "lazy";
    const full = card.meta.cover || "";
    const hasThumb = !!card.meta.thumb;
    const thumb = hasThumb ? card.meta.thumb : full;
    img.src = thumb;
    img.dataset.src = full;
    img.decoding = "async";
    img.className = "img-fade" + (hasThumb ? " img-blur" : "");
    img.alt = card.meta.alt || card.meta.title || "Работа";

    // Ссылка на детальную страницу
    const link = document.createElement("a");
    link.href = `work.html?id=${encodeURIComponent(card.meta.id)}`;
    link.setAttribute("aria-label", (card.meta.title || "Работа") + " — открыть страницу работы");
    link.style.display = "block";
    link.appendChild(img);

    const figcaption = document.createElement("figcaption");
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = card.meta.title || "Без названия";
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = card.meta.material ? `${card.meta.material}${card.meta.year ? ` • ${card.meta.year}` : ""}` : (card.meta.year || "");
    const desc = document.createElement("p");
    desc.className = "desc";
    desc.textContent = card.meta.description || "Описание будет добавлено позже.";
    figcaption.appendChild(title);
    figcaption.appendChild(meta);
    figcaption.appendChild(desc);

    figure.appendChild(link);
    figure.appendChild(figcaption);
    fragment.appendChild(figure);
  }

  grid.appendChild(fragment);

  // Ленивая замена превью на полноразмерные с IntersectionObserver
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const image = entry.target;
      const src = image.dataset.src;
      if (src && image.src !== src) {
        const swap = new Image();
        swap.src = src;
        swap.onload = () => {
          image.src = src;
          image.classList.add("is-loaded");
          image.classList.remove("img-blur");
        };
      } else {
        image.classList.add("is-loaded");
      }
      obs.unobserve(image);
    });
  }, { rootMargin: "200px 0px" });

  grid.querySelectorAll('img[loading="lazy"]').forEach((im) => io.observe(im));
}

// ===== Work detail page =====
function getParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name) || "";
}

async function loadWorkDetail() {
  const container = document.getElementById("workDetail");
  const titleEl = document.getElementById("workTitle");
  const metaEl = document.getElementById("workMeta");
  const descEl = document.getElementById("workDesc");
  const galleryEl = document.getElementById("workGallery");
  if (!container || !galleryEl) return;
  const id = getParam("id");
  if (!id) return;
  try {
    const list = await fetch('data/works.json', { cache: 'no-store' }).then(r => r.json());
    const meta = list.find(x => String(x.id) === String(id));
    titleEl && (titleEl.textContent = meta.title || "Работа");
    metaEl && (metaEl.textContent = meta.material ? `${meta.material}${meta.year ? ` • ${meta.year}` : ''}` : (meta.year || ''));
    descEl && (descEl.textContent = meta.description || "");

    const images = Array.isArray(meta.images) && meta.images.length ? meta.images : [meta.cover];
    const fragment = document.createDocumentFragment();
    for (const file of images) {
      const href = file;
      const a = document.createElement('a');
      a.href = href;
      a.className = 'glightbox';
      a.dataset.gallery = 'work';
      const im = document.createElement('img');
      im.loading = 'lazy';
      im.decoding = 'async';
      im.src = href;
      im.alt = meta.alt || meta.title || 'Изображение работы';
      a.appendChild(im);
      fragment.appendChild(a);
    }
    galleryEl.appendChild(fragment);

    if (typeof GLightbox !== 'undefined') {
      GLightbox({ selector: '.glightbox', loop: true, touchNavigation: true, zoomable: true });
    }
  } catch (e) {
    container.textContent = 'Не удалось загрузить работу.';
  }
}

function initHeroSlideshow() {
  const slideA = document.getElementById('heroSlideA');
  const slideB = document.getElementById('heroSlideB');
  if (!slideA || !slideB) return;

  fetch('data/works.json', { cache: 'no-store' }).then(r => r.json()).then(async (list) => {
    const pool = [];
    for (const it of list) {
      const imgPath = it.thumb || it.cover;
      if (!imgPath) continue;
      const dimOk = await new Promise((resolve) => {
        const im = new Image();
        im.src = imgPath;
        im.onload = () => resolve(im.naturalWidth > im.naturalHeight);
        im.onerror = () => resolve(false);
      });
      if (dimOk) pool.push(imgPath);
    }
    if (!pool.length) return;

    const uniq = Array.from(new Set(pool));
    uniq.sort(() => Math.random() - 0.5);
    let i = 0;
    const setSrc = (img, src) => { img.src = src; img.decoding = 'async'; img.loading = 'eager'; };
    setSrc(slideA, uniq[i % uniq.length]); i++;
    setSrc(slideB, uniq[i % uniq.length]); i++;
    let showA = true;
    const tick = () => {
      const next = uniq[i % uniq.length]; i++;
      if (showA) { setSrc(slideB, next); slideB.classList.add('is-active'); slideA.classList.remove('is-active'); }
      else { setSrc(slideA, next); slideA.classList.add('is-active'); slideB.classList.remove('is-active'); }
      showA = !showA;
    };
    setInterval(tick, 6000);
  }).catch(() => {});
}

function initAboutSlideshow() {
  const slideA = document.getElementById('aboutSlideA');
  const slideB = document.getElementById('aboutSlideB');
  if (!slideA || !slideB) return;

  fetch('data/works.json', { cache: 'no-store' }).then(r => r.json()).then(async (list) => {
    const pool = [];
    for (const it of list) {
      const imgPath = it.thumb || it.cover;
      if (!imgPath) continue;
      pool.push(imgPath);
    }
    if (!pool.length) return;
    const uniq = Array.from(new Set(pool));
    uniq.sort(() => Math.random() - 0.5);
    let i = 0;
    const setSrc = (img, src) => { img.src = src; img.decoding = 'async'; };
    setSrc(slideA, uniq[i % uniq.length]); i++;
    setSrc(slideB, uniq[i % uniq.length]); i++;
    let showA = true;
    const tick = () => {
      const next = uniq[i % uniq.length]; i++;
      if (showA) { setSrc(slideB, next); slideB.classList.add('is-active'); slideA.classList.remove('is-active'); }
      else { setSrc(slideA, next); slideA.classList.add('is-active'); slideB.classList.remove('is-active'); }
      showA = !showA;
    };
    setInterval(tick, 9000);
  }).catch(() => {});
}

