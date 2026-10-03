# Sparsh HRMS Chat UI / Behaviour Update

## Implemented in this update

- Reaction summary now renders as distinct emoji + one total reaction count (for example: `👍 ❤️ 😂 5`).
- Reaction details now has an `All (total)` tab plus one tab per emoji and a `+` action.
- Reaction details lists avatar + name + the corresponding emoji; the logged-in user's own reaction can be removed by clicking it.
- 1-to-1 message bubbles do not display sender/receiver names above each message. Group messages continue to display sender names.
- Clicking a reply/quoted-message section scrolls to the original message and briefly highlights it.
- Sidebar direct-chat preview uses the latest message instead of `Direct message`.
- Sidebar group preview uses `Sender Name: message` instead of a member count.
- Sidebar reaction activity shows `Name reacted to "message"` or `You reacted to "message" 👍` as appropriate.
- Sidebar typing preview remains italic `typing...`.
- Draft preview is truncated cleanly with a single ellipsis and remains conversation-specific.
- Enter no longer sends a message. Enter inserts a newline; sending/editing is button-driven. Escape cancels reply/edit mode.
- Delivery tick UI now distinguishes sent, delivered and read states; read uses `#2879F8`.
- Pin and Star message actions are wired to their backend endpoints instead of showing placeholder toasts.
- Clear Chat clears the current participant's visible history without deleting other participants' messages.
- Delete Chat removes the current participant from the chat history; direct chats can be recreated later.
- Reaction changes publish a realtime event so other connected clients refresh reaction state/sidebar activity.
- Added missing PostgreSQL schema objects for message receipts, pinned messages and reports, plus participant `cleared_at`.
- Added latest-conversation-activity API used by the sidebar.
- Added `conversation_type` to message payloads so group sender names render correctly.

## Files changed

- `frontend/src/pages/Chat.jsx`
- `backend/src/controllers/chat.controller.js`
- `backend/src/routes/chat.routes.js`
- `backend/src/db/schema.sql`

## Intentionally not included in this delivery

- Production authentication/authorization redesign.
- Full attachment upload/storage pipeline.
- Poll persistence and voting.
- Media / Docs / Links gallery APIs.
- Full Group Owner/Admin member-management UI.
- Employee group-creation approval workflow.
- Production-scale realtime broker (for example Redis) and durable event cursors.

These should be treated as subsequent implementation phases rather than mocked as completed features.

## Validation

- Backend controller and route files pass Node syntax checks.
- Frontend production build could not be completed in the build environment because npm dependencies were not available offline and package installation timed out.
