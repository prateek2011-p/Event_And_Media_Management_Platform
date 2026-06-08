# API Documentation

## Authentication

The platform uses role-based access control. All API requests support an `X-User-Id` header to simulate the currently authenticated user.

---

## Bootstrap API

### GET /api/bootstrap

Returns all data required to initialize the application, including:

* Current user information
* Events
* Albums
* Media
* Notifications
* Platform settings
* Analytics data

**Access:** All Users

---

## Search API

### GET /api/search

Provides advanced media search functionality.

Users can search media by:

* Event name
* Media title
* Tags
* Upload date
* Uploader name

**Access:** All Users

---

## Cloud Status API

### GET /api/cloud/status

Returns the current cloud storage status and indicates whether AWS S3 integration is configured.

**Access:** All Users

---

## Event Management APIs

### POST /api/events

Creates a new event with metadata such as name, category, date, visibility, location, and description.

**Access:** Admin Only

---

## Album Management APIs

### POST /api/albums

Creates a new album within an event.

Albums help organize media into logical collections.

**Access:** Admin, Photographer

---

## Media Management APIs

### POST /api/media

Uploads media and creates associated metadata.

Supports:

* Photos
* Videos
* Bulk uploads
* Album association
* AI-generated tags
* AI-generated captions

**Access:** Admin, Photographer

---

## Social Interaction APIs

### POST /api/media/:id/like

Allows users to like or unlike media content.

Automatically updates engagement statistics and generates notifications.

**Access:** Authenticated Users

---

### POST /api/media/:id/favourite

Adds or removes media from a user's favourites collection.

**Access:** Authenticated Users

---

### POST /api/media/:id/comment

Allows users to comment on media content.

Comment activity generates notifications for content owners.

**Access:** Authenticated Users

---

### POST /api/media/:id/tag

Allows users to tag other members in media.

Tagged users receive notifications.

**Access:** Authenticated Users

---

### POST /api/media/:id/share

Generates a shareable media link and QR code for easy distribution.

**Access:** Authenticated Users

---

## Face Finder API

### POST /api/face-match

Provides personalized media discovery by matching media against the selected reference profile.

Matching results are displayed in a dedicated personalized section.

**Access:** Authenticated Users

---

## Notification APIs

### POST /api/notifications/read

Marks all notifications for the current user as read.

**Access:** Authenticated Users

---

## API Highlights

* Role-Based Access Control
* Event Management
* Album Management
* Media Upload & Retrieval
* AI-Powered Search
* Social Interactions
* Notification System
* QR-Based Media Sharing
* Face Finder Support
* Cloud Storage Integration
* Analytics Support
