# Scrolling Message Bar Management

The HUD now includes a scrolling message bar that displays announcements, alerts, and advertisements.

## Configuration

- **Height**: 20px
- **Default Speed**: 50 pixels per second
- **Default Gap**: 100px between messages
- **Font**: Menlo, monospace (same as LCD screens)
- **Colors**: Dark green background (#0b2f18), bright green text (#64ff8a)

## API Endpoints

### Get Messages (Public)
```bash
GET https://mineboy-g5xo.onrender.com/v2/messages
```
Returns: `{ messages: string[] }`

### Get Messages with Metadata (Admin)
```bash
GET https://mineboy-g5xo.onrender.com/v2/admin/messages
Authorization: Bearer <ADMIN_TOKEN>
```
Returns: `{ messages: [{ id, text, createdAt }] }`

### Add Message (Admin)
```bash
POST https://mineboy-g5xo.onrender.com/v2/admin/messages
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "text": "Your message here"
}
```

### Update Message (Admin)
```bash
PUT https://mineboy-g5xo.onrender.com/v2/admin/messages/:id
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "text": "Updated message"
}
```

### Delete Message (Admin)
```bash
DELETE https://mineboy-g5xo.onrender.com/v2/admin/messages/:id
Authorization: Bearer <ADMIN_TOKEN>
```

### Clear All Messages (Admin)
```bash
DELETE https://mineboy-g5xo.onrender.com/v2/admin/messages
Authorization: Bearer <ADMIN_TOKEN>
```

## Using cURL

### Add a message:
```bash
curl -X POST https://mineboy-g5xo.onrender.com/v2/admin/messages \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"🎉 New pickaxe types available on Magic Eden!"}'
```

### List all messages:
```bash
curl https://mineboy-g5xo.onrender.com/v2/admin/messages \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Delete a message:
```bash
curl -X DELETE https://mineboy-g5xo.onrender.com/v2/admin/messages/msg_1234567890_abc123 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Frontend Configuration

To adjust speed or gap, pass props to the HUD component:

```tsx
<HUD
  messages={scrollingMessages}
  scrollSpeed={50}  // pixels per second (higher = faster)
  messageGap={100}  // pixels between messages
  ...
/>
```

## Notes

- Messages are stored in memory and will reset when the backend restarts
- Frontend refreshes messages every 5 minutes automatically
- Default message: "MineBoy it Mines stuff!"
- Admin token is set via `ADMIN_TOKEN` environment variable on the backend
