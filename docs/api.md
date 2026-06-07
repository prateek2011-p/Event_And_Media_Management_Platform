# API Documentation

All endpoints accept `X-User-Id` to simulate the active authenticated user.

## GET `/api/bootstrap`

Returns the current user, visible events, albums, media, notifications, settings, and analytics.

## GET `/api/search?q=&tag=&uploader=&date=`

Searches visible media by event name, title, tags, uploader, and upload date.

## GET `/api/cloud/status`

Returns S3 readiness and local demo storage mode.

## POST `/api/events`

Admin only. Creates a new event.

```json
{
  "name": "Freshers Night",
  "category": "Party",
  "date": "2026-06-12",
  "visibility": "public",
  "location": "Auditorium",
  "description": "Welcome event"
}
```

## POST `/api/albums`

Admin and Photographer only. Creates an album under an event.

## POST `/api/media`

Admin and Photographer only. Creates media metadata and stores demo upload content.

## POST `/api/media/:id/like`

Toggles like and notifies the uploader.

## POST `/api/media/:id/favourite`

Toggles favourite for the active user.

## POST `/api/media/:id/comment`

Adds a comment and notifies the uploader.

## POST `/api/media/:id/tag`

Tags a user and sends a notification.

## POST `/api/media/:id/share`

Creates a share URL for QR sharing.

## POST `/api/face-match`

Returns visible media whose face tokens match the selected reference profile.

## POST `/api/notifications/read`

Marks the current user's notifications as read.
