    const DATA_PATHS = {
      videos: "./data/videos.json",
      themes: "./data/themes.json",
      comments: "./data/comments.json"
    };

    const inlineData = window.CODEIT_COMMENT_DATA || null;

    const keywordSeeds = [
      "AI", "취업", "부트캠프", "비전공", "지방", "위워크", "공간", "질문",
      "동료", "공식문서", "루틴", "시리즈", "응원", "자동화", "학습"
    ];

    const state = {
      videos: [],
      themes: [],
      comments: [],
      activeTheme: "all",
      activeVideo: "all",
      sort: "theme"
    };

    const $ = selector => document.querySelector(selector);

    function normalizeText(value) {
      return String(value || "").replace(/\s+/g, " ").trim();
    }

    function countBy(items, getter) {
      return items.reduce((acc, item) => {
        const key = getter(item);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
    }

    function themeOf(themeId) {
      return state.themes.find(theme => theme.theme === themeId) || {
        theme: themeId,
        label: themeId,
        color: "#6500c3",
        summary: "",
        planning_use: ""
      };
    }

    function safeColor(value) {
      return /^#[0-9a-fA-F]{6}$/.test(String(value || "")) ? value : "#6500c3";
    }

    function safeURL(value) {
      try {
        const url = new URL(String(value || ""), window.location.href);
        if (url.protocol === "https:" && url.hostname === "www.youtube.com") return url.href;
      } catch (error) {
        return "#";
      }
      return "#";
    }

    function safeYouTubeId(value) {
      return /^[A-Za-z0-9_-]{6,20}$/.test(String(value || "")) ? value : "";
    }

    function escapeHTML(value) {
      return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function renderMetrics() {
      const personaCount = new Set(state.comments.map(comment => comment.persona)).size;
      $("#metricVideos").textContent = state.videos.length;
      $("#metricComments").textContent = state.comments.length;
      $("#metricThemes").textContent = state.themes.length;
      $("#metricPersonas").textContent = personaCount;
    }

    function renderThemeBars() {
      const counts = countBy(state.comments, comment => comment.theme);
      const max = Math.max(...Object.values(counts), 1);
      $("#themeBars").innerHTML = state.themes.map(theme => {
        const count = counts[theme.theme] || 0;
        const width = Math.max(4, Math.round((count / max) * 100));
        return `
          <div class="bar-row">
            <div class="bar-label">${escapeHTML(theme.label)}</div>
            <div class="bar-track" aria-hidden="true">
              <span class="bar-fill" style="--w:${width}%; --c:${safeColor(theme.color)}"></span>
            </div>
            <div class="bar-count">${count}개</div>
          </div>
        `;
      }).join("");
    }

    function renderPersonaBars() {
      const counts = Object.entries(countBy(state.comments, comment => comment.persona))
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
      const max = Math.max(...counts.map(([, count]) => count), 1);
      $("#personaBars").innerHTML = counts.map(([persona, count], index) => {
        const width = Math.max(4, Math.round((count / max) * 100));
        const colors = ["#6500c3", "#3d7c5f", "#1c6ca8", "#a84832", "#7a5c99", "#52616b", "#c48a36"];
        return `
          <div class="bar-row">
            <div class="bar-label">${escapeHTML(persona)}</div>
            <div class="bar-track" aria-hidden="true">
              <span class="bar-fill" style="--w:${width}%; --c:${colors[index % colors.length]}"></span>
            </div>
            <div class="bar-count">${count}개</div>
          </div>
        `;
      }).join("");
    }

    function renderKeywords() {
      const joined = state.comments.map(comment => `${comment.text} ${comment.intent} ${comment.persona}`).join(" ");
      const rows = keywordSeeds.map(word => {
        const pattern = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        const matches = joined.match(pattern);
        return { word, count: matches ? matches.length : 0 };
      }).filter(row => row.count > 0)
        .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, "ko"));

      const max = Math.max(...rows.map(row => row.count), 1);
      $("#keywordCloud").innerHTML = rows.map(row => {
        const size = row.count === max ? 21 : row.count >= max * 0.65 ? 18 : 15;
        return `<span class="keyword" style="--size:${size}px">${escapeHTML(row.word)}<small>${row.count}</small></span>`;
      }).join("");
    }

    function renderVideos() {
      $("#videoRows").innerHTML = state.videos.map(video => `
        <tr>
          <td><a class="video-title" href="${escapeHTML(safeURL(video.url))}" target="_blank" rel="noreferrer">${escapeHTML(video.title)}</a></td>
          <td>${video.comment_count}</td>
          <td>${escapeHTML(video.main_signal)}</td>
          <td>${escapeHTML(video.content_implication)}</td>
        </tr>
      `).join("");
    }

    function renderVideoEmbeds() {
      $("#sourceVideoGrid").innerHTML = state.videos.map(video => {
        const youtubeId = safeYouTubeId(video.youtube_id);
        const thumbnail = youtubeId
          ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
          : "";
        return `
          <a class="video-embed-card" href="${escapeHTML(safeURL(video.url))}" target="_blank" rel="noreferrer">
            <span class="video-thumb">
              ${thumbnail ? `<img src="${escapeHTML(thumbnail)}" alt="${escapeHTML(video.title)} 썸네일">` : ""}
              <span class="play-mark" aria-hidden="true"></span>
            </span>
            <span class="video-embed-title">${escapeHTML(video.title)}</span>
          </a>
        `;
      }).join("");
    }

    function renderFilters() {
      const videoScopedComments = state.activeVideo === "all"
        ? state.comments
        : state.comments.filter(comment => comment.video_id === state.activeVideo);

      $("#videoFilter").innerHTML = [
        `<option value="all">전체 영상</option>`,
        ...state.videos.map(video => `<option value="${escapeHTML(video.video_id)}">${escapeHTML(video.video_id)} · ${escapeHTML(video.title)}</option>`)
      ].join("");
      $("#videoFilter").value = state.activeVideo;

      $("#themeTabs").innerHTML = [
        `<button class="theme-tab" type="button" data-theme="all" aria-pressed="${state.activeTheme === "all"}">전체 ${videoScopedComments.length}</button>`,
        ...state.themes.map(theme => {
          const count = videoScopedComments.filter(comment => comment.theme === theme.theme).length;
          return `<button class="theme-tab" type="button" data-theme="${escapeHTML(theme.theme)}" aria-pressed="${state.activeTheme === theme.theme}">${escapeHTML(theme.label)} ${count}</button>`;
        })
      ].join("");

      $("#themeTabs").querySelectorAll("button").forEach(button => {
        button.addEventListener("click", () => {
          state.activeTheme = button.dataset.theme;
          renderFilters();
          renderComments();
        });
      });
    }

    function sortedComments() {
      const filtered = state.comments.filter(comment => {
        const themeMatch = state.activeTheme === "all" || comment.theme === state.activeTheme;
        const videoMatch = state.activeVideo === "all" || comment.video_id === state.activeVideo;
        return themeMatch && videoMatch;
      });

      return filtered.sort((a, b) => {
        if (state.sort === "like") return b.like_count - a.like_count || a.comment_id.localeCompare(b.comment_id);
        if (state.sort === "video") return a.video_id.localeCompare(b.video_id) || a.comment_id.localeCompare(b.comment_id);
        return themeOf(a.theme).label.localeCompare(themeOf(b.theme).label, "ko") || a.comment_id.localeCompare(b.comment_id);
      });
    }

    function renderComments() {
      const rows = sortedComments();
      if (!rows.length) {
        $("#commentGrid").innerHTML = `<div class="empty-state">선택한 조건에 맞는 댓글 근거가 없습니다.</div>`;
        return;
      }

      $("#commentGrid").innerHTML = rows.map(comment => {
        const theme = themeOf(comment.theme);
        return `
          <article class="comment-card">
            <div class="comment-meta">
              <span class="pill" style="border-color:${safeColor(theme.color)}44; color:${safeColor(theme.color)}; background:${safeColor(theme.color)}12">${escapeHTML(theme.label)}</span>
            </div>
            <div class="comment-video-title">영상: ${escapeHTML(comment.video_title)}</div>
            <p>${escapeHTML(comment.text)}</p>
            <div class="comment-foot">
              <span>${escapeHTML(comment.persona)}</span>
              <span>의도: ${escapeHTML(comment.intent)}</span>
              <span>${escapeHTML(comment.published_at || "")}</span>
            </div>
          </article>
        `;
      }).join("");
    }

    function bindControls() {
      $("#videoFilter").addEventListener("change", event => {
        state.activeVideo = event.target.value;
        renderFilters();
        renderComments();
      });

      $("#sortSelect").addEventListener("change", event => {
        state.sort = event.target.value;
        renderComments();
      });
    }

    async function loadJSON(path) {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`${path} 로딩 실패: ${response.status}`);
      }
      return response.json();
    }

    function hasInlineData(data) {
      return data
        && Array.isArray(data.videos)
        && Array.isArray(data.themes)
        && Array.isArray(data.comments);
    }

    function cloneData(data) {
      return JSON.parse(JSON.stringify(data));
    }

    async function loadData() {
      if (window.location.protocol === "file:" && hasInlineData(inlineData)) {
        return cloneData(inlineData);
      }

      try {
        const [videos, themes, comments] = await Promise.all([
          loadJSON(DATA_PATHS.videos),
          loadJSON(DATA_PATHS.themes),
          loadJSON(DATA_PATHS.comments)
        ]);
        return { videos, themes, comments };
      } catch (error) {
        if (hasInlineData(inlineData)) {
          return cloneData(inlineData);
        }
        throw error;
      }
    }

    async function init() {
      try {
        const data = await loadData();
        state.videos = data.videos;
        state.themes = data.themes;
        state.comments = data.comments;

        renderMetrics();
        renderThemeBars();
        renderPersonaBars();
        renderKeywords();
        renderVideoEmbeds();
        renderVideos();
        renderFilters();
        renderComments();
        bindControls();

        $("#status").classList.add("is-hidden");
      } catch (error) {
        $("#status").textContent = `데이터 로딩 실패: ${error.message}`;
      }
    }

    init();
