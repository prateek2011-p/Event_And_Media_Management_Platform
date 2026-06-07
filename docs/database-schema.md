# Database Schema

The demo uses `data/db.json` so it can run without setup. The same shape maps cleanly to MongoDB collections or PostgreSQL tables.

## users

| Field | Type | Notes |
| --- | --- | --- |
| id | string | Primary key |
| name | string | Display name |
| role | enum | Admin, Photographer, Club Member, Viewer |
| avatar | string | Initials for UI |
| faceToken | string | Demo face-recognition identity token |

## events

| Field | Type | Notes |
| --- | --- | --- |
| id | string | Primary key |
| name | string | Sortable event name |
| category | string | Workshop, Trip, Cultural Fest, etc. |
| date | date | Event date |
| visibility | enum | public or private |
| description | string | Event description |
| location | string | Event venue |
| coverColor | string | UI cover color |
| albumIds | string[] | Linked albums |

## albums

| Field | Type | Notes |
| --- | --- | --- |
| id | string | Primary key |
| eventId | string | Foreign key to events |
| title | string | Album title |
| description | string | Album summary |
| collaborators | string[] | User ids with collaboration rights |

## media

| Field | Type | Notes |
| --- | --- | --- |
| id | string | Primary key |
| eventId | string | Foreign key to events |
| albumId | string | Foreign key to albums |
| type | enum | photo or video |
| title | string | Display title |
| dataUrl | string | Local demo media payload; production uses S3 key |
| thumbnail | string | Thumbnail URL/key |
| tags | string[] | Manual and AI-generated tags |
| aiCaption | string | Generated caption |
| uploadedBy | string | User id |
| uploadedAt | datetime | Upload timestamp |
| visibility | enum | public or private |
| faceTokens | string[] | Matched identity tokens |
| sizeKb | number | Optimized media size metadata |
| likes | string[] | User ids |
| favourites | string[] | User ids |
| comments | Comment[] | Embedded comments for demo |

## notifications

| Field | Type | Notes |
| --- | --- | --- |
| id | string | Primary key |
| userId | string | Recipient |
| text | string | Notification text |
| read | boolean | Read state |
| createdAt | datetime | Created timestamp |

## shares

| Field | Type | Notes |
| --- | --- | --- |
| id | string | Primary key |
| mediaId | string | Shared media |
| createdBy | string | User id |
| createdAt | datetime | Created timestamp |
| url | string | Share URL |
