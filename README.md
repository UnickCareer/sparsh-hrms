# Sparsh HRMS

**Sparsh HRMS (Human Resource Management System)** is a modern, full-stack Human Resource Management platform designed to centralize employee information, attendance, leave management, tasks, visitors, sales queries, IT support, performance reviews, notifications, and internal communication within a unified web application.

The system is developed and maintained locally on **Ubuntu 20.04 LTS**, with a React-based frontend, Node.js/Express backend, and PostgreSQL database.

---

## Project Overview

Sparsh HRMS is designed around a role-based enterprise workflow where employees, administrators, HR personnel, and system owners can access functionality appropriate to their responsibilities.

The application follows a modular full-stack architecture:

```text
React Frontend
      │
      │ HTTP / REST API
      ▼
Node.js + Express Backend
      │
      │ PostgreSQL Driver / Queries
      ▼
PostgreSQL Database
```

The platform is being developed with an emphasis on:

- Centralized employee data
- Role-based access and workflows
- Responsive administration interfaces
- Structured REST APIs
- PostgreSQL-backed persistent storage
- Internal employee communication
- Real-time communication capabilities
- Maintainable and modular frontend/backend architecture

---

## Tech Stack

### Frontend

- **React**
- **Vite**
- **Tailwind CSS**
- **Lucide React** — UI icons
- **Framer Motion** — animations and transitions
- **React Hot Toast** — notifications and feedback
- **Emoji Mart** — emoji functionality

### Backend

- **Node.js**
- **Express.js**
- RESTful API architecture
- PostgreSQL connection pooling
- File upload handling with **Multer**
- Authentication/authorization and role-based request handling

### Database

- **PostgreSQL 12**
- Relational data model
- Structured tables for HRMS modules
- Foreign-key relationships between employees, workflows, and communication records

### Development Environment

- **Ubuntu 20.04.6 LTS**
- Local PostgreSQL server
- Local Node.js development environment
- Git-based source management

---

# Features

## Employee Management

The HRMS provides centralized employee record management, including employee information required by different HR and administrative workflows.

Core employee functionality includes:

- Employee records
- Employee identification
- Department/designation-related information
- Role-based access
- Employee-specific workflow data
- Employee-linked attendance, leave, task, and performance information

---

## Attendance Management

The system contains an attendance module designed to maintain employee attendance records.

Attendance functionality includes support for:

- Employee attendance records
- Attendance status
- Check-in/check-out workflows
- Location/geo-related attendance information
- Employee-linked attendance history

---

## Leave Management

The leave module manages employee leave workflows and balances.

The system supports:

- Leave requests
- Leave status tracking
- Employee leave balances
- Approval workflows
- Manager/administrative review

---

## Task Management

Sparsh HRMS includes task management functionality for assigning and tracking work.

The system supports:

- Task creation
- Employee/task assignments
- Task status management
- Employee-linked tasks
- Administrative task workflows

---

## Visitor Management

The application includes a visitor-management module for maintaining visitor records and associated information.

---

## Sales Query Management

Sales queries can be recorded and assigned to employees.

The module includes:

- Sales query records
- Assignment workflows
- Employee-linked queries
- Assignment-related notifications

---

## IT Support / Ticket Management

The HRMS includes an IT ticketing workflow for internal technical support.

The system supports:

- IT ticket creation
- Ticket assignment
- Ticket status
- Employee-linked tickets
- Assignment notifications

---

## Performance Management

Sparsh HRMS includes a structured employee performance-review system.

The current performance workflow is designed around:

```text
Not Started
     ↓
Self Assessment
     ↓
Manager Review
     ↓
HR Review
     ↓
Approved
     ↓
Completed
```

The system also supports workflows such as:

- Performance cycles
- Employee goals
- Self assessment
- Manager review
- HR review
- Approval
- Correction workflows
- Performance history

The current HRMS performance cycle is structured around the **FY 2026–27** period.

---

## Notifications

The HRMS contains an integrated notification system for important application events.

Examples include:

- Sales-query assignment notifications
- IT-ticket assignment notifications
- Reference-linked notifications
- Read/unread notification state

Notifications are intended to remain integrated into the main application interface rather than introducing unnecessary standalone notification infrastructure.

---

# Internal Chat — Active Development

The internal Chat module is currently under active development/restoration.

The objective is to provide an internal WhatsApp-style communication system for employees while integrating it directly with the HRMS employee and role structure.

The Chat system is being developed around:

- Direct conversations
- Group conversations
- Employee participants
- Text messaging
- Message reactions
- Reply functionality
- Message editing
- Message deletion
- Message selection
- Forwarding
- Pinning
- Starring
- Conversation search
- Attachments
- Images
- Videos
- Documents
- Media previews
- Message receipts/read state
- Group management
- Role-based group authority

### Chat Role Hierarchy

The intended Chat hierarchy is:

```text
Owner
  │
  ├── Administrator
  │
  └── Employee
```

Website Administrator accounts act as the Chat Owner authority within the current HRMS design.

---

# Media & Attachment Development

The Chat attachment system is currently being restored and integrated with the existing PostgreSQL-backed Chat implementation.

The backend already contains infrastructure for Chat attachments, including:

- Image uploads
- Video uploads
- Document uploads
- Attachment metadata
- Conversation attachment endpoints
- Static upload serving
- Multipart upload handling

The frontend is being enhanced to provide a richer media experience.

Planned/active media capabilities include:

- Multiple photo/video selection
- Image preview
- Video preview
- Captions
- Crop
- Doodle
- Undo/redo
- Rotation
- Media viewer
- Zoom
- Download/save
- Video playback
- Clipboard image copying
- Clipboard image pasting
- Attachment-aware forwarding

---

# Database

The PostgreSQL database currently contains dedicated Chat-related structures alongside the HRMS modules.

Important Chat tables include:

```text
chat_conversations
chat_participants
chat_messages
chat_message_reactions
chat_starred_messages
chat_message_attachments
```

The existing database is being preserved wherever possible during Chat restoration.

**Database/schema changes are intentionally minimized** so that existing HRMS functionality is not unnecessarily affected.

---

# System Architecture

Sparsh HRMS follows a layered full-stack architecture.

```text
┌─────────────────────────────────────────────┐
│              React Frontend                 │
│                                             │
│  Dashboard │ Employees │ Attendance         │
│  Leaves    │ Tasks     │ Performance        │
│  Visitors  │ IT        │ Sales Queries      │
│  Notifications │ Chat                      │
└──────────────────────┬──────────────────────┘
                       │
                       │ REST / HTTP
                       ▼
┌─────────────────────────────────────────────┐
│          Node.js + Express Backend          │
│                                             │
│  Routes                                      │
│    ↓                                         │
│  Controllers                                 │
│    ↓                                         │
│  Database / Business Logic                   │
│                                             │
│  Chat APIs                                   │
│  File Upload APIs                            │
└──────────────────────┬──────────────────────┘
                       │
                       │ PostgreSQL
                       ▼
┌─────────────────────────────────────────────┐
│              PostgreSQL 12                  │
│                                             │
│  Employees                                   │
│  Attendance                                  │
│  Leaves                                      │
│  Tasks                                       │
│  Visitors                                    │
│  Sales Queries                               │
│  IT Tickets                                  │
│  Performance                                 │
│  Notifications                               │
│  Chat                                        │
└─────────────────────────────────────────────┘
```

---

# Chat Real-Time Architecture

The next stage of the Chat architecture introduces a WebSocket layer for low-latency communication.

The planned architecture is:

```text
React Chat UI
      │
      ├──────── REST API ──────────┐
      │                            │
      ▼                            ▼
WebSocket Layer              Express API
      │                            │
      │                            ▼
      │                       PostgreSQL
      │
      └──── Real-time events
             │
             ├── New message
             ├── Message updates
             ├── Read receipts
             ├── Reactions
             ├── Typing state
             └── Conversation updates
```

REST APIs remain responsible for persistent operations and data retrieval, while WebSockets are intended to provide low-latency delivery of real-time events.

---

# Active Development Roadmap

## Phase 1 — Core HRMS

**Status: Completed / Operational**

- [x] Employee database management
- [x] Employee-linked HR workflows
- [x] Responsive dashboard
- [x] Attendance management
- [x] Leave management
- [x] Task management
- [x] Visitor management
- [x] Sales query management
- [x] IT ticket management
- [x] Performance management
- [x] Application notifications
- [x] PostgreSQL integration

---

## Phase 2 — Chat Restoration

**Status: In Progress**

- [x] Chat database tables
- [x] Direct conversations
- [x] Group conversations
- [x] Text messaging
- [x] Message reactions
- [x] Reply functionality
- [x] Message editing
- [x] Message deletion
- [x] Pin/star functionality
- [x] Conversation/message selection
- [x] Attachment backend infrastructure
- [x] Image/video/document upload infrastructure
- [ ] Complete Chat frontend restoration
- [ ] Attachment-aware message forwarding
- [ ] Image clipboard copy
- [ ] Clipboard media paste
- [ ] Advanced media editor
- [ ] Advanced media viewer
- [ ] Final Chat regression testing

---

## Phase 3 — Real-Time Communication

**Status: Pending**

- [ ] WebSocket layer
- [ ] Real-time message delivery
- [ ] Real-time conversation updates
- [ ] Read/delivery events
- [ ] Real-time reactions
- [ ] Typing indicators
- [ ] Connection/reconnection handling
- [ ] WebSocket authentication
- [ ] Multi-user concurrency testing

---

## Phase 4 — Production Hardening

**Status: Planned**

- [ ] Comprehensive API validation
- [ ] Authentication hardening
- [ ] Authorization audit
- [ ] File-upload security review
- [ ] Error handling improvements
- [ ] Database performance optimization
- [ ] Logging and monitoring
- [ ] Automated testing
- [ ] Production deployment configuration
- [ ] Backup and recovery procedures

---

# Development Principles

The project is being developed with the following principles:

### Preserve Existing Functionality

New features should not unnecessarily break already-working HRMS modules.

### Database Safety

Existing PostgreSQL structures should be reused wherever practical. Schema modifications should only be introduced when genuinely required by a feature.

### Modular Architecture

Frontend components, backend routes, controllers, and database responsibilities should remain separated and maintainable.

### Role-Based Access

Administrative and employee functionality should follow the application's established role hierarchy.

### Progressive Restoration

Complex modules such as Chat are being restored incrementally:

```text
Audit
  ↓
Database verification
  ↓
Backend verification
  ↓
Frontend restoration
  ↓
Integration testing
  ↓
Real-time layer
  ↓
Production hardening
```

---

# Local Development Environment

The project is currently developed locally on:

```text
Ubuntu 20.04 LTS
PostgreSQL 12
Node.js
React + Vite
```

Example project structure:

```text
sparsh-hrms/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── db/
│   │   └── ...
│   └── ...
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── ...
│   └── ...
│
├── package.json
├── README.md
└── ...
```

---

# Current Project Status

**Overall Status: Active Development**

The core HRMS platform and PostgreSQL-backed business modules are established. The current development focus is the restoration and completion of the internal Chat experience, followed by implementation of the WebSocket layer for real-time communication.

The project is intentionally being developed incrementally to protect existing HRMS functionality while introducing more advanced communication capabilities.

---

# License

This project is currently maintained as a private/internal HRMS application.

License and distribution terms should be added before any public release.