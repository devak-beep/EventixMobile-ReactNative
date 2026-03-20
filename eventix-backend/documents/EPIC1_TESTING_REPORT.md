# EPIC 1: Project & Infrastructure Setup - Complete Testing Report

**Project:** Event Booking Backend  
**EPIC:** 1 - Project & Infrastructure Setup  
**Date:** February 3, 2026  
**Status:** ✅ COMPLETE & VERIFIED

---

## Executive Summary

EPIC 1 establishes the foundational infrastructure for the Event Booking Backend. This epic covers project initialization, dependency management, database setup, and version control configuration. All core infrastructure components have been successfully implemented and verified.

### Key Results

- ✅ **Project initialized** with npm and package.json
- ✅ **Core dependencies installed** (Express, Mongoose, MongoDB, Winston, UUID, dotenv, nodemon)
- ✅ **Project structure created** following industry standards
- ✅ **MongoDB installed and configured** on system
- ✅ **Environment variables configured** via .env file
- ✅ **Git repository initialized** for version control
- ✅ **Server running successfully** on port 3000

---

## Big Picture: Why EPIC 1?

### Goal

Build an Event Booking Backend using Node.js + Express + MongoDB

### Before EPIC 1

A backend project requires 4 basic infrastructure components before writing any business logic:

1. **Project structure** - Organized file layout
2. **Node dependencies** - Required npm packages
3. **Database connection** - MongoDB setup and connectivity
4. **GitHub version control** - Source code management

**Without EPIC 1:** No foundation to build upon

---

## Task 1.1: Project Initialization (npm)

### What Was Done

Initialized a Node.js project using npm:

```bash
npm init
```

### Output Generated

Created `package.json` file containing:

- Project metadata
- Scripts configuration
- Dependencies list

### Why This Is Critical

`package.json` serves as:

- **Identity card of the project** - Contains project name, description, version
- **Script definitions** - Commands to start/develop the application
- **Dependency manifest** - Lists all required packages and versions
- **Configuration hub** - Project-wide settings

### Key Learning

**Without package.json:**

- Node.js doesn't recognize it as a project
- npm cannot manage dependencies
- Scripts cannot be executed
- Project cannot be shared or deployed

### Status

✅ **PASSED** - package.json created successfully

---

## Task 1.2: Installing Core Dependencies

### What Was Installed

```bash
npm install express mongoose dotenv uuid winston
npm install -D nodemon
```

### Dependencies Breakdown

| Package      | Version  | Purpose               | Why Needed                                  |
| ------------ | -------- | --------------------- | ------------------------------------------- |
| **express**  | Latest   | Web server framework  | Routes HTTP requests, handles REST APIs     |
| **mongoose** | Latest   | MongoDB ODM           | Object-Data Mapping for MongoDB             |
| **dotenv**   | Latest   | Environment variables | Reads .env file for config                  |
| **uuid**     | Latest   | Unique ID generator   | Creates unique identifiers                  |
| **winston**  | Latest   | Logging library       | Structured logging across app               |
| **nodemon**  | Dev only | Auto-restart server   | Restarts on file changes during development |

### Problems Faced & Solutions

#### Problem 1: Express Version Mismatch

**Symptom:** Import errors with express modules  
**Cause:** Version conflict between installed and required versions  
**Solution:** Reinstalled express@4 specifically

```bash
npm install express@4 --save
```

#### Problem 2: Missing Dev Script

**Symptom:** `npm run dev` fails  
**Cause:** Script not defined in package.json  
**Solution:** Added dev script to package.json

### Status

✅ **PASSED** - All dependencies installed and verified

---

## Task 1.3: Package.json Scripts Configuration

### Problem Encountered

**Error Message:**

```
Missing script: "dev"
npm ERR! Missing script: dev
```

### Root Cause Analysis

The `package.json` file did not contain the required scripts:

- `"dev"` script was missing
- `"start"` script was missing
- npm cannot find scripts that aren't explicitly defined

### How It Was Fixed

Added `scripts` section to package.json:

```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  }
}
```

### Script Purpose

| Script    | Command       | Usage                                  |
| --------- | ------------- | -------------------------------------- |
| **start** | `npm start`   | Production - runs server once          |
| **dev**   | `npm run dev` | Development - restarts on file changes |

### Key Learning

**Critical Rule:** `npm run xyz` works ONLY if `xyz` exists in the `scripts` section of package.json

### Status

✅ **PASSED** - Scripts configured and working

---

## Task 1.4: Project Structure Setup

### Directory Structure Created

```
event-booking-backend/
├── src/
│   ├── server.js           # Entry point (starts server)
│   ├── app.js             # Express app configuration
│   ├── config/
│   │   └── db.js          # MongoDB connection
│   ├── routes/            # API route handlers
│   ├── controllers/       # Business logic
│   ├── models/            # Mongoose schemas
│   ├── middlewares/       # Express middlewares
│   ├── services/          # Reusable business logic
│   └── utils/             # Helper functions
├── package.json
├── package-lock.json
├── .env                   # Environment variables (git ignored)
└── .gitignore            # Git configuration
```

### Why Structure Matters

1. **Scalability** - Easy to add new features without chaos
2. **Maintainability** - Clear organization helps debugging
3. **Industry Standard** - Follows professional backend patterns
4. **Collaboration** - Team members know where to find code
5. **Testing** - Modular structure allows isolated testing

### File Responsibilities

| File             | Responsibility                      |
| ---------------- | ----------------------------------- |
| **server.js**    | Start HTTP server, listen on port   |
| **app.js**       | Configure Express app, mount routes |
| **config/db.js** | Establish MongoDB connection        |
| **routes/**      | Define API endpoints                |
| **controllers/** | Handle request/response logic       |
| **models/**      | Define Mongoose schemas             |

### Status

✅ **PASSED** - Structure implemented following industry standards

---

## Task 1.5: Server Startup & Initial Issues

### First Attempt

**Command:**

```bash
npm run dev
```

**Expected Result:**

```
Server running on port 3000
MongoDB connected
```

**Actual Result:**

```
Server started successfully
(But no port listening)
```

### Problem Identified

**Error:** Connection refused - could not connect via curl

**Root Cause Analysis:**

The `server.js` file:

- Created an Express app
- Exported the app
- But **never started listening**

JavaScript execution:

- Ran the file
- Finished (no infinite loop to keep it running)
- Process exited cleanly

### Why This Happened

Mixing concerns in single file:

- Configuration in server.js
- Execution in server.js
- No clear separation

### How It Was Fixed

**Separated responsibilities into two files:**

**server.js** - Start the server:

```javascript
const app = require("./app");
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**app.js** - Configure Express:

```javascript
const express = require("express");
const app = express();

// Configure middlewares
// Define routes
// Export app

module.exports = app;
```

### Key Learning

**Professional Backend Architecture:**

- `app.js` = **What** to do (configuration)
- `server.js` = **How** to do it (execution)
- Clear separation = Easy debugging

### Status

✅ **PASSED** - Server now starts and listens correctly

---

## Task 1.6: MongoDB Installation

### Problem Encountered

**Error Message:**

```
MongoDB connection failed: connect ECONNREFUSED 127.0.0.1:27017
```

**Meaning:** Connection refused at localhost:27017

### Root Cause Analysis

1. Backend tried to connect to MongoDB
2. MongoDB was **NOT running** on the system
3. MongoDB was **NOT installed** on the system

### Verification of Missing MongoDB

**Command:**

```bash
mongod
```

**Error:**

```
mongod: command not found
```

**Conclusion:** MongoDB server doesn't exist on this system

### Installation Steps Performed

#### Step 1: Add MongoDB Repository

```bash
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 0C49F3730359A14518585931BC711F9BA15703C6
```

#### Step 2: Install MongoDB

```bash
sudo apt install mongodb-org
```

#### Step 3: Start MongoDB Service

```bash
sudo systemctl start mongod
```

#### Step 4: Enable Auto-start

```bash
sudo systemctl enable mongod
```

### Verification

**Check MongoDB Status:**

```bash
sudo systemctl status mongod
```

**Expected Output:**

```
● mongod.service - MongoDB Database Server
   Loaded: loaded (/lib/systemd/system/mongod.service; enabled)
   Active: active (running)
```

**Status:** ✅ **ACTIVE (RUNNING)**

### Key Learning

MongoDB must be running as a system service for Node.js connection to work.

### Status

✅ **PASSED** - MongoDB installed, running, and auto-starting

---

## Task 1.7: Environment Configuration (.env)

### Purpose of .env File

The .env file stores sensitive configuration:

```bash
touch .env
```

### Why .env Is Critical

**Without .env:**

- Secrets hardcoded in source code
- Database URLs exposed in Git
- API keys visible to everyone
- Production passwords in repositories

**With .env:**

- Sensitive data kept locally
- Different configs per environment
- Production safe from exposure

### .env File Content

```
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/event_booking
NODE_ENV=development
```

### How .env Is Used

**In app.js:**

```javascript
require("dotenv").config();

const PORT = process.env.PORT;
const MONGO_URI = process.env.MONGO_URI;
```

### Security: .gitignore

**File: .gitignore**

```
node_modules/
.env
.env.local
.DS_Store
```

**Result:** Git will never commit .env files

### Key Learning

`.env` files are:

- Never committed to Git
- Different per developer/environment
- Essential for production security

### Status

✅ **PASSED** - Environment variables configured securely

---

## Task 1.8: Git Repository & Version Control

### Why Version Control?

**Without Git:**

- No backup of code
- No history of changes
- Cannot collaborate
- Cannot rollback errors

**With Git:**

- Complete code history
- Backup on GitHub
- Team collaboration
- Rollback capability

### Git Initialization

**Commands:**

```bash
git init
git add .
git commit -m "EPIC 1: Project initialization"
git remote add origin https://github.com/devak-beep/event-booking-backend.git
git push -u origin main
```

### .gitignore Configuration

**Prevents committing:**

- `node_modules/` - Recreatable from package.json
- `.env` - Contains secrets
- `logs/` - Generated at runtime
- `.DS_Store` - System files

### Why Some Files Don't Appear on GitHub

| Item              | Reason                                             |
| ----------------- | -------------------------------------------------- |
| **node_modules/** | Listed in .gitignore - recreatable via npm install |
| **.env**          | Listed in .gitignore - security (secrets exposure) |
| **Empty folders** | Git tracks files, not folders                      |
| **Logs**          | Generated at runtime, not source code              |

### Important Professional Rule

**This is CORRECT behavior:**

- Only source code goes to Git
- Secrets stay locally
- Dependencies are reproducible from package.json
- Large generated files are excluded

### Status

✅ **PASSED** - Git repository initialized and configured

---

## Final Infrastructure Summary

| Component             | Status         | Details                          |
| --------------------- | -------------- | -------------------------------- |
| **npm project**       | ✅ Ready       | package.json created             |
| **Dependencies**      | ✅ Installed   | All 6 packages + devDependencies |
| **Scripts**           | ✅ Configured  | start and dev commands working   |
| **Project structure** | ✅ Created     | Professional layout established  |
| **Server**            | ✅ Running     | Listening on port 3000           |
| **MongoDB**           | ✅ Running     | Service active and auto-starting |
| **Environment**       | ✅ Configured  | .env file with variables         |
| **Git**               | ✅ Initialized | Repository and .gitignore setup  |

---

## What Was Actually Learned

This EPIC taught:

✔ How backend servers actually start  
✔ How databases connect to applications  
✔ Why servers crash and how to debug  
✔ How services run on Linux systems  
✔ Why environment variables exist  
✔ How Git REALLY works (not just syntax)  
✔ Industry-standard folder structure  
✔ Debugging mindset and problem-solving  
✔ Security best practices (.env)  
✔ Project dependency management

---

## Conclusion

**EPIC 1: Project & Infrastructure Setup is COMPLETE**

All foundational infrastructure is in place:

- ✅ Node.js project initialized
- ✅ Express and MongoDB configured
- ✅ Project structure established
- ✅ Development environment ready
- ✅ Version control configured

**The backend is now ready for business logic implementation (EPIC 2+)**

---

**Report Generated:** February 3, 2026  
**Status:** FINAL - INFRASTRUCTURE READY
