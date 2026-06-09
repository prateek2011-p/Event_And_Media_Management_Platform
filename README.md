# 🎉 Event & Media Management Platform

## 🌟 Overview

The Event & Media Management Platform is a centralized web application designed to simplify the management, organization, and sharing of media generated during college events. Clubs and societies frequently organize workshops, cultural festivals, competitions, trips, photoshoots, and celebrations that generate hundreds or even thousands of photos and videos. These files are often scattered across multiple Google Drive folders, cloud storage links, and personal devices, making them difficult to manage efficiently.

This platform provides a unified solution where organizers, photographers, and club members can upload, organize, search, access, and interact with event media seamlessly through a modern and user-friendly interface.

---

# 🚀 Live Demo

https://event-and-media-management-platform-k1yl.onrender.com

---

# 🎯 Problem Statement

College clubs and societies regularly conduct events that generate a large volume of photos and videos. Managing this media becomes challenging due to:

* Scattered storage across multiple platforms
* Difficulty in searching for specific photos
* Lack of centralized organization
* Poor access control mechanisms
* Inefficient sharing and collaboration
* Difficulty in finding photos containing specific members

The Event & Media Management Platform solves these challenges by providing a centralized, scalable, and interactive platform for managing event media efficiently.

---

# ✨ Key Features

## 📅 Event Management

The platform allows administrators and organizers to efficiently manage events and their associated media.

### Features

* Create and manage events
* Event-wise media organization
* Event descriptions and metadata
* Event categorization
* Event editing and updates
* Event-wise album management

### Sorting Options

* Event Name
* Event Date
* Event Category

---

## 📁 Album Management

Albums provide structured organization of media within events.

### Features

* Event-specific albums
* Album descriptions
* Organized media hierarchy
* Album management
* Album deletion support
* Collaborative album architecture

---

## 📸 Media Upload System

The platform provides an efficient and user-friendly media upload experience.

### Upload Features

* Photo uploads
* Video uploads
* Bulk uploads
* Drag-and-drop support
* Media preview before upload
* Upload validation
* Optimized storage workflow

### Media Processing

* Automatic tag generation
* Metadata extraction
* AI-generated captions
* Organized media storage

---

# 🔒 Access Control & Authentication

The platform implements role-based access control to ensure secure and controlled media access.

## User Roles

### Admin

* Full platform access
* Create and manage events
* Manage albums
* Upload media
* Access private content
* Monitor platform activities

### Photographer

* Upload media
* Create albums
* Manage uploaded content
* Access private club content

### Club Member

* View authorized content
* Like media
* Comment on media
* Download media
* Receive notifications

### Viewer

* Access public content only

---

## Public & Private Media

### Public Media

Accessible to all users.

### Private Media

Accessible only to authorized members and administrators.

---

# ❤️ Social Features

The platform includes social-media-inspired interactions to improve engagement and collaboration.

## Available Interactions

* Like media
* Comment on media
* Share media
* Download media
* Add to favourites
* Tag users and friends

---

## Notification System

Real-time notification support for:

* Photo likes
* User tagging
* Comments
* Media interactions

### Example Notifications

* Someone liked your photo
* Someone tagged you
* Someone commented on your upload

---

# 🤖 AI-Powered Features

## Smart Image Tagging

The platform automatically generates tags based on uploaded media and metadata.

### Example Tags

* Crowd
* Stage
* Sports
* Workshop
* Party
* Mountains
* Beach
* Dance

Automatic tagging improves search accuracy and media discoverability.

---

## AI-Generated Captions

The system generates meaningful captions using uploaded file information and metadata to improve media organization.

---

## Advanced Search System

Users can search media using multiple criteria.

### Search Filters

* Event Name
* Tags
* Upload Date
* Uploader Name
* Media Title

### Example Searches

```text
stage
crowd
mountains
workshop
Mira
2026-04
```

---

# 👤 Personalized Photo Discovery

The platform includes a personalized photo discovery feature that helps users locate media associated with them.

## Workflow

1. Select a face profile.
2. Search for matching media.
3. View matching results.
4. Review confidence scores.

### Benefits

* Faster photo discovery
* Personalized experience
* Improved accessibility of event memories

---

# ☁️ AWS S3 Cloud Integration

## Overview

To ensure scalability and efficient media management, the platform is designed to support integration with Amazon Simple Storage Service (AWS S3).

Currently, media files are stored locally for demonstration purposes. In a production environment, uploaded photos and videos can be stored securely in AWS S3 while only metadata is maintained in the database.

This approach improves scalability, reliability, and performance while reducing server storage requirements.

---

## Why AWS S3?

AWS S3 provides:

- Highly scalable object storage
- High durability and availability
- Secure media management
- Fast retrieval of images and videos
- Reduced server storage load
- Production-ready cloud infrastructure

---

## Storage Workflow

```text
Photographer Uploads Media
          │
          ▼
     Node.js Backend
          │
          ▼
      AWS S3 Bucket
          │
          ▼
 Metadata Stored in Database
          │
          ▼
     Users Access Media
```

---

## Step 1: Create an S3 Bucket

Create an S3 bucket in AWS.

Example:

```text
college-event-media
```

It is recommended to keep **Block Public Access** enabled unless media is intentionally served through signed URLs or a CDN.

---

## Step 2: Configure CORS

Configure CORS on the bucket to allow browser-based uploads.

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": [
      "http://127.0.0.1:4173",
      "http://localhost:4173"
    ],
    "ExposeHeaders": ["ETag"]
  }
]
```

---

## Step 3: Configure IAM Permissions

Create an IAM User or IAM Role with the following permissions:

- s3:PutObject
- s3:GetObject
- s3:DeleteObject

These permissions allow the application to upload, retrieve, and delete media securely.

---

## Step 4: Configure Environment Variables

Store AWS credentials using environment variables.

```powershell
$env:S3_BUCKET="college-event-media"

$env:AWS_REGION="ap-south-1"

$env:AWS_ACCESS_KEY_ID="your-access-key"

$env:AWS_SECRET_ACCESS_KEY="your-secret-key"
```

---

## Step 5: Install AWS SDK

Install the AWS SDK for JavaScript.

```bash
npm install @aws-sdk/client-s3
```

---

## Step 6: Initialize AWS S3 Client

Import and configure the S3 client in the backend.

```javascript
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand
} = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  region: process.env.AWS_REGION
});
```

---

## Step 7: Upload Media to S3

Convert uploaded media into a buffer and upload it to AWS S3.

```javascript
const [meta, base64] = body.dataUrl.split(",");

const contentType =
  meta.match(/data:(.*);base64/)?.[1] ||
  "application/octet-stream";

const s3Buffer = Buffer.from(base64, "base64");

const key =
  `events/${event.id}/albums/${album.id}/${Date.now()}-${body.title}`;

await s3.send(
  new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: s3Buffer,
    ContentType: contentType
  })
);
```

---

## Step 8: Store Metadata

Instead of storing the complete media file in the database, only metadata is stored.

```javascript
{
  storageKey: key,
  eventId: event.id,
  albumId: album.id,
  mediaType: contentType
}
```

This significantly reduces database size and improves performance.

---

## Step 9: Retrieve Media

When users access media:

1. Metadata is fetched from the database.
2. The S3 object key is identified.
3. Media is retrieved using secure URLs.
4. Access permissions are verified before serving content.

---

## Step 10: Delete Media

When media or albums are deleted, the corresponding S3 objects can also be removed.

```javascript
await s3.send(
  new DeleteObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: storageKey
  })
);
```

---

## Cloud Readiness Features

The platform includes:

✅ AWS S3 Compatible Architecture

✅ Secure Upload Workflow

✅ Cloud Storage Status Monitoring

✅ Scalable Media Management

✅ Production-Ready Storage Design

---

## Benefits of AWS S3 Integration

- Scalable cloud storage
- High durability and availability
- Secure media access
- Reduced server storage requirements
- Faster media management
- Industry-standard cloud architecture
- Production-ready deployment support
---

# 🖼️ Dynamic Watermarking System

The platform automatically applies watermarks during media downloads.

## Watermark Components

* Club Name
* Event Name
* User Role

### Benefits

* Ownership protection
* Content attribution
* Secure media distribution

---

# 📊 Analytics Dashboard

The platform includes analytics capabilities to provide insights into platform activity.

### Analytics Features

* Event statistics
* Media statistics
* Upload tracking
* Activity monitoring
* Engagement insights

---

# 📱 Progressive Web Technologies

The platform incorporates modern web technologies to improve performance and user experience.

### Features

* Web Manifest Support
* Service Worker Integration
* Offline Cache Support
* Faster Resource Loading
* Improved User Experience

These technologies improve responsiveness and reduce unnecessary network requests.

---

# 🔥 Bonus Features Implemented

✅ QR-Based Media Sharing

✅ AI-Generated Captions

✅ Analytics Dashboard

✅ Offline Cache Service Worker

✅ Collaborative Album Data Model

✅ Infinite Gallery Experience

✅ Enhanced Search Experience

---

# 🏗️ System Architecture

```text
Users
   │
   ▼
Frontend (HTML, CSS, JavaScript)
   │
   ▼
Node.js Backend
   │
   ├── Event Management
   ├── Album Management
   ├── Media Upload Service
   ├── Search Engine
   ├── AI Tagging Module
   ├── Notification System
   ├── Face Discovery Module
   └── Watermark Engine
   │
   ▼
Storage Layer
   ├── Local JSON Storage
   └── AWS S3 Integration
```

---

# 🛠️ Technology Stack

## Frontend

* HTML5
* CSS3
* JavaScript

## Backend

* Node.js

## Database

* JSON-Based Storage

## Cloud Services

* AWS S3 Ready Architecture

## Web Technologies

* Service Workers
* Web Manifest

---

# 📂 Project Structure

```text
event-media-platform/

├── server.js
├── data/
│   └── db.json
│
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── manifest.webmanifest
│   └── sw.js
│
├── docs/
│   ├── api.md
│   ├── architecture.md
│   ├── database-schema.md
│   └── presentation-outline.md
│
└── tests/
    └── smoke.test.js
```

---




---

# 🏆 Project Highlights

* Centralized Event Media Management
* Event-Wise Album Organization
* Role-Based Access Control
* Social Media Style Interactions
* AI-Powered Search and Discovery
* Personalized Photo Discovery
* Dynamic Watermarking System
* AWS Cloud Integration Ready
* Analytics Dashboard
* Offline Support
* Scalable Architecture
* Production-Oriented Design
