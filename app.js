/* ============================================================
   بیان قرآن — application logic
   ============================================================ */
(() => {
  "use strict";

  /* ---------------- helpers ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
  const faNum = (v) => String(v).replace(/\d/g, (d) => FA_DIGITS[+d]);

  const normalize = (s) =>
    String(s)
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u06DF-\u06E8]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ی")
      .replace(/ي/g, "ی")
      .replace(/ك/g, "ک")
      .replace(/ة/g, "ه")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  let META = window.QURAN_META;
  let FULL = window.QURAN_FULL;

  /* ---------------- state ---------------- */
  const LS_KEY = "bayanquran-v1";
  const state = {
    theme: "dark",
    fontScale: 1,
    showTr: true,
    autoNext: true,
    reciter: "ar.alafasy",
    bookmarks: [], // {s, a, t}
    lastRead: null, // {s, a}
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) Object.assign(state, JSON.parse(raw));
    } catch (_) { /* ignore */ }
  }
  function saveState() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (_) { /* ignore */ }
  }

  /* ---------------- toasts ---------------- */
  const toastWrap = $("#toast-wrap");
  function toast(msg) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    toastWrap.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(10px)";
      setTimeout(() => el.remove(), 350);
    }, 2600);
  }

  /* ---------------- daily verse ---------------- */
  const DAILY = [
    [2, 255], [24, 35], [13, 28], [94, 5], [65, 3], [39, 53], [2, 286], [20, 114],
    [55, 13], [31, 17], [3, 139], [47, 7], [29, 69], [76, 3], [103, 3], [8, 2],
    [57, 20], [112, 1], [1, 5], [30, 21], [59, 24], [23, 118], [2, 152], [16, 90],
  ];
  function todayVerse() {
    const d = new Date();
    const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
    return DAILY[doy % DAILY.length];
  }

  /* ---------------- surah helpers ---------------- */
  const surah = (n) => META.surahs[n - 1];
  const ayahText = (s, a) => FULL[String(s)][a - 1];
  const isBookmarked = (s, a) => state.bookmarks.some((b) => b.s === s && b.a === a);

  function toggleBookmark(s, a) {
    const i = state.bookmarks.findIndex((b) => b.s === s && b.a === a);
    if (i >= 0) {
      state.bookmarks.splice(i, 1);
      toast("از نشان‌شده‌ها حذف شد");
    } else {
      state.bookmarks.unshift({ s, a, t: Date.now() });
      toast("به نشان‌شده‌ها اضافه شد");
    }
    saveState();
    syncBookmarkUI(s, a);
  }

  function syncBookmarkUI(s, a) {
    const active = isBookmarked(s, a);
    $$(`[data-bm-s="${s}"][data-bm-a="${a}"]`).forEach((btn) => btn.classList.toggle("active", active));
    updateBmBadge();
  }

  function updateBmBadge() {
    const badge = $("#bm-badge");
    if (state.bookmarks.length) {
      badge.hidden = false;
      badge.textContent = faNum(state.bookmarks.length);
    } else {
      badge.hidden = true;
    }
  }

  /* ---------------- audio ---------------- */
  const audio = $("#audio");
  const player = $("#player");
  let playing = { s: 0, a: 0 };
  let wantedAuto = false;
  let audioWarned = false;

  const ayahUrl = (s, a) =>
    `https://cdn.islamic.network/quran/audio/128/${state.reciter}/${META.offsets[String(s)] + a - 1}.mp3`;

  function markPlayingRow() {
    $$(".ayah.playing").forEach((el) => el.classList.remove("playing"));
    const row = $(`#ayah-${playing.a}`);
    if (row && currentSurah === playing.s) {
      row.classList.add("playing");
    }
  }

  function updatePlayerUI() {
    if (!playing.s) return;
    const meta = surah(playing.s);
    $("#player-title").textContent = `سوره‌ی ${meta.fa}`;
    $("#player-sub").textContent = `آیه‌ی ${faNum(playing.a)} از ${faNum(meta.a)} • ${reciterName(state.reciter)}`;
    player.hidden = false;
  }

  function playAyah(s, a, auto = false) {
    if (a < 1 || a > surah(s).a) return;
    playing = { s, a };
    wantedAuto = auto;
    audio.src = ayahUrl(s, a);
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
    player.classList.add("playing");
    updatePlayerUI();
    markPlayingRow();
  }

  function pauseAudio() {
    audio.pause();
    player.classList.remove("playing");
    $$(".ayah.playing").forEach((el) => el.classList.remove("playing"));
  }

  function resumeAudio() {
    if (!playing.s) return;
    if (!audio.src) {
      playAyah(playing.s, playing.a, wantedAuto);
    } else {
      audio.play().catch(() => {});
      player.classList.add("playing");
      markPlayingRow();
    }
  }

  audio.addEventListener("ended", () => {
    const meta = surah(playing.s);
    if (wantedAuto && state.autoNext && playing.a < meta.a) {
      playAyah(playing.s, playing.a + 1, true);
    } else {
      wantedAuto = false;
      pauseAudio();
    }
  });
  audio.addEventListener("error", () => {
    if (!audioWarned) {
      audioWarned = true;
      toast("پخش صوت ممکن نشد؛ اتصال اینترنت را بررسی کنید");
    }
    player.classList.remove("playing");
    $$(".ayah.playing").forEach((el) => el.classList.remove("playing"));
  });

  function reciterName(id) {
    return {
      "ar.alafasy": "مشاری العفاسی",
      "ar.husary": "محمود الحصري",
      "ar.minshawi": "محمد صدیق المنشاوی",
      "ar.abdulbasitmurattal": "عبدالباسط عبدالصمد",
      "ar.mahermuaiqly": "ماهر المعيقلي",
    }[id] || id;
  }

  /* ---------------- copy ---------------- */
  function copyAyah(s, a) {
    const [ar, faT] = ayahText(s, a);
    const meta = surah(s);
    const text = `${ar}\n\n${faT}\n\n(سوره‌ی ${meta.fa} — آیه‌ی ${faNum(a)}) | بیان قرآن`;
    const done = () => toast("متن آیه کپی شد ✓");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (_) { toast("کپی ممکن نشد"); }
    ta.remove();
  }

  /* ---------------- views / router ---------------- */
  const views = {
    home: $("#view-home"),
    surah: $("#view-surah"),
    bookmarks: $("#view-bookmarks"),
  };
  let currentSurah = 0;

  function showView(name) {
    Object.entries(views).forEach(([k, el]) => { el.hidden = k !== name; });
  }

  function showHome(anchor) {
    currentSurah = 0;
    showView("home");
    document.title = "بیان قرآن | مطالعه، تلاوت و ترجمه‌ی قرآن کریم";
    if (anchor) {
      const el = $(anchor);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function route() {
    const h = location.hash || "#/";
    if (h.startsWith("#/surah/")) {
      const parts = h.split("/"); // #, surah, n, a?
      const s = parseInt(parts[2], 10);
      const a = parts[3] ? parseInt(parts[3], 10) : null;
      if (s >= 1 && s <= 114) openSurah(s, a);
      else showHome();
    } else if (h === "#/bookmarks") {
      openBookmarksView();
    } else if (h.startsWith("#/") ) {
      showHome();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      // in-page anchors: #surahs, #daily, #features, #home
      showHome(h.length > 1 ? h : null);
    }
  }
  window.addEventListener("hashchange", route);

  /* ---------------- hero + daily ---------------- */
  function renderHeroVerse() {
    const [s, a] = todayVerse();
    const meta = surah(s);
    const [ar, faT] = ayahText(s, a);
    $("#hv-ref").textContent = `سوره‌ی ${meta.fa} • آیه‌ی ${faNum(a)}`;
    $("#hv-ar").textContent = ar;
    $("#hv-fa").textContent = faT;
    $("#hv-open").href = `#/surah/${s}/${a}`;
    $("#hv-play").onclick = () => playAyah(s, a, true);
    $("#hv-copy").onclick = () => copyAyah(s, a);
    const bm = $("#hv-bookmark");
    bm.dataset.bmS = s; bm.dataset.bmA = a;
    bm.classList.toggle("active", isBookmarked(s, a));
    bm.onclick = () => toggleBookmark(s, a);

    $("#daily-ref").textContent = `سوره‌ی ${meta.fa} — آیه‌ی ${faNum(a)}`;
    $("#daily-type").textContent = `${meta.t} • ${faNum(meta.a)} آیه`;
    $("#daily-ar").textContent = ar;
    $("#daily-fa").textContent = faT;
    $("#daily-open").href = `#/surah/${s}/${a}`;
    $("#daily-play").onclick = () => playAyah(s, a, true);
    $("#daily-copy").onclick = () => copyAyah(s, a);
    const dbm = $("#daily-bookmark");
    dbm.dataset.bmS = s; dbm.dataset.bmA = a;
    dbm.classList.toggle("active", isBookmarked(s, a));
    dbm.onclick = () => toggleBookmark(s, a);
  }

  function updateContinueBtn() {
    const label = $("#continue-label");
    if (state.lastRead && state.lastRead.s >= 1 && state.lastRead.s <= 114) {
      const m = surah(state.lastRead.s);
      label.textContent = `ادامه‌ی مطالعه: ${m.fa}، آیه‌ی ${faNum(state.lastRead.a || 1)}`;
    } else {
      label.textContent = "شروع مطالعه";
    }
  }
  $("#btn-continue").addEventListener("click", () => {
    const lr = state.lastRead;
    if (lr && lr.s >= 1 && lr.s <= 114) location.hash = `#/surah/${lr.s}/${lr.a || 1}`;
    else location.hash = "#/surah/1";
  });

  /* ---------------- surah grid ---------------- */
  const grid = $("#surah-grid");
  let filterMode = "all";
  let query = "";

  function renderGrid() {
    const q = normalize(query);
    const list = META.surahs.filter((s) => {
      if (filterMode === "meccan" && s.t !== "مکی") return false;
      if (filterMode === "medinan" && s.t !== "مدنی") return false;
      if (!q) return true;
      return (
        normalize(s.fa).includes(q) ||
        normalize(s.ar).includes(q) ||
        normalize(s.en).includes(q) ||
        normalize(s.tr).includes(q) ||
        String(s.n) === q ||
        faNum(s.n) === query.trim()
      );
    });

    $("#surah-count").textContent = `${faNum(list.length)} سوره نمایش داده شد`;

    if (!list.length) {
      grid.innerHTML = `<div class="empty-state glass"><b>سوره‌ای پیدا نشد</b>
        عبارت دیگری را امتحان کنید؛ مثلاً نام سوره یا شماره‌ی آن.</div>`;
      return;
    }

    grid.innerHTML = list
      .map(
        (s) => `
      <article class="glass surah-card" data-surah="${s.n}" tabindex="0" role="button"
        aria-label="سوره‌ی ${s.fa}">
        <div class="surah-num"><span>${faNum(s.n)}</span></div>
        <div class="surah-info">
          <div class="fa-name">${s.fa}</div>
          <div class="ar-name">${s.ar}</div>
          <div class="meta">${s.t} • ${faNum(s.a)} آیه • ${s.en}</div>
        </div>
      </article>`
      )
      .join("");
  }

  grid.addEventListener("click", (e) => {
    const card = e.target.closest("[data-surah]");
    if (card) location.hash = `#/surah/${card.dataset.surah}`;
  });
  grid.addEventListener("keydown", (e) => {
    const card = e.target.closest("[data-surah]");
    if (card && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      location.hash = `#/surah/${card.dataset.surah}`;
    }
  });

  function bindSearch(input) {
    input.addEventListener("input", () => {
      query = input.value;
      if (views.home.hidden) {
        location.hash = "#surahs";
        setTimeout(() => $("#surahs").scrollIntoView({ behavior: "smooth" }), 60);
      }
      renderGrid();
    });
  }
  bindSearch($("#search-hero"));
  bindSearch($("#search-surahs"));

  $("#filter-chips").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    filterMode = btn.dataset.filter;
    $$("#filter-chips .filter-chip").forEach((b) => b.classList.toggle("active", b === btn));
    renderGrid();
  });

  /* ---------------- surah reader ---------------- */
  function openSurah(n, focusAyah) {
    currentSurah = n;
    showView("surah");
    const m = surah(n);
    document.title = `سوره‌ی ${m.fa} | بیان قرآن`;

    $("#reader-num").innerHTML = `<span>${faNum(n)}</span>`;
    $("#reader-name").textContent = m.ar;
    $("#reader-meta").textContent = `نام فارسی: ${m.fa} — ${m.t} — ${faNum(m.a)} آیه — ${m.en}`;

    $("#reader-bismillah").style.display = n === 9 ? "none" : "";

    const rows = FULL[String(n)]
      .map(([ar, faT], i) => {
        const a = i + 1;
        return `
        <article class="glass ayah" id="ayah-${a}" data-a="${a}">
          <div class="ayah-num"><span>${faNum(a)}</span></div>
          <div class="ayah-body">
            <p class="ayah-ar">${ar}</p>
            <p class="ayah-fa">${faT}</p>
            <div class="ayah-tools">
              <button class="chip-btn" data-act="play" data-a="${a}">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg> تلاوت
              </button>
              <button class="chip-btn" data-act="copy" data-a="${a}">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> کپی
              </button>
              <button class="chip-btn ${isBookmarked(n, a) ? "active" : ""}" data-act="bm" data-a="${a}" data-bm-s="${n}" data-bm-a="${a}">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> نشان
              </button>
            </div>
          </div>
        </article>`;
      })
      .join("");
    $("#ayah-list").innerHTML = rows;

    // pager
    const prev = $("#pager-prev");
    const next = $("#pager-next");
    prev.textContent = n > 1 ? `سوره‌ی ${surah(n - 1).fa} ←` : "شروع مصحف";
    next.textContent = n < 114 ? `→ سوره‌ی ${surah(n + 1).fa}` : "پایان مصحف";
    $("#reader-prev").disabled = n <= 1;
    $("#reader-next").disabled = n >= 114;

    markPlayingRow();

    if (focusAyah && focusAyah >= 1 && focusAyah <= m.a) {
      state.lastRead = { s: n, a: focusAyah };
      saveState();
      updateContinueBtn();
      setTimeout(() => {
        const row = $(`#ayah-${focusAyah}`);
        if (row) {
          row.scrollIntoView({ behavior: "smooth", block: "center" });
          row.classList.add("flash");
          setTimeout(() => row.classList.remove("flash"), 1800);
        }
      }, 120);
    } else {
      state.lastRead = { s: n, a: state.lastRead && state.lastRead.s === n ? state.lastRead.a : 1 };
      saveState();
      updateContinueBtn();
      window.scrollTo(0, 0);
    }
  }

  $("#ayah-list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn || !currentSurah) return;
    const a = parseInt(btn.dataset.a, 10);
    const act = btn.dataset.act;
    if (act === "play") {
      wantedAuto = true;
      playAyah(currentSurah, a, true);
    } else if (act === "copy") {
      copyAyah(currentSurah, a);
    } else if (act === "bm") {
      toggleBookmark(currentSurah, a);
    }
  });

  $("#reader-back").addEventListener("click", () => {
    location.hash = "#surahs";
    setTimeout(() => $("#surahs").scrollIntoView({ behavior: "smooth" }), 60);
  });
  $("#reader-play").addEventListener("click", () => {
    wantedAuto = true;
    playAyah(currentSurah, 1, true);
  });
  $("#reader-prev").addEventListener("click", () => { if (currentSurah > 1) location.hash = `#/surah/${currentSurah - 1}`; });
  $("#reader-next").addEventListener("click", () => { if (currentSurah < 114) location.hash = `#/surah/${currentSurah + 1}`; });
  $("#pager-prev").addEventListener("click", () => {
    if (currentSurah > 1) location.hash = `#/surah/${currentSurah - 1}`;
    else location.hash = "#surahs";
  });
  $("#pager-next").addEventListener("click", () => {
    if (currentSurah < 114) location.hash = `#/surah/${currentSurah + 1}`;
    else location.hash = "#surahs";
  });
  $("#pager-home").addEventListener("click", () => {
    location.hash = "#surahs";
    setTimeout(() => $("#surahs").scrollIntoView({ behavior: "smooth" }), 60);
  });

  $("#reader-font-plus").addEventListener("click", () => setFontScale(state.fontScale + 0.1));
  $("#reader-font-minus").addEventListener("click", () => setFontScale(state.fontScale - 0.1));
  $("#reader-toggle-tr").addEventListener("click", () => {
    state.showTr = !state.showTr;
    applySettings();
    saveState();
  });

  /* ---------------- bookmarks view + panel ---------------- */
  function renderBookmarks(container, compact) {
    if (!state.bookmarks.length) {
      container.innerHTML = `<div class="panel-empty">هنوز آیه‌ای نشان‌گذاری نکرده‌اید.<br>
        در هر آیه، دکمه‌ی «نشان» را بزنید تا اینجا ذخیره شود.</div>`;
      return;
    }
    container.innerHTML = state.bookmarks
      .map((b, idx) => {
        const m = surah(b.s);
        const [ar, faT] = ayahText(b.s, b.a);
        if (compact) {
          return `
          <div class="panel-bm-item" data-jump-s="${b.s}" data-jump-a="${b.a}">
            <div class="ref">سوره‌ی ${m.fa} • آیه‌ی ${faNum(b.a)}</div>
            <div class="snippet">${ar}</div>
          </div>`;
        }
        return `
        <article class="glass bm-card">
          <div class="bm-main" data-jump-s="${b.s}" data-jump-a="${b.a}">
            <span class="bm-ref">سوره‌ی ${m.fa} • آیه‌ی ${faNum(b.a)}</span>
            <p class="bm-ar">${ar}</p>
            <p class="bm-fa">${faT}</p>
          </div>
          <div class="bm-side">
            <button class="chip-btn" data-jump-s="${b.s}" data-jump-a="${b.a}">مشاهده</button>
            <button class="chip-btn" data-remove-idx="${idx}">حذف</button>
          </div>
        </article>`;
      })
      .join("");
  }

  function openBookmarksView() {
    showView("bookmarks");
    document.title = "نشان‌شده‌ها | بیان قرآن";
    renderBookmarks($("#bm-list"), false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $("#bm-list").addEventListener("click", (e) => {
    const jump = e.target.closest("[data-jump-s]");
    if (jump) {
      location.hash = `#/surah/${jump.dataset.jumpS}/${jump.dataset.jumpA}`;
      return;
    }
    const rm = e.target.closest("[data-remove-idx]");
    if (rm) {
      state.bookmarks.splice(parseInt(rm.dataset.removeIdx, 10), 1);
      saveState();
      updateBmBadge();
      renderBookmarks($("#bm-list"), false);
      toast("از نشان‌شده‌ها حذف شد");
    }
  });

  /* ---------------- panels ---------------- */
  const scrim = $("#scrim");
  function openPanel(id) {
    closePanels(true);
    if (id === "panel-bookmarks") renderBookmarks($("#panel-bm-list"), true);
    $(id.startsWith("#") ? id : `#${id}`).hidden = false;
    scrim.hidden = false;
  }
  function closePanels(keepScrim = false) {
    $("#panel-bookmarks").hidden = true;
    $("#panel-settings").hidden = true;
    if (!keepScrim) scrim.hidden = true;
  }
  scrim.addEventListener("click", () => closePanels());
  $$("[data-close-panel]").forEach((b) => b.addEventListener("click", () => closePanels()));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closePanels();
      $("#mobile-menu").hidden = true;
    }
  });
  $("#btn-bookmarks").addEventListener("click", () => openPanel("panel-bookmarks"));
  $("#btn-settings").addEventListener("click", () => openPanel("panel-settings"));
  $("#panel-bm-list").addEventListener("click", (e) => {
    const jump = e.target.closest("[data-jump-s]");
    if (jump) {
      closePanels();
      location.hash = `#/surah/${jump.dataset.jumpS}/${jump.dataset.jumpA}`;
    }
  });

  /* ---------------- settings ---------------- */
  function setFontScale(v) {
    state.fontScale = Math.min(1.35, Math.max(0.85, Math.round(v * 100) / 100));
    applySettings();
    saveState();
  }
  function applySettings() {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.style.setProperty("--font-scale", state.fontScale);
    document.documentElement.classList.toggle("hide-translation", !state.showTr);
    $("#font-val").textContent = `${faNum(Math.round(state.fontScale * 100))}٪`;
    $("#set-font").value = Math.round(state.fontScale * 100);
    $("#set-reciter").value = state.reciter;
    $$("#seg-theme button").forEach((b) =>
      b.classList.toggle("active", b.dataset.themeVal === state.theme)
    );
    $("#sw-tr").classList.toggle("active", state.showTr);
    $("#sw-tr").setAttribute("aria-checked", String(state.showTr));
    $("#sw-auto").classList.toggle("active", state.autoNext);
    $("#sw-auto").setAttribute("aria-checked", String(state.autoNext));
  }
  $("#seg-theme").addEventListener("click", (e) => {
    const b = e.target.closest("[data-theme-val]");
    if (!b) return;
    state.theme = b.dataset.themeVal;
    applySettings();
    saveState();
  });
  $("#btn-theme").addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applySettings();
    saveState();
  });
  $("#set-reciter").addEventListener("change", (e) => {
    state.reciter = e.target.value;
    saveState();
    if (playing.s) playAyah(playing.s, playing.a, wantedAuto);
    toast(`قاری: ${reciterName(state.reciter)}`);
  });
  $("#set-font").addEventListener("input", (e) => setFontScale(parseInt(e.target.value, 10) / 100));
  $("#sw-tr").addEventListener("click", () => {
    state.showTr = !state.showTr;
    applySettings();
    saveState();
  });
  $("#sw-auto").addEventListener("click", () => {
    state.autoNext = !state.autoNext;
    applySettings();
    saveState();
  });

  /* ---------------- mini player ---------------- */
  $("#player-toggle").addEventListener("click", () => {
    if (audio.paused) resumeAudio();
    else pauseAudio();
  });
  $("#player-close").addEventListener("click", () => {
    pauseAudio();
    playing = { s: 0, a: 0 };
    wantedAuto = false;
    player.hidden = true;
  });
  $("#player-prev").addEventListener("click", () => {
    if (!playing.s) return;
    if (playing.a > 1) playAyah(playing.s, playing.a - 1, wantedAuto);
    else if (playing.s > 1) playAyah(playing.s - 1, surah(playing.s - 1).a, wantedAuto);
  });
  $("#player-next").addEventListener("click", () => {
    if (!playing.s) return;
    if (playing.a < surah(playing.s).a) playAyah(playing.s, playing.a + 1, wantedAuto);
    else if (playing.s < 114) playAyah(playing.s + 1, 1, wantedAuto);
  });

  /* ---------------- nav / menu ---------------- */
  const nav = $("#nav");
  window.addEventListener("scroll", () => {
    nav.classList.toggle("scrolled", window.scrollY > 24);
  }, { passive: true });

  $("#btn-menu").addEventListener("click", () => {
    const menu = $("#mobile-menu");
    menu.hidden = !menu.hidden;
  });
  $("#mobile-menu").addEventListener("click", (e) => {
    if (e.target.closest("a")) $("#mobile-menu").hidden = true;
  });

  /* ---------------- boot ---------------- */
  let bootTries = 0;
  function boot() {
    META = window.QURAN_META;
    FULL = window.QURAN_FULL;
    if (!META || !FULL) {
      if (bootTries++ < 20) return setTimeout(boot, 150); // wait for data scripts
      $("#loader .loader-text").textContent = "خطا در بارگذاری داده‌های قرآن؛ صفحه را نوسازی کنید.";
      return;
    }
    loadState();
    applySettings();
    renderHeroVerse();
    renderGrid();
    updateBmBadge();
    updateContinueBtn();
    route();

    const hideLoader = () => $("#loader").classList.add("hide");
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => setTimeout(hideLoader, 350));
      setTimeout(hideLoader, 2500); // safety
    } else {
      setTimeout(hideLoader, 600);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
