<p align="center">
  <img src="https://raw.githubusercontent.com/ShiftlineTools/gen-image-factory/main/src/renderer/assets/logo-square.svg" width="100" alt="Gen Image Factory Logo" />
</p>

<h1 align="center">Gen Image Factory</h1>

<p align="center">
  <img src="https://img.shields.io/github/v/release/ShiftlineTools/gen-image-factory?label=Latest%20Release&color=3b82f6&style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/Security-AES--256--GCM-blueviolet?style=flat-square" alt="Security" />
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/github/license/ShiftlineTools/gen-image-factory?style=flat-square&color=white" alt="License" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Made%20by-Shiftline%20Tools-3b82f6?style=flat-square" alt="Made by Shiftline Tools" />
  <img src="https://img.shields.io/badge/Status-Active%20Development-success?style=flat-square" alt="Status" />
  <a href="https://ko-fi.com/shiftlinetools"><img src="https://img.shields.io/badge/Support%20on-Ko--fi-ff5f5f?style=flat-square&logo=ko-fi&logoColor=white" alt="Support on Ko-fi" /></a>
</p>

**Made by Shiftline Tools**

AI-powered image generation application built with Electron, React, and TypeScript. Generate high-quality images using AI models with advanced quality control and metadata generation.

## Overview

Gen Image Factory is a desktop application that streamlines the image generation workflow by combining AI-powered image creation, automated quality checks, and comprehensive metadata generation. The application provides an intuitive graphical interface for managing image generation jobs, reviewing results, and exporting data.

[![Watch the Trailer](https://img.youtube.com/vi/GjooSAGE5NA/maxresdefault.jpg)](https://youtu.be/GjooSAGE5NA)

## Installation

### Microsoft Store (Windows)

The recommended way to install on Windows is via the Microsoft Store:
- Automatic updates
- Trusted installation

[**Get it from Microsoft Store**](https://apps.microsoft.com/detail/9P761655KPBW)

### GitHub Releases

For Windows (advanced users), macOS, and Linux, download installers from [GitHub Releases](https://github.com/ShiftlineTools/gen-image-factory/releases):

- **Windows**: NSIS installer or portable executable
- **macOS**: DMG or ZIP archive
- **Linux**: AppImage or DEB package

**Note**: GitHub Releases installers are unsigned and may trigger security warnings.

## Quick Start

1. **Install the application** using one of the methods above
2. **Launch Gen Image Factory**
3. **Configure API keys** in Settings:
   - OpenAI API key (for prompt generation and quality checks)
   - Runware API key (for image generation)
   - Remove.bg API key (optional, for background removal)
4. **Set up your workflow**:
   - Select input files (keyword files, custom prompt templates)
   - Configure image generation parameters
   - Enable quality checks and metadata generation as needed
5. **Start generating** from the Dashboard

For detailed documentation, visit our [documentation website](https://genimage.shiftlinetools.com).

## Documentation

Comprehensive documentation is available at:

**📚 [genimage.shiftlinetools.com](https://genimage.shiftlinetools.com)**

The documentation includes:
- Getting started guides
- User manual
- Troubleshooting
- API configuration
- Advanced features

## Features

- **AI-Powered Image Generation**: Generate images using advanced AI models
- **Quality Control**: Automated quality checks using AI vision models
- **Metadata Generation**: Automatic title, description, and tag generation
- **Job Management**: Save and reuse job configurations
- **Export Options**: Export metadata to Excel or package images with metadata in ZIP files
- **Cross-Platform**: Available for Windows, macOS, and Linux

## Support

- **Email**: [admin@shiftlinetools.com](mailto:admin@shiftlinetools.com)
- **GitHub Issues**: [Report a bug or request a feature](https://github.com/ShiftlineTools/gen-image-factory/issues)
- **Documentation**: [genimage.shiftlinetools.com](https://genimage.shiftlinetools.com)

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Security

For security concerns, vulnerability reporting, and our security policy, please see [SECURITY.md](SECURITY.md).

## Contributing

**About Shiftline Tools**: Shiftline Tools is a single developer organization. All development is done by one person with limited time and resources.

**Current Status**: Shiftline Tools not currently accepting code contributions at this time. I appreciate your interest, but I don't have the bandwidth to properly review and manage contributions right now.

**Future**: We may open up contributions in the future once I have established a strict and effective process for accepting and managing code contributions. In the meantime, I welcome:
- Bug reports via [GitHub Issues](https://github.com/ShiftlineTools/gen-image-factory/issues)
- Feature requests via [GitHub Issues](https://github.com/ShiftlineTools/gen-image-factory/issues)
- Documentation improvements and feedback

## For Developers

### Agentic Memory Integration

This project uses an **Obsidian + Qdrant + MCP** architecture to provide AI agents with persistent, semantic memory across development sessions.

**What this means:**
- AI assistants can search project knowledge (ADRs, stories, standards) semantically
- **70-80% reduction** in context window usage (no need to load 40+ documents)
- **<200ms query latency** for instant access to architectural constraints
- **Persistent memory** survives across chat sessions

**Components:**

1. **Obsidian Vault** (Source of Truth)
   - Location: `~/Documents/Obsidian/BMad-Projects/gen-image-factory/`
   - Contains all project documentation with knowledge graph features

2. **Symlink** (`./docs`)
   - Points to Obsidian vault for IDE visibility
   - Added to `.gitignore` (user-specific path)

3. **Qdrant Vector Database** (Local Docker)
   - Semantic search over project knowledge
   - 2 collections: knowledge + best-practices

4. **MCP Integration** (Cursor IDE)
   - AI agents query memory via Model Context Protocol
   - Configured in `.cursor/mcp_config.json`

**Quick Setup:**

```bash
# 1. Create Obsidian vault and symlink
mkdir -p ~/Documents/Obsidian/BMad-Projects/gen-image-factory
ln -s ~/Documents/Obsidian/BMad-Projects/gen-image-factory ./docs

# 2. Start Qdrant (requires Docker/Colima)
docker run -d --name bmad-qdrant -p 6333:6333 qdrant/qdrant:latest

# 3. See full setup guides:
# - docs/architecture/obsidian-setup.md
# - docs/architecture/mcp-setup.md
```

**Setup Time:** ~30 minutes for first-time setup

**Troubleshooting:** See `docs/architecture/mcp-troubleshooting.md`

### Commit Convention

All commits to `main` must use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format:

```
<type>(<scope>): <description>
```

The `<scope>` is optional. The `<description>` must be lowercase and not end with a period.

**Active types and their release-note categories:**

| Type | Category | Example |
|---|---|---|
| `feat` | 🚀 Features | `feat(jobs): add parameter regeneration support` |
| `fix` | 🐛 Bug Fixes | `fix(database): resolve sqlite3 connection leak on stop` |
| `perf` | ⚡ Performance | `perf(renderer): replace react-window scan with virtualized grid` |
| `refactor` | ♻️ Refactoring | `refactor(retry): extract RetryQueueService from retryExecutor` |

Other types (`chore`, `docs`, `test`, `ci`, `build`) are allowed and will appear under **📦 Other Changes** in the release body.

The machine-readable source of truth for category mapping is [`.github/release-notes-config.json`](.github/release-notes-config.json).

## Made by Shiftline Tools

Gen Image Factory is developed and maintained by an individual developer under the **Shiftline Tools** brand, a software development studio focused on creating tools that enhance productivity.

---

**Note**: This application requires API keys for OpenAI and Runware services. These keys are stored securely using your operating system's credential manager. See [SECURITY.md](SECURITY.md) for details on data handling and security practices.

