const state = {
  userId: localStorage.getItem("cig-user") || "u_admin",
  users: [],
  events: [],
  albums: [],
  media: [],
  notifications: [],
  analytics: {},
  settings: {},
  selectedEventId: "",
  selectedAlbumId: "",
  selectedFiles: [],
  visibleCount: 6,
  galleryObserver: null,
  notificationTimer: null,
  mediaHashCache: new Map()
};

const USER_ROLES = ["Admin", "Photographer", "Club Member", "Viewer"];

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function api(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": state.userId,
      ...(options.headers || {})
    }
  }).then(async response => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Request failed");
    return body;
  });
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function currentUser() {
  return state.users.find(user => user.id === state.userId) || state.users[0];
}

function canUpload() {
  const role = currentUser()?.role;
  return role === "Admin" || role === "Photographer";
}

function canCreateEvent() {
  return currentUser()?.role === "Admin";
}

function canCreateAlbum() {
  const role = currentUser()?.role;
  return role === "Admin" || role === "Photographer";
}

function canDeleteAlbum(album) {
  return currentUser()?.role === "Admin" || album.collaborators?.includes(state.userId);
}

function canManageAlbum(album) {
  return currentUser()?.role === "Admin" || album.collaborators?.includes(state.userId);
}

async function bootstrap() {
  const requestedUserId = state.userId;
  const data = await api("/api/bootstrap");
  Object.assign(state, data);
  state.userId = state.users.some(user => user.id === requestedUserId)
    ? requestedUserId
    : data.currentUser?.id || state.users[0]?.id || requestedUserId;
  localStorage.setItem("cig-user", state.userId);
  renderAll();
}

function renderAll() {
  normalizeBrowserSelection();
  renderUsers();
  renderStats();
  renderEvents();
  renderEventBrowser();
  renderTags();
  renderUploadSelectors();
  renderAlbumDialogOptions();
  updateUploadStatus();
  renderGalleryHeading();
  renderGallery();
  renderNotifications();
  renderFacePlaceholder();
  renderAnalytics();
  $("#newEventButton").disabled = !canCreateEvent();
  $("#newEventButton").title = canCreateEvent() ? "Create event" : "Only admins can create events";
  $("#newAlbumButton").disabled = !canCreateAlbum();
  $("#newAlbumButton").title = canCreateAlbum() ? "Create album" : "Only admins and photographers can create albums";
  $("#dropZone").classList.toggle("disabled", !canUpload());
}

function selectedEvent() {
  return state.events.find(event => event.id === state.selectedEventId) || null;
}

function selectedAlbum() {
  return state.albums.find(album => album.id === state.selectedAlbumId) || null;
}

function selectedEventAlbums() {
  return state.albums.filter(album => album.eventId === state.selectedEventId);
}

function normalizeBrowserSelection() {
  if (state.selectedEventId && !state.events.some(event => event.id === state.selectedEventId)) {
    state.selectedEventId = "";
    state.selectedAlbumId = "";
  }
  if (state.selectedAlbumId) {
    const album = selectedAlbum();
    if (!album || album.eventId !== state.selectedEventId) {
      state.selectedAlbumId = "";
    }
  }
}

function mediaInActiveScope() {
  let items = state.media;
  if (state.selectedEventId) {
    items = items.filter(item => item.eventId === state.selectedEventId);
    if (!state.selectedAlbumId) return [];
  }
  if (state.selectedAlbumId) {
    items = items.filter(item => item.albumId === state.selectedAlbumId);
  }
  return items;
}

function renderUsers() {
  $("#userSelect").innerHTML = state.users.map(user => (
    `<option value="${user.id}">${user.name} - ${user.role}</option>`
  )).join("");
  $("#userSelect").value = state.userId;

  $("#faceUser").innerHTML = state.users.map(user => (
    `<option value="${user.faceToken}">${user.name}</option>`
  )).join("");

  $("#manageUsersButton").classList.toggle("hidden", !canCreateEvent());
  renderUserDirectory();
}

function renderStats() {
  const cards = [
    ["Events", state.analytics.totalEvents || 0, "Public/private event records"],
    ["Media", state.analytics.totalMedia || 0, "Photos and videos"],
    ["Photos", state.analytics.photos || 0, "Image gallery items"],
    ["Interactions", (state.analytics.likes || 0) + (state.analytics.comments || 0), "Likes plus comments"]
  ];
  $("#statsGrid").innerHTML = cards.map(([label, value, note], index) => (
    `<article class="stat-card stat-${index + 1}"><span class="label">${label}</span><strong>${value}</strong><p>${note}</p></article>`
  )).join("");
}

function renderEvents() {
  const sort = $("#eventSort").value;
  const canEditEvents = canCreateEvent();
  const events = [...state.events].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "category") return a.category.localeCompare(b.category);
    return new Date(b.date) - new Date(a.date);
  });

  const grid = $("#eventGrid");
  grid.innerHTML = events.map(event => {
    const albums = state.albums.filter(album => album.eventId === event.id);
    const mediaCount = state.media.filter(item => item.eventId === event.id).length;
    const isSelected = event.id === state.selectedEventId;
    return `
      <article class="event-card ${isSelected ? "selected" : ""}" data-event-card-id="${event.id}" tabindex="0" role="button" aria-label="View albums for ${escapeHtml(event.name)}">
        <div class="event-cover" style="background:${event.coverColor}"></div>
        <div class="event-body">
          <div class="media-title-row">
            <h3>${escapeHtml(event.name)}</h3>
            <span class="privacy-pill ${event.visibility}">${event.visibility}</span>
          </div>
          <p class="caption">${escapeHtml(event.description)}</p>
          <div class="event-meta">
            <span class="pill">${escapeHtml(event.category)}</span>
            <span class="pill">${formatDate(event.date)}</span>
            <span class="pill">${escapeHtml(event.location || "No location")}</span>
            <span class="pill">${albums.length} album${albums.length === 1 ? "" : "s"}</span>
            <span class="pill">${mediaCount} media</span>
          </div>
          <div class="album-strip">
            ${albums.map(album => `
              <span class="album-chip">
                <span class="album-chip-title">${escapeHtml(album.title)}</span>
                <small>${(album.collaborators || []).length} collaborator${(album.collaborators || []).length === 1 ? "" : "s"}</small>
                ${canManageAlbum(album) ? `<button type="button" data-album-action="manage" data-album-id="${album.id}" title="Manage collaborators">Manage</button>` : ""}
                ${canDeleteAlbum(album) ? `<button type="button" data-album-action="delete" data-album-id="${album.id}" title="Delete album">Delete</button>` : ""}
              </span>
            `).join("") || "<span>No albums yet</span>"}
          </div>
          <div class="event-actions">
            <button type="button" class="secondary-button compact-button" data-event-action="select" data-event-id="${event.id}">View albums</button>
            ${canEditEvents ? `<button type="button" class="ghost-button compact-button" data-event-action="edit" data-event-id="${event.id}">Edit event</button>` : ""}
          </div>
        </div>
      </article>
    `;
  }).join("");

  grid.querySelectorAll("[data-event-card-id]").forEach(card => {
    const chooseEvent = () => selectEvent(card.dataset.eventCardId);
    card.addEventListener("click", event => {
      if (event.target.closest("button")) return;
      chooseEvent();
    });
    card.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      chooseEvent();
    });
  });

  grid.querySelectorAll("[data-event-action='select']").forEach(button => {
    button.addEventListener("click", () => selectEvent(button.dataset.eventId));
  });

  grid.querySelectorAll("[data-event-action='edit']").forEach(button => {
    button.addEventListener("click", () => {
      const eventItem = state.events.find(item => item.id === button.dataset.eventId);
      if (eventItem) openEventDialog(eventItem);
    });
  });

  grid.querySelectorAll("[data-album-action='delete']").forEach(button => {
    button.addEventListener("click", () => deleteAlbum(button.dataset.albumId));
  });

  grid.querySelectorAll("[data-album-action='manage']").forEach(button => {
    button.addEventListener("click", () => openCollaboratorDialog(button.dataset.albumId));
  });
}

function renderEventBrowser() {
  const container = $("#eventBrowser");
  const event = selectedEvent();
  if (!event) {
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }

  const albums = selectedEventAlbums();
  container.classList.remove("hidden");
  container.innerHTML = `
    <div class="browser-title-row">
      <div>
        <p class="eyebrow">Selected event</p>
        <h2>${escapeHtml(event.name)}</h2>
        <p class="caption">${albums.length ? "Choose an album to view its media. Search, tag, and date filters stay available above." : "This event has no albums yet."}</p>
      </div>
      <div class="toolbar">
        ${canCreateAlbum() ? `<button type="button" class="secondary-button" data-event-browser-action="new-album">New album here</button>` : ""}
        <button type="button" class="ghost-button" data-event-browser-action="clear">All media</button>
      </div>
    </div>
    <div class="album-browser-grid">
      ${albums.map(album => {
        const mediaCount = state.media.filter(item => item.albumId === album.id).length;
        const collaboratorNames = (album.collaborators || [])
          .map(userId => state.users.find(user => user.id === userId)?.name)
          .filter(Boolean)
          .join(", ") || "No collaborators";
        const isSelected = album.id === state.selectedAlbumId;
        return `
          <article class="album-browser-card ${isSelected ? "selected" : ""}" data-album-browser-id="${album.id}" tabindex="0" role="button" aria-label="View media in ${escapeHtml(album.title)}">
            <div>
              <span class="label">${mediaCount} media item${mediaCount === 1 ? "" : "s"}</span>
              <h3>${escapeHtml(album.title)}</h3>
              <p class="caption">${escapeHtml(album.description || "No description added.")}</p>
            </div>
            <small>${escapeHtml(collaboratorNames)}</small>
            <div class="album-card-actions">
              <button type="button" class="primary-button compact-button" data-album-browser-action="open" data-album-id="${album.id}">View media</button>
              ${canManageAlbum(album) ? `<button type="button" class="ghost-button compact-button" data-album-action="manage" data-album-id="${album.id}">Manage</button>` : ""}
              ${canDeleteAlbum(album) ? `<button type="button" class="ghost-button compact-button danger-button" data-album-action="delete" data-album-id="${album.id}">Delete</button>` : ""}
            </div>
          </article>
        `;
      }).join("") || `
        <article class="album-browser-empty">
          <strong>No albums in this event</strong>
          <p class="caption">Create an album first, then uploaded media can be browsed here.</p>
          ${canCreateAlbum() ? `<button type="button" class="secondary-button" data-event-browser-action="new-album">Create album</button>` : ""}
        </article>
      `}
    </div>
  `;

  container.querySelectorAll("[data-album-browser-id]").forEach(card => {
    const chooseAlbum = () => selectAlbum(card.dataset.albumBrowserId);
    card.addEventListener("click", event => {
      if (event.target.closest("button")) return;
      chooseAlbum();
    });
    card.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      chooseAlbum();
    });
  });

  container.querySelectorAll("[data-album-browser-action='open']").forEach(button => {
    button.addEventListener("click", () => selectAlbum(button.dataset.albumId));
  });

  container.querySelectorAll("[data-album-action='delete']").forEach(button => {
    button.addEventListener("click", () => deleteAlbum(button.dataset.albumId));
  });

  container.querySelectorAll("[data-album-action='manage']").forEach(button => {
    button.addEventListener("click", () => openCollaboratorDialog(button.dataset.albumId));
  });

  container.querySelectorAll("[data-event-browser-action='new-album']").forEach(button => {
    button.addEventListener("click", () => openAlbumDialog(event.id));
  });

  container.querySelector("[data-event-browser-action='clear']")?.addEventListener("click", clearEventSelection);
}

function selectEvent(eventId) {
  state.selectedEventId = eventId;
  state.selectedAlbumId = "";
  state.visibleCount = 6;
  renderEvents();
  renderEventBrowser();
  renderTags();
  renderGalleryHeading();
  renderGallery();
  $("#eventBrowser").scrollIntoView({ behavior: "smooth", block: "start" });
}

function selectAlbum(albumId) {
  const album = state.albums.find(item => item.id === albumId);
  if (!album) return;
  state.selectedEventId = album.eventId;
  state.selectedAlbumId = album.id;
  state.visibleCount = 6;
  renderEvents();
  renderEventBrowser();
  renderTags();
  renderGalleryHeading();
  renderGallery();
  $("#gallery").scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearEventSelection() {
  state.selectedEventId = "";
  state.selectedAlbumId = "";
  state.visibleCount = 6;
  renderEvents();
  renderEventBrowser();
  renderTags();
  renderGalleryHeading();
  renderGallery();
}

function renderGalleryHeading() {
  const event = selectedEvent();
  const album = selectedAlbum();
  const title = $("#galleryTitle");
  const subtitle = $("#gallerySubtitle");
  if (!event) {
    title.textContent = "Latest media";
    subtitle.textContent = "Showing all visible media. Use search, tag, and date filters to narrow results.";
    return;
  }
  if (!album) {
    title.textContent = "Select an album";
    subtitle.textContent = `Albums from ${event.name} are shown above. Pick one to view its photos and videos.`;
    return;
  }
  title.textContent = `${album.title} media`;
  subtitle.textContent = `${event.name} | Search by title, event, uploader, tag, or upload date.`;
}

function renderTags() {
  const source = state.selectedEventId && !state.selectedAlbumId
    ? state.media.filter(item => item.eventId === state.selectedEventId)
    : mediaInActiveScope();
  const tags = [...new Set(source.flatMap(item => item.tags))].sort();
  const current = $("#tagFilter").value;
  $("#tagFilter").innerHTML = `<option value="">All tags</option>${tags.map(tag => `<option value="${tag}">${tag}</option>`).join("")}`;
  $("#tagFilter").value = tags.includes(current) ? current : "";
}

function filteredMedia() {
  const q = $("#searchInput").value.trim().toLowerCase();
  const tag = $("#tagFilter").value;
  const date = $("#dateFilter").value;
  return mediaInActiveScope().filter(item => {
    const event = state.events.find(evt => evt.id === item.eventId);
    const uploader = state.users.find(user => user.id === item.uploadedBy);
    const haystack = [item.title, event?.name, uploader?.name, item.tags.join(" "), item.uploadedAt].join(" ").toLowerCase();
    return (!q || haystack.includes(q)) &&
      (!tag || item.tags.includes(tag)) &&
      (!date || item.uploadedAt.startsWith(date));
  });
}

function renderGallery(items = null, target = $("#gallery")) {
  const isPrimaryGallery = target === $("#gallery");
  const totalItems = items === null ? filteredMedia() : items;
  const visibleItems = items === null ? totalItems.slice(0, state.visibleCount) : items;
  target.innerHTML = "";
  if (!visibleItems.length) {
    target.innerHTML = isPrimaryGallery ? primaryGalleryEmptyMessage(totalItems.length) : `<div class="stat-card"><strong>No media found</strong><p>Try a different search, role, or upload something new.</p></div>`;
    if (isPrimaryGallery) updateGalleryStatus(totalItems.length);
    return;
  }
  visibleItems.forEach(item => target.appendChild(mediaCard(item)));
  if (isPrimaryGallery) updateGalleryStatus(totalItems.length);
}

function primaryGalleryEmptyMessage(filteredCount) {
  const event = selectedEvent();
  const album = selectedAlbum();
  if (event && !album) {
    return `<div class="stat-card"><strong>Select an album above</strong><p>Click any album in ${escapeHtml(event.name)} to show the media stored inside it.</p></div>`;
  }
  if (album && !mediaInActiveScope().length) {
    return `<div class="stat-card"><strong>No media in this album yet</strong><p>Upload photos or videos to ${escapeHtml(album.title)}, then they will appear here.</p></div>`;
  }
  if (!filteredCount) {
    return `<div class="stat-card"><strong>No media found</strong><p>Try a different search term, tag, date, role, or album.</p></div>`;
  }
  return `<div class="stat-card"><strong>No media found</strong><p>Try a different search, role, or upload something new.</p></div>`;
}

function updateGalleryStatus(total) {
  const status = $("#galleryStatus");
  const loadMoreButton = $("#loadMoreButton");
  if (state.selectedEventId && !state.selectedAlbumId) {
    status.textContent = "Select an album above to load its media.";
    loadMoreButton.classList.add("hidden");
    return;
  }
  const hasMore = state.visibleCount < total;
  status.textContent = hasMore
    ? `Showing ${Math.min(state.visibleCount, total)} of ${total}. More loads as you scroll.`
    : total ? `Showing all ${total} media items.` : "No media to load.";
  loadMoreButton.classList.toggle("hidden", !hasMore);
}

function loadMoreMedia() {
  const total = filteredMedia().length;
  if (state.visibleCount >= total) {
    updateGalleryStatus(total);
    return;
  }
  state.visibleCount += 6;
  renderGallery();
}

function initInfiniteScroll() {
  const sentinel = $("#gallerySentinel");
  if (!("IntersectionObserver" in window) || !sentinel) return;
  state.galleryObserver?.disconnect();
  state.galleryObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) loadMoreMedia();
  }, { rootMargin: "260px 0px" });
  state.galleryObserver.observe(sentinel);
}

function mediaCard(item) {
  const template = $("#mediaCardTemplate").content.cloneNode(true);
  const card = template.querySelector(".media-card");
  const visual = template.querySelector(".media-visual");
  const thumb = template.querySelector(".media-thumb");
  const title = template.querySelector("h3");
  const meta = template.querySelector(".media-meta");
  const caption = template.querySelector(".caption");
  const privacy = template.querySelector(".privacy-pill");
  const tagRow = template.querySelector(".tag-row");
  const likeButton = template.querySelector('[data-action="like"]');
  const favButton = template.querySelector('[data-action="favourite"]');
  const matchBadge = template.querySelector(".match-badge");
  const tagForm = template.querySelector(".tag-form");
  const tagSelect = tagForm.querySelector("select");
  const commentList = template.querySelector(".comment-list");
  const commentForm = template.querySelector(".comment-form");
  const commentInput = commentForm.querySelector("input");
  const event = state.events.find(evt => evt.id === item.eventId);
  const album = state.albums.find(alb => alb.id === item.albumId);

  title.textContent = item.title;
  meta.textContent = `${event?.name || "Unknown event"} | ${album?.title || "No album"} | Uploaded by ${item.uploaderName}`;
  caption.textContent = item.aiCaption;
  privacy.textContent = item.visibility;
  privacy.classList.add(item.visibility);
  tagRow.innerHTML = item.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  likeButton.querySelector(".action-count").textContent = item.likes.length;
  likeButton.classList.toggle("active", item.likes.includes(state.userId));
  favButton.querySelector(".action-label").textContent = item.favourites.includes(state.userId) ? "Saved" : "Save";
  favButton.classList.toggle("active", item.favourites.includes(state.userId));
  if (item.matchConfidence) {
    matchBadge.textContent = `${item.matchConfidence}% face match`;
    matchBadge.classList.remove("hidden");
  }

  tagSelect.innerHTML = state.users.map(user => `<option value="${user.id}">${user.name}</option>`).join("");
  commentList.innerHTML = item.comments.length
    ? item.comments.map(comment => `<p><strong>${escapeHtml(comment.userName)}</strong><span>${escapeHtml(comment.text)}</span></p>`).join("")
    : "<p><strong>Be first</strong><span>No comments yet.</span></p>";

  renderMediaThumb(thumb, item, { controls: true });
  visual.tabIndex = 0;
  visual.setAttribute("role", "button");
  visual.setAttribute("aria-label", `Open ${item.title} fullscreen`);
  visual.addEventListener("click", () => openMediaViewer(item));
  visual.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMediaViewer(item);
    }
  });

  template.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.action === "comment-focus") {
        commentForm.scrollIntoView({ behavior: "smooth", block: "center" });
        commentInput.focus();
        return;
      }
      handleMediaAction(item, button.dataset.action).catch(error => alert(error.message));
    });
  });

  tagForm.addEventListener("submit", async event => {
    event.preventDefault();
    await api(`/api/media/${item.id}/tag`, {
      method: "POST",
      body: JSON.stringify({ userId: new FormData(tagForm).get("userId") })
    });
    await bootstrap();
    alert("User tagged. Open that user's notifications to see the output.");
  });

  commentForm.addEventListener("submit", async event => {
    event.preventDefault();
    const text = new FormData(commentForm).get("comment").trim();
    if (!text) return;
    await api(`/api/media/${item.id}/comment`, { method: "POST", body: JSON.stringify({ text }) });
    commentForm.reset();
    await bootstrap();
  });

  card.dataset.mediaId = item.id;
  return template;
}

function renderMediaThumb(container, item, options = {}) {
  container.innerHTML = "";
  container.style.background = "";
  const controls = options.controls ? "controls" : "";
  const autoplay = options.autoplay ? "autoplay" : "";
  if (item.dataUrl) {
    if (item.type === "video") {
      container.innerHTML = `<video src="${item.dataUrl}" ${controls} ${autoplay}></video>`;
    } else {
      container.innerHTML = `<img src="${item.dataUrl}" alt="${escapeHtml(item.title)}">`;
    }
    return;
  }
  container.style.background = `linear-gradient(135deg, ${item.gradient?.[0] || "#7c3aed"}, ${item.gradient?.[1] || "#f97316"})`;
  container.textContent = item.type === "video" ? "VIDEO" : "PHOTO";
}

async function handleMediaAction(item, action) {
  if (action === "download") return downloadWatermarked(item);
  if (action === "share") {
    const { share } = await api(`/api/media/${item.id}/share`, { method: "POST", body: "{}" });
    openShareModal(share.url, item);
    return;
  }
  await api(`/api/media/${item.id}/${action}`, { method: "POST", body: "{}" });
  await bootstrap();
}

function showQrShare(url, title) {
  const panel = $("#notificationPanel");
  const qr = makeQrPattern(url);
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <strong>Share output for ${escapeHtml(title)}</strong>
    <canvas id="qrCanvas" width="164" height="164" aria-label="QR share code"></canvas>
    <p class="caption">${location.origin}${url}</p>
  `;
  drawQr($("#qrCanvas"), qr);
}

function openShareModal(url, item) {
  const modal = $("#shareModal");
  const fullUrl = new URL(url, location.origin).href;
  const encoded = encodeURIComponent(fullUrl);
  $("#shareModalTitle").textContent = item.title;
  $("#shareLinkInput").value = fullUrl;
  $("#copyShareFeedback").textContent = "QR code ready";
  drawQr($("#shareQrCanvas"), makeQrPattern(fullUrl));
  const platforms = [
    ["WhatsApp", `https://wa.me/?text=${encoded}`],
    ["Email", `mailto:?subject=Shared Media&body=${encoded}`],
    ["Telegram", `https://t.me/share/url?url=${encoded}`],
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${encoded}`],
    ["Twitter/X", `https://twitter.com/intent/tweet?url=${encoded}`],
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`]
  ];
  $("#socialShareLinks").innerHTML = platforms.map(([label, href]) => (
    `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
  )).join("");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => modal.classList.add("active"));
  $("#copyShareLink").focus();
}

function closeShareModal() {
  const modal = $("#shareModal");
  modal.classList.remove("active");
  window.setTimeout(() => modal.classList.add("hidden"), 160);
}

async function copyShareLink() {
  const input = $("#shareLinkInput");
  input.select();
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(input.value);
    } else {
      document.execCommand("copy");
    }
    $("#copyShareFeedback").textContent = "Copied \u2713";
  } catch (error) {
    $("#copyShareFeedback").textContent = "Copy failed. Select the link manually.";
  }
}

function openMediaViewer(item) {
  const viewer = $("#mediaViewer");
  const content = $("#mediaViewerContent");
  renderMediaThumb(content, item, { controls: true, autoplay: item.type === "video" });
  $("#mediaViewerTitle").textContent = item.title;
  $("#mediaViewerMeta").textContent = item.aiCaption || "";
  viewer.classList.remove("hidden");
  requestAnimationFrame(() => viewer.classList.add("active"));
  viewer.focus();
}

function closeMediaViewer() {
  const viewer = $("#mediaViewer");
  viewer.classList.remove("active");
  $("#mediaViewerContent").innerHTML = "";
  window.setTimeout(() => viewer.classList.add("hidden"), 180);
}

function makeQrPattern(text) {
  const bytes = [...text].map(ch => ch.charCodeAt(0));
  return Array.from({ length: 21 }, (_, y) => Array.from({ length: 21 }, (_, x) => {
    const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    if (finder) return x === 0 || y === 0 || x === 6 || y === 6 || (x > 1 && x < 5 && y > 1 && y < 5);
    return ((x * 31 + y * 17 + (bytes[(x + y) % bytes.length] || 0)) % 5) < 2;
  }));
}

function drawQr(canvas, pattern) {
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cell = canvas.width / pattern.length;
  ctx.fillStyle = "#0f172a";
  pattern.forEach((row, y) => row.forEach((on, x) => {
    if (on) ctx.fillRect(x * cell, y * cell, Math.ceil(cell), Math.ceil(cell));
  }));
}

async function downloadWatermarked(item) {
  await api(`/api/media/${item.id}/download`, { method: "POST", body: "{}" }).catch(() => {});
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 820;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, item.gradient?.[0] || "#7c3aed");
  gradient.addColorStop(1, item.gradient?.[1] || "#f97316");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (item.dataUrl && item.type === "photo") {
    const img = await loadImage(item.dataUrl);
    const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
    const width = img.width * scale;
    const height = img.height * scale;
    ctx.drawImage(img, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  } else {
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.font = "900 96px system-ui";
    ctx.fillText(item.type === "video" ? "VIDEO" : "PHOTO", 70, 160);
  }

  const event = state.events.find(evt => evt.id === item.eventId);
  ctx.fillStyle = "rgba(15,23,42,.72)";
  ctx.fillRect(0, canvas.height - 116, canvas.width, 116);
  ctx.fillStyle = "#fff";
  ctx.font = "700 34px system-ui";
  ctx.fillText(`${state.settings.clubName} | ${event?.name || "Event"} | ${currentUser().role}`, 42, canvas.height - 58);
  const link = document.createElement("a");
  link.download = `${item.title.replace(/\W+/g, "-").toLowerCase()}-watermarked.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  refreshAnalytics();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function renderUploadSelectors() {
  $("#uploadEvent").innerHTML = state.events.map(event => `<option value="${event.id}">${escapeHtml(event.name)}</option>`).join("");
  renderAlbumOptions();
}

function renderAlbumDialogOptions() {
  $("#albumEvent").innerHTML = state.events.map(event => `<option value="${event.id}">${escapeHtml(event.name)}</option>`).join("");
  renderCollaboratorChoices($("#albumCollaborators"), [state.userId]);
}

function renderAlbumOptions() {
  const eventId = $("#uploadEvent").value || state.events[0]?.id;
  const albums = state.albums.filter(album => album.eventId === eventId);
  const albumSelect = $("#uploadAlbum");
  albumSelect.innerHTML = albums.length
    ? albums.map(album => `<option value="${album.id}">${escapeHtml(album.title)}</option>`).join("")
    : `<option value="">Create an album first</option>`;
  albumSelect.disabled = !albums.length;
}

function handleFiles(files) {
  const existing = new Set(state.selectedFiles.map(fileKey));
  const nextFiles = [...files].filter(file => {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) return false;
    const key = fileKey(file);
    if (existing.has(key)) return false;
    existing.add(key);
    return true;
  });
  state.selectedFiles = [...state.selectedFiles, ...nextFiles];
  $("#fileInput").value = "";
  renderPreviewGrid();
  updateUploadStatus();
}

function renderPreviewGrid() {
  const grid = $("#previewGrid");
  grid.innerHTML = "";
  state.selectedFiles.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    const originalKb = Math.round(file.size / 1024);
    const optimizedKb = Math.max(1, Math.round(originalKb * 0.72));
    const tags = inferClientTags(file.name, file.type);
    const card = document.createElement("article");
    card.className = "preview-card";
    card.innerHTML = `
      <button type="button" class="preview-remove" title="Remove selected file" data-remove-index="${index}">Remove</button>
      <div class="preview-media">
        ${file.type.startsWith("video/") ? `<video src="${url}" muted controls></video>` : `<img src="${url}" alt="${escapeHtml(file.name)}">`}
      </div>
      <div class="preview-info">
        <strong>${escapeHtml(file.name)}</strong>
        <span>${formatBytes(file.size)} original | ${optimizedKb} KB optimized estimate</span>
        <div class="preview-tags">${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
      </div>
    `;
    grid.appendChild(card);
  });
  grid.querySelectorAll("[data-remove-index]").forEach(button => {
    button.addEventListener("click", () => removeSelectedFile(Number(button.dataset.removeIndex)));
  });
}

function removeSelectedFile(index) {
  state.selectedFiles.splice(index, 1);
  renderPreviewGrid();
  updateUploadStatus();
}

function fileKey(file) {
  return [file.name, file.size, file.lastModified, file.type].join("|");
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function updateUploadStatus() {
  const count = state.selectedFiles.length;
  const totalKb = state.selectedFiles.reduce((sum, file) => sum + Math.round(file.size / 1024), 0);
  $("#uploadCount").textContent = String(count);
  $("#uploadSummary").textContent = count
    ? `${totalKb} KB selected | estimated optimized size ${Math.max(1, Math.round(totalKb * 0.72))} KB`
    : "Ready for images or videos.";
}

async function publishUploads(event) {
  event.preventDefault();
  if (!canUpload()) return alert("Only admins and photographers can upload media.");
  if (!state.selectedFiles.length) return alert("Choose at least one file.");
  if (!$("#uploadAlbum").value) return alert("Create an album for this event before publishing media.");
  const manualTags = $("#manualTags").value.split(",").map(tag => tag.trim()).filter(Boolean);
  const remainingFiles = [];
  let uploadedCount = 0;
  for (const file of state.selectedFiles) {
    const dataUrl = await fileToDataUrl(file);
    const exactHash = await hashText(dataUrl);
    const duplicate = await findDuplicateMedia(dataUrl, exactHash);
    if (duplicate && !confirm(`This image already exists as "${duplicate.title}".\nUpload anyway?`)) {
      remainingFiles.push(file);
      continue;
    }
    const visualSignature = file.type.startsWith("image/") ? await createVisualSignature(dataUrl).catch(() => null) : null;
    await api("/api/media", {
      method: "POST",
      body: JSON.stringify({
        eventId: $("#uploadEvent").value,
        albumId: $("#uploadAlbum").value,
        type: file.type.startsWith("video/") ? "video" : "photo",
        title: file.name.replace(/\.[^.]+$/, ""),
        dataUrl,
        tags: manualTags,
        visibility: $("#uploadVisibility").value,
        sizeKb: Math.round(file.size / 1024),
        exactHash,
        visualSignature
      })
    });
    uploadedCount += 1;
  }
  state.selectedFiles = remainingFiles;
  renderPreviewGrid();
  if (!remainingFiles.length) $("#uploadForm").reset();
  updateUploadStatus();
  await bootstrap();
  if (!remainingFiles.length) setView("dashboard");
  alert(uploadedCount
    ? `Upload complete. ${uploadedCount} item${uploadedCount === 1 ? "" : "s"} added to Latest media.`
    : "No files uploaded.");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function hashText(text) {
  if (!crypto.subtle) return String(text.length);
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function findDuplicateMedia(dataUrl, exactHash) {
  const localDuplicate = state.media.find(item => item.exactHash && item.exactHash === exactHash);
  if (localDuplicate) return localDuplicate;
  for (const item of state.media) {
    if (!item.dataUrl) continue;
    if (!state.mediaHashCache.has(item.id)) {
      state.mediaHashCache.set(item.id, await hashText(item.dataUrl));
    }
    if (state.mediaHashCache.get(item.id) === exactHash) return item;
  }
  const result = await api("/api/media/check-duplicates", {
    method: "POST",
    body: JSON.stringify({ exactHash, dataUrl })
  }).catch(() => ({ duplicates: [] }));
  return result.duplicates?.[0] || null;
}

async function createVisualSignature(dataUrl) {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, 8, 8);
  const { data } = ctx.getImageData(0, 0, 8, 8);
  const luminance = [];
  const averageColor = [0, 0, 0];
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    averageColor[0] += r;
    averageColor[1] += g;
    averageColor[2] += b;
    luminance.push((r * 0.299) + (g * 0.587) + (b * 0.114));
  }
  averageColor[0] = Math.round(averageColor[0] / 64);
  averageColor[1] = Math.round(averageColor[1] / 64);
  averageColor[2] = Math.round(averageColor[2] / 64);
  const brightness = luminance.reduce((sum, value) => sum + value, 0) / luminance.length;
  const hash = luminance.map(value => value >= brightness ? "1" : "0").join("");
  return {
    hash,
    averageColor,
    brightness: Math.round(brightness),
    sampleSize: 8
  };
}

function inferClientTags(name, type) {
  const lower = `${name} ${type}`.toLowerCase();
  const tags = [];
  [["mountain", "mountains"], ["hill", "mountains"], ["beach", "beaches"], ["sport", "sports"], ["crowd", "crowd"], ["stage", "stage"], ["workshop", "workshop"], ["portrait", "portrait"], ["party", "party"], ["dance", "dance"], ["video", "video"]]
    .forEach(([needle, tag]) => {
      if (lower.includes(needle)) tags.push(tag);
    });
  return tags.length ? tags : [type.startsWith("video/") ? "video" : "campus"];
}

function renderNotifications() {
  const unread = state.notifications.filter(item => !item.read).length;
  $("#notificationBadge").textContent = unread ? String(unread) : "";
  $("#notificationPanel").innerHTML = state.notifications.length
    ? state.notifications.map(item => `<p class="caption"><strong>${item.read ? "" : "New "}</strong>${escapeHtml(item.text)}</p>`).join("")
    : `<p class="caption">No notifications yet. Like, comment, upload, or tag users to create notifications.</p>`;
}

async function refreshNotifications() {
  const data = await api("/api/bootstrap");
  state.notifications = data.notifications;
  state.analytics = data.analytics;
  renderNotifications();
  renderAnalytics();
}

async function refreshAnalytics() {
  const data = await api("/api/bootstrap");
  state.analytics = data.analytics;
  renderAnalytics();
}

function startNotificationPolling() {
  window.clearInterval(state.notificationTimer);
  state.notificationTimer = window.setInterval(() => {
    refreshNotifications().catch(() => {});
  }, 5000);
}

function renderAnalytics() {
  const analytics = state.analytics || {};
  const totalMedia = analytics.totalMedia || 0;
  const engagement = (analytics.likes || 0) + (analytics.comments || 0) + (analytics.favourites || 0);
  const storageKb = analytics.storageKb || state.media.reduce((sum, item) => sum + (item.sizeKb || 0), 0);
  const publicMedia = analytics.publicMedia ?? state.media.filter(item => item.visibility === "public").length;
  const privateMedia = analytics.privateMedia ?? state.media.filter(item => item.visibility === "private").length;
  const totalDownloads = analytics.totalDownloads || 0;
  const totalShares = analytics.totalShares || 0;
  const cloud = analytics.cloudStatus || {};
  const eventBreakdown = analytics.eventBreakdown || state.events.map(event => ({
    name: event.name,
    media: state.media.filter(item => item.eventId === event.id).length,
    albums: state.albums.filter(album => album.eventId === event.id).length
  }));
  const topUploaders = analytics.topUploaders || [];
  const topTags = analytics.topTags || [];
  const maxEventMedia = Math.max(1, ...eventBreakdown.map(item => item.media));
  const publicPct = totalMedia ? Math.round((publicMedia / totalMedia) * 100) : 0;

  const cards = [
    ["Events", analytics.totalEvents || 0, `${analytics.privateEvents || 0} private`],
    ["Media Library", totalMedia, `${analytics.photos || 0} photos | ${analytics.videos || 0} videos`],
    ["Engagement", engagement, `${analytics.likes || 0} likes | ${analytics.comments || 0} comments`],
    ["Shares + Downloads", totalShares + totalDownloads, `${totalShares} shares | ${totalDownloads} downloads`],
    ["Storage", `${(storageKb / 1024).toFixed(1)} MB`, "tracked upload size"],
    ["Cloud", cloud.mode || "demo", cloud.bucket || state.settings.bucket || "local"]
  ];
  $("#analyticsBoard").innerHTML = cards.map(([title, value, note], index) => (
    `<article class="analytics-card analytics-${index + 1}">
      <span class="label">${title}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(note)}</small>
    </article>`
  )).join("");

  $("#analyticsDetails").innerHTML = `
    <article class="analytics-panel analytics-panel-wide">
      <div class="panel-title-row">
        <h3>Event performance</h3>
        <span>${totalMedia} media items</span>
      </div>
      <div class="bar-list">
        ${eventBreakdown.map(item => `
          <div class="bar-row">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <small>${item.media} media | ${item.albums} albums</small>
            </div>
            <span class="bar-track"><span style="width:${Math.max(8, Math.round((item.media / maxEventMedia) * 100))}%"></span></span>
          </div>
        `).join("") || `<p class="caption">No event data yet.</p>`}
      </div>
    </article>
    <article class="analytics-panel">
      <h3>Visibility mix</h3>
      <div class="visibility-meter" style="--public:${publicPct}%">
        <strong>${publicPct}%</strong>
        <span>public media</span>
      </div>
      <div class="split-row">
        <span>Public ${publicMedia}</span>
        <span>Private ${privateMedia}</span>
      </div>
    </article>
    <article class="analytics-panel">
      <h3>Highlights</h3>
      <div class="insight-list">
        <span><strong>Most liked event</strong><small>${escapeHtml(analytics.mostLikedEvent?.name || "No likes yet")} ${analytics.mostLikedEvent ? `(${analytics.mostLikedEvent.likes})` : ""}</small></span>
        <span><strong>Most active uploader</strong><small>${escapeHtml(analytics.mostActiveUploader?.name || "No uploads yet")} ${analytics.mostActiveUploader ? `(${analytics.mostActiveUploader.count})` : ""}</small></span>
        <span><strong>Most used tag</strong><small>${escapeHtml(analytics.mostUsedTag?.tag || "No tags yet")} ${analytics.mostUsedTag ? `(${analytics.mostUsedTag.count})` : ""}</small></span>
      </div>
    </article>
    <article class="analytics-panel">
      <h3>Top tags</h3>
      <div class="analytics-tags">
        ${topTags.map(([tag, count]) => `<span>${escapeHtml(tag)} <strong>${count}</strong></span>`).join("") || `<p class="caption">No tags yet.</p>`}
      </div>
    </article>
    <article class="analytics-panel">
      <h3>Top uploaders</h3>
      <div class="uploader-list">
        ${topUploaders.map(item => `<span><strong>${escapeHtml(item.name)}</strong><small>${item.count} uploads</small></span>`).join("") || `<p class="caption">No uploader data yet.</p>`}
      </div>
    </article>
    <article class="analytics-panel">
      <h3>Cloud status</h3>
      <div class="cloud-analytics">
        <span><strong>${escapeHtml(cloud.provider || "AWS S3")}</strong><small>${escapeHtml(cloud.mode || "demo")}</small></span>
        <span><strong>${escapeHtml(cloud.bucket || state.settings.bucket || "No bucket")}</strong><small>${escapeHtml(cloud.connected ? "Connected" : "Demo/local mode")}</small></span>
      </div>
    </article>
  `;
}

async function findFaces() {
  const selected = $("#faceUser").value;
  const selfie = $("#selfieInput").files[0];
  const profile = state.users.find(user => user.faceToken === selected);
  $("#faceConfidence").textContent = "Scanning";
  $(".face-score-card").style.setProperty("--confidence", "12%");
  $("#clearFaceMatchesButton").classList.add("hidden");
  $("#faceResultText").textContent = selfie
    ? "Analyzing the reference selfie and visible media."
    : "Checking visible media against the selected profile.";
  let referenceSignature = null;
  let referenceHash = "";
  if (selfie) {
    const referenceDataUrl = await fileToDataUrl(selfie);
    referenceHash = await hashText(referenceDataUrl);
    referenceSignature = await createVisualSignature(referenceDataUrl).catch(() => null);
  }
  const result = await api("/api/face-match", {
    method: "POST",
    body: JSON.stringify({
      faceToken: selected,
      referenceName: selfie?.name || "Selected profile",
      referenceSignature,
      referenceHash
    })
  });
  const confidence = Math.round(result.confidence * 100);
  $("#faceConfidence").textContent = `${confidence}%`;
  $(".face-score-card").style.setProperty("--confidence", `${confidence}%`);
  $("#faceResultText").textContent = `${result.totalMatched || result.matches.length} matched photo${(result.totalMatched || result.matches.length) === 1 ? "" : "s"} found${profile ? ` for ${profile.name}` : ""}.`;
  renderGallery(result.matches, $("#faceMatches"));
  $("#clearFaceMatchesButton").classList.remove("hidden");
}

function renderFacePlaceholder() {
  if ($("#faceMatches").children.length) return;
  $("#faceMatches").innerHTML = `
    <div class="face-empty">
      <strong>No scan yet</strong>
      <p class="caption">Matched photos will appear here after you choose a profile.</p>
    </div>
  `;
}

function clearFaceMatches() {
  $("#selfieInput").value = "";
  $("#selfiePreview").innerHTML = "<span>Reference preview</span>";
  $("#faceConfidence").textContent = "--";
  $(".face-score-card").style.setProperty("--confidence", "0%");
  $("#faceResultText").textContent = "Choose a profile to scan visible media.";
  $("#faceMatches").innerHTML = "";
  $("#clearFaceMatchesButton").classList.add("hidden");
  renderFacePlaceholder();
}

function previewSelfie(event) {
  const file = event.target.files[0];
  const preview = $("#selfiePreview");
  if (!file) {
    preview.innerHTML = "<span>Reference preview</span>";
    return;
  }
  preview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="${escapeHtml(file.name)}">`;
}

function setView(name) {
  $$(".view").forEach(view => view.classList.toggle("active", view.id === `${name}View`));
  $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === name));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function openEventDialog(eventItem = null) {
  const form = $("#eventForm");
  form.reset();
  form.dataset.mode = eventItem ? "edit" : "create";
  $("#eventDialogTitle").textContent = eventItem ? "Edit event" : "Create event";
  $("#eventSubmitButton").textContent = eventItem ? "Save changes" : "Create event";
  $("#eventId").value = eventItem?.id || "";
  form.elements.name.value = eventItem?.name || "";
  form.elements.category.value = eventItem?.category || "";
  form.elements.date.value = eventItem?.date || "";
  form.elements.location.value = eventItem?.location || "";
  form.elements.description.value = eventItem?.description || "";
  form.elements.visibility.value = eventItem?.visibility || "public";
  $("#eventDialog").showModal();
}

async function saveEvent(event) {
  event.preventDefault();
  const form = $("#eventForm");
  const body = Object.fromEntries(new FormData(form));
  const eventId = body.id;
  delete body.id;
  const path = eventId ? `/api/events/${eventId}` : "/api/events";
  const method = eventId ? "PATCH" : "POST";
  await api(path, { method, body: JSON.stringify(body) });
  $("#eventDialog").close();
  form.reset();
  await bootstrap();
}

async function deleteAlbum(albumId) {
  const album = state.albums.find(item => item.id === albumId);
  if (!album) return;
  const mediaCount = state.media.filter(item => item.albumId === albumId).length;
  const message = mediaCount
    ? `Delete album "${album.title}" and ${mediaCount} media item${mediaCount === 1 ? "" : "s"} inside it?`
    : `Delete album "${album.title}"?`;
  if (!confirm(message)) return;
  await api(`/api/albums/${albumId}`, { method: "DELETE" });
  await bootstrap();
}

function openAlbumDialog(eventId = state.selectedEventId) {
  const form = $("#albumForm");
  form.reset();
  renderCollaboratorChoices($("#albumCollaborators"), [state.userId]);
  if (eventId && state.events.some(event => event.id === eventId)) {
    $("#albumEvent").value = eventId;
  }
  $("#albumDialog").showModal();
}

async function createAlbum(event) {
  event.preventDefault();
  const form = $("#albumForm");
  const formData = new FormData(form);
  const body = {
    eventId: formData.get("eventId"),
    title: formData.get("title"),
    description: formData.get("description"),
    collaborators: formData.getAll("collaborators")
  };
  await api("/api/albums", { method: "POST", body: JSON.stringify(body) });
  $("#albumDialog").close();
  form.reset();
  state.selectedEventId = body.eventId;
  state.selectedAlbumId = "";
  await bootstrap();
}

function renderCollaboratorChoices(container, selectedIds = []) {
  const selected = new Set(selectedIds);
  container.innerHTML = state.users
    .filter(user => user.role !== "Viewer")
    .map(user => `
      <label class="collaborator-option">
        <input type="checkbox" name="collaborators" value="${user.id}" ${selected.has(user.id) ? "checked" : ""}>
        <span>${escapeHtml(user.name)}</span>
        <small>${escapeHtml(user.role)}</small>
      </label>
    `).join("");
}

function openCollaboratorDialog(albumId) {
  const album = state.albums.find(item => item.id === albumId);
  if (!album || !canManageAlbum(album)) return;
  $("#collaboratorAlbumId").value = album.id;
  $("#collaboratorAlbumName").textContent = album.title;
  renderCollaboratorChoices($("#collaboratorOptions"), album.collaborators || []);
  $("#collaboratorDialog").showModal();
}

async function saveCollaborators(event) {
  event.preventDefault();
  const form = $("#collaboratorForm");
  const formData = new FormData(form);
  const albumId = formData.get("albumId");
  await api(`/api/albums/${albumId}/collaborators`, {
    method: "PATCH",
    body: JSON.stringify({ collaborators: formData.getAll("collaborators") })
  });
  $("#collaboratorDialog").close();
  await bootstrap();
}

function openUserDialog() {
  if (!canCreateEvent()) return alert("Only admins can manage people.");
  const form = $("#userForm");
  form.reset();
  form.elements.role.value = "Club Member";
  renderUserDirectory();
  $("#userDialog").showModal();
}

function renderUserDirectory() {
  const container = $("#userDirectory");
  if (!container) return;
  const adminCount = state.users.filter(user => user.role === "Admin").length;
  container.innerHTML = state.users.map(user => {
    const isCurrentUser = user.id === state.userId;
    const isLastAdmin = user.role === "Admin" && adminCount <= 1;
    const canDeleteUser = canCreateEvent() && !isCurrentUser && !isLastAdmin;
    return `
      <article class="user-row">
        <div class="user-avatar">${escapeHtml(user.avatar || user.name.slice(0, 2).toUpperCase())}</div>
        <div>
          <strong>${escapeHtml(user.name)}</strong>
          <small>${escapeHtml(user.role)}${isCurrentUser ? " | Current" : ""}</small>
        </div>
        <button type="button" class="ghost-button compact-button danger-button" data-user-delete="${user.id}" ${canDeleteUser ? "" : "disabled"}>${isLastAdmin ? "Required" : "Delete"}</button>
      </article>
    `;
  }).join("");

  container.querySelectorAll("[data-user-delete]").forEach(button => {
    button.addEventListener("click", () => deleteUser(button.dataset.userDelete));
  });
}

async function createUser(event) {
  event.preventDefault();
  if (!canCreateEvent()) return alert("Only admins can add people.");
  const form = $("#userForm");
  const formData = new FormData(form);
  const name = formData.get("name").trim();
  const role = formData.get("role");
  if (!name) return;
  await api("/api/users", {
    method: "POST",
    body: JSON.stringify({ name, role })
  });
  form.reset();
  form.elements.role.value = "Club Member";
  await bootstrap();
}

async function deleteUser(userId) {
  const user = state.users.find(item => item.id === userId);
  if (!user) return;
  if (!confirm(`Delete ${user.name} from the platform? Their likes, comments, notifications, and album access will be removed.`)) return;
  await api(`/api/users/${userId}`, { method: "DELETE" });
  await bootstrap();
}

function bindEvents() {
  $$(".nav-item").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
  $("#userSelect").addEventListener("change", async event => {
    state.userId = event.target.value;
    localStorage.setItem("cig-user", state.userId);
    await bootstrap();
  });
  ["searchInput", "tagFilter", "dateFilter"].forEach(id => $(`#${id}`).addEventListener("input", () => {
    state.visibleCount = 6;
    renderGallery();
  }));
  $("#eventSort").addEventListener("change", renderEvents);
  $("#loadMoreButton").addEventListener("click", loadMoreMedia);
  $("#uploadEvent").addEventListener("change", renderAlbumOptions);
  $("#fileInput").addEventListener("change", event => handleFiles(event.target.files));
  $("#uploadForm").addEventListener("submit", publishUploads);
  $("#selfieInput").addEventListener("change", previewSelfie);
  $("#findFacesButton").addEventListener("click", findFaces);
  $("#clearFaceMatchesButton").addEventListener("click", clearFaceMatches);
  $("#newEventButton").addEventListener("click", () => canCreateEvent() && openEventDialog());
  $("#newAlbumButton").addEventListener("click", () => canCreateAlbum() && openAlbumDialog());
  $("#manageUsersButton").addEventListener("click", openUserDialog);
  $("#cancelEventButton").addEventListener("click", () => $("#eventDialog").close());
  $("#cancelAlbumButton").addEventListener("click", () => $("#albumDialog").close());
  $("#cancelCollaboratorButton").addEventListener("click", () => $("#collaboratorDialog").close());
  $("#cancelUserButton").addEventListener("click", () => $("#userDialog").close());
  $("#eventForm").addEventListener("submit", saveEvent);
  $("#albumForm").addEventListener("submit", createAlbum);
  $("#collaboratorForm").addEventListener("submit", saveCollaborators);
  $("#userForm").addEventListener("submit", createUser);
  $("#closeShareModal").addEventListener("click", closeShareModal);
  $("#copyShareLink").addEventListener("click", copyShareLink);
  $("#shareModal").addEventListener("click", event => {
    if (event.target === $("#shareModal")) closeShareModal();
  });
  $("#mediaViewer").addEventListener("click", event => {
    if (event.target === $("#mediaViewer")) closeMediaViewer();
  });
  $("#mediaViewerClose").addEventListener("click", closeMediaViewer);
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (!$("#shareModal").classList.contains("hidden")) closeShareModal();
    if (!$("#mediaViewer").classList.contains("hidden")) closeMediaViewer();
  });
  $("#notificationButton").addEventListener("click", async () => {
    $("#notificationPanel").classList.toggle("hidden");
    await api("/api/notifications/read", { method: "POST", body: "{}" });
    const data = await api("/api/bootstrap");
    state.notifications = data.notifications;
    renderNotifications();
  });

  const dropZone = $("#dropZone");
  ["dragenter", "dragover"].forEach(type => dropZone.addEventListener(type, event => {
    event.preventDefault();
    dropZone.classList.add("dragover");
  }));
  ["dragleave", "drop"].forEach(type => dropZone.addEventListener(type, event => {
    event.preventDefault();
    dropZone.classList.remove("dragover");
  }));
  dropZone.addEventListener("drop", event => handleFiles(event.dataTransfer.files));
  initInfiniteScroll();
  startNotificationPolling();
}

async function loadCloudStatus() {
  const status = await api("/api/cloud/status");
  $("#cloudProvider").textContent = "Cloud Integration";
  $("#cloudProviderValue").textContent = status.provider || "AWS S3";
  $("#cloudBucket").textContent = status.bucket || "No bucket";
  $("#cloudMode").textContent = status.connected ? "Connected" : `${status.mode || "demo"} mode`;
  $("#cloudMode").className = status.connected ? "connected" : "demo";
  $("#cloudText").textContent = status.message;
}

bindEvents();
bootstrap().then(loadCloudStatus).catch(error => {
  document.body.innerHTML = `<main class="main"><h1>Startup error</h1><p>${escapeHtml(error.message)}</p></main>`;
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
