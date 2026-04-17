# ldmux - Local dmux for Windows Terminal

Multi-agent orchestrator cho phep chay nhieu Claude Code sessions song song tren Windows Terminal + PowerShell. Khong can cai npm global — chi can clone ve va chay.

## Tai sao can ldmux?

Khi lam du an lon, ban co the chia cong viec cho nhieu AI agent chay cung luc:
- 1 agent lam database schema
- 1 agent lam API endpoints
- 1 agent lam UI components

Thay vi lam tuan tu (30 phut), chay song song chi mat ~10 phut.

## Yeu cau he thong

- **OS:** Windows 10/11
- **Terminal:** Windows Terminal (co san tren Windows 11, hoac tai tu Microsoft Store)
- **Node.js:** >= 18.0.0 ([tai tai day](https://nodejs.org/))
- **Claude Code CLI:** Da cai dat va dang nhap

## Cai dat

### Cach 1: Clone tu GitHub

```powershell
git clone https://github.com/GiaTrong2003/tmux-clone-for-enterprise-machine.git
cd tmux-clone-for-enterprise-machine
npm install
```

### Cach 2: May khong co npm (enterprise machine)

Neu may khong cho cai npm global, lam theo cac buoc:

1. Tai ZIP tu GitHub: **Code > Download ZIP**
2. Giai nen vao thu muc bat ky
3. Copy `node_modules` tu may khac (hoac tai file `node_modules.zip` tu Releases)
4. Giai nen `node_modules` vao thu muc du an

## Cau truc du an

```
ldmux/
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── plan.example.json         # Vi du task plan
└── src/
    ├── index.ts              # CLI entry point
    ├── file-comm.ts          # Doc/ghi file trong .ldmux/
    ├── worker.ts             # Spawn va quan ly agent process
    ├── pane-manager.ts       # Mo Windows Terminal panes qua wt CLI
    ├── orchestrator.ts       # Doc plan.json, tao workers
    ├── merge.ts              # Gop output tu tat ca workers
    └── gui/
        ├── server.ts         # Express API server
        └── public/
            └── index.html    # Web Dashboard
```

## Su dung

### 1. Tao 1 worker don le

```powershell
npx ts-node src/index.ts new "Implement auth middleware for Express"
```

Dat ten cho worker:

```powershell
npx ts-node src/index.ts new "Implement auth middleware" --name auth-worker
```

### 2. Chay tu file plan (JSON)

Tao file `plan.json`:

```json
{
  "name": "my-feature",
  "layout": "vertical",
  "gitWorktree": false,
  "workers": [
    {
      "name": "db-schema",
      "prompt": "Create database schema and migrations for billing feature",
      "cwd": "."
    },
    {
      "name": "api",
      "prompt": "Build REST API endpoints for billing",
      "cwd": "."
    },
    {
      "name": "ui",
      "prompt": "Create React components for billing dashboard",
      "cwd": "."
    }
  ]
}
```

Chay plan:

```powershell
npx ts-node src/index.ts run plan.json
```

Chay khong mo pane (background only):

```powershell
npx ts-node src/index.ts run plan.json --no-pane
```

### 3. Xem trang thai workers

```powershell
npx ts-node src/index.ts list
```

Output:

```
  Workers:

    [>] db-schema - running (started: 10:30:15 AM)
    [+] api - done (started: 10:30:16 AM)
    [!] ui - error (started: 10:30:17 AM)
```

### 4. Mo Web Dashboard (GUI)

```powershell
npx ts-node src/index.ts gui
```

Mo trinh duyet tai: **http://localhost:3700**

Dashboard cho phep:
- Xem danh sach workers real-time (tu dong refresh moi 3 giay)
- Tao worker moi tu giao dien web
- Xem output log cua tung worker
- Stop worker dang chay
- Merge ket qua tat ca workers
- Xoa toan bo worker data

### 5. Gop ket qua (Merge)

```powershell
npx ts-node src/index.ts merge
```

Ket qua duoc ghi vao `.ldmux/merged-output.md`.

### 6. Don dep

```powershell
npx ts-node src/index.ts clean
```

Xoa toan bo thu muc `.ldmux/workers/`.

## Cau hinh Plan JSON

| Truong | Kieu | Mo ta |
|--------|------|-------|
| `name` | string | Ten cua plan |
| `layout` | `"vertical"` \| `"horizontal"` \| `"grid"` | Cach sap xep panes |
| `gitWorktree` | boolean | Tao git worktree rieng cho moi worker |
| `workers` | array | Danh sach workers |
| `workers[].name` | string | Ten worker (duy nhat) |
| `workers[].prompt` | string | Prompt gui cho AI agent |
| `workers[].cwd` | string | Thu muc lam viec (mac dinh: `.`) |
| `workers[].agent` | string | Agent su dung (mac dinh: `claude`) |

## Git Worktree

Khi cac worker co the chinh sua cung file, bat `gitWorktree: true` de tao nhanh rieng cho moi worker:

```json
{
  "name": "big-feature",
  "gitWorktree": true,
  "workers": [
    { "name": "auth", "prompt": "Implement auth module" },
    { "name": "billing", "prompt": "Implement billing module" }
  ]
}
```

ldmux se tu dong:
1. Tao branch `ldmux/big-feature/auth` va `ldmux/big-feature/billing`
2. Tao worktree rieng cho moi branch
3. Chay agent trong worktree tuong ung

Sau khi xong, merge bang git:

```powershell
git merge ldmux/big-feature/auth
git merge ldmux/big-feature/billing
```

## Cac mau quy trinh (Workflow Patterns)

### Pattern 1: Nghien cuu + Trien khai

```json
{
  "name": "research-implement",
  "workers": [
    { "name": "research", "prompt": "Research best practices for rate limiting in Node.js. Write findings to /tmp/research.md" },
    { "name": "implement", "prompt": "Implement rate limiting middleware for Express API" }
  ]
}
```

### Pattern 2: Test + Fix

```json
{
  "name": "test-fix",
  "workers": [
    { "name": "tester", "prompt": "Run the test suite and summarize all failures" },
    { "name": "fixer", "prompt": "Fix the failing tests in src/api/" }
  ]
}
```

### Pattern 3: Code Review song song

```json
{
  "name": "review-pipeline",
  "workers": [
    { "name": "security", "prompt": "Review src/api/ for security vulnerabilities" },
    { "name": "performance", "prompt": "Review src/api/ for performance issues" },
    { "name": "coverage", "prompt": "Review src/api/ for test coverage gaps" }
  ]
}
```

## Luu y quan trong

1. **Chi chay song song cac task doc lap** — khong chia task co phu thuoc lan nhau
2. **Moi pane lam viec tren file rieng** — tranh xung dot
3. **Giu so pane duoi 5-6** — moi pane tieu ton API token
4. **Kiem tra output truoc khi merge** — tranh merge code loi
5. **Dung git worktree** khi cac worker co the chinh sua cung file

## Xu ly su co

| Van de | Giai phap |
|--------|-----------|
| `wt` khong tim thay | Cai Windows Terminal tu Microsoft Store |
| `claude` khong tim thay | Cai Claude Code CLI: `npm install -g @anthropic-ai/claude-code` |
| Worker khong phan hoi | Chay `list` de kiem tra status, hoac `clean` roi chay lai |
| Port 3700 da dung | Sua port trong `src/gui/server.ts` |
| Permission denied khi tao worktree | Kiem tra quyen git va thu muc hien tai |

## License

MIT
