# Event & Media Management Platform

A centralized media hub for college clubs, photographers, organizers, and members. It implements the features requested in `CIG_DEV_PS.pdf`: event-wise albums, drag-and-drop uploads, access control, social interactions, AI-style tagging/search, face-based discovery, cloud storage readiness, watermark downloads, notifications, and bonus analytics/PWA/QR sharing flows.

## What This Project Does

This project is a website for handling all photos and videos created during club events. Instead of keeping media scattered across many Google Drive links, photographers can upload media into event-wise albums. Members can search it, interact with it, and find photos that contain them.

Simple example:

1. Admin creates an event called `Freshers Night`.
2. Photographer creates an album called `Main Stage`.
3. Photographer uploads photos/videos with tags like `dance, crowd, stage`.
4. Club members search `stage`, like/comment/share/download photos, and tag users.
5. A member uses Face Finder to show only photos matched to them.

## Quick Start

```powershell
cd "C:\EVENT AND MEDIA MANAGEMENT"
node server.js
```

Open `http://127.0.0.1:4173`.

No dependency install is required. The project uses Node's built-in HTTP server and a vanilla frontend.

## User Roles

- `Admin`: creates events, sees private content, uploads media.
- `Photographer`: uploads media, sees private content, creates albums.
- `Club Member`: sees private club content and can interact.
- `Viewer`: sees public content only.

Use the role switcher in the top bar to test access control.

## Key Workflows

### 1. Create Event

Role:

```text
Aarav Admin - Admin
```

Click `New event` and enter:

```text
Name: Freshers Night
Category: Party
Date: 2026-06-12
Location: Auditorium
Description: Welcome party photos and videos
Visibility: Public
```

Expected output: a colorful `Freshers Night` event card appears. Sorting by event name, date, and category changes the event order.

### 2. Create Album

Role:

```text
Mira Photographer - Photographer
```

Click `New album` and enter:

```text
Event: Freshers Night
Album title: Main Stage
Description: Stage photos and dance videos
```

Expected output: the `Freshers Night` card shows the new album name, and the Upload page can publish media into it.

### 3. Upload Media

Role:

```text
Mira Photographer - Photographer
```

Go to `Upload` and enter:

```text
Event: Freshers Night
Album: Main Stage
Visibility: Public media
Manual tags: dance, crowd, stage, music
```

Choose one or more image/video files. A file named `stage_crowd_dance_photo.jpg` is a good test.

Expected output: preview cards show before upload, including original size, optimized estimate, and AI tags. After `Publish selected`, the new media appears in Latest media with AI caption and tags.

### 4. Access Control

Switch to:

```text
Vihaan Viewer - Viewer
```

Expected output: only public events/media are visible.

Switch to:

```text
Aarav Admin - Admin
```

Expected output: private content such as `Portrait Lighting Workshop` and `Softbox Portrait` appears.

### 5. Social Features

On any media card, test:

```text
Like
Favourite
Share
Download
Tag user: Rhea Member
Comment: Great shot for the club page!
```

Expected output: like count changes, favourite toggles, share QR opens, download creates a watermarked PNG, user tagging creates a notification, and the comment appears below the media card.

### 6. AI Search

Try these search inputs:

```text
stage
crowd
Mira
Spring
mountains
2026-04
```

Expected output: gallery filters by event name, tags, uploader name, and upload date.

### 7. Face Finder

Go to `Face Finder`.

Input:

```text
Face profile: Rhea Member
```

Click `Find matches`.

Expected output: matching photos appear in the separate personalized section with a confidence score.

### 8. Cloud and Watermark

Check the sidebar `Cloud integration` box.

Expected output: it shows AWS S3 demo/configured status.

Click `Download` on any media.

Expected output: downloaded PNG contains dynamic watermark with club name, event name, and user role.

## Implemented Features

- Event management with name/date/category sorting and event editing.
- Event-wise albums, event metadata, and album deletion.
- Public/private access control with role-aware API filtering.
- Bulk photo/video upload with drag-and-drop and preview.
- AI-style auto tags and AI-generated captions from file names and metadata.
- Advanced search by event name, tag, upload date, media title, and uploader.
- Like, comment, share, download, favourite, and tag flows.
- Real-time-style notification feed stored per user.
- Face discovery flow using configurable face profile tokens.
- Dynamic watermark on download using club name, event name, and user role.
- Cloud integration readiness endpoint for AWS S3 configuration.
- Bonus: infinite-style load more gallery, QR-style share card, richer analytics dashboard, collaborative album data model, duplicate-ready metadata, PWA manifest, and offline cache service worker.

## Project Structure

```text
event-media-platform/
  server.js                 # Node API and static server
  data/db.json              # JSON persistence for demo data
  public/
    index.html              # App shell
    styles.css              # Responsive UI
    app.js                  # Frontend behavior
    manifest.webmanifest    # PWA manifest
    sw.js                   # Offline cache
  docs/
    api.md
    architecture.md
    database-schema.md
    presentation-outline.md
  tests/
    smoke.test.js
```

## AWS S3 Cloud Storage Integration

The app currently stores uploaded file data locally in `data/db.json` as a data URL so it can run without dependencies. To connect real AWS S3 storage, use these main steps:

1. Create an S3 bucket in AWS, for example `college-event-media`.
2. Keep "Block all public access" on unless you plan to serve files through CloudFront or signed URLs.
3. Add CORS on the bucket if the browser will fetch media directly:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["http://127.0.0.1:4173", "http://localhost:4173"],
    "ExposeHeaders": ["ETag"]
  }
]
```

4. Create an IAM user or role with `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` permissions for this bucket.
5. Set environment variables before starting the server:

```powershell
$env:S3_BUCKET="college-event-media"
$env:AWS_REGION="ap-south-1"
$env:AWS_ACCESS_KEY_ID="your-access-key"
$env:AWS_SECRET_ACCESS_KEY="your-secret-key"
npm start
```

6. Install the AWS SDK when you are ready to switch from local JSON storage:

```powershell
npm install @aws-sdk/client-s3
```

7. In `server.js`, import the SDK:

```js
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const s3 = new S3Client({ region: process.env.AWS_REGION });
```

8. Inside the `/api/media` route, replace direct `dataUrl` storage with a Buffer upload. You do not select `s3Buffer` from any UI; it is created in backend code from the uploaded base64 data:

```js
const [meta, base64] = body.dataUrl.split(",");
const contentType = meta.match(/data:(.*);base64/)?.[1] || "application/octet-stream";
const s3Buffer = Buffer.from(base64, "base64");
const key = `events/${event.id}/albums/${album.id}/${id("obj")}-${body.title || "upload"}`;

await s3.send(new PutObjectCommand({
  Bucket: process.env.S3_BUCKET,
  Key: key,
  Body: s3Buffer,
  ContentType: contentType
}));
```

9. Store `storageKey: key` and a signed URL or CDN URL in the media record instead of storing the full `dataUrl`.
10. When deleting an album, also call `DeleteObjectCommand` for each media item that has a `storageKey`.

The `/api/cloud/status` endpoint already reports configured mode when `S3_BUCKET` is present. Full production storage should move large files out of `data/db.json` and keep only metadata plus S3 object keys in the database.

## API Smoke Test

```powershell
npm test
```

## Submission Notes

Mandatory deliverables covered in this folder:

- GitHub-ready project source
- Working local demo
- Documentation and README
- Database schema
- Architecture diagram
- Presentation outline

Optional deliverables included:

- API documentation
- PWA/offline setup
- Test script
live demo deployed link:
https://event-and-media-management-platform-k1yl.onrender.com
