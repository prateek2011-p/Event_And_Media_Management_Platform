const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { server, inferTags, canViewEvent, eventColor, aiCaption, compareVisualSignatures } = require("../server");

const dbPath = path.join(__dirname, "..", "data", "db.json");
let originalDb = "";

async function request(path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${global.port}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await response.json();
  return { response, body };
}

async function main() {
  originalDb = fs.readFileSync(dbPath, "utf8");
  assert.deepStrictEqual(inferTags("mountain workshop video", "video").sort(), ["mountains", "video", "workshop"].sort());
  assert.strictEqual(canViewEvent({ role: "Viewer" }, { visibility: "private" }), false);
  assert.strictEqual(canViewEvent({ role: "Club Member" }, { visibility: "private" }), true);
  assert.ok(eventColor("Freshers Night").startsWith("#"));
  assert.ok(aiCaption("stage crowd", ["stage", "crowd"], "Spring Fest").includes("main stage"));
  assert.ok(compareVisualSignatures(
    { hash: "10101010", averageColor: [100, 120, 140], brightness: 120 },
    { hash: "10101010", averageColor: [102, 119, 141], brightness: 121 }
  ) > 0.9);

  await new Promise(resolve => {
    const instance = server.listen(0, () => {
      global.port = instance.address().port;
      resolve();
    });
  });

  const viewer = await request("/api/bootstrap", { headers: { "X-User-Id": "u_viewer" } });
  assert.strictEqual(viewer.response.status, 200);
  assert.ok(viewer.body.events.every(event => event.visibility === "public"));

  const admin = await request("/api/bootstrap", { headers: { "X-User-Id": "u_admin" } });
  assert.ok(admin.body.events.some(event => event.visibility === "private"));
  assert.ok(Array.isArray(admin.body.analytics.eventBreakdown));
  assert.ok(Array.isArray(admin.body.analytics.topUploaders));
  assert.ok("totalDownloads" in admin.body.analytics);
  assert.ok("totalShares" in admin.body.analytics);
  assert.strictEqual(admin.body.analytics.cloudStatus.provider, "AWS S3");

  const editEvent = await request("/api/events/evt_fest", {
    method: "PATCH",
    headers: { "X-User-Id": "u_admin" },
    body: JSON.stringify({ name: "Spring Cultural Fest Updated", category: "Cultural Fest", date: "2026-04-22", visibility: "public" })
  });
  assert.strictEqual(editEvent.response.status, 200);
  assert.strictEqual(editEvent.body.event.name, "Spring Cultural Fest Updated");

  const uploadDenied = await request("/api/media", {
    method: "POST",
    headers: { "X-User-Id": "u_viewer" },
    body: JSON.stringify({})
  });
  assert.strictEqual(uploadDenied.response.status, 403);

  const cloud = await request("/api/cloud/status", { headers: { "X-User-Id": "u_admin" } });
  assert.strictEqual(cloud.body.provider, "AWS S3");

  const userDenied = await request("/api/users", {
    method: "POST",
    headers: { "X-User-Id": "u_viewer" },
    body: JSON.stringify({ name: "Smoke Viewer", role: "Viewer" })
  });
  assert.strictEqual(userDenied.response.status, 403);

  const newUser = await request("/api/users", {
    method: "POST",
    headers: { "X-User-Id": "u_admin" },
    body: JSON.stringify({ name: "Smoke Viewer", role: "Viewer" })
  });
  assert.strictEqual(newUser.response.status, 201);
  assert.strictEqual(newUser.body.user.role, "Viewer");

  const deleteCurrentAdmin = await request("/api/users/u_admin", {
    method: "DELETE",
    headers: { "X-User-Id": "u_admin" }
  });
  assert.strictEqual(deleteCurrentAdmin.response.status, 400);

  const deleteNewUser = await request(`/api/users/${newUser.body.user.id}`, {
    method: "DELETE",
    headers: { "X-User-Id": "u_admin" }
  });
  assert.strictEqual(deleteNewUser.response.status, 200);

  const album = await request("/api/albums", {
    method: "POST",
    headers: { "X-User-Id": "u_photo" },
    body: JSON.stringify({ eventId: "evt_fest", title: "Smoke Test Album", collaborators: ["u_member"] })
  });
  assert.strictEqual(album.response.status, 201);
  assert.ok(album.body.album.collaborators.includes("u_photo"));
  assert.ok(album.body.album.collaborators.includes("u_member"));

  const collaboratorUpdate = await request(`/api/albums/${album.body.album.id}/collaborators`, {
    method: "PATCH",
    headers: { "X-User-Id": "u_photo" },
    body: JSON.stringify({ collaborators: ["u_photo", "u_admin"] })
  });
  assert.strictEqual(collaboratorUpdate.response.status, 200);
  assert.ok(collaboratorUpdate.body.album.collaborators.includes("u_admin"));

  const dataUrl = "data:image/png;base64,c21va2UtdXBsb2Fk";
  const exactHash = crypto.createHash("sha256").update(dataUrl).digest("hex");
  const upload = await request("/api/media", {
    method: "POST",
    headers: { "X-User-Id": "u_admin" },
    body: JSON.stringify({
      eventId: "evt_fest",
      albumId: album.body.album.id,
      type: "photo",
      title: "stage crowd smoke",
      dataUrl,
      exactHash,
      tags: ["stage", "crowd"],
      visualSignature: { hash: "10101010", averageColor: [100, 120, 140], brightness: 120 }
    })
  });
  assert.strictEqual(upload.response.status, 201);
  assert.strictEqual(upload.body.media.exactHash, exactHash);
  assert.ok(upload.body.media.aiCaption.includes("main stage"));

  const duplicateCheck = await request("/api/media/check-duplicates", {
    method: "POST",
    headers: { "X-User-Id": "u_admin" },
    body: JSON.stringify({ exactHash })
  });
  assert.strictEqual(duplicateCheck.response.status, 200);
  assert.ok(duplicateCheck.body.duplicates.some(item => item.id === upload.body.media.id));

  const share = await request(`/api/media/${upload.body.media.id}/share`, {
    method: "POST",
    headers: { "X-User-Id": "u_admin" },
    body: "{}"
  });
  assert.strictEqual(share.response.status, 201);

  const download = await request(`/api/media/${upload.body.media.id}/download`, {
    method: "POST",
    headers: { "X-User-Id": "u_admin" },
    body: "{}"
  });
  assert.strictEqual(download.response.status, 200);

  const face = await request("/api/face-match", {
    method: "POST",
    headers: { "X-User-Id": "u_admin" },
    body: JSON.stringify({
      faceToken: "blue-crowd",
      referenceSignature: { hash: "10101010", averageColor: [100, 120, 140], brightness: 120 }
    })
  });
  assert.strictEqual(face.response.status, 200);
  assert.ok(face.body.totalMatched >= 1);
  assert.ok(face.body.matches.some(item => typeof item.matchConfidence === "number"));

  const postActionAnalytics = await request("/api/bootstrap", { headers: { "X-User-Id": "u_admin" } });
  assert.ok(postActionAnalytics.body.analytics.totalShares >= 1);
  assert.ok(postActionAnalytics.body.analytics.totalDownloads >= 1);

  const deleteAlbum = await request(`/api/albums/${album.body.album.id}`, {
    method: "DELETE",
    headers: { "X-User-Id": "u_photo" }
  });
  assert.strictEqual(deleteAlbum.response.status, 200);
  assert.strictEqual(deleteAlbum.body.albumId, album.body.album.id);

  fs.writeFileSync(dbPath, originalDb);
  server.close();
  console.log("Smoke tests passed");
}

main().catch(error => {
  if (fs.existsSync(dbPath) && originalDb) {
    fs.writeFileSync(dbPath, originalDb);
  }
  server.close();
  console.error(error);
  process.exit(1);
});
