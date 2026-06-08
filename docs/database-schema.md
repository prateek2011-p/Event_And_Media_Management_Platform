# Database Schema

The application currently uses a JSON-based datastore for demonstration purposes. The schema is designed to map directly to MongoDB collections or PostgreSQL tables in a production deployment.

---

# Entity Relationships

```text
User (1) ─── (N) Media

Event (1) ─── (N) Albums

Album (1) ─── (N) Media

User (1) ─── (N) Notifications

Media (1) ─── (N) Comments

Media (1) ─── (N) Shares
```

---

# users

Stores platform user information and access roles.

| Field     | Type     | Notes                                    |
| --------- | -------- | ---------------------------------------- |
| id        | string   | Primary key                              |
| name      | string   | Display name                             |
| role      | enum     | Admin, Photographer, Club Member, Viewer |
| avatarUrl | string   | Profile image or avatar                  |
| faceToken | string   | Face discovery identity token            |
| createdAt | datetime | Account creation timestamp               |

---

# events

Stores event information and metadata.

| Field       | Type     | Notes                                                   |
| ----------- | -------- | ------------------------------------------------------- |
| id          | string   | Primary key                                             |
| name        | string   | Event name                                              |
| category    | string   | Workshop, Trip, Cultural Fest, Competition, Party, etc. |
| date        | date     | Event date                                              |
| visibility  | enum     | public, private                                         |
| description | string   | Event description                                       |
| location    | string   | Event venue                                             |
| coverColor  | string   | UI cover color                                          |
| albumIds    | string[] | Associated album identifiers                            |

---

# albums

Stores album information linked to events.

| Field         | Type     | Notes                                   |
| ------------- | -------- | --------------------------------------- |
| id            | string   | Primary key                             |
| eventId       | string   | Foreign key to events                   |
| title         | string   | Album title                             |
| description   | string   | Album summary                           |
| collaborators | string[] | User IDs with collaboration permissions |
| createdAt     | datetime | Album creation timestamp                |

---

# media

Stores photos and videos uploaded to the platform.

| Field         | Type      | Notes                                             |
| ------------- | --------- | ------------------------------------------------- |
| id            | string    | Primary key                                       |
| eventId       | string    | Foreign key to events                             |
| albumId       | string    | Foreign key to albums                             |
| type          | enum      | photo, video                                      |
| title         | string    | Display title                                     |
| dataUrl       | string    | Demo media payload; production uses S3 object key |
| thumbnail     | string    | Thumbnail URL or storage key                      |
| tags          | string[]  | Manual and AI-generated tags                      |
| aiCaption     | string    | AI-generated caption                              |
| uploadedBy    | string    | User ID of uploader                               |
| uploadedAt    | datetime  | Upload timestamp                                  |
| visibility    | enum      | public, private                                   |
| faceTokens    | string[]  | Face discovery identity tokens                    |
| sizeKb        | number    | Optimized media size                              |
| likes         | string[]  | User IDs who liked the media                      |
| favourites    | string[]  | User IDs who favourited the media                 |
| comments      | Comment[] | Associated comments                               |
| shareCount    | number    | Total share count                                 |
| downloadCount | number    | Total download count                              |

---

# comments

Embedded comment structure used inside media records.

| Field     | Type     | Notes                      |
| --------- | -------- | -------------------------- |
| id        | string   | Primary key                |
| userId    | string   | Comment author             |
| text      | string   | Comment content            |
| createdAt | datetime | Comment creation timestamp |

---

# notifications

Stores activity notifications for users.

| Field     | Type     | Notes                     |
| --------- | -------- | ------------------------- |
| id        | string   | Primary key               |
| userId    | string   | Notification recipient    |
| type      | string   | like, comment, tag, share |
| text      | string   | Notification message      |
| read      | boolean  | Read status               |
| createdAt | datetime | Notification timestamp    |

---

# shares

Stores media sharing information.

| Field     | Type     | Notes                        |
| --------- | -------- | ---------------------------- |
| id        | string   | Primary key                  |
| mediaId   | string   | Related media                |
| createdBy | string   | User who generated the share |
| createdAt | datetime | Share creation timestamp     |
| url       | string   | Share URL                    |

---

# analytics

Stores aggregated analytics data used by the dashboard.

| Field          | Type   | Notes             |
| -------------- | ------ | ----------------- |
| id             | string | Primary key       |
| eventId        | string | Related event     |
| mediaCount     | number | Total media items |
| totalLikes     | number | Total likes       |
| totalDownloads | number | Total downloads   |
| totalShares    | number | Total shares      |
| totalUploads   | number | Total uploads     |

---

# Storage Strategy

### Current Implementation

* JSON-based persistence using `data/db.json`
* Lightweight setup for local development and demonstration
* No external database dependency

### Production Deployment

The schema is designed to migrate directly to:

* MongoDB Collections
* PostgreSQL Tables
* MySQL Tables

### Cloud Storage

Large media files can be stored in AWS S3 while maintaining only metadata within the database.

### Benefits

* Scalable architecture
* Efficient media management
* Reduced database size
* Improved performance
* Production-ready deployment model
