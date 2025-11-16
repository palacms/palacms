<div align="center">

# Pala CMS

### the next-gen monolithic CMS for dev control & editor joy

build reusable components, edit content visually, and host a hundred static sites on a single server.

[Website](https://palacms.com) • [Documentation](https://palacms.com/docs) • [Cloud Hosting](https://palacms.com/cloud)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.com/deploy/palacms?referralCode=RCPU7k)

</div>

---

![Pala Screenshot](https://pala-pullzone.b-cdn.net/pala-trimmed-browser.jpeg)

---

## Overview

Pala is a component-based CMS that gives developers full code control while providing clients with a foolproof editing experience.

**The Problem:**

Traditional website development creates tension between developers and content editors:

- Developers need code control and modern tooling
- Clients need a simple, visual editing experience
- WordPress lets clients break designs
- Headless CMSs have terrible client UX
- Webflow is expensive and limiting

**The Solution:**

Pala couples code and content in self-contained blocks. Developers write reusable components with built-in content schemas. Editors work visually within those guardrails. Changes sync in realtime, and both work in the same environment without stepping on each other's toes.

## Features

- **Code-First Development** - Write reusable blocks with Svelte and zero setup. Powerful in-browser IDE, instant responsive previews. Edit code, add fields, done.
- **Client-Proof Editing** - Give clients full content control while keeping design and structure locked down. You define the guardrails, they work freely within them.
- **Block Library** - Build blocks once, reuse across all your sites. Browse the marketplace for prebuilt starter sites and blocks.
- **Built-in Hosting** - Static site generation with hosting included. Deploy blazing-fast, secure, SEO-optimized sites with ease.

## Who It's For

- Freelancers building sites for local businesses
- Small agencies managing multiple client sites
- In-house developers building internal & marketing sites
- Weekend devs building sites for friends and family
- Anyone tired of "the website broke 😩" texts

## Getting Started

### Pala Cloud (Recommended)

Managed hosting with automatic SSL, global CDN, and zero setup required.

→ [palacms.com/cloud](https://palacms.com/cloud)

### Self-Hosted

Run Pala on your own infrastructure for complete control.

**Quick Deploy:**
- [Railway](https://railway.com/deploy/palacms?referralCode=RCPU7k) - One-click deployment (from $5/month)
- [Fly.io](https://fly.io) - Free tier with 3GB persistent volume

**VPS Hosting:**
- [Hetzner Cloud](https://cloud.hetzner.com) - From €4/month
- [DigitalOcean](https://www.digitalocean.com) - From $6/month

**Local Development:**

```bash
git clone https://github.com/palacms/palacms.git
cd palacms
npm install
npm run build
npm run dev
```

Access points:
- Main app: http://localhost:5173
- PocketBase Admin: http://localhost:8090/_
- Built app: http://localhost:8090

**Note:** Local development is for testing only. For production, deploy to a persistent server since all code and content lives in the database.

## Documentation

Full documentation available at [palacms.com/docs](https://palacms.com/docs)

- [Core Concepts](https://palacms.com/docs/getting-started/core-concepts) - Understanding Pala's architecture
- [Quickstart](https://palacms.com/docs/getting-started/quickstart) - Create your first site in 5 minutes
- [Installation](https://palacms.com/docs/getting-started/installation) - Detailed setup instructions
- [Writing Blocks](https://palacms.com/docs/building-sites/writing-blocks) - Learn to build custom blocks
- [Architecture](https://palacms.com/docs/reference/architecture) - How Pala works under the hood

## Technology Stack

**Frontend:**
- SvelteKit 2 & Svelte 5
- TailwindCSS
- CodeMirror 6
- TipTap 2

**Backend:**
- Golang
- PocketBase
- SQLite 3

## Architecture Highlights

- **Single Application** - SvelteKit frontend + PocketBase backend in one binary
- **Database-First** - Code and content coupled at the component level, both in SQLite
- **Client-Side Compilation** - Svelte compilation happens in browser using Web Workers
- **Static Output** - Generates optimized static HTML/CSS/JS for fast delivery
- **Realtime Collaboration** - Multiple users can edit simultaneously
