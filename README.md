# Pala CMS (formerly Primo) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT) [![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev) ![](https://img.shields.io/badge/PocketBase-555555?logo=pocketbase&logoColor=white)

Pala is a component-based CMS that streamlines development and content management by putting code and content in the same place. Developers get full code control with a browser-based IDE, editors get focused visual content editing, and visitors get sub-second loading speeds.

**One-click deploy:**

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/palacms?referralCode=RCPU7k)

![screenshot](https://cdn.primo.page/f52960e1-0bb0-4c64-9f70-5a9994ce95fc/staging/_images/1739675414227Screenshot%202025-02-15%20at%2010.10.10%E2%80%AFPM.png)

## Why Pala

Pala gives developers **code control** while giving editors **content freedom** - without either breaking the other's work.

- **Monolithic**: Build and host your sites from the same deployment, no external services needed. Powered by [PocketBase](https://pocketbase.io).
- **Code-First Development**: Build reusable blocks with [Svelte](https://svelte.dev) in a powerful in-browser IDE with instant previews.
- **Visual Content Editing**: You define the guardrails, editors work freely within them. No more "I broke the website" texts.
- **Block Library**: Build blocks once, reuse across all your sites. Browse the marketplace for pre-built templates and blocks.
- **Page Types**: Define custom page types for all types of content: posts, people, events, locations, projects, anything.
- **Multisite by Default**: Publish hundreds of sites from a single server, just connect a domain name for each new site.
- **Static Output**: Sites deploy as clean, secure, SEO-optimized static HTML for sub-second loading speeds.
- **Self-Hosted**: Host on Railway, Fly.io, Hetzner, or any Docker-compatible platform.

## Getting Started

After deploying, create your first site by accessing the server from your domain.

**Next steps:**
1. **[Read the Quickstart](https://docs.palacms.com/getting-started/quickstart)** - Get oriented with key concepts
2. **[Build Your First Site](https://docs.palacms.com/building-sites/your-first-site)** - Step-by-step guide
3. **[Create Blocks](https://docs.palacms.com/building-sites/writing-components)** - Build reusable components with Svelte

## Documentation
- **[Installation](https://docs.palacms.com/getting-started/installation)** - Self-host or run locally
- **[Quickstart](https://docs.palacms.com/getting-started/quickstart)** - Key concepts and getting started
- **[Writing Blocks](https://docs.palacms.com/building-sites/writing-components)** - Build custom Svelte components
- **[Field Types](https://docs.palacms.com/reference/field-types)** - Available content field types
- **[Managing Sites](https://docs.palacms.com/dashboard/managing-sites)** - Organize sites with groups
- **[Page Types](https://docs.palacms.com/building-sites/defining-page-types)** - Define page structure and available blocks
- **[Collaboration](https://docs.palacms.com/collaboration/inviting-collaborators)** - Working with editors and teams
- **[Keyboard Shortcuts](https://docs.palacms.com/reference/keyboard-shortcuts)** - Power user reference

## Deploy

The easiest way to deploy Pala is on Railway.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/palacms?referralCode=RCPU7k)

You can also host Pala on any platform that supports Docker:

```bash
docker run -d -p 8080:8080 -v palacms-data:/app/pb_data ghcr.io/palacms/palacms:latest
```

**[See full deployment guide →](https://docs.palacms.com/getting-started/installation)**


## Community

- **[GitHub Issues](https://github.com/palacms/palacms/issues)** - Report bugs or request features
- **[GitHub Discussions](https://github.com/palacms/palacms/discussions)** - Ask questions

## License

[MIT](./LICENSE)
