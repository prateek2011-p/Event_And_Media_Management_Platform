const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_FILE = path.join(ROOT, "data", "db.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

const USER_ROLES = ["Admin", "Photographer", "Club Member", "Viewer"];

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
}

function now() {
  return new Date().toISOString();
}

function seedDb() {
  const createdAt = now();
  return {
    settings: {
      clubName: "Creative Ink Guild",
      cloudProvider: "AWS S3",
      bucket: process.env.S3_BUCKET || "demo-cigma-media",
      cloudMode: process.env.S3_BUCKET ? "configured" : "demo",
      watermarkEnabled: true
    },
    users: [
      { id: "u_admin", name: "Aarav Admin", role: "Admin", avatar: "AA", faceToken: "blue-crowd" },
      { id: "u_photo", name: "Mira Photographer", role: "Photographer", avatar: "MP", faceToken: "green-stage" },
      { id: "u_member", name: "Rhea Member", role: "Club Member", avatar: "RM", faceToken: "pink-workshop" },
      { id: "u_viewer", name: "Vihaan Viewer", role: "Viewer", avatar: "VV", faceToken: "yellow-public" }
    ],
    events: [
      {
        id: "evt_fest",
        name: "Spring Cultural Fest",
        category: "Cultural Fest",
        date: "2026-04-22",
        visibility: "public",
        description: "Main stage performances, backstage candids, stalls, and crowd moments.",
        location: "Open Air Theatre",
        coverColor: "#3b82f6",
        albumIds: ["alb_fest_main"]
      },
      {
        id: "evt_workshop",
        name: "Portrait Lighting Workshop",
        category: "Workshop",
        date: "2026-05-08",
        visibility: "private",
        description: "Hands-on studio lighting practice for club members and photographers.",
        location: "Media Lab",
        coverColor: "#ef4444",
        albumIds: ["alb_workshop"]
      },
      {
        id: "evt_trip",
        name: "Hillside Photo Walk",
        category: "Trip",
        date: "2026-03-16",
        visibility: "public",
        description: "Landscape shots, trail portraits, and sunrise timelapses.",
        location: "Nandi Hills",
        coverColor: "#22c55e",
        albumIds: ["alb_trip"]
      }
    ],
    albums: [
      { id: "alb_fest_main", eventId: "evt_fest", title: "Main Stage", description: "Performances and crowd energy.", collaborators: ["u_admin", "u_photo"] },
      { id: "alb_workshop", eventId: "evt_workshop", title: "Studio Practice", description: "Portrait setups and member practice shots.", collaborators: ["u_admin", "u_photo", "u_member"] },
      { id: "alb_trip", eventId: "evt_trip", title: "Trail Highlights", description: "Landscapes, group photos, and travel reels.", collaborators: ["u_photo"] }
    ],
    media: [
      {
        id: "med_stage",
        eventId: "evt_fest",
        albumId: "alb_fest_main",
        type: "photo",
        title: "Finale Lights",
        dataUrl: "",
        thumbnail: "",
        gradient: ["#2563eb", "#f59e0b"],
        tags: ["stage", "crowd", "music", "festival"],
        aiCaption: "A bright stage finale with a cheering campus crowd.",
        uploadedBy: "u_photo",
        uploadedAt: "2026-04-22T18:30:00.000Z",
        visibility: "public",
        faceTokens: ["green-stage", "yellow-public"],
        sizeKb: 420,
        likes: ["u_member", "u_viewer"],
        favourites: ["u_member"],
        comments: [{ id: "c1", userId: "u_member", text: "This one should be on the fest poster.", createdAt }]
      },
      {
        id: "med_portrait",
        eventId: "evt_workshop",
        albumId: "alb_workshop",
        type: "photo",
        title: "Softbox Portrait",
        dataUrl: "",
        thumbnail: "",
        gradient: ["#dc2626", "#111827"],
        tags: ["portrait", "workshop", "studio", "lighting"],
        aiCaption: "A focused portrait setup with warm side lighting.",
        uploadedBy: "u_admin",
        uploadedAt: "2026-05-08T10:20:00.000Z",
        visibility: "private",
        faceTokens: ["pink-workshop"],
        sizeKb: 530,
        likes: ["u_photo"],
        favourites: [],
        comments: []
      },
      {
        id: "med_hills",
        eventId: "evt_trip",
        albumId: "alb_trip",
        type: "photo",
        title: "Sunrise Ridge",
        dataUrl: "",
        thumbnail: "",
        gradient: ["#16a34a", "#f97316"],
        tags: ["mountains", "sunrise", "trip", "landscape"],
        aiCaption: "Club members pause along a green ridge during sunrise.",
        uploadedBy: "u_photo",
        uploadedAt: "2026-03-16T06:45:00.000Z",
        visibility: "public",
        faceTokens: ["blue-crowd", "green-stage"],
        sizeKb: 610,
        likes: [],
        favourites: ["u_viewer"],
        comments: []
      }
    ],
    notifications: [
      { id: "n_seed", userId: "u_photo", text: "Rhea Member liked your photo Finale Lights", read: false, createdAt }
    ],
    shares: []
  };
}

function ensureDb() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(seedDb(), null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 10 * 1024 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function currentUser(db, req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = req.headers["x-user-id"] || url.searchParams.get("userId") || "u_viewer";
  return db.users.find(user => user.id === userId) ||
    db.users.find(user => user.id === "u_viewer") ||
    db.users[0] ||
    { id: "guest", name: "Guest Viewer", role: "Viewer", avatar: "GV", faceToken: "guest-viewer" };
}

function canViewEvent(user, event) {
  if (event.visibility === "public") return true;
  return ["Admin", "Photographer", "Club Member"].includes(user.role);
}

function canUpload(user) {
  return ["Admin", "Photographer"].includes(user.role);
}

function canManage(user) {
  return user.role === "Admin";
}

function normalizeRole(role = "Club Member") {
  return USER_ROLES.includes(role) ? role : "Club Member";
}

function userAvatar(name = "User") {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
  return initials || "U";
}

function userFaceToken(name = "user", role = "Club Member") {
  const slug = `${name} ${role}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28) || "user";
  return `${slug}-${crypto.randomBytes(3).toString("hex")}`;
}

function visibleMedia(db, user) {
  const events = new Map(db.events.map(event => [event.id, event]));
  return db.media.filter(item => {
    const event = events.get(item.eventId);
    return event && canViewEvent(user, event) && (item.visibility === "public" || canViewEvent(user, { visibility: item.visibility }));
  });
}

function publicMedia(item, db) {
  const user = db.users.find(u => u.id === item.uploadedBy);
  const shareCount = (item.shares || 0) || (db.shares || []).filter(share => share.mediaId === item.id).length;
  return {
    ...item,
    uploaderName: user ? user.name : "Unknown",
    downloadCount: item.downloads || 0,
    shareCount,
    comments: (item.comments || []).map(comment => ({
      ...comment,
      userName: db.users.find(u => u.id === comment.userId)?.name || "Unknown"
    }))
  };
}

function notify(db, userId, text) {
  db.notifications.unshift({ id: id("not"), userId, text, read: false, createdAt: now() });
}

function inferTags(name, type) {
  const lower = `${name} ${type}`.toLowerCase();
  const dictionary = [
    ["mountain", "mountains"],
    ["hill", "mountains"],
    ["beach", "beaches"],
    ["sport", "sports"],
    ["football", "sports"],
    ["crowd", "crowd"],
    ["stage", "stage"],
    ["music", "music"],
    ["workshop", "workshop"],
    ["portrait", "portrait"],
    ["party", "party"],
    ["food", "food"],
    ["dance", "dance"],
    ["video", "video"]
  ];
  const tags = dictionary.filter(([needle]) => lower.includes(needle)).map(([, tag]) => tag);
  if (!tags.length) tags.push(type === "video" ? "video" : "campus");
  return [...new Set(tags)];
}

function aiCaption(title, tags, eventName = "the event") {
  const normalizedTags = tags.map(tag => tag.toLowerCase());
  const cleanEvent = eventName || "the event";
  const cleanTitle = title ? title.replace(/[-_]+/g, " ").replace(/\.[^.]+$/, "").trim() : "This moment";
  if (normalizedTags.some(tag => ["stage", "music", "crowd", "festival"].includes(tag))) {
    return `Crowd gathering around the main stage during ${cleanEvent}.`;
  }
  if (normalizedTags.some(tag => ["dance", "party", "cultural"].includes(tag))) {
    return `Students enjoying cultural performances during ${cleanEvent}.`;
  }
  if (normalizedTags.some(tag => ["portrait", "workshop", "lighting"].includes(tag))) {
    return `A focused portrait session with members practicing lighting during ${cleanEvent}.`;
  }
  if (normalizedTags.some(tag => ["mountains", "sunrise", "landscape", "trip"].includes(tag))) {
    return `Club members capturing scenic outdoor memories during ${cleanEvent}.`;
  }
  if (normalizedTags.some(tag => ["sports", "football"].includes(tag))) {
    return `An energetic sports moment with participants in action during ${cleanEvent}.`;
  }
  if (normalizedTags.includes("video")) {
    return `A short event video preserving the movement and atmosphere of ${cleanEvent}.`;
  }
  return `${cleanTitle} captures a meaningful club moment from ${cleanEvent}.`;
}

function hashDataUrl(dataUrl = "") {
  if (!dataUrl) return "";
  return crypto.createHash("sha256").update(dataUrl).digest("hex");
}

function mediaExactHash(item) {
  return item.exactHash || hashDataUrl(item.dataUrl || "");
}

function normalizeCollaborators(db, collaboratorIds = [], fallbackUserId = "") {
  const validIds = new Set(db.users.map(user => user.id));
  const requested = Array.isArray(collaboratorIds) ? collaboratorIds : [collaboratorIds];
  const normalized = requested.filter(userId => validIds.has(userId));
  if (fallbackUserId && validIds.has(fallbackUserId)) normalized.unshift(fallbackUserId);
  return [...new Set(normalized)];
}

function cloudStatus(db) {
  const configuredBucket = process.env.S3_BUCKET || db.settings.bucket;
  const configuredMode = process.env.S3_BUCKET ? "configured" : db.settings.cloudMode;
  return {
    provider: db.settings.cloudProvider,
    mode: configuredMode,
    bucket: configuredBucket,
    region: process.env.AWS_REGION || "",
    connected: configuredMode === "configured",
    message: configuredMode === "configured"
      ? `S3 bucket ${configuredBucket} detected through environment configuration.`
      : "Local mode stores media data in JSON; set S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY for S3."
  };
}

function hammingSimilarity(a = "", b = "") {
  if (!a || !b || a.length !== b.length) return 0;
  let same = 0;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] === b[index]) same += 1;
  }
  return same / a.length;
}

function colorSimilarity(a = [], b = []) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length < 3 || b.length < 3) return 0;
  const distance = Math.sqrt(
    ((a[0] || 0) - (b[0] || 0)) ** 2 +
    ((a[1] || 0) - (b[1] || 0)) ** 2 +
    ((a[2] || 0) - (b[2] || 0)) ** 2
  );
  return Math.max(0, 1 - distance / 441.7);
}

function compareVisualSignatures(reference, candidate) {
  if (!reference || !candidate) return 0;
  const hashScore = hammingSimilarity(reference.hash, candidate.hash);
  const colorScore = colorSimilarity(reference.averageColor, candidate.averageColor);
  const brightnessScore = 1 - Math.min(1, Math.abs((reference.brightness || 0) - (candidate.brightness || 0)) / 255);
  return Math.max(0, Math.min(1, (hashScore * 0.56) + (colorScore * 0.3) + (brightnessScore * 0.14)));
}

function faceMatchScore(item, token, referenceSignature, referenceHash) {
  const reasons = [];
  const tokenMatched = token && (item.faceTokens || []).includes(token);
  if (tokenMatched) reasons.push("profile token");
  if (referenceHash && item.exactHash && referenceHash === item.exactHash) reasons.push("exact reference image");
  const visualScore = compareVisualSignatures(referenceSignature, item.visualSignature);
  if (visualScore >= 0.72) reasons.push("strong visual similarity");
  if (visualScore >= 0.58 && visualScore < 0.72) reasons.push("visual similarity");
  const exactScore = referenceHash && item.exactHash && referenceHash === item.exactHash ? 1 : 0;
  const profileScore = tokenMatched ? 0.74 : 0;
  const combined = Math.max(exactScore, profileScore + (visualScore * 0.24), visualScore * 0.88);
  return {
    score: Math.max(0, Math.min(0.99, combined)),
    reasons
  };
}

function eventColor(seed) {
  const colors = ["#7c3aed", "#db2777", "#f97316", "#0891b2", "#16a34a", "#2563eb", "#e11d48"];
  const text = seed || "event";
  const total = [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[total % colors.length];
}

function routeStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, "Forbidden");
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, "Not found");
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

async function routeApi(req, res) {
  const db = readDb();
  const user = currentUser(db, req);
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);
  const method = req.method;

  try {
    if (method === "GET" && url.pathname === "/api/bootstrap") {
      const events = db.events.filter(event => canViewEvent(user, event));
      const eventIds = new Set(events.map(event => event.id));
      return send(res, 200, {
        currentUser: user,
        users: db.users,
        settings: db.settings,
        events,
        albums: db.albums.filter(album => eventIds.has(album.eventId)),
        media: visibleMedia(db, user).map(item => publicMedia(item, db)),
        notifications: db.notifications.filter(item => item.userId === user.id),
        analytics: buildAnalytics(db, user)
      });
    }

    if (method === "GET" && url.pathname === "/api/search") {
      const q = (url.searchParams.get("q") || "").toLowerCase();
      const tag = (url.searchParams.get("tag") || "").toLowerCase();
      const uploader = (url.searchParams.get("uploader") || "").toLowerCase();
      const date = url.searchParams.get("date") || "";
      const results = visibleMedia(db, user).filter(item => {
        const event = db.events.find(evt => evt.id === item.eventId);
        const uploadUser = db.users.find(u => u.id === item.uploadedBy);
        const haystack = [item.title, event?.name, item.tags.join(" "), uploadUser?.name].join(" ").toLowerCase();
        return (!q || haystack.includes(q)) &&
          (!tag || item.tags.some(t => t.toLowerCase().includes(tag))) &&
          (!uploader || (uploadUser?.name || "").toLowerCase().includes(uploader)) &&
          (!date || item.uploadedAt.startsWith(date));
      }).map(item => publicMedia(item, db));
      return send(res, 200, { results });
    }

    if (method === "GET" && url.pathname === "/api/cloud/status") {
      return send(res, 200, cloudStatus(db));
    }

    if (method === "POST" && url.pathname === "/api/users") {
      if (!canManage(user)) return send(res, 403, { error: "Only admins can add people." });
      const body = await readJson(req);
      const name = String(body.name || "").trim();
      if (!name) return send(res, 400, { error: "Name is required." });
      const role = normalizeRole(body.role);
      const newUser = {
        id: id("usr"),
        name: name.slice(0, 80),
        role,
        avatar: userAvatar(name),
        faceToken: userFaceToken(name, role)
      };
      db.users.push(newUser);
      writeDb(db);
      return send(res, 201, { user: newUser });
    }

    if (method === "DELETE" && parts[0] === "api" && parts[1] === "users" && parts[2]) {
      if (!canManage(user)) return send(res, 403, { error: "Only admins can delete people." });
      const target = db.users.find(item => item.id === parts[2]);
      if (!target) return send(res, 404, { error: "User not found." });
      if (target.id === user.id) return send(res, 400, { error: "Switch to another admin before deleting this account." });
      if (target.role === "Admin" && db.users.filter(item => item.role === "Admin").length <= 1) {
        return send(res, 400, { error: "At least one admin must remain." });
      }

      db.users = db.users.filter(item => item.id !== target.id);
      db.albums.forEach(album => {
        album.collaborators = (album.collaborators || []).filter(userId => userId !== target.id);
      });
      db.media.forEach(item => {
        item.likes = (item.likes || []).filter(userId => userId !== target.id);
        item.favourites = (item.favourites || []).filter(userId => userId !== target.id);
        item.comments = (item.comments || []).filter(comment => comment.userId !== target.id);
        item.faceTokens = (item.faceTokens || []).filter(token => token !== target.faceToken);
      });
      db.notifications = db.notifications.filter(item => item.userId !== target.id);
      db.shares = (db.shares || []).filter(item => item.createdBy !== target.id);
      writeDb(db);
      return send(res, 200, { userId: target.id });
    }

    if (method === "POST" && url.pathname === "/api/events") {
      if (!canManage(user)) return send(res, 403, { error: "Only admins can create events." });
      const body = await readJson(req);
      const event = {
        id: id("evt"),
        name: body.name || "Untitled Event",
        category: body.category || "General",
        date: body.date || new Date().toISOString().slice(0, 10),
        visibility: body.visibility === "private" ? "private" : "public",
        description: body.description || "",
        location: body.location || "",
        coverColor: body.coverColor || eventColor(body.name),
        albumIds: []
      };
      db.events.unshift(event);
      writeDb(db);
      return send(res, 201, { event });
    }

    if (method === "PATCH" && parts[0] === "api" && parts[1] === "events" && parts[2]) {
      if (!canManage(user)) return send(res, 403, { error: "Only admins can edit events." });
      const event = db.events.find(evt => evt.id === parts[2]);
      if (!event) return send(res, 404, { error: "Event not found." });
      const body = await readJson(req);
      event.name = body.name?.trim() || event.name;
      event.category = body.category?.trim() || event.category;
      event.date = body.date || event.date;
      event.visibility = body.visibility === "private" ? "private" : "public";
      event.description = "description" in body ? body.description || "" : event.description;
      event.location = "location" in body ? body.location || "" : event.location;
      if (body.coverColor) event.coverColor = body.coverColor;
      writeDb(db);
      return send(res, 200, { event });
    }

    if (method === "POST" && url.pathname === "/api/albums") {
      const body = await readJson(req);
      const event = db.events.find(evt => evt.id === body.eventId);
      if (!event || !canViewEvent(user, event)) return send(res, 404, { error: "Event not found." });
      if (!["Admin", "Photographer"].includes(user.role)) return send(res, 403, { error: "Only admins and photographers can create albums." });
      const album = {
        id: id("alb"),
        eventId: event.id,
        title: body.title || "New Album",
        description: body.description || "",
        collaborators: normalizeCollaborators(db, body.collaborators, user.id)
      };
      db.albums.unshift(album);
      event.albumIds.push(album.id);
      writeDb(db);
      return send(res, 201, { album });
    }

    if (method === "PATCH" && parts[0] === "api" && parts[1] === "albums" && parts[2] && parts[3] === "collaborators") {
      const album = db.albums.find(item => item.id === parts[2]);
      if (!album) return send(res, 404, { error: "Album not found." });
      const event = db.events.find(evt => evt.id === album.eventId);
      const canManageCollaborators = user.role === "Admin" || (album.collaborators || []).includes(user.id);
      if (!event || !canViewEvent(user, event) || !canManageCollaborators) {
        return send(res, 403, { error: "Only admins and album collaborators can manage collaborators." });
      }
      const body = await readJson(req);
      album.collaborators = normalizeCollaborators(db, body.collaborators, user.id);
      writeDb(db);
      return send(res, 200, { album });
    }

    if (method === "DELETE" && parts[0] === "api" && parts[1] === "albums" && parts[2]) {
      const album = db.albums.find(item => item.id === parts[2]);
      if (!album) return send(res, 404, { error: "Album not found." });
      const event = db.events.find(evt => evt.id === album.eventId);
      const canDeleteAlbum = user.role === "Admin" || (album.collaborators || []).includes(user.id);
      if (!canDeleteAlbum || !event || !canViewEvent(user, event)) {
        return send(res, 403, { error: "Only admins and album collaborators can delete this album." });
      }
      const deletedMediaIds = new Set(db.media.filter(item => item.albumId === album.id).map(item => item.id));
      db.media = db.media.filter(item => item.albumId !== album.id);
      db.shares = (db.shares || []).filter(share => !deletedMediaIds.has(share.mediaId));
      db.albums = db.albums.filter(item => item.id !== album.id);
      event.albumIds = event.albumIds.filter(id => id !== album.id);
      writeDb(db);
      return send(res, 200, { albumId: album.id, deletedMedia: deletedMediaIds.size });
    }

    if (method === "POST" && url.pathname === "/api/media/check-duplicates") {
      const body = await readJson(req);
      const exactHash = body.exactHash || hashDataUrl(body.dataUrl || "");
      const duplicates = exactHash
        ? visibleMedia(db, user)
          .filter(item => mediaExactHash(item) === exactHash)
          .map(item => publicMedia(item, db))
        : [];
      return send(res, 200, { duplicates });
    }

    if (method === "POST" && url.pathname === "/api/media") {
      if (!canUpload(user)) return send(res, 403, { error: "Only admins and photographers can upload media." });
      const body = await readJson(req);
      const event = db.events.find(evt => evt.id === body.eventId);
      const album = db.albums.find(alb => alb.id === body.albumId);
      if (!event || !album || album.eventId !== event.id) return send(res, 400, { error: "Choose a valid event and album." });
      const tags = [...new Set([...(body.tags || []), ...inferTags(body.title || body.fileName || "", body.type || "photo")])];
      const exactHash = body.exactHash || hashDataUrl(body.dataUrl || "");
      const duplicate = exactHash ? db.media.find(item => mediaExactHash(item) === exactHash) : null;
      const item = {
        id: id("med"),
        eventId: event.id,
        albumId: album.id,
        type: body.type === "video" ? "video" : "photo",
        title: body.title || body.fileName || "Untitled upload",
        dataUrl: body.dataUrl || "",
        thumbnail: body.thumbnail || "",
        gradient: body.gradient || ["#0ea5e9", "#14b8a6"],
        tags,
        aiCaption: aiCaption(body.title || body.fileName, tags, event.name),
        uploadedBy: user.id,
        uploadedAt: now(),
        visibility: body.visibility === "private" ? "private" : event.visibility,
        faceTokens: body.faceTokens || [user.faceToken],
        sizeKb: body.sizeKb || 0,
        exactHash,
        duplicateOf: duplicate?.id || "",
        visualSignature: body.visualSignature || null,
        downloads: 0,
        shares: 0,
        likes: [],
        favourites: [],
        comments: []
      };
      db.media.unshift(item);
      db.users.filter(member => member.id !== user.id && member.role !== "Viewer").forEach(member => {
        notify(db, member.id, `${user.name} uploaded ${item.title} to ${event.name}`);
      });
      writeDb(db);
      return send(res, 201, { media: publicMedia(item, db) });
    }

    if (method === "POST" && parts[0] === "api" && parts[1] === "media" && parts[3]) {
      const media = db.media.find(item => item.id === parts[2]);
      if (!media) return send(res, 404, { error: "Media not found." });
      const event = db.events.find(evt => evt.id === media.eventId);
      if (!canViewEvent(user, event)) return send(res, 403, { error: "You do not have access to this media." });
      const action = parts[3];
      if (action === "like") {
        media.likes = media.likes.includes(user.id) ? media.likes.filter(id => id !== user.id) : [...media.likes, user.id];
        if (media.uploadedBy !== user.id) notify(db, media.uploadedBy, `${user.name} liked your photo ${media.title}`);
      } else if (action === "favourite") {
        media.favourites = media.favourites.includes(user.id) ? media.favourites.filter(id => id !== user.id) : [...media.favourites, user.id];
      } else if (action === "comment") {
        const body = await readJson(req);
        if (!body.text) return send(res, 400, { error: "Comment text is required." });
        media.comments.push({ id: id("com"), userId: user.id, text: body.text.slice(0, 240), createdAt: now() });
        if (media.uploadedBy !== user.id) notify(db, media.uploadedBy, `${user.name} commented on ${media.title}`);
      } else if (action === "tag") {
        const body = await readJson(req);
        const tagged = db.users.find(member => member.id === body.userId);
        if (!tagged) return send(res, 400, { error: "User not found." });
        if (!media.faceTokens.includes(tagged.faceToken)) media.faceTokens.push(tagged.faceToken);
        notify(db, tagged.id, `${user.name} tagged you in ${media.title}`);
      } else if (action === "share") {
        const share = { id: id("shr"), mediaId: media.id, createdBy: user.id, createdAt: now(), url: `/share/${media.id}` };
        media.shares = (media.shares || 0) + 1;
        db.shares.unshift(share);
        writeDb(db);
        return send(res, 201, { share });
      } else if (action === "download") {
        media.downloads = (media.downloads || 0) + 1;
      } else {
        return send(res, 404, { error: "Unknown action." });
      }
      writeDb(db);
      return send(res, 200, { media: publicMedia(media, db), notifications: db.notifications.filter(item => item.userId === user.id) });
    }

    if (method === "POST" && url.pathname === "/api/face-match") {
      const body = await readJson(req);
      const token = body.faceToken || user.faceToken;
      const referenceSignature = body.referenceSignature || null;
      const referenceHash = body.referenceHash || "";
      const scored = visibleMedia(db, user).map(item => {
        const result = faceMatchScore(item, token, referenceSignature, referenceHash);
        return {
          item,
          score: result.score,
          reasons: result.reasons
        };
      });
      const matches = scored
        .filter(result => result.score >= 0.58)
        .sort((a, b) => b.score - a.score)
        .map(result => ({
          ...publicMedia(result.item, db),
          matchConfidence: Math.round(result.score * 100),
          matchReasons: result.reasons
        }));
      const averageConfidence = matches.length
        ? matches.reduce((sum, item) => sum + item.matchConfidence, 0) / matches.length / 100
        : 0.28;
      return send(res, 200, {
        reference: body.referenceName || user.name,
        token,
        confidence: averageConfidence,
        totalMatched: matches.length,
        matches
      });
    }

    if (method === "POST" && url.pathname === "/api/notifications/read") {
      db.notifications.forEach(item => {
        if (item.userId === user.id) item.read = true;
      });
      writeDb(db);
      return send(res, 200, { notifications: db.notifications.filter(item => item.userId === user.id) });
    }

    return send(res, 404, { error: "API route not found." });
  } catch (error) {
    return send(res, 500, { error: error.message });
  }
}

function buildAnalytics(db, user) {
  const media = visibleMedia(db, user);
  const events = db.events.filter(event => canViewEvent(user, event));
  const eventIds = new Set(events.map(event => event.id));
  const tags = {};
  const uploaders = {};
  const eventLikes = {};
  media.forEach(item => item.tags.forEach(tag => {
    tags[tag] = (tags[tag] || 0) + 1;
  }));
  media.forEach(item => {
    uploaders[item.uploadedBy] = (uploaders[item.uploadedBy] || 0) + 1;
    eventLikes[item.eventId] = (eventLikes[item.eventId] || 0) + (item.likes || []).length;
  });
  const topTags = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topUploaders = Object.entries(uploaders)
    .map(([userId, count]) => ({ id: userId, name: db.users.find(item => item.id === userId)?.name || "Unknown", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const mostLikedEventEntry = Object.entries(eventLikes).sort((a, b) => b[1] - a[1])[0];
  const mostLikedEvent = mostLikedEventEntry
    ? {
      id: mostLikedEventEntry[0],
      name: db.events.find(event => event.id === mostLikedEventEntry[0])?.name || "Unknown",
      likes: mostLikedEventEntry[1]
    }
    : null;
  const totalDownloads = media.reduce((sum, item) => sum + (item.downloads || 0), 0);
  const totalShares = (db.shares || []).filter(share => media.some(item => item.id === share.mediaId)).length ||
    media.reduce((sum, item) => sum + (item.shares || 0), 0);
  return {
    totalEvents: events.length,
    totalMedia: media.length,
    privateEvents: events.filter(event => event.visibility === "private").length,
    photos: media.filter(item => item.type === "photo").length,
    videos: media.filter(item => item.type === "video").length,
    publicMedia: media.filter(item => item.visibility === "public").length,
    privateMedia: media.filter(item => item.visibility === "private").length,
    storageKb: media.reduce((sum, item) => sum + (item.sizeKb || 0), 0),
    likes: media.reduce((sum, item) => sum + item.likes.length, 0),
    favourites: media.reduce((sum, item) => sum + item.favourites.length, 0),
    comments: media.reduce((sum, item) => sum + item.comments.length, 0),
    totalDownloads,
    totalShares,
    mostLikedEvent,
    mostActiveUploader: topUploaders[0] || null,
    mostUsedTag: topTags[0] ? { tag: topTags[0][0], count: topTags[0][1] } : null,
    topTags,
    topUploaders,
    eventBreakdown: events.map(event => ({
      id: event.id,
      name: event.name,
      visibility: event.visibility,
      albums: db.albums.filter(album => album.eventId === event.id).length,
      media: media.filter(item => item.eventId === event.id).length,
      likes: media.filter(item => item.eventId === event.id).reduce((sum, item) => sum + (item.likes || []).length, 0)
    })).sort((a, b) => b.media - a.media),
    albumCount: db.albums.filter(album => eventIds.has(album.eventId)).length,
    cloudStatus: cloudStatus(db)
  };
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) return routeApi(req, res);
  return routeStatic(req, res);
});

if (require.main === module) {
  ensureDb();
  server.listen(PORT, () => {
    console.log(`Event Media Platform running at http://127.0.0.1:${PORT}`);
  });
}

module.exports = { server, seedDb, buildAnalytics, canViewEvent, inferTags, eventColor, aiCaption, compareVisualSignatures };
