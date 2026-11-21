# 本地运行手册 · 解题答疑视频 SDK

> 适用于本机现状（macOS / Node 22+）。手册分两条独立路径：
> **A. 只跑 SDK**（离线 demo，不需要主项目、不需要大模型、不需要网络）
> **B. 跑完整集成**（外语考证宝典 + LLM + edge-tts + ffmpeg 导出）
>
> 路径 A 用于验证「播放器/时间轴/编辑」；路径 B 用于验证「生成链路」。两者互不依赖。

---

## 0. 目录与角色

| 路径 | 角色 | 说明 |
| --- | --- | --- |
| `~/WorkBuddy/2026-11-21-11-52-51/explain-video-sdk` | **SDK 独立仓库**（git 独立） | 包名 `@waiyu/explain-video`，只负责协议 / 时间轴 / 渲染 / 编辑 |
| `~/WorkBuddy/2026-11-04-12-41-53/waiyu-baodian` | **宿主主项目** | 负责 LLM 生成、TTS 配音、落盘缓存、MP4 导出、页面入口 |
| `<主项目>/.data/explain-video/local/<articleId>/<hash>/` | 生成产物 | `manifest.json` + `seg-N.mp3` + `export.mp4` |

依赖方向是单向的：**主项目通过 `file:` 依赖 SDK，SDK 从不反向依赖主项目**。

---

## 1. 环境准备

```bash
# 1.1 Node（建议 >= 20；本机默认 v22.22.2，/usr/local/bin 下为 v24）
node -v
npm -v

# 1.2 Python（配音依赖，路径 A 不需要）
python3 -V

# 1.3 端口占用检查：4399 = 主项目 API，5190 = SDK demo
lsof -nP -iTCP:4399 -sTCP:LISTEN
lsof -nP -iTCP:5190 -sTCP:LISTEN
```

> 若 `npm run dev` 报 Node 语法/JSON 解析错误，多半是命中了一个旧 Node。用
> `PATH=/usr/local/bin:$PATH npm run ...` 前置高版本 Node 即可。

配音与导出所需的三个外部件，主项目已内置处理，无需手工装：

| 外部件 | 处理方式 | 说明 |
| --- | --- | --- |
| edge-tts | `npm run voice:setup` 建 `.voice-venv` | 缺失时报「本地 edge-tts 未安装」 |
| ffmpeg | `@ffmpeg-installer/ffmpeg` npm 静态二进制 | 不依赖 `brew install ffmpeg`（brew 走网络易卡死） |
| 中文字体 | 用系统字体（PingFang 等） | MP4 烧字幕用，缺失会退化为无字幕画面 |

---

## 2. 路径 A：只跑 SDK（离线 demo）

```bash
cd ~/WorkBuddy/2026-11-21-11-52-51/explain-video-sdk

npm install          # 首次
npm run dev          # → http://localhost:5190
```

demo 用 WebAudio 现场合成极轻正弦波当音轨，因此**没有任何 mp3 也能验证播放、seek、字幕同步、逐字稿编辑**。

```bash
npm run typecheck    # tsc --noEmit
npm test             # 16 个时间轴 / 协议单测（vitest）
npm run build        # 产出 dist/（含 .d.ts 与 styles.css）
npm run build:demo   # 产出 dist-demo/ 静态 demo
```

构建产物结构（宿主实际引用的就这三处）：

```
dist/index.d.ts | dist/explain-video.js | dist/explain-video.cjs   # 核心（框架无关）
dist/react/index.d.ts | dist/react.js | dist/react.cjs             # React 绑定
dist/styles.css                                                    # 样式（build 时从 src 复制）
```

> 注意：`vite` 默认监听 `localhost`（可能只绑 IPv6）。若 `curl 127.0.0.1:5190` 失败，用
> `curl http://localhost:5190` 或 `lsof -nP -iTCP:5190` 看实际绑定地址。

### 在别的项目里引用（三种方式）

```bash
# ① 本地联调（推荐，改 SDK 立即生效）
npm install file:../../2026-11-21-11-52-51/explain-video-sdk

# ② 打包成 tarball 分发
cd explain-video-sdk && npm pack     # 生成 waiyu-explain-video-0.1.0.tgz
# 宿主：npm install ../explain-video-sdk/waiyu-explain-video-0.1.0.tgz

# ③ 发布到私有 registry 后正常安装（需先 npm run build）
```

```tsx
import { ExplainVideoPlayer } from '@waiyu/explain-video/react';
import '@waiyu/explain-video/styles.css';
```

---

## 3. 路径 B：跑完整集成（主项目）

### 3.1 安装与依赖

```bash
cd ~/WorkBuddy/2026-11-04-12-41-53/waiyu-baodian

# package.json 里已声明： "@waiyu/explain-video": "file:../../2026-11-21-11-52-51/explain-video-sdk"
npm install
npm run voice:setup      # 建 .voice-venv 并装 edge-tts（首次或换机时）
```

确认 SDK 软链正常：

```bash
ls -la node_modules/@waiyu/          # explain-video -> ../../2026-11-21-11-52-51/explain-video-sdk
node -e "import('@waiyu/explain-video').then(m=>console.log(typeof m.computeTimeline))"
```

> **改完 SDK 必须 `npm run build`**：宿主读的是 `dist/`，不是 `src/`。
> 主项目 Vite 会跟随软链热更新，但类型与运行时都指向 `dist`。

### 3.2 环境变量（`.env`，已存在则跳过）

| 变量 | 作用 | 缺失后果 |
| --- | --- | --- |
| `PORT=4399` / `HOST=127.0.0.1` | API 监听 | 端口冲突启动失败 |
| `DATA_DIR=./.data` | 数据根目录 | 产物落到别处 |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | 分镜脚本生成 | 报「还没有配置大模型线路」 |
| `LLM_TIMEOUT_MS=90000` | 单次 LLM 超时 | 默认可，脚本慢时建议 ≥ 120000 |
| `EDGE_TTS_PYTHON`（可选） | 指定 python 路径 | 默认用 `.voice-venv/bin/python` |
| `AUTH_REQUIRED=false` | 本地免登录 | 为 true 时音频分段需带 Token |

### 3.3 启动

```bash
npm run dev        # concurrently 起 API(4399) + Web(5173)
# 或分开
npm run dev:api
npm run dev:web
```

页面入口：**任务 → 任一语言的「精读」任务 → 顶部页签「解题答疑视频」**。
页签是懒加载的，首次点击才请求 `/resolve` 并可能触发生成。

### 3.4 从零验证一次生成（不点页面，纯命令行）

```bash
API=http://127.0.0.1:4399/api
AID=8138dace-4e53-4579-b2e1-b85a0cb3facd   # 换成本库里任意有题目的 day_contents.id

# ① 预检缓存：命中则秒开、零 token
curl -s "$API/explain-videos/resolve?articleId=$AID" | python3 -m json.tool

# ② 未命中才创建 job（内部开始跑 script → speech → assemble）
curl -s -X POST "$API/explain-videos" -H 'content-type: application/json' \
  -d "{\"articleId\":\"$AID\"}" | tee /tmp/ev-job.json | python3 -m json.tool

# ③ 轮询（脚本阶段通常 30s~3min，取决于模型）
JOB=$(python3 -c "import json;print(json.load(open('/tmp/ev-job.json'))['job']['id'])")
while :; do
  curl -s "$API/explain-videos/jobs/$JOB" | python3 -c \
    "import sys,json;j=json.load(sys.stdin)['job'];print(j['stage'],j['progress'],j.get('tokens'),j.get('error',''))"
  curl -s "$API/explain-videos/jobs/$JOB" | grep -q '"stage":"done"\|"stage":"error"' && break
  sleep 5
done
```

查库找可用的 articleId：

```bash
node -e "
const D=require('better-sqlite3');const db=new D('.data/app.db',{readonly:true});
console.log(db.prepare(\"SELECT id,substr(title,1,30) t,length(questions) q FROM day_contents WHERE questions!='[]' LIMIT 5\").all());
"
```

### 3.5 接口冒烟（生成完成后）

```bash
VID=<上一步 job.videoId>

curl -s "$API/explain-videos/$VID" | python3 -c "
import sys,json;v=json.load(sys.stdin)['video']
print('shots',len(v['shots']),'cues',len(v['cues']),'totalMs',v['totalMs'])
print('kinds',[s['kind'] for s in v['shots']])
print('answers',[s['highlight']['picked'] for s in v['shots'] if s['kind']=='answer'])"

# 分段音频（页面靠它播放）
curl -s -o /tmp/seg0.mp3 -w "%{http_code} %{content_type}\n" "$API/explain-videos/$VID/seg/0"

# 逐字稿保存
curl -s "$API/explain-videos/$VID" \
  | python3 -c "import sys,json;v=json.load(sys.stdin)['video'];v['cues'][0]['text']='改一句试试';json.dump({'video':v},open('/tmp/ev-tr.json','w'))"
curl -s -X PUT "$API/explain-videos/$VID/transcript" \
  -H 'content-type: application/json' --data-binary @/tmp/ev-tr.json | head -c 200

# MP4 导出（首次约 20~60s，之后直接读缓存文件）
curl -s -X POST "$API/explain-videos/$VID/export"
curl -s -o /tmp/ev.mp4 -w "%{http_code} %{content_type} %{size_download}\n" "$API/explain-videos/$VID/export/file"
file /tmp/ev.mp4
```

---

## 4. 缓存与 token：怎么确认「没白花钱」

| 现象 | 含义 |
| --- | --- |
| `resolve` 返回 `state: "cached"` + `videoId` | 直接读盘，**不创建 job、不调 LLM** |
| `resolve` 返回 `state: "running"` + `job` | 有同参任务在跑，前端续轮询 |
| `POST` 的 job 里 `cacheHit: true`、`tokens: 0` | 命中缓存，本次零消耗 |
| job `tokens.totalTokens ≈ 5000~7500` | 真实一次生成（4 题 22 镜约 7.3k） |

缓存 key：

```
hash(articleId | voice | rate | scriptVersion | 题目文本 | 正文 | 译文)
```

- 改了 prompt / 分镜结构 → 把 `SCRIPT_VERSION`（`server/src/services/explainVideo.ts`）**+1**，旧缓存自然失效。
- 改了音色/语速 → 目前 hash 变、会重新生成；L2 脚本缓存是 v0.4 的任务（见 ITERATION.md）。
- 想强制重生成：前端点「重新生成」（会弹窗告知预计 token），或 `POST { articleId, force: true }`。

清理本地缓存：

```bash
rm -rf <主项目>/.data/explain-video/local/<articleId>/   # 只清一篇
rm -rf <主项目>/.data/explain-video/local/               # 全清（谨慎）
```

---

## 5. 数据落盘结构

```
.data/explain-video/local/<articleId>/<hash>/
├── manifest.json     # ExplainVideo 协议对象 + meta{voice,rate,scriptVersion,usage,model}
├── seg-0.mp3 …       # 逐镜音频（一镜一段，供 seg/:n 直接流出）
└── export.mp4        # POST /export 合成后生成（可选）
```

`manifest.json` 是唯一真相：页面、分段音频、导出都以它为准。手工排查时先看它。

---

## 6. 常见故障排查

| 症状 | 原因 | 处理 |
| --- | --- | --- |
| 生成一直停在 `script` | LLM 慢 / 限流（429） | 看日志；换模型或等配额重置；`LLM_TIMEOUT_MS` 调大 |
| `脚本生成超时（5 分钟）` | 模型响应过慢 | 换 `LLM_MODEL`；或降低单次输出长度 |
| `本地 edge-tts 未安装，请运行 npm run voice:setup` | 缺 python 依赖 | `npm run voice:setup` |
| `本地 Neural 音色名不合法` | 音色 id 不符合 `xx-XX-XxxNeural` | 检查 `voices` 分配或 `.env` |
| 播放器 401 / 音频不响 | 开了鉴权但没带 Token | 本地设 `AUTH_REQUIRED=false`，或确认 `audioUrlResolver` 走鉴权 fetch |
| `还没有导出过这个视频，请先点导出` | 先调了 `/export/file` | 先 `POST /export` |
| 导出报 ffmpeg 相关 | 二进制未安装/不可执行 | 确认 `node_modules/@ffmpeg-installer/ffmpeg` 存在；必要时 `npm install` |
| MP4 里字幕是方块/缺失 | 中文字体路径不存在 | 换字体（`explainExport.ts` 内候选列表） |
| `resolve` 永远 `state:"none"` | 缓存 key 变了（改了正文/题/版本） | 属正常失效；重新生成一次即可 |
| 页面白屏、控制台 `dist/react.js` 404 | SDK 没 build | `cd explain-video-sdk && npm run build` |
| 两个声音同时响 | 播放权未互斥 | 确认 `onRequestPlay` 调了 `claimMediaPlayback('explain')` + `speechSynthesis.cancel()` |
| 端口 4399 被占用 | 已有 dev server 在跑 | 复用现有进程，或 `lsof -ti:4399 \| xargs kill` |

日志位置：

```bash
tail -f <主项目>/.data/server-live.log     # 服务运行日志
grep -i explain <主项目>/.data/server-live.log | tail -30
```

---

## 7. 一键自检清单

```bash
# SDK 侧
cd ~/WorkBuddy/2026-11-21-11-52-51/explain-video-sdk && npm run typecheck && npm test && npm run build

# 宿主侧
cd ~/WorkBuddy/2026-11-04-12-41-53/waiyu-baodian && npm run typecheck && npm run build

# 服务侧
curl -s http://127.0.0.1:4399/api/health
curl -s "http://127.0.0.1:4399/api/explain-videos/resolve?articleId=<任意有题目的 id>"
```

三项全绿即可认为本地环境就绪。

---

## 8. 改动后必须做的事（防踩坑）

1. 改 `explain-video-sdk/src/**` → `npm run build`（宿主不读 src）。
2. 改分镜结构 / prompt → `SCRIPT_VERSION += 1`，否则旧缓存会被当成新内容。
3. 改 `ExplainVideo` 协议字段 → 同步 `src/types.ts`、`src/index.ts` 导出、`test/timeline.test.ts`、`demo/`。
4. 改后端路由 → 注意 `/explain-videos/jobs/:id`、`/resolve` 必须注册在 `/:id` **之前**，否则被通配吃掉。
