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

### Cach 3: Cai lam lenh global `ldmux`

Sau khi da clone/giai nen va `npm install`, chay 1 lan duy nhat:

```powershell
npm run build    # Bien dich TypeScript -> dist/
npm link         # Dang ky lenh `ldmux` toan cuc
```

Sau do mo **bat ky terminal nao** va go truc tiep:

```powershell
ldmux help
ldmux new "Implement auth middleware"
ldmux run plan.json
ldmux gui
```

Khong can `npx ts-node src/index.ts ...` nua. Moi lan sua code TypeScript trong `src/` chi can chay lai `npm run build` — khong can `npm link` lai.

**Lenh `ldmux` chay trong thu muc hien tai (`cwd`)**, nen thu muc `.ldmux/workers/` se duoc tao ngay tai project ban dang dung. Dung project nao, chay o project do.

**Go bo:** `npm unlink -g ldmux`

**Windows:** `npm link` tu dong tao `ldmux.cmd` trong thu muc npm global (da co san trong PATH).
**Mac/Linux:** `npm link` tao symlink trong `$(npm config get prefix)/bin`. Neu go `ldmux` khong thay, kiem tra PATH co thu muc do chua.

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

> **Ghi chu ve cu phap:** Tat ca vi du duoi day deu dung lenh global `ldmux` (sau khi da `npm link`). Neu ban chua cai global, thay `ldmux` bang `npx ts-node src/index.ts` — ket qua giong het.

### Tong quan cac lenh

| Lenh | Muc dich |
|------|----------|
| `ldmux new <prompt>` | Tao 1 worker don le o background |
| `ldmux run <plan.json>` | Chay nhieu worker theo plan (mo panes + background) |
| `ldmux list` | Liet ke tat ca worker va trang thai |
| `ldmux merge` | Gop output tat ca worker vao `.ldmux/merged-output.md` |
| `ldmux gui` | Mo web dashboard o http://localhost:3700 |
| `ldmux clean` | Xoa toan bo `.ldmux/workers/` |
| `ldmux help` | In huong dan |

### 1. Tao 1 worker don le

```powershell
ldmux new "Implement auth middleware for Express"
```

Dat ten cho worker:

```powershell
ldmux new "Implement auth middleware" --name auth-worker
```

Worker chay ngam o background, output ghi vao `.ldmux/workers/<name>/output.log`.

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
ldmux run plan.json
```

Chay khong mo pane (background only) — huu ich khi dang dung Linux/Mac hoac khi khong muon mo nhieu cua so:

```powershell
ldmux run plan.json --no-pane
```

**Luong thuc thi noi bo:**
1. Neu `gitWorktree: true`, tao `git worktree` + branch rieng (`ldmux/<plan>/<worker>`) cho moi worker.
2. Voi moi worker: mo 1 Windows Terminal pane chay `claude -p '<prompt>'` (neu bat `--pane`).
3. **Dong thoi** spawn 1 tien trinh background cung nhiem vu — de ghi log vao `.ldmux/workers/<name>/output.log` cho `list`/`merge`/GUI doc.

### 3. Xem trang thai workers

```powershell
ldmux list
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
ldmux gui
```

Mo trinh duyet tai: **http://localhost:3700**

**Web chi de xem/thao tac** — CLI va GUI doc chung `.ldmux/workers/`, nen moi thay doi o mot phia deu phan anh ben kia. Ban khong bat buoc phai mo GUI; chi can thich thi mo.

Dashboard cho phep:
- Xem danh sach workers real-time (tu dong refresh moi 3 giay)
- Tao worker moi tu giao dien web
- Xem output log cua tung worker
- Stop worker dang chay
- Merge ket qua tat ca workers
- Xoa toan bo worker data

**REST API** (huu ich neu muon tich hop script khac):

| Method | Endpoint | Mo ta |
|--------|----------|-------|
| GET | `/api/workers` | Danh sach workers |
| GET | `/api/workers/:name/status` | Status 1 worker |
| GET | `/api/workers/:name/output` | Output log 1 worker |
| POST | `/api/workers` | Tao worker moi (`{name, prompt, cwd?, agent?}`) |
| POST | `/api/workers/:name/stop` | Dung 1 worker |
| POST | `/api/merge` | Merge tat ca outputs |
| POST | `/api/clean` | Xoa worker data |

### 5. Gop ket qua (Merge)

```powershell
ldmux merge
```

Ket qua duoc ghi vao `.ldmux/merged-output.md` — file Markdown co heading cho moi worker, kem status, timestamp va full output trong code block.

### 6. Don dep

```powershell
ldmux clean
```

Xoa toan bo thu muc `.ldmux/workers/`. Khong xoa file `.ldmux/merged-output.md` da tao truoc do.

## Cau hinh Plan JSON

| Truong | Kieu | Bat buoc | Mo ta |
|--------|------|----------|-------|
| `name` | string | co | Ten cua plan (dung lam prefix branch khi `gitWorktree: true`) |
| `layout` | `"vertical"` \| `"horizontal"` \| `"grid"` | khong | Cach sap xep panes — mac dinh `vertical` |
| `gitWorktree` | boolean | khong | Tao git worktree rieng cho moi worker — mac dinh `false` |
| `workers` | array | co | Danh sach workers (toi thieu 1) |
| `workers[].name` | string | co | Ten worker, duy nhat, filesystem-safe (khong chua `/`, `\`, space) |
| `workers[].prompt` | string | co | Prompt gui cho AI agent |
| `workers[].cwd` | string | khong | Thu muc lam viec — mac dinh la thu muc goc cua plan |
| `workers[].agent` | string | khong | `"claude"` (mac dinh), `"codex"`, hoac lenh bat ky tren PATH |

**Cach worker goi agent:**
- `claude` → `claude -p "<prompt>"`
- `codex` → `codex exec --task "<prompt>"`
- Khac → `<agent> "<prompt>"`

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

## Cau truc thu muc `.ldmux/`

Khi chay, ldmux tao thu muc sau trong project:

```
.ldmux/
├── merged-output.md              # Tao boi `ldmux merge`
└── workers/
    └── <worker-name>/
        ├── task.md               # Prompt da gui cho agent
        ├── status.json           # { name, status, pid, startedAt, finishedAt, error? }
        └── output.log            # stdout + stderr cua agent
```

Thu muc `.ldmux/` da co trong `.gitignore` nen khong bi commit len repo.

**Giao thuc IPC:** CLI va GUI khong giao tiep truc tiep voi nhau — ca 2 deu doc/ghi thu muc nay. Nho vay khong can daemon, khong co state trong memory, va ban co the dong cua CLI bat cu luc nao ma worker background van chay tiep.

## Luu y quan trong

1. **Chi chay song song cac task doc lap** — khong chia task co phu thuoc lan nhau (worker A can ket qua worker B thi phai chay tuan tu).
2. **Moi pane lam viec tren file rieng** — tranh xung dot khi 2 worker cung ghi 1 file.
3. **Giu so pane duoi 5-6** — moi pane tieu ton API token va RAM rieng.
4. **Kiem tra output truoc khi merge** — tranh merge code loi; dung `ldmux list` xem co worker nao `error` khong.
5. **Dung git worktree** khi cac worker co the chinh sua cung file — moi worker co branch rieng, merge bang `git merge` sau.
6. **Worker name phai duy nhat** — chay 2 lan cung ten se ghi de status cua lan truoc.
7. **Khi dung CLI, tien trinh background van tiep tuc** — muon dung hay go `ldmux` qua web GUI hoac `ldmux clean` roi chay lai.

## Xu ly su co

| Van de | Giai phap |
|--------|-----------|
| `wt` khong tim thay | Cai Windows Terminal tu Microsoft Store |
| `claude` khong tim thay | Cai Claude Code CLI: `npm install -g @anthropic-ai/claude-code` |
| `ldmux` khong tim thay | Chua chay `npm link`, hoac thu muc npm global chua co trong PATH (kiem tra: `npm config get prefix`) |
| Worker khong phan hoi | Chay `ldmux list` de kiem tra status, hoac `ldmux clean` roi chay lai |
| Port 3700 da dung | Sua hang so `PORT` trong `src/gui/server.ts` va build lai |
| Permission denied khi tao worktree | Kiem tra quyen git va thu muc hien tai |
| Pane khong mo tren Mac/Linux | Dung — `wt` chi co tren Windows. Dung `ldmux run plan.json --no-pane` va xem output qua `ldmux gui` |
| Sua code TS xong khong thay cap nhat | Quen chay `npm run build` — lenh `ldmux` toan cuc tro toi `dist/` chu khong phai `src/` |

## License

MIT
